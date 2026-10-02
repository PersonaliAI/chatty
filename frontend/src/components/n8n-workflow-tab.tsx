"use client";

import React, { useState, useEffect } from "react";
import {
  ExternalLink,
  RefreshCw,
  Copy,
  Check,
  Zap,
  Layers,
  Sparkles,
  AlertTriangle,
  Play,
  ArrowRight,
  ShieldCheck,
} from "lucide-react";
import { BACKEND_URL, fetchBackend } from "@/lib/backend-client";

interface Props {
  botId: string | null;
  color?: string;
  fetchBackend?: (path: string, options?: RequestInit) => Promise<Response>;
}

interface WorkflowInfo {
  workflow_id: string | null;
  workflow_name: string | null;
  active: boolean;
  editor_url: string;
  webhook_url: string;
  created: boolean;
}

export function N8nWorkflowTab({ botId, color = "#0ea5e9" }: Props) {
  const [loading, setLoading] = useState(true);
  const [n8nStatus, setN8nStatus] = useState<"checking" | "connected" | "offline">("checking");
  const [workflow, setWorkflow] = useState<WorkflowInfo | null>(null);
  const [copied, setCopied] = useState(false);
  const [triggering, setTriggering] = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);

  const loadWorkflow = async () => {
    if (!botId) return;
    setLoading(true);
    setTestResult(null);
    try {
      // 1. Check status
      const statusRes = await fetchBackend(`/api/bots/${botId}/n8n/status`);
      if (statusRes.ok) {
        const statusData = await statusRes.json();
        setN8nStatus(statusData.reachable ? "connected" : "offline");
      } else {
        setN8nStatus("offline");
      }

      // 2. Fetch or provision workflow
      const wfRes = await fetchBackend(`/api/bots/${botId}/n8n/workflow`);
      if (wfRes.ok) {
        const wfData = await wfRes.json();
        setWorkflow(wfData);
      }
    } catch (err) {
      setN8nStatus("offline");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadWorkflow();
  }, [botId]);

  const copyWebhook = () => {
    if (!workflow?.webhook_url) return;
    navigator.clipboard.writeText(workflow.webhook_url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const testTrigger = async () => {
    if (!botId) return;
    setTriggering(true);
    setTestResult(null);
    try {
      const res = await fetchBackend(`/api/bots/${botId}/n8n/trigger`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "test_event",
          payload: {
            customer_name: "Demo Customer",
            customer_email: "demo@example.com",
            message: "Hello from Chatty!",
            timestamp: new Date().toISOString(),
          },
        }),
      });
      const data = await res.json();
      setTestResult(JSON.stringify(data, null, 2));
    } catch (err) {
      setTestResult(JSON.stringify({ error: "Failed to trigger webhook" }));
    } finally {
      setTriggering(false);
    }
  };

  const N8N_PUBLIC_URL =
    process.env.NEXT_PUBLIC_N8N_EXTERNAL_URL ||
    "https://n8n.chatty.personaliai.com";
  const iframeSrc = workflow?.editor_url || N8N_PUBLIC_URL;

  return (
    <div className="space-y-4 w-full">
      {/* Top Banner & Info Card */}
      <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl p-4 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2.5">
              <span className="p-2 rounded-lg bg-orange-500/10 text-orange-600 dark:text-orange-400">
                <Zap className="size-5" />
              </span>
              <div>
                <h3 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100 flex items-center gap-2">
                  {workflow?.workflow_name || "Bot Automation Engine (Powered by n8n)"}
                  {n8nStatus === "connected" ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                      <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
                      Live Connected
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                      <AlertTriangle className="size-3" />
                      Standalone / Local
                    </span>
                  )}
                </h3>
                <p className="text-xs text-neutral-500 dark:text-neutral-400">
                  Connect your bot to 1,500+ integrations, trigger CRM updates, manage calendars, and run AI Agent tools.
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={loadWorkflow}
              disabled={loading}
              className="p-2 rounded-lg border border-neutral-200 dark:border-neutral-800 hover:bg-neutral-50 dark:hover:bg-neutral-800 text-neutral-600 dark:text-neutral-300 text-xs flex items-center gap-1.5 transition-colors"
              title="Refresh status"
            >
              <RefreshCw className={`size-3.5 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </button>

            <button
              onClick={testTrigger}
              disabled={triggering || !workflow?.webhook_url}
              className="px-3 py-1.5 rounded-lg border border-neutral-200 dark:border-neutral-800 hover:bg-neutral-50 dark:hover:bg-neutral-800 text-neutral-700 dark:text-neutral-200 text-xs font-medium flex items-center gap-1.5 transition-colors"
            >
              <Play className={`size-3.5 text-emerald-500 ${triggering ? "animate-pulse" : ""}`} />
              {triggering ? "Triggering..." : "Test Event"}
            </button>

            <a
              href={iframeSrc}
              target="_blank"
              rel="noreferrer"
              className="px-3.5 py-1.5 rounded-lg bg-orange-600 hover:bg-orange-500 text-white text-xs font-medium flex items-center gap-1.5 shadow-sm transition-colors"
            >
              Open n8n Canvas
              <ExternalLink className="size-3.5" />
            </a>
          </div>
        </div>

        {/* Webhook endpoint bar */}
        {workflow?.webhook_url && (
          <div className="mt-4 pt-3 border-t border-neutral-100 dark:border-neutral-800/60 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-2 text-neutral-500">
              <span className="font-mono text-[11px] font-semibold text-neutral-700 dark:text-neutral-300">
                Webhook Ingress:
              </span>
              <code className="px-2 py-0.5 rounded bg-neutral-100 dark:bg-neutral-800 text-neutral-800 dark:text-neutral-200 font-mono text-[11px] select-all">
                {workflow.webhook_url}
              </code>
            </div>
            <button
              onClick={copyWebhook}
              className="inline-flex items-center gap-1 text-xs text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100 transition-colors"
            >
              {copied ? (
                <>
                  <Check className="size-3.5 text-emerald-500" />
                  Copied
                </>
              ) : (
                <>
                  <Copy className="size-3.5" />
                  Copy URL
                </>
              )}
            </button>
          </div>
        )}

        {testResult && (
          <div className="mt-3 p-2.5 rounded-lg bg-neutral-950 text-neutral-200 text-xs font-mono max-h-40 overflow-y-auto">
            <div className="text-neutral-400 text-[10px] mb-1 font-semibold uppercase">Execution Test Result:</div>
            <pre className="whitespace-pre-wrap">{testResult}</pre>
          </div>
        )}
      </div>

      {/* Embedded n8n Visual Workflow Canvas */}
      <div className="w-full h-[760px] rounded-xl border border-neutral-200 dark:border-neutral-800 overflow-hidden bg-neutral-50 dark:bg-neutral-950 relative shadow-inner">
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-white/80 dark:bg-neutral-950/80 z-10">
            <div className="flex items-center gap-2 text-sm text-neutral-500">
              <RefreshCw className="size-4 animate-spin text-orange-500" />
              Loading n8n Workflow Studio...
            </div>
          </div>
        )}

        {n8nStatus === "offline" && !loading ? (
          <div className="w-full h-full flex flex-col items-center justify-center p-6 text-center">
            <div className="p-3 rounded-full bg-orange-100 dark:bg-orange-950/50 text-orange-600 dark:text-orange-400 mb-4">
              <Layers className="size-8" />
            </div>
            <h4 className="text-base font-bold text-neutral-900 dark:text-neutral-100 mb-1">
              Start n8n to design workflows
            </h4>
            <p className="text-xs text-neutral-500 dark:text-neutral-400 max-w-md mb-4">
              n8n is not currently reachable at <code className="font-mono text-orange-600">{iframeSrc}</code>.
              Start your n8n container or configure <code className="font-mono">N8N_EXTERNAL_URL</code> in your environment.
            </p>
            <div className="bg-neutral-900 text-neutral-200 p-3 rounded-lg text-xs font-mono max-w-lg text-left select-all mb-4">
              docker run -it --rm --name chatty-n8n -p 5678:5678 -e N8N_SECURITY_DISABLE_FRAME_EMBED_RESTRICTION=true docker.n8n.io/n8nio/n8n
            </div>
            <button
              onClick={loadWorkflow}
              className="px-4 py-2 rounded-lg bg-orange-600 hover:bg-orange-500 text-white text-xs font-semibold flex items-center gap-2 shadow-sm transition-colors"
            >
              <RefreshCw className="size-3.5" />
              Check Connection Again
            </button>
          </div>
        ) : (
          <iframe
            src={iframeSrc}
            title="n8n Workflow Editor"
            className="w-full h-full border-0"
            allow="clipboard-read; clipboard-write"
          />
        )}
      </div>
    </div>
  );
}
