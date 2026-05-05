import { useState } from "react";
import { login, signup } from "../services/auth";
import { getUserData } from "../services/db";
import { useNavigate } from "react-router-dom";
import DecryptedText from "../components/DecryptedText";
import { UserContext } from "../context/UserContext";
import { useContext, useEffect } from "react";

export default function LoginPage() {
    const [tab, setTab] = useState("login"); // "login" | "signup"
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();
    const { user, loading: userLoading, userData } = useContext(UserContext);

    useEffect(() => {
        if (!userLoading && user) {
            if (userData?.onboarded) navigate("/dashboard");
            else navigate("/onboarding");
        }
    }, [user, userLoading, userData, navigate]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError("");
        setLoading(true);
        try {
            let cred;
            if (tab === "login") {
                cred = await login(email, password);
            } else {
                cred = await signup(email, password);
            }
            const uid = cred.user.uid;
            // Check if user has completed onboarding
            const data = await getUserData(uid);
            if (data && data.onboarded) {
                navigate("/dashboard");
            } else {
                navigate("/onboarding");
            }
        } catch (err) {
            setError(friendlyError(err.code));
        } finally {
            setLoading(false);
        }
    };

    const friendlyError = (code) => {
        switch (code) {
            case "auth/user-not-found":      return "No account found with this email.";
            case "auth/wrong-password":      return "Incorrect password.";
            case "auth/email-already-in-use":return "Email already registered. Try logging in.";
            case "auth/invalid-email":       return "Please enter a valid email address.";
            case "auth/weak-password":       return "Password must be at least 6 characters.";
            case "auth/invalid-credential":  return "Invalid email or password.";
            default:                         return "Something went wrong. Please try again.";
        }
    };

    return (
        <div className="login-page">
            {/* Background glow blobs */}
            <div className="login-blob login-blob-1" />
            <div className="login-blob login-blob-2" />

            {/* Card */}
            <div className="login-card">
                {/* Logo */}
                <div className="login-logo" onClick={() => navigate("/")}>
                    <span className="login-logo-dot" />
                    <DecryptedText
                        text="PosturePal"
                        animateOn="hover"
                        sequential={true}
                        speed={35}
                        revealDirection="start"
                        characters="ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz@#$"
                        className="logo-revealed"
                        encryptedClassName="logo-encrypted"
                    />
                </div>

                <h2 className="login-heading">
                    {tab === "login" ? "Welcome back" : "Create account"}
                </h2>
                <p className="login-sub">
                    {tab === "login"
                        ? "Sign in to continue your posture journey"
                        : "Start tracking your form today"}
                </p>

                {/* Tab switcher */}
                <div className="login-tabs">
                    <button
                        type="button"
                        className={`login-tab${tab === "login" ? " login-tab-active" : ""}`}
                        onClick={() => { setTab("login"); setError(""); }}
                    >Login</button>
                    <button
                        type="button"
                        className={`login-tab${tab === "signup" ? " login-tab-active" : ""}`}
                        onClick={() => { setTab("signup"); setError(""); }}
                    >Sign up</button>
                </div>

                <form className="login-form" onSubmit={handleSubmit} noValidate>
                    <div className="login-field">
                        <label className="login-label">Email</label>
                        <input
                            id="login-email"
                            type="email"
                            className="login-input"
                            placeholder="you@example.com"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                        />
                    </div>

                    <div className="login-field">
                        <label className="login-label">Password</label>
                        <input
                            id="login-password"
                            type="password"
                            className="login-input"
                            placeholder="••••••••"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                        />
                    </div>

                    {error && <p className="login-error">⚠ {error}</p>}

                    <button
                        id="btn-login-submit"
                        type="submit"
                        className="login-submit"
                        disabled={loading}
                    >
                        {loading
                            ? <span className="login-spinner" />
                            : tab === "login" ? "Sign In →" : "Create Account →"
                        }
                    </button>
                </form>

                <p className="login-footer">
                    {tab === "login" ? "Don't have an account? " : "Already have an account? "}
                    <span
                        className="login-switch"
                        onClick={() => { setTab(tab === "login" ? "signup" : "login"); setError(""); }}
                    >
                        {tab === "login" ? "Sign up" : "Sign in"}
                    </span>
                </p>
            </div>
        </div>
    );
}