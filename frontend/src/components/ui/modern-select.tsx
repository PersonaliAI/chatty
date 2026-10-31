"use client";

import { useState, useRef, useEffect, useMemo, useId } from "react";
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
  popupWidth?: string;
  popupClassName?: string;
}

/**
 * Accessible, modern dropdown with optional fuzzy search.
 * Anchored directly to trigger container with pure relative/absolute positioning.
 * Closes on outside-click (mouse & touch) and Escape; keyboard-navigable list.
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
  popupWidth,
  popupClassName = "",
}: ModernSelectProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const [openUpwards, setOpenUpwards] = useState(false);
  const [computedAlign, setComputedAlign] = useState<"left" | "right">(align);
  const rootRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const popupRef = useRef<HTMLDivElement>(null);
  const listId = useId();

  const selected = options.find((o) => o.value === value);

  const filtered = useMemo(() => {
    if (!searchable || !query.trim()) return options;
    const q = query.toLowerCase();
    return options.filter(
      (o) => o.label.toLowerCase().includes(q) || o.value.toLowerCase().includes(q)
    );
  }, [options, query, searchable]);

  const updatePopupPlacement = () => {
    if (!rootRef.current || typeof window === "undefined") return;
    const rect = rootRef.current.getBoundingClientRect();
    const below = window.innerHeight - rect.bottom;
    setOpenUpwards(below < 220 && rect.top > 220);

    // Prevent horizontal viewport cropping on mobile / narrow screens
    const estimatedPopupWidth = Math.max(rect.width, 200);
    const spaceRight = window.innerWidth - rect.left;
    const spaceLeft = rect.right;
    if (align === "left" && spaceRight < estimatedPopupWidth + 16 && spaceLeft > spaceRight) {
      setComputedAlign("right");
    } else if (align === "right" && spaceLeft < estimatedPopupWidth + 16 && spaceRight > spaceLeft) {
      setComputedAlign("left");
    } else {
      setComputedAlign(align);
    }
  };

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent | TouchEvent) => {
      const target = e.target as Node;
      if (!rootRef.current?.contains(target) && !popupRef.current?.contains(target)) {
        setOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        rootRef.current?.querySelector("button")?.focus();
      }
    };
    const onResize = () => updatePopupPlacement();
    document.addEventListener("mousedown", onDown);
    document.addEventListener("touchstart", onDown);
    document.addEventListener("keydown", onKey);
    window.addEventListener("resize", onResize);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("touchstart", onDown);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", onResize);
    };
  }, [open, align]);

  useEffect(() => {
    if (open && searchable) setTimeout(() => searchRef.current?.focus(), 30);
    if (!open) {
      setQuery("");
      setActive(0);
    }
  }, [open, searchable]);

  const toggleOpen = () => {
    if (disabled) return;
    if (!open) {
      updatePopupPlacement();
    }
    setOpen((o) => !o);
  };

  const choose = (v: string) => {
    onChange(v);
    setOpen(false);
    rootRef.current?.querySelector("button")?.focus();
  };

  const pad = size === "sm" ? "px-2.5 py-1.5 text-[11px]" : "px-3 py-2 text-xs";
  const hasExplicitWidth = /\b(w-|min-w-|max-w-|flex-1|flex-auto|flex-initial|inline-)/.test(className);

  return (
    <div ref={rootRef} className={`relative ${hasExplicitWidth ? "" : "w-full"} ${className}`.trim()}>
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
            if (!open) {
              updatePopupPlacement();
              setOpen(true);
            }
            requestAnimationFrame(() =>
              popupRef.current?.querySelector<HTMLButtonElement>('button[role="option"]:not(:disabled)')?.focus()
            );
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

      {open && (
        <div
          data-modern-select-popup={listId}
          ref={popupRef}
          onKeyDown={(event) => {
            if ((event.target as HTMLElement).tagName === "INPUT") return;
            const optionBtns = Array.from(popupRef.current?.querySelectorAll<HTMLButtonElement>('button[role="option"]:not(:disabled)') || []);
            const current = optionBtns.indexOf(document.activeElement as HTMLButtonElement);
            const next =
              event.key === "ArrowDown"
                ? (current + 1) % optionBtns.length
                : event.key === "ArrowUp"
                ? (current - 1 + optionBtns.length) % optionBtns.length
                : event.key === "Home"
                ? 0
                : event.key === "End"
                ? optionBtns.length - 1
                : -1;
            if (next >= 0) {
              event.preventDefault();
              optionBtns[next]?.focus();
            }
            if (event.key === "Escape") rootRef.current?.querySelector("button")?.focus();
          }}
          className={`absolute z-[100] max-w-[calc(100vw-1.5rem)] ${
            openUpwards ? "bottom-full mb-1.5" : "top-full mt-1.5"
          } ${
            computedAlign === "right" ? "right-0" : "left-0"
          } ${popupWidth || "w-full min-w-full"} bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl shadow-2xl overflow-hidden ${popupClassName}`}
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
          <div id={listId} role="listbox" aria-label={ariaLabel || placeholder} className="max-h-60 overflow-y-auto py-1 chatty-custom-scrollbar [scrollbar-width:thin] [scrollbar-color:rgba(156,163,175,0.4)_transparent] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-neutral-300 dark:[&::-webkit-scrollbar-thumb]:bg-neutral-700 [&::-webkit-scrollbar-thumb]:rounded-full hover:[&::-webkit-scrollbar-thumb]:bg-neutral-400 dark:hover:[&::-webkit-scrollbar-thumb]:bg-neutral-600">
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
                  className={`w-full flex items-start justify-between gap-3 px-3.5 py-2.5 text-left text-xs transition-colors ${
                    o.disabled ? "opacity-45 cursor-not-allowed" : "cursor-pointer"
                  } ${i === active && !o.disabled ? "bg-neutral-100/80 dark:bg-neutral-800/80" : ""} ${
                    isSel ? "bg-[#f97316]/5 dark:bg-[#f97316]/10" : ""
                  }`}
                >
                  <div className="flex flex-col min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      {o.icon}
                      <span className={`font-semibold text-xs leading-snug break-words ${isSel ? "text-[#f97316]" : "text-neutral-800 dark:text-neutral-200"}`}>
                        {o.label}
                      </span>
                    </div>
                    {o.hint && (
                      <span className="text-[11px] text-neutral-400 dark:text-neutral-500 leading-snug mt-0.5 whitespace-normal break-words">
                        {o.hint}
                      </span>
                    )}
                  </div>
                  {isSel && <Check className="size-3.5 text-[#f97316] shrink-0 mt-0.5" />}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
