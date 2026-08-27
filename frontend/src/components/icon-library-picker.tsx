"use client";

import { useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import { flushSync } from "react-dom";
import { createElement } from "react";
import { Search, X, Loader2 } from "lucide-react";
import { DynamicIcon, dynamicIconImports, iconNames } from "lucide-react/dynamic";
import { getOnColor } from "@/lib/color-contrast";

const COLOR_SWATCHES = [
  "#111111", "#ffffff", "#f97316", "#ef4444", "#22c55e",
  "#3b82f6", "#a855f7", "#ec4899", "#eab308", "#14b8a6",
];

const MAX_RESULTS = 120;

/** Renders `name` (kebab-case, per lucide-react/dynamic's IconName) at `color`
 * into a detached DOM node and serializes the result to a File. Handed to
 * the same upload endpoint a real file picked from disk would go through —
 * widget.js and EmbedClient.tsx only ever deal with the resulting storage
 * URL, so neither needs to know arbitrary icon libraries exist. */
async function iconToFile(name: string, color: string): Promise<File> {
  const loader = dynamicIconImports[name as keyof typeof dynamicIconImports];
  const mod = await loader();
  const IconComponent = mod.default;
  const container = document.createElement("div");
  const root = createRoot(container);
  flushSync(() => {
    root.render(createElement(IconComponent, { color, size: 64, strokeWidth: 2 }));
  });
  const svg = container.querySelector("svg");
  const markup = svg ? svg.outerHTML : "<svg xmlns=\"http://www.w3.org/2000/svg\"></svg>";
  root.unmount();
  return new File([markup], `${name}.svg`, { type: "image/svg+xml" });
}

interface IconLibraryPickerProps {
  onClose: () => void;
  onSelect: (file: File, name: string, color: string) => void;
  /** Re-opening on an existing selection (see avatarIconLibrarySelection in
   * dashboard/page.tsx) pre-fills the same icon/color instead of resetting
   * to defaults — this is what makes "change the color" actually work,
   * since the uploaded SVG file itself has no memory of its own color. */
  initialSelection?: { name: string; color: string } | null;
  /** Where the icon will actually be displayed (the avatar circle's
   * background) — used to default the color swatch to something that's
   * guaranteed visible there, instead of an arbitrary black that can go
   * invisible against a dark background the business owner already chose. */
  backgroundHex?: string;
}

export function IconLibraryPicker({ onClose, onSelect, initialSelection, backgroundHex }: IconLibraryPickerProps) {
  const [query, setQuery] = useState("");
  const [color, setColor] = useState(initialSelection?.color || getOnColor(backgroundHex || "#ffffff"));
  const [applying, setApplying] = useState<string | null>(null);
  const [selectedName, setSelectedName] = useState<string | null>(initialSelection?.name || null);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    const all = q ? iconNames.filter((n) => n.includes(q)) : iconNames;
    return all.slice(0, MAX_RESULTS);
  }, [query]);

  const pickWithColor = async (name: string, c: string) => {
    if (applying) return;
    setApplying(name);
    setSelectedName(name);
    try {
      const file = await iconToFile(name, c);
      onSelect(file, name, c);
    } finally {
      setApplying(null);
    }
  };
  const pick = (name: string) => pickWithColor(name, color);

  // Changing the color swatch re-bakes and re-uploads the CURRENTLY
  // selected icon at the new color immediately — this is what makes
  // "change its color after picking" actually possible, since the
  // uploaded SVG file has no live color to just tweak otherwise.
  const changeColor = (c: string) => {
    setColor(c);
    if (selectedName) pickWithColor(selectedName, c);
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/45 dark:bg-black/70 backdrop-blur-xs">
      <div onClick={onClose} className="absolute inset-0" />
      <div className="relative w-full max-w-lg bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-2xl shadow-2xl z-10 flex flex-col max-h-[80vh]">
        <div className="flex items-center justify-between px-4 pt-4 pb-3 border-b border-neutral-100 dark:border-neutral-850">
          <div>
            <h3 className="text-sm font-semibold">Choose an icon</h3>
            {selectedName && (
              <p className="text-[10px] text-neutral-400 mt-0.5">Editing <span className="font-medium text-neutral-500 dark:text-neutral-400">{selectedName}</span> — pick a color to update it, or click another icon.</p>
            )}
          </div>
          <button onClick={onClose} aria-label="Close" className="p-1 rounded-md hover:bg-neutral-100 dark:hover:bg-neutral-900 text-neutral-400 hover:text-neutral-900 dark:hover:text-white cursor-pointer">
            <X className="size-4" />
          </button>
        </div>
        {backgroundHex && color.toLowerCase() === backgroundHex.toLowerCase() && (
          <p className="px-4 pt-2 text-[10px] text-amber-600 dark:text-amber-500 font-medium">
            This color matches the avatar background exactly — the icon will be invisible. Pick a different color.
          </p>
        )}

        <div className="px-4 pt-3 pb-2 space-y-3 shrink-0">
          <div className="relative">
            <Search className="size-3.5 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search 1,500+ icons…"
              className="w-full bg-neutral-100 dark:bg-neutral-900 rounded-lg pl-9 pr-3 py-2 text-xs focus:outline-none"
            />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-semibold uppercase tracking-wide text-neutral-400">Color</span>
            <div className="flex items-center gap-1.5 flex-wrap">
              {COLOR_SWATCHES.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => changeColor(c)}
                  aria-label={`Use ${c}`}
                  className={`size-5 rounded-full border cursor-pointer transition-transform ${color === c ? "scale-110 ring-2 ring-offset-1 ring-[#f97316]" : "border-neutral-200 dark:border-neutral-700"}`}
                  style={{ background: c }}
                />
              ))}
              <label className="size-5 rounded-full border border-dashed border-neutral-300 dark:border-neutral-700 cursor-pointer relative overflow-hidden flex items-center justify-center">
                <input
                  type="color"
                  value={color}
                  onChange={(e) => changeColor(e.target.value)}
                  className="absolute inset-0 opacity-0 cursor-pointer"
                  aria-label="Custom color"
                />
                <span className="text-[9px] text-neutral-400">+</span>
              </label>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-4 pb-4">
          {results.length === 0 ? (
            <p className="text-[11px] text-neutral-400 text-center pt-8">No icons found</p>
          ) : (
            <div className="grid grid-cols-8 gap-1.5">
              {results.map((name) => (
                <button
                  key={name}
                  type="button"
                  onClick={() => pick(name)}
                  disabled={!!applying}
                  title={name}
                  className={`aspect-square rounded-lg flex items-center justify-center border transition-colors cursor-pointer disabled:cursor-wait ${
                    selectedName === name
                      ? "border-[#f97316] bg-[#f97316]/5"
                      : "border-transparent hover:border-neutral-200 dark:hover:border-neutral-800 hover:bg-neutral-50 dark:hover:bg-neutral-900"
                  }`}
                >
                  {applying === name ? (
                    <Loader2 className="size-4 animate-spin text-neutral-400" />
                  ) : (
                    <DynamicIcon name={name} size={20} color={color} />
                  )}
                </button>
              ))}
            </div>
          )}
          {results.length === MAX_RESULTS && (
            <p className="text-[10px] text-neutral-400 text-center pt-3">Showing the first {MAX_RESULTS} matches — keep typing to narrow it down.</p>
          )}
        </div>
      </div>
    </div>
  );
}
