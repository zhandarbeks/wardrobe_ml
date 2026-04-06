# ML Service — three-stage pipeline:
#   1. Background removal   — rembg (U2-Net based)
#   2. Garment classification — CLIP zero-shot (openai/clip-vit-base-patch32)
#   3. Dominant colour       — K-Means in RGB space
from fastapi import FastAPI, UploadFile, File, HTTPException
from PIL import Image
import io
import uuid
import numpy as np
from pathlib import Path
from sklearn.cluster import KMeans

app = FastAPI(title="ML Service")
UPLOAD_DIR = Path("/app/uploads")
UPLOAD_DIR.mkdir(exist_ok=True)

# ---------------------------------------------------------------------------
# Colour vocabulary — named colours with reference RGB values
# ---------------------------------------------------------------------------
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


def nearest_color(rgb: tuple) -> str:
    r, g, b = rgb
    return min(
        NAMED_COLORS,
        key=lambda n: sum((a - b_) ** 2 for a, b_ in zip((r, g, b), NAMED_COLORS[n])),
    )


def dominant_color(img_rgba: Image.Image) -> str:
    arr = np.array(img_rgba)
    if arr.ndim == 3 and arr.shape[2] == 4:
        # Use only non-transparent foreground pixels
        mask = arr[:, :, 3] > 128
        pixels = arr[mask][:, :3]
    else:
        pixels = arr.reshape(-1, 3)

    if len(pixels) < 20:
        return "black"

    # Downsample for performance
    if len(pixels) > 6000:
        idx = np.random.choice(len(pixels), 6000, replace=False)
        pixels = pixels[idx]

    km = KMeans(n_clusters=5, n_init=5, random_state=0)
    km.fit(pixels)
    labels, counts = np.unique(km.labels_, return_counts=True)
    center = km.cluster_centers_[labels[np.argmax(counts)]].astype(int)
    return nearest_color(tuple(center))


# ---------------------------------------------------------------------------
# CLIP zero-shot classification
# ---------------------------------------------------------------------------
CLOTHING_PROMPTS = [
    "a t-shirt or top",
    "a dress shirt or blouse",
    "a sweater or hoodie",
    "a jacket or coat",
    "jeans or trousers",
    "shorts",
    "a skirt or dress",
    "sneakers or casual shoes",
    "boots or formal shoes",
    "an accessory such as a hat scarf or bag",
]

# Maps prompt text → (category, subcategory)
PROMPT_MAP = {
    "a t-shirt or top":                        ("top",       "t-shirt"),
    "a dress shirt or blouse":                 ("top",       "shirt"),
    "a sweater or hoodie":                     ("mid",       "sweater"),
    "a jacket or coat":                        ("outer",     "jacket"),
    "jeans or trousers":                       ("bottom",    "jeans"),
    "shorts":                                  ("bottom",    "shorts"),
    "a skirt or dress":                        ("bottom",    "skirt"),
    "sneakers or casual shoes":                ("footwear",  "sneakers"),
    "boots or formal shoes":                   ("footwear",  "boots"),
    "an accessory such as a hat scarf or bag": ("accessory", "accessory"),
}

_clip_model = None
_clip_proc = None


def get_clip():
    global _clip_model, _clip_proc
    if _clip_model is None:
        from transformers import CLIPModel, CLIPProcessor
        _clip_model = CLIPModel.from_pretrained("openai/clip-vit-base-patch32")
        _clip_proc = CLIPProcessor.from_pretrained("openai/clip-vit-base-patch32")
        _clip_model.eval()
    return _clip_model, _clip_proc


def classify(img: Image.Image):
    try:
        import torch
        model, proc = get_clip()
        inputs = proc(
            text=CLOTHING_PROMPTS,
            images=img,
            return_tensors="pt",
            padding=True,
        )
        with torch.no_grad():
            logits = model(**inputs).logits_per_image[0]
            probs = logits.softmax(dim=0).numpy()

        best = int(np.argmax(probs))
        label = CLOTHING_PROMPTS[best]
        cat, sub = PROMPT_MAP[label]
        return cat, sub, float(probs[best])
    except Exception:
        return "top", "t-shirt", 0.0


# ---------------------------------------------------------------------------
# API endpoint
# ---------------------------------------------------------------------------
@app.post("/analyze")
async def analyze(file: UploadFile = File(...)):
    contents = await file.read()
    try:
        original = Image.open(io.BytesIO(contents)).convert("RGBA")
    except Exception:
        raise HTTPException(400, "Cannot decode image")

    # Stage 1: background removal with rembg
    try:
        from rembg import remove
        no_bg_bytes = remove(contents)
        no_bg = Image.open(io.BytesIO(no_bg_bytes)).convert("RGBA")
    except Exception:
        no_bg = original

    # Save no-bg PNG
    fname = f"nobg_{uuid.uuid4()}.png"
    no_bg.save(UPLOAD_DIR / fname, "PNG")

    # Stage 2: CLIP classification on RGB image
    category, subcategory, confidence = classify(original.convert("RGB"))

    # Stage 3: dominant colour from foreground pixels only
    color = dominant_color(no_bg)

    return {
        "category": category,
        "subcategory": subcategory,
        "color": color,
        "confidence": round(confidence, 3),
        "no_bg_filename": fname,
    }


@app.get("/health")
def health():
    return {"status": "ok", "service": "ml-service"}
