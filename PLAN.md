# Vastra (वस्त्र) — Build Plan

**Ready, set, styled.**

Updated: October 6, 2026  
Status: rebuilding from scratch; implementation not yet verified  
Hackathon: NVIDIA × Nebius Global AI Hackathon — Personal AI track  
Submission deadline: October 30, 2026, at 10 AM PDT  
Target submission readiness: October 29, 2026

## 1. Product goal

Build a personal AI stylist that remembers a user's preferences and wardrobe, recommends outfits from clothes they already own, and uses explicit feedback to personalize future suggestions.

Primary scenario:

> “I have dinner in 20 minutes and no shopping budget. What can I wear?”

The first release should complete this workflow reliably before adding more features.

## 2. Agreed scope

| Feature         | Planned behavior                                                                    |
| --------------- | ----------------------------------------------------------------------------------- |
| Style profile   | Save preferred styles, colors, fit, comfort preferences, and clothing to avoid      |
| Wardrobe        | Manually add, view, edit, and delete clothing and accessories                       |
| Emergency Fit   | Recommend an outfit based on occasion, time available, preferences, and owned items |
| Explanations    | Explain outfit choices and offer optional accessory, hair, or makeup tips           |
| Feedback memory | Save ratings and explicit likes/dislikes; retrieve them for later requests          |
| Authentication  | Protect saved records and restrict access to their owner                            |
| Data controls   | Export and delete saved personal records                                            |

Support Indian, Western, and fusion styles, with men, women, and unisex styling preferences.

### Stretch feature

Trend Stylist may be considered only after the MVP is reliable and deployed. It must use retrieved sources before making claims about current trends.

### Excluded

- Smart Shopping
- Store links, product prices, and thrift inventory
- Automatic purchases
- Photo-based wardrobe recognition
- Virtual try-on
- Native iOS application

## 3. First complete demonstration

1. Create an account.
2. Save a style profile.
3. Add a small wardrobe manually.
4. Request an outfit for an occasion and time limit.
5. Retrieve the saved profile, wardrobe, and relevant feedback.
6. Call NVIDIA Nemotron through Nebius Token Factory.
7. Validate the recommended wardrobe IDs and constraints.
8. Display the outfit and explanation.
9. Save explicit feedback.
10. Make another request and demonstrate that the feedback is used.

A successful demo must show real persistence and a real model call.

## 4. Proposed architecture

| Layer         | Choice                            | Responsibility                                       |
| ------------- | --------------------------------- | ---------------------------------------------------- |
| Interface     | Streamlit                         | Forms, wardrobe management, outfit display, feedback |
| Backend       | FastAPI                           | Authenticated endpoints and styling workflow         |
| Validation    | Pydantic and deterministic checks | Validate inputs, outputs, ownership, and constraints |
| Local storage | SQLite via SQLAlchemy             | Persist user records                                 |
| Model         | NVIDIA Nemotron                   | Propose structured outfits and explanations          |
| Inference     | Nebius Token Factory              | Serve the selected model                             |

Streamlit communicates with FastAPI. The backend owns database access and model credentials.

Choose the exact Nemotron model identifier during integration based on verified availability and a working test call.

Before shared deployment, select durable storage and verify that restarts or redeployments do not erase user records.

## 5. Minimum data model

| Record        | Minimum information                                                       |
| ------------- | ------------------------------------------------------------------------- |
| User          | ID and authentication information                                         |
| Style profile | Owner ID, style preferences, colors, fit, comfort preferences, exclusions |
| Wardrobe item | Stable ID, owner ID, name, category, color, optional notes                |
| Outfit        | ID, owner ID, request context, selected item IDs, explanation, timestamp  |
| Feedback      | Owner ID, outfit ID, rating, optional explicit comments, timestamp        |

Store passwords as secure hashes, never plaintext.

Use explicit, inspectable preferences. Do not silently infer sensitive personal traits from clothing choices.

## 6. Styling workflow

Implement one reusable workflow:

1. Validate the request.
2. Load the authenticated user's profile.
3. Load their wardrobe.
4. Retrieve relevant saved feedback.
5. Check whether enough wardrobe information is available.
6. Ask Nemotron for a structured recommendation.
7. Validate the result.
8. Display and save the valid outfit.
9. Save feedback only when the user provides it.

Useful backend operations:

- Load style profile
- List owned wardrobe items
- Retrieve feedback
- Validate outfit item IDs
- Save outfit
- Save feedback

Start with ordinary Python functions. Add an agent framework only if a concrete requirement justifies it.

## 7. Recommendation rules

