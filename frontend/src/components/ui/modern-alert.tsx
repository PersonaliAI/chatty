"use client";

import React from "react";
import {
  AlertCircle,
  CheckCircle2,
  Info,
  AlertTriangle,
  Sparkles,
  X,
} from "lucide-react";

export type ModernAlertVariant = "info" | "success" | "warning" | "error" | "ai";

interface ModernAlertProps {
  variant?: ModernAlertVariant;
  title?: string;
  children: React.ReactNode;
  icon?: React.ReactNode;
  onDismiss?: () => void;
  action?: React.ReactNode;
  className?: string;
}

export function ModernAlert({
  variant = "info",
  title,
  children,
  icon,
  onDismiss,
  action,
  className = "",
}: ModernAlertProps) {
  const styles = {
    info: {
      container:
        "bg-blue-50/80 dark:bg-blue-950/25 border-blue-200/80 dark:border-blue-900/50 text-blue-900 dark:text-blue-100",
      iconColor: "text-blue-600 dark:text-blue-400",
      defaultIcon: <Info className="size-4 shrink-0" />,
      titleColor: "text-blue-900 dark:text-blue-200",
    },
    success: {
      container:
        "bg-emerald-50/80 dark:bg-emerald-950/25 border-emerald-200/80 dark:border-emerald-900/50 text-emerald-900 dark:text-emerald-100",
      iconColor: "text-emerald-600 dark:text-emerald-400",
      defaultIcon: <CheckCircle2 className="size-4 shrink-0" />,
      titleColor: "text-emerald-900 dark:text-emerald-200",
    },
    warning: {
      container:
        "bg-amber-50/80 dark:bg-amber-950/25 border-amber-200/80 dark:border-amber-900/50 text-amber-900 dark:text-amber-100",
      iconColor: "text-amber-600 dark:text-amber-400",
      defaultIcon: <AlertTriangle className="size-4 shrink-0" />,
      titleColor: "text-amber-900 dark:text-amber-200",
    },
    error: {
      container:
        "bg-rose-50/80 dark:bg-rose-950/25 border-rose-200/80 dark:border-rose-900/50 text-rose-900 dark:text-rose-100",
      iconColor: "text-rose-600 dark:text-rose-400",
      defaultIcon: <AlertCircle className="size-4 shrink-0" />,
      titleColor: "text-rose-900 dark:text-rose-200",
    },
    ai: {
      container:
        "bg-gradient-to-r from-purple-50/90 via-indigo-50/80 to-purple-50/90 dark:from-purple-950/30 dark:via-indigo-950/25 dark:to-purple-950/30 border-purple-200/80 dark:border-purple-800/50 text-purple-950 dark:text-purple-100",
      iconColor: "text-purple-600 dark:text-purple-400",
      defaultIcon: <Sparkles className="size-4 shrink-0" />,
      titleColor: "text-purple-900 dark:text-purple-200",
    },
  }[variant];

  return (
    <div
      role="alert"
      className={`relative flex items-start gap-3 p-3.5 rounded-xl border text-xs leading-relaxed transition-all shadow-xs ${styles.container} ${className}`}
    >
      <div className={`mt-0.5 ${styles.iconColor}`}>
        {icon || styles.defaultIcon}
      </div>

      <div className="flex-1 min-w-0 space-y-1">
        {title && (
          <h5 className={`font-bold tracking-tight text-xs ${styles.titleColor}`}>
            {title}
          </h5>
        )}
        <div className="text-[11px] opacity-90 break-words">{children}</div>
        {action && <div className="pt-1.5">{action}</div>}
      </div>

      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          className="p-1 -mr-1 -mt-1 rounded-lg opacity-60 hover:opacity-100 transition-opacity cursor-pointer"
          aria-label="Dismiss alert"
        >
          <X className="size-3.5" />
        </button>
      )}
    </div>
  );
}
