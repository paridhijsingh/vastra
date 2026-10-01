"""Project-wide configuration. Fill in from environment; no secrets hardcoded."""

import os
from dotenv import load_dotenv

load_dotenv()

NEBIUS_API_KEY = os.getenv("NEBIUS_API_KEY", "")
NEBIUS_BASE_URL = os.getenv("NEBIUS_BASE_URL", "")
NEMOTRON_MODEL = os.getenv("NEMOTRON_MODEL", "nemotron-3-super-120b")

STYLE_PREFERENCES = ["women's", "men's", "unisex"]

OCCASIONS = [
    "casual day out",
    "office / work",
    "date night",
    "party",
    "wedding guest",
    "interview",
    "gym / athleisure",
    "travel",
]
