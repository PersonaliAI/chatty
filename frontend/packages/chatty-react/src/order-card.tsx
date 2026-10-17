"use client";

import React from "react";
import {
  Package,
  Truck,
  ExternalLink,
  AlertTriangle,
  CheckCircle2,
  Clock,
  RotateCcw,
} from "lucide-react";

export interface OrderTrackingItem {
  carrier?: string;
  tracking_number: string;
  tracking_url?: string;
  date_shipped?: string;
  item_name?: string;
}

export interface OrderLineItem {
  name: string;
  quantity: number;
  total?: string;
  sku?: string;
}

export interface OrderCardData {
  order_id?: string;
  order_number: string;
  status: string;
  status_label?: string;
  currency?: string;
  total?: string;
  refunded_total?: string;
  date_created?: string;
  items?: OrderLineItem[];
  tracking?: OrderTrackingItem[];
  is_split_shipment?: boolean;
  is_partial_refund?: boolean;
  requires_human_review?: boolean;
}

interface OrderCardProps {
  order: OrderCardData;
  primaryColor?: string;
}

export function OrderCard({ order, primaryColor = "#f97316" }: OrderCardProps) {
  const statusLower = (order.status || "processing").toLowerCase();
  const isCompleted = statusLower === "completed" || statusLower === "delivered";
  const isRefunded = statusLower === "refunded" || Boolean(order.is_partial_refund);
  const isCancelled = statusLower === "cancelled" || statusLower === "failed";

  const statusBadgeClass = isCompleted
    ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30"
    : isRefunded
    ? "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30"
    : isCancelled
    ? "bg-red-500/15 text-red-700 dark:text-red-300 border-red-500/30"
    : "bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/30";

  const curr = order.currency || "USD";
  const formatAmount = (val?: string) => {
    if (!val) return null;
    const num = parseFloat(val);
    if (isNaN(num)) return `${val} ${curr}`;
    try {
      return new Intl.NumberFormat("en-US", { style: "currency", currency: curr }).format(num);
    } catch {
      return `${curr} ${num.toFixed(2)}`;
    }
  };

  return (
    <div className="my-2.5 w-full max-w-[300px] sm:max-w-[340px] rounded-2xl border border-neutral-200 dark:border-neutral-700/80 bg-white dark:bg-neutral-900 shadow-sm overflow-hidden text-left">
      {/* Header */}
      <div className="px-3.5 py-2.5 bg-neutral-50 dark:bg-neutral-800/70 border-b border-neutral-200/70 dark:border-neutral-700/70 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <Package className="size-4 shrink-0" style={{ color: primaryColor }} />
          <span className="text-xs font-bold text-neutral-900 dark:text-white truncate">
            Order #{order.order_number || order.order_id}
          </span>
        </div>
        <span
          className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full border shrink-0 ${statusBadgeClass}`}
        >
          {isCompleted ? (
            <CheckCircle2 className="size-2.5" />
          ) : isRefunded ? (
            <RotateCcw className="size-2.5" />
          ) : (
            <Clock className="size-2.5" />
          )}
          <span>{order.status_label || order.status}</span>
        </span>
      </div>

      {/* Edge-Case Alerts (Split Shipment / Partial Refund) */}
      {(order.is_split_shipment || order.is_partial_refund) && (
        <div className="px-3.5 py-2 bg-amber-50/90 dark:bg-amber-950/40 border-b border-amber-200/60 dark:border-amber-800/50 space-y-1">
          {order.is_split_shipment && (
            <div className="flex items-center gap-1.5 text-[10px] font-semibold text-amber-800 dark:text-amber-300">
              <AlertTriangle className="size-3 shrink-0 text-amber-600 dark:text-amber-400" />
              <span>Split Shipment ({order.tracking?.length || 2} packages)</span>
            </div>
          )}
          {order.is_partial_refund && (
            <div className="flex items-center gap-1.5 text-[10px] font-semibold text-amber-800 dark:text-amber-300">
              <RotateCcw className="size-3 shrink-0 text-amber-600 dark:text-amber-400" />
              <span>
                Partial Refund Processed ({formatAmount(order.refunded_total)} of {formatAmount(order.total)})
              </span>
            </div>
          )}
        </div>
      )}

      {/* Body */}
      <div className="p-3.5 space-y-3">
        {/* Line Items */}
        {order.items && order.items.length > 0 && (
          <div className="space-y-1">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-neutral-400 dark:text-neutral-500">
              Items
            </span>
            <div className="space-y-1">
              {order.items.slice(0, 4).map((item, idx) => (
                <div key={idx} className="flex items-center justify-between gap-2 text-xs">
                  <span className="text-neutral-700 dark:text-neutral-200 truncate">
                    {item.quantity}x {item.name}
                  </span>
                  {item.total && (
                    <span className="text-neutral-500 dark:text-neutral-400 font-medium shrink-0 tabular-nums">
                      {formatAmount(item.total)}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Total Row */}
        {order.total && (
          <div className="pt-2 border-t border-neutral-100 dark:border-neutral-800 flex items-center justify-between text-xs">
            <span className="font-medium text-neutral-500 dark:text-neutral-400">Order Total</span>
            <span className="font-bold text-neutral-900 dark:text-white tabular-nums">
              {formatAmount(order.total)}
            </span>
          </div>
        )}

        {/* Carrier Tracking Links */}
        {order.tracking && order.tracking.length > 0 && (
          <div className="pt-1 space-y-1.5">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-neutral-400 dark:text-neutral-500 flex items-center gap-1">
              <Truck className="size-3" /> Shipment Tracking
            </span>
            <div className="space-y-1.5">
              {order.tracking.map((tr, tIdx) => (
                <div
                  key={tIdx}
                  className="p-2 rounded-xl bg-neutral-50 dark:bg-neutral-800/60 border border-neutral-200/70 dark:border-neutral-700/70 flex items-center justify-between gap-2"
                >
                  <div className="min-w-0">
                    <div className="text-[11px] font-bold text-neutral-800 dark:text-neutral-100 truncate">
                      {tr.carrier || "Carrier"} • {tr.tracking_number}
                    </div>
                    {tr.item_name && (
                      <div className="text-[10px] text-neutral-500 dark:text-neutral-400 truncate">
                        Item: {tr.item_name}
                      </div>
                    )}
                  </div>
                  {tr.tracking_url && (
                    <a
                      href={tr.tracking_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-semibold text-white shrink-0 shadow-2xs transition-opacity hover:opacity-90"
                      style={{ background: primaryColor }}
                    >
                      <span>Track</span>
                      <ExternalLink className="size-2.5" />
                    </a>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
