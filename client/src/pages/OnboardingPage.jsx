import { useState, useRef, useEffect, useContext } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import auth from "../services/auth";
import { saveUserData } from "../services/db";
import DecryptedText from "../components/DecryptedText";
import { UserContext } from "../context/UserContext";

const STEPS = [
  { id: 1, title: "Who are you?",        sub: "Let's get to know you a bit"         },
  { id: 2, title: "Body metrics",        sub: "Helps us personalise your experience" },
  { id: 3, title: "Experience level",   sub: "Pick what fits you best"              },
  { id: 4, title: "What's your goal?",  sub: "We'll tailor your tracking to this"   },
];

const LEVELS = [
  { val: "Beginner",     icon: "🌱", desc: "Just getting started" },
  { val: "Intermediate", icon: "⚡", desc: "Some experience"       },
  { val: "Advanced",     icon: "🔥", desc: "I train regularly"     },
];

const GOALS = [
  { val: "Posture",   icon: "🧘", desc: "Fix my posture & alignment"  },
  { val: "Strength",  icon: "💪", desc: "Build strength & muscle"      },
  { val: "Fat Loss",  icon: "🎯", desc: "Lose weight & tone up"        },
];

const slideVariants = {
  enter: (dir) => ({ opacity: 0, x: dir > 0 ? 40 : -40 }),
  center:        ({ opacity: 1, x: 0 }),
  exit:  (dir) => ({ opacity: 0, x: dir > 0 ? -40 : 40 }),
};

