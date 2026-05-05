import { useRef, useState, useEffect, useContext } from "react";

import { UserContext } from "../../context/UserContext";

// ── MediaPipe pose connections ────────────────────────────────────────────────
const CONNECTIONS = [
    // Torso
    [11,12],[11,23],[12,24],[23,24],
    // Left arm
    [11,13],[13,15],
    // Right arm
    [12,14],[14,16],
    // Left leg
    [23,25],[25,27],[27,29],[27,31],
    // Right leg
    [24,26],[26,28],[28,30],[28,32],
];

// key points with labels for the legend
const KEYPOINT_LEGEND = [
    { idx:0,  label:"Nose"          },
    { idx:11, label:"L.Shoulder"    },
    { idx:12, label:"R.Shoulder"    },
    { idx:13, label:"L.Elbow"       },
    { idx:14, label:"R.Elbow"       },
    { idx:23, label:"L.Hip"         },
    { idx:24, label:"R.Hip"         },
    { idx:25, label:"L.Knee"        },
    { idx:26, label:"R.Knee"        },
    { idx:27, label:"L.Ankle"       },
    { idx:28, label:"R.Ankle"       },
];

const SEV_COLOR = { good:"#22c55e", warning:"#f59e0b", error:"#ef4444" };
const EXERCISES = [
    { id:"squat",      e:"🏋️", label:"Squat"      },
    { id:"deadlift",   e:"⬆️", label:"Deadlift"   },
    { id:"benchpress", e:"🔩", label:"Bench Press" },
];

// Frame dimensions sent to backend — match original Python camera resolution
const FW = 640, FH = 480;

// ── Skeleton draw ─────────────────────────────────────────────────────────────
function drawSkeleton(canvas, lms, bbox) {
    const ctx = canvas.getContext("2d");
    const W = canvas.width, H = canvas.height;
    ctx.clearRect(0, 0, W, H);
    if (!lms?.length) return;

    // bbox is in FW×FH frame space (non-mirrored raw frame)
    // landmarks are normalized 0-1 within the crop
    // We mirror X on draw to match the CSS scaleX(-1) on the video element
    const [bx1, by1, bx2, by2] = bbox || [0, 0, FW, FH];
    const cw = bx2 - bx1, ch = by2 - by1;
    const sx = W / FW, sy = H / FH;

    // Map landmark → canvas pixel, mirror X to match CSS-mirrored video
    const px = (lm) => ({
        x: W - (bx1 + lm.x * cw) * sx,   // mirror X only
        y: (by1 + lm.y * ch) * sy,
    });

    // Bones
    ctx.lineWidth = 3;
    ctx.lineCap = "round";
    for (const [a, b] of CONNECTIONS) {
        const A = lms[a], B = lms[b];
        if (!A || !B || A.vis < 0.25 || B.vis < 0.25) continue;
        const ca = px(A), cb = px(B);
        ctx.strokeStyle = a >= 23 ? "rgba(139,92,246,0.85)" : "rgba(0,212,255,0.85)";
        ctx.beginPath();
        ctx.moveTo(ca.x, ca.y);
        ctx.lineTo(cb.x, cb.y);
        ctx.stroke();
    }

    // Joints
    for (let i = 0; i < lms.length; i++) {
        const lm = lms[i];
        if (lm.vis < 0.25) continue;
        const c = px(lm);
        const isKey = KEYPOINT_LEGEND.some(k => k.idx === i);
        ctx.beginPath();
        ctx.arc(c.x, c.y, isKey ? 6 : 4, 0, 2 * Math.PI);
        ctx.fillStyle   = isKey ? "#00d4ff" : "rgba(255,255,255,0.5)";
        ctx.fill();
        ctx.strokeStyle = "rgba(0,0,0,0.6)";
        ctx.lineWidth   = 1.5;
        ctx.stroke();
    }
}

