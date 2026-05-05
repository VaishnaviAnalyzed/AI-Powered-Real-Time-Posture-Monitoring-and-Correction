import cv2
import torch
import warnings

# Suppress torch.cuda.amp FutureWarning from YOLOv5 internals
warnings.filterwarnings("ignore", category=FutureWarning)
warnings.filterwarnings("ignore", category=UserWarning)

_model = None


def _select_model_size() -> str:
    # Force yolov5n (nano) — fastest, real-time capable even on CPU.
    # yolov5s causes NMS timeout at 20fps input on laptop GPUs.
    print("[Detector] Using yolov5n (nano) for real-time performance")
    return "yolov5n"


def _get_model():
    global _model
    if _model is not None:
        return _model

    size   = _select_model_size()
    device = "cuda" if torch.cuda.is_available() else "cpu"

    with warnings.catch_warnings():
        warnings.simplefilter("ignore")
        _model = torch.hub.load(
            "ultralytics/yolov5", size,
            pretrained=True,
            verbose=False,
        )

    _model.to(device)
    _model.conf    = 0.40   # slightly lower to find partially visible people
    _model.iou     = 0.40
    _model.max_det = 1      # only care about the closest/largest person
    _model.classes = [0]
    _model.eval()
    print(f"[Detector] {size} loaded on {device}")
    return _model


def detect_person(frame, bbox, frame_count, redetect_every=12):
    """Run YOLOv5 every `redetect_every` frames; reuse bbox in between."""
    if bbox is not None and frame_count % redetect_every != 0:
        return bbox

    model  = _get_model()
    h, w   = frame.shape[:2]
    IW, IH = 320, 256
    small  = cv2.resize(frame, (IW, IH))

    with torch.no_grad():
        results    = model(small, size=IW)
        detections = results.xyxy[0]

    best_box, max_area = None, 0
    for det in detections:
        x1, y1, x2, y2 = map(int, det[:4])
        area = (x2 - x1) * (y2 - y1)
        if area > max_area:
            max_area = area
            best_box = [x1, y1, x2, y2]

    if best_box is None:
        return bbox

    sx, sy = w / IW, h / IH
    x1, y1, x2, y2 = best_box
    pad_x = int((x2 - x1) * 0.05)
    pad_y = int((y2 - y1) * 0.05)

    return [
        max(0, int(x1 * sx) - pad_x),
        max(0, int(y1 * sy) - pad_y),
        min(w, int(x2 * sx) + pad_x),
        min(h, int(y2 * sy) + pad_y),
    ]