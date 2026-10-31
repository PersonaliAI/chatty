"use client";

import React, { useCallback, useEffect, useState } from "react";
import type { WahaAntiBanStats, WahaConfigForm, WahaSessionInfo, WahaStatusResponse } from "./types";
import { WahaAntiBanDashboard } from "./WahaAntiBanDashboard";
import { WahaQrScannerModal } from "./WahaQrScannerModal";

interface Props {
  botId: string;
  fetchBackend?: (url: string, init?: RequestInit) => Promise<Response>;
}

export function WahaConnectionCard({ botId, fetchBackend }: Props) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [isQrModalOpen, setIsQrModalOpen] = useState(false);
  const [session, setSession] = useState<WahaSessionInfo | null>(null);
  const [antiBanStats, setAntiBanStats] = useState<WahaAntiBanStats | null>(null);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const [form, setForm] = useState<WahaConfigForm>({
    endpoint: "http://localhost:3000",
    apiKey: "",
    sessionName: `bot_${botId.slice(0, 8)}`,
    simAgeDays: 7,
    typingPresenceEnabled: true,
    optOutShieldEnabled: true,
    dailyCap: 50,
    windowStartHour: 8,
    windowEndHour: 21,
  });

  const fetchStatus = useCallback(async () => {
    if (!botId) return;
    try {
      setLoading(true);
      const fetcher = fetchBackend || fetch;
      const res = await fetcher(`/api/integrations/waha/status?bot_id=${encodeURIComponent(botId)}`);
      if (res.ok) {
        const data: WahaStatusResponse = await res.json();
        setSession(data.session);
        if (data.anti_ban?.warmup) {
          setAntiBanStats(data.anti_ban.warmup);
          setForm((prev) => ({
            ...prev,
            simAgeDays: data.anti_ban.warmup.sim_age_days || prev.simAgeDays,
            dailyCap: data.anti_ban.warmup.daily_cap || prev.dailyCap,
            typingPresenceEnabled: data.anti_ban.pacing_enabled ?? prev.typingPresenceEnabled,
            optOutShieldEnabled: data.anti_ban.opt_out_shield ?? prev.optOutShieldEnabled,
          }));
        }
      }
    } catch {
      // Ignore network errors on polling
    } finally {
      setLoading(false);
    }
  }, [botId, fetchBackend]);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  const handleStartSession = async () => {
    try {
      setLoading(true);
      setMessage(null);
      const fetcher = fetchBackend || fetch;
      const res = await fetcher("/api/integrations/waha/session/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bot_id: botId }),
      });
      if (!res.ok) throw new Error("Failed to start session on WAHA container");
      const data = await res.json();
      setSession(data.session);
      setIsQrModalOpen(true);
    } catch (err) {
      setMessage({ type: "error", text: err instanceof Error ? err.message : "Error starting WAHA" });
    } finally {
      setLoading(false);
    }
  };

  const handleStopSession = async () => {
    try {
      setLoading(true);
      setMessage(null);
      const fetcher = fetchBackend || fetch;
      const res = await fetcher("/api/integrations/waha/session/stop", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bot_id: botId }),
      });
      if (!res.ok) throw new Error("Failed to stop session");
      await fetchStatus();
      setMessage({ type: "success", text: "WhatsApp session disconnected." });
    } catch (err) {
      setMessage({ type: "error", text: err instanceof Error ? err.message : "Error disconnecting" });
    } finally {
      setLoading(false);
    }
  };

  const handleSaveConfig = async () => {
    try {
      setSaving(true);
      setMessage(null);
      const fetcher = fetchBackend || fetch;
      const res = await fetcher("/api/integrations/waha/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bot_id: botId,
          provider: "waha",
          waha_endpoint: form.endpoint,
          waha_api_key: form.apiKey || null,
          waha_session_name: form.sessionName,
          sim_age_days: form.simAgeDays,
          typing_presence_enabled: form.typingPresenceEnabled,
          opt_out_shield_enabled: form.optOutShieldEnabled,
          daily_cap: form.dailyCap,
          window_start_hour: form.windowStartHour,
          window_end_hour: form.windowEndHour,
        }),
      });
      if (!res.ok) throw new Error("Failed to save WAHA configuration");
      setMessage({ type: "success", text: "WAHA & Anti-Ban configuration saved successfully!" });
      await fetchStatus();
    } catch (err) {
      setMessage({ type: "error", text: err instanceof Error ? err.message : "Failed to save" });
    } finally {
      setSaving(false);
    }
  };

  const isWorking = session?.status === "WORKING";
  const isAwaitingQr = session?.status === "SCAN_QR_CODE";

  return (
    <div className="space-y-6">
      {/* Alert Banner */}
      {message && (
        <div
          className={`p-3.5 rounded-xl text-xs flex items-center justify-between border ${
            message.type === "success"
              ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800"
              : "bg-rose-50 dark:bg-rose-950/40 text-rose-800 dark:text-rose-300 border-rose-200 dark:border-rose-800"
          }`}
        >
          <span>{message.text}</span>
          <button type="button" onClick={() => setMessage(null)} className="text-xs font-bold opacity-60 hover:opacity-100">
            ✕
          </button>
        </div>
      )}

      {/* Main Connection Status Card */}
      <div className="rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200/80 dark:border-neutral-800 p-5 sm:p-6 shadow-xs space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-neutral-100 dark:border-neutral-800">
          <div>
            <div className="flex items-center gap-2.5">
              <span className="text-sm sm:text-base font-semibold text-neutral-900 dark:text-neutral-100">
                WAHA Container Connection
              </span>
              <span
                className={`inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-0.5 rounded-full border ${
                  isWorking
                    ? "bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-700"
                    : isAwaitingQr
                    ? "bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border-amber-300 dark:border-amber-700"
                    : "bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 border-neutral-300 dark:border-neutral-700"
                }`}
              >
                <span
                  className={`size-2 rounded-full ${
                    isWorking ? "bg-emerald-500" : isAwaitingQr ? "bg-amber-500 animate-pulse" : "bg-neutral-400"
                  }`}
                />
                {isWorking ? "Connected" : isAwaitingQr ? "Awaiting QR Scan" : "Disconnected"}
              </span>
            </div>
            <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
              Connect to your WAHA Docker container running the NOWEB engine.
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2">
            {!isWorking ? (
              <button
                type="button"
                disabled={loading}
                onClick={handleStartSession}
                className="px-4 py-2 text-xs font-semibold rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs transition-all cursor-pointer flex items-center gap-1.5"
              >
                <span>📷</span>
                <span>{isAwaitingQr ? "Show QR Code" : "Pair WhatsApp"}</span>
              </button>
            ) : (
              <button
                type="button"
                disabled={loading}
                onClick={handleStopSession}
                className="px-3.5 py-2 text-xs font-medium rounded-xl border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
              >
                Disconnect
              </button>
            )}
          </div>
        </div>

        {/* Configuration Inputs */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1.5">
              WAHA Endpoint URL
            </label>
            <input
              type="text"
              placeholder="http://localhost:3000"
              value={form.endpoint}
              onChange={(e) => setForm((prev) => ({ ...prev, endpoint: e.target.value }))}
              className="w-full px-3.5 py-2 text-xs rounded-xl border border-neutral-200 dark:border-neutral-700 bg-neutral-50/50 dark:bg-neutral-800/50 text-neutral-900 dark:text-neutral-100 focus:bg-white dark:focus:bg-neutral-900 transition-colors"
            />
            <p className="text-[11px] text-neutral-400 mt-1">
              Default is <code>http://localhost:3000</code> when hosted on the same server.
            </p>
          </div>

          <div>
            <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1.5">
              WAHA API Key (optional)
            </label>
            <input
              type="password"
              placeholder="WAHA_API_KEY if configured"
              value={form.apiKey}
              onChange={(e) => setForm((prev) => ({ ...prev, apiKey: e.target.value }))}
              className="w-full px-3.5 py-2 text-xs rounded-xl border border-neutral-200 dark:border-neutral-700 bg-neutral-50/50 dark:bg-neutral-800/50 text-neutral-900 dark:text-neutral-100 focus:bg-white dark:focus:bg-neutral-900 transition-colors"
            />
            <p className="text-[11px] text-neutral-400 mt-1">
              Passed as <code>X-Api-Key</code> header to protect your endpoint.
            </p>
          </div>
        </div>

        <div className="pt-2 flex justify-end">
          <button
            type="button"
            disabled={saving}
            onClick={handleSaveConfig}
            className="px-4 py-2 text-xs font-semibold rounded-xl bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 hover:opacity-90 transition-opacity"
          >
            {saving ? "Saving..." : "Save WAHA Settings"}
          </button>
        </div>
      </div>

      {/* Anti-Ban Shield Dashboard */}
      <WahaAntiBanDashboard
        stats={antiBanStats}
        form={form}
        onChange={(field, val) => setForm((prev) => ({ ...prev, [field]: val }))}
      />

      {/* QR Code Pairing Modal */}
      <WahaQrScannerModal
        isOpen={isQrModalOpen}
        onClose={() => setIsQrModalOpen(false)}
        session={session}
        onRefresh={fetchStatus}
      />
    </div>
  );
}
