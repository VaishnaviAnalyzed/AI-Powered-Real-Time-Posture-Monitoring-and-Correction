"""
Live posture monitor test.
Press:  1 = squat   2 = deadlift   3 = benchpress
        R = reset reps   Q = quit
"""

import warnings
warnings.filterwarnings("ignore")

import cv2
import mediapipe as mp

from pose.detector    import detect_person
from pose.angles      import knee_flexion, spine_angle, elbow_flexion
from pose.feedback    import get_feedback
from pose.rep_counter import count_rep, get_phase, reset_reps
from pose.voice       import speak
from app_utils.smoothing  import smooth

# ── Setup ─────────────────────────────────────────────────────────────────────
mp_pose = mp.solutions.pose
mp_draw = mp.solutions.drawing_utils

pose = mp_pose.Pose(
    static_image_mode=False,
    model_complexity=0,
    smooth_landmarks=True,
    min_detection_confidence=0.5,
    min_tracking_confidence=0.5,
)

cap = cv2.VideoCapture(0)
cap.set(cv2.CAP_PROP_FRAME_WIDTH,  640)
cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 480)
cap.set(cv2.CAP_PROP_FPS, 30)

exercise    = "squat"
bbox        = None
frame_count = 0

SEVERITY_COLOR = {
    "error":   (0, 0, 255),      # red
    "warning": (0, 140, 255),    # orange
    "good":    (0, 210, 0),      # green
}

print("=" * 45)
print("  Posture Monitor — Live Test")
print("  1=Squat  2=Deadlift  3=Benchpress")
print("  R=Reset reps   Q=Quit")
print("=" * 45)


def draw_text(img, text, pos, color, scale=0.65, thickness=2):
    cv2.putText(img, text, pos, cv2.FONT_HERSHEY_SIMPLEX,
                scale, (0, 0, 0), thickness + 2)   # black shadow
    cv2.putText(img, text, pos, cv2.FONT_HERSHEY_SIMPLEX,
                scale, color, thickness)


def draw_angle_arc(img, pt, angle_val, color):
    """Draw a small circle + angle value near a joint."""
    x, y = int(pt[0]), int(pt[1])
    cv2.circle(img, (x, y), 6, color, -1)
    cv2.putText(img, f"{angle_val:.0f}", (x + 8, y - 8),
                cv2.FONT_HERSHEY_SIMPLEX, 0.45, color, 1)


