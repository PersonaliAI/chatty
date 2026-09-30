"use client";

import { useState, useEffect } from "react";
import { Plus, Trash2, Megaphone, Sparkles, Pause, Play, ListChecks, Loader2 } from "lucide-react";
import { ModernSelect, type ModernSelectOption } from "@/components/ui/modern-select";

interface TriggerRule {
  id: string;
  type: "time" | "scroll" | "exit" | "url";
  value: string;
  message: string;
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

export function CampaignsUI({ botId, color = "#f97316", fetchBackend }: Props) {
  const [rules, setRules] = useState<TriggerRule[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [type, setType] = useState<"time" | "scroll" | "exit" | "url">("time");
  const [value, setValue] = useState("");
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
  const [sequenceSteps, setSequenceSteps] = useState<CampaignSequenceStep[]>([]);
  const [goal, setGoal] = useState("");
  const [suggesting, setSuggesting] = useState(false);
  const [suggestingAudience, setSuggestingAudience] = useState(false);
  const [audienceRationale, setAudienceRationale] = useState("");
  const [dispatchPlans, setDispatchPlans] = useState<Record<string, DispatchPreview>>({});
  const [deliveryLogs, setDeliveryLogs] = useState<Record<string, DeliveryLog>>({});

  const typeOptions: ModernSelectOption[] = [
    { value: "time", label: "Time on page (Seconds)" },
    { value: "scroll", label: "Scroll depth (Percentage)" },
    { value: "exit", label: "Exit Intent (Leaver)" },
    { value: "url", label: "URL Match (Path/Regexp)" },
  ];

  useEffect(() => {
    if (!botId) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchBackend(`/api/bots/${botId}/campaigns`)
      .then(async (response) => {
        if (!response.ok) throw new Error(`Campaigns could not be loaded (${response.status})`);
        const rows = await response.json() as Array<Record<string, unknown>>;
        if (!cancelled) {
          const mapped: TriggerRule[] = rows.map((row) => ({
            id: String(row.id),
            type: String(row.trigger_type ?? "time_on_page") === "scroll_percentage" ? "scroll"
              : String(row.trigger_type ?? "time_on_page") === "exit_intent" ? "exit"
              : String(row.trigger_type ?? "time_on_page") === "url_match" ? "url" : "time",
            value: String(row.trigger_type ?? "") === "url_match"
              ? String((row.url_patterns as string[] | undefined)?.[0] ?? "")
              : String(row.trigger_value ?? ""),
            message: String(row.message ?? ""),
            impressions: Number(row.impressions ?? 0),
            clicks: Number(row.clicks ?? 0),
            conversions: Number(row.conversions ?? 0),
            audience: String((row.audience_rules as { segment?: string } | undefined)?.segment ?? "all"),
            recipientSource: String((row.audience_rules as { recipient_source?: string } | undefined)?.recipient_source ?? "widget") === "consented_leads" ? "consented_leads" : "widget",
            channels: Array.isArray(row.channels) ? row.channels.map(String) : ["web"],
            sequenceSteps: Array.isArray(row.sequence_steps) ? row.sequence_steps as Array<Record<string, unknown>> : [],
            isActive: row.is_active !== false,
            startDate: row.start_date ? String(row.start_date) : null,
            endDate: row.end_date ? String(row.end_date) : null,
            quietHours: ((row.safety_config as { quiet_hours?: { start?: string; end?: string } } | undefined)?.quiet_hours?.start && (row.safety_config as { quiet_hours?: { start?: string; end?: string } } | undefined)?.quiet_hours?.end)
              ? { start: String((row.safety_config as { quiet_hours: { start: string } }).quiet_hours.start), end: String((row.safety_config as { quiet_hours: { end: string } }).quiet_hours.end) }
              : null,
          }));
          setRules(mapped);
          // Counters on the campaign row are legacy snapshots. Read the
          // recomputable event-ledger metrics when available, without making
          // campaign loading fail if telemetry has not been migrated yet.
          const analytics = await Promise.all(mapped.map(async (rule) => {
            try {
              const [metricResponse, scheduleResponse] = await Promise.all([
                fetchBackend(`/api/bots/${botId}/campaigns/${rule.id}/analytics`),
                fetchBackend(`/api/bots/${botId}/campaigns/${rule.id}/schedule-preview`),
              ]);
              const metric = metricResponse.ok
                ? await metricResponse.json() as {
                    impressions?: number;
                    clicks?: number;
                    conversions?: number;
                    click_rate?: number;
                    conversion_rate?: number;
                    queued?: number;
                    sent?: number;
                    failed?: number;
                    suppressed?: number;
                    delivery_success_rate?: number;
                    by_device?: Record<string, number>;
                    by_channel?: Record<string, number>;
                  }
                : {};
              const schedule = scheduleResponse.ok
                ? await scheduleResponse.json() as { next_run_at?: string | null; schedule_config?: { cadence?: string } }
                : {};
              if (!metricResponse.ok && !scheduleResponse.ok) return null;
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
            } catch { return null; }
          }));
          if (!cancelled) setRules((current) => current.map((rule) => {
            const metric = analytics.find((item) => item?.id === rule.id);
            return metric ? { ...rule, ...metric } : rule;
          }));
        }
      })
      .catch(() => {
        // Keep old browser rules readable during rollout, but all new writes go
        // to the authenticated API so campaigns work across devices.
        try {
          const saved = botId ? localStorage.getItem(`chatty_campaigns_${botId}`) : null;
          if (!cancelled && saved) setRules(JSON.parse(saved));
        } catch { /* ignore corrupt legacy state */ }
        if (!cancelled) setError("Campaign service is unavailable; showing local rules.");
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [botId, fetchBackend]);

  const addRule = () => {
    if (!message.trim()) return;
    const cleanSequenceSteps = sequenceSteps.map((step) => ({
      channel: step.channel,
      after_minutes: Math.max(0, Math.min(43_200, Number(step.after_minutes) || 0)),
      message: step.message.trim(),
    })).filter((step) => Boolean(step.message));
    const newRule: TriggerRule = {
      id: crypto.randomUUID(),
      type,
      value: type === "exit" ? "" : value.trim() || "10",
      message: message.trim(),
    };
    if (!botId) return;
    if (!channels.length) {
      setError("Select at least one campaign channel.");
      return;
    }
    setSaving(true);
    setError(null);
    const triggerType = type === "time" ? "time_on_page" : type === "scroll" ? "scroll_percentage" : "exit_intent";
    fetchBackend(`/api/bots/${botId}/campaigns`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: `${type} campaign`,
        campaign_type: "chat_bubble",
        message_content: newRule.message,
        url_patterns: type === "url" ? [newRule.value] : ["*"],
        trigger_type: type === "url" ? "url_match" : triggerType,
        trigger_value: type === "url" ? 0 : Number(newRule.value) || 0,
        target_devices: ["desktop", "mobile"],
        is_active: true,
        audience_rules: {
          segment: audience,
          min_intent_score: minIntentScore,
          returning_only: returningOnly,
          recipient_source: (channels.some((channel) => channel !== "web") || cleanSequenceSteps.some((step) => step.channel !== "web")) ? "consented_leads" : "widget",
        },
        channels,
        sequence_steps: cleanSequenceSteps,
        safety_config: {
          frequency_cap_hours: 24,
          require_consent: true,
          ...(quietHoursEnabled ? { quiet_hours: { start: quietHoursStart, end: quietHoursEnd } } : {}),
        },
        schedule_config: { cadence, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC" },
        start_date: startDate ? new Date(startDate).toISOString() : null,
        end_date: endDate ? new Date(endDate).toISOString() : null,
      }),
    }).then(async (response) => {
      if (!response.ok) throw new Error(`Campaign could not be saved (${response.status})`);
      const row = await response.json() as Record<string, unknown>;
      setRules((current) => [{ ...newRule, id: String(row.id), quietHours: quietHoursEnabled ? { start: quietHoursStart, end: quietHoursEnd } : null }, ...current]);
      setValue("");
      setMessage("");
      setAudience("all");
      setMinIntentScore(0);
      setReturningOnly(false);
      setChannels(["web"]);
      setCadence("once");
      setStartDate("");
      setEndDate("");
      setQuietHoursEnabled(false);
      setQuietHoursStart("22:00");
      setQuietHoursEnd("08:00");
      setSequenceSteps([]);
    }).catch((saveError: unknown) => setError(saveError instanceof Error ? saveError.message : "Campaign could not be saved."))
      .finally(() => setSaving(false));
  };

  const toggleChannel = (value: string) => {
    setChannels((current) => current.includes(value) ? current.filter((item) => item !== value) : [...current, value]);
  };

  const addSequenceStep = () => {
    setSequenceSteps((current) => [...current, { channel: channels[0] || "web", after_minutes: 0, message: "" }]);
  };

  const updateSequenceStep = (index: number, patch: Partial<CampaignSequenceStep>) => {
    setSequenceSteps((current) => current.map((step, stepIndex) => stepIndex === index ? { ...step, ...patch } : step));
  };

  const suggestCampaign = () => {
    if (!botId || !goal.trim()) return;
    setSuggesting(true);
    setError(null);
    fetchBackend(`/api/bots/${botId}/campaigns/suggest`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ goal: goal.trim() }),
    }).then(async (response) => {
      if (!response.ok) throw new Error("AI campaign suggestion failed");
      const suggestion = await response.json() as {
        message_content?: string; trigger_type?: string; trigger_value?: number; sequence_steps?: Array<Record<string, unknown>>;
      };
      const suggestedType = suggestion.trigger_type === "scroll_percentage" ? "scroll"
        : suggestion.trigger_type === "exit_intent" ? "exit"
        : suggestion.trigger_type === "url_match" ? "url" : "time";
      setType(suggestedType);
      setValue(suggestedType === "exit" ? "" : String(suggestion.trigger_value ?? 5));
      setMessage(String(suggestion.message_content ?? ""));
      setSequenceSteps((Array.isArray(suggestion.sequence_steps) ? suggestion.sequence_steps : []).map((step) => ({
        channel: String(step.channel ?? "web").toLowerCase(),
        after_minutes: Math.max(0, Number(step.after_minutes ?? 0) || 0),
        message: String(step.message ?? ""),
      })));
    }).catch((suggestionError: unknown) => setError(suggestionError instanceof Error ? suggestionError.message : "AI suggestion failed."))
      .finally(() => setSuggesting(false));
  };

