# Rookie Vault

A zero-build static PWA for cataloging a shared sports card collection and tracking what it's worth. Backed by a free Supabase database, so you and your son see the same collection from any device.

- **Collection** — snap the front (and optionally back) of a card, crop/straighten it, then log the details: player, team, sport, year, brand/set, card number, parallel/insert, rookie flag, and either a raw condition or a professional grade (PSA/BGS/SGC + number). Everything's stored in a shared Supabase database and Storage bucket — both of you see the same collection, same photos, same values, live.
- **AI identification** — tap "Identify with AI" on a card you've just photographed, and it'll try to fill in player, year, set, card number, parallel, and even grading-slab info automatically, using [CardSight AI](https://cardsight.ai)'s visual card recognition (baseball, football, basketball, hockey — soccer isn't covered yet). When it gets an exact match, it also pulls a value estimate from recent completed sales. This is opt-in and needs a (free) API key — see setup below.
- **Value tracking** — enter what you paid and what you think it's worth now (or let AI identification suggest a starting number). Every time the estimated value changes, it's logged, so the card's detail view shows a small trend line over time. There's also a one-tap button that opens a pre-filled **eBay sold-listings search** for a manual cross-check.
- **Stats** — total cards, total collection value, total invested, overall gain/loss, a "most valuable" leaderboard, and a breakdown by sport.

This version needs an internet connection to work — the collection lives in the cloud now, not on the device.

## Set up the shared database (do this first)

1. **Create a Supabase project.** Go to [supabase.com](https://supabase.com), sign up free, create a new project. Pick any name/region; the free tier is far more than this needs.
2. **Run the schema.** In your project, go to the SQL Editor → New query → paste in everything from `schema.sql` (included in this folder) → Run. This creates the `cards` table, locks it down with Row Level Security, and sets up the `card-photos` storage bucket.
3. **Create the one shared login.** Go to Authentication → Users → Add user. Use any email (it doesn't need to be real, e.g. `family@example.com`) and a password you choose. This is the account the app signs into behind the scenes after a correct PIN — you and your son never see this login screen, just the PIN.
4. **Grab your API details.** Go to Project Settings → API. Copy the "Project URL" and the "anon public" key (not the "service_role" key — that one should never go in client-side code).
5. **Fill in `config.js`.** Open `config.js` in this folder and fill in:
   - `supabaseUrl` — the Project URL from step 4
   - `supabaseAnonKey` — the anon public key from step 4
   - `sharedEmail` / `sharedPassword` — exactly what you created in step 3
   - `appPin` — whatever PIN you and your son want to type in (this can be anything, it's just a convenience gate — the real protection is the Supabase login behind it)

## Set up AI identification (optional but recommended)

1. Go to [cardsight.ai](https://cardsight.ai) and sign up for a free API key — no credit card required, 750 lookups/month.
2. In the app, tap the gear icon (top right) → paste the key → **Save key**.
3. When adding a new card, tap **Identify with AI** after the front photo is captured. Always double-check what it fills in before saving — it's a great head start, not a guarantee.

## Deploy to GitHub Pages

1. Create a new repo (e.g. `rookie-vault`) and push all these files to the root — **including your filled-in `config.js`**. (If you'd rather not commit real credentials to a public repo, make the repo private, or keep `config.js` out of git and upload it separately — either works fine for GitHub Pages.)
2. **Settings → Pages → Source** → select the branch/folder and save.
3. Visit `https://<your-username>.github.io/rookie-vault/` — HTTPS is required for camera access and the service worker.
4. Enter the PIN you set in `config.js` to unlock it.
5. On your phone, "Add to Home Screen" (or tap the in-app **Install** button) to install it like a native app. Do this on your son's phone too, pointing at the same URL — same PIN, same collection.

## Notes

- Camera access requires HTTPS (or `localhost`) — it won't work over plain `http://`.
- The PIN is a convenience layer, not real security — it unlocks a shared login, so treat it (and the shared password) like a house key: fine for keeping casual visitors out, not for anything truly sensitive.
- The crop tool is a simple rectangular crop (drag the corner handles) — fast, no dependencies.
- Supabase's free tier: 500MB database, 1GB file storage, 50k monthly active users. A two-person card collection won't come close to any of those limits.
- Want to make it feel more like his own app? The name, colors (`style.css` — look for the `:root` tokens up top), and icon (`icons/icon.svg`) are all easy to swap.
