"use client";

import { McpHub } from "@/components/mcp/McpHub";

export function McpTab() {
  return (
    <div className="max-w-5xl mx-auto w-full py-6 px-4 space-y-6">
      <McpHub defaultAgent="cursor" showCatalog={true} />
    </div>
  );
}
