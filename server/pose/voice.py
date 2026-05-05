"""
Voice feedback engine using pyttsx3 (offline, no API needed).

Rules:
  - Errors   → spoken immediately every time they appear
  - Warnings → spoken only if message changed OR 4 seconds passed
  - Good     → spoken only when message changes (no repeat praise)
  - Never blocks the video loop — runs in a background thread
"""

import threading
import time

try:
    import pyttsx3
    _engine = pyttsx3.init()
    _engine.setProperty("rate", 165)    # words per minute (150=slow, 200=fast)
    _engine.setProperty("volume", 1.0)  # 0.0 to 1.0
    VOICE_AVAILABLE = True
except Exception:
    VOICE_AVAILABLE = False
    print("[Voice] pyttsx3 not available — install with: pip install pyttsx3")

_last_spoken:   str   = ""
_last_spoken_t: float = 0.0
_speaking:      bool  = False
_lock = threading.Lock()


def _speak_thread(text: str):
    global _speaking
    try:
        if VOICE_AVAILABLE:
            _engine.say(text)
            _engine.runAndWait()
    finally:
        with _lock:
            _speaking = False


def speak(message: str, severity: str) -> None:
    """
    Non-blocking speak call.
    severity: "error" | "warning" | "good"
    """
    global _last_spoken, _last_spoken_t, _speaking

    if not VOICE_AVAILABLE:
        return

    now = time.time()

    with _lock:
        if _speaking:
            # Only interrupt for errors
            if severity != "error":
                return

        same_message = (message == _last_spoken)
        time_since   = now - _last_spoken_t

        should_speak = False

        if severity == "error":
            # Errors: speak if message changed or every 3 seconds
            should_speak = (not same_message) or (time_since > 3.0)

        elif severity == "warning":
            # Warnings: speak if message changed or every 4 seconds
            should_speak = (not same_message) or (time_since > 4.0)

        elif severity == "good":
            # Good: only speak when message changes
            should_speak = not same_message

        if not should_speak:
            return

        _last_spoken   = message
        _last_spoken_t = now
        _speaking      = True

    t = threading.Thread(target=_speak_thread, args=(message,), daemon=True)
    t.start()