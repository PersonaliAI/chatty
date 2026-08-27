"use client";

import { useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import { flushSync } from "react-dom";
import { createElement } from "react";
import { Search, X, Loader2 } from "lucide-react";
import { DynamicIcon, dynamicIconImports, iconNames } from "lucide-react/dynamic";

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
  onSelect: (file: File) => void;
}

export function IconLibraryPicker({ onClose, onSelect }: IconLibraryPickerProps) {
  const [query, setQuery] = useState("");
  const [color, setColor] = useState("#111111");
  const [applying, setApplying] = useState<string | null>(null);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    const all = q ? iconNames.filter((n) => n.includes(q)) : iconNames;
    return all.slice(0, MAX_RESULTS);
  }, [query]);

  const pick = async (name: string) => {
    if (applying) return;
    setApplying(name);
    try {
      const file = await iconToFile(name, color);
      onSelect(file);
    } finally {
      setApplying(null);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/45 dark:bg-black/70 backdrop-blur-xs">
      <div onClick={onClose} className="absolute inset-0" />
      <div className="relative w-full max-w-lg bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-2xl shadow-2xl z-10 flex flex-col max-h-[80vh]">
        <div className="flex items-center justify-between px-4 pt-4 pb-3 border-b border-neutral-100 dark:border-neutral-850">
          <h3 className="text-sm font-semibold">Choose an icon</h3>
          <button onClick={onClose} aria-label="Close" className="p-1 rounded-md hover:bg-neutral-100 dark:hover:bg-neutral-900 text-neutral-400 hover:text-neutral-900 dark:hover:text-white cursor-pointer">
            <X className="size-4" />
          </button>
        </div>

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
                  onClick={() => setColor(c)}
                  aria-label={`Use ${c}`}
                  className={`size-5 rounded-full border cursor-pointer transition-transform ${color === c ? "scale-110 ring-2 ring-offset-1 ring-[#f97316]" : "border-neutral-200 dark:border-neutral-700"}`}
                  style={{ background: c }}
                />
              ))}
              <label className="size-5 rounded-full border border-dashed border-neutral-300 dark:border-neutral-700 cursor-pointer relative overflow-hidden flex items-center justify-center">
                <input
                  type="color"
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
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
                  className="aspect-square rounded-lg flex items-center justify-center border border-transparent hover:border-neutral-200 dark:hover:border-neutral-800 hover:bg-neutral-50 dark:hover:bg-neutral-900 transition-colors cursor-pointer disabled:cursor-wait"
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
