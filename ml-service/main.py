"""ml-service v3 — production inference server for the WarDrobe AI pipeline.

Models served (all artefacts trained in the v3 split-notebook workflow):
  - Model A  modelA_best.keras           Multi-head EfficientNetB2 (type/layer/season + embedding)
  - Model D  modelD_best.keras           Attention U-Net foreground segmentation (256x256 → 1ch)
  - Model B  modelB_compatibility.h5     Pairwise MLP over 384-d pair features
  - embedding_extractor.h5               128-d embedding extractor (input → embedding layer)
  - scaler_b.pkl                         StandardScaler for Model B inputs
  - class_indices.pkl / layer_indices.pkl / season_indices.pkl

Differences vs the legacy main.py:
  - EfficientNetB2 (260x260) instead of B0 (224x224)
  - Model A returns dict outputs (type_out / layer_out / season_out)
  - Layer category comes directly from the layer_out head (no manual mapping)
  - White-background composite before classification (matches training distribution)
  - Mask coverage sanity check with raw-image fallback
  - Shape heuristic removed — Model A is accurate enough on its own (test type acc 0.9104)
  - /rank endpoint removed (no new Model C trained in the v3 pipeline)
"""

import io
import json
import pickle
import uuid
from pathlib import Path
from typing import List

import joblib
import numpy as np
from PIL import Image

from fastapi import FastAPI, UploadFile, File, HTTPException
from pydantic import BaseModel


# ─────────────────────────────────────────────────────────────────────────────
# App + paths
# ─────────────────────────────────────────────────────────────────────────────
app = FastAPI(title="WarDrobe AI — ml-service v3")

UPLOAD_DIR = Path("/app/uploads"); UPLOAD_DIR.mkdir(exist_ok=True)
MODELS_DIR = Path("/app/models")

# Configuration that mirrors the training pipeline exactly
IMG_SIZE = (260, 260)         # EfficientNetB2 native input
SEG_SIZE = (256, 256)         # Attention U-Net input
EMBEDDING_DIM = 128
MASK_COVERAGE_LO = 0.02       # below this → mask probably failed
MASK_COVERAGE_HI = 0.98       # above this → mask covers the entire frame


# ─────────────────────────────────────────────────────────────────────────────
# Sub-category labels for the 20 trained article types.
# (`category` itself is taken directly from the layer_out head — no lookup needed.)
# ─────────────────────────────────────────────────────────────────────────────
TYPE_TO_SUBCATEGORY = {
    "Tshirts":      "t-shirt",     "Shirts":       "shirt",
    "Tops":         "top",
    "Jeans":        "jeans",       "Trousers":     "trousers",
    "Shorts":       "shorts",      "Track Pants":  "track pants",
    "Casual Shoes": "casual shoes","Sports Shoes": "sports shoes",
    "Formal Shoes": "formal shoes","Heels":        "heels",
    "Flats":        "flats",       "Sandals":      "sandals",
    "Flip Flops":   "sandals",
    "Watches":      "watch",       "Sunglasses":   "sunglasses",
    "Belts":        "belt",        "Wallets":      "wallet",
    "Backpacks":    "backpack",    "Handbags":     "bag",
}


# ─────────────────────────────────────────────────────────────────────────────
# Named colour vocabulary (18 names; matches the LAB vocab used in training)
# ─────────────────────────────────────────────────────────────────────────────
NAMED_COLORS = {
    "black":      (20,  20,  20),   "white":      (240, 240, 240),
    "gray":       (128, 128, 128),  "navy":       (10,  30,  80),
    "royal blue": (65,  105, 225),  "sky blue":   (135, 206, 235),
    "teal":       (0,   128, 128),  "green":      (34,  139, 34),
    "olive":      (107, 142, 35),   "yellow":     (255, 215, 0),
    "orange":     (255, 140, 0),    "red":        (200, 30,  30),
    "burgundy":   (128, 0,   32),   "pink":       (255, 105, 147),
    "purple":     (128, 0,   128),  "beige":      (245, 245, 220),
    "brown":      (139, 69,  19),   "camel":      (193, 154, 107),
}


def _nearest_color(rgb):
    return min(NAMED_COLORS, key=lambda n: sum(
        (a - b) ** 2 for a, b in zip(rgb, NAMED_COLORS[n])
    ))


def _dominant_color(img_rgba: Image.Image) -> str:
    """K-Means in RGB (5 clusters) on foreground pixels → nearest named colour."""
    from sklearn.cluster import KMeans
    arr = np.array(img_rgba)
    if arr.ndim == 3 and arr.shape[2] == 4:
        mask = arr[:, :, 3] > 128
        pixels = arr[mask][:, :3]
    else:
        pixels = arr.reshape(-1, 3)
    if len(pixels) < 20:
        return "black"
    if len(pixels) > 6000:
        idx = np.random.choice(len(pixels), 6000, replace=False)
        pixels = pixels[idx]
    km = KMeans(n_clusters=5, n_init=5, random_state=0)
    km.fit(pixels)
    labels, counts = np.unique(km.labels_, return_counts=True)
    centre = km.cluster_centers_[labels[np.argmax(counts)]].astype(int)
    return _nearest_color(tuple(centre))


