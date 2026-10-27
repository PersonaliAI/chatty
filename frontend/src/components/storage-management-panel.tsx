"use client";

import { useEffect, useState } from "react";
import {
  HardDrive,
  Trash2,
  RefreshCw,
  FileText,
  Image as ImageIcon,
  Music,
  ExternalLink,
  ShieldAlert,
  Calendar,
  Layers,
  Search,
  CheckSquare,
  Square,
  AlertCircle,
  Database,
  Clock,
  Sparkles,
  Bot as BotIcon,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { fetchBackend } from "@/lib/backend-client";

export interface StorageFile {
  id: string;
  name: string;
  path: string;
  bucket: string;
  category: "visitor_uploads" | "catalog_media" | "branding_assets" | "knowledge_sources";
  category_label: string;
  size_bytes: number;
  size_formatted: string;
  created_at: string | null;
  url: string | null;
  session_id?: string | null;
  mimetype?: string;
  status?: string;
  bot_id?: string | null;
  bot_name?: string | null;
}

export interface StorageCategoryStats {
  name: string;
  bytes: number;
  mb: number;
  count: number;
  percent: number;
}

export interface StorageBotOption {
  id: string;
  name: string;
}

export interface StorageData {
  bot_id: string;
  account_wide?: boolean;
  bots?: StorageBotOption[];
  total_bytes: number;
  total_mb: number;
  limit_mb: number | null;
  unlimited: boolean;
  usage_percent: number;
  plan: string;
  categories: {
    visitor_uploads: StorageCategoryStats;
    catalog_media: StorageCategoryStats;
    branding_assets: StorageCategoryStats;
    knowledge_sources: StorageCategoryStats;
  };
  files_count: number;
  files: StorageFile[];
}

interface StorageManagementPanelProps {
  botId?: string;
  onStorageUpdated?: () => void;
}

export function StorageManagementPanel({ botId, onStorageUpdated }: StorageManagementPanelProps) {
  const supabase = createClient();
  const [data, setData] = useState<StorageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters & Search
  const [activeCategory, setActiveCategory] = useState<string>("all");
  const [selectedBotFilter, setSelectedBotFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedPaths, setSelectedPaths] = useState<Set<string>>(new Set());

  // Action states
  const [deleting, setDeleting] = useState(false);
  const [cleanupDays, setCleanupDays] = useState(30);
  const [cleaningUp, setCleaningUp] = useState(false);
  const [actionNotice, setActionNotice] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const loadStorage = async () => {
    try {
      setLoading(true);
      setError(null);
      // Query account-wide storage first; fallback to bot-scoped if needed
      let res = await fetchBackend(supabase, `/api/account/storage`);
      if (!res.ok && botId) {
        res = await fetchBackend(supabase, `/api/bots/${botId}/storage?account_wide=true`);
      }
      if (res.ok) {
        const json = await res.json();
        setData(json);
      } else {
        const errJson = await res.json().catch(() => ({}));
        setError(errJson.detail || "Failed to load storage details");
      }
    } catch (err: any) {
      setError(err?.message || "Storage connection error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStorage();
  }, [botId]);

  const handleDeleteSelected = async () => {
    if (selectedPaths.size === 0 || !data) return;
    const count = selectedPaths.size;
    if (!confirm(`Are you sure you want to permanently delete ${count} file(s)? This will free up storage immediately.`)) {
      return;
    }

    try {
      setDeleting(true);
      setActionNotice(null);

      const filesToDelete = data.files
        .filter((f) => selectedPaths.has(f.path))
        .map((f) => ({ bucket: f.bucket, path: f.path }));

      let res = await fetchBackend(supabase, `/api/account/storage/files`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ files: filesToDelete }),
      });

      if (!res.ok && botId) {
        res = await fetchBackend(supabase, `/api/bots/${botId}/storage/files`, {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ files: filesToDelete }),
        });
      }

      if (res.ok) {
        const resJson = await res.json();
        setActionNotice({
          type: "success",
          text: resJson.message || `Deleted ${count} file(s) and freed up space.`,
        });
        setSelectedPaths(new Set());
        await loadStorage();
        onStorageUpdated?.();
      } else {
        const err = await res.json().catch(() => ({}));
        setActionNotice({ type: "error", text: err.detail || "Failed to delete files" });
      }
    } catch (err: any) {
      setActionNotice({ type: "error", text: err?.message || "Deletion error" });
    } finally {
      setDeleting(false);
    }
  };

  const handleDeleteSingle = async (file: StorageFile) => {
    if (!confirm(`Delete "${file.name}"? This action cannot be undone.`)) return;

    try {
      setDeleting(true);
      setActionNotice(null);

      let res = await fetchBackend(supabase, `/api/account/storage/files`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ files: [{ bucket: file.bucket, path: file.path }] }),
      });

      if (!res.ok && botId) {
        res = await fetchBackend(supabase, `/api/bots/${botId}/storage/files`, {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ files: [{ bucket: file.bucket, path: file.path }] }),
        });
      }

      if (res.ok) {
        setActionNotice({ type: "success", text: `Deleted "${file.name}" successfully.` });
        await loadStorage();
        onStorageUpdated?.();
      } else {
        const err = await res.json().catch(() => ({}));
        setActionNotice({ type: "error", text: err.detail || "Failed to delete file" });
      }
    } catch (err: any) {
      setActionNotice({ type: "error", text: err?.message || "Deletion error" });
    } finally {
      setDeleting(false);
    }
  };

  const handleRetentionCleanup = async () => {
    const scopeLabel = selectedBotFilter === "all" ? "across all chatbots" : "for this chatbot";
    if (!confirm(`Purge visitor chat uploads older than ${cleanupDays} days ${scopeLabel}? This will permanently remove stale customer uploads and reclaim storage.`)) {
      return;
    }

    try {
      setCleaningUp(true);
      setActionNotice(null);

      let res = await fetchBackend(supabase, `/api/account/storage/cleanup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ older_than_days: cleanupDays, bot_id: selectedBotFilter }),
      });

      if (!res.ok && botId) {
        res = await fetchBackend(supabase, `/api/bots/${botId}/storage/cleanup`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ older_than_days: cleanupDays }),
        });
      }

      if (res.ok) {
        const resJson = await res.json();
        setActionNotice({ type: "success", text: resJson.message });
        await loadStorage();
        onStorageUpdated?.();
      } else {
        const err = await res.json().catch(() => ({}));
        setActionNotice({ type: "error", text: err.detail || "Cleanup failed" });
      }
    } catch (err: any) {
      setActionNotice({ type: "error", text: err?.message || "Cleanup error" });
    } finally {
      setCleaningUp(false);
    }
  };

  const filteredFiles = (data?.files || []).filter((f) => {
    // 1. Bot filter
    if (selectedBotFilter !== "all" && f.bot_id && f.bot_id !== selectedBotFilter) {
      return false;
    }
    // 2. Category filter
    if (activeCategory !== "all" && f.category !== activeCategory) {
      return false;
    }
    // 3. Search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        f.name.toLowerCase().includes(q) ||
        (f.session_id && f.session_id.toLowerCase().includes(q)) ||
        (f.bot_name && f.bot_name.toLowerCase().includes(q)) ||
        f.category_label.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const toggleSelectAll = () => {
    if (selectedPaths.size === filteredFiles.length) {
      setSelectedPaths(new Set());
    } else {
      setSelectedPaths(new Set(filteredFiles.map((f) => f.path)));
    }
  };

  const toggleSelectPath = (path: string) => {
    const next = new Set(selectedPaths);
    if (next.has(path)) {
      next.delete(path);
    } else {
      next.add(path);
    }
    setSelectedPaths(next);
  };

  const renderFileIcon = (file: StorageFile) => {
    const lower = file.name.toLowerCase();
    if (lower.endsWith(".png") || lower.endsWith(".jpg") || lower.endsWith(".jpeg") || lower.endsWith(".webp") || lower.endsWith(".jfif")) {
      return <ImageIcon className="size-4 text-sky-500 shrink-0" />;
    }
    if (lower.endsWith(".wav") || lower.endsWith(".mp3") || lower.endsWith(".ogg") || lower.endsWith(".m4a")) {
      return <Music className="size-4 text-purple-500 shrink-0" />;
    }
    if (file.category === "knowledge_sources") {
      return <Database className="size-4 text-amber-500 shrink-0" />;
    }
    return <FileText className="size-4 text-neutral-400 shrink-0" />;
  };

  return (
    <div className="p-6 rounded-3xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-sm space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-sky-50 dark:bg-sky-950/60 text-sky-600 dark:text-sky-400 border border-sky-100 dark:border-sky-800/40">
              <HardDrive className="size-4" />
            </div>
            <h3 className="text-base font-bold text-neutral-900 dark:text-white">
              Storage Usage &amp; Media Management
            </h3>
          </div>
          <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
            Account-wide storage overview across all chatbots. Categorized breakdown of visitor uploads, catalog media, and indexed knowledge.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={loadStorage}
            disabled={loading}
            className="px-3 py-1.5 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800 hover:bg-neutral-100 dark:hover:bg-neutral-700 text-xs font-semibold text-neutral-700 dark:text-neutral-300 flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <RefreshCw className={`size-3.5 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>
      </div>

      {actionNotice && (
        <div
          className={`p-3 rounded-2xl text-xs font-medium flex items-center gap-2 ${
            actionNotice.type === "success"
              ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800"
              : "bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800"
          }`}
        >
          <AlertCircle className="size-4 shrink-0" />
          <span>{actionNotice.text}</span>
        </div>
      )}

      {/* Main Quota Meter & Category Breakdown */}
      {data && (
        <div className="space-y-4">
          <div className="p-4 rounded-2xl bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-200 dark:border-neutral-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-extrabold text-neutral-900 dark:text-white font-mono">
                  {data.total_mb} MB
                </span>
                {data.limit_mb ? (
                  <span className="text-xs text-neutral-400 font-mono">
                    / {data.limit_mb >= 1024 ? `${data.limit_mb / 1024} GB` : `${data.limit_mb} MB`}
                  </span>
                ) : (
                  <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300">
                    Unlimited Storage
                  </span>
                )}
              </div>
              <p className="text-xs text-neutral-500">
                {data.limit_mb
                  ? `${data.usage_percent}% of total storage quota consumed across ${data.files_count} indexed assets.`
                  : `${data.files_count} total assets indexed · Enterprise unmetered tier.`}
              </p>
            </div>

            {/* Storage Meter Bar */}
            <div className="w-full md:w-64 space-y-1.5">
              <div className="flex justify-between text-[11px] font-mono text-neutral-500">
                <span>Usage</span>
                <span>{data.unlimited ? "Active" : `${data.usage_percent}%`}</span>
              </div>
              <div className="w-full h-2.5 rounded-full bg-neutral-200 dark:bg-neutral-700 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    data.usage_percent > 90
                      ? "bg-rose-500"
                      : data.usage_percent > 70
                      ? "bg-amber-500"
                      : "bg-sky-500"
                  }`}
                  style={{ width: `${data.unlimited ? Math.min(100, Math.max(8, (data.total_mb / 1024) * 20)) : Math.min(100, Math.max(3, data.usage_percent))}%` }}
                />
              </div>
            </div>
          </div>

          {/* 4 Category Breakdown Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {/* 1. Visitor Uploads */}
            <div
              onClick={() => setActiveCategory(activeCategory === "visitor_uploads" ? "all" : "visitor_uploads")}
              className={`p-3.5 rounded-2xl border cursor-pointer transition-all ${
                activeCategory === "visitor_uploads"
                  ? "bg-purple-50/60 dark:bg-purple-950/40 border-purple-300 dark:border-purple-700 shadow-xs"
                  : "bg-white dark:bg-neutral-900 border-neutral-200 dark:border-neutral-800 hover:border-neutral-300"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-neutral-500">Visitor Uploads</span>
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-md bg-purple-100 dark:bg-purple-900/60 text-purple-700 dark:text-purple-300 font-bold">
                  {data.categories.visitor_uploads.count} files
                </span>
              </div>
              <p className="text-lg font-bold text-neutral-900 dark:text-white mt-1 font-mono">
                {data.categories.visitor_uploads.mb} MB
              </p>
              <div className="w-full h-1 rounded-full bg-neutral-100 dark:bg-neutral-800 mt-2 overflow-hidden">
                <div
                  className="h-full bg-purple-500 rounded-full"
                  style={{ width: `${Math.min(100, data.categories.visitor_uploads.percent)}%` }}
                />
              </div>
            </div>

            {/* 2. Catalog Media */}
            <div
              onClick={() => setActiveCategory(activeCategory === "catalog_media" ? "all" : "catalog_media")}
              className={`p-3.5 rounded-2xl border cursor-pointer transition-all ${
                activeCategory === "catalog_media"
                  ? "bg-sky-50/60 dark:bg-sky-950/40 border-sky-300 dark:border-sky-700 shadow-xs"
                  : "bg-white dark:bg-neutral-900 border-neutral-200 dark:border-neutral-800 hover:border-neutral-300"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-neutral-500">Catalog Media</span>
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-md bg-sky-100 dark:bg-sky-900/60 text-sky-700 dark:text-sky-300 font-bold">
                  {data.categories.catalog_media.count} items
                </span>
              </div>
              <p className="text-lg font-bold text-neutral-900 dark:text-white mt-1 font-mono">
                {data.categories.catalog_media.mb} MB
              </p>
              <div className="w-full h-1 rounded-full bg-neutral-100 dark:bg-neutral-800 mt-2 overflow-hidden">
                <div
                  className="h-full bg-sky-500 rounded-full"
                  style={{ width: `${Math.min(100, data.categories.catalog_media.percent)}%` }}
                />
              </div>
            </div>

            {/* 3. Knowledge Documents */}
            <div
              onClick={() => setActiveCategory(activeCategory === "knowledge_sources" ? "all" : "knowledge_sources")}
              className={`p-3.5 rounded-2xl border cursor-pointer transition-all ${
                activeCategory === "knowledge_sources"
                  ? "bg-amber-50/60 dark:bg-amber-950/40 border-amber-300 dark:border-amber-700 shadow-xs"
                  : "bg-white dark:bg-neutral-900 border-neutral-200 dark:border-neutral-800 hover:border-neutral-300"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-neutral-500">Knowledge Sources</span>
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-md bg-amber-100 dark:bg-amber-900/60 text-amber-700 dark:text-amber-300 font-bold">
                  {data.categories.knowledge_sources.count} sources
                </span>
              </div>
              <p className="text-lg font-bold text-neutral-900 dark:text-white mt-1 font-mono">
                {data.categories.knowledge_sources.mb} MB
              </p>
              <div className="w-full h-1 rounded-full bg-neutral-100 dark:bg-neutral-800 mt-2 overflow-hidden">
                <div
                  className="h-full bg-amber-500 rounded-full"
                  style={{ width: `${Math.min(100, data.categories.knowledge_sources.percent)}%` }}
                />
              </div>
            </div>

            {/* 4. Branding Assets */}
            <div
              onClick={() => setActiveCategory(activeCategory === "branding_assets" ? "all" : "branding_assets")}
              className={`p-3.5 rounded-2xl border cursor-pointer transition-all ${
                activeCategory === "branding_assets"
                  ? "bg-emerald-50/60 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-700 shadow-xs"
                  : "bg-white dark:bg-neutral-900 border-neutral-200 dark:border-neutral-800 hover:border-neutral-300"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-neutral-500">Branding &amp; Avatars</span>
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-md bg-emerald-100 dark:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300 font-bold">
                  {data.categories.branding_assets.count} files
                </span>
              </div>
              <p className="text-lg font-bold text-neutral-900 dark:text-white mt-1 font-mono">
                {data.categories.branding_assets.mb} MB
              </p>
              <div className="w-full h-1 rounded-full bg-neutral-100 dark:bg-neutral-800 mt-2 overflow-hidden">
                <div
                  className="h-full bg-emerald-500 rounded-full"
                  style={{ width: `${Math.min(100, data.categories.branding_assets.percent)}%` }}
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Retention Policy & Bulk Actions Bar */}
      <div className="p-4 rounded-2xl bg-neutral-50/80 dark:bg-neutral-800/40 border border-neutral-200/80 dark:border-neutral-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="flex items-center gap-2">
            <Clock className="size-4 text-neutral-400" />
            <span className="text-xs font-semibold text-neutral-700 dark:text-neutral-300">
              Retention Cleanup:
            </span>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <select
              value={cleanupDays}
              onChange={(e) => setCleanupDays(Number(e.target.value))}
              className="px-2.5 py-1 text-xs rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-neutral-800 dark:text-neutral-200 font-medium focus:outline-hidden"
            >
              <option value={14}>Older than 14 days</option>
              <option value={30}>Older than 30 days</option>
              <option value={60}>Older than 60 days</option>
              <option value={90}>Older than 90 days</option>
              <option value={180}>Older than 180 days</option>
            </select>
            <button
              onClick={handleRetentionCleanup}
              disabled={cleaningUp || loading}
              className="px-3 py-1 text-xs font-semibold rounded-xl bg-neutral-200 dark:bg-neutral-700 hover:bg-neutral-300 dark:hover:bg-neutral-600 text-neutral-800 dark:text-neutral-100 transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <Trash2 className="size-3" />
              {cleaningUp ? "Purging..." : selectedBotFilter === "all" ? "Purge Stale Visitor Files (All Bots)" : "Purge Stale Visitor Files"}
            </button>
          </div>
        </div>

        {selectedPaths.size > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono text-neutral-500">
              {selectedPaths.size} selected
            </span>
            <button
              onClick={handleDeleteSelected}
              disabled={deleting}
              className="px-3 py-1 text-xs font-semibold rounded-xl bg-rose-600 hover:bg-rose-700 text-white transition-colors flex items-center gap-1.5 shadow-xs cursor-pointer"
            >
              <Trash2 className="size-3" />
              {deleting ? "Deleting..." : `Delete Selected (${selectedPaths.size})`}
            </button>
          </div>
        )}
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pt-2">
        <div className="flex items-center gap-2 flex-wrap">
          {/* Bot Filter Dropdown */}
          {data?.bots && data.bots.length > 0 && (
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] font-semibold text-neutral-500 flex items-center gap-1">
                <BotIcon className="size-3.5 text-sky-500" /> Bot:
              </span>
              <select
                value={selectedBotFilter}
                onChange={(e) => setSelectedBotFilter(e.target.value)}
                className="px-2.5 py-1 text-xs rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white font-semibold focus:outline-hidden"
              >
                <option value="all">🌐 All Chatbots ({data.files_count})</option>
                {data.bots.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Category Tabs */}
          <div className="flex items-center gap-1 overflow-x-auto pb-1 sm:pb-0">
            {[
              { id: "all", label: "All Files" },
              { id: "visitor_uploads", label: "Visitor Uploads" },
              { id: "catalog_media", label: "Catalog Media" },
              { id: "knowledge_sources", label: "Knowledge" },
              { id: "branding_assets", label: "Branding" },
            ].map((cat) => (
              <button
                key={cat.id}
                onClick={() => setActiveCategory(cat.id)}
                className={`px-3 py-1 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer ${
                  activeCategory === cat.id
                    ? "bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 shadow-xs"
                    : "bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-700"
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>
        </div>

        <div className="relative w-full sm:w-56">
          <Search className="absolute left-2.5 top-2.5 size-3.5 text-neutral-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by name, bot, session..."
            className="w-full pl-8 pr-3 py-1.5 text-xs rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white placeholder:text-neutral-400 focus:outline-hidden focus:ring-1 focus:ring-sky-500"
          />
        </div>
      </div>

      {/* Files Table */}
      <div className="border border-neutral-200 dark:border-neutral-800 rounded-2xl overflow-hidden bg-white dark:bg-neutral-900">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-800/60 text-neutral-500 font-semibold">
                <th className="py-2.5 px-3 w-8">
                  <button
                    onClick={toggleSelectAll}
                    className="text-neutral-400 hover:text-neutral-600 flex items-center cursor-pointer"
                  >
                    {selectedPaths.size > 0 && selectedPaths.size === filteredFiles.length ? (
                      <CheckSquare className="size-3.5 text-sky-500" />
                    ) : (
                      <Square className="size-3.5" />
                    )}
                  </button>
                </th>
                <th className="py-2.5 px-3">File / Asset Name</th>
                <th className="py-2.5 px-3">Chatbot</th>
                <th className="py-2.5 px-3">Category</th>
                <th className="py-2.5 px-3">Size</th>
                <th className="py-2.5 px-3">Uploaded / Indexed</th>
                <th className="py-2.5 px-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800/60 font-mono">
              {filteredFiles.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-neutral-400 font-sans">
                    {loading ? "Loading storage assets..." : "No files found matching the criteria."}
                  </td>
                </tr>
              ) : (
                filteredFiles.map((f) => {
                  const isSelected = selectedPaths.has(f.path);
                  return (
                    <tr
                      key={f.id}
                      className={`hover:bg-neutral-50/70 dark:hover:bg-neutral-800/40 transition-colors ${
                        isSelected ? "bg-sky-50/40 dark:bg-sky-950/20" : ""
                      }`}
                    >
                      <td className="py-2.5 px-3">
                        <button
                          onClick={() => toggleSelectPath(f.path)}
                          className="text-neutral-400 hover:text-neutral-600 flex items-center cursor-pointer"
                        >
                          {isSelected ? (
                            <CheckSquare className="size-3.5 text-sky-500" />
                          ) : (
                            <Square className="size-3.5" />
                          )}
                        </button>
                      </td>

                      <td className="py-2.5 px-3 font-sans">
                        <div className="flex items-center gap-2 max-w-xs truncate">
                          {renderFileIcon(f)}
                          <span className="font-medium text-neutral-800 dark:text-neutral-200 truncate" title={f.name}>
                            {f.name}
                          </span>
                        </div>
                        {f.session_id && (
                          <span className="text-[10px] text-neutral-400 font-mono block mt-0.5">
                            session: {f.session_id}
                          </span>
                        )}
                      </td>

                      <td className="py-2.5 px-3 font-sans">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300">
                          <BotIcon className="size-3 text-sky-500" />
                          {f.bot_name || "Bot"}
                        </span>
                      </td>

                      <td className="py-2.5 px-3 font-sans">
                        <span
                          className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                            f.category === "visitor_uploads"
                              ? "bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300"
                              : f.category === "catalog_media"
                              ? "bg-sky-100 dark:bg-sky-950 text-sky-700 dark:text-sky-300"
                              : f.category === "branding_assets"
                              ? "bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300"
                              : "bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300"
                          }`}
                        >
                          {f.category_label}
                        </span>
                      </td>

                      <td className="py-2.5 px-3 text-neutral-700 dark:text-neutral-300 font-mono text-[11px]">
                        {f.size_formatted}
                      </td>

                      <td className="py-2.5 px-3 text-neutral-500 font-sans text-[11px]">
                        {f.created_at ? new Date(f.created_at).toLocaleString() : "—"}
                      </td>

                      <td className="py-2.5 px-3 text-right font-sans">
                        <div className="flex items-center justify-end gap-1.5">
                          {f.url && (
                            <a
                              href={f.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="p-1 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200 transition-colors"
                              title="Open original file"
                            >
                              <ExternalLink className="size-3.5" />
                            </a>
                          )}
                          <button
                            onClick={() => handleDeleteSingle(f)}
                            disabled={deleting}
                            className="p-1 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/40 text-neutral-400 hover:text-rose-600 transition-colors cursor-pointer"
                            title="Delete file permanently"
                          >
                            <Trash2 className="size-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
