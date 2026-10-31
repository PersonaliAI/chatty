"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import {
  Check,
  ChevronDown,
  Inbox,
  MessageSquare,
  Calendar,
  Mail,
  Home,
  Users,
  Star,
  BarChart3,
  MapPin,
  Database,
  Sliders,
  Workflow,
  Megaphone,
  Headphones,
  Building2,
  Settings,
  UserCheck,
  Bell,
  FileText,
  Code2,
  Puzzle,
  Cpu,
  CreditCard,
  ShoppingBag,
  Sparkles,
  RotateCcw,
  CheckCheck,
  X,
} from "lucide-react";

import { ModernSelect, type ModernSelectOption } from "@/components/ui/modern-select";
import {
  TAB_LABELS,
  TAB_DESCRIPTIONS,
  TAB_CATEGORIES,
  ROLE_DEFAULT_TABS,
  ROLE_INFO,
  toggleTabIntelligently,
  type ChattyTeamTab,
  type ChattyTeamRole,
} from "./dashboard-permissions";

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
  const popupRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ left: 0, top: 0 });
  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node) && !popupRef.current?.contains(e.target as Node)) setOpen(false); };
    const place = () => {
      const rect = ref.current?.getBoundingClientRect();
      if (rect) setPosition({ left: Math.max(12, Math.min(rect.left, window.innerWidth - 236)), top: rect.bottom + 6 });
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") { setOpen(false); ref.current?.querySelector("button")?.focus(); } };
    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onClick);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-expanded={open}
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
      {open && createPortal(
        <div ref={popupRef} style={{ left: position.left, top: position.top }} className="fixed z-[9999] w-56 max-w-[calc(100vw-24px)] rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 shadow-lg shadow-black/10 dark:shadow-black/40 overflow-hidden">
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
      , ref.current?.closest("[data-dashboard]") || document.body)}
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
    <div className="flex min-w-0 sm:min-w-max sm:shrink-0 items-center gap-1">
      <div className="w-[68px] shrink-0 max-sm:w-auto max-sm:min-w-0 max-sm:flex-1">
        <ModernSelect
          size="sm" value={String(h12)}
          options={TIME_PICKER_HOURS.map((h) => ({ value: h, label: h }))}
          onChange={(v) => update(parseInt(v, 10), m, isPM)}
        />
      </div>
      <span className="text-neutral-400 text-[10px]">:</span>
      <div className="w-[68px] shrink-0 max-sm:w-auto max-sm:min-w-0 max-sm:flex-1">
        <ModernSelect
          size="sm" value={String(m).padStart(2, "0")}
          options={TIME_PICKER_MINUTES.map((mm) => ({ value: mm, label: mm }))}
          onChange={(v) => update(h12, parseInt(v, 10), isPM)}
        />
      </div>
      <div className="w-[68px] shrink-0 max-sm:w-auto max-sm:min-w-0 max-sm:flex-1">
        <ModernSelect
          size="sm" value={isPM ? "PM" : "AM"}
          options={[{ value: "AM", label: "AM" }, { value: "PM", label: "PM" }]}
          onChange={(v) => update(h12, m, v === "PM")}
        />
      </div>
    </div>
  );
}

export const TAB_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  inbox: Inbox,
  playground: MessageSquare,
  meetings: Calendar,
  mailbox: Mail,
  orders: ShoppingBag,
  overview: Home,
  leads: Users,
  feedback: Star,
  analytics: BarChart3,
  map: MapPin,
  knowledge: Database,
  customizer: Sliders,
  flow_builder: Workflow,
  campaigns: Megaphone,
  voice: Headphones,
  workspace: Building2,
  settings: Settings,
  team: UserCheck,
  notifications: Bell,
  audit_log: FileText,
  integrations: Code2,
  developer: Puzzle,
  mcp: Cpu,
  billing: CreditCard,
  sources: Database,
  design: Sliders,
  byok: Settings,
  webhooks: Puzzle,
};

