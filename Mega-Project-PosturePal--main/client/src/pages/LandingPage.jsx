import { useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Activity, Zap, BarChart3 } from "lucide-react";
import DecryptedText from "../components/DecryptedText";

function LandingPage() {
  const navigate = useNavigate();

  const fullText = "Train Your Body with Real-Time AI Feedback";
  const [displayedText, setDisplayedText] = useState("");

  // TYPEWRITER
  useEffect(() => {
    let i = 0;

    const interval = setInterval(() => {
      setDisplayedText(fullText.slice(0, i + 1));
      i++;

      if (i === fullText.length) clearInterval(interval);
    }, 40);

    return () => clearInterval(interval);
  }, []);

  // ANIMATION VARIANTS
  const container = {
    hidden: {},
    show: {
      transition: {
        staggerChildren: 0.2,
      },
    },
  };

  const item = {
    hidden: { opacity: 0, y: 40 },
    show: { opacity: 1, y: 0 },
  };

  return (
    <div className="hero-container">
      {/* NAVBAR */}
      <nav className="navbar">
        <h2 className="logo">
          <DecryptedText
            text="PosturePal"
            animateOn="hover"
            speed={40}
            maxIterations={12}
            sequential={true}
            revealDirection="start"
            characters="ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz@#$%&"
            className="logo-revealed"
            encryptedClassName="logo-encrypted"
          />
        </h2>

        <div className="nav-actions">
          <button
            className="login-btn"
            onClick={() => navigate("/login")}
          >
            Login
          </button>

          <button
            className="primary-btn"
            onClick={() => navigate("/login")}
          >
            Start Free
          </button>
        </div>
      </nav>

      {/* HERO */}
      <div className="hero-center">
        <p className="tagline">
          Most people ruin their posture without realizing it.
        </p>

        <h1 className="hero-title">
          {displayedText.includes("Real-Time AI Feedback") ? (
            <>
              {displayedText.replace("Real-Time AI Feedback", "")}
              <span className="gradient-text">
                Real-Time AI Feedback
              </span>
            </>
          ) : (
            displayedText
          )}
          <span className="cursor">|</span>
        </h1>

        <p className="subtext">
          Detect posture mistakes instantly and fix them before they become pain.
        </p>

        <button
          className="cta big"
          onClick={() => navigate("/login")}
        >
          Start Tracking Now →
        </button>

        <div className="trust-row">
          <span>✔ Works in real-time</span>
          <span>✔ No equipment needed</span>
          <span>✔ AI-powered correction</span>
        </div>

        {/* AI CARD */}
        <div className="camera-card">
          <p className="live">● LIVE</p>
          <p className="score">Posture Score: 92%</p>
          <p className="status good">GOOD POSTURE</p>
        </div>
      </div>

      {/* FEATURES */}
      <div className="features">
        <motion.div
          className="features-grid"
          variants={container}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true }}
        >
          <motion.div className="feature-card" variants={item}>
            <div className="feature-icon">
              <Activity size={22} />
            </div>
            <h3 className="feature-title">Real-Time Monitoring</h3>
            <p>AI continuously analyzes your posture using your camera.</p>
          </motion.div>

          <motion.div className="feature-card" variants={item}>
            <div className="feature-icon">
              <Zap size={22} />
            </div>
            <h3 className="feature-title">Smart Feedback</h3>
            <p>Instant alerts help you correct posture immediately.</p>
          </motion.div>

          <motion.div className="feature-card" variants={item}>
            <div className="feature-icon">
              <BarChart3 size={22} />
            </div>
            <h3 className="feature-title">Progress Tracking</h3>
            <p>Track your posture improvements over time.</p>
          </motion.div>
        </motion.div>
      </div>

      {/* HOW IT WORKS */}
      <div className="how">
        <h2 className="section-title">How It Works</h2>

        <div className="steps">
          <div className="step">
            <h4>1. Start Camera</h4>
            <p>Allow camera access to begin posture tracking.</p>
          </div>

          <div className="step">
            <h4>2. AI Analysis</h4>
            <p>Our AI detects posture alignment in real-time.</p>
          </div>

          <div className="step">
            <h4>3. Get Feedback</h4>
            <p>Fix your posture instantly with smart suggestions.</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default LandingPage;