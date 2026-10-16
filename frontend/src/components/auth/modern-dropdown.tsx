"use client";

import React, { useState, useRef, useEffect } from "react";
import { ChevronDown, Check } from "lucide-react";

export interface DropdownOption {
  value: string;
  label: string;
  description?: string;
  icon?: React.ReactNode;
}

interface ModernDropdownProps {
  id?: string;
  options: DropdownOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  label?: string;
  hint?: string;
  error?: string;
  disabled?: boolean;
  className?: string;
}

export function ModernDropdown({
  id,
  options,
  value,
  onChange,
  placeholder = "Select an option...",
  label,
  hint,
  error,
  disabled = false,
  className = "",
}: ModernDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedOption = options.find((opt) => opt.value === value);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className={`space-y-1.5 w-full ${className}`} ref={containerRef}>
      {label && (
        <label
          htmlFor={id}
          className="block text-xs font-semibold text-neutral-800 dark:text-neutral-200"
        >
          {label}
        </label>
      )}

      <div className="relative">
        <button
          type="button"
          id={id}
          aria-haspopup="listbox"
          aria-expanded={isOpen}
          disabled={disabled}
          onClick={() => !disabled && setIsOpen(!isOpen)}
          className={`w-full h-11 sm:h-12 px-3.5 sm:px-4 rounded-xl border bg-white dark:bg-neutral-900 text-left flex items-center justify-between gap-2.5 transition-all outline-none ${
            isOpen
              ? "border-neutral-950 dark:border-white ring-2 ring-neutral-950/10 dark:ring-white/10 shadow-sm"
              : error
              ? "border-red-500 ring-1 ring-red-500/20"
              : "border-neutral-200 dark:border-neutral-800 hover:border-neutral-300 dark:hover:border-neutral-700"
          } ${disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
        >
          <div className="flex items-center gap-2.5 truncate">
            {selectedOption?.icon && (
              <span className="shrink-0 size-4 sm:size-4.5 flex items-center justify-center">
                {selectedOption.icon}
              </span>
            )}
            <span
              className={`text-sm sm:text-sm truncate font-medium ${
                selectedOption
                  ? "text-neutral-900 dark:text-neutral-100"
                  : "text-neutral-400 dark:text-neutral-500"
              }`}
            >
              {selectedOption ? selectedOption.label : placeholder}
            </span>
          </div>

          <ChevronDown
            className={`size-4 sm:size-4.5 shrink-0 text-neutral-400 dark:text-neutral-500 transition-transform duration-200 ${
              isOpen ? "rotate-180 text-neutral-800 dark:text-neutral-200" : ""
            }`}
          />
        </button>

        {isOpen && (
          <div
            role="listbox"
            tabIndex={-1}
            className="absolute z-50 mt-1.5 w-full max-h-60 overflow-y-auto rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-1.5 shadow-xl shadow-neutral-950/10 dark:shadow-black/40 backdrop-blur-sm animate-in fade-in-0 zoom-in-95 duration-100"
          >
            {options.map((option) => {
              const isSelected = option.value === value;
              return (
                <button
                  key={option.value}
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  onClick={() => {
                    onChange(option.value);
                    setIsOpen(false);
                  }}
                  className={`w-full px-3 py-2.5 rounded-lg text-left text-sm flex items-center justify-between gap-2.5 transition-colors cursor-pointer ${
                    isSelected
                      ? "bg-neutral-100 dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 font-semibold"
                      : "text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-850 hover:text-neutral-950 dark:hover:text-white font-medium"
                  }`}
                >
                  <div className="flex items-center gap-2.5 truncate">
                    {option.icon && (
                      <span className="shrink-0 size-4 sm:size-4.5 flex items-center justify-center">
                        {option.icon}
                      </span>
                    )}
                    <div className="truncate">
                      <div className="truncate text-sm">{option.label}</div>
                      {option.description && (
                        <div className="text-[11px] text-neutral-400 dark:text-neutral-500 font-normal truncate mt-0.5">
                          {option.description}
                        </div>
                      )}
                    </div>
                  </div>

                  {isSelected && (
                    <Check className="size-4 shrink-0 text-neutral-950 dark:text-white" />
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {hint && !error && (
        <p className="text-[11px] sm:text-xs text-neutral-500 dark:text-neutral-400 leading-normal pl-0.5">
          {hint}
        </p>
      )}
      {error && (
        <p className="text-[11px] sm:text-xs text-red-500 dark:text-red-400 font-medium pl-0.5">
          {error}
        </p>
      )}
    </div>
  );
}
