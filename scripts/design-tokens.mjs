// Shared parser for the 10 widget designs' key visual tokens, read directly
// out of src/app/globals.css. Used by both generate-design-snapshot.mjs
// (to freeze the current values) and verify-design-snapshot.mjs (to catch
// any future edit that silently changes them) — one parser, so the two
// scripts can never disagree about what a "value" means.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CSS_PATH = path.join(__dirname, "..", "src", "app", "globals.css");

export const DESIGN_IDS = [
  "minimal", "playful", "corporate", "dark-sleek", "gradient-glow",
  "glassmorphism", "ecommerce", "healthcare-calm", "neubrutalism", "luxury-editorial",
];

function extractBlock(css, selector) {
  // Matches `SELECTOR { ...single-or-multi-line... }`, selector taken literally.
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(`${escaped}\\s*\\{([^}]*)\\}`);
  const m = css.match(re);
  return m ? m[1] : null;
}

function extractProp(block, prop) {
  if (!block) return null;
  // Matches `prop: value !important;` or `prop: value;` — value may itself
  // contain commas/parens (rgba(), linear-gradient()), so match up to the
  // first `!important` or `;` that isn't inside parens.
  const re = new RegExp(`(?:^|;)\\s*${prop}\\s*:\\s*([^;]+?)\\s*(?:!important)?\\s*;`);
  const m = block.match(re);
  return m ? m[1].trim() : null;
}

export function readDesignTokens() {
  const css = readFileSync(CSS_PATH, "utf-8");
  const tokens = {};
  for (const id of DESIGN_IDS) {
    const container = extractBlock(css, `.style-${id}`);
    const header = extractBlock(css, `.style-${id} .chat-header`);
    const botBubble = extractBlock(css, `.style-${id} .bot-bubble`);
    const userBubble = extractBlock(css, `.style-${id} .user-bubble`);
    tokens[id] = {
      containerBg: extractProp(container, "background-color") || extractProp(container, "background"),
      containerRadius: extractProp(container, "border-radius"),
      headerBg: extractProp(header, "background-color") || extractProp(header, "background"),
      botBubbleBg: extractProp(botBubble, "background-color"),
      botBubbleRadius: extractProp(botBubble, "border-radius"),
      userBubbleBg: extractProp(userBubble, "background-color"),
      userBubbleRadius: extractProp(userBubble, "border-radius"),
    };
  }
  return tokens;
}
