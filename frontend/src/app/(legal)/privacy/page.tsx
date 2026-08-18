import type { Metadata } from "next";
import { PageTitle, H2, P, UL, Mail } from "../_ui";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "How Chatty by PersonaliAI collects, uses, stores, and protects your data, including data accessed through the Zoom integration.",
};

export default function PrivacyPage() {
  return (
    <>
      <PageTitle updated="June 22, 2026">Privacy Policy</PageTitle>

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

      <H2>How we use information</H2>
      <UL>
        <li>To operate your chatbot, answer visitor questions, and capture leads.</li>
        <li>To schedule meetings and deliver meeting links via chat and email when a booking is made.</li>
        <li>To maintain, secure, and improve the Service.</li>
        <li>To communicate with you about your account and support requests.</li>
      </UL>
      <P>We do not sell your personal information or use connected-account data for advertising.</P>

      <H2>Data sharing</H2>
      <P>
        We share data only with subprocessors that help us run the Service (for example, our cloud hosting,
        database, and email-delivery providers) and only as needed to provide it. We may disclose information
        where required by law. We do not share Zoom data with any third party other than as needed to deliver
        the meeting links you request.
      </P>

      <H2>Data retention &amp; deletion</H2>
      <P>
        We retain data for as long as your account is active. You may disconnect any integration at any time
        from your dashboard, which deletes the stored OAuth tokens for that provider. If you remove the Chatty
        app from the Zoom Marketplace, we delete the associated Zoom tokens and account email. You may request
        deletion of your entire account and associated data by contacting <Mail user="privacy" />.
      </P>

      <H2>Your rights</H2>
      <P>
        Depending on your location, you may have the right to access, correct, export, or delete your personal
        information, and to object to or restrict certain processing. To exercise these rights, contact
        {" "}<Mail user="privacy" />. We will respond within the timeframe required by applicable law.
      </P>

      <H2>Security</H2>
      <P>
        We use encryption in transit and at rest, access controls, and reputable infrastructure providers to
        protect your data. No method of transmission or storage is completely secure, but we work to protect
        your information using industry-standard safeguards.
      </P>

      <H2>Contact</H2>
      <P>Questions about this policy? Email <Mail user="privacy" />.</P>
    </>
  );
}
