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

// Simulated audio player component for the landing page chatbot widget
function SimulatedAudioPlayer({ name }: { name: string }) {
  const [isPlaying, setIsPlaying] = useState(false);
  return (
    <div className="flex items-center gap-3 p-2 bg-white dark:bg-black border border-neutral-200 dark:border-neutral-800 font-mono text-[10px] mt-2 select-none">
      <button
        onClick={(e) => {
          e.preventDefault();
          setIsPlaying(!isPlaying);
        }}
        className="size-6 border border-neutral-300 dark:border-neutral-850 flex items-center justify-center hover:bg-neutral-50 dark:hover:bg-neutral-900 cursor-pointer text-neutral-800 dark:text-neutral-200 shrink-0"
      >
        {isPlaying ? (
          <span className="size-2 bg-neutral-900 dark:bg-white animate-pulse" />
        ) : (
          <svg className="size-2.5 fill-current ml-0.5" viewBox="0 0 24 24">
            <path d="M8 5v14l11-7z" />
          </svg>
        )}
      </button>
      <div className="flex-1 flex items-end gap-0.5 h-5 select-none">
        <span className={`w-0.5 bg-neutral-300 dark:bg-neutral-800 transition-all ${isPlaying ? "animate-pulse h-4" : "h-2"}`}></span>
        <span className={`w-0.5 bg-neutral-400 dark:bg-neutral-700 transition-all ${isPlaying ? "animate-pulse [animation-delay:0.1s] h-5" : "h-3"}`}></span>
        <span className={`w-0.5 bg-neutral-900 dark:bg-white transition-all ${isPlaying ? "animate-pulse [animation-delay:0.2s] h-3" : "h-1"}`}></span>
        <span className={`w-0.5 bg-neutral-400 dark:bg-neutral-700 transition-all ${isPlaying ? "animate-pulse [animation-delay:0.3s] h-4" : "h-2"}`}></span>
        <span className={`w-0.5 bg-neutral-300 dark:bg-neutral-800 transition-all ${isPlaying ? "animate-pulse [animation-delay:0.4s] h-2" : "h-3"}`}></span>
        <span className={`w-0.5 bg-neutral-900 dark:bg-white transition-all ${isPlaying ? "animate-pulse [animation-delay:0.5s] h-5" : "h-1"}`}></span>
        <span className={`w-0.5 bg-neutral-450 dark:bg-neutral-700 transition-all ${isPlaying ? "animate-pulse [animation-delay:0.6s] h-3" : "h-2"}`}></span>
      </div>
      <span className="text-neutral-400 dark:text-neutral-500 text-[9px] shrink-0">{isPlaying ? "0:04" : "0:08"}</span>
    </div>
  );
}

// Simulated file clip component for the landing page chatbot widget
function SimulatedFileClip({ name }: { name: string }) {
  return (
    <div className="flex items-center justify-between p-2 bg-white dark:bg-black border border-neutral-200 dark:border-neutral-800 font-mono text-[10px] mt-2 select-none">
      <div className="flex items-center gap-2 truncate">
        <svg className="size-3.5 text-[#f97316] shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
          <path strokeLinecap="round" strokeLinejoin="round" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
        </svg>
        <span className="truncate text-neutral-800 dark:text-neutral-200">{name}</span>
      </div>
      <span className="text-neutral-400 dark:text-neutral-500 text-[9px] shrink-0 ml-2">1.2 MB</span>
    </div>
  );
}

