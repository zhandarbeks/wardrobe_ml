from typing import List, Optional
from models import WardrobeItem, Preference
import itertools
import random

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
        return 2.0  # neutrals go with everything
    h1 = COLOR_HUES.get(c1)
    h2 = COLOR_HUES.get(c2)
    if h1 is None or h1 == -1 or h2 is None or h2 == -1:
        return 0.5  # unknown colour
    diff = abs(h1 - h2)
    if diff > 180:
        diff = 360 - diff
    if 150 <= diff <= 210:
        return 3.0   # complementary
    if diff <= 30:
        return 2.0   # analogous
    if diff == 0:
        return 1.5   # monochromatic
    if 60 <= diff <= 120:
        return -1.0  # colour clash
    return 0.5


def score_outfit(items: List[WardrobeItem], prefs: Optional[Preference]) -> float:
    # color score — pairwise Itten compatibility
    colors = [i.color for i in items if i.color]
    pairs = list(itertools.combinations(colors, 2))
    color_avg = sum(_hue_score(a, b) for a, b in pairs) / len(pairs) if pairs else 0.0

    # style + preference score
    style_score = 0.0
    if prefs:
        pref_styles = set((prefs.styles or "").lower().split(",")) - {""}
        fav_colors = set((prefs.favorite_colors or "").lower().split(",")) - {""}
        disliked = set((prefs.disliked_colors or "").lower().split(",")) - {""}
        for item in items:
            if item.styles:
                item_styles = set(item.styles.lower().split(","))
                if item_styles & pref_styles:
                    style_score += 1.0
            if item.color:
                if item.color.lower() in fav_colors:
                    style_score += 0.5
                if item.color.lower() in disliked:
                    style_score -= 1.0

    return round(0.6 * color_avg + 0.4 * style_score, 3)


def recommend_outfits(
    items: List[WardrobeItem],
    prefs: Optional[Preference],
    weather: dict,
    top_n: int = 3,
) -> List[dict]:
    # Step 1 — T_target
    feels_like = weather.get("feels_like", weather.get("temp", 15))
    wind_speed = weather.get("wind_speed", 0)
    pop = weather.get("pop", 0)  # precipitation probability 0-1

    sensitivity = str(prefs.heat_sensitivity) if prefs else "normal"
    delta = {"cold": 5, "normal": 0, "hot": -5}.get(sensitivity, 0)
    wind_adj = -3 if wind_speed > 10 else 0
    t = feels_like + delta + wind_adj

    allow_layering = prefs.allow_layering if prefs else True

    def in_range(item):
        return item.temp_min <= t <= item.temp_max

    # Step 2 — layer pools
    base_pool  = [i for i in items if i.category == "top"      and in_range(i)]
    mid_pool   = [i for i in items if i.category == "mid"      and in_range(i)] if (t < 18 and allow_layering) else []
    outer_pool = [i for i in items if i.category == "outer"    and in_range(i)] if t < 10 else []

    bottom_pool = []
    for i in items:
        if i.category != "bottom" or not in_range(i):
            continue
        if i.subcategory and "short" in i.subcategory.lower() and t < 15:
            continue
        bottom_pool.append(i)

    footwear_pool = []
    for i in items:
        if i.category != "footwear" or not in_range(i):
            continue
        if i.subcategory and "sandal" in i.subcategory.lower():
            if t < 18 or pop > 0.3:
                continue
        footwear_pool.append(i)

    # Fallback when temp filters eliminate everything
    if not base_pool:
        base_pool = [i for i in items if i.category == "top"]
    if not bottom_pool:
        bottom_pool = [i for i in items if i.category == "bottom"]
    if not footwear_pool:
        footwear_pool = [i for i in items if i.category == "footwear"]

    if not base_pool or not bottom_pool:
        return []

    # Step 3 — generate combinations (capped for performance)
    b  = random.sample(base_pool,    min(5, len(base_pool)))
    bt = random.sample(bottom_pool,  min(5, len(bottom_pool)))
    fw = random.sample(footwear_pool, min(4, len(footwear_pool))) if footwear_pool else [None]

    combos = []
    for base, bot, shoe in itertools.product(b, bt, fw):
        outfit = [base, bot]
        if shoe:
            outfit.append(shoe)
        if mid_pool:
            outfit.append(random.choice(mid_pool))
        if outer_pool:
            outfit.append(random.choice(outer_pool))
        combos.append((outfit, score_outfit(outfit, prefs)))

    combos.sort(key=lambda x: x[1], reverse=True)

    # Deduplicate and return top N
    seen, results = set(), []
    for outfit_items, sc in combos:
        key = frozenset(i.id for i in outfit_items)
        if key in seen:
            continue
        seen.add(key)
        results.append({
            "items": [
                {
                    "id": i.id,
                    "name": i.name,
                    "category": i.category,
                    "color": i.color,
                    "image_url": i.image_url,
                    "image_no_bg_url": i.image_no_bg_url,
                }
                for i in outfit_items
            ],
            "score": sc,
            "t_target": round(t, 1),
        })
        if len(results) >= top_n:
            break

    return results