# ─────────────────────────────────────────────────────────────────────────────
# Lazy-loaded model state
# ─────────────────────────────────────────────────────────────────────────────
_model_a = None          # Multi-head EfficientNetB2 classifier (dict outputs)
_embed_extractor = None  # Sub-model: input → 128-dim embedding
_model_b = None          # Pairwise compatibility MLP
_model_d = None          # Attention U-Net segmentation
_scaler_b = None         # StandardScaler for Model B
_idx_to_type = None      # int → article-type name (e.g. "Tshirts")
_idx_to_layer = None     # int → layer name ("top", "bottom", "footwear", "accessory")
_idx_to_season = None    # int → season group ("hot", "mild", "cold")


def _tf():
    import tensorflow as tf
    return tf


def _get_model_a():
    global _model_a
    if _model_a is None:
        tf = _tf()
        _model_a = tf.keras.models.load_model(
            str(MODELS_DIR / "modelA_best.keras"), compile=False,
        )
    return _model_a


def _get_embed_extractor():
    """Dedicated 128-d embedding extractor (separate file, faster than slicing Model A)."""
    global _embed_extractor
    if _embed_extractor is None:
        _embed_extractor = _tf().keras.models.load_model(
            str(MODELS_DIR / "embedding_extractor.h5"), compile=False,
        )
    return _embed_extractor


def _get_model_b():
    global _model_b
    if _model_b is None:
        _model_b = _tf().keras.models.load_model(
            str(MODELS_DIR / "modelB_compatibility.h5"), compile=False,
        )
    return _model_b


def _get_model_d():
    global _model_d
    if _model_d is None:
        _model_d = _tf().keras.models.load_model(
            str(MODELS_DIR / "modelD_best.keras"), compile=False,
        )
    return _model_d


def _get_scaler_b():
    global _scaler_b
    if _scaler_b is None:
        _scaler_b = joblib.load(MODELS_DIR / "scaler_b.pkl")
    return _scaler_b


def _load_idx_map(filename: str) -> dict:
    """class_indices was saved as {label_name: idx}; we want the inverse."""
    with open(MODELS_DIR / filename, "rb") as f:
        d = pickle.load(f)
    if d and isinstance(next(iter(d.keys())), str):
        return {v: k for k, v in d.items()}
    return dict(d)


def _get_idx_to_type():
    global _idx_to_type
    if _idx_to_type is None:
        _idx_to_type = _load_idx_map("class_indices.pkl")
    return _idx_to_type


def _get_idx_to_layer():
    global _idx_to_layer
    if _idx_to_layer is None:
        _idx_to_layer = _load_idx_map("layer_indices.pkl")
    return _idx_to_layer


def _get_idx_to_season():
    global _idx_to_season
    if _idx_to_season is None:
        _idx_to_season = _load_idx_map("season_indices.pkl")
    return _idx_to_season


# ─────────────────────────────────────────────────────────────────────────────
# Startup preload (so the first /analyze isn't 30 s slow)
# ─────────────────────────────────────────────────────────────────────────────
@app.on_event("startup")
def preload_models():
    import threading

    def _load():
        try:
            _get_model_d();        print("[startup] Model D loaded")
            _get_model_a();        print("[startup] Model A loaded")
            _get_embed_extractor();print("[startup] embedding_extractor loaded")
            _get_model_b();        print("[startup] Model B loaded")
            _get_scaler_b();       print("[startup] scaler_b loaded")
            _get_idx_to_type();    print("[startup] class_indices loaded")
            _get_idx_to_layer();   print("[startup] layer_indices loaded")
            _get_idx_to_season();  print("[startup] season_indices loaded")
            print("[startup] All v3 models ready.")
        except Exception as e:
            print(f"[startup] WARNING: model preload failed: {e}")

    threading.Thread(target=_load, daemon=True).start()


# ─────────────────────────────────────────────────────────────────────────────
# Pre-processing helpers
# ─────────────────────────────────────────────────────────────────────────────
def _preprocess_efficientnetb2(img: Image.Image) -> np.ndarray:
    """Resize to 260x260 + EfficientNet preprocess (the same eff_pre used in training)."""
    from tensorflow.keras.applications.efficientnet import preprocess_input
    arr = np.array(img.convert("RGB").resize(IMG_SIZE), dtype=np.float32)
    return preprocess_input(np.expand_dims(arr, 0))


