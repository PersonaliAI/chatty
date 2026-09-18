/**
 * Maps old, now-removed widget style preset IDs to their closest current
 * equivalent. The widget style system has been redesigned twice:
 *   1. An original 9-preset set (glassmorphism, liquid, neumorphism,
 *      brutalism, claymorphism, bento, retro, aurora, minimalist)
 *   2. A brief 5-preset set (minimalist, elevated, frosted, bold, contrast)
 *   3. The current 10-preset set, ported 1:1 from a real design gallery
 *      (minimal, playful, corporate, dark-sleek, gradient-glow,
 *      glassmorphism, ecommerce, healthcare-calm, neubrutalism,
 *      luxury-editorial) - see globals.css for the full rationale.
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
 * public/widget.js exactly - kept in sync by hand since widget.js is a
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

/**
 * Each design's own chat-panel corner radius (its .style-X { border-radius }
 * in globals.css). Mirrors PANEL_RADIUS in public/widget.js exactly - kept
 * in sync by hand for the same reason LAUNCHER_STYLES above is. The outer
 * host div/iframe around the embedded panel matches this exactly (instead
 * of a flat 0px "always smaller" safety net) so there's no radius mismatch
 * at the corner for anti-aliasing to expose as a hairline seam.
 */
export const PANEL_RADIUS: Record<string, string> = {
  minimal: "18px",
  playful: "28px",
  corporate: "10px",
  "dark-sleek": "16px",
  "gradient-glow": "24px",
  glassmorphism: "20px",
  ecommerce: "14px",
  "healthcare-calm": "18px",
  neubrutalism: "4px",
  "luxury-editorial": "6px",
};

import type { WidgetColorScheme } from "./color-contrast";

export interface PresetSignature {
  id: string;
  name: string;
  desc: string;
  primary: string;
  onPrimary: string;
  headerBg: string;
  headerText: string;
  botBubbleBg: string;
  botBubbleText: string;
  userBubbleBg: string;
  userBubbleText: string;
  inputBg: string;
  inputText: string;
  bottomNavBg: string;
  bottomNavText: string;
  bottomNavActive: string;
  bottomNavStyle: "default" | "pill" | "clean" | "glass" | "chunky" | "luxury";
  bottomNavIndicator: "line" | "pill" | "dot";
  fontFamily: string;
  previewPalette: [string, string, string];
}

