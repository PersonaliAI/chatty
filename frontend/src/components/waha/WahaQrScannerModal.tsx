"use client";

import React, { useEffect, useState } from "react";
import type { WahaSessionInfo } from "./types";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  session: WahaSessionInfo | null;
  onRefresh: () => Promise<void>;
}

export function WahaQrScannerModal({ isOpen, onClose, session, onRefresh }: Props) {
  const [countdown, setCountdown] = useState(20);
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    const interval = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          onRefresh();
          return 20;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [isOpen, onRefresh]);

  if (!isOpen) return null;

  const isWorking = session?.status === "WORKING";
  const qrUrl = session?.qr_code_data_url;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="relative w-full max-w-md bg-white dark:bg-neutral-900 rounded-3xl shadow-2xl border border-neutral-200 dark:border-neutral-800 overflow-hidden p-6 sm:p-8">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-neutral-100 dark:border-neutral-800">
          <div>
            <h3 className="text-base sm:text-lg font-semibold text-neutral-900 dark:text-neutral-100">
              {isWorking ? "WhatsApp Connected" : "Pair WhatsApp via WAHA"}
            </h3>
            <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
              NOWEB Engine Companion Linking
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="size-8 flex items-center justify-center rounded-full text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div className="py-6 flex flex-col items-center justify-center text-center">
          {isWorking ? (
            <div className="py-6 space-y-4">
              <div className="size-16 mx-auto rounded-full bg-emerald-100 dark:bg-emerald-950/60 flex items-center justify-center text-emerald-600 dark:text-emerald-400 text-2xl">
                ✓
              </div>
              <div>
                <p className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
                  Successfully Linked!
                </p>
                <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
                  Active number: <span className="font-mono text-emerald-600 dark:text-emerald-400">+{session?.phone_number || "paired"}</span>
                </p>
              </div>
            </div>
          ) : qrUrl ? (
            <div className="space-y-4">
              <div className="relative p-3 bg-white rounded-2xl border border-neutral-200 shadow-inner flex items-center justify-center mx-auto size-56 sm:size-64">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={qrUrl}
                  alt="WhatsApp Pairing QR Code"
                  className="w-full h-full object-contain rounded-xl"
                />
              </div>
              <p className="text-xs text-neutral-500 dark:text-neutral-400 flex items-center justify-center gap-1.5">
                <span className="inline-block size-2 rounded-full bg-amber-500 animate-pulse" />
                Refreshes in <span className="font-mono font-medium text-neutral-700 dark:text-neutral-300">{countdown}s</span>
              </p>
            </div>
          ) : (
            <div className="py-10 space-y-3">
              <div className="size-10 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto" />
              <p className="text-xs text-neutral-500 dark:text-neutral-400">
                Contacting WAHA container & generating QR code...
              </p>
            </div>
          )}

          {/* Instructions */}
          {!isWorking && (
            <div className="w-full mt-4 text-left p-3.5 bg-neutral-50 dark:bg-neutral-800/50 rounded-2xl border border-neutral-200/60 dark:border-neutral-800 text-xs space-y-1.5 text-neutral-600 dark:text-neutral-300">
              <p className="font-semibold text-neutral-800 dark:text-neutral-200">How to link:</p>
              <ol className="list-decimal list-inside space-y-1 text-[11px] leading-relaxed text-neutral-500 dark:text-neutral-400">
                <li>Open <b>WhatsApp</b> on your phone</li>
                <li>Tap <b>Menu (⋮)</b> or <b>Settings</b> &rarr; <b>Linked Devices</b></li>
                <li>Tap <b>Link a Device</b> and point camera at this screen</li>
              </ol>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-neutral-100 dark:border-neutral-800">
          {!isWorking && (
            <button
              type="button"
              disabled={isRefreshing}
              onClick={async () => {
                setIsRefreshing(true);
                await onRefresh();
                setCountdown(20);
                setIsRefreshing(false);
              }}
              className="px-3.5 py-2 text-xs font-medium rounded-xl border border-neutral-200 dark:border-neutral-700 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
            >
              {isRefreshing ? "Refreshing..." : "Refresh QR"}
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold rounded-xl bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 hover:opacity-90 transition-opacity"
          >
            {isWorking ? "Done" : "Close"}
          </button>
        </div>
      </div>
    </div>
  );
}
