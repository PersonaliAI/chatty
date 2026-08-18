"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown, Check, Search } from "lucide-react";

export interface ModernSelectOption {
  value: string;
  label: string;
  icon?: React.ReactNode;
  hint?: string;
  disabled?: boolean;
}

interface ModernSelectProps {
  value: string;
  options: ModernSelectOption[];
  onChange: (value: string) => void;
  placeholder?: string;
  searchable?: boolean;
  disabled?: boolean;
  className?: string;
  align?: "left" | "right";
  size?: "sm" | "md";
}

/**
 * Accessible, animated dropdown with optional fuzzy search.
 * Closes on outside-click and Escape; keyboard-navigable list.
 */
export function ModernSelect({
  value,
  options,
  onChange,
  placeholder = "Select…",
  searchable = false,
  disabled = false,
  className = "",
  align = "left",
  size = "md",
}: ModernSelectProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const selected = options.find((o) => o.value === value);

  const filtered = useMemo(() => {
    if (!searchable || !query.trim()) return options;
    const q = query.toLowerCase();
    return options.filter(
      (o) => o.label.toLowerCase().includes(q) || o.value.toLowerCase().includes(q)
    );
  }, [options, query, searchable]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  useEffect(() => {
    if (open && searchable) setTimeout(() => searchRef.current?.focus(), 30);
    if (!open) {
      setQuery("");
      setActive(0);
    }
  }, [open, searchable]);

  const choose = (v: string) => {
    onChange(v);
    setOpen(false);
  };

  const pad = size === "sm" ? "px-2.5 py-1.5 text-[11px]" : "px-3 py-2 text-xs";

  return (
    <div ref={rootRef} className={`relative ${className}`}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
        className={`w-full flex items-center justify-between gap-2 ${pad} bg-neutral-50 dark:bg-neutral-950 border rounded-lg text-left transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
          open
            ? "border-[#f97316]/60 ring-2 ring-[#f97316]/15"
            : "border-neutral-200 dark:border-neutral-800 hover:border-neutral-350 dark:hover:border-neutral-700"
        }`}
      >
        <span className={`flex items-center gap-2 truncate ${selected ? "text-neutral-800 dark:text-neutral-200" : "text-neutral-400"}`}>
          {selected?.icon}
          <span className="truncate">{selected ? selected.label : placeholder}</span>
        </span>
        <ChevronDown className={`size-3.5 text-neutral-400 shrink-0 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -4, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.98 }}
            transition={{ duration: 0.13, ease: "easeOut" }}
            className={`absolute z-50 mt-1.5 w-max min-w-full max-w-[calc(100vw-2rem)] bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl shadow-xl overflow-hidden ${
              align === "right" ? "right-0" : "left-0"
            }`}
          >
            {searchable && (
              <div className="p-2 border-b border-neutral-100 dark:border-neutral-850">
                <div className="relative">
                  <Search className="size-3.5 text-neutral-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                  <input
                    ref={searchRef}
                    value={query}
                    onChange={(e) => {
                      setQuery(e.target.value);
                      setActive(0);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "ArrowDown") {
                        e.preventDefault();
                        setActive((a) => Math.min(a + 1, filtered.length - 1));
                      } else if (e.key === "ArrowUp") {
                        e.preventDefault();
                        setActive((a) => Math.max(a - 1, 0));
                      } else if (e.key === "Enter" && filtered[active]) {
                        e.preventDefault();
                        choose(filtered[active].value);
                      }
                    }}
                    placeholder="Search…"
                    className="w-full bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-lg pl-8 pr-2 py-1.5 text-[11px] focus:outline-none focus:border-neutral-350 dark:focus:border-neutral-700"
                  />
                </div>
              </div>
            )}
            <div className="max-h-60 overflow-y-auto py-1 scrollbar-thin">
              {filtered.length === 0 && (
                <div className="px-3 py-4 text-center text-[11px] text-neutral-400">No matches</div>
              )}
              {filtered.map((o, i) => {
                const isSel = o.value === value;
                return (
                  <button
                    key={o.value}
                    type="button"
                    disabled={o.disabled}
                    onMouseEnter={() => !o.disabled && setActive(i)}
                    onClick={() => !o.disabled && choose(o.value)}
                    className={`w-full flex items-center justify-between gap-2 px-3 py-2 text-left text-xs transition-colors ${
                      o.disabled ? "opacity-45 cursor-not-allowed" : "cursor-pointer"
                    } ${i === active && !o.disabled ? "bg-neutral-100 dark:bg-neutral-800" : ""} ${
                      isSel ? "text-[#f97316] font-semibold" : "text-neutral-700 dark:text-neutral-300"
                    }`}
                  >
                    <span className="flex items-center gap-2 truncate">
                      {o.icon}
                      <span className="truncate">{o.label}</span>
                      {o.hint && <span className="text-[10px] text-neutral-400">{o.hint}</span>}
                    </span>
                    {isSel && <Check className="size-3.5 shrink-0" />}
                  </button>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
