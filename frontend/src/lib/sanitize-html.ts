import React from "react";

/**
 * Pure React element tree renderer for Help Center / Knowledge Base HTML articles.
 * Parses allowlisted HTML tags and attributes into React.createElement nodes
 * without using dangerouslySetInnerHTML, DOMParser.parseFromString, or regex
 * tag-stripping filters. All text content is passed as React text children
 * (rendered via TextNode), making script/attribute XSS impossible while
 * preserving full rich-text article formatting.
 */

const ALLOWED_TAGS = new Set([
  "p",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "strong",
  "b",
  "em",
  "i",
  "u",
  "s",
  "del",
  "mark",
  "sub",
  "sup",
  "ul",
  "ol",
  "li",
  "blockquote",
  "pre",
  "code",
  "a",
  "img",
  "br",
  "hr",
  "table",
  "thead",
  "tbody",
  "tfoot",
  "tr",
  "th",
  "td",
  "div",
  "span",
  "section",
  "article",
  "header",
  "footer",
  "figure",
  "figcaption",
  "details",
  "summary",
  "kbd",
  "samp",
  "small",
  "dl",
  "dt",
  "dd",
]);

const VOID_TAGS = new Set(["br", "hr", "img", "input", "meta", "link", "col", "area", "base", "source", "track", "wbr"]);

const DROP_SUBTREE_TAGS = new Set([
  "script",
  "style",
  "iframe",
  "object",
  "embed",
  "applet",
  "svg",
  "math",
  "template",
  "noscript",
  "head",
  "title",
]);

const NAMED_ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: "\u00A0",
  bull: "\u2022",
  mdash: "\u2014",
  ndash: "\u2013",
  rarr: "\u2192",
  larr: "\u2190",
  copy: "\u00A9",
  reg: "\u00AE",
  trade: "\u2122",
  hellip: "\u2026",
};

function decodeHtmlEntities(text: string): string {
  if (!text || !text.includes("&")) return text;
  return text.replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z]+);/g, (full, entity: string) => {
    if (entity.startsWith("#x") || entity.startsWith("#X")) {
      const code = Number.parseInt(entity.slice(2), 16);
      return Number.isFinite(code) && code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : full;
    }
    if (entity.startsWith("#")) {
      const code = Number.parseInt(entity.slice(1), 10);
      return Number.isFinite(code) && code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : full;
    }
    const lower = entity.toLowerCase();
    return Object.prototype.hasOwnProperty.call(NAMED_ENTITIES, lower) ? NAMED_ENTITIES[lower] : full;
  });
}

