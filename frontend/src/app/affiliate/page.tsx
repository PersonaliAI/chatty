import type { Metadata } from "next";
import { AffiliatePortalClient } from "./AffiliatePortalClient";

export const metadata: Metadata = {
  title: "Chatty Affiliate Partner Portal",
  description:
    "Join the Chatty Partner Program. Earn 30% recurring commissions for 12 months by referring customers to the modern open-source AI customer support platform.",
};

export default function AffiliatePage() {
  return <AffiliatePortalClient />;
}
