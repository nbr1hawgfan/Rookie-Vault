# Rookie Vault

A zero-build static PWA for cataloging a sports card collection and tracking what it's worth.

- **Collection** — snap the front (and optionally back) of a card, crop/straighten it, then log the details: player, team, sport, year, brand/set, card number, parallel/insert, rookie flag, and either a raw condition or a professional grade (PSA/BGS/SGC + number). Everything's stored locally on the device (IndexedDB) — no account, no cloud, no data leaving the phone.
- **Value tracking** — enter what you paid and what you think it's worth now. Every time the estimated value changes, it's logged, so the card's detail view can show a small trend line over time. There's also a one-tap button that opens a pre-filled **eBay sold-listings search** so you can check real recent sale prices — there's no free public pricing API for sports cards, so this is the honest way to get a real number instead of a made-up one.
- **Stats** — total cards, total collection value, total invested, overall gain/loss, a "most valuable" leaderboard, and a breakdown by sport.

Works fully offline once loaded (aside from the eBay price-check link, which opens in a new tab), installable to the home screen.

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
