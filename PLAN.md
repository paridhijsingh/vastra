# Vastra (वस्त्र) — Build Plan

**Ready, set, styled.**

Updated: October 7, 2026  
Status: FastAPI auth/profile/wardrobe APIs working; Next.js auth, Style Profile UI, Wardrobe UI, and read-only Style Dictionary page working; personal dictionary entries can be managed through the API; shared catalog is empty; Emergency Fit next  
Hackathon: NVIDIA × Nebius Global AI Hackathon — Personal AI track  
Submission deadline: October 30, 2026, at 10 AM PDT  
Target submission readiness: October 29, 2026

## 1. Product goal

Build a personal AI stylist that helps users dress for an occasion using clothes they already own and can wear today.

Vastra will remember explicit, user-approved preferences and help revise an outfit when one piece does not work.

Primary scenario:

> “I have dinner in 20 minutes and no shopping budget. What can I wear?”

Signature feature:

> “These shoes are uncomfortable. Replace only the shoes and keep the rest.”

The first release should complete these workflows reliably before adding more features.

## 2. Agreed scope

| Feature               | Planned behavior                                                                           |
| --------------------- | ------------------------------------------------------------------------------------------ |
| Style profile         | Save preferred styles, colors, fit, comfort preferences, and clothing to avoid             |
| Wardrobe              | Manually add, view, edit, and delete clothing and accessories                              |
| Wardrobe availability | Mark items available, in the laundry, or packed away                                       |
| Style Dictionary      | Shared read-only catalog plus private entries the owner can create, edit, and delete |
| Emergency Fit         | Recommend an outfit for an occasion and time limit using available owned items             |
| Rescue My Outfit      | Replace a selected piece while preserving the rest of the outfit                           |
| Weather-aware styling | Optional weather context; location requested only via "Use my location"                    |
| Saved events/outfits  | Save occasions and outfits for later recall (later milestone)                              |
| Explanations          | Explain outfit choices and offer optional hair or makeup tips                              |
| Outfit feedback       | Save ratings and explicit comments separately from lasting preferences                     |
| Confirmed memory      | Ask before saving a lasting preference; support approval, editing, dismissal, and deletion |
| Authentication        | Protect saved records and restrict access to their owner                                   |
| Data controls         | Export and delete saved personal records                                                   |

Support Indian, Western, and fusion styles, with men, women, and unisex styling preferences.

Cultural styling choices should reflect the user's preferences and context rather than assume universal dress-code rules.

### Style Dictionary (private API entries, read-only page)

The shared catalog is still the empty JSON file packaged with the backend. Personal entries are stored in SQLite and owned by the authenticated user. `create_all` adds that table without deleting existing data.

`GET /dictionary` returns shared entries plus the current user's personal entries. `GET /dictionary/{entry_id}` returns a shared entry or that user's personal entry, otherwise 404. `POST /dictionary` creates a personal entry and returns 201. `PATCH` updates only supplied fields. `DELETE` returns 204. The server assigns ids prefixed with `personal-`. Responses include `origin` (`shared` or `personal`) and never include an owner id. Another user's entry is 404 and is left out of lists. Shared entries reject PATCH and DELETE. These routes do not read or change a profile or wardrobe.

Each entry is general guidance: term, aliases, definition, kind (`garment`, `fabric`, `silhouette`, or `styling_technique`), dictionary `styles` (`Indian`, `Western`, `fusion`), flexible `style_tags`, optional `cultural_context`, pairing suggestions, occasions, weather notes, and comfort notes. The dictionary style enum is separate from the profile style enum. `style_tags` can name other cultural styles without changing saved profiles.

Search (`q`), `style`, `kind`, and `tag` filters combine with AND across both sources. `tag` is a case-insensitive exact match on `style_tags`. A blank tag does not filter. An unknown tag returns `[]`. Invalid `style` or `kind` values still use the sanitized 422 response.

Entry text, when added, should be short and original. Pairings are suggestions. Do not restrict garments by gender or judge body shape. Weather and comfort depend on fabric weight, construction, fit, and preference; do not present them as guarantees. Do not claim an entry is currently trending, and do not invent citations, review dates, or product links.

The Next.js page at `/dictionary` is signed-in and read-only. It loads `GET /dictionary`, keeps submitted filters in the URL, and opens `/dictionary/[entry_id]` for a term. It does not yet create, edit, or delete entries.

Pending: the manual-entry UI, AI term suggestions, and live trend retrieval. A suggested term stays a draft until a person reviews and approves it. Do not label a suggestion as verified or currently trending without supporting sources.

### Weather-aware styling (planned)

