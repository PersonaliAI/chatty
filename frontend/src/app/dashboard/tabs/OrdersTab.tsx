"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import {
  ShoppingBag,
  CreditCard,
  CheckCircle2,
  Clock,
  RotateCcw,
  XCircle,
  ExternalLink,
  MessageSquare,
  Copy,
  Check,
  Search,
  Sparkles,
  User,
  RefreshCw,
  X,
  TrendingUp,
  DollarSign,
  AlertCircle,
} from "lucide-react";

interface Order {
  id: string;
  bot_id: string;
  session_id: string | null;
  provider: "stripe" | "paypal" | "lemonsqueezy" | "polar";
  order_type: "custom_checkout" | "product_checkout" | "booking_payment" | "subscription";
  attributed_to: "ai_agent" | "human_agent";
  agent_email: string | null;
  channel: string;
  title: string;
  amount_cents: number;
  currency: string;
  customer_name: string | null;
  customer_email: string | null;
  customer_phone: string | null;
  customer_country: string | null;
  checkout_url: string;
  gateway_order_id: string | null;
  gateway_customer_id: string | null;
  status: "pending" | "succeeded" | "failed" | "refunded" | "cancelled";
  metadata: Record<string, unknown> | null;
  paid_at: string | null;
  created_at: string;
  updated_at: string;
}

interface OrdersKPIs {
  total_revenue_cents: number;
  pending_revenue_cents: number;
  ai_revenue_cents: number;
  human_revenue_cents: number;
  total_orders: number;
  succeeded_orders: number;
}

interface OrdersTabProps {
  botId: string;
  onOpenConversation?: (sessionId: string) => void;
}

