"""Trend stylist mode: occasion + vibe + budget -> Nemotron outfit + buy links.

Design notes:
  - Ground the outfit in *current* trends: pass a short trend brief
    (fetched via web search at runtime or curated weekly) into the prompt.
  - The agent names specific item types; shopping.py turns those into
    real product links with prices.
"""

SYSTEM_PROMPT = """You are Vastra's trend stylist. Recommend a complete,
cohesive outfit grounded in current fashion trends for the given occasion,
style preference, and budget. Name specific item types (e.g. 'high-waisted
mom jeans', 'oversized linen blazer'). Stay strictly within budget."""


def build_prompt(occasion: str, vibe: str, budget: float,
                 style_preference: str, trend_brief: str = "") -> str:
    """Assemble the user prompt for Nemotron.

    Args:
        occasion: e.g. "date night"
        vibe: free-text vibe, e.g. "old money, minimal"
        budget: max total spend in USD
        style_preference: "women's" | "men's" | "unisex"
        trend_brief: short summary of current trends (optional but recommended)
    """
    # TODO: compose the prompt. Include trend_brief when available so the
    # recommendations feel current, not generic.
    raise NotImplementedError("Build the trend-stylist prompt")
