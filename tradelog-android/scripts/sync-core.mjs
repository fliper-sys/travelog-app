// Keeps the Android app's shared logic identical to the web app's.
//
//   node scripts/sync-core.mjs          copy the shared files from ../tradelog-web
//   node scripts/sync-core.mjs --check  fail if the copies differ (used by `npm test`)
//
// The web app is the source of truth. Edit these files there, then run the copy.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const from = join(root, "..", "tradelog-web", "src", "lib");
const to = join(root, "src", "core");

const FILES = [
  "types.ts",
  "constants.ts",
  "format.ts",
  "analytics.ts",
  "offline/types.ts",
  "offline/merge.ts",
  "offline/sync.ts",
  "offline/trades.ts",
  "offline/memory-store.ts",
  "offline/remote.ts",
  "offline/fetch.ts",
  "csv.ts",
];

const HEADER =
  "// GENERATED COPY of tradelog-web/src/lib. Do not edit here.\n" +
  "// Change the web file, then run: npm run sync-core\n";

const check = process.argv.includes("--check");
let drift = 0;

if (!existsSync(from)) {
  if (check) {
    console.log("tradelog-web not found next to this app; skipping the shared-code check.");
    process.exit(0);
  }
  console.error(`Cannot find ${from}`);
  process.exit(1);
}

for (const file of FILES) {
  const expected = HEADER + readFileSync(join(from, file), "utf8");
  const target = join(to, file);
  const current = existsSync(target) ? readFileSync(target, "utf8") : null;
  if (current === expected) continue;
  if (check) {
    drift += 1;
    console.error(`out of date: src/core/${file}`);
  } else {
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, expected);
    console.log(`copied ${file}`);
  }
}

if (check && drift > 0) {
  console.error(`\n${drift} shared file(s) differ from the web app. Run: npm run sync-core`);
  process.exit(1);
}
if (check) console.log("Shared code matches the web app.");
