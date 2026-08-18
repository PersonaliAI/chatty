/**
 * Maps old, now-removed widget style preset IDs to their closest new
 * equivalent. The 9-preset set (glassmorphism, liquid, neumorphism,
 * brutalism, claymorphism, bento, retro, aurora, minimalist) was replaced
 * with 5 redesigned presets (minimalist, elevated, frosted, bold, contrast)
 * — see globals.css for why. Existing bots in the database still have the
 * old IDs stored in widget_style; without this mapping they'd render with
 * no matching CSS class at all (unstyled).
 */
const LEGACY_STYLE_MAP: Record<string, string> = {
  glassmorphism: "frosted",
  liquid: "frosted",
  neumorphism: "elevated",
  claymorphism: "elevated",
  bento: "minimalist",
  brutalism: "bold",
  retro: "contrast",
  aurora: "frosted",
};

const CURRENT_STYLES = new Set(["minimalist", "elevated", "frosted", "bold", "contrast"]);

export function normalizeWidgetStyle(id: string | null | undefined): string {
  if (!id) return "minimalist";
  if (CURRENT_STYLES.has(id)) return id;
  return LEGACY_STYLE_MAP[id] || "minimalist";
}