# ── Main loop ─────────────────────────────────────────────────────────────────
while True:
    ret, frame = cap.read()
    if not ret:
        print("Camera not found")
        break

    frame_count += 1
    frame = cv2.resize(frame, (640, 480))
    display = frame.copy()

    key = cv2.waitKey(1) & 0xFF
    if key == ord('q'):
        break
    elif key == ord('1'):
        exercise = "squat"
        reset_reps("squat")
        print(">> Switched to SQUAT")
    elif key == ord('2'):
        exercise = "deadlift"
        reset_reps("deadlift")
        print(">> Switched to DEADLIFT")
    elif key == ord('3'):
        exercise = "benchpress"
        reset_reps("benchpress")
        print(">> Switched to BENCH PRESS")
    elif key == ord('r'):
        reset_reps(exercise)
        print(">> Reps reset")

    # ── YOLOv5 detection ──────────────────────────────────────────────────
    bbox = detect_person(frame, bbox, frame_count, redetect_every=10)

    if bbox:
        x1, y1, x2, y2 = bbox
        cv2.rectangle(display, (x1, y1), (x2, y2), (255, 255, 0), 1)

        crop = frame[y1:y2, x1:x2]
        if crop.size == 0:
            cv2.imshow("Posture Monitor", display)
            continue

        # ── MediaPipe ─────────────────────────────────────────────────────
        rgb    = cv2.cvtColor(crop, cv2.COLOR_BGR2RGB)
        result = pose.process(rgb)

        if result.pose_landmarks:
            # Draw skeleton on crop
            mp_draw.draw_landmarks(
                crop, result.pose_landmarks,
                mp_pose.POSE_CONNECTIONS,
                mp_draw.DrawingSpec(color=(0,255,255), thickness=2, circle_radius=3),
                mp_draw.DrawingSpec(color=(0,180,255), thickness=2),
            )

            lm   = result.pose_landmarks.landmark
            h, w = crop.shape[:2]

            def pt(i):
                return [lm[i].x * w, lm[i].y * h]

            # Pick more visible side
            l_vis = min(lm[11].visibility, lm[23].visibility, lm[25].visibility)
            r_vis = min(lm[12].visibility, lm[24].visibility, lm[26].visibility)
            off   = 0 if l_vis >= r_vis else 1

            shoulder = pt(11 + off)
            elbow    = pt(13 + off)
            wrist    = pt(15 + off)
            hip      = pt(23 + off)
            knee     = pt(25 + off)
            ankle    = pt(27 + off)

            required = [11 + off, 23 + off, 25 + off, 27 + off]
            if any(lm[i].visibility < 0.5 for i in required):
                cv2.imshow("Posture Monitor", display)
                continue

            # ── Angles ────────────────────────────────────────────────────
            k = smooth(knee_flexion(hip, knee, ankle),        key="knee",  window=6)
            b = smooth(spine_angle(shoulder, hip, knee),      key="back",  window=6)
            e = smooth(elbow_flexion(shoulder, elbow, wrist), key="elbow", window=6)

            # Draw angle values at joints on crop
            draw_angle_arc(crop, knee,     k, (0, 255, 200))
            draw_angle_arc(crop, hip,      b, (255, 200, 0))
            draw_angle_arc(crop, elbow,    e, (200, 0, 255))

            # ── Feedback + reps ───────────────────────────────────────────
            fb    = get_feedback(exercise, k, b, e)
            reps  = count_rep(exercise, k, e)
            phase = get_phase(exercise)
            color = SEVERITY_COLOR[fb.severity]

            # Speak feedback
            speak(fb.message, fb.severity)

            # ── Overlay on display frame ───────────────────────────────────

            # Semi-transparent top bar
            overlay = display.copy()
            cv2.rectangle(overlay, (0, 0), (640, 50), (0, 0, 0), -1)
            cv2.addWeighted(overlay, 0.55, display, 0.45, 0, display)

            # Feedback message (large, top center)
            draw_text(display, fb.message, (10, 35), color, scale=0.72, thickness=2)

            # Bottom info bar
            overlay2 = display.copy()
            cv2.rectangle(overlay2, (0, 440), (640, 480), (0, 0, 0), -1)
            cv2.addWeighted(overlay2, 0.55, display, 0.45, 0, display)

            draw_text(display, f"Exercise: {exercise.upper()}", (10, 468),  (255,255,255), 0.55)
            draw_text(display, f"Reps: {reps}",                 (210, 468), (0,255,100),   0.55)
            draw_text(display, f"Phase: {phase.upper()}",       (320, 468), (200,200,0),   0.55)
            draw_text(display, f"Knee:{k:.0f}",                 (430, 468), (0,200,255),   0.50)
            draw_text(display, f"Back:{b:.0f}",                 (515, 468), (0,200,255),   0.50)
            draw_text(display, f"Elbow:{e:.0f}",                (590, 468), (0,200,255),   0.45)

            # Rep counter box (top right)
            cv2.rectangle(display, (555, 55), (635, 105), (0,0,0), -1)
            cv2.rectangle(display, (555, 55), (635, 105), color, 2)
            draw_text(display, "REPS",    (563, 73),  (255,255,255), 0.45)
            draw_text(display, str(reps), (573, 98),  color,         0.9, thickness=2)

    else:
        draw_text(display, "No person detected", (10, 35), (100,100,255), 0.7)

    cv2.imshow("Posture Monitor", display)

cap.release()
cv2.destroyAllWindows()
print("Session ended.")