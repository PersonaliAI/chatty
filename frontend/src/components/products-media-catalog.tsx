"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  ShoppingBag,
  Store,
  RefreshCw,
  Plus,
  Trash2,
  ExternalLink,
  AlertCircle,
  CheckCircle2,
  Copy,
  Check,
  Video,
  Image as ImageIcon,
  Search,
  Tag,
  Package,
  Layers,
  ArrowUpRight,
  Loader2,
  Sparkles,
  HelpCircle,
  Globe,
  Link2,
  SlidersHorizontal,
  UploadCloud,
  Camera,
  Key,
} from "lucide-react";

export interface MediaItem {
  id: string;
  bot_id: string;
  media_type: "product" | "image" | "video" | "video_frame";
  title: string;
  description?: string;
  sku?: string;
  price?: number;
  currency?: string;
  url?: string;
  media_url: string;
  thumbnail_url?: string;
  video_url?: string;
  video_timestamp_start?: number;
  visual_attributes?: Record<string, any>;
  metadata?: {
    source?: string;
    woocommerce_id?: number | string;
    stock_status?: string;
    in_stock?: boolean;
    categories?: string[];
    tags?: string[];
    [key: string]: any;
  };
  created_at: string;
}

export interface WooCommerceStatus {
  connected: boolean;
  store_url?: string;
  sync_status?: "idle" | "syncing" | "synced" | "failed";
  sync_progress?: number;
  total_products?: number;
  synced_products?: number;
  last_synced_at?: string;
  last_error?: string;
  webhook_url?: string;
  webhook_secret?: string;
  product_count?: number;
}

interface CatalogWebhookStatus {
  configured: boolean;
  enabled: boolean;
  webhook_url?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
}

interface ProductsMediaCatalogProps {
  botId: string;
  fetchWithFallback: (url: string, init?: RequestInit) => Promise<Response>;
  primaryColor?: string;
}