// ── TTS ───────────────────────────────────────────────────────────────────────
const TTS = {
    unlocked: false, voice: null, lastMsg: "", lastAt: 0, enabled: true,
    init() {
        if (this.unlocked || !window.speechSynthesis) return;
        this.unlocked = true;
        const u = new SpeechSynthesisUtterance(" "); u.volume = 0;
        window.speechSynthesis.speak(u);
        const pick = () => {
            const vs = window.speechSynthesis.getVoices();
            this.voice = vs.find(v => v.lang === "en-US" && /google/i.test(v.name))
                || vs.find(v => v.lang === "en-US")
                || vs.find(v => v.lang.startsWith("en")) || null;
        };
        pick(); window.speechSynthesis.onvoiceschanged = pick;
    },
    say(msg, sev) {
        if (!msg || !this.unlocked || !this.enabled || !window.speechSynthesis) return;
        const cd = sev === "error" ? 3000 : sev === "warning" ? 5000 : 9000;
        if (msg === this.lastMsg && Date.now() - this.lastAt < cd) return;
        this.lastMsg = msg; this.lastAt = Date.now();
        window.speechSynthesis.cancel();
        const u   = new SpeechSynthesisUtterance(msg);
        u.voice   = this.voice; u.rate = 1.05; u.volume = 1;
        window.speechSynthesis.speak(u);
    },
    stop() {
        this.lastMsg = ""; this.lastAt = 0;
        window.speechSynthesis?.cancel();
        // Belt-and-suspenders: cancel again in next tick
        setTimeout(() => window.speechSynthesis?.cancel(), 100);
    },
};

