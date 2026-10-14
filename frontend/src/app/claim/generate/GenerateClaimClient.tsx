"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Share2,
  Sparkles,
  Globe,
  Loader2,
  Copy,
  Check,
  ExternalLink,
  ArrowRight,
  Bot,
  Mail,
  ShieldAlert,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { fetchBackend, BACKEND_URL } from "@/lib/backend-client";

export default function GenerateClaimClient() {
  const router = useRouter();
  const [targetName, setTargetName] = useState("");
  const [targetUrl, setTargetUrl] = useState("");
  const [founderName, setFounderName] = useState("");
  const [founderEmail, setFounderEmail] = useState("");
  const [primaryColor, setPrimaryColor] = useState("#00c8ff");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedEmail, setCopiedEmail] = useState(false);

  const [result, setResult] = useState<{
    bot_id: string;
    claim_token: string;
    claim_url: string;
    demo_expires_at: string;
    email_template: string;
  } | null>(null);

  async function handleGenerate(e: React.FormEvent) {
    e.preventDefault();
    if (!targetName.trim() || !targetUrl.trim()) return;

    setLoading(true);
    setError(null);
    try {
      let formattedUrl = targetUrl.trim();
      if (!/^https?:\/\//i.test(formattedUrl)) {
        formattedUrl = `https://${formattedUrl}`;
      }

      const supabase = createClient();
      const res = await fetchBackend(supabase, "/api/claim/generate", {
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
        throw new Error(err.detail || "Failed to generate claimable demo bot. Please sign in first.");
      }

      const data = await res.json();
      setResult(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error creating outreach assistant");
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
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans">
      {/* Top Header */}
      <header className="sticky top-0 z-30 bg-white/90 backdrop-blur-md border-b border-slate-200/80 px-4 sm:px-8 h-16 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/" className="flex items-center gap-2.5 group">
            <Image
              src="/favicon.png"
              alt="Chatty Logo"
              width={28}
              height={28}
              className="size-7 object-contain"
              priority
            />
            <span className="font-semibold text-slate-900 text-base tracking-tight">Chatty</span>
          </Link>
          <span className="text-slate-300 font-light hidden sm:inline">|</span>
          <span className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-100">
            <Sparkles className="size-3" />
            Outreach Bot Engine
          </span>
        </div>

        <Link
          href="/dashboard"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-700 hover:text-slate-900 px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 transition-colors"
        >
          <span>Dashboard</span>
          <ArrowRight className="size-3.5" />
        </Link>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-3xl w-full mx-auto px-4 py-8 sm:py-12">
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 sm:p-8 space-y-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200/60">
              <Share2 className="size-3.5" />
              Pre-Trained Demo Link Generator
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              Generate an Outreach AI Assistant
            </h1>
            <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
              Create a personalized, brand-styled demo chatbot trained on any target startup’s website.
              Send the claim link directly in cold emails or Twitter DMs—prospects can test it with zero sign-up and claim it with 1 click.
            </p>
          </div>

          {error && (
            <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700 flex items-start gap-2.5">
              <ShieldAlert className="size-4 shrink-0 mt-0.5 text-red-600" />
              <div>
                <p className="font-semibold">Generation Notice</p>
                <p className="text-red-600 mt-0.5">{error}</p>
                {error.includes("sign in") && (
                  <Link href="/login" className="font-semibold underline mt-1 inline-block">
                    Click here to log into your Chatty dashboard
                  </Link>
                )}
              </div>
            </div>
          )}

          {!result ? (
            <form onSubmit={handleGenerate} className="space-y-4 pt-2">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                    Company Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. AirJelly"
                    value={targetName}
                    onChange={(e) => setTargetName(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 focus:bg-white focus:outline-none focus:border-blue-500 transition-colors"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                    Website URL <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <Globe className="size-3.5 absolute left-3.5 top-3 text-slate-400" />
                    <input
                      type="text"
                      placeholder="https://www.airjelly.ai"
                      value={targetUrl}
                      onChange={(e) => setTargetUrl(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3.5 py-2.5 text-xs text-slate-900 focus:bg-white focus:outline-none focus:border-blue-500 transition-colors"
                      required
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                    Founder Name
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Alex"
                    value={founderName}
                    onChange={(e) => setFounderName(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 focus:bg-white focus:outline-none focus:border-blue-500 transition-colors"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                    Founder Email
                  </label>
                  <input
                    type="email"
                    placeholder="alex@target.com"
                    value={founderEmail}
                    onChange={(e) => setFounderEmail(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 focus:bg-white focus:outline-none focus:border-blue-500 transition-colors"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                    Brand Color
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={primaryColor}
                      onChange={(e) => setPrimaryColor(e.target.value)}
                      className="size-9 rounded-lg border border-slate-200 cursor-pointer p-0.5 bg-white"
                    />
                    <input
                      type="text"
                      value={primaryColor}
                      onChange={(e) => setPrimaryColor(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono text-slate-900 focus:bg-white focus:outline-none focus:border-blue-500 uppercase"
                    />
                  </div>
                </div>
              </div>

              <div className="pt-3">
                <button
                  type="submit"
                  disabled={loading || !targetName.trim() || !targetUrl.trim()}
                  className="w-full py-3 px-4 rounded-xl bg-slate-900 hover:bg-black text-white text-xs sm:text-sm font-semibold shadow-sm transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {loading ? (
                    <>
                      <Loader2 className="size-4 animate-spin" />
                      <span>Creating &amp; crawling target website...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="size-4 text-amber-300" />
                      <span>Generate Pre-Trained Demo Assistant</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          ) : (
            <div className="space-y-6 pt-2">
              <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-between gap-3 text-xs text-emerald-800">
                <div className="flex items-center gap-2">
                  <Check className="size-4 text-emerald-600 shrink-0" />
                  <span className="font-semibold">Assistant Created &amp; Background Crawl Triggered!</span>
                </div>
                <button
                  type="button"
                  onClick={() => setResult(null)}
                  className="text-xs font-semibold underline text-emerald-700 hover:text-emerald-900 cursor-pointer"
                >
                  Create another
                </button>
              </div>

              {/* Public Link Box */}
              <div className="space-y-2">
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider">
                  Public Claim &amp; Sandbox Link
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    readOnly
                    value={result.claim_url}
                    className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs font-mono text-slate-800 select-all"
                  />
                  <button
                    type="button"
                    onClick={() => handleCopy(result.claim_url, "link")}
                    className="px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-black text-white text-xs font-medium flex items-center gap-1.5 cursor-pointer shrink-0"
                  >
                    {copiedLink ? <Check className="size-3.5 text-emerald-400" /> : <Copy className="size-3.5" />}
                    <span>{copiedLink ? "Copied" : "Copy Link"}</span>
                  </button>
                  <a
                    href={result.claim_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 cursor-pointer shrink-0"
                    title="Open Sandbox"
                  >
                    <ExternalLink className="size-4" />
                  </a>
                </div>
              </div>

              {/* Email Template Box */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider">
                    Personalized Outreach Email Pitch
                  </label>
                  <button
                    type="button"
                    onClick={() => handleCopy(result.email_template, "email")}
                    className="text-xs font-semibold text-blue-600 hover:text-blue-800 flex items-center gap-1 cursor-pointer"
                  >
                    {copiedEmail ? <Check className="size-3.5 text-emerald-600" /> : <Copy className="size-3.5" />}
                    <span>{copiedEmail ? "Copied Pitch" : "Copy Email Pitch"}</span>
                  </button>
                </div>
                <textarea
                  readOnly
                  rows={8}
                  value={result.email_template}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3.5 text-xs font-mono text-slate-800 leading-relaxed resize-none select-all"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-3">
                <Link
                  href="/dashboard"
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-black text-white text-xs font-semibold shadow-sm"
                >
                  <span>Go to Chatty Dashboard</span>
                  <ArrowRight className="size-3.5" />
                </Link>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
