/**
 * Ensures files changed by the current frontend commit also exist with the
 * same contents in the public monorepo checkout.  CI checks out that repo at
 * ../chatty-public before invoking this script.
 */
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const mirrorRoot = process.env.PUBLIC_MIRROR_DIR;
if (!mirrorRoot) throw new Error("PUBLIC_MIRROR_DIR must point to a PersonaliAI/chatty checkout.");

const changed = execFileSync("git", ["diff", "--name-only", "HEAD^", "HEAD"], { encoding: "utf8" })
  .split(/\r?\n/)
  .filter(Boolean)
  .filter((file) => file.startsWith("src/") || file.startsWith("public/") || ["package.json", ".env.example"].includes(file));

const failures = [];
for (const file of changed) {
  const mirrorFile = path.join(mirrorRoot, "frontend", file);
  if (!existsSync(mirrorFile)) {
    failures.push(`${file}: missing from public mirror`);
    continue;
  }
  if (!readFileSync(file).equals(readFileSync(mirrorFile))) failures.push(`${file}: contents differ from public mirror`);
}

if (failures.length) {
  console.error("Public mirror verification failed:\n" + failures.map((failure) => `  - ${failure}`).join("\n"));
  process.exit(1);
}
console.log(`Public mirror verified for ${changed.length} changed frontend file(s).`);
