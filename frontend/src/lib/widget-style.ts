/**
 * Maps old, now-removed widget style preset IDs to their closest current
 * equivalent. The widget style system has been redesigned twice:
 *   1. An original 9-preset set (glassmorphism, liquid, neumorphism,
 *      brutalism, claymorphism, bento, retro, aurora, minimalist)
 *   2. A brief 5-preset set (minimalist, elevated, frosted, bold, contrast)
 *   3. The current 10-preset set, ported 1:1 from a real design gallery
 *      (minimal, playful, corporate, dark-sleek, gradient-glow,
 *      glassmorphism, ecommerce, healthcare-calm, neubrutalism,
 *      luxury-editorial) — see globals.css for the full rationale.
 * Existing bots in the database may still have any of the older IDs stored
 * in widget_style; without this mapping they'd render with no matching CSS
 * class at all (unstyled).
 */
const LEGACY_STYLE_MAP: Record<string, string> = {
  // Original 9-preset set
  liquid: "glassmorphism",
  neumorphism: "corporate",
  claymorphism: "playful",
  bento: "minimal",
  brutalism: "neubrutalism",
  retro: "dark-sleek",
  aurora: "gradient-glow",
  // Brief 5-preset set
  minimalist: "minimal",
  elevated: "corporate",
  frosted: "glassmorphism",
  bold: "gradient-glow",
  contrast: "dark-sleek",
};

const CURRENT_STYLES = new Set([
  "minimal",
  "playful",
  "corporate",
  "dark-sleek",
  "gradient-glow",
  "glassmorphism",
  "ecommerce",
  "healthcare-calm",
  "neubrutalism",
  "luxury-editorial",
]);

export function normalizeWidgetStyle(id: string | null | undefined): string {
  if (!id) return "minimal";
  if (CURRENT_STYLES.has(id)) return id;
  return LEGACY_STYLE_MAP[id] || "minimal";
}
