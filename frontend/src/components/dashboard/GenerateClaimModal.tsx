"use client";

import { useState } from "react";
import { X, Copy, Check, ExternalLink, Sparkles, Globe, Loader2, ArrowRight, Share2, Mail } from "lucide-react";
import type { Bot } from "@/app/dashboard/dashboard-types";

interface GenerateClaimModalProps {
  isOpen: boolean;
  onClose: () => void;
  fetchWithFallback: (path: string, options?: RequestInit) => Promise<Response>;
  onBotCreated: (newBot: Bot) => void;
  showToast: (msg: string, type?: "success" | "error" | "info") => void;
}

const PRESET_COLORS = [
  { label: "Slate", hex: "#0f172a" },
  { label: "Blue", hex: "#2563eb" },
  { label: "Orange", hex: "#f97316" },
  { label: "Emerald", hex: "#059669" },
  { label: "Violet", hex: "#7c3aed" },
  { label: "Rose", hex: "#e11d48" },
];

export function GenerateClaimModal({
  isOpen,
  onClose,
  fetchWithFallback,
  onBotCreated,
  showToast,
}: GenerateClaimModalProps) {
  const [targetName, setTargetName] = useState("");
  const [targetUrl, setTargetUrl] = useState("");
  const [founderName, setFounderName] = useState("");
  const [founderEmail, setFounderEmail] = useState("");
  const [primaryColor, setPrimaryColor] = useState("#0f172a");
  const [loading, setLoading] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedEmail, setCopiedEmail] = useState(false);

  // Result state
  const [result, setResult] = useState<{
    bot_id: string;
    claim_token: string;
    claim_url: string;
    demo_expires_at: string;
    email_template: string;
  } | null>(null);

  if (!isOpen) return null;

  async function handleGenerate(e: React.FormEvent) {
    e.preventDefault();
    if (!targetName.trim() || !targetUrl.trim()) {
      showToast("Please provide both target name and website URL.", "error");
      return;
    }

    setLoading(true);
    try {
      let formattedUrl = targetUrl.trim();
      if (!/^https?:\/\//i.test(formattedUrl)) {
        formattedUrl = `https://${formattedUrl}`;
      }

      const res = await fetchWithFallback("/api/claim/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          target_name: targetName.trim(),
          target_url: formattedUrl,
          founder_name: founderName.trim(),
          founder_email: founderEmail.trim(),
          primary_color: primaryColor,
          suggested_prompts: [
            `What is ${targetName.trim()} and what problem does it solve?`,
            "What are your pricing plans and features?",
            "How do I sign up or get started?",
          ],
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || "Failed to generate claimable demo assistant.");
      }

      const data = await res.json();
      setResult(data);

      // Create synthetic bot representation to immediately push into user's bots list
      const newDemoBot: Bot = {
        id: data.bot_id,
        name: `${targetName.trim()} Assistant`,
        welcome_message: `Hello! I am ${targetName.trim()}'s AI assistant. Ask me anything about our features, pricing, or docs.`,
        primary_color: primaryColor,
        claim_token: data.claim_token,
        claim_status: "unclaimed",
        demo_target_name: targetName.trim(),
        demo_target_url: formattedUrl,
        demo_expires_at: data.demo_expires_at,
        created_at: new Date().toISOString(),
      };
      onBotCreated(newDemoBot);
      showToast("Claimable demo assistant generated!", "success");
    } catch (err: unknown) {
      console.error(err);
      showToast(err instanceof Error ? err.message : "Error generating claimable bot", "error");
    } finally {
      setLoading(false);
    }
  }

  function handleCopy(text: string, type: "link" | "email") {
    navigator.clipboard.writeText(text);
    if (type === "link") {
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    } else {
      setCopiedEmail(true);
      setTimeout(() => setCopiedEmail(false), 2000);
    }
    showToast(`${type === "link" ? "Claim link" : "Email template"} copied to clipboard!`, "info");
  }

  function handleReset() {
    setResult(null);
    setTargetName("");
    setTargetUrl("");
    setFounderName("");
    setFounderEmail("");
    onClose();
  }

  return (
    <div className="fixed inset-0 z-[9998] bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl p-6 max-w-lg w-full space-y-4 shadow-2xl text-neutral-900 dark:text-neutral-100 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-neutral-100 dark:border-neutral-800">
          <div className="flex items-center gap-2">
            <div className="size-8 rounded-lg bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 flex items-center justify-center text-blue-600 dark:text-blue-400">
              <Share2 className="size-4" />
            </div>
            <div>
              <h4 className="text-sm font-bold">Generate Claimable Demo Link</h4>
              <p className="text-[11px] text-neutral-500 dark:text-neutral-400">
                Target startups on Product Hunt with a pre-trained assistant.
              </p>
            </div>
          </div>
          <button
            onClick={handleReset}
            className="text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 cursor-pointer p-1"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* View 1: Creation Form */}
        {!result ? (
          <form onSubmit={handleGenerate} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] font-semibold text-neutral-500 uppercase mb-1">
                  Startup / Company Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. Acme AI"
                  value={targetName}
                  onChange={(e) => setTargetName(e.target.value)}
                  className="w-full bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-lg px-3 py-2 text-xs text-neutral-800 dark:text-neutral-200 focus:outline-none focus:border-blue-500"
                  required
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-[10px] font-semibold text-neutral-500 uppercase mb-1">
                  Website URL <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <Globe className="size-3.5 absolute left-3 top-2.5 text-neutral-400" />
                  <input
                    type="text"
                    placeholder="https://acme.ai"
                    value={targetUrl}
                    onChange={(e) => setTargetUrl(e.target.value)}
                    className="w-full bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-lg pl-8 pr-3 py-2 text-xs text-neutral-800 dark:text-neutral-200 focus:outline-none focus:border-blue-500"
                    required
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-[10px] font-semibold text-neutral-500 uppercase">
                    Founder / Contact Name
                  </label>
                  <span className="text-[10px] text-neutral-400 font-normal">Optional</span>
                </div>
                <input
                  type="text"
                  placeholder="e.g. Sarah"
                  value={founderName}
                  onChange={(e) => setFounderName(e.target.value)}
                  className="w-full bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-lg px-3 py-2 text-xs text-neutral-800 dark:text-neutral-200 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-[10px] font-semibold text-neutral-500 uppercase">
                    Founder Email
                  </label>
                  <span className="text-[10px] text-neutral-400 font-normal">Optional</span>
                </div>
                <input
                  type="email"
                  placeholder="founder@acme.ai"
                  value={founderEmail}
                  onChange={(e) => setFounderEmail(e.target.value)}
                  className="w-full bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-lg px-3 py-2 text-xs text-neutral-800 dark:text-neutral-200 focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>

            {/* Brand Color Selector */}
            <div>
              <label className="block text-[10px] font-semibold text-neutral-500 uppercase mb-1.5">
                Brand Accent Color
              </label>
              <div className="flex items-center gap-2">
                {PRESET_COLORS.map((c) => (
                  <button
                    key={c.hex}
                    type="button"
                    onClick={() => setPrimaryColor(c.hex)}
                    className={`size-6 rounded-full border-2 transition-transform cursor-pointer ${
                      primaryColor.toLowerCase() === c.hex.toLowerCase()
                        ? "scale-110 border-neutral-900 dark:border-white ring-2 ring-blue-500/30"
                        : "border-transparent hover:scale-105"
                    }`}
                    style={{ backgroundColor: c.hex }}
                    title={c.label}
                  />
                ))}
                <div className="flex items-center gap-1.5 ml-2 border border-neutral-200 dark:border-neutral-800 rounded-md px-2 py-0.5 bg-neutral-50 dark:bg-neutral-950">
                  <input
                    type="color"
                    value={primaryColor}
                    onChange={(e) => setPrimaryColor(e.target.value)}
                    className="size-4 rounded cursor-pointer border-0 bg-transparent p-0"
                  />
                  <span className="text-[10px] font-mono text-neutral-600 dark:text-neutral-400 uppercase">
                    {primaryColor}
                  </span>
                </div>
              </div>
            </div>

            {/* Note box */}
            <div className="p-3 rounded-lg border border-neutral-100 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-950/30 text-[11px] text-neutral-500 space-y-1">
              <p className="flex items-center gap-1.5 font-medium text-neutral-700 dark:text-neutral-300">
                <Sparkles className="size-3.5 text-blue-500" />
                How Outreach Claim Works
              </p>
              <p className="leading-relaxed">
                Creates an assistant with a live test sandbox at{" "}
                <code className="text-neutral-700 dark:text-neutral-300">/claim/[token]</code>. The prospect can test questions with zero login and claim the bot to their account with 1 click.
              </p>
            </div>

            {/* Modal Actions */}
            <div className="flex justify-end gap-2 pt-2 border-t border-neutral-100 dark:border-neutral-800">
              <button
                type="button"
                onClick={handleReset}
                className="px-3 py-1.5 border border-neutral-200 dark:border-neutral-800 rounded-lg text-xs font-semibold hover:bg-neutral-50 dark:hover:bg-neutral-800 cursor-pointer text-neutral-700 dark:text-neutral-350"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="px-4 py-1.5 bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 rounded-lg text-xs font-semibold hover:opacity-90 cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
              >
                {loading ? (
                  <>
                    <Loader2 className="size-3.5 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    Generate Link & Email <ArrowRight className="size-3.5" />
                  </>
                )}
              </button>
            </div>
          </form>
        ) : (
          /* View 2: Generated Result View */
          <div className="space-y-4">
            <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/60 flex items-center gap-2.5">
              <div className="size-6 rounded-full bg-emerald-600 text-white flex items-center justify-center shrink-0">
                <Check className="size-3.5" />
              </div>
              <div className="text-xs">
                <p className="font-bold text-emerald-900 dark:text-emerald-100">
                  Claimable Assistant Created!
                </p>
                <p className="text-[11px] text-emerald-700 dark:text-emerald-400">
                  Ready to send to {targetName}. Active for 14 days.
                </p>
              </div>
            </div>

            {/* Claim Sandbox Link */}
            <div className="space-y-1.5">
              <label className="block text-[10px] font-semibold text-neutral-500 uppercase">
                Public Test & Claim Sandbox Link
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={result.claim_url}
                  className="flex-1 bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-lg px-3 py-2 text-xs font-mono text-neutral-800 dark:text-neutral-200 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => handleCopy(result.claim_url, "link")}
                  className="px-3 py-2 bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-750 border border-neutral-200 dark:border-neutral-700 rounded-lg text-xs font-semibold cursor-pointer flex items-center gap-1.5 shrink-0"
                >
                  {copiedLink ? <Check className="size-3.5 text-emerald-500" /> : <Copy className="size-3.5" />}
                  {copiedLink ? "Copied" : "Copy"}
                </button>
                <a
                  href={result.claim_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-2 bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 rounded-lg text-xs font-semibold hover:opacity-90 flex items-center gap-1.5 shrink-0"
                >
                  <ExternalLink className="size-3.5" />
                  Test
                </a>
              </div>
            </div>

            {/* Cold Outreach Email Copy */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="block text-[10px] font-semibold text-neutral-500 uppercase flex items-center gap-1.5">
                  <Mail className="size-3 text-neutral-400" />
                  Personalized Outreach Email Template
                </label>
                <button
                  type="button"
                  onClick={() => handleCopy(result.email_template, "email")}
                  className="text-[11px] font-semibold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer flex items-center gap-1"
                >
                  {copiedEmail ? <Check className="size-3 text-emerald-500" /> : <Copy className="size-3" />}
                  {copiedEmail ? "Copied Email!" : "Copy Email"}
                </button>
              </div>
              <textarea
                readOnly
                rows={7}
                value={result.email_template}
                className="w-full bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-lg p-3 text-[11px] font-sans text-neutral-700 dark:text-neutral-300 focus:outline-none resize-none leading-relaxed"
              />
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between pt-2 border-t border-neutral-100 dark:border-neutral-800">
              <span className="text-[10px] text-neutral-400 font-mono">
                Token: {result.claim_token}
              </span>
              <button
                type="button"
                onClick={handleReset}
                className="px-4 py-1.5 bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 rounded-lg text-xs font-semibold hover:opacity-90 cursor-pointer"
              >
                Done
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
