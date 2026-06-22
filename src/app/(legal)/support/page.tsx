import type { Metadata } from "next";
import { PageTitle, H2, P, UL, Mail } from "../_ui";

export const metadata: Metadata = {
  title: "Support",
  description: "Get help with Chatty by PersonaliAI, including the Zoom Bookings integration.",
};

export default function SupportPage() {
  return (
    <>
      <PageTitle>Support</PageTitle>

      <P>
        Need help with Chatty or the Zoom Bookings integration? We&apos;re here to help.
      </P>

      <H2>Contact us</H2>
      <P>
        Email our team at <Mail user="support" /> and we&apos;ll get back to you, typically within one
        business day. Please include your account email and a description of the issue so we can assist
        you quickly.
      </P>

      <H2>Common questions</H2>
      <UL>
        <li>
          <strong>How do I connect Zoom?</strong> In your Chatty dashboard, open Agent Settings &rarr;
          Meetings, then click &ldquo;Connect Zoom&rdquo; and approve access. New bookings will then create
          meetings on your Zoom account.
        </li>
        <li>
          <strong>How do I disconnect Zoom?</strong> Click &ldquo;Disconnect&rdquo; next to Zoom in your
          dashboard, or remove the app from the Zoom Marketplace under Manage &rarr; Installed Apps.
        </li>
        <li>
          <strong>Why isn&apos;t a meeting link generated?</strong> Make sure your Zoom account is connected
          and the booking includes a date and time. If the issue persists, contact support.
        </li>
      </UL>

      <H2>Documentation</H2>
      <P>
        For step-by-step instructions on adding, using, and removing the Zoom integration, see our{" "}
        <a href="/zoom" className="text-orange-600 hover:underline">Zoom integration guide</a>.
      </P>
    </>
  );
}