export function OrdersTab({ botId, onOpenConversation }: OrdersTabProps) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [kpis, setKpis] = useState<OrdersKPIs>({
    total_revenue_cents: 0,
    pending_revenue_cents: 0,
    ai_revenue_cents: 0,
    human_revenue_cents: 0,
    total_orders: 0,
    succeeded_orders: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [providerFilter, setProviderFilter] = useState<string>("all");
  const [attributionFilter, setAttributionFilter] = useState<string>("all");

  // Selected Order for Slide-over Drawer
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [copiedUrlId, setCopiedUrlId] = useState<string | null>(null);
  const [updatingStatus, setUpdatingStatus] = useState(false);

  const fetchOrders = useCallback(async () => {
    if (!botId) return;
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (statusFilter !== "all") params.set("status", statusFilter);
      if (providerFilter !== "all") params.set("provider", providerFilter);
      if (attributionFilter !== "all") params.set("attributed_to", attributionFilter);
      if (search.trim()) params.set("search", search.trim());

      const res = await fetch(`/api/bots/${botId}/orders?${params.toString()}`);
      if (!res.ok) {
        throw new Error("Failed to fetch transactions");
      }
      const data = await res.json();
      setOrders(data.orders || []);
      if (data.kpis) {
        setKpis(data.kpis);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error loading transactions");
    } finally {
      setLoading(false);
    }
  }, [botId, statusFilter, providerFilter, attributionFilter, search]);

  useEffect(() => {
    void fetchOrders();
  }, [fetchOrders]);

  const handleCopyLink = (order: Order) => {
    void navigator.clipboard.writeText(order.checkout_url);
    setCopiedUrlId(order.id);
    setTimeout(() => setCopiedUrlId(null), 2000);
  };

  const handleUpdateStatus = async (orderId: string, newStatus: string) => {
    if (!botId) return;
    setUpdatingStatus(true);
    try {
      const res = await fetch(`/api/bots/${botId}/orders/${orderId}/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) {
        const data = await res.json();
        if (selectedOrder && selectedOrder.id === orderId) {
          setSelectedOrder(data.order);
        }
        void fetchOrders();
      }
    } catch {
      // ignore
    } finally {
      setUpdatingStatus(false);
    }
  };

  const formatMoney = (cents: number, currency = "USD") => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency.toUpperCase(),
    }).format(cents / 100);
  };

  const filteredOrders = useMemo(() => {
    return orders.filter((o) => {
      if (search.trim()) {
        const q = search.toLowerCase();
        const matchesTitle = o.title.toLowerCase().includes(q);
        const matchesEmail = (o.customer_email || "").toLowerCase().includes(q);
        const matchesName = (o.customer_name || "").toLowerCase().includes(q);
        if (!matchesTitle && !matchesEmail && !matchesName) return false;
      }
      return true;
    });
  }, [orders, search]);

  const providerBadge = (provider: string) => {
    switch (provider) {
      case "stripe":
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#635bff]/10 text-[#635bff] border border-[#635bff]/20">Stripe</span>;
      case "paypal":
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#003087]/10 text-[#003087] dark:text-sky-400 border border-[#003087]/20">PayPal</span>;
      case "lemonsqueezy":
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20">Lemon Squeezy</span>;
      case "polar":
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">Polar.sh</span>;
      default:
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300">{provider}</span>;
    }
  };

  const statusBadge = (status: string) => {
    switch (status) {
      case "succeeded":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 whitespace-nowrap">
            <CheckCircle2 className="size-3" /> Paid
          </span>
        );
      case "pending":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-400 border border-amber-200 dark:border-amber-800 whitespace-nowrap">
            <Clock className="size-3" /> Awaiting Payment
          </span>
        );
      case "refunded":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-purple-50 text-purple-700 dark:bg-purple-950/50 dark:text-purple-400 border border-purple-200 dark:border-purple-800 whitespace-nowrap">
            <RotateCcw className="size-3" /> Refunded
          </span>
        );
      case "failed":
      case "cancelled":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-red-50 text-red-700 dark:bg-red-950/50 dark:text-red-400 border border-red-200 dark:border-red-800 whitespace-nowrap">
            <XCircle className="size-3" /> Failed
          </span>
        );
      default:
        return <span className="text-[11px] text-neutral-400">{status}</span>;
    }
  };

  const channelBadge = (channel: string) => {
    switch (channel.toLowerCase()) {
      case "whatsapp":
        return <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300">WhatsApp</span>;
      case "telegram":
        return <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-sky-100 text-sky-800 dark:bg-sky-950/80 dark:text-sky-300">Telegram</span>;
      case "instagram":
        return <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-pink-100 text-pink-800 dark:bg-pink-950/80 dark:text-pink-300">Instagram</span>;
      case "messenger":
        return <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-800 dark:bg-blue-950/80 dark:text-blue-300">Messenger</span>;
      case "sms":
        return <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-purple-100 text-purple-800 dark:bg-purple-950/80 dark:text-purple-300">SMS</span>;
      default:
        return <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-neutral-100 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300">Web</span>;
    }
  };

  return (
    <div className="max-w-7xl mx-auto w-full py-6 px-4 sm:px-6 flex flex-col gap-6">
      {/* Top Hero Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 sm:p-6 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-3xl shadow-xs">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <span className="inline-flex size-9 items-center justify-center rounded-xl bg-orange-500/10 text-[#f97316] border border-orange-500/20 shadow-xs shrink-0">
              <ShoppingBag className="size-5" />
            </span>
            <h1 className="text-lg sm:text-xl font-bold text-neutral-900 dark:text-neutral-100 flex items-center gap-2">
              Orders &amp; Sales Transactions
              <span className="rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[10px] font-bold px-2 py-0.5 border border-emerald-500/20">
                Live Audited
              </span>
            </h1>
          </div>
          <p className="text-xs text-neutral-500 dark:text-neutral-400 max-w-2xl leading-relaxed">
            Complete transaction ledger for in-chat sales, payment links, and paid booking appointments across all connected payment gateways.
          </p>
        </div>

        <button
          type="button"
          onClick={() => void fetchOrders()}
          disabled={loading}
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl border border-neutral-200 dark:border-neutral-800 text-xs font-semibold text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-800/60 transition-colors cursor-pointer self-start sm:self-auto shrink-0"
        >
          <RefreshCw className={`size-3.5 ${loading ? "animate-spin text-orange-500" : ""}`} />
          <span>Refresh</span>
        </button>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5 sm:gap-4">
        {/* Total Succeeded Revenue */}
        <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 space-y-1 shadow-2xs">
          <div className="flex items-center justify-between text-neutral-400">
            <span className="text-[11px] font-bold uppercase tracking-wider">Total Revenue</span>
            <DollarSign className="size-4 text-emerald-500" />
          </div>
          <div className="text-xl sm:text-2xl font-extrabold text-neutral-900 dark:text-neutral-100">
            {formatMoney(kpis.total_revenue_cents)}
          </div>
          <p className="text-[10px] text-neutral-400">
            {kpis.succeeded_orders} successful {kpis.succeeded_orders === 1 ? "order" : "orders"}
          </p>
        </div>

        {/* AI Agent Closed Revenue */}
        <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-neutral-900 border border-indigo-200/60 dark:border-indigo-900/40 space-y-1 shadow-2xs">
          <div className="flex items-center justify-between text-indigo-500 dark:text-indigo-400">
            <span className="text-[11px] font-bold uppercase tracking-wider">AI Autonomous</span>
            <Sparkles className="size-4" />
          </div>
          <div className="text-xl sm:text-2xl font-extrabold text-indigo-950 dark:text-indigo-200">
            {formatMoney(kpis.ai_revenue_cents)}
          </div>
          <p className="text-[10px] text-indigo-600/70 dark:text-indigo-400/70">
            {kpis.total_revenue_cents > 0
              ? `${Math.round((kpis.ai_revenue_cents / kpis.total_revenue_cents) * 100)}% of total volume`
              : "Zero autonomous sales"}
          </p>
        </div>

        {/* Human Agent Closed */}
        <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-neutral-900 border border-orange-200/60 dark:border-orange-900/40 space-y-1 shadow-2xs">
          <div className="flex items-center justify-between text-orange-600 dark:text-orange-400">
            <span className="text-[11px] font-bold uppercase tracking-wider">Human Agent Sales</span>
            <User className="size-4" />
          </div>
          <div className="text-xl sm:text-2xl font-extrabold text-orange-950 dark:text-orange-200">
            {formatMoney(kpis.human_revenue_cents)}
          </div>
          <p className="text-[10px] text-orange-600/70 dark:text-orange-400/70">
            Dispatched via Live Inbox
          </p>
        </div>

        {/* Pending Orders */}
        <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 space-y-1 shadow-2xs">
          <div className="flex items-center justify-between text-neutral-400">
            <span className="text-[11px] font-bold uppercase tracking-wider">Pending Links</span>
            <Clock className="size-4 text-amber-500" />
          </div>
          <div className="text-xl sm:text-2xl font-extrabold text-neutral-900 dark:text-neutral-100">
            {formatMoney(kpis.pending_revenue_cents)}
          </div>
          <p className="text-[10px] text-neutral-400">
            Awaiting visitor completion
          </p>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 p-3.5 sm:p-4 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl shadow-xs">
        <div className="flex items-center gap-2 flex-1 max-w-md">
          <div className="relative w-full">
            <Search className="size-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
            <input
              type="text"
              placeholder="Search by customer name, email, or item..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-xl pl-9 pr-3 py-1.5 text-xs text-neutral-900 dark:text-neutral-100 focus:outline-none focus:border-orange-500 transition-colors"
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-2.5 py-1.5 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950 text-xs font-semibold text-neutral-700 dark:text-neutral-300 focus:outline-none cursor-pointer"
          >
            <option value="all">All Statuses</option>
            <option value="succeeded">Paid</option>
            <option value="pending">Pending</option>
            <option value="refunded">Refunded</option>
            <option value="failed">Failed</option>
          </select>

          {/* Provider Filter */}
          <select
            value={providerFilter}
            onChange={(e) => setProviderFilter(e.target.value)}
            className="px-2.5 py-1.5 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950 text-xs font-semibold text-neutral-700 dark:text-neutral-300 focus:outline-none cursor-pointer"
          >
            <option value="all">All Gateways</option>
            <option value="stripe">Stripe</option>
            <option value="paypal">PayPal</option>
            <option value="lemonsqueezy">Lemon Squeezy</option>
            <option value="polar">Polar.sh</option>
          </select>

          {/* Attribution Filter */}
          <select
            value={attributionFilter}
            onChange={(e) => setAttributionFilter(e.target.value)}
            className="px-2.5 py-1.5 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950 text-xs font-semibold text-neutral-700 dark:text-neutral-300 focus:outline-none cursor-pointer"
          >
            <option value="all">All Attributions</option>
            <option value="ai_agent">🤖 AI Agent</option>
            <option value="human_agent">👤 Human Agent</option>
          </select>
        </div>
      </div>

      {/* Main Table Container */}
      <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-3xl overflow-hidden shadow-xs">
        {loading && orders.length === 0 ? (
          <div className="py-20 flex flex-col items-center justify-center text-center space-y-3">
            <RefreshCw className="size-7 animate-spin text-orange-500" />
            <p className="text-xs text-neutral-400">Loading verified transactions...</p>
          </div>
        ) : error ? (
          <div className="p-8 text-center space-y-2">
            <AlertCircle className="size-8 text-red-500 mx-auto" />
            <p className="text-xs font-semibold text-red-600 dark:text-red-400">{error}</p>
          </div>
        ) : filteredOrders.length === 0 ? (
          <div className="py-16 px-4 text-center space-y-3 max-w-md mx-auto">
            <div className="size-12 rounded-2xl bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center mx-auto text-neutral-400">
              <ShoppingBag className="size-6" />
            </div>
            <h3 className="text-sm font-bold text-neutral-900 dark:text-neutral-100">No Transactions Yet</h3>
            <p className="text-xs text-neutral-500 dark:text-neutral-400 leading-relaxed">
              When an AI agent or human staff sends a checkout link in chat or when visitors book paid appointments, full details will be audited right here.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-neutral-100 dark:border-neutral-800/80 bg-neutral-50/60 dark:bg-neutral-950/40 text-[10px] uppercase font-bold tracking-wider text-neutral-400">
                  <th className="py-3.5 px-4 sm:px-6">Customer</th>
                  <th className="py-3.5 px-4">Item &amp; Gateway</th>
                  <th className="py-3.5 px-4">Amount</th>
                  <th className="py-3.5 px-4">Attribution</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4">Date</th>
                  <th className="py-3.5 px-4 sm:px-6 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800/60">
                {filteredOrders.map((order) => {
                  const initial = (order.customer_name || order.customer_email || "V")[0].toUpperCase();
                  return (
                    <tr
                      key={order.id}
                      onClick={() => setSelectedOrder(order)}
                      className="hover:bg-neutral-50/80 dark:hover:bg-neutral-800/40 transition-colors cursor-pointer group"
                    >
                      {/* Customer Profile Column */}
                      <td className="py-4 px-4 sm:px-6">
                        <div className="flex items-center gap-3">
                          <div className="size-8 rounded-full bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-200 font-bold flex items-center justify-center shrink-0 border border-neutral-200/60 dark:border-neutral-700/60">
                            {initial}
                          </div>
                          <div className="min-w-0">
                            <div className="font-bold text-neutral-900 dark:text-neutral-100 truncate flex items-center gap-1.5">
                              <span>{order.customer_name || "Visitor"}</span>
                              {channelBadge(order.channel)}
                            </div>
                            <div className="text-[11px] text-neutral-500 dark:text-neutral-400 truncate">
                              {order.customer_email || (order.customer_phone ? order.customer_phone : order.session_id ? `Session: ${order.session_id.slice(0, 16)}...` : "Direct Visitor")}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Item & Provider */}
                      <td className="py-4 px-4">
                        <div className="space-y-1">
                          <div className="font-semibold text-neutral-900 dark:text-neutral-100 truncate max-w-[200px]">
                            {order.title}
                          </div>
                          <div className="flex items-center gap-1.5">
                            {providerBadge(order.provider)}
                            <span className="text-[10px] text-neutral-400 capitalize">
                              {order.order_type.replace("_", " ")}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Amount */}
                      <td className="py-4 px-4 font-bold text-neutral-900 dark:text-neutral-100 whitespace-nowrap">
                        {formatMoney(order.amount_cents, order.currency)}
                      </td>

                      {/* Attribution */}
                      <td className="py-4 px-4 whitespace-nowrap">
                        {order.attributed_to === "ai_agent" ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300 border border-indigo-200/80 dark:border-indigo-800/60">
                            <Sparkles className="size-3 text-indigo-500" />
                            <span>AI Agent</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-200/80 dark:border-amber-800/60 max-w-[160px] truncate">
                            <User className="size-3 text-amber-500 shrink-0" />
                            <span className="truncate">{order.agent_email || "Human Agent"}</span>
                          </span>
                        )}
                      </td>

                      {/* Status */}
                      <td className="py-4 px-4">{statusBadge(order.status)}</td>

                      {/* Date */}
                      <td className="py-4 px-4 text-[11px] text-neutral-500 dark:text-neutral-400 whitespace-nowrap">
                        {new Date(order.created_at).toLocaleDateString(undefined, {
                          month: "short",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </td>

                      {/* Actions */}
                      <td className="py-4 px-4 sm:px-6 text-right whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1.5">
                          {order.session_id && onOpenConversation && (
                            <button
                              type="button"
                              onClick={() => onOpenConversation(order.session_id!)}
                              title="Open Customer Chat in Inbox"
                              className="size-7 rounded-lg border border-neutral-200 dark:border-neutral-800 flex items-center justify-center text-neutral-600 dark:text-neutral-400 hover:text-orange-600 hover:bg-orange-50 dark:hover:bg-orange-950/30 transition-colors cursor-pointer"
                            >
                              <MessageSquare className="size-3.5" />
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={() => handleCopyLink(order)}
                            title="Copy Checkout Link"
                            className="size-7 rounded-lg border border-neutral-200 dark:border-neutral-800 flex items-center justify-center text-neutral-600 dark:text-neutral-400 hover:text-orange-600 hover:bg-orange-50 dark:hover:bg-orange-950/30 transition-colors cursor-pointer"
                          >
                            {copiedUrlId === order.id ? <Check className="size-3.5 text-emerald-500" /> : <Copy className="size-3.5" />}
                          </button>

                          <a
                            href={order.checkout_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            title="Open Hosted Checkout"
                            className="size-7 rounded-lg border border-neutral-200 dark:border-neutral-800 flex items-center justify-center text-neutral-600 dark:text-neutral-400 hover:text-orange-600 hover:bg-orange-50 dark:hover:bg-orange-950/30 transition-colors cursor-pointer"
                          >
                            <ExternalLink className="size-3.5" />
                          </a>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Slide-over Detail Drawer */}
      {selectedOrder && (
        <div className="fixed inset-0 z-50 overflow-hidden flex justify-end bg-black/40 backdrop-blur-2xs animate-in fade-in duration-150">
          <div className="w-full max-w-lg bg-white dark:bg-neutral-900 h-full shadow-2xl flex flex-col border-l border-neutral-200 dark:border-neutral-800 p-6 space-y-6 overflow-y-auto">
            {/* Header */}
            <div className="flex items-start justify-between pb-4 border-b border-neutral-100 dark:border-neutral-800">
              <div className="space-y-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-400">Transaction Dossier</span>
                <h2 className="text-base font-bold text-neutral-900 dark:text-neutral-100">{selectedOrder.title}</h2>
                <div className="flex items-center gap-2 pt-0.5">
                  {statusBadge(selectedOrder.status)}
                  {providerBadge(selectedOrder.provider)}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedOrder(null)}
                className="size-8 rounded-xl bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-100 cursor-pointer"
              >
                <X className="size-4" />
              </button>
            </div>

            {/* Financial Summary */}
            <div className="p-4 rounded-2xl bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 flex items-center justify-between">
              <div>
                <div className="text-[10px] font-bold uppercase tracking-wider text-neutral-400">Total Charged</div>
                <div className="text-xl font-extrabold text-neutral-900 dark:text-neutral-100">
                  {formatMoney(selectedOrder.amount_cents, selectedOrder.currency)}
                </div>
              </div>
              <div className="text-right">
                <div className="text-[10px] font-bold uppercase tracking-wider text-neutral-400">Channel</div>
                <div className="pt-0.5">{channelBadge(selectedOrder.channel)}</div>
              </div>
            </div>

            {/* Customer Details */}
            <div className="space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-neutral-400">Customer Identity</h4>
              <div className="p-4 rounded-2xl bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-neutral-400">Name:</span>
                  <span className="font-semibold text-neutral-900 dark:text-neutral-100">{selectedOrder.customer_name || "Unspecified"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-neutral-400">Email:</span>
                  <span className="font-semibold text-neutral-900 dark:text-neutral-100">{selectedOrder.customer_email || "Unspecified"}</span>
                </div>
                {selectedOrder.customer_phone && (
                  <div className="flex justify-between">
                    <span className="text-neutral-400">Phone:</span>
                    <span className="font-semibold text-neutral-900 dark:text-neutral-100">{selectedOrder.customer_phone}</span>
                  </div>
                )}
                {selectedOrder.customer_country && (
                  <div className="flex justify-between">
                    <span className="text-neutral-400">Country:</span>
                    <span className="font-semibold text-neutral-900 dark:text-neutral-100">{selectedOrder.customer_country}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-neutral-400">Session ID:</span>
                  <span className="font-mono text-[11px] text-neutral-700 dark:text-neutral-300">{selectedOrder.session_id || "None"}</span>
                </div>
              </div>
            </div>

            {/* Attribution Breakdown */}
            <div className="space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-neutral-400">Sales Attribution</h4>
              <div className="p-4 rounded-2xl bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 space-y-2 text-xs">
                <div className="flex justify-between items-center">
                  <span className="text-neutral-400">Origin:</span>
                  <span className="font-semibold text-neutral-900 dark:text-neutral-100 capitalize">
                    {selectedOrder.attributed_to === "ai_agent" ? "🤖 AI Autonomous Reasoning" : "👤 Human Staff Takeover"}
                  </span>
                </div>
                {selectedOrder.agent_email && (
                  <div className="flex justify-between items-center">
                    <span className="text-neutral-400">Agent Sign-off:</span>
                    <span className="font-semibold text-neutral-900 dark:text-neutral-100">{selectedOrder.agent_email}</span>
                  </div>
                )}
                {selectedOrder.gateway_order_id && (
                  <div className="flex justify-between items-center">
                    <span className="text-neutral-400">Gateway Ref:</span>
                    <span className="font-mono text-[10px] bg-neutral-200 dark:bg-neutral-800 px-1.5 py-0.5 rounded">{selectedOrder.gateway_order_id}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Actions Toolbar */}
            <div className="space-y-3 pt-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-neutral-400">Audit Actions</h4>
              <div className="space-y-2">
                {selectedOrder.session_id && onOpenConversation && (
                  <button
                    type="button"
                    onClick={() => {
                      onOpenConversation(selectedOrder.session_id!);
                      setSelectedOrder(null);
                    }}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-orange-500 text-white text-xs font-bold hover:bg-orange-600 transition-colors cursor-pointer shadow-xs"
                  >
                    <MessageSquare className="size-4" />
                    <span>Open Conversation in Inbox</span>
                  </button>
                )}

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => handleCopyLink(selectedOrder)}
                    className="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-xl border border-neutral-200 dark:border-neutral-800 text-xs font-semibold text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors cursor-pointer"
                  >
                    {copiedUrlId === selectedOrder.id ? <Check className="size-3.5 text-emerald-500" /> : <Copy className="size-3.5" />}
                    <span>{copiedUrlId === selectedOrder.id ? "Copied" : "Copy Checkout Link"}</span>
                  </button>

                  <a
                    href={selectedOrder.checkout_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-xl border border-neutral-200 dark:border-neutral-800 text-xs font-semibold text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors cursor-pointer"
                  >
                    <ExternalLink className="size-3.5" />
                    <span>Visit Checkout</span>
                  </a>
                </div>

                {/* Quick Status Adjustments */}
                <div className="pt-2 border-t border-neutral-100 dark:border-neutral-800 flex items-center justify-between gap-2">
                  <span className="text-[11px] text-neutral-400 font-medium">Audit Status:</span>
                  <div className="flex gap-1.5">
                    {selectedOrder.status !== "succeeded" && (
                      <button
                        type="button"
                        disabled={updatingStatus}
                        onClick={() => handleUpdateStatus(selectedOrder.id, "succeeded")}
                        className="px-2.5 py-1 text-[10px] font-bold rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20 transition-colors cursor-pointer"
                      >
                        Mark as Paid
                      </button>
                    )}
                    {selectedOrder.status !== "refunded" && (
                      <button
                        type="button"
                        disabled={updatingStatus}
                        onClick={() => handleUpdateStatus(selectedOrder.id, "refunded")}
                        className="px-2.5 py-1 text-[10px] font-bold rounded-lg bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20 hover:bg-purple-500/20 transition-colors cursor-pointer"
                      >
                        Mark as Refunded
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
