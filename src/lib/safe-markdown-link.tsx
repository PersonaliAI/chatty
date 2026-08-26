import type { CSSProperties, ReactNode } from "react";

/**
 * react-markdown (v6+) does not sanitize link URI schemes on its own — a
 * `[click me](javascript:...)` link in assistant/bot output (LLM-generated,
 * or sourced from a crawled page / uploaded document) would otherwise
 * render as a clickable `javascript:` href. Only allow schemes that can't
 * execute script when clicked.
 */
const SAFE_SCHEMES = ["http:", "https:", "mailto:", "tel:"];

export function isSafeHref(href: string | undefined): boolean {
  if (!href) return false;
  const trimmed = href.trim();
  // Relative/same-origin paths ("/foo", "#section", "?q=1") have no scheme
  // to abuse and are always safe.
  if (/^(\/|#|\?)/.test(trimmed)) return true;
  try {
    return SAFE_SCHEMES.includes(new URL(trimmed, "https://placeholder.invalid").protocol);
  } catch {
    return false;
  }
}

/** Drop-in `a` component for ReactMarkdown's `components` prop. Renders
 * unsafe-scheme links as inert text instead of a clickable anchor. */
export function SafeMarkdownLink({
  href,
  children,
  className,
  style,
}: {
  href?: string;
  children?: ReactNode;
  className?: string;
  style?: CSSProperties;
}) {
  if (!isSafeHref(href)) return <span className={className}>{children}</span>;
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className={className} style={style}>
      {children}
    </a>
  );
}
