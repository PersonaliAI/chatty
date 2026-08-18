// Run manually (`node scripts/generate-design-snapshot.mjs`) whenever a
// widget design is *intentionally* changed, to re-freeze the new values as
// the regression baseline. verify-design-snapshot.mjs (run in CI) fails if
// the live CSS ever drifts from whatever this file currently records.
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { readDesignTokens } from "./design-tokens.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_PATH = path.join(__dirname, "design-snapshot.json");

const tokens = readDesignTokens();
writeFileSync(OUT_PATH, JSON.stringify(tokens, null, 2) + "\n");
console.log(`Wrote ${Object.keys(tokens).length} design snapshots to ${OUT_PATH}`);