function OnboardingPage() {
  const navigate  = useNavigate();
  const { refetchUserData, user, loading: userLoading } = useContext(UserContext);
  const [step, setStep]       = useState(1);
  const [dir,  setDir ]       = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState("");

  useEffect(() => {
    if (!userLoading && !user) navigate("/login");
  }, [user, userLoading, navigate]);

  const [formData, setFormData] = useState({
    name: "", age: "", height: "", weight: "", level: "", goal: "",
  });

  const nameRef   = useRef(null);
  const ageRef    = useRef(null);
  const heightRef = useRef(null);
  const weightRef = useRef(null);

  useEffect(() => {
    if (step === 1) nameRef.current?.focus();
    if (step === 2) heightRef.current?.focus();
  }, [step]);

  const set = (field, val) => setFormData(p => ({ ...p, [field]: val }));

  const isValid = () => {
    if (step === 1) return formData.name.trim() && formData.age;
    if (step === 2) return formData.height && formData.weight;
    if (step === 3) return formData.level;
    if (step === 4) return formData.goal;
    return false;
  };

  const next = () => { if (!isValid()) return; setDir(1); setStep(s => s + 1); };
  const back = () => { setDir(-1); setStep(s => s - 1); };

  const handleKeyDown = (e, nextRef) => {
    if (e.key !== "Enter") return;
    if (nextRef?.current) { nextRef.current.focus(); }
    else if (isValid()) { next(); }
  };

  const handleFinish = async () => {
    setError(""); setLoading(true);
    try {
      const user = auth.currentUser;
      if (!user) { setError("Not logged in — please sign in first."); setLoading(false); return; }
      await saveUserData(user.uid, {
        name: formData.name.trim(),
        age: Number(formData.age),
        height: Number(formData.height),
        weight: Number(formData.weight),
        level: formData.level,
        goal: formData.goal,
        onboarded: true,
        createdAt: new Date(),
      });
      await refetchUserData(); // sync context immediately
      navigate("/dashboard");
    } catch (err) {
      setError("Failed to save — please try again.");
    } finally {
      setLoading(false);
    }
  };

  const progress = ((step - 1) / (STEPS.length - 1)) * 100;
  const stepInfo = STEPS[step - 1];

  return (
    <div className="ob-page">
      {/* Background blobs */}
      <div className="login-blob login-blob-1" />
      <div className="login-blob login-blob-2" />

      {/* Card */}
      <div className="ob-card">

        {/* Logo */}
        <div className="login-logo ob-logo" onClick={() => navigate("/")}>
          <span className="login-logo-dot" />
          <DecryptedText
            text="PosturePal"
            animateOn="hover"
            sequential speed={35} revealDirection="start"
            characters="ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz@#$"
            className="logo-revealed" encryptedClassName="logo-encrypted"
          />
        </div>

        {/* Step counter pills */}
        <div className="ob-steps-row">
          {STEPS.map(s => (
            <div key={s.id} className={`ob-step-pill${s.id === step ? " ob-step-active" : s.id < step ? " ob-step-done" : ""}`}>
              {s.id < step ? "✓" : s.id}
            </div>
          ))}
        </div>

        {/* Progress bar */}
        <div className="ob-progress-track">
          <motion.div className="ob-progress-fill" animate={{ width: `${progress}%` }} transition={{ duration: 0.4, ease: "easeInOut" }} />
        </div>

        {/* Animated step content */}
        <AnimatePresence mode="wait" custom={dir}>
          <motion.div
            key={step}
            custom={dir}
            variants={slideVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.28, ease: "easeInOut" }}
            className="ob-step-body"
          >
            <p  className="ob-step-label">Step {step} of {STEPS.length}</p>
            <h2 className="ob-heading">{stepInfo.title}</h2>
            <p  className="ob-sub">{stepInfo.sub}</p>

            {/* ── STEP 1: Name + Age ── */}
            {step === 1 && (
              <div className="ob-fields">
                <div className="ob-field">
                  <label className="ob-label">Full Name</label>
                  <input ref={nameRef} type="text" className="ob-input" placeholder="e.g. Alex Johnson"
                    value={formData.name} onChange={e => set("name", e.target.value)}
                    onKeyDown={e => handleKeyDown(e, ageRef)} />
                </div>
                <div className="ob-field">
                  <label className="ob-label">Age</label>
                  <input ref={ageRef} type="number" className="ob-input" placeholder="e.g. 24"
                    min={10} max={99} value={formData.age} onChange={e => set("age", e.target.value)}
                    onKeyDown={e => handleKeyDown(e, null)} />
                </div>
              </div>
            )}

            {/* ── STEP 2: Height + Weight ── */}
            {step === 2 && (
              <div className="ob-fields">
                <div className="ob-field">
                  <label className="ob-label">Height</label>
                  <div className="ob-input-unit-wrap">
                    <input ref={heightRef} type="number" className="ob-input ob-input-unit" placeholder="170"
                      value={formData.height} onChange={e => set("height", e.target.value)}
                      onKeyDown={e => handleKeyDown(e, weightRef)} />
                    <span className="ob-unit">cm</span>
                  </div>
                </div>
                <div className="ob-field">
                  <label className="ob-label">Weight</label>
                  <div className="ob-input-unit-wrap">
                    <input ref={weightRef} type="number" className="ob-input ob-input-unit" placeholder="70"
                      value={formData.weight} onChange={e => set("weight", e.target.value)}
                      onKeyDown={e => handleKeyDown(e, null)} />
                    <span className="ob-unit">kg</span>
                  </div>
                </div>
              </div>
            )}

            {/* ── STEP 3: Level ── */}
            {step === 3 && (
              <div className="ob-option-grid">
                {LEVELS.map(({ val, icon, desc }) => (
                  <button type="button" key={val}
                    className={`ob-option-card${formData.level === val ? " ob-option-active" : ""}`}
                    onClick={() => set("level", val)}>
                    <span className="ob-option-icon">{icon}</span>
                    <span className="ob-option-val">{val}</span>
                    <span className="ob-option-desc">{desc}</span>
                  </button>
                ))}
              </div>
            )}

            {/* ── STEP 4: Goal ── */}
            {step === 4 && (
              <div className="ob-option-grid">
                {GOALS.map(({ val, icon, desc }) => (
                  <button type="button" key={val}
                    className={`ob-option-card${formData.goal === val ? " ob-option-active" : ""}`}
                    onClick={() => set("goal", val)}>
                    <span className="ob-option-icon">{icon}</span>
                    <span className="ob-option-val">{val}</span>
                    <span className="ob-option-desc">{desc}</span>
                  </button>
                ))}
              </div>
            )}
          </motion.div>
        </AnimatePresence>

        {error && <p className="login-error" style={{marginTop:8}}>{error}</p>}

        {/* Actions */}
        <div className="ob-actions">
          {step > 1 && (
            <button type="button" className="ob-back-btn" onClick={back}>← Back</button>
          )}
          {step < 4 ? (
            <button type="button" className="login-submit ob-next-btn" onClick={next} disabled={!isValid()}>
              Continue →
            </button>
          ) : (
            <button type="button" className="login-submit ob-next-btn" onClick={handleFinish} disabled={!isValid() || loading}>
              {loading ? <span className="login-spinner" /> : "Finish & Start →"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default OnboardingPage;