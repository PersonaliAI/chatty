"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import { useParams, useSearchParams } from "next/navigation";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  Search,
  BookOpen,
  ChevronRight,
  FileText,
  HelpCircle,
  ArrowLeft,
  ThumbsUp,
  ThumbsDown,
  Check,
  Sparkles,
  Folder,
  Clock,
  Share2,
  MessageSquare,
  ExternalLink,
  Shield,
  Zap,
  Settings,
  Rocket,
  Heart,
  X,
  ChevronDown,
} from "lucide-react";
import { SafeMarkdownLink } from "@/lib/safe-markdown-link";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL ?? "https://api.chatty.personaliai.com";

interface BotInfo {
  id: string;
  name: string;
  logo_url?: string | null;
  avatar_icon?: string;
  primary_color?: string;
  color_scheme?: string;
  bot_role?: string;
}

interface Category {
  id: string;
  name: string;
  slug: string;
  description?: string;
  icon?: string;
  order_index?: number;
  article_count?: number;
}

interface ArticleSummary {
  id: string;
  category_id?: string | null;
  title: string;
  slug: string;
  subtitle?: string;
  status?: string;
  visibility?: string;
  tags?: string[];
  is_promoted?: boolean;
  order_index?: number;
  view_count?: number;
  helpful_count?: number;
  not_helpful_count?: number;
  created_at: string;
  updated_at: string;
}

interface FullArticle extends ArticleSummary {
  content: string;
  author_name?: string;
  category?: Category;
}

interface LegacySource {
  id: string;
  name: string;
  content: string;
  type: string;
}

const CATEGORY_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  Folder,
  BookOpen,
  FileText,
  Shield,
  Zap,
  Settings,
  Rocket,
  Heart,
  HelpCircle,
  Sparkles,
};

function getCategoryIcon(name?: string): React.ComponentType<{ className?: string }> {
  if (name && CATEGORY_ICONS[name]) {
    return CATEGORY_ICONS[name];
  }
  return Folder;
}

