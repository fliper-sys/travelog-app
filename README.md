# TRADELOG

A Forex trading journal. Record trades, review your execution and understand
your performance. Web dashboard first (Next.js + Supabase); Android comes later
against the same backend.

```
supabase/schema.sql   database table, row-level security, updated_at trigger
tradelog-web/         Next.js (App Router, TypeScript) web dashboard
```

## What works now

- Register, sign in and sign out (Supabase Auth, email + password)
- Add, edit and delete trades, saved per user in Supabase
- Dashboard computed from your real trades: Net P&L, win rate, profit factor,
  average R, equity curve, review queue, strategy breakdown, psychology hints
- Search across pair, strategy and notes

Not built yet: Android app, trade-review history table, filters and date
ranges, deployment.

## Setup (Windows, VS Code)

1. **Create the database table.** In your Supabase project open the SQL Editor,
   paste the contents of `supabase/schema.sql` and run it once. In the Table
   Editor you should see `trades` with four RLS policies. If it errors, read
   the error before running it again.
2. **Add your keys.** In `tradelog-web`, copy `.env.example` to `.env.local`
   (beside `package.json`) and fill in the project URL and the publishable
   (anon) key. Never use the database password or a `service_role` key here.
3. **Run it** in the VS Code terminal:

   ```powershell
   cd tradelog-web
   npm install
   npm run dev
   ```

   Open http://localhost:3000. After changing `.env.local`, stop the server
   (Ctrl+C) and run `npm run dev` again.

If email confirmation is enabled in Supabase (Authentication settings), new
accounts must click the link in the confirmation email before signing in.

## How the numbers are calculated

- Only **closed** trades with a **P&L** are counted. Open trades and closed
  trades with no P&L are ignored.
- Win = P&L above 0, loss = below 0, breakeven = exactly 0. Breakeven trades
  count in the total (so they lower the win rate) but are neither wins nor
  losses.
- **Win rate** = wins / counted trades.
- **Profit factor** = gross profit / gross loss. Shows ∞ if there are profits
  and no losses.
- **R multiple** = P&L / risk amount, for trades that have a risk amount above 0.
  **Average R** is the mean of those.
- P&L is used exactly as entered. Fees are not modelled separately, so enter
  P&L net of fees.
- Currency formatting is USD. Change `CURRENCY` in `tradelog-web/src/lib/format.ts`
  if your account uses another currency.

## Security notes

- Row-level security restricts every row to its owner. Before any public
  release, test with **two accounts** and confirm one cannot see or change the
  other's trades.
- Only the public (publishable/anon) key is used in the browser. Keep any
  service key server-side and out of this repository.
- `.env.local` is git-ignored. Do not commit it.

## Next steps

1. Filters and date ranges
2. A `trade_reviews` table for structured reviews and lessons learned
3. Psychology tags per trade
4. Android client (React Native / Expo) on the same Supabase project
5. Deployment and a backup plan
