"""
Feedback engine.

Rules checked top-to-bottom — first match wins.
Priority: critical errors → form warnings → depth cues → praise.

severity:
  "error"   → red   → spoken immediately
  "warning" → orange → spoken every 3 seconds
  "good"    → green  → spoken on change only
"""

from dataclasses import dataclass, asdict


@dataclass
class Feedback:
    message:  str
    severity: str  # "error" | "warning" | "good"

    def to_dict(self) -> dict:
        return asdict(self)


# ── Squat ─────────────────────────────────────────────────────────────────────
def _squat(knee: float, back: float) -> Feedback:
    if back < 110:
        return Feedback("STOP — severe back rounding, risk of injury", "error")
    if knee < 55:
        return Feedback("Way too low — you are past safe range", "error")
    if back < 135:
        return Feedback("Back rounding badly — chest up, brace core", "error")
    if back < 150:
        return Feedback("Keep your chest up — back is rounding", "warning")
    if knee > 160:
        return Feedback("Go lower — aim for thighs parallel to floor", "warning")
    if knee > 140:
        return Feedback("Almost there — go a little lower", "warning")
    if back < 165:
        return Feedback("Slight forward lean — push knees out", "warning")
    if 90 <= knee <= 110:
        return Feedback("Perfect squat depth — great job", "good")
    if knee < 90:
        return Feedback("Good depth — drive through your heels", "good")
    return Feedback("Good squat form", "good")


# ── Deadlift ──────────────────────────────────────────────────────────────────
def _deadlift(knee: float, back: float) -> Feedback:
    if back < 120:
        return Feedback("STOP — back rounding dangerously", "error")
    if back < 140:
        return Feedback("Back rounding — brace hard and reset", "error")
    if knee > 175 and back < 160:
        return Feedback("Hips too high — bend knees more at setup", "warning")
    if back < 158:
        return Feedback("Keep back flat — squeeze shoulder blades", "warning")
    if knee < 100:
        return Feedback("Too much knee bend — this is a deadlift not squat", "warning")
    if back >= 165 and 110 <= knee <= 160:
        return Feedback("Great deadlift position — drive hips forward", "good")
    return Feedback("Good deadlift form", "good")


# ── Bench press ───────────────────────────────────────────────────────────────
def _benchpress(elbow: float) -> Feedback:
    if elbow < 50:
        return Feedback("STOP — elbows too low, shoulder impingement risk", "error")
    if elbow > 170:
        return Feedback("Lower the bar — bring it to your chest", "warning")
    if elbow > 140:
        return Feedback("Keep descending — bar should touch chest", "warning")
    if 80 <= elbow <= 100:
        return Feedback("Perfect depth — press up powerfully", "good")
    if elbow < 80:
        return Feedback("Great depth — press to full lockout", "good")
    if 100 < elbow <= 140:
        return Feedback("Control the descent — keep elbows at 45 degrees", "warning")
    return Feedback("Good bench press form", "good")


# ── Public API ────────────────────────────────────────────────────────────────
def get_feedback(
    exercise:    str,
    knee_angle:  float,
    back_angle:  float,
    elbow_angle: float,
) -> Feedback:
    if exercise == "squat":
        return _squat(knee_angle, back_angle)
    if exercise == "deadlift":
        return _deadlift(knee_angle, back_angle)
    if exercise == "benchpress":
        return _benchpress(elbow_angle)
    return Feedback("Unknown exercise", "warning")