"""
Rep counter — UP → DOWN → UP state machine.

One full rep = joint crosses DOWN threshold then returns past UP threshold.

Thresholds per exercise:
  squat/deadlift → tracked via knee angle
  benchpress     → tracked via elbow angle

To tune: if reps aren't counting, print the live angle and adjust
DOWN_THRESH until it's ~10° below your lowest point.
"""

from dataclasses import dataclass


EXERCISE_CONFIG: dict[str, dict] = {
    "squat": {
        "joint":       "knee",
        "up_thresh":   155,   # standing straight
        "down_thresh": 105,   # at squat depth
    },
    "deadlift": {
        "joint":       "knee",
        "up_thresh":   160,   # hips locked out
        "down_thresh": 125,   # bar at shin level
    },
    "benchpress": {
        "joint":       "elbow",
        "up_thresh":   150,   # bar locked out
        "down_thresh":  95,   # bar at chest
    },
}


@dataclass
class RepState:
    phase: str = "up"   # "up" | "down"
    reps:  int = 0


_states: dict[str, RepState] = {}


def _get_state(exercise: str) -> RepState:
    if exercise not in _states:
        _states[exercise] = RepState()
    return _states[exercise]


def count_rep(exercise: str, knee_angle: float, elbow_angle: float) -> int:
    """
    Call every frame. Returns current total rep count.
    """
    cfg = EXERCISE_CONFIG.get(exercise)
    if cfg is None:
        return 0

    angle = knee_angle if cfg["joint"] == "knee" else elbow_angle
    state = _get_state(exercise)

    if state.phase == "up" and angle < cfg["down_thresh"]:
        state.phase = "down"

    elif state.phase == "down" and angle > cfg["up_thresh"]:
        state.phase = "up"
        state.reps += 1

    return state.reps


def get_phase(exercise: str) -> str:
    """Returns 'up' or 'down' — useful for debug overlay."""
    return _get_state(exercise).phase


def get_reps(exercise: str) -> int:
    return _get_state(exercise).reps


def reset_reps(exercise: str | None = None) -> None:
    if exercise is None:
        _states.clear()
    else:
        _states.pop(exercise, None)