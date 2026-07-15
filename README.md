# Rookie Vault

A zero-build static PWA for cataloging a sports card collection and tracking what it's worth.

- **Collection** — snap the front (and optionally back) of a card, crop/straighten it, then log the details: player, team, sport, year, brand/set, card number, parallel/insert, rookie flag, and either a raw condition or a professional grade (PSA/BGS/SGC + number). Everything's stored locally on the device (IndexedDB) — no account, no cloud, no data leaving the phone *except* the one AI feature below.
- **AI identification** — tap "Identify with AI" on a card you've just photographed, and it'll try to fill in player, year, set, card number, parallel, and even grading-slab info automatically, using [CardSight AI](https://cardsight.ai)'s visual card recognition (baseball, football, basketball, hockey — soccer isn't covered yet). When it gets an exact match, it also pulls a value estimate from recent completed sales. This is opt-in and needs a (free) API key — see setup below. **The one privacy tradeoff**: tapping this button sends that card's front photo to CardSight's service to be matched. Nothing else in the app ever leaves the device, and you can skip this entirely and enter cards by hand.
- **Value tracking** — enter what you paid and what you think it's worth now (or let AI identification suggest a starting number). Every time the estimated value changes, it's logged, so the card's detail view can show a small trend line over time. There's also a one-tap button that opens a pre-filled **eBay sold-listings search** for a manual cross-check.
- **Stats** — total cards, total collection value, total invested, overall gain/loss, a "most valuable" leaderboard, and a breakdown by sport.

Works fully offline once loaded (aside from AI identification and the eBay link, both of which need a connection), installable to the home screen.

## Set up AI identification (optional but recommended)

1. Go to [cardsight.ai](https://cardsight.ai) and sign up for a free API key — no credit card required, 750 lookups/month.
2. In the app, tap the gear icon (top right) → paste the key → **Save key**.
3. When adding a new card, tap **Identify with AI** after the front photo is captured. Always double-check what it fills in before saving — it's a great head start, not a guarantee.

## Deploy to GitHub Pages

1. Create a new repo (e.g. `rookie-vault`) and push all these files to the root.
2. **Settings → Pages → Source** → select the branch/folder and save.
3. Visit `https://<your-username>.github.io/rookie-vault/` — HTTPS is required for camera access and the service worker.
4. On your phone, "Add to Home Screen" (or tap the in-app **Install** button) to install it like a native app.

## Notes

- Camera access requires HTTPS (or `localhost`) — it won't work over plain `http://`.
- All card data and photos stay on-device.
- The crop tool is a simple rectangular crop (drag the corner handles) — fast, no dependencies.
- Want to make it feel more like his own app? The name, colors (`style.css` — look for the `:root` tokens up top), and icon (`icons/icon.svg`) are all easy to swap. Could be a fun one to hand off to him.
