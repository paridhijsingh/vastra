"""Style dictionary: every fashion term the agent uses gets a plain definition.

Render this as a glossary page in the app. When the agent uses a term,
link it here. Seed more terms as you encounter them.
"""

STYLE_DICTIONARY: dict[str, str] = {
    "mom jeans": "High-waisted, relaxed-fit jeans with a tapered leg — a 90s revival staple.",
    "bootcut": "Jeans that flare slightly from the knee down; balances fitted tops.",
    "oversized blazer": "A blazer cut larger than your size for a relaxed, borrowed-from-him silhouette.",
    "old money": "Understated luxury aesthetic: neutrals, loafers, knit polos, minimal logos.",
    "streetwear": "Casual, urban-inspired style: graphic tees, cargos, sneakers, hoodies.",
    "capsule wardrobe": "A small set of versatile pieces that all mix and match.",
    "athleisure": "Athletic wear styled for everyday life: leggings, sneakers, track jackets.",
    "Y2K": "Early-2000s revival: low-rise jeans, baby tees, chunky sneakers, baguette bags.",
    "cropped": "A top or jacket cut short, ending above the waist.",
    "layering": "Wearing multiple pieces (e.g. tee + shirt + jacket) for depth and weather flexibility.",
}


def lookup(term: str) -> str | None:
    """Return the definition for a term, or None if unknown."""
    return STYLE_DICTIONARY.get(term.lower().strip())
