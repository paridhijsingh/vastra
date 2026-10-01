"""Thin client for calling Nemotron models via Nebius Token Factory.

Token Factory is OpenAI-compatible:
  base URL: https://api.tokenfactory.nebius.com/v1
  auth:     Authorization: Bearer <key>  (key from the TF dashboard)
  models:   GET /v1/models lists what's currently served

Your first build task: implement `complete()` below, then verify it with
a tiny script before wiring it into the app.
"""

from openai import OpenAI

from .config import NEBIUS_API_KEY, NEBIUS_BASE_URL, NEMOTRON_MODEL


def get_client() -> OpenAI:
    """Return a configured client. Raises if the API key is missing."""
    if not NEBIUS_API_KEY:
        raise RuntimeError("NEBIUS_API_KEY is not set — copy .env.example to .env")
    return OpenAI(api_key=NEBIUS_API_KEY, base_url=NEBIUS_BASE_URL)


def complete(system_prompt: str, user_prompt: str, model: str = NEMOTRON_MODEL) -> str:
    """Send one chat completion to Nemotron and return the text reply.

    Args:
        system_prompt: role + rules for the stylist agent.
        user_prompt: the fully-assembled request (quiz answers, prefs, budget...).
        model: override the default Nemotron model id if needed.
    """
    # TODO: implement the API call and return response text.
    raise NotImplementedError("Implement the Token Factory call here")
