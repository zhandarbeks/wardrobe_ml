import json
import itertools
import random
from typing import List, Optional
from models import WardrobeItem, Preference

COLOR_HUES = {
    "black": -1, "white": -1, "gray": -1, "grey": -1,
    "beige": -1, "cream": -1, "navy": -1,
    "royal blue": 215, "sky blue": 200,
    "teal": 175, "green": 120, "olive": 80,
    "yellow": 60, "orange": 30, "red": 0,
    "burgundy": 345, "pink": 330, "purple": 270,
    "brown": 25, "camel": 35,
}

NEUTRAL_COLORS = {"black", "white", "gray", "grey", "beige", "cream", "navy"}


def _hue_score(c1: str, c2: str) -> float:
    c1, c2 = c1.lower().strip(), c2.lower().strip()
    if c1 in NEUTRAL_COLORS or c2 in NEUTRAL_COLORS:
        return 2.0
    h1 = COLOR_HUES.get(c1)
    h2 = COLOR_HUES.get(c2)
    if h1 is None or h1 == -1 or h2 is None or h2 == -1:
        return 0.5
    diff = abs(h1 - h2)
    if diff > 180:
        diff = 360 - diff
    if 150 <= diff <= 210: return 3.0   # complementary
    if diff <= 30:         return 2.0   # analogous
    if diff == 0:          return 1.5   # monochromatic
    if 60 <= diff <= 120:  return -1.0  # colour clash
    return 0.5


def _item_color(item: WardrobeItem) -> str:
    return item.colour_ref.name if item.colour_ref else ""


def _item_category(item: WardrobeItem) -> str:
    return item.category_ref.name if item.category_ref else ""


def _item_styles(item: WardrobeItem) -> set:
    return {s.name.lower() for s in (item.styles or [])}


def score_outfit(items: List[WardrobeItem], prefs: Optional[Preference]) -> float:
    colors = [_item_color(i) for i in items if _item_color(i)]
    pairs  = list(itertools.combinations(colors, 2))
    color_avg = sum(_hue_score(a, b) for a, b in pairs) / len(pairs) if pairs else 0.0

    style_score = 0.0
    if prefs:
        pref_styles = {s.name.lower() for s in (prefs.styles or [])}
        fav_colors  = {c.name.lower() for c in (prefs.favourite_colours or [])}
        disliked    = {c.name.lower() for c in (prefs.disliked_colours  or [])}
        for item in items:
            if _item_styles(item) & pref_styles:
                style_score += 1.0
            col = _item_color(item).lower()
            if col in fav_colors:  style_score += 0.5
            if col in disliked:    style_score -= 1.0

    return round(0.6 * color_avg + 0.4 * style_score, 3)


#  ── Subcategory-based safety net ────────────────────────────────────────────
#  Catches items whose stored category/temp_range is wrong (e.g. a hoodie
#  classified as "top" by Model A would otherwise sneak into hot-weather
#  outfits). Subcategory names below are the single strongest temperature
#  signals on the garment.
WARM_SUBCATEGORIES = {
    "sweater", "sweatshirt", "pullover", "hoodie",
    "jacket",  "blazer",     "coat",     "rain jacket",
    "boots",   "scarf",
}
COOL_SUBCATEGORIES = {
    "tank top", "t-shirt", "shorts",
    "sandals",  "flip flops",
}

# Accessories grouped by visible "kind" — we pick at most one per kind so the
# recommended outfit doesn't end up wearing two backpacks or three watches.
# Subcategories not in this map are treated as their own kind.
ACCESSORY_KINDS = {
    "watch":      "jewelry",
    "sunglasses": "eyewear",
    "belt":       "belt",
    "backpack":   "bag",
    "handbag":    "bag",
    "bag":        "bag",
    "wallet":     "small",
    "tie":        "neck",
    "scarf":      "neck",
    "hat":        "headwear",
    "cap":        "headwear",
}
# Items that exist in users' wardrobes but rarely belong on an outfit board —
# we deprioritise them when auto-attaching accessories.
ACCESSORY_LOW_PRIORITY = {"wallet"}


def _safe(item, t: float, pop: float, category: str) -> bool:
    """Soft safety net — rejects items whose subcategory makes them obviously
    inappropriate for the current weather. NOT absolute: at Tier 3 of
    `_eligible_pool` we relax this so sparse wardrobes still get a result."""
    sub = (item.subcategory or "").lower().strip()
    if t > 22 and sub in WARM_SUBCATEGORIES:
        return False
    if t <  8 and sub in COOL_SUBCATEGORIES:
        return False
    if category == "footwear" and ("sandal" in sub or "flip flop" in sub):
        if t < 18 or pop > 0.3:
            return False
    if category == "bottom" and "short" in sub and t < 15:
        return False
    return True


# Backwards-compat alias for any external callers
def _subcategory_appropriate(item, t: float) -> bool:
    return _safe(item, t, pop=0.0, category=_item_category(item))


def _closeness(item, t: float) -> float:
    """0 if t is inside [temp_min, temp_max], otherwise positive distance."""
    if item.temp_min <= t <= item.temp_max:
        return 0.0
    if t < item.temp_min:
        return item.temp_min - t
    return t - item.temp_max


def _pick_accessories(pool, max_n: int = 2):
    """Return up to `max_n` accessory items from `pool`, each from a different
    visible kind. Wallets and other low-priority items are picked last."""
    if not pool:
        return []
    high = [i for i in pool if (i.subcategory or "").lower() not in ACCESSORY_LOW_PRIORITY]
    low  = [i for i in pool if (i.subcategory or "").lower() in     ACCESSORY_LOW_PRIORITY]
    candidates = list(high)
    random.shuffle(candidates)
    random.shuffle(low)
    candidates.extend(low)

    chosen, seen_kinds = [], set()
    for item in candidates:
        sub  = (item.subcategory or "").lower().strip()
        kind = ACCESSORY_KINDS.get(sub, sub or "other")
        if kind in seen_kinds:
            continue
        chosen.append(item)
        seen_kinds.add(kind)
        if len(chosen) >= max_n:
            break
    return chosen