def _composite_on_white(img: Image.Image, mask_2d: np.ndarray, size=IMG_SIZE) -> Image.Image:
    """Paste foreground onto a white canvas at the requested size — matches the
    studio-only training distribution that Model A was trained on."""
    rgb = np.array(img.convert("RGB").resize(size), dtype=np.float32)
    mask = np.array(Image.fromarray((mask_2d * 255).astype(np.uint8)).resize(size, Image.BILINEAR),
                    dtype=np.float32) / 255.0
    mask = np.clip(mask, 0.0, 1.0)[:, :, None]
    white = np.full_like(rgb, 255.0)
    out = rgb * mask + white * (1.0 - mask)
    return Image.fromarray(np.clip(out, 0, 255).astype(np.uint8))


# ─────────────────────────────────────────────────────────────────────────────
# Segmentation: Model D primary, raw-image fallback when mask coverage is bad
# ─────────────────────────────────────────────────────────────────────────────
def _segment_model_d(img: Image.Image) -> np.ndarray:
    """Returns a binary mask at SEG_SIZE (numpy float32 in [0,1])."""
    model_d = _get_model_d()
    arr = np.array(img.convert("RGB").resize(SEG_SIZE), dtype=np.float32) / 255.0
    pred = model_d.predict(np.expand_dims(arr, 0), verbose=0)[0, :, :, 0]
    return (pred > 0.5).astype(np.float32)


def _build_no_bg_rgba(original: Image.Image, mask_2d: np.ndarray) -> Image.Image:
    """Make an RGBA preview — the foreground original with mask as alpha channel."""
    mask_pil = Image.fromarray((mask_2d * 255).astype(np.uint8)).resize(original.size, Image.BILINEAR)
    rgba = original.convert("RGBA")
    rgba.putalpha(mask_pil)
    return rgba


# ─────────────────────────────────────────────────────────────────────────────
# Classification: Model A multi-head dict outputs
# ─────────────────────────────────────────────────────────────────────────────
def _classify(image_for_classifier: Image.Image):
    """Run Model A on the (white-composited) image and unpack all three heads."""
    model_a = _get_model_a()
    preds = model_a.predict(_preprocess_efficientnetb2(image_for_classifier), verbose=0)

    # In Keras 3, dict-output models return dicts; older versions may return list.
    if isinstance(preds, dict):
        type_p   = preds["type_out"][0]
        layer_p  = preds["layer_out"][0]
        season_p = preds["season_out"][0]
    else:
        # Defensive: unpack assuming the model.outputs ordering matches dict alphabetical
        type_p   = preds[2][0] if len(preds) >= 3 else preds[0][0]
        layer_p  = preds[0][0] if len(preds) >= 3 else preds[0][0]
        season_p = preds[1][0] if len(preds) >= 3 else preds[0][0]

    idx_to_type   = _get_idx_to_type()
    idx_to_layer  = _get_idx_to_layer()
    idx_to_season = _get_idx_to_season()

    type_idx   = int(np.argmax(type_p))
    layer_idx  = int(np.argmax(layer_p))
    season_idx = int(np.argmax(season_p))

    article_type = idx_to_type.get(type_idx,   "Tshirts")
    layer_name   = idx_to_layer.get(layer_idx,  "top")
    season_name  = idx_to_season.get(season_idx,"mild")

    type_conf   = float(type_p[type_idx])
    layer_conf  = float(layer_p[layer_idx])
    season_conf = float(season_p[season_idx])

    subcategory = TYPE_TO_SUBCATEGORY.get(article_type, article_type.lower())

    return {
        "category":     layer_name,                  # frontend-facing top/bottom/footwear/accessory
        "subcategory":  subcategory,                 # human-friendly sub label
        "type":         article_type,                # raw articleType from training
        "season":       season_name,                 # hot / mild / cold
        "confidence":   type_conf,
        "layer_confidence":  layer_conf,
        "season_confidence": season_conf,
    }


# ─────────────────────────────────────────────────────────────────────────────
# Embedding extraction (separate dedicated extractor → 128-d)
# ─────────────────────────────────────────────────────────────────────────────
def _get_embedding(image_for_classifier: Image.Image) -> np.ndarray:
    extractor = _get_embed_extractor()
    return extractor.predict(_preprocess_efficientnetb2(image_for_classifier), verbose=0)[0].astype(np.float32)


