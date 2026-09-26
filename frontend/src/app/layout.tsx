import type { Metadata, Viewport } from "next";
import { Inter, DM_Sans, Quicksand, Space_Grotesk, Lora, Playfair_Display } from "next/font/google";
import { FirebaseAnalytics } from "@/components/firebase-analytics";
import "./globals.css";
// NOTE: the "Chatty on Chatty" support widget (eating our own dog food) is
// mounted on the marketing landing page only (src/app/page.tsx), not here -
// it doesn't belong on authenticated app pages like /dashboard.

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
};

const inter = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
  display: "swap",
});

// One additional font per widget design preset (see globals.css's "Assistant
// Design Presets" section) - each design in the source gallery used a
// distinct typeface as part of its identity, not just color/shape.
// These fonts are selected per widget preset and are not used by the dashboard
// shell. Keep their font-face rules available, but do not preload every preset
// on every route (which produces unused-preload warnings and wasted requests).
const dmSans = DM_Sans({ variable: "--font-dm-sans", subsets: ["latin"], display: "swap", preload: false });
const quicksand = Quicksand({ variable: "--font-quicksand", subsets: ["latin"], display: "swap", preload: false });
const spaceGrotesk = Space_Grotesk({ variable: "--font-space-grotesk", subsets: ["latin"], display: "swap", preload: false });
const lora = Lora({ variable: "--font-lora", subsets: ["latin"], display: "swap", preload: false });
const playfair = Playfair_Display({ variable: "--font-playfair", subsets: ["latin"], display: "swap", preload: false });

export const metadata: Metadata = {
  metadataBase: new URL('https://chatty.personaliai.com'),
  title: {
    default: "PersonaliAI | Chatty - Custom AI Agents that Convert",
    template: "%s | PersonaliAI"
  },
  description: "Create custom AI agents trained on your files, websites, and data sources. Integrate with your apps, book meetings, capture leads, and convert visitors in minutes. Zero coding required.",
  keywords: ["AI Agent", "Autonomous AI Agents", "Voice AI Agent", "Custom AI Agent", "Chatty AI", "Lead Conversion", "Customer Support AI", "Train AI Agent", "SaaS AI Agent"],
  authors: [{ name: "PersonaliAI Team" }],
  creator: "PersonaliAI",
  publisher: "PersonaliAI",
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  openGraph: {
    title: "PersonaliAI | Chatty - Custom AI Agents that Convert",
    description: "Plug in your content. Create custom AI agents that not only chat, but take action, book meetings, and convert. Zero coding, on your website in minutes.",
    url: 'https://chatty.personaliai.com',
    siteName: 'PersonaliAI',
    locale: 'en_US',
    type: 'website',
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'PersonaliAI Chatty - Autonomous AI Agents for Customer Support & Sales',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: "PersonaliAI | Chatty - Custom AI Agents that Convert",
    description: "Plug in your content. Create custom AI agents that not only chat, but take action, book meetings, and convert. Zero coding, on your website in minutes.",
    creator: '@personaliai',
    images: ['/og-image.png'],
  },
  icons: {
    icon: '/favicon.png',
    shortcut: '/favicon.png',
    apple: '/favicon.png',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${inter.variable} ${dmSans.variable} ${quicksand.variable} ${spaceGrotesk.variable} ${lora.variable} ${playfair.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        {children}
        <FirebaseAnalytics />
      </body>
    </html>
  );
}
