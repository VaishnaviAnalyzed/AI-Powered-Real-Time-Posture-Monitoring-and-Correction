import numpy as np


def _angle_at_vertex(a, b, c) -> float:
    """
    Core: angle in degrees at point b, formed by rays b→a and b→c.
    Returns 0.0 if either ray has zero length (degenerate landmark).
    """
    a = np.array(a, dtype=float)
    b = np.array(b, dtype=float)
    c = np.array(c, dtype=float)

    ba    = a - b
    bc    = c - b
    denom = np.linalg.norm(ba) * np.linalg.norm(bc)

    if denom < 1e-6:
        return 0.0

    cosine = np.clip(np.dot(ba, bc) / denom, -1.0, 1.0)
    return float(np.degrees(np.arccos(cosine)))


def knee_flexion(hip, knee, ankle) -> float:
    """
    Knee joint angle.
    180° = fully extended (standing).
    ~90° = parallel squat depth.
    """
    return _angle_at_vertex(hip, knee, ankle)


def spine_angle(shoulder, hip, knee) -> float:
    """
    Back / torso angle at the hip.
    180° = perfectly upright.
    Lower = forward lean or rounding.
    """
    return _angle_at_vertex(shoulder, hip, knee)


def elbow_flexion(shoulder, elbow, wrist) -> float:
    """
    Elbow joint angle.
    180° = fully extended (bar locked out on bench).
    ~70–90° = bar at chest (full bench depth).
    """
    return _angle_at_vertex(shoulder, elbow, wrist)


def hip_angle(shoulder, hip, knee) -> float:
    """
    Hip hinge angle — same geometry as spine_angle but
    named separately for deadlift context clarity.
    """
    return _angle_at_vertex(shoulder, hip, knee)