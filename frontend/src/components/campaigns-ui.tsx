"use client";

import { useState, useEffect } from "react";
import { Plus, Trash2, Megaphone, Sparkles } from "lucide-react";
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
  audience?: string;
  channels?: string[];
  sequenceSteps?: Array<Record<string, unknown>>;
}

interface Props {
  botId: string | null;
  color?: string;
  fetchBackend: (path: string, options?: RequestInit) => Promise<Response>;
}

export function CampaignsUI({ botId, color = "#f97316", fetchBackend }: Props) {
  const [rules, setRules] = useState<TriggerRule[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [type, setType] = useState<"time" | "scroll" | "exit" | "url">("time");
  const [value, setValue] = useState("");
  const [message, setMessage] = useState("");
  const [audience, setAudience] = useState("all");
  const [channel, setChannel] = useState("web");
  const [cadence, setCadence] = useState("once");
  const [sequenceText, setSequenceText] = useState("[]");
  const [goal, setGoal] = useState("");
  const [suggesting, setSuggesting] = useState(false);
  const [suggestingAudience, setSuggestingAudience] = useState(false);
  const [audienceRationale, setAudienceRationale] = useState("");

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
            channels: Array.isArray(row.channels) ? row.channels.map(String) : ["web"],
            sequenceSteps: Array.isArray(row.sequence_steps) ? row.sequence_steps as Array<Record<string, unknown>> : [],
          }));
          setRules(mapped);
          // Counters on the campaign row are legacy snapshots. Read the
          // recomputable event-ledger metrics when available, without making
          // campaign loading fail if telemetry has not been migrated yet.
          const analytics = await Promise.all(mapped.map(async (rule) => {
            try {
              const metricResponse = await fetchBackend(`/api/bots/${botId}/campaigns/${rule.id}/analytics`);
              if (!metricResponse.ok) return null;
              const metric = await metricResponse.json() as { impressions?: number; clicks?: number; conversions?: number; click_rate?: number; conversion_rate?: number };
              return { id: rule.id, impressions: Number(metric.impressions ?? rule.impressions ?? 0), clicks: Number(metric.clicks ?? rule.clicks ?? 0), conversions: Number(metric.conversions ?? rule.conversions ?? 0), clickRate: Number(metric.click_rate ?? 0), conversionRate: Number(metric.conversion_rate ?? 0) };
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
    let sequenceSteps: Array<Record<string, unknown>> = [];
    try {
      const parsed = JSON.parse(sequenceText);
      if (!Array.isArray(parsed)) throw new Error("Sequence must be a JSON array");
      sequenceSteps = parsed.filter((step): step is Record<string, unknown> => Boolean(step) && typeof step === "object");
    } catch (sequenceError) {
      setError(sequenceError instanceof Error ? sequenceError.message : "Invalid sequence JSON");
      return;
    }
    const newRule: TriggerRule = {
      id: crypto.randomUUID(),
      type,
      value: type === "exit" ? "" : value.trim() || "10",
      message: message.trim(),
    };
    if (!botId) return;
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
        audience_rules: { segment: audience },
        channels: [channel],
        sequence_steps: sequenceSteps,
        safety_config: { frequency_cap_hours: 24, require_consent: true },
        schedule_config: { cadence, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC" },
      }),
    }).then(async (response) => {
      if (!response.ok) throw new Error(`Campaign could not be saved (${response.status})`);
      const row = await response.json() as Record<string, unknown>;
      setRules((current) => [{ ...newRule, id: String(row.id) }, ...current]);
      setValue("");
      setMessage("");
      setAudience("all");
      setChannel("web");
      setCadence("once");
      setSequenceText("[]");
    }).catch((saveError: unknown) => setError(saveError instanceof Error ? saveError.message : "Campaign could not be saved."))
      .finally(() => setSaving(false));
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
      setSequenceText(JSON.stringify(suggestion.sequence_steps ?? [], null, 2));
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
      const result = await response.json() as { audience_rules?: { segment?: string }; rationale?: string };
      const segment = result.audience_rules?.segment;
      if (segment === "all" || segment === "returning" || segment === "high_intent") setAudience(segment);
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
                <ModernSelect value={audience} options={[{ value: "all", label: "All visitors" }, { value: "returning", label: "Returning visitors" }, { value: "high_intent", label: "High intent" }]} onChange={setAudience} />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-semibold text-neutral-400 uppercase tracking-wider">Channel</label>
                <ModernSelect value={channel} options={[{ value: "web", label: "Website" }, { value: "email", label: "Email" }, { value: "whatsapp", label: "WhatsApp" }]} onChange={setChannel} />
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-semibold text-neutral-400 uppercase tracking-wider">Sequence cadence</label>
              <ModernSelect value={cadence} options={[{ value: "once", label: "Run once" }, { value: "hourly", label: "Hourly" }, { value: "daily", label: "Daily" }, { value: "weekly", label: "Weekly" }]} onChange={setCadence} />
              <p className="text-[9px] text-neutral-400">The schedule is persisted with the campaign and interpreted in the visitor’s configured timezone.</p>
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-semibold uppercase tracking-wider text-neutral-400">Sequence steps (JSON)</label>
              <textarea rows={3} value={sequenceText} onChange={(event) => setSequenceText(event.target.value)} spellCheck={false} className="w-full rounded-lg border border-neutral-200 bg-neutral-50 px-2.5 py-1.5 font-mono text-[10px] focus:outline-none dark:border-neutral-800 dark:bg-neutral-950" placeholder='[{"after_minutes": 0, "channel": "web", "message": "..."}]' />
              <p className="text-[9px] text-neutral-400">Use AI suggestion or define follow-up steps with channel and delay metadata.</p>
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
          <h5 className="text-xs font-bold text-neutral-850">Active Campaigns ({rules.length})</h5>
          {loading && <p className="text-[11px] text-neutral-400">Loading persisted campaigns…</p>}
          
          <div className="space-y-3 divide-y divide-neutral-100 dark:divide-neutral-850">
            {rules.length === 0 ? (
              <div className="text-center py-10 text-neutral-400">
                <Megaphone className="size-8 text-neutral-300 mx-auto mb-2" />
                <p className="text-xs">No proactive rules defined.</p>
              </div>
            ) : (
              rules.map((r, idx) => (
                <div key={r.id} className={`flex items-start justify-between gap-4 pt-3 ${idx === 0 ? "pt-0 border-0" : ""}`}>
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
                    </div>
                    <p className="text-xs text-neutral-700 dark:text-neutral-300 font-medium whitespace-pre-wrap leading-relaxed">{r.message}</p>
                    <div className="flex flex-wrap gap-2 text-[10px] text-neutral-400" aria-label="Campaign analytics">
                      <span>{r.impressions ?? 0} impressions</span><span>{r.clicks ?? 0} clicks</span><span>{r.conversions ?? 0} conversions</span>
                      {r.clickRate !== undefined && <span>{(r.clickRate * 100).toFixed(1)}% CTR</span>}
                      {r.conversionRate !== undefined && <span>{(r.conversionRate * 100).toFixed(1)}% CVR</span>}
                    </div>
                    <div className="text-[10px] text-neutral-400">Audience: {r.audience ?? "all"} · Channels: {(r.channels ?? ["web"]).join(", ")}</div>
                    {!!r.sequenceSteps?.length && <div className="text-[10px] text-neutral-400">{r.sequenceSteps.length} sequenced follow-up{r.sequenceSteps.length === 1 ? "" : "s"}</div>}
                  </div>
                  <button
                    onClick={() => deleteRule(r.id)}
                    className="p-1.5 text-neutral-450 hover:text-red-500 rounded-lg hover:bg-neutral-50 dark:hover:bg-neutral-850 cursor-pointer shrink-0 transition-colors"
                  >
                    <Trash2 className="size-4" />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
