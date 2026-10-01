"""Emergency mode: 60-second rapid quiz -> fit from what the user already owns.

Design notes:
  - No inventory needed. Ask ~6 quick questions, assemble a fit.
  - Keep questions multiple-choice (radio buttons), not free text — speed.
  - The agent should also suggest jewelry, hairstyle, and makeup to
    complete the look, using only what the quiz reveals.
"""

# TODO: tune these questions. Each answer should map to a wardrobe fact
# the prompt builder can use (e.g. "dark jeans" -> bottoms: dark jeans).
QUIZ_QUESTIONS = [
    {
        "id": "occasion",
        "question": "What's the occasion?",
        "options": ["casual day out", "office / work", "date night", "party", "interview"],
    },
    {
        "id": "time",
        "question": "How much time do you have?",
        "options": ["under 15 min", "15-30 min", "30+ min"],
    },
    {
        "id": "tops",
        "question": "Pick a top you own and like:",
        "options": ["white tee", "black top", "button-down shirt", "blouse", "sweater"],
    },
    {
        "id": "bottoms",
        "question": "Pick bottoms you own:",
        "options": ["dark jeans", "light jeans", "trousers", "skirt", "shorts"],
    },
    {
        "id": "shoes",
        "question": "Shoes?",
        "options": ["sneakers", "heels", "loafers / flats", "boots"],
    },
    {
        "id": "weather",
        "question": "Weather today?",
        "options": ["hot", "mild", "cold", "rainy"],
    },
]


def build_prompt(answers: dict, style_preference: str) -> str:
    """Assemble the user prompt for Nemotron from quiz answers.

    Args:
        answers: {question_id: chosen_option, ...}
        style_preference: "women's" | "men's" | "unisex"
    """
    # TODO: turn answers into a vivid prompt, e.g.:
    # "Style a {style_preference} outfit for {occasion} in {weather} weather
    #  using ONLY: {tops}, {bottoms}, {shoes}. Time available: {time}..."
    raise NotImplementedError("Build the prompt from quiz answers")


SYSTEM_PROMPT = """You are Vastra's emergency stylist. The user is in a hurry
and cannot buy anything. Build a complete outfit ONLY from the items they
listed. Then add jewelry, hairstyle, and makeup suggestions that elevate the
look with zero new purchases. Be specific and confident — no hedging."""
