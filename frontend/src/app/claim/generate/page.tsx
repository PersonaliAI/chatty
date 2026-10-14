import type { Metadata } from "next";
import GenerateClaimClient from "./GenerateClaimClient";

export const metadata: Metadata = {
  title: "Generate Outreach Demo Bot | Chatty",
  description: "Create pre-trained, brand-aligned demo AI customer support assistants for cold outreach and client handoffs.",
};

export default function GenerateClaimPage() {
  return <GenerateClaimClient />;
}
