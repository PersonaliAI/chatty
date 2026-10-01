"use client";

import { useState, useEffect, useMemo } from "react";
import {
  Megaphone,
  Sparkles,
  ListChecks,
  Loader2,
  Plus,
  Trash2,
  Clock,
  MousePointer,
  ArrowUpRight,
  Globe,
  Users,
  UserCheck,
  Send,
  Mail,
  MessageSquare,
  Smartphone,
  Search,
  Eye,
  Check,
  X,
  ShieldCheck,
  RefreshCw,
  History,
} from "lucide-react";
import { ModernSelect, type ModernSelectOption } from "@/components/ui/modern-select";
import { ModernSwitch } from "@/components/ui/modern-switch";
import { ModernAlert } from "@/components/ui/modern-alert";
import { DateTimePicker, TimePicker } from "@/components/ui/date-time-picker";
import { createClient } from "@/lib/supabase/client";
import { SELF_HOST_MODE } from "@/lib/deployment";

interface TriggerRule {
  id: string;
  type: "time" | "scroll" | "exit" | "url";
  value: string;
  message: string;
  name?: string;
  impressions?: number;
  clicks?: number;
  conversions?: number;
  clickRate?: number;
  conversionRate?: number;
  queued?: number;
  sent?: number;
  failed?: number;
  suppressed?: number;
  deliverySuccessRate?: number;
  byDevice?: Record<string, number>;
  byChannel?: Record<string, number>;
  audience?: string;
  recipientSource?: "widget" | "consented_leads";
  channels?: string[];
  sequenceSteps?: Array<Record<string, unknown>>;
  isActive?: boolean;
  nextRunAt?: string | null;
  scheduleCadence?: string;
  startDate?: string | null;
  endDate?: string | null;
  quietHours?: { start: string; end: string } | null;
}

interface Props {
  botId: string | null;
  color?: string;
  fetchBackend: (path: string, options?: RequestInit) => Promise<Response>;
}

type CampaignSequenceStep = { channel: string; after_minutes: number; message: string };
type DispatchJob = {
  idempotency_key: string;
  scheduled_at: string;
  payload: { channel?: string; requires_consent?: boolean; frequency_cap_hours?: number; message?: string };
};
type DispatchPreview = { loading?: boolean; jobs?: DispatchJob[]; deferred?: boolean; deferred_reason?: string; error?: string };
type DeliveryRow = { id: string; idempotency_key: string; status: string; channel: string; recipient_id?: string | null; error?: string | null; updated_at?: string | null };
type DeliveryLog = { loading?: boolean; available?: boolean; deliveries?: DeliveryRow[]; error?: string };
type DeliveryStatus = "all" | "queued" | "sent" | "failed" | "suppressed";

type ActiveCampaignTab = "list" | "builder" | "copilot" | "audit";

