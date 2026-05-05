from collections import deque

# Isolated history per angle key so knee angles never pollute back angles
_histories: dict[str, deque] = {}


def smooth(value: float, key: str = "default", window: int = 6) -> float:
    """
    Exponential-weighted moving average over a sliding window.

    More recent readings carry more weight:
      weights = [0.5^(n-1), 0.5^(n-2), ..., 0.5^0]
    where n = buffer length.

    Args:
        value:  Raw angle reading for this frame.
        key:    Unique name per angle stream, e.g. "knee", "back", "elbow".
                Always pass the same key for the same angle so histories
                stay isolated.
        window: How many frames to average over (default 6 ≈ 0.3 s at 20 fps).
    """
    if key not in _histories:
        _histories[key] = deque(maxlen=window)

    _histories[key].append(value)
    buf = _histories[key]

    weights = [0.5 ** (len(buf) - 1 - i) for i in range(len(buf))]
    total_w = sum(weights)
    return sum(v * w for v, w in zip(buf, weights)) / total_w


def reset(key: str | None = None) -> None:
    """
    Clear angle history.
    Call with no args when switching exercises to avoid stale values
    leaking into the new exercise's first few frames.
    """
    if key is None:
        _histories.clear()
    elif key in _histories:
        del _histories[key]