export default function Home() {
  const [isYearly, setIsYearly] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [activeFaq, setActiveFaq] = useState<number | null>(null);
  const [selectedFeature, setSelectedFeature] = useState<Feature | null>(null);

  // Chat Widget Simulation State
  const [messages, setMessages] = useState<{
    role: string;
    content: string;
    attachment?: { type: "audio" | "file"; name: string; url: string };
  }[]>([
    { role: "assistant", content: "Hi! I'm Chatty. I'm a custom AI chatbot that captures leads and answers questions. Ask me anything about my pricing or features!" }
  ]);
  const [inputValue, setInputValue] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [collectedLead, setCollectedLead] = useState(false);
  const [isSimulating, setIsSimulating] = useState(true);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const simulationTimeoutsRef = useRef<any[]>([]);

  const clearSimulation = () => {
    setIsSimulating(false);
    simulationTimeoutsRef.current.forEach(clearTimeout);
    simulationTimeoutsRef.current = [];
  };

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    // Start auto-simulation sequence
    const t1 = setTimeout(() => {
      if (!isSimulating) return;
      setMessages((prev) => [
        ...prev,
        { role: "user", content: "Can you show me how a file upload or audio message looks in Chatty? 📎🎙️" }
      ]);
      
      const t2 = setTimeout(() => {
        setIsTyping(true);
        
        const t3 = setTimeout(() => {
          setIsTyping(false);
          setMessages((prev) => [
            ...prev,
            {
              role: "assistant",
              content: "Certainly! Chatty supports rich media and voice notes. Here is a voice message example:",
              attachment: { type: "audio", name: "voice_note.wav", url: "#" }
            }
          ]);
          
          const t4 = setTimeout(() => {
            setIsTyping(true);
            
            const t5 = setTimeout(() => {
              setIsTyping(false);
              setMessages((prev) => [
                ...prev,
                {
                  role: "assistant",
                  content: "And here is a document attachment sent by a customer:",
                  attachment: { type: "file", name: "product_specs.pdf", url: "#" }
                }
              ]);
              
              const t6 = setTimeout(() => {
                setMessages((prev) => [
                  ...prev,
                  { role: "user", content: "Wow, that looks extremely clean! Emojis work too? 😀🔥" }
                ]);
                
                const t7 = setTimeout(() => {
                  setIsTyping(true);
                  
                  const t8 = setTimeout(() => {
                    setIsTyping(false);
                    setMessages((prev) => [
                      ...prev,
                      {
                        role: "assistant",
                        content: "Absolutely! Emojis, files, and voice notes are fully supported. Try asking me about 'pricing' or enter your email to test lead capture! 👍"
                      }
                    ]);
                    setIsSimulating(false);
                  }, 1500);
                  simulationTimeoutsRef.current.push(t8);
                }, 1000);
                simulationTimeoutsRef.current.push(t7);
              }, 2500);
              simulationTimeoutsRef.current.push(t6);
            }, 1500);
            simulationTimeoutsRef.current.push(t5);
          }, 1000);
          simulationTimeoutsRef.current.push(t4);
        }, 1500);
        simulationTimeoutsRef.current.push(t3);
      }, 1000);
      simulationTimeoutsRef.current.push(t2);
    }, 2500);
    simulationTimeoutsRef.current.push(t1);

    return () => {
      simulationTimeoutsRef.current.forEach(clearTimeout);
    };
  }, []);

  useEffect(() => {
    if (messages.length > 1) {
      chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isTyping]);

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim()) return;

    clearSimulation();
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
              <span className="font-mono text-sm tracking-widest font-bold flex items-center gap-1.5 uppercase">
                <span className="size-5 bg-neutral-950 dark:bg-white flex items-center justify-center text-white dark:text-black font-mono font-bold text-xs">C</span>
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
          <section className="border-b border-neutral-200 dark:border-neutral-900">
            <div className="grid grid-cols-1 md:grid-cols-12 divide-y md:divide-y-0 md:divide-x divide-neutral-200 dark:divide-neutral-900">
              {/* Left Column */}
              <div className="md:col-span-7 p-8 md:p-12 lg:p-16 flex flex-col justify-center space-y-8 text-left">
                <div className="flex items-center gap-2 text-xs font-mono text-neutral-400 dark:text-neutral-500 uppercase tracking-widest">
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
                <div className="flex flex-wrap items-center gap-4 pt-2">
                  <Link href="/dashboard">
                    <Button className="h-12 px-6 bg-neutral-950 hover:bg-neutral-900 text-white dark:bg-white dark:text-black dark:hover:bg-neutral-100 rounded-none text-xs font-mono uppercase tracking-wider transition-colors border border-neutral-950 dark:border-white cursor-pointer">
                      Start free 14-day trial
                    </Button>
                  </Link>
                  <Link href="#features">
                    <Button variant="outline" className="h-12 px-6 border-neutral-200 dark:border-neutral-850 hover:bg-neutral-50 dark:hover:bg-neutral-900 rounded-none text-xs font-mono uppercase tracking-wider transition-colors bg-transparent cursor-pointer">
                      Explore features
                    </Button>
                  </Link>
                </div>
                <div className="text-[10px] font-mono text-neutral-400 dark:text-neutral-500 flex items-center gap-1.5">
                  <span>[ ✓ ] 14-DAY TRIAL</span>
                  <span>•</span>
                  <span>NO CREDIT CARD REQUIRED</span>
                </div>
              </div>

              {/* Right Column: Simulated Chat Widget */}
              <div className="md:col-span-5 p-8 md:p-12 lg:p-16 flex items-center justify-center bg-neutral-50/30 dark:bg-neutral-950/10">
                <div className="w-full max-w-[360px] h-[460px] border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-black flex flex-col overflow-hidden relative shadow-sm">
                  {/* Chat Header */}
                  <div className="p-4 border-b border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950 flex items-center justify-between font-mono text-xs text-neutral-500 dark:text-neutral-455">
                    <div className="flex items-center gap-2">
                      <div className="size-2 bg-[#f97316]"></div>
                      <span className="font-semibold text-neutral-900 dark:text-white uppercase">chatty_agent_v1</span>
                    </div>
                    <span>[ ACTIVE ]</span>
                  </div>

                  {/* Message Container */}
                  <div className="flex-1 p-4 overflow-y-auto space-y-4 scrollbar-thin text-xs">
                    {messages.map((msg, index) => (
                      <div
                        key={index}
                        className={`flex gap-3 max-w-[90%] ${
                          msg.role === "user" ? "ml-auto flex-row-reverse" : "mr-auto"
                        }`}
                      >
                        {msg.role !== "user" ? (
                          <div className="size-6 border border-neutral-200 dark:border-neutral-800 flex items-center justify-center font-mono text-[10px] text-neutral-500 dark:text-neutral-450 shrink-0 select-none bg-neutral-50 dark:bg-neutral-950">
                            A
                          </div>
                        ) : (
                          <div className="size-6 border border-neutral-950 dark:border-white flex items-center justify-center font-mono text-[10px] text-neutral-950 dark:text-white shrink-0 select-none bg-neutral-950 dark:bg-white text-white dark:text-black">
                            U
                          </div>
                        )}
                        <div
                          className={`p-3 border leading-relaxed ${
                            msg.role === "user"
                              ? "bg-neutral-950 text-white border-neutral-950 dark:bg-white dark:text-black dark:border-white"
                              : "bg-neutral-50 text-neutral-800 dark:bg-neutral-950 dark:text-neutral-200 border-neutral-200 dark:border-neutral-850"
                          }`}
                        >
                          <div>{msg.content}</div>
                          {msg.attachment && (
                            <div className="mt-2.5 pt-2 border-t border-neutral-200/50 dark:border-neutral-800/50">
                              {msg.attachment.type === "audio" ? (
                                <SimulatedAudioPlayer name={msg.attachment.name} />
                              ) : (
                                <SimulatedFileClip name={msg.attachment.name} />
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                    {isTyping && (
                      <div className="flex gap-3 max-w-[90%] mr-auto">
                        <div className="size-6 border border-neutral-200 dark:border-neutral-800 flex items-center justify-center font-mono text-[10px] text-neutral-500 dark:text-neutral-455 shrink-0 select-none bg-neutral-50 dark:bg-neutral-950">
                          A
                        </div>
                        <div className="p-3 border border-neutral-200 dark:border-neutral-855 bg-neutral-50 dark:bg-neutral-950 flex items-center gap-1.5">
                          <span className="size-1.5 bg-neutral-400 dark:bg-neutral-600 animate-bounce"></span>
                          <span className="size-1.5 bg-neutral-400 dark:bg-neutral-600 animate-bounce [animation-delay:0.2s]"></span>
                          <span className="size-1.5 bg-neutral-400 dark:bg-neutral-600 animate-bounce [animation-delay:0.4s]"></span>
                        </div>
                      </div>
                    )}
                    <div ref={chatEndRef} />
                  </div>

                  {/* Lead Captured Alert Banner */}
                  {collectedLead && (
                    <div className="absolute bottom-[60px] left-4 right-4 p-3 bg-white dark:bg-black border-2 border-emerald-500 text-emerald-600 dark:text-emerald-455 font-mono text-[10px] flex items-center gap-2 tracking-tight">
                      <Check className="size-3.5 shrink-0" />
                      <span>[ LEAD CAPTURED: CHECK DASHBOARD ]</span>
                    </div>
                  )}

                  {/* Input Form */}
                  <form onSubmit={handleSendMessage} className="p-3 border-t border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950 flex flex-col gap-2">
                    <div className="flex items-center gap-2">
                      {/* Left actions */}
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => {
                            clearSimulation();
                            setInputValue((prev) => prev + " 📎 ");
                          }}
                          className="p-1 hover:text-[#f97316] text-neutral-450 dark:text-neutral-500 transition-colors group cursor-pointer"
                          title="Attach file"
                        >
                          <svg className="size-3.5 group-hover:animate-bounce" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                          </svg>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            clearSimulation();
                            setInputValue((prev) => prev + " 🎙️ ");
                          }}
                          className="p-1 hover:text-[#f97316] text-neutral-450 dark:text-neutral-500 transition-colors cursor-pointer"
                          title="Voice message"
                        >
                          <svg className="size-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                          </svg>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            clearSimulation();
                            setInputValue((prev) => prev + " 😀 ");
                          }}
                          className="p-1 hover:text-[#f97316] text-neutral-450 dark:text-neutral-500 transition-colors cursor-pointer"
                          title="Insert emoji"
                        >
                          <svg className="size-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                        </button>
                      </div>
                      
                      {/* Input field */}
                      <div className="flex-1 relative flex items-center">
                        <span className="absolute left-2.5 font-mono text-neutral-405 dark:text-neutral-500 select-none text-[10px]">&gt;</span>
                        <input
                          type="text"
                          placeholder="Ask a question..."
                          value={inputValue}
                          onChange={(e) => {
                            clearSimulation();
                            setInputValue(e.target.value);
                          }}
                          className="w-full bg-white dark:bg-black border border-neutral-200 dark:border-neutral-800 rounded-none pl-6 pr-2 py-1.5 text-xs text-neutral-800 dark:text-neutral-200 focus:outline-none focus:border-neutral-900 dark:focus:border-white font-mono"
                        />
                      </div>

                      {/* Send button */}
                      <button type="submit" className="px-3 py-1.5 bg-neutral-950 text-white dark:bg-white dark:text-black rounded-none border border-neutral-955 dark:border-white hover:opacity-90 flex items-center justify-center font-mono text-xs cursor-pointer uppercase tracking-tight">
                        Send
                      </button>
                    </div>
                  </form>
                  
                  {/* Branding / Website Link */}
                  <div className="p-2 border-t border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950 text-center select-none shrink-0">
                    <span className="text-[9px] font-mono text-neutral-400 dark:text-neutral-500 uppercase tracking-wider">
                      Powered by{" "}
                      <a
                        href="https://personaliai.com"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-neutral-600 dark:text-neutral-300 hover:text-[#f97316] underline font-semibold"
                      >
                        PersonaliAI
                      </a>
                    </span>
                  </div>
                </div>
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
              <span className="font-mono text-sm tracking-widest font-bold flex items-center gap-1.5 uppercase text-neutral-900 dark:text-white">
                <span className="size-5 bg-neutral-950 dark:bg-white flex items-center justify-center text-white dark:text-black font-mono font-bold text-xs">C</span>
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
    </div>
  );
}
