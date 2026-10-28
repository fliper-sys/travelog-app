# TRADELOG

A Forex trading journal. Record trades, review your execution and understand
your performance. **Offline first:** everything you enter is saved on your
device immediately, every page works with no internet, and changes upload by
themselves when a connection is available.

Web app first (Next.js + Supabase). An Android client can use the same backend later.

```
supabase/schema.sql              trades table, row-level security, updated_at trigger
supabase/002_review_fields.sql   review fields, timeframe, R multiple, account settings
tradelog-web/                    Next.js (App Router, TypeScript) web app
tradelog-web/tests/              unit tests (npm test)
```

## What it does

- Sign in with email and password (Supabase Auth)
- Add, edit and delete trades, with R multiple calculated for you
- Review each closed trade: plan adherence, emotion, confidence, mistake, lesson
- Eight pages: Overview, Journal, Reviews, Analytics, Strategies, Psychology,
  Review Calendar, Settings
- Net P&L, win rate, profit factor, average R, equity curve, cumulative R,
  drawdown, weekday and strategy breakdowns, emotion results, insights
- Export every trade to CSV (works offline too)

## Setup (Windows, VS Code)

1. **Create the database tables.** In your Supabase project open the SQL Editor
   and run these two files, in this order, one time each:
   1. `supabase/schema.sql`
   2. `supabase/002_review_fields.sql`

   If a script errors, read the error before running it again. The second one
   is safe to run more than once.
2. **Add your keys.** In `tradelog-web`, copy `.env.example` to `.env.local`
   (beside `package.json`) and fill in the project URL and the publishable
   (anon) key. Never put the database password or a `service_role` key here.
3. **Run it** in the VS Code terminal:

   ```powershell
   cd tradelog-web
   npm install
   npm run dev
   ```

   Open http://localhost:3000. After changing `.env.local`, stop the server
   (Ctrl+C) and run `npm run dev` again.

If email confirmation is on in Supabase (Authentication settings), new accounts
must click the link in the confirmation email before signing in.

## Using it offline

**Before you rely on it offline,** open the app once while online and sign in.
That saves the app itself and downloads your trades to the device. Settings
shows **OFFLINE READY** once the app is saved.

The service worker that saves the app is switched off in `npm run dev` so it
never hides your edits. To try offline mode on your own machine, run the
production build instead:

```powershell
npm run build
npm start
```

Open http://localhost:3000, sign in, then turn off your internet (or use the
browser's DevTools, Network, Offline) and reload. Offline mode needs **HTTPS or
localhost**, so a deployed copy must be served over HTTPS.

### What happens

| You do | What the app does |
| --- | --- |
| Add, edit, review or delete a trade with no internet | Saves it on this device at once and marks it **Not synced** |
| Open the app with no internet | Opens from the saved copy with all your trades |
| Connection returns | Uploads waiting changes by itself, then pulls changes made on other devices |
| Connection is "on" but nothing loads | Shows **Waiting for connection**, keeps working, retries every 15 seconds |

The pill beside the page title always tells you where you stand: **Synced**,
**N changes waiting**, **Offline · saved on this device**, or **Sync problem**.

### Sync rules

- Each trade waits in an upload queue until the server confirms it. If you edit
  a trade several times offline, only the latest version is uploaded.
- A trade with changes still waiting is never overwritten by the server's copy.
- If two devices edit the same trade, the last one to upload wins.
- If the server refuses a trade (for example the database script was not run),
  that trade stays on your device with an explanation and the rest still sync.
- Your session can expire while you are offline. The app still opens with your
  data; uploads pause until you sign in again, and nothing is lost.
- Signing out removes your trades from that device (they stay on the server). The
  app warns you first if changes have not uploaded yet.

### Where the data lives

Trades are stored in the browser's IndexedDB, one database per account. The app
asks the browser not to clear it under storage pressure. In some private
windows the browser blocks this storage, and the app tells you when that happens.
Use a normal window to keep data offline.

## How the numbers are calculated

- Only **closed** trades with a **P&L** are counted. Open trades and closed
  trades with no P&L are ignored.
- Win = P&L above 0, loss = below 0, breakeven = exactly 0. Breakeven trades
  count in the total (so they lower the win rate) but are neither wins nor losses.
- **Win rate** = wins / counted trades.
- **Profit factor** = gross profit / gross loss. Shows ∞ with profits and no losses.
- **R multiple**, in order: the value you typed, else calculated from entry, exit
  and stop loss, else P&L divided by risk amount. **Average R** is the mean over
  trades that have one.
- **Max drawdown** = the largest fall from a cumulative-P&L peak.
- A trade's date is its close date (its open date if it has no close date).
- P&L is used exactly as entered. Fees are not modelled separately, so enter
  P&L net of fees.
- Currency formatting is USD. Change `CURRENCY` in `tradelog-web/src/lib/format.ts`
  if your account uses another currency.

## Tests

```powershell
cd tradelog-web
npm test
```

Covers the analytics maths, the sync engine (offline queue, edits during an
upload, deletes, refused trades, expired sessions, other devices, starting
balance), and the guards that stop a signed-out device from touching local data.

## Security notes

- Row-level security restricts every row to its owner. Before any public
  release, test with **two accounts** and confirm one cannot see or change the
  other's trades.
- Only the public (publishable/anon) key is used in the browser. Keep any
  service key server-side and out of this repository.
- `.env.local` is git-ignored. Do not commit it.
- Trades kept on a device can be read by anyone who can use that browser
  profile. On a shared computer, sign out when you finish.

## Known limits and next steps

- The installable-app icon is an SVG; some browsers want PNG icons before they
  offer "Install". Adding 192 and 512 pixel PNGs is the fix.
- Old build files stay in the offline cache until the service worker version in
  `public/sw.js` is bumped.
- Filters by date range on the Journal, psychology tags per trade, and the
  Android client are not built yet.
