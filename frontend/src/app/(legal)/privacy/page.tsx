import type { Metadata } from "next";
import { PageTitle, H2, P, UL, Mail } from "../_ui";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "How Chatty by PersonaliAI collects, uses, stores, and protects your data, including data accessed through the Zoom integration.",
};

export default function PrivacyPage() {
  return (
    <>
      <PageTitle updated="September 9, 2026">Privacy Policy</PageTitle>

      <P>
        This Privacy Policy explains how PersonaliAI (&ldquo;PersonaliAI&rdquo;, &ldquo;we&rdquo;, &ldquo;us&rdquo;)
        collects, uses, stores, shares, and protects information when you use Chatty
        (the &ldquo;Service&rdquo;), including the optional Chatty Bookings integration for Zoom.
        It is written to comply with applicable data-protection laws and clarifies your rights
        over your personal information.
      </P>

      <H2>Information we collect</H2>
      <UL>
        <li><strong>Account data:</strong> name, email address, and authentication identifiers when you sign up.</li>
        <li><strong>Chatbot content:</strong> the files, website URLs, and text you provide to train your assistant.</li>
        <li><strong>Conversation data:</strong> messages exchanged with your chatbot and any lead details visitors submit.</li>
        <li><strong>Integration data:</strong> OAuth access and refresh tokens, and the email address of the connected account, for services you choose to connect (Google, Microsoft, Zoom).</li>
      </UL>

      <H2>Zoom integration data</H2>
      <P>
        If you connect your Zoom account, Chatty requests only the permission required to create meetings
        on your behalf (<code>meeting:write</code>). We use this access for a single purpose: to schedule a
        Zoom meeting and generate a join link when a visitor books a call through your chatbot. We access:
      </P>
      <UL>
        <li>Your Zoom account email address (to confirm which account is connected).</li>
        <li>Meeting objects we create (topic, start time, duration, and the resulting join URL and meeting ID).</li>
      </UL>
      <P>
        We do <strong>not</strong> read your existing Zoom meetings, recordings, contacts, or chat history,
        and we never join your meetings. Zoom OAuth tokens are stored encrypted at rest and are used only to
        create meetings you initiate through bookings.
      </P>

      <H2>Google user data</H2>
      <P>
        If you choose to connect your Google account, Chatty requests access to specific Google services
        (Google Calendar and Google Drive) strictly to provide user-facing features you configure:
      </P>
      <UL>
        <li>
          <strong>Google Calendar (<code>.../auth/calendar</code>, <code>.../auth/calendar.events</code>):</strong> Used
          to check host availability (free/busy slots) so website visitors can schedule appointments without double-booking,
          to create calendar events with Google Meet conference links upon booking confirmation, and to display upcoming
          customer meetings in the dashboard calendar.
        </li>
        <li>
          <strong>Google Drive (<code>.../auth/drive</code>):</strong> Used only when you explicitly connect and select a Google Drive
          folder or file in your Knowledge Base settings. Chatty reads the designated documents (such as PDFs, Docs, Sheets, and text files)
          solely to extract content and create search embeddings so your AI assistant can accurately answer customer inquiries
          based on your business documentation.
        </li>
      </UL>
      <P>
        <strong>Google Limited Use Compliance:</strong> PersonaliAI&apos;s use and transfer to any other app of information
        received from Google APIs will adhere to the{" "}
        <a
          href="https://developers.google.com/terms/api-services-user-data-policy"
          target="_blank"
          rel="noopener noreferrer"
          className="text-[#f97316] underline hover:opacity-80"
        >
          Google API Services User Data Policy
        </a>
        , including the Limited Use requirements.
      </P>
      <UL>
        <li>We do <strong>not</strong> use Google user data to train, retrain, or improve generalized or foundational AI/ML models.</li>
        <li>We do <strong>not</strong> sell Google user data or transfer it to third parties for advertising or profiling.</li>
        <li>Google OAuth access and refresh tokens are encrypted at rest using AES-256 and transmitted exclusively via encrypted TLS/HTTPS.</li>
        <li>You can disconnect your Google account at any time in your dashboard settings, which immediately revokes tokens and purges stored credentials.</li>
      </UL>

      <H2>How we use information</H2>
      <UL>
        <li>To operate your chatbot, answer visitor questions, and capture leads.</li>
        <li>To schedule meetings and deliver meeting links via chat and email when a booking is made.</li>
        <li>To maintain, secure, and improve the Service.</li>
        <li>To communicate with you about your account and support requests.</li>
      </UL>
      <P>We do not sell your personal information or use connected-account data for advertising.</P>

      <H2>GDPR Legal Bases for Processing (Article 6)</H2>
      <P>
        If you are located in the European Economic Area (EEA), United Kingdom, or Switzerland, our legal bases
        for processing your Personal Data include:
      </P>
      <UL>
        <li><strong>Performance of a Contract (Art. 6(1)(b)):</strong> To provide the Chatty Service, manage customer accounts, execute appointment bookings, and deliver customer support.</li>
        <li><strong>Legitimate Interests (Art. 6(1)(f)):</strong> To secure our systems, prevent fraud, scrub sensitive PII, ensure service stability, and provide business communication tools.</li>
        <li><strong>Consent (Art. 6(1)(a)):</strong> For proactive promotional marketing campaigns across SMS, email, and WhatsApp, which strictly require prior affirmative opt-in.</li>
        <li><strong>Legal Compliance (Art. 6(1)(c)):</strong> To comply with mandatory statutory and regulatory tax, billing, and accounting obligations.</li>
      </UL>

      <H2>Data Minimisation &amp; Automated PII Redaction (Article 25)</H2>
      <P>
        In accordance with Privacy by Design standards, Chatty includes an automated Data Loss Prevention (DLP) engine
        that scans incoming customer messages across chat widgets and omnichannel pipelines (WhatsApp, Instagram, Telegram, SMS, Email).
        Payment cards (Luhn MOD-10 algorithm), Social Security numbers, and bank account numbers (ISO 7064 IBAN MOD-97) are
        automatically redacted prior to prompt synthesis or persistent database storage.
      </P>

      <H2>Sub-processors &amp; Cross-Border Transfers (Articles 28, 44–49)</H2>
      <P>
        We share data only with verified sub-processors necessary to deliver the Service (cloud database, LLM inference,
        and messaging carriers). All sub-processors are vetted for SOC 2 Type II or ISO 27001 certifications.
        Transfers outside the EEA are governed by the European Commission&rsquo;s Standard Contractual Clauses (SCCs)
        or the EU-U.S. Data Privacy Framework (DPF).
      </P>
      <P>
        View our full, binding <a href="/dpa" className="font-medium text-[#f95721] hover:underline">Data Processing Addendum (DPA)</a> and
        regularly updated <a href="/subprocessors" className="font-medium text-[#f95721] hover:underline">Sub-processor Registry</a>.
      </P>

      <H2>Data Retention &amp; Storage Limitation (Article 5(1)(e))</H2>
      <P>
        We retain personal data only for as long as necessary to fulfill the purposes for which it was collected.
        Account owners can configure automated data retention periods (e.g. 30, 60, or 90 days) for their bots,
        or trigger an on-demand retention purge in dashboard settings. Deleting a bot immediately cascades deletion
        across all conversational history, leads, session notes, and knowledge base embeddings.
      </P>

      <H2>Your Data Subject Rights Under GDPR (Articles 12–23)</H2>
      <P>
        Under European data protection laws, data subjects have comprehensive rights regarding their personal data:
      </P>
      <UL>
        <li><strong>Right of Access (Art. 15):</strong> You may request a complete export of all personal data held about you.</li>
        <li><strong>Right to Rectification (Art. 16):</strong> You may correct inaccurate or incomplete personal data.</li>
        <li><strong>Right to Erasure / &ldquo;Right to be Forgotten&rdquo; (Art. 17):</strong> You may request permanent deletion of your data. Website visitors can also trigger instant self-service data erasure directly within the chat widget via the trash icon.</li>
        <li><strong>Right to Restriction of Processing (Art. 18):</strong> You may request temporary suspension of automated AI responses.</li>
        <li><strong>Right to Data Portability (Art. 20):</strong> You may receive your data in a structured, machine-readable format (JSON/CSV).</li>
        <li><strong>Right to Object (Art. 21):</strong> You may object to marketing communications at any time. All marketing emails include one-click cryptographic unsubscribe links.</li>
      </UL>
      <P>
        To exercise any of these rights, contact our Data Protection team at <Mail user="privacy" />.
        You also have the right to lodge a complaint with an EU supervisory authority in your Member State.
      </P>

      <H2>Cookies &amp; Local Storage (ePrivacy Directive)</H2>
      <P>
        The Chatty embed widget uses strictly necessary terminal storage (<code>localStorage</code> and an HttpOnly session capability token)
        solely to preserve conversational continuity during an active chat session initiated by the user. Chatty does not use
        third-party advertising cookies or cross-site tracking pixels.
      </P>

      <H2>Security Measures (Article 32)</H2>
      <P>
        We implement rigorous safeguards including symmetric Fernet / AES-256 encryption at rest for credentials,
        TLS 1.3 encryption in transit, multi-tenant Row-Level Security (RLS) isolation in PostgreSQL, and HMAC signature
        verification across all webhook integrations.
      </P>

      <H2>Contact &amp; Data Protection Officer</H2>
      <P>
        For inquiries regarding our GDPR compliance, DPA execution, or to reach our Data Protection Officer, email{" "}
        <Mail user="privacy" />.
      </P>
    </>
  );
}
