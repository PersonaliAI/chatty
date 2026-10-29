"use client";

import { Suspense, lazy, useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
// Types/enums only (erased at compile time) - must NOT import any runtime
// value from "emoji-picker-react" here, or its whole (large) module gets
// pulled into the eagerly-loaded parts of the bundle, defeating the point
// of dynamically importing the actual <EmojiPicker> component below.
import type { EmojiClickData, Theme, SuggestionMode, EmojiStyle } from "emoji-picker-react";

// Code-split: emoji-picker-react's full Unicode dataset has no business
// being in the main bundle for a component that opens on a click. Its own
// `lazyLoadEmojis` further defers per-category emoji images until scrolled
// into view - this is what "efficient, fast opening" actually looks like
// for a *complete* emoji set (as opposed to the old hand-picked ~100-emoji
// list this file used to ship, which only felt fast because it was tiny).
//
// emojiStyle below is set to native rather than the library's APPLE
// default: the image styles (apple/twitter/facebook/google) render every
// emoji as its own separate PNG fetched from a jsdelivr CDN - dozens of
// individual network requests just to fill one category's visible grid,
// which is what actually showed up as a slow, empty-looking picker.
// Native emoji use the browser/OS's own emoji font: zero network requests,
// so the grid paints as fast as any other text on the page.
//
// Plain React.lazy (not next/dynamic): this component is also bundled
// standalone via Vite for the public widget (see widget-entry.tsx), which
// has no next/dynamic. next/dynamic's ssr:false behavior isn't needed here
// either way - the picker only ever mounts after emojiOpen flips true from
// a click, well after hydration, so there's nothing for SSR to render.
const EmojiPicker = lazy(() => import("emoji-picker-react"));
const EmojiPickerFallback = () => (
  <div className="flex items-center justify-center h-full">
    <Loader2 className="size-5 animate-spin text-neutral-300" />
  </div>
);

interface QuickEmojiPickerProps {
  onSelect: (emoji: string) => void;
  accentColor?: string;
  theme?: "light" | "dark" | "auto";
}

export function QuickEmojiPicker({ onSelect, accentColor = "#f97316", theme }: QuickEmojiPickerProps) {
  const [systemIsDark, setSystemIsDark] = useState(false);
  useEffect(() => {
    const root = document.documentElement;
    const update = () => setSystemIsDark(root.classList.contains("dark"));
    update();
    const observer = new MutationObserver(update);
    observer.observe(root, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);

  const activeTheme: Theme =
    theme && theme !== "auto"
      ? (theme as Theme)
      : (systemIsDark ? ("dark" as Theme) : ("light" as Theme));

  return (
    <div
      className="flex flex-col h-full w-full min-w-0 max-w-full [&_.epr-main]:border-0 [&_.epr-main]:!h-full [&_.epr-main]:!w-full [&_.epr-main]:!min-w-0 [&_.epr-main]:!max-w-full [&_.epr-body]:!w-full [&_.epr-body]:!min-w-0 [&_.EmojiPickerReact]:!w-full [&_.EmojiPickerReact]:!min-w-0 [&_.EmojiPickerReact]:!max-w-full"
      style={{
        ["--epr-highlight-color" as string]: accentColor,
        ["--epr-bg-color" as string]: activeTheme === "dark" ? "#14141a" : "#ffffff",
        ["--epr-category-label-bg-color" as string]: activeTheme === "dark" ? "#14141a" : "#ffffff",
      }}
    >
      <Suspense fallback={<EmojiPickerFallback />}>
      <EmojiPicker
        onEmojiClick={(data: EmojiClickData) => onSelect(data.emoji)}
        theme={activeTheme}
        emojiStyle={"native" as EmojiStyle}
        lazyLoadEmojis
        autoFocusSearch
        suggestedEmojisMode={"frequent" as SuggestionMode}
        previewConfig={{ showPreview: false }}
        skinTonesDisabled={false}
        width="100%"
        height="100%"
        searchPlaceHolder="Search emoji…"
      />
      </Suspense>
    </div>
  );
}
