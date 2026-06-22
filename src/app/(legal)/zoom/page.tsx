import type { Metadata } from "next";
import { PageTitle, H2, P, UL, Mail } from "../_ui";

export const metadata: Metadata = {
  title: "Zoom Integration Guide",
  description: "How to add, use, and remove the Chatty Bookings integration for Zoom.",
};

export default function ZoomDocsPage() {
  return (
    <>
      <PageTitle updated="June 22, 2026">Chatty Bookings for Zoom — Setup &amp; Usage Guide</PageTitle>

      <P>
        Chatty is an AI customer-support assistant that businesses embed on their website. When a visitor
        wants to book a demo or call, Chatty collects their details, checks availability, and schedules the
        meeting. With the Zoom integration enabled, Chatty creates the meeting on <strong>your</strong> Zoom
        account and shares the join link with the visitor in chat and by email.
      </P>

      <H2>Prerequisites</H2>
      <UL>
        <li>A Chatty account at <a href="https://chatty.personaliai.com" className="text-orange-600 hover:underline">chatty.personaliai.com</a>.</li>
        <li>A Zoom account with permission to create meetings.</li>
      </UL>

      <H2>Adding the integration</H2>
      <P>To connect your Zoom account to Chatty:</P>
      <UL>
        <li>Sign in to your Chatty dashboard.</li>
        <li>Open <strong>Agent Settings &rarr; Meetings</strong>.</li>
        <li>Click <strong>Connect Zoom</strong>. You will be redirected to Zoom&apos;s secure authorization page.</li>
        <li>Review the requested permission (create meetings) and click <strong>Allow</strong>.</li>
        <li>You will be returned to Chatty, where Zoom now shows as <strong>Connected</strong> with your account email.</li>
      </UL>

      <H2>Using the integration</H2>
      <UL>
        <li>A website visitor asks to book a demo or call through your embedded Chatty widget.</li>
        <li>Chatty collects the visitor&apos;s details and a preferred time.</li>
        <li>On confirmation, Chatty creates a Zoom meeting on your connected account.</li>
        <li>The Zoom join link and meeting details are shown in the chat and emailed to both you and the visitor.</li>
      </UL>
      <P>
        Chatty only creates meetings you initiate through bookings. It does not read your existing meetings,
        recordings, or contacts, and never joins your meetings on your behalf.
      </P>

      <H2>Removing the integration</H2>
      <P>You can disconnect Chatty from Zoom at any time using either method:</P>
      <UL>
        <li>
          <strong>From Chatty:</strong> open <strong>Agent Settings &rarr; Meetings</strong> and click
          {" "}<strong>Disconnect</strong> next to Zoom. This deletes the stored Zoom tokens immediately.
        </li>
        <li>
          <strong>From Zoom:</strong> sign in to the{" "}
          <a href="https://marketplace.zoom.us" className="text-orange-600 hover:underline">Zoom App Marketplace</a>,
          go to <strong>Manage &rarr; Added Apps</strong>, find <strong>Chatty Bookings</strong>, and click
          {" "}<strong>Remove</strong>. Chatty deletes the associated tokens and account email upon removal.
        </li>
      </UL>

      <H2>Data &amp; privacy</H2>
      <P>
        For details on what data the integration accesses and how it is stored and deleted, see our{" "}
        <a href="/privacy" className="text-orange-600 hover:underline">Privacy Policy</a>.
      </P>

      <H2>Support</H2>
      <P>
        Need help? Email <Mail user="support" /> or visit our{" "}
        <a href="/support" className="text-orange-600 hover:underline">support page</a>.
      </P>
    </>
  );
}
