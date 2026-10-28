# Devpost draft — Vastra (वस्त्र)

English project description and testing instructions for the NVIDIA × Nebius Global AI Hackathon.

## Project description

Vastra is a personal AI stylist for the clothes you already own. You save a style profile and a private wardrobe, then ask for an outfit. Emergency Fit recommends one look from items marked available. Rescue My Outfit replaces a single piece and keeps the rest. Stylist chat answers from the saved profile and wardrobe. Suggestions are saved only when you choose Save a look.

The app uses NVIDIA Nemotron models through Nebius Token Factory. The Next.js UI never receives the Nebius key. Wardrobe, profile, looks, events, and dictionary entries are scoped to the signed-in owner.

Built for the Best Apps and Agents track.

Live app: https://vastra-one-beryl.vercel.app  
Live API: https://vastra-api-c5gx.onrender.com

## Testing instructions

Judges do not need to register or type a wardrobe.

1. Open https://vastra-one-beryl.vercel.app
2. Click **Skip intro** if the wardrobe doors are on screen.
3. Click **Try the demo**.
4. On Emergency Fit, click **Generate outfit** (occasion is already “dinner with friends”).

Expected: a dinner outfit made only from synthetic `Demo — …` clothes marked available. The first request after idle can take about a minute while the API wakes up.

Optional:

- Filter the wardrobe to **In laundry** to see two synthetic items that Emergency Fit must not use.
- Rescue: replace the shoes; other pieces stay.
- Stylist: ask for a wedding-guest outfit.

Demo credentials (for local seeding and host env only — never commit the password):

- Username / `DEMO_EMAIL`: `demo@vastra.example`
- Password: the `DEMO_PASSWORD` you set in the backend environment
- Seed: `python scripts/seed_demo.py`

One-click **Try the demo** signs in through the API using those host env vars. The password is not sent from the browser and is not shown on the page. A demo user cannot see or edit another user's records.

Empty personal wardrobes can click **Load demo wardrobe** to copy the same synthetic catalog into that signed-in account only.
