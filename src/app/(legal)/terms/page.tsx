import type { Metadata } from "next";
import { PageTitle, H2, P, UL, Mail } from "../_ui";

export const metadata: Metadata = {
  title: "Terms of Use",
  description: "The terms governing your use of Chatty by PersonaliAI, including the Zoom integration.",
};

export default function TermsPage() {
  return (
    <>
      <PageTitle updated="June 22, 2026">Terms of Use</PageTitle>

      <P>
        These Terms of Use (&ldquo;Terms&rdquo;) govern your access to and use of Chatty (the
        &ldquo;Service&rdquo;) provided by PersonaliAI. By creating an account or using the Service,
        including the Chatty Bookings integration for Zoom, you agree to these Terms.
      </P>

      <H2>The Service</H2>
      <P>
        Chatty is an AI customer-support assistant that businesses embed on their website to answer
        visitor questions, capture leads, and schedule meetings. When you connect a third-party account
        (Google, Microsoft, or Zoom), Chatty acts on your behalf to perform the actions you authorize,
        such as creating a meeting and sharing its link.
      </P>

      <H2>Your account &amp; responsibilities</H2>
      <UL>
        <li>You are responsible for the accuracy of the content you provide to train your chatbot.</li>
        <li>You are responsible for maintaining the confidentiality of your login credentials.</li>
        <li>You must have the right to connect any third-party account you authorize, and to use it for bookings.</li>
        <li>You agree to comply with the terms of any connected provider, including Zoom&apos;s Terms of Service and API license terms.</li>
      </UL>

      <H2>Acceptable use</H2>
      <P>You agree not to use the Service to:</P>
      <UL>
        <li>Violate any law or the rights of others.</li>
        <li>Send spam, harassing, deceptive, or unlawful content.</li>
        <li>Attempt to disrupt, reverse-engineer, or gain unauthorized access to the Service or connected accounts.</li>
      </UL>

      <H2>Third-party services</H2>
      <P>
        The Service integrates with third-party platforms such as Zoom, Google, and Microsoft. Your use of
        those platforms is governed by their own terms and privacy policies. We are not responsible for the
        availability, accuracy, or practices of third-party services.
      </P>

      <H2>Disclaimer &amp; limitation of liability</H2>
      <P>
        The Service is provided &ldquo;as is&rdquo; without warranties of any kind. To the maximum extent
        permitted by law, PersonaliAI is not liable for any indirect, incidental, or consequential damages
        arising from your use of the Service.
      </P>

      <H2>Termination</H2>
      <P>
        You may stop using the Service and disconnect any integration at any time. We may suspend or terminate
        access for violation of these Terms. Upon termination, the provisions that by their nature should
        survive will remain in effect.
      </P>

      <H2>Changes</H2>
      <P>
        We may update these Terms from time to time. Material changes will be reflected by updating the date
        above, and continued use of the Service constitutes acceptance of the updated Terms.
      </P>

      <H2>Contact</H2>
      <P>Questions about these Terms? Email <Mail user="support" />.</P>
    </>
  );
}
