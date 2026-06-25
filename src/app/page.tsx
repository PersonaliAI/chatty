"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import {
  ArrowRight,
  ChevronDown,
  Check,
  Sparkles,
  HelpCircle,
  MessageSquare,
  Database,
  Sliders,
  BarChart3,
  Bot,
  Layers,
  Inbox,
  Cpu,
  Globe,
  Settings,
  Shield,
  RefreshCw,
  Lock,
  UserCheck,
  FolderOpen,
  Mail,
  Send,
  User,
  CheckCircle2,
  X
} from "lucide-react";

// Feature structure
interface Feature {
  icon: any;
  title: string;
  desc: string;
}

const featuresList: Feature[] = [
  {
    icon: Database,
    title: "Knowledge",
    desc: "Train the chatbot to answer questions about your website, files, and more.",
  },
  {
    icon: Sparkles,
    title: "Actions",
    desc: "Go beyond just Q&A and let the chatbot use any of your apps.",
  },
  {
    icon: Sliders,
    title: "Refine answers",
    desc: "Review conversations and correct the chatbot to give better answers.",
  },
  {
    icon: BarChart3,
    title: "Analytics",
    desc: "Learn how your customers are interacting with your chatbot.",
  },
  {
    icon: Bot,
    title: "Multiple chatbots",
    desc: "Create multiple chatbots for different use cases or different websites.",
  },
  {
    icon: Layers,
    title: "White-label",
    desc: "Features that help you resell chatbots as part of your business.",
  },
  {
    icon: Inbox,
    title: "Inbox",
    desc: "Access conversations between your chatbot and page visitors.",
  },
  {
    icon: Cpu,
    title: "AI Models",
    desc: "GPT-5.3, Claude Opus, Mistral, Gemini... Switch between AI models at any time.",
  },
  {
    icon: Mail,
    title: "Chatbot API",
    desc: "Use our powerful API and access your chatbot from other apps.",
  },
  {
    icon: Lock,
    title: "BYOK Option",
    desc: "You can provide your own OpenAI or OpenRouter API key to manage your costs.",
  },
  {
    icon: Globe,
    title: "Multilingual",
    desc: "Our chatbots can use over 95 languages out of the box.",
  },
  {
    icon: Settings,
    title: "Customizable",
    desc: "Change name, icon, theme, position, color, CSS, JS... make it yours.",
  },
  {
    icon: Shield,
    title: "Guardrails",
    desc: "Prevent abuse. Get a reliable and assertive chatbot, not 'ChatGPT for free'.",
  },
  {
    icon: RefreshCw,
    title: "Auto train",
    desc: "Automatically keep your chatbot up to date: daily, weekly and monthly.",
  },
  {
    icon: UserCheck,
    title: "Allow list",
    desc: "Secure your chatbot to work only on domains under your control.",
  },
  {
    icon: MessageSquare,
    title: "Leads",
    desc: "Collect name, email, phone number of the chat visitor.",
  },
  {
    icon: FolderOpen,
    title: "Bulk",
    desc: "Bulk operations to handle any amount of training.",
  },
  {
    icon: Mail,
    title: "Notifications",
    desc: "Receive email & webhook updates with recent conversations.",
  },
];

const faqs = [
  {
    question: "How do I train my chatbot?",
    answer: "You can train your chatbot by simply entering a URL to your website, uploading documents (PDF, DOCX, TXT), or writing text directly. The bot processes your data in seconds and is immediately ready to answer questions.",
  },
  {
    question: "Can I use my own API keys?",
    answer: "Yes! The Business plan includes a Bring-Your-Own-Key (BYOK) option, allowing you to use your own OpenAI or OpenRouter API keys to manage message costs directly.",
  },
  {
    question: "What counts as a 'message credit'?",
    answer: "Each response sent by the chatbot to a visitor counts as one message credit. System actions and internal tests do not consume credits.",
  },
  {
    question: "How does lead collection work?",
    answer: "You can configure your chatbot to ask for a visitor's name, email, or phone number before, during, or after a conversation. These leads are stored in your dashboard and can be synced via webhooks or API.",
  },
  {
    question: "Can I embed the chatbot on multiple sites?",
    answer: "Yes, you can install the chatbot on as many domains as you want. However, you can restrict it to only function on specific domains using the Domain Allowlist feature to prevent unauthorized use.",
  },
];