- Request optional location permission only when the user clicks **Use my location**.
- If permission is denied, allow manual weather conditions or continuing without weather guidance.
- Precise coordinates are request-only: do not persist them by default; do not include them in logs, analytics, saved events, or model prompts.
- Obtain a fresh location only after **Use my location**. Permission duration and wording are controlled by the browser/OS — do not promise “allow once” or “always allow.”
- Explain that coordinates are sent to the weather provider for the lookup. Do not send precise coordinates to Nemotron; send relevant weather conditions instead.
- Display: “Weather can change. You can also check your preferred weather app to verify conditions before heading out.”

### Saved events and outfits (planned)

Deferred to a later milestone after the core wardrobe and styling workflows.

### Stretch feature

Trend Stylist may be considered only after the MVP is reliable and deployed. Claims about current trends must use dated, retrieved sources. Retrieval and permitted scraping remain stretch work.

### Excluded

- Smart Shopping (remains excluded)
- Store links, product prices, and thrift inventory
- Automatic purchases
- Photo-based wardrobe recognition
- Virtual try-on
- Native iOS application
- Other brainstormed features, including Occasion Translator and One Item, Three Ways
- MCP tooling (deferred; continue with FastAPI)

## 3. First complete demonstration

1. Create an account.
2. Save a style profile.
3. Add a small wardrobe manually.
4. Mark which items are available.
5. Request a dinner outfit with a 20-minute time limit.
6. Retrieve the profile, available wardrobe, and confirmed preferences.
7. Call NVIDIA Nemotron through Nebius Token Factory.
8. Validate the recommended item IDs and constraints.
9. Display the outfit and explanation.
10. Request a replacement for uncomfortable shoes.
11. Replace only the shoes and preserve the other pieces.
12. Save feedback and review a proposed preference:
    “Prefer flats for events involving standing.”
13. Approve, edit, or dismiss the preference.
14. Make another request and demonstrate that approved preferences are used.

A successful demo must show real persistence and a real model call.

## 4. Proposed architecture

| Layer         | Choice                                     | Responsibility                                                          |
| ------------- | ------------------------------------------ | ----------------------------------------------------------------------- |
| Interface     | Next.js (App Router), TypeScript, Tailwind | Navigation, forms, wardrobe, outfit display, rescue, and memory controls |
| Backend       | FastAPI (MCP deferred)                     | Authenticated endpoints and reusable styling workflows                  |
| Validation    | Pydantic and deterministic checks          | Validate inputs, outputs, ownership, availability, and locked items     |
| Local storage | SQLite via SQLAlchemy                      | Persist user records                                                    |
| Model         | NVIDIA Nemotron                            | Propose structured outfits, revisions, and explanations                 |
| Inference     | Nebius Token Factory                       | Serve the selected model                                                |

The Next.js frontend communicates with FastAPI. The backend owns database access and model credentials. Do not expose Nebius keys or other secrets to the browser.

Frontend auth status: register/sign-in work through Next.js route handlers that store the bearer token in an HttpOnly cookie. Logout clears the browser cookie and does not revoke tokens on the backend. Style Profile and Wardrobe UIs are connected to their FastAPI endpoints. Smart Shopping remains excluded.

Choose the exact Nemotron model identifier during integration based on verified availability and a working test call.

Use ordinary Python workflow functions initially. Add an agent framework only if a concrete requirement justifies it.

Before shared deployment, select durable storage and verify that restarts or redeployments do not erase user records.

## 5. Minimum data model

| Record               | Minimum information                                                                         |
| -------------------- | ------------------------------------------------------------------------------------------- |
| User                 | ID and securely hashed authentication information                                           |
| Style profile        | Owner ID, styles, colors, fit, comfort preferences, and exclusions                          |
| Wardrobe item        | Stable ID, owner ID, name, category, color, notes, and availability                         |
| Outfit               | ID, owner ID, request context, selected item IDs, explanation, and timestamp                |
| Outfit revision      | Owner ID, original outfit ID, locked item IDs, replacement item IDs, and reason             |
| Feedback             | Owner ID, outfit ID, rating, explicit comments, and timestamp                               |
| Preference proposal  | Owner ID, source feedback, exact proposed preference, and pending/approved/dismissed status |
| Confirmed preference | Owner ID, approved preference, and timestamp                                                |

Store passwords as secure hashes, never plaintext.

Store feedback separately from lasting preferences.

Historical outfit descriptions may remain visible when an item is deleted, but deleted items must not remain active recommendation candidates.

Define deletion behavior for related records explicitly.

## 6. Reusable styling workflows

### Emergency Fit

1. Validate the request.
2. Load the authenticated user's profile.
3. Retrieve relevant confirmed preferences.
4. Load available wardrobe items.
5. Check whether enough information and suitable clothing are available.
6. Ask Nemotron for a structured recommendation.
7. Validate ownership, availability, and constraints.
8. Save and display the valid outfit.

