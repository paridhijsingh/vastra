# Vastra (वस्त्र)

**Ready, set, styled.**

Your AI stylist for every occasion and budget.

Vastra (Sanskrit for clothing) helps you choose outfits for everyday occasions, celebrations, and festivities — based on your style, budget, and the clothes you already have.

> **Model choice:** Use **Nemotron via Nebius Token Factory** (`NEBIUS_API_KEY`), not Gemini, for future outfit recommendations.

## Features and current status

| Area | Status |
|------|--------|
| **Style profile** | Working — preferred styles (Indian / Western / fusion), colours, optional USD budget, comfort prefs; save / edit / delete |
| **Wardrobe** | Working — manual items (name, category, colour, notes); list / edit / delete; empty state |
| **Auth + private storage** | Working — register / sign-in; SQLite records scoped to the owner; API rejects unauthenticated access |
| **Export** | Working — download profile + wardrobe JSON |
| **Emergency Fit / Trend Stylist / Smart Shopping** | Shell only — Nemotron recommendations are the next milestone |

**Not claimed yet:** trend retrieval, product links/prices, local thrift inventory, or AI outfit generation.

## How it works

1. Start the **FastAPI** backend (SQLite-backed profile & wardrobe).
2. Start the **Streamlit** UI and create an account (or sign in).
3. Save your style profile and wardrobe pieces — data survives refreshes and restarts.
4. Export JSON anytime from the sidebar.
5. Later milestones will call Nemotron using your saved profile/wardrobe.

## Tech stack and project structure

- **UI:** Streamlit (existing interface, extended with Profile + Wardrobe tabs)
- **API:** FastAPI + JWT bearer auth
- **DB:** SQLite via SQLAlchemy (smallest durable option; no external DB service)
- **Validation:** Pydantic on API requests
- **LLM (next):** Nemotron via Nebius Token Factory

```
app.py                         Streamlit UI
scripts/run_api.sh             Start API
scripts/check_nemotron.py      Manual Nemotron probe (paid call)
data/vastra.db                 Created at runtime (gitignored)
vastra/
  api.py                       Auth + profile/wardrobe endpoints
  auth.py                      Passwords + JWT
  client.py                    Streamlit → API client
  config.py                    Env settings
  db.py                        SQLAlchemy engine / sessions
  models.py                    User, StyleProfile, WardrobeItem
  store.py                     Owner-scoped persistence helpers
  schemas.py                   Request/response models
  nemotron.py                  Token Factory client (next milestone)
```

## Local setup

```bash
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
```

Useful `.env` keys:

| Variable | Purpose |
|----------|---------|
| `DATABASE_URL` | Default `sqlite:///./data/vastra.db` |
| `SECRET_KEY` | JWT signing secret (change for any shared deploy) |
| `VASTRA_API_URL` | Streamlit → API base URL (default `http://127.0.0.1:8000`) |
| `NEBIUS_*` / `NEMOTRON_MODEL` | Optional until outfit recommendations |

### Run

Terminal 1 — API:

```bash
chmod +x scripts/run_api.sh
./scripts/run_api.sh
# or: python -m uvicorn vastra.api:app --reload --port 8000
```

Terminal 2 — UI:

```bash
streamlit run app.py
```

### Checks (no paid API calls)

```bash
python -m compileall app.py vastra scripts tests
python -m unittest discover -s tests -v
```

## Roadmap

- Emergency Fit quiz → Nemotron outfit from wardrobe + profile
- Trend Stylist with optional retrieved trend context
- Smart Shopping product / thrift sources

## Demo

Coming soon.

## License

MIT — see [LICENSE](LICENSE).
