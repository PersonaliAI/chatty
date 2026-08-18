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

/**
 * Each design's default launcher-button look. Mirrors LAUNCHER_STYLES in
 * public/widget.js exactly — kept in sync by hand since widget.js is a
 * separate unbundled script that can't import from this file.
 */
export const LAUNCHER_STYLES: Record<string, { bg: string; shadow: string; dot: string }> = {
  minimal: { bg: "#1c1a15", shadow: "0 6px 16px rgba(0,0,0,.18)", dot: "#f3f2ee" },
  playful: { bg: "#ff8a5c", shadow: "0 8px 20px rgba(255,138,92,.45)", dot: "#ffffff" },
  corporate: { bg: "#1c2e4a", shadow: "0 6px 16px rgba(28,46,74,.3)", dot: "#8fb0dc" },
  "dark-sleek": { bg: "#14141a", shadow: "0 0 24px rgba(0,229,199,.35)", dot: "#00e5c7" },
  "gradient-glow": { bg: "linear-gradient(135deg,#a855f7,#ec4899)", shadow: "0 10px 26px rgba(168,85,247,.4)", dot: "#ffffff" },
  glassmorphism: { bg: "rgba(255,255,255,.25)", shadow: "0 8px 24px rgba(0,0,0,.2)", dot: "#ffffff" },
  ecommerce: { bg: "#0f9d8c", shadow: "0 8px 20px rgba(15,157,140,.35)", dot: "#ffffff" },
  "healthcare-calm": { bg: "#6f9c7d", shadow: "0 8px 20px rgba(111,156,125,.35)", dot: "#f4f7f3" },
  neubrutalism: { bg: "#111111", shadow: "5px 5px 0 0 #111111", dot: "#ffde59" },
  "luxury-editorial": { bg: "#161412", shadow: "0 8px 22px rgba(0,0,0,.3)", dot: "#b08a3e" },
};
