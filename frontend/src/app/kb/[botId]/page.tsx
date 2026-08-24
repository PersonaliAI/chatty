"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Search, BookOpen, ChevronRight, FileText, HelpCircle, ArrowLeft } from "lucide-react";

const supabase = createClient();
const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL ?? "https://api.chatty.personaliai.com";

interface Source {
  id: string;
  name: string;
  content: string;
  type: string;
}

export default function KnowledgeBasePortal() {
  const { botId } = useParams();
  const [botName, setBotName] = useState("Chatty Help Center");
  const [primaryColor, setPrimaryColor] = useState("#f97316");
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  
  const [sources, setSources] = useState<Source[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedArticle, setSelectedArticle] = useState<Source | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!botId) return;
    async function loadPortalData() {
      try {
        // Fetch Bot Info from Backend (Theme API is public, no auth required)
        const themeRes = await fetch(`${BACKEND_URL}/api/widget/theme?bot_id=${encodeURIComponent(String(botId))}`);
        if (themeRes.ok) {
          const bot = await themeRes.json();
          setBotName(bot.name || "Chatty Help Center");
          setPrimaryColor(bot.primary_color || "#f97316");
          setLogoUrl(bot.logo_url || null);
        }

        // Fetch public sources directly from Supabase
        const { data: dbSources } = await supabase
          .from("chatty_sources")
          .select("*")
          .eq("bot_id", botId);

        if (dbSources) {
          setSources(dbSources.map(s => ({
            id: s.id,
            name: s.name,
            content: s.content || "",
            type: s.type,
          })));
        }
      } catch (err) {
        console.error("Failed to load knowledge base:", err);
      } finally {
        setLoading(false);
      }
    }
    loadPortalData();
  }, [botId]);

  const filteredSources = sources.filter(s =>
    s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.content.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-neutral-50 dark:bg-neutral-950 flex flex-col items-center justify-center p-6 text-neutral-500">
        <div className="flex items-center gap-3">
          <span className="size-4 border-2 border-neutral-300 border-t-[#f97316] rounded-full animate-spin"></span>
          <span className="text-xs font-semibold uppercase tracking-wider">Loading help center...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-neutral-950 text-neutral-850 dark:text-neutral-100 flex flex-col font-sans">
      {/* Header */}
      <header className="border-b border-neutral-200 dark:border-neutral-850 bg-white dark:bg-neutral-900 sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            {logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- uploaded logo URL, not in next/image's domain allowlist
              <img src={logoUrl} alt="logo" className="size-7 rounded-lg object-contain" />
            ) : (
              <BookOpen className="size-6" style={{ color: primaryColor }} />
            )}
            <span className="font-bold text-sm tracking-tight">{botName} Help Center</span>
          </div>

          <div className="relative w-64 md:w-80">
            <Search className="size-4 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search help articles..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-xl pl-9 pr-3 py-1.5 text-xs focus:outline-none"
            />
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-6xl mx-auto w-full px-4 py-8 flex-1 grid grid-cols-1 md:grid-cols-12 gap-8">
        {/* Navigation Sidebar */}
        <div className="md:col-span-4 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-400">All Articles</h3>
            <span className="text-[10px] bg-neutral-100 dark:bg-neutral-800 font-bold px-1.5 py-0.5 rounded-full text-neutral-500">
              {filteredSources.length} articles
            </span>
          </div>

          <div className="space-y-2 max-h-[600px] overflow-y-auto pr-2 scrollbar-thin">
            {filteredSources.length === 0 ? (
              <div className="p-6 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl text-center text-xs text-neutral-400">
                <HelpCircle className="size-8 mx-auto mb-2 text-neutral-300" />
                No matching articles found
              </div>
            ) : (
              filteredSources.map((s) => (
                <button
                  key={s.id}
                  onClick={() => setSelectedArticle(s)}
                  className={`w-full text-left p-3.5 rounded-xl border transition-colors flex items-center justify-between gap-3 cursor-pointer ${
                    selectedArticle?.id === s.id
                      ? "bg-white dark:bg-neutral-900 shadow-sm border-neutral-300 dark:border-neutral-700 font-semibold"
                      : "bg-white/50 hover:bg-white dark:bg-neutral-900/40 dark:hover:bg-neutral-900 border-neutral-200 dark:border-neutral-800 text-neutral-600 dark:text-neutral-300"
                  }`}
                >
                  <div className="min-w-0">
                    <p className="text-xs truncate">{s.name}</p>
                    <p className="text-[10px] text-neutral-400 dark:text-neutral-500 truncate mt-1">
                      {s.content ? s.content.slice(0, 80) : "No description available..."}
                    </p>
                  </div>
                  <ChevronRight className="size-4 text-neutral-400 shrink-0" />
                </button>
              ))
            )}
          </div>
        </div>

        {/* Article Viewer Content Area */}
        <div className="md:col-span-8">
          {selectedArticle ? (
            <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl p-6 md:p-8 space-y-6">
              {/* Back button on mobile */}
              <button
                onClick={() => setSelectedArticle(null)}
                className="md:hidden flex items-center gap-1.5 text-xs text-neutral-400 hover:text-neutral-600 cursor-pointer"
              >
                <ArrowLeft className="size-4" /> Back to list
              </button>

              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-neutral-100 dark:bg-neutral-800 text-neutral-500">
                    {selectedArticle.type}
                  </span>
                </div>
                <h1 className="text-xl md:text-2xl font-bold tracking-tight text-neutral-900 dark:text-white">
                  {selectedArticle.name}
                </h1>
              </div>

              {/* Rich Markdown Reader */}
              <article className="prose dark:prose-invert prose-xs text-neutral-700 dark:text-neutral-300 max-w-none leading-relaxed space-y-4">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {selectedArticle.content}
                </ReactMarkdown>
              </article>
            </div>
          ) : (
            <div className="h-full min-h-[300px] flex flex-col items-center justify-center text-center p-6 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl">
              <FileText className="size-12 text-neutral-200 dark:text-neutral-800 mb-3" />
              <h4 className="text-xs font-bold text-neutral-700 dark:text-neutral-350">Select an Article</h4>
              <p className="text-[10px] text-neutral-450 dark:text-neutral-500 mt-1 max-w-xs leading-normal">
                Choose an article from the left navigation panel to read guides, docs, and sync rules.
              </p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
