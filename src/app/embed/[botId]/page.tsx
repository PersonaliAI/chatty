"use client";

import { useState, useEffect, useRef } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.min.css";
import { motion, AnimatePresence } from "framer-motion";
import { Send, Loader2, Sparkles } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useParams, useSearchParams } from "next/navigation";

// Supabase client instance
const supabase = createClient();

interface Message {
  role: "user" | "assistant";
  content: string;
}

export default function EmbedWidget() {
  const { botId } = useParams();
  const searchParams = useSearchParams();
  
  // Custom styling overrides from URL params
  const paramColor = searchParams.get("color");
  const paramStyle = searchParams.get("style");
  const disableShadows = searchParams.get("shadows") === "false" || true; // defaults to true as requested: "dont include shadows around chat assistant"

  const [loading, setLoading] = useState(true);
  const [botName, setBotName] = useState("Chatty Assistant");
  const [welcomeMsg, setWelcomeMsg] = useState("Hello! How can I help you today?");
  const [primaryColor, setPrimaryColor] = useState("#f97316");
  const [widgetStyle, setWidgetStyle] = useState("minimalist");

  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [isBotResponding, setIsBotResponding] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Fetch bot preferences
  useEffect(() => {
    async function loadBot() {
      if (!botId) return;
      try {
        const { data: bot, error } = await supabase
          .from("chatty_bots")
          .select("*")
          .eq("id", botId)
          .maybeSingle();

        if (error) throw error;

        if (bot) {
          setBotName(bot.name || "Chatty Assistant");
          setWelcomeMsg(bot.welcome_message || "Hello! How can I help you today?");
          setPrimaryColor(paramColor || bot.primary_color || "#f97316");
          setWidgetStyle(paramStyle || bot.widget_style || "minimalist");
          
          setMessages([
            { role: "assistant", content: bot.welcome_message || "Hello! How can I help you today?" }
          ]);
        }
      } catch (err) {
        console.error("Failed to load bot preferences:", err);
      } finally {
        setLoading(false);
      }
    }
    loadBot();
  }, [botId, paramColor, paramStyle]);

  // Handle open smooth scroll a tiny bit down
  useEffect(() => {
    const timer = setTimeout(() => {
      window.scrollTo({ top: 30, behavior: "smooth" });
    }, 400);
    return () => clearTimeout(timer);
  }, []);

  // Always scroll chat window to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isBotResponding]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim() || isBotResponding) return;

    const userText = inputValue;
    setMessages((prev) => [...prev, { role: "user", content: userText }]);
    setInputValue("");
    setIsBotResponding(true);

    const sessionId = `widget-session-${botId}`;

    try {
      const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL ?? "https://personaliai-api-376030619262.us-central1.run.app";
      
      const res = await fetch(`${BACKEND_URL}/api/widget/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          bot_id: botId,
          session_id: sessionId,
          text: userText,
          visitor_timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
        })
      });

      if (res.ok) {
        const body = await res.json();
        setMessages((prev) => [...prev, { role: "assistant", content: body.reply }]);
      } else {
        const body = await res.json();
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: `Error: ${body.detail || "Failed to get response from assistant."}` }
        ]);
      }
    } catch (err) {
      console.error("Widget send message error:", err);
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "Sorry, I am unable to connect to the server right now." }
      ]);
    } finally {
      setIsBotResponding(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-transparent">
        <Loader2 className="size-6 animate-spin text-neutral-400" />
      </div>
    );
  }

  const activeColor = primaryColor;

  return (
    <div className="w-full h-screen bg-transparent flex justify-center items-center p-0">
      <div 
        className={`w-full h-full bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-none overflow-hidden relative flex flex-col style-${widgetStyle} ${
          disableShadows ? "shadow-none" : "shadow-xl"
        }`}
      >
        {/* Chat Header */}
        <div
          style={widgetStyle === "minimalist" ? { backgroundColor: activeColor } : {}}
          className={`chat-header p-4 flex items-center justify-between border-b ${
            widgetStyle === "minimalist" ? "text-white border-transparent" : "border-neutral-200 dark:border-neutral-850"
          }`}
        >
          <div className="flex items-center gap-3">
            <div 
              style={widgetStyle !== "minimalist" ? { backgroundColor: activeColor, color: "white" } : {}}
              className="size-8 rounded-full bg-white/20 dark:bg-black/20 flex items-center justify-center font-bold text-sm"
            >
              {botName[0].toUpperCase()}
            </div>
            <div>
              <h4 className="font-semibold text-sm leading-tight">{botName}</h4>
              <p className="text-[9px] opacity-80 flex items-center gap-1">
                <span className="size-1.5 rounded-full bg-green-400 animate-pulse"></span>
                Online
              </p>
            </div>
          </div>
        </div>

        {/* Chat Messages */}
        <div className="flex-1 p-4 overflow-y-auto space-y-4 text-xs scrollbar-thin">
          <AnimatePresence initial={false}>
            {messages.map((msg, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, scale: 0.95, y: 15 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                transition={{ duration: 0.2, ease: "easeOut" }}
                className={`flex gap-2 max-w-[85%] ${
                  msg.role === "user" ? "ml-auto flex-row-reverse" : "mr-auto"
                }`}
              >
                {msg.role !== "user" && (
                  <div 
                    style={{ backgroundColor: activeColor, color: "white" }}
                    className="size-6 rounded-full flex items-center justify-center text-[9px] font-bold shrink-0"
                  >
                    {botName[0].toUpperCase()}
                  </div>
                )}
                <div
                  className={`p-3 rounded-2xl leading-relaxed ${
                    msg.role === "user"
                      ? "text-white rounded-tr-none"
                      : "bg-neutral-100 text-neutral-800 dark:bg-neutral-800 dark:text-neutral-200 rounded-tl-none"
                  }`}
                  style={msg.role === "user" ? { backgroundColor: activeColor } : {}}
                >
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm, remarkMath]}
                    rehypePlugins={[rehypeKatex]}
                    components={{
                      p: ({ children }) => <p className="mb-1 last:mb-0">{children}</p>,
                      ul: ({ children }) => <ul className="list-disc pl-4 mb-2 space-y-1">{children}</ul>,
                      ol: ({ children }) => <ol className="list-decimal pl-4 mb-2 space-y-1">{children}</ol>,
                      li: ({ children }) => <li className="mb-0.5">{children}</li>,
                      pre: ({ children }) => <pre className="bg-neutral-950 text-white rounded-lg p-2 overflow-x-auto my-2 text-[10px] font-mono leading-normal">{children}</pre>,
                      code: ({ children }) => (
                        <code className={msg.role === "user" ? "bg-white/20 text-white px-1 py-0.5 rounded text-[10px] font-mono" : "bg-neutral-200 dark:bg-neutral-850 px-1 py-0.5 rounded text-[10px] font-mono"}>
                          {children}
                        </code>
                      )
                    }}
                  >
                    {msg.content}
                  </ReactMarkdown>
                </div>
              </motion.div>
            ))}

            {isBotResponding && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 15 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                className="flex gap-2 max-w-[85%] mr-auto"
              >
                <div 
                  style={{ backgroundColor: activeColor, color: "white" }}
                  className="size-6 rounded-full flex items-center justify-center text-[9px] font-bold shrink-0 animate-pulse"
                >
                  {botName[0].toUpperCase()}
                </div>
                <div className="p-3 bg-neutral-100 text-neutral-800 dark:bg-neutral-800 dark:text-neutral-200 rounded-2xl rounded-tl-none flex items-center gap-1 min-h-[36px]">
                  <span className="size-1.5 rounded-full bg-neutral-400 dark:bg-neutral-500 animate-bounce" style={{ animationDelay: '0ms' }}></span>
                  <span className="size-1.5 rounded-full bg-neutral-400 dark:bg-neutral-500 animate-bounce" style={{ animationDelay: '150ms' }}></span>
                  <span className="size-1.5 rounded-full bg-neutral-400 dark:bg-neutral-500 animate-bounce" style={{ animationDelay: '300ms' }}></span>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
          <div ref={messagesEndRef} />
        </div>

        {/* Chat Input */}
        <form onSubmit={handleSendMessage} className="p-3 border-t border-neutral-150 dark:border-neutral-900 flex gap-2">
          <input
            type="text"
            placeholder="Type your message..."
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            disabled={isBotResponding}
            className="flex-1 bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-lg px-3 py-2 text-xs focus:outline-none"
          />
          <button
            type="submit"
            disabled={isBotResponding || !inputValue.trim()}
            style={{ backgroundColor: activeColor }}
            className="size-8 rounded-lg flex items-center justify-center text-white hover:opacity-90 transition-opacity cursor-pointer shrink-0 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Send className="size-4" />
          </button>
        </form>
      </div>
    </div>
  );
}
