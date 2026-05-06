"""Style-tag defaults — derives a list of likely styles for a wardrobe item
from (category, subcategory, material).

Style vocabulary (must match the seeded styles in models.py / seed.py):
    casual, smart casual, business, sport, streetwear, formal

Output is a *suggestion* — the user can toggle them in the UI. We return at
most 2-3 styles per item, prioritising the most likely first.

Mirrored client-side in frontend/src/pages/AddItem.jsx for instant feedback.
"""

from typing import List, Optional

# (category, subcategory) -> list of likely styles in priority order
STYLE_BY_SUBCAT = {
    # ── Tops ──────────────────────────────────────────────────────────────
    ("top",    "t-shirt"):    ["casual", "streetwear"],
    ("top",    "tank top"):   ["casual", "sport"],
    ("top",    "polo"):       ["smart casual", "casual"],
    ("top",    "shirt"):      ["smart casual", "business"],
    ("top",    "blouse"):     ["smart casual", "business"],
    ("top",    "tunic"):      ["casual", "smart casual"],
    ("top",    "top"):        ["casual"],
    # ── Mid layer ─────────────────────────────────────────────────────────
    ("mid",    "sweater"):    ["smart casual", "casual"],
    ("mid",    "sweatshirt"): ["casual", "streetwear"],
    ("mid",    "pullover"):   ["casual", "smart casual"],
    ("mid",    "hoodie"):     ["streetwear", "casual", "sport"],
    # ── Outerwear ─────────────────────────────────────────────────────────
    ("outer",  "jacket"):     ["casual", "smart casual"],
    ("outer",  "blazer"):     ["business", "smart casual", "formal"],
    ("outer",  "coat"):       ["smart casual", "business"],
    ("outer",  "rain jacket"):["casual", "sport"],
    # ── Bottoms ───────────────────────────────────────────────────────────
    ("bottom", "jeans"):      ["casual", "streetwear"],
    ("bottom", "trousers"):   ["smart casual", "business"],
    ("bottom", "shorts"):     ["casual", "sport"],
    ("bottom", "skirt"):      ["casual", "smart casual"],
    ("bottom", "leggings"):   ["sport", "casual"],
    ("bottom", "track pants"):["sport", "streetwear"],
    ("bottom", "joggers"):    ["sport", "streetwear", "casual"],
    # ── Footwear ──────────────────────────────────────────────────────────
    ("footwear", "sandals"):     ["casual"],
    ("footwear", "flip flops"):  ["casual"],
    ("footwear", "flats"):       ["casual", "smart casual"],
    ("footwear", "heels"):       ["smart casual", "business", "formal"],
    ("footwear", "casual shoes"):["casual", "streetwear"],
    ("footwear", "sports shoes"):["sport", "streetwear"],
    ("footwear", "formal shoes"):["business", "formal"],
    ("footwear", "boots"):       ["casual", "smart casual"],
    ("footwear", "loafers"):     ["smart casual", "business"],
    # ── Accessories ──────────────────────────────────────────────────────
    ("accessory", "watch"):      [],            # no strong preference
    ("accessory", "sunglasses"): ["casual"],
    ("accessory", "belt"):       ["smart casual"],
    ("accessory", "backpack"):   ["casual", "streetwear", "sport"],
    ("accessory", "handbag"):    ["smart casual"],
    ("accessory", "bag"):        ["smart casual", "casual"],
    ("accessory", "wallet"):     [],
    ("accessory", "hat"):        ["casual", "streetwear"],
    ("accessory", "cap"):        ["casual", "sport", "streetwear"],
    ("accessory", "scarf"):      ["smart casual"],
    ("accessory", "tie"):        ["business", "formal"],
}

# Per-category fallback when the subcategory isn't recognised.
CATEGORY_FALLBACK = {
    "top":       ["casual"],
    "mid":       ["casual"],
    "outer":     ["casual", "smart casual"],
    "bottom":    ["casual"],
    "footwear":  ["casual"],
    "accessory": [],
}

# Material can shift the style mix — e.g. wool blazer is more formal than
# a synthetic one. We append (or prepend) styles from this map and dedupe.
MATERIAL_STYLE_HINTS = {
    "wool":      ["smart casual", "business"],
    "silk":      ["formal", "business"],
    "linen":     ["smart casual", "casual"],
    "leather":   ["smart casual", "streetwear"],
    "denim":     ["casual", "streetwear"],
    "fleece":    ["sport", "casual"],
    "down":      ["casual", "sport"],
    "knit":      ["casual", "smart casual"],
    "synthetic": ["sport"],
    # cotton / polyester are too generic to imply a style
}


def derive_styles(
    category: Optional[str],
    subcategory: Optional[str] = None,
    material: Optional[str] = None,
    max_styles: int = 3,
) -> List[str]:
    """Return up to `max_styles` likely style tags for an item, in priority order."""
    cat = (category or "").lower().strip()
    sub = (subcategory or "").lower().strip()
    mat = (material or "").lower().strip()

    styles: List[str] = []

    base = STYLE_BY_SUBCAT.get((cat, sub))
    if base is None:
        base = CATEGORY_FALLBACK.get(cat, [])
    styles.extend(base)

    # Material can promote/demote styles — only ADD options that align with
    # the existing category bucket (not force "formal" onto sneakers).
    hints = MATERIAL_STYLE_HINTS.get(mat, [])
    for h in hints:
        if h not in styles:
            # Don't promote "formal"/"business" onto inherently-casual subcategories
            if h in {"formal", "business"} and sub in {
                "t-shirt", "tank top", "shorts", "leggings",
                "track pants", "joggers", "sandals", "flip flops",
                "sports shoes", "hoodie", "sweatshirt",
            }:
                continue
            styles.append(h)

    # Dedupe while preserving order, then trim
    seen = set(); out = []
    for s in styles:
        if s in seen:
            continue
        seen.add(s); out.append(s)
        if len(out) >= max_styles:
            break
    return out
