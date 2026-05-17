from typing import Optional, Tuple

BASE_RANGES = {
    # ── Tops ──────────────────────────────────────────────────────────────
    ("top",    "t-shirt"):       (15,  35),
    ("top",    "tank top"):      (20,  40),
    ("top",    "polo"):          (12,  32),
    ("top",    "shirt"):         ( 8,  28),
    ("top",    "blouse"):        (10,  28),
    ("top",    "tunic"):          ( 8,  26),
    ("top",    "top"):           (12,  30),
    # ── Mid layer ─────────────────────────────────────────────────────────
    ("mid",    "sweater"):       (-5,  18),
    ("mid",    "sweatshirt"):    ( 0,  20),
    ("mid",    "pullover"):      (-2,  18),
    ("mid",    "hoodie"):        (-3,  19),
    # ── Outerwear ─────────────────────────────────────────────────────────
    ("outer",  "jacket"):        (-10, 15),
    ("outer",  "blazer"):        ( 5,  22),
    ("outer",  "coat"):          (-15, 12),
    ("outer",  "rain jacket"):   (  5, 20),
    # ── Bottoms ───────────────────────────────────────────────────────────
    ("bottom", "shorts"):        (18,  40),
    ("bottom", "skirt"):         (12,  30),
    ("bottom", "jeans"):         (-10, 25),
    ("bottom", "trousers"):      (-5,  28),
    ("bottom", "leggings"):      (-5,  22),
    ("bottom", "track pants"):   ( 0,  25),
    ("bottom", "joggers"):       (-5,  22),
    # ── Footwear ──────────────────────────────────────────────────────────
    ("footwear", "sandals"):     (18,  40),
    ("footwear", "flip flops"):  (20,  40),
    ("footwear", "flats"):       (10,  30),
    ("footwear", "heels"):       ( 8,  30),
    ("footwear", "casual shoes"):(-5,  28),
    ("footwear", "sports shoes"):(-5,  30),
    ("footwear", "formal shoes"):( 0,  28),
    ("footwear", "boots"):       (-15, 15),
    ("footwear", "loafers"):     ( 5,  28),
    # ── Accessories ──────────────────────────────────────────────────────
    ("accessory", "watch"):      (-30, 40),
    ("accessory", "sunglasses"): (-30, 40),
    ("accessory", "belt"):       (-30, 40),
    ("accessory", "backpack"):   (-30, 40),
    ("accessory", "handbag"):    (-30, 40),
    ("accessory", "bag"):        (-30, 40),
    ("accessory", "wallet"):     (-30, 40),
    ("accessory", "tie"):        (-30, 40),
    ("accessory", "hat"):        (-30, 25),
    ("accessory", "cap"):        (-30, 30),
    ("accessory", "scarf"):      (-30, 12),
}

CATEGORY_FALLBACK = {
    "top":       (12, 30),
    "mid":       (-5, 20),
    "outer":     (-10, 18),
    "bottom":    (-5, 28),
    "footwear":  ( 0, 30),
    "accessory": (-30, 40),
}

MATERIAL_MODIFIERS = {
    # warm
    "wool":      {"min_delta": -5,  "max_delta":  0},
    "fleece":    {"min_delta": -5,  "max_delta":  0},
    "down":      {"min_delta": -10, "max_delta":  0},
    "knit":      {"min_delta": -3,  "max_delta":  0},
    "leather":   {"min_delta": -3,  "max_delta":  0},
    # breathable / cool
    "linen":     {"min_delta":  0,  "max_delta":  3},
    "silk":      {"min_delta":  0,  "max_delta":  2},
    # neutral
    "cotton":    {"min_delta":  0,  "max_delta":  0},
    "denim":     {"min_delta":  0,  "max_delta":  0},
    "polyester": {"min_delta":  0,  "max_delta":  0},
    "synthetic": {"min_delta":  0,  "max_delta":  0},
}

MIN_BOUND, MAX_BOUND = -30, 45


def derive_temp_range(
    category: Optional[str],
    subcategory: Optional[str] = None,
    material: Optional[str] = None,
) -> Tuple[int, int]:
    cat = (category or "").lower().strip()
    sub = (subcategory or "").lower().strip()
    mat = (material or "").lower().strip()

    base = BASE_RANGES.get((cat, sub))
    if base is None and sub:
        for (c2, s2), r in BASE_RANGES.items():
            if s2 == sub:
                base = r
                break
    if base is None:
        base = CATEGORY_FALLBACK.get(cat, (-5, 28))

    t_min, t_max = base
    mod = MATERIAL_MODIFIERS.get(mat)
    if mod:
        t_min += mod["min_delta"]
        t_max += mod["max_delta"]

    t_min = max(MIN_BOUND, min(t_min, MAX_BOUND))
    t_max = max(MIN_BOUND, min(t_max, MAX_BOUND))
    if t_min > t_max:
        t_min, t_max = t_max, t_min
    return (int(t_min), int(t_max))
