import FlowRoute from "./flow-route";
import { Suspense } from "react";

export const metadata = {
  title: "Chatty Flow Builder",
  description: "Build reliable automations for Chatty",
};

export default function FlowPage() {
  return <Suspense fallback={<div style={{ minHeight: "100vh", background: "#f7f9fc" }} />}><FlowRoute /></Suspense>;
}
