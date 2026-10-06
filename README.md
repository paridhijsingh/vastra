# Vastra (वस्त्र)

**Ready, set, styled.**

Your personal AI stylist for the clothes you already own.

Vastra (Sanskrit for clothing) helps you dress for everyday occasions, celebrations, and festivities using your preferences and saved wardrobe. When one piece does not work, it helps you revise the outfit without starting over.

Built for the **NVIDIA × Nebius Global AI Hackathon — Personal AI track**.

## Project status

Rebuilding from scratch. All features below are **planned** and will be marked as working only after implementation and verification.

A working demo is not yet available.

## Planned features

| Feature                                | What it does                                                                                    | Status  |
| -------------------------------------- | ----------------------------------------------------------------------------------------------- | ------- |
| **Style profile**                      | Save preferred styles, colors, fit, comfort preferences, and clothing to avoid                  | Planned |
| **My wardrobe**                        | Manually add, view, edit, and delete clothing and accessories                                   | Planned |
| **Wardrobe availability**              | Mark items available, in the laundry, or packed away                                            | Planned |
| **Style Dictionary**                   | Searchable fashion terms, pairing guidance, occasions, and comfort-aware alternatives           | Planned |
| **Emergency Fit**                      | Recommend an outfit for an occasion and time limit using available owned items                  | Planned |
| **Rescue My Outfit**                   | Replace a selected piece while preserving the rest of the outfit                                | Planned |
| **Weather-aware styling**              | Optional weather context for outfit advice; location used only on explicit request              | Planned |
| **Saved events and outfits**           | Save occasions and outfits for later recall                                                     | Planned |
| **Styling explanations**               | Explain outfit choices and offer optional hair or makeup tips                                   | Planned |
| **Outfit feedback**                    | Save ratings and comments separately from lasting preferences                                   | Planned |
| **Confirmed memory**                   | Ask before remembering a lasting preference; support approval, editing, dismissal, and deletion | Planned |
| **Authentication and private storage** | Restrict saved records to their owner                                                           | Planned |
| **Data controls**                      | Export and delete saved personal records                                                        | Planned |

Support Indian, Western, and fusion styles, with men, women, and unisex styling preferences.

Cultural styling choices will reflect the user's preferences and context rather than assume universal dress-code rules.

### Style Dictionary (planned)

Core feature: searchable fashion terms with pairing guidance, occasion notes, and comfort-aware alternatives.

- Start with curated entries.
- AI-generated additions remain drafts until reviewed.

### Weather-aware styling (planned)

Optional location permission is requested only when the user clicks **Use my location**.

- If permission is denied, the user may enter weather conditions manually or continue without weather guidance.
- Precise coordinates are request-only: do not persist them by default, and do not include them in logs, analytics, saved events, or model prompts.
- Obtain a fresh location only after the user clicks **Use my location**.
- Coordinates may be sent to the weather provider for that lookup. Permission duration and wording are controlled by the browser or OS — do not promise “allow once” or “always allow” options.
- Do not send precise coordinates to Nemotron; send relevant weather conditions instead.
- Display: “Weather can change. You can also check your preferred weather app to verify conditions before heading out.”

### Saved events and outfits (planned)

Deferred to a later milestone after the core wardrobe and styling workflows.

## Emergency Fit

> “I have dinner in 20 minutes and no shopping budget. What can I wear?”

Vastra will:

1. Retrieve your saved style profile.
2. Load wardrobe items marked available.
3. Retrieve relevant confirmed preferences.
4. Ask Nemotron for a structured outfit recommendation.
5. Validate ownership, availability, and constraints.
6. Display the outfit and explain the choices.

If your wardrobe lacks suitable pieces, Vastra will explain the limitation or ask a follow-up question.

## Rescue My Outfit

> “These shoes are uncomfortable. Replace only the shoes and keep the rest.”

Vastra will lock the other pieces, find an available replacement, and validate the revised outfit.

If no suitable replacement exists, it will explain why. It will ask before changing another piece.

## Feedback and confirmed memory

Feedback about one outfit should not automatically become a permanent preference.

For example:

1. You give feedback about uncomfortable shoes.
2. Vastra proposes:
   “Prefer flats for events involving standing.”
3. You approve, edit, or dismiss the proposal.
4. Only an approved preference becomes lasting memory.
5. Later recommendations retrieve relevant confirmed preferences.

You will be able to inspect, edit, and delete saved preferences.

Unconfirmed or dismissed proposals will not become lasting instructions. Deleted preferences will not be silently recreated from old feedback.

## Example workflow

1. Create an account.
2. Save your style preferences.
3. Add clothing and accessories manually.
4. Mark which items are available today.
5. Request an outfit for an occasion.
6. Review the validated recommendation.
7. Use Rescue My Outfit to replace one piece.
8. Give feedback and review any proposed preference.
9. Make another request using your confirmed preferences.

## Recommendation rules

- Recommend only confirmed, owned, available clothing and accessories.
- Validate item IDs and ownership in the backend.
- Recheck availability when generating or revising an outfit.
- Preserve locked pieces during outfit rescue.
- Ask before changing additional pieces.
- Respect explicit exclusions and clarify conflicting constraints.
- Never present missing items as owned.
- Keep optional hair and makeup tips separate from wardrobe items.
- Never save a lasting preference without confirmation.
- Report inference failures rather than fabricate recommendations.

## Scope boundaries

### Outside the MVP