- Clothing and accessory recommendations must reference confirmed, owned items.
- Model output cannot establish ownership.
- Reject unknown IDs and items belonging to another user.
- Enforce explicit exclusions using structured fields where possible.
- Ask for clarification when constraints conflict.
- If the wardrobe is insufficient, explain what is missing without inventing items.
- Hair and makeup tips are optional and separate from owned wardrobe items.
- Do not claim current weather or trends without a verified source.
- Clearly report model failures instead of presenting fabricated success.

## 8. Privacy requirements

- Keep model credentials and authentication secrets server-side.
- Exclude `.env`, personal databases, and secrets from Git.
- Derive ownership from the authenticated session, not a submitted owner ID.
- Explain external inference before sending personal context to Nebius.
- Send only the context needed for the recommendation.
- Avoid logging raw personal records or credentials.
- Provide export and deletion of profile, wardrobe, outfit history, and feedback.
- Document limitations involving backups and provider retention.
- Use synthetic data for the public demonstration.

External inference means Vastra is not entirely on-device. Do not claim otherwise.

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

### Milestone 2 — Profile and wardrobe

Target: October 8–11

Tasks:

- Add database models and persistence.
- Add basic authentication before exposing personal-data endpoints.
- Implement profile save, edit, and delete.
- Implement wardrobe create, list, edit, and delete.
- Build Streamlit forms and empty states.

Done when:

- A user can manage their profile and wardrobe through the UI.
- Data survives an application restart.
- Unauthenticated requests are rejected.
- One user cannot read or modify another user's records.

### Milestone 3 — Emergency Fit

Target: October 12–16

Tasks:

- Verify an available Nemotron model on Nebius Token Factory.
- Add configurable server-side inference.
- Define structured request and response schemas.
- Build the occasion and time-limit form.
- Implement the styling workflow.
- Validate owned item IDs before displaying recommendations.
- Handle insufficient wardrobes, timeouts, and invalid output.

Done when:

- A real model call produces an outfit from saved items.
- Invalid or cross-user item IDs are rejected.
- Missing information produces a useful response.
- The UI explains the recommendation.

### Milestone 4 — Memory and data controls

Target: October 17–20

Tasks:

- Save outfit history and explicit feedback.
- Retrieve relevant feedback for subsequent requests.
- Add JSON export.
- Add deletion controls.
- Prevent stale or deleted wardrobe items from being reused.

Done when:

- Saved feedback is included in a later recommendation request.
- A controlled example demonstrates preference-aware behavior.
- Export includes all stored personal record types.
- Deletion removes the relevant records from active storage.

### Milestone 5 — Deployment

Target: October 21–24

Tasks:

- Choose hosting and durable storage.
- Configure secrets securely.
- Verify authentication and user isolation in deployment.
- Add a synthetic demonstration account or dataset.
- Test the complete workflow on the deployed application.

Done when:

- The demo URL works.
- Data survives deployment restarts.
- The UI and backend communicate successfully.
- Model credentials are not exposed to the browser.
- The full demonstration works outside the development environment.

### Milestone 6 — Submission

Target: October 25–29

Tasks:

- Fix remaining workflow failures.
- Verify setup from a fresh environment.
- Update feature statuses honestly.
- Record a demonstration video under three minutes.
- Prepare the project description and testing instructions.
- Document actual NVIDIA and Nebius integration.
- Verify the public repository and existing license.
- Complete and review the submission.

Done when:

- A new user can follow the README.
- The demonstrated features work.
- Submission links are accessible.
- No secrets or personal data are included.

## 10. Meaningful verification

Test the following behaviors as their features are implemented:

- Profile, wardrobe, and feedback survive restart.
- User isolation holds for reads and writes.
- Recommendations use only valid, owned items.
- Deleted items cannot appear in newly generated outfits.
- Explicit exclusions are respected.
- Empty or insufficient wardrobes are handled.
- Feedback is retrieved for later requests.
- Missing configuration, timeouts, and malformed model output are handled.
- Export and deletion cover all personal record types.
- Deployed storage survives restarts.

Use mocked inference for routine tests. Run paid model calls deliberately to verify real integration.

## 11. Hackathon alignment

| Personal AI element | Vastra implementation                                                   |
| ------------------- | ----------------------------------------------------------------------- |
| Persistent memory   | Saved profile, wardrobe, outfit history, and feedback                   |
| Reusable skills     | Repeatable Emergency Fit workflow                                       |
| Tools               | Profile retrieval, wardrobe retrieval, validation, and feedback storage |
| Personal task       | Help the user dress for an occasion using owned clothes                 |
| User control        | Editable records, export, deletion, and explained inference boundaries  |
| NVIDIA and Nebius   | Real Nemotron inference through Nebius Token Factory                    |

This describes the planned implementation, not proof that every track expectation has been met. Review the