export const PRESET_SIGNATURES: Record<string, PresetSignature> = {
  minimal: {
    id: "minimal",
    name: "Minimal",
    desc: "Clean SaaS · off-white",
    primary: "#18181b",
    onPrimary: "#ffffff",
    headerBg: "#ffffff",
    headerText: "#18181b",
    botBubbleBg: "#f4f4f5",
    botBubbleText: "#18181b",
    userBubbleBg: "#18181b",
    userBubbleText: "#ffffff",
    inputBg: "#ffffff",
    inputText: "#18181b",
    bottomNavBg: "#ffffff",
    bottomNavText: "#71717a",
    bottomNavActive: "#18181b",
    bottomNavStyle: "clean",
    bottomNavIndicator: "line",
    fontFamily: "DM Sans",
    previewPalette: ["#18181b", "#ffffff", "#f4f4f5"],
  },
  playful: {
    id: "playful",
    name: "Playful",
    desc: "Consumer app · rounded & warm",
    primary: "#ff6b4a",
    onPrimary: "#ffffff",
    headerBg: "#ff6b4a",
    headerText: "#ffffff",
    botBubbleBg: "#ffece3",
    botBubbleText: "#7a3f24",
    userBubbleBg: "#ff6b4a",
    userBubbleText: "#ffffff",
    inputBg: "#fffaf5",
    inputText: "#7a3f24",
    bottomNavBg: "#fff5ee",
    bottomNavText: "#a4623d",
    bottomNavActive: "#ff6b4a",
    bottomNavStyle: "pill",
    bottomNavIndicator: "pill",
    fontFamily: "Quicksand",
    previewPalette: ["#ff6b4a", "#fff5ee", "#ffece3"],
  },
  corporate: {
    id: "corporate",
    name: "Corporate",
    desc: "Enterprise SaaS · structured navy",
    primary: "#1e3a8a",
    onPrimary: "#ffffff",
    headerBg: "#1e3a8a",
    headerText: "#ffffff",
    botBubbleBg: "#eef2f7",
    botBubbleText: "#1e293b",
    userBubbleBg: "#1e3a8a",
    userBubbleText: "#ffffff",
    inputBg: "#f8fafc",
    inputText: "#1e293b",
    bottomNavBg: "#f1f5f9",
    bottomNavText: "#64748b",
    bottomNavActive: "#1e3a8a",
    bottomNavStyle: "clean",
    bottomNavIndicator: "line",
    fontFamily: "Space Grotesk",
    previewPalette: ["#1e3a8a", "#f1f5f9", "#2563eb"],
  },
  "dark-sleek": {
    id: "dark-sleek",
    name: "Dark Sleek",
    desc: "Dev tool · near-black with glow",
    primary: "#00e5c7",
    onPrimary: "#090d16",
    headerBg: "#0d111a",
    headerText: "#e4e4e8",
    botBubbleBg: "#161922",
    botBubbleText: "#e4e4e8",
    userBubbleBg: "#00e5c7",
    userBubbleText: "#090d16",
    inputBg: "#0f131d",
    inputText: "#e4e4e8",
    bottomNavBg: "#090d16",
    bottomNavText: "#64748b",
    bottomNavActive: "#00e5c7",
    bottomNavStyle: "clean",
    bottomNavIndicator: "pill",
    fontFamily: "Space Grotesk",
    previewPalette: ["#00e5c7", "#090d16", "#161922"],
  },
  "gradient-glow": {
    id: "gradient-glow",
    name: "Gradient Glow",
    desc: "Startup · vivid gradient",
    primary: "#9733f5",
    onPrimary: "#ffffff",
    headerBg: "linear-gradient(135deg, #7c3aed 0%, #ec4899 100%)",
    headerText: "#ffffff",
    botBubbleBg: "#f7f0fd",
    botBubbleText: "#4a2467",
    userBubbleBg: "#9733f5",
    userBubbleText: "#ffffff",
    inputBg: "#fcf9ff",
    inputText: "#4a2467",
    bottomNavBg: "#fbf8ff",
    bottomNavText: "#9063b3",
    bottomNavActive: "#9733f5",
    bottomNavStyle: "pill",
    bottomNavIndicator: "pill",
    fontFamily: "Space Grotesk",
    previewPalette: ["#9733f5", "#ec4899", "#f7f0fd"],
  },
  glassmorphism: {
    id: "glassmorphism",
    name: "Glassmorphism",
    desc: "Fintech app · frosted glass",
    primary: "#6366f1",
    onPrimary: "#ffffff",
    headerBg: "rgba(255, 255, 255, 0.12)",
    headerText: "#ffffff",
    botBubbleBg: "rgba(255, 255, 255, 0.18)",
    botBubbleText: "#ffffff",
    userBubbleBg: "rgba(255, 255, 255, 0.9)",
    userBubbleText: "#312e81",
    inputBg: "rgba(255, 255, 255, 0.12)",
    inputText: "#ffffff",
    bottomNavBg: "rgba(15, 23, 42, 0.45)",
    bottomNavText: "rgba(255, 255, 255, 0.7)",
    bottomNavActive: "#ffffff",
    bottomNavStyle: "glass",
    bottomNavIndicator: "pill",
    fontFamily: "Space Grotesk",
    previewPalette: ["#3170eb", "#7d58ee", "#d127b3"],
  },
  ecommerce: {
    id: "ecommerce",
    name: "E-commerce",
    desc: "Online shop · order-aware",
    primary: "#0d9488",
    onPrimary: "#ffffff",
    headerBg: "#0d9488",
    headerText: "#ffffff",
    botBubbleBg: "#f3efe6",
    botBubbleText: "#3a3226",
    userBubbleBg: "#0d9488",
    userBubbleText: "#ffffff",
    inputBg: "#fdf9f2",
    inputText: "#3a3226",
    bottomNavBg: "#fdf9f2",
    bottomNavText: "#78716c",
    bottomNavActive: "#0d9488",
    bottomNavStyle: "clean",
    bottomNavIndicator: "line",
    fontFamily: "DM Sans",
    previewPalette: ["#0d9488", "#fdf9f2", "#3a3226"],
  },
  "healthcare-calm": {
    id: "healthcare-calm",
    name: "Healthcare Calm",
    desc: "Clinic · soft sage & serif",
    primary: "#4a7c59",
    onPrimary: "#ffffff",
    headerBg: "#4a7c59",
    headerText: "#ffffff",
    botBubbleBg: "#eef5ef",
    botBubbleText: "#2f4235",
    userBubbleBg: "#4a7c59",
    userBubbleText: "#ffffff",
    inputBg: "#fbfcf9",
    inputText: "#2f4235",
    bottomNavBg: "#f5f9f6",
    bottomNavText: "#607b63",
    bottomNavActive: "#4a7c59",
    bottomNavStyle: "clean",
    bottomNavIndicator: "pill",
    fontFamily: "Lora",
    previewPalette: ["#4a7c59", "#f5f9f6", "#2f4235"],
  },
  neubrutalism: {
    id: "neubrutalism",
    name: "Neubrutalism",
    desc: "Bold brand · thick borders",
    primary: "#ffde59",
    onPrimary: "#111111",
    headerBg: "#ffde59",
    headerText: "#111111",
    botBubbleBg: "#f4f4f4",
    botBubbleText: "#111111",
    userBubbleBg: "#ea0033",
    userBubbleText: "#ffffff",
    inputBg: "#ffffff",
    inputText: "#111111",
    bottomNavBg: "#ffde59",
    bottomNavText: "#111111",
    bottomNavActive: "#111111",
    bottomNavStyle: "chunky",
    bottomNavIndicator: "pill",
    fontFamily: "DM Sans",
    previewPalette: ["#ffde59", "#111111", "#ea0033"],
  },
  "luxury-editorial": {
    id: "luxury-editorial",
    name: "Luxury Editorial",
    desc: "Boutique · serif & gold",
    primary: "#c9a86a",
    onPrimary: "#14120f",
    headerBg: "#14120f",
    headerText: "#f5efe3",
    botBubbleBg: "#f3ede2",
    botBubbleText: "#2a251d",
    userBubbleBg: "#14120f",
    userBubbleText: "#f5efe3",
    inputBg: "#fbf9f5",
    inputText: "#2a251d",
    bottomNavBg: "#14120f",
    bottomNavText: "#8e8271",
    bottomNavActive: "#c9a86a",
    bottomNavStyle: "luxury",
    bottomNavIndicator: "line",
    fontFamily: "Playfair Display",
    previewPalette: ["#14120f", "#c9a86a", "#fbf9f5"],
  },
};

export function getPresetSignature(id: string | null | undefined): PresetSignature {
  const norm = normalizeWidgetStyle(id);
  return PRESET_SIGNATURES[norm] || PRESET_SIGNATURES.minimal;
}

export function getPresetColorScheme(id: string | null | undefined): WidgetColorScheme {
  const sig = getPresetSignature(id);
  return {
    header: { bg: sig.headerBg, text: sig.headerText },
    botBubble: { bg: sig.botBubbleBg, text: sig.botBubbleText },
    userBubble: { bg: sig.userBubbleBg, text: sig.userBubbleText },
    inputBar: { bg: sig.inputBg, text: sig.inputText, icon: sig.primary },
    sendBtn: { bg: sig.primary, text: sig.onPrimary },
    launcher: { bg: sig.primary, text: sig.onPrimary },
    avatar: { bg: sig.primary, text: sig.onPrimary },
    bottomNav: {
      bg: sig.bottomNavBg,
      text: sig.bottomNavText,
      activeColor: sig.bottomNavActive,
      style: sig.bottomNavStyle,
      indicator: sig.bottomNavIndicator,
      showLabels: true,
      allowMinimize: true,
    },
  };
}