- Smart Shopping (remains excluded)
- Store links, product prices, and thrift inventory
- Automatic purchases
- Photo-based wardrobe recognition
- Virtual try-on
- Native iOS application
- Occasion Translator and One Item, Three Ways
- MCP tooling (deferred; continue with FastAPI)

### Stretch feature

**Trend Stylist** may be considered only after the core workflow is reliable and deployed.

Claims about current trends must use dated, retrieved sources. Retrieval and permitted scraping remain stretch work.

## Proposed technology

| Component          | Technology                                |
| ------------------ | ----------------------------------------- |
| Interface          | Streamlit                                 |
| Backend            | Python and FastAPI (MCP deferred)         |
| Local storage      | SQLite via SQLAlchemy                     |
| Validation         | Pydantic and deterministic backend checks |
| Authentication     | Authenticated, owner-scoped access        |
| AI model           | NVIDIA Nemotron                           |
| Inference provider | Nebius Token Factory                      |

**Model choice:** Use Nemotron through Nebius Token Factory, not Gemini, for outfit recommendations.

The exact model identifier and API configuration will be verified during integration.

The backend will own database access and model credentials. Shared deployment requires verified authentication, user isolation, and durable storage.

## Personal AI workflows

Vastra will implement three reusable workflows:

- **Emergency Fit:** retrieve personal context and recommend a validated outfit.
- **Rescue My Outfit:** replace one selected piece while preserving the others.
- **Confirmed memory:** propose a preference and save it only after approval.

Persistent records will include the style profile, wardrobe, outfit history, feedback, and confirmed preferences.

The model will propose recommendations. Backend checks will enforce ownership, availability, and locked-item rules.

## Privacy and data controls

These are planned requirements, not claims of completed protection:

- Keep API keys and authentication secrets server-side.
- Exclude secrets and personal database files from Git.
- Restrict saved records to their owner.
- Explain what data is sent to Nebius before the first inference.
- Send only context needed for the request.
- Avoid logging credentials or raw personal records.
- Provide export and deletion of saved personal data.
- Let users inspect, edit, and delete confirmed preferences.
- Document backup and provider-retention limitations.
- Use synthetic data in the public demonstration.
- Location is request-only: do not persist precise coordinates by default, and do not include them in logs, analytics, saved events, or model prompts. Obtain a fresh location only after **Use my location**. Coordinates may be sent to the weather provider for that lookup; send weather conditions (not coordinates) to Nemotron.

Vastra uses external model inference and is not entirely on-device.

## Development plan

See [PLAN.md](PLAN.md) for milestones and acceptance checks.

Build order:

1. Minimal backend and verified local environment
2. Profile, wardrobe, availability, authentication, and basic interface
3. Nebius integration and Emergency Fit
4. Rescue My Outfit
5. Confirmed memory and data controls
6. Deployment and submission preparation

Each milestone will be implemented, run, and debugged before moving ahead.

## Local setup

Verified for the FastAPI foundation and authentication endpoints:

```bash
python3 -m venv .venv
source .venv/bin/activate
python -m pip install --upgrade pip
python -m pip install -r requirements.txt
cp .env.example .env
# Edit .env and set SECRET_KEY to a long random string (required).
uvicorn vastra.api:app --reload --host 127.0.0.1 --port 8000
```

Then open:

- http://127.0.0.1:8000/ → `{"name": "Vastra AI", "status": "running"}`
- http://127.0.0.1:8000/health → `{"status": "ok"}`

Auth endpoints (JWT bearer tokens):

- `POST /auth/register` — create an account
- `POST /auth/login` — receive an access token
- `GET /auth/me` — current user (requires `Authorization: Bearer <token>`)

Required configuration in `.env`:

- `SECRET_KEY` — JWT signing secret (no default; required)
- `DATABASE_URL` — defaults to `sqlite:///./data/vastra.db` (directory created automatically)

Optional: `JWT_EXPIRE_HOURS` (default `72`).

Run auth tests:

```bash
source .venv/bin/activate
python -m pytest tests/test_auth.py -q
```

Later milestones will add Nebius / Nemotron settings (`NEBIUS_API_KEY`, `NEBIUS_BASE_URL`, `NEMOTRON_MODEL`).

Never commit `.env`, API keys, authentication secrets, or personal database files.

## Verification goals

- Saved records survive application restarts.
- Users cannot access another user's records.
- Recommendations contain only valid, owned, available items.
- Deleted items are excluded from new recommendations.
- Rescue preserves locked pieces.
- Missing replacements produce clear responses.
- Unconfirmed preferences do not become lasting instructions.
- Approved preferences are retrieved for later requests.
- Preference edits and deletions affect subsequent requests.
- Model errors and malformed responses are handled.
- Export and deletion cover all stored personal record types.
- Deployed storage survives restarts.

## Demo

Coming soon.

The planned demonstration will show:

1. A saved profile and available wardrobe
2. A dinner outfit recommendation
3. A shoe replacement with other pieces preserved
4. Explicit approval of a preference for flats when standing
5. A later recommendation using that preference

## Hackathon submission

Planned materials:

- Working demo or test-build URL
- Public source repository with an open-source license
- README with verified setup and run instructions
- English project description
- Public YouTube demonstration under three minutes
- Documentation of actual NVIDIA and Nebius integration
- Requested platform feedback

The finished application will be reviewed against the full track requirements. Background or always-on behavior will not be claimed unless implemented.

[Official hackathon rules](https://nebiusglobalaihackathon.devpost.com/rules)

## License

See [LICENSE](LICENSE).
