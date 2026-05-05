import asyncio
import base64
import json
import warnings

# Must be FIRST — suppresses FutureWarning spam from YOLOv5 torch.cuda.amp
warnings.filterwarnings("ignore", category=FutureWarning)
warnings.filterwarnings("ignore", category=UserWarning)

import cv2
import mediapipe as mp
import numpy as np


from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

from pose.detector import detect_person
from pose.angles import knee_flexion, spine_angle, elbow_flexion
from pose.feedback import get_feedback
from pose.rep_counter import count_rep, get_phase, reset_reps
from app_utils.smoothing import smooth, reset as reset_smooth

app = FastAPI()
app.add_middleware(
    CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"],
)

mp_pose       = mp.solutions.pose
VIS_THRESHOLD = 0.45   # slightly lower to catch more landmarks

# ── Helpers ────────────────────────────────────────────────────────────────────

def _pt(lm, idx, w, h):
    return [lm[idx].x * w, lm[idx].y * h]

def _all_visible(lm, *indices):
    return all(lm[i].visibility >= VIS_THRESHOLD for i in indices)

def _landmarks_payload(lm):
    return [
        {"x": round(p.x, 4), "y": round(p.y, 4), "vis": round(p.visibility, 3)}
        for p in lm
    ]

def _choose_side(lm):
    l = min(lm[11].visibility, lm[23].visibility, lm[25].visibility)
    r = min(lm[12].visibility, lm[24].visibility, lm[26].visibility)
    return "left" if l >= r else "right"

def _decode_b64_frame(b64: str):
    """Decode base64 JPEG string → BGR numpy array."""
    try:
        raw   = base64.b64decode(b64)
        arr   = np.frombuffer(raw, dtype=np.uint8)
        frame = cv2.imdecode(arr, cv2.IMREAD_COLOR)
        return frame
    except Exception as e:
        print(f"[Frame decode error] {e}")
        return None

# ── WebSocket ──────────────────────────────────────────────────────────────────

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    print("[WS] Client connected")

    pose = mp_pose.Pose(
        static_image_mode=False,
        model_complexity=1,
        smooth_landmarks=True,
        min_detection_confidence=0.5,
        min_tracking_confidence=0.5,
    )

    exercise     = "squat"
    bbox         = None
    frame_count  = 0
    no_det_count = 0

    try:
        while True:
            # All messages are JSON text — simple and reliable
            try:
                raw = await websocket.receive_text()
            except WebSocketDisconnect:
                break

            try:
                msg = json.loads(raw)
            except Exception:
                continue

            mtype = msg.get("type", "")

            # ── Control messages ──────────────────────────────────────────
            if mtype == "set_exercise":
                new_ex = msg.get("exercise", exercise)
                if new_ex != exercise:
                    exercise = new_ex
                    reset_smooth()
                    reset_reps(exercise)
                    bbox = None
                    print(f"[WS] Exercise → {exercise}")
                continue

            if mtype == "reset_reps":
                reset_reps(exercise)
                continue

            # ── Video frame ───────────────────────────────────────────────
            if mtype != "frame":
                continue

            b64 = msg.get("data", "")
            if not b64:
                continue

            frame = _decode_b64_frame(b64)
            if frame is None:
                continue

            frame_count += 1

            # ── YOLOv5 person detection ───────────────────────────────────
            bbox = detect_person(frame, bbox, frame_count, redetect_every=10)

            if bbox is None:
                no_det_count += 1
                if no_det_count >= 2:
                    reps = count_rep(exercise, 180.0, 180.0)
                    await websocket.send_text(json.dumps({
                        "feedback":  "No person detected — step into frame",
                        "severity":  "warning",
                        "reps":      reps,
                        "landmarks": [],
                        "bbox":      None,
                    }))
                continue

            no_det_count = 0

            # ── MediaPipe pose on cropped region ──────────────────────────
            x1, y1, x2, y2 = bbox
            crop = frame[y1:y2, x1:x2]
            if crop.size == 0:
                continue

            rgb    = cv2.cvtColor(crop, cv2.COLOR_BGR2RGB)
            result = pose.process(rgb)

            if not result.pose_landmarks:
                reps = count_rep(exercise, 180.0, 180.0)
                await websocket.send_text(json.dumps({
                    "feedback":  "Position yourself in frame",
                    "severity":  "warning",
                    "reps":      reps,
                    "landmarks": [],
                    "bbox":      list(bbox),
                }))
                continue

            # ── Compute angles ────────────────────────────────────────────
            lm   = result.pose_landmarks.landmark
            h, w = crop.shape[:2]

            side = _choose_side(lm)
            off  = 0 if side == "left" else 1

            shoulder = _pt(lm, 11 + off, w, h)
            elbow_pt = _pt(lm, 13 + off, w, h)
            wrist    = _pt(lm, 15 + off, w, h)
            hip      = _pt(lm, 23 + off, w, h)
            knee_pt  = _pt(lm, 25 + off, w, h)
            ankle    = _pt(lm, 27 + off, w, h)

            if not _all_visible(lm, 11 + off, 23 + off, 25 + off, 27 + off):
                reps = count_rep(exercise, 180.0, 180.0)
                await websocket.send_text(json.dumps({
                    "feedback":  "Step back — show full body",
                    "severity":  "warning",
                    "reps":      reps,
                    "landmarks": _landmarks_payload(lm),
                    "bbox":      list(bbox),
                }))
                continue

            k_angle = smooth(knee_flexion(hip, knee_pt, ankle),       key="knee",  window=4)
            b_angle = smooth(spine_angle(shoulder, hip, knee_pt),      key="back",  window=4)
            e_angle = smooth(elbow_flexion(shoulder, elbow_pt, wrist), key="elbow", window=4)

            fb   = get_feedback(exercise, k_angle, b_angle, e_angle)
            reps = count_rep(exercise, k_angle, e_angle)

            await websocket.send_text(json.dumps({
                "exercise":    exercise,
                "knee_angle":  round(k_angle, 1),
                "back_angle":  round(b_angle, 1),
                "elbow_angle": round(e_angle, 1),
                "feedback":    fb.message,
                "severity":    fb.severity,
                "reps":        reps,
                "phase":       get_phase(exercise).upper(),   # "UP" | "DOWN"
                "bbox":        list(bbox),
                "landmarks":   _landmarks_payload(lm),
            }))

    except (WebSocketDisconnect, Exception) as e:
        err = str(e).strip()
        if err:  # only print non-empty errors (WebSocketDisconnect has no message)
            print(f"[WS] Error: {err}")
    finally:
        pose.close()
        print("[WS] Disconnected & cleaned up")


@app.get("/health")
def health():
    return {"status": "ok"}
