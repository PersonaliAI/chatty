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

/** Returns the higher-contrast of white / near-black text for a given background hex. */
export function getOnColor(backgroundHex: string): "#ffffff" | "#111827" {
  const [r, g, b] = hexToRgb(backgroundHex);
  const bgLum = relativeLuminance(r, g, b);
  const whiteContrast = contrastRatio(bgLum, 1);
  const blackContrast = contrastRatio(bgLum, relativeLuminance(0x11, 0x18, 0x27));
  return whiteContrast >= blackContrast ? "#ffffff" : "#111827";
}
