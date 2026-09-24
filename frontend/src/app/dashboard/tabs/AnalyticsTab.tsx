"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  MessageCircle,
  Users,
  TrendingUp,
  TrendingDown,
  CheckCircle2,
  Star,
  Clock,
  Zap,
  DollarSign,
  Calendar,
  Download,
  RefreshCw,
  AlertTriangle,
  BarChart2,
  Minus,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  HardDrive,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AnalyticsOverview {
  period: { from: string; to: string };
  kpis: {
    total_sessions: KpiValue;
    total_messages: KpiValue;
    deflection_rate: KpiValue;
    lead_conversion: KpiValue;
    avg_resolution_min: KpiValue;
    csat_avg: KpiValue;
    total_meetings: KpiValue;
    ai_cost_usd: KpiValue;
    ai_cost_priced_calls: KpiValue;
    ai_cost_unpriced_calls: KpiValue;
    ai_tokens: KpiValue;
    sla_breach_rate: KpiValue;
    total_csat_responses: KpiValue;
  };
}
interface KpiValue { value: number | null; delta: number | null }

export interface VolumePoint { date: string; sessions: number; messages: number }
export interface ChannelRow { channel: string; sessions: number; pct: number }
export interface HeatmapCell { day: string; hour: number; count: number; intensity: number }
export interface AgentRow {
  email: string; name: string; assigned: number; resolved: number;
  resolution_rate: number; avg_first_reply_min: number | null;
  csat_avg: number | null; sla_compliance_pct: number | null;
}
export interface SlaPoint { date: string; on_track: number; met: number; breached: number }
export interface AiCostData {
  total_cost_usd: number; total_tokens: number;
  cost_status: { complete: boolean; priced_calls: number; unpriced_calls: number };
  by_model: { model: string; calls: number; successful_calls: number; failed_calls: number; total_tokens: number; cost_usd: number; priced_calls: number; unpriced_calls: number; avg_latency_ms: number | null }[];
  daily_series: { date: string; cost_usd: number }[];
}
export interface CsatData {
  overall_avg: number | null; total_responses: number;
  distribution: { stars: number; count: number }[];
  daily_series: { date: string; avg: number | null; count: number }[];
}

// ---------------------------------------------------------------------------
// Date-range presets
// ---------------------------------------------------------------------------

const PRESETS = [
  { label: "7d", days: 7 },
  { label: "14d", days: 14 },
  { label: "30d", days: 30 },
  { label: "90d", days: 90 },
];

function toIso(d: Date) {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
export interface VoiceAnalytics {
  calls: number;
  duration_seconds: { avg: number | null; p95: number | null };
  first_response_latency_ms: { avg: number | null; p95: number | null };
  peak_rss_mb: { avg: number | null; p95: number | null };
  avg_cpu_percent: { avg: number | null; p95: number | null };
  turns: number; nudges: number; errors: number; cost_usd: number;
  cost_status: { complete: boolean; priced_calls: number; unpriced_calls: number };
  by_mode: { mode: string; calls: number; cost_usd: number }[];
}
function addDays(d: Date, n: number) { const r = new Date(d); r.setDate(r.getDate() + n); return r; }
function fmtDate(iso: string) {
  try {
    const [year, month, day] = iso.split("-").map(Number);
    const date = year && month && day ? new Date(year, month - 1, day) : new Date(iso);
    return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  } catch { return iso; }
}

function parseLocalDate(iso: string) {
  const [year, month, day] = iso.split("-").map(Number);
  return new Date(year, (month || 1) - 1, day || 1);
}

function DateRangePicker({
  fromDate,
  toDate,
  onChange,
  onApply,
}: {
  fromDate: string;
  toDate: string;
  onChange: (from: string, to: string) => void;
  onApply: () => void;
}) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const [month, setMonth] = useState(() => {
    const d = parseLocalDate(fromDate);
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const [draftFrom, setDraftFrom] = useState(fromDate);
  const [draftTo, setDraftTo] = useState(toDate);

  useEffect(() => {
    setDraftFrom(fromDate);
    setDraftTo(toDate);
  }, [fromDate, toDate]);

  const monthStart = new Date(month.getFullYear(), month.getMonth(), 1);
  const gridStart = new Date(monthStart);
  gridStart.setDate(1 - monthStart.getDay());
  const days = Array.from({ length: 42 }, (_, index) => {
    const d = new Date(gridStart);
    d.setDate(gridStart.getDate() + index);
    return d;
  });
  const monthLabel = month.toLocaleDateString(undefined, { month: "long", year: "numeric" });
  const dateKey = (d: Date) => toIso(d);
  const isFuture = (d: Date) => d > today;
  const choose = (d: Date) => {
    if (isFuture(d)) return;
    const key = dateKey(d);
    if (!draftFrom || (draftFrom && draftTo)) {
      setDraftFrom(key);
      setDraftTo("");
      return;
    }
    const [from, to] = key < draftFrom ? [key, draftFrom] : [draftFrom, key];
    setDraftFrom(from);
    setDraftTo(to);
    onChange(from, to);
  };

  return (
    <div className="relative z-20">
      <div className="flex items-center gap-2 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl px-3 py-1.5 shadow-sm">
        <Calendar className="size-3.5 text-[#f97316]" />
        <span className="text-[11px] font-medium text-neutral-700 dark:text-neutral-200 tabular-nums">{fmtDate(draftFrom)} – {draftTo ? fmtDate(draftTo) : "Select end"}</span>
      </div>
      <div className="absolute right-0 top-10 w-[292px] rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-3 shadow-xl">
        <div className="flex items-center justify-between mb-3">
          <button type="button" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))} className="p-1.5 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800" aria-label="Previous month"><ChevronLeft className="size-4" /></button>
          <span className="text-xs font-semibold text-neutral-800 dark:text-neutral-100">{monthLabel}</span>
          <button type="button" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))} className="p-1.5 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800" aria-label="Next month"><ChevronRight className="size-4" /></button>
        </div>
        <div className="grid grid-cols-7 mb-1">
          {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map(day => <span key={day} className="text-center text-[9px] font-semibold text-neutral-400">{day}</span>)}
        </div>
        <div className="grid grid-cols-7 gap-y-1">
          {days.map(d => {
            const key = dateKey(d);
            const inMonth = d.getMonth() === month.getMonth();
            const selected = key === draftFrom || key === draftTo;
            const inRange = Boolean(draftFrom && draftTo && key > draftFrom && key < draftTo);
            return (
              <button key={key} type="button" disabled={isFuture(d)} onClick={() => choose(d)} className={`h-8 text-[11px] rounded-lg transition-colors ${!inMonth ? "text-neutral-300 dark:text-neutral-700" : "text-neutral-700 dark:text-neutral-200"} ${selected ? "bg-[#f97316] text-white font-semibold" : inRange ? "bg-orange-50 dark:bg-orange-950/30 text-[#ea580c]" : "hover:bg-neutral-100 dark:hover:bg-neutral-800"} ${isFuture(d) ? "opacity-30 cursor-not-allowed" : ""}`}>
                {d.getDate()}
              </button>
            );
          })}
        </div>
        <div className="flex items-center justify-between border-t border-neutral-100 dark:border-neutral-800 mt-3 pt-3">
          <span className="text-[10px] text-neutral-400">{draftTo ? `${fmtDate(draftFrom)} – ${fmtDate(draftTo)}` : "Choose an end date"}</span>
          <button type="button" disabled={!draftFrom || !draftTo} onClick={onApply} className="px-3 py-1.5 rounded-lg bg-[#f97316] text-white text-[10px] font-semibold disabled:opacity-40">Apply</button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Pure-SVG chart primitives
