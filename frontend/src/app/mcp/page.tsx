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
    <div className="min-h-screen bg-black text-white selection:bg-[#f97316] selection:text-white">
      {/* Top Navbar */}
      <header className="border-b border-neutral-900 bg-neutral-950/80 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link
              href="/"
              className="flex items-center gap-2 text-neutral-400 hover:text-white transition text-xs font-semibold"
            >
              <ArrowLeft className="size-4" />
              <span>Back to Chatty</span>
            </Link>
            <span className="text-neutral-800">|</span>
            <div className="flex items-center gap-2">
              <span className="size-2 rounded-full bg-[#f97316]" />
              <span className="text-sm font-bold tracking-tight text-white">Chatty MCP</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/dashboard"
              className="px-3.5 py-1.5 rounded-full text-xs font-semibold text-neutral-300 hover:text-white hover:bg-neutral-800 transition"
            >
              Dashboard
            </Link>
            <Link
              href="/signup?next=/oauth/consent"
              className="px-4 py-1.5 rounded-full text-xs font-bold bg-[#f97316] text-white hover:bg-[#ea580c] transition shadow-md"
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
      <footer className="border-t border-neutral-900 bg-neutral-950 py-8 text-center text-xs text-neutral-500">
        <div className="max-w-6xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p>© 2026 Chatty (PersonaliAI). All rights reserved.</p>
          <div className="flex items-center gap-4">
            <Link href="/privacy" className="hover:text-neutral-400 transition">
              Privacy Policy
            </Link>
            <Link href="/terms" className="hover:text-neutral-400 transition">
              Terms of Service
            </Link>
            <Link href="/help" className="hover:text-neutral-400 transition">
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
