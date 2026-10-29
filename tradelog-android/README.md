# Tradelog for Android

The phone version of the Tradelog trading journal. It uses the **same Supabase project, tables and
login** as the web app (`../tradelog-web`), so your trades appear on both.

**Offline-first:** every trade, review and chart is read from a database on the phone, so the app
opens and works with no signal. New entries are saved on the phone first and upload on their own
when the connection returns.

## What is in the app

| Tab | What it does |
| --- | --- |
| Overview | Balance, net P&L, win rate, profit factor, average R, equity curve, review queue, insights |
| Journal | Every trade with search, status filter and sorting. Tap a trade to edit or delete it (delete has Undo) |
| Reviews | Queue of closed trades waiting for a review (losses and off-plan trades first), and finished reviews |
| Insights | Stats, strategy comparison, mindset (emotions) and the review calendar |
| Settings | Starting balance, sync status and "Sync now", CSV export, sign out |

Forms: add/edit trade (automatic R multiple, planned risk:reward, sanity warnings) and the review form
(plan adherence, emotion, confidence, mistake, lesson). Sign in / create account.

## Run it on your phone (Windows + VS Code)

1. Install **Node.js LTS** and install **Expo Go** from the Play Store on your phone.
2. In a VS Code terminal:
   ```
   cd tradelog-android
   npm install
   copy .env.example .env
   ```
3. Open `.env` and fill in the **same** project URL and publishable key as the web app
   (`https://xxxx.supabase.co` and the key that starts with `sb_publishable_`). Never use the
   database password or a secret / service_role key.
4. `npx expo start -c`, then scan the QR code with Expo Go (phone and PC on the same Wi-Fi).
5. Make sure you already ran `supabase/schema.sql` and `supabase/002_review_fields.sql` from the web
   project in the Supabase SQL Editor.

Sign in **once while online**. After that you can switch on airplane mode, close and reopen the app,
and everything is still there.

## Make an installable APK

```
npx eas-cli@latest login
npx eas-cli@latest build -p android --profile preview
```

Add the two `EXPO_PUBLIC_` variables to your EAS project first (`npx eas-cli@latest env:create`), because
the cloud build does not see your local `.env`.

## How offline sync works

Same rules as the web app:

- Saving a trade writes it to the phone's SQLite database and adds it to an **upload queue** in one
  step. There is one queue item per trade, so editing it five times offline uploads once, with the
  latest version.
- When the phone gets a connection (or the app returns to the foreground, or every 15 s while changes
  are waiting) the queue is uploaded oldest first, then the server's trades are pulled in.
- A trade with an unsent change is never overwritten by the server copy. A trade deleted on another
  device is removed here too. If two devices edit the same trade, the last one to sync wins.
- If the server refuses one trade, it is flagged and the rest still upload.
- The app refuses to talk to the server without a valid sign-in, so an offline start can never be
  mistaken for "the server has no trades" and wipe the phone.
- Signing out deletes the phone's copy (the data stays on the server). If changes have not uploaded
  yet, you are warned first.

The sign-in is kept in the Android Keystore (`expo-secure-store`), split into small pieces because a
session is longer than one SecureStore value should be.

## Shared code with the web app

`src/core/` is a **generated copy** of the web app's `src/lib` (trade types, analytics, formatting,
merge/sync/remote rules, CSV). The web app is the source of truth.

```
npm run sync-core     copy the latest from ../tradelog-web
npm run check-core    fail if the copies differ (also runs inside npm test)
```

Do not edit `src/core/` by hand; change the web file and run `sync-core`.

## Checks

```
npm run typecheck     TypeScript
npm run lint          ESLint (expo lint)
npm test              shared-code check + store/session tests (28)
```

The tests run the same offline scenarios (offline entry, repeated edits, offline delete, refused row,
other-device changes, starting balance) against both the in-memory store and the real SQLite store
(`src/lib/sqlite-store.ts`, run on Node's built-in SQLite).

## Known limits

- Built and checked with TypeScript, lint, unit tests and a full Android bundle, but **not yet run on a
  physical phone or emulator** by the author of this code. Please try the offline steps above and report
  anything odd.
- Trade date is typed as `YYYY-MM-DD` (there is a Today button); there is no calendar picker yet.
- CSV export uses the Android share sheet (text), not a saved file.
- Android is the target. The web build of this app is not supported (no SQLite / SecureStore on web);
  use `tradelog-web` for the browser.
- The app icon and splash are still the Expo starter artwork.
