"use client";

import { useState, useEffect } from "react";
import { Plus, Trash2, Megaphone } from "lucide-react";
import { ModernSelect, type ModernSelectOption } from "@/components/ui/modern-select";

interface TriggerRule {
  id: string;
  type: "time" | "scroll" | "exit" | "url";
  value: string;
  message: string;
}

interface Props {
  botId: string | null;
  color?: string;
}

export function CampaignsUI({ botId, color = "#f97316" }: Props) {
  const [rules, setRules] = useState<TriggerRule[]>([]);
  const [type, setType] = useState<"time" | "scroll" | "exit" | "url">("time");
  const [value, setValue] = useState("");
  const [message, setMessage] = useState("");

  const typeOptions: ModernSelectOption[] = [
    { value: "time", label: "Time on page (Seconds)" },
    { value: "scroll", label: "Scroll depth (Percentage)" },
    { value: "exit", label: "Exit Intent (Leaver)" },
    { value: "url", label: "URL Match (Path/Regexp)" },
  ];

  // Hydrate rules from localStorage once botId is known — a one-time
  // default-hydration effect reading from a browser-only API, not
  // something computable at render time.
  useEffect(() => {
    if (!botId) return;
    try {
      const saved = localStorage.getItem(`chatty_campaigns_${botId}`);
      if (saved) {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setRules(JSON.parse(saved));
      } else {
        // Default onboarding rule
        setRules([
          {
            id: "default-1",
            type: "time",
            value: "5",
            message: "👋 Hi there! Need help choosing a plan?"
          }
        ]);
      }
    } catch {}
  }, [botId]);

  const onSave = (newRules: TriggerRule[]) => {
    if (!botId) return;
    setRules(newRules);
    try {
      localStorage.setItem(`chatty_campaigns_${botId}`, JSON.stringify(newRules));
      // Trigger update to database rules so it maps to the widget.js triggers
      localStorage.setItem(`chatty_session_trigger_rules_${botId}`, JSON.stringify(newRules));
    } catch {}
  };

  const addRule = () => {
    if (!message.trim()) return;
    const newRule: TriggerRule = {
      id: crypto.randomUUID(),
      type,
      value: type === "exit" ? "" : value.trim() || "10",
      message: message.trim(),
    };
    const updated = [...rules, newRule];
    onSave(updated);
    setValue("");
    setMessage("");
  };

  const deleteRule = (id: string) => {
    const updated = rules.filter((r) => r.id !== id);
    onSave(updated);
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

      <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
        {/* Creator form */}
        <div className="md:col-span-5 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl p-5 space-y-4 h-fit">
          <h5 className="text-xs font-bold text-neutral-850">Create Campaign Rule</h5>
          
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
          </div>

          <button
            onClick={addRule}
            disabled={!message.trim()}
            className="w-full flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-semibold text-white rounded-xl cursor-pointer disabled:opacity-40"
            style={{ background: color }}
          >
            <Plus className="size-4" /> Add Campaign Rule
          </button>
        </div>

        {/* Existing campaigns list */}
        <div className="md:col-span-7 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl p-5 space-y-4">
          <h5 className="text-xs font-bold text-neutral-850">Active Campaigns ({rules.length})</h5>
          
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
