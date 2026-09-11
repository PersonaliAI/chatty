"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { Check, ChevronDown } from "lucide-react";

import { ModernSelect } from "@/components/ui/modern-select";
import { TAB_LABELS, type ChattyTeamTab } from "./dashboard-permissions";

export function CloudProviderMenu({
  label, iconSrc, connected, services, onDisconnect,
}: {
  label: string;
  iconSrc: string;
  connected: boolean;
  services: { label: string; iconSrc: string; onClick: () => void }[];
  onDisconnect: () => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-[11px] font-semibold transition-colors cursor-pointer ${
          connected ? "border-green-300 bg-green-50 text-green-700 dark:border-green-900/50 dark:bg-green-950/20 dark:text-green-400" : "border-neutral-200 dark:border-neutral-800 hover:border-[#f97316]/40 hover:bg-[#f97316]/5"
        }`}
      >
        <Image src={iconSrc} alt="" width={16} height={16} className="size-4 object-contain" />
        {label}
        {connected && <Check className="size-3" />}
        <ChevronDown className={`size-3 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="absolute z-20 mt-1.5 w-56 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 shadow-lg shadow-black/10 dark:shadow-black/40 overflow-hidden">
          {!connected && (
            <div className="px-3 py-2 text-[10px] text-neutral-400 border-b border-neutral-100 dark:border-neutral-850">
              Connect {label} to unlock:
            </div>
          )}
          {services.map((s) => (
            <button
              key={s.label}
              type="button"
              onClick={() => { setOpen(false); s.onClick(); }}
              className="w-full flex items-center gap-2.5 px-3 py-2 text-[11px] font-medium text-neutral-700 dark:text-neutral-200 hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors cursor-pointer"
            >
              <Image src={s.iconSrc} alt="" width={16} height={16} className="size-4 object-contain" />
              {s.label}
            </button>
          ))}
          {connected && (
            <button
              type="button"
              onClick={() => { setOpen(false); onDisconnect(); }}
              className="w-full flex items-center gap-2 px-3 py-2 text-[11px] font-medium text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 transition-colors cursor-pointer border-t border-neutral-100 dark:border-neutral-850"
            >
              Disconnect {label}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export function TeamTabCheckbox({ checked, onChange, label }: { checked: boolean; onChange: (checked: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="flex items-center gap-1.5 text-[11px] text-neutral-600 dark:text-neutral-300 cursor-pointer select-none"
    >
      <span
        className={`flex items-center justify-center size-4 rounded-[5px] border transition-colors duration-150 ${
          checked
            ? "bg-[#f97316] border-[#f97316]"
            : "bg-white dark:bg-neutral-900 border-neutral-300 dark:border-neutral-700 hover:border-neutral-400 dark:hover:border-neutral-600"
        }`}
      >
        {checked && <Check className="size-3 text-white" strokeWidth={3.5} />}
      </span>
      {label}
    </button>
  );
}

const TIME_PICKER_HOURS = Array.from({ length: 12 }, (_, i) => String(i + 1));
const TIME_PICKER_MINUTES = ["00", "15", "30", "45"];

export function TimePicker({ minutes, onChange }: { minutes: number; onChange: (minutes: number) => void }) {
  const h24 = Math.floor(minutes / 60) % 24;
  const m = minutes % 60;
  const isPM = h24 >= 12;
  const h12 = h24 % 12 || 12;

  function update(newH12: number, newM: number, newIsPM: boolean) {
    const newH24 = (newH12 % 12) + (newIsPM ? 12 : 0);
    onChange(newH24 * 60 + newM);
  }

  return (
    <div className="flex items-center gap-1">
      <div className="w-[68px] shrink-0">
        <ModernSelect
          size="sm" value={String(h12)}
          options={TIME_PICKER_HOURS.map((h) => ({ value: h, label: h }))}
          onChange={(v) => update(parseInt(v, 10), m, isPM)}
        />
      </div>
      <span className="text-neutral-400 text-[10px]">:</span>
      <div className="w-[68px] shrink-0">
        <ModernSelect
          size="sm" value={String(m).padStart(2, "0")}
          options={TIME_PICKER_MINUTES.map((mm) => ({ value: mm, label: mm }))}
          onChange={(v) => update(h12, parseInt(v, 10), isPM)}
        />
      </div>
      <div className="w-[68px] shrink-0">
        <ModernSelect
          size="sm" value={isPM ? "PM" : "AM"}
          options={[{ value: "AM", label: "AM" }, { value: "PM", label: "PM" }]}
          onChange={(v) => update(h12, m, v === "PM")}
        />
      </div>
    </div>
  );
}

export function MemberPermissionEditor({
  role, permissions, grantableTabs, onSave, onCancel,
}: {
  role: "agent" | "admin";
  permissions: ChattyTeamTab[];
  grantableTabs: readonly ChattyTeamTab[];
  onSave: (role: "agent" | "admin", permissions: ChattyTeamTab[]) => void;
  onCancel: () => void;
}) {
  const [draftRole, setDraftRole] = useState(role);
  const [draftTabs, setDraftTabs] = useState<ChattyTeamTab[]>(permissions);
  return (
    <div className="space-y-2 pt-1">
      <div className="w-28">
        <ModernSelect
          value={draftRole}
          options={[{ value: "agent", label: "Agent" }, { value: "admin", label: "Admin" }]}
          onChange={(v) => setDraftRole(v as "agent" | "admin")}
        />
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1.5">
        {grantableTabs.map((tab) => (
          <TeamTabCheckbox
            key={tab}
            checked={draftTabs.includes(tab)}
            onChange={(checked) => setDraftTabs((p) => checked ? [...p, tab] : p.filter((t) => t !== tab))}
            label={TAB_LABELS[tab]}
          />
        ))}
      </div>
      <div className="flex items-center gap-2">
        <button onClick={() => onSave(draftRole, draftTabs)} className="px-2.5 py-1 text-[10px] font-semibold rounded-md bg-[#f97316] text-white hover:opacity-90 transition-opacity">Save</button>
        <button onClick={onCancel} className="px-2.5 py-1 text-[10px] font-medium rounded-md text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200 transition-colors">Cancel</button>
      </div>
    </div>
  );
}

const AVAILABILITY_DAYS = [
  { value: 0, label: "Mon" }, { value: 1, label: "Tue" }, { value: 2, label: "Wed" },
  { value: 3, label: "Thu" }, { value: 4, label: "Fri" }, { value: 5, label: "Sat" }, { value: 6, label: "Sun" },
] as const;

export function MemberAvailabilityEditor({ memberId, botId, showToast, fetchWithFallback }: {
  memberId: string; botId: string;
  showToast: (msg: string, kind: "success" | "error" | "info") => void;
  fetchWithFallback: (path: string, options?: RequestInit) => Promise<Response>;
}) {
  const [rules, setRules] = useState<{ day_of_week: number; start_minute: number; end_minute: number }[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetchWithFallback(`/api/team/${memberId}/availability?bot_id=${botId}`);
        if (res.ok && !cancelled) {
          const d = await res.json();
          setRules(d.rules || []);
        }
      } finally { if (!cancelled) setLoading(false); }
    })();
    return () => { cancelled = true; };
  }, [memberId, botId, fetchWithFallback]);

  function dayRule(day: number) { return rules.find((r) => r.day_of_week === day); }
  function toggleDay(day: number, on: boolean) {
    setRules((p) => on
      ? [...p, { day_of_week: day, start_minute: 540, end_minute: 1020 }]
      : p.filter((r) => r.day_of_week !== day));
  }
  function updateDay(day: number, field: "start_minute" | "end_minute", minutes: number) {
    setRules((p) => p.map((r) => (r.day_of_week === day ? { ...r, [field]: minutes } : r)));
  }

  async function save() {
    setSaving(true);
    try {
      const res = await fetchWithFallback(`/api/team/${memberId}/availability`, {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bot_id: botId, rules }),
      });
      if (!res.ok) showToast("Couldn't save availability. Try again.", "error");
      else showToast("Availability saved.", "success");
    } catch {
      showToast("Couldn't save availability. Try again.", "error");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <p className="text-[10px] text-neutral-400 py-1">Loading availability…</p>;

  return (
    <div className="space-y-1.5 pt-1">
      <p className="text-[10px] text-neutral-400">Recurring weekly availability for round-robin booking. Days left off use this bot&apos;s default business hours.</p>
      {AVAILABILITY_DAYS.map(({ value, label }) => {
        const rule = dayRule(value);
        const on = !!rule;
        return (
          <div key={value} className="flex items-center gap-2.5">
            <div className="w-16 shrink-0">
              <TeamTabCheckbox checked={on} onChange={(checked) => toggleDay(value, checked)} label={label} />
            </div>
            {on && rule && (
              <>
                <TimePicker minutes={rule.start_minute} onChange={(m) => updateDay(value, "start_minute", m)} />
                <span className="text-[10px] text-neutral-400">to</span>
                <TimePicker minutes={rule.end_minute} onChange={(m) => updateDay(value, "end_minute", m)} />
              </>
            )}
          </div>
        );
      })}
      <button onClick={save} disabled={saving} className="mt-1 px-2.5 py-1 text-[10px] font-semibold rounded-md bg-[#f97316] text-white hover:opacity-90 disabled:opacity-40 transition-opacity">
        {saving ? "Saving…" : "Save availability"}
      </button>
    </div>
  );
}

export function SectionPropertyDropdown({ value, options, onChange }: { value: string; options: { value: string; label: string }[]; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);
  const current = options.find((o) => o.value === value) || options[0];
  return (
    <div ref={ref} className="relative flex-1">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between gap-1.5 bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-lg pl-2.5 pr-2 py-1.5 text-[11px] font-medium text-left cursor-pointer transition-colors hover:border-neutral-300 dark:hover:border-neutral-700"
      >
        <span className="truncate">{current?.label}</span>
        <ChevronDown className={`size-3 text-neutral-400 shrink-0 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="absolute z-20 top-full left-0 right-0 mt-1 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-lg shadow-lg overflow-hidden py-1">
          {options.map((o) => (
            <button
              key={o.value}
              type="button"
              onClick={() => { onChange(o.value); setOpen(false); }}
              className={`w-full text-left px-2.5 py-1.5 text-[11px] cursor-pointer transition-colors ${
                o.value === current?.value ? "bg-[#f97316]/10 text-[#f97316] font-semibold" : "hover:bg-neutral-100 dark:hover:bg-neutral-800"
              }`}
            >
              {o.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
