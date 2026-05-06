"""Wearable-temperature defaults — pure data + a small helper.

Derives a (temp_min, temp_max) range for a wardrobe item given:
  - category    (top / mid / outer / bottom / footwear / accessory)
  - subcategory (t-shirt, jeans, sandals, ...)
  - material    (cotton, wool, down, ...)

The numbers are based on common wardrobe-app heuristics, not exact thermo-
physics. They are intentionally CONSERVATIVE (wide rather than narrow) so
the recommender doesn't accidentally exclude items the user could still wear.

Mirror copy in `frontend/src/pages/AddItem.jsx` keeps the UI in sync without
an extra round-trip on every keystroke. Backend remains authoritative.
"""

from typing import Optional, Tuple

# (temp_min, temp_max) per (category, subcategory)
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
    # Most accessories don't gate outfits → wide-open. A few that do (scarf,
    # hat) ARE temperature-sensitive — they should drop out at hot weather.
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

# Per-category fallback if subcategory isn't recognised
CATEGORY_FALLBACK = {
    "top":       (12, 30),
    "mid":       (-5, 20),
    "outer":     (-10, 18),
    "bottom":    (-5, 28),
    "footwear":  ( 0, 30),
    "accessory": (-30, 40),
}

# Material modifiers — shift temp_min down (extends cold tolerance) for warm
# materials and shift temp_max up (extends heat tolerance) for breathable ones.
# Applied AFTER the base range is looked up.
MATERIAL_MODIFIERS = {
    # Warm: only extend the cold side
    "wool":      {"min_delta": -5,  "max_delta":  0},
    "fleece":    {"min_delta": -5,  "max_delta":  0},
    "down":      {"min_delta": -10, "max_delta":  0},
    "knit":      {"min_delta": -3,  "max_delta":  0},
    "leather":   {"min_delta": -3,  "max_delta":  0},
    # Breathable / cool: only extend the warm side
    "linen":     {"min_delta":  0,  "max_delta":  3},
    "silk":      {"min_delta":  0,  "max_delta":  2},
    # Neutral
    "cotton":    {"min_delta":  0,  "max_delta":  0},
    "denim":     {"min_delta":  0,  "max_delta":  0},
    "polyester": {"min_delta":  0,  "max_delta":  0},
    "synthetic": {"min_delta":  0,  "max_delta":  0},
}

# Hard clamping bounds so a wool down jacket doesn't end up at -50.
MIN_BOUND, MAX_BOUND = -30, 45


def derive_temp_range(
    category: Optional[str],
    subcategory: Optional[str] = None,
    material: Optional[str] = None,
) -> Tuple[int, int]:
    """Return a sensible (temp_min, temp_max) based on item attributes.
    All inputs are case-insensitive and tolerant of None.
    """
    cat = (category or "").lower().strip()
    sub = (subcategory or "").lower().strip()
    mat = (material or "").lower().strip()

    base = BASE_RANGES.get((cat, sub))
    # Subcategory-priority cross-lookup: if (cat, sub) isn't in the table
    # but `sub` exists under a DIFFERENT category, use that range.
    # Catches the common misclassification of warm garments (hoodie tagged
    # as `top` instead of `mid` by Model A's layer head, etc.).
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
