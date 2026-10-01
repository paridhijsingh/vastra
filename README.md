# Vastra (वस्त्र)

**Ready, set, styled.**

Your AI stylist for every occasion and budget.

Vastra (Sanskrit for clothing) helps you choose outfits for everyday occasions, celebrations, and festivities — based on your style, budget, and the clothes you already have.

## Features and current status

### MVP modes

| Mode | What it does | Status |
|------|----------------|--------|
| **Emergency Fit** | Short quiz that assembles an outfit from clothes you confirm you own. No photos, inventory setup, or account. Optional accessory, hair, and makeup tips. | UI + quiz questions ready; Nemotron outfit generation not wired yet |
| **Trend Stylist** | Occasion, vibe, style preference, and budget → outfit advice grounded in retrieved trend references when available. | UI ready; prompt builder and Nemotron call not implemented |
| **Smart Shopping** | Find new online items or thrift/local options, with verified links and prices when a shopping source is connected. | UI ready; product/thrift search stubs return no results yet |

### Shared features

- **Style preference** — men's, women's, or unisex (sidebar selector works today).
- **Style dictionary** — plain-English fashion terms; lookup page works with a seeded glossary.

### Not claimed yet

Trends, product links, prices, and local inventory are **not** verified in the current code. Those depend on wiring Nemotron and a shopping/places source.

## How it works

1. Pick a style preference and mode in the Streamlit sidebar.
2. Answer a short quiz (Emergency Fit), set occasion/vibe/budget (Trend Stylist), or search for an item (Smart Shopping).
3. When connected, **Nemotron** (via **Nebius Token Factory**) generates outfit advice from those inputs.
4. Shopping mode will rank options by budget once a product or thrift source is connected.

**Nemotron + Nebius Token Factory:** `vastra/nemotron.py` is the intended client. It uses the OpenAI-compatible Token Factory API (`NEBIUS_BASE_URL`, `NEBIUS_API_KEY`) and the model id from `NEMOTRON_MODEL`. The `complete()` call is still a stub.

## Tech stack and project structure

- **UI:** Streamlit (`app.py`)
- **LLM:** Nemotron through Nebius Token Factory (OpenAI Python SDK)
- **Config:** `python-dotenv` + env vars

```
app.py                  Streamlit UI — mode selector and pages
vastra/
  config.py             Env vars, style prefs, occasions
  nemotron.py           Nemotron client via Nebius Token Factory (stub)
  quiz.py               Emergency Fit questions + prompt builder (stub)
  stylist.py            Trend Stylist prompts (stub)
  shopping.py           Product / thrift search (stubs)
  wardrobe.py            Plain-text wardrobe parsing (partial)
  dictionary.py         Style glossary (seeded, working)
.env.example            Required environment variables
requirements.txt        Python dependencies
```

## Local setup

1. Join the Nebius Builder Program and get Token Factory credentials.
2. Copy env template and fill in values (never commit `.env`):

   ```bash
   cp .env.example .env
   ```

   Variables:

   - `NEBIUS_API_KEY` — Token Factory API key
   - `NEBIUS_BASE_URL` — Token Factory base URL (see `.env.example`)
   - `NEMOTRON_MODEL` — model id served by Token Factory (set from the dashboard / `/v1/models`; do not invent one)

3. Install and run:

   ```bash
   pip install -r requirements.txt
   streamlit run app.py
   ```

## Roadmap

- Wire `nemotron.complete()` and connect Emergency Fit + Trend Stylist.
- Ground Trend Stylist in retrieved trend references when available.
- Connect Smart Shopping to a product source; thrift/local as a stretch.
- Expand the style dictionary; optional plain-text wardrobe inventory.

## Demo

Coming soon.

## License

No license file in this repository yet.
