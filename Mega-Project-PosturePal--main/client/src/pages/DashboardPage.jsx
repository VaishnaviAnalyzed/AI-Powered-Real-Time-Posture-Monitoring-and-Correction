import { useContext, useState, useRef, useEffect, useCallback } from "react";
import { UserContext } from "../context/UserContext";
import { useNavigate } from "react-router-dom";
import CameraView from "../features/camera/CameraView";
import { saveSession, getSessions } from "../services/session";
import { logout } from "../services/auth";

// ── Helpers ──────────────────────────────────────────────────────────────────
function fmt(s) {
    const m = Math.floor(s / 60);
    const sec = String(s % 60).padStart(2, "0");
    return m > 0 ? `${m}:${sec}` : `0:${sec}`;
}

function scoreColor(v) {
    if (v >= 70) return "#22c55e";
    if (v >= 40) return "#f59e0b";
    return "#ef4444";
}

// ── Score Ring (SVG) ─────────────────────────────────────────────────────────
function ScoreRing({ score }) {
    const r = 44;
    const circ = 2 * Math.PI * r;
    const dash = (score / 100) * circ;
    const color = scoreColor(score);

    return (
        <div className="score-ring-wrap">
            <svg width="110" height="110" viewBox="0 0 110 110">
                <circle cx="55" cy="55" r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="8" />
                <circle
                    cx="55" cy="55" r={r}
                    fill="none"
                    stroke={color}
                    strokeWidth="8"
                    strokeLinecap="round"
                    strokeDasharray={`${dash} ${circ}`}
                    strokeDashoffset={circ / 4}  /* start at top */
                    style={{ transition: "stroke-dasharray 0.6s ease, stroke 0.4s" }}
                    transform="rotate(-90 55 55)"
                />
                <text x="55" y="58" textAnchor="middle" fill={color} fontSize="20" fontWeight="700" fontFamily="Inter,sans-serif">
                    {score}%
                </text>
            </svg>
        </div>
    );
}