If the wardrobe is insufficient, explain the limitation or ask a follow-up question.

### Rescue My Outfit

1. Load the authenticated user's outfit.
2. Identify one piece to replace.
3. Lock the remaining item IDs.
4. Recheck ownership and availability.
5. Retrieve suitable available replacements.
6. Ask Nemotron for a structured revision.
7. Validate the replacement.
8. Verify that locked item IDs remain unchanged.
9. Save and display the revision.

If no replacement works, explain why.

If a locked piece is now unavailable, ask before changing it. Never silently broaden the revision.

### Confirmed memory

1. Save explicit outfit feedback.
2. Optionally propose a lasting preference.
3. Show the exact proposed preference.
4. Let the user approve, edit, or dismiss it.
5. Save only approved preferences as lasting memory.
6. Retrieve relevant confirmed preferences for later requests.

Users must be able to inspect, edit, and delete confirmed preferences.

Unconfirmed or dismissed proposals must not become lasting instructions. Do not silently recreate deleted preferences from historical feedback.

## 7. Recommendation rules

- Recommend only confirmed, owned, available clothing and accessories.
- Model output cannot establish ownership or availability.
- Reject unknown IDs and items belonging to another user.
- Recheck item availability when generating or revising an outfit.
- Preserve locked pieces during Rescue My Outfit.
- Ask before changing additional pieces.
- Enforce explicit exclusions using structured fields where possible.
- Ask for clarification when constraints conflict.
- Never invent missing wardrobe items.
- Keep optional hair and makeup tips separate from owned items.
- Never turn feedback into lasting memory without confirmation.
- Do not claim current weather or trends without a verified source.
- For weather guidance, send weather conditions to the model — never precise coordinates.
- Report model failures clearly instead of fabricating success.

## 8. Privacy requirements

- Keep model credentials and authentication secrets server-side.
- Exclude `.env`, personal databases, and secrets from Git.
- Derive ownership from the authenticated session.
- Explain external inference before sending personal context to Nebius.
- Send only the context needed for the request.
- Avoid logging raw personal records or credentials.
- Provide export and deletion of all saved personal record types.
- Let users inspect, edit, and delete confirmed preferences.
- Document limitations involving backups and provider retention.
- Use synthetic data for the public demonstration.
- Do not infer sensitive personal traits from clothing choices.
- Location is request-only: do not persist precise coordinates by default; do not include them in logs, analytics, saved events, or model prompts. Obtain a fresh location only after the user clicks **Use my location**. Coordinates may be sent to the weather provider for that lookup; browser/OS controls permission duration and wording.

Vastra uses external inference and is not entirely on-device.

## 9. Milestones and acceptance checks

### Milestone 1 — Foundation

Target: October 6–7

Tasks:

- Finalize README.md and PLAN.md.
- Create an isolated Python environment.
- Create a minimal FastAPI application.
- Add GET / and GET /health.
- Configure .gitignore.
- Document verified startup commands.

Done when:

- The backend starts successfully.
- Both endpoints return their expected responses.
- Secrets and generated files are excluded from Git.

### Milestone 2 — Profile, wardrobe, and availability

Target: October 8–11

Tasks:

- Add database models and persistence.
- Add authentication before exposing personal-data endpoints.
- Implement profile save, edit, and delete.
- Implement wardrobe create, list, edit, and delete.
- Add available, in laundry, and packed away statuses.
- Build the Next.js frontend shell (navigation and placeholder pages).
- Connect the frontend to auth, profile, and wardrobe APIs.

Done when:

- Users can manage their profile and wardrobe through the UI.
- Availability can be edited.
- Data survives an application restart.
- Unauthenticated requests are rejected.
- Users cannot read or modify another user's records.

### Milestone 3 — Emergency Fit and Rescue My Outfit

Target: October 12–16

Tasks:

- Verify an available Nemotron model on Nebius Token Factory.
- Add configurable server-side inference.
- Define structured request and response schemas.
- Build the occasion and time-limit form.
- Implement Emergency Fit.
- Validate ownership and availability.
- Add one-piece rescue with locked item IDs.
- Save outfit revision history.
- Handle insufficient wardrobes, timeouts, and invalid output.

Done when:

- A real model call produces an outfit from available owned items.
- Invalid, unavailable, or cross-user IDs are rejected.
- Rescue changes only the selected piece.
- Locked pieces remain unchanged.
- Missing replacements and unavailable locked items produce useful responses.
- The UI explains the outfit and revision.

### Milestone 4 — Confirmed memory and data controls

Target: October 17–20

Tasks:

