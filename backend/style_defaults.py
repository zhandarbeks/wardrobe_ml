from typing import List, Optional

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
    ("accessory", "watch"):      [],
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

CATEGORY_FALLBACK = {
    "top":       ["casual"],
    "mid":       ["casual"],
    "outer":     ["casual", "smart casual"],
    "bottom":    ["casual"],
    "footwear":  ["casual"],
    "accessory": [],
}

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

    hints = MATERIAL_STYLE_HINTS.get(mat, [])
    for h in hints:
        if h not in styles:
            if h in {"formal", "business"} and sub in {
                "t-shirt", "tank top", "shorts", "leggings",
                "track pants", "joggers", "sandals", "flip flops",
                "sports shoes", "hoodie", "sweatshirt",
            }:
                continue
            styles.append(h)

    seen = set(); out = []
    for s in styles:
        if s in seen:
            continue
        seen.add(s); out.append(s)
        if len(out) >= max_styles:
            break
    return out