  const suggestAudience = () => {
    if (!botId || !goal.trim()) return;
    setSuggestingAudience(true);
    setError(null);
    fetchBackend(`/api/bots/${botId}/campaigns/audience-suggest`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ goal: goal.trim(), audience }),
    }).then(async (response) => {
      if (!response.ok) throw new Error("AI audience suggestion failed");
      const result = await response.json() as { audience_rules?: { segment?: string; min_intent_score?: number; returning_only?: boolean }; rationale?: string };
      const segment = result.audience_rules?.segment;
      if (segment === "all" || segment === "returning" || segment === "high_intent") setAudience(segment);
      setMinIntentScore(Math.max(0, Math.min(100, Number(result.audience_rules?.min_intent_score ?? 0))));
      setReturningOnly(Boolean(result.audience_rules?.returning_only));
      setAudienceRationale(String(result.rationale ?? "").slice(0, 240));
    }).catch((suggestionError: unknown) => setError(suggestionError instanceof Error ? suggestionError.message : "AI audience suggestion failed."))
      .finally(() => setSuggestingAudience(false));
  };

  const deleteRule = (id: string) => {
    if (!botId) return;
    setSaving(true);
    fetchBackend(`/api/bots/${botId}/campaigns/${id}`, { method: "DELETE" })
      .then((response) => {
        if (!response.ok) throw new Error(`Campaign could not be deleted (${response.status})`);
        setRules((current) => current.filter((r) => r.id !== id));
      })
      .catch((deleteError: unknown) => setError(deleteError instanceof Error ? deleteError.message : "Campaign could not be deleted."))
      .finally(() => setSaving(false));
  };

  const toggleRule = (rule: TriggerRule) => {
    if (!botId) return;
    setSaving(true);
    fetchBackend(`/api/bots/${botId}/campaigns/${rule.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_active: rule.isActive === false }),
    }).then((response) => {
      if (!response.ok) throw new Error(`Campaign could not be updated (${response.status})`);
      setRules((current) => current.map((item) => item.id === rule.id ? { ...item, isActive: rule.isActive === false } : item));
    }).catch((toggleError: unknown) => setError(toggleError instanceof Error ? toggleError.message : "Campaign could not be updated."))
      .finally(() => setSaving(false));
  };

  const toggleDispatchPlan = (campaignId: string) => {
    if (!botId) return;
    const current = dispatchPlans[campaignId];
    if (current?.jobs || current?.error) {
      setDispatchPlans((plans) => {
        const next = { ...plans };
        delete next[campaignId];
        return next;
      });
      return;
    }
    setDispatchPlans((plans) => ({ ...plans, [campaignId]: { loading: true } }));
    fetchBackend(`/api/bots/${botId}/campaigns/${campaignId}/dispatch-plan`)
      .then(async (response) => {
        if (!response.ok) throw new Error(`Preview unavailable (${response.status})`);
        const result = await response.json() as { jobs?: DispatchJob[]; deferred?: boolean; deferred_reason?: string };
        setDispatchPlans((plans) => ({
          ...plans,
          [campaignId]: {
            jobs: Array.isArray(result.jobs) ? result.jobs : [],
            deferred: result.deferred === true,
            deferred_reason: result.deferred_reason,
          },
        }));
      })
      .catch((previewError: unknown) => setDispatchPlans((plans) => ({
        ...plans,
        [campaignId]: { error: previewError instanceof Error ? previewError.message : "Preview unavailable." },
      })));
  };

  const toggleDeliveryLog = (campaignId: string) => {
    if (!botId) return;
    const current = deliveryLogs[campaignId];
    if (current?.deliveries || current?.error) {
      setDeliveryLogs((logs) => { const next = { ...logs }; delete next[campaignId]; return next; });
      return;
    }
    setDeliveryLogs((logs) => ({ ...logs, [campaignId]: { loading: true } }));
    fetchBackend(`/api/bots/${botId}/campaigns/${campaignId}/deliveries?limit=100`)
      .then(async (response) => {
        if (!response.ok) throw new Error(`Delivery history unavailable (${response.status})`);
        const result = await response.json() as { available?: boolean; deliveries?: DeliveryRow[] };
        setDeliveryLogs((logs) => ({ ...logs, [campaignId]: { available: result.available !== false, deliveries: Array.isArray(result.deliveries) ? result.deliveries : [] } }));
      })
      .catch((historyError: unknown) => setDeliveryLogs((logs) => ({ ...logs, [campaignId]: { error: historyError instanceof Error ? historyError.message : "Delivery history unavailable." } })));
  };

  return (
    <div className="max-w-4xl mx-auto w-full py-6 px-4 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h4 className="text-xs font-bold uppercase tracking-wider text-neutral-400 flex items-center gap-2">
            <Megaphone className="size-4" style={{ color }} /> Proactive Campaigns
          </h4>
          <p className="text-[10px] text-neutral-450 dark:text-neutral-500 mt-1">
            Display targeted teaser popups to web visitors based on user behaviors.
          </p>
        </div>
      </div>
      {error && <div role="status" className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] text-amber-800">{error}</div>}

      <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
        {/* Creator form */}
        <div className="md:col-span-5 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl p-5 space-y-4 h-fit">
          <h5 className="text-xs font-bold text-neutral-850">Create Campaign Rule</h5>
          <div className="rounded-xl border border-orange-100 bg-orange-50/70 p-3 space-y-2 dark:border-orange-900/40 dark:bg-orange-950/20">
            <div className="flex items-center gap-1.5 text-[11px] font-semibold text-orange-800 dark:text-orange-200"><Sparkles className="size-3.5" /> AI campaign copilot</div>
            <input value={goal} onChange={(event) => setGoal(event.target.value)} placeholder="Goal, e.g. convert pricing visitors" className="w-full rounded-lg border border-orange-200 bg-white px-2.5 py-1.5 text-xs focus:outline-none dark:border-orange-900 dark:bg-neutral-950" />
            <button type="button" onClick={suggestCampaign} disabled={!goal.trim() || suggesting} className="w-full rounded-lg border border-orange-200 px-3 py-1.5 text-[11px] font-semibold text-orange-700 disabled:opacity-50 dark:border-orange-900 dark:text-orange-200">{suggesting ? "Thinking…" : "Suggest campaign"}</button>
            <button type="button" onClick={suggestAudience} disabled={!goal.trim() || suggestingAudience} className="w-full rounded-lg border border-orange-200 px-3 py-1.5 text-[11px] font-semibold text-orange-700 disabled:opacity-50 dark:border-orange-900 dark:text-orange-200">{suggestingAudience ? "Selecting audience…" : "Suggest audience"}</button>
            {audienceRationale && <p className="text-[10px] leading-relaxed text-orange-800/80 dark:text-orange-200/80">{audienceRationale}</p>}
          </div>
          
          <div className="space-y-3">
            <div className="space-y-1">
              <label className="text-[10px] font-semibold text-neutral-400 uppercase tracking-wider">Trigger Type</label>
              <ModernSelect
                value={type}
                options={typeOptions}
                onChange={(val) => setType(val as "time" | "scroll" | "exit" | "url")}
              />
            </div>

            {type !== "exit" && (
              <div className="space-y-1">
                <label className="text-[10px] font-semibold text-neutral-400 uppercase tracking-wider">
                  {type === "time" ? "Delay (seconds)" : type === "scroll" ? "Scroll past (%)" : "Path contains"}
                </label>
                <input
                  type="text"
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                  placeholder={type === "time" ? "5" : type === "scroll" ? "50" : "/pricing"}
                  className="w-full bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none"
                />
              </div>
            )}

            <div className="space-y-1">
              <label className="text-[10px] font-semibold text-neutral-400 uppercase tracking-wider">Teaser Message</label>
              <textarea
                rows={3}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="👋 Need help? Chat with our sales team!"
                className="w-full bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-lg px-2.5 py-1.5 text-xs resize-none focus:outline-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <label className="text-[10px] font-semibold text-neutral-400 uppercase tracking-wider">Audience</label>
                <ModernSelect value={audience} options={[{ value: "all", label: "All visitors" }, { value: "returning", label: "Returning visitors" }, { value: "high_intent", label: "High intent" }]} onChange={(value) => { setAudience(value); if (value === "returning") setReturningOnly(true); }} />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-semibold text-neutral-400 uppercase tracking-wider">Channels</label>
                <div className="flex flex-wrap gap-1.5" role="group" aria-label="Campaign channels">
                  {[{ value: "web", label: "Website" }, { value: "email", label: "Email" }, { value: "whatsapp", label: "WhatsApp" }, { value: "sms", label: "SMS" }].map((option) => (
                    <button type="button" key={option.value} onClick={() => toggleChannel(option.value)} aria-pressed={channels.includes(option.value)} className={`rounded-lg border px-2 py-1 text-[10px] font-semibold transition-colors ${channels.includes(option.value) ? "border-orange-300 bg-orange-50 text-orange-700 dark:border-orange-800 dark:bg-orange-950/30 dark:text-orange-200" : "border-neutral-200 text-neutral-500 dark:border-neutral-800"}`}>
                      {option.label}
                    </button>
                  ))}
                </div>
                {channels.some((channel) => channel !== "web") && <p className="mt-1 text-[9px] leading-relaxed text-neutral-400">Provider channels target only leads with recorded marketing consent. Contacts without opt-in are never queued.</p>}
                <div className="mt-2 flex items-center gap-2">
                  <label className="text-[9px] text-neutral-400" htmlFor="campaign-intent-score">Min intent</label>
                  <input id="campaign-intent-score" type="number" min={0} max={100} value={minIntentScore} onChange={(event) => setMinIntentScore(Math.max(0, Math.min(100, Number(event.target.value) || 0)))} className="w-16 rounded-lg border border-neutral-200 bg-neutral-50 px-2 py-1 text-[10px] dark:border-neutral-800 dark:bg-neutral-950" />
                  <label className="flex items-center gap-1 text-[9px] text-neutral-400">
                    <input type="checkbox" checked={returningOnly} onChange={(event) => setReturningOnly(event.target.checked)} /> Returning only
                  </label>
                </div>
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-semibold text-neutral-400 uppercase tracking-wider">Sequence cadence</label>
              <ModernSelect value={cadence} options={[{ value: "once", label: "Run once" }, { value: "hourly", label: "Hourly" }, { value: "daily", label: "Daily" }, { value: "weekly", label: "Weekly" }]} onChange={setCadence} />
              <p className="text-[9px] text-neutral-400">The schedule is persisted with the campaign and interpreted in the visitor’s configured timezone.</p>
            </div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <label className="text-[9px] font-semibold uppercase tracking-wider text-neutral-400">Start window
                <input type="datetime-local" value={startDate} onChange={(event) => setStartDate(event.target.value)} className="mt-1 w-full rounded-lg border border-neutral-200 bg-neutral-50 px-2 py-1.5 text-[10px] font-normal dark:border-neutral-800 dark:bg-neutral-950" />
              </label>
              <label className="text-[9px] font-semibold uppercase tracking-wider text-neutral-400">End window
                <input type="datetime-local" value={endDate} min={startDate || undefined} onChange={(event) => setEndDate(event.target.value)} className="mt-1 w-full rounded-lg border border-neutral-200 bg-neutral-50 px-2 py-1.5 text-[10px] font-normal dark:border-neutral-800 dark:bg-neutral-950" />
              </label>
              <p className="sm:col-span-2 text-[9px] text-neutral-400">Optional. Set a bounded campaign window; leaving either blank keeps the schedule open-ended.</p>
            </div>
            <div className="rounded-xl border border-neutral-200 bg-neutral-50/60 p-2.5 dark:border-neutral-800 dark:bg-neutral-950/40">
              <label className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-wider text-neutral-400">
                <input type="checkbox" checked={quietHoursEnabled} onChange={(event) => setQuietHoursEnabled(event.target.checked)} />
                Quiet hours safeguard
              </label>
              {quietHoursEnabled && <div className="mt-2 grid grid-cols-2 gap-2">
                <label className="text-[9px] text-neutral-400">Suppress from<input type="time" value={quietHoursStart} onChange={(event) => setQuietHoursStart(event.target.value)} className="mt-1 w-full rounded-lg border border-neutral-200 bg-white px-2 py-1 text-[10px] dark:border-neutral-800 dark:bg-neutral-900" /></label>
                <label className="text-[9px] text-neutral-400">Suppress until<input type="time" value={quietHoursEnd} onChange={(event) => setQuietHoursEnd(event.target.value)} className="mt-1 w-full rounded-lg border border-neutral-200 bg-white px-2 py-1 text-[10px] dark:border-neutral-800 dark:bg-neutral-900" /></label>
              </div>}
              <p className="mt-1 text-[9px] text-neutral-400">Uses the campaign timezone and applies to every channel.</p>
            </div>
            <div className="space-y-2 rounded-xl border border-neutral-200 bg-neutral-50/60 p-2.5 dark:border-neutral-800 dark:bg-neutral-950/40">
              <div className="flex items-center justify-between gap-2">
                <label className="text-[10px] font-semibold uppercase tracking-wider text-neutral-400">Intelligent sequence</label>
                <button type="button" onClick={addSequenceStep} disabled={sequenceSteps.length >= 20} className="rounded-md border border-orange-200 px-2 py-1 text-[10px] font-semibold text-orange-700 disabled:opacity-40 dark:border-orange-900 dark:text-orange-200">+ Add step</button>
              </div>
              {!sequenceSteps.length && <p className="text-[9px] text-neutral-400">Add follow-ups or use the AI copilot to generate a multi-channel sequence.</p>}
              {sequenceSteps.map((step, index) => (
                <div key={`sequence-${index}`} className="grid grid-cols-[auto_1fr_auto] items-center gap-1.5 rounded-lg border border-neutral-200 bg-white p-2 dark:border-neutral-800 dark:bg-neutral-900">
                  <span className="text-[9px] font-bold text-neutral-400">{index + 1}</span>
                  <div className="min-w-0 space-y-1">
                    <div className="flex gap-1.5">
                      <select value={step.channel} onChange={(event) => updateSequenceStep(index, { channel: event.target.value })} className="w-24 rounded-md border border-neutral-200 px-1.5 py-1 text-[10px] dark:border-neutral-800 dark:bg-neutral-950">
                        {["web", "email", "whatsapp", "sms"].map((channel) => <option key={channel} value={channel}>{channel}</option>)}
                      </select>
                      <input type="number" min={0} max={43_200} value={step.after_minutes} onChange={(event) => updateSequenceStep(index, { after_minutes: Number(event.target.value) || 0 })} aria-label={`Step ${index + 1} delay in minutes`} className="w-20 rounded-md border border-neutral-200 px-1.5 py-1 text-[10px] dark:border-neutral-800 dark:bg-neutral-950" placeholder="Minutes" />
                    </div>
                    <input value={step.message} onChange={(event) => updateSequenceStep(index, { message: event.target.value })} aria-label={`Step ${index + 1} message`} className="w-full rounded-md border border-neutral-200 px-2 py-1 text-[10px] dark:border-neutral-800 dark:bg-neutral-950" placeholder="Follow-up message" />
                  </div>
                  <button type="button" onClick={() => setSequenceSteps((current) => current.filter((_, stepIndex) => stepIndex !== index))} aria-label={`Remove step ${index + 1}`} className="rounded-md p-1 text-neutral-400 hover:text-red-500"><Trash2 className="size-3.5" /></button>
                </div>
              ))}
            </div>
          </div>

            <button
            onClick={addRule}
            disabled={!message.trim() || saving || loading}
            className="w-full flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-semibold text-white rounded-xl cursor-pointer disabled:opacity-40"
            style={{ background: color }}
          >
            <Plus className="size-4" /> {saving ? "Saving…" : "Add Campaign Rule"}
          </button>
        </div>

        {/* Existing campaigns list */}
        <div className="md:col-span-7 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl p-5 space-y-4">
          <h5 className="text-xs font-bold text-neutral-850">Campaigns ({rules.length})</h5>
          {loading && <p className="text-[11px] text-neutral-400">Loading persisted campaigns…</p>}
          
          <div className="space-y-3 divide-y divide-neutral-100 dark:divide-neutral-850">
            {rules.length === 0 ? (
              <div className="text-center py-10 text-neutral-400">
                <Megaphone className="size-8 text-neutral-300 mx-auto mb-2" />
                <p className="text-xs">No proactive rules defined.</p>
              </div>
            ) : (
              rules.map((r, idx) => (
                <div key={r.id} className={`flex items-start justify-between gap-4 pt-3 ${idx === 0 ? "pt-0 border-0" : ""} ${r.isActive === false ? "opacity-60" : ""}`}>
                  <div className="space-y-1.5 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-neutral-100 dark:bg-neutral-800 text-neutral-500">
                        {r.type}
                      </span>
                      {r.type !== "exit" && (
                        <span className="text-[10px] font-mono text-neutral-400">
                          ({r.value}{r.type === "time" ? "s" : r.type === "scroll" ? "%" : ""})
                        </span>
                      )}
                      <span className={`text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${r.isActive === false ? "bg-neutral-100 text-neutral-500" : "bg-emerald-50 text-emerald-700"}`}>
                        {r.isActive === false ? "paused" : "active"}
                      </span>
                    </div>
                    <p className="text-xs text-neutral-700 dark:text-neutral-300 font-medium whitespace-pre-wrap leading-relaxed">{r.message}</p>
                    <div className="flex flex-wrap gap-2 text-[10px] text-neutral-400" aria-label="Campaign analytics">
                      <span>{r.impressions ?? 0} impressions</span><span>{r.clicks ?? 0} clicks</span><span>{r.conversions ?? 0} conversions</span>
                      {r.clickRate !== undefined && <span>{(r.clickRate * 100).toFixed(1)}% CTR</span>}
                      {r.conversionRate !== undefined && <span>{(r.conversionRate * 100).toFixed(1)}% CVR</span>}
                      {(r.sent ?? 0) + (r.failed ?? 0) + (r.suppressed ?? 0) > 0 && <span>Delivery {((r.deliverySuccessRate ?? 0) * 100).toFixed(1)}% · {r.sent ?? 0} sent · {r.failed ?? 0} failed · {r.suppressed ?? 0} suppressed</span>}
                      {Object.keys(r.byDevice ?? {}).length > 0 && <span>Devices: {Object.entries(r.byDevice ?? {}).map(([key, value]) => `${key} ${value}`).join(" · ")}</span>}
                      {Object.keys(r.byChannel ?? {}).length > 0 && <span>Channels: {Object.entries(r.byChannel ?? {}).map(([key, value]) => `${key} ${value}`).join(" · ")}</span>}
                    </div>
                    <div className="text-[10px] text-neutral-400">Audience: {r.audience ?? "all"} · Channels: {(r.channels ?? ["web"]).join(", ")}{r.recipientSource === "consented_leads" ? " · consented leads only" : ""}</div>
                    <div className="text-[10px] text-neutral-400">
                      Schedule: {r.scheduleCadence ?? "once"}
                      {r.nextRunAt ? ` · next run ${new Date(r.nextRunAt).toLocaleString()}` : " · no future run"}
                      {r.startDate ? ` · starts ${new Date(r.startDate).toLocaleString()}` : ""}
                      {r.endDate ? ` · ends ${new Date(r.endDate).toLocaleString()}` : ""}
                      {r.quietHours ? ` · quiet ${r.quietHours.start}–${r.quietHours.end}` : ""}
                    </div>
                    {!!r.sequenceSteps?.length && <div className="text-[10px] text-neutral-400">{r.sequenceSteps.length} sequenced follow-up{r.sequenceSteps.length === 1 ? "" : "s"}</div>}
                    <button type="button" onClick={() => toggleDispatchPlan(r.id)} className="mt-1 inline-flex items-center gap-1 text-[10px] font-semibold text-indigo-600 hover:underline dark:text-indigo-300">
                      {dispatchPlans[r.id]?.loading ? <Loader2 className="size-3 animate-spin" /> : <ListChecks className="size-3" />}
                      {dispatchPlans[r.id] ? "Hide delivery plan" : "Preview delivery plan"}
                    </button>
                    {dispatchPlans[r.id]?.error && <p className="mt-1 text-[10px] text-rose-600 dark:text-rose-300">{dispatchPlans[r.id]?.error}</p>}
                    {dispatchPlans[r.id]?.jobs && <div className="mt-2 space-y-1 rounded-lg border border-indigo-100 bg-indigo-50/50 p-2 text-[10px] text-indigo-900 dark:border-indigo-900/50 dark:bg-indigo-950/20 dark:text-indigo-100">
                      {dispatchPlans[r.id]?.deferred && <p className="rounded-md border border-amber-200 bg-amber-50 px-2 py-1 text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-200">Deferred safely: {dispatchPlans[r.id]?.deferred_reason ?? "recipient and consent checks must complete before provider delivery."}</p>}
                      {!dispatchPlans[r.id]?.deferred && !dispatchPlans[r.id]?.jobs?.length && <p>No dispatch is due now. Check the campaign schedule, date window, or quiet-hours safeguard.</p>}
                      {dispatchPlans[r.id]?.jobs?.map((job, jobIndex) => <div key={job.idempotency_key} className="rounded-md border border-indigo-100 bg-white/70 px-2 py-1 dark:border-indigo-900/50 dark:bg-neutral-950/30">
                        <span className="font-bold">{jobIndex + 1}. {job.payload.channel ?? "web"}</span> · {new Date(job.scheduled_at).toLocaleString()}
                        <span className="block text-[9px] text-indigo-700/80 dark:text-indigo-200/80">Consent {job.payload.requires_consent ? "required" : "not required"} · frequency cap {job.payload.frequency_cap_hours ?? 24}h · idempotent</span>
                      </div>)}
                    </div>}
                    <button type="button" onClick={() => toggleDeliveryLog(r.id)} className="mt-1 inline-flex items-center gap-1 text-[10px] font-semibold text-neutral-500 hover:underline dark:text-neutral-300">
                      {deliveryLogs[r.id]?.loading ? <Loader2 className="size-3 animate-spin" /> : <ListChecks className="size-3" />}
                      {deliveryLogs[r.id] ? "Hide delivery log" : "View delivery log"}
                    </button>
                    {deliveryLogs[r.id]?.error && <p className="mt-1 text-[10px] text-rose-600 dark:text-rose-300">{deliveryLogs[r.id]?.error}</p>}
                    {deliveryLogs[r.id]?.deliveries && <div className="mt-2 max-h-36 space-y-1 overflow-y-auto rounded-lg border border-neutral-200 bg-neutral-50 p-2 text-[10px] dark:border-neutral-800 dark:bg-neutral-950">
                      {!deliveryLogs[r.id]?.deliveries?.length && <p className="text-neutral-400">No provider delivery attempts recorded.</p>}
                      {deliveryLogs[r.id]?.deliveries?.map((delivery) => <div key={delivery.id} className="flex items-start justify-between gap-2 rounded-md border border-neutral-200 bg-white px-2 py-1 dark:border-neutral-800 dark:bg-neutral-900">
                        <span><b className="uppercase">{delivery.status}</b> · {delivery.channel} · recipient {delivery.recipient_id || "—"}<span className="block text-[9px] text-neutral-400">{delivery.updated_at ? new Date(delivery.updated_at).toLocaleString() : "time unavailable"}</span></span>
                        {delivery.error && <span className="max-w-[55%] text-right text-rose-600 dark:text-rose-300">{delivery.error}</span>}
                      </div>)}
                    </div>}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button type="button" onClick={() => toggleRule(r)} disabled={saving} aria-label={r.isActive === false ? "Resume campaign" : "Pause campaign"} title={r.isActive === false ? "Resume campaign" : "Pause campaign"} className="p-1.5 text-neutral-450 hover:text-orange-500 rounded-lg hover:bg-neutral-50 dark:hover:bg-neutral-850 cursor-pointer transition-colors disabled:opacity-40">
                      {r.isActive === false ? <Play className="size-4" /> : <Pause className="size-4" />}
                    </button>
                    <button type="button" onClick={() => deleteRule(r.id)} disabled={saving} aria-label="Delete campaign" title="Delete campaign" className="p-1.5 text-neutral-450 hover:text-red-500 rounded-lg hover:bg-neutral-50 dark:hover:bg-neutral-850 cursor-pointer transition-colors disabled:opacity-40">
                      <Trash2 className="size-4" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
