# Vastra — Devpost submission

NVIDIA × Nebius Global AI Hackathon.

## Title

Vastra (वस्त्र) — Outfits from the clothes you already own

## Track

Best Apps and Agents

## Description (~150 words)

Vastra (वस्त्र, Sanskrit for clothing) is a personal AI stylist for clothes you already own. Save a style profile and wardrobe, mark what is available today, and get a wearable Indian, Western, or fusion outfit for an occasion—without shopping. Emergency Fit and Rescue My Outfit use NVIDIA Nemotron Nano on Nebius Token Factory for a fast dinner look or a one-piece swap. Stylist chat uses Nemotron Super so you can type in your own words. Trend Stylist (Trend Lite) uses Tavily plus Nemotron Ultra to turn live fashion coverage into one sourced idea; prices are never invented. Vastra only styles owned, available items and never invents a garment. A look is saved only when you choose Save a look. Judges skip the intro, tap Try the demo, and generate an outfit in three clicks. Style Dictionary explains garment names as you go. Smart Shopping is excluded.

## Testing instructions

Judges do not register and do not type a wardrobe. Demo login is the **Try the demo** button (the password is not shown in the browser).

1. Open https://vastra-one-beryl.vercel.app (first API request after idle can take about a minute).
2. Click **Skip intro**.
3. Click **Try the demo**.
4. Click **Generate outfit**. Occasion is already “dinner with friends”.

Expected: a dinner outfit made only from synthetic `Demo — …` clothes marked available.

Optional: Rescue the shoes; open `/stylist` and type an occasion; open `/trends` for Trend Lite.

Local operators set `DEMO_EMAIL` / `DEMO_PASSWORD` on the API host and run `python scripts/seed_demo.py`. Never commit those values. See README [Try the demo](README.md#try-the-demo).

## Video

Public YouTube, under 3:00:

`https://www.youtube.com/watch?v=VIDEO_ID`

Replace `VIDEO_ID` before submitting.

## Links

- App: https://vastra-one-beryl.vercel.app
- API health: https://vastra-api-c5gx.onrender.com/health
- Repo: https://github.com/paridhijsingh/vastra
- License: [LICENSE](LICENSE) (MIT)
- README: [README.md](README.md)
- Token Factory / Nemotron feedback: [README.md#feedback-on-token-factory--nemotron](README.md#feedback-on-token-factory--nemotron)

## Checklist

- [x] Public repo + MIT license visible on GitHub (`https://github.com/paridhijsingh/vastra`, MIT on `main`)
- [x] README setup verified from a fresh clone (`/tmp/vastra-fresh`, 29 Oct 2026)
- [x] Demo URL live (app 200; API `GET /health` → `{"status":"ok"}`)
- [ ] Video public on YouTube under 3:00
- [x] Feedback section filled in (README “Feedback on Token Factory / Nemotron”)
- [x] No live secrets in the current tree — see sanity check below

### Secret sanity check

Command:

```bash
git log --all -p | grep -i "NEBIUS_API_KEY\|SECRET_KEY"
```

Result (29 Oct 2026, this workspace):

- `.env` and `frontend/.env.local` are gitignored and untracked. Current `.env.example` has empty `SECRET_KEY=` and placeholder `NEBIUS_API_KEY=your-key-here`.
- The grep matches **variable names** in docs, tests, Render comments, and placeholders (`your-key-here`, `test-only-not-a-real-nebius-key`, `test-only-secret-key-not-for-production-use`). No live `NEBIUS_API_KEY` value appears in history.
- One **former** `.env.example` commit had a filled JWT `SECRET_KEY=` (later blanked). That value is not in HEAD. If that JWT secret was ever used on a deployed API, rotate `SECRET_KEY` on the host (existing sessions will drop). Do not paste real keys into git, chat, or this file.
