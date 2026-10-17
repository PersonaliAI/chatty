/**
 * DOMParser-based HTML sanitizer for Help Center / Knowledge Base articles.
 * Uses the browser's native HTML5 parser and an explicit tag/attribute policy
 * rather than regular expressions, avoiding incomplete multi-character
 * sanitization and malformed closing-tag bypasses.
 */

const BLOCKED_TAGS = new Set([
  "script",
  "style",
  "iframe",
  "object",
  "embed",
  "applet",
  "meta",
  "link",
  "base",
  "form",
  "input",
  "button",
  "textarea",
  "select",
  "option",
  "template",
  "noscript",
]);

const URL_ATTRIBUTES = new Set(["href", "src", "xlink:href", "action", "formaction"]);

function isSafeUrlValue(raw: string): boolean {
  const trimmed = raw.replace(/[\u0000-\u0020]+/g, "").trim().toLowerCase();
  if (!trimmed) return true;
  if (
    trimmed.startsWith("#") ||
    trimmed.startsWith("/") ||
    trimmed.startsWith("./") ||
    trimmed.startsWith("../")
  ) {
    return true;
  }
  return (
    trimmed.startsWith("https://") ||
    trimmed.startsWith("http://") ||
    trimmed.startsWith("mailto:") ||
    trimmed.startsWith("tel:")
  );
}

export function sanitizeArticleHtml(html: string): string {
  if (!html) return "";
  if (typeof window === "undefined" || typeof DOMParser === "undefined") {
    return "";
  }
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, "text/html");

  const elements = Array.from(doc.body.querySelectorAll("*"));
  for (const el of elements) {
    const tag = el.tagName.toLowerCase();
    if (BLOCKED_TAGS.has(tag)) {
      el.remove();
      continue;
    }
    for (const attr of Array.from(el.attributes)) {
      const name = attr.name.toLowerCase();
      if (name.startsWith("on") || name === "srcdoc" || name === "style") {
        el.removeAttribute(attr.name);
        continue;
      }
      if (URL_ATTRIBUTES.has(name) && !isSafeUrlValue(attr.value)) {
        el.setAttribute(attr.name, "#");
      }
    }
  }

  return doc.body.innerHTML;
}
