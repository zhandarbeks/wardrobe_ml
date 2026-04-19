"""
ML Service — trained model pipeline:
  1. Background removal     — ModelD U-Net      (modelD_unet_segmentation.h5)
  2. Classification+Embedding — ModelA EfficientNetB0 (modelA_efficientnetb0.h5)
  3. Dominant colour        — K-Means (RGB)
  4. Pairwise compatibility — ModelB Siamese MLP (modelB_compatibility.h5)
  5. Context-aware ranking  — ModelC XGBoost     (modelC_xgboost.pkl)
"""
import io
import pickle
import joblib
import uuid
import numpy as np
from pathlib import Path
from PIL import Image
from fastapi import FastAPI, UploadFile, File, HTTPException
from pydantic import BaseModel
from typing import List, Optional

app = FastAPI(title="ML Service")
UPLOAD_DIR = Path("/app/uploads")
UPLOAD_DIR.mkdir(exist_ok=True)
MODELS_DIR = Path("/app/models")


@app.on_event("startup")
def preload_models():
    """Load all models into memory at startup so first request isn't slow."""
    import threading
    def _load():
        try:
            _get_model_d()
            print("[startup] ModelD (U-Net) loaded")
            _get_model_a()
            print("[startup] ModelA (EfficientNetB0) loaded")
            _get_model_b()
            print("[startup] ModelB (Siamese MLP) loaded")
            _get_scaler_b()
            print("[startup] Scaler_B loaded")
            _get_model_c()
            print("[startup] ModelC (XGBoost) loaded")
            _get_idx_to_class()
            print("[startup] class_indices loaded")
            print("[startup] All models ready.")
        except Exception as e:
            print(f"[startup] WARNING: model preload failed: {e}")
    threading.Thread(target=_load, daemon=True).start()

# ── Class → wardrobe category mapping ───────────────────────────────────────
CLASS_TO_CATEGORY = {
    # Tops
    "Tshirts":          ("top",       "t-shirt"),
    "Shirts":           ("top",       "shirt"),
    "Tops":             ("top",       "top"),
    "Kurtas":           ("top",       "kurta"),
    "Blouses":          ("top",       "top"),
    "Tank Tops":        ("top",       "tank top"),
    "Polo Tshirts":     ("top",       "polo"),
    "Tunics":           ("top",       "top"),
    # Mid layer
    "Sweatshirts":      ("mid",       "sweatshirt"),
    "Sweaters":         ("mid",       "sweater"),
    "Jackets":          ("outer",     "jacket"),
    "Blazers":          ("outer",     "blazer"),
    "Rain Jackets":     ("outer",     "jacket"),
    "Trench Coats":     ("outer",     "jacket"),
    "Coats":            ("outer",     "jacket"),
    "Waistcoats":       ("outer",     "blazer"),
    "Windcheaters":     ("outer",     "jacket"),
    # Bottoms
    "Jeans":            ("bottom",    "jeans"),
    "Trousers":         ("bottom",    "trousers"),
    "Shorts":           ("bottom",    "shorts"),
    "Skirts":           ("bottom",    "skirt"),
    "Leggings":         ("bottom",    "leggings"),
    "Track Pants":      ("bottom",    "track pants"),
    "Capris":           ("bottom",    "trousers"),
    "Joggers":          ("bottom",    "joggers"),
    "Jeggings":         ("bottom",    "leggings"),
    # Footwear
    "Casual Shoes":     ("footwear",  "casual shoes"),
    "Sports Shoes":     ("footwear",  "sports shoes"),
    "Formal Shoes":     ("footwear",  "formal shoes"),
    "Heels":            ("footwear",  "heels"),
    "Flats":            ("footwear",  "flats"),
    "Sandals":          ("footwear",  "sandals"),
    "Flip Flops":       ("footwear",  "sandals"),
    "Boots":            ("footwear",  "casual shoes"),
    "Loafers":          ("footwear",  "formal shoes"),
    # Accessories
    "Watches":          ("accessory", "watch"),
    "Sunglasses":       ("accessory", "sunglasses"),
    "Handbags":         ("accessory", "bag"),
    "Backpacks":        ("accessory", "backpack"),
    "Belts":            ("accessory", "belt"),
    "Hats":             ("accessory", "belt"),
    "Caps":             ("accessory", "belt"),
    "Scarves":          ("accessory", "belt"),
    "Socks":            ("footwear",  "casual shoes"),
    "Ties":             ("accessory", "belt"),
}