function isSafeUrlValue(raw: string): boolean {
  const trimmed = raw.replace(/[\u0000-\u0020]+/g, "").trim().toLowerCase();
  if (!trimmed) return false;
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

interface HtmlNode {
  tag: string;
  props: Record<string, unknown>;
  children: Array<HtmlNode | string>;
}

function parseAttributes(attrSource: string, tag: string): Record<string, unknown> {
  const props: Record<string, unknown> = {};
  const attrRegex = /([a-zA-Z_:][-a-zA-Z0-9_:.]*)\s*(?:=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;
  let match: RegExpExecArray | null;
  while ((match = attrRegex.exec(attrSource)) !== null) {
    const rawName = match[1].toLowerCase();
    const rawVal = decodeHtmlEntities(match[2] ?? match[3] ?? match[4] ?? "");
    if (rawName.startsWith("on") || rawName === "style" || rawName === "srcdoc") {
      continue;
    }
    if (rawName === "class" || rawName === "classname") {
      props.className = rawVal;
    } else if (rawName === "href") {
      if (tag === "a" && isSafeUrlValue(rawVal)) {
        props.href = rawVal;
        props.target = "_blank";
        props.rel = "noopener noreferrer";
      }
    } else if (rawName === "src") {
      if (tag === "img" && isSafeUrlValue(rawVal)) {
        props.src = rawVal;
      }
    } else if (rawName === "alt" || rawName === "title" || rawName === "id") {
      props[rawName] = rawVal;
    } else if (rawName === "colspan") {
      const n = Number.parseInt(rawVal, 10);
      if (Number.isFinite(n) && n > 0 && n <= 50) props.colSpan = n;
    } else if (rawName === "rowspan") {
      const n = Number.parseInt(rawVal, 10);
      if (Number.isFinite(n) && n > 0 && n <= 50) props.rowSpan = n;
    }
  }
  return props;
}

export function renderSafeArticleHtml(html: string): React.ReactNode {
  if (!html) return null;

  const root: HtmlNode = { tag: "root", props: {}, children: [] };
  const stack: HtmlNode[] = [root];
  let cursor = 0;
  const len = html.length;

  while (cursor < len) {
    const lt = html.indexOf("<", cursor);
    if (lt < 0) {
      const text = decodeHtmlEntities(html.slice(cursor));
      if (text) stack[stack.length - 1].children.push(text);
      break;
    }
    if (lt > cursor) {
      const text = decodeHtmlEntities(html.slice(cursor, lt));
      if (text) stack[stack.length - 1].children.push(text);
    }

    // Handle HTML comment <!-- ... -->
    if (html.startsWith("<!--", lt)) {
      const commentEnd = html.indexOf("-->", lt + 4);
      cursor = commentEnd >= 0 ? commentEnd + 3 : len;
      continue;
    }

    const gt = html.indexOf(">", lt + 1);
    if (gt < 0) {
      const text = decodeHtmlEntities(html.slice(lt));
      if (text) stack[stack.length - 1].children.push(text);
      break;
    }

    const inner = html.slice(lt + 1, gt).trim();
    cursor = gt + 1;

    if (!inner || inner.startsWith("!") || inner.startsWith("?")) {
      continue;
    }

    // Closing tag </tag>
    if (inner.startsWith("/")) {
      const closeTag = inner.slice(1).trim().split(/[\s/>]/)[0].toLowerCase();
      for (let i = stack.length - 1; i >= 1; i--) {
        if (stack[i].tag === closeTag) {
          stack.length = i;
          break;
        }
      }
      continue;
    }

    const selfClosing = inner.endsWith("/");
    const cleanInner = selfClosing ? inner.slice(0, -1).trim() : inner;
    const spaceIdx = cleanInner.search(/\s/);
    const tag = (spaceIdx >= 0 ? cleanInner.slice(0, spaceIdx) : cleanInner).toLowerCase();
    const attrPart = spaceIdx >= 0 ? cleanInner.slice(spaceIdx + 1) : "";

    // Drop dangerous container tags and their entire inner content
    if (DROP_SUBTREE_TAGS.has(tag)) {
      if (!selfClosing && !VOID_TAGS.has(tag)) {
        const lowerRest = html.slice(cursor).toLowerCase();
        const closeMatch = new RegExp(`<\\s*/\\s*${tag}[\\s>]`, "i").exec(lowerRest);
        if (closeMatch) {
          const afterClose = html.indexOf(">", cursor + closeMatch.index);
          cursor = afterClose >= 0 ? afterClose + 1 : len;
        } else {
          cursor = len;
        }
      }
      continue;
    }

    if (!ALLOWED_TAGS.has(tag)) {
      continue;
    }

    const props = parseAttributes(attrPart, tag);
    const node: HtmlNode = { tag, props, children: [] };
    stack[stack.length - 1].children.push(node);

    if (!selfClosing && !VOID_TAGS.has(tag)) {
      stack.push(node);
    }
  }

  let keyCounter = 0;
  function toReactNode(item: HtmlNode | string): React.ReactNode {
    if (typeof item === "string") return item;
    keyCounter += 1;
    const props = { ...item.props, key: `sh-${keyCounter}` };
    if (VOID_TAGS.has(item.tag)) {
      return React.createElement(item.tag, props);
    }
    const children = item.children.map(toReactNode);
    return React.createElement(item.tag, props, ...children);
  }

  return root.children.map(toReactNode);
}
