"use client";

import { useState, useRef, useEffect, useLayoutEffect, useMemo, useId, useCallback } from "react";
import { createPortal } from "react-dom";
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
  id?: string;
  "aria-label"?: string;
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
  id,
  "aria-label": ariaLabel,
}: ModernSelectProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const popupRef = useRef<HTMLDivElement>(null);
  const listId = useId();
  const [position, setPosition] = useState({ left: 0, top: 0, width: 0, maxHeight: 300 });

  const placePopup = useCallback(() => {
    if (!rootRef.current) return;
    const rect = rootRef.current.getBoundingClientRect();
    const width = Math.min(340, window.innerWidth - 24);
    const popupWidth = popupRef.current?.offsetWidth || Math.min(rect.width, width);
    const below = window.innerHeight - rect.bottom - 12;
    const upwards = below < 250 && rect.top > 200;
    setOpenUpwards(upwards);
    setPosition({
      left: Math.max(12, Math.min(align === "right" ? rect.right - popupWidth : rect.left, window.innerWidth - popupWidth - 12)),
      top: upwards ? window.innerHeight - rect.top + 6 : rect.bottom + 6,
      width: Math.min(rect.width, width),
      maxHeight: Math.max(80, Math.min(300, upwards ? rect.top - 18 : below - 6)),
    });
  }, [align]);

  useLayoutEffect(() => { if (open) placePopup(); }, [open, placePopup]);

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
      if (!rootRef.current?.contains(e.target as Node) && !popupRef.current?.contains(e.target as Node)) setOpen(false);
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
    if (!open) return;
    window.addEventListener("resize", placePopup);
    window.addEventListener("scroll", placePopup, true);
    return () => {
      window.removeEventListener("resize", placePopup);
      window.removeEventListener("scroll", placePopup, true);
    };
  }, [open, placePopup]);

  useEffect(() => {
    if (open && searchable) setTimeout(() => searchRef.current?.focus(), 30);
    if (!open) {
      // Resets search/highlight state whenever the dropdown closes. `open`
      // is toggled from several places (outside-click, Escape, the trigger
      // button) - consolidating this into each of those call sites would be
      // a larger refactor than this warning justifies.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setQuery("");
      setActive(0);
    }
  }, [open, searchable]);

  const [openUpwards, setOpenUpwards] = useState(false);

  const toggleOpen = () => {
    if (disabled) return;
    if (!open) placePopup();
    setOpen((o) => !o);
  };

  const choose = (v: string) => {
    onChange(v);
    setOpen(false);
    rootRef.current?.querySelector("button")?.focus();
  };

  const pad = size === "sm" ? "px-2.5 py-1.5 text-[11px]" : "px-3 py-2 text-xs";

  return (
    <div ref={rootRef} className={`relative ${className}`}>
      <button
        data-modern-select-trigger
        id={id}
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        type="button"
        disabled={disabled}
        onClick={toggleOpen}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            event.preventDefault();
            if (!open) { placePopup(); setOpen(true); }
            requestAnimationFrame(() => popupRef.current?.querySelector<HTMLButtonElement>('button[role="option"]:not(:disabled)')?.focus());
          }
        }}
        className={`w-full flex items-center justify-between gap-2 ${pad} bg-neutral-50 dark:bg-neutral-950 border rounded-lg text-left transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
          open
            ? "border-[#f97316]/60 ring-2 ring-[#f97316]/15"
            : "border-neutral-200 dark:border-neutral-800 hover:border-neutral-350 dark:hover:border-neutral-700"
        }`}
      >
        <span className={`flex items-center gap-2 whitespace-nowrap min-w-0 ${selected ? "text-neutral-800 dark:text-neutral-200" : "text-neutral-400"}`}>
          {selected?.icon}
          <span className="truncate">{selected ? selected.label : placeholder}</span>
        </span>
        <ChevronDown className={`size-3.5 text-neutral-400 shrink-0 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && createPortal(<AnimatePresence>
        {open && (
          <motion.div
            data-modern-select-popup
            onKeyDown={(event) => {
              if ((event.target as HTMLElement).tagName === "INPUT") return;
              const options = Array.from(popupRef.current?.querySelectorAll<HTMLButtonElement>('button[role="option"]:not(:disabled)') || []);
              const current = options.indexOf(document.activeElement as HTMLButtonElement);
              const next = event.key === "ArrowDown" ? (current + 1) % options.length
                : event.key === "ArrowUp" ? (current - 1 + options.length) % options.length
                : event.key === "Home" ? 0 : event.key === "End" ? options.length - 1 : -1;
              if (next >= 0) { event.preventDefault(); options[next]?.focus(); }
              if (event.key === "Escape") rootRef.current?.querySelector("button")?.focus();
            }}
            ref={popupRef}
            style={{
              left: position.left,
              ...(openUpwards ? { bottom: position.top } : { top: position.top }),
              minWidth: position.width,
              maxWidth: "min(340px, calc(100vw - 24px))",
              maxHeight: position.maxHeight,
            }}
            initial={{ opacity: 0, y: openUpwards ? 4 : -4, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: openUpwards ? 4 : -4, scale: 0.98 }}
            transition={{ duration: 0.13, ease: "easeOut" }}
            className="fixed z-[9999] w-max bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl shadow-2xl overflow-y-auto"
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
                      } else if (e.key === "Enter" && filtered[active] && !filtered[active].disabled) {
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
            <div id={listId} role="listbox" aria-label={ariaLabel || placeholder} className="max-h-60 overflow-y-auto py-1 scrollbar-thin">
              {filtered.length === 0 && (
                <div className="px-3 py-4 text-center text-[11px] text-neutral-400">No matches</div>
              )}
              {filtered.map((o, i) => {
                const isSel = o.value === value;
                return (
                  <button
                    key={o.value}
                    type="button"
                    role="option"
                    aria-selected={isSel}
                    disabled={o.disabled}
                    onMouseEnter={() => !o.disabled && setActive(i)}
                    onClick={() => !o.disabled && choose(o.value)}
                    className={`w-full flex items-center justify-between gap-3 px-3 py-2 text-left text-xs transition-colors ${
                      o.disabled ? "opacity-45 cursor-not-allowed" : "cursor-pointer"
                    } ${i === active && !o.disabled ? "bg-neutral-100 dark:bg-neutral-800" : ""} ${
                      isSel ? "text-[#f97316] font-semibold" : "text-neutral-700 dark:text-neutral-300"
                    }`}
                  >
                    <span className="flex min-w-0 items-center gap-2">
                      {o.icon}
                      <span className="min-w-0 whitespace-normal break-words font-medium">{o.label}</span>
                      {o.hint && <span className="text-[10px] text-neutral-400 ml-1">({o.hint})</span>}
                    </span>
                    {isSel && <Check className="size-3.5 text-[#f97316] shrink-0" />}
                  </button>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>, rootRef.current?.closest("[data-dashboard]") || document.body)}
    </div>
  );
}
