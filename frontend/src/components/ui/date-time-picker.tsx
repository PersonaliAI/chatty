"use client";

import React, { useState, useRef, useEffect, useMemo } from "react";
import {
  Calendar as CalendarIcon,
  Clock,
  ChevronLeft,
  ChevronRight,
  X,
  Check,
} from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { ModernSelect } from "./modern-select";

function TimeFields({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const [hour = "09", minute = "00"] = (value || "09:00").split(":");
  return (
    <div className="flex min-w-0 items-center gap-1">
      <ModernSelect size="sm" aria-label="Hour" className="w-16" value={hour} options={Array.from({ length: 24 }, (_, i) => ({ value: String(i).padStart(2, "0"), label: String(i).padStart(2, "0") }))} onChange={(h) => onChange(`${h}:${minute}`)} />
      <span className="text-neutral-400">:</span>
      <ModernSelect size="sm" aria-label="Minute" className="w-16" value={minute} options={Array.from({ length: 60 }, (_, i) => ({ value: String(i).padStart(2, "0"), label: String(i).padStart(2, "0") }))} onChange={(m) => onChange(`${hour}:${m}`)} />
    </div>
  );
}

interface DateTimePickerProps {
  value: string; // ISO string or "YYYY-MM-DDTHH:mm"
  onChange: (value: string) => void;
  placeholder?: string;
  min?: string;
  max?: string;
  disabled?: boolean;
  label?: string;
  className?: string;
  size?: "sm" | "md";
}

export function DateTimePicker({
  value,
  onChange,
  placeholder = "Select date & time…",
  min,
  max,
  disabled = false,
  label,
  className = "",
  size = "md",
}: DateTimePickerProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Parse current value
  const parsedDate = useMemo(() => {
    if (!value) return null;
    const d = new Date(value);
    return isNaN(d.getTime()) ? null : d;
  }, [value]);

  // Calendar view state (which month we are displaying)
  const [viewDate, setViewDate] = useState<Date>(() => parsedDate || new Date());
  const [selectedTime, setSelectedTime] = useState<string>(() => {
    if (parsedDate) {
      const h = String(parsedDate.getHours()).padStart(2, "0");
      const m = String(parsedDate.getMinutes()).padStart(2, "0");
      return `${h}:${m}`;
    }
    return "09:00";
  });

  useEffect(() => {
    if (parsedDate) {
      setViewDate(parsedDate);
      const h = String(parsedDate.getHours()).padStart(2, "0");
      const m = String(parsedDate.getMinutes()).padStart(2, "0");
      setSelectedTime(`${h}:${m}`);
    }
  }, [parsedDate]);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      if ((e.target as HTMLElement).closest("[data-modern-select-popup]")) return;
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKey);
    };
  }, [open]);

  // Generate calendar days for the current viewDate month
  const calendarDays = useMemo(() => {
    const year = viewDate.getFullYear();
    const month = viewDate.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    const days: Array<{ day: number; currentMonth: boolean; date: Date }> = [];

    // Preceding month trailing days
    const prevMonthDays = new Date(year, month, 0).getDate();
    for (let i = firstDay - 1; i >= 0; i--) {
      const day = prevMonthDays - i;
      days.push({
        day,
        currentMonth: false,
        date: new Date(year, month - 1, day),
      });
    }

    // Current month days
    for (let i = 1; i <= daysInMonth; i++) {
      days.push({
        day: i,
        currentMonth: true,
        date: new Date(year, month, i),
      });
    }

    // Trailing next month days to make complete 6 rows (42 days)
    const remaining = 42 - days.length;
    for (let i = 1; i <= remaining; i++) {
      days.push({
        day: i,
        currentMonth: false,
        date: new Date(year, month + 1, i),
      });
    }

    return days;
  }, [viewDate]);

  const handlePrevMonth = () => {
    setViewDate((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
  };

  const handleNextMonth = () => {
    setViewDate((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
  };

  const handleSelectDay = (targetDate: Date) => {
    const [hours, minutes] = selectedTime.split(":").map(Number);
    const newDate = new Date(targetDate);
    newDate.setHours(hours ?? 9, minutes ?? 0, 0, 0);

    const year = newDate.getFullYear();
    const month = String(newDate.getMonth() + 1).padStart(2, "0");
    const day = String(newDate.getDate()).padStart(2, "0");
    const h = String(newDate.getHours()).padStart(2, "0");
    const m = String(newDate.getMinutes()).padStart(2, "0");

    onChange(`${year}-${month}-${day}T${h}:${m}`);
  };

  const handleTimeChange = (newTime: string) => {
    setSelectedTime(newTime);
    const base = parsedDate || new Date();
    const [hours, minutes] = newTime.split(":").map(Number);
    const newDate = new Date(base);
    newDate.setHours(hours || 0, minutes || 0, 0, 0);

    const year = newDate.getFullYear();
    const month = String(newDate.getMonth() + 1).padStart(2, "0");
    const day = String(newDate.getDate()).padStart(2, "0");
    const h = String(newDate.getHours()).padStart(2, "0");
    const m = String(newDate.getMinutes()).padStart(2, "0");

    onChange(`${year}-${month}-${day}T${h}:${m}`);
  };

  const applyPreset = (preset: "today" | "tomorrow" | "3days" | "1week" | "now") => {
    const now = new Date();
    let target = new Date();
    if (preset === "now") {
      target = new Date();
    } else if (preset === "today") {
      target.setHours(9, 0, 0, 0);
      if (target.getTime() < now.getTime()) {
        target.setHours(now.getHours() + 1, 0, 0, 0);
      }
    } else if (preset === "tomorrow") {
      target.setDate(now.getDate() + 1);
      target.setHours(9, 0, 0, 0);
    } else if (preset === "3days") {
      target.setDate(now.getDate() + 3);
      target.setHours(9, 0, 0, 0);
    } else if (preset === "1week") {
      target.setDate(now.getDate() + 7);
      target.setHours(9, 0, 0, 0);
    }

    const year = target.getFullYear();
    const month = String(target.getMonth() + 1).padStart(2, "0");
    const day = String(target.getDate()).padStart(2, "0");
    const h = String(target.getHours()).padStart(2, "0");
    const m = String(target.getMinutes()).padStart(2, "0");

    onChange(`${year}-${month}-${day}T${h}:${m}`);
    setViewDate(target);
    setSelectedTime(`${h}:${m}`);
  };

  const formatDisplay = () => {
    if (!parsedDate) return null;
    return parsedDate.toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  };

  const pad = size === "sm" ? "px-2.5 py-1.5 text-[11px]" : "px-3 py-2 text-xs";
  const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];
  const dayHeaders = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      {label && (
        <label className="block text-[10px] font-bold text-neutral-500 uppercase tracking-wider mb-1.5">
          {label}
        </label>
      )}

      <div className="relative">
        <button
          type="button"
          disabled={disabled}
          onClick={() => setOpen(!open)}
          className={`w-full flex items-center justify-between gap-2.5 ${pad} bg-white dark:bg-neutral-900 border rounded-xl text-left transition-all cursor-pointer ${
            open
              ? "border-[#f97316] ring-2 ring-[#f97316]/15 shadow-sm"
              : "border-neutral-200 dark:border-neutral-800 hover:border-neutral-300 dark:hover:border-neutral-700"
          } ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}
        >
          <div className="flex items-center gap-2 truncate">
            <CalendarIcon className="size-3.5 text-neutral-400 shrink-0" />
            {parsedDate ? (
              <span className="font-semibold text-neutral-800 dark:text-neutral-100 truncate">
                {formatDisplay()}
              </span>
            ) : (
              <span className="text-neutral-400 font-normal truncate">{placeholder}</span>
            )}
          </div>

          <div className="flex items-center gap-1 shrink-0">
            {parsedDate && !disabled && (
              <span
                role="button"
                tabIndex={0}
                onClick={(e) => {
                  e.stopPropagation();
                  onChange("");
                }}
                className="p-1 rounded-md text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 cursor-pointer"
                title="Clear date"
              >
                <X className="size-3" />
              </span>
            )}
            <Clock className="size-3.5 text-neutral-400" />
          </div>
        </button>

        <AnimatePresence>
          {open && (
            <motion.div
              initial={{ opacity: 0, y: 6, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 6, scale: 0.98 }}
              transition={{ duration: 0.15, ease: "easeOut" }}
              className="absolute z-50 top-full mt-2 left-0 w-80 max-sm:fixed max-sm:inset-x-4 max-sm:bottom-4 max-sm:top-auto max-sm:z-[9998] max-sm:w-auto max-sm:max-h-[calc(100dvh-2rem)] max-sm:overflow-y-auto bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl shadow-2xl p-3.5 space-y-3"
            >
              {/* Presets row */}
              <div className="flex items-center gap-1 overflow-x-auto pb-1 scrollbar-none">
                {[
                  { id: "now", label: "Now" },
                  { id: "today", label: "Today" },
                  { id: "tomorrow", label: "Tomorrow" },
                  { id: "3days", label: "+3d" },
                  { id: "1week", label: "+1w" },
                ].map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => applyPreset(p.id as "today" | "tomorrow" | "3days" | "1week" | "now")}
                    className="px-2 py-0.5 rounded-lg text-[10px] font-semibold bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-800 dark:hover:bg-neutral-750 text-neutral-600 dark:text-neutral-300 transition-colors shrink-0 cursor-pointer"
                  >
                    {p.label}
                  </button>
                ))}
              </div>

              {/* Month Header Navigation */}
              <div className="flex items-center justify-between pt-1">
                <span className="text-xs font-bold text-neutral-800 dark:text-neutral-100">
                  {monthNames[viewDate.getMonth()]} {viewDate.getFullYear()}
                </span>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={handlePrevMonth}
                    className="p-1 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-500 cursor-pointer"
                  >
                    <ChevronLeft className="size-4" />
                  </button>
                  <button
                    type="button"
                    onClick={handleNextMonth}
                    className="p-1 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-500 cursor-pointer"
                  >
                    <ChevronRight className="size-4" />
                  </button>
                </div>
              </div>

              {/* Calendar Grid */}
              <div className="grid grid-cols-7 gap-1 text-center">
                {dayHeaders.map((dh) => (
                  <span
                    key={dh}
                    className="text-[10px] font-bold text-neutral-400 py-1"
                  >
                    {dh}
                  </span>
                ))}

                {calendarDays.map((item, idx) => {
                  const isSelected =
                    parsedDate &&
                    parsedDate.getFullYear() === item.date.getFullYear() &&
                    parsedDate.getMonth() === item.date.getMonth() &&
                    parsedDate.getDate() === item.date.getDate();

                  const isToday =
                    new Date().getFullYear() === item.date.getFullYear() &&
                    new Date().getMonth() === item.date.getMonth() &&
                    new Date().getDate() === item.date.getDate();

                  const isDisabled = Boolean(
                    (min && item.date < new Date(new Date(min).setHours(0, 0, 0, 0))) ||
                    (max && item.date > new Date(new Date(max).setHours(23, 59, 59, 999)))
                  );

                  return (
                    <button
                      key={idx}
                      type="button"
                      disabled={isDisabled}
                      onClick={() => handleSelectDay(item.date)}
                      className={`h-7 w-7 mx-auto rounded-lg text-[11px] font-medium flex items-center justify-center transition-colors cursor-pointer ${
                        isDisabled
                          ? "opacity-25 cursor-not-allowed"
                          : isSelected
                            ? "bg-[#f97316] text-white font-bold shadow-xs"
                            : item.currentMonth
                              ? "text-neutral-800 dark:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800"
                              : "text-neutral-350 dark:text-neutral-600 hover:bg-neutral-50 dark:hover:bg-neutral-850"
                      } ${isToday && !isSelected ? "ring-1 ring-[#f97316] font-bold text-[#f97316]" : ""}`}
                    >
                      {item.day}
                    </button>
                  );
                })}
              </div>

              {/* Time Selector */}
              <div className="pt-2 border-t border-neutral-100 dark:border-neutral-800 flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 text-xs text-neutral-500 font-medium">
                  <Clock className="size-3.5 text-neutral-400" />
                  <span>Time</span>
                </div>

                <div className="flex items-center gap-1">
                  <TimeFields value={selectedTime} onChange={handleTimeChange} />
                  <button
                    type="button"
                    onClick={() => setOpen(false)}
                    className="p-1 px-2.5 rounded-lg bg-[#f97316] hover:bg-[#ea580c] text-white text-xs font-bold transition-colors cursor-pointer flex items-center gap-1"
                  >
                    <Check className="size-3" /> Done
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

interface TimePickerProps {
  value: string; // "HH:mm" e.g. "22:00"
  onChange: (value: string) => void;
  label?: string;
  className?: string;
}

export function TimePicker({ value, onChange, label, className = "" }: TimePickerProps) {
  const presets = ["08:00", "09:00", "12:00", "17:00", "20:00", "22:00", "23:00"];

  return (
    <div className={`space-y-1.5 ${className}`}>
      {label && (
        <label className="block text-[10px] font-bold text-neutral-500 uppercase tracking-wider">
          {label}
        </label>
      )}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Clock className="size-3.5 text-neutral-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
          <div className="pl-8"><TimeFields value={value} onChange={onChange} /></div>
        </div>
      </div>
      <div className="flex items-center gap-1 overflow-x-auto">
        {presets.slice(0, 5).map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => onChange(p)}
            className={`px-1.5 py-0.5 rounded text-[9px] font-medium transition-colors cursor-pointer ${
              value === p
                ? "bg-[#f97316] text-white font-bold"
                : "bg-neutral-100 dark:bg-neutral-800 text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200"
            }`}
          >
            {p}
          </button>
        ))}
      </div>
    </div>
  );
}