export function AccessibleTabsGrid({
  selectedTabs,
  onChange,
  grantableTabs,
  role,
}: {
  selectedTabs: ChattyTeamTab[];
  onChange: (tabs: ChattyTeamTab[]) => void;
  grantableTabs: readonly ChattyTeamTab[];
  role?: ChattyTeamRole;
}) {
  const handleToggle = (tab: ChattyTeamTab, checked: boolean) => {
    onChange(toggleTabIntelligently(selectedTabs, tab, checked, grantableTabs));
  };

  const handleSelectRoleDefaults = () => {
    if (!role) return;
    const defaults = ROLE_DEFAULT_TABS[role] || [];
    onChange(defaults.filter((t) => grantableTabs.includes(t)) as ChattyTeamTab[]);
  };

  const handleSelectAll = () => {
    onChange([...grantableTabs]);
  };

  const handleClearAll = () => {
    onChange([]);
  };

  const totalGrantable = grantableTabs.length;
  const totalSelected = selectedTabs.filter((t) => grantableTabs.includes(t)).length;

  return (
    <div className="space-y-3">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-1 border-b border-neutral-100 dark:border-neutral-800">
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-semibold text-neutral-800 dark:text-neutral-200">
            Accessible Dashboard Tabs
          </span>
          <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400">
            {totalSelected} / {totalGrantable} granted
          </span>
        </div>
        <div className="flex items-center gap-1.5 flex-wrap">
          {role && (
            <button
              type="button"
              onClick={handleSelectRoleDefaults}
              className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-300 transition-colors cursor-pointer"
            >
              <RotateCcw className="size-2.5" />
              Role Defaults
            </button>
          )}
          <button
            type="button"
            onClick={handleSelectAll}
            className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-300 transition-colors cursor-pointer"
          >
            <CheckCheck className="size-2.5" />
            Select All
          </button>
          <button
            type="button"
            onClick={handleClearAll}
            className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors cursor-pointer"
          >
            <X className="size-2.5" />
            Clear
          </button>
        </div>
      </div>

      <div className="space-y-3.5">
        {TAB_CATEGORIES.map((category) => {
          const categoryTabs = category.tabs.filter((t) => grantableTabs.includes(t));
          if (categoryTabs.length === 0) return null;
          return (
            <div key={category.id} className="space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
                  {category.label}
                </span>
                <span className="text-[9px] text-neutral-400 hidden sm:inline">
                  {category.description}
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                {categoryTabs.map((tab) => {
                  const isChecked = selectedTabs.includes(tab);
                  const Icon = TAB_ICONS[tab] || Sparkles;
                  return (
                    <button
                      key={tab}
                      type="button"
                      role="checkbox"
                      aria-checked={isChecked}
                      onClick={() => handleToggle(tab, !isChecked)}
                      className={`flex items-start gap-2 p-2 rounded-lg border text-left transition-all cursor-pointer ${
                        isChecked
                          ? "bg-orange-50/60 dark:bg-orange-950/20 border-orange-200 dark:border-orange-850 shadow-2xs"
                          : "bg-white dark:bg-neutral-900 border-neutral-200 dark:border-neutral-800 hover:border-neutral-300 dark:hover:border-neutral-700"
                      }`}
                    >
                      <span
                        className={`flex items-center justify-center size-4 mt-0.5 rounded-[4px] border shrink-0 transition-colors ${
                          isChecked
                            ? "bg-[#f97316] border-[#f97316]"
                            : "bg-white dark:bg-neutral-850 border-neutral-300 dark:border-neutral-700"
                        }`}
                      >
                        {isChecked && <Check className="size-3 text-white" strokeWidth={3} />}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <Icon className={`size-3.5 shrink-0 ${isChecked ? "text-[#f97316]" : "text-neutral-400"}`} />
                          <span className={`text-[11px] font-semibold truncate ${isChecked ? "text-neutral-900 dark:text-white" : "text-neutral-700 dark:text-neutral-300"}`}>
                            {TAB_LABELS[tab] || tab}
                          </span>
                        </div>
                        <p className="text-[9.5px] text-neutral-400 dark:text-neutral-500 line-clamp-1 mt-0.5 leading-snug">
                          {TAB_DESCRIPTIONS[tab] || ""}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function MemberPermissionEditor({
  role, permissions, grantableTabs, onSave, onCancel,
}: {
  role: string;
  permissions: ChattyTeamTab[];
  grantableTabs: readonly ChattyTeamTab[];
  onSave: (role: string, permissions: ChattyTeamTab[]) => void;
  onCancel: () => void;
}) {
  const [draftRole, setDraftRole] = useState<ChattyTeamRole>(
    (role as ChattyTeamRole) in ROLE_DEFAULT_TABS ? (role as ChattyTeamRole) : "agent"
  );
  const [draftTabs, setDraftTabs] = useState<ChattyTeamTab[]>(permissions);

  const handleRoleChange = (newRole: ChattyTeamRole) => {
    setDraftRole(newRole);
    const defaults = ROLE_DEFAULT_TABS[newRole] || [];
    setDraftTabs([...defaults.filter((t) => grantableTabs.includes(t)) as ChattyTeamTab[]]);
  };

  const roleOptions: ModernSelectOption[] = [
    { value: "admin", label: "Admin", hint: "Full operational access across all bot tabs (except billing)" },
    { value: "agent", label: "Agent", hint: "Support agent: live chats, simulator, meetings, leads & mailbox" },
    { value: "editor", label: "Editor", hint: "Content editor: knowledge training, customizer styling & flows" },
    { value: "billing_manager", label: "Billing Manager", hint: "Finance: plan subscriptions, quotas & invoices" },
    { value: "viewer", label: "Viewer", hint: "Read-only observer: customer sentiment, reports & audit log" },
  ];

  return (
    <div className="space-y-4 pt-3 pb-2 border-t border-neutral-100 dark:border-neutral-800">
      <div>
        <label className="block text-[11px] font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
          Role &amp; Access Tier
        </label>
        <div className="w-64">
          <ModernSelect
            value={draftRole}
            options={roleOptions}
            onChange={(v) => handleRoleChange(v as ChattyTeamRole)}
          />
        </div>
        <p className="text-[10px] text-neutral-400 dark:text-neutral-500 mt-1">
          {ROLE_INFO[draftRole]?.description || "Configure role and permissions."}
        </p>
      </div>

      <AccessibleTabsGrid
        selectedTabs={draftTabs}
        onChange={setDraftTabs}
        grantableTabs={grantableTabs}
        role={draftRole}
      />

      <div className="flex items-center gap-2 pt-2 border-t border-neutral-100 dark:border-neutral-800">
        <button
          onClick={() => onSave(draftRole, draftTabs)}
          className="px-3.5 py-1.5 text-xs font-semibold rounded-lg bg-[#f97316] text-white hover:opacity-90 transition-opacity cursor-pointer shadow-xs"
        >
          Save Permissions
        </button>
        <button
          onClick={onCancel}
          className="px-3.5 py-1.5 text-xs font-medium rounded-lg text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200 transition-colors cursor-pointer"
        >
          Cancel
        </button>
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
          <div key={value} className="grid grid-cols-[2.75rem_minmax(0,1fr)] items-center gap-2 sm:flex sm:gap-2.5">
            <div className="w-11 sm:w-16 shrink-0">
              <TeamTabCheckbox checked={on} onChange={(checked) => toggleDay(value, checked)} label={label} />
            </div>
            {on && rule && (
              <>
                <TimePicker minutes={rule.start_minute} onChange={(m) => updateDay(value, "start_minute", m)} />
                <span className="col-start-2 text-[10px] text-neutral-400">to</span>
                <div className="col-start-2 sm:contents">
                  <TimePicker minutes={rule.end_minute} onChange={(m) => updateDay(value, "end_minute", m)} />
                </div>
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

export function MemberOooEditor({
  member,
  botId,
  allMembers,
  showToast,
  fetchWithFallback,
  onSaved,
}: {
  member: {
    id: string;
    email: string;
    name?: string;
    ooo_active?: boolean;
    ooo_start?: string | null;
    ooo_end?: string | null;
    ooo_backup_email?: string | null;
    ooo_reason?: string | null;
  };
  botId: string;
  allMembers: { id: string; email: string; name?: string; ooo_active?: boolean }[];
  showToast: (msg: string, kind: "success" | "error" | "info") => void;
  fetchWithFallback: (path: string, options?: RequestInit) => Promise<Response>;
  onSaved: () => void;
}) {
  const [isAway, setIsAway] = useState(!!member.ooo_active || !!member.ooo_start);
  const [startDate, setStartDate] = useState(() => {
    if (member.ooo_start) {
      try {
        return new Date(member.ooo_start).toISOString().slice(0, 10);
      } catch {
        /* ignore */
      }
    }
    return new Date().toISOString().slice(0, 10);
  });
  const [endDate, setEndDate] = useState(() => {
    if (member.ooo_end) {
      try {
        return new Date(member.ooo_end).toISOString().slice(0, 10);
      } catch {
        /* ignore */
      }
    }
    return "";
  });
  const [backupEmail, setBackupEmail] = useState(member.ooo_backup_email || "");
  const [reason, setReason] = useState(member.ooo_reason || "");
  const [saving, setSaving] = useState(false);

  const backupOptions: ModernSelectOption[] = [
    { value: "", label: "No backup (skip in round-robin meetings)" },
    ...allMembers
      .filter((m) => m.email.toLowerCase() !== member.email.toLowerCase() && !m.ooo_active)
      .map((m) => ({
        value: m.email,
        label: m.name ? `${m.name} (${m.email})` : m.email,
      })),
  ];

  async function handleSave() {
    setSaving(true);
    try {
      const payload = isAway
        ? {
            bot_id: botId,
            clear: false,
            ooo_start: startDate ? new Date(startDate).toISOString() : new Date().toISOString(),
            ooo_end: endDate ? new Date(endDate).toISOString() : null,
            ooo_backup_email: backupEmail.trim() || null,
            ooo_reason: reason.trim() || null,
          }
        : {
            bot_id: botId,
            clear: true,
          };

      const res = await fetchWithFallback(`/api/team/${member.id}/ooo`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        showToast(data.detail || "Couldn't update out-of-office status.", "error");
      } else {
        showToast(isAway ? "Out-of-office window set." : "Out-of-office cleared.", "success");
        onSaved();
      }
    } catch {
      showToast("Network error updating out-of-office.", "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-3 pt-2 pb-1 border-t border-neutral-200/70 dark:border-neutral-800/80">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] font-medium text-neutral-700 dark:text-neutral-300">
          Out-of-Office & Vacation Delegation
        </p>
        <span className="text-[10px] text-neutral-400">
          Auto-skips round-robin & routes to backup
        </span>
      </div>

      <div className="flex items-center gap-2">
        <TeamTabCheckbox
          checked={isAway}
          onChange={(checked) => setIsAway(checked)}
          label="Mark as Out of Office / Away"
        />
      </div>

      {isAway && (
        <div className="space-y-2.5 p-2.5 rounded-lg bg-white/70 dark:bg-neutral-900/60 border border-neutral-200/80 dark:border-neutral-800">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <div>
              <label className="block text-[10px] font-semibold text-neutral-600 dark:text-neutral-400 mb-1">
                Start Date
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-lg px-2.5 py-1.5 text-xs text-neutral-800 dark:text-neutral-200 focus:outline-none focus:border-[#f97316]/50"
              />
            </div>
            <div>
              <label className="block text-[10px] font-semibold text-neutral-600 dark:text-neutral-400 mb-1">
                End Date (Optional)
              </label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                placeholder="Until cleared"
                className="w-full bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-lg px-2.5 py-1.5 text-xs text-neutral-800 dark:text-neutral-200 focus:outline-none focus:border-[#f97316]/50"
              />
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-semibold text-neutral-600 dark:text-neutral-400 mb-1">
              Backup Colleague (Optional)
            </label>
            <ModernSelect
              size="sm"
              value={backupEmail}
              options={backupOptions}
              onChange={(val) => setBackupEmail(val)}
              placeholder="Select a teammate to cover..."
            />
            <p className="text-[10px] text-neutral-400 mt-1">
              Colleague will cover booked appointments and customer inquiries during this period.
            </p>
          </div>

          <div>
            <label className="block text-[10px] font-semibold text-neutral-600 dark:text-neutral-400 mb-1">
              Reason / Status Note (Optional)
            </label>
            <input
              type="text"
              value={reason}
              maxLength={120}
              placeholder="e.g., Annual leave, Conference, Parental leave"
              onChange={(e) => setReason(e.target.value)}
              className="w-full bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-lg px-2.5 py-1.5 text-xs text-neutral-800 dark:text-neutral-200 focus:outline-none focus:border-[#f97316]/50"
            />
          </div>
        </div>
      )}

      <div className="flex items-center gap-2 pt-0.5">
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-[#f97316] text-white hover:opacity-90 disabled:opacity-40 transition-opacity cursor-pointer shadow-sm"
        >
          {saving ? "Saving…" : isAway ? "Save Out-of-Office" : "Clear Out-of-Office"}
        </button>
      </div>
    </div>
  );
}