# ── Named colour vocabulary ──────────────────────────────────────────────────
NAMED_COLORS = {
    "black":      (20,  20,  20),
    "white":      (240, 240, 240),
    "gray":       (128, 128, 128),
    "navy":       (10,  30,  80),
    "royal blue": (65,  105, 225),
    "sky blue":   (135, 206, 235),
    "teal":       (0,   128, 128),
    "green":      (34,  139, 34),
    "olive":      (107, 142, 35),
    "yellow":     (255, 215, 0),
    "orange":     (255, 140, 0),
    "red":        (200, 30,  30),
    "burgundy":   (128, 0,   32),
    "pink":       (255, 105, 147),
    "purple":     (128, 0,   128),
    "beige":      (245, 245, 220),
    "brown":      (139, 69,  19),
    "camel":      (193, 154, 107),
}


def _nearest_color(rgb: tuple) -> str:
    r, g, b = rgb
    return min(NAMED_COLORS, key=lambda n: sum(
        (a - b_) ** 2 for a, b_ in zip((r, g, b), NAMED_COLORS[n])
    ))


def _dominant_color(img_rgba: Image.Image) -> str:
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
    center = km.cluster_centers_[labels[np.argmax(counts)]].astype(int)
    return _nearest_color(tuple(center))


# ── Lazy-loaded model state ──────────────────────────────────────────────────
_model_a = None          # EfficientNetB0 full model
_embed_extractor = None  # sub-model: input → 128-dim embedding
_model_b = None          # Siamese MLP compatibility scorer
_model_c = None          # XGBoost outfit ranker
_model_d = None          # U-Net background segmentation
_scaler_b = None         # StandardScaler for ModelB inputs
_idx_to_class = None     # {int → class_name}


def _tf():
    import tensorflow as tf
    return tf


def _get_model_a():
    global _model_a, _embed_extractor
    if _model_a is None:
        tf = _tf()
        _model_a = tf.keras.models.load_model(
            str(MODELS_DIR / "modelA_efficientnetb0.h5"), compile=False
        )
        # Build a sub-model that outputs only the 128-dim embedding layer
        try:
            emb_output = _model_a.get_layer("embedding").output
        except (ValueError, AttributeError):
            # fallback: take last output if model has multiple outputs
            outputs = _model_a.outputs
            emb_output = outputs[-1] if len(outputs) > 1 else outputs[0]
        _embed_extractor = tf.keras.Model(
            inputs=_model_a.input, outputs=emb_output
        )
    return _model_a, _embed_extractor


def _get_model_b():
    global _model_b
    if _model_b is None:
        _model_b = _tf().keras.models.load_model(
            str(MODELS_DIR / "modelB_compatibility.h5"), compile=False
        )
    return _model_b


def _get_model_c():
    global _model_c
    if _model_c is None:
        with open(MODELS_DIR / "modelC_xgboost.pkl", "rb") as f:
            _model_c = pickle.load(f)
    return _model_c


def _get_model_d():
    global _model_d
    if _model_d is None:
        _model_d = _tf().keras.models.load_model(
            str(MODELS_DIR / "modelD_unet_segmentation.h5"), compile=False
        )
    return _model_d


def _get_scaler_b():
    global _scaler_b
    if _scaler_b is None:
        # Saved with joblib (pickle protocol 5 + numpy buffers) — must use joblib to load
        _scaler_b = joblib.load(MODELS_DIR / "scaler_b.pkl")
    return _scaler_b


def _get_idx_to_class():
    global _idx_to_class
    if _idx_to_class is None:
        with open(MODELS_DIR / "class_indices.pkl", "rb") as f:
            ci = pickle.load(f)
        # class_indices from Keras is {class_name: index} → invert
        if ci and isinstance(next(iter(ci.keys())), str):
            _idx_to_class = {v: k for k, v in ci.items()}
        else:
            _idx_to_class = dict(ci)
    return _idx_to_class


# ── Preprocessing helpers ────────────────────────────────────────────────────
def _preprocess_efficientnet(img: Image.Image) -> np.ndarray:
    """Resize to 224×224 and apply EfficientNet normalization (→ [-1, 1])."""
    from tensorflow.keras.applications.efficientnet import preprocess_input
    arr = np.array(img.convert("RGB").resize((224, 224)), dtype=np.float32)
    return preprocess_input(np.expand_dims(arr, 0))


# ── Core pipeline functions ──────────────────────────────────────────────────
def _segment_background(img: Image.Image) -> Image.Image:
    """U-Net binary segmentation → RGBA with transparent background."""
    model_d = _get_model_d()
    orig_size = img.size
    arr = np.array(img.convert("RGB").resize((256, 256)), dtype=np.float32) / 255.0
    pred = model_d.predict(np.expand_dims(arr, 0), verbose=0)[0, :, :, 0]
    mask = (pred > 0.5).astype(np.uint8) * 255
    mask_pil = Image.fromarray(mask).resize(orig_size, Image.BILINEAR)
    rgba = img.convert("RGBA")
    rgba.putalpha(mask_pil)
    return rgba


