"use client";

import React, { Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowLeft, Sparkles, Shield, Cpu } from "lucide-react";
import { McpHub, AgentId } from "@/components/mcp/McpHub";

function McpPageContent() {
  const searchParams = useSearchParams();
  const tabParam = (searchParams.get("tab") || "chatgpt") as AgentId;

  return (
    <div
      className="min-h-screen text-[var(--color-text)] selection:bg-[#c67139] selection:text-white"
      style={{
        background: "var(--color-bg, #f5ead8)",
        color: "var(--color-text, #201e1d)",
      }}
    >
      {/* Top Navbar */}
      <header
        className="border-b sticky top-0 z-40 backdrop-blur-md"
        style={{
          background: "color-mix(in srgb, var(--color-bg, #f5ead8) 90%, white 10%)",
          borderColor: "var(--color-divider, rgba(32, 30, 29, 0.16))",
        }}
      >
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link
              href="/"
              className="flex items-center gap-2 hover:opacity-80 transition text-xs font-semibold"
              style={{ color: "var(--color-text, #201e1d)" }}
            >
              <ArrowLeft className="size-4" />
              <span>Back to Chatty</span>
            </Link>
            <span className="opacity-30">|</span>
            <div className="flex items-center gap-2">
              <span className="size-2 rounded-full" style={{ background: "var(--color-accent, #c67139)" }} />
              <span className="text-sm font-bold tracking-tight" style={{ fontFamily: "var(--font-heading)" }}>
                Chatty MCP
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/dashboard"
              className="px-4 py-1.5 rounded-full text-xs font-semibold border transition hover:bg-black/5"
              style={{ borderColor: "var(--color-divider, rgba(32, 30, 29, 0.16))", color: "var(--color-text, #201e1d)" }}
            >
              Dashboard
            </Link>
            <Link
              href="/signup?next=/oauth/consent"
              className="px-4 py-1.5 rounded-full text-xs font-bold text-white transition shadow-sm hover:brightness-105"
              style={{ background: "var(--color-accent, #c67139)" }}
            >
              Sign up
            </Link>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-10 sm:py-16 space-y-12">
        <McpHub defaultAgent={tabParam} showCatalog={true} />
      </main>

      {/* Footer */}
      <footer
        className="border-t py-8 text-center text-xs"
        style={{
          borderColor: "var(--color-divider, rgba(32, 30, 29, 0.16))",
          color: "color-mix(in srgb, var(--color-text, #201e1d) 65%, transparent)",
        }}
      >
        <div className="max-w-6xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p>© 2026 Chatty (PersonaliAI). All rights reserved.</p>
          <div className="flex items-center gap-4">
            <Link href="/privacy" className="hover:opacity-80 transition">
              Privacy Policy
            </Link>
            <Link href="/terms" className="hover:opacity-80 transition">
              Terms of Service
            </Link>
            <Link href="/help" className="hover:opacity-80 transition">
              Help Center
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default function McpPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-black text-white p-8">Loading MCP Documentation...</div>}>
      <McpPageContent />
    </Suspense>
  );
}