def _eligible_pool(items, category: str, t: float, pop: float, max_fallback: int = 5):
    """Items of `category` that suit temperature `t`.

    Three-tier fallback so users with sparse wardrobes still get suggestions:
      Tier 1 — _safe items whose stored temp_range covers t (ideal).
      Tier 2 — _safe items closest to t (slightly out of range).
      Tier 3 — ANY item in the category closest to t. Last resort — better to
               recommend a t-shirt at cold weather than to show an empty
               dashboard. The user can override anyway.
    """
    cat_items = [i for i in items if _item_category(i) == category]
    safe = [i for i in cat_items if _safe(i, t, pop, category)]

    # Tier 1
    in_range_safe = [i for i in safe if i.temp_min <= t <= i.temp_max]
    if in_range_safe:
        return in_range_safe

    # Tier 2
    if safe:
        safe.sort(key=lambda i: _closeness(i, t))
        return safe[:max_fallback]

    # Tier 3 — sparse wardrobe; relax safety net entirely
    cat_items.sort(key=lambda i: _closeness(i, t))
    return cat_items[:max_fallback]


def recommend_outfits(
    items: List[WardrobeItem],
    prefs: Optional[Preference],
    weather: dict,
    top_n: int = 3,
) -> List[dict]:
    feels_like = weather.get("feels_like", weather.get("temp", 15))
    wind_speed = weather.get("wind_speed", 0)
    pop        = weather.get("pop", 0)

    sensitivity = str(prefs.heat_sensitivity) if prefs else "normal"
    delta    = {"cold": 5, "normal": 0, "hot": -5}.get(sensitivity, 0)
    wind_adj = -3 if wind_speed > 10 else 0
    t = feels_like + delta + wind_adj

    allow_layering = prefs.allow_layering if prefs else True

    base_pool      = _eligible_pool(items, "top",       t, pop)
    mid_pool       = _eligible_pool(items, "mid",       t, pop) if (t < 18 and allow_layering) else []
    outer_pool     = _eligible_pool(items, "outer",     t, pop) if t < 10 else []
    bottom_pool    = _eligible_pool(items, "bottom",    t, pop)
    footwear_pool  = _eligible_pool(items, "footwear",  t, pop)
    accessory_pool = _eligible_pool(items, "accessory", t, pop)

    if not base_pool or not bottom_pool:
        return []

    b  = random.sample(base_pool,     min(5, len(base_pool)))
    bt = random.sample(bottom_pool,   min(5, len(bottom_pool)))
    fw = random.sample(footwear_pool, min(4, len(footwear_pool))) if footwear_pool else [None]

    combos = []
    for base, bot, shoe in itertools.product(b, bt, fw):
        outfit = [base, bot]
        if shoe:  outfit.append(shoe)
        if mid_pool:   outfit.append(random.choice(mid_pool))
        if outer_pool: outfit.append(random.choice(outer_pool))
        # Accessories: up to 2 items of distinct kinds (e.g. bag + watch).
        # Picked per-combo so different outfit options surface different accessories.
        outfit.extend(_pick_accessories(accessory_pool, max_n=2))
        combos.append((outfit, score_outfit(outfit, prefs)))

    combos.sort(key=lambda x: x[1], reverse=True)

    seen, results = set(), []
    for outfit_items, sc in combos:
        key = frozenset(i.id for i in outfit_items)
        if key in seen:
            continue
        seen.add(key)
        results.append({
            "items": [
                {
                    "id":              str(i.id),
                    "name":            i.name,
                    "category":        _item_category(i),
                    "color":           _item_color(i),
                    "image_url":       i.image_url,
                    "image_no_bg_url": i.image_no_bg_url,
                    "embedding":       i.embedding,   # for ModelB rescoring (stripped before client)
                }
                for i in outfit_items
            ],
            "score":    sc,
            "t_target": round(t, 1),
        })
        if len(results) >= top_n:
            break

    return results


async def ml_rescore_outfits(outfits: list, ml_url: str) -> list:
    """Re-score outfit list using ModelB pairwise compatibility."""
    import httpx

    def _decode(emb_str) -> Optional[list]:
        if not emb_str:
            return None
        try:
            decoded = json.loads(emb_str) if isinstance(emb_str, str) else emb_str
            return decoded if len(decoded) == 128 else None
        except Exception:
            return None

    try:
        async with httpx.AsyncClient(timeout=8.0) as client:
            for outfit in outfits:
                items = outfit["items"]
                embeddings = [_decode(i.get("embedding")) for i in items]
                valid = [(i, e) for i, e in enumerate(embeddings) if e is not None]
                if len(valid) < 2:
                    continue
                scores = []
                for (_, e1), (_, e2) in itertools.combinations(valid, 2):
                    try:
                        resp = await client.post(
                            f"{ml_url}/compatibility",
                            json={"embedding1": e1, "embedding2": e2},
                        )
                        if resp.status_code == 200:
                            scores.append(resp.json()["score"])
                    except Exception:
                        pass
                if scores:
                    outfit["score"] = round(sum(scores) / len(scores), 3)
    except Exception:
        pass

    for outfit in outfits:
        for item in outfit["items"]:
            item.pop("embedding", None)

    outfits.sort(key=lambda x: x["score"], reverse=True)
    return outfits
