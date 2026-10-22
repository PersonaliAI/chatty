import type { Metadata } from "next";
import { PageTitle, H2, P, UL, Mail } from "../_ui";

export const metadata: Metadata = {
  title: "Data Processing Addendum (DPA) | Chatty",
  description: "Chatty Data Processing Addendum (DPA) under Article 28 of the EU General Data Protection Regulation (GDPR).",
};

export default function DPAPage() {
  return (
    <>
      <PageTitle updated="October 22, 2026">Data Processing Addendum (DPA)</PageTitle>

      <P>
        This Data Processing Addendum (&ldquo;<strong>DPA</strong>&rdquo;) supplements the Terms of Service
        and Privacy Policy between <strong>PersonaliAI</strong> (&ldquo;<strong>Processor</strong>&rdquo;,
        &ldquo;we&rdquo;, &ldquo;us&rdquo;) and the customer agreeing to these terms (&ldquo;<strong>Controller</strong>&rdquo;,
        &ldquo;you&rdquo;). This DPA governs the processing of Personal Data in connection with your use of
        Chatty (the &ldquo;Service&rdquo;) pursuant to <strong>Article 28 of the General Data Protection Regulation
        (Regulation (EU) 2016/679)</strong> (&ldquo;<strong>GDPR</strong>&rdquo;).
      </P>

      <H2>1. Roles and Scope of Processing</H2>
      <P>
        1.1 <strong>Roles of the Parties:</strong> You acknowledge and agree that with respect to end-user Personal Data
        collected or processed through your chatbots, web widgets, and integrated omnichannel messaging channels
        (WhatsApp, Instagram, Telegram, SMS, and Email), you are the <strong>Data Controller</strong> and PersonaliAI
        is the <strong>Data Processor</strong>.
      </P>
      <P>
        1.2 <strong>Scope and Subject Matter:</strong> The Processor shall process Personal Data solely on behalf of and
        in accordance with the Controller&rsquo;s documented instructions, including with respect to transfers of Personal
        Data outside the European Economic Area (EEA), unless required to do so by applicable European Union or Member State law.
      </P>
      <P>
        1.3 <strong>Categories of Data:</strong> Contact information (name, email address, phone number), chat transcripts,
        support inquiries, meeting booking records, and conversational metadata submitted by end users.
      </P>
      <P>
        1.4 <strong>Categories of Data Subjects:</strong> Website visitors, customers, and prospects who communicate with
        the Controller through the Chatty service.
      </P>

      <H2>2. Confidentiality and Security (Article 32)</H2>
      <P>
        2.1 <strong>Personnel Confidentiality:</strong> The Processor shall ensure that persons authorized to process the
        Personal Data have committed themselves to confidentiality or are under an appropriate statutory obligation of confidentiality.
      </P>
      <P>
        2.2 <strong>Technical and Organizational Measures:</strong> The Processor implements and maintains state-of-the-art
        technical and organizational security measures, including:
      </P>
      <UL>
        <li><strong>Cryptographic Isolation:</strong> Symmetric authenticated encryption (Fernet / AES-256) for stored secrets, BYOK API keys, and OAuth tokens.</li>
        <li><strong>Encryption in Transit:</strong> Mandatory TLS 1.3 encryption across all public APIs, widgets, and webhook delivery pipelines.</li>
        <li><strong>Multi-Tenant Row-Level Security:</strong> Strict PostgreSQL database Row-Level Security (RLS) isolating each Controller&rsquo;s workspace data.</li>
        <li><strong>Automated Data Loss Prevention (DLP):</strong> Inbound PII redaction of credit cards (Luhn algorithm), Social Security numbers, and bank account details (ISO 7064 IBAN MOD 97).</li>
        <li><strong>HMAC Webhook Verification:</strong> Cryptographic verification of all incoming omnichannel webhooks (Meta Graph API, Twilio, Telegram).</li>
      </UL>

      <H2>3. Sub-processors (Article 28(2) &amp; 28(4))</H2>
      <P>
        3.1 <strong>Authorized Sub-processors:</strong> The Controller provides general authorization for the Processor
        to engage the sub-processors listed in the official <a href="/subprocessors" className="font-medium text-[#f95721] hover:underline">Chatty Sub-processor Registry</a>.
      </P>
      <P>
        3.2 <strong>Sub-processor Obligations:</strong> The Processor shall impose data protection terms on each sub-processor
        that provide at least the same level of protection for Personal Data as those in this DPA. The Processor remains fully
        liable to the Controller for the performance of each sub-processor&rsquo;s obligations.
      </P>
      <P>
        3.3 <strong>Zero AI Foundation Training Guarantee:</strong> Chatty contracts with LLM inference providers
        (Google Vertex AI, OpenAI) under enterprise terms ensuring customer chat data and uploaded business documents
        are <strong>never</strong> used to train or retrain generalized or foundational AI models.
      </P>

      <H2>4. Assistance with Data Subject Rights (Articles 12–23)</H2>
      <P>
        4.1 <strong>Assistance:</strong> Taking into account the nature of the processing, the Processor shall assist the Controller
        by appropriate technical and organizational measures, insofar as this is possible, for the fulfilment of the Controller&rsquo;s
        obligation to respond to requests for exercising the data subject&rsquo;s rights under Chapter III of the GDPR:
      </P>
      <UL>
        <li><strong>Right to Erasure (&ldquo;Right to be Forgotten&rdquo;):</strong> The Controller can trigger instant, cascading erasure of contact and conversation data via the dashboard or API endpoint (<code>DELETE /api/admin/inbox/contacts/&#123;id&#125;</code>).</li>
        <li><strong>Right of Access &amp; Portability:</strong> Controllers can export complete contact and lead records in standard JSON/CSV format.</li>
        <li><strong>Visitor Self-Service Erasure:</strong> Website visitors can independently erase their session credentials and local conversational storage directly within the chat widget.</li>
      </UL>

      <H2>5. Personal Data Breach Notification (Article 33)</H2>
      <P>
        The Processor shall notify the Controller without undue delay after becoming aware of a personal data breach affecting
        the Controller&rsquo;s Personal Data, and in any event within <strong>72 hours</strong>. The notice shall describe the
        nature of the breach, the categories and approximate number of data subjects affected, and the mitigation measures taken.
      </P>

      <H2>6. International Data Transfers (Articles 44–49)</H2>
      <P>
        6.1 <strong>Standard Contractual Clauses:</strong> Where Personal Data is transferred outside the European Economic
        Area (EEA) to a country not recognized as providing an adequate level of data protection, the parties agree that the
        transfer shall be governed by Module 2 (Controller-to-Processor) of the <strong>Standard Contractual Clauses (SCCs)</strong>
        adopted by the European Commission (Implementing Decision (EU) 2021/914).
      </P>
      <P>
        6.2 <strong>Data Privacy Framework:</strong> Where applicable, transfers to US sub-processors are conducted pursuant
        to the EU-U.S. Data Privacy Framework (DPF).
      </P>

      <H2>7. Return and Deletion of Personal Data</H2>
      <P>
        Upon termination of the Service or upon Controller&rsquo;s request, the Processor shall delete or return all Personal Data
        to the Controller and delete existing copies, unless applicable European Union or Member State law requires continued storage.
        Deleting a bot immediately purges all associated conversational history, indexed knowledge embeddings, and contact records.
      </P>

      <H2>8. Contact and DPO Inquiries</H2>
      <P>
        To execute an enterprise-signed copy of this DPA, or for Data Protection Officer (DPO) inquiries, contact{" "}
        <Mail user="privacy" />.
      </P>
    </>
  );
}
