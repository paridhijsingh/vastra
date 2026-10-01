"""Smart shopping: turn item names into real product links, ranked by budget.

Design notes:
  - Two sources: buy-new (product search with prices) and thrift/local
    (places search for thrift & vintage stores near the user).
  - Always show price next to each link; filter out anything over budget.
  - MVP: implement buy-new first; thrift/local is the first stretch goal.
"""

from dataclasses import dataclass


@dataclass
class Product:
    name: str
    price_usd: float
    url: str
    source: str  # "online" | "thrift"


def search_products(item: str, budget: float, style_preference: str) -> list[Product]:
    """Find real buyable products for an item name, within budget.

    TODO: wire to a product search (shopping skill / API). Return cheapest
    relevant results first. Empty list is fine for the scaffold.
    """
    return []


def find_thrift_stores(location: str) -> list[dict]:
    """Find thrift/vintage stores near a location.

    TODO (stretch): wire to a places search. Each dict: {name, address}.
    """
    return []


def within_budget(products: list[Product], budget: float) -> list[Product]:
    """Filter products to those at or under budget, cheapest first."""
    return sorted([p for p in products if p.price_usd <= budget],
                  key=lambda p: p.price_usd)
