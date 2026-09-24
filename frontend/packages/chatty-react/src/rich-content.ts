export interface RichContentResult<TProduct extends object = Record<string, unknown>, TVideo extends object = Record<string, unknown>> {
  cleanContent: string;
  products: TProduct[];
  videoClips: TVideo[];
}

function extractMarker<T extends object>(source: string, marker: string): { text: string; items: T[] } {
  const items: T[] = [];
  let text = "";
  let cursor = 0;
  while (cursor < source.length) {
    const markerStart = source.indexOf(marker, cursor);
    if (markerStart < 0) {
      text += source.slice(cursor);
      break;
    }
    const jsonStart = source.indexOf("{", markerStart + marker.length);
    if (jsonStart < 0) {
      text += source.slice(cursor);
      break;
    }
    let depth = 0;
    let end = -1;
    let inString = false;
    let escaped = false;
    for (let index = jsonStart; index < source.length; index += 1) {
      const char = source[index];
      if (inString) {
        if (escaped) escaped = false;
        else if (char === "\\") escaped = true;
        else if (char === '"') inString = false;
        continue;
      }
      if (char === '"') inString = true;
      else if (char === "{") depth += 1;
      else if (char === "}" && --depth === 0) {
        end = index;
        break;
      }
    }
    if (end < 0 || source[end + 1] !== "]") {
      text += source.slice(cursor, markerStart + marker.length);
      cursor = markerStart + marker.length;
      continue;
    }
    let parsed: T | null = null;
    try {
      const candidate = JSON.parse(source.slice(jsonStart, end + 1));
      if (candidate && typeof candidate === "object" && !Array.isArray(candidate)) parsed = candidate as T;
    } catch {
      // Keep malformed content visible to the visitor.
    }
    text += source.slice(cursor, markerStart);
    if (parsed) items.push(parsed);
    else text += source.slice(markerStart, end + 2);
    cursor = end + 2;
  }
  return { text, items };
}

export function parseRichContent<TProduct extends object = Record<string, unknown>, TVideo extends object = Record<string, unknown>>(
  content: string,
): RichContentResult<TProduct, TVideo> {
  const productResult = extractMarker<TProduct>(content, "[PRODUCT_CARD:");
  const videoResult = extractMarker<TVideo>(productResult.text, "[VIDEO_CLIP:");
  return {
    cleanContent: videoResult.text.replace(/\[BOOKING_WIDGET\]/g, "").trim(),
    products: productResult.items,
    videoClips: videoResult.items,
  };
}