export function ProductsMediaCatalog({
  botId,
  fetchWithFallback,
  primaryColor = "#f97316",
}: ProductsMediaCatalogProps) {
  const [activeSubTab, setActiveSubTab] = useState<"woocommerce" | "manual_product" | "video">("woocommerce");

  // WooCommerce Integration State
  const [wcStatus, setWcStatus] = useState<WooCommerceStatus | null>(null);
  const [loadingWc, setLoadingWc] = useState<boolean>(true);
  const [storeUrl, setStoreUrl] = useState<string>("");
  const [consumerKey, setConsumerKey] = useState<string>("");
  const [consumerSecret, setConsumerSecret] = useState<string>("");
  const [connectingWc, setConnectingWc] = useState<boolean>(false);
  const [wcError, setWcError] = useState<string | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [syncingWc, setSyncingWc] = useState<boolean>(false);
  const [authMode, setAuthMode] = useState<"oauth" | "manual">("oauth");
  const [authorizingWc, setAuthorizingWc] = useState<boolean>(false);
  const [wcSuccessMsg, setWcSuccessMsg] = useState<string | null>(null);
  const [catalogWebhook, setCatalogWebhook] = useState<CatalogWebhookStatus | null>(null);
  const [loadingCatalogWebhook, setLoadingCatalogWebhook] = useState<boolean>(true);
  const [provisioningCatalogWebhook, setProvisioningCatalogWebhook] = useState<boolean>(false);
  const [catalogWebhookSecret, setCatalogWebhookSecret] = useState<string | null>(null);
  const [catalogWebhookError, setCatalogWebhookError] = useState<string | null>(null);

  // Catalog items list state
  const [items, setItems] = useState<MediaItem[]>([]);
  const [loadingItems, setLoadingItems] = useState<boolean>(true);
  const [filterType, setFilterType] = useState<"all" | "product" | "video">("all");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Manual Product Form State
  const [prodTitle, setProdTitle] = useState<string>("");
  const [prodPrice, setProdPrice] = useState<string>("");
  const [prodCurrency, setProdCurrency] = useState<string>("USD");
  const [prodSku, setProdSku] = useState<string>("");
  const [prodExternalId, setProdExternalId] = useState<string>("");
  const [prodUrl, setProdUrl] = useState<string>("");
  const [prodImageUrl, setProdImageUrl] = useState<string>("");
  const [prodDesc, setProdDesc] = useState<string>("");
  const [prodInStock, setProdInStock] = useState<boolean>(true);
  const [savingProduct, setSavingProduct] = useState<boolean>(false);
  const imageFileInputRef = useRef<HTMLInputElement | null>(null);
  const [uploadingImage, setUploadingImage] = useState<boolean>(false);
  const [imageInputMode, setImageInputMode] = useState<"file" | "url">("file");
  const [isDragging, setIsDragging] = useState<boolean>(false);

  const handleImageFileChange = async (file: File) => {
    if (!file || !file.type.startsWith("image/")) return;
    setUploadingImage(true);

    // Instant local preview
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        setProdImageUrl(reader.result);
      }
    };
    reader.readAsDataURL(file);

    // Upload to backend
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetchWithFallback(`/api/bots/${botId}/media-items/upload`, {
        method: "POST",
        body: formData,
      });
      if (res.ok) {
        const data = await res.json();
        if (data.url) {
          setProdImageUrl(data.url);
        }
      }
    } catch (err) {
      console.warn("Upload endpoint failed, keeping local image data URL", err);
    } finally {
      setUploadingImage(false);
    }
  };

  // Manual Video Form State
  const [vidTitle, setVidTitle] = useState<string>("");
  const [vidUrl, setVidUrl] = useState<string>("");
  const [vidExternalId, setVidExternalId] = useState<string>("");
  const [vidTimestamp, setVidTimestamp] = useState<string>("0");
  const [vidThumbnail, setVidThumbnail] = useState<string>("");
  const [vidDesc, setVidDesc] = useState<string>("");
  const [savingVideo, setSavingVideo] = useState<boolean>(false);

  // Fetch WooCommerce Status
  const loadWcStatus = useCallback(async () => {
    if (!botId) return;
    try {
      setLoadingWc(true);
      const res = await fetchWithFallback(`/api/bots/${botId}/integrations/woocommerce`);
      if (res.ok) {
        const data: WooCommerceStatus = await res.json();
        setWcStatus(data);
        if (data.sync_status === "syncing") {
          setSyncingWc(true);
        }
      }
    } catch (err) {
      console.error("Failed to load WooCommerce status", err);
    } finally {
      setLoadingWc(false);
    }
  }, [botId, fetchWithFallback]);

  // Fetch Catalog Items
  const loadCatalogItems = useCallback(async () => {
    if (!botId) return;
    try {
      setLoadingItems(true);
      const res = await fetchWithFallback(`/api/bots/${botId}/media-items?limit=100`);
      if (res.ok) {
        const data = await res.json();
        setItems(data.items || []);
      }
    } catch (err) {
      console.error("Failed to load catalog items", err);
    } finally {
      setLoadingItems(false);
    }
  }, [botId, fetchWithFallback]);

  const loadCatalogWebhook = useCallback(async () => {
    if (!botId) return;
    try {
      setLoadingCatalogWebhook(true);
      const res = await fetchWithFallback(`/api/bots/${botId}/media-webhook`);
      if (res.ok) {
        setCatalogWebhook(await res.json());
        setCatalogWebhookError(null);
      }
    } catch (err) {
      console.error("Failed to load catalog webhook status", err);
    } finally {
      setLoadingCatalogWebhook(false);
    }
  }, [botId, fetchWithFallback]);

  useEffect(() => {
    loadWcStatus();
    loadCatalogItems();
    loadCatalogWebhook();
  }, [loadWcStatus, loadCatalogItems, loadCatalogWebhook]);

  const handleProvisionCatalogWebhook = async (rotate = false) => {
    if (rotate && !confirm("Rotate this signing secret? Existing senders will stop working until updated.")) return;
    setProvisioningCatalogWebhook(true);
    setCatalogWebhookError(null);
    try {
      const res = await fetchWithFallback(`/api/bots/${botId}/media-webhook${rotate ? "?rotate=true" : ""}`, {
        method: "POST",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.detail || "Could not provision the catalog webhook.");
      setCatalogWebhook({
        configured: true,
        enabled: true,
        webhook_url: data.webhook_url,
      });
      setCatalogWebhookSecret(data.signing_secret || null);
    } catch (err: any) {
      setCatalogWebhookError(err?.message || "Could not provision the catalog webhook.");
    } finally {
      setProvisioningCatalogWebhook(false);
    }
  };

  // Polling when sync is active
  useEffect(() => {
    if (!syncingWc) return;
    const interval = setInterval(async () => {
      try {
        const res = await fetchWithFallback(`/api/bots/${botId}/integrations/woocommerce`);
        if (res.ok) {
          const data: WooCommerceStatus = await res.json();
          setWcStatus(data);
          if (data.sync_status !== "syncing") {
            setSyncingWc(false);
            loadCatalogItems(); // Refresh items once finished!
          }
        }
      } catch {
        // silent polling error
      }
    }, 2500);

    return () => clearInterval(interval);
  }, [syncingWc, botId, fetchWithFallback, loadCatalogItems]);

  // Check URL parameters when returning from WooCommerce authorization flow
  useEffect(() => {
    if (typeof window === "undefined") return;
    const urlParams = new URLSearchParams(window.location.search);
    const wcAuth = urlParams.get("wc_auth");
    const success = urlParams.get("success");

    if (wcAuth === "success" || success === "1") {
      setWcSuccessMsg("WooCommerce store connected successfully! Initial product catalog sync started.");
      setWcError(null);
      urlParams.delete("wc_auth");
      urlParams.delete("success");
      urlParams.delete("user_id");
      const newSearch = urlParams.toString();
      const newUrl = `${window.location.pathname}${newSearch ? `?${newSearch}` : ""}`;
      window.history.replaceState({}, "", newUrl);
      loadWcStatus();
      loadCatalogItems();
    } else if (success === "0") {
      setWcError("WooCommerce connection was cancelled or denied by the store owner.");
      urlParams.delete("success");
      urlParams.delete("user_id");
      const newSearch = urlParams.toString();
      const newUrl = `${window.location.pathname}${newSearch ? `?${newSearch}` : ""}`;
      window.history.replaceState({}, "", newUrl);
    }
  }, [loadWcStatus, loadCatalogItems]);

  // Handle 1-Click WooCommerce Automatic Authorization (wc-auth/v1/authorize)
  const handleOneClickConnect = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanUrl = storeUrl.trim();
    if (!cleanUrl) return;
    setWcError(null);
    setWcSuccessMsg(null);
    setAuthorizingWc(true);
    try {
      const returnUrl = typeof window !== "undefined"
        ? `${window.location.origin}${window.location.pathname}?tab=catalog&bot_id=${botId}&wc_auth=success`
        : "";
      const res = await fetchWithFallback(`/api/bots/${botId}/integrations/woocommerce/authorize-url`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          store_url: cleanUrl,
          return_url: returnUrl,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || "Failed to initialize WooCommerce 1-click authorization.");
      }

      const data = await res.json();
      if (data.authorize_url) {
        window.location.href = data.authorize_url;
      } else {
        throw new Error("Invalid response from server: missing authorize_url");
      }
    } catch (err: any) {
      setWcError(err.message || "Failed to connect WooCommerce store. You can also try manual keys below.");
      setAuthorizingWc(false);
    }
  };

  // Handle Connect WooCommerce (Manual API Keys)
  const handleConnectWc = async (e: React.FormEvent) => {
    e.preventDefault();
    setWcError(null);
    setConnectingWc(true);
    try {
      const res = await fetchWithFallback(`/api/bots/${botId}/integrations/woocommerce/connect`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          store_url: storeUrl,
          consumer_key: consumerKey,
          consumer_secret: consumerSecret,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || "Failed to connect store");
      }

      await loadWcStatus();
    } catch (err: any) {
      setWcError(err.message || "Failed to connect WooCommerce store");
    } finally {
      setConnectingWc(false);
    }
  };

  // Handle Trigger Direct Bulk Sync
  const handleTriggerSync = async () => {
    setWcError(null);
    setSyncingWc(true);
    try {
      const res = await fetchWithFallback(`/api/bots/${botId}/integrations/woocommerce/sync`, {
        method: "POST",
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || "Failed to start sync");
      }
      await loadWcStatus();
    } catch (err: any) {
      setWcError(err.message || "Sync failed to start");
      setSyncingWc(false);
    }
  };

  // Handle Disconnect WooCommerce
  const handleDisconnectWc = async () => {
    if (!confirm("Are you sure you want to disconnect your WooCommerce store?")) return;
    try {
      const res = await fetchWithFallback(`/api/bots/${botId}/integrations/woocommerce`, {
        method: "DELETE",
      });
      if (res.ok) {
        await loadWcStatus();
      }
    } catch (err) {
      console.error("Disconnect failed", err);
    }
  };

  // Handle Delete Single Item
  const handleDeleteItem = async (itemId: string) => {
    if (!confirm("Delete this item from the bot's catalog?")) return;
    setDeletingId(itemId);
    try {
      const res = await fetchWithFallback(`/api/bots/${botId}/media-items/${itemId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setItems((prev) => prev.filter((it) => it.id !== itemId));
      }
    } catch (err) {
      console.error("Failed to delete item", err);
    } finally {
      setDeletingId(null);
    }
  };

  // Handle Manual Product Submit
  const handleCreateProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prodTitle.trim() || !prodImageUrl.trim()) return;
    setSavingProduct(true);
    try {
      const res = await fetchWithFallback(`/api/bots/${botId}/media-items`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          media_type: "product",
          title: prodTitle.trim(),
          description: prodDesc.trim(),
          price: prodPrice ? parseFloat(prodPrice) : null,
          currency: prodCurrency,
          sku: prodSku.trim() || null,
          url: prodUrl.trim() || null,
          media_url: prodImageUrl.trim(),
          thumbnail_url: prodImageUrl.trim(),
          metadata: {
            source: "manual",
            ...(prodExternalId.trim() ? { external_id: prodExternalId.trim() } : {}),
            in_stock: prodInStock,
            stock_status: prodInStock ? "instock" : "outofstock",
          },
        }),
      });

      if (res.ok) {
        setProdTitle("");
        setProdPrice("");
        setProdSku("");
        setProdExternalId("");
        setProdUrl("");
        setProdImageUrl("");
        setProdDesc("");
        setProdInStock(true);
        loadCatalogItems();
      }
    } catch (err) {
      console.error("Failed to save product", err);
    } finally {
      setSavingProduct(false);
    }
  };

  // Handle Manual Video Submit
  const handleCreateVideo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!vidTitle.trim() || !vidUrl.trim()) return;
    setSavingVideo(true);
    try {
      const parsedSeconds = parseFloat(vidTimestamp) || 0;
      const res = await fetchWithFallback(`/api/bots/${botId}/media-items`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          media_type: "video",
          title: vidTitle.trim(),
          description: vidDesc.trim(),
          video_url: vidUrl.trim(),
          media_url: vidThumbnail.trim() || vidUrl.trim(),
          thumbnail_url: vidThumbnail.trim() || null,
          video_timestamp_start: parsedSeconds,
          metadata: {
            source: "manual",
            ...(vidExternalId.trim() ? { external_id: vidExternalId.trim() } : {}),
          },
        }),
      });

      if (res.ok) {
        setVidTitle("");
        setVidUrl("");
        setVidExternalId("");
        setVidTimestamp("0");
        setVidThumbnail("");
        setVidDesc("");
        loadCatalogItems();
      }
    } catch (err) {
      console.error("Failed to save video", err);
    } finally {
      setSavingVideo(false);
    }
  };

  // Copy helper
  const copyToClipboard = (text: string, fieldName: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(fieldName);
    setTimeout(() => setCopiedField(null), 2000);
  };

  // Filter items
  const filteredItems = items.filter((item) => {
    if (filterType !== "all" && item.media_type !== filterType) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchTitle = item.title?.toLowerCase().includes(q);
      const matchSku = item.sku?.toLowerCase().includes(q);
      const matchDesc = item.description?.toLowerCase().includes(q);
      return matchTitle || matchSku || matchDesc;
    }
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Top Banner / Mode Switcher */}
      <div
        className="p-1.5 bg-neutral-100 dark:bg-neutral-800/60 rounded-xl border border-neutral-200/80 dark:border-neutral-800 overflow-x-auto"
        aria-label="Catalog source"
      >
        <div className="flex min-w-[36rem] items-center gap-1">
        <button
          type="button"
          onClick={() => setActiveSubTab("woocommerce")}
          className={`flex-1 shrink-0 whitespace-nowrap flex items-center justify-center gap-2 py-2 px-3 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
            activeSubTab === "woocommerce"
              ? "bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 shadow-sm"
              : "text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300"
          }`}
        >
          <Store className="size-4 text-[#9b51e0]" />
          <span>WooCommerce Auto-Sync</span>
          {wcStatus?.connected && (
            <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400">
              Live
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveSubTab("manual_product")}
          className={`flex-1 shrink-0 whitespace-nowrap flex items-center justify-center gap-2 py-2 px-3 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
            activeSubTab === "manual_product"
              ? "bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 shadow-sm"
              : "text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300"
          }`}
        >
          <ShoppingBag className="size-4 text-[#f97316]" />
          <span>Add Custom Product</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSubTab("video")}
          className={`flex-1 shrink-0 whitespace-nowrap flex items-center justify-center gap-2 py-2 px-3 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
            activeSubTab === "video"
              ? "bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 shadow-sm"
              : "text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300"
          }`}
        >
          <Video className="size-4 text-[#0ea5e9]" />
          <span>Add Video Clip</span>
        </button>
        </div>
      </div>

      {activeSubTab !== "woocommerce" && (
        <div className="p-5 rounded-2xl border border-[#f97316]/20 bg-[#f97316]/5 dark:bg-[#f97316]/10 space-y-3">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-lg bg-white dark:bg-neutral-900 text-[#f97316] border border-[#f97316]/20">
                <Link2 className="size-4" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-neutral-900 dark:text-white">Automatic updates for manual items</h4>
                <p className="text-[11px] text-neutral-600 dark:text-neutral-400 mt-1 max-w-2xl">
                  Send signed product or media events from your ERP, store, or spreadsheet automation. Chatty matches the exact <code className="font-mono">external_id</code> within this bot; keep it stable and unique for every item.
                </p>
              </div>
            </div>
            {!catalogWebhook?.configured && (
              <button
                type="button"
                onClick={() => handleProvisionCatalogWebhook()}
                disabled={loadingCatalogWebhook || provisioningCatalogWebhook}
                className="px-3 py-2 bg-[#f97316] hover:bg-[#ea580c] text-white rounded-lg text-[11px] font-semibold flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                {provisioningCatalogWebhook ? <Loader2 className="size-3.5 animate-spin" /> : <Link2 className="size-3.5" />}
                Enable webhook
              </button>
            )}
          </div>

          {catalogWebhookError && (
            <div className="p-2.5 rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/50 text-[11px] text-red-600 dark:text-red-400 flex items-center gap-2">
              <AlertCircle className="size-3.5 shrink-0" /> {catalogWebhookError}
            </div>
          )}

          {catalogWebhook?.configured && (
            <>
              <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-3 items-end">
                <div className="p-3 bg-white/70 dark:bg-neutral-950/50 border border-[#f97316]/15 rounded-xl space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[10px] font-semibold text-neutral-400 uppercase tracking-wider">Delivery URL</span>
                    <button type="button" onClick={() => copyToClipboard(catalogWebhook.webhook_url || "", "catalog-webhook-url")} className="text-[11px] text-[#f97316] hover:underline flex items-center gap-1 cursor-pointer">
                      {copiedField === "catalog-webhook-url" ? <Check className="size-3" /> : <Copy className="size-3" />}
                      {copiedField === "catalog-webhook-url" ? "Copied" : "Copy"}
                    </button>
                  </div>
                  <p className="font-mono text-[11px] text-neutral-700 dark:text-neutral-300 break-all select-all">{catalogWebhook.webhook_url}</p>
                </div>
                <button
                  type="button"
                  onClick={() => handleProvisionCatalogWebhook(true)}
                  disabled={provisioningCatalogWebhook}
                  className="px-3 py-2 border border-[#f97316]/30 text-[#c2410c] dark:text-[#fb923c] rounded-lg text-[11px] font-semibold flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {provisioningCatalogWebhook ? <Loader2 className="size-3.5 animate-spin" /> : <RefreshCw className="size-3.5" />}
                  Rotate secret
                </button>
              </div>
              {catalogWebhookSecret && (
                <div className="p-3 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/50 rounded-xl space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[10px] font-semibold text-amber-700 dark:text-amber-300 uppercase tracking-wider">Signing secret · shown once</span>
                    <button type="button" onClick={() => copyToClipboard(catalogWebhookSecret, "catalog-webhook-secret")} className="text-[11px] text-amber-700 dark:text-amber-300 hover:underline flex items-center gap-1 cursor-pointer">
                      {copiedField === "catalog-webhook-secret" ? <Check className="size-3" /> : <Copy className="size-3" />}
                      {copiedField === "catalog-webhook-secret" ? "Copied" : "Copy"}
                    </button>
                  </div>
                  <p className="font-mono text-[11px] text-amber-900 dark:text-amber-200 break-all select-all">{catalogWebhookSecret}</p>
                </div>
              )}
              <p className="text-[10px] text-neutral-500 dark:text-neutral-400">
                Sign the exact JSON body with HMAC-SHA256 and send <code className="font-mono">X-Chatty-Signature: sha256=&lt;hex&gt;</code>. Include <code className="font-mono">event</code>, <code className="font-mono">external_id</code>, and an <code className="font-mono">item</code> object; use <code className="font-mono">product.deleted</code> to remove an item.
              </p>
            </>
          )}
        </div>
      )}

      {/* Subtab 1: WooCommerce Integration */}
      {activeSubTab === "woocommerce" && (
        <div className="space-y-4">
          {loadingWc ? (
            <div className="flex items-center justify-center py-12 text-neutral-400 gap-2">
              <Loader2 className="size-5 animate-spin" />
              <span className="text-xs">Checking store integration...</span>
            </div>
          ) : !wcStatus?.connected ? (
            /* Connection Form */
            <div className="p-6 rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 space-y-5">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3">
                  <div className="p-3 rounded-xl bg-[#9b51e0]/10 text-[#9b51e0]">
                    <Store className="size-6" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-neutral-900 dark:text-white">
                      Connect WooCommerce Store
                    </h4>
                    <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1 max-w-xl">
                      Automatically import all store products directly into Chatty. AI will visually index your items, match photos sent by visitors, and sync stock and price updates automatically.
                    </p>
                  </div>
                </div>
              </div>

              {wcSuccessMsg && (
                <div className="p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/50 flex items-start gap-2.5 text-emerald-700 dark:text-emerald-300 text-xs">
                  <CheckCircle2 className="size-4 shrink-0 mt-0.5 text-emerald-600 dark:text-emerald-400" />
                  <span>{wcSuccessMsg}</span>
                </div>
              )}

              {wcError && (
                <div className="p-3 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/50 flex items-start gap-2.5 text-red-600 dark:text-red-400 text-xs">
                  <AlertCircle className="size-4 shrink-0 mt-0.5" />
                  <span>{wcError}</span>
                </div>
              )}

              {/* Mode Switcher Tabs */}
              <div className="flex items-center gap-2 p-1 bg-neutral-100 dark:bg-neutral-800/60 rounded-xl border border-neutral-200/60 dark:border-neutral-700/60 max-w-md">
                <button
                  type="button"
                  onClick={() => setAuthMode("oauth")}
                  className={`flex-1 flex items-center justify-center gap-2 py-1.5 px-3 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                    authMode === "oauth"
                      ? "bg-white dark:bg-neutral-900 text-[#9b51e0] dark:text-[#9b51e0] shadow-sm"
                      : "text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300"
                  }`}
                >
                  <Sparkles className="size-3.5" />
                  <span>1-Click Automatic</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[#9b51e0]/10 text-[#9b51e0] font-bold">
                    Recommended
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setAuthMode("manual")}
                  className={`flex-1 flex items-center justify-center gap-2 py-1.5 px-3 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                    authMode === "manual"
                      ? "bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white shadow-sm"
                      : "text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300"
                  }`}
                >
                  <Key className="size-3.5" />
                  <span>Manual API Keys</span>
                </button>
              </div>

              {authMode === "oauth" ? (
                /* 1-Click Flow Form */
                <form onSubmit={handleOneClickConnect} className="space-y-4 pt-1">
                  <div>
                    <label className="block text-[11px] font-semibold text-neutral-600 dark:text-neutral-400 uppercase tracking-wider mb-1.5">
                      WordPress / WooCommerce Store URL
                    </label>
                    <input
                      type="url"
                      required
                      placeholder="https://myfashionstore.com"
                      value={storeUrl}
                      onChange={(e) => setStoreUrl(e.target.value)}
                      className="w-full bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-xl px-3.5 py-2.5 text-xs text-neutral-900 dark:text-white focus:outline-none focus:border-[#9b51e0]"
                    />
                    <p className="text-[11px] text-neutral-400 dark:text-neutral-500 mt-1.5">
                      Enter your store address (e.g. <code>https://yourdomain.com</code>). You will be safely redirected to approve access on your WordPress site.
                    </p>
                  </div>

                  <div className="p-4 rounded-xl bg-[#9b51e0]/5 border border-[#9b51e0]/20 text-xs text-neutral-600 dark:text-neutral-300 space-y-2">
                    <div className="font-semibold text-neutral-800 dark:text-neutral-200 flex items-center gap-1.5">
                      <Sparkles className="size-4 text-[#9b51e0]" /> How 1-Click Connection Works
                    </div>
                    <ul className="list-disc list-inside space-y-1 text-[11px] text-neutral-500 dark:text-neutral-400 pl-1">
                      <li>You will be redirected to your WordPress admin screen to approve access.</li>
                      <li>WooCommerce automatically creates read/write API credentials securely.</li>
                      <li>You are immediately returned to Chatty and automatic product catalog synchronization begins.</li>
                      <li>Zero manual copying of keys required.</li>
                    </ul>
                  </div>

                  <div className="flex justify-end pt-2">
                    <button
                      type="submit"
                      disabled={authorizingWc || !storeUrl.trim()}
                      className="px-5 py-2.5 bg-[#9b51e0] hover:bg-[#8644c7] text-white rounded-xl text-xs font-semibold flex items-center gap-2 cursor-pointer transition-all shadow-sm disabled:opacity-50"
                    >
                      {authorizingWc ? (
                        <>
                          <Loader2 className="size-4 animate-spin" />
                          <span>Connecting with WooCommerce...</span>
                        </>
                      ) : (
                        <>
                          <Sparkles className="size-4" />
                          <span>Connect with WooCommerce (1-Click)</span>
                        </>
                      )}
                    </button>
                  </div>
                </form>
              ) : (
                /* Manual API Keys Form */
                <form onSubmit={handleConnectWc} className="space-y-4 pt-1">
                  <div>
                    <label className="block text-[11px] font-semibold text-neutral-600 dark:text-neutral-400 uppercase tracking-wider mb-1.5">
                      WordPress / WooCommerce Store URL
                    </label>
                    <input
                      type="url"
                      required
                      placeholder="https://myfashionstore.com"
                      value={storeUrl}
                      onChange={(e) => setStoreUrl(e.target.value)}
                      className="w-full bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-xl px-3.5 py-2.5 text-xs text-neutral-900 dark:text-white focus:outline-none focus:border-[#9b51e0]"
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[11px] font-semibold text-neutral-600 dark:text-neutral-400 uppercase tracking-wider mb-1.5">
                        Consumer Key
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="ck_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                        value={consumerKey}
                        onChange={(e) => setConsumerKey(e.target.value)}
                        className="w-full font-mono text-xs bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-xl px-3.5 py-2.5 text-neutral-900 dark:text-white focus:outline-none focus:border-[#9b51e0]"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-neutral-600 dark:text-neutral-400 uppercase tracking-wider mb-1.5">
                        Consumer Secret
                      </label>
                      <input
                        type="password"
                        required
                        placeholder="cs_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                        value={consumerSecret}
                        onChange={(e) => setConsumerSecret(e.target.value)}
                        className="w-full font-mono text-xs bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-xl px-3.5 py-2.5 text-neutral-900 dark:text-white focus:outline-none focus:border-[#9b51e0]"
                      />
                    </div>
                  </div>

                  <div className="p-4 rounded-xl bg-neutral-50 dark:bg-neutral-950 border border-neutral-100 dark:border-neutral-800/80 text-xs text-neutral-500 space-y-1.5">
                    <div className="font-semibold text-neutral-700 dark:text-neutral-300 flex items-center gap-1.5">
                      <HelpCircle className="size-3.5 text-[#9b51e0]" /> Where do I find these keys?
                    </div>
                    <ol className="list-decimal list-inside space-y-1 text-[11px] text-neutral-500 dark:text-neutral-400 pl-1">
                      <li>Log in to your WordPress admin dashboard.</li>
                      <li>Go to <b>WooCommerce → Settings → Advanced → REST API</b>.</li>
                      <li>Click <b>Add Key</b>, set Permissions to <b>Read/Write</b>, and click <b>Generate API Key</b>.</li>
                      <li>Copy and paste the Consumer Key and Consumer Secret above.</li>
                    </ol>
                  </div>

                  <div className="flex justify-end pt-2">
                    <button
                      type="submit"
                      disabled={connectingWc || !storeUrl.trim() || !consumerKey.trim()}
                      className="px-5 py-2.5 bg-[#9b51e0] hover:bg-[#8644c7] text-white rounded-xl text-xs font-semibold flex items-center gap-2 cursor-pointer transition-all shadow-sm disabled:opacity-50"
                    >
                      {connectingWc ? (
                        <>
                          <Loader2 className="size-4 animate-spin" />
                          <span>Verifying & Connecting...</span>
                        </>
                      ) : (
                        <>
                          <CheckCircle2 className="size-4" />
                          <span>Connect WooCommerce Store</span>
                        </>
                      )}
                    </button>
                  </div>
                </form>
              )}
            </div>
          ) : (
            /* Connected Store Status Card */
            <div className="space-y-4">
              {wcSuccessMsg && (
                <div className="p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/50 flex items-start gap-2.5 text-emerald-700 dark:text-emerald-300 text-xs">
                  <CheckCircle2 className="size-4 shrink-0 mt-0.5 text-emerald-600 dark:text-emerald-400" />
                  <span>{wcSuccessMsg}</span>
                </div>
              )}
              <div className="p-6 rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 space-y-5">
                <div className="flex items-center justify-between gap-4 flex-wrap">
                  <div className="flex items-center gap-3">
                    <div className="size-11 rounded-xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                      <Store className="size-6" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="text-sm font-bold text-neutral-900 dark:text-white">
                          {wcStatus.store_url?.replace(/^https?:\/\//, "")}
                        </h4>
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400">
                          <CheckCircle2 className="size-3" /> Connected
                        </span>
                      </div>
                      <p className="text-xs text-neutral-500 mt-0.5">
                        {wcStatus.product_count ?? 0} products currently indexed in Chatty RAG memory.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleTriggerSync}
                      disabled={syncingWc}
                      className="px-4 py-2 bg-[#9b51e0] hover:bg-[#8644c7] text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50 shadow-sm"
                    >
                      <RefreshCw className={`size-3.5 ${syncingWc ? "animate-spin" : ""}`} />
                      <span>{syncingWc ? "Syncing..." : "Import All Products"}</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleDisconnectWc}
                      className="px-3 py-2 border border-neutral-200 dark:border-neutral-800 text-neutral-500 hover:text-red-500 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
                    >
                      Disconnect
                    </button>
                  </div>
                </div>

                {/* Progress Bar when syncing */}
                {syncingWc && (
                  <div className="p-4 rounded-xl bg-[#9b51e0]/5 border border-[#9b51e0]/20 space-y-2 animate-pulse">
                    <div className="flex items-center justify-between text-xs font-semibold text-[#9b51e0]">
                      <span className="flex items-center gap-2">
                        <Loader2 className="size-4 animate-spin" />
                        Importing & embedding WooCommerce catalog...
                      </span>
                      <span>{wcStatus.sync_progress || 5}%</span>
                    </div>
                    <div className="w-full bg-neutral-200 dark:bg-neutral-800 rounded-full h-2 overflow-hidden">
                      <div
                        className="bg-[#9b51e0] h-2 rounded-full transition-all duration-300"
                        style={{ width: `${wcStatus.sync_progress || 5}%` }}
                      />
                    </div>
                    <p className="text-[11px] text-neutral-500">
                      Processing products, extracting visual attributes with Gemini Vision, and indexing 768-d vector embeddings in background.
                    </p>
                  </div>
                )}

                {/* Real-time Webhook Setup helper */}
                <div className="pt-3 border-t border-neutral-100 dark:border-neutral-800 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <h5 className="text-xs font-bold text-neutral-900 dark:text-white flex items-center gap-1.5">
                        <Sparkles className="size-3.5 text-[#f97316]" /> Real-Time Auto-Sync (Webhooks)
                      </h5>
                      <p className="text-[11px] text-neutral-500 dark:text-neutral-400 mt-0.5">
                        Add this webhook in WooCommerce to automatically update prices, out-of-stock items, and new products with zero manual work.
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="p-3 bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-xl space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-semibold text-neutral-400 uppercase tracking-wider">
                          Delivery URL
                        </span>
                        <button
                          type="button"
                          onClick={() => copyToClipboard(wcStatus.webhook_url || "", "url")}
                          className="text-[11px] text-[#9b51e0] hover:underline flex items-center gap-1 cursor-pointer"
                        >
                          {copiedField === "url" ? <Check className="size-3" /> : <Copy className="size-3" />}
                          {copiedField === "url" ? "Copied" : "Copy"}
                        </button>
                      </div>
                      <p className="font-mono text-[11px] text-neutral-700 dark:text-neutral-300 break-all select-all">
                        {wcStatus.webhook_url}
                      </p>
                    </div>

                    <div className="p-3 bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-xl space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-semibold text-neutral-400 uppercase tracking-wider">
                          Secret Key
                        </span>
                        <button
                          type="button"
                          onClick={() => copyToClipboard(wcStatus.webhook_secret || "", "secret")}
                          className="text-[11px] text-[#9b51e0] hover:underline flex items-center gap-1 cursor-pointer"
                        >
                          {copiedField === "secret" ? <Check className="size-3" /> : <Copy className="size-3" />}
                          {copiedField === "secret" ? "Copied" : "Copy"}
                        </button>
                      </div>
                      <p className="font-mono text-[11px] text-neutral-700 dark:text-neutral-300 truncate select-all">
                        {wcStatus.webhook_secret}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Subtab 2: Manual Product Form */}
      {activeSubTab === "manual_product" && (
        <form
          onSubmit={handleCreateProduct}
          className="p-6 rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 space-y-4"
        >
          <div className="flex items-center gap-2">
            <ShoppingBag className="size-5 text-[#f97316]" />
            <h4 className="text-sm font-bold text-neutral-900 dark:text-white">Add Custom Product</h4>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-[11px] font-semibold text-neutral-600 dark:text-neutral-400 uppercase tracking-wider mb-1">
                Product Title *
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Classic Denim Jacket"
                value={prodTitle}
                onChange={(e) => setProdTitle(e.target.value)}
                className="w-full bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-xl px-3 py-2 text-xs text-neutral-900 dark:text-white focus:outline-none focus:border-[#f97316]"
              />
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="block text-[11px] font-semibold text-neutral-600 dark:text-neutral-400 uppercase tracking-wider">
                  Product Image *
                </label>
                <div className="flex items-center gap-1 bg-neutral-100 dark:bg-neutral-800 p-0.5 rounded-lg text-[10px]">
                  <button
                    type="button"
                    onClick={() => setImageInputMode("file")}
                    className={`px-2 py-0.5 rounded-md font-semibold transition-colors cursor-pointer ${
                      imageInputMode === "file"
                        ? "bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white shadow-xs"
                        : "text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300"
                    }`}
                  >
                    Upload File
                  </button>
                  <button
                    type="button"
                    onClick={() => setImageInputMode("url")}
                    className={`px-2 py-0.5 rounded-md font-semibold transition-colors cursor-pointer ${
                      imageInputMode === "url"
                        ? "bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white shadow-xs"
                        : "text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300"
                    }`}
                  >
                    Image URL
                  </button>
                </div>
              </div>

              {/* Hidden file input */}
              <input
                type="file"
                ref={imageFileInputRef}
                accept="image/png,image/jpeg,image/webp,image/gif"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleImageFileChange(f);
                }}
                className="hidden"
              />

              {imageInputMode === "file" ? (
                prodImageUrl ? (
                  /* Image Preview Card */
                  <div className="p-3 bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-xl flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="size-12 rounded-lg bg-neutral-200 dark:bg-neutral-800 overflow-hidden shrink-0 border border-neutral-300 dark:border-neutral-700">
                        <img
                          src={prodImageUrl}
                          alt="Product preview"
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-neutral-900 dark:text-white truncate flex items-center gap-1.5">
                          <CheckCircle2 className="size-3.5 text-emerald-500" />
                          Image Selected
                        </p>
                        <p className="text-[10px] text-neutral-400 truncate">
                          Ready for visual indexing & RAG
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => imageFileInputRef.current?.click()}
                        disabled={uploadingImage}
                        className="px-2.5 py-1 text-[11px] font-semibold text-neutral-700 dark:text-neutral-300 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors cursor-pointer"
                      >
                        {uploadingImage ? <Loader2 className="size-3 animate-spin" /> : "Change"}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setProdImageUrl("");
                          if (imageFileInputRef.current) imageFileInputRef.current.value = "";
                        }}
                        className="p-1 text-neutral-400 hover:text-red-500 rounded-lg transition-colors cursor-pointer"
                        title="Remove photo"
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    </div>
                  </div>
                ) : (
                  /* Drag and Drop Zone */
                  <div
                    onClick={() => imageFileInputRef.current?.click()}
                    onDragOver={(e) => {
                      e.preventDefault();
                      setIsDragging(true);
                    }}
                    onDragLeave={() => setIsDragging(false)}
                    onDrop={(e) => {
                      e.preventDefault();
                      setIsDragging(false);
                      const f = e.dataTransfer.files?.[0];
                      if (f) handleImageFileChange(f);
                    }}
                    className={`border-2 border-dashed rounded-xl p-4 text-center cursor-pointer transition-all flex flex-col items-center justify-center gap-1 ${
                      isDragging
                        ? "border-[#f97316] bg-[#f97316]/5"
                        : "border-neutral-200 dark:border-neutral-800 hover:border-neutral-300 dark:hover:border-neutral-700 bg-neutral-50/50 dark:bg-neutral-950/50"
                    }`}
                  >
                    {uploadingImage ? (
                      <div className="flex items-center gap-2 py-2 text-xs text-neutral-500">
                        <Loader2 className="size-4 animate-spin text-[#f97316]" />
                        <span>Uploading image...</span>
                      </div>
                    ) : (
                      <>
                        <UploadCloud className="size-6 text-neutral-400 group-hover:text-[#f97316] mb-0.5" />
                        <p className="text-xs font-semibold text-neutral-700 dark:text-neutral-300">
                          Click to browse image or drag & drop
                        </p>
                        <p className="text-[10px] text-neutral-400">
                          PNG, JPG, WebP up to 10MB
                        </p>
                      </>
                    )}
                  </div>
                )
              ) : (
                /* URL Input Mode */
                <input
                  type="url"
                  required
                  placeholder="https://example.com/images/jacket.jpg"
                  value={prodImageUrl}
                  onChange={(e) => setProdImageUrl(e.target.value)}
                  className="w-full bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-xl px-3 py-2 text-xs text-neutral-900 dark:text-white focus:outline-none focus:border-[#f97316]"
                />
              )}
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[11px] font-semibold text-neutral-600 dark:text-neutral-400 uppercase tracking-wider mb-1">
                  Price
                </label>
                <input
                  type="number"
                  step="0.01"
                  placeholder="49.99"
                  value={prodPrice}
                  onChange={(e) => setProdPrice(e.target.value)}
                  className="w-full bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-xl px-3 py-2 text-xs text-neutral-900 dark:text-white focus:outline-none focus:border-[#f97316]"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-neutral-600 dark:text-neutral-400 uppercase tracking-wider mb-1">
                  Currency
                </label>
                <input
                  type="text"
                  value={prodCurrency}
                  onChange={(e) => setProdCurrency(e.target.value.toUpperCase())}
                  className="w-full bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-xl px-3 py-2 text-xs text-neutral-900 dark:text-white focus:outline-none focus:border-[#f97316]"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[11px] font-semibold text-neutral-600 dark:text-neutral-400 uppercase tracking-wider mb-1">
                  SKU (Optional)
                </label>
                <input
                  type="text"
                  placeholder="JKT-001"
                  value={prodSku}
                  onChange={(e) => setProdSku(e.target.value)}
                  className="w-full bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-xl px-3 py-2 text-xs text-neutral-900 dark:text-white focus:outline-none focus:border-[#f97316]"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-neutral-600 dark:text-neutral-400 uppercase tracking-wider mb-1">
                  Stock Status
                </label>
                <button
                  type="button"
                  onClick={() => setProdInStock(!prodInStock)}
                  className={`w-full py-2 px-3 rounded-xl border text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
                    prodInStock
                      ? "bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-800 text-emerald-600 dark:text-emerald-400"
                      : "bg-neutral-100 dark:bg-neutral-800 border-neutral-300 dark:border-neutral-700 text-neutral-500"
                  }`}
                >
                  <CheckCircle2 className="size-3.5" />
                  {prodInStock ? "In Stock" : "Out of Stock"}
                </button>
              </div>
            </div>

            <div className="md:col-span-2">
              <label className="block text-[11px] font-semibold text-neutral-600 dark:text-neutral-400 uppercase tracking-wider mb-1">
                External ID (for automatic updates)
              </label>
              <input
                type="text"
                placeholder="e.g. ERP-10042 or product_123"
                value={prodExternalId}
                onChange={(e) => setProdExternalId(e.target.value)}
                className="w-full bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-xl px-3 py-2 text-xs text-neutral-900 dark:text-white focus:outline-none focus:border-[#f97316]"
              />
              <p className="text-[10px] text-neutral-400 mt-1">Your webhook payload must use this exact value as <code>external_id</code>.</p>
            </div>

            <div className="md:col-span-2">
              <label className="block text-[11px] font-semibold text-neutral-600 dark:text-neutral-400 uppercase tracking-wider mb-1">
                Product Page URL (Buy Link)
              </label>
              <input
                type="url"
                placeholder="https://example.com/product/classic-denim-jacket"
                value={prodUrl}
                onChange={(e) => setProdUrl(e.target.value)}
                className="w-full bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-xl px-3 py-2 text-xs text-neutral-900 dark:text-white focus:outline-none focus:border-[#f97316]"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-[11px] font-semibold text-neutral-600 dark:text-neutral-400 uppercase tracking-wider mb-1">
                Visual Description / Features
              </label>
              <textarea
                rows={2}
                placeholder="Vintage wash blue denim, button-up front, spread collar, two chest flap pockets..."
                value={prodDesc}
                onChange={(e) => setProdDesc(e.target.value)}
                className="w-full bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-xl px-3 py-2 text-xs text-neutral-900 dark:text-white focus:outline-none focus:border-[#f97316] resize-y"
              />
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <button
              type="submit"
              disabled={savingProduct || !prodTitle.trim() || !prodImageUrl.trim()}
              className="px-5 py-2.5 bg-[#f97316] hover:bg-[#ea580c] text-white rounded-xl text-xs font-semibold flex items-center gap-2 cursor-pointer transition-all shadow-sm disabled:opacity-50"
            >
              {savingProduct ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  <span>Embedding into RAG...</span>
                </>
              ) : (
                <>
                  <Plus className="size-4" />
                  <span>Save Product to Catalog</span>
                </>
              )}
            </button>
          </div>
        </form>
      )}

      {/* Subtab 3: Manual Video Form */}
      {activeSubTab === "video" && (
        <form
          onSubmit={handleCreateVideo}
          className="p-6 rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 space-y-4"
        >
          <div className="flex items-center gap-2">
            <Video className="size-5 text-[#0ea5e9]" />
            <h4 className="text-sm font-bold text-neutral-900 dark:text-white">Add Video Clip / Guide</h4>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-[11px] font-semibold text-neutral-600 dark:text-neutral-400 uppercase tracking-wider mb-1">
                Video Title *
              </label>
              <input
                type="text"
                required
                placeholder="e.g. How to Style Denim Jacket"
                value={vidTitle}
                onChange={(e) => setVidTitle(e.target.value)}
                className="w-full bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-xl px-3 py-2 text-xs text-neutral-900 dark:text-white focus:outline-none focus:border-[#0ea5e9]"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-neutral-600 dark:text-neutral-400 uppercase tracking-wider mb-1">
                Video URL (YouTube, Vimeo, MP4) *
              </label>
              <input
                type="url"
                required
                placeholder="https://www.youtube.com/watch?v=..."
                value={vidUrl}
                onChange={(e) => setVidUrl(e.target.value)}
                className="w-full bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-xl px-3 py-2 text-xs text-neutral-900 dark:text-white focus:outline-none focus:border-[#0ea5e9]"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-neutral-600 dark:text-neutral-400 uppercase tracking-wider mb-1">
                External ID (for automatic updates)
              </label>
              <input
                type="text"
                placeholder="e.g. guide_10042"
                value={vidExternalId}
                onChange={(e) => setVidExternalId(e.target.value)}
                className="w-full bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-xl px-3 py-2 text-xs text-neutral-900 dark:text-white focus:outline-none focus:border-[#0ea5e9]"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-neutral-600 dark:text-neutral-400 uppercase tracking-wider mb-1">
                Keyframe Start Timestamp (Seconds)
              </label>
              <input
                type="number"
                placeholder="45"
                value={vidTimestamp}
                onChange={(e) => setVidTimestamp(e.target.value)}
                className="w-full bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-xl px-3 py-2 text-xs text-neutral-900 dark:text-white focus:outline-none focus:border-[#0ea5e9]"
              />
              <p className="text-[10px] text-neutral-400 mt-1">
                The chatbot will auto-jump the video to this keyframe.
              </p>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-neutral-600 dark:text-neutral-400 uppercase tracking-wider mb-1">
                Custom Thumbnail Image URL (Optional)
              </label>
              <input
                type="url"
                placeholder="https://example.com/thumbnail.jpg"
                value={vidThumbnail}
                onChange={(e) => setVidThumbnail(e.target.value)}
                className="w-full bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-xl px-3 py-2 text-xs text-neutral-900 dark:text-white focus:outline-none focus:border-[#0ea5e9]"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-[11px] font-semibold text-neutral-600 dark:text-neutral-400 uppercase tracking-wider mb-1">
                Description & Topics Covered
              </label>
              <textarea
                rows={2}
                placeholder="Explains sizing differences, washing instructions, and fit details..."
                value={vidDesc}
                onChange={(e) => setVidDesc(e.target.value)}
                className="w-full bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-xl px-3 py-2 text-xs text-neutral-900 dark:text-white focus:outline-none focus:border-[#0ea5e9] resize-y"
              />
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <button
              type="submit"
              disabled={savingVideo || !vidTitle.trim() || !vidUrl.trim()}
              className="px-5 py-2.5 bg-[#0ea5e9] hover:bg-[#0284c7] text-white rounded-xl text-xs font-semibold flex items-center gap-2 cursor-pointer transition-all shadow-sm disabled:opacity-50"
            >
              {savingVideo ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  <span>Indexing Video...</span>
                </>
              ) : (
                <>
                  <Plus className="size-4" />
                  <span>Save Video Clip</span>
                </>
              )}
            </button>
          </div>
        </form>
      )}

      {/* Catalog Table / Grid View */}
      <div className="space-y-4 pt-2">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-2">
            <h4 className="text-sm font-bold text-neutral-900 dark:text-white flex items-center gap-2">
              <Package className="size-4 text-neutral-500" />
              Indexed Catalog Items ({filteredItems.length})
            </h4>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Search */}
            <div className="relative">
              <Search className="size-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
              <input
                type="text"
                placeholder="Search catalog..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 pr-3 py-1.5 bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-lg text-xs w-44 focus:outline-none focus:border-neutral-400"
              />
            </div>

            {/* Filter pills */}
            <div className="p-1 bg-neutral-100 dark:bg-neutral-800 rounded-lg flex items-center gap-0.5 border border-neutral-200 dark:border-neutral-700">
              <button
                type="button"
                onClick={() => setFilterType("all")}
                className={`px-2 py-1 text-[10px] font-semibold rounded cursor-pointer ${
                  filterType === "all" ? "bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white shadow-xs" : "text-neutral-500"
                }`}
              >
                All
              </button>
              <button
                type="button"
                onClick={() => setFilterType("product")}
                className={`px-2 py-1 text-[10px] font-semibold rounded cursor-pointer ${
                  filterType === "product" ? "bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white shadow-xs" : "text-neutral-500"
                }`}
              >
                Products
              </button>
              <button
                type="button"
                onClick={() => setFilterType("video")}
                className={`px-2 py-1 text-[10px] font-semibold rounded cursor-pointer ${
                  filterType === "video" ? "bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white shadow-xs" : "text-neutral-500"
                }`}
              >
                Videos
              </button>
            </div>

            <button
              type="button"
              onClick={loadCatalogItems}
              disabled={loadingItems}
              className="p-2 border border-neutral-200 dark:border-neutral-800 rounded-lg text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200 transition-colors cursor-pointer"
              title="Refresh Catalog"
            >
              <RefreshCw className={`size-3.5 ${loadingItems ? "animate-spin" : ""}`} />
            </button>
          </div>
        </div>

        {loadingItems ? (
          <div className="flex items-center justify-center py-16 text-neutral-400 gap-2">
            <Loader2 className="size-5 animate-spin" />
            <span className="text-xs">Loading indexed catalog items...</span>
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="p-12 text-center border border-dashed border-neutral-200 dark:border-neutral-800 rounded-2xl bg-neutral-50/50 dark:bg-neutral-950/50 space-y-2">
            <Package className="size-8 text-neutral-400 mx-auto" />
            <p className="text-xs font-semibold text-neutral-600 dark:text-neutral-400">
              No products or media items indexed yet
            </p>
            <p className="text-[11px] text-neutral-400 max-w-sm mx-auto">
              Connect your WooCommerce store to import all products with 1 click, or add custom products and video clips manually.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredItems.map((item) => {
              const isVideo = item.media_type === "video";
              const inStock = item.metadata?.in_stock !== false;
              const source = item.metadata?.source || "manual";
              const imgUrl = item.thumbnail_url || item.media_url;

              return (
                <div
                  key={item.id}
                  className="group relative bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl overflow-hidden hover:border-neutral-300 dark:hover:border-neutral-700 transition-all flex flex-col justify-between"
                >
                  <div>
                    {/* Media Preview Header */}
                    <div className="relative aspect-video w-full bg-neutral-100 dark:bg-neutral-800 overflow-hidden">
                      {imgUrl ? (
                        <img
                          src={imgUrl}
                          alt={item.title}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          onError={(e) => {
                            (e.target as HTMLElement).style.display = "none";
                          }}
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-neutral-400">
                          {isVideo ? <Video className="size-8" /> : <ImageIcon className="size-8" />}
                        </div>
                      )}

                      {/* Floating Badges */}
                      <div className="absolute top-2.5 left-2.5 flex items-center gap-1.5 flex-wrap">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold shadow-xs ${
                            isVideo
                              ? "bg-sky-500 text-white"
                              : "bg-neutral-900/80 backdrop-blur-xs text-white"
                          }`}
                        >
                          {isVideo ? "Video Demo" : "Product"}
                        </span>

                        {source === "woocommerce" && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#9b51e0] text-white shadow-xs flex items-center gap-1">
                            <Store className="size-2.5" /> WooCommerce
                          </span>
                        )}
                      </div>

                      {/* Stock Badge */}
                      {!isVideo && (
                        <div className="absolute top-2.5 right-2.5">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold shadow-xs ${
                              inStock
                                ? "bg-emerald-500/90 text-white"
                                : "bg-neutral-700/90 text-neutral-300"
                            }`}
                          >
                            {inStock ? "In Stock" : "Out of Stock"}
                          </span>
                        </div>
                      )}

                      {/* Video Timestamp Tag */}
                      {isVideo && item.video_timestamp_start !== undefined && (
                        <div className="absolute bottom-2.5 left-2.5 bg-black/80 text-white text-[10px] font-mono px-2 py-0.5 rounded-md backdrop-blur-xs">
                          Start at {item.video_timestamp_start}s
                        </div>
                      )}
                    </div>

                    {/* Item Details */}
                    <div className="p-4 space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <h5 className="text-xs font-bold text-neutral-900 dark:text-white line-clamp-1">
                          {item.title}
                        </h5>
                        {item.price !== undefined && item.price !== null && (
                          <span className="shrink-0 text-xs font-bold text-[#f97316]">
                            {item.currency || "$"} {item.price.toFixed(2)}
                          </span>
                        )}
                      </div>

                      {item.sku && (
                        <p className="text-[10px] font-mono text-neutral-400">SKU: {item.sku}</p>
                      )}

                      {item.metadata?.external_id && (
                        <p className="text-[10px] font-mono text-[#c2410c] dark:text-[#fb923c] truncate" title={String(item.metadata.external_id)}>
                          External ID: {String(item.metadata.external_id)}
                        </p>
                      )}

                      {item.description && (
                        <p className="text-[11px] text-neutral-500 dark:text-neutral-400 line-clamp-2 leading-relaxed">
                          {item.description}
                        </p>
                      )}

                      {/* Categories & Visual tags */}
                      {item.metadata?.categories && item.metadata.categories.length > 0 && (
                        <div className="flex items-center gap-1 flex-wrap pt-1">
                          {item.metadata.categories.slice(0, 3).map((cat: string) => (
                            <span
                              key={cat}
                              className="text-[9px] px-1.5 py-0.5 rounded bg-neutral-100 dark:bg-neutral-800 text-neutral-500 font-medium"
                            >
                              {cat}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Actions Footer */}
                  <div className="p-3 bg-neutral-50/70 dark:bg-neutral-950/60 border-t border-neutral-100 dark:border-neutral-800/80 flex items-center justify-between text-xs">
                    <div>
                      {item.url ? (
                        <a
                          href={item.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[11px] font-semibold text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white flex items-center gap-1"
                        >
                          <span>Store Link</span>
                          <ArrowUpRight className="size-3" />
                        </a>
                      ) : (
                        <span className="text-[11px] text-neutral-400">Direct Embed</span>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={() => handleDeleteItem(item.id)}
                      disabled={deletingId === item.id}
                      className="text-neutral-400 hover:text-red-500 transition-colors p-1 cursor-pointer disabled:opacity-50"
                      title="Delete item"
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
  );
}
