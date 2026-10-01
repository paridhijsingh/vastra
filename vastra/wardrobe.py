"""Typed wardrobe inventory: the user lists what they own, in plain text.

Design notes:
  - Plain text beats photos for MVP (10 min of typing vs 1-2 hrs of photos,
    and no vision model needed). One item per line, e.g.:
        black blazer
        white sneakers
        mom jeans
  - parse_wardrobe() normalizes the list; the agent does the rest.
"""

from dataclasses import dataclass


@dataclass
class WardrobeItem:
    raw: str
    category: str = ""  # tops | bottoms | shoes | outerwear | accessories | other


def parse_wardrobe(text: str) -> list[WardrobeItem]:
    """Parse one-item-per-line text into WardrobeItems.

    TODO: normalize lines (strip, lowercase) and guess a category with
    simple keyword matching. Keep it dumb — precision doesn't matter much.
    """
    items = [line.strip() for line in text.splitlines() if line.strip()]
    return [WardrobeItem(raw=item) for item in items]


def build_prompt(items: list[WardrobeItem], occasion: str,
                 style_preference: str) -> str:
    """Assemble the user prompt: style an outfit ONLY from these items."""
    # TODO: list the items in the prompt and instruct Nemotron to use
    # nothing else, then add jewelry/hairstyle/makeup suggestions.
    raise NotImplementedError("Build the wardrobe prompt")
