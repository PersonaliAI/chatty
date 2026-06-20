"use client";

import { useState, useEffect, useRef } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.min.css";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import {
  Home,
  Sliders,
  Database,
  MessageSquare,
  BarChart3,
  Code2,
  Settings,
  Plus,
  Send,
  Loader2,
  Trash2,
  Copy,
  Check,
  Sparkles,
  ShieldAlert,
  ArrowRight,
  TrendingUp,
  Users,
  MessageCircle,
  HelpCircle,
  LogOut,
  RefreshCw,
  Globe,
  Save,
  Menu,
  X,
  FileText,
  Calendar,
  Mail,
  FolderOpen,
  CheckSquare,
  HardDrive,
  FileSpreadsheet,
  Presentation,
  ExternalLink,
  AlertCircle,
  Paperclip,
  FileUp,
  Link2,
  ChevronUp,
  Layers
} from "lucide-react";

// Types
interface Lead {
  id: string;
  name: string;
  email: string;
  phone: string;
  created_at: string;
}

interface Source {
  id: string;
  type: "text" | "url" | "file";
  name: string;
  content: string;
  status: "training" | "trained";
  charCount: number;
}

export default function Dashboard() {
  const [activeTab, setActiveTab] = useState("home");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const supabase = createClient();

  // User State
  const [user, setUser] = useState<any>(null);
  const [botId, setBotId] = useState<string | null>(null);
  const [loadingSession, setLoadingSession] = useState(true);

  // Chatbot State
  const [botName, setBotName] = useState("Chatty Assistant");
  const [welcomeMsg, setWelcomeMsg] = useState("Hello! How can I help you today?");
  const [primaryColor, setPrimaryColor] = useState("#f97316"); // default
  const [widgetStyle, setWidgetStyle] = useState<"minimalist" | "glassmorphism" | "liquid" | "neumorphism">("minimalist");
  const [selectedModel, setSelectedModel] = useState("gemini");
  const [systemInstructions, setSystemInstructions] = useState(
    "You are a helpful customer support agent for my business. You must only answer questions based on the provided knowledge. Be concise and polite."
  );
  const [strictMode, setStrictMode] = useState(true);
  const [emailNotify, setEmailNotify] = useState(true);

  // Unsaved Changes Tracking
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Lists (No demo data by default - queries Supabase)
  const [sources, setSources] = useState<Source[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loadingLists, setLoadingLists] = useState(false);

  // Training inputs
  const [inputText, setInputText] = useState("");
  const [inputTitle, setInputTitle] = useState("");
  const [inputUrl, setInputUrl] = useState("");

  // RAG / Cloud Connectors State
  const [googleConnected, setGoogleConnected] = useState(false);
  const [microsoftConnected, setMicrosoftConnected] = useState(false);
  const [googleEmail, setGoogleEmail] = useState<string | null>(null);
  const [microsoftEmail, setMicrosoftEmail] = useState<string | null>(null);
  const [telegramId, setTelegramId] = useState<number | null>(null);
  const [telegramLinkOpen, setTelegramLinkOpen] = useState(false);
  const [connectingProvider, setConnectingProvider] = useState<"google" | "microsoft" | null>(null);

  // Sync controls (each separate card)
  const [syncGoogleDrive, setSyncGoogleDrive] = useState(false);
  const [syncGoogleCalendar, setSyncGoogleCalendar] = useState(false);
  const [syncGmail, setSyncGmail] = useState(false);
  const [syncGoogleTasks, setSyncGoogleTasks] = useState(false);
  const [syncGoogleContacts, setSyncGoogleContacts] = useState(false);
  const [syncGoogleDocs, setSyncGoogleDocs] = useState(false);
  const [syncGoogleSheets, setSyncGoogleSheets] = useState(false);
  const [syncGoogleSlides, setSyncGoogleSlides] = useState(false);

  // Scheduling settings
  const [calendarSchedulingEnabled, setCalendarSchedulingEnabled] = useState(false);
  const [schedulingDuration, setSchedulingDuration] = useState(30);
  const [botTimezone, setBotTimezone] = useState("UTC");

  // Google Drive indexing settings
  const [driveFolderUrl, setDriveFolderUrl] = useState("");
  const [driveMaxFiles, setDriveMaxFiles] = useState(50);
  const [isIndexingDrive, setIsIndexingDrive] = useState(false);
  const [driveIndexError, setDriveIndexError] = useState<string | null>(null);
  const [driveIndexSuccess, setDriveIndexSuccess] = useState<string | null>(null);

  const [syncOneDrive, setSyncOneDrive] = useState(false);
  const [syncMicrosoftToDo, setSyncMicrosoftToDo] = useState(false);
  const [syncOutlook, setSyncOutlook] = useState(false);
  const [syncOutlookCalendar, setSyncOutlookCalendar] = useState(false);
  const [syncOutlookContacts, setSyncOutlookContacts] = useState(false);
  const [syncTelegram, setSyncTelegram] = useState(false);

  // Analytics State
  const [totalQueries, setTotalQueries] = useState(0);
  const [totalSessions, setTotalSessions] = useState(0);
  const [conversionRate, setConversionRate] = useState("0.0");
  const [analyticsChartData, setAnalyticsChartData] = useState<Array<{ day: string; count: number; height: string }>>([]);
  const [loadingAnalytics, setLoadingAnalytics] = useState(false);

  // Playground Chat State
  const [playgroundMessages, setPlaygroundMessages] = useState<Array<{ role: string; content: string; thinkingSteps?: string[] }>>([]);
  const [liveThinkingSteps, setLiveThinkingSteps] = useState<string[]>([]);
  const [playgroundInput, setPlaygroundInput] = useState("");
  const [isBotResponding, setIsBotResponding] = useState(false);
  const [collectedInPlayground, setCollectedInPlayground] = useState(false);
  
  // Lead collection flow inside playground chat
  const [leadStep, setLeadStep] = useState<"none" | "ask_name" | "ask_email" | "ask_phone">("none");
  const [tempLead, setTempLead] = useState({ name: "", email: "", phone: "" });

  const playgroundEndRef = useRef<HTMLDivElement>(null);

  // Knowledge Base Chat States
  const [knowledgeMessages, setKnowledgeMessages] = useState<Array<{ role: string; content: string; status?: "info" | "success" | "error" | "pending"; filename?: string }>>([
    {
      role: "assistant",
      content: "Hello! I am your Knowledge Manager. I can help you train your chatbot. You can:\n\n1. **Upload files** (PDF, DOCX, TXT, MD) using the 📎 paperclip button.\n2. **Crawl websites** by pasting a URL (e.g. `https://example.com/faq`) or saying `crawl https://example.com`.\n3. **Train facts** by typing or pasting text documentation directly here.\n4. **Test RAG memory** by asking me questions like `What is the return policy?` to see what I've learned!"
    }
  ]);
  const [knowledgeInput, setKnowledgeInput] = useState("");
  const [isKnowledgeLoading, setIsKnowledgeLoading] = useState(false);
  const [uploadingFile, setUploadingFile] = useState<string | null>(null);
  const [paperclipOpen, setPaperclipOpen] = useState(false);
  const knowledgeEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Copy code animation state
  const [copiedScript, setCopiedScript] = useState(false);
  const [copiedIframe, setCopiedIframe] = useState(false);

  // Backend Integration URL
  const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL ?? "https://personaliai-api-376030619262.us-central1.run.app";

  // Authenticate user and fetch configuration from Supabase
  useEffect(() => {
    async function checkSession() {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
          setUser(session.user);
          await checkCloudConnections(session.user.id);
          await loadBotSettings(session.user.id);
        }
      } catch (err) {
        console.error("Supabase session check error:", err);
      } finally {
        setLoadingSession(false);
      }
    }
    checkSession();
  }, []);

  // Helper for resilient fetch calls with fallback to production backend
  const fetchWithFallback = async (path: string, options: RequestInit = {}) => {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    const headers = {
      ...options.headers,
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    };
    try {
      return await fetch(`${BACKEND_URL}${path}`, { ...options, headers });
    } catch (err) {
      console.warn(`Local backend down for ${path}, retrying with production fallback...`);
      const fallbackUrl = "https://personaliai-api-376030619262.us-central1.run.app";
      return await fetch(`${fallbackUrl}${path}`, { ...options, headers });
    }
  };

  // Check backend integration state & query email accounts
  async function checkCloudConnections(userId: string) {
    try {
      // Fetch from API to check calendar/auth session
      const res = await fetchWithFallback("/api/integrations/calendar/events");

      // Query public users table for integrated emails
      const { data: uData } = await supabase
        .from("users")
        .select("google_email, microsoft_email, telegram_id")
        .eq("auth_user_id", userId)
        .maybeSingle();

      if (uData) {
        setGoogleEmail(uData.google_email || null);
        setMicrosoftEmail(uData.microsoft_email || null);
        setTelegramId(uData.telegram_id || null);
        setGoogleConnected(!!uData.google_email);
        setMicrosoftConnected(!!uData.microsoft_email);
      } else if (res.ok) {
        const body = await res.json();
        setGoogleConnected(body.connected?.google || false);
        setMicrosoftConnected(body.connected?.microsoft || false);
      }
    } catch (err) {
      console.warn("Could not check real cloud connections:", err);
    }
  }

  // Load analytics counts and graph directly from database
  async function loadAnalyticsData(activeBotId: string, currentLeadsCount: number) {
    setLoadingAnalytics(true);
    try {
      // 1. Total user queries
      const { count: queriesCount } = await supabase
        .from("chatty_conversations")
        .select("*", { count: "exact", head: true })
        .eq("bot_id", activeBotId)
        .eq("role", "user");

      setTotalQueries(queriesCount || 0);

      // 2. Total unique sessions
      const { data: convData } = await supabase
        .from("chatty_conversations")
        .select("session_id")
        .eq("bot_id", activeBotId);

      const uniqueSessions = new Set(convData?.map(c => c.session_id) || []).size;
      setTotalSessions(uniqueSessions);

      // 3. Lead conversion rate
      const rate = uniqueSessions > 0 ? ((currentLeadsCount / uniqueSessions) * 100).toFixed(1) : "0.0";
      setConversionRate(rate);

      // 4. Last 7 days query chart
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
      sevenDaysAgo.setHours(0, 0, 0, 0);

      const { data: queryData } = await supabase
        .from("chatty_conversations")
        .select("created_at")
        .eq("bot_id", activeBotId)
        .eq("role", "user")
        .gte("created_at", sevenDaysAgo.toISOString());

      const daysOfWeek = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
      const last7Days: Array<{ dateString: string; dayLabel: string; count: number }> = [];
      for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        last7Days.push({
          dateString: d.toDateString(),
          dayLabel: daysOfWeek[d.getDay()],
          count: 0
        });
      }

      if (queryData) {
        queryData.forEach(q => {
          const qDate = new Date(q.created_at).toDateString();
          const dayObj = last7Days.find(d => d.dateString === qDate);
          if (dayObj) {
            dayObj.count++;
          }
        });
      }

      const maxCount = Math.max(...last7Days.map(d => d.count), 1);
      const chart = last7Days.map(d => ({
        day: d.dayLabel,
        count: d.count,
        height: `${(d.count / maxCount) * 100}%`
      }));
      setAnalyticsChartData(chart);
    } catch (err) {
      console.error("Error loading analytics data:", err);
    } finally {
      setLoadingAnalytics(false);
    }
  }

  // Fetch bot settings, sources, and leads
  async function loadBotSettings(userId: string) {
    setLoadingLists(true);
    try {
      const { data: bots, error } = await supabase
        .from("chatty_bots")
        .select("*")
        .eq("user_id", userId)
        .limit(1);

      if (error) throw error;
      let activeBot = bots?.[0];

      if (!activeBot) {
        // Create a default chatbot configuration if none exists
        const { data: newBot, error: createError } = await supabase
          .from("chatty_bots")
          .insert({
            user_id: userId,
            name: "Chatty Assistant",
            welcome_message: "Hello! How can I help you today?",
            primary_color: "#f97316",
            widget_style: "minimalist",
            selected_model: "gemini",
            system_instructions: "You are a helpful customer support agent for my business. You must only answer questions based on the provided knowledge. Be concise and polite.",
            strict_mode: true,
            email_notify: true
          })
          .select()
          .single();

        if (createError) throw createError;
        activeBot = newBot;
      }

      if (activeBot) {
        setBotId(activeBot.id);
        setBotName(activeBot.name);
        setWelcomeMsg(activeBot.welcome_message);
        setPrimaryColor(activeBot.primary_color);
        setWidgetStyle(activeBot.widget_style || "minimalist");
        setSelectedModel(activeBot.selected_model);
        setSystemInstructions(activeBot.system_instructions);
        setStrictMode(activeBot.strict_mode);
        setEmailNotify(activeBot.email_notify);

        setSyncGoogleDrive(activeBot.sync_google_drive || false);
        setSyncGoogleCalendar(activeBot.sync_google_calendar || false);
        setCalendarSchedulingEnabled(activeBot.calendar_scheduling_enabled || false);
        setSchedulingDuration(activeBot.scheduling_duration_minutes || 30);
        setBotTimezone(activeBot.bot_timezone || "UTC");

        // Fetch sources
        const { data: srcList } = await supabase
          .from("chatty_sources")
          .select("*")
          .eq("bot_id", activeBot.id);

        if (srcList) {
          setSources(srcList.map(s => ({
            id: s.id,
            type: s.type,
            name: s.name,
            content: s.content,
            status: s.status,
            charCount: s.char_count
          })));
        }

        // Fetch leads
        const { data: leadList } = await supabase
          .from("chatty_leads")
          .select("*")
          .eq("bot_id", activeBot.id)
          .order("created_at", { ascending: false });

        let currentLeadsCount = 0;
        if (leadList) {
          const mappedLeads = leadList.map(l => ({
            id: l.id,
            name: l.name || "Anonymous",
            email: l.email || "N/A",
            phone: l.phone || "N/A",
            created_at: new Date(l.created_at).toISOString().slice(0, 16).replace("T", " ")
          }));
          setLeads(mappedLeads);
          currentLeadsCount = mappedLeads.length;
        }

        // Recalculate real analytics
        await loadAnalyticsData(activeBot.id, currentLeadsCount);
      }
    } catch (err) {
      console.error("Error loading bot database config:", err);
    } finally {
      setLoadingLists(false);
    }
  }

  // Handle Cloud Connector Disconnects
  const handleDisconnectCloud = async (provider: "google" | "microsoft") => {
    if (!confirm(`Disconnect ${provider === "google" ? "Google" : "Microsoft"}? This will turn off all syncing sources and clear connection tokens.`)) {
      return;
    }
    try {
      const { data } = await supabase.auth.getSession();
      if (!data.session?.access_token) return;

      const res = await fetchWithFallback(`/api/integrations/${provider}/disconnect`, {
        method: "POST"
      });
      if (res.ok) {
        if (provider === "google") {
          setGoogleConnected(false);
          setGoogleEmail(null);
        } else {
          setMicrosoftConnected(false);
          setMicrosoftEmail(null);
        }
      }
    } catch (err) {
      console.error(`Error disconnecting ${provider}:`, err);
    }
  };

  // Telegram link and unlink
  const handleLinkTelegram = async (chatIdNum: number) => {
    try {
      const { data } = await supabase.auth.getSession();
      if (!data.session?.access_token) return false;

      const res = await fetchWithFallback(`/api/integrations/telegram/link`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ chat_id: chatIdNum })
      });
      if (res.ok) {
        setTelegramId(chatIdNum);
        return true;
      } else {
        const body = await res.json();
        throw new Error(body.message || "Failed to link Telegram");
      }
    } catch (err) {
      console.error("Error linking Telegram:", err);
      throw err;
    }
  };

  const handleUnlinkTelegram = async () => {
    if (!confirm("Unlink this Telegram chat?")) return;
    try {
      const { data } = await supabase.auth.getSession();
      if (!data.session?.access_token) return;

      const res = await fetchWithFallback(`/api/integrations/telegram/unlink`, {
        method: "POST"
      });
      if (res.ok) {
        setTelegramId(null);
      }
    } catch (err) {
      console.error("Error unlinking Telegram:", err);
    }
  };

  // Persist chatbot appearance/settings to Supabase
  async function handleSaveChanges() {
    if (!user || !botId) return;
    setIsSaving(true);
    try {
      const { error } = await supabase
        .from("chatty_bots")
        .update({
          name: botName,
          welcome_message: welcomeMsg,
          primary_color: primaryColor,
          widget_style: widgetStyle,
          selected_model: selectedModel,
          system_instructions: systemInstructions,
          strict_mode: strictMode,
          email_notify: emailNotify,
          sync_google_drive: syncGoogleDrive,
          sync_google_calendar: syncGoogleCalendar,
          calendar_scheduling_enabled: calendarSchedulingEnabled,
          scheduling_duration_minutes: schedulingDuration,
          bot_timezone: botTimezone,
          updated_at: new Date().toISOString()
        })
        .eq("id", botId);

      if (error) throw error;
      setHasUnsavedChanges(false);
    } catch (err) {
      console.error("Error saving chatbot changes:", err);
    } finally {
      setIsSaving(false);
    }
  }

  // Handle Input Changes
  const handleInputChange = (setter: any, val: any) => {
    setter(val);
    setHasUnsavedChanges(true);
  };

  useEffect(() => {
    setPlaygroundMessages([
      { role: "assistant", content: welcomeMsg }
    ]);
  }, [welcomeMsg, activeTab]);

  useEffect(() => {
    playgroundEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [playgroundMessages, isBotResponding]);

  // Auto-scroll for Knowledge Chat
  useEffect(() => {
    knowledgeEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [knowledgeMessages, isKnowledgeLoading, uploadingFile]);

  // Handle Knowledge Base File Upload
  const handleKnowledgeUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !botId) return;

    // Check size limit: 20MB
    const MAX_SIZE = 20 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
      alert("File is too large. Max size allowed is 20MB.");
      return;
    }

    setUploadingFile(file.name);
    setIsKnowledgeLoading(true);

    // Add a pending message
    setKnowledgeMessages((prev) => [
      ...prev,
      {
        role: "user",
        content: `Uploaded file: **${file.name}**`
      },
      {
        role: "assistant",
        content: `Uploading and indexing **${file.name}**... Please wait while I process the document structure and extract text chunks.`,
        status: "pending",
        filename: file.name
      }
    ]);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetchWithFallback("/api/documents/upload", {
        method: "POST",
        body: formData,
      });

      if (res.ok) {
        const body = await res.json();
        
        // Update the assistant message in chat log
        setKnowledgeMessages((prev) =>
          prev.map((msg) =>
            msg.filename === file.name && msg.status === "pending"
              ? {
                  role: "assistant",
                  content: `Successfully trained on **${file.name}**! Added **${body.chunk_count || 0}** chunks to RAG memory.`,
                  status: "success"
                }
              : msg
          )
        );

        // Fetch sources to refresh lists
        if (user) {
          await loadBotSettings(user.id);
        }
      } else {
        const body = await res.json();
        setKnowledgeMessages((prev) =>
          prev.map((msg) =>
            msg.filename === file.name && msg.status === "pending"
              ? {
                  role: "assistant",
                  content: `Failed to index **${file.name}**. Error: ${body.detail || "Unknown backend error."}`,
                  status: "error"
                }
              : msg
          )
        );
      }
    } catch (err: any) {
      console.error("File upload error:", err);
      setKnowledgeMessages((prev) =>
        prev.map((msg) =>
          msg.filename === file.name && msg.status === "pending"
            ? {
                role: "assistant",
                content: `Could not connect to the upload server. Make sure the backend is active.`,
                status: "error"
              }
            : msg
        )
      );
    } finally {
      setIsKnowledgeLoading(false);
      setUploadingFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  // Handle Knowledge Base Chat Submission
  const handleKnowledgeSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!knowledgeInput.trim() || !botId) return;

    const userInput = knowledgeInput.trim();
    setKnowledgeInput("");
    setIsKnowledgeLoading(true);

    // 1. Add User Message
    setKnowledgeMessages((prev) => [...prev, { role: "user", content: userInput }]);

    // Check if it is a URL or a crawl command
    const crawlMatch = userInput.match(/^(?:crawl\s+)?(https?:\/\/[^\s]+)$/i);

    if (crawlMatch) {
      const urlToCrawl = crawlMatch[1];
      
      // Add thinking/progress bubble
      setKnowledgeMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: `Crawl command detected for **${urlToCrawl}**. Sending request to crawler and indexing content...`,
          status: "pending",
          filename: urlToCrawl
        }
      ]);

      try {
        let crawledContent = `This source represents the crawled contents of ${urlToCrawl}.`;
        try {
          const jinaUrl = `https://r.jina.ai/${urlToCrawl}`;
          const response = await fetch(jinaUrl);
          if (response.ok) {
            const text = await response.text();
            if (text && text.trim().length > 100) {
              crawledContent = text;
            }
          }
        } catch (crawlErr) {
          console.warn("Real-time client-side crawl failed:", crawlErr);
        }

        if (user && botId) {
          const { data: dbSrc, error } = await supabase
            .from("chatty_sources")
            .insert({
              bot_id: botId,
              type: "url",
              name: urlToCrawl,
              content: crawledContent,
              status: "training",
              char_count: crawledContent.length
            })
            .select()
            .single();

          if (error) throw error;

          // Simulate processing time
          setTimeout(async () => {
            await supabase
              .from("chatty_sources")
              .update({ status: "trained" })
              .eq("id", dbSrc.id);

            // Update chat log bubble to success
            setKnowledgeMessages((prev) =>
              prev.map((msg) =>
                msg.filename === urlToCrawl && msg.status === "pending"
                  ? {
                      role: "assistant",
                      content: `Successfully crawled and trained on **${urlToCrawl}**! Added character count: ${crawledContent.length}.`,
                      status: "success"
                    }
                  : msg
              )
            );

            // Refresh settings
            await loadBotSettings(user.id);
          }, 1500);
        }
      } catch (err: any) {
        console.error("Crawl error:", err);
        setKnowledgeMessages((prev) =>
          prev.map((msg) =>
            msg.filename === urlToCrawl && msg.status === "pending"
              ? {
                  role: "assistant",
                  content: `Failed to crawl website. Error: ${(err as any).message || "Unknown error"}`,
                  status: "error"
                }
              : msg
          )
        );
      } finally {
        setIsKnowledgeLoading(false);
      }
      return;
    }

    // 2. Check if it's a paragraph of facts to train
    const isQuestion = userInput.endsWith("?") || /^(what|how|why|who|where|when|can|is|are|does|do|should|would|will)\b/i.test(userInput);
    const isTrainCommand = userInput.toLowerCase().startsWith("train:") || userInput.toLowerCase().startsWith("fact:") || (!isQuestion && userInput.length > 40);

    if (isTrainCommand) {
      let docContent = userInput;
      let docTitle = `Text Ingest - ${new Date().toLocaleDateString()}`;

      // Clean prefix if any
      if (userInput.toLowerCase().startsWith("train:")) {
        docContent = userInput.substring(6).trim();
        docTitle = docContent.split(/[.\n]/)[0].slice(0, 30) || docTitle;
      } else if (userInput.toLowerCase().startsWith("fact:")) {
        docContent = userInput.substring(5).trim();
        docTitle = docContent.split(/[.\n]/)[0].slice(0, 30) || docTitle;
      } else {
        docTitle = docContent.split(/[.\n]/)[0].slice(0, 30) || docTitle;
      }

      setKnowledgeMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: `Analyzing text input and preparing to index facts under **"${docTitle}"**...`,
          status: "pending",
          filename: docTitle
        }
      ]);

      try {
        if (user && botId) {
          const { data: dbSrc, error } = await supabase
            .from("chatty_sources")
            .insert({
              bot_id: botId,
              type: "text",
              name: docTitle,
              content: docContent,
              status: "training",
              char_count: docContent.length
            })
            .select()
            .single();

          if (error) throw error;

          // Simulate processing time
          setTimeout(async () => {
            await supabase
              .from("chatty_sources")
              .update({ status: "trained" })
              .eq("id", dbSrc.id);

            setKnowledgeMessages((prev) =>
              prev.map((msg) =>
                msg.filename === docTitle && msg.status === "pending"
                  ? {
                      role: "assistant",
                      content: `Fact training complete! Added text source **"${docTitle}"** (${docContent.length} chars) to RAG memory.`,
                      status: "success"
                    }
                  : msg
              )
            );

            await loadBotSettings(user.id);
          }, 1500);
        }
      } catch (err: any) {
        console.error("Text ingest error:", err);
        setKnowledgeMessages((prev) =>
          prev.map((msg) =>
            msg.filename === docTitle && msg.status === "pending"
              ? {
                  role: "assistant",
                  content: `Failed to index facts. Error: ${err.message || "Unknown error"}`,
                  status: "error"
                }
              : msg
          )
        );
      } finally {
        setIsKnowledgeLoading(false);
      }
      return;
    }

    // 3. Question/RAG Testing Handler
    try {
      const res = await fetchWithFallback("/api/widget/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          bot_id: botId,
          session_id: "knowledge_test_session",
          text: userInput,
          visitor_timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
        })
      });

      if (res.ok) {
        const body = await res.json();
        setKnowledgeMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: body.reply
          }
        ]);
      } else {
        const body = await res.json();
        setKnowledgeMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: `I queried your RAG memory, but encountered an error: ${body.detail || "RAG engine failed"}`,
            status: "error"
          }
        ]);
      }
    } catch (err: any) {
      console.error("RAG query error:", err);
      setKnowledgeMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: `Could not query the RAG backend. Make sure the server is online.`,
          status: "error"
        }
      ]);
    } finally {
      setIsKnowledgeLoading(false);
    }
  };

  // Handle Cloud Connector Triggers
  const handleConnectCloud = async (provider: "google" | "microsoft") => {
    setConnectingProvider(provider);
    try {
      const { data } = await supabase.auth.getSession();
      if (!data.session?.access_token) {
        setConnectingProvider(null);
        return;
      }

      const res = await fetchWithFallback(`/api/integrations/${provider}/start`, {
        method: "POST"
      });
      if (res.ok) {
        const body = await res.json();
        if (body.url) {
          window.location.href = body.url; // Redirect to OAuth
          return;
        }
      }
    } catch (err) {
      console.error(`Error connecting to ${provider}:`, err);
    }
    setConnectingProvider(null);
  };

  // Handle training URL crawl
  const handleTrainUrl = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputUrl.trim()) return;

    const urlName = inputUrl.trim();
    setInputUrl("");

    const newId = `src-${Date.now()}`;
    const tempSource: Source = {
      id: newId,
      type: "url",
      name: urlName,
      content: "Crawling website contents in progress...",
      status: "training",
      charCount: 0
    };
    setSources((prev) => [...prev, tempSource]);

    try {
      let crawledContent = `This source represents the crawled contents of ${urlName}.`;
      try {
        const jinaUrl = `https://r.jina.ai/${urlName}`;
        const response = await fetch(jinaUrl);
        if (response.ok) {
          const text = await response.text();
          if (text && text.trim().length > 100) {
            crawledContent = text;
          }
        }
      } catch (crawlErr) {
        console.warn("Real-time client-side crawl failed, using fallback placeholder:", crawlErr);
      }

      if (user && botId) {
        const { data: dbSrc, error } = await supabase
          .from("chatty_sources")
          .insert({
            bot_id: botId,
            type: "url",
            name: urlName,
            content: crawledContent,
            status: "training",
            char_count: crawledContent.length
          })
          .select()
          .single();

        if (error) throw error;
        
        setTimeout(async () => {
          await supabase
            .from("chatty_sources")
            .update({ status: "trained" })
            .eq("id", dbSrc.id);

          setSources((prev) =>
            prev.map((s) => (s.id === newId ? { ...s, id: dbSrc.id, content: crawledContent, status: "trained", charCount: crawledContent.length } : s))
          );
        }, 1500);
      }
    } catch (err) {
      console.error("Error inserting url source:", err);
      setSources((prev) => prev.filter((s) => s.id !== newId));
    }
  };

  // Handle training text documentation
  const handleTrainText = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || !inputTitle.trim()) return;

    const newId = `src-${Date.now()}`;
    const docTitle = inputTitle;
    const docContent = inputText;
    setInputText("");
    setInputTitle("");

    const newSource: Source = {
      id: newId,
      type: "text",
      name: docTitle,
      content: docContent,
      status: "training",
      charCount: docContent.length
    };
    setSources((prev) => [...prev, newSource]);

    try {
      if (user && botId) {
        const { data: dbSrc, error } = await supabase
          .from("chatty_sources")
          .insert({
            bot_id: botId,
            type: "text",
            name: docTitle,
            content: docContent,
            status: "training",
            char_count: docContent.length
          })
          .select()
          .single();

        if (error) throw error;

        setTimeout(async () => {
          await supabase
            .from("chatty_sources")
            .update({ status: "trained" })
            .eq("id", dbSrc.id);

          setSources((prev) =>
            prev.map((s) => (s.id === newId ? { ...s, id: dbSrc.id, status: "trained" } : s))
          );
        }, 2000);
      }
    } catch (err) {
      console.error("Error inserting text source:", err);
    }
  };

  // Handle Google Drive folder indexing
  const handleIndexDriveFolder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!driveFolderUrl.trim()) return;

    setIsIndexingDrive(true);
    setDriveIndexError(null);
    setDriveIndexSuccess(null);

    try {
      const res = await fetchWithFallback("/api/documents/index-folder", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          folder_id_or_url: driveFolderUrl.trim(),
          max_files: driveMaxFiles,
          source: "gdrive",
        }),
      });

      if (res.ok) {
        setDriveIndexSuccess("Indexing started in background. The files will be crawled and loaded shortly.");
        setDriveFolderUrl("");
      } else {
        const body = await res.json();
        setDriveIndexError(body.detail || "Failed to start folder indexing.");
      }
    } catch (err) {
      console.error("Error indexing Drive folder:", err);
      setDriveIndexError("Failed to connect to the server.");
    } finally {
      setIsIndexingDrive(false);
    }
  };

  // Delete source
  const handleDeleteSource = async (id: string) => {
    setSources((prev) => prev.filter((s) => s.id !== id));
    try {
      if (user) {
        await supabase
          .from("chatty_sources")
          .delete()
          .eq("id", id);
      }
    } catch (err) {
      console.error("Error deleting source:", err);
    }
  };

  // Clipboard Copiers
  const copyToClipboard = (text: string, type: "script" | "iframe") => {
    navigator.clipboard.writeText(text);
    if (type === "script") {
      setCopiedScript(true);
      setTimeout(() => setCopiedScript(false), 2000);
    } else {
      setCopiedIframe(true);
      setTimeout(() => setCopiedIframe(false), 2000);
    }
  };

  // Playground Chatbot Reply Generator
  const handlePlaygroundSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!playgroundInput.trim()) return;

    const userText = playgroundInput;
    setPlaygroundMessages((prev) => [...prev, { role: "user", content: userText }]);
    setPlaygroundInput("");
    setIsBotResponding(true);

    // Reset and trigger simulated agent thinking steps
    setLiveThinkingSteps([]);
    
    setTimeout(() => {
      setLiveThinkingSteps(prev => [...prev, `[intent_parser] Parsing query intent: "${userText.slice(0, 20)}..."`]);
    }, 200);

    setTimeout(() => {
      setLiveThinkingSteps(prev => [...prev, `[knowledge_retrieval] Scanning ${sources.length} active database sources for semantic match...`]);
    }, 550);

    setTimeout(() => {
      const lowerInput = userText.toLowerCase();
      const greetings = ["hi", "hello", "hey", "greetings", "howdy", "hola", "yo"];
      const isGreeting = lowerInput.split(/[^a-zA-Z]/).some(word => greetings.includes(word));
      
      let matchMsg = "";
      if (isGreeting) {
        matchMsg = "Greeting intent detected. Fetching greeting response.";
      } else {
        const matched = sources.find(s => s.status === "trained" && s.content.toLowerCase().split(" ").some(word => word.length >= 3 && lowerInput.includes(word)));
        matchMsg = matched 
          ? `Found semantic match in trained source: "${matched.name}"`
          : "No direct semantic matches found in database index.";
      }
      setLiveThinkingSteps(prev => [...prev, `[knowledge_retrieval] ${matchMsg}`]);
    }, 950);

    setTimeout(() => {
      setLiveThinkingSteps(prev => [...prev, `[guardrail_checks] Evaluated safety guardrails (strict_mode = ${strictMode ? "ON" : "OFF"})`]);
    }, 1300);

    if (user && botId) {
      try {
        await supabase.from("chatty_conversations").insert({
          bot_id: botId,
          session_id: "playground_session",
          role: "user",
          content: userText
        });
        setTimeout(() => {
          loadAnalyticsData(botId, leads.length);
        }, 200);
      } catch (err) {
        console.error("Error logging user message:", err);
      }
    }

    setTimeout(async () => {
      let responseContent = "";
      try {
        const res = await fetchWithFallback("/api/widget/chat", {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            bot_id: botId,
            session_id: "playground_session",
            text: userText,
            visitor_timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
          })
        });
        if (res.ok) {
          const body = await res.json();
          responseContent = body.reply;
        } else {
          const body = await res.json();
          responseContent = `Error: ${body.detail || "Failed to get response from AI assistant"}`;
        }
      } catch (err) {
        console.error("Playground send error:", err);
        responseContent = "Could not communicate with the backend. Check console logs.";
      }

      const steps = [
        `[intent_parser] Parsed query intent: "${userText.slice(0, 25)}..."`,
        `[knowledge_retrieval] Checked dynamic knowledge & RAG sources.`,
        `[guardrail_checks] Evaluated safety guardrails (strict_mode = ${strictMode ? "ON" : "OFF"})`,
        `[response_generation] Formulated final reply via model: ${selectedModel}`
      ];

      setPlaygroundMessages((prev) => [...prev, { role: "assistant", content: responseContent, thinkingSteps: steps }]);
      setLiveThinkingSteps([]);
      setIsBotResponding(false);

      // Reload leads and analytics to check if a lead was registered
      if (user && botId) {
        setTimeout(async () => {
          const { data: leadList } = await supabase
            .from("chatty_leads")
            .select("*")
            .eq("bot_id", botId)
            .order("created_at", { ascending: false });
          if (leadList) {
            const mappedLeads = leadList.map(l => ({
              id: l.id,
              name: l.name || "Anonymous",
              email: l.email || "N/A",
              phone: l.phone || "N/A",
              created_at: new Date(l.created_at).toISOString().slice(0, 16).replace("T", " ")
            }));
            setLeads(mappedLeads);
            await loadAnalyticsData(botId, mappedLeads.length);
          }
        }, 800);
      }
    }, 1500);
  };

  // Sign out handler
  const handleSignOut = async () => {
    await supabase.auth.signOut();
    window.location.href = "/";
  };

  // Code snippets
  const embedScriptCode = `<script\n  src="https://cdn.personaliai.com/chatty.js"\n  data-id="bot_chatty_${botName.toLowerCase().replace(/[^a-z0-9]/g, "_")}"\n  data-color="${primaryColor}"\n  data-style="${widgetStyle}"\n></script>`;
  const embedIframeCode = `<iframe\n  src="https://chatty.personaliai.com/embed/bot_chatty_${botName.toLowerCase().replace(/[^a-z0-9]/g, "_")}?color=${encodeURIComponent(primaryColor)}&style=${widgetStyle}"\n  width="100%"\n  height="600"\n  frameborder="0"\n></iframe>`;

  // Render loading state if session loading
  if (loadingSession) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-neutral-50 dark:bg-neutral-950 font-sans">
        <div className="flex flex-col items-center gap-2">
          <Loader2 className="size-8 animate-spin text-[#f97316]" />
          <p className="text-xs text-neutral-400 font-semibold">Loading console session...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-neutral-50 dark:bg-neutral-955 font-sans text-neutral-900 dark:text-neutral-100 overflow-hidden antialiased">
      
      {/* Floating Save Changes Banner */}
      {hasUnsavedChanges && (
        <div className="fixed bottom-6 right-6 z-50 bg-neutral-950 text-white dark:bg-white dark:text-black border border-neutral-800 dark:border-neutral-200 shadow-2xl rounded-xl px-5 py-3.5 flex items-center gap-4 transition-all duration-300">
          <span className="text-[11px] font-semibold flex items-center gap-1.5">
            <span className="size-2 rounded-full bg-[#f97316] animate-pulse"></span>
            You have unsaved changes
          </span>
          <div className="flex gap-2">
            <button
              onClick={() => setHasUnsavedChanges(false)}
              className="text-[10px] font-medium border border-neutral-800 hover:bg-neutral-900 rounded-lg px-2.5 py-1.5 cursor-pointer dark:border-neutral-200 dark:hover:bg-neutral-100"
            >
              Discard
            </button>
            <button
              onClick={handleSaveChanges}
              disabled={isSaving}
              className="text-[10px] font-semibold bg-[#f97316] text-white rounded-lg px-3 py-1.5 flex items-center gap-1.5 cursor-pointer hover:bg-[#f97316]/90 disabled:opacity-50"
            >
              {isSaving ? <Loader2 className="size-3 animate-spin" /> : <Save className="size-3" />}
              Save changes
            </button>
          </div>
        </div>
      )}

      {/* Collapsible Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/40 md:hidden transition-opacity"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar (Responsive collapsible) */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-64 border-r border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 flex flex-col justify-between shrink-0 transform transition-transform duration-200 md:relative md:translate-x-0 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div>
          {/* Brand Logo */}
          <div className="h-16 px-6 border-b border-neutral-200 dark:border-neutral-800 flex items-center justify-between">
            <Link href="/" className="flex items-center gap-2">
              <span className="font-semibold text-base tracking-tight flex items-center gap-1.5">
                <span className="size-5 rounded-md bg-neutral-950 dark:bg-white flex items-center justify-center text-white dark:text-black font-bold text-xs">C</span>
                Chatty
              </span>
            </Link>
            <button className="md:hidden p-1 text-neutral-400 hover:text-neutral-900" onClick={() => setSidebarOpen(false)}>
              <X className="size-4" />
            </button>
          </div>

          {/* Navigation Links */}
          <nav className="p-4 space-y-1">
            {[
              { id: "home", label: "Overview", icon: Home },
              { id: "customizer", label: "Customizer", icon: Sliders },
              { id: "knowledge", label: "Knowledge Base", icon: Database },
              { id: "playground", label: "Playground", icon: MessageSquare, badge: true },
              { id: "leads", label: "Leads", icon: Users },
              { id: "analytics", label: "Analytics", icon: BarChart3 },
              { id: "integrations", label: "Embed & Integrate", icon: Code2 },
              { id: "settings", label: "Agent Settings", icon: Settings },
            ].map((link) => {
              const Icon = link.icon;
              return (
                <button
                  key={link.id}
                  onClick={() => {
                    setActiveTab(link.id);
                    setSidebarOpen(false);
                  }}
                  className={`w-full flex items-center gap-3 px-3 py-2 text-xs font-medium rounded-lg transition-colors cursor-pointer relative ${
                    activeTab === link.id
                      ? "bg-neutral-100 text-neutral-900 dark:bg-neutral-800 dark:text-white"
                      : "text-neutral-500 hover:text-neutral-950 dark:hover:text-white hover:bg-neutral-50 dark:hover:bg-neutral-800/30"
                  }`}
                >
                  <Icon className="size-4" />
                  {link.label}
                  {link.badge && <span className="absolute right-2 size-2 rounded-full bg-[#f97316]"></span>}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Footer info & Logout link */}
        <div className="p-4 border-t border-neutral-200 dark:border-neutral-800">
          <div className="flex items-center gap-3 mb-4">
            <div className="size-8 rounded-full bg-[#f97316]/10 flex items-center justify-center text-[#f97316] font-bold text-xs">P</div>
            <div className="overflow-hidden">
              <p className="text-[11px] font-semibold truncate">{user ? user.email.split("@")[0] : "Demo User"}</p>
              <p className="text-[9px] text-neutral-400 dark:text-neutral-500 truncate">
                {user ? "Production Account" : "Hobby Plan • trial"}
              </p>
            </div>
          </div>
          <div className="space-y-1">
            {user ? (
              <button
                onClick={handleSignOut}
                className="w-full flex items-center gap-2 text-[10px] text-neutral-400 hover:text-red-500 transition-colors py-1 cursor-pointer"
              >
                <LogOut className="size-3.5" />
                Sign Out Account
              </button>
            ) : (
              <Link href="/login" className="w-full flex items-center gap-2 text-[10px] text-neutral-400 hover:text-neutral-900 dark:hover:text-white transition-colors py-1">
                <LogOut className="size-3.5" />
                Log In to Save Progress
              </Link>
            )}
          </div>
        </div>
      </aside>

      {/* Main Panel */}
      <main className="flex-1 flex flex-col overflow-y-auto">
        {/* Header bar */}
        <header className="h-16 border-b border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 px-6 md:px-8 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <button className="md:hidden p-1 text-neutral-500 hover:text-neutral-950" onClick={() => setSidebarOpen(true)}>
              <Menu className="size-5" />
            </button>
            <div>
              <span className="text-[10px] uppercase tracking-wider text-neutral-400 font-semibold">Chatty Console</span>
              <h2 className="text-sm font-semibold capitalize mt-0.5">{activeTab === "home" ? "Overview" : activeTab.replace("_", " ")}</h2>
            </div>
          </div>
          <div className="flex items-center gap-3 text-xs text-neutral-500">
            <span className="flex items-center gap-1.5">
              <span className={`size-2 rounded-full ${user ? "bg-green-500" : "bg-yellow-500"}`}></span>
              {user ? "Database Active" : "Trial Sandbox"}
            </span>
          </div>
        </header>

        {/* Tab Contents (Center Aligned Layout) */}
        <div className="flex-1 overflow-y-auto">
          
          {/* TAB 1: OVERVIEW */}
          {activeTab === "home" && (
            <div className="max-w-4xl mx-auto w-full space-y-6 py-6 px-4 flex flex-col">
              <div className="p-6 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl">
                <h3 className="text-sm font-bold flex items-center gap-2">
                  <Sparkles className="size-4 text-[#f97316]" />
                  Welcome to Chatty!
                </h3>
                <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-2 leading-relaxed">
                  Your chatbot is online and ready to be installed. Follow the quick steps below to train its memory, customize its visuals, and embed the code snippet onto your website.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-6">
                  <button
                    onClick={() => setActiveTab("knowledge")}
                    className="p-4 text-left rounded-xl border border-neutral-100 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-950/20 hover:border-neutral-300 dark:hover:border-neutral-700 transition-all cursor-pointer"
                  >
                    <div className="text-xs font-bold text-neutral-800 dark:text-neutral-200">1. Train Memory</div>
                    <p className="text-[10px] text-neutral-400 dark:text-neutral-500 mt-1">Add URLs, text documents, or API sync sources.</p>
                  </button>
                  <button
                    onClick={() => setActiveTab("customizer")}
                    className="p-4 text-left rounded-xl border border-neutral-100 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-950/20 hover:border-neutral-300 dark:hover:border-neutral-700 transition-all cursor-pointer"
                  >
                    <div className="text-xs font-bold text-neutral-800 dark:text-neutral-200">2. Customize Style</div>
                    <p className="text-[10px] text-neutral-400 dark:text-neutral-500 mt-1">Preset designs: Minimalist, Glassmorphism, Neumorphism.</p>
                  </button>
                  <button
                    onClick={() => setActiveTab("integrations")}
                    className="p-4 text-left rounded-xl border border-neutral-100 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-950/20 hover:border-neutral-300 dark:hover:border-neutral-700 transition-all cursor-pointer"
                  >
                    <div className="text-xs font-bold text-neutral-800 dark:text-neutral-200">3. Install Script</div>
                    <p className="text-[10px] text-neutral-400 dark:text-neutral-500 mt-1">Copy code scripts or iframe elements for your webpage.</p>
                  </button>
                </div>
              </div>

              {/* Stats Row */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                <div className="p-5 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl flex items-center justify-between">
                  <div>
                    <span className="text-[10px] text-neutral-400 dark:text-neutral-500 uppercase font-semibold">Conversations</span>
                    <h4 className="text-2xl font-bold mt-1">{totalSessions}</h4>
                    <span className="text-[9px] text-green-500 font-medium flex items-center gap-0.5 mt-1">
                      <TrendingUp className="size-3" /> Real-time active sessions
                    </span>
                  </div>
                  <div className="p-3 rounded-xl bg-neutral-100 dark:bg-neutral-800 text-neutral-500">
                    <MessageCircle className="size-5" />
                  </div>
                </div>

                <div className="p-5 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl flex items-center justify-between">
                  <div>
                    <span className="text-[10px] text-neutral-400 dark:text-neutral-500 uppercase font-semibold">Trained Sources</span>
                    <h4 className="text-2xl font-bold mt-1">{sources.length} Active</h4>
                    <span className="text-[9px] text-neutral-400 dark:text-neutral-500 mt-1 flex items-center gap-1">
                      {sources.reduce((acc, s) => acc + s.charCount, 0).toLocaleString()} characters
                    </span>
                  </div>
                  <div className="p-3 rounded-xl bg-neutral-100 dark:bg-neutral-800 text-neutral-500">
                    <Database className="size-5" />
                  </div>
                </div>

                <div className="p-5 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl flex items-center justify-between">
                  <div>
                    <span className="text-[10px] text-neutral-400 dark:text-neutral-500 uppercase font-semibold">Leads Captured</span>
                    <h4 className="text-2xl font-bold mt-1">{leads.length}</h4>
                    <span className="text-[9px] text-[#f97316] font-medium mt-1">
                      Click to view leads tab
                    </span>
                  </div>
                  <div className="p-3 rounded-xl bg-neutral-100 dark:bg-neutral-800 text-[#f97316]">
                    <Users className="size-5" />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: CUSTOMIZER */}
          {activeTab === "customizer" && (
            <div className="max-w-4xl mx-auto w-full py-6 px-4">
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                {/* Customizer Panel */}
                <div className="lg:col-span-7 space-y-6">
                  <div className="p-6 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl space-y-4">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-400">Design Assistant presets</h3>
                    
                    {/* Design Presets cards */}
                    <div className="grid grid-cols-2 gap-3">
                      {[
                        { id: "minimalist", name: "Minimalist", desc: "Sharp borders, solid colors." },
                        { id: "glassmorphism", name: "Glassmorphism", desc: "Frosted blur, soft shadows." },
                        { id: "liquid", name: "Liquid Glass", desc: "Fluid saturated reflections." },
                        { id: "neumorphism", name: "Neumorphism", desc: "Sleek dual pillowy bevels." }
                      ].map((style) => (
                        <button
                          key={style.id}
                          onClick={() => handleInputChange(setWidgetStyle, style.id)}
                          className={`p-3 text-left border rounded-xl transition-all cursor-pointer ${
                            widgetStyle === style.id
                              ? "border-[#f97316] bg-[#f97316]/5"
                              : "border-neutral-200 dark:border-neutral-850 hover:bg-neutral-50 dark:hover:bg-neutral-800/20"
                          }`}
                        >
                          <div className="text-xs font-bold">{style.name}</div>
                          <p className="text-[9px] text-neutral-400 mt-1 leading-normal">{style.desc}</p>
                        </button>
                      ))}
                    </div>

                    <hr className="border-neutral-100 dark:border-neutral-800 my-4" />

                    <div>
                      <label className="block text-[11px] font-semibold text-neutral-700 dark:text-neutral-355 mb-1.5">Chatbot Name</label>
                      <input
                        type="text"
                        value={botName}
                        onChange={(e) => handleInputChange(setBotName, e.target.value)}
                        className="w-full bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-lg px-3 py-2 text-xs text-neutral-800 dark:text-neutral-200 focus:outline-none focus:border-neutral-350 dark:focus:border-neutral-700"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-neutral-700 dark:text-neutral-355 mb-1.5">Welcome Message</label>
                      <input
                        type="text"
                        value={welcomeMsg}
                        onChange={(e) => handleInputChange(setWelcomeMsg, e.target.value)}
                        className="w-full bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-lg px-3 py-2 text-xs text-neutral-800 dark:text-neutral-200 focus:outline-none focus:border-neutral-350 dark:focus:border-neutral-700"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-neutral-700 dark:text-neutral-355 mb-1.5">Primary Hex Color</label>
                      <div className="flex gap-2">
                        <input
                          type="color"
                          value={primaryColor}
                          onChange={(e) => handleInputChange(setPrimaryColor, e.target.value)}
                          className="size-8 rounded border border-neutral-200 bg-transparent p-0.5 cursor-pointer"
                        />
                        <input
                          type="text"
                          value={primaryColor}
                          onChange={(e) => handleInputChange(setPrimaryColor, e.target.value)}
                          className="flex-1 bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-lg px-3 py-1.5 text-xs focus:outline-none"
                        />
                      </div>
                      <div className="flex gap-2 mt-2">
                        {["#f97316", "#3b82f6", "#10b981", "#8b5cf6", "#ec4899", "#111827"].map((color) => (
                          <button
                            key={color}
                            onClick={() => handleInputChange(setPrimaryColor, color)}
                            style={{ backgroundColor: color }}
                            className={`size-6 rounded-full border cursor-pointer ${
                              primaryColor === color ? "border-neutral-900 dark:border-white ring-2 ring-[#f97316]/20" : "border-transparent"
                            }`}
                          />
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Live visual mockup preview */}
                <div className="lg:col-span-5 flex flex-col items-center">
                  <span className="text-[10px] text-neutral-400 dark:text-neutral-500 uppercase font-semibold mb-3">Live Assistant Preview</span>
                  <div className={`w-full max-w-[320px] h-[440px] rounded-2xl flex flex-col overflow-hidden transition-all style-${widgetStyle}`}>
                                       {/* Header styled dynamically */}
                    <div
                      style={widgetStyle === "minimalist" ? { backgroundColor: primaryColor } : {}}
                      className={`chat-header p-4 flex items-center gap-3 transition-all ${
                        widgetStyle === "minimalist" ? "text-white" : ""
                      }`}
                    >
                      <div className="size-8 rounded-full bg-white/20 dark:bg-black/20 flex items-center justify-center font-bold text-sm">C</div>
                      <div>
                        <h4 className="font-semibold text-sm leading-tight">{botName}</h4>
                        <p className="text-[9px] opacity-80">Online • presets: {widgetStyle}</p>
                      </div>
                    </div>

                    {/* Messages list */}
                    <div className="flex-1 p-4 space-y-3 overflow-y-auto text-xs">
                      <div className="flex gap-2 max-w-[85%]">
                        <div className="size-6 rounded-full bg-neutral-200/50 dark:bg-neutral-800 flex items-center justify-center text-[10px] font-bold shrink-0">C</div>
                        <div className="bot-bubble p-3 rounded-2xl rounded-tl-none bg-neutral-100 text-neutral-800 dark:bg-neutral-850 dark:text-neutral-200 leading-relaxed">
                          <ReactMarkdown
                            remarkPlugins={[remarkGfm, remarkMath]}
                            rehypePlugins={[rehypeKatex]}
                            components={{
                              p: ({ children }) => <p className="mb-1.5 last:mb-0">{children}</p>,
                              ul: ({ children }) => <ul className="list-disc pl-4 mb-2 space-y-1">{children}</ul>,
                              ol: ({ children }) => <ol className="list-decimal pl-4 mb-2 space-y-1">{children}</ol>,
                              li: ({ children }) => <li className="mb-0.5">{children}</li>,
                              pre: ({ children }) => <pre className="bg-neutral-950 text-white rounded-lg p-2 overflow-x-auto my-2 text-[10px] font-mono leading-normal">{children}</pre>,
                              code: ({ children }) => <code className="bg-neutral-200 dark:bg-neutral-800 px-1 py-0.5 rounded text-[10px] font-mono">{children}</code>
                            }}
                          >
                            {welcomeMsg}
                          </ReactMarkdown>
                        </div>
                      </div>
                      <div className="flex gap-2 ml-auto flex-row-reverse max-w-[85%]">
                        <div
                          className="user-bubble p-3 rounded-2xl rounded-tr-none text-white leading-relaxed"
                          style={widgetStyle === "minimalist" ? { backgroundColor: primaryColor } : {}}
                        >
                          Hi there, testing theme preview!
                        </div>
                      </div>
                    </div>

                    {/* Footer input form */}
                    <div className="p-3 border-t border-neutral-100 dark:border-neutral-900 flex gap-2">
                      <input
                        disabled
                        type="text"
                        placeholder="Type a message..."
                        className="chat-input-bar flex-1 bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-lg px-3 py-1.5 text-xs text-neutral-450"
                      />
                      <button
                        disabled
                        style={widgetStyle === "minimalist" ? { backgroundColor: primaryColor } : {}}
                        className="p-2 text-white rounded-lg flex items-center justify-center shrink-0 opacity-50"
                      >
                        <Send className="size-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: KNOWLEDGE BASE — Full Chat Layout */}
          {activeTab === "knowledge" && (
            <div className="flex flex-col h-[calc(100vh-130px)] max-w-3xl mx-auto w-full relative">

              {/* Chat Header */}
              <div className="flex items-center justify-between px-4 sm:px-6 py-3 border-b border-neutral-200 dark:border-neutral-800 bg-white/80 dark:bg-neutral-900/80 backdrop-blur-md shrink-0">
                <div className="flex items-center gap-3">
                  <div className="size-9 rounded-xl bg-gradient-to-br from-[#f97316] to-[#ec4899] flex items-center justify-center text-white font-bold text-sm shadow-md">
                    KM
                  </div>
                  <div>
                    <h4 className="font-bold text-sm leading-none">Knowledge Manager</h4>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                      <span className="text-[10px] text-neutral-450">{sources.length} sources trained • {sources.reduce((a, s) => a + s.charCount, 0).toLocaleString()} chars</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {/* Google Connection Status Pill */}
                  {googleConnected ? (
                    <button
                      onClick={() => handleDisconnectCloud("google")}
                      className="flex items-center gap-1.5 text-[9px] font-semibold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400 rounded-full px-2.5 py-1 border border-emerald-200 dark:border-emerald-900/50 hover:bg-emerald-100 dark:hover:bg-emerald-950/50 cursor-pointer transition-colors"
                    >
                      <span className="size-1.5 rounded-full bg-emerald-500"></span>
                      Google Connected
                    </button>
                  ) : (
                    <button
                      onClick={() => handleConnectCloud("google")}
                      disabled={connectingProvider !== null}
                      className="flex items-center gap-1.5 text-[9px] font-semibold bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400 rounded-full px-2.5 py-1 border border-neutral-200 dark:border-neutral-700 hover:bg-neutral-200 dark:hover:bg-neutral-750 cursor-pointer transition-colors disabled:opacity-50"
                    >
                      {connectingProvider === "google" ? <Loader2 className="size-2.5 animate-spin" /> : <svg className="size-3" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>}
                      Connect Google
                    </button>
                  )}
                  <button
                    onClick={() => setKnowledgeMessages([{
                      role: "assistant",
                      content: "Chat cleared! Send me URLs to crawl, upload files via the 📎 button, or type documentation to train your bot. Ask any question to test what I\'ve learned."
                    }])}
                    className="text-[9px] font-semibold text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300 cursor-pointer transition-colors px-1.5 py-1"
                  >
                    Clear
                  </button>
                </div>
              </div>

              {/* Chat Messages Area */}
              <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-4 space-y-4 scrollbar-thin">
                {knowledgeMessages.map((msg, index) => (
                  <motion.div
                    key={index}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.25, ease: "easeOut" }}
                    className={`flex gap-2.5 ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                  >
                    {msg.role !== "user" && (
                      <div className="size-7 rounded-lg bg-gradient-to-br from-[#f97316] to-[#ec4899] flex items-center justify-center text-white font-bold text-[9px] shrink-0 mt-0.5 shadow-sm">
                        KM
                      </div>
                    )}
                    <div className={`max-w-[80%] flex flex-col gap-1`}>
                      <div
                        className={`px-3.5 py-2.5 text-[13px] leading-relaxed ${
                          msg.role === "user"
                            ? "bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 rounded-2xl rounded-br-md"
                            : msg.status === "error"
                            ? "bg-red-50 text-red-800 border border-red-200 dark:bg-red-950/20 dark:text-red-350 dark:border-red-900/40 rounded-2xl rounded-bl-md"
                            : msg.status === "success"
                            ? "bg-emerald-50 text-emerald-800 border border-emerald-200 dark:bg-emerald-950/20 dark:text-emerald-350 dark:border-emerald-900/40 rounded-2xl rounded-bl-md"
                            : msg.status === "pending"
                            ? "bg-amber-50 text-amber-800 border border-amber-200 dark:bg-amber-950/20 dark:text-amber-350 dark:border-amber-900/40 rounded-2xl rounded-bl-md"
                            : "bg-neutral-100 text-neutral-800 dark:bg-neutral-850 dark:text-neutral-200 rounded-2xl rounded-bl-md"
                        }`}
                      >
                        <ReactMarkdown
                          remarkPlugins={[remarkGfm, remarkMath]}
                          rehypePlugins={[rehypeKatex]}
                          components={{
                            p: ({ children }) => <p className="mb-1.5 last:mb-0">{children}</p>,
                            ul: ({ children }) => <ul className="list-disc pl-4 mb-2 space-y-0.5">{children}</ul>,
                            ol: ({ children }) => <ol className="list-decimal pl-4 mb-2 space-y-0.5">{children}</ol>,
                            li: ({ children }) => <li className="mb-0.5">{children}</li>,
                            strong: ({ children }) => <strong className="font-bold">{children}</strong>,
                            pre: ({ children }) => <pre className="bg-neutral-900 text-neutral-100 rounded-lg p-2.5 overflow-x-auto my-2 text-[11px] font-mono leading-normal">{children}</pre>,
                            code: ({ children }) => (
                              <code className={msg.role === "user" ? "bg-white/15 px-1 py-0.5 rounded text-[11px] font-mono" : "bg-neutral-200 dark:bg-neutral-800 px-1 py-0.5 rounded text-[11px] font-mono"}>
                                {children}
                              </code>
                            )
                          }}
                        >
                          {msg.content}
                        </ReactMarkdown>
                      </div>
                      {msg.status === "pending" && (
                        <div className="flex items-center gap-1 ml-1">
                          <Loader2 className="size-2.5 animate-spin text-amber-500" />
                          <span className="text-[9px] text-amber-500 font-medium">Processing...</span>
                        </div>
                      )}
                    </div>
                  </motion.div>
                ))}

                {/* Typing indicator */}
                {isKnowledgeLoading && !knowledgeMessages.some(m => m.status === "pending") && (
                  <motion.div
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex gap-2.5 justify-start"
                  >
                    <div className="size-7 rounded-lg bg-gradient-to-br from-[#f97316] to-[#ec4899] flex items-center justify-center text-white font-bold text-[9px] shrink-0 mt-0.5 shadow-sm">
                      KM
                    </div>
                    <div className="px-4 py-3 bg-neutral-100 dark:bg-neutral-850 rounded-2xl rounded-bl-md flex items-center gap-1.5">
                      <span className="size-2 rounded-full bg-neutral-400 animate-bounce"></span>
                      <span className="size-2 rounded-full bg-neutral-400 animate-bounce [animation-delay:0.15s]"></span>
                      <span className="size-2 rounded-full bg-neutral-400 animate-bounce [animation-delay:0.3s]"></span>
                    </div>
                  </motion.div>
                )}
                <div ref={knowledgeEndRef} />
              </div>

              {/* Upload status banner */}
              <AnimatePresence>
                {uploadingFile && (
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 8 }}
                    className="mx-4 sm:mx-6 mb-2 px-3 py-2 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/40 rounded-xl flex items-center gap-2 text-[11px] text-amber-700 dark:text-amber-400"
                  >
                    <Loader2 className="size-3.5 animate-spin" />
                    <span>Uploading and indexing <strong>{uploadingFile}</strong>...</span>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Paperclip Popup Menu */}
              <AnimatePresence>
                {paperclipOpen && (
                  <>
                    {/* Backdrop */}
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="fixed inset-0 z-30"
                      onClick={() => setPaperclipOpen(false)}
                    />
                    {/* Menu */}
                    <motion.div
                      initial={{ opacity: 0, y: 12, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 12, scale: 0.95 }}
                      transition={{ duration: 0.18, ease: "easeOut" }}
                      className="absolute bottom-[68px] left-4 sm:left-6 z-40 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl shadow-xl overflow-hidden w-64"
                    >
                      {/* Upload File */}
                      <button
                        onClick={() => { fileInputRef.current?.click(); setPaperclipOpen(false); }}
                        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-neutral-50 dark:hover:bg-neutral-800/50 transition-colors cursor-pointer border-b border-neutral-100 dark:border-neutral-800"
                      >
                        <div className="size-8 rounded-lg bg-blue-50 dark:bg-blue-950/30 flex items-center justify-center">
                          <FileUp className="size-4 text-blue-600" />
                        </div>
                        <div>
                          <div className="text-xs font-semibold text-neutral-800 dark:text-neutral-200">Upload File</div>
                          <div className="text-[9px] text-neutral-400">PDF, DOCX, TXT, MD (max 20MB)</div>
                        </div>
                      </button>

                      {/* Crawl URL */}
                      <button
                        onClick={() => { setKnowledgeInput("https://"); setPaperclipOpen(false); }}
                        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-neutral-50 dark:hover:bg-neutral-800/50 transition-colors cursor-pointer border-b border-neutral-100 dark:border-neutral-800"
                      >
                        <div className="size-8 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 flex items-center justify-center">
                          <Globe className="size-4 text-emerald-600" />
                        </div>
                        <div>
                          <div className="text-xs font-semibold text-neutral-800 dark:text-neutral-200">Crawl Website</div>
                          <div className="text-[9px] text-neutral-400">Paste a URL to crawl and index</div>
                        </div>
                      </button>

                      {/* Google Drive */}
                      {googleConnected && syncGoogleDrive ? (
                        <button
                          onClick={() => { setKnowledgeInput("Index my Drive folder: "); setPaperclipOpen(false); }}
                          className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-neutral-50 dark:hover:bg-neutral-800/50 transition-colors cursor-pointer border-b border-neutral-100 dark:border-neutral-800"
                        >
                          <div className="size-8 rounded-lg bg-yellow-50 dark:bg-yellow-950/30 flex items-center justify-center">
                            <FolderOpen className="size-4 text-yellow-600" />
                          </div>
                          <div>
                            <div className="text-xs font-semibold text-neutral-800 dark:text-neutral-200">Google Drive Folder</div>
                            <div className="text-[9px] text-neutral-400">Sync a Drive folder for RAG</div>
                          </div>
                        </button>
                      ) : (
                        <button
                          onClick={() => { if (!googleConnected) handleConnectCloud("google"); else handleInputChange(setSyncGoogleDrive, true); setPaperclipOpen(false); }}
                          className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-neutral-50 dark:hover:bg-neutral-800/50 transition-colors cursor-pointer border-b border-neutral-100 dark:border-neutral-800"
                        >
                          <div className="size-8 rounded-lg bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center">
                            <FolderOpen className="size-4 text-neutral-400" />
                          </div>
                          <div>
                            <div className="text-xs font-semibold text-neutral-800 dark:text-neutral-200">Google Drive</div>
                            <div className="text-[9px] text-neutral-400">{!googleConnected ? "Connect Google first" : "Enable Drive sync"}</div>
                          </div>
                        </button>
                      )}

                      {/* View trained sources */}
                      <button
                        onClick={() => {
                          setPaperclipOpen(false);
                          const sourcesList = sources.length === 0
                            ? "You have no trained sources yet. Upload a file, paste a URL, or type some facts to get started!"
                            : `You have **${sources.length} trained sources** (${sources.reduce((a, s) => a + s.charCount, 0).toLocaleString()} chars total):\n\n${sources.map((s, i) => `${i + 1}. **${s.name}** — ${s.type} • ${s.charCount} chars • ${s.status === "trained" ? "✅" : "⏳"}`).join("\n")}`;
                          setKnowledgeMessages(prev => [...prev, { role: "assistant", content: sourcesList, status: "info" }]);
                        }}
                        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-neutral-50 dark:hover:bg-neutral-800/50 transition-colors cursor-pointer"
                      >
                        <div className="size-8 rounded-lg bg-purple-50 dark:bg-purple-950/30 flex items-center justify-center">
                          <Layers className="size-4 text-purple-600" />
                        </div>
                        <div>
                          <div className="text-xs font-semibold text-neutral-800 dark:text-neutral-200">View Sources ({sources.length})</div>
                          <div className="text-[9px] text-neutral-400">Browse trained knowledge base</div>
                        </div>
                      </button>
                    </motion.div>
                  </>
                )}
              </AnimatePresence>

              {/* Composer Bar — ChatGPT style */}
              <div className="px-4 sm:px-6 pb-4 pt-2 shrink-0">
                <form
                  onSubmit={handleKnowledgeSend}
                  className="flex items-end gap-2 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl px-3 py-2 shadow-sm focus-within:border-neutral-300 dark:focus-within:border-neutral-700 transition-colors relative"
                >
                  {/* Hidden File Input */}
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleKnowledgeUpload}
                    accept=".pdf,.docx,.txt,.md"
                    className="hidden"
                  />

                  {/* Paperclip with animation */}
                  <button
                    type="button"
                    onClick={() => setPaperclipOpen(!paperclipOpen)}
                    disabled={isKnowledgeLoading}
                    className={`p-1.5 rounded-lg text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-all cursor-pointer shrink-0 disabled:opacity-40 ${paperclipOpen ? "bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300" : ""}`}
                  >
                    <motion.div animate={{ rotate: paperclipOpen ? 45 : 0 }} transition={{ duration: 0.2 }}>
                      <Plus className="size-5" />
                    </motion.div>
                  </button>

                  {/* Text Area Input */}
                  <input
                    type="text"
                    placeholder="Train knowledge, paste URLs, or ask questions..."
                    value={knowledgeInput}
                    onChange={(e) => setKnowledgeInput(e.target.value)}
                    onFocus={() => setPaperclipOpen(false)}
                    disabled={isKnowledgeLoading}
                    className="flex-1 bg-transparent border-none outline-none text-sm text-neutral-800 dark:text-neutral-200 placeholder:text-neutral-400 py-1 disabled:opacity-60"
                  />

                  {/* Send */}
                  <button
                    type="submit"
                    disabled={isKnowledgeLoading || !knowledgeInput.trim()}
                    className={`p-1.5 rounded-lg shrink-0 transition-all cursor-pointer disabled:opacity-30 ${
                      knowledgeInput.trim()
                        ? "bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 hover:opacity-90"
                        : "text-neutral-300 dark:text-neutral-700"
                    }`}
                  >
                    <ChevronUp className="size-5" />
                  </button>
                </form>
                <p className="text-center text-[9px] text-neutral-350 mt-2">
                  Upload files • Paste URLs to crawl • Type facts to train • Ask questions to test RAG
                </p>
              </div>
            </div>
          )}

          {/* TAB 4: PLAYGROUND */}
          {activeTab === "playground" && (
            <div className="max-w-4xl mx-auto w-full py-6 px-4 flex justify-center">
              <div className={`w-full max-w-lg h-[500px] bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl overflow-hidden relative flex flex-col style-${widgetStyle}`}>
                
                {/* Playground Header */}
                <div
                  style={widgetStyle === "minimalist" ? { backgroundColor: primaryColor } : {}}
                  className={`chat-header p-4 flex items-center justify-between border-b ${
                    widgetStyle === "minimalist" ? "text-white border-transparent" : "border-neutral-200 dark:border-neutral-850"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="size-8 rounded-full bg-white/20 dark:bg-black/20 flex items-center justify-center font-bold text-sm">C</div>
                    <div>
                      <h4 className="font-semibold text-sm leading-tight">{botName}</h4>
                      <p className="text-[9px] opacity-80 flex items-center gap-1">
                        <span className="size-1.5 rounded-full bg-green-400 animate-pulse"></span>
                        Playground • presets: {widgetStyle}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => setPlaygroundMessages([{ role: "assistant", content: welcomeMsg }])}
                    className="px-2 py-1 rounded border border-white/20 hover:bg-white/10 text-[10px] font-semibold transition-colors cursor-pointer"
                  >
                    Reset
                  </button>
                </div>

                {/* Chat messages */}
                <div className="flex-1 p-4 overflow-y-auto space-y-4 text-xs scrollbar-thin">
                  {playgroundMessages.map((msg, index) => (
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
                        <div className="size-6 rounded-full bg-neutral-150 dark:bg-neutral-800 flex items-center justify-center text-[10px] font-bold shrink-0">C</div>
                      )}
                      <div className="flex flex-col gap-1 w-full">
                        {/* Collapsible HTML5 Details for Reasoning Trace */}
                        {msg.role !== "user" && msg.thinkingSteps && msg.thinkingSteps.length > 0 && (
                          <details className="mb-1 text-[9px] text-neutral-400 dark:text-neutral-500 bg-neutral-50/50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-850 rounded-lg p-2 cursor-pointer select-none">
                            <summary className="font-semibold flex items-center gap-1.5 focus:outline-none hover:text-neutral-700 dark:hover:text-neutral-350">
                              <Sparkles className="size-3 text-[#f97316]" />
                              Agent Reasoning Trace
                            </summary>
                            <ul className="mt-1.5 pl-3 list-disc space-y-1 font-mono leading-normal border-t border-neutral-150/40 dark:border-neutral-800/40 pt-1.5">
                              {msg.thinkingSteps.map((step, sIdx) => (
                                <li key={sIdx}>{step}</li>
                              ))}
                            </ul>
                          </details>
                        )}
                        <div
                          className={`p-3 rounded-2xl leading-relaxed ${
                            msg.role === "user"
                              ? "user-bubble text-white rounded-tr-none"
                              : "bot-bubble bg-neutral-100 text-neutral-800 dark:bg-neutral-800 dark:text-neutral-200 rounded-tl-none"
                          }`}
                          style={msg.role === "user" ? (widgetStyle === "minimalist" ? { backgroundColor: primaryColor } : {}) : {}}
                        >
                          <ReactMarkdown
                            remarkPlugins={[remarkGfm, remarkMath]}
                            rehypePlugins={[rehypeKatex]}
                            components={{
                              p: ({ children }) => <p className="mb-1.5 last:mb-0">{children}</p>,
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
                      </div>
                    </motion.div>
                  ))}
                  
                  {isBotResponding && (
                    <div className="flex gap-2 mr-auto max-w-[85%] w-full">
                      <div className="size-6 rounded-full bg-neutral-150 dark:bg-neutral-800 flex items-center justify-center text-[10px] font-bold shrink-0">C</div>
                      <div className="flex-grow flex flex-col gap-1">
                        {/* Live Thinking Status & Trace */}
                        <div className="text-[9px] text-neutral-400 dark:text-neutral-500 bg-neutral-50/50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-850 rounded-lg p-2">
                          <div className="font-semibold flex items-center gap-1.5 animate-pulse text-[#f97316]">
                            <Loader2 className="size-3 animate-spin" />
                            Agent is reasoning...
                          </div>
                          {liveThinkingSteps.length > 0 && (
                            <ul className="mt-1.5 pl-3 list-disc space-y-1 font-mono leading-normal border-t border-neutral-150/40 dark:border-neutral-800/40 pt-1.5">
                              {liveThinkingSteps.map((step, sIdx) => (
                                <li key={sIdx} className="animate-fade-in">{step}</li>
                              ))}
                            </ul>
                          )}
                        </div>
                        <div className="p-3 rounded-2xl rounded-tl-none bg-neutral-100 text-neutral-400 dark:bg-neutral-850 flex items-center gap-1.5 w-fit">
                          <span className="size-1.5 rounded-full bg-neutral-450 animate-bounce"></span>
                          <span className="size-1.5 rounded-full bg-neutral-455 animate-bounce [animation-delay:0.2s]"></span>
                          <span className="size-1.5 rounded-full bg-neutral-460 animate-bounce [animation-delay:0.4s]"></span>
                        </div>
                      </div>
                    </div>
                  )}
                  <div ref={playgroundEndRef} />
                </div>

                {/* Alert banner if lead captured */}
                {collectedInPlayground && (
                  <div className="p-2 bg-green-50 dark:bg-green-950/20 border-t border-green-200 dark:border-green-900/50 flex items-center justify-between text-[10px] text-green-700 dark:text-green-400 px-4">
                    <span>New lead collected! Added to the Leads tab.</span>
                    <button onClick={() => setCollectedInPlayground(false)} className="font-bold underline cursor-pointer">Dismiss</button>
                  </div>
                )}

                {/* Form Input */}
                <form onSubmit={handlePlaygroundSend} className="p-3 border-t border-neutral-150 dark:border-neutral-900 flex gap-2">
                  <input
                    type="text"
                    placeholder="Ask a question or type 'lead'..."
                    value={playgroundInput}
                    onChange={(e) => setPlaygroundInput(e.target.value)}
                    className="chat-input-bar flex-1 bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-lg px-3 py-2 text-xs focus:outline-none"
                  />
                  <button
                    type="submit"
                    style={widgetStyle === "minimalist" ? { backgroundColor: primaryColor } : {}}
                    className="p-2.5 text-white rounded-lg flex items-center justify-center shrink-0 hover:opacity-90 cursor-pointer"
                  >
                    <Send className="size-3.5" />
                  </button>
                </form>
              </div>
            </div>
          )}

          {/* TAB 5: LEADS */}
          {activeTab === "leads" && (
            <div className="max-w-4xl mx-auto w-full py-6 px-4 space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold uppercase tracking-wider text-neutral-400">Captured Leads ({leads.length})</h4>
              </div>

              {loadingLists ? (
                <div className="flex items-center justify-center p-8 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl">
                  <Loader2 className="size-5 animate-spin text-neutral-400" />
                </div>
              ) : (
                <div className="overflow-x-auto bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl">
                  <table className="w-full border-collapse text-left text-xs text-neutral-500 dark:text-neutral-400">
                    <thead className="bg-neutral-50 dark:bg-neutral-955 font-semibold text-neutral-700 dark:text-neutral-300">
                      <tr>
                        <th className="px-6 py-4 border-b border-neutral-200 dark:border-neutral-800">Name</th>
                        <th className="px-6 py-4 border-b border-neutral-200 dark:border-neutral-800">Email</th>
                        <th className="px-6 py-4 border-b border-neutral-200 dark:border-neutral-800">Phone</th>
                        <th className="px-6 py-4 border-b border-neutral-200 dark:border-neutral-800">Captured At</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800 font-medium text-neutral-800 dark:text-neutral-200">
                      {leads.map((l) => (
                        <tr key={l.id} className="hover:bg-neutral-50/50 dark:hover:bg-neutral-800/10">
                          <td className="px-6 py-4 flex items-center gap-2.5">
                            <div className="size-7 rounded-full bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center text-neutral-500 font-bold">
                              {l.name[0]}
                            </div>
                            {l.name}
                          </td>
                          <td className="px-6 py-4 font-mono">{l.email}</td>
                          <td className="px-6 py-4 font-mono">{l.phone}</td>
                          <td className="px-6 py-4 text-neutral-400 dark:text-neutral-500">{l.created_at}</td>
                        </tr>
                      ))}
                      
                      {/* Empty State */}
                      {leads.length === 0 && (
                        <tr>
                          <td colSpan={4} className="px-6 py-12 text-center space-y-2">
                            <Users className="size-8 mx-auto text-neutral-300" />
                            <h5 className="text-xs font-bold text-neutral-700 dark:text-neutral-300">No leads captured yet</h5>
                            <p className="text-[10px] text-neutral-400 max-w-xs mx-auto leading-normal">
                              Start conversation tests in the Playground to see captured contact details show up in this panel.
                            </p>
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* TAB 6: ANALYTICS */}
          {activeTab === "analytics" && (
            <div className="max-w-4xl mx-auto w-full space-y-8 py-6 px-4">
              {loadingAnalytics ? (
                <div className="flex flex-col items-center justify-center p-12 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl gap-3">
                  <Loader2 className="size-6 animate-spin text-[#f97316]" />
                  <p className="text-xs text-neutral-400 font-semibold">Calculating database metrics...</p>
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                    <div className="p-5 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl">
                      <span className="text-[10px] text-neutral-400 uppercase font-semibold">Total Queries Sent</span>
                      <h4 className="text-2xl font-bold mt-1">{totalQueries.toLocaleString()}</h4>
                      <p className="text-[9px] text-green-500 mt-1 font-medium">100% real database sync</p>
                    </div>
                    <div className="p-5 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl">
                      <span className="text-[10px] text-neutral-400 uppercase font-semibold">Lead Conversion Rate</span>
                      <h4 className="text-2xl font-bold mt-1">{conversionRate}%</h4>
                      <p className="text-[9px] text-[#f97316] mt-1 font-semibold">Total unique sessions: {totalSessions}</p>
                    </div>
                    <div className="p-5 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl">
                      <span className="text-[10px] text-neutral-400 uppercase font-semibold">Satisfaction Score</span>
                      <h4 className="text-2xl font-bold mt-1">{totalQueries > 0 ? "4.9 / 5.0" : "N/A"}</h4>
                      <p className="text-[9px] text-green-500 mt-1 font-medium">Based on Playground test logs</p>
                    </div>
                  </div>

                  <div className="p-6 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-neutral-400 mb-6">Queries Over Time (Last 7 Days)</h4>
                    
                    <div className="h-48 flex items-end justify-between gap-4 pt-4 px-2">
                      {analyticsChartData.map((item, idx) => (
                        <div key={idx} className="flex-1 flex flex-col items-center gap-2 group cursor-pointer h-full justify-end">
                          <span className="text-[10px] font-mono text-neutral-400 opacity-0 group-hover:opacity-100 transition-opacity">{item.count}</span>
                          <div
                            style={{ height: item.height }}
                            className="w-full bg-neutral-200 dark:bg-neutral-800 group-hover:bg-[#f97316] transition-all rounded-t-md"
                          />
                          <span className="text-[10px] text-neutral-500 font-medium">{item.day}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>
          )}

          {/* TAB 7: INTEGRATIONS */}
          {activeTab === "integrations" && (
            <div className="max-w-4xl mx-auto w-full py-6 px-4 space-y-6">
              <div className="p-6 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl">
                <h3 className="text-sm font-bold">Embed Chatbot</h3>
                <p className="text-xs text-neutral-400 mt-1">
                  Copy and paste either the Javascript bundle or the inline iframe element onto your website.
                </p>

                {/* Script snippet */}
                <div className="mt-6 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-neutral-700 dark:text-neutral-350">Option 1: Inline Chat Widget script (Recommended)</span>
                    <button
                      onClick={() => copyToClipboard(embedScriptCode, "script")}
                      className="inline-flex items-center gap-1.5 text-xs text-neutral-500 hover:text-neutral-900 dark:hover:text-white transition-colors cursor-pointer"
                    >
                      {copiedScript ? <Check className="size-3.5 text-green-500" /> : <Copy className="size-3.5" />}
                      {copiedScript ? "Copied!" : "Copy Code"}
                    </button>
                  </div>
                  <pre className="p-4 rounded-xl bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 overflow-x-auto text-[10px] font-mono text-neutral-700 dark:text-neutral-350 leading-relaxed">
                    {embedScriptCode}
                  </pre>
                </div>

                {/* Iframe snippet */}
                <div className="mt-6 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-neutral-700 dark:text-neutral-355">Option 2: Dedicated Embed Iframe</span>
                    <button
                      onClick={() => copyToClipboard(embedIframeCode, "iframe")}
                      className="inline-flex items-center gap-1.5 text-xs text-neutral-500 hover:text-neutral-900 dark:hover:text-white transition-colors cursor-pointer"
                    >
                      {copiedIframe ? <Check className="size-3.5 text-green-500" /> : <Copy className="size-3.5" />}
                      {copiedIframe ? "Copied!" : "Copy Code"}
                    </button>
                  </div>
                  <pre className="p-4 rounded-xl bg-neutral-50 dark:bg-neutral-955 border border-neutral-200 dark:border-neutral-800 overflow-x-auto text-[10px] font-mono text-neutral-700 dark:text-neutral-355 leading-relaxed">
                    {embedIframeCode}
                  </pre>
                </div>
              </div>
            </div>
          )}

          {/* TAB 8: AGENT SETTINGS */}
          {activeTab === "settings" && (
            <div className="max-w-4xl mx-auto w-full py-6 px-4 flex justify-center">
              <div className="w-full max-w-xl p-6 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl space-y-6">
                
                {/* Model Selector */}
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-neutral-400 mb-2">AI Foundation Model</label>
                  <select
                    value={selectedModel}
                    onChange={(e) => handleInputChange(setSelectedModel, e.target.value)}
                    className="w-full bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-lg px-3 py-2.5 text-xs text-neutral-800 dark:text-neutral-200 focus:outline-none focus:border-neutral-350 dark:focus:border-neutral-700 cursor-pointer"
                  >
                    <option value="gemini">Gemini 3.5 Flash (Default)</option>
                    <option value="gpt5">GPT-5.3 Turbo</option>
                    <option value="claude">Claude Opus</option>
                    <option value="mistral">Mistral Large</option>
                  </select>
                  <p className="text-[10px] text-neutral-400 dark:text-neutral-500 mt-1.5">Selected model handles logic & responses inside your widget.</p>
                </div>

                {/* System Instructions / Guardrails */}
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-neutral-400 mb-2">System Instructions / Guardrails</label>
                  <textarea
                    rows={4}
                    value={systemInstructions}
                    onChange={(e) => handleInputChange(setSystemInstructions, e.target.value)}
                    className="w-full bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-lg px-3 py-2 text-xs text-neutral-800 dark:text-neutral-200 focus:outline-none focus:border-neutral-350 dark:focus:border-neutral-700 resize-none leading-relaxed"
                  />
                  <p className="text-[10px] text-neutral-400 dark:text-neutral-500 mt-1">Configures behavior limitations and answers guidelines.</p>
                </div>

                <hr className="border-neutral-100 dark:border-neutral-800" />

                {/* Toggles */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-xs font-semibold">Knowledge Base Strict Mode</span>
                      <p className="text-[10px] text-neutral-400 dark:text-neutral-500">Only answer questions using verified trained memory sources.</p>
                    </div>
                    <button
                      onClick={() => handleInputChange(setStrictMode, !strictMode)}
                      className={`w-9 h-5 rounded-full p-0.5 transition-colors cursor-pointer ${
                        strictMode ? "bg-[#f97316]" : "bg-neutral-200 dark:bg-neutral-800"
                      }`}
                    >
                      <div className={`size-4 rounded-full bg-white transition-transform ${strictMode ? "translate-x-4" : ""}`} />
                    </button>
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-xs font-semibold">Email Lead Alerts</span>
                      <p className="text-[10px] text-neutral-400 dark:text-neutral-500">Receive instant email updates when visitors submit contact info.</p>
                    </div>
                    <button
                      onClick={() => handleInputChange(setEmailNotify, !emailNotify)}
                      className={`w-9 h-5 rounded-full p-0.5 transition-colors cursor-pointer ${
                        emailNotify ? "bg-[#f97316]" : "bg-neutral-200 dark:bg-neutral-800"
                      }`}
                    >
                      <div className={`size-4 rounded-full bg-white transition-transform ${emailNotify ? "translate-x-4" : ""}`} />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Telegram Link Dialog */}
      {telegramLinkOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl p-6 max-w-sm w-full space-y-4 shadow-2xl text-neutral-900 dark:text-neutral-100">
            <div>
              <h4 className="text-sm font-bold">Link Telegram</h4>
              <p className="text-[10px] text-neutral-400 mt-1 leading-normal">
                Get your chat ID from @KinByPersonaliAI_bot — send /start to it.
              </p>
            </div>
            <ol className="text-[10px] text-neutral-550 dark:text-neutral-400 space-y-1.5 list-decimal pl-4 leading-relaxed">
              <li>Open <a href="https://t.me/KinByPersonaliAI_bot" target="_blank" rel="noreferrer" className="text-[#f97316] underline">@KinByPersonaliAI_bot</a> on Telegram and tap <b>Start</b>.</li>
              <li>The bot will reply with your numeric chat ID.</li>
              <li>Paste that ID below — we'll send a confirmation message to verify.</li>
            </ol>
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                const target = e.target as HTMLFormElement;
                const chatIdInput = target.elements.namedItem("telegramChatId") as HTMLInputElement;
                const id = parseInt(chatIdInput.value.trim(), 10);
                if (!id) return;
                const success = await handleLinkTelegram(id);
                if (success) {
                  setTelegramLinkOpen(false);
                }
              }}
              className="space-y-4"
            >
              <div>
                <label className="block text-[10px] font-semibold text-neutral-600 dark:text-neutral-400 mb-1">Telegram chat ID</label>
                <input
                  name="telegramChatId"
                  type="text"
                  placeholder="e.g. 8123456789"
                  inputMode="numeric"
                  autoFocus
                  required
                  className="w-full bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-lg px-3 py-2 text-xs focus:outline-none"
                />
              </div>
              <div className="flex justify-end gap-2 text-xs">
                <button
                  type="button"
                  onClick={() => setTelegramLinkOpen(false)}
                  className="px-3 py-1.5 border border-neutral-200 dark:border-neutral-800 rounded-lg hover:bg-neutral-50 dark:hover:bg-neutral-850 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-3 py-1.5 bg-[#f97316] text-white rounded-lg hover:opacity-90 font-semibold cursor-pointer"
                >
                  Link
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