// ---------------------------------------------------------------------------

/** Shared SVG viewport width/height constants */
const SVG_H = 140;
const SVG_W = 600; // viewBox units — scales freely

function LinePath({ data, valueKey, color, strokeWidth = 2 }: {
  data: Record<string, unknown>[];
  valueKey: string;
  color: string;
  strokeWidth?: number;
}) {
  if (!data.length) return null;
  const vals = data.map(d => Number(d[valueKey] ?? 0));
  const maxV = Math.max(...vals, 0.001);
  const points = vals.map((v, i) => {
    const x = (i / (vals.length - 1 || 1)) * SVG_W;
    const y = SVG_H - (v / maxV) * (SVG_H - 12) - 4;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  return (
    <polyline
      fill="none"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinejoin="round"
      strokeLinecap="round"
      points={points.join(" ")}
    />
  );
}

function AreaPath({ data, valueKey, color }: {
  data: Record<string, unknown>[];
  valueKey: string;
  color: string;
}) {
  if (data.length < 2) return null;
  const vals = data.map(d => Number(d[valueKey] ?? 0));
  const maxV = Math.max(...vals, 0.001);
  const pts = vals.map((v, i) => {
    const x = (i / (vals.length - 1)) * SVG_W;
    const y = SVG_H - (v / maxV) * (SVG_H - 12) - 4;
    return { x, y };
  });
  const path = [
    `M ${pts[0].x.toFixed(1)} ${SVG_H}`,
    ...pts.map(p => `L ${p.x.toFixed(1)} ${p.y.toFixed(1)}`),
    `L ${pts[pts.length - 1].x.toFixed(1)} ${SVG_H}`,
    "Z",
  ].join(" ");
  return <path d={path} fill={color} opacity={0.12} />;
}

/** Dual-line chart for sessions + messages */
function VolumeChart({ data }: { data: VolumePoint[] }) {
  const [tooltip, setTooltip] = useState<{ x: number; y: number; point: VolumePoint } | null>(null);
  if (!data.length) return <EmptyChart label="No volume data" />;

  const maxSess = Math.max(...data.map(d => d.sessions), 1);
  const maxMsg = Math.max(...data.map(d => d.messages), 1);

  const sessY = (v: number) => SVG_H - (v / maxSess) * (SVG_H - 12) - 4;
  const msgY = (v: number) => SVG_H - (v / maxMsg) * (SVG_H - 12) - 4;

  const sessPts = data.map((d, i) => `${((i / (data.length - 1 || 1)) * SVG_W).toFixed(1)},${sessY(d.sessions).toFixed(1)}`);
  const msgPts = data.map((d, i) => `${((i / (data.length - 1 || 1)) * SVG_W).toFixed(1)},${msgY(d.messages).toFixed(1)}`);

  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const xRatio = (e.clientX - rect.left) / rect.width;
    const idx = Math.min(Math.round(xRatio * (data.length - 1)), data.length - 1);
    const x = (idx / (data.length - 1 || 1)) * rect.width + rect.left - rect.left;
    setTooltip({ x: e.clientX - rect.left, y: e.clientY - rect.top, point: data[idx] });
  };

  return (
    <div className="relative">
      <svg
        viewBox={`0 0 ${SVG_W} ${SVG_H}`}
        className="w-full h-36 overflow-visible"
        onMouseMove={handleMouseMove}
        onMouseLeave={() => setTooltip(null)}
      >
        {/* sessions area + line */}
        <path
          d={[`M 0 ${SVG_H}`, ...data.map((d, i) => `L ${((i / (data.length - 1 || 1)) * SVG_W).toFixed(1)} ${sessY(d.sessions).toFixed(1)}`), `L ${SVG_W} ${SVG_H} Z`].join(" ")}
          fill="#f97316" opacity={0.1}
        />
        <polyline fill="none" stroke="#f97316" strokeWidth={2} strokeLinejoin="round" points={sessPts.join(" ")} />
        {/* messages area + line */}
        <path
          d={[`M 0 ${SVG_H}`, ...data.map((d, i) => `L ${((i / (data.length - 1 || 1)) * SVG_W).toFixed(1)} ${msgY(d.messages).toFixed(1)}`), `L ${SVG_W} ${SVG_H} Z`].join(" ")}
          fill="#6366f1" opacity={0.1}
        />
        <polyline fill="none" stroke="#6366f1" strokeWidth={2} strokeLinejoin="round" points={msgPts.join(" ")} />

        {/* Tooltip vertical line */}
        {tooltip && (
          <line
            x1={((data.indexOf(tooltip.point) / (data.length - 1 || 1)) * SVG_W).toFixed(1)}
            y1={0}
            x2={((data.indexOf(tooltip.point) / (data.length - 1 || 1)) * SVG_W).toFixed(1)}
            y2={SVG_H}
            stroke="#94a3b8" strokeWidth={1} strokeDasharray="3,3"
          />
        )}
      </svg>

      {/* X-axis labels */}
      <div className="flex justify-between px-0.5 mt-1">
        {[0, Math.floor(data.length / 2), data.length - 1].map(i => (
          <span key={i} className="text-[9px] text-neutral-400">{fmtDate(data[i]?.date)}</span>
        ))}
      </div>

      {/* Tooltip card */}
      {tooltip && (
        <div
          className="absolute top-0 z-10 pointer-events-none bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl px-3 py-2 text-xs shadow-lg"
          style={{ left: Math.min(tooltip.x + 12, 240), transform: "translateY(-50%)", top: 60 }}
        >
          <p className="font-semibold text-neutral-700 dark:text-neutral-200 mb-1">{fmtDate(tooltip.point.date)}</p>
          <p className="text-[#f97316]">🟠 {tooltip.point.sessions} sessions</p>
          <p className="text-indigo-500">🟣 {tooltip.point.messages} messages</p>
        </div>
      )}

      {/* Legend */}
      <div className="flex gap-4 mt-2">
        <span className="flex items-center gap-1 text-[10px] text-neutral-500"><span className="inline-block w-3 h-0.5 bg-[#f97316] rounded" />Sessions</span>
        <span className="flex items-center gap-1 text-[10px] text-neutral-500"><span className="inline-block w-3 h-0.5 bg-indigo-500 rounded" />Messages</span>
      </div>
    </div>
  );
}

/** 7×24 heatmap grid */
function HeatmapGrid({ data }: { data: HeatmapCell[] }) {
  if (!data.length) return <EmptyChart label="No traffic data" />;
  const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const cellsByDayHour: Record<string, HeatmapCell> = {};
  for (const c of data) cellsByDayHour[`${c.day}-${c.hour}`] = c;

  return (
    <div className="overflow-x-auto">
      <div className="min-w-[500px]">
        {/* Hour labels top */}
        <div className="flex ml-8 mb-1">
          {Array.from({ length: 24 }, (_, h) => (
            <div key={h} className="flex-1 text-center text-[8px] text-neutral-400">
              {h % 6 === 0 ? `${h}h` : ""}
            </div>
          ))}
        </div>
        {days.map(day => (
          <div key={day} className="flex items-center gap-1 mb-0.5">
            <span className="w-7 text-[9px] text-neutral-400 shrink-0 text-right pr-1">{day}</span>
            {Array.from({ length: 24 }, (_, h) => {
              const cell = cellsByDayHour[`${day}-${h}`];
              const intensity = cell?.intensity ?? 0;
              return (
                <div
                  key={h}
                  title={`${day} ${h}:00 — ${cell?.count ?? 0} sessions`}
                  className="flex-1 rounded-sm h-4"
                  style={{
                    backgroundColor: intensity > 0
                      ? `rgba(249,115,22,${0.12 + intensity * 0.88})`
                      : undefined,
                  }}
                />
              );
            })}
          </div>
        ))}
        <div className="flex items-center gap-2 mt-2 ml-8">
          <span className="text-[9px] text-neutral-400">Low</span>
          {[0.1, 0.3, 0.5, 0.7, 0.9].map(v => (
            <div key={v} className="w-4 h-3 rounded-sm" style={{ backgroundColor: `rgba(249,115,22,${0.12 + v * 0.88})` }} />
          ))}
          <span className="text-[9px] text-neutral-400">High</span>
        </div>
      </div>
    </div>
  );
}

/** Stacked horizontal bar for channels */
function ChannelBars({ data }: { data: ChannelRow[] }) {
  if (!data.length) return <EmptyChart label="No channel data" />;
  const COLORS = ["#f97316", "#6366f1", "#10b981", "#f59e0b", "#ec4899", "#06b6d4"];
  const labels: Record<string, string> = { whatsapp: "WhatsApp", web: "Web", email: "Email", voice: "Voice", slack: "Slack", api: "API" };
  const maxV = Math.max(...data.map(d => d.sessions), 1);
  return (
    <div className="space-y-3">
      {data.map((row, i) => (
        <div key={row.channel}>
          <div className="flex justify-between items-center mb-1">
            <span className="text-xs font-medium text-neutral-700 dark:text-neutral-300">{labels[row.channel] ?? row.channel}</span>
            <span className="text-xs text-neutral-400">{row.sessions.toLocaleString()} ({row.pct}%)</span>
          </div>
          <div className="h-2.5 bg-neutral-100 dark:bg-neutral-800 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{ width: `${(row.sessions / maxV) * 100}%`, backgroundColor: COLORS[i % COLORS.length] }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

/** SLA stacked bar chart */
function SlaChart({ data }: { data: SlaPoint[] }) {
  if (!data.length) return <EmptyChart label="No SLA data" />;
  const chartData = data.filter(d => d.on_track + d.met + d.breached > 0);
  if (!chartData.length) return <EmptyChart label="No SLA events in period" />;

  const maxTotal = Math.max(...chartData.map(d => d.on_track + d.met + d.breached), 1);
  return (
    <div>
      <div className="flex items-end gap-0.5 h-32">
        {chartData.map(d => {
          const total = d.on_track + d.met + d.breached;
          const heightPct = (total / maxTotal) * 100;
          const metPct = total > 0 ? (d.met / total) * 100 : 0;
          const breachPct = total > 0 ? (d.breached / total) * 100 : 0;
          const ontrackPct = 100 - metPct - breachPct;
          return (
            <div
              key={d.date}
              title={`${fmtDate(d.date)}\nOn-track: ${d.on_track}  Met: ${d.met}  Breached: ${d.breached}`}
              className="flex-1 flex flex-col-reverse overflow-hidden rounded-t-sm"
              style={{ height: `${heightPct}%` }}
            >
              {d.breached > 0 && <div style={{ height: `${breachPct}%`, backgroundColor: "#ef4444" }} />}
              {d.met > 0 && <div style={{ height: `${metPct}%`, backgroundColor: "#10b981" }} />}
              {d.on_track > 0 && <div style={{ height: `${ontrackPct}%`, backgroundColor: "#6366f1" }} />}
            </div>
          );
        })}
      </div>
      <div className="flex justify-between mt-1">
        <span className="text-[9px] text-neutral-400">{fmtDate(chartData[0].date)}</span>
        <span className="text-[9px] text-neutral-400">{fmtDate(chartData[chartData.length - 1].date)}</span>
      </div>
      <div className="flex gap-4 mt-2">
        {[{ color: "#6366f1", label: "On-track" }, { color: "#10b981", label: "Met" }, { color: "#ef4444", label: "Breached" }].map(l => (
          <span key={l.label} className="flex items-center gap-1 text-[10px] text-neutral-500">
            <span className="inline-block w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: l.color }} />{l.label}
          </span>
        ))}
      </div>
    </div>
  );
}

/** CSAT rating distribution bar chart */
function CsatDistribution({ data }: { data: { stars: number; count: number }[] }) {
  const sorted = [...data].sort((a, b) => b.stars - a.stars);
  const maxCount = Math.max(...sorted.map(d => d.count), 1);
  return (
    <div className="space-y-2">
      {sorted.map(d => (
        <div key={d.stars} className="flex items-center gap-2">
          <span className="text-[10px] text-neutral-500 w-12 text-right">{d.stars} ★</span>
          <div className="flex-1 h-2 bg-neutral-100 dark:bg-neutral-800 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full bg-amber-400 transition-all"
              style={{ width: `${(d.count / maxCount) * 100}%` }}
            />
          </div>
          <span className="text-[10px] text-neutral-400 w-8 text-right">{d.count}</span>
        </div>
      ))}
    </div>
  );
}

/** CSAT trend sparkline */
function CsatTrendLine({ data }: { data: { date: string; avg: number | null }[] }) {
  const valid = data.filter(d => d.avg !== null);
  if (valid.length < 2) return null;
  const vals = valid.map(d => d.avg as number);
  const minV = Math.min(...vals);
  const maxV = Math.max(...vals, minV + 0.5);
  const range = maxV - minV || 0.5;
  const pts = vals.map((v, i) => {
    const x = (i / (vals.length - 1)) * SVG_W;
    const y = SVG_H - ((v - minV) / range) * (SVG_H - 12) - 4;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  return (
    <svg viewBox={`0 0 ${SVG_W} ${SVG_H}`} className="w-full h-20">
      <polyline fill="none" stroke="#f59e0b" strokeWidth={2} strokeLinejoin="round" points={pts.join(" ")} />
    </svg>
  );
}

/** AI cost sparkline */
function CostSparkline({ data }: { data: { date: string; cost_usd: number }[] }) {
  if (data.length < 2) return null;
  const vals = data.map(d => d.cost_usd);
  const maxV = Math.max(...vals, 0.0001);
  const pts = vals.map((v, i) => {
    const x = (i / (vals.length - 1)) * SVG_W;
    const y = SVG_H - (v / maxV) * (SVG_H - 12) - 4;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  return (
    <svg viewBox={`0 0 ${SVG_W} ${SVG_H}`} className="w-full h-16">
      <path
        d={[`M 0 ${SVG_H}`, ...data.map((d, i) => `L ${((i / (data.length - 1)) * SVG_W).toFixed(1)} ${(SVG_H - (d.cost_usd / maxV) * (SVG_H - 12) - 4).toFixed(1)}`), `L ${SVG_W} ${SVG_H} Z`].join(" ")}
        fill="#10b981" opacity={0.12}
      />
      <polyline fill="none" stroke="#10b981" strokeWidth={2} strokeLinejoin="round" points={pts.join(" ")} />
    </svg>
  );
}

function EmptyChart({ label }: { label: string }) {
  return (
    <div className="flex items-center justify-center h-20 text-[11px] text-neutral-400 dark:text-neutral-600">
      {label}
    </div>
  );
}

// ---------------------------------------------------------------------------
// KPI card
// ---------------------------------------------------------------------------

interface KpiCardProps {
  label: string;
  value: string;
  delta?: number | null;
  icon: React.ReactNode;
  suffix?: string;
  colorClass?: string;
}
function KpiCard({ label, value, delta, icon, suffix, colorClass }: KpiCardProps) {
  const deltaEl = delta !== null && delta !== undefined ? (
    <span className={`flex items-center gap-0.5 text-[9px] font-semibold ${delta >= 0 ? "text-green-500" : "text-red-400"}`}>
      {delta >= 0 ? <TrendingUp className="size-2.5" /> : <TrendingDown className="size-2.5" />}
      {Math.abs(delta)}% vs prev
    </span>
  ) : (
    <span className="flex items-center gap-0.5 text-[9px] text-neutral-400"><Minus className="size-2.5" />No prior data</span>
  );

  return (
    <div className="p-4 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl flex items-start justify-between gap-2">
      <div className="min-w-0">
        <span className="text-[9px] text-neutral-400 dark:text-neutral-500 uppercase font-semibold tracking-wide">{label}</span>
        <h4 className="text-xl font-bold mt-0.5 tabular-nums">
          {value}{suffix && <span className="text-sm font-normal text-neutral-400 ml-0.5">{suffix}</span>}
        </h4>
        <div className="mt-1">{deltaEl}</div>
      </div>
      <div className={`p-2.5 rounded-xl shrink-0 ${colorClass ?? "bg-neutral-100 dark:bg-neutral-800 text-neutral-500"}`}>
        {icon}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// CSV export
// ---------------------------------------------------------------------------

function exportCsv(overview: AnalyticsOverview | null, volume: VolumePoint[], agents: AgentRow[]) {
  const lines: string[] = [];

  if (overview) {
    lines.push("# KPI Overview");
    lines.push("Metric,Value,Delta %");
    const k = overview.kpis;
    lines.push(`Total Conversations,${k.total_sessions.value ?? ""},${k.total_sessions.delta ?? ""}`);
    lines.push(`Total Messages,${k.total_messages.value ?? ""},${k.total_messages.delta ?? ""}`);
    lines.push(`AI Deflection Rate (%),${k.deflection_rate.value ?? ""},`);
    lines.push(`Lead Conversion (%),${k.lead_conversion.value ?? ""},${k.lead_conversion.delta ?? ""}`);
    lines.push(`Avg Resolution (min),${k.avg_resolution_min.value ?? ""},`);
    lines.push(`CSAT Avg,${k.csat_avg.value ?? ""},`);
    lines.push(`Meetings Booked,${k.total_meetings.value ?? ""},`);
    lines.push(`AI Cost (USD),${k.ai_cost_usd.value ?? ""},${k.ai_cost_usd.delta ?? ""}`);
    lines.push(`SLA Breach Rate (%),${k.sla_breach_rate.value ?? ""},`);
    lines.push("");
  }

  if (volume.length) {
    lines.push("# Volume Time Series");
    lines.push("Date,Sessions,Messages");
    volume.forEach(v => lines.push(`${v.date},${v.sessions},${v.messages}`));
    lines.push("");
  }

  if (agents.length) {
    lines.push("# Agent Performance");
    lines.push("Agent,Assigned,Resolved,Resolution %,Avg First Reply (min),CSAT Avg,SLA Compliance %");
    agents.forEach(a => lines.push(
      [a.name, a.assigned, a.resolved, a.resolution_rate,
       a.avg_first_reply_min ?? "", a.csat_avg ?? "", a.sla_compliance_pct ?? ""].join(",")
    ));
  }

  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `chatty-analytics-${new Date().toISOString().split("T")[0]}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

// ---------------------------------------------------------------------------
// Section card wrapper
// ---------------------------------------------------------------------------

function Section({ title, children, action }: { title: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="p-5 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl">
      <div className="flex items-center justify-between mb-4">
        <h4 className="text-[10px] font-bold uppercase tracking-wider text-neutral-400">{title}</h4>
        {action}
      </div>
      {children}
    </div>
  );
}

function MetricTile({ label, value, detail }: { label: string; value: string; detail?: string }) {
  return (
    <div className="rounded-xl border border-neutral-200 bg-neutral-50/70 p-3 dark:border-neutral-800 dark:bg-neutral-900/60">
      <p className="text-[9px] font-bold uppercase tracking-wide text-neutral-400">{label}</p>
      <p className="mt-1 text-base font-bold tabular-nums text-neutral-800 dark:text-neutral-100">{value}</p>
      {detail && <p className="mt-0.5 text-[9px] text-neutral-400">{detail}</p>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Storage Progress Component
// ---------------------------------------------------------------------------

function StorageProgressBar({ plan, botId, backendUrl, authToken }: { plan: string; botId: string; backendUrl: string; authToken: string }) {
  const [usedBytes, setUsedBytes] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // In the future, this should fetch from an actual endpoint, e.g. /api/bots/{botId}/media-items/storage
    // For now, we mock the usage to 0 or fetch total count and multiply by an average size if we want to be clever.
    setLoading(false);
    setUsedBytes(12.4 * 1024 * 1024); // Mock 12.4 MB for visual purposes as requested
  }, [botId, backendUrl, authToken]);

  const getStorageLimit = (p: string) => {
    if (p.includes("business")) return { label: "10 GB", bytes: 10 * 1024 * 1024 * 1024 };
    if (p.includes("standard")) return { label: "2 GB", bytes: 2 * 1024 * 1024 * 1024 };
    if (p.includes("hobby")) return { label: "500 MB", bytes: 500 * 1024 * 1024 };
    return { label: "100 MB", bytes: 100 * 1024 * 1024 };
  };

  const limit = getStorageLimit(plan);
  const pct = Math.min((usedBytes / limit.bytes) * 100, 100);

  return (
    <div className="p-4 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl flex flex-col justify-center gap-2">
      <div className="flex justify-between items-center">
         <span className="text-[9px] text-neutral-400 uppercase font-bold tracking-wide flex items-center gap-1">
           <HardDrive className="size-3" /> Storage Capacity
         </span>
         <span className="text-[9px] text-[#f97316] font-bold bg-[#f97316]/10 px-2 py-0.5 rounded-full tracking-wider uppercase">
           {plan.replace('chatty_', '')} PLAN
         </span>
      </div>
      <div className="flex justify-between items-end mt-1">
         <div>
            <h4 className="text-xl font-bold tabular-nums">
               {loading ? "..." : (usedBytes / (1024 * 1024)).toFixed(1)} <span className="text-sm font-normal text-neutral-400">MB</span>
            </h4>
            <p className="text-[10px] text-neutral-400 mt-0.5">used of {limit.label}</p>
         </div>
      </div>
      <div className="mt-1 h-2 bg-neutral-100 dark:bg-neutral-800 rounded-full overflow-hidden">
        <div 
           className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-purple-500 transition-all duration-1000" 
           style={{ width: `${pct}%` }} 
        />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main AnalyticsTab component
// ---------------------------------------------------------------------------

interface AnalyticsTabProps {
  botId: string;
  backendUrl: string;
  authToken: string;
  plan?: string;
}

export function AnalyticsTab({ botId, backendUrl, authToken, plan = "free" }: AnalyticsTabProps) {
  const now = new Date();
  const [presetDays, setPresetDays] = useState(30);
  const [fromDate, setFromDate] = useState(toIso(addDays(now, -30)));
  const [toDate, setToDate] = useState(toIso(now));
  const [showCustom, setShowCustom] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [overview, setOverview] = useState<AnalyticsOverview | null>(null);
  const [volume, setVolume] = useState<VolumePoint[]>([]);
  const [channels, setChannels] = useState<ChannelRow[]>([]);
  const [heatmap, setHeatmap] = useState<HeatmapCell[]>([]);
  const [agents, setAgents] = useState<AgentRow[]>([]);
  const [sla, setSla] = useState<SlaPoint[]>([]);
  const [aiCost, setAiCost] = useState<AiCostData | null>(null);
  const [csat, setCsat] = useState<CsatData | null>(null);
  const [voice, setVoice] = useState<VoiceAnalytics | null>(null);

  const abortRef = useRef<AbortController | null>(null);

  const fetchAll = useCallback(async (from: string, to: string) => {
    if (!botId || !authToken) return;
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    setLoading(true);
    setError(null);

    const headers = { Authorization: `Bearer ${authToken}` };
    const base = `${backendUrl}/api/admin/analytics`;
    const qs = `bot_id=${botId}&from=${from}&to=${to}`;

    try {
      const [ovRes, volRes, chRes, hmRes, agRes, slaRes, aiRes, csatRes, voiceRes] = await Promise.all([
        fetch(`${base}/overview?${qs}`, { headers, signal: ctrl.signal }),
        fetch(`${base}/volume?${qs}&granularity=${presetDays <= 14 ? "day" : "day"}`, { headers, signal: ctrl.signal }),
        fetch(`${base}/channels?${qs}`, { headers, signal: ctrl.signal }),
        fetch(`${base}/heatmap?${qs}`, { headers, signal: ctrl.signal }),
        fetch(`${base}/agents?${qs}`, { headers, signal: ctrl.signal }),
        fetch(`${base}/sla?${qs}`, { headers, signal: ctrl.signal }),
        fetch(`${base}/ai-cost?${qs}`, { headers, signal: ctrl.signal }),
        fetch(`${base}/csat?${qs}`, { headers, signal: ctrl.signal }),
        fetch(`${base}/voice?${qs}`, { headers, signal: ctrl.signal }),
      ]);

      if (!ovRes.ok) throw new Error(`Overview failed: ${ovRes.status}`);

      const [ov, vol, ch, hm, ag, sl, ai, cs, vo] = await Promise.all([
        ovRes.json(), volRes.json(), chRes.json(), hmRes.json(),
        agRes.json(), slaRes.json(), aiRes.json(), csatRes.json(), voiceRes.json(),
      ]);

      setOverview(ov);
      setVolume(vol.data ?? []);
      setChannels(ch.data ?? []);
      setHeatmap(hm.data ?? []);
      setAgents(ag.data ?? []);
      setSla(sl.data ?? []);
      setAiCost(ai);
      setCsat(cs);
      setVoice(vo);
    } catch (e: unknown) {
      if ((e as Error)?.name === "AbortError") return;
      setError("Failed to load analytics. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [botId, authToken, backendUrl, presetDays]);

  // Fetch on mount + when range changes
  useEffect(() => { fetchAll(fromDate, toDate); }, [fetchAll, fromDate, toDate]);

  const applyPreset = (days: number) => {
    setPresetDays(days);
    const t = new Date();
    const f = addDays(t, -days);
    setFromDate(toIso(f));
    setToDate(toIso(t));
    setShowCustom(false);
  };

  const k = overview?.kpis;

  const fmtMin = (v: number | null | undefined) => {
    if (v === null || v === undefined) return "—";
    if (v < 60) return `${v}m`;
    return `${Math.floor(v / 60)}h ${Math.round(v % 60)}m`;
  };

  return (
    <div className="max-w-5xl mx-auto w-full space-y-5 py-6 px-4">
      {/* ── Header & Controls ─────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-bold">Analytics</h2>
          <p className="text-[11px] text-neutral-400 mt-0.5">
            {fmtDate(fromDate)} – {fmtDate(toDate)}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* Preset buttons */}
          <div className="flex items-center gap-1 bg-neutral-100 dark:bg-neutral-800 rounded-xl p-1">
            {PRESETS.map(p => (
              <button
                key={p.label}
                type="button"
                onClick={() => applyPreset(p.days)}
                className={`px-3 py-1 rounded-lg text-[11px] font-semibold transition-all ${presetDays === p.days && !showCustom
                  ? "bg-white dark:bg-neutral-900 shadow text-[#f97316]"
                  : "text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300"
                  }`}
              >
                {p.label}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setShowCustom(v => !v)}
              className={`px-3 py-1 rounded-lg text-[11px] font-semibold flex items-center gap-1 transition-all ${showCustom
                ? "bg-white dark:bg-neutral-900 shadow text-[#f97316]"
                : "text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300"
                }`}
            >
              Custom <ChevronDown className="size-3" />
            </button>
          </div>

          {/* Custom date range */}
          {showCustom && (
            <DateRangePicker
              fromDate={fromDate}
              toDate={toDate}
              onChange={(from, to) => { setFromDate(from); setToDate(to); setPresetDays(0); }}
              onApply={() => setShowCustom(false)}
            />
          )}

          {/* Refresh */}
          <button
            type="button"
            onClick={() => fetchAll(fromDate, toDate)}
            disabled={loading}
            className="p-2 rounded-xl bg-neutral-100 dark:bg-neutral-800 text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300 disabled:opacity-50 transition-colors"
            title="Refresh"
          >
            <RefreshCw className={`size-3.5 ${loading ? "animate-spin" : ""}`} />
          </button>

          {/* CSV Export */}
          <button
            type="button"
            onClick={() => exportCsv(overview, volume, agents)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300 text-[11px] font-semibold hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-colors"
          >
            <Download className="size-3" /> Export CSV
          </button>
        </div>
      </div>

      {/* Error state */}
      {error && (
        <div className="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900 rounded-xl text-xs text-red-600 dark:text-red-400">
          <AlertTriangle className="size-4 shrink-0" />{error}
        </div>
      )}

      {/* Loading skeleton */}
      {loading && !overview && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-24 bg-neutral-100 dark:bg-neutral-800 rounded-2xl animate-pulse" />
          ))}
        </div>
      )}

      {/* ── KPI Cards ─────────────────────────────────────────────────── */}
      {k && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <KpiCard label="Conversations" value={(k.total_sessions.value ?? 0).toLocaleString()} delta={k.total_sessions.delta}
            icon={<MessageCircle className="size-4" />} colorClass="bg-orange-50 dark:bg-orange-950/30 text-[#f97316]" />
          <KpiCard label="User Messages" value={(k.total_messages.value ?? 0).toLocaleString()} delta={k.total_messages.delta}
            icon={<BarChart2 className="size-4" />} colorClass="bg-indigo-50 dark:bg-indigo-950/30 text-indigo-500" />
          <KpiCard label="AI Deflection" value={`${k.deflection_rate.value ?? 0}`} suffix="%" delta={null}
            icon={<Zap className="size-4" />} colorClass="bg-green-50 dark:bg-green-950/30 text-green-500" />
          <KpiCard label="Lead Conversion" value={`${k.lead_conversion.value ?? 0}`} suffix="%" delta={k.lead_conversion.delta}
            icon={<Users className="size-4" />} colorClass="bg-blue-50 dark:bg-blue-950/30 text-blue-500" />
          <KpiCard label="Avg Resolution" value={fmtMin(k.avg_resolution_min.value)} delta={null}
            icon={<Clock className="size-4" />} />
          <KpiCard label="CSAT Score" value={k.csat_avg.value !== null ? `${k.csat_avg.value}/5` : "—"} delta={null}
            icon={<Star className="size-4" />} colorClass="bg-amber-50 dark:bg-amber-950/30 text-amber-500" />
          <KpiCard label="Meetings Booked" value={(k.total_meetings.value ?? 0).toLocaleString()} delta={null}
            icon={<Calendar className="size-4" />} />
          <KpiCard label="SLA Breach Rate" value={`${k.sla_breach_rate.value ?? 0}`} suffix="%"
            delta={k.sla_breach_rate.value !== null && (k.sla_breach_rate.value as number) > 10 ? null : null}
            icon={<AlertTriangle className="size-4" />}
            colorClass={(k.sla_breach_rate.value ?? 0) > 10
              ? "bg-red-50 dark:bg-red-950/30 text-red-500"
              : "bg-neutral-100 dark:bg-neutral-800 text-neutral-500"} />
        </div>
      )}

      {/* Highlight Cards (AI Cost + Storage) */}
      {k && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="p-4 bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-950/20 dark:to-teal-950/20 border border-emerald-200 dark:border-emerald-900 rounded-2xl flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600"><DollarSign className="size-4" /></div>
              <div>
                <span className="text-[9px] text-emerald-600 dark:text-emerald-400 uppercase font-bold tracking-wide">AI Spend</span>
                <p className="text-xl font-bold tabular-nums">{(k.ai_cost_unpriced_calls?.value ?? 0) > 0 ? "~" : ""}${(k.ai_cost_usd.value ?? 0).toFixed(4)}</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-[10px] text-neutral-500">{(k.ai_tokens.value ?? 0).toLocaleString()} tokens</p>
              {(k.ai_cost_unpriced_calls?.value ?? 0) > 0 && <p className="text-[10px] text-amber-600 dark:text-amber-400">{k.ai_cost_unpriced_calls?.value} calls not priced</p>}
              {k.ai_cost_usd.delta !== null && (
                <span className={`text-[10px] font-semibold ${(k.ai_cost_usd.delta ?? 0) >= 0 ? "text-red-400" : "text-green-500"}`}>
                  {(k.ai_cost_usd.delta ?? 0) >= 0 ? "↑" : "↓"} {Math.abs(k.ai_cost_usd.delta ?? 0)}% vs prev period
                </span>
              )}
            </div>
          </div>
          
          <StorageProgressBar plan={plan} botId={botId} backendUrl={backendUrl} authToken={authToken} />
        </div>
      )}

      {/* ── Voice worker health ───────────────────────────────────────── */}
      <Section title="Voice agent health" action={<span className="text-[9px] text-neutral-400">worker telemetry · p95 where available</span>}>
        {!voice || voice.calls === 0 ? (
          <p className="py-5 text-center text-[11px] text-neutral-400">No voice calls in this period.</p>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <MetricTile label="Calls" value={voice.calls.toLocaleString()} />
            <MetricTile label="First response" value={voice.first_response_latency_ms.avg !== null ? `${Math.round(voice.first_response_latency_ms.avg)}ms` : "—"} detail={voice.first_response_latency_ms.p95 !== null ? `p95 ${Math.round(voice.first_response_latency_ms.p95)}ms` : undefined} />
            <MetricTile label="Peak memory" value={voice.peak_rss_mb.avg !== null ? `${voice.peak_rss_mb.avg.toFixed(1)} MB` : "—"} detail={voice.peak_rss_mb.p95 !== null ? `p95 ${voice.peak_rss_mb.p95.toFixed(1)} MB` : undefined} />
            <MetricTile label="CPU" value={voice.avg_cpu_percent.avg !== null ? `${voice.avg_cpu_percent.avg.toFixed(1)}%` : "—"} detail={voice.avg_cpu_percent.p95 !== null ? `p95 ${voice.avg_cpu_percent.p95.toFixed(1)}%` : undefined} />
            <MetricTile label="Turns" value={voice.turns.toLocaleString()} />
            <MetricTile label="Re-engagements" value={voice.nudges.toLocaleString()} />
            <MetricTile label="Errors" value={voice.errors.toLocaleString()} />
            <MetricTile label="Voice cost" value={`$${voice.cost_usd.toFixed(4)}`} detail={voice.cost_status.unpriced_calls ? `${voice.cost_status.unpriced_calls} unpriced` : undefined} />
          </div>
        )}
      </Section>

      {/* ── Volume Chart ───────────────────────────────────────────────── */}
      <Section title="Conversation Volume">
        {loading && !volume.length
          ? <div className="h-36 bg-neutral-100 dark:bg-neutral-800 rounded-xl animate-pulse" />
          : <VolumeChart data={volume} />}
      </Section>

      {/* ── Channel + Heatmap row ─────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <Section title="Channel Breakdown">
          {loading && !channels.length
            ? <div className="h-32 bg-neutral-100 dark:bg-neutral-800 rounded-xl animate-pulse" />
            : <ChannelBars data={channels} />}
        </Section>

        <Section title="Traffic Heatmap" action={<span className="text-[9px] text-neutral-400">Hour of day × weekday</span>}>
          {loading && !heatmap.length
            ? <div className="h-32 bg-neutral-100 dark:bg-neutral-800 rounded-xl animate-pulse" />
            : <HeatmapGrid data={heatmap} />}
        </Section>
      </div>

      {/* ── SLA Report ─────────────────────────────────────────────────── */}
      <Section title="SLA Compliance">
        {loading && !sla.length
          ? <div className="h-32 bg-neutral-100 dark:bg-neutral-800 rounded-xl animate-pulse" />
          : <SlaChart data={sla} />}
      </Section>

      {/* ── Agent Performance ──────────────────────────────────────────── */}
      <Section title="Agent Performance">
        {loading && !agents.length ? (
          <div className="h-24 bg-neutral-100 dark:bg-neutral-800 rounded-xl animate-pulse" />
        ) : agents.length === 0 ? (
          <p className="text-[11px] text-neutral-400 py-4 text-center">No agent-assigned tickets in this period.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs min-w-[560px]">
              <thead>
                <tr className="text-[10px] text-neutral-400 uppercase">
                  <th className="text-left py-2 pr-3 font-semibold">Agent</th>
                  <th className="text-right py-2 px-2 font-semibold">Assigned</th>
                  <th className="text-right py-2 px-2 font-semibold">Resolved</th>
                  <th className="text-right py-2 px-2 font-semibold">Res. %</th>
                  <th className="text-right py-2 px-2 font-semibold">First Reply</th>
                  <th className="text-right py-2 px-2 font-semibold">CSAT</th>
                  <th className="text-right py-2 pl-2 font-semibold">SLA %</th>
                </tr>
              </thead>
              <tbody>
                {agents.map(a => (
                  <tr key={a.email} className="border-t border-neutral-100 dark:border-neutral-800 hover:bg-neutral-50 dark:hover:bg-neutral-950/50 transition-colors">
                    <td className="py-2.5 pr-3">
                      <p className="font-semibold text-neutral-800 dark:text-neutral-100">{a.name}</p>
                      <p className="text-[10px] text-neutral-400">{a.email}</p>
                    </td>
                    <td className="text-right px-2 tabular-nums font-mono">{a.assigned}</td>
                    <td className="text-right px-2 tabular-nums font-mono">{a.resolved}</td>
                    <td className="text-right px-2">
                      <span className={`font-semibold ${a.resolution_rate >= 80 ? "text-green-500" : a.resolution_rate >= 50 ? "text-amber-500" : "text-red-400"}`}>
                        {a.resolution_rate}%
                      </span>
                    </td>
                    <td className="text-right px-2 text-neutral-500">{fmtMin(a.avg_first_reply_min)}</td>
                    <td className="text-right px-2">
                      {a.csat_avg !== null
                        ? <span className="flex items-center justify-end gap-0.5"><Star className="size-3 fill-amber-400 text-amber-400" />{a.csat_avg}</span>
                        : <span className="text-neutral-400">—</span>}
                    </td>
                    <td className="text-right pl-2">
                      {a.sla_compliance_pct !== null
                        ? <span className={`font-semibold ${a.sla_compliance_pct >= 90 ? "text-green-500" : a.sla_compliance_pct >= 70 ? "text-amber-500" : "text-red-400"}`}>
                          {a.sla_compliance_pct}%
                        </span>
                        : <span className="text-neutral-400">—</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      {/* ── CSAT Trend + Distribution ──────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <Section title="CSAT Trend">
          {csat ? (
            <>
              <div className="flex items-baseline gap-2 mb-3">
                <span className="text-2xl font-bold">{csat.overall_avg !== null ? csat.overall_avg : "—"}</span>
                <span className="text-xs text-neutral-400">/ 5.0 · {csat.total_responses} responses</span>
              </div>
              <CsatTrendLine data={csat.daily_series} />
            </>
          ) : <EmptyChart label="No CSAT data" />}
        </Section>

        <Section title="Rating Distribution">
          {csat ? <CsatDistribution data={csat.distribution} /> : <EmptyChart label="No CSAT data" />}
        </Section>
      </div>

      {/* ── AI Cost ────────────────────────────────────────────────────── */}
      <Section title="AI Cost Breakdown">
        {aiCost ? (
          <>
            {aiCost.cost_status?.unpriced_calls > 0 && (
              <div className="flex items-start gap-2 mb-4 p-3 rounded-xl border border-amber-200 bg-amber-50 dark:border-amber-900/50 dark:bg-amber-950/20 text-[11px] text-amber-700 dark:text-amber-300">
                <AlertTriangle className="size-4 shrink-0 mt-0.5" />
                <span>Estimated spend includes only {aiCost.cost_status.priced_calls.toLocaleString()} priced calls. {aiCost.cost_status.unpriced_calls.toLocaleString()} successful call{aiCost.cost_status.unpriced_calls === 1 ? " is" : "s are"} missing provider pricing and are excluded from the dollar total.</span>
              </div>
            )}
            <div className="mb-4">
              <CostSparkline data={aiCost.daily_series} />
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs min-w-[500px]">
                <thead>
                  <tr className="text-[10px] text-neutral-400 uppercase">
                    <th className="text-left py-2 pr-3 font-semibold">Model</th>
                    <th className="text-right py-2 px-2 font-semibold">Calls</th>
                    <th className="text-right py-2 px-2 font-semibold">Tokens</th>
                    <th className="text-right py-2 px-2 font-semibold">Avg Latency</th>
                    <th className="text-right py-2 pl-2 font-semibold">Cost (USD)</th>
                  </tr>
                </thead>
                <tbody>
                  {aiCost.by_model.map(m => (
                    <tr key={m.model} className="border-t border-neutral-100 dark:border-neutral-800">
                      <td className="py-2.5 pr-3 font-mono text-neutral-700 dark:text-neutral-300">{m.model}</td>
                      <td className="text-right px-2 tabular-nums">{m.successful_calls.toLocaleString()}
                        {m.failed_calls > 0 && <span className="text-red-400 ml-1">({m.failed_calls} failed)</span>}
                      </td>
                      <td className="text-right px-2 tabular-nums text-neutral-500">{m.total_tokens.toLocaleString()}</td>
                      <td className="text-right px-2 text-neutral-500">{m.avg_latency_ms ? `${m.avg_latency_ms}ms` : "—"}</td>
                      <td className="text-right pl-2 font-mono font-semibold">{m.unpriced_calls > 0 ? "~" : ""}${m.cost_usd.toFixed(4)}{m.unpriced_calls > 0 && <span className="text-[9px] text-amber-600 ml-1">partial</span>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        ) : <EmptyChart label="No AI usage data" />}
      </Section>
    </div>
  );
}
