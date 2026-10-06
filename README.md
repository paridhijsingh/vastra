# Vastra (वस्त्र)

**Ready, set, styled.**

Your personal AI stylist for the clothes you already own.

Vastra (Sanskrit for clothing) helps you choose outfits for everyday occasions, celebrations, and festivities based on your preferences and saved wardrobe. It remembers your explicit feedback to personalize future suggestions.

Built for the **NVIDIA × Nebius Global AI Hackathon — Personal AI track**.

## Project status

The features below are planned and will be marked as working only after implementation and verification.

A working demo is not yet available.

## Planned features

| Feature                                | What it does                                                                                                         | Status  |
| -------------------------------------- | -------------------------------------------------------------------------------------------------------------------- | ------- |
| **Style profile**                      | Save preferred styles such as Indian, Western, or fusion; colors; fit and comfort preferences; and clothing to avoid | Planned |
| **My wardrobe**                        | Manually add, view, edit, and delete clothing and accessories                                                        | Planned |
| **Emergency Fit**                      | Recommend an outfit for an occasion and time limit using only confirmed wardrobe items                               | Planned |
| **Styling explanations**               | Explain outfit choices and provide optional accessory, hair, or makeup tips                                          | Planned |
| **Feedback memory**                    | Save outfit ratings and explicit likes or dislikes to inform later recommendations                                   | Planned |
| **Authentication and private storage** | Keep saved records scoped to their owner                                                                             | Planned |
| **Data controls**                      | Export and delete saved profile, wardrobe, outfit history, and feedback                                              | Planned |

Styling preferences will support men, women, and unisex options.

**Trend Stylist** is a stretch feature, considered only after the core workflow is reliable.

## Example workflow

> “I have dinner in 20 minutes and no shopping budget. What can I wear?”

1. Create an account and save your style preferences.
2. Add clothing and accessories to your wardrobe.
3. Enter the occasion, time available, and any relevant constraints.
4. Vastra retrieves your profile, wardrobe, and saved feedback.
5. Nemotron proposes an outfit.
6. The backend validates recommended wardrobe items before displaying the result.
7. Rate the outfit or explain what you would change.
8. Vastra uses that saved feedback in future requests.

If your wardrobe lacks suitable pieces, Vastra will ask a follow-up question or explain the limitation.

## Recommendation rules

- Recommend only clothing and accessories the user confirms they own.
- Validate item ownership using saved wardrobe IDs.
- Respect explicit clothing exclusions and preferences.
- Ask for clarification when constraints conflict.
- Never present missing items as owned.
- Keep optional hair and makeup suggestions separate from wardrobe items.
- Show useful errors when inference fails rather than fabricating a recommendation.

## Outside the MVP

- Smart Shopping, retailer links, and product prices
- Local thrift inventory
- Automatic purchases
- Photo-based wardrobe recognition
- Virtual try-on
- Native iOS application

The MVP focuses on making useful outfit decisions from an existing wardrobe.

## Proposed technology

| Component          | Technology                                  |
| ------------------ | ------------------------------------------- |
| Interface          | Streamlit                                   |
| Backend            | Python and FastAPI                          |
| Storage            | SQLite via SQLAlchemy for local development |
| Validation         | Pydantic and deterministic backend checks   |
| Authentication     | Planned authenticated, owner-scoped access  |
| AI model           | NVIDIA Nemotron                             |
| Inference provider | Nebius Token Factory                        |

**Model choice:** Use Nemotron through Nebius Token Factory, not Gemini, for outfit recommendations.

The exact model identifier and API configuration will be verified during integration.

## Personal memory and reusable skills

Vastra will store an editable style profile, wardrobe, outfit history, and explicit feedback.

Its reusable styling workflow will:

1. Retrieve relevant personal context.
2. Select suitable wardrobe candidates.
3. Request a structured outfit recommendation.
4. Validate ownership and constraints.
5. Explain the result.
6. Save user feedback when provided.

The model will propose outfits; the backend will enforce ownership and data-access rules.

## Privacy and data controls

These are planned requirements, not claims of completed protection:

- Keep API keys and authentication secrets server-side.
- Exclude secrets and personal database files from Git.
- Restrict saved records to their owner.
- Explain what data is sent to Nebius before the first AI request.
- Send only context needed for the recommendation.
- Provide export and deletion of saved personal records.
- Document backup and provider-retention limitations.
- Use synthetic personal data in the public demo.

Vastra uses external model inference and is not an entirely on-device assistant.

## Development plan

See [PLAN.md](PLAN.md) for milestones and acceptance checks.

Build order:

1. Minimal backend and verified local environment
2. Style profile and wardrobe persistence
3. Basic interface
4. Nebius integration and Emergency Fit
5. Feedback memory and data controls
6. Authentication verification, deployment, and submission preparation

Each milestone will be implemented, tested, and debugged before moving ahead.

## Local setup

Setup instructions will be added once the application foundation is implemented and verified.

Planned configuration includes:

- `NEBIUS_API_KEY`
- `NEBIUS_BASE_URL`
- `NEMOTRON_MODEL`
- `DATABASE_URL`
- Authentication configuration

Never commit `.env`, API keys, authentication secrets, or personal database files.

## Verification goals

- Saved data survives application restarts.
- Users cannot access another user's records.
- Recommendations contain only valid, owned wardrobe items.
- Deleted items are excluded from new recommendations.
- Explicit feedback is retrieved for later requests.
- Insufficient wardrobe information produces a clear response.
- Model errors and malformed responses are handled.
- Export and deletion cover all stored personal record types.

## Demo

Coming soon.

The planned demo will show a saved wardrobe, an Emergency Fit request, a validated outfit recommendation, and feedback influencing a later suggestion.

## Hackathon submission

Planned submission materials:

- Working demo or test-build URL
- Public source repository with an open-source license
- README with verified setup and run instructions
- Project description explaining the Personal AI workflow
- Public demonstration video under three minutes
- Documentation of NVIDIA Nemotron and Nebius usage

[Official hackathon rules](https://nebiusglobalaihackathon.devpost.com/rules)

## License

See [LICENSE](LICENSE).
