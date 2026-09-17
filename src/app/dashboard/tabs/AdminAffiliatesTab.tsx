"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { createPortal } from "react-dom";
import {
  DollarSign,
  Users,
  ShieldAlert,
  ShieldCheck,
  Check,
  RefreshCw,
  Clock,
  AlertTriangle,
  ChevronDown,
  ExternalLink,
  Edit2,
  Send,
  Sliders,
  X,
  Search,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { fetchBackend } from "@/lib/backend-client";
import { ModernSelect, type ModernSelectOption } from "@/components/ui/modern-select";

interface AdminAffiliateItem {
  id: string;
  user_id: string;
  referral_code: string;
  payout_email: string;
  display_name: string | null;
  website_url: string | null;
  status: "active" | "pending" | "paused" | "rejected";
  commission_rate_bps: number;
  created_at: string;
  clicks_count: number;
  referrals_count: number;
  paid_referrals_count: number;
  pending_cents: number;
  payable_cents: number;
  paid_cents: number;
  total_earned_cents: number;
}

interface FraudFlagItem {
  id: string;
  affiliate_id: string;
  referred_user_id: string | null;
  flag_reason: string;
  severity: "low" | "medium" | "high" | "critical";
  ip_address: string | null;
  event_payload: any;
  created_at: string;
}

function formatCents(cents: number): string {
  return (cents / 100).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
  });
}

const STATUS_FILTER_OPTIONS: ModernSelectOption[] = [
  { value: "all", label: "All Statuses" },
  { value: "active", label: "Active", icon: <span className="size-2 rounded-full bg-emerald-500 inline-block" /> },
  { value: "pending", label: "Pending", icon: <span className="size-2 rounded-full bg-neutral-400 inline-block" /> },
  { value: "paused", label: "Paused", icon: <span className="size-2 rounded-full bg-amber-500 inline-block" /> },
  { value: "rejected", label: "Rejected", icon: <span className="size-2 rounded-full bg-red-500 inline-block" /> },
];

const PAYOUT_METHOD_OPTIONS: ModernSelectOption[] = [
  { value: "paypal", label: "PayPal" },
  { value: "wise", label: "Wise" },
  { value: "bank_transfer", label: "Bank Transfer (ACH/Wire)" },
  { value: "manual", label: "Other Manual" },
];

/**
 * Modern interactive Status Dropdown for table cells and cards.
 * Replaces unstyled native selects with an animated pill and clean flyout menu.
 */
