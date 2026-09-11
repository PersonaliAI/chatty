export async function extractColorsFromUrl(url: string): Promise<string[]> {
  return new Promise((resolve) => {
    if (!url) return resolve([]);
    const img = new window.Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");
        if (!ctx) return resolve([]);

        canvas.width = 40;
        canvas.height = 40;
        ctx.drawImage(img, 0, 0, 40, 40);

        const imgData = ctx.getImageData(0, 0, 40, 40).data;
        const colorCounts: Record<string, number> = {};

        for (let i = 0; i < imgData.length; i += 4) {
          const r = imgData[i];
          const g = imgData[i + 1];
          const b = imgData[i + 2];
          const a = imgData[i + 3];

          if (a < 128) continue;

          const brightness = (r * 299 + g * 587 + b * 114) / 1000;
          if (brightness > 245 || brightness < 15) continue;

          const clusterR = Math.round(r / 16) * 16;
          const clusterG = Math.round(g / 16) * 16;
          const clusterB = Math.round(b / 16) * 16;

          const hex = "#" + [clusterR, clusterG, clusterB].map((x) => {
            const hexStr = Math.min(255, Math.max(0, x)).toString(16);
            return hexStr.length === 1 ? "0" + hexStr : hexStr;
          }).join("");

          colorCounts[hex] = (colorCounts[hex] || 0) + 1;
        }

        const sortedColors = Object.keys(colorCounts).sort((a, b) => colorCounts[b] - colorCounts[a]);
        resolve(sortedColors.slice(0, 5));
      } catch (e) {
        console.error("Color extraction error:", e);
        resolve([]);
      }
    };
    img.onerror = () => resolve([]);
    img.src = url;
  });
}
