import type { Metadata } from "next";
import Script from "next/script";
import LandingClient from "@/components/landing/LandingClient";

export const metadata: Metadata = {
  title: "Chatty | Autonomous Customer Support AI That Captures Leads & Books Meetings",
  description:
    "Chatty grounds autonomous AI agents on your real business data—website sitemaps, help documents, and APIs. Zero hallucinations, in-chat calendar booking, progressive lead qualification, and official Model Context Protocol (MCP) server support.",
  keywords: [
    "AI customer support chatbot",
    "autonomous customer support agent",
    "website chatbot",
    "lead qualification chatbot",
    "in-chat calendar booking",
    "Intercom alternative",
    "Crisp alternative",
    "Zendesk AI alternative",
    "open source chatbot",
    "MCP customer support",
    "Model Context Protocol chatbot",
    "pgvector RAG chatbot",
    "BYOK AI chatbot",
  ],
  alternates: { canonical: "https://chatty.personaliai.com" },
  openGraph: {
    title: "Chatty | Autonomous Customer Support AI That Captures Leads & Books Meetings",
    description:
      "Grounded conversational AI for your website. Resolve 84%+ of tickets, schedule meetings in-chat, qualify high-intent leads, and control via MCP. Free BYOK tier forever.",
    url: "https://chatty.personaliai.com",
    siteName: "Chatty",
    type: "website",
    images: [
      {
        url: "/chatty-hero-product.webp",
        width: 1270,
        height: 760,
        alt: "Chatty autonomous customer support agent interface and live simulator",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Chatty | Autonomous Customer Support AI That Captures Leads & Books Meetings",
    description:
      "Autonomous website support that captures leads, books meetings, and connects to Claude/Cursor via MCP. Open source & Free BYOK.",
    images: ["/chatty-hero-product.webp"],
  },
};

const softwareApplicationJsonLd = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "Chatty",
  applicationCategory: "BusinessApplication",
  operatingSystem: "Web",
  description:
    "Autonomous AI customer support chatbot trained on websites, files, and help docs with lead capture, in-chat calendar booking, omnichannel inbox, and Model Context Protocol (MCP) support.",
  url: "https://chatty.personaliai.com",
  offers: [
    {
      "@type": "Offer",
      name: "Free BYOK",
      price: "0",
      priceCurrency: "USD",
      description: "Free forever BYOK plan with zero token markup. 1 live chatbot, RAG knowledge training, and lead capture.",
    },
    {
      "@type": "Offer",
      name: "Hobby",
      price: "19",
      priceCurrency: "USD",
      description: "For solo builders and indie founders. 3 chatbots, included AI credits, 10M characters training.",
    },
    {
      "@type": "Offer",
      name: "Standard",
      price: "99",
      priceCurrency: "USD",
      description: "For growing SaaS and support teams. 6 chatbots, 10,000 AI credits, daily auto-sync sitemap crawl, no branding.",
    },
    {
      "@type": "Offer",
      name: "Business",
      price: "399",
      priceCurrency: "USD",
      description: "For enterprise scale and agencies. Unlimited chatbots, 40,000 AI credits, 50M characters training, white-label.",
    },
  ],
};

const faqJsonLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: [
    {
      "@type": "Question",
      name: "How fast can I deploy Chatty on my live website?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Most teams are fully live in under 3 minutes. Simply create an account, paste your website URL or upload your help documentation, let our crawler index your knowledge chunks, and copy-paste one <script> snippet into your HTML head or Google Tag Manager.",
      },
    },
    {
      "@type": "Question",
      name: "How does Chatty guarantee zero hallucinations?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Chatty implements strict cosine similarity thresholding with pgvector. If a visitor's question cannot be grounded with high mathematical confidence in your ingested data sources, the assistant transparently admits it doesn't know and offers to schedule a call or route to a human team member.",
      },
    },
    {
      "@type": "Question",
      name: "How does the in-chat calendar booking work?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Chatty connects directly to your Google Calendar or Microsoft Outlook account. When a qualified prospect requests a meeting, the assistant dynamically presents real-time open slots inside the chat widget. Once picked, the calendar event and Google Meet/Zoom link are created instantly with zero external redirects.",
      },
    },
    {
      "@type": "Question",
      name: "What does BYOK (Bring Your Own Key) mean?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "BYOK allows you to plug in your own API key from OpenAI, Anthropic, Google Gemini, or OpenRouter. Chatty manages the UI, vector search, crawler, and chat widget, while model tokens are billed directly to your own provider account without any markup from us.",
      },
    },
    {
      "@type": "Question",
      name: "What is Model Context Protocol (MCP) and how does Chatty use it?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "MCP is the open standard created by Anthropic that allows AI agents like Claude Desktop and Cursor to securely call tools. Chatty provides a native MCP server so your local development or support agents can query conversation analytics, update knowledge bases, and triage customer tickets using natural language.",
      },
    },
    {
      "@type": "Question",
      name: "Can my support team take over conversations in real time?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Yes. Our real-time Omnichannel Team Inbox lets you monitor active conversations. If an agent detects negative sentiment or complex enterprise requirements, you can pause the AI with one click, lock the conversation to a human rep, and reply seamlessly.",
      },
    },
  ],
};

const organizationJsonLd = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "PersonaliAI",
  url: "https://personaliai.com",
  logo: "https://chatty.personaliai.com/favicon.png",
  sameAs: [
    "https://github.com/Damayantha/chatty",
    "https://twitter.com/personaliai",
  ],
};

export default function LandingPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(softwareApplicationJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationJsonLd) }}
      />
      <LandingClient />
      {/* Mount Chatty support widget */}
      <Script
        src="https://chatty.personaliai.com/widget.js"
        data-id="ad32f373-7694-43f4-9465-f8d65ce291e3"
        data-color="#f95721"
        strategy="afterInteractive"
      />
    </>
  );
}