// ── Component ────────────────────────────────────────────────────────────────
function DashboardPage() {
    const { user, userData, loading } = useContext(UserContext);
    const navigate = useNavigate();

    const [cameraOn,    setCameraOn]    = useState(false);
    const [tracking,    setTracking]    = useState(false);
    const [exercise,    setExercise]    = useState("squat");
    const [seconds,     setSeconds]     = useState(0);
    const [goodSeconds, setGoodSeconds] = useState(0);
    const [sessions,    setSessions]    = useState([]);
    const [saved,       setSaved]       = useState(false);
    const [liveReps,    setLiveReps]    = useState(0);

    const intervalRef = useRef(null);
    const isGoodRef = useRef(false);
    const isReady = !loading && user;

    const score = seconds > 0
        ? Math.min(100, Math.round((goodSeconds / seconds) * 100))
        : 0;

    // Load past sessions
    useEffect(() => {
        if (user) getSessions(user.uid).then(setSessions).catch(() => {});
    }, [user, saved]);

    // Protect route
    useEffect(() => {
        if (!loading && !user) {
            navigate("/login");
        }
    }, [loading, user, navigate]);

    // Session timer
    useEffect(() => {
        if (tracking) {
            intervalRef.current = setInterval(() => {
                setSeconds((p) => p + 1);
                if (isGoodRef.current) {
                    setGoodSeconds((p) => p + 1);
                }
            }, 1000);
        } else {
            clearInterval(intervalRef.current);
        }
        return () => clearInterval(intervalRef.current);
    }, [tracking]);

    const handleStart = useCallback(() => {
        setTracking(true);
        setSeconds(0);
        setGoodSeconds(0);
        setLiveReps(0);
        setSaved(false);
        if (!cameraOn) setCameraOn(true);
    }, [cameraOn]);

    const handleStop = useCallback(async () => {
        setTracking(false);
        const s = seconds > 0 ? Math.min(100, Math.round((goodSeconds / seconds) * 100)) : 0;
        try {
            await saveSession(user.uid, { totalTime: seconds, goodPostureTime: goodSeconds, score: s, exercise });
            setSaved(true);
        } catch (e) { console.error(e); }
    }, [seconds, goodSeconds, user, exercise]);

    if (!isReady) return (
        <div className="db-loading">
            <div className="db-spinner" />
            <p>{loading ? "Loading…" : "Initializing…"}</p>
        </div>
    );

    return (
        <div className="db-page">

            {/* ── NAV ── */}
            <nav className="db-nav">
                <div className="db-brand">
                    <span className="db-brand-dot" />
                    <span className="db-brand-name">PosturePal</span>
                </div>
                <div className="db-nav-center">
                    <h1 className="db-title">Dashboard</h1>
                </div>
                <div className="db-nav-right">
                    <span className="db-user">{userData?.name || user?.email?.split("@")[0]}</span>
                    <button className="login-btn" onClick={async () => { await logout(); navigate("/"); }}>Sign Out</button>
                </div>
            </nav>

            {/* ── CONTROL BAR ── */}
            <div className="db-controls">
                {!tracking ? (
                    <button id="btn-start" className="primary-btn db-primary-action" onClick={handleStart}>
                        ▶ Start Session
                    </button>
                ) : (
                    <button id="btn-stop" className="db-stop-btn" onClick={handleStop}>
                        ⏹ Stop Session
                    </button>
                )}

                <button
                    id="btn-camera"
                    className={`db-cam-btn ${cameraOn ? "db-cam-on" : ""}`}
                    onClick={() => setCameraOn((p) => !p)}
                >
                    {cameraOn ? "📷 Camera OFF" : "📷 Camera ON"}
                </button>

                {tracking && <div className="db-timer">🔴 {fmt(seconds)}</div>}
                {tracking && (
                    <div className="db-live-score" style={{ color: scoreColor(score) }}>
                        {score}% form
                    </div>
                )}
                {saved && !tracking && <div className="db-saved-badge">✅ Saved</div>}
            </div>

            {/* ── BODY ── */}
            <div className="db-body">

                {/* ─ CAMERA HERO ─ */}
                <section className="db-camera-hero">
                    <CameraView
                        active={cameraOn}
                        tracking={tracking}
                        onExerciseChange={(ex) => { setExercise(ex); setLiveReps(0); }}
                        onRepsUpdate={setLiveReps}
                        onPosture={(isGood) => {
                            isGoodRef.current = isGood;
                        }}
                    />
                </section>

                {/* ─ SIDEBAR ─ */}
                <aside className="db-sidebar">

                    {/* Score card */}
                    <div className="db-card db-score-card">
                        <p className="db-card-label">Form Score</p>
                        <ScoreRing score={score} />
                        <div className="db-stat-row">
                            <span>Good</span>
                            <span style={{ color: "#22c55e" }}>{fmt(goodSeconds)}</span>
                        </div>
                        <div className="db-stat-row">
                            <span>Total</span>
                            <span>{fmt(seconds)}</span>
                        </div>
                    </div>

                    {/* Exercise card */}
                    <div className="db-card">
                        <p className="db-card-label">Exercise</p>
                        <p className="db-exercise-name">
                            {exercise === "squat"      && "🏋️ Squat"}
                            {exercise === "deadlift"   && "⬆️ Deadlift"}
                            {exercise === "benchpress" && "🔩 Bench Press"}
                        </p>
                        {tracking && liveReps > 0 && (
                            <div style={{ marginTop: 10, display: "flex", alignItems: "center", gap: 8 }}>
                                <span style={{ fontSize: 28, fontWeight: 800, color: "#a78bfa" }}>{liveReps}</span>
                                <span style={{ fontSize: 13, color: "var(--muted)" }}>reps this set</span>
                            </div>
                        )}
                        {(!tracking || liveReps === 0) && (
                            <p style={{ fontSize: 12, color: "var(--muted)", marginTop: 6 }}>
                                {tracking ? "Waiting for reps…" : "Use selector above camera to switch"}
                            </p>
                        )}
                    </div>

                    {/* Sessions */}
                    <div className="db-card db-sessions-card">
                        <p className="db-card-label">Recent Sessions</p>
                        {sessions.length === 0 ? (
                            <p style={{ color: "var(--muted)", fontSize: 13, marginTop: 8 }}>
                                No sessions yet
                            </p>
                        ) : (
                            <div className="db-session-list">
                                {sessions.slice(0, 6).map((s) => (
                                    <div key={s.id} className="db-session-item">
                                        <span className="db-session-time">{fmt(Math.round(s.totalTime))}</span>
                                        <div className="db-session-bar-track">
                                            <div
                                                className="db-session-bar-fill"
                                                style={{ width: `${s.score}%`, background: scoreColor(s.score) }}
                                            />
                                        </div>
                                        <span className="db-session-score" style={{ color: scoreColor(s.score) }}>
                                            {s.score}%
                                        </span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                </aside>
            </div>
        </div>
    );
}

export default DashboardPage;
