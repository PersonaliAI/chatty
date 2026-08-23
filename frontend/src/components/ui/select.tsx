"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Check, ChevronDown, Search } from "lucide-react";
import { cn } from "@/lib/utils";

export type SelectOption = {
  value: string;
  label: string;
  /** Leading visual — emoji string or icon element */
  leading?: React.ReactNode;
  /** Trailing label, e.g. timezone offset */
  trailing?: string;
};

export function SearchSelect({
  value,
  onChange,
  options,
  placeholder = "Select...",
  disabled = false,
  className,
  emptyHint = "No matches",
}: {
  value: string | null | undefined;
  onChange: (v: string) => void;
  options: SelectOption[];
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  emptyHint?: string;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [highlight, setHighlight] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const selected = useMemo(
    () => options.find((o) => o.value === value) ?? null,
    [options, value],
  );

  const filtered = useMemo(() => {
    if (!q.trim()) return options;
    const t = q.toLowerCase();
    return options.filter(
      (o) =>
        o.label.toLowerCase().includes(t) ||
        o.value.toLowerCase().includes(t) ||
        (o.trailing ?? "").toLowerCase().includes(t),
    );
  }, [options, q]);

  // Close on outside click
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  // Focus search on open + scroll highlighted into view. `open` is toggled
  // from several places (outside-click, the trigger button) — consolidating
  // this reset into each of those call sites would be a larger refactor
  // than this warning justifies.
  useEffect(() => {
    if (open) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setQ("");
      setHighlight(0);
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  useEffect(() => {
    const el = listRef.current?.querySelector(
      `[data-idx="${highlight}"]`,
    ) as HTMLElement | null;
    el?.scrollIntoView({ block: "nearest" });
  }, [highlight, filtered]);

  function pick(opt: SelectOption) {
    onChange(opt.value);
    setOpen(false);
  }

  function onKey(e: React.KeyboardEvent) {
    if (!open) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlight((h) => Math.min(h + 1, filtered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlight((h) => Math.max(h - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const o = filtered[highlight];
      if (o) pick(o);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((s) => !s)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={cn(
          "w-full h-10 px-3 bg-background border rounded-md text-sm flex items-center gap-2 transition-colors disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer",
          open
            ? "border-foreground/30 ring-1 ring-foreground/10"
            : "border-border hover:border-foreground/20",
        )}
      >
        {selected ? (
          <>
            {selected.leading && (
              <span className="shrink-0">{selected.leading}</span>
            )}
            <span className="flex-1 text-left truncate">{selected.label}</span>
            {selected.trailing && (
              <span className="text-[11px] text-muted-foreground shrink-0">
                {selected.trailing}
              </span>
            )}
          </>
        ) : (
          <span className="flex-1 text-left text-muted-foreground">{placeholder}</span>
        )}
        <ChevronDown
          className={cn(
            "size-4 text-muted-foreground shrink-0 transition-transform",
            open && "rotate-180",
          )}
        />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -4, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.98 }}
            transition={{ duration: 0.12 }}
            className="absolute z-30 mt-1.5 w-full rounded-xl border border-border bg-card shadow-xl overflow-hidden"
            onKeyDown={onKey}
          >
            <div className="flex items-center gap-2 px-3 py-2 border-b border-border bg-background/40">
              <Search className="size-3.5 text-muted-foreground" />
              <input
                ref={inputRef}
                value={q}
                onChange={(e) => {
                  setQ(e.target.value);
                  setHighlight(0);
                }}
                onKeyDown={onKey}
                placeholder="Search…"
                className="flex-1 bg-transparent text-sm focus:outline-none placeholder:text-muted-foreground"
              />
            </div>
            <div
              ref={listRef}
              className="max-h-64 overflow-y-auto py-1"
              role="listbox"
            >
              {filtered.length === 0 ? (
                <div className="px-3 py-6 text-center text-xs text-muted-foreground">
                  {emptyHint}
                </div>
              ) : (
                filtered.map((opt, idx) => {
                  const active = idx === highlight;
                  const isSelected = opt.value === value;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      data-idx={idx}
                      onMouseEnter={() => setHighlight(idx)}
                      onClick={() => pick(opt)}
                      role="option"
                      aria-selected={isSelected}
                      className={cn(
                        "w-full flex items-center gap-2 px-3 py-2 text-sm text-left cursor-pointer",
                        active && "bg-muted",
                      )}
                    >
                      {opt.leading && (
                        <span className="shrink-0">{opt.leading}</span>
                      )}
                      <span className="flex-1 truncate">{opt.label}</span>
                      {opt.trailing && (
                        <span className="text-[11px] text-muted-foreground shrink-0">
                          {opt.trailing}
                        </span>
                      )}
                      {isSelected && (
                        <Check className="size-3.5 text-foreground shrink-0" />
                      )}
                    </button>
                  );
                })
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
