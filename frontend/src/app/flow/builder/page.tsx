import { Suspense } from "react";
import FlowBuilderClient from "./FlowBuilderClient";

export const metadata = {
  title: "Chatty Flow Builder",
  description: "Build and publish a Chatty conversation flow",
};

export default function FlowBuilderRoute() {
  return (
    <Suspense fallback={<div style={{ minHeight: "100vh", background: "#f7f9fc" }} />}>
      <FlowBuilderClient />
    </Suspense>
  );
}