// ── Component ─────────────────────────────────────────────────────────────────
export default function CameraView({ active, tracking, onPosture, onExerciseChange, onRepsUpdate }) {
    const { user } = useContext(UserContext) || {};

    const videoRef    = useRef(null);
    const canvasRef   = useRef(null);
    const offRef      = useRef(null);   // offscreen canvas for frame capture
    const wsRef       = useRef(null);
    const retryRef    = useRef(null);
    const rafRef      = useRef(null);
    const captureRef  = useRef(null);
    const frameRef    = useRef(null);   // queued skeleton data for RAF
    const voiceRef    = useRef(true);
    const trackingRef = useRef(false);
    const exRef       = useRef("squat");
    const postureRef  = useRef(onPosture);
    const goodRef     = useRef(0);
    const lastTickRef = useRef(Date.now());

    useEffect(() => { postureRef.current = onPosture; }, [onPosture]);
    useEffect(() => { trackingRef.current = tracking; }, [tracking]);

    const [exercise,   setExercise ] = useState("squat");
    const [voiceOn,    setVoiceOn  ] = useState(true);
    const [wsStatus,   setWsStatus ] = useState("idle");
    const [feedback,   setFeedback ] = useState("");
    const [severity,   setSeverity ] = useState("good");
    const [reps,       setReps     ] = useState(0);
    const [angles,     setAngles   ] = useState({ knee:null, back:null, elbow:null });
    const [phase,      setPhase    ] = useState("UP");
    const [hasPerson,  setHasPerson] = useState(false);
    const [goodTime,   setGoodTime ] = useState(0);
    const [retryCount, setRetryCount] = useState(0);
    const [showLegend, setShowLegend] = useState(false);

    // Request-response gate: only send next frame after backend responds
    const readyRef = useRef(true);

    // Create offscreen canvas once
    useEffect(() => {
        const c = document.createElement("canvas");
        c.width = FW; c.height = FH;
        offRef.current = c;
    }, []);

    // ── RAF loop (draws skeleton at 60fps) ────────────────────────────────
    const startRAF = () => {
        const loop = () => {
            if (frameRef.current && canvasRef.current) {
                const { lms, bbox } = frameRef.current;
                drawSkeleton(canvasRef.current, lms, bbox);
                frameRef.current = null;
            }
            rafRef.current = requestAnimationFrame(loop);
        };
        rafRef.current = requestAnimationFrame(loop);
    };
    const stopRAF = () => { cancelAnimationFrame(rafRef.current); rafRef.current = null; };

    const clearCanvas = () => {
        frameRef.current = null;
        if (canvasRef.current) {
            canvasRef.current.getContext("2d").clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
        }
    };

    // ── Frame capture + send (request-response gated) ─────────────────────
    const startCapture = () => {
        if (captureRef.current) return;
        readyRef.current = true;  // reset gate on fresh start
        captureRef.current = setInterval(() => {
            const ws    = wsRef.current;
            const video = videoRef.current;
            const off   = offRef.current;
            if (!ws || ws.readyState !== WebSocket.OPEN) return;
            if (!video || video.readyState < 2)          return;
            if (!trackingRef.current)                    return;
            if (!readyRef.current)                       return; // wait for backend response

            const ctx = off.getContext("2d");
            // ⚠️ Do NOT mirror — send raw frame exactly like cv2.VideoCapture.
            // The video CSS uses scaleX(-1) for display only.
            // drawSkeleton mirrors X when rendering, so skeleton aligns perfectly.
            ctx.drawImage(video, 0, 0, FW, FH);

            const dataUrl = off.toDataURL("image/jpeg", 0.92); // high quality
            const b64     = dataUrl.split(",")[1];
            if (b64 && ws.readyState === WebSocket.OPEN) {
                readyRef.current = false; // block until backend responds
                ws.send(JSON.stringify({ type: "frame", data: b64 }));
            }
        }, 66); // poll at ~15fps; actual rate gated by backend response time
    };
    const stopCapture = () => {
        clearInterval(captureRef.current);
        captureRef.current = null;
        readyRef.current = true;
    };


    // ── WebSocket ─────────────────────────────────────────────────────────
    const openWS = () => {
        clearTimeout(retryRef.current);
        if (wsRef.current) return;
        setWsStatus("connecting");

        let ws;
        try { ws = new WebSocket("ws://localhost:8000/ws"); }
        catch { setWsStatus("error"); return; }

        wsRef.current = ws;

        ws.onopen = () => {
            setWsStatus("connected");
            setRetryCount(0);
            ws.send(JSON.stringify({ type: "set_exercise", exercise: exRef.current }));
            startCapture();
        };

        ws.onmessage = (evt) => {
            let d;
            try { d = JSON.parse(evt.data); } catch { return; }

            const sev   = d.severity || "good";
            const fb    = d.feedback || "";
            const hasLm = !!(d.landmarks?.length && d.bbox);

            // Unblock: backend responded, ready for next frame
            readyRef.current = true;

            // Queue skeleton for RAF
            if (hasLm) frameRef.current = { lms: d.landmarks, bbox: d.bbox };
            else clearCanvas();

            setFeedback(fb);
            setSeverity(sev);
            setReps(d.reps ?? 0);
            setPhase(d.phase || "UP");
            setHasPerson(hasLm);
            setAngles({
                knee:  d.knee_angle  ?? null,
                back:  d.back_angle  ?? null,
                elbow: d.elbow_angle ?? null,
            });
            onRepsUpdate?.(d.reps ?? 0);

            // Voice — only when tracking, with per-severity cooldowns
            // readyRef was true already, so this is the fresh response (not stale)
            if (voiceRef.current && trackingRef.current && fb) {
                TTS.say(fb, sev);
            }

            // Good posture time — only when tracking
            const now = Date.now();
            if (sev === "good" && trackingRef.current) {
                const dt = (now - lastTickRef.current) / 1000;
                // Cap dt at 0.5s to prevent huge jumps if there's a lag spike
                if (dt > 0 && dt < 0.5) {
                    goodRef.current += dt;
                    setGoodTime(goodRef.current);
                }
            }
            lastTickRef.current = now;
            
            postureRef.current?.(sev === "good");
        };

        ws.onerror = () => {};

        ws.onclose = () => {
            wsRef.current = null;
            stopCapture();
            clearCanvas();
            setHasPerson(false);
            setFeedback("");
            setWsStatus("idle");
            setRetryCount(p => {
                const n     = p + 1;
                const delay = Math.min(3000 * n, 15000);
                retryRef.current = setTimeout(openWS, delay);
                return n;
            });
        };
    };

    const closeWS = () => {
        clearTimeout(retryRef.current);
        stopCapture();
        if (wsRef.current) {
            wsRef.current.onclose = null;
            wsRef.current.close();
            wsRef.current = null;
        }
        setWsStatus("idle");
        setRetryCount(0);
        clearCanvas();
        setHasPerson(false);
        setFeedback("");
    };

    // ── Camera ────────────────────────────────────────────────────────────
    const startCam = async () => {
        if (videoRef.current?.srcObject) return;
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: { width:{ideal:1280}, height:{ideal:720}, facingMode:"user" }, audio:false
            });
            if (videoRef.current) {
                videoRef.current.srcObject = stream;
                videoRef.current.onloadedmetadata = () => videoRef.current?.play().catch(()=>{});
            }
        } catch(e) { console.error("Camera:", e); }
    };

    const stopCam = () => {
        videoRef.current?.srcObject?.getTracks().forEach(t => t.stop());
        if (videoRef.current) videoRef.current.srcObject = null;
    };

    // ── Session save ──────────────────────────────────────────────────────
    // Session saving is now handled entirely by the parent (DashboardPage)
    // to prevent duplicate/competing session records in the database.

    // ── Active (camera on/off) ────────────────────────────────────────────
    useEffect(() => {
        if (active) {
            TTS.init();
            startCam();
            startRAF();
            goodRef.current  = 0;
            lastTickRef.current = Date.now();
            setGoodTime(0);
            setReps(0);
            openWS();
        } else {
            stopCam();
            stopRAF();
            closeWS();
        }
        return () => { 
            clearTimeout(retryRef.current); 
            stopRAF(); 
            stopCapture(); 
            if (active) {
                stopCam();
                closeWS();
            }
        };
    }, [active]); // eslint-disable-line

    // ── Tracking toggle ───────────────────────────────────────────────────
    useEffect(() => {
        if (!tracking) {
            // STOP everything tracking-related immediately
            TTS.stop();
            clearCanvas();
            setFeedback("");
            setHasPerson(false);
            setAngles({ knee:null, back:null, elbow:null });
        }
    }, [tracking]);

    // ── Exercise change ───────────────────────────────────────────────────
    const setEx = (id) => {
        setExercise(id); exRef.current = id;
        setReps(0);
        onExerciseChange?.(id);
        if (wsRef.current?.readyState === WebSocket.OPEN)
            wsRef.current.send(JSON.stringify({ type:"set_exercise", exercise:id }));
    };

    // ── Voice toggle ──────────────────────────────────────────────────────
    const toggleVoice = () => {
        const next = !voiceOn;
        setVoiceOn(next); voiceRef.current = next; TTS.enabled = next;
        if (!next) TTS.stop();
    };

    const reconnect = () => { closeWS(); setTimeout(openWS, 300); };
    const sevColor  = SEV_COLOR[severity] || "#00d4ff";

    return (
        <div className="cameraview-root">

            {/* ── Exercise + Voice bar ── */}
            <div className="exercise-selector">
                <span className="ex-label">Exercise:</span>
                {EXERCISES.map(({ id, e, label }) => (
                    <button key={id} type="button"
                        className={`ex-btn${exercise === id ? " ex-btn-active" : ""}`}
                        onClick={() => setEx(id)}
                    >{e} {label}</button>
                ))}
                <button type="button"
                    className={`ex-btn voice-btn${voiceOn ? " ex-btn-active" : ""}`}
                    onClick={toggleVoice}
                >{voiceOn ? "🔊 Voice" : "🔇 Muted"}</button>
            </div>

            {/* ── WS status bar ── */}
            {active && wsStatus !== "connected" && (
                <div className={`ws-status-bar ${wsStatus}`}>
                    {wsStatus === "connecting" && <>⏳ Connecting to backend… run: <code>uvicorn app:app --port 8000</code></>}
                    {(wsStatus === "idle" || wsStatus === "error") && (
                        <><span>{wsStatus === "error" ? "⚠️ Backend error" : "🔌 Disconnected"}</span>
                        <button className="ws-retry-btn" onClick={reconnect}>Retry</button></>
                    )}
                    {retryCount > 0 && <span className="ws-retry-count">(attempt {retryCount})</span>}
                </div>
            )}

            {/* ── Camera + skeleton canvas ── */}
            <div className="video-wrapper">
                {/* Video feed — mirrored via CSS */}
                <video ref={videoRef} autoPlay playsInline muted className="video-el video-mirror" />

                {/* Skeleton overlay — NOT CSS-mirrored (mirroring done in drawSkeleton) */}
                <canvas ref={canvasRef} width={640} height={480} className="canvas-overlay" />

                {/* Live / Ready / Offline badge */}
                <div className={`ws-badge ${wsStatus === "connected" ? "ws-ok" : wsStatus === "connecting" ? "ws-connecting" : "ws-off"}`}>
                    {wsStatus === "connected"  && (tracking ? "● LIVE" : "● READY")}
                    {wsStatus === "connecting" && "● connecting"}
                    {(wsStatus === "idle" || wsStatus === "error") && "● OFFLINE"}
                </div>

                {/* Rep badge — top right */}
                {tracking && hasPerson && reps > 0 && (
                    <div className="rep-overlay">{reps}<span>reps</span></div>
                )}

                {/* Bottom hints — non-blocking pill */}
                {tracking && wsStatus === "connected" && !hasPerson && (
                    <div className="small-hint">🎯 Step back — show your full body</div>
                )}
                {!tracking && active && (
                    <div className="cam-idle-hint">▶ Press Start Session to begin AI tracking</div>
                )}

                {/* Skeleton key toggle */}
                <button className="skeleton-key-btn" type="button" onClick={() => setShowLegend(v => !v)} title="Show skeleton key">
                    🦴
                </button>

                {/* Skeleton legend popover */}
                {showLegend && (
                    <div className="skeleton-legend">
                        <p className="sk-legend-title">Skeleton Key</p>
                        <div className="sk-legend-row"><span className="sk-dot sk-upper"/>Upper body <span className="sk-dot sk-lower"/>Lower body</div>
                        <div className="sk-divider"/>
                        {KEYPOINT_LEGEND.map(k => (
                            <div key={k.idx} className="sk-kp-row">
                                <span className="sk-kp-idx">#{k.idx}</span>
                                <span className="sk-kp-label">{k.label}</span>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* ── Feedback banner ── */}
            {feedback && tracking && (
                <div className="feedback-banner" style={{ borderColor:sevColor, color:sevColor }}>
                    {severity === "error" ? "🚨 " : severity === "warning" ? "⚠️ " : "✅ "}{feedback}
                </div>
            )}

            {/* ── Angle + rep chips ── */}
            {tracking && (
                <>
                    <div className="angle-row">
                        {[
                            { label:"Knee",  val:angles.knee,  unit:"°" },
                            { label:"Back",  val:angles.back,  unit:"°" },
                            { label:"Elbow", val:angles.elbow, unit:"°" },
                            { label:"Reps",  val:reps,         unit:"", purple:true },
                        ].map(({ label, val, unit, purple }) => (
                            <div className="angle-chip" key={label}>
                                <span className="angle-label">{label}</span>
                                <span className={`angle-val${purple ? " rep-val" : ""}`}>
                                    {val !== null && val !== undefined ? `${val}${unit}` : "—"}
                                </span>
                            </div>
                        ))}
                        {/* Phase badge — matches original Python overlay */}
                        <div className="angle-chip" style={{ borderColor: phase==="DOWN" ? "rgba(139,92,246,0.5)" : "rgba(0,212,255,0.3)" }}>
                            <span className="angle-label">Phase</span>
                            <span className="angle-val" style={{ fontSize:15, color: phase==="DOWN" ? "#a78bfa" : "#00d4ff" }}>
                                {phase}
                            </span>
                        </div>
                    </div>
                    <div className="good-time">
                        ✅ Good posture: <strong>{goodTime.toFixed(1)} s</strong>
                    </div>
                </>
            )}
        </div>
    );
}
