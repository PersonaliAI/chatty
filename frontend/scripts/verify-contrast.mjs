// Regression guard: fails fast if any widget design preset's text/background
// pair in src/app/globals.css drops below WCAG AA (4.5:1) for normal-size
// text. Written after a real incident — the "Playful" preset's header/
// button/chip used #ff8a5c (orange) text-on-white and white-on-orange at
// only 2.32:1, visibly hard to read in production. Run via
// `node scripts/verify-contrast.mjs`; wired into CI.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { contrastRatio, hexToRgb } from "./wcag-contrast.mjs";
import { DESIGN_IDS } from "./design-tokens.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CSS_PATH = path.join(__dirname, "..", "src", "app", "globals.css");
const MIN_RATIO = 4.5;

// Elements whose CSS class carries real, readable text.
const TEXT_ELEMENTS = [
  "", // the container itself (e.g. .style-minimal)
  " .chat-header",
  " .bot-bubble",
  " .user-bubble",
  " .starter-chip",
  " .chat-input-bar",
  " .send-btn",
];

// Presets whose header/send-btn use a two-stop linear-gradient background
// instead of a solid color — both stops need checking against the
// foreground text color.
const GRADIENT_ELEMENTS = new Set(["gradient-glow .chat-header", "gradient-glow .send-btn"]);

// Presets that paint text-bearing elements with an rgba(...) translucent
// background over a colorful gradient (glassmorphism) rather than a solid
// hex — this script can't resolve the true composited color, so the
// underlying raw gradient stops are checked instead (as a worst-case floor:
// the translucent white overlay only ever pushes the effective background
// closer to white, i.e. more contrast against white/near-white text, never
// less) — see the container-level check below, which still runs for these.
const SKIP_TRANSLUCENT = new Set([
  "glassmorphism .chat-header",
  "glassmorphism .bot-bubble",
  "glassmorphism .starter-chip",
  "glassmorphism .chat-input-bar",
]);

function extractBlock(css, selector) {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(`${escaped}\\s*\\{([^}]*)\\}`);
  const m = css.match(re);
  return m ? m[1] : null;
}

function extractProp(block, prop) {
  if (!block) return null;
  const re = new RegExp(`(?:^|;)\\s*${prop}\\s*:\\s*([^;]+?)\\s*(?:!important)?\\s*;`);
  const m = block.match(re);
  return m ? m[1].trim() : null;
}

function gradientStops(value) {
  // Pulls every #rrggbb / #rgb hex literal out of a linear-gradient(...) value.
  return [...value.matchAll(/#[0-9a-fA-F]{3,6}/g)].map((m) => m[0]);
}

// send-btn intentionally uses var(--primary-color, <curated-fallback>) so the
// dashboard's color picker has one safe place to show through (see the
// comment above the preset block in globals.css). The fallback is the
// no-primary-color-set case — the one this static script can actually
// verify, since --primary-color is only known at runtime. Resolves to the
// fallback text with any wrapping "!important" stripped.
function resolveVarFallback(value) {
  const m = value.match(/^var\(\s*--[\w-]+\s*,\s*([\s\S]+)\)$/);
  return m ? m[1].trim() : value;
}

const css = readFileSync(CSS_PATH, "utf-8");
const failures = [];
const checked = [];

for (const id of DESIGN_IDS) {
  for (const suffix of TEXT_ELEMENTS) {
    const selector = `.style-${id}${suffix}`;
    const label = suffix ? `${id}${suffix}` : `${id} (container)`;
    if (SKIP_TRANSLUCENT.has(`${id}${suffix}`)) continue;

    const block = extractBlock(css, selector);
    if (!block) continue; // element doesn't set its own bg/color for this preset — inherits, nothing to check here
    const color = resolveVarFallback(extractProp(block, "color") || "");
    if (!color || !color.startsWith("#")) continue; // no text color set on this element, or not a plain hex

    const rawBg = resolveVarFallback(extractProp(block, "background-color") || extractProp(block, "background") || "");
    if (!rawBg) continue;

    const bgHexes = GRADIENT_ELEMENTS.has(`${id}${suffix}`) ? gradientStops(rawBg)
      : rawBg.startsWith("#") ? [rawBg]
      : []; // rgba()/unresolvable — skip, not our failure mode here

    for (const bgHex of bgHexes) {
      if (!hexToRgb(bgHex) || !hexToRgb(color)) continue;
      const ratio = contrastRatio(bgHex, color);
      checked.push(label);
      if (ratio < MIN_RATIO) {
        failures.push(`${label}: bg=${bgHex} fg=${color} ratio=${ratio.toFixed(2)} (needs >= ${MIN_RATIO})`);
      }
    }
  }

  // ::placeholder text, checked against the preset's own input/container background.
  const placeholderBlock = extractBlock(css, `.style-${id} ::placeholder`);
  const placeholderColor = extractProp(placeholderBlock, "color");
  if (placeholderColor && placeholderColor.startsWith("#")) {
    const inputBlock = extractBlock(css, `.style-${id} .chat-input-bar`);
    const bg = extractProp(inputBlock, "background-color");
    if (bg && bg.startsWith("#") && hexToRgb(bg) && hexToRgb(placeholderColor)) {
      const ratio = contrastRatio(bg, placeholderColor);
      checked.push(`${id} ::placeholder`);
      if (ratio < MIN_RATIO) {
        failures.push(`${id} ::placeholder: bg=${bg} fg=${placeholderColor} ratio=${ratio.toFixed(2)} (needs >= ${MIN_RATIO})`);
      }
    }
  }
}

if (checked.length === 0) {
  console.error("verify-contrast.mjs found nothing to check — the CSS structure probably changed; update this script's selectors.");
  process.exit(1);
}

if (failures.length) {
  console.error(`Contrast check failed (${failures.length} of ${checked.length} pairs below ${MIN_RATIO}:1):\n`);
  for (const f of failures) console.error(`  - ${f}`);
  process.exit(1);
}

console.log(`Contrast check passed: ${checked.length} text/background pairs all >= ${MIN_RATIO}:1.`);
