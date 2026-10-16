"use client";

import dynamic from "next/dynamic";
import { Loader2 } from "lucide-react";

const FlowBuilderScreen = dynamic(
  () => import("../flow-builder/flow-builder-screen"),
  {
    ssr: false,
    loading: () => (
      <div style={{ minHeight: "100vh", background: "#f7f9fc", display: "grid", placeItems: "center" }}>
        <Loader2 className="animate-spin text-neutral-400" size={28} />
      </div>
    ),
  }
);

export default function FlowBuilderClient() {
  return <FlowBuilderScreen />;
}