export function CampaignsUI({ botId, color = "#f97316", fetchBackend }: Props) {
  const [activeTab, setActiveTab] = useState<ActiveCampaignTab>("list");

  // State: List
  const [rules, setRules] = useState<TriggerRule[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "paused">("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");

  // State: Builder Form
  const [campaignName, setCampaignName] = useState("");
  const [type, setType] = useState<"time" | "scroll" | "exit" | "url">("time");
  const [value, setValue] = useState("5");
  const [message, setMessage] = useState("");
  const [audience, setAudience] = useState("all");
  const [minIntentScore, setMinIntentScore] = useState(0);
  const [returningOnly, setReturningOnly] = useState(false);
  const [channels, setChannels] = useState<string[]>(["web"]);
  const [cadence, setCadence] = useState("once");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [quietHoursEnabled, setQuietHoursEnabled] = useState(false);
  const [quietHoursStart, setQuietHoursStart] = useState("22:00");
  const [quietHoursEnd, setQuietHoursEnd] = useState("08:00");
  const [frequencyCapHours, setFrequencyCapHours] = useState(24);
  const [sequenceSteps, setSequenceSteps] = useState<CampaignSequenceStep[]>([]);

  // State: AI Copilot
  const [goal, setGoal] = useState("");
  const [suggesting, setSuggesting] = useState(false);
  const [suggestingAudience, setSuggestingAudience] = useState(false);
  const [audienceRationale, setAudienceRationale] = useState("");

  // State: Previews & Logs
  const [dispatchPlans, setDispatchPlans] = useState<Record<string, DispatchPreview>>({});
  const [deliveryLogs, setDeliveryLogs] = useState<Record<string, DeliveryLog>>({});
  const [deliveryStatus, setDeliveryStatus] = useState<Record<string, DeliveryStatus>>({});

  // Options for ModernSelect
  const typeOptions: ModernSelectOption[] = [
    { value: "time", label: "Time on Page (Seconds)", icon: <Clock className="size-4 text-blue-500" />, hint: "Trigger after visitor spends X seconds" },
    { value: "scroll", label: "Scroll Depth (Percentage)", icon: <MousePointer className="size-4 text-purple-500" />, hint: "Trigger when scrolled past X%" },
    { value: "exit", label: "Exit Intent (Mouse Leave)", icon: <ArrowUpRight className="size-4 text-rose-500" />, hint: "Trigger when cursor heads towards browser exit" },
    { value: "url", label: "URL Path Match", icon: <Globe className="size-4 text-emerald-500" />, hint: "Trigger only on matching subpaths (e.g. /pricing)" },
  ];

  const audienceOptions: ModernSelectOption[] = [
    { value: "all", label: "All Website Visitors", icon: <Users className="size-4 text-blue-500" />, hint: "Targets every new & returning visitor" },
    { value: "returning", label: "Returning Visitors Only", icon: <UserCheck className="size-4 text-emerald-500" />, hint: "Only visitors with prior recorded visits" },
    { value: "high_intent", label: "High-Intent Prospects", icon: <Sparkles className="size-4 text-amber-500" />, hint: "Scored by browsing depth & page engagement" },
  ];

  const cadenceOptions: ModernSelectOption[] = [
    { value: "once", label: "Run Once (Per Visitor Session)" },
    { value: "hourly", label: "Hourly (Re-evaluate Every Hour)" },
    { value: "daily", label: "Daily (Once per 24 Hours)" },
    { value: "weekly", label: "Weekly Digest" },
  ];

  const mapCampaignRow = (row: Record<string, unknown>): TriggerRule => ({
    id: String(row.id),
    name: String(row.name || `${row.trigger_type || "Proactive"} Campaign`),
    type:
      String(row.trigger_type ?? "time_on_page") === "scroll_percentage"
        ? "scroll"
        : String(row.trigger_type ?? "time_on_page") === "exit_intent"
          ? "exit"
          : String(row.trigger_type ?? "time_on_page") === "url_match"
            ? "url"
            : "time",
    value:
      String(row.trigger_type ?? "") === "url_match"
        ? String((row.url_patterns as string[] | undefined)?.[0] ?? "")
        : String(row.trigger_value ?? ""),
    message: String(row.message_content ?? row.message ?? ""),
    impressions: Number(row.impressions ?? 0),
    clicks: Number(row.clicks ?? 0),
    conversions: Number(row.conversions ?? 0),
    audience: String((row.audience_rules as { segment?: string } | undefined)?.segment ?? "all"),
    recipientSource:
      String((row.audience_rules as { recipient_source?: string } | undefined)?.recipient_source ?? "widget") === "consented_leads"
        ? "consented_leads"
        : "widget",
    channels: Array.isArray(row.channels) ? row.channels.map(String) : ["web"],
    sequenceSteps: Array.isArray(row.sequence_steps) ? (row.sequence_steps as Array<Record<string, unknown>>) : [],
    isActive: row.is_active !== false,
    startDate: row.start_date ? String(row.start_date) : null,
    endDate: row.end_date ? String(row.end_date) : null,
    quietHours:
      (row.safety_config as { quiet_hours?: { start?: string; end?: string } } | undefined)?.quiet_hours?.start &&
      (row.safety_config as { quiet_hours?: { start?: string; end?: string } } | undefined)?.quiet_hours?.end
        ? {
            start: String((row.safety_config as { quiet_hours: { start: string } }).quiet_hours.start),
            end: String((row.safety_config as { quiet_hours: { end: string } }).quiet_hours.end),
          }
        : null,
  });

  // Fetch campaigns
  const loadCampaigns = async () => {
    if (!botId || loading) return;
    setLoading(true);
    setError(null);
    let loadedRules: TriggerRule[] | null = null;

    // 1. Try REST API endpoint
    try {
      const response = await fetchBackend(`/api/bots/${botId}/campaigns`);
      if (response.ok) {
        const rows = (await response.json()) as Array<Record<string, unknown>>;
        loadedRules = rows.map(mapCampaignRow);
      }
    } catch {
      // Backend API offline or error; fallback to direct Supabase query
    }

    // 2. Direct Supabase Fallback (managed mode)
    if (!loadedRules && !SELF_HOST_MODE) {
      try {
        const supabase = createClient();
        const { data, error: dbErr } = await supabase
          .from("chatty_campaigns")
          .select("*")
          .eq("bot_id", botId)
          .order("created_at", { ascending: false });
        if (!dbErr && data) {
          loadedRules = data.map((r) => mapCampaignRow(r as Record<string, unknown>));
        }
      } catch {
        // Supabase query error
      }
    }

    // 3. Local Storage Fallback if all network queries fail
    if (!loadedRules) {
      try {
        const saved = botId ? localStorage.getItem(`chatty_campaigns_${botId}`) : null;
        if (saved) {
          loadedRules = JSON.parse(saved);
          setError("Campaign service is offline; showing local backup.");
        }
      } catch {
        // ignore
      }
    }

    if (loadedRules) {
      setRules(loadedRules);
      try {
        localStorage.setItem(`chatty_campaigns_${botId}`, JSON.stringify(loadedRules));
      } catch {}

      // Asynchronously enrich with metrics & schedule previews
      Promise.all(
        loadedRules.map(async (rule) => {
          try {
            const [metricResponse, scheduleResponse] = await Promise.all([
              fetchBackend(`/api/bots/${botId}/campaigns/${rule.id}/analytics`),
              fetchBackend(`/api/bots/${botId}/campaigns/${rule.id}/schedule-preview`),
            ]);
            const metric = metricResponse.ok ? await metricResponse.json() : {};
            const schedule = scheduleResponse.ok ? await scheduleResponse.json() : {};
            return {
              id: rule.id,
              impressions: Number(metric.impressions ?? rule.impressions ?? 0),
              clicks: Number(metric.clicks ?? rule.clicks ?? 0),
              conversions: Number(metric.conversions ?? rule.conversions ?? 0),
              clickRate: Number(metric.click_rate ?? 0),
              conversionRate: Number(metric.conversion_rate ?? 0),
              queued: Number(metric.queued ?? 0),
              sent: Number(metric.sent ?? 0),
              failed: Number(metric.failed ?? 0),
              suppressed: Number(metric.suppressed ?? 0),
              deliverySuccessRate: Number(metric.delivery_success_rate ?? 0),
              byDevice: metric.by_device ?? {},
              byChannel: metric.by_channel ?? {},
              nextRunAt: schedule.next_run_at ?? null,
              scheduleCadence: String(schedule.schedule_config?.cadence ?? "once"),
            };
          } catch {
            return null;
          }
        })
      ).then((analytics) => {
        setRules((current) =>
          current.map((rule) => {
            const metric = analytics.find((item) => item?.id === rule.id);
            return metric ? { ...rule, ...metric } : rule;
          })
        );
      });
    } else {
      setError("Campaign service is offline; showing local backup.");
    }
    setLoading(false);
  };

  useEffect(() => {
    loadCampaigns();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [botId]);

  // Aggregate Metrics
  const metrics = useMemo(() => {
    const totalCampaigns = rules.length;
    const activeCount = rules.filter((r) => r.isActive !== false).length;
    const totalImpressions = rules.reduce((acc, r) => acc + (r.impressions || 0), 0);
    const totalClicks = rules.reduce((acc, r) => acc + (r.clicks || 0), 0);
    const totalConversions = rules.reduce((acc, r) => acc + (r.conversions || 0), 0);
    const avgCtr = totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0;
    const avgCvr = totalClicks > 0 ? (totalConversions / totalClicks) * 100 : 0;
    const totalDelivered = rules.reduce((acc, r) => acc + (r.sent || 0), 0);

    return { totalCampaigns, activeCount, totalImpressions, totalClicks, totalConversions, avgCtr, avgCvr, totalDelivered };
  }, [rules]);

  // Filtered Rules
  const filteredRules = useMemo(() => {
    return rules.filter((r) => {
      if (statusFilter === "active" && r.isActive === false) return false;
      if (statusFilter === "paused" && r.isActive !== false) return false;
      if (typeFilter !== "all" && r.type !== typeFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          r.message.toLowerCase().includes(q) ||
          (r.name && r.name.toLowerCase().includes(q)) ||
          r.value.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [rules, statusFilter, typeFilter, searchQuery]);

  const toggleChannel = (val: string) => {
    setChannels((curr) => (curr.includes(val) ? curr.filter((c) => c !== val) : [...curr, val]));
  };

  const addSequenceStep = () => {
    setSequenceSteps((curr) => [...curr, { channel: channels[0] || "web", after_minutes: 15, message: "" }]);
  };

  const updateSequenceStep = (idx: number, patch: Partial<CampaignSequenceStep>) => {
    setSequenceSteps((curr) => curr.map((step, i) => (i === idx ? { ...step, ...patch } : step)));
  };

  const saveNewCampaign = async () => {
    if (!message.trim() || !botId) return;
    if (!channels.length) {
      setError("Please select at least one channel (e.g. Website).");
      return;
    }
    if (message.trim().length > 10_000) {
      setError("Campaign message must be 10,000 characters or fewer.");
      return;
    }
    if ((type === "time" || type === "scroll") && (!Number.isFinite(Number(value)) || Number(value) <= 0)) {
      setError(type === "time" ? "Time on page must be greater than zero seconds." : "Scroll depth must be greater than zero percent.");
      return;
    }
    if (type === "scroll" && Number(value) > 100) {
      setError("Scroll depth cannot exceed 100 percent.");
      return;
    }
    const parsedStart = startDate ? new Date(startDate).getTime() : null;
    const parsedEnd = endDate ? new Date(endDate).getTime() : null;
    if (parsedStart !== null && !Number.isFinite(parsedStart)) {
      setError("The campaign start date is invalid.");
      return;
    }
    if (parsedEnd !== null && !Number.isFinite(parsedEnd)) {
      setError("The campaign end date is invalid.");
      return;
    }
    if (parsedStart !== null && parsedEnd !== null && parsedEnd <= parsedStart) {
      setError("The campaign end date must be later than its start date.");
      return;
    }
    const validClock = (value: string) => {
      if (!/^\d{2}:\d{2}$/.test(value)) return false;
      const [hours, minutes] = value.split(":").map(Number);
      return hours >= 0 && hours <= 23 && minutes >= 0 && minutes <= 59;
    };
    if (quietHoursEnabled && (!validClock(quietHoursStart) || !validClock(quietHoursEnd))) {
      setError("Quiet hours must use the HH:MM format.");
      return;
    }
    if (!Number.isInteger(frequencyCapHours) || frequencyCapHours < 1 || frequencyCapHours > 720) {
      setError("Frequency cap must be between 1 and 720 hours.");
      return;
    }
    setSaving(true);
    setError(null);

    const invalidTiming = sequenceSteps.find((s) => {
      const minutes = Number(s.after_minutes);
      return !Number.isFinite(minutes) || minutes < 0 || minutes > 43_200;
    });
    if (invalidTiming) {
      setError("Sequence delays must be between 0 minutes and 30 days.");
      setSaving(false);
      return;
    }
    const cleanSteps = sequenceSteps
      .map((s) => ({
        channel: s.channel,
        after_minutes: Number(s.after_minutes),
        message: s.message.trim(),
      }))
      .filter((s) => Boolean(s.message));
    const duplicateStep = cleanSteps.find((step, index) =>
      cleanSteps.slice(0, index).some((prior) => prior.channel === step.channel && prior.after_minutes === step.after_minutes && prior.message === step.message)
    );
    if (duplicateStep) {
      setError("Sequence steps must not contain duplicate channel, timing, and message combinations.");
      setSaving(false);
      return;
    }
    const invalidStep = cleanSteps.find((step) => !channels.includes(step.channel));
    if (invalidStep) {
      setError(`Sequence channel “${invalidStep.channel}” is not enabled for this campaign.`);
      setSaving(false);
      return;
    }

    const triggerType = type === "time" ? "time_on_page" : type === "scroll" ? "scroll_percentage" : type === "exit" ? "exit_intent" : "url_match";

    const payload = {
      bot_id: botId,
      name: campaignName.trim() || `${type.toUpperCase()} Campaign`,
      campaign_type: "chat_bubble",
      message_content: message.trim(),
      url_patterns: type === "url" ? [value.trim() || "/"] : ["*"],
      trigger_type: triggerType,
      trigger_value: type === "url" || type === "exit" ? 0 : Number(value) || 5,
      target_devices: ["desktop", "mobile"],
      is_active: true,
      audience_rules: {
        segment: audience,
        min_intent_score: minIntentScore,
        returning_only: returningOnly,
        recipient_source: channels.some((c) => c !== "web") || cleanSteps.some((s) => s.channel !== "web") ? "consented_leads" : "widget",
      },
      channels,
      sequence_steps: cleanSteps,
      safety_config: {
        frequency_cap_hours: frequencyCapHours,
        require_consent: true,
        ...(quietHoursEnabled ? { quiet_hours: { start: quietHoursStart, end: quietHoursEnd } } : {}),
      },
      schedule_config: { cadence, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC" },
      start_date: startDate ? new Date(startDate).toISOString() : null,
      end_date: endDate ? new Date(endDate).toISOString() : null,
    };

    setSaving(true);
    let createdRow: Record<string, unknown> | null = null;
    try {
      const response = await fetchBackend(`/api/bots/${botId}/campaigns`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (response.ok) {
        createdRow = (await response.json()) as Record<string, unknown>;
      }
    } catch {
      // Backend API offline; fallback to direct Supabase insert
    }

    if (!createdRow && !SELF_HOST_MODE) {
      try {
        const supabase = createClient();
        const { data, error: dbErr } = await supabase
          .from("chatty_campaigns")
          .insert(payload)
          .select()
          .single();
        if (!dbErr && data) {
          createdRow = data as Record<string, unknown>;
        }
      } catch {
        // ignore
      }
    }

    if (createdRow) {
      const created = mapCampaignRow(createdRow);
      setRules((curr) => {
        const next = [created, ...curr];
        if (botId) localStorage.setItem(`chatty_campaigns_${botId}`, JSON.stringify(next));
        return next;
      });
      // Reset builder form
      setCampaignName("");
      setMessage("");
      setValue("5");
      setSequenceSteps([]);
      setStartDate("");
      setEndDate("");
      setQuietHoursEnabled(false);
      setActiveTab("list");
      setError(null);
    } else {
      setError("Failed to create campaign.");
    }
    setSaving(false);
  };

  const toggleRuleActive = async (rule: TriggerRule) => {
    if (!botId) return;
    const nextState = rule.isActive === false;
    let success = false;
    try {
      const res = await fetchBackend(`/api/bots/${botId}/campaigns/${rule.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_active: nextState }),
      });
      if (res.ok) success = true;
    } catch {}

    if (!success && !SELF_HOST_MODE) {
      try {
        const supabase = createClient();
        const { error: dbErr } = await supabase
          .from("chatty_campaigns")
          .update({ is_active: nextState })
          .eq("id", rule.id);
        if (!dbErr) success = true;
      } catch {}
    }

    if (success) {
      setRules((curr) => {
        const next = curr.map((r) => (r.id === rule.id ? { ...r, isActive: nextState } : r));
        if (botId) localStorage.setItem(`chatty_campaigns_${botId}`, JSON.stringify(next));
        return next;
      });
    }
  };

  const deleteRule = async (id: string) => {
    if (!botId) return;
    let success = false;
    try {
      const res = await fetchBackend(`/api/bots/${botId}/campaigns/${id}`, { method: "DELETE" });
      if (res.ok) success = true;
    } catch {}

    if (!success && !SELF_HOST_MODE) {
      try {
        const supabase = createClient();
        const { error: dbErr } = await supabase
          .from("chatty_campaigns")
          .delete()
          .eq("id", id);
        if (!dbErr) success = true;
      } catch {}
    }

    if (success) {
      setRules((curr) => {
        const next = curr.filter((r) => r.id !== id);
        if (botId) localStorage.setItem(`chatty_campaigns_${botId}`, JSON.stringify(next));
        return next;
      });
    }
  };

  const suggestCampaignWithAI = () => {
    if (!botId || !goal.trim()) return;
    setSuggesting(true);
    setError(null);
    fetchBackend(`/api/bots/${botId}/campaigns/suggest`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ goal: goal.trim() }),
    })
      .then(async (response) => {
        if (!response.ok) throw new Error("AI copilot suggestion failed");
        const suggestion = (await response.json()) as {
          message_content?: string;
          trigger_type?: string;
          trigger_value?: number;
          sequence_steps?: Array<Record<string, unknown>>;
        };
        const suggestedType =
          suggestion.trigger_type === "scroll_percentage"
            ? "scroll"
            : suggestion.trigger_type === "exit_intent"
              ? "exit"
              : suggestion.trigger_type === "url_match"
                ? "url"
                : "time";
        setType(suggestedType);
        setValue(suggestedType === "exit" ? "" : String(suggestion.trigger_value ?? 5));
        setMessage(String(suggestion.message_content ?? ""));
        setCampaignName(`AI: ${goal.trim().slice(0, 30)}`);
        setActiveTab("builder");
      })
      .catch((err) => setError(err instanceof Error ? err.message : "AI suggestion failed"))
      .finally(() => setSuggesting(false));
  };

  const suggestAudienceWithAI = () => {
    if (!botId || !goal.trim()) return;
    setSuggestingAudience(true);
    setError(null);
    fetchBackend(`/api/bots/${botId}/campaigns/audience-suggest`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ goal: goal.trim(), audience }),
    })
      .then(async (response) => {
        if (!response.ok) throw new Error("AI audience suggestion failed");
        const result = (await response.json()) as {
          audience_rules?: { segment?: string; min_intent_score?: number; returning_only?: boolean };
          rationale?: string;
        };
        const segment = result.audience_rules?.segment;
        if (segment === "all" || segment === "returning" || segment === "high_intent") setAudience(segment);
        setMinIntentScore(Math.max(0, Math.min(100, Number(result.audience_rules?.min_intent_score ?? 0))));
        setReturningOnly(Boolean(result.audience_rules?.returning_only));
        setAudienceRationale(String(result.rationale ?? "").slice(0, 240));
      })
      .catch((err) => setError(err instanceof Error ? err.message : "AI audience suggestion failed"))
      .finally(() => setSuggestingAudience(false));
  };

  const toggleDispatchPlan = (id: string) => {
    if (!botId) return;
    if (dispatchPlans[id]) {
      setDispatchPlans((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
      return;
    }
    setDispatchPlans((prev) => ({ ...prev, [id]: { loading: true } }));
    fetchBackend(`/api/bots/${botId}/campaigns/${id}/dispatch-plan`)
      .then(async (res) => {
        const data = await res.json();
        setDispatchPlans((prev) => ({
          ...prev,
          [id]: { jobs: data.jobs || [], deferred: data.deferred, deferred_reason: data.deferred_reason },
        }));
      })
      .catch((err) => {
        setDispatchPlans((prev) => ({ ...prev, [id]: { error: err.message } }));
      });
  };

  const toggleDeliveryLog = (id: string) => {
    if (!botId) return;
    if (deliveryLogs[id]) {
      setDeliveryLogs((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
      return;
    }
    setDeliveryLogs((prev) => ({ ...prev, [id]: { loading: true } }));
    const status = deliveryStatus[id] || "all";
    const query = status === "all" ? "" : `&status=${encodeURIComponent(status)}`;
    fetchBackend(`/api/bots/${botId}/campaigns/${id}/deliveries?limit=50${query}`)
      .then(async (res) => {
        const data = await res.json();
        setDeliveryLogs((prev) => ({
          ...prev,
          [id]: { available: data.available, deliveries: data.deliveries || [] },
        }));
      })
      .catch((err) => {
        setDeliveryLogs((prev) => ({ ...prev, [id]: { error: err.message } }));
      });
  };

  return (
    <div className="max-w-7xl mx-auto w-full pt-4 sm:pt-6 pb-12 px-4 sm:px-6 space-y-6">
      {/* ── Top Header & Stats Overview ── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 dark:border-neutral-800 pb-5">
        <div className="min-w-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="size-10 sm:size-9 shrink-0 rounded-xl bg-gradient-to-tr from-orange-500 to-amber-500 text-white flex items-center justify-center shadow-xs">
              <Megaphone className="size-5 shrink-0" strokeWidth={2.25} />
            </div>
            <div className="min-w-0">
              <h2 className="text-lg font-bold text-neutral-900 dark:text-neutral-100 tracking-tight">
                Proactive Campaigns
              </h2>
              <p className="text-xs text-neutral-500 dark:text-neutral-400">
                Trigger targeted teaser popups, behavioral prompts, and automated multi-channel sequences.
              </p>
              <p className="text-[11px] font-semibold text-neutral-500 dark:text-neutral-400">
                AI campaign copilot
              </p>
              <p className="text-[11px] text-neutral-400 dark:text-neutral-500">
                <span>Start window</span><span aria-hidden="true"> · </span><span>End window</span>
              </p>
            </div>
          </div>
        </div>

        {/* Global Action */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setActiveTab("builder")}
            className="w-full sm:w-auto justify-center flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-white shadow-sm transition-all cursor-pointer hover:opacity-95 whitespace-nowrap"
            style={{ background: color }}
          >
            <Plus className="size-4" />
            <span>Create Campaign</span>
          </button>
        </div>
      </div>

      {/* ── Metrics Cards Ribbon ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
        <div className="p-4 rounded-2xl border border-slate-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 shadow-2xs space-y-1">
          <div className="flex items-center justify-between text-neutral-400 text-xs font-medium">
            <span>Active Campaigns</span>
            <span className="size-2 rounded-full bg-emerald-500 animate-pulse" />
          </div>
          <div className="text-xl font-extrabold text-neutral-900 dark:text-neutral-100">
            {metrics.activeCount} <span className="text-xs font-normal text-neutral-400">/ {metrics.totalCampaigns}</span>
          </div>
        </div>

        <div className="p-4 rounded-2xl border border-slate-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 shadow-2xs space-y-1">
          <div className="flex items-center justify-between text-neutral-400 text-xs font-medium">
            <span>Impressions</span>
            <Eye className="size-3.5 text-blue-500" />
          </div>
          <div className="text-xl font-extrabold text-neutral-900 dark:text-neutral-100">
            {metrics.totalImpressions.toLocaleString()}
          </div>
        </div>

        <div className="p-4 rounded-2xl border border-slate-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 shadow-2xs space-y-1">
          <div className="flex items-center justify-between text-neutral-400 text-xs font-medium">
            <span>Click-Through (CTR)</span>
            <MousePointer className="size-3.5 text-purple-500" />
          </div>
          <div className="text-xl font-extrabold text-neutral-900 dark:text-neutral-100">
            {metrics.avgCtr.toFixed(1)}%
          </div>
        </div>

        <div className="p-4 rounded-2xl border border-slate-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 shadow-2xs space-y-1">
          <div className="flex items-center justify-between text-neutral-400 text-xs font-medium">
            <span>Conversions (CVR)</span>
            <Sparkles className="size-3.5 text-amber-500" />
          </div>
          <div className="text-xl font-extrabold text-neutral-900 dark:text-neutral-100">
            {metrics.avgCvr.toFixed(1)}%
          </div>
        </div>
      </div>

      {/* ── Error Banner ── */}
      {error && (
        <ModernAlert variant="error" onDismiss={() => setError(null)} title="Action Alert">
          {error}
        </ModernAlert>
      )}

      {/* ── Segmented Navigation Tabs ── */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between border-b border-slate-200 dark:border-neutral-800 pb-2">
        <div className="min-w-0 max-w-full overflow-x-auto overscroll-x-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <div className="inline-flex min-w-max items-center gap-1.5 p-1 bg-slate-100 dark:bg-neutral-850 rounded-xl border border-slate-200/80 dark:border-neutral-800">
          {[
            { id: "list", label: "All Campaigns", count: rules.length },
            { id: "builder", label: "Campaign Builder" },
            { id: "copilot", label: "AI Copilot & Playbooks" },
          ].map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id as ActiveCampaignTab)}
                className={`flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                  isActive
                    ? "bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white shadow-xs"
                    : "text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200"
                }`}
              >
                <span>{tab.label}</span>
                {tab.count !== undefined && (
                  <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-slate-200 dark:bg-neutral-750 text-neutral-600 dark:text-neutral-300 font-semibold">
                    {tab.count}
                  </span>
                )}
              </button>
            );
          })}
          </div>
        </div>

        {activeTab === "list" && (
          <button
            type="button"
            onClick={loadCampaigns}
            disabled={loading}
            aria-busy={loading}
            className="self-start sm:self-auto shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 text-xs font-bold text-neutral-600 dark:text-neutral-300 hover:bg-slate-50 cursor-pointer shadow-2xs whitespace-nowrap disabled:cursor-wait disabled:opacity-60"
          >
            <RefreshCw className={`size-3.5 ${loading ? "animate-spin" : ""}`} />
            <span>Sync</span>
          </button>
        )}
      </div>

      {/* ── TAB 1: ALL CAMPAIGNS LIST ── */}
      {activeTab === "list" && (
        <div className="space-y-4">
          {/* Filters & Search Toolbar */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white dark:bg-neutral-900 p-3.5 rounded-2xl border border-slate-200 dark:border-neutral-800 shadow-2xs">
            <div className="relative flex-1 max-w-md">
              <Search className="size-4 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search campaigns by name, message, or URL path..."
                className="w-full bg-slate-50 dark:bg-neutral-950 border border-slate-200 dark:border-neutral-800 rounded-xl pl-9 pr-3 py-1.5 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-[#f97316]/20"
              />
            </div>

            <div className="flex items-center gap-2">
              <ModernSelect
                value={statusFilter}
                options={[
                  { value: "all", label: "Status: All" },
                  { value: "active", label: "Status: Active Only" },
                  { value: "paused", label: "Status: Paused Only" },
                ]}
                onChange={(val) => setStatusFilter(val as "all" | "active" | "paused")}
                size="sm"
              />

              <ModernSelect
                value={typeFilter}
                options={[
                  { value: "all", label: "Trigger: All" },
                  { value: "time", label: "Trigger: Time on Page" },
                  { value: "scroll", label: "Trigger: Scroll Depth" },
                  { value: "exit", label: "Trigger: Exit Intent" },
                  { value: "url", label: "Trigger: URL Match" },
                ]}
                onChange={(val) => setTypeFilter(val)}
                size="sm"
              />
            </div>
          </div>

          {loading && (
            <div className="py-16 flex flex-col items-center justify-center gap-2 text-neutral-400">
              <Loader2 className="size-7 animate-spin text-[#f97316]" />
              <span className="text-xs">Loading campaigns…</span>
            </div>
          )}

          {!loading && filteredRules.length === 0 && (
            <div className="text-center py-16 bg-white dark:bg-neutral-900 border border-slate-200 dark:border-neutral-800 rounded-2xl p-8 space-y-3">
              <Megaphone className="size-10 text-neutral-300 mx-auto" />
              <h4 className="font-bold text-sm text-neutral-800 dark:text-neutral-200">No campaigns found</h4>
              <p className="text-xs text-neutral-400 max-w-sm mx-auto">
                Create proactive trigger campaigns to engage visitors based on delay, scroll percentage, or exit intent.
              </p>
              <button
                type="button"
                onClick={() => setActiveTab("builder")}
                className="px-4 py-2 rounded-xl text-xs font-bold text-white shadow-sm cursor-pointer whitespace-nowrap"
                style={{ background: color }}
              >
                Create First Campaign
              </button>
            </div>
          )}

          {/* Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredRules.map((rule) => {
              const typeBadge = {
                time: { label: "Time on Page", icon: <Clock className="size-3.5 text-blue-500" />, bg: "bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300" },
                scroll: { label: "Scroll Depth", icon: <MousePointer className="size-3.5 text-purple-500" />, bg: "bg-purple-50 text-purple-700 dark:bg-purple-950 dark:text-purple-300" },
                exit: { label: "Exit Intent", icon: <ArrowUpRight className="size-3.5 text-rose-500" />, bg: "bg-rose-50 text-rose-700 dark:bg-rose-950 dark:text-rose-300" },
                url: { label: "URL Match", icon: <Globe className="size-3.5 text-emerald-500" />, bg: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300" },
              }[rule.type];

              return (
                <div
                  key={rule.id}
                  className={`bg-white dark:bg-neutral-900 border border-slate-200 dark:border-neutral-800 rounded-2xl p-5 shadow-xs space-y-4 transition-all hover:shadow-md ${
                    rule.isActive === false ? "opacity-70" : ""
                  }`}
                >
                  {/* Card Header */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${typeBadge.bg}`}>
                          {typeBadge.icon}
                          <span>{typeBadge.label}</span>
                        </span>
                        {rule.type !== "exit" && (
                          <span className="text-[10px] font-mono text-neutral-400 bg-slate-100 dark:bg-neutral-800 px-2 py-0.5 rounded-full">
                            {rule.value}{rule.type === "time" ? "s" : rule.type === "scroll" ? "%" : ""}
                          </span>
                        )}
                      </div>
                      <h4 className="font-bold text-sm text-neutral-900 dark:text-neutral-100 truncate">
                        {rule.name || `${rule.type.toUpperCase()} Campaign`}
                      </h4>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <ModernSwitch
                        checked={rule.isActive !== false}
                        onChange={() => toggleRuleActive(rule)}
                        size="sm"
                        activeColor="#10b981"
                      />
                      <button
                        type="button"
                        onClick={() => deleteRule(rule.id)}
                        className="p-1.5 rounded-lg text-neutral-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors cursor-pointer"
                        title="Delete campaign"
                      >
                        <Trash2 className="size-4" />
                      </button>
                    </div>
                  </div>

                  {/* Teaser Preview Bubble */}
                  <div className="p-3 bg-slate-50 dark:bg-neutral-950/60 rounded-xl border border-slate-200/80 dark:border-neutral-800/80 text-xs text-neutral-800 dark:text-neutral-200 leading-relaxed break-words font-medium">
                    &quot;{rule.message}&quot;
                  </div>

                  {/* Metrics Bar */}
                  <div className="grid grid-cols-3 gap-2 py-2 border-y border-slate-100 dark:border-neutral-800 text-center">
                    <div>
                      <div className="text-[10px] uppercase font-bold text-neutral-400">Views</div>
                      <div className="font-bold text-xs text-neutral-800 dark:text-neutral-200">
                        {rule.impressions || 0}
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] uppercase font-bold text-neutral-400">CTR</div>
                      <div className="font-bold text-xs text-purple-600 dark:text-purple-400">
                        {rule.clickRate ? (rule.clickRate * 100).toFixed(1) : 0}%
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] uppercase font-bold text-neutral-400">CVR</div>
                      <div className="font-bold text-xs text-emerald-600 dark:text-emerald-400">
                        {rule.conversionRate ? (rule.conversionRate * 100).toFixed(1) : 0}%
                      </div>
                    </div>
                  </div>

                  {/* Footer metadata & buttons */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-[11px] text-neutral-400">
                      <span>Audience: <b className="text-neutral-600 dark:text-neutral-300">{rule.audience || "all"}</b></span>
                      <span>Cadence: <b className="text-neutral-600 dark:text-neutral-300">{rule.scheduleCadence || "once"}</b></span>
                    </div>

                    {rule.quietHours && (
                      <div className="text-[10px] font-medium text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 px-2.5 py-1 rounded-lg border border-amber-200/60 dark:border-amber-900/40 flex items-center gap-1.5">
                        <Clock className="size-3" />
                        <span>Quiet Hours: {rule.quietHours.start} – {rule.quietHours.end}</span>
                      </div>
                    )}

                    <div className="flex items-center gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => toggleDispatchPlan(rule.id)}
                        className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer flex items-center gap-1 whitespace-nowrap"
                      >
                        <ListChecks className="size-3" />
                        <span>{dispatchPlans[rule.id] ? "Hide Dispatch Plan" : "Dispatch Plan"}</span>
                      </button>

                      <span className="text-neutral-300">·</span>

                      <button
                        type="button"
                        onClick={() => toggleDeliveryLog(rule.id)}
                        className="text-[11px] font-bold text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200 hover:underline cursor-pointer flex items-center gap-1 whitespace-nowrap"
                      >
                        <History className="size-3" />
                        <span>{deliveryLogs[rule.id] ? "Hide Logs" : "Delivery Logs"}</span>
                      </button>
                    </div>

                    {/* Collapsible Dispatch Plan */}
                    {dispatchPlans[rule.id]?.jobs && (
                      <div className="p-3 bg-indigo-50/50 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-900/50 rounded-xl space-y-1.5 text-xs text-indigo-950 dark:text-indigo-200">
                        <div className="font-bold text-[11px] uppercase tracking-wide">
                          Scheduled Jobs ({dispatchPlans[rule.id]?.jobs?.length ?? 0})
                        </div>
                        {dispatchPlans[rule.id]?.jobs?.map((job) => (
                          <div key={job.idempotency_key} className="p-2 bg-white/80 dark:bg-neutral-900 rounded-lg text-[10px]">
                            <b>{job.payload.channel}</b> · {new Date(job.scheduled_at).toLocaleString()}
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Collapsible Delivery Logs */}
                    {deliveryLogs[rule.id]?.deliveries && (
                      <div className="p-3 bg-slate-50 dark:bg-neutral-950/80 border border-slate-200 dark:border-neutral-800 rounded-xl space-y-2 text-xs max-h-48 overflow-y-auto">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-[11px] uppercase tracking-wide text-neutral-400">
                            Delivery Attempts
                          </span>
                          <ModernSelect
                            aria-label="Filter deliveries"
                            value={deliveryStatus[rule.id] || "all"}
                            onChange={(value) => {
                              const status = value as DeliveryStatus;
                              setDeliveryStatus((prev) => ({ ...prev, [rule.id]: status }));
                              setDeliveryLogs((prev) => {
                                const next = { ...prev };
                                delete next[rule.id];
                                return next;
                              });
                            }}
                            options={[
                              { value: "all", label: "All Statuses" },
                              { value: "sent", label: "Sent" },
                              { value: "failed", label: "Failed" },
                              { value: "suppressed", label: "Suppressed" },
                            ]}
                            size="sm"
                          />
                        </div>
                        {deliveryLogs[rule.id]?.deliveries?.length === 0 && (
                          <div className="text-[10px] text-neutral-400">No deliveries recorded yet.</div>
                        )}
                        {deliveryLogs[rule.id]?.deliveries?.map((d) => (
                          <div key={d.id} className="p-2 bg-white dark:bg-neutral-900 rounded-lg text-[10px] flex items-center justify-between">
                            <span><b className="uppercase">{d.status}</b> · {d.channel}</span>
                            <span className="text-neutral-400">{d.updated_at ? new Date(d.updated_at).toLocaleTimeString() : ""}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── TAB 2: CAMPAIGN BUILDER ── */}
      {activeTab === "builder" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Builder Form Card */}
          <div className="lg:col-span-8 bg-white dark:bg-neutral-900 border border-slate-200 dark:border-neutral-800 rounded-2xl p-6 shadow-xs space-y-6">
            <div>
              <h3 className="text-base font-bold text-neutral-900 dark:text-neutral-100">
                Campaign Configuration
              </h3>
              <p className="text-xs text-neutral-500 mt-0.5">
                Set behavioral triggers, audience targeting, teaser copy, and multi-channel follow-ups.
              </p>
            </div>

            {/* Section 1: Campaign Identity & Trigger */}
            <div className="space-y-4 pt-2">
              <div className="space-y-1.5">
                <label className="block text-[11px] font-bold uppercase tracking-wider text-neutral-400">
                  Campaign Title
                </label>
                <input
                  value={campaignName}
                  onChange={(e) => setCampaignName(e.target.value)}
                  placeholder="e.g. Enterprise Pricing Teaser / Exit Intent Discount"
                  className="w-full bg-slate-50 dark:bg-neutral-950 border border-slate-200 dark:border-neutral-800 rounded-xl px-3 py-2 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[#f97316]/20"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-neutral-400">
                    Behavior Trigger Type
                  </label>
                  <ModernSelect
                    value={type}
                    options={typeOptions}
                    onChange={(val) => setType(val as "time" | "scroll" | "exit" | "url")}
                  />
                </div>

                {type !== "exit" && (
                  <div className="space-y-1.5">
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-neutral-400">
                      {type === "time" ? "Delay (Seconds)" : type === "scroll" ? "Scroll Depth (%)" : "Path Match"}
                    </label>
                    <input
                      value={value}
                      onChange={(e) => setValue(e.target.value)}
                      placeholder={type === "time" ? "5" : type === "scroll" ? "50" : "/pricing"}
                      className="w-full bg-slate-50 dark:bg-neutral-950 border border-slate-200 dark:border-neutral-800 rounded-xl px-3 py-2 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-[#f97316]/20"
                    />
                  </div>
                )}
              </div>
            </div>

            {/* Section 2: Teaser Message */}
            <div className="space-y-1.5 pt-2">
              <label className="block text-[11px] font-bold uppercase tracking-wider text-neutral-400">
                Teaser Popup Message
              </label>
              <textarea
                rows={3}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="👋 Evaluating our enterprise plan? Chat with an SDR for custom pricing!"
                className="w-full bg-slate-50 dark:bg-neutral-950 border border-slate-200 dark:border-neutral-800 rounded-xl p-3 text-xs leading-relaxed font-medium focus:outline-none focus:ring-2 focus:ring-[#f97316]/20"
              />
              <p className="text-[10px] text-neutral-400">
                This copy pops up beside the chat widget to prompt the visitor before they open the full window.
              </p>
            </div>

            {/* Section 3: Audience & Delivery Channels */}
            <div className="space-y-4 pt-2 border-t border-slate-100 dark:border-neutral-800">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-neutral-400">
                    Target Audience
                  </label>
                  <ModernSelect
                    value={audience}
                    options={audienceOptions}
                    onChange={(val) => {
                      setAudience(val);
                      if (val === "returning") setReturningOnly(true);
                    }}
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-neutral-400">
                    Delivery Cadence
                  </label>
                  <ModernSelect
                    value={cadence}
                    options={cadenceOptions}
                    onChange={setCadence}
                  />
                </div>
              </div>

              {/* Channels Pills */}
              <div className="space-y-2">
                <label className="block text-[11px] font-bold uppercase tracking-wider text-neutral-400">
                  Notification Channels
                </label>
                <div className="flex flex-wrap gap-2">
                  {[
                    { id: "web", label: "Website Chat Bubble", icon: <MessageSquare className="size-3.5" /> },
                    { id: "email", label: "Email Notification", icon: <Mail className="size-3.5" /> },
                    { id: "whatsapp", label: "WhatsApp Direct", icon: <Smartphone className="size-3.5" /> },
                    { id: "sms", label: "SMS Broadcast", icon: <Send className="size-3.5" /> },
                  ].map((chan) => {
                    const isSelected = channels.includes(chan.id);
                    return (
                      <button
                        key={chan.id}
                        type="button"
                        onClick={() => toggleChannel(chan.id)}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-semibold transition-all cursor-pointer ${
                          isSelected
                            ? "border-orange-500 bg-orange-50 text-orange-700 dark:border-orange-600 dark:bg-orange-950/60 dark:text-orange-200 shadow-2xs"
                            : "border-slate-200 text-neutral-500 dark:border-neutral-800 hover:border-slate-300"
                        }`}
                      >
                        {chan.icon}
                        <span>{chan.label}</span>
                      </button>
                    );
                  })}
                </div>
                {channels.some((c) => c !== "web") && (
                  <ModernAlert variant="info">
                    Multichannel notifications (Email, WhatsApp, SMS) target consented leads with recorded marketing opt-in.
                  </ModernAlert>
                )}
              </div>

              {/* Min Intent Slider & Returning Only Switch */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                <div className="space-y-1.5 bg-slate-50 dark:bg-neutral-950 p-3.5 rounded-xl border border-slate-200 dark:border-neutral-800">
                  <div className="flex items-center justify-between">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">
                      Min Intent Score Threshold
                    </label>
                    <span className="text-xs font-bold text-[#f97316]">{minIntentScore}/100</span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={minIntentScore}
                    onChange={(e) => setMinIntentScore(Number(e.target.value))}
                    className="w-full accent-[#f97316] cursor-pointer"
                  />
                  <p className="text-[10px] text-neutral-400">Visitors with score ≥ {minIntentScore} will be triggered.</p>
                </div>

                <div className="flex items-center justify-between p-3.5 bg-slate-50 dark:bg-neutral-950 rounded-xl border border-slate-200 dark:border-neutral-800">
                  <div>
                    <h5 className="font-bold text-xs text-neutral-800 dark:text-neutral-200">
                      Returning Visitors Only
                    </h5>
                    <p className="text-[10px] text-neutral-400">Exclude first-time website visitors</p>
                  </div>
                  <ModernSwitch
                    checked={returningOnly}
                    onChange={setReturningOnly}
                    size="sm"
                    activeColor="#f97316"
                  />
                </div>
              </div>
            </div>

            {/* Section 4: Modern Date Time Windows & Quiet Hours */}
            <div className="space-y-4 pt-2 border-t border-slate-100 dark:border-neutral-800">
              <h4 className="text-xs font-bold text-neutral-900 dark:text-neutral-100 uppercase tracking-wider">
                Schedule & Safeguards
              </h4>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <DateTimePicker
                  label="Campaign Start Date & Time"
                  value={startDate}
                  onChange={setStartDate}
                  placeholder="Immediately (or pick future date)"
                />

                <DateTimePicker
                  label="Campaign End Date & Time"
                  value={endDate}
                  onChange={setEndDate}
                  min={startDate}
                  placeholder="Open-ended (no expiry)"
                />
              </div>

              <div className="flex items-center justify-between gap-4 p-3.5 bg-slate-50 dark:bg-neutral-950 rounded-xl border border-slate-200 dark:border-neutral-800">
                <div>
                  <label htmlFor="campaign-frequency-cap" className="text-xs font-bold text-neutral-800 dark:text-neutral-200">
                    Visitor frequency cap
                  </label>
                  <p className="text-[10px] text-neutral-400">Suppress repeat sends for this many hours.</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <input
                    id="campaign-frequency-cap"
                    type="number"
                    min={1}
                    max={720}
                    value={frequencyCapHours}
                    onChange={(e) => setFrequencyCapHours(Number(e.target.value))}
                    className="w-20 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs dark:border-neutral-700 dark:bg-neutral-900"
                  />
                  <span className="text-[10px] text-neutral-500">hours</span>
                </div>
              </div>

              {/* Quiet Hours Switch & TimePicker */}
              <div className="p-4 bg-slate-50 dark:bg-neutral-950 rounded-2xl border border-slate-200 dark:border-neutral-800 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="size-4 text-emerald-500" />
                    <div>
                      <h5 className="font-bold text-xs text-neutral-800 dark:text-neutral-200">
                        Quiet Hours Safeguard
                      </h5>
                      <p className="text-[10px] text-neutral-400">
                        Suppress notifications during late night hours in visitor&apos;s timezone
                      </p>
                    </div>
                  </div>
                  <ModernSwitch
                    checked={quietHoursEnabled}
                    onChange={setQuietHoursEnabled}
                    size="sm"
                    activeColor="#10b981"
                  />
                </div>

                {quietHoursEnabled && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-slate-200/80 dark:border-neutral-800">
                    <TimePicker
                      label="Suppress From"
                      value={quietHoursStart}
                      onChange={setQuietHoursStart}
                    />
                    <TimePicker
                      label="Suppress Until"
                      value={quietHoursEnd}
                      onChange={setQuietHoursEnd}
                    />
                  </div>
                )}
              </div>
            </div>

            {/* Section 5: Intelligent Sequence Follow-ups */}
            <div className="space-y-3 pt-2 border-t border-slate-100 dark:border-neutral-800">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-bold text-neutral-900 dark:text-neutral-100 uppercase tracking-wider">
                    Follow-Up Sequences
                  </h4>
                  <p className="text-[10px] text-neutral-400">
                    Automatically send chained follow-up messages across channels if visitor does not convert.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={addSequenceStep}
                  disabled={sequenceSteps.length >= 10}
                  className="px-3 py-1.5 rounded-xl border border-orange-200 text-orange-700 dark:border-orange-800 dark:text-orange-300 hover:bg-orange-50 text-xs font-bold transition-colors cursor-pointer"
                >
                  + Add Step
                </button>
              </div>

              {sequenceSteps.length === 0 && (
                <div className="p-4 rounded-xl border border-dashed border-slate-200 dark:border-neutral-800 text-center text-xs text-neutral-400">
                  No automated sequence steps added. Click &quot;+ Add Step&quot; to queue follow-ups.
                </div>
              )}

              {sequenceSteps.map((step, idx) => (
                <div
                  key={idx}
                  className="p-3.5 bg-slate-50 dark:bg-neutral-950 rounded-xl border border-slate-200 dark:border-neutral-800 flex items-start gap-3"
                >
                  <span className="size-6 rounded-full bg-orange-100 dark:bg-orange-950 text-orange-700 dark:text-orange-300 font-bold text-xs flex items-center justify-center shrink-0">
                    {idx + 1}
                  </span>
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center gap-2">
                      <ModernSelect
                        value={step.channel}
                        onChange={(value) => updateSequenceStep(idx, { channel: value })}
                        options={["web", "email", "whatsapp", "sms"].map((channel) => ({
                          value: channel,
                          label: channel.toUpperCase(),
                        }))}
                        size="sm"
                      />
                      <span className="text-xs text-neutral-400">after</span>
                      <input
                        type="number"
                        min={1}
                        max={10080}
                        value={step.after_minutes}
                        onChange={(e) => updateSequenceStep(idx, { after_minutes: Number(e.target.value) || 0 })}
                        className="w-18 bg-white dark:bg-neutral-900 border border-slate-200 dark:border-neutral-800 rounded-lg px-2 py-1 text-xs font-semibold"
                      />
                      <span className="text-xs text-neutral-400">minutes</span>
                    </div>
                    <input
                      value={step.message}
                      onChange={(e) => updateSequenceStep(idx, { message: e.target.value })}
                      placeholder="Follow-up message copy..."
                      className="w-full bg-white dark:bg-neutral-900 border border-slate-200 dark:border-neutral-800 rounded-lg px-3 py-1.5 text-xs focus:outline-none"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => setSequenceSteps((curr) => curr.filter((_, i) => i !== idx))}
                    className="p-1 rounded-lg text-neutral-400 hover:text-red-500"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </div>
              ))}
            </div>

            {/* Actions Footer */}
            <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100 dark:border-neutral-800">
              <button
                type="button"
                onClick={() => setActiveTab("list")}
                className="px-4 py-2 rounded-xl text-xs font-bold text-neutral-600 dark:text-neutral-300 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={saveNewCampaign}
                disabled={!message.trim() || saving}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold text-white shadow-sm transition-all cursor-pointer disabled:opacity-50"
                style={{ background: color }}
              >
                {saving ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
                <span>{saving ? "Publishing Campaign..." : "Save & Activate Campaign"}</span>
              </button>
            </div>
          </div>

          {/* Live Teaser Preview Card */}
          <div className="lg:col-span-4 space-y-4">
            <div className="bg-white dark:bg-neutral-900 border border-slate-200 dark:border-neutral-800 rounded-2xl p-5 shadow-xs space-y-4 sticky top-6">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold uppercase tracking-wider text-neutral-400">
                  Live Visitor Mockup
                </h4>
                <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 dark:bg-emerald-950 px-2 py-0.5 rounded-full">
                  Real-Time
                </span>
              </div>

              {/* Website Mockup Window */}
              <div className="rounded-xl border border-slate-200 dark:border-neutral-800 bg-slate-100 dark:bg-neutral-950 p-4 min-h-[300px] flex flex-col justify-end relative overflow-hidden">
                <div className="absolute top-3 left-3 flex items-center gap-1.5">
                  <div className="size-2.5 rounded-full bg-rose-400" />
                  <div className="size-2.5 rounded-full bg-amber-400" />
                  <div className="size-2.5 rounded-full bg-emerald-400" />
                  <span className="text-[10px] text-neutral-400 ml-2 font-mono">acme.com{type === "url" && value ? value : "/"}</span>
                </div>

                {/* Floating Chat Bubble & Teaser Popup */}
                <div className="flex flex-col items-end gap-2 z-10">
                  <div className="max-w-[240px] bg-white dark:bg-neutral-900 border border-slate-200 dark:border-neutral-800 rounded-2xl p-3.5 shadow-xl space-y-1 relative animate-bounce-subtle">
                    <div className="flex items-center justify-between text-[10px] font-bold text-neutral-400">
                      <span>Chatty Assistant</span>
                      <X className="size-3 text-neutral-400" />
                    </div>
                    <p className="text-xs text-neutral-800 dark:text-neutral-100 font-medium leading-relaxed">
                      {message || "👋 Evaluating our enterprise plan? Chat with an SDR for custom pricing!"}
                    </p>
                  </div>

                  <div
                    className="size-12 rounded-full text-white flex items-center justify-center shadow-xl cursor-pointer"
                    style={{ background: color }}
                  >
                    <MessageSquare className="size-6 fill-white" />
                  </div>
                </div>
              </div>

              <div className="p-3 bg-slate-50 dark:bg-neutral-950 rounded-xl border border-slate-200/80 dark:border-neutral-800/80 text-[11px] text-neutral-500 space-y-1">
                <div className="font-bold text-neutral-800 dark:text-neutral-200">Trigger Conditions:</div>
                <div>• Type: <b>{type.toUpperCase()}</b> ({type === "exit" ? "Mouse leave" : value})</div>
                <div>• Segment: <b>{audience}</b></div>
                <div>• Cadence: <b>{cadence}</b></div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── TAB 3: AI COPILOT & PLAYBOOKS ── */}
      {activeTab === "copilot" && (
        <div className="max-w-4xl mx-auto space-y-6">
          <div className="bg-white dark:bg-neutral-900 border border-slate-200 dark:border-neutral-800 rounded-2xl p-6 shadow-xs space-y-4">
            <div className="flex items-center gap-2">
              <div className="size-8 rounded-xl bg-gradient-to-tr from-orange-500 to-amber-500 text-white flex items-center justify-center">
                <Sparkles className="size-4" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-neutral-900 dark:text-neutral-100">
                  AI Campaign Strategist
                </h4>
                <p className="text-xs font-semibold text-neutral-500 dark:text-neutral-400">
                  AI campaign copilot
                </p>
                <p className="text-xs text-neutral-400">
                  Describe what you want to achieve, and AI will generate high-converting triggers, copy, and audience segment.
                </p>
              </div>
            </div>

            <div className="space-y-3">
              <textarea
                rows={3}
                value={goal}
                onChange={(e) => setGoal(e.target.value)}
                placeholder="e.g. Convert visitors who linger on pricing for more than 10 seconds into booked discovery demos..."
                className="w-full bg-slate-50 dark:bg-neutral-950 border border-slate-200 dark:border-neutral-800 rounded-xl p-3 text-xs leading-relaxed focus:outline-none focus:ring-2 focus:ring-[#f97316]/20"
              />

              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={suggestCampaignWithAI}
                  disabled={!goal.trim() || suggesting}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold text-white shadow-sm transition-all cursor-pointer disabled:opacity-50"
                  style={{ background: color }}
                >
                  {suggesting ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
                  <span>{suggesting ? "Analyzing & Generating..." : "Generate Campaign with AI"}</span>
                </button>

                <button
                  type="button"
                  onClick={suggestAudienceWithAI}
                  disabled={!goal.trim() || suggestingAudience}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold border border-orange-200 text-orange-700 dark:border-orange-800 dark:text-orange-300 hover:bg-orange-50 dark:hover:bg-orange-950/40 transition-all cursor-pointer disabled:opacity-50"
                >
                  {suggestingAudience ? <Loader2 className="size-4 animate-spin" /> : <Users className="size-4" />}
                  <span>{suggestingAudience ? "Optimizing Audience..." : "Suggest Target Audience"}</span>
                </button>
              </div>

              {audienceRationale && (
                <ModernAlert variant="ai" title="Audience Optimization Strategy">
                  {audienceRationale}
                </ModernAlert>
              )}
            </div>
          </div>

          {/* Pre-built Strategy Playbooks */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-neutral-400">
              Proven High-Conversion Playbooks
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
              {[
                {
                  title: "Exit-Intent Offer",
                  type: "exit",
                  val: "",
                  msg: "Wait! Before you leave, get an exclusive 20% discount on standard plans today.",
                  desc: "Recovers abandoning website visitors right when their cursor leaves the viewport.",
                },
                {
                  title: "Pricing Page Whitepaper",
                  type: "url",
                  val: "/pricing",
                  msg: "Need help choosing the right plan for your team? Download our enterprise feature comparison guide.",
                  desc: "Targets prospects evaluating pricing with actionable buying guidance.",
                },
                {
                  title: "Engaged Reader Prompt",
                  type: "scroll",
                  val: "60",
                  msg: "Enjoying the article? Subscribe to our weekly AI newsletter for curated updates.",
                  desc: "Triggers after visitor demonstrates high engagement by scrolling past 60%.",
                },
              ].map((playbook) => (
                <div
                  key={playbook.title}
                  onClick={() => {
                    setCampaignName(playbook.title);
                    setType(playbook.type as "time" | "scroll" | "exit" | "url");
                    setValue(playbook.val);
                    setMessage(playbook.msg);
                    setActiveTab("builder");
                  }}
                  className="p-4 bg-white dark:bg-neutral-900 border border-slate-200 dark:border-neutral-800 hover:border-orange-300 dark:hover:border-orange-700/60 rounded-2xl shadow-2xs space-y-2 cursor-pointer transition-all hover:scale-101"
                >
                  <h5 className="font-bold text-xs text-neutral-900 dark:text-neutral-100 flex items-center justify-between">
                    <span>{playbook.title}</span>
                    <span className="text-[9px] uppercase font-bold text-orange-600 bg-orange-50 px-2 py-0.5 rounded-full">
                      {playbook.type}
                    </span>
                  </h5>
                  <p className="text-[11px] text-neutral-500 leading-relaxed">
                    {playbook.desc}
                  </p>
                  <div className="text-[10px] font-bold text-[#f97316] pt-1">
                    Use this playbook →
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
