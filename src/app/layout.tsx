import type { Metadata, Viewport } from "next";
import { Inter, DM_Sans, Quicksand, Space_Grotesk, Lora, Playfair_Display } from "next/font/google";
import { FirebaseAnalytics } from "@/components/firebase-analytics";
import "./globals.css";

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
// Design Presets" section) — each design in the source gallery used a
// distinct typeface as part of its identity, not just color/shape.
const dmSans = DM_Sans({ variable: "--font-dm-sans", subsets: ["latin"], display: "swap" });
const quicksand = Quicksand({ variable: "--font-quicksand", subsets: ["latin"], display: "swap" });
const spaceGrotesk = Space_Grotesk({ variable: "--font-space-grotesk", subsets: ["latin"], display: "swap" });
const lora = Lora({ variable: "--font-lora", subsets: ["latin"], display: "swap" });
const playfair = Playfair_Display({ variable: "--font-playfair", subsets: ["latin"], display: "swap" });

export const metadata: Metadata = {
  metadataBase: new URL('https://personaliai.com'),
  title: {
    default: "PersonaliAI | Chatty — Custom AI Chatbots that Convert",
    template: "%s | PersonaliAI"
  },
  description: "Create a custom AI chatbot trained on your files, websites, and data sources. Integrate with your apps, capture leads, and convert visitors in minutes. Zero coding required.",
  keywords: ["AI Chatbot", "Custom Chatbot", "Chatty AI", "Lead Conversion", "Customer Support AI", "Train Chatbot", "SaaS Chatbot"],
  authors: [{ name: "PersonaliAI Team" }],
  creator: "PersonaliAI",
  publisher: "PersonaliAI",
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  openGraph: {
    title: "PersonaliAI | Chatty — Custom AI Chatbots that Convert",
    description: "Plug in your content. Create a custom AI chatbot that not only chats but converts. Zero coding, on your website in minutes.",
    url: 'https://personaliai.com/chatty',
    siteName: 'PersonaliAI',
    locale: 'en_US',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: "PersonaliAI | Chatty — Custom AI Chatbots that Convert",
    description: "Plug in your content. Create a custom AI chatbot that not only chats but converts. Zero coding, on your website in minutes.",
    creator: '@personaliai',
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