def _get_embedding(img: Image.Image) -> np.ndarray:
    """Extract 128-dim EfficientNetB0 embedding."""
    _, extractor = _get_model_a()
    return extractor.predict(_preprocess_efficientnet(img), verbose=0)[0].astype(np.float32)


def _classify_by_shape(mask_rgba: Image.Image) -> tuple:
    """
    Shape/silhouette heuristic on the U-Net foreground mask.
    Returns (category, subcategory, confidence).

    Rules derived from bounding-box geometry of the foreground region:
      - footwear  : very wide relative to height (aspect < 0.7) OR very short vertically
      - accessory : small area (<8% of image) OR nearly square compact shape
      - outer     : wide-shoulder profile at top (shoulder_ratio > 1.3)
      - bottom    : tall narrow shape with two-leg symmetry (aspect > 1.6, symmetric)
      - mid       : moderate width, no strong shoulder taper
      - top       : default with visible shoulder width
    """
    arr = np.array(mask_rgba)
    if arr.ndim == 4 or (arr.ndim == 3 and arr.shape[2] == 4):
        alpha = arr[:, :, 3]
    else:
        alpha = arr

    fg = (alpha > 128).astype(np.uint8)
    rows = np.any(fg, axis=1)
    cols = np.any(fg, axis=0)
    if not rows.any():
        return "top", "t-shirt", 0.3

    r_min, r_max = np.where(rows)[0][[0, -1]]
    c_min, c_max = np.where(cols)[0][[0, -1]]
    h = int(r_max - r_min) + 1
    w = int(c_max - c_min) + 1
    total_px = fg.shape[0] * fg.shape[1]
    fg_area_ratio = fg.sum() / total_px

    aspect = h / max(w, 1)          # > 1 → tall, < 1 → wide/short

    # Widths at top-25%, middle, bottom-25% of the bounding box
    q1 = int(r_min + h * 0.20)
    q2 = int(r_min + h * 0.50)
    q3 = int(r_min + h * 0.80)
    w_top    = int(fg[max(q1-5, 0):q1+5, :].any(axis=0).sum())
    w_mid    = int(fg[max(q2-5, 0):q2+5, :].any(axis=0).sum())
    w_bottom = int(fg[max(q3-5, 0):q3+5, :].any(axis=0).sum())

    shoulder_ratio = w_top / max(w_mid, 1)
    taper_ratio    = w_top / max(w_bottom, 1)

    # ── Decision tree ────────────────────────────────────────────────────────
    # Footwear: wide and short bounding box
    if aspect < 0.65 or (aspect < 0.85 and w_bottom > w_top * 1.5):
        return "footwear", "casual shoes", 0.72

    # Accessory: very small foreground area
    if fg_area_ratio < 0.07:
        return "accessory", "watch", 0.65

    # Bottom (trousers/jeans): tall shape + symmetric two-leg split at bottom
    if aspect > 1.55:
        bottom_half = fg[q2:, :]
        col_sum = bottom_half.sum(axis=0)
        left_mass  = col_sum[:fg.shape[1]//2].sum()
        right_mass = col_sum[fg.shape[1]//2:].sum()
        balance = min(left_mass, right_mass) / max(max(left_mass, right_mass), 1)
        if balance > 0.25:
            return "bottom", "jeans", 0.74
        return "bottom", "trousers", 0.65

    # Outer (jacket/coat): very pronounced shoulder flare
    # Regular t-shirts have shoulder_ratio ~1.2-1.4; jackets/coats > 1.55
    if shoulder_ratio > 1.55 and taper_ratio > 1.3 and aspect > 0.85:
        return "outer", "jacket", 0.68

    # Mid layer: boxy shape, no shoulder flare, moderate height
    if 0.85 < aspect < 1.5 and shoulder_ratio < 1.15 and w_mid >= w_top * 0.85:
        return "mid", "sweater", 0.60

    # Top — shirt if there is a noticeable shoulder width; t-shirt otherwise
    sub = "shirt" if shoulder_ratio > 1.3 else "t-shirt"
    return "top", sub, 0.65


def _classify(img: Image.Image, mask_rgba: Image.Image = None):
    """
    Hybrid classification:
      1. EfficientNetB0 — trusted only for non-top accessories/footwear
         (model is trained on 10 specific classes; it over-predicts Tshirts for clothes)
      2. Shape heuristic  — used for all garment categories (top/mid/outer/bottom)
    Returns (category, subcategory, confidence).
    """
    model_a, _ = _get_model_a()
    idx_to_class = _get_idx_to_class()

    # ── EfficientNetB0 prediction ────────────────────────────────────────────
    preds = model_a.predict(_preprocess_efficientnet(img), verbose=0)
    class_probs = preds[0] if isinstance(preds, list) else preds
    class_probs = class_probs[0]
    best_idx  = int(np.argmax(class_probs))
    cnn_conf  = float(class_probs[best_idx])
    class_name = idx_to_class.get(best_idx, "Tshirts")
    cnn_cat, cnn_sub = CLASS_TO_CATEGORY.get(class_name, ("top", "t-shirt"))

    # Trust CNN only when it confidently predicts a non-clothing accessory/footwear
    NON_GARMENT = {"footwear", "accessory"}
    if cnn_cat in NON_GARMENT and cnn_conf >= 0.60:
        return cnn_cat, cnn_sub, cnn_conf

    # ── Shape heuristic for garment categories ───────────────────────────────
    if mask_rgba is not None:
        shape_cat, shape_sub, shape_conf = _classify_by_shape(mask_rgba)
        return shape_cat, shape_sub, shape_conf

    # Final fallback
    return cnn_cat, cnn_sub, cnn_conf


# ── API endpoints ─────────────────────────────────────────────────────────────

@app.post("/analyze")
async def analyze(file: UploadFile = File(...)):
    """
    Full pipeline: U-Net segmentation → EfficientNetB0 classification
    + embedding → K-Means dominant colour.
    Returns embedding (128 floats) for downstream compatibility scoring.
    """
    contents = await file.read()
    try:
        original = Image.open(io.BytesIO(contents))
    except Exception:
        raise HTTPException(400, "Cannot decode image")

    # Stage 1: background removal via U-Net
    try:
        no_bg = _segment_background(original)
    except Exception:
        no_bg = original.convert("RGBA")

    fname = f"nobg_{uuid.uuid4()}.png"
    no_bg.save(UPLOAD_DIR / fname, "PNG")

    # Stage 2: classification (pass mask so shape heuristic can run) + embedding
    try:
        category, subcategory, confidence = _classify(original, mask_rgba=no_bg)
        embedding = _get_embedding(original).tolist()
    except Exception:
        category, subcategory, confidence = "top", "t-shirt", 0.0
        embedding = []

    # Stage 3: dominant colour from foreground pixels
    try:
        color = _dominant_color(no_bg)
    except Exception:
        color = "black"

    return {
        "category": category,
        "subcategory": subcategory,
        "color": color,
        "confidence": round(confidence, 3),
        "no_bg_filename": fname,
        "embedding": embedding,
    }


class CompatibilityRequest(BaseModel):
    embedding1: List[float]
    embedding2: List[float]


@app.post("/compatibility")
async def compatibility(req: CompatibilityRequest):
    """
    Pairwise garment compatibility using ModelB (Siamese MLP).
    Input: two 128-dim EfficientNetB0 embeddings.
    Output: compatibility score in [0, 1].
    """
    e1 = np.array(req.embedding1, dtype=np.float32)
    e2 = np.array(req.embedding2, dtype=np.float32)
    if len(e1) != 128 or len(e2) != 128:
        raise HTTPException(400, "Each embedding must be 128-dimensional")
    pair_feat = np.concatenate([e1, e2, np.abs(e1 - e2)]).reshape(1, -1)
    scaler = _get_scaler_b()
    pair_scaled = scaler.transform(pair_feat)
    model_b = _get_model_b()
    score = float(model_b.predict(pair_scaled, verbose=0)[0][0])
    return {"score": round(score, 4)}


class RankRequest(BaseModel):
    visual_compat: float   # avg pairwise ModelB score [0,1]
    colour_harmony: float  # Itten hue harmony score (normalised)
    season_match: float    # 1.0 / 0.5 / 0.0
    temp_in_range: float   # fraction of items whose temp range covers current T
    rain_protected: float  # 1 if outfit handles rain, 0 otherwise
    pref_colour: float     # user preference colour match
    pref_style: float      # user preference style match


@app.post("/rank")
async def rank_outfit(req: RankRequest):
    """
    Context-aware outfit ranking using ModelC XGBoost (7 features).
    Output: suitability probability in [0, 1].
    """
    features = np.array([[
        req.visual_compat, req.colour_harmony,
        req.season_match,  req.temp_in_range,
        req.rain_protected, req.pref_colour, req.pref_style,
    ]], dtype=np.float32)
    model_c = _get_model_c()
    score = float(model_c.predict_proba(features)[0, 1])
    return {"score": round(score, 4)}


@app.get("/health")
def health():
    return {"status": "ok", "service": "ml-service"}