// Extract headings for Table of Contents
function extractHeadings(markdown: string): Array<{ id: string; title: string; level: number }> {
  const lines = markdown.split("\n");
  const headings: Array<{ id: string; title: string; level: number }> = [];
  lines.forEach((line) => {
    const match = line.match(/^(#{1,3})\s+(.+)$/);
    if (match) {
      const level = match[1].length;
      const title = match[2].trim();
      const id = title
        .toLowerCase()
        .replace(/[^\w\s-]/g, "")
        .replace(/[\s_-]+/g, "-");
      headings.push({ id, title, level });
    }
  });
  return headings;
}

export default function KnowledgeBasePortal() {
  const { botId } = useParams();
  const searchParams = useSearchParams();

  // Theme & Bot Info
  const [botInfo, setBotInfo] = useState<BotInfo | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [promotedArticles, setPromotedArticles] = useState<ArticleSummary[]>([]);
  const [recentArticles, setRecentArticles] = useState<ArticleSummary[]>([]);
  const [totalArticles, setTotalArticles] = useState(0);

  // Legacy fallback if no structured articles exist
  const [legacySources, setLegacySources] = useState<LegacySource[]>([]);
  const [isLegacyMode, setIsLegacyMode] = useState(false);

  // Active navigation states
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);
  const [categoryArticles, setCategoryArticles] = useState<ArticleSummary[]>([]);
  const [selectedArticle, setSelectedArticle] = useState<FullArticle | null>(null);
  const [relatedArticles, setRelatedArticles] = useState<ArticleSummary[]>([]);

  // Search & Autocomplete
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchDropdownOpen, setSearchDropdownOpen] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  // Loading & Feedback
  const [loading, setLoading] = useState(true);
  const [feedbackSubmitted, setFeedbackSubmitted] = useState<boolean | null>(null);
  const [feedbackComment, setFeedbackComment] = useState("");
  const [submittingFeedback, setSubmittingFeedback] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  const primaryColor = botInfo?.primary_color || "#f97316";

  // Initial Data Load
  useEffect(() => {
    if (!botId) return;

    async function loadPortal() {
      setLoading(true);
      try {
        // Fetch new structured portal data
        const res = await fetch(`${BACKEND_URL}/api/widget/kb/portal?bot_id=${encodeURIComponent(String(botId))}`);
        if (res.ok) {
          const data = await res.json();
          setBotInfo(data.bot);
          setCategories(data.categories || []);
          setPromotedArticles(data.promoted_articles || []);
          setRecentArticles(data.recent_articles || []);
          setTotalArticles(data.total_articles || 0);

          // If no structured articles exist, check for legacy raw sources fallback
          if ((data.total_articles || 0) === 0) {
            const legRes = await fetch(`${BACKEND_URL}/api/widget/kb-sources?bot_id=${encodeURIComponent(String(botId))}`);
            if (legRes.ok) {
              const legData = await legRes.json();
              const sources = legData.sources || [];
              if (sources.length > 0) {
                setLegacySources(sources);
                setIsLegacyMode(true);
              }
            }
          }
        }
      } catch (err) {
        console.error("Failed to load help center portal:", err);
      } finally {
        setLoading(false);
      }
    }

    loadPortal();
  }, [botId]);

  // Deep-link article parameter support (?article=slug)
  useEffect(() => {
    const articleSlug = searchParams.get("article");
    if (articleSlug && botId) {
      loadArticleBySlug(articleSlug);
    }
  }, [searchParams, botId]);

  // Load article by slug
  const loadArticleBySlug = async (slug: string) => {
    try {
      const res = await fetch(
        `${BACKEND_URL}/api/widget/kb/articles/${encodeURIComponent(slug)}?bot_id=${encodeURIComponent(String(botId))}`
      );
      if (res.ok) {
        const data = await res.json();
        setSelectedArticle(data.article);
        setRelatedArticles(data.related || []);
        setSelectedCategory(data.category || null);
        setFeedbackSubmitted(null);
        setFeedbackComment("");
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
    } catch (err) {
      console.error("Failed to load article:", err);
    }
  };

  // Load category by slug
  const loadCategory = async (cat: Category) => {
    setSelectedCategory(cat);
    setSelectedArticle(null);
    try {
      const res = await fetch(
        `${BACKEND_URL}/api/widget/kb/categories/${encodeURIComponent(cat.slug)}?bot_id=${encodeURIComponent(String(botId))}`
      );
      if (res.ok) {
        const data = await res.json();
        setCategoryArticles(data.articles || []);
      }
    } catch (err) {
      console.error("Failed to load category articles:", err);
    }
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // Live search debounced
  useEffect(() => {
    if (!searchQuery.trim() || !botId) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }

    const timer = setTimeout(async () => {
      setIsSearching(true);
      try {
        const res = await fetch(
          `${BACKEND_URL}/api/widget/kb/search?bot_id=${encodeURIComponent(String(botId))}&q=${encodeURIComponent(
            searchQuery.trim()
          )}`
        );
        if (res.ok) {
          const data = await res.json();
          setSearchResults(data.articles || []);
          setSearchDropdownOpen(true);
        }
      } catch (err) {
        console.error("Search failed:", err);
      } finally {
        setIsSearching(false);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [searchQuery, botId]);

  // Close search dropdown on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setSearchDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Submit CSAT Article Feedback
  const handleFeedback = async (isHelpful: boolean) => {
    if (!selectedArticle || !botId) return;
    setSubmittingFeedback(true);
    try {
      await fetch(`${BACKEND_URL}/api/widget/kb/articles/${selectedArticle.id}/feedback`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bot_id: botId,
          is_helpful: isHelpful,
          comment: feedbackComment.trim(),
        }),
      });
      setFeedbackSubmitted(isHelpful);
    } catch (err) {
      console.error("Failed to submit feedback:", err);
    } finally {
      setSubmittingFeedback(false);
    }
  };

  // Copy article link to clipboard
  const handleCopyLink = () => {
    if (typeof window === "undefined") return;
    navigator.clipboard.writeText(window.location.href);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  // Return to home view
  const handleGoHome = () => {
    setSelectedArticle(null);
    setSelectedCategory(null);
    setSearchQuery("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // Table of Contents headings
  const tocHeadings = useMemo(() => {
    return selectedArticle?.content ? extractHeadings(selectedArticle.content) : [];
  }, [selectedArticle]);

  // Estimated reading time
  const readingTime = useMemo(() => {
    if (!selectedArticle?.content) return "1 min";
    const words = selectedArticle.content.split(/\s+/).length;
    const minutes = Math.ceil(words / 200);
    return `${minutes} min read`;
  }, [selectedArticle]);

  if (loading) {
    return (
      <div className="min-h-screen bg-neutral-50 dark:bg-neutral-950 flex flex-col items-center justify-center p-6 text-neutral-500">
        <div className="flex items-center gap-3">
          <span
            className="size-5 border-2 border-neutral-300 rounded-full animate-spin"
            style={{ borderTopColor: primaryColor }}
          />
          <span className="text-xs font-semibold uppercase tracking-wider">Loading Help Center...</span>
        </div>
      </div>
    );
  }

  // LEGACY MODE FALLBACK (if only raw chatty_sources exist)
  if (isLegacyMode) {
    return (
      <div className="min-h-screen bg-neutral-50 dark:bg-neutral-950 text-neutral-850 dark:text-neutral-100 flex flex-col font-sans">
        <header className="border-b border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 sticky top-0 z-40">
          <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <BookOpen className="size-6" style={{ color: primaryColor }} />
              <span className="font-bold text-sm tracking-tight">{botInfo?.name || "Chatty"} Help Center</span>
            </div>
          </div>
        </header>

        <main className="max-w-6xl mx-auto w-full px-4 py-8 flex-1 grid grid-cols-1 md:grid-cols-12 gap-8">
          <div className="md:col-span-4 space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-400">All Sources</h3>
            <div className="space-y-2 max-h-[600px] overflow-y-auto pr-2">
              {legacySources.map((s) => (
                <button
                  key={s.id}
                  onClick={() => setSelectedArticle({ ...s, title: s.name, slug: s.id, status: "published", visibility: "public", created_at: "", updated_at: "" })}
                  className="w-full text-left p-3.5 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 hover:border-[#f97316]/50 transition-colors"
                >
                  <p className="text-xs font-semibold">{s.name}</p>
                  <p className="text-[10px] text-neutral-400 truncate mt-1">{s.content ? s.content.slice(0, 80) : ""}</p>
                </button>
              ))}
            </div>
          </div>
          <div className="md:col-span-8">
            {selectedArticle ? (
              <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl p-6 md:p-8 space-y-4">
                <h1 className="text-xl font-bold">{selectedArticle.title}</h1>
                <article className="prose dark:prose-invert prose-xs text-neutral-700 dark:text-neutral-300 max-w-none">
                  <ReactMarkdown remarkPlugins={[remarkGfm]} components={{ a: SafeMarkdownLink }}>
                    {selectedArticle.content}
                  </ReactMarkdown>
                </article>
              </div>
            ) : (
              <div className="p-12 text-center text-xs text-neutral-400">Select an article to read.</div>
            )}
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-neutral-950 text-neutral-900 dark:text-neutral-100 flex flex-col font-sans selection:bg-[#f97316]/20">
      {/* 1. TOP BRANDED NAVIGATION HEADER */}
      <header className="border-b border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 sticky top-0 z-40 shadow-xs">
        <div className="max-w-6xl mx-auto px-4 py-3.5 flex items-center justify-between gap-4">
          <button
            onClick={handleGoHome}
            className="flex items-center gap-2.5 cursor-pointer hover:opacity-85 transition-opacity text-left"
          >
            {botInfo?.logo_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={botInfo.logo_url} alt="Logo" className="size-7 rounded-lg object-contain" />
            ) : (
              <div
                className="size-7 rounded-lg flex items-center justify-center text-white"
                style={{ backgroundColor: primaryColor }}
              >
                <BookOpen className="size-4" />
              </div>
            )}
            <div>
              <span className="font-bold text-sm tracking-tight text-neutral-900 dark:text-white">
                {botInfo?.name || "Chatty"} Help Center
              </span>
              <span className="text-[10px] text-neutral-400 block -mt-0.5 font-medium">Knowledge &amp; Guides</span>
            </div>
          </button>

          <div className="flex items-center gap-3">
            <a
              href={`/embed/${botId}`}
              target="_blank"
              rel="noopener noreferrer"
              className="hidden sm:flex items-center gap-1.5 text-xs font-semibold px-3.5 py-1.5 rounded-xl border border-neutral-200 dark:border-neutral-800 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
            >
              <MessageSquare className="size-3.5" style={{ color: primaryColor }} />
              <span>Ask AI Assistant</span>
            </a>
          </div>
        </div>
      </header>

      {/* 2. HERO SEARCH SECTION */}
      <div className="bg-gradient-to-b from-white via-white to-neutral-50 dark:from-neutral-900 dark:via-neutral-900 dark:to-neutral-950 border-b border-neutral-200 dark:border-neutral-800 py-10 px-4">
        <div className="max-w-3xl mx-auto text-center space-y-4">
          <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-neutral-900 dark:text-white">
            How can we help you today?
          </h1>
          <p className="text-xs md:text-sm text-neutral-500 dark:text-neutral-400 max-w-xl mx-auto leading-relaxed">
            Search our comprehensive guides, FAQs, and setup instructions.
          </p>

          {/* Search Box with Autocomplete */}
          <div ref={searchRef} className="relative max-w-xl mx-auto mt-6">
            <div className="relative flex items-center shadow-lg rounded-2xl bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 focus-within:ring-2 focus-within:ring-[#f97316]/50 transition-all">
              <Search className="size-4 text-neutral-400 ml-4 shrink-0" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onFocus={() => {
                  if (searchResults.length > 0) setSearchDropdownOpen(true);
                }}
                placeholder="Type a question or topic (e.g. refund, setup, api)..."
                className="w-full py-3.5 pl-3 pr-10 text-xs md:text-sm bg-transparent focus:outline-none"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="p-1 text-neutral-400 hover:text-neutral-600 mr-3"
                >
                  <X className="size-3.5" />
                </button>
              )}
            </div>

            {/* Live Autocomplete Dropdown */}
            {searchDropdownOpen && searchQuery.trim().length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl shadow-2xl z-50 overflow-hidden text-left divide-y divide-neutral-100 dark:divide-neutral-800 animate-in fade-in">
                {isSearching ? (
                  <div className="p-4 text-center text-xs text-neutral-400 flex items-center justify-center gap-2">
                    <span
                      className="size-3.5 border-2 border-neutral-300 rounded-full animate-spin"
                      style={{ borderTopColor: primaryColor }}
                    />
                    Searching guides...
                  </div>
                ) : searchResults.length === 0 ? (
                  <div className="p-5 text-center text-xs text-neutral-400">
                    No articles found matching &ldquo;{searchQuery}&rdquo;.
                  </div>
                ) : (
                  searchResults.map((result) => (
                    <button
                      key={result.id}
                      onClick={() => {
                        loadArticleBySlug(result.slug);
                        setSearchDropdownOpen(false);
                      }}
                      className="w-full p-3.5 hover:bg-neutral-50 dark:hover:bg-neutral-800/60 transition-colors flex items-start gap-3 text-left cursor-pointer"
                    >
                      <FileText className="size-4 text-[#f97316] shrink-0 mt-0.5" />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="text-xs font-bold text-neutral-900 dark:text-white truncate">
                            {result.title}
                          </p>
                          {result.category && (
                            <span className="text-[9px] bg-neutral-100 dark:bg-neutral-800 text-neutral-500 font-semibold px-1.5 py-0.2 rounded">
                              {result.category.name}
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-neutral-500 dark:text-neutral-400 line-clamp-1 mt-0.5">
                          {result.snippet}
                        </p>
                      </div>
                      <ChevronRight className="size-3.5 text-neutral-400 shrink-0 mt-1" />
                    </button>
                  ))
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 3. MAIN CONTENT CONTAINER */}
      <main className="max-w-6xl mx-auto w-full px-4 py-8 flex-1">
        {/* VIEW A: ARTICLE READING VIEW */}
        {selectedArticle ? (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            {/* Article Main Body */}
            <div className="lg:col-span-8 space-y-6">
              {/* Breadcrumb Navigation */}
              <nav className="flex items-center gap-2 text-xs text-neutral-500 flex-wrap">
                <button
                  onClick={handleGoHome}
                  className="hover:text-neutral-900 dark:hover:text-white transition-colors cursor-pointer"
                >
                  Home
                </button>
                <ChevronRight className="size-3 text-neutral-400" />
                {selectedCategory ? (
                  <button
                    onClick={() => loadCategory(selectedCategory)}
                    className="hover:text-neutral-900 dark:hover:text-white transition-colors cursor-pointer"
                  >
                    {selectedCategory.name}
                  </button>
                ) : (
                  <span>Articles</span>
                )}
                <ChevronRight className="size-3 text-neutral-400" />
                <span className="font-semibold text-neutral-900 dark:text-white truncate max-w-xs">
                  {selectedArticle.title}
                </span>
              </nav>

              <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-3xl p-6 sm:p-10 shadow-xs space-y-6">
                {/* Article Header */}
                <div className="space-y-3 pb-6 border-b border-neutral-100 dark:border-neutral-800">
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <div className="flex items-center gap-2">
                      {selectedArticle.category && (
                        <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300">
                          {selectedArticle.category.name}
                        </span>
                      )}
                      <span className="flex items-center gap-1 text-[11px] text-neutral-400">
                        <Clock className="size-3" /> {readingTime}
                      </span>
                    </div>

                    <button
                      onClick={handleCopyLink}
                      className="flex items-center gap-1.5 text-xs text-neutral-500 hover:text-neutral-800 dark:hover:text-white transition-colors cursor-pointer"
                    >
                      {copiedLink ? <Check className="size-3 text-green-500" /> : <Share2 className="size-3" />}
                      <span>{copiedLink ? "Link Copied!" : "Share"}</span>
                    </button>
                  </div>

                  <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-neutral-900 dark:text-white leading-tight">
                    {selectedArticle.title}
                  </h1>

                  {selectedArticle.subtitle && (
                    <p className="text-sm text-neutral-500 dark:text-neutral-400 leading-relaxed font-medium">
                      {selectedArticle.subtitle}
                    </p>
                  )}

                  <div className="flex items-center gap-2 pt-2 text-[11px] text-neutral-400">
                    <span>By {selectedArticle.author_name || "Support Team"}</span>
                    <span>G«Û</span>
                    <span>Last updated {new Date(selectedArticle.updated_at).toLocaleDateString()}</span>
                  </div>
                </div>

                {/* Rich Markdown Article Body */}
                <article className="prose dark:prose-invert prose-neutral max-w-none text-xs sm:text-sm leading-relaxed space-y-4">
                  <ReactMarkdown remarkPlugins={[remarkGfm]} components={{ a: SafeMarkdownLink }}>
                    {selectedArticle.content}
                  </ReactMarkdown>
                </article>

                {/* CSAT Feedback Widget */}
                <div className="mt-10 pt-6 border-t border-neutral-100 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-850/40 rounded-2xl p-5 space-y-3">
                  <div className="flex items-center justify-between gap-4 flex-wrap">
                    <span className="text-xs font-bold text-neutral-800 dark:text-neutral-200">
                      Was this article helpful?
                    </span>
                    {feedbackSubmitted === null ? (
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleFeedback(true)}
                          disabled={submittingFeedback}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-neutral-200 dark:border-neutral-700 hover:bg-white dark:hover:bg-neutral-800 text-xs font-semibold text-neutral-700 dark:text-neutral-200 transition-colors cursor-pointer"
                        >
                          <ThumbsUp className="size-3.5 text-green-500" />
                          <span>Yes</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleFeedback(false)}
                          disabled={submittingFeedback}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-neutral-200 dark:border-neutral-700 hover:bg-white dark:hover:bg-neutral-800 text-xs font-semibold text-neutral-700 dark:text-neutral-200 transition-colors cursor-pointer"
                        >
                          <ThumbsDown className="size-3.5 text-red-500" />
                          <span>No</span>
                        </button>
                      </div>
                    ) : (
                      <span className="text-xs font-bold text-green-500 flex items-center gap-1.5">
                        <Check className="size-4" /> Thank you for your feedback!
                      </span>
                    )}
                  </div>

                  {feedbackSubmitted === false && (
                    <div className="space-y-2 pt-2 animate-in fade-in">
                      <p className="text-[11px] text-neutral-400">
                        How can we improve this article? (Optional)
                      </p>
                      <textarea
                        rows={2}
                        value={feedbackComment}
                        onChange={(e) => setFeedbackComment(e.target.value)}
                        placeholder="Tell us what was missing or confusing..."
                        className="w-full text-xs p-2.5 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-xl focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => handleFeedback(false)}
                        className="px-3 py-1 bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 rounded-lg text-xs font-semibold"
                      >
                        Send Feedback
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Article Sticky Sidebar (TOC & Related Articles) */}
            <div className="lg:col-span-4 space-y-6">
              {/* Table of Contents */}
              {tocHeadings.length > 0 && (
                <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-3xl p-5 space-y-3 sticky top-20 shadow-xs">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-neutral-400">
                    On this page
                  </h4>
                  <nav className="space-y-1.5 text-xs">
                    {tocHeadings.map((h, i) => (
                      <a
                        key={i}
                        href={`#${h.id}`}
                        className={`block text-neutral-600 dark:text-neutral-400 hover:text-[#f97316] transition-colors ${
                          h.level === 1 ? "font-bold" : h.level === 2 ? "pl-2 font-medium" : "pl-4 text-[11px]"
                        }`}
                      >
                        {h.title}
                      </a>
                    ))}
                  </nav>
                </div>
              )}

              {/* Related Articles */}
              {relatedArticles.length > 0 && (
                <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-3xl p-5 space-y-3 shadow-xs">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-neutral-400">
                    Related Articles
                  </h4>
                  <div className="space-y-2">
                    {relatedArticles.map((rel) => (
                      <button
                        key={rel.id}
                        onClick={() => loadArticleBySlug(rel.slug)}
                        className="w-full text-left p-2.5 rounded-xl hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors flex items-center justify-between gap-2 cursor-pointer"
                      >
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-neutral-800 dark:text-neutral-200 truncate">
                            {rel.title}
                          </p>
                          <span className="text-[10px] text-neutral-400">
                            {(rel.view_count || 0).toLocaleString()} views
                          </span>
                        </div>
                        <ChevronRight className="size-3.5 text-neutral-400 shrink-0" />
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* AI Support Deflection Card */}
              <div className="bg-gradient-to-br from-[#f97316]/10 to-[#f97316]/5 border border-[#f97316]/20 rounded-3xl p-5 space-y-3">
                <Sparkles className="size-5 text-[#f97316]" />
                <h4 className="text-xs font-bold text-neutral-900 dark:text-white">
                  Still need help?
                </h4>
                <p className="text-[11px] text-neutral-500 dark:text-neutral-400 leading-relaxed">
                  Our AI assistant can answer your custom questions instantly 24/7.
                </p>
                <a
                  href={`/embed/${botId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#f97316] text-white text-xs font-semibold hover:opacity-90 transition-opacity"
                >
                  <MessageSquare className="size-3.5" />
                  <span>Chat with Assistant</span>
                </a>
              </div>
            </div>
          </div>
        ) : selectedCategory ? (
          /* VIEW B: CATEGORY ARTICLES LIST */
          <div className="space-y-6">
            <nav className="flex items-center gap-2 text-xs text-neutral-500">
              <button onClick={handleGoHome} className="hover:text-neutral-900 transition-colors cursor-pointer">
                Home
              </button>
              <ChevronRight className="size-3 text-neutral-400" />
              <span className="font-semibold text-neutral-900 dark:text-white">{selectedCategory.name}</span>
            </nav>

            <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-3xl p-6 sm:p-8 shadow-xs">
              <div className="flex items-center gap-3">
                <div className="size-12 rounded-2xl bg-[#f97316]/10 text-[#f97316] flex items-center justify-center">
                  {React.createElement(getCategoryIcon(selectedCategory.icon), { className: "size-6" })}
                </div>
                <div>
                  <h1 className="text-xl sm:text-2xl font-bold text-neutral-900 dark:text-white">
                    {selectedCategory.name}
                  </h1>
                  <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
                    {selectedCategory.description || "Browse guides and tutorials in this section."}
                  </p>
                </div>
              </div>

              <div className="mt-8 divide-y divide-neutral-100 dark:divide-neutral-800">
                {categoryArticles.length === 0 ? (
                  <div className="p-8 text-center text-xs text-neutral-400">
                    No articles in this category yet.
                  </div>
                ) : (
                  categoryArticles.map((art) => (
                    <button
                      key={art.id}
                      onClick={() => loadArticleBySlug(art.slug)}
                      className="w-full text-left py-4 hover:bg-neutral-50/60 dark:hover:bg-neutral-850/40 px-3 rounded-2xl transition-colors flex items-center justify-between gap-4 cursor-pointer"
                    >
                      <div className="min-w-0">
                        <h3 className="text-sm font-bold text-neutral-900 dark:text-white truncate">
                          {art.title}
                        </h3>
                        {art.subtitle && (
                          <p className="text-xs text-neutral-500 dark:text-neutral-400 line-clamp-1 mt-1">
                            {art.subtitle}
                          </p>
                        )}
                        <span className="text-[10px] text-neutral-400 mt-1.5 block">
                          Updated {new Date(art.updated_at).toLocaleDateString()}
                        </span>
                      </div>
                      <ChevronRight className="size-4 text-neutral-400 shrink-0" />
                    </button>
                  ))
                )}
              </div>
            </div>
          </div>
        ) : (
          /* VIEW C: HOME VIEW */
          <div className="space-y-12">
            {/* 1. Promoted / Featured Guides */}
            {promotedArticles.length > 0 && (
              <section className="space-y-4">
                <div className="flex items-center gap-2">
                  <Sparkles className="size-4 text-amber-500" />
                  <h2 className="text-xs font-bold uppercase tracking-wider text-neutral-400">
                    Featured Guides
                  </h2>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {promotedArticles.map((art) => (
                    <button
                      key={art.id}
                      onClick={() => loadArticleBySlug(art.slug)}
                      className="text-left bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 hover:border-[#f97316]/50 rounded-3xl p-5 shadow-xs transition-all hover:shadow-md cursor-pointer flex flex-col justify-between space-y-4 group"
                    >
                      <div className="space-y-2">
                        <span className="inline-flex items-center gap-1 text-[9px] font-bold px-2 py-0.5 rounded-full bg-amber-50 dark:bg-amber-950/30 text-amber-600 dark:text-amber-400">
                          <Sparkles className="size-2.5" /> Promoted
                        </span>
                        <h3 className="text-sm font-bold text-neutral-900 dark:text-white group-hover:text-[#f97316] transition-colors leading-snug">
                          {art.title}
                        </h3>
                        <p className="text-xs text-neutral-500 dark:text-neutral-400 line-clamp-2 leading-relaxed">
                          {art.subtitle || "Click to read full setup and guide..."}
                        </p>
                      </div>

                      <div className="flex items-center justify-between text-[10px] text-neutral-400 pt-3 border-t border-neutral-100 dark:border-neutral-800">
                        <span>{(art.view_count || 0).toLocaleString()} reads</span>
                        <span className="font-semibold text-[#f97316] flex items-center gap-1">
                          Read Guide GÂ∆
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              </section>
            )}

            {/* 2. Browse by Category */}
            <section className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Folder className="size-4 text-[#f97316]" />
                  <h2 className="text-xs font-bold uppercase tracking-wider text-neutral-400">
                    Browse Topics
                  </h2>
                </div>
                <span className="text-xs text-neutral-400">{categories.length} categories</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {categories.map((cat) => {
                  const Icon = getCategoryIcon(cat.icon);
                  return (
                    <button
                      key={cat.id}
                      onClick={() => loadCategory(cat)}
                      className="text-left bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 hover:border-[#f97316]/50 rounded-3xl p-5 shadow-xs transition-all hover:shadow-md cursor-pointer flex flex-col justify-between space-y-4 group"
                    >
                      <div className="flex items-start gap-3.5">
                        <div className="size-11 rounded-2xl bg-[#f97316]/10 text-[#f97316] flex items-center justify-center shrink-0">
                          <Icon className="size-5" />
                        </div>
                        <div className="min-w-0">
                          <h3 className="text-sm font-bold text-neutral-900 dark:text-white group-hover:text-[#f97316] transition-colors truncate">
                            {cat.name}
                          </h3>
                          <p className="text-xs text-neutral-500 dark:text-neutral-400 line-clamp-2 mt-1 leading-relaxed">
                            {cat.description || "Guides and answers in this section."}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center justify-between text-[11px] text-neutral-400 pt-3 border-t border-neutral-100 dark:border-neutral-800">
                        <span className="font-semibold text-neutral-700 dark:text-neutral-300">
                          {cat.article_count || 0} articles
                        </span>
                        <span className="text-[#f97316] font-semibold flex items-center gap-1 group-hover:translate-x-0.5 transition-transform">
                          Browse GÂ∆
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </section>

            {/* 3. Recent Articles Feed */}
            {recentArticles.length > 0 && (
              <section className="space-y-4">
                <div className="flex items-center gap-2">
                  <FileText className="size-4 text-neutral-400" />
                  <h2 className="text-xs font-bold uppercase tracking-wider text-neutral-400">
                    Recently Added &amp; Updated
                  </h2>
                </div>

                <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-3xl p-2 sm:p-4 divide-y divide-neutral-100 dark:divide-neutral-800 shadow-xs">
                  {recentArticles.map((art) => (
                    <button
                      key={art.id}
                      onClick={() => loadArticleBySlug(art.slug)}
                      className="w-full text-left p-3 hover:bg-neutral-50/60 dark:hover:bg-neutral-850/40 rounded-2xl transition-colors flex items-center justify-between gap-4 cursor-pointer"
                    >
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-neutral-900 dark:text-white truncate">
                          {art.title}
                        </p>
                        <span className="text-[10px] text-neutral-400 mt-0.5 block">
                          Updated {new Date(art.updated_at).toLocaleDateString()}
                        </span>
                      </div>
                      <ChevronRight className="size-4 text-neutral-400 shrink-0" />
                    </button>
                  ))}
                </div>
              </section>
            )}

            {/* 4. Global Deflection CTA Banner */}
            <section className="bg-gradient-to-r from-neutral-900 to-neutral-800 text-white rounded-3xl p-8 sm:p-10 shadow-lg flex flex-col sm:flex-row items-center justify-between gap-6">
              <div className="space-y-2 text-center sm:text-left">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#f97316] bg-[#f97316]/10 px-2.5 py-1 rounded-full">
                  24/7 Instant Answers
                </span>
                <h3 className="text-xl sm:text-2xl font-extrabold tracking-tight">
                  Didn&apos;t find what you were looking for?
                </h3>
                <p className="text-xs sm:text-sm text-neutral-300 max-w-md">
                  Our AI customer support assistant is trained on our complete knowledge base and ready to help.
                </p>
              </div>

              <a
                href={`/embed/${botId}`}
                target="_blank"
                rel="noopener noreferrer"
                className="shrink-0 flex items-center gap-2 bg-[#f97316] hover:bg-[#ea580c] text-white px-5 py-3 rounded-2xl text-xs font-bold shadow-md transition-colors"
              >
                <MessageSquare className="size-4" />
                <span>Ask AI Assistant</span>
              </a>
            </section>
          </div>
        )}
      </main>

      {/* 4. FOOTER */}
      <footer className="border-t border-neutral-200 dark:border-neutral-850 py-6 text-center text-xs text-neutral-400 bg-white dark:bg-neutral-900">
        <div className="max-w-6xl mx-auto px-4 flex items-center justify-between flex-wrap gap-3">
          <p>-¨ {new Date().getFullYear()} {botInfo?.name || "Chatty"}. All rights reserved.</p>
          <span className="text-[10px] text-neutral-400 flex items-center gap-1">
            Powered by <strong className="text-neutral-600 dark:text-neutral-300 font-semibold">Chatty Help Center</strong>
          </span>
        </div>
      </footer>
    </div>
  );
}