- Save outfit feedback separately from preferences.
- Add preference proposals with approve, edit, and dismiss controls.
- Retrieve confirmed preferences for subsequent requests.
- Support preference inspection, editing, and deletion.
- Add complete JSON export.
- Add deletion controls.
- Prevent deleted wardrobe items from being reused.

Done when:

- Unconfirmed and dismissed proposals do not become lasting instructions.
- Approved preferences are retrieved for later requests.
- Edited or deleted preferences affect subsequent requests.
- A controlled example demonstrates preference-aware behavior.
- Export includes all stored personal record types.
- Deletion removes relevant records from active storage.

### Milestone 5 — Deployment

Target: October 21–24

Tasks:

- Choose hosting and durable storage.
- Configure secrets securely.
- Verify authentication and user isolation in deployment.
- Add synthetic demonstration data.
- Test the complete workflow on the deployed application.

Done when:

- The demo URL works.
- Data survives deployment restarts.
- The UI and backend communicate successfully.
- Model credentials are not exposed to the browser.
- The full demonstration works outside local development.

### Milestone 6 — Submission

Target: October 25–29

Tasks:

- Fix remaining workflow failures.
- Verify setup from a fresh environment.
- Update feature statuses honestly.
- Record a public demonstration video under three minutes.
- Prepare the project description and testing instructions.
- Document actual NVIDIA and Nebius integration.
- Verify the public repository and existing license.
- Complete and review the submission.
- Recheck official rules and organizer updates.

Done when:

- A new user can follow the README.
- Demonstrated features work.
- Submission links are accessible.
- No secrets or personal data are included.
- The submission is ready before the deadline.

## 10. Meaningful verification

Test these behaviors as their features are implemented:

- Profiles, wardrobe items, feedback, and preferences survive restart.
- User isolation holds for all reads and writes.
- Outfit revisions and preference confirmations are owner-scoped.
- Recommendations contain only valid, owned, available items.
- Deleted items cannot appear in new recommendations.
- Rescue preserves locked item IDs.
- Missing replacements produce clear responses.
- Explicit exclusions are respected.
- Empty or insufficient wardrobes are handled.
- Unconfirmed and dismissed proposals are not lasting instructions.
- Approved preferences are retrieved.
- Preference edits and deletions affect later requests.
- Export and deletion cover all stored personal record types.
- Missing configuration, timeouts, and malformed model output are handled.
- Deployed storage survives restarts.

Use mocked inference for routine tests. Run paid model calls deliberately to verify actual integration.

Including a preference in a prompt does not guarantee model compliance. Enforce structured hard constraints in the backend where possible.

## 11. Hackathon alignment

| Personal AI element | Vastra implementation                                                    |
| ------------------- | ------------------------------------------------------------------------ |
| Persistent memory   | Profile, wardrobe, outfit history, and confirmed preferences             |
| Reusable skills     | Emergency Fit, Rescue My Outfit, and preference confirmation             |
| Tools               | Retrieve records, validate items, save revisions, and manage preferences |
| Personal task       | Dress for an occasion and adapt an outfit to practical constraints       |
| User control        | Edit, export, delete, and approve lasting preferences                    |
| NVIDIA and Nebius   | Real Nemotron inference through Nebius Token Factory                     |

This describes planned implementation, not proof that every track expectation has been met.

Review the finished product against the official rules. Do not claim background or always-on behavior that has not been implemented.

Prepare:

- Working demo or test-build URL
- Public repository with an open-source license
- Verified setup and run instructions
- English project description
- Public YouTube demonstration under three minutes
- Documentation of actual NVIDIA and Nebius usage
- Requested platform feedback

Keep judge access available through the organizer's testing period.

Official rules:
https://nebiusglobalaihackathon.devpost.com/rules

## 12. Working method

Use Cursor for one milestone at a time:

1. Inspect existing files.
2. Implement the smallest useful change.
3. Run it locally.
4. Review actual output and errors.
5. Debug together.
6. Verify the milestone.
7. Commit the working change.
8. Update documentation.

Do not generate the entire application in one prompt.

If behind schedule:

- Simplify the interface.
- Defer Trend Stylist.
- Keep Rescue My Outfit limited to one selected piece.
- Keep confirmed memory focused on explicit preferences.
- Avoid adding unrelated features or unnecessary orchestration.

## Next action

Wardrobe UI and the Style Dictionary page are in place. The dictionary catalog is still empty. Next: Nebius / Nemotron integration and Emergency Fit.

Pending for the dictionary: the manual-entry UI, AI term suggestions (drafts until reviewed; never mark them verified or currently trending without supporting sources), and live trend retrieval.

Do not implement weather lookups, saved events, shopping, or MCP yet.
