"use client";

import React, { useState, useEffect, useMemo } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  BookOpen,
  Folder,
  Plus,
  Search,
  Check,
  Eye,
  Edit3,
  Trash2,
  ExternalLink,
  Sparkles,
  HelpCircle,
  FileText,
  AlertTriangle,
  BarChart2,
  Database,
  ThumbsUp,
  ThumbsDown,
  Layers,
  ArrowUpRight,
  RefreshCw,
  FolderPlus,
  Shield,
  Zap,
  Settings,
  Rocket,
  Heart,
  Tag,
  Code,
  Bold,
  Italic,
  List,
  ListOrdered,
  Quote,
  Table as TableIcon,
  Info,
  ChevronRight,
  X,
} from "lucide-react";
import { SafeMarkdownLink } from "@/lib/safe-markdown-link";

export interface KBArticle {
  id: string;
  bot_id: string;
  category_id?: string | null;
  title: string;
  slug: string;
  subtitle?: string;
  content: string;
  status: "published" | "draft" | "archived";
  visibility: "public" | "internal_only";
  author_name?: string;
  author_email?: string;
  tags?: string[];
  is_promoted?: boolean;
  order_index?: number;
  view_count?: number;
  helpful_count?: number;
  not_helpful_count?: number;
  source_id?: string | null;
  created_at: string;
  updated_at: string;
  category?: {
    id?: string;
    name: string;
    slug: string;
    icon?: string;
  };
}

export interface KBCategory {
  id: string;
  bot_id: string;
  name: string;
  slug: string;
  description?: string;
  icon?: string;
  order_index?: number;
  article_count?: number;
  created_at?: string;
  updated_at?: string;
}

export interface KBAnalytics {
  total_articles: number;
  published_count: number;
  draft_count: number;
  archived_count: number;
  total_categories: number;
  total_views: number;
  total_helpful: number;
  total_not_helpful: number;
  csat_percent: number;
  top_articles: Array<{
    id: string;
    title: string;
    slug: string;
    status: string;
    view_count: number;
    helpful_count: number;
    not_helpful_count: number;
  }>;
  content_gaps: Array<{
    query: string;
    count: number;
  }>;
}

const CATEGORY_ICONS = [
  { name: "Folder", icon: Folder },
  { name: "BookOpen", icon: BookOpen },
  { name: "FileText", icon: FileText },
  { name: "Shield", icon: Shield },
  { name: "Zap", icon: Zap },
  { name: "Settings", icon: Settings },
  { name: "Rocket", icon: Rocket },
  { name: "Heart", icon: Heart },
  { name: "HelpCircle", icon: HelpCircle },
  { name: "Sparkles", icon: Sparkles },
];

