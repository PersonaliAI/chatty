"use client";

import React from "react";
import { motion } from "framer-motion";

interface ModernSwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  size?: "sm" | "md" | "lg";
  label?: string;
  activeLabel?: string;
  inactiveLabel?: string;
  activeColor?: string;
  id?: string;
  className?: string;
  "aria-label"?: string;
}

export function ModernSwitch({
  checked,
  onChange,
  disabled = false,
  size = "md",
  label,
  activeLabel,
  inactiveLabel,
  activeColor = "#f97316",
  id,
  className = "",
  "aria-label": ariaLabel,
}: ModernSwitchProps) {
  const switchId = id || (label ? `switch-${label.toLowerCase().replace(/\s+/g, "-")}` : undefined);

  const dimensions = {
    sm: { track: "w-8 h-4.5 p-0.5", thumb: "size-3.5", translate: 14 },
    md: { track: "w-11 h-6 p-0.5", thumb: "size-5", translate: 20 },
    lg: { track: "w-14 h-7.5 p-1", thumb: "size-5.5", translate: 26 },
  }[size];

  const handleClick = () => {
    if (!disabled) {
      onChange(!checked);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (disabled) return;
    if (e.key === " " || e.key === "Enter") {
      e.preventDefault();
      onChange(!checked);
    }
  };

  return (
    <div className={`inline-flex items-center gap-2.5 select-none ${className}`}>
      <button
        id={switchId}
        role="switch"
        type="button"
        aria-checked={checked}
        aria-label={ariaLabel || label || activeLabel || "Toggle switch"}
        disabled={disabled}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        className={`relative inline-flex items-center shrink-0 cursor-pointer rounded-full transition-colors duration-200 ease-in-out focus:outline-none focus-visible:ring-2 focus-visible:ring-[#f97316]/50 focus-visible:ring-offset-2 ${
          dimensions.track
        } ${
          disabled ? "opacity-40 cursor-not-allowed" : ""
        } ${
          checked
            ? ""
            : "bg-neutral-200 dark:bg-neutral-750 hover:bg-neutral-300 dark:hover:bg-neutral-700"
        }`}
        style={checked ? { backgroundColor: activeColor } : undefined}
      >
        <motion.span
          animate={{ x: checked ? dimensions.translate : 0 }}
          transition={{ type: "spring", stiffness: 500, damping: 30 }}
          className={`pointer-events-none inline-block rounded-full bg-white shadow-md ring-0 ${dimensions.thumb}`}
        />
      </button>

      {(label || activeLabel || inactiveLabel) && (
        <span
          onClick={handleClick}
          className={`text-xs font-semibold cursor-pointer ${
            disabled ? "opacity-50 cursor-not-allowed" : "text-neutral-700 dark:text-neutral-200"
          }`}
        >
          {checked ? activeLabel || label : inactiveLabel || label}
        </span>
      )}
    </div>
  );
}
