import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
  display: "swap",
});

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
    <html lang="en" className={`${inter.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
