/**
 * WCAG-based "what text color goes on this background" helper. Used
 * anywhere a widget preset paints an element's background with the
 * business owner's arbitrary primaryColor (chat header, user bubble, the
 * "Bold" preset) — a hardcoded text color there goes invisible the moment
 * someone picks a color from the wrong half of the lightness spectrum.
 */

export function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace("#", "").trim();
  const full = clean.length === 3 ? clean.split("").map((c) => c + c).join("") : clean;
  const num = parseInt(full, 16);
  if (full.length !== 6 || Number.isNaN(num)) return [249, 115, 22]; // fallback: brand orange
  return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
}

function relativeLuminance(r: number, g: number, b: number): number {
  const [rs, gs, bs] = [r, g, b].map((c) => {
    const v = c / 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

function contrastRatio(l1: number, l2: number): number {
  const [lighter, darker] = l1 > l2 ? [l1, l2] : [l2, l1];
  return (lighter + 0.05) / (darker + 0.05);
}

/**
 * Returns white / near-black text for a given background hex.
 *
 * Deliberately NOT "whichever of white/black has the higher literal WCAG
 * ratio" — that maximization picks black for nearly every saturated brand
 * color (orange #f97316, green #10b981/#22c55e, blue #3b82f6, red #ef4444
 * all land here: mid-lightness luminance means black's ratio against it
 * edges out white's, even though white is the near-universal design-system
 * choice for buttons/badges in these colors). Instead, favor white unless
 * the background is light enough that white would actually wash out
 * (pastels, near-white) — matching how colored UI chrome reads in practice.
 */
export function getOnColor(backgroundHex: string): "#ffffff" | "#111827" {
  const [r, g, b] = hexToRgb(backgroundHex);
  const bgLum = relativeLuminance(r, g, b);
  return bgLum > 0.55 ? "#111827" : "#ffffff";
}

/**
 * --primary-color / --on-primary, the pair every widget preset
 * (globals.css's .style-*) reads for its primaryColor-driven surfaces —
 * one computation shared by every place that renders a preset (the real
 * embedded widget, and the Customizer/Playground's non-iframe mock
 * previews), so it can't drift between them.
 *
 * Surfaces that can't take the full saturated color without hurting
 * legibility (a bot reply bubble, an input field) don't get a separate
 * JS-precomputed tint — globals.css blends var(--primary-color) toward
 * that surface's own curated color with CSS color-mix() instead, at a
 * partial ratio. That keeps each preset's own light/dark character (a
 * dark preset's bot-bubble tints toward primaryColor while staying dark;
 * a light preset's stays light) without a fixed "tint toward white"
 * assumption breaking already-dark designs like Dark Sleek.
 */
export function primaryColorCssVars(primaryColor: string): Record<string, string> {
  return {
    "--primary-color": primaryColor,
    "--on-primary": getOnColor(primaryColor),
  };
}

// ── Per-section color scheme ────────────────────────────────────────────
// Section-by-section colors (header, bubbles, input bar, send button,
// launcher), each independently overridable in the Customizer, with a
// color-theory generator that fills in a full, harmonious set from one
// seed color — same hue throughout, only lightness/saturation shifted per
// surface, so "Auto-generate" never needs an actual model call.

function hexToHsl(hex: string): [number, number, number] {
  const [r8, g8, b8] = hexToRgb(hex);
  const r = r8 / 255, g = g8 / 255, b = b8 / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l * 100];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h: number;
  switch (max) {
    case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
    case g: h = ((b - r) / d + 2) / 6; break;
    default: h = ((r - g) / d + 4) / 6;
  }
  return [h * 360, s * 100, l * 100];
}

function hslToHex(h: number, s: number, l: number): string {
  const S = s / 100, L = l / 100;
  const c = (1 - Math.abs(2 * L - 1)) * S;
  const hp = ((h % 360) + 360) % 360 / 60;
  const x = c * (1 - Math.abs((hp % 2) - 1));
  let [r1, g1, b1] = [0, 0, 0];
  if (hp < 1) [r1, g1, b1] = [c, x, 0];
  else if (hp < 2) [r1, g1, b1] = [x, c, 0];
  else if (hp < 3) [r1, g1, b1] = [0, c, x];
  else if (hp < 4) [r1, g1, b1] = [0, x, c];
  else if (hp < 5) [r1, g1, b1] = [x, 0, c];
  else [r1, g1, b1] = [c, 0, x];
  const m = L - c / 2;
  const toHex = (v: number) => Math.round((v + m) * 255).toString(16).padStart(2, "0");
  return `#${toHex(r1)}${toHex(g1)}${toHex(b1)}`;
}

/** A section's background + the text/icon color(s) it needs. */
export interface SectionColors {
  bg: string;
  text: string;
  icon?: string;
}

export interface WidgetColorScheme {
  header: SectionColors;
  botBubble: SectionColors;
  userBubble: SectionColors;
  inputBar: SectionColors;
  sendBtn: SectionColors;
  launcher: SectionColors;
}

/**
 * Derives a full 6-section color scheme from one seed color — same hue
 * throughout (color theory, not per-section arbitrary picks), lightness
 * and saturation shifted per surface so bot-bubble/input-bar stay soft
 * and legible instead of a jarring flat fill of the seed itself, and
 * every text/icon color is computed (getOnColor) against its own actual
 * background, never assumed.
 */
export function generateColorScheme(seedHex: string): WidgetColorScheme {
  const [h, s] = hexToHsl(seedHex);
  const solid = seedHex;
  const solidText = getOnColor(solid);
  // Soft, slightly desaturated tint of the same hue for message/input
  // surfaces — light enough to read as neutral chrome, still visibly
  // tinted toward the brand hue rather than generic gray.
  const softBg = hslToHex(h, Math.min(s, 45) * 0.5, 95);
  const softText = hslToHex(h, Math.min(s, 45) * 0.6, 22);
  return {
    header: { bg: solid, text: solidText },
    botBubble: { bg: softBg, text: softText },
    userBubble: { bg: solid, text: solidText },
    inputBar: { bg: hslToHex(h, Math.min(s, 30) * 0.35, 97.5), text: softText, icon: hslToHex(h, Math.min(s, 50), 45) },
    sendBtn: { bg: solid, text: solidText },
    launcher: { bg: solid, text: solidText },
  };
}

const HEX_RE = /^#[0-9a-fA-F]{3,8}$/;
function safeHex(h?: string): string | null {
  return h && HEX_RE.test(h) ? h : null;
}

/**
 * Builds the !important CSS override block for a color scheme, scoped
 * under `scopeSelector` (an id or class on the widget's root element) so
 * it reliably beats globals.css's .style-* !important rules regardless of
 * which design preset is active. Shared by every place that renders a
 * scheme — the real embedded widget (EmbedClient.tsx) and the dashboard's
 * Customizer/Playground non-iframe mock previews — so they can't drift.
 * Launcher isn't included: it lives outside this DOM tree entirely
 * (widget.js/page.tsx own that separately).
 */
export function buildColorSchemeCss(scheme: WidgetColorScheme | null, scopeSelector: string): string {
  if (!scheme) return "";
  const rules: string[] = [];
  const header = scheme.header, bg = safeHex(header?.bg), text = safeHex(header?.text);
  if (bg && text) rules.push(`${scopeSelector} .chat-header { background: ${bg} !important; color: ${text} !important; }`);
  const bot = scheme.botBubble, botBg = safeHex(bot?.bg), botText = safeHex(bot?.text);
  if (botBg && botText) rules.push(`${scopeSelector} .bot-bubble { background-color: ${botBg} !important; color: ${botText} !important; }`);
  const user = scheme.userBubble, userBg = safeHex(user?.bg), userText = safeHex(user?.text);
  if (userBg && userText) rules.push(`${scopeSelector} .user-bubble { background-color: ${userBg} !important; color: ${userText} !important; }`);
  const input = scheme.inputBar, inputBg = safeHex(input?.bg), inputText = safeHex(input?.text);
  if (inputBg && inputText) rules.push(`${scopeSelector} .chat-input-bar { background-color: ${inputBg} !important; color: ${inputText} !important; }`);
  const inputIcon = safeHex(input?.icon);
  if (inputIcon) rules.push(`${scopeSelector} .chat-input-bar-icon { color: ${inputIcon} !important; }`);
  const send = scheme.sendBtn, sendBg = safeHex(send?.bg), sendText = safeHex(send?.text);
  if (sendBg && sendText) rules.push(`${scopeSelector} .send-btn { background-color: ${sendBg} !important; color: ${sendText} !important; }`);
  return rules.join("\n");
}