export default function Home() {
  const [isYearly, setIsYearly] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [activeFaq, setActiveFaq] = useState<number | null>(null);
  const [selectedFeature, setSelectedFeature] = useState<Feature | null>(null);

  // Live Widget States
  const [progress, setProgress] = useState(0);
  const [isWidgetOpen, setIsWidgetOpen] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);

  const botId = "08b10dc1-c339-4171-818a-35b9cb684d40"; // The official landing page bot ID
  const [themeColor, setThemeColor] = useState("#f97316");
  const [themeIcon, setThemeIcon] = useState("/favicon.png");
  const [logoBgColor, setLogoBgColor] = useState("");

  useEffect(() => {
    async function loadTheme() {
      try {
        const res = await fetch(`https://personaliai-api-376030619262.us-central1.run.app/api/widget/theme?bot_id=${botId}&t=${Date.now()}`);
        if (res.ok) {
          const d = await res.json();
          if (d.primary_color) setThemeColor(d.primary_color);
          
          let logoToUse = "/favicon.png";
          if (d.avatar_icon === "custom" && d.avatar_url) {
            logoToUse = d.avatar_url;
          } else if (d.logo_url) {
            logoToUse = d.logo_url;
          }
          setThemeIcon(logoToUse);

          if (d.widget_style) {
            const [, bg] = d.widget_style.split(":");
            setLogoBgColor(bg || "");
          }
        }
      } catch (err) {
        console.error("Failed to load landing page widget theme:", err);
      }
    }
    loadTheme();
  }, []);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Listen for close/ready messages from the embedded iframe chatbot
  useEffect(() => {
    const handleMessage = (ev: MessageEvent) => {
      if (ev.data && typeof ev.data === "object") {
        if (ev.data.type === "chatty:close") {
          setIsWidgetOpen(false);
          setIsConnecting(false);
          setProgress(0);
        }
      }
    };
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, []);

  // Waiting wheel circulation progress when connecting
  useEffect(() => {
    if (!isConnecting) {
      if (!isWidgetOpen) {
        setProgress(0);
      }
      return;
    }

    const interval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 90) {
          return 90; // Wait at 90% until iframe load triggers 100%
        }
        return prev + 5; // Climb to 90% smoothly
      });
    }, 50);

    return () => clearInterval(interval);
  }, [isConnecting, isWidgetOpen]);

  const handleIframeLoad = () => {
    if (isConnecting) {
      setProgress(100);
      setTimeout(() => {
        setIsConnecting(false);
        setIsWidgetOpen(true);
      }, 150); // short delay to show 100% progress
    }
  };

  const handleToggleWidget = () => {
    if (isWidgetOpen) {
      setIsWidgetOpen(false);
      setProgress(0);
    } else if (isConnecting) {
      setIsConnecting(false);
      setProgress(0);
    } else {
      setIsConnecting(true);
      setProgress(0);
    }
  };

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-neutral-950 text-neutral-900 dark:text-neutral-100 font-sans antialiased selection:bg-neutral-200 dark:selection:bg-neutral-800">
      {/* Boxed Grid Layout container */}
      <div className="max-w-6xl mx-auto border-x border-neutral-200 dark:border-neutral-900 bg-white dark:bg-black min-h-screen flex flex-col relative">
        {/* Navbar */}
        <header
          className={`fixed top-0 left-0 right-0 z-50 transition-all duration-200 ${
            scrolled
              ? "bg-white/90 dark:bg-black/90 backdrop-blur-md border-b border-neutral-200 dark:border-neutral-900"
              : "bg-transparent border-b border-transparent"
          }`}
        >
          <div className="mx-auto max-w-6xl px-6 h-16 flex items-center justify-between border-x border-neutral-200 dark:border-neutral-900">
            <Link href="/" className="flex items-center gap-2 shrink-0">
              <Image
                src="/favicon.png"
                alt="Chatty Logo"
                width={36}
                height={36}
                className="size-9 object-contain"
              />
              <span className="font-mono text-sm tracking-widest font-bold uppercase">
                Chatty
              </span>
            </Link>
            <nav className="hidden md:flex items-center gap-8 font-mono text-xs uppercase tracking-wider">
              <Link href="#features" className="text-neutral-500 hover:text-neutral-900 dark:text-neutral-450 dark:hover:text-white transition-colors">Features</Link>
              <Link href="#pricing" className="text-neutral-500 hover:text-neutral-900 dark:text-neutral-450 dark:hover:text-white transition-colors">Pricing</Link>
              <Link href="#faq" className="text-neutral-500 hover:text-neutral-900 dark:text-neutral-450 dark:hover:text-white transition-colors">FAQ</Link>
              <Link href="/dashboard" className="text-neutral-900 dark:text-white font-semibold">Dashboard</Link>
            </nav>
            <div className="flex items-center gap-4 shrink-0 font-mono text-xs">
              <Link href="/dashboard" className="hidden sm:inline-flex text-neutral-500 hover:text-neutral-900 dark:text-neutral-450 dark:hover:text-white uppercase tracking-wider py-1.5">
                Log in
              </Link>
              <Link href="/dashboard">
                <Button size="sm" className="h-9 px-4 font-mono text-xs uppercase tracking-wider bg-neutral-950 text-white dark:bg-white dark:text-black rounded-none border border-neutral-950 dark:border-white hover:opacity-90 cursor-pointer">
                  Free Trial
                </Button>
              </Link>
            </div>
          </div>
        </header>

        <main className="flex-1 pt-16">
          {/* Hero Section */}
          <section className="border-b border-neutral-200 dark:border-neutral-900 py-16 md:py-24">
            <div className="max-w-3xl mx-auto px-8 flex flex-col items-center text-center space-y-8">
              <div className="flex items-center gap-2 text-xs font-mono text-neutral-400 dark:text-neutral-500 uppercase tracking-widest justify-center">
                <span className="size-1.5 bg-[#f97316]"></span>
                <span>[ 00 / CUSTOM AGENT ]</span>
              </div>
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-medium tracking-tight leading-[1.1] text-neutral-900 dark:text-white">
                Trained on your content. <br />
                <span className="text-neutral-400 dark:text-neutral-500 font-light">Optimized for conversion.</span>
              </h1>
              <p className="text-sm sm:text-base text-neutral-500 dark:text-neutral-400 leading-relaxed max-w-xl font-sans font-normal">
                An AI chatbot that does more than just chat. Plug in your website, files, and tools. Deploy a custom assistant that captures leads and triggers actions. Zero coding, active on your website in under five minutes.
              </p>
              <div className="flex flex-wrap justify-center items-center gap-4 pt-2">
                <Link href="/dashboard">
                  <Button className="h-12 px-6 bg-neutral-950 hover:bg-neutral-900 text-white dark:bg-white dark:text-black dark:hover:bg-neutral-100 rounded-none text-xs font-mono uppercase tracking-wider transition-colors border border-neutral-955 dark:border-white cursor-pointer">
                    Start free 14-day trial
                  </Button>
                </Link>
                <Link href="#features">
                  <Button variant="outline" className="h-12 px-6 border-neutral-200 dark:border-neutral-850 hover:bg-neutral-50 dark:hover:bg-neutral-900 rounded-none text-xs font-mono uppercase tracking-wider transition-colors bg-transparent cursor-pointer">
                    Explore features
                  </Button>
                </Link>
              </div>
              <div className="text-[10px] font-mono text-neutral-400 dark:text-neutral-500 flex items-center gap-1.5 justify-center">
                <span>[ ✓ ] 14-DAY TRIAL</span>
                <span>•</span>
                <span>NO CREDIT CARD REQUIRED</span>
              </div>
            </div>
          </section>

          {/* Pricing Section */}
          <section id="pricing" className="border-b border-neutral-200 dark:border-neutral-900">
            <div className="p-8 md:p-12 lg:p-16 text-center flex flex-col items-center">
              <span className="text-[10px] font-mono text-neutral-400 dark:text-neutral-500 uppercase tracking-widest block">[ 01 / TRANSPARENT FEES ]</span>
              <h2 className="text-3xl font-bold tracking-tight uppercase mt-2">Pricing plans</h2>
              <p className="mt-3 text-sm text-neutral-500 dark:text-neutral-400 max-w-lg font-sans">
                All plans include a 14-day free trial. Scale up or down as your traffic changes.
              </p>

              {/* Custom Switcher */}
              <div className="flex justify-center mt-8">
                <div className="inline-flex border border-neutral-200 dark:border-neutral-800 p-1 bg-neutral-50 dark:bg-neutral-950">
                  <button
                    onClick={() => setIsYearly(false)}
                    className={`px-4 py-1.5 text-xs font-mono uppercase tracking-wider transition-colors cursor-pointer ${
                      !isYearly
                        ? "bg-neutral-950 text-white dark:bg-white dark:text-black font-semibold"
                        : "text-neutral-500 hover:text-neutral-900 dark:hover:text-white"
                    }`}
                  >
                    Monthly
                  </button>
                  <button
                    onClick={() => setIsYearly(true)}
                    className={`px-4 py-1.5 text-xs font-mono uppercase tracking-wider transition-colors cursor-pointer flex items-center gap-1.5 ${
                      isYearly
                        ? "bg-neutral-950 text-white dark:bg-white dark:text-black font-semibold"
                        : "text-neutral-500 hover:text-neutral-900 dark:hover:text-white"
                    }`}
                  >
                    <span>Yearly</span>
                    <span className="px-1.5 py-0.5 bg-[#f97316] text-white text-[9px] font-bold uppercase tracking-tight">
                      2 Months Free
                    </span>
                  </button>
                </div>
              </div>

              {/* Cards Grid */}
              <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-neutral-200 dark:divide-neutral-900 border border-neutral-200 dark:border-neutral-900 mt-12 w-full text-left">
                {/* Hobby Plan */}
                <div className="p-8 flex flex-col justify-between min-h-[500px]">
                  <div>
                    <span className="text-[10px] font-mono text-neutral-400 dark:text-neutral-500 uppercase tracking-widest block">
                      [ PLAN: HOBBY ]
                    </span>
                    <h3 className="text-xl font-bold mt-2 text-neutral-900 dark:text-white">Hobby</h3>
                    <div className="mt-6 flex items-baseline gap-1">
                      <span className="text-5xl font-mono tracking-tight font-semibold text-neutral-900 dark:text-white">
                        ${isYearly ? "15" : "19"}
                      </span>
                      <span className="text-xs font-mono text-neutral-400 dark:text-neutral-500">/mo</span>
                    </div>
                    {isYearly && (
                      <span className="text-[9px] font-mono text-[#f97316] block mt-1 uppercase tracking-tight">
                        Billed annually ($190/yr)
                      </span>
                    )}
                    <p className="mt-4 text-xs text-neutral-500 dark:text-neutral-400 leading-relaxed font-sans">
                      Perfect for individuals, developers, and side projects.
                    </p>

                    <ul className="mt-8 space-y-3.5 text-xs text-neutral-600 dark:text-neutral-400">
                      <li className="flex items-start gap-2.5">
                        <span className="font-mono text-neutral-950 dark:text-white shrink-0 select-none">[✓]</span>
                        <span>1,000 message credits/mo</span>
                      </li>
                      <li className="flex items-start gap-2.5">
                        <span className="font-mono text-neutral-950 dark:text-white shrink-0 select-none">[✓]</span>
                        <span>10M training characters</span>
                      </li>
                      <li className="flex items-start gap-2.5">
                        <span className="font-mono text-neutral-950 dark:text-white shrink-0 select-none">[✓]</span>
                        <span>1 chatbot</span>
                      </li>
                      <li className="flex items-start gap-2.5">
                        <span className="font-mono text-neutral-950 dark:text-white shrink-0 select-none">[✓]</span>
                        <span>Fast & Advanced AI models</span>
                      </li>
                      <li className="flex items-start gap-2.5">
                        <span className="font-mono text-neutral-950 dark:text-white shrink-0 select-none">[✓]</span>
                        <span>AI Actions & Analytics</span>
                      </li>
                      <li className="flex items-start gap-2.5">
                        <span className="font-mono text-neutral-950 dark:text-white shrink-0 select-none">[✓]</span>
                        <span>Guardrails & Notifications</span>
                      </li>
                      <li className="flex items-start gap-2.5">
                        <span className="font-mono text-neutral-950 dark:text-white shrink-0 select-none">[✓]</span>
                        <span>Lead collection & API</span>
                      </li>
                    </ul>
                  </div>
                  <div className="mt-8">
                    <Link href="/dashboard" className="block">
                      <Button className="w-full h-11 border border-neutral-200 dark:border-neutral-800 hover:bg-neutral-50 dark:hover:bg-neutral-900 bg-transparent text-neutral-800 dark:text-neutral-200 text-xs font-mono uppercase tracking-wider rounded-none transition-colors cursor-pointer">
                        Start 14-day trial
                      </Button>
                    </Link>
                  </div>
                </div>

                {/* Standard Plan */}
                <div className="p-8 flex flex-col justify-between min-h-[500px] bg-neutral-50/30 dark:bg-neutral-950/20 relative">
                  <div className="absolute top-0 right-8 -translate-y-1/2 px-2.5 py-0.5 border border-neutral-955 bg-neutral-955 text-white dark:border-white dark:bg-white dark:text-black font-mono text-[9px] uppercase tracking-wider">
                    Popular Choice
                  </div>
                  <div>
                    <span className="text-[10px] font-mono text-[#f97316] uppercase tracking-widest block font-semibold">
                      [ PLAN: STANDARD ]
                    </span>
                    <h3 className="text-xl font-bold mt-2 text-neutral-900 dark:text-white">Standard</h3>
                    <div className="mt-6 flex items-baseline gap-1">
                      <span className="text-5xl font-mono tracking-tight font-semibold text-neutral-900 dark:text-white">
                        ${isYearly ? "82" : "99"}
                      </span>
                      <span className="text-xs font-mono text-neutral-400 dark:text-neutral-500">/mo</span>
                    </div>
                    {isYearly && (
                      <span className="text-[9px] font-mono text-[#f97316] block mt-1 uppercase tracking-tight">
                        Billed annually ($990/yr)
                      </span>
                    )}
                    <p className="mt-4 text-xs text-neutral-500 dark:text-neutral-400 leading-relaxed font-sans">
                      All in Hobby, plus advanced automation and multi-bot systems.
                    </p>

                    <ul className="mt-8 space-y-3.5 text-xs text-neutral-600 dark:text-neutral-400">
                      <li className="font-mono text-[10px] uppercase text-neutral-900 dark:text-white tracking-wider list-none font-semibold">All in Hobby, plus:</li>
                      <li className="flex items-start gap-2.5">
                        <span className="font-mono text-neutral-950 dark:text-white shrink-0 select-none">[✓]</span>
                        <span>10,000 message credits/mo</span>
                      </li>
                      <li className="flex items-start gap-2.5">
                        <span className="font-mono text-neutral-950 dark:text-white shrink-0 select-none">[✓]</span>
                        <span>20M training characters</span>
                      </li>
                      <li className="flex items-start gap-2.5">
                        <span className="font-mono text-neutral-950 dark:text-white shrink-0 select-none">[✓]</span>
                        <span>3 chatbots</span>
                      </li>
                      <li className="flex items-start gap-2.5">
                        <span className="font-mono text-neutral-955 dark:text-white shrink-0 select-none">[✓]</span>
                        <span>Daily Auto Train sync</span>
                      </li>
                      <li className="flex items-start gap-2.5">
                        <span className="font-mono text-neutral-955 dark:text-white shrink-0 select-none">[✓]</span>
                        <span>Remove branding completely</span>
                      </li>
                      <li className="flex items-start gap-2.5">
                        <span className="font-mono text-neutral-955 dark:text-white shrink-0 select-none">[✓]</span>
                        <span>Unlimited team members</span>
                      </li>
                    </ul>
                  </div>
                  <div className="mt-8">
                    <Link href="/dashboard" className="block">
                      <Button className="w-full h-11 bg-neutral-950 hover:bg-neutral-900 text-white dark:bg-white dark:text-black dark:hover:bg-neutral-100 text-xs font-mono uppercase tracking-wider rounded-none transition-colors border border-neutral-950 dark:border-white cursor-pointer">
                        Start 14-day trial
                      </Button>
                    </Link>
                  </div>
                </div>

                {/* Business Plan */}
                <div className="p-8 flex flex-col justify-between min-h-[500px]">
                  <div>
                    <span className="text-[10px] font-mono text-neutral-400 dark:text-neutral-500 uppercase tracking-widest block">
                      [ PLAN: BUSINESS ]
                    </span>
                    <h3 className="text-xl font-bold mt-2 text-neutral-900 dark:text-white">Business</h3>
                    <div className="mt-6 flex items-baseline gap-1">
                      <span className="text-5xl font-mono tracking-tight font-semibold text-neutral-900 dark:text-white">
                        ${isYearly ? "332" : "399"}
                      </span>
                      <span className="text-xs font-mono text-neutral-400 dark:text-neutral-500">/mo</span>
                    </div>
                    {isYearly && (
                      <span className="text-[9px] font-mono text-[#f97316] block mt-1 uppercase tracking-tight">
                        Billed annually ($3,990/yr)
                      </span>
                    )}
                    <p className="mt-4 text-xs text-neutral-500 dark:text-neutral-400 leading-relaxed font-sans">
                      For enterprise scale, heavy traffic, and reseller options.
                    </p>

                    <ul className="mt-8 space-y-3.5 text-xs text-neutral-600 dark:text-neutral-400">
                      <li className="font-mono text-[10px] uppercase text-neutral-900 dark:text-white tracking-wider list-none font-semibold">All in Standard, plus:</li>
                      <li className="flex items-start gap-2.5">
                        <span className="font-mono text-neutral-950 dark:text-white shrink-0 select-none">[✓]</span>
                        <span>40,000 message credits/mo</span>
                      </li>
                      <li className="flex items-start gap-2.5">
                        <span className="font-mono text-neutral-955 dark:text-white shrink-0 select-none">[✓]</span>
                        <span>50M training characters</span>
                      </li>
                      <li className="flex items-start gap-2.5">
                        <span className="font-mono text-neutral-955 dark:text-white shrink-0 select-none">[✓]</span>
                        <span>5 chatbots</span>
                      </li>
                      <li className="flex items-start gap-2.5">
                        <span className="font-mono text-neutral-955 dark:text-white shrink-0 select-none">[✓]</span>
                        <span>BYOK (Bring-Your-Own-Key) option</span>
                      </li>
                      <li className="flex items-start gap-2.5">
                        <span className="font-mono text-neutral-955 dark:text-white shrink-0 select-none">[✓]</span>
                        <span>White-label configuration</span>
                      </li>
                      <li className="flex items-start gap-2.5">
                        <span className="font-mono text-neutral-955 dark:text-white shrink-0 select-none">[✓]</span>
                        <span>Management Admin API</span>
                      </li>
                    </ul>
                  </div>
                  <div className="mt-8">
                    <Link href="/dashboard" className="block">
                      <Button className="w-full h-11 border border-neutral-200 dark:border-neutral-800 hover:bg-neutral-50 dark:hover:bg-neutral-900 bg-transparent text-neutral-800 dark:text-neutral-200 text-xs font-mono uppercase tracking-wider rounded-none transition-colors cursor-pointer">
                        Start 14-day trial
                      </Button>
                    </Link>
                  </div>
                </div>
              </div>
              <p className="my-8 text-[10px] font-mono text-neutral-400 dark:text-neutral-500 uppercase">
                [ TAXES & COMPLIANCE ] ALL PLANS ARE SUBJECT TO LOCAL TAX SYSTEM REGULATION.
              </p>
            </div>
          </section>

          {/* Features Grid Section */}
          <section id="features" className="border-b border-neutral-200 dark:border-neutral-900">
            <div className="grid grid-cols-1 md:grid-cols-12 divide-y md:divide-y-0 md:divide-x divide-neutral-200 dark:divide-neutral-900">
              {/* Left block: Title */}
              <div className="md:col-span-4 p-8 md:p-12 flex flex-col justify-between space-y-4">
                <div className="space-y-2">
                  <span className="text-[10px] font-mono text-neutral-400 dark:text-neutral-500 uppercase tracking-widest block">[ 02 / CAPABILITIES ]</span>
                  <h2 className="text-3xl font-bold tracking-tight uppercase">Core Features</h2>
                </div>
                <p className="text-xs text-neutral-500 dark:text-neutral-400 leading-relaxed font-sans max-w-sm">
                  A granular index of Chatty's feature set. Click on any block to see detailed configuration parameters and dashboard instructions.
                </p>
              </div>

              {/* Right block: Grid cells */}
              <div className="md:col-span-8">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 -mt-px -ml-px">
                  {featuresList.map((f, i) => {
                    const Icon = f.icon;
                    const indexStr = String(i + 1).padStart(2, "0");
                    return (
                      <div
                        key={i}
                        onClick={() => setSelectedFeature(f)}
                        className="border-b border-r border-neutral-200 dark:border-neutral-900 p-6 flex flex-col justify-between min-h-[180px] hover:bg-neutral-50 dark:hover:bg-neutral-950/45 transition-colors cursor-pointer group"
                      >
                        <div className="flex items-start justify-between">
                          <span className="text-[10px] font-mono text-neutral-400 dark:text-neutral-500">[{indexStr}]</span>
                          <Icon className="size-4 text-neutral-400 group-hover:text-[#f97316] transition-colors" />
                        </div>
                        <div className="mt-8 space-y-2">
                          <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-neutral-900 dark:text-white flex items-center justify-between">
                            {f.title}
                            <ArrowRight className="size-3 opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all text-[#f97316]" />
                          </h3>
                          <p className="text-[11px] text-neutral-500 dark:text-neutral-400 leading-relaxed line-clamp-2">
                            {f.desc}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </section>

          {/* FAQ Section */}
          <section id="faq" className="border-b border-neutral-200 dark:border-neutral-900">
            <div className="grid grid-cols-1 md:grid-cols-12 divide-y md:divide-y-0 md:divide-x divide-neutral-200 dark:divide-neutral-900">
              {/* Left block: Title */}
              <div className="md:col-span-4 p-8 md:p-12 flex flex-col justify-between space-y-4">
                <div className="space-y-2">
                  <span className="text-[10px] font-mono text-neutral-400 dark:text-neutral-500 uppercase tracking-widest block">[ 03 / COMMON INQUIRIES ]</span>
                  <h2 className="text-3xl font-bold tracking-tight uppercase">Questions</h2>
                </div>
                <p className="text-xs text-neutral-500 dark:text-neutral-400 leading-relaxed font-sans max-w-sm">
                  Everything you need to know about Chatty's training mechanics, costs, safety layers, and white-label setups.
                </p>
              </div>

              {/* Right block: Accordions */}
              <div className="md:col-span-8 p-8 md:p-12">
                <div className="divide-y divide-neutral-200 dark:divide-neutral-900">
                  {faqs.map((faq, index) => {
                    const isOpen = activeFaq === index;
                    return (
                      <div key={index} className="py-5 first:pt-0 last:pb-0">
                        <button
                          onClick={() => setActiveFaq(isOpen ? null : index)}
                          className="w-full flex items-center justify-between text-left font-medium text-sm text-neutral-900 dark:text-white hover:text-[#f97316] transition-colors cursor-pointer group"
                          aria-expanded={isOpen}
                        >
                          <span className="font-sans font-semibold tracking-tight">{faq.question}</span>
                          <ChevronDown
                            className={`size-4 text-neutral-400 transition-transform duration-200 group-hover:text-[#f97316] ${
                              isOpen ? "rotate-180 text-[#f97316]" : ""
                            }`}
                          />
                        </button>
                        {isOpen && (
                          <div className="mt-3 text-xs text-neutral-550 dark:text-neutral-400 leading-relaxed font-sans pr-8">
                            {faq.answer}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </section>
        </main>

        {/* Footer */}
        <footer className="p-8 md:p-12 bg-neutral-50/50 dark:bg-neutral-950/20 font-mono text-xs border-t border-neutral-200 dark:border-neutral-900">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-8">
            <div className="flex items-center gap-2">
              <Image
                src="/favicon.png"
                alt="Chatty Logo"
                width={20}
                height={20}
                className="size-5 object-contain"
              />
              <span className="font-mono text-sm tracking-widest font-bold uppercase text-neutral-900 dark:text-white">
                Chatty
              </span>
              <span className="text-[10px] text-neutral-400 dark:text-neutral-500 uppercase">[ BY PERSONALIAI ]</span>
            </div>
            <div className="flex flex-wrap gap-x-8 gap-y-4 uppercase tracking-wider text-neutral-500 dark:text-neutral-450">
              <Link href="#features" className="hover:text-neutral-950 dark:hover:text-white transition-colors">Features</Link>
              <Link href="#pricing" className="hover:text-neutral-950 dark:hover:text-white transition-colors">Pricing</Link>
              <Link href="#faq" className="hover:text-neutral-950 dark:hover:text-white transition-colors">FAQ</Link>
              <Link href="/privacy" className="hover:text-neutral-950 dark:hover:text-white transition-colors">Privacy</Link>
              <Link href="/terms" className="hover:text-neutral-950 dark:hover:text-white transition-colors">Terms</Link>
            </div>
            <p className="text-[10px] text-neutral-450 dark:text-neutral-500">&copy; {new Date().getFullYear()} PersonaliAI. All rights reserved.</p>
          </div>
        </footer>
      </div>

      {/* Feature Detail Modal overlay */}
      {selectedFeature && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/45 dark:bg-black/70 backdrop-blur-xs">
          <div
            onClick={() => setSelectedFeature(null)}
            className="absolute inset-0"
          />
          <div className="relative w-full max-w-md bg-white dark:bg-neutral-950 border border-neutral-900 dark:border-neutral-100 rounded-none p-6 shadow-2xl z-10 text-left">
            <button
              onClick={() => setSelectedFeature(null)}
              className="absolute top-4 right-4 p-1 hover:bg-neutral-100 dark:hover:bg-neutral-900 text-neutral-400 hover:text-neutral-900 dark:hover:text-white cursor-pointer border border-transparent hover:border-neutral-200 dark:hover:border-neutral-800"
              aria-label="Close modal"
            >
              <X className="size-4" />
            </button>
            <div className="flex items-center gap-3">
              <div className="size-8 border border-neutral-200 dark:border-neutral-800 flex items-center justify-center text-[#f97316]">
                {(() => {
                  const Icon = selectedFeature.icon;
                  return <Icon className="size-4" />;
                })()}
              </div>
              <h3 className="text-sm font-mono font-bold uppercase tracking-wider text-neutral-900 dark:text-white">{selectedFeature.title}</h3>
            </div>
            <p className="mt-4 text-xs text-neutral-600 dark:text-neutral-400 leading-relaxed font-sans">
              {selectedFeature.desc}
            </p>
            <div className="mt-6 p-4 border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900/50 text-[11px] text-neutral-500 font-mono">
              <span className="font-bold text-neutral-900 dark:text-white uppercase">[ IMPLEMENTATION ]</span>
              <p className="mt-2 text-neutral-450 leading-relaxed">Configure this parameter inside the Chatty administration panel. No custom code injection or server-side configuration is needed.</p>
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <Button size="sm" onClick={() => setSelectedFeature(null)} className="h-9 px-4 text-xs font-mono uppercase tracking-wider border border-neutral-200 dark:border-neutral-850 hover:bg-neutral-100 dark:hover:bg-neutral-900 bg-transparent text-neutral-700 dark:text-neutral-300 rounded-none cursor-pointer">
                Dismiss
              </Button>
              <Link href="/dashboard" onClick={() => setSelectedFeature(null)}>
                <Button size="sm" className="h-9 px-4 text-xs font-mono uppercase tracking-wider bg-neutral-950 text-white dark:bg-white dark:text-black hover:opacity-90 rounded-none cursor-pointer border border-neutral-950 dark:border-white">
                  Try Feature
                </Button>
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* Floating Chat Button & Waiting Circle */}
      <div className="fixed bottom-6 right-6 z-50 flex items-center justify-center select-none">
        {/* Progress circular waiting indicator */}
        <svg className={`absolute w-[72px] h-[72px] -rotate-90 transition-opacity duration-300 ${isConnecting ? "opacity-100" : "opacity-0 pointer-events-none"}`}>
          <circle
            cx="36"
            cy="36"
            r="32"
            className="stroke-neutral-200 dark:stroke-neutral-800"
            strokeWidth="2.5"
            fill="transparent"
          />
          <circle
            cx="36"
            cy="36"
            r="32"
            style={{ stroke: themeColor }}
            className="transition-all duration-75"
            strokeWidth="2.5"
            fill="transparent"
            strokeDasharray="201.1"
            strokeDashoffset={201.1 - (201.1 * progress) / 100}
          />
        </svg>
        {/* Toggle Button */}
        <button
          onClick={handleToggleWidget}
          style={{ backgroundColor: themeColor }}
          className="size-14 rounded-full text-white flex items-center justify-center shadow-lg hover:opacity-90 transition-opacity cursor-pointer z-10 focus:outline-none"
          title="Chat Assistant"
        >
          {isWidgetOpen || isConnecting ? (
            <X className="size-6" />
          ) : (
            <Image
              src={themeIcon}
              alt="Chat"
              width={36}
              height={36}
              className={`size-9 ${themeIcon === "/favicon.png" ? "object-contain" : "object-cover rounded-full"}`}
              style={{
                ...((themeIcon === "/favicon.png" && themeColor.toLowerCase().replace(/\s+/g, "") === "#f97316") ? { filter: "brightness(0) invert(1)" } : {}),
                ...(logoBgColor ? { backgroundColor: logoBgColor } : {})
              }}
            />
          )}
        </button>
      </div>

      {/* Live Chatbot Widget Overlay */}
      {(isWidgetOpen || isConnecting) && (
        <div className={`fixed z-50 flex flex-col overflow-hidden transition-all duration-350 ease-out bg-transparent
          w-full h-full bottom-0 right-0 rounded-none border-0
          sm:w-[380px] sm:h-[540px] sm:bottom-24 sm:right-6 sm:rounded-2xl sm:border sm:border-neutral-200 sm:dark:border-neutral-900 sm:shadow-2xl
          ${
            isWidgetOpen 
              ? "opacity-100 translate-y-0 scale-100 pointer-events-auto" 
              : "opacity-0 translate-y-4 scale-95 pointer-events-none"
          }`}
        >
          {/* Iframe */}
          <iframe
            src={`https://chatty.personaliai.com/embed/${botId}`}
            className="flex-1 w-full border-0 rounded-none sm:rounded-2xl"
            allow="microphone"
            onLoad={handleIframeLoad}
          />
        </div>
      )}
    </div>
  );
}
