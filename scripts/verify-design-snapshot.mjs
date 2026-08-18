// Regression guard (Chatty Test Strategy, Phase 4): fails fast, in plain
// Node with no browser, if any of the 10 widget designs' key visual tokens
// silently drift from the frozen snapshot — a stray edit to globals.css
// (wrong selector, typo'd hex, an !important dropped) gets caught on the
// next push instead of being noticed three days later in a screenshot.
// Run via `node scripts/verify-design-snapshot.mjs`; wired into CI.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { readDesignTokens, DESIGN_IDS } from "./design-tokens.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SNAPSHOT_PATH = path.join(__dirname, "design-snapshot.json");

const expected = JSON.parse(readFileSync(SNAPSHOT_PATH, "utf-8"));
const actual = readDesignTokens();

let failures = [];

for (const id of DESIGN_IDS) {
  const exp = expected[id];
  const act = actual[id];
  if (!exp) {
    failures.push(`"${id}" has no frozen snapshot — run generate-design-snapshot.mjs`);
    continue;
  }
  if (!act || Object.values(act).every((v) => v === null)) {
    failures.push(`"${id}": no CSS rules found at all — selector renamed or removed?`);
    continue;
  }
  for (const key of Object.keys(exp)) {
    if (act[key] !== exp[key]) {
      failures.push(`"${id}".${key}: expected ${JSON.stringify(exp[key])}, got ${JSON.stringify(act[key])}`);
    }
  }
}

if (failures.length) {
  console.error(`Design snapshot mismatch (${failures.length}):\n`);
  for (const f of failures) console.error(`  - ${f}`);
  console.error(
    "\nIf this change is intentional, run `node scripts/generate-design-snapshot.mjs`\n" +
    "to re-freeze the new values, then commit the updated design-snapshot.json.",
  );
  process.exit(1);
}

console.log(`All ${DESIGN_IDS.length} design snapshots match.`);
