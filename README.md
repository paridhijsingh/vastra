# Vastra (वस्त्र)

**Ready, set, styled.**

Your personal AI stylist for the clothes you already own.

Vastra (Sanskrit for clothing) helps you dress for everyday occasions, celebrations, and festivities using your preferences and saved wardrobe. When one piece does not work, it helps you revise the outfit without starting over.

Built for the **NVIDIA × Nebius Global AI Hackathon — Best Apps and Agents track**.

## Live demo

Open the app with no local install and no key of your own:

- **App (Vercel):** https://vastra-one-beryl.vercel.app
- **API (Render):** https://vastra-api-c5gx.onrender.com — `GET /health` returns `{"status":"ok"}`

The frontend host is set with only `API_URL=https://vastra-api-c5gx.onrender.com` and `AUTH_COOKIE_MAX_AGE_HOURS=72`. Backend secrets stay on Render. After idle, the first API request may take about a minute while the service wakes up.

**Judges (no account, no wardrobe typing):** Skip intro → **Try the demo** → **Generate outfit**. Occasion is prefilled as dinner with friends. Demo clothes are synthetic (`Demo — …`) and private to the demo user.

For local development, use the [Local setup](#local-setup) env names (`API_URL`, `AUTH_COOKIE_MAX_AGE_HOURS`) against `http://127.0.0.1:8000` instead of these URLs.

## Project status

Rebuilding from scratch. Features below are **planned** unless noted.

- **Backend auth, style profile, and wardrobe APIs** are implemented and tested.
- **Frontend authentication** is implemented (register, sign in, HttpOnly session cookie).
- **Style Profile UI** is implemented (load/save/delete).
- **Confirmed preferences** are reviewed and saved at `/preferences`. They are guidance for later Stylist, Emergency Fit, and Rescue requests. They do not change ownership or availability.
- **Wardrobe UI** is implemented (list/add/edit/delete with availability filters).
- **Style Dictionary** has a shared seeded catalog and private entry create/edit/delete on the API and in the Next.js page. AI term suggestions and live trend retrieval are pending.
- **Nebius / Nemotron** settings are optional. A manual smoke-test script can make one styling check. Emergency Fit uses that connection on the API.
- **Emergency Fit** recommends one outfit from available owned clothes. The page is at `/emergency-fit`. Suggestions are saved only when you choose Save a look. Image generation is post-v1.
- **Rescue My Outfit** replaces one available piece with another owned item of the same category. The page is at `/rescue`. Suggestions are saved only when you choose Save a look.
- **Saved Looks** stores a named plan at `/looks`. Emergency Fit and Rescue call the model only when you generate or rescue an outfit.
- **Saved Events** stores a dated plan at `/events`. It can point at a Saved Look without copying wardrobe items. There is no location, weather, or reminder.
- **Stylist chat** is `POST /stylist/chat` and the signed-in page `/stylist`. It answers from the saved profile and available wardrobe. The conversation stays in the browser tab and is not stored.
- Smart Shopping remains excluded.

Emergency Fit, Rescue My Outfit, Saved Looks, and Events can be used from their signed-in pages. A look is stored only when you choose Save a look.

## Planned features

| Feature                                | What it does                                                                                    | Status  |
| -------------------------------------- | ----------------------------------------------------------------------------------------------- | ------- |
| **Style profile**                      | Save preferred styles, colors, fit, comfort preferences, and clothing to avoid                  | Working (API + UI) |
| **My wardrobe**                        | Manually add, view, edit, and delete clothing and accessories                                   | Working (API + UI) |
| **Wardrobe availability**              | Mark items available, in the laundry, or packed away                                            | Working (API + UI) |
| **Style Dictionary**                   | Searchable fashion terms, pairing guidance, occasions, and comfort-aware alternatives           | Working (API + manual entry UI) |
| **Emergency Fit**                      | Recommend an outfit for an occasion using available owned items                                 | Working |
| **Rescue My Outfit**                   | Replace one available piece with another of the same category and keep the rest locked          | Working |
| **Weather-aware styling**              | Optional weather context for outfit advice; location used only on explicit request              | Planned |
| **Saved Looks**                        | Save a named outfit plan from owned wardrobe items for later recall                             | Working |
| **Saved Events**                       | Save a dated plan and optionally attach one Saved Look                                          | Working |
| **Stylist chat**                       | Conversational outfit planning from saved clothes and what you describe                         | Working (API + UI) |
| **Styling explanations**               | Explain outfit choices and offer optional hair or makeup tips                                   | Planned |
| **Outfit feedback**                    | Save ratings and comments separately from lasting preferences                                   | Planned |
| **Confirmed memory**                   | Ask before remembering a lasting preference; support approval, editing, dismissal, and deletion | Planned |
| **Authentication and private storage** | Restrict saved records to their owner                                                           | Working (API + frontend sign-in) |
| **Data controls**                      | Export and delete saved personal records                                                        | Planned |

Support Indian, Western, and fusion styles, with men, women, and unisex styling preferences.

Cultural styling choices will reflect the user's preferences and context rather than assume universal dress-code rules.

### Style Dictionary (private entries on the API)

The shared catalog is a version-controlled JSON file inside the `vastra` package. Shared entries are read-only. Personal entries are stored in the user database and are visible only to their owner.

Authenticated endpoints:

- `GET /dictionary` — shared entries plus the signed-in user's personal entries. Optional `q` (case-insensitive search of term, aliases, and definition; blank means no search), `style` (`Indian`, `Western`, or `fusion`), `kind` (`garment`, `fabric`, `silhouette`, or `styling_technique`), and `tag` (case-insensitive exact match against `style_tags`; blank means no tag filter). An unknown tag returns `[]`. Supplied filters combine with AND and apply to both sources. Results are alphabetical.
- `GET /dictionary/{entry_id}` — one shared entry or the current user's personal entry, or 404.
- `POST /dictionary` — create a personal entry. Returns 201. The server assigns the id.
- `PATCH /dictionary/{entry_id}` — update supplied fields on a personal entry. `cultural_context: null` clears it. `[]` clears a list. An empty body is rejected.
- `DELETE /dictionary/{entry_id}` — delete a personal entry. Returns 204.

Every route requires a bearer token. Responses include `origin` (`shared` or `personal`) and do not include an owner id. Only the owner can change a personal entry. Another user's entry is 404 and is omitted from lists. Shared entries are read-only. These routes do not read or change a user's profile or wardrobe.

`styles` uses a dictionary enum (`Indian`, `Western`, `fusion`) that is separate from the profile style enum. `style_tags`, plus an optional `cultural_context`, can name additional cultural styles.

Future entry text should stay short and original. Pairings are suggestions, not rules. Garments are not limited by gender, and entries do not judge body shape. Weather and comfort notes depend on fabric weight, construction, fit, and personal preference; they are not guarantees. Entries are not described as currently trending.

The signed-in Next.js page is `/dictionary`. It searches and filters the catalog, links each term to `/dictionary/[entry_id]`, and can add, edit, and delete personal entries. Edit and delete appear only when the API reports `origin` `personal`. Shared entries stay read-only. The style menu is Indian, Western, and fusion. A separate text field filters by a cultural or style tag. Terms you add are private to your account. The page does not call a model, and it does not label manual entries as verified or currently trending.

Pending:

- AI term suggestions, which must stay drafts until reviewed and approved, and must not be labeled verified or currently trending without supporting sources
- Live trend retrieval

### Weather-aware styling (planned)

Optional location permission is requested only when the user clicks **Use my location**.

- If permission is denied, the user may enter weather conditions manually or continue without weather guidance.
- Precise coordinates are request-only: do not persist them by default, and do not include them in logs, analytics, saved events, or model prompts.
- Obtain a fresh location only after the user clicks **Use my location**.
- Coordinates may be sent to the weather provider for that lookup. Permission duration and wording are controlled by the browser or OS — do not promise “allow once” or “always allow” options.
- Do not send precise coordinates to Nemotron; send relevant weather conditions instead.
- Display: “Weather can change. You can also check your preferred weather app to verify conditions before heading out.”

### Saved Looks

The signed-in pages are `/looks` and `/looks/{id}`. A look is a named plan of owned wardrobe items, including laundry and packed-away pieces. Emergency Fit and Rescue show **Save a look** only after a suggestion. Saving does not generate another outfit. A deleted wardrobe item stays in its position as “Wardrobe item removed.”

### Saved Events

The signed-in pages are `/events` and `/events/{id}`. `occasion`, `notes`, and `comfort_needs` are optional. A Saved Look can be attached from the looks you already saved. **Suggest an outfit** opens Emergency Fit with that event’s id. The page fills the occasion from the event, or the event name when the occasion is blank, and fills the comfort needs. Vibe stays blank. Opening the page does not generate an outfit. Saving a look does not change the event. **Attach to this event** sends only the new look id, and replacing a look leaves the previous look saved. Reading an event uses that look’s current name and does not copy wardrobe items. Deleting the look keeps the event and clears the link. Deleting the event keeps the look and the wardrobe. There is no location, weather, or reminder field.

## Emergency Fit

> “I have dinner in 20 minutes and no shopping budget. What can I wear?”

Vastra will:

1. Retrieve your saved style profile.
2. Load wardrobe items marked available.
3. Retrieve relevant confirmed preferences.
4. Ask Nemotron for a structured outfit recommendation.
5. Validate ownership, availability, and constraints.
6. Display the outfit and explain the choices.

The signed-in page is `/emergency-fit`. It asks for an occasion, an optional vibe, and optional comfort needs, then shows the outfit. An event link can prefill the occasion and comfort needs; the model still receives only those fields, and only after you choose Generate outfit. Suggestions are saved only when you choose Save a look. Attaching that look to the event is a separate step. If your wardrobe lacks suitable pieces, the page explains the limitation.

## Rescue My Outfit

> “These shoes are uncomfortable. Replace only the shoes and keep the rest.”

The signed-in page is `/rescue`. It locks every piece except the one being replaced, asks for one available replacement of the same category, and shows the revision. Suggestions are saved only when you choose Save a look. Saving stores the replacement outfit.

If no other available item in that category exists, the API explains that and does not call the model. It does not replace a second piece.

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
| Interface          | Next.js (App Router), TypeScript, Tailwind |
| Backend            | Python and FastAPI (MCP deferred)         |
| Local storage      | SQLite via SQLAlchemy                     |
| Validation         | Pydantic and deterministic backend checks |
| Authentication     | Authenticated, owner-scoped access        |
| AI model           | NVIDIA Nemotron                           |
| Inference provider | Nebius Token Factory                      |

**Model choice:** Use Nemotron through Nebius Token Factory, not Gemini, for outfit recommendations.

The exact model identifier and API configuration will be verified during integration.

The backend will own database access and model credentials. Shared deployment requires verified authentication, user isolation, and durable storage. Do not put Nebius keys or other backend secrets in the Next.js frontend.

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
2. Profile, wardrobe, availability, authentication, and frontend shell
3. Frontend auth/API integration
4. Nebius integration and Emergency Fit
5. Rescue My Outfit
6. Confirmed memory and data controls
7. Deployment and submission preparation

Each milestone will be implemented, run, and debugged before moving ahead.

## Local setup

### Backend (FastAPI)

```bash
python3 -m venv .venv
source .venv/bin/activate
python -m pip install --upgrade pip
python -m pip install -r requirements.txt
cp .env.example .env
# Edit .env and set SECRET_KEY to a long random string (required).
# Optional judge demo: set DEMO_EMAIL and DEMO_PASSWORD, then:
python scripts/seed_demo.py
uvicorn vastra.api:app --reload --host 127.0.0.1 --port 8000
```

Then open:

- http://127.0.0.1:8000/ → `{"name": "Vastra AI", "status": "running"}`
- http://127.0.0.1:8000/health → `{"status": "ok"}`

Auth endpoints (JWT bearer tokens):

- `POST /auth/register` — create an account
- `POST /auth/login` — receive an access token
- `GET /auth/me` — current user (requires `Authorization: Bearer <token>`)

Style Dictionary (requires `Authorization: Bearer <token>`):

- `GET /dictionary` — shared catalog plus your personal entries
- `GET /dictionary/{entry_id}` — one shared or personal entry, or 404
- `POST /dictionary` — create a personal entry
- `PATCH /dictionary/{entry_id}` — update your personal entry
- `DELETE /dictionary/{entry_id}` — delete your personal entry

Emergency Fit (requires `Authorization: Bearer <token>`):

- `POST /outfits/emergency` — one outfit from clothes marked available. Does not save the outfit or change the wardrobe, profile, or dictionary. The page is http://127.0.0.1:3000/emergency-fit.

```json
{"occasion": "dinner with friends", "vibe": "relaxed", "comfort_needs": ["breathable"]}
```

`occasion` is required. `vibe` and `comfort_needs` are optional. A saved profile is optional. If nothing is available, the response is 409 and the model is not called.

Rescue My Outfit (requires `Authorization: Bearer <token>`):

- `POST /outfits/rescue` — replace one available piece with another available owned item of the same category. Does not save the outfit or change the wardrobe, profile, or dictionary. The page is http://127.0.0.1:3000/rescue.

```json
{"item_ids": ["top-id", "bottom-id"], "replace_item_id": "top-id", "occasion": "dinner with friends", "change_request": "The top feels too warm.", "comfort_needs": ["breathable"]}
```

`item_ids`, `replace_item_id`, `occasion`, and `change_request` are required. `comfort_needs` is optional. Unknown outfit ids return 404. If the pieces are not available, or no same-category replacement exists, the response is 409 and the model is not called.

Saved Looks (requires `Authorization: Bearer <token>`):

- `POST /looks` — save an ordered plan. Returns 201. Does not call the model.
- `GET /looks` — the signed-in user's looks, newest first
- `GET /looks/{id}` — one look, with current wardrobe details
- `PATCH /looks/{id}` — rename or edit occasion and notes
- `DELETE /looks/{id}` — 204

```json
{"name": "Dinner", "occasion": "dinner with friends", "notes": "Mostly standing.", "item_ids": ["top-id", "bottom-id", "shoes-id"]}
```

`name` and `item_ids` are required. `occasion` and `notes` are optional. Unknown and another user's item ids both return 404. A deleted wardrobe item stays in its position as a missing marker. The pages are http://127.0.0.1:3000/looks and http://127.0.0.1:3000/looks/{id}.

Saved Events (requires `Authorization: Bearer <token>`):

- `POST /events` — save a dated plan. Returns 201. Does not call the model.
- `GET /events` — the signed-in user's events, ordered by date then id
- `GET /events/{event_id}` — one event, with the attached look’s current name
- `PATCH /events/{event_id}` — change only the supplied fields
- `DELETE /events/{event_id}` — 204. Does not delete the look or wardrobe

```json
{"name": "Dinner", "event_date": "2026-11-02", "occasion": "dinner with friends", "notes": "Mostly standing.", "comfort_needs": ["breathable"], "look_id": "look-id"}
```

`name` and `event_date` are required. `event_date` is a calendar date. Unknown and another user's event or look ids both return 404. The pages are http://127.0.0.1:3000/events and http://127.0.0.1:3000/events/{id}.

Required configuration in `.env`:

- `SECRET_KEY` — JWT signing secret (no default; required)
- `DATABASE_URL` — defaults to `sqlite:///./data/vastra.db` (directory created automatically)

Optional: `JWT_EXPIRE_HOURS` (default `72`).

Optional Nebius settings in the root `.env` (the API starts without a key):

- `NEBIUS_API_KEY`
- `NEBIUS_BASE_URL` — default `https://api.tokenfactory.nebius.com/v1/`
- `NEMOTRON_MODEL` — default `nvidia/NVIDIA-Nemotron-3-Nano-30B-A3B`. Emergency Fit and Rescue use this model.
- `STYLIST_MODEL` — default `nvidia/nemotron-3-super-120b-a12b`. Stylist chat uses this model.
- `NEMOTRON_TIMEOUT_SECONDS` — default `60`, shared by those calls.

Emergency Fit and Rescue send `chat_template_kwargs.enable_thinking` set to false for Nano. Stylist sends that same body only on its own requests. Five observed Nebius calls with Super and that body returned `reasoning_tokens` 0. That does not show that every Nebius endpoint honors the control. Stylist still caps output at 1024 tokens, uses the shared timeout, rejects invalid replies, and does not retry. A response that stops because it reached the cap is rejected, including when the partial text is JSON.

Stylist chat (requires `Authorization: Bearer <token>`):

- `POST /stylist/chat` — one reply. Does not save the chat or change the profile, wardrobe, looks, events, or dictionary. The signed-in page is `/stylist`.

```json
{"message": "I have a wedding next week and own cream trousers.", "history": [{"role": "user", "content": "Help me plan an outfit."}, {"role": "assistant", "content": "Is this indoors?"}]}
```

`message` is required. `history` is optional and accepts only `user` and `assistant` turns. A message is at most 2000 characters, history is at most 12 turns, and the combined text is at most 8000 characters. The server loads the signed-in profile and wardrobe. Saved available rows and saved unavailable rows are separate lists, and only an available id can be selected. A reply is `clarification` or `proposal`. Clarification is for the case with no occasion and no usable preference or piece. Otherwise the reply is a proposal and unknowns stay in the note. The prompt does not require body type, size, or gender. It keeps the user's style wording. Clothes described in chat stay separate from saved rows, including when the names match. A proposal contains one outfit. The server builds the proposal title and message from the validated pieces. The model returns a saved id, a user-turn index plus an exact phrase, or a short suggested description. Python checks the phrase against that user turn. The match records where the words came from and does not prove ownership or the category. Assistant turns are not numbered. It rejects a suggestion with competing bottoms or a repeated saved id instead of dropping a piece. Prompt rules for layering, fusion, and breathability still need live evaluation. A proposal can include suggestions whose pieces are `saved_wardrobe`, `described`, or `suggested`. Saved pieces use current wardrobe details. Described and suggested pieces have no wardrobe id. This is separate from Saved Looks. Mocked tests check this prompt and schema. They do not establish live conversational quality.

Manual smoke test (one paid chat completion; not part of pytest):

```bash
source .venv/bin/activate
python scripts/check_nemotron.py
```

The script loads the root `.env` from any working directory, then asks Nemotron for one short styling sentence. It prints the answer and token usage. It exits nonzero for missing settings, authentication errors, rate limits, connection or timeout errors, and empty or truncated responses. It does not read the database or send user data.

Manual Stylist comparison (paid only with `--run`; not part of pytest):

```bash
source .venv/bin/activate
python scripts/evaluate_stylist_models.py
python scripts/evaluate_stylist_models.py --run \
  --model nvidia/NVIDIA-Nemotron-3-Nano-30B-A3B \
  --model nvidia/nemotron-3-super-120b-a12b \
  --settings scripts/stylist_eval_settings.example.json
```

Without `--run`, the script prints the five synthetic scenarios and the scoring checklist and does not call the model. This is evaluation version 8. When the user clearly identifies an available saved garment, the model is told to use that saved id, and to ask when the reference is ambiguous. Version 7 includes confirmed preferences as guidance. Version 6 tells the model to acknowledge an unavailable saved garment, to put every recommended garment in the pieces, and to suggest unowned shoes. A shirt with trousers is not fusion by itself. Version 5 selects one bottom or one one-piece. Requested trousers are that bottom, and a saved bottom is left out. Version 4 accepts an optional category on a saved reference and uses the wardrobe record instead. The prompt still asks for the minimal saved shape. Version 3 added the JSON piece examples. Version 1 used the previous internal contract. With `--run`, the command above sends at most 10 completions: two models and five scenarios, one completion each, with no retries. Both models receive `scripts/stylist_comparison_prompt.txt`. That file must match the current stylist prompt or the script stops before any request. Nano's settings entry disables thinking. Super's entry sends no reasoning override. The output records model ID, latency, token counts, schema success, and a sanitized error reason. The application's configured model is unchanged.

A Super-only diagnostic can select one scenario. NVIDIA documents `chat_template_kwargs.enable_thinking` set to false for `nvidia/nemotron-3-super-120b-a12b`. Nebius Token Factory has not confirmed that its endpoint honors that control. The settings file below sends that control once and labels the result experimental. It does not change the application client. This command sends one completion and was not run from the repository checks:

```bash
source .venv/bin/activate
python scripts/evaluate_stylist_models.py --run \
  --model nvidia/nemotron-3-super-120b-a12b \
  --scenario owned_uncatalogued \
  --settings scripts/stylist_super_diagnostic.settings.json
```

The JSON line records `reasoning_tokens`, `finish_reason`, `schema_success`, and `error_reason`. Answer quality still uses the manual checklist on that one scenario.

Run backend tests:

```bash
source .venv/bin/activate
python -m pytest tests/ -q
```

### Frontend (Next.js)

```bash
cd frontend
cp .env.example .env.local
npm install
npm run dev
```

Open http://localhost:3000

Frontend auth pages:

- `/register` — create an account (then sign in)
- `/signin` — establish a browser session
- `/profile` — style profile form (requires sign-in)
- `/wardrobe` — wardrobe manager with availability filters (requires sign-in)
- `/dictionary` — style dictionary search, plus add, edit, and delete for your own terms (requires sign-in; shared entries are read-only)

Frontend configuration (server-only in `.env.local` locally, or Vercel project env in production):

- `API_URL` — FastAPI base URL (local default `http://127.0.0.1:8000`; live demo uses `https://vastra-api-c5gx.onrender.com`)
- `AUTH_COOKIE_MAX_AGE_HOURS` — session cookie lifetime; keep aligned with backend `JWT_EXPIRE_HOURS` (default `72`)

The access token is stored only in an HttpOnly, SameSite=Lax cookie set by Next.js route handlers. It is not placed in `localStorage`, `sessionStorage`, client JavaScript, URLs, or client response bodies. Logout clears the browser cookie; it does **not** revoke the JWT on the FastAPI backend.

Backend secrets and Nebius credentials must stay on the FastAPI server. Do not add them to frontend env files.

Run frontend checks:

```bash
cd frontend
npm test
npm run lint
npm run typecheck
npm run build
```

Nebius credentials stay in the root backend `.env`. Do not copy `NEBIUS_API_KEY` into frontend env files. Outfit generation is not wired to the model yet.

Never commit `.env`, `.env.local`, API keys, authentication secrets, or personal database files.

### Testing the demo

Demo credentials are **never hardcoded**. Set them in the backend `.env` (and on Render for the live API):

```
DEMO_EMAIL=demo@vastra.example
DEMO_PASSWORD=choose-your-own-demo-password
```

`DEMO_EMAIL` is the demo username. Then seed (idempotent):

```bash
python scripts/seed_demo.py
```

That creates a style profile plus 15 synthetic wardrobe items (`Demo — …`), including two marked in laundry. The demo user cannot read or edit another user's records.

- **Judges:** https://vastra-one-beryl.vercel.app → Skip intro → **Try the demo** → **Generate outfit**. No registration and no wardrobe typing. The password is not shown in the browser.
- **Signed-in testers with an empty closet:** `/wardrobe` → **Load demo wardrobe** copies the same synthetic items into that account only.
- Manual login (local only): username `demo@vastra.example` and the `DEMO_PASSWORD` you set. Do not commit that password.

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

Live URLs are in [Live demo](#live-demo). Judge clicks are in [Testing the demo](#testing-the-demo).

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