# ─────────────────────────────────────────────────────────────────────────────
# /analyze
# ─────────────────────────────────────────────────────────────────────────────
@app.post("/analyze")
async def analyze(file: UploadFile = File(...)):
    """Full pipeline:
        Model D segmentation → white-bg composite → Model A multi-head classification
        + 128-d embedding + K-Means dominant colour.
    Returns the same field set as v2 ml-service plus three new fields
    (type, season, layer/season confidences) so existing frontend code keeps working."""
    contents = await file.read()
    try:
        original = Image.open(io.BytesIO(contents))
    except Exception:
        raise HTTPException(400, "Cannot decode image")

    # Stage 1 — segmentation (Model D, with raw-image fallback on bad coverage)
    mask_seg = None
    used_segmenter = "model_d"
    try:
        mask_seg = _segment_model_d(original)
        coverage = float(mask_seg.mean())
        if not (MASK_COVERAGE_LO <= coverage <= MASK_COVERAGE_HI):
            print(f"[/analyze] Model D coverage={coverage:.3f} — fallback to raw image")
            mask_seg = None
            used_segmenter = "raw_image"
    except Exception as e:
        print(f"[/analyze] Model D failed: {e} — fallback to raw image")
        mask_seg = None
        used_segmenter = "raw_image"

    # Build no-bg preview for the frontend
    if mask_seg is not None:
        no_bg_rgba = _build_no_bg_rgba(original, mask_seg)
    else:
        no_bg_rgba = original.convert("RGBA")
    no_bg_filename = f"nobg_{uuid.uuid4()}.png"
    no_bg_rgba.save(UPLOAD_DIR / no_bg_filename, "PNG")

    # Stage 2 — white-bg composite for the classifier (training-distribution match)
    if mask_seg is not None:
        image_for_clf = _composite_on_white(original, mask_seg, size=IMG_SIZE)
    else:
        image_for_clf = original.convert("RGB").resize(IMG_SIZE)

    # Stage 3 — classification + embedding
    try:
        cls = _classify(image_for_clf)
    except Exception as e:
        print(f"[/analyze] classification failed: {e}")
        cls = {"category": "top", "subcategory": "t-shirt", "type": "Tshirts",
               "season": "mild", "confidence": 0.0,
               "layer_confidence": 0.0, "season_confidence": 0.0}

    try:
        embedding = _get_embedding(image_for_clf).tolist()
    except Exception as e:
        print(f"[/analyze] embedding failed: {e}")
        embedding = []

    # Stage 4 — dominant colour (uses the no-bg RGBA so background pixels are ignored)
    try:
        color = _dominant_color(no_bg_rgba)
    except Exception:
        color = "black"

    return {
        # Backwards-compatible fields
        "category":         cls["category"],
        "subcategory":      cls["subcategory"],
        "color":            color,
        "confidence":       round(cls["confidence"], 3),
        "no_bg_filename":   no_bg_filename,
        "embedding":        embedding,
        # New v3 fields
        "type":             cls["type"],
        "season":           cls["season"],
        "layer_confidence": round(cls["layer_confidence"],  3),
        "season_confidence":round(cls["season_confidence"], 3),
        "segmenter":        used_segmenter,    # "model_d" or "raw_image"
    }


# ─────────────────────────────────────────────────────────────────────────────
# /compatibility — Model B pairwise scorer (unchanged interface)
# ─────────────────────────────────────────────────────────────────────────────
class CompatibilityRequest(BaseModel):
    embedding1: List[float]
    embedding2: List[float]


@app.post("/compatibility")
async def compatibility(req: CompatibilityRequest):
    """Pairwise garment compatibility using Model B (Pairwise MLP) over Model A embeddings."""
    e1 = np.array(req.embedding1, dtype=np.float32)
    e2 = np.array(req.embedding2, dtype=np.float32)
    if len(e1) != EMBEDDING_DIM or len(e2) != EMBEDDING_DIM:
        raise HTTPException(400, f"Each embedding must be {EMBEDDING_DIM}-dimensional")
    pair_feat = np.concatenate([e1, e2, np.abs(e1 - e2)]).reshape(1, -1)
    pair_scaled = _get_scaler_b().transform(pair_feat)
    score = float(_get_model_b().predict(pair_scaled, verbose=0)[0][0])
    return {"score": round(score, 4)}


# ─────────────────────────────────────────────────────────────────────────────
# /health — model status + training metrics for diagnostics
# ─────────────────────────────────────────────────────────────────────────────
@app.get("/health")
def health():
    summary_path = MODELS_DIR / "training_summary.json"
    summary = {}
    if summary_path.exists():
        try:
            summary = json.loads(summary_path.read_text())
        except Exception:
            summary = {}
    return {
        "status":     "ok",
        "service":    "ml-service v3",
        "models":     {
            "model_a": "modelA_best.keras (EfficientNetB2 multi-head)",
            "model_d": "modelD_best.keras (Attention U-Net)",
            "model_b": "modelB_compatibility.h5 (Pairwise MLP)",
            "embedding_extractor": "embedding_extractor.h5 (128-d)",
        },
        "training_metrics": summary.get("test_metrics", {}),
    }
