"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";
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
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.08,
      },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 15 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        duration: 0.8,
        ease: [0.16, 1, 0.3, 1] as any,
      },
    },
  };
  const [isYearly, setIsYearly] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [activeFaq, setActiveFaq] = useState<number | null>(null);
  const [selectedFeature, setSelectedFeature] = useState<Feature | null>(null);

  // Chat Widget Simulation State
  const [messages, setMessages] = useState([
    { role: "assistant", content: "Hi! I'm Chatty. I'm a custom AI chatbot that captures leads and answers questions. Ask me anything about my pricing or features!" }
  ]);
  const [inputValue, setInputValue] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [collectedLead, setCollectedLead] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);



  useEffect(() => {
    if (messages.length > 1) {
      chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isTyping]);

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim()) return;

    const userMsg = inputValue;
    setMessages((prev) => [...prev, { role: "user", content: userMsg }]);
    setInputValue("");
    setIsTyping(true);

    // Simulated chatbot intelligence
    setTimeout(() => {
      let reply = "I can definitely help with that! Chatty allows you to import any website or files to instantly train your AI. Would you like to check our pricing plans?";
      
      const lower = userMsg.toLowerCase();
      if (lower.includes("price") || lower.includes("cost") || lower.includes("plan") || lower.includes("pricing")) {
        reply = "Our plans start at $19/mo (Hobby) which includes 1 chatbot and 1,000 messages. Standard is $99/mo with 3 chatbots. If you toggle yearly billing, you get 2 months free!";
      } else if (lower.includes("train") || lower.includes("knowledge") || lower.includes("source")) {
        reply = "Training is super simple! You can paste your website link, upload PDFs/text files, or write custom Q&As. I will learn it instantly in under a minute.";
      } else if (lower.includes("lead") || lower.includes("convert") || lower.includes("email")) {
        reply = "Yes! I can collect visitor names, emails, and phone numbers. Let's see: what is your email? (Type your email to see me collect a lead!)";
      } else if (lower.includes("@") && (lower.includes(".com") || lower.includes(".org") || lower.includes(".net"))) {
        setCollectedLead(true);
        reply = "Awesome! I've successfully collected your email as a lead. In a real scenario, this would be instantly visible in your dashboard under the 'Leads' tab and sent to your CRM.";
      } else if (lower.includes("model") || lower.includes("gpt") || lower.includes("claude") || lower.includes("gemini")) {
        reply = "You can switch between GPT-5.3, Claude Opus, Gemini, and Mistral at any time directly in your dashboard to find the best fit for your users.";
      } else if (lower.includes("free") || lower.includes("trial")) {
        reply = "All our plans come with a 14-day free trial. No credit card required to get started!";
      }

      setMessages((prev) => [...prev, { role: "assistant", content: reply }]);
      setIsTyping(false);
    }, 1000);
  };

  return (
    <div className="flex flex-col min-h-screen bg-background text-foreground font-sans relative antialiased">
      {/* Navbar */}
      <header
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-200 ${
          scrolled
            ? "bg-background/80 backdrop-blur-md border-b border-neutral-100 dark:border-neutral-900"
            : "bg-transparent"
        }`}
      >
        <div className="mx-auto max-w-5xl px-6 h-14 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <span className="font-semibold text-lg tracking-tight flex items-center gap-1.5">
              <span className="size-5 rounded-md bg-neutral-950 dark:bg-white flex items-center justify-center text-white dark:text-black font-bold text-xs">C</span>
              Chatty
            </span>
          </Link>
          <nav className="hidden md:flex items-center gap-6">
            <Link href="#features" className="text-sm text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-100 transition-colors">Features</Link>
            <Link href="#pricing" className="text-sm text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-100 transition-colors">Pricing</Link>
            <Link href="#faq" className="text-sm text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-100 transition-colors">FAQ</Link>
            <Link href="/dashboard" className="text-sm font-medium text-neutral-900 dark:text-neutral-100 hover:underline underline-offset-4">Dashboard</Link>
          </nav>
          <div className="flex items-center gap-3">
            <Link href="/dashboard" className="hidden sm:inline-flex text-sm text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-100 py-1.5 px-3">Log in</Link>
            <Link href="/dashboard">
              <Button size="sm" className="h-8 px-4 font-medium text-xs bg-neutral-950 text-white dark:bg-white dark:text-black rounded-lg hover:opacity-90 cursor-pointer">
                Start Free Trial
              </Button>
            </Link>
          </div>
        </div>
      </header>

      <main className="flex-1 pt-24">
        {/* Hero Section */}
        <section className="pb-16 md:pb-24">
          <div className="mx-auto max-w-5xl px-6">
            <div className="grid grid-cols-1 md:grid-cols-12 gap-12 items-center">
              {/* Left Column */}
              <motion.div 
                variants={containerVariants}
                initial="hidden"
                animate="visible"
                className="md:col-span-7 flex flex-col space-y-6 text-left"
              >
                <motion.span 
                  variants={itemVariants}
                  className="inline-flex items-center gap-1.5 w-fit rounded-full border border-neutral-200 dark:border-neutral-800 px-3 py-1 text-xs text-neutral-500 dark:text-neutral-400 font-medium bg-neutral-50/50 dark:bg-neutral-900/50"
                >
                  <span className="size-1.5 rounded-full bg-[#f97316] animate-pulse"></span>
                  PersonaliAI Product
                </motion.span>
                <motion.h1 
                  variants={itemVariants}
                  className="text-4xl sm:text-5xl md:text-[56px] font-bold tracking-tight leading-[1.08] text-neutral-900 dark:text-white"
                >
                  Custom chatbot that <br />
                  <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#f97316] to-[#ec4899] font-extrabold">pays for itself</span>.
                </motion.h1>
                <motion.p 
                  variants={itemVariants}
                  className="text-base sm:text-lg text-neutral-500 dark:text-neutral-400 max-w-xl leading-relaxed font-normal"
                >
                  An AI chatbot that does more than just chatting. Plug in your content and data sources. Integrate with your services. Create a custom AI chatbot that not only chats but converts. Zero coding, on your website in minutes.
                </motion.p>
                <motion.div 
                  variants={itemVariants}
                  className="flex flex-wrap items-center gap-4 pt-2"
                >
                  <Link href="/dashboard">
                    <Button size="lg" className="h-11 px-6 text-sm font-semibold bg-neutral-950 text-white dark:bg-white dark:text-black rounded-lg hover:opacity-90 cursor-pointer shadow-lg shadow-neutral-950/10 dark:shadow-white/5">
                      Start free 14-day trial
                    </Button>
                  </Link>
                  <Link href="#features">
                    <Button variant="outline" size="lg" className="h-11 px-6 text-sm font-semibold border-neutral-200 dark:border-neutral-850 bg-transparent rounded-lg hover:bg-neutral-50 dark:hover:bg-neutral-900 cursor-pointer">
                      See details
                    </Button>
                  </Link>
                </motion.div>
                <motion.p 
                  variants={itemVariants}
                  className="text-[10px] text-neutral-400 dark:text-neutral-500 font-medium"
                >
                  No credit card required. Cancel anytime.
                </motion.p>
              </motion.div>

              {/* Right Column: Simulated Chat Widget */}
              <motion.div 
                initial={{ opacity: 0, scale: 0.96, y: 15 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                transition={{ delay: 0.35, duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
                className="md:col-span-5 flex justify-center"
              >
                <div className="w-full max-w-[360px] h-[480px] rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 flex flex-col overflow-hidden relative">
                  {/* Chat Header */}
                  <div className="p-4 border-b border-neutral-100 dark:border-neutral-900 bg-neutral-50 dark:bg-neutral-900/50 flex items-center gap-3">
                    <div className="size-8 rounded-full bg-neutral-900 dark:bg-white flex items-center justify-center text-white dark:text-black font-bold text-sm">C</div>
                    <div>
                      <h4 className="font-semibold text-sm leading-tight text-neutral-900 dark:text-white">Chatty</h4>
                      <p className="text-[10px] text-neutral-400 dark:text-neutral-500 flex items-center gap-1">
                        <span className="size-1.5 rounded-full bg-[#f97316] animate-pulse"></span>
                        Active • Powered by PersonaliAI
                      </p>
                    </div>
                  </div>

                  {/* Message Container */}
                  <div className="flex-1 p-4 overflow-y-auto space-y-3 scrollbar-thin text-xs">
                    {messages.map((msg, index) => (
                      <motion.div
                        key={index}
                        initial={{ opacity: 0, scale: 0.92, y: 12 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        transition={{ duration: 0.25, ease: "easeOut" }}
                        className={`flex gap-2 max-w-[85%] ${
                          msg.role === "user" ? "ml-auto flex-row-reverse" : "mr-auto"
                        }`}
                      >
                        {msg.role !== "user" && (
                          <div className="size-6 rounded-full bg-neutral-100 dark:bg-neutral-900 flex items-center justify-center text-[10px] font-bold shrink-0">C</div>
                        )}
                        <div
                          className={`p-3 rounded-2xl leading-relaxed ${
                            msg.role === "user"
                              ? "bg-neutral-950 text-white rounded-tr-none dark:bg-neutral-100 dark:text-black"
                              : "bg-neutral-100 text-neutral-800 dark:bg-neutral-900 dark:text-neutral-200 rounded-tl-none"
                          }`}
                        >
                          {msg.content}
                        </div>
                      </motion.div>
                    ))}
                    {isTyping && (
                      <motion.div
                        initial={{ opacity: 0, y: 5 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="flex gap-2 mr-auto max-w-[85%]"
                      >
                        <div className="size-6 rounded-full bg-neutral-100 dark:bg-neutral-900 flex items-center justify-center text-[10px] font-bold shrink-0">C</div>
                        <div className="p-3 rounded-2xl rounded-tl-none bg-neutral-100 text-neutral-400 dark:bg-neutral-900 flex items-center gap-1.5">
                          <span className="size-1.5 rounded-full bg-neutral-400 dark:bg-neutral-500 animate-bounce"></span>
                          <span className="size-1.5 rounded-full bg-neutral-400 dark:bg-neutral-500 animate-bounce [animation-delay:0.2s]"></span>
                          <span className="size-1.5 rounded-full bg-neutral-400 dark:bg-neutral-500 animate-bounce [animation-delay:0.4s]"></span>
                        </div>
                      </motion.div>
                    )}
                    <div ref={chatEndRef} />
                  </div>

                  {/* Lead Captured Alert Banner */}
                  {collectedLead && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="absolute bottom-[60px] left-4 right-4 p-2 bg-green-50 border border-green-200 dark:bg-green-950/20 dark:border-green-900/50 rounded-lg flex items-center gap-2 text-[10px] text-green-700 dark:text-green-400"
                    >
                      <CheckCircle2 className="size-3.5 shrink-0" />
                      <span>Lead captured! Check the dashboard.</span>
                    </motion.div>
                  )}

                  {/* Input Form */}
                  <form onSubmit={handleSendMessage} className="p-3 border-t border-neutral-100 dark:border-neutral-900 flex gap-2">
                    <input
                      type="text"
                      placeholder="Ask me a question or type 'lead'..."
                      value={inputValue}
                      onChange={(e) => setInputValue(e.target.value)}
                      className="flex-1 bg-neutral-50 dark:bg-neutral-900 border border-neutral-100 dark:border-neutral-800 rounded-lg px-3 py-1.5 text-xs text-neutral-800 dark:text-neutral-200 focus:outline-none focus:border-neutral-350 dark:focus:border-neutral-700"
                    />
                    <button type="submit" className="p-2 bg-neutral-950 text-white dark:bg-white dark:text-black rounded-lg hover:opacity-90 flex items-center justify-center shrink-0 cursor-pointer">
                      <Send className="size-3.5" />
                    </button>
                  </form>
                </div>
              </motion.div>
            </div>
          </div>
        </section>

        {/* Pricing Section */}
        <section id="pricing" className="py-16 md:py-24 border-t border-neutral-100 dark:border-neutral-900">
          <div className="mx-auto max-w-5xl px-6 text-center flex flex-col items-center">
            <h2 className="text-3xl font-bold text-neutral-900 dark:text-white">Pricing plans</h2>
            <p className="mt-3 text-neutral-500 dark:text-neutral-400 max-w-lg">
              All plans come with a 14-day free trial and you can cancel anytime.
            </p>

            {/* Toggle Switch */}
            <div className="mt-8 flex items-center gap-3">
              <span className={`text-sm ${!isYearly ? "text-neutral-900 dark:text-white font-medium" : "text-neutral-400"}`}>Billed monthly</span>
              <button
                onClick={() => setIsYearly(!isYearly)}
                className="w-11 h-6 rounded-full bg-neutral-200 dark:bg-neutral-800 p-0.5 transition-colors relative cursor-pointer"
                aria-label="Toggle billing interval"
              >
                <div
                  className={`size-5 rounded-full bg-neutral-900 dark:bg-white transition-transform ${
                    isYearly ? "translate-x-5" : ""
                  }`}
                />
              </button>
              <div className="flex items-center gap-1.5">
                <span className={`text-sm ${isYearly ? "text-neutral-900 dark:text-white font-medium" : "text-neutral-400"}`}>Billed yearly</span>
                <span className="px-2 py-0.5 rounded-full bg-[#f97316]/10 text-[#f97316] text-[10px] font-bold">2 months free!</span>
              </div>
            </div>

            {/* Cards Matrix */}
            <div className="mt-12 w-full grid grid-cols-1 md:grid-cols-3 gap-8 text-left">
              {/* Hobby */}
              <div className="rounded-2xl border border-neutral-200 dark:border-neutral-800 p-8 bg-white dark:bg-neutral-950 flex flex-col justify-between relative">
                <div>
                  <h3 className="text-lg font-bold text-neutral-900 dark:text-white">Hobby</h3>
                  <div className="mt-4 flex items-baseline gap-1">
                    <span className="text-4xl font-bold text-neutral-900 dark:text-white">${isYearly ? "15" : "19"}</span>
                    <span className="text-sm text-neutral-500 dark:text-neutral-400">/month</span>
                  </div>
                  {isYearly && <p className="text-[10px] text-[#f97316] font-medium mt-1">Billed annually ($190/yr)</p>}
                  <p className="mt-4 text-xs text-neutral-500 dark:text-neutral-400">Perfect for individuals and side projects.</p>

                  <Link href="/dashboard" className="block mt-6">
                    <Button variant="outline" className="w-full h-10 border-neutral-200 dark:border-neutral-800 hover:bg-neutral-50 dark:hover:bg-neutral-900 text-xs font-semibold rounded-lg cursor-pointer">
                      Start free 14-day trial
                    </Button>
                  </Link>

                  <hr className="my-6 border-neutral-100 dark:border-neutral-900" />

                  <ul className="space-y-3 text-xs text-neutral-600 dark:text-neutral-400">
                    <li className="flex items-center gap-2"><Check className="size-3.5 text-neutral-900 dark:text-white" /> 1,000 message credits/month</li>
                    <li className="flex items-center gap-2"><Check className="size-3.5 text-neutral-900 dark:text-white" /> 10M training characters</li>
                    <li className="flex items-center gap-2"><Check className="size-3.5 text-neutral-900 dark:text-white" /> 1 chatbot</li>
                    <li className="flex items-center gap-2"><Check className="size-3.5 text-neutral-900 dark:text-white" /> Fast & Advanced AI models</li>
                    <li className="flex items-center gap-2"><Check className="size-3.5 text-neutral-900 dark:text-white" /> AI Actions</li>
                    <li className="flex items-center gap-2"><Check className="size-3.5 text-neutral-900 dark:text-white" /> Analytics</li>
                    <li className="flex items-center gap-2"><Check className="size-3.5 text-neutral-900 dark:text-white" /> Refinements</li>
                    <li className="flex items-center gap-2"><Check className="size-3.5 text-neutral-900 dark:text-white" /> Guardrails</li>
                    <li className="flex items-center gap-2"><Check className="size-3.5 text-neutral-900 dark:text-white" /> Notifications</li>
                    <li className="flex items-center gap-2"><Check className="size-3.5 text-neutral-900 dark:text-white" /> Integrations</li>
                    <li className="flex items-center gap-2"><Check className="size-3.5 text-neutral-900 dark:text-white" /> Chat API</li>
                    <li className="flex items-center gap-2"><Check className="size-3.5 text-neutral-900 dark:text-white" /> Lead collection</li>
                    <li className="flex items-center gap-2"><Check className="size-3.5 text-neutral-900 dark:text-white" /> Domain allowlist</li>
                    <li className="flex items-center gap-2"><Check className="size-3.5 text-neutral-900 dark:text-white" /> Community support</li>
                  </ul>
                </div>
              </div>

              {/* Standard */}
              <div className="rounded-2xl border-2 border-neutral-900 dark:border-white p-8 bg-white dark:bg-neutral-950 flex flex-col justify-between relative">
                <div className="absolute top-0 right-8 -translate-y-1/2 px-2.5 py-0.5 rounded-full bg-neutral-900 text-white dark:bg-white dark:text-black text-[10px] font-bold uppercase tracking-wider">Most Popular</div>
                <div>
                  <h3 className="text-lg font-bold text-neutral-900 dark:text-white">Standard</h3>
                  <div className="mt-4 flex items-baseline gap-1">
                    <span className="text-4xl font-bold text-neutral-900 dark:text-white">${isYearly ? "82" : "99"}</span>
                    <span className="text-sm text-neutral-500 dark:text-neutral-400">/month</span>
                  </div>
                  {isYearly && <p className="text-[10px] text-[#f97316] font-medium mt-1">Billed annually ($990/yr)</p>}
                  <p className="mt-4 text-xs text-neutral-500 dark:text-neutral-400">All in Hobby, plus advanced automation.</p>

                  <Link href="/dashboard" className="block mt-6">
                    <Button className="w-full h-10 bg-neutral-950 text-white dark:bg-white dark:text-black hover:opacity-90 text-xs font-semibold rounded-lg cursor-pointer">
                      Start free 14-day trial
                    </Button>
                  </Link>

                  <hr className="my-6 border-neutral-100 dark:border-neutral-900" />

                  <ul className="space-y-3 text-xs text-neutral-600 dark:text-neutral-400">
                    <li className="font-semibold text-neutral-800 dark:text-neutral-200">All in Hobby, plus:</li>
                    <li className="flex items-center gap-2"><Check className="size-3.5 text-neutral-900 dark:text-white" /> 10,000 message credits/month</li>
                    <li className="flex items-center gap-2"><Check className="size-3.5 text-neutral-900 dark:text-white" /> 20M training characters</li>
                    <li className="flex items-center gap-2"><Check className="size-3.5 text-neutral-900 dark:text-white" /> 3 chatbots</li>
                    <li className="flex items-center gap-2"><Check className="size-3.5 text-neutral-900 dark:text-white" /> Regular Auto Train</li>
                    <li className="flex items-center gap-2"><Check className="size-3.5 text-neutral-900 dark:text-white" /> Advanced notifications</li>
                    <li className="flex items-center gap-2"><Check className="size-3.5 text-neutral-900 dark:text-white" /> Remove branding</li>
                    <li className="flex items-center gap-2"><Check className="size-3.5 text-neutral-900 dark:text-white" /> Unlimited team members</li>
                    <li className="flex items-center gap-2"><Check className="size-3.5 text-neutral-900 dark:text-white" /> Standard support</li>
                  </ul>
                </div>
              </div>

              {/* Business */}
              <div className="rounded-2xl border border-neutral-200 dark:border-neutral-800 p-8 bg-white dark:bg-neutral-950 flex flex-col justify-between relative">
                <div>
                  <h3 className="text-lg font-bold text-neutral-900 dark:text-white">Business</h3>
                  <div className="mt-4 flex items-baseline gap-1">
                    <span className="text-4xl font-bold text-neutral-900 dark:text-white">${isYearly ? "332" : "399"}</span>
                    <span className="text-sm text-neutral-500 dark:text-neutral-400">/month</span>
                  </div>
                  {isYearly && <p className="text-[10px] text-[#f97316] font-medium mt-1">Billed annually ($3,990/yr)</p>}
                  <p className="mt-4 text-xs text-neutral-500 dark:text-neutral-400">For enterprise scale and heavy usage.</p>

                  <Link href="/dashboard" className="block mt-6">
                    <Button variant="outline" className="w-full h-10 border-neutral-200 dark:border-neutral-800 hover:bg-neutral-50 dark:hover:bg-neutral-900 text-xs font-semibold rounded-lg cursor-pointer">
                      Start free 14-day trial
                    </Button>
                  </Link>

                  <hr className="my-6 border-neutral-100 dark:border-neutral-900" />

                  <ul className="space-y-3 text-xs text-neutral-600 dark:text-neutral-400">
                    <li className="font-semibold text-neutral-800 dark:text-neutral-200">All in Standard, plus:</li>
                    <li className="flex items-center gap-2"><Check className="size-3.5 text-neutral-900 dark:text-white" /> 40,000 message credits/month</li>
                    <li className="flex items-center gap-2"><Check className="size-3.5 text-neutral-900 dark:text-white" /> 50M training characters</li>
                    <li className="flex items-center gap-2"><Check className="size-3.5 text-neutral-900 dark:text-white" /> 5 chatbots</li>
                    <li className="flex items-center gap-2"><Check className="size-3.5 text-neutral-900 dark:text-white" /> Use your own API keys (BYOK)</li>
                    <li className="flex items-center gap-2"><Check className="size-3.5 text-neutral-900 dark:text-white" /> Max Auto Train</li>
                    <li className="flex items-center gap-2"><Check className="size-3.5 text-neutral-900 dark:text-white" /> Whitelabel</li>
                    <li className="flex items-center gap-2"><Check className="size-3.5 text-neutral-900 dark:text-white" /> Management API</li>
                    <li className="flex items-center gap-2"><Check className="size-3.5 text-neutral-900 dark:text-white" /> Premium support</li>
                  </ul>
                </div>
              </div>
            </div>
            <p className="mt-8 text-xs text-neutral-400 dark:text-neutral-500">All prices are in USD and exclude local taxes (if applicable).</p>
          </div>
        </section>

        {/* Features Grid ("The details that matter") */}
        <section id="features" className="py-16 md:py-24 border-t border-neutral-100 dark:border-neutral-900">
          <div className="mx-auto max-w-5xl px-6">
            <div className="text-center max-w-lg mx-auto">
              <h2 className="text-3xl font-bold text-neutral-900 dark:text-white">The details that matter</h2>
              <p className="mt-3 text-sm text-neutral-500 dark:text-neutral-400">
                Explore the depth of Chatty's feature set. Click on any feature card to view a quick explanation.
              </p>
            </div>

            <div className="mt-12 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
              {featuresList.map((f, i) => {
                const Icon = f.icon;
                return (
                  <motion.div
                    key={i}
                    whileHover={{ y: -3 }}
                    onClick={() => setSelectedFeature(f)}
                    className="p-6 rounded-2xl border border-neutral-100 dark:border-neutral-900 bg-white dark:bg-neutral-950 hover:border-neutral-300 dark:hover:border-neutral-700 transition-all cursor-pointer group"
                  >
                    <div className="size-10 rounded-lg bg-neutral-50 dark:bg-neutral-900 flex items-center justify-center border border-neutral-100 dark:border-neutral-800 text-neutral-900 dark:text-white mb-4 group-hover:bg-[#f97316]/10 group-hover:text-[#f97316] transition-colors">
                      <Icon className="size-5" />
                    </div>
                    <h3 className="text-sm font-semibold text-neutral-900 dark:text-white flex items-center gap-1.5">
                      {f.title}
                      <ArrowRight className="size-3.5 opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all text-[#f97316]" />
                    </h3>
                    <p className="mt-2 text-xs text-neutral-500 dark:text-neutral-400 leading-relaxed line-clamp-2">
                      {f.desc}
                    </p>
                  </motion.div>
                );
              })}
            </div>
          </div>
        </section>

        {/* Feature Detail Modal */}
        <AnimatePresence>
          {selectedFeature && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
              {/* Backdrop */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 0.5 }}
                exit={{ opacity: 0 }}
                onClick={() => setSelectedFeature(null)}
                className="absolute inset-0 bg-black"
              />
              {/* Content Panel */}
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 15 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 15 }}
                className="relative w-full max-w-md bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-2xl p-6 shadow-2xl z-10"
              >
                <button
                  onClick={() => setSelectedFeature(null)}
                  className="absolute top-4 right-4 p-1 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-900 text-neutral-400 hover:text-neutral-900 dark:hover:text-white cursor-pointer"
                  aria-label="Close modal"
                >
                  <X className="size-4" />
                </button>
                <div className="flex items-center gap-3">
                  <div className="size-10 rounded-lg bg-[#f97316]/10 flex items-center justify-center text-[#f97316]">
                    {(() => {
                      const Icon = selectedFeature.icon;
                      return <Icon className="size-5" />;
                    })()}
                  </div>
                  <h3 className="text-base font-bold text-neutral-900 dark:text-white">{selectedFeature.title}</h3>
                </div>
                <p className="mt-4 text-sm text-neutral-600 dark:text-neutral-350 leading-relaxed">
                  {selectedFeature.desc}
                </p>
                <div className="mt-6 p-4 bg-neutral-50 dark:bg-neutral-900/50 rounded-xl border border-neutral-100 dark:border-neutral-900 text-xs text-neutral-500">
                  <span className="font-semibold text-neutral-850 dark:text-neutral-300">How to use:</span>
                  <p className="mt-1">Setup this feature directly inside the Chatty Dashboard under the corresponding management tab in under two clicks.</p>
                </div>
                <div className="mt-6 flex justify-end gap-2">
                  <Button size="sm" onClick={() => setSelectedFeature(null)} className="h-8 border-neutral-200 dark:border-neutral-800 text-neutral-700 bg-transparent border rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-900 text-xs cursor-pointer">
                    Dismiss
                  </Button>
                  <Link href="/dashboard" onClick={() => setSelectedFeature(null)}>
                    <Button size="sm" className="h-8 px-4 text-xs font-semibold bg-neutral-950 text-white dark:bg-white dark:text-black rounded-lg hover:opacity-90 cursor-pointer">
                      Try in Dashboard
                    </Button>
                  </Link>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* FAQ Section */}
        <section id="faq" className="py-16 md:py-24 border-t border-neutral-100 dark:border-neutral-900 bg-neutral-50/50 dark:bg-neutral-950/20">
          <div className="mx-auto max-w-3xl px-6">
            <h2 className="text-3xl font-bold text-neutral-900 dark:text-white text-center">Frequently asked questions</h2>
            <div className="mt-12 space-y-4">
              {faqs.map((faq, index) => {
                const isOpen = activeFaq === index;
                return (
                  <div
                    key={index}
                    className="border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 rounded-xl overflow-hidden transition-all duration-200"
                  >
                    <button
                      onClick={() => setActiveFaq(isOpen ? null : index)}
                      className="w-full px-6 py-4 flex items-center justify-between text-left font-medium text-sm text-neutral-900 dark:text-white hover:bg-neutral-50 dark:hover:bg-neutral-900/50 transition-colors cursor-pointer"
                      aria-expanded={isOpen}
                    >
                      {faq.question}
                      <ChevronDown
                        className={`size-4 text-neutral-500 transition-transform duration-200 ${
                          isOpen ? "rotate-180" : ""
                        }`}
                      />
                    </button>
                    <AnimatePresence initial={false}>
                      {isOpen && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.2 }}
                        >
                          <div className="px-6 pb-4 pt-1 text-xs text-neutral-500 dark:text-neutral-400 leading-relaxed border-t border-neutral-100 dark:border-neutral-900 bg-neutral-50/20 dark:bg-neutral-950/20">
                            {faq.answer}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-neutral-100 dark:border-neutral-900 py-12 bg-white dark:bg-neutral-950">
        <div className="mx-auto max-w-5xl px-6 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-sm tracking-tight flex items-center gap-1.5">
              <span className="size-5 rounded-md bg-neutral-950 dark:bg-white flex items-center justify-center text-white dark:text-black font-bold text-xs">C</span>
              Chatty
            </span>
            <span className="text-[10px] text-neutral-400 dark:text-neutral-500">by PersonaliAI</span>
          </div>
          <div className="flex flex-wrap justify-center gap-6 text-xs text-neutral-500 dark:text-neutral-400">
            <Link href="#features" className="hover:text-neutral-950 dark:hover:text-white transition-colors">Features</Link>
            <Link href="#pricing" className="hover:text-neutral-950 dark:hover:text-white transition-colors">Pricing</Link>
            <Link href="#faq" className="hover:text-neutral-950 dark:hover:text-white transition-colors">FAQ</Link>
            <Link href="/privacy" className="hover:text-neutral-950 dark:hover:text-white transition-colors">Privacy Policy</Link>
            <Link href="/terms" className="hover:text-neutral-950 dark:hover:text-white transition-colors">Terms of Service</Link>
          </div>
          <p className="text-[11px] text-neutral-400 dark:text-neutral-500">&copy; {new Date().getFullYear()} PersonaliAI. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