function getCategoryIcon(name?: string) {
  const found = CATEGORY_ICONS.find((c) => c.name === name);
  return found ? found.icon : Folder;
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

interface KBManagerProps {
  botId: string;
  fetchBackend: (path: string, options?: RequestInit) => Promise<Response>;
  rawSourcesContent?: React.ReactNode;
  color?: string;
}

export function KBManager({
  botId,
  fetchBackend,
  rawSourcesContent,
  color = "#f97316",
}: KBManagerProps) {
  const [subTab, setSubTab] = useState<"articles" | "categories" | "analytics" | "sources">("articles");

  // Articles state
  const [articles, setArticles] = useState<KBArticle[]>([]);
  const [categories, setCategories] = useState<KBCategory[]>([]);
  const [analytics, setAnalytics] = useState<KBAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchFilter, setSearchFilter] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  // Editor modal state
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingArticleId, setEditingArticleId] = useState<string | null>(null);
  const [editorTitle, setEditorTitle] = useState("");
  const [editorSlug, setEditorSlug] = useState("");
  const [editorCategoryId, setEditorCategoryId] = useState<string>("");
  const [editorSubtitle, setEditorSubtitle] = useState("");
  const [editorContent, setEditorContent] = useState("");
  const [editorStatus, setEditorStatus] = useState<"published" | "draft" | "archived">("published");
  const [editorVisibility, setEditorVisibility] = useState<"public" | "internal_only">("public");
  const [editorTags, setEditorTags] = useState<string[]>([]);
  const [editorTagInput, setEditorTagInput] = useState("");
  const [editorPromoted, setEditorPromoted] = useState(false);
  const [editorTab, setEditorTab] = useState<"write" | "preview">("write");
  const [savingArticle, setSavingArticle] = useState(false);

  // Category Modal state
  const [categoryModalOpen, setCategoryModalOpen] = useState(false);
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  const [catName, setCatName] = useState("");
  const [catSlug, setCatSlug] = useState("");
  const [catDesc, setCatDesc] = useState("");
  const [catIcon, setCatIcon] = useState("Folder");
  const [savingCategory, setSavingCategory] = useState(false);

  // Action status message
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  // Fetch all KB data
  const loadData = async () => {
    if (!botId) return;
    setLoading(true);
    try {
      const [artRes, catRes, anaRes] = await Promise.all([
        fetchBackend(`/api/admin/kb/articles?bot_id=${encodeURIComponent(botId)}`),
        fetchBackend(`/api/admin/kb/categories?bot_id=${encodeURIComponent(botId)}`),
        fetchBackend(`/api/admin/kb/analytics?bot_id=${encodeURIComponent(botId)}`),
      ]);

      if (artRes.ok) {
        const data = await artRes.json();
        setArticles(data.articles || []);
      }
      if (catRes.ok) {
        const data = await catRes.json();
        setCategories(data.categories || []);
      }
      if (anaRes.ok) {
        const data = await anaRes.json();
        setAnalytics(data);
      }
    } catch (err) {
      console.error("Failed to load KB data:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [botId]);

  // Open editor for new or existing article
  const handleOpenEditor = (art?: KBArticle, initialTitle?: string) => {
    if (art) {
      setEditingArticleId(art.id);
      setEditorTitle(art.title);
      setEditorSlug(art.slug);
      setEditorCategoryId(art.category_id || "");
      setEditorSubtitle(art.subtitle || "");
      setEditorContent(art.content);
      setEditorStatus(art.status);
      setEditorVisibility(art.visibility);
      setEditorTags(art.tags || []);
      setEditorPromoted(!!art.is_promoted);
    } else {
      setEditingArticleId(null);
      const title = initialTitle || "";
      setEditorTitle(title);
      setEditorSlug(title ? slugify(title) : "");
      setEditorCategoryId(categories.length > 0 ? categories[0].id : "");
      setEditorSubtitle("");
      setEditorContent("");
      setEditorStatus("published");
      setEditorVisibility("public");
      setEditorTags([]);
      setEditorPromoted(false);
    }
    setEditorTab("write");
    setEditorOpen(true);
  };

  // Title change with auto-slug
  const handleTitleChange = (val: string) => {
    setEditorTitle(val);
    if (!editingArticleId) {
      setEditorSlug(slugify(val));
    }
  };

  // Save article handler
  const handleSaveArticle = async (overrideStatus?: "published" | "draft") => {
    if (!editorTitle.trim() || !editorContent.trim()) {
      showToast("Please provide both a title and content for the article.");
      return;
    }
    setSavingArticle(true);
    const targetStatus = overrideStatus || editorStatus;

    try {
      const payload = {
        bot_id: botId,
        title: editorTitle.trim(),
        slug: editorSlug.trim() || slugify(editorTitle),
        category_id: editorCategoryId || null,
        subtitle: editorSubtitle.trim(),
        content: editorContent.trim(),
        status: targetStatus,
        visibility: editorVisibility,
        tags: editorTags,
        is_promoted: editorPromoted,
      };

      let res: Response;
      if (editingArticleId) {
        res = await fetchBackend(`/api/admin/kb/articles/${editingArticleId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      } else {
        res = await fetchBackend(`/api/admin/kb/articles`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      }

      if (res.ok) {
        showToast(
          targetStatus === "published"
            ? "Article published and synchronized with AI chatbot!"
            : "Article saved as draft."
        );
        setEditorOpen(false);
        await loadData();
      } else {
        const err = await res.json();
        showToast(`Failed to save article: ${err.detail || "Unknown error"}`);
      }
    } catch (err) {
      console.error(err);
      showToast("Network error while saving article.");
    } finally {
      setSavingArticle(false);
    }
  };

  // Delete article handler
  const handleDeleteArticle = async (id: string, title: string) => {
    if (!confirm(`Are you sure you want to delete "${title}"? This will also remove it from the public help center and AI brain.`)) {
      return;
    }
    try {
      const res = await fetchBackend(`/api/admin/kb/articles/${id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        showToast("Article deleted successfully.");
        await loadData();
      }
    } catch (err) {
      console.error(err);
      showToast("Failed to delete article.");
    }
  };

  // Category save
  const handleSaveCategory = async () => {
    if (!catName.trim()) return;
    setSavingCategory(true);
    try {
      const payload = {
        bot_id: botId,
        name: catName.trim(),
        slug: catSlug.trim() || slugify(catName),
        description: catDesc.trim(),
        icon: catIcon,
      };

      let res: Response;
      if (editingCategoryId) {
        res = await fetchBackend(`/api/admin/kb/categories/${editingCategoryId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      } else {
        res = await fetchBackend(`/api/admin/kb/categories`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      }

      if (res.ok) {
        showToast(editingCategoryId ? "Category updated." : "Category created.");
        setCategoryModalOpen(false);
        setCatName("");
        setCatSlug("");
        setCatDesc("");
        setEditingCategoryId(null);
        await loadData();
      }
    } catch (err) {
      console.error(err);
      showToast("Failed to save category.");
    } finally {
      setSavingCategory(false);
    }
  };

  // Delete category
  const handleDeleteCategory = async (id: string, name: string) => {
    if (!confirm(`Delete category "${name}"? Articles inside will become unassigned.`)) return;
    try {
      const res = await fetchBackend(`/api/admin/kb/categories/${id}`, { method: "DELETE" });
      if (res.ok) {
        showToast("Category deleted.");
        await loadData();
      }
    } catch (err) {
      console.error(err);
      showToast("Failed to delete category.");
    }
  };

  // Formatting insert helpers for WYSIWYG markdown toolbar
  const insertFormatting = (prefix: string, suffix: string = "") => {
    const textarea = document.getElementById("kb-article-textarea") as HTMLTextAreaElement | null;
    if (!textarea) {
      setEditorContent((prev) => prev + prefix + suffix);
      return;
    }
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selected = editorContent.slice(start, end);
    const replacement = prefix + (selected || "text") + suffix;
    const newContent = editorContent.slice(0, start) + replacement + editorContent.slice(end);
    setEditorContent(newContent);
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + prefix.length, start + replacement.length - suffix.length);
    }, 0);
  };

  // Filtered articles
  const filteredArticles = useMemo(() => {
    return articles.filter((a) => {
      const matchesSearch =
        !searchFilter ||
        a.title.toLowerCase().includes(searchFilter.toLowerCase()) ||
        a.content.toLowerCase().includes(searchFilter.toLowerCase()) ||
        (a.tags || []).some((t) => t.toLowerCase().includes(searchFilter.toLowerCase()));

      const matchesCat =
        categoryFilter === "all" ||
        (categoryFilter === "none" && !a.category_id) ||
        a.category_id === categoryFilter;

      const matchesStatus = statusFilter === "all" || a.status === statusFilter;

      return matchesSearch && matchesCat && matchesStatus;
    });
  }, [articles, searchFilter, categoryFilter, statusFilter]);

  return (
    <div className="max-w-5xl mx-auto w-full py-6 px-4 space-y-6">
      {/* Toast Alert */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 px-4 py-3 rounded-xl shadow-xl text-xs font-semibold flex items-center gap-2.5 animate-in fade-in slide-in-from-bottom-3">
          <Check className="size-4 text-green-500" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header with Title & Public Portal link */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2">
            <BookOpen className="size-5 text-[#f97316]" />
            <h3 className="text-sm font-bold text-neutral-900 dark:text-white">
              Enterprise Knowledge Base &amp; Help Center
            </h3>
            <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-[#f97316]/10 text-[#f97316]">
              Zendesk Guide Level
            </span>
          </div>
          <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1 leading-relaxed max-w-2xl">
            Author structured documentation, publish public customer help guides, deflect support tickets automatically, and track search content gaps. All published guides automatically train your AI bot.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <a
            href={`/kb/${botId}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-[11px] font-semibold bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-800 dark:text-neutral-200 px-3 py-1.5 rounded-lg transition-colors cursor-pointer"
          >
            <ExternalLink className="size-3.5 text-[#f97316]" />
            View Public Help Center
          </a>
          <button
            onClick={loadData}
            disabled={loading}
            className="flex items-center gap-1.5 text-[11px] font-semibold border border-neutral-200 dark:border-neutral-800 rounded-lg px-3 py-1.5 hover:bg-neutral-50 dark:hover:bg-neutral-800 text-neutral-600 dark:text-neutral-350 transition-colors cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`size-3.5 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Sub-Navigation Tabs */}
      <div className="flex items-center gap-1 border-b border-neutral-200 dark:border-neutral-800 pb-2 overflow-x-auto">
        {[
          { id: "articles", label: "Articles & Guides", icon: BookOpen, count: articles.length },
          { id: "categories", label: "Categories & Structure", icon: Folder, count: categories.length },
          { id: "analytics", label: "Insights & Content Gaps", icon: BarChart2, count: analytics?.content_gaps.length },
          { id: "sources", label: "Raw Sources & Crawlers", icon: Database },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = subTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setSubTab(tab.id as any)}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                isActive
                  ? "bg-[#f97316]/10 text-[#f97316] font-bold"
                  : "text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-850"
              }`}
            >
              <Icon className="size-4" />
              <span>{tab.label}</span>
              {typeof tab.count === "number" && (
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                    isActive
                      ? "bg-[#f97316] text-white"
                      : "bg-neutral-100 dark:bg-neutral-800 text-neutral-500"
                  }`}
                >
                  {tab.count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* SUBTAB 1: ARTICLES & GUIDES */}
      {subTab === "articles" && (
        <div className="space-y-6">
          {/* KPI Mini-Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <div className="p-3.5 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl">
              <span className="text-[10px] text-neutral-400 font-semibold uppercase tracking-wider">Published Guides</span>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-2xl font-bold">{articles.filter((a) => a.status === "published").length}</span>
                <span className="text-[10px] text-neutral-400">/ {articles.length} total</span>
              </div>
            </div>
            <div className="p-3.5 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl">
              <span className="text-[10px] text-neutral-400 font-semibold uppercase tracking-wider">Help Center Views</span>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-2xl font-bold">{analytics?.total_views || 0}</span>
                <span className="text-[10px] text-neutral-400">reads</span>
              </div>
            </div>
            <div className="p-3.5 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl">
              <span className="text-[10px] text-neutral-400 font-semibold uppercase tracking-wider">Article CSAT Rating</span>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-2xl font-bold text-green-500">{analytics?.csat_percent || 100}%</span>
                <span className="text-[10px] text-neutral-400">helpful</span>
              </div>
            </div>
            <div className="p-3.5 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl">
              <span className="text-[10px] text-neutral-400 font-semibold uppercase tracking-wider">Content Gaps</span>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-2xl font-bold text-amber-500">{analytics?.content_gaps.length || 0}</span>
                <span className="text-[10px] text-neutral-400">unanswered</span>
              </div>
            </div>
          </div>

          {/* Action Toolbar */}
          <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 flex-1 min-w-[260px]">
              <div className="relative flex-1">
                <Search className="size-3.5 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search articles by title, tag, or content..."
                  value={searchFilter}
                  onChange={(e) => setSearchFilter(e.target.value)}
                  className="w-full bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-xl pl-9 pr-3 py-1.5 text-xs focus:outline-none focus:border-[#f97316]"
                />
              </div>

              {/* Category Filter */}
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-xl px-2.5 py-1.5 text-xs focus:outline-none"
              >
                <option value="all">All Categories</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
                <option value="none">Uncategorized</option>
              </select>

              {/* Status Filter */}
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-xl px-2.5 py-1.5 text-xs focus:outline-none"
              >
                <option value="all">All Statuses</option>
                <option value="published">Published</option>
                <option value="draft">Draft</option>
                <option value="archived">Archived</option>
              </select>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => handleOpenEditor()}
                className="flex items-center gap-1.5 bg-[#f97316] text-white px-3.5 py-2 rounded-xl text-xs font-semibold hover:opacity-90 transition-opacity cursor-pointer shadow-sm"
              >
                <Plus className="size-3.5" />
                New Article
              </button>
            </div>
          </div>

          {/* Articles Table */}
          <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl overflow-hidden shadow-sm">
            {filteredArticles.length === 0 ? (
              <div className="p-12 text-center space-y-3">
                <BookOpen className="size-10 text-neutral-300 dark:text-neutral-700 mx-auto" />
                <h4 className="text-xs font-bold text-neutral-700 dark:text-neutral-300">
                  {articles.length === 0 ? "No articles created yet" : "No articles match your search"}
                </h4>
                <p className="text-[11px] text-neutral-400 max-w-sm mx-auto">
                  {articles.length === 0
                    ? "Create your first Help Center guide. Published articles appear on your public portal and instantly feed the AI assistant."
                    : "Try clearing your search query or changing category filters."}
                </p>
                {articles.length === 0 && (
                  <button
                    onClick={() => handleOpenEditor()}
                    className="inline-flex items-center gap-1.5 bg-[#f97316] text-white px-4 py-2 rounded-xl text-xs font-semibold hover:opacity-90 transition-opacity cursor-pointer mt-2"
                  >
                    <Plus className="size-3.5" /> Create Article
                  </button>
                )}
              </div>
            ) : (
              <div className="divide-y divide-neutral-100 dark:divide-neutral-850">
                {filteredArticles.map((art) => {
                  const CatIcon = getCategoryIcon(art.category?.icon);
                  return (
                    <div
                      key={art.id}
                      className="p-4 hover:bg-neutral-50/70 dark:hover:bg-neutral-850/40 transition-colors flex items-center justify-between gap-4 flex-wrap"
                    >
                      <div className="flex items-start gap-3 min-w-0 flex-1">
                        <div className="size-8 rounded-lg bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center text-neutral-500 shrink-0 mt-0.5">
                          <CatIcon className="size-4 text-[#f97316]" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h4 className="text-xs font-bold text-neutral-900 dark:text-white truncate max-w-md">
                              {art.title}
                            </h4>
                            {art.is_promoted && (
                              <span className="inline-flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-amber-50 dark:bg-amber-950/30 text-amber-600 dark:text-amber-400 border border-amber-200/50">
                                <Sparkles className="size-2.5" /> Featured
                              </span>
                            )}
                            <span
                              className={`text-[9px] font-bold px-2 py-0.5 rounded-full capitalize ${
                                art.status === "published"
                                  ? "bg-green-50 dark:bg-green-950/30 text-green-600 dark:text-green-400"
                                  : art.status === "draft"
                                  ? "bg-neutral-100 dark:bg-neutral-800 text-neutral-500"
                                  : "bg-red-50 text-red-600"
                              }`}
                            >
                              {art.status}
                            </span>
                            <span
                              className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${
                                art.visibility === "public"
                                  ? "bg-blue-50 dark:bg-blue-950/30 text-blue-600 dark:text-blue-400"
                                  : "bg-purple-50 dark:bg-purple-950/30 text-purple-600 dark:text-purple-400"
                              }`}
                            >
                              {art.visibility === "public" ? "Public Portal" : "Internal Staff"}
                            </span>
                          </div>

                          <div className="flex items-center gap-3 mt-1.5 text-[10px] text-neutral-400 flex-wrap">
                            {art.category ? (
                              <span className="font-semibold text-neutral-600 dark:text-neutral-300">
                                {art.category.name}
                              </span>
                            ) : (
                              <span className="italic">Uncategorized</span>
                            )}
                            <span>•</span>
                            <span className="flex items-center gap-1">
                              <Eye className="size-3" /> {(art.view_count || 0).toLocaleString()} views
                            </span>
                            <span>•</span>
                            <span className="flex items-center gap-1 text-green-600 dark:text-green-400">
                              <ThumbsUp className="size-2.5" /> {art.helpful_count || 0}
                            </span>
                            <span className="flex items-center gap-1 text-red-500">
                              <ThumbsDown className="size-2.5" /> {art.not_helpful_count || 0}
                            </span>
                            <span>•</span>
                            <span>Updated {new Date(art.updated_at).toLocaleDateString()}</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {art.status === "published" && art.visibility === "public" && (
                          <a
                            href={`/kb/${botId}?article=${art.slug}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-1.5 text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors cursor-pointer"
                            title="View on customer portal"
                          >
                            <ExternalLink className="size-3.5" />
                          </a>
                        )}
                        <button
                          onClick={() => handleOpenEditor(art)}
                          className="p-1.5 text-neutral-500 hover:text-[#f97316] rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors cursor-pointer"
                          title="Edit article"
                        >
                          <Edit3 className="size-3.5" />
                        </button>
                        <button
                          onClick={() => handleDeleteArticle(art.id, art.title)}
                          className="p-1.5 text-neutral-400 hover:text-red-500 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors cursor-pointer"
                          title="Delete article"
                        >
                          <Trash2 className="size-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* SUBTAB 2: CATEGORIES & STRUCTURE */}
      {subTab === "categories" && (
        <div className="space-y-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h4 className="text-xs font-bold text-neutral-800 dark:text-neutral-200">
                Help Center Categories
              </h4>
              <p className="text-[11px] text-neutral-400 mt-0.5">
                Organize your articles into clear topics (e.g., Getting Started, Billing, Troubleshooting).
              </p>
            </div>
            <button
              onClick={() => {
                setEditingCategoryId(null);
                setCatName("");
                setCatSlug("");
                setCatDesc("");
                setCatIcon("Folder");
                setCategoryModalOpen(true);
              }}
              className="flex items-center gap-1.5 bg-[#f97316] text-white px-3.5 py-2 rounded-xl text-xs font-semibold hover:opacity-90 transition-opacity cursor-pointer shadow-sm"
            >
              <Plus className="size-3.5" />
              New Category
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {categories.map((cat) => {
              const IconComponent = getCategoryIcon(cat.icon);
              return (
                <div
                  key={cat.id}
                  className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl p-4 flex flex-col justify-between space-y-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="size-10 rounded-xl bg-[#f97316]/10 text-[#f97316] flex items-center justify-center shrink-0">
                      <IconComponent className="size-5" />
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => {
                          setEditingCategoryId(cat.id);
                          setCatName(cat.name);
                          setCatSlug(cat.slug);
                          setCatDesc(cat.description || "");
                          setCatIcon(cat.icon || "Folder");
                          setCategoryModalOpen(true);
                        }}
                        className="p-1 text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 transition-colors"
                        title="Edit category"
                      >
                        <Edit3 className="size-3" />
                      </button>
                      <button
                        onClick={() => handleDeleteCategory(cat.id, cat.name)}
                        className="p-1 text-neutral-400 hover:text-red-500 transition-colors"
                        title="Delete category"
                      >
                        <Trash2 className="size-3" />
                      </button>
                    </div>
                  </div>

                  <div>
                    <h5 className="text-xs font-bold text-neutral-900 dark:text-white truncate">
                      {cat.name}
                    </h5>
                    <p className="text-[11px] text-neutral-400 mt-1 line-clamp-2 leading-relaxed">
                      {cat.description || "No description provided."}
                    </p>
                  </div>

                  <div className="pt-2 border-t border-neutral-100 dark:border-neutral-800 flex items-center justify-between text-[10px] text-neutral-400">
                    <span className="font-semibold text-neutral-600 dark:text-neutral-300">
                      {cat.article_count || 0} articles
                    </span>
                    <span className="font-mono text-[9px] bg-neutral-100 dark:bg-neutral-800 px-1.5 py-0.5 rounded">
                      /{cat.slug}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* SUBTAB 3: CONTENT GAPS & ANALYTICS */}
      {subTab === "analytics" && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Content Gap Detector */}
            <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl p-5 space-y-4">
              <div className="flex items-center gap-2">
                <AlertTriangle className="size-4 text-amber-500" />
                <h4 className="text-xs font-bold uppercase tracking-wider text-neutral-900 dark:text-white">
                  Content Gap Detector
                </h4>
                <span className="text-[10px] bg-amber-50 dark:bg-amber-950/30 text-amber-600 font-bold px-2 py-0.5 rounded-full">
                  Zendesk AI Level
                </span>
              </div>
              <p className="text-[11px] text-neutral-400 leading-relaxed">
                Queries visitors searched for in your Help Center that yielded 0 results. Click &ldquo;Draft Article&rdquo; to fill the gap immediately.
              </p>

              <div className="divide-y divide-neutral-100 dark:divide-neutral-800 max-h-[360px] overflow-y-auto pr-1">
                {(analytics?.content_gaps || []).length === 0 ? (
                  <div className="p-8 text-center text-xs text-neutral-400">
                    <Check className="size-6 text-green-500 mx-auto mb-2" />
                    No missing content detected. Your help center covers all visitor searches!
                  </div>
                ) : (
                  analytics?.content_gaps.map((gap, i) => (
                    <div key={i} className="py-2.5 flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-neutral-800 dark:text-neutral-200 truncate">
                          &ldquo;{gap.query}&rdquo;
                        </p>
                        <span className="text-[10px] text-neutral-400">
                          Searched {gap.count} time{gap.count > 1 ? "s" : ""} with 0 results
                        </span>
                      </div>
                      <button
                        onClick={() => {
                          const capTitle = gap.query.charAt(0).toUpperCase() + gap.query.slice(1);
                          handleOpenEditor(undefined, capTitle);
                        }}
                        className="px-2.5 py-1 bg-[#f97316]/10 text-[#f97316] hover:bg-[#f97316] hover:text-white rounded-lg text-[10px] font-bold transition-colors cursor-pointer shrink-0"
                      >
                        Draft Article →
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Top Performing Articles */}
            <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl p-5 space-y-4">
              <div className="flex items-center gap-2">
                <BarChart2 className="size-4 text-[#f97316]" />
                <h4 className="text-xs font-bold uppercase tracking-wider text-neutral-900 dark:text-white">
                  Most Viewed Guides
                </h4>
              </div>
              <p className="text-[11px] text-neutral-400 leading-relaxed">
                Articles driving the highest self-service deflection and customer satisfaction.
              </p>

              <div className="divide-y divide-neutral-100 dark:divide-neutral-800">
                {(analytics?.top_articles || []).length === 0 ? (
                  <div className="p-8 text-center text-xs text-neutral-400">
                    No article views recorded yet.
                  </div>
                ) : (
                  analytics?.top_articles.map((art, idx) => (
                    <div key={art.id} className="py-2.5 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span className="text-xs font-bold text-neutral-400 w-4">{idx + 1}.</span>
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-neutral-800 dark:text-neutral-200 truncate">
                            {art.title}
                          </p>
                          <span className="text-[10px] text-neutral-400">
                            {art.view_count} views • {art.helpful_count} helpful
                          </span>
                        </div>
                      </div>
                      <span className="text-xs font-bold text-green-500 shrink-0">
                        {art.helpful_count + art.not_helpful_count > 0
                          ? Math.round((art.helpful_count / (art.helpful_count + art.not_helpful_count)) * 100) + "% CSAT"
                          : "100% CSAT"}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SUBTAB 4: RAW SOURCES & CRAWLERS */}
      {subTab === "sources" && (
        <div className="space-y-6">
          {rawSourcesContent}
        </div>
      )}

      {/* ARTICLE EDITOR MODAL */}
      {editorOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6 animate-in fade-in">
          <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-3xl w-full max-w-4xl h-[90vh] flex flex-col shadow-2xl overflow-hidden">
            {/* Modal Header */}
            <div className="p-4 border-b border-neutral-200 dark:border-neutral-800 flex items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <BookOpen className="size-4 text-[#f97316]" />
                <h3 className="text-xs font-bold text-neutral-900 dark:text-white">
                  {editingArticleId ? "Edit Help Center Article" : "Create Help Center Article"}
                </h3>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleSaveArticle("draft")}
                  disabled={savingArticle}
                  className="px-3 py-1.5 rounded-xl border border-neutral-200 dark:border-neutral-800 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 text-xs font-semibold cursor-pointer disabled:opacity-50"
                >
                  Save Draft
                </button>
                <button
                  type="button"
                  onClick={() => handleSaveArticle("published")}
                  disabled={savingArticle}
                  className="px-4 py-1.5 rounded-xl bg-[#f97316] text-white hover:opacity-90 text-xs font-semibold cursor-pointer flex items-center gap-1.5 disabled:opacity-50 shadow-sm"
                >
                  {savingArticle ? <RefreshCw className="size-3.5 animate-spin" /> : <Check className="size-3.5" />}
                  Publish &amp; Train Bot
                </button>
                <button
                  type="button"
                  onClick={() => setEditorOpen(false)}
                  className="p-1.5 text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 rounded-lg"
                >
                  <X className="size-4" />
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              {/* Title & Slug */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="md:col-span-2">
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-neutral-400 mb-1">
                    Article Title
                  </label>
                  <input
                    type="text"
                    value={editorTitle}
                    onChange={(e) => handleTitleChange(e.target.value)}
                    placeholder="e.g. How to set up custom domain SSL"
                    className="w-full bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-xl px-3 py-2 text-xs font-semibold focus:outline-none focus:border-[#f97316]"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-neutral-400 mb-1">
                    URL Slug
                  </label>
                  <input
                    type="text"
                    value={editorSlug}
                    onChange={(e) => setEditorSlug(slugify(e.target.value))}
                    placeholder="e.g. custom-domain-ssl"
                    className="w-full bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-xl px-3 py-2 text-xs font-mono focus:outline-none"
                  />
                </div>
              </div>

              {/* Category, Status, Visibility */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-neutral-400 mb-1">
                    Category
                  </label>
                  <select
                    value={editorCategoryId}
                    onChange={(e) => setEditorCategoryId(e.target.value)}
                    className="w-full bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-xl px-3 py-2 text-xs focus:outline-none"
                  >
                    <option value="">Uncategorized</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-neutral-400 mb-1">
                    Status
                  </label>
                  <select
                    value={editorStatus}
                    onChange={(e) => setEditorStatus(e.target.value as any)}
                    className="w-full bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-xl px-3 py-2 text-xs focus:outline-none"
                  >
                    <option value="published">Published (Public)</option>
                    <option value="draft">Draft (Private)</option>
                    <option value="archived">Archived</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-neutral-400 mb-1">
                    Visibility
                  </label>
                  <select
                    value={editorVisibility}
                    onChange={(e) => setEditorVisibility(e.target.value as any)}
                    className="w-full bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-xl px-3 py-2 text-xs focus:outline-none"
                  >
                    <option value="public">Public (Help Center)</option>
                    <option value="internal_only">Internal (Team Only)</option>
                  </select>
                </div>
              </div>

              {/* Subtitle */}
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-neutral-400 mb-1">
                  Summary / Subtitle
                </label>
                <input
                  type="text"
                  value={editorSubtitle}
                  onChange={(e) => setEditorSubtitle(e.target.value)}
                  placeholder="Brief 1-sentence summary displayed in search results and cards..."
                  className="w-full bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-xl px-3 py-2 text-xs focus:outline-none"
                />
              </div>

              {/* Tags & Promoted Toggle */}
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <div className="flex items-center gap-2 flex-1 min-w-[260px]">
                  <Tag className="size-3.5 text-neutral-400 shrink-0" />
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {editorTags.map((t) => (
                      <span
                        key={t}
                        className="bg-neutral-100 dark:bg-neutral-800 text-[10px] font-semibold px-2 py-0.5 rounded-full flex items-center gap-1 text-neutral-600 dark:text-neutral-300"
                      >
                        {t}
                        <button
                          type="button"
                          onClick={() => setEditorTags(editorTags.filter((x) => x !== t))}
                          className="hover:text-red-500 cursor-pointer"
                        >
                          ✕
                        </button>
                      </span>
                    ))}
                    <input
                      type="text"
                      placeholder="Add tag + Enter"
                      value={editorTagInput}
                      onChange={(e) => setEditorTagInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && editorTagInput.trim()) {
                          e.preventDefault();
                          const val = editorTagInput.trim().toLowerCase();
                          if (!editorTags.includes(val)) {
                            setEditorTags([...editorTags, val]);
                          }
                          setEditorTagInput("");
                        }
                      }}
                      className="bg-transparent text-xs outline-none w-24 py-1"
                    />
                  </div>
                </div>

                <label className="flex items-center gap-2 text-xs font-semibold cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={editorPromoted}
                    onChange={(e) => setEditorPromoted(e.target.checked)}
                    className="accent-[#f97316] rounded"
                  />
                  <span>Pin / Feature on Homepage</span>
                </label>
              </div>

              {/* Editor Tabs & Markdown Formatting Toolbar */}
              <div className="border border-neutral-200 dark:border-neutral-800 rounded-2xl overflow-hidden flex flex-col flex-1">
                <div className="bg-neutral-50 dark:bg-neutral-950 p-2 border-b border-neutral-200 dark:border-neutral-800 flex items-center justify-between gap-2 flex-wrap">
                  {/* Formatting Buttons */}
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => insertFormatting("# ")}
                      className="p-1.5 hover:bg-neutral-200 dark:hover:bg-neutral-800 rounded text-neutral-600 dark:text-neutral-300 text-xs font-bold"
                      title="Heading 1"
                    >
                      H1
                    </button>
                    <button
                      type="button"
                      onClick={() => insertFormatting("## ")}
                      className="p-1.5 hover:bg-neutral-200 dark:hover:bg-neutral-800 rounded text-neutral-600 dark:text-neutral-300 text-xs font-bold"
                      title="Heading 2"
                    >
                      H2
                    </button>
                    <button
                      type="button"
                      onClick={() => insertFormatting("### ")}
                      className="p-1.5 hover:bg-neutral-200 dark:hover:bg-neutral-800 rounded text-neutral-600 dark:text-neutral-300 text-xs font-bold"
                      title="Heading 3"
                    >
                      H3
                    </button>
                    <div className="h-4 w-px bg-neutral-300 dark:bg-neutral-700 mx-1" />
                    <button
                      type="button"
                      onClick={() => insertFormatting("**", "**")}
                      className="p-1.5 hover:bg-neutral-200 dark:hover:bg-neutral-800 rounded text-neutral-600 dark:text-neutral-300"
                      title="Bold"
                    >
                      <Bold className="size-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => insertFormatting("*", "*")}
                      className="p-1.5 hover:bg-neutral-200 dark:hover:bg-neutral-800 rounded text-neutral-600 dark:text-neutral-300"
                      title="Italic"
                    >
                      <Italic className="size-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => insertFormatting("`", "`")}
                      className="p-1.5 hover:bg-neutral-200 dark:hover:bg-neutral-800 rounded text-neutral-600 dark:text-neutral-300"
                      title="Code inline"
                    >
                      <Code className="size-3.5" />
                    </button>
                    <div className="h-4 w-px bg-neutral-300 dark:bg-neutral-700 mx-1" />
                    <button
                      type="button"
                      onClick={() => insertFormatting("- ")}
                      className="p-1.5 hover:bg-neutral-200 dark:hover:bg-neutral-800 rounded text-neutral-600 dark:text-neutral-300"
                      title="Bullet list"
                    >
                      <List className="size-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => insertFormatting("1. ")}
                      className="p-1.5 hover:bg-neutral-200 dark:hover:bg-neutral-800 rounded text-neutral-600 dark:text-neutral-300"
                      title="Numbered list"
                    >
                      <ListOrdered className="size-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => insertFormatting("> ")}
                      className="p-1.5 hover:bg-neutral-200 dark:hover:bg-neutral-800 rounded text-neutral-600 dark:text-neutral-300"
                      title="Quote"
                    >
                      <Quote className="size-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        insertFormatting(
                          "\n| Feature | Description |\n|---|---|\n| Item 1 | Description 1 |\n"
                        )
                      }
                      className="p-1.5 hover:bg-neutral-200 dark:hover:bg-neutral-800 rounded text-neutral-600 dark:text-neutral-300"
                      title="Insert Table"
                    >
                      <TableIcon className="size-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => insertFormatting("\n> [!NOTE]\n> ")}
                      className="p-1.5 hover:bg-neutral-200 dark:hover:bg-neutral-800 rounded text-neutral-600 dark:text-neutral-300"
                      title="Note Callout"
                    >
                      <Info className="size-3.5 text-blue-500" />
                    </button>
                  </div>

                  {/* Write vs Preview toggle */}
                  <div className="flex items-center gap-1 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-lg p-0.5">
                    <button
                      type="button"
                      onClick={() => setEditorTab("write")}
                      className={`px-3 py-1 rounded text-xs font-semibold transition-colors ${
                        editorTab === "write"
                          ? "bg-[#f97316] text-white"
                          : "text-neutral-500 hover:text-neutral-800"
                      }`}
                    >
                      Write
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditorTab("preview")}
                      className={`px-3 py-1 rounded text-xs font-semibold transition-colors ${
                        editorTab === "preview"
                          ? "bg-[#f97316] text-white"
                          : "text-neutral-500 hover:text-neutral-800"
                      }`}
                    >
                      Preview
                    </button>
                  </div>
                </div>

                {/* Main Content Area */}
                {editorTab === "write" ? (
                  <textarea
                    id="kb-article-textarea"
                    rows={14}
                    value={editorContent}
                    onChange={(e) => setEditorContent(e.target.value)}
                    placeholder="Write detailed guide in markdown... Markdown tables, code blocks, images, and links are supported."
                    className="w-full p-4 bg-white dark:bg-neutral-900 text-xs font-mono focus:outline-none resize-y leading-relaxed"
                  />
                ) : (
                  <div className="p-6 bg-white dark:bg-neutral-900 overflow-y-auto max-h-[400px]">
                    <article className="prose dark:prose-invert prose-xs text-neutral-700 dark:text-neutral-300 max-w-none leading-relaxed space-y-3">
                      <ReactMarkdown remarkPlugins={[remarkGfm]} components={{ a: SafeMarkdownLink }}>
                        {editorContent || "*No content written yet.*"}
                      </ReactMarkdown>
                    </article>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* CATEGORY MODAL */}
      {categoryModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-3xl w-full max-w-md p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-neutral-900 dark:text-white">
                {editingCategoryId ? "Edit Category" : "New Help Center Category"}
              </h3>
              <button
                onClick={() => setCategoryModalOpen(false)}
                className="text-neutral-400 hover:text-neutral-700"
              >
                <X className="size-4" />
              </button>
            </div>

            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-neutral-400 mb-1">
                Name
              </label>
              <input
                type="text"
                value={catName}
                onChange={(e) => {
                  setCatName(e.target.value);
                  if (!editingCategoryId) setCatSlug(slugify(e.target.value));
                }}
                placeholder="e.g. Getting Started"
                className="w-full bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-xl px-3 py-2 text-xs font-semibold focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-neutral-400 mb-1">
                Slug
              </label>
              <input
                type="text"
                value={catSlug}
                onChange={(e) => setCatSlug(slugify(e.target.value))}
                placeholder="e.g. getting-started"
                className="w-full bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-xl px-3 py-2 text-xs font-mono focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-neutral-400 mb-1">
                Description
              </label>
              <textarea
                rows={2}
                value={catDesc}
                onChange={(e) => setCatDesc(e.target.value)}
                placeholder="Brief summary of articles in this topic..."
                className="w-full bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-xl px-3 py-2 text-xs focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-neutral-400 mb-1">
                Icon
              </label>
              <div className="grid grid-cols-5 gap-2">
                {CATEGORY_ICONS.map((item) => {
                  const Icon = item.icon;
                  return (
                    <button
                      key={item.name}
                      type="button"
                      onClick={() => setCatIcon(item.name)}
                      className={`p-2 rounded-xl border flex items-center justify-center transition-colors cursor-pointer ${
                        catIcon === item.name
                          ? "border-[#f97316] bg-[#f97316]/10 text-[#f97316]"
                          : "border-neutral-200 dark:border-neutral-800 hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-500"
                      }`}
                    >
                      <Icon className="size-4" />
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setCategoryModalOpen(false)}
                className="px-3.5 py-2 rounded-xl text-xs font-semibold text-neutral-500 hover:text-neutral-800"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveCategory}
                disabled={savingCategory || !catName.trim()}
                className="px-4 py-2 bg-[#f97316] text-white rounded-xl text-xs font-semibold hover:opacity-90 disabled:opacity-50"
              >
                {savingCategory ? "Saving..." : "Save Category"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
