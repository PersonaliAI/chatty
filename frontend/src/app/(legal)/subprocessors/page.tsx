import type { Metadata } from "next";
import { PageTitle, H2, P, UL, Mail } from "../_ui";

export const metadata: Metadata = {
  title: "Sub-processor Registry | Chatty",
  description: "Official list of sub-processors engaged by PersonaliAI for Chatty in accordance with GDPR Article 28.",
};

interface Subprocessor {
  name: string;
  purpose: string;
  entity: string;
  location: string;
  mechanism: string;
  certifications: string;
}

const SUBPROCESSORS: Subprocessor[] = [
  {
    name: "Supabase Inc.",
    purpose: "Primary PostgreSQL database hosting, row-level access control, vector search embeddings, and file storage.",
    entity: "Supabase Inc.",
    location: "United States / AWS Multi-Region (AP / EU / US)",
    mechanism: "EU Standard Contractual Clauses (SCCs)",
    certifications: "SOC 2 Type II, ISO 27001",
  },
  {
    name: "Google Cloud Platform & Vertex AI",
    purpose: "Large language model inference (Gemini 2.5 Flash / Vertex AI) under strict zero-training enterprise data agreements.",
    entity: "Google Ireland Limited / Google LLC",
    location: "European Union / United States",
    mechanism: "EU-U.S. Data Privacy Framework (DPF) & SCCs",
    certifications: "ISO 27001, SOC 2/3, FedRAMP High",
  },
  {
    name: "Meta Platforms Ireland Ltd.",
    purpose: "Delivery and reception of WhatsApp Business messages, Instagram DMs, and Facebook Messenger webhooks.",
    entity: "Meta Platforms Ireland Ltd.",
    location: "European Union (Ireland) / United States",
    mechanism: "Meta EU Data Processing Terms & SCCs",
    certifications: "ISO 27001, SOC 2",
  },
  {
    name: "Twilio Inc.",
    purpose: "Delivery and inbound reception of Two-Way SMS messages and customer support notifications.",
    entity: "Twilio Inc.",
    location: "United States",
    mechanism: "Binding Corporate Rules (BCRs) & EU SCCs",
    certifications: "ISO 27001, SOC 2 Type II",
  },
  {
    name: "Resend Inc.",
    purpose: "Transactional email delivery, booking confirmation receipts, and two-way email support forwarding.",
    entity: "Resend Inc.",
    location: "United States",
    mechanism: "Data Processing Agreement with EU SCCs",
    certifications: "SOC 2 Type II",
  },
  {
    name: "Lemon Squeezy LLC & Stripe Inc.",
    purpose: "Merchant of Record, billing orchestration, payment processing, and VAT/sales tax compliance.",
    entity: "Lemon Squeezy LLC / Stripe Inc.",
    location: "United States / United Kingdom",
    mechanism: "EU-U.S. Data Privacy Framework (DPF) & SCCs",
    certifications: "PCI-DSS Level 1, SOC 1 & 2",
  },
  {
    name: "Sentry (Functional Software Inc.)",
    purpose: "Application crash reporting and error diagnostics with automated PII scrubbing.",
    entity: "Functional Software Inc.",
    location: "United States",
    mechanism: "EU-U.S. Data Privacy Framework (DPF) & SCCs",
    certifications: "SOC 2 Type II, ISO 27001",
  },
];

export default function SubprocessorsPage() {
  return (
    <>
      <PageTitle updated="October 22, 2026">Sub-processor Registry</PageTitle>

      <P>
        Under <strong>Article 28 of the EU General Data Protection Regulation (GDPR)</strong>, PersonaliAI
        maintains an up-to-date registry of third-party sub-processors authorized to process personal data on
        behalf of Chatty customers.
      </P>

      <H2>Authorized Third-Party Sub-processors</H2>
      <P>
        All sub-processors undergo stringent technical and security assessments. We require every sub-processor
        to maintain enterprise-grade security standards, encrypt data at rest and in transit, and execute
        appropriate data transfer mechanisms including the European Commission&rsquo;s Standard Contractual Clauses (SCCs)
        or certification under the EU-U.S. Data Privacy Framework (DPF).
      </P>

      <div className="not-prose my-8 overflow-hidden rounded-xl border border-zinc-200">
        <table className="min-w-full divide-y divide-zinc-200 text-left text-xs">
          <thead className="bg-zinc-50 font-semibold text-zinc-900">
            <tr>
              <th className="px-4 py-3">Sub-processor</th>
              <th className="px-4 py-3">Processing Purpose</th>
              <th className="px-4 py-3">Hosting Country</th>
              <th className="px-4 py-3">Transfer Safeguard</th>
              <th className="px-4 py-3">Certifications</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100 bg-white text-zinc-600">
            {SUBPROCESSORS.map((sub) => (
              <tr key={sub.name} className="hover:bg-zinc-50/50">
                <td className="px-4 py-3.5 font-bold text-zinc-900 whitespace-nowrap">{sub.name}</td>
                <td className="px-4 py-3.5 leading-relaxed">{sub.purpose}</td>
                <td className="px-4 py-3.5 whitespace-nowrap">{sub.location}</td>
                <td className="px-4 py-3.5 text-zinc-700 whitespace-nowrap">{sub.mechanism}</td>
                <td className="px-4 py-3.5 whitespace-nowrap font-mono text-[11px] text-zinc-500">{sub.certifications}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <H2>Zero AI Model Training Commitment</H2>
      <P>
        PersonaliAI strictly mandates that third-party AI model providers (including Google Cloud / Vertex AI and OpenAI)
        do <strong>not</strong> use customer prompts, knowledge documents, or conversational data to train, retrain,
        or fine-tune public foundation models. Customer data is processed solely in transient memory to generate
        real-time responses.
      </P>

      <H2>Sub-processor Change Notifications</H2>
      <P>
        Chatty notifies workspace owners at least 30 days prior to authorizing any new sub-processor that will have
        access to customer personal data. Customers may object to any newly proposed sub-processor on reasonable
        data protection grounds by emailing <Mail user="privacy" />.
      </P>

      <H2>Questions &amp; Legal Inquiries</H2>
      <P>
        For inquiries regarding our sub-processor security evaluations or data protection agreements, contact{" "}
        <Mail user="privacy" />.
      </P>
    </>
  );
}
