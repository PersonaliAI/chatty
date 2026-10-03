import FlowRoute from "./flow-route";
import { Suspense } from "react";

export const metadata = {
  title: "My Chatty flows",
  description: "Manage Chatty conversation flows",
};

export default function FlowPage() {
  return <Suspense fallback={<div style={{ minHeight: "100vh", background: "#f7f9fc" }} />}><FlowRoute /></Suspense>;
}