function AffiliateStatusDropdown({
  status,
  onChange,
}: {
  status: "active" | "pending" | "paused" | "rejected";
  onChange: (next: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [coords, setCoords] = useState<{ top: number; left: number; openUpwards: boolean } | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  const updatePosition = useCallback(() => {
    if (!buttonRef.current) return;
    const rect = buttonRef.current.getBoundingClientRect();
    const dropdownHeight = 145;
    const dropdownWidth = 140;
    const spaceBelow = window.innerHeight - rect.bottom;
    const openUpwards = spaceBelow < dropdownHeight && rect.top > dropdownHeight;

    let left = rect.left;
    if (typeof window !== "undefined" && left + dropdownWidth > window.innerWidth - 8) {
      left = Math.max(8, window.innerWidth - dropdownWidth - 8);
    }

    setCoords({
      top: openUpwards ? rect.top - 6 : rect.bottom + 6,
      left,
      openUpwards,
    });
  }, []);

  const toggleOpen = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!open) {
      updatePosition();
      setOpen(true);
    } else {
      setOpen(false);
    }
  };

  useEffect(() => {
    if (!open) return;

    const handleDown = (e: MouseEvent) => {
      if (
        buttonRef.current && !buttonRef.current.contains(e.target as Node) &&
        menuRef.current && !menuRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };

    const handleScrollOrResize = () => {
      updatePosition();
    };

    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };

    document.addEventListener("mousedown", handleDown);
    document.addEventListener("keydown", handleKey);
    window.addEventListener("scroll", handleScrollOrResize, true);
    window.addEventListener("resize", handleScrollOrResize);

    return () => {
      document.removeEventListener("mousedown", handleDown);
      document.removeEventListener("keydown", handleKey);
      window.removeEventListener("scroll", handleScrollOrResize, true);
      window.removeEventListener("resize", handleScrollOrResize);
    };
  }, [open, updatePosition]);

  const configs: Record<string, { label: string; pill: string; dot: string }> = {
    active: {
      label: "Active",
      pill: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-400 dark:border-emerald-800",
      dot: "bg-emerald-500",
    },
    paused: {
      label: "Paused",
      pill: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/50 dark:text-amber-400 dark:border-amber-800",
      dot: "bg-amber-500",
    },
    pending: {
      label: "Pending",
      pill: "bg-neutral-100 text-neutral-700 border-neutral-200 dark:bg-neutral-800 dark:text-neutral-300 dark:border-neutral-700",
      dot: "bg-neutral-400",
    },
    rejected: {
      label: "Rejected",
      pill: "bg-red-50 text-red-700 border-red-200 dark:bg-red-950/50 dark:text-red-400 dark:border-red-800",
      dot: "bg-red-500",
    },
  };

  const curr = configs[status] || configs.pending;

  return (
    <div className="relative inline-block text-left">
      <button
        ref={buttonRef}
        type="button"
        onClick={toggleOpen}
        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-mono font-bold uppercase cursor-pointer border transition-all hover:opacity-90 ${curr.pill}`}
      >
        <span className={`size-1.5 rounded-full ${curr.dot}`} />
        <span>{curr.label}</span>
        <ChevronDown className={`size-3 transition-transform duration-150 ${open ? "rotate-180" : ""}`} />
      </button>

      {open && coords && mounted && typeof document !== "undefined" && createPortal(
        <div
          ref={menuRef}
          style={{
            position: "fixed",
            top: coords.openUpwards ? "auto" : `${coords.top}px`,
            bottom: coords.openUpwards ? `${window.innerHeight - coords.top}px` : "auto",
            left: `${coords.left}px`,
            minWidth: "140px",
            zIndex: 99999,
          }}
          className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl shadow-2xl py-1 overflow-hidden animate-in fade-in zoom-in-95 duration-100 select-none"
        >
          {(["active", "pending", "paused", "rejected"] as const).map((s) => {
            const item = configs[s];
            const isSelected = s === status;
            return (
              <button
                key={s}
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onChange(s);
                  setOpen(false);
                }}
                className={`w-full flex items-center justify-between px-3 py-1.5 text-xs text-left transition-colors hover:bg-neutral-100 dark:hover:bg-neutral-800 cursor-pointer ${
                  isSelected ? "font-bold text-neutral-900 dark:text-white" : "text-neutral-600 dark:text-neutral-400"
                }`}
              >
                <span className="flex items-center gap-2">
                  <span className={`size-1.5 rounded-full ${item.dot}`} />
                  <span className="font-mono text-[10px] uppercase">{item.label}</span>
                </span>
                {isSelected && <Check className="size-3 text-[#f97316]" />}
              </button>
            );
          })}
        </div>,
        document.body
      )}
    </div>
  );
}

export function AdminAffiliatesTab() {
  const supabase = createClient();
  const [loading, setLoading] = useState(true);
  const [affiliates, setAffiliates] = useState<AdminAffiliateItem[]>([]);
  const [fraudFlags, setFraudFlags] = useState<FraudFlagItem[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [searchTerm, setSearchTerm] = useState("");

  // Sub-view: "affiliates" | "fraud"
  const [subView, setSubView] = useState<"affiliates" | "fraud">("affiliates");

  // Matured commissions action
  const [releasingMature, setReleasingMature] = useState(false);
  const [matureResult, setMatureResult] = useState<string | null>(null);

  // Edit Rate Modal State
  const [rateModalAffiliate, setRateModalAffiliate] = useState<AdminAffiliateItem | null>(null);
  const [newRatePercent, setNewRatePercent] = useState<number>(30);
  const [savingRate, setSavingRate] = useState(false);

  // Payout Modal State
  const [payoutModalAffiliate, setPayoutModalAffiliate] = useState<AdminAffiliateItem | null>(null);
  const [payoutAmountCents, setPayoutAmountCents] = useState<number>(0);
  const [payoutTxId, setPayoutTxId] = useState("");
  const [payoutMethod, setPayoutMethod] = useState("paypal");
  const [recordingPayout, setRecordingPayout] = useState(false);

  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3000);
  };

  const loadData = async () => {
    try {
      setLoading(true);
      const [affRes, fraudRes] = await Promise.all([
        fetchBackend(supabase, "/api/admin/affiliates?limit=100"),
        fetchBackend(supabase, "/api/admin/affiliate-fraud-flags?limit=50"),
      ]);

      if (affRes.ok) {
        const body = await affRes.json();
        setAffiliates(body.affiliates || []);
      }
      if (fraudRes.ok) {
        const body = await fraudRes.json();
        setFraudFlags(body.fraud_flags || []);
      }
    } catch (err) {
      console.error("Failed to load admin affiliate data:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleUpdateStatus = async (affiliateId: string, nextStatus: string) => {
    try {
      const res = await fetchBackend(supabase, `/api/admin/affiliates/${affiliateId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus }),
      });
      if (res.ok) {
        showToast(`Affiliate status updated to ${nextStatus}`);
        setAffiliates((prev) =>
          prev.map((a) => (a.id === affiliateId ? { ...a, status: nextStatus as any } : a))
        );
      }
    } catch {
      showToast("Failed to update affiliate status");
    }
  };

  const handleSaveRate = async () => {
    if (!rateModalAffiliate) return;
    setSavingRate(true);
    try {
      const bps = Math.round(newRatePercent * 100);
      const res = await fetchBackend(supabase, `/api/admin/affiliates/${rateModalAffiliate.id}/rate`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ commission_rate_bps: bps }),
      });
      if (res.ok) {
        showToast(`Commission rate updated to ${newRatePercent}%`);
        setAffiliates((prev) =>
          prev.map((a) => (a.id === rateModalAffiliate.id ? { ...a, commission_rate_bps: bps } : a))
        );
        setRateModalAffiliate(null);
      }
    } catch {
      showToast("Failed to update commission rate");
    } finally {
      setSavingRate(false);
    }
  };

  const handleReleaseMatureCommissions = async () => {
    setReleasingMature(true);
    setMatureResult(null);
    try {
      const res = await fetchBackend(supabase, "/api/admin/affiliate-commissions/approve-mature", {
        method: "POST",
      });
      if (res.ok) {
        const body = await res.json();
        const count = body.matured_count || 0;
        setMatureResult(`Successfully matured ${count} commission${count === 1 ? "" : "s"} to Payable!`);
        showToast(`Released ${count} mature commissions`);
        loadData();
      }
    } catch {
      setMatureResult("Failed to release mature commissions");
    } finally {
      setReleasingMature(false);
    }
  };

  const handleRecordPayout = async () => {
    if (!payoutModalAffiliate || payoutAmountCents <= 0) return;
    setRecordingPayout(true);
    try {
      const res = await fetchBackend(supabase, "/api/admin/affiliate-payouts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          affiliate_id: payoutModalAffiliate.id,
          amount_cents: payoutAmountCents,
          payout_method: payoutMethod,
          external_payout_id: payoutTxId || undefined,
        }),
      });
      if (res.ok) {
        showToast(`Recorded payout of ${formatCents(payoutAmountCents)}`);
        setPayoutModalAffiliate(null);
        loadData();
      }
    } catch {
      showToast("Failed to record payout");
    } finally {
      setRecordingPayout(false);
    }
  };

  const filteredAffiliates = affiliates.filter((a) => {
    if (statusFilter !== "all" && a.status !== statusFilter) return false;
    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      const codeMatch = a.referral_code.toLowerCase().includes(q);
      const emailMatch = a.payout_email.toLowerCase().includes(q);
      const nameMatch = (a.display_name || "").toLowerCase().includes(q);
      if (!codeMatch && !emailMatch && !nameMatch) return false;
    }
    return true;
  });

  const totalPartners = affiliates.length;
  const totalClicks = affiliates.reduce((acc, a) => acc + (a.clicks_count || 0), 0);
  const totalReferrals = affiliates.reduce((acc, a) => acc + (a.referrals_count || 0), 0);
  const totalPaidReferrals = affiliates.reduce((acc, a) => acc + (a.paid_referrals_count || 0), 0);
  const totalPayableCents = affiliates.reduce((acc, a) => acc + (a.payable_cents || 0), 0);
  const totalLifetimeEarnedCents = affiliates.reduce((acc, a) => acc + (a.total_earned_cents || 0), 0);

  return (
    <div className="max-w-7xl mx-auto w-full py-4 sm:py-6 px-3 sm:px-4 space-y-5 sm:space-y-6">
      {/* Toast */}
      {toastMsg && (
        <div className="fixed bottom-6 right-6 z-50 bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 px-4 py-2.5 rounded-xl shadow-xl text-xs font-semibold flex items-center gap-2">
          <Check className="size-4 text-emerald-400" />
          <span>{toastMsg}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-neutral-200 dark:border-neutral-800 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-mono uppercase tracking-widest text-[#f97316] font-bold">
              Platform Admin
            </span>
            <span className="px-2 py-0.5 rounded-full bg-[#f97316]/10 text-[#f97316] text-[10px] font-mono font-bold">
              Affiliate Management
            </span>
          </div>
          <h1 className="text-lg sm:text-xl font-bold text-neutral-900 dark:text-white mt-1">
            Affiliate Partner Program Command Center
          </h1>
        </div>

        <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
          <button
            type="button"
            onClick={handleReleaseMatureCommissions}
            disabled={releasingMature}
            className="flex-1 sm:flex-none px-3.5 py-2 rounded-xl border border-neutral-200 dark:border-neutral-800 hover:bg-neutral-50 dark:hover:bg-neutral-850 text-xs font-semibold text-neutral-800 dark:text-neutral-200 transition-colors flex items-center justify-center gap-1.5 cursor-pointer shadow-xs disabled:opacity-50"
            title="Scan commissions past 30-day hold and move them to Payable"
          >
            {releasingMature ? (
              <RefreshCw className="size-3.5 animate-spin" />
            ) : (
              <Clock className="size-3.5 text-amber-500" />
            )}
            <span>Release Mature Holds</span>
          </button>
          <button
            type="button"
            onClick={loadData}
            className="p-2 rounded-xl border border-neutral-200 dark:border-neutral-800 hover:bg-neutral-50 dark:hover:bg-neutral-850 text-neutral-600 dark:text-neutral-400 transition-colors cursor-pointer shrink-0"
            title="Refresh data"
          >
            <RefreshCw className={`size-4 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {matureResult && (
        <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-xs font-medium text-emerald-800 dark:text-emerald-300 flex items-center justify-between">
          <span>{matureResult}</span>
          <button type="button" onClick={() => setMatureResult(null)} className="text-emerald-600 hover:text-emerald-800 cursor-pointer">
            <X className="size-3.5" />
          </button>
        </div>
      )}

      {/* Aggregate KPI Overview */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 sm:gap-3">
        <div className="p-3.5 sm:p-4 rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 space-y-1">
          <span className="text-[10px] font-mono uppercase text-neutral-400 block truncate">Total Partners</span>
          <p className="text-lg sm:text-xl font-black font-mono text-neutral-900 dark:text-white">{totalPartners}</p>
        </div>
        <div className="p-3.5 sm:p-4 rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 space-y-1">
          <span className="text-[10px] font-mono uppercase text-neutral-400 block truncate">Total Clicks</span>
          <p className="text-lg sm:text-xl font-black font-mono text-neutral-900 dark:text-white">{totalClicks}</p>
        </div>
        <div className="p-3.5 sm:p-4 rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 space-y-1">
          <span className="text-[10px] font-mono uppercase text-neutral-400 block truncate">Conversions</span>
          <p className="text-lg sm:text-xl font-black font-mono text-emerald-600 dark:text-emerald-400 truncate">
            {totalPaidReferrals} <span className="text-xs font-normal text-neutral-400">/ {totalReferrals}</span>
          </p>
        </div>
        <div className="p-3.5 sm:p-4 rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 space-y-1">
          <span className="text-[10px] font-mono uppercase text-neutral-400 block truncate">Outstanding Payable</span>
          <p className="text-lg sm:text-xl font-black font-mono text-[#f97316] truncate">{formatCents(totalPayableCents)}</p>
        </div>
        <div className="p-3.5 sm:p-4 rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 space-y-1">
          <span className="text-[10px] font-mono uppercase text-neutral-400 block truncate">Commissions Earned</span>
          <p className="text-lg sm:text-xl font-black font-mono text-neutral-900 dark:text-white truncate">
            {formatCents(totalLifetimeEarnedCents)}
          </p>
        </div>
        <div className="p-3.5 sm:p-4 rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 space-y-1">
          <span className="text-[10px] font-mono uppercase text-neutral-400 block truncate">Fraud / Flagged</span>
          <p className="text-lg sm:text-xl font-black font-mono text-red-500">{fraudFlags.length}</p>
        </div>
      </div>

      {/* Sub-nav Buttons & Search/Filter Toolbar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setSubView("affiliates")}
            className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
              subView === "affiliates"
                ? "bg-neutral-900 text-white dark:bg-white dark:text-neutral-900"
                : "text-neutral-500 hover:text-neutral-900 dark:hover:text-white bg-neutral-100 dark:bg-neutral-800"
            }`}
          >
            Partners List ({filteredAffiliates.length})
          </button>
          <button
            type="button"
            onClick={() => setSubView("fraud")}
            className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer flex items-center gap-1.5 ${
              subView === "fraud"
                ? "bg-red-600 text-white"
                : "text-neutral-500 hover:text-red-600 dark:hover:text-red-400 bg-neutral-100 dark:bg-neutral-800"
            }`}
          >
            <ShieldAlert className="size-3.5" />
            <span>Fraud Flags ({fraudFlags.length})</span>
          </button>
        </div>

        {subView === "affiliates" && (
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full md:w-auto">
            <div className="relative w-full sm:w-64">
              <Search className="size-3.5 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                placeholder="Search code or email..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white focus:outline-none focus:border-[#f97316] transition-colors"
              />
            </div>
            <ModernSelect
              value={statusFilter}
              options={STATUS_FILTER_OPTIONS}
              onChange={(val) => setStatusFilter(val)}
              size="sm"
              className="w-full sm:w-44"
              align="right"
            />
          </div>
        )}
      </div>

      {/* SubView 1: Affiliates List */}
      {subView === "affiliates" && (
        <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl sm:rounded-2xl overflow-hidden shadow-xs">
          {filteredAffiliates.length === 0 ? (
            <div className="py-12 px-6 text-center text-xs text-neutral-500">
              No affiliates found matching filters.
            </div>
          ) : (
            <>
              {/* Desktop Table View (visible on md screens and up) */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-left text-xs min-w-[760px]">
                  <thead className="bg-neutral-50 dark:bg-neutral-950 text-neutral-500 uppercase font-mono text-[10px] border-b border-neutral-200 dark:border-neutral-800">
                    <tr>
                      <th className="py-3 px-4">Partner Code</th>
                      <th className="py-3 px-4">Payout Email</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4">Rate</th>
                      <th className="py-3 px-4">Clicks</th>
                      <th className="py-3 px-4">Paying</th>
                      <th className="py-3 px-4">Payable Balance</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800 text-neutral-700 dark:text-neutral-300">
                    {filteredAffiliates.map((a) => (
                      <tr key={a.id} className="hover:bg-neutral-50/60 dark:hover:bg-neutral-850/40 transition-colors">
                        <td className="py-3.5 px-4 font-mono font-bold text-neutral-900 dark:text-white">
                          {a.referral_code}
                          {a.display_name && (
                            <span className="block text-[10px] font-normal text-neutral-400">
                              {a.display_name}
                            </span>
                          )}
                        </td>
                        <td className="py-3.5 px-4 font-mono text-neutral-600 dark:text-neutral-400">
                          {a.payout_email}
                        </td>
                        <td className="py-3.5 px-4">
                          <AffiliateStatusDropdown
                            status={a.status}
                            onChange={(next) => handleUpdateStatus(a.id, next)}
                          />
                        </td>
                        <td className="py-3.5 px-4">
                          <button
                            type="button"
                            onClick={() => {
                              setRateModalAffiliate(a);
                              setNewRatePercent((a.commission_rate_bps || 3000) / 100);
                            }}
                            className="font-mono font-bold hover:text-[#f97316] flex items-center gap-1 cursor-pointer"
                          >
                            {(a.commission_rate_bps || 3000) / 100}%
                            <Edit2 className="size-2.5 text-neutral-400" />
                          </button>
                        </td>
                        <td className="py-3.5 px-4 font-mono">{a.clicks_count}</td>
                        <td className="py-3.5 px-4 font-mono font-bold text-emerald-600 dark:text-emerald-400">
                          {a.paid_referrals_count}
                        </td>
                        <td className="py-3.5 px-4 font-mono font-bold text-[#f97316]">
                          {formatCents(a.payable_cents)}
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          <button
                            type="button"
                            onClick={() => {
                              setPayoutModalAffiliate(a);
                              setPayoutAmountCents(a.payable_cents > 0 ? a.payable_cents : 5000);
                              setPayoutTxId("");
                            }}
                            className="px-2.5 py-1 rounded-lg bg-neutral-900 hover:bg-neutral-800 text-white dark:bg-white dark:text-neutral-950 text-[10px] font-bold cursor-pointer transition-colors"
                          >
                            Payout
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile Card View (visible below md screens) */}
              <div className="block md:hidden divide-y divide-neutral-100 dark:divide-neutral-800">
                {filteredAffiliates.map((a) => (
                  <div key={a.id} className="p-4 space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="font-mono font-bold text-sm text-neutral-900 dark:text-white truncate">
                          {a.referral_code}
                        </p>
                        {a.display_name && (
                          <p className="text-[11px] text-neutral-400 truncate mt-0.5">
                            {a.display_name}
                          </p>
                        )}
                        <p className="text-xs font-mono text-neutral-500 dark:text-neutral-400 mt-1 break-all">
                          {a.payout_email}
                        </p>
                      </div>
                      <AffiliateStatusDropdown
                        status={a.status}
                        onChange={(next) => handleUpdateStatus(a.id, next)}
                      />
                    </div>

                    <div className="grid grid-cols-4 gap-2 bg-neutral-50 dark:bg-neutral-950 p-2.5 rounded-xl border border-neutral-100 dark:border-neutral-800/60 text-center">
                      <div>
                        <span className="text-[9px] uppercase font-mono text-neutral-400 block">Rate</span>
                        <button
                          type="button"
                          onClick={() => {
                            setRateModalAffiliate(a);
                            setNewRatePercent((a.commission_rate_bps || 3000) / 100);
                          }}
                          className="font-mono font-bold text-xs hover:text-[#f97316] inline-flex items-center gap-0.5 mt-0.5 cursor-pointer"
                        >
                          {(a.commission_rate_bps || 3000) / 100}%
                          <Edit2 className="size-2 text-neutral-400" />
                        </button>
                      </div>
                      <div>
                        <span className="text-[9px] uppercase font-mono text-neutral-400 block">Clicks</span>
                        <span className="font-mono text-xs font-semibold text-neutral-700 dark:text-neutral-300 mt-0.5 block">
                          {a.clicks_count}
                        </span>
                      </div>
                      <div>
                        <span className="text-[9px] uppercase font-mono text-neutral-400 block">Paying</span>
                        <span className="font-mono text-xs font-bold text-emerald-600 dark:text-emerald-400 mt-0.5 block">
                          {a.paid_referrals_count}
                        </span>
                      </div>
                      <div>
                        <span className="text-[9px] uppercase font-mono text-neutral-400 block">Payable</span>
                        <span className="font-mono text-xs font-bold text-[#f97316] mt-0.5 block">
                          {formatCents(a.payable_cents)}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center justify-end pt-1">
                      <button
                        type="button"
                        onClick={() => {
                          setPayoutModalAffiliate(a);
                          setPayoutAmountCents(a.payable_cents > 0 ? a.payable_cents : 5000);
                          setPayoutTxId("");
                        }}
                        className="w-full sm:w-auto px-4 py-2 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-white dark:bg-white dark:text-neutral-950 text-xs font-bold transition-colors cursor-pointer text-center"
                      >
                        Record Payout
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {/* SubView 2: Fraud Flags Audit Log */}
      {subView === "fraud" && (
        <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl sm:rounded-2xl overflow-hidden shadow-xs">
          {fraudFlags.length === 0 ? (
            <div className="py-12 px-6 text-center space-y-2">
              <ShieldCheck className="size-8 text-emerald-500 mx-auto" />
              <p className="text-xs font-semibold text-neutral-700 dark:text-neutral-300">
                Zero security flags recorded!
              </p>
              <p className="text-[11px] text-neutral-400">
                No self-referrals or suspicious abuse events have been intercepted.
              </p>
            </div>
          ) : (
            <>
              {/* Desktop Fraud Flags Table */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-left text-xs min-w-[680px]">
                  <thead className="bg-neutral-50 dark:bg-neutral-950 text-neutral-500 uppercase font-mono text-[10px] border-b border-neutral-200 dark:border-neutral-800">
                    <tr>
                      <th className="py-3 px-4">Date</th>
                      <th className="py-3 px-4">Severity</th>
                      <th className="py-3 px-4">Reason</th>
                      <th className="py-3 px-4">Affiliate ID</th>
                      <th className="py-3 px-4">IP Address</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800 text-neutral-700 dark:text-neutral-300">
                    {fraudFlags.map((flag) => (
                      <tr key={flag.id}>
                        <td className="py-3.5 px-4 font-mono text-neutral-500">
                          {new Date(flag.created_at).toLocaleString()}
                        </td>
                        <td className="py-3.5 px-4">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-mono uppercase font-bold ${
                              flag.severity === "high" || flag.severity === "critical"
                                ? "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400"
                                : "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400"
                            }`}
                          >
                            {flag.severity}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 font-semibold text-neutral-900 dark:text-white">
                          {flag.flag_reason}
                        </td>
                        <td className="py-3.5 px-4 font-mono text-neutral-400">
                          {flag.affiliate_id.slice(0, 8)}...
                        </td>
                        <td className="py-3.5 px-4 font-mono text-neutral-500">
                          {flag.ip_address || "hidden"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile Fraud Flags Card List */}
              <div className="block md:hidden divide-y divide-neutral-100 dark:divide-neutral-800">
                {fraudFlags.map((flag) => (
                  <div key={flag.id} className="p-4 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-mono uppercase font-bold ${
                          flag.severity === "high" || flag.severity === "critical"
                            ? "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400"
                            : "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400"
                        }`}
                      >
                        {flag.severity}
                      </span>
                      <span className="text-[10px] font-mono text-neutral-400">
                        {new Date(flag.created_at).toLocaleDateString()}
                      </span>
                    </div>
                    <p className="text-xs font-semibold text-neutral-900 dark:text-white">
                      {flag.flag_reason}
                    </p>
                    <div className="flex items-center justify-between text-[10px] font-mono text-neutral-400 pt-1">
                      <span>ID: {flag.affiliate_id.slice(0, 8)}...</span>
                      <span>IP: {flag.ip_address || "hidden"}</span>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {/* Edit Rate Modal */}
      {rateModalAffiliate && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-3xl p-5 sm:p-6 max-w-sm w-full shadow-2xl space-y-4 relative">
            <button
              type="button"
              onClick={() => setRateModalAffiliate(null)}
              className="absolute top-4 right-4 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 cursor-pointer p-1"
            >
              <X className="size-4" />
            </button>

            <div>
              <h3 className="text-sm font-bold text-neutral-900 dark:text-white">
                Update Commission Rate
              </h3>
              <p className="text-xs text-neutral-500 mt-1">
                Set custom commission rate for <strong>{rateModalAffiliate.referral_code}</strong>.
              </p>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold text-neutral-700 dark:text-neutral-300">
                Rate Percentage (%):
              </label>
              <input
                type="number"
                min="0"
                max="100"
                value={newRatePercent}
                onChange={(e) => setNewRatePercent(parseFloat(e.target.value) || 0)}
                className="w-full px-3 py-2 text-sm rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950 text-neutral-900 dark:text-white focus:outline-none focus:border-[#f97316] transition-colors"
              />
              <span className="text-[10px] text-neutral-400 font-mono block">
                Basis Points: {Math.round(newRatePercent * 100)} bps
              </span>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setRateModalAffiliate(null)}
                className="px-4 py-2 text-xs font-semibold text-neutral-600 dark:text-neutral-400 cursor-pointer hover:underline"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveRate}
                disabled={savingRate}
                className="px-4 py-2 rounded-xl bg-[#f97316] text-white text-xs font-bold cursor-pointer disabled:opacity-50 hover:opacity-90 transition-opacity"
              >
                {savingRate ? "Saving..." : "Save Rate"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Record Payout Modal */}
      {payoutModalAffiliate && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-3xl p-5 sm:p-6 max-w-md w-full shadow-2xl space-y-4 relative">
            <button
              type="button"
              onClick={() => setPayoutModalAffiliate(null)}
              className="absolute top-4 right-4 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 cursor-pointer p-1"
            >
              <X className="size-4" />
            </button>

            <div>
              <h3 className="text-sm font-bold text-neutral-900 dark:text-white">
                Record External Payout
              </h3>
              <p className="text-xs text-neutral-500 mt-1">
                Partner: <strong>{payoutModalAffiliate.referral_code}</strong> ({payoutModalAffiliate.payout_email})
              </p>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-neutral-700 dark:text-neutral-300 block mb-1">
                  Payout Amount (USD)
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2 text-xs font-mono text-neutral-400">$</span>
                  <input
                    type="number"
                    step="0.01"
                    min="1"
                    value={payoutAmountCents / 100}
                    onChange={(e) => setPayoutAmountCents(Math.round(parseFloat(e.target.value || "0") * 100))}
                    className="w-full pl-7 pr-3 py-2 text-xs rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950 text-neutral-900 dark:text-white focus:outline-none focus:border-[#f97316] transition-colors"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-neutral-700 dark:text-neutral-300 block mb-1">
                  Payment Method
                </label>
                <div className="p-3 rounded-xl bg-blue-50/70 dark:bg-blue-950/40 border border-blue-200/70 dark:border-blue-800/60 flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="size-7 rounded-lg bg-[#003087] text-white flex items-center justify-center font-bold text-xs">
                      P
                    </div>
                    <div>
                      <span className="text-xs font-bold text-neutral-900 dark:text-white block">
                        PayPal Disbursal
                      </span>
                      <span className="text-[10px] font-mono text-neutral-500">
                        {payoutModalAffiliate.payout_email}
                      </span>
                    </div>
                  </div>
                  <span className="px-2 py-0.5 rounded-full text-[9px] font-mono uppercase font-bold bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400">
                    PayPal Only
                  </span>
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-neutral-700 dark:text-neutral-300 block mb-1">
                  PayPal Transaction ID / Batch ID (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. PP-BATCH-994812"
                  value={payoutTxId}
                  onChange={(e) => setPayoutTxId(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950 text-neutral-900 dark:text-white focus:outline-none focus:border-[#f97316] transition-colors"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setPayoutModalAffiliate(null)}
                className="px-4 py-2 text-xs font-semibold text-neutral-600 dark:text-neutral-400 cursor-pointer hover:underline"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleRecordPayout}
                disabled={recordingPayout || payoutAmountCents <= 0}
                className="px-4 py-2 rounded-xl bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 text-xs font-bold cursor-pointer disabled:opacity-50 hover:opacity-90 transition-opacity"
              >
                {recordingPayout ? "Recording..." : "Disburse via PayPal & Notify"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
