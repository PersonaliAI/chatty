"use client";

import { useState, useCallback, useEffect, useMemo, useRef, type MouseEvent } from "react";
import {
  ReactFlow,
  MiniMap,
  Background,
  useNodesState,
  useEdgesState,
  addEdge,
  Connection,
  Edge,
  Node,
  Panel,
  Handle,
  Position,
  ReactFlowInstance,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import {
  MessageSquare,
  HelpCircle,
  UserCheck,
  PhoneCall,
  Trash2,
  Save,
  Loader2,
  Sparkles,
  Check,
  AlertCircle,
  Play,
  Maximize2,
  Tag,
  Zap,
  CheckCircle2,
  ListFilter,
  Calendar,
  Clock,
  Mail,
  Plus,
  X,
  GitBranch,
  Download,
  Upload,
  Bot as BotIcon,
  Search,
  RotateCcw,
  ZoomIn,
  ZoomOut,
  Layers,
  History,
  Sliders,
  Repeat,
  ShieldAlert,
  MoreHorizontal,
  PanelLeftClose,
  PanelLeftOpen,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { createClient } from "@/lib/supabase/client";
import { BACKEND_URL, fetchBackend } from "@/lib/backend-client";
import { SELF_HOST_MODE } from "@/lib/deployment";
import { ModernSwitch } from "@/components/ui/modern-switch";
import { ModernSelect } from "@/components/ui/modern-select";
import { ModernAlert } from "@/components/ui/modern-alert";

interface Props {
  botId: string | null;
  color?: string;
  fetchBackend?: (path: string, options?: RequestInit) => Promise<Response>;
}

interface FlowNodeData {
  [key: string]: unknown;
  label?: string;
  options?: string[];
  field?: string;
  validation?: string;
  prompt?: string;
  automationKind?: string;
  config?: Record<string, unknown>;
}

interface FlowNodeProps {
  data: FlowNodeData;
  selected?: boolean;
}

type FlowTemplate = {
  name: string;
  nodes: Node<FlowNodeData>[];
  edges: Edge[];
};

type ActiveEditorTab = "editor" | "executions" | "versions" | "simulation";

// ── Custom n8n-Inspired Node Components ──

function StartNode({ data, selected }: FlowNodeProps) {
  return (
    <div
      className={`relative min-w-[260px] max-w-[320px] bg-white dark:bg-neutral-900 text-neutral-800 dark:text-white rounded-2xl shadow-md border-2 transition-all group ${
        selected
          ? "border-orange-500 ring-4 ring-orange-500/20 shadow-lg scale-102"
          : "border-slate-200 dark:border-neutral-800 hover:border-orange-300 dark:hover:border-orange-700/60"
      }`}
    >
      <div className="p-3.5 flex items-center justify-between gap-3 border-b border-slate-100 dark:border-neutral-800/80 bg-gradient-to-r from-orange-50/70 via-amber-50/40 to-transparent dark:from-orange-950/30 dark:via-amber-950/20 dark:to-transparent rounded-t-2xl">
        <div className="flex items-center gap-2.5">
          <div className="size-8 rounded-xl bg-orange-500 text-white flex items-center justify-center shadow-xs">
            <Zap className="size-4 fill-white" />
          </div>
          <div>
            <h4 className="font-bold text-xs tracking-tight text-neutral-900 dark:text-neutral-100">
              When chat message received
            </h4>
            <p className="text-[10px] text-orange-600 dark:text-orange-400 font-semibold">
              Start Trigger · Entry Point
            </p>
          </div>
        </div>
        <span className="text-[9px] font-extrabold uppercase tracking-wider bg-orange-100 text-orange-700 dark:bg-orange-950/80 dark:text-orange-300 px-2 py-0.5 rounded-full shrink-0">
          Trigger
        </span>
      </div>

      <div className="p-3.5 text-xs font-medium text-neutral-700 dark:text-neutral-200 leading-relaxed bg-neutral-50/40 dark:bg-neutral-950/30 rounded-b-2xl">
        <p className="line-clamp-2">{data.label || "🚀 Start Conversation"}</p>
      </div>

      {/* Target handle on Top/Left if re-routed, Source on Right & Bottom */}
      <Handle
        type="source"
        position={Position.Right}
        className="!bg-orange-500 !w-3.5 !h-3.5 !border-2 !border-white dark:!border-neutral-900 transition-transform hover:scale-125"
      />
      <Handle
        type="source"
        position={Position.Bottom}
        className="!bg-orange-500 !w-3.5 !h-3.5 !border-2 !border-white dark:!border-neutral-900 transition-transform hover:scale-125 opacity-70"
      />
    </div>
  );
}

function MessageNode({ data, selected }: FlowNodeProps) {
  const content = (data.label || "").replace(/^💬\s*(Message:\s*)?/, "") || "Bot message content...";

  return (
    <div
      className={`relative min-w-[260px] max-w-[320px] bg-white dark:bg-neutral-900 text-neutral-800 dark:text-white rounded-2xl shadow-md border-2 transition-all group ${
        selected
          ? "border-blue-500 ring-4 ring-blue-500/20 shadow-lg scale-102"
          : "border-slate-200 dark:border-neutral-800 hover:border-blue-300 dark:hover:border-blue-800/60"
      }`}
    >
      <Handle
        type="target"
        position={Position.Left}
        className="!bg-blue-500 !w-3.5 !h-3.5 !border-2 !border-white dark:!border-neutral-900"
      />
      <Handle
        type="target"
        position={Position.Top}
        className="!bg-blue-500 !w-3.5 !h-3.5 !border-2 !border-white dark:!border-neutral-900 opacity-60"
      />

      <div className="p-3.5 flex items-center justify-between gap-3 border-b border-slate-100 dark:border-neutral-800/80 bg-blue-50/50 dark:bg-blue-950/20 rounded-t-2xl">
        <div className="flex items-center gap-2.5">
          <div className="size-8 rounded-xl bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400 flex items-center justify-center shadow-2xs">
            <MessageSquare className="size-4" />
          </div>
          <div>
            <h4 className="font-bold text-xs tracking-tight text-neutral-900 dark:text-neutral-100">
              Bot Message
            </h4>
            <p className="text-[10px] text-blue-600 dark:text-blue-400 font-medium">
              Display to Visitor
            </p>
          </div>
        </div>
        <span className="text-[9px] font-bold uppercase tracking-wider bg-blue-100/80 text-blue-700 dark:bg-blue-950 dark:text-blue-300 px-2 py-0.5 rounded-full shrink-0">
          Message
        </span>
      </div>

      <div className="p-3.5 text-xs text-neutral-700 dark:text-neutral-200 leading-relaxed font-normal bg-neutral-50/30 dark:bg-neutral-950/20 rounded-b-2xl break-words">
        <p className="line-clamp-3">{content}</p>
      </div>

      <Handle
        type="source"
        position={Position.Right}
        className="!bg-blue-500 !w-3.5 !h-3.5 !border-2 !border-white dark:!border-neutral-900 transition-transform hover:scale-125"
      />
      <Handle
        type="source"
        position={Position.Bottom}
        className="!bg-blue-500 !w-3.5 !h-3.5 !border-2 !border-white dark:!border-neutral-900 transition-transform hover:scale-125 opacity-70"
      />
    </div>
  );
}

function QuestionNode({ data, selected }: FlowNodeProps) {
  const content = (data.label || "").replace(/^❓\s*(Ask:\s*)?/, "") || "Ask visitor a question...";

  return (
    <div
      className={`relative min-w-[260px] max-w-[320px] bg-white dark:bg-neutral-900 text-neutral-800 dark:text-white rounded-2xl shadow-md border-2 transition-all group ${
        selected
          ? "border-purple-500 ring-4 ring-purple-500/20 shadow-lg scale-102"
          : "border-slate-200 dark:border-neutral-800 hover:border-purple-300 dark:hover:border-purple-800/60"
      }`}
    >
      <Handle
        type="target"
        position={Position.Left}
        className="!bg-purple-500 !w-3.5 !h-3.5 !border-2 !border-white dark:!border-neutral-900"
      />
      <Handle
        type="target"
        position={Position.Top}
        className="!bg-purple-500 !w-3.5 !h-3.5 !border-2 !border-white dark:!border-neutral-900 opacity-60"
      />

      <div className="p-3.5 flex items-center justify-between gap-3 border-b border-slate-100 dark:border-neutral-800/80 bg-purple-50/50 dark:bg-purple-950/20 rounded-t-2xl">
        <div className="flex items-center gap-2.5">
          <div className="size-8 rounded-xl bg-purple-100 dark:bg-purple-900/50 text-purple-600 dark:text-purple-400 flex items-center justify-center shadow-2xs">
            <HelpCircle className="size-4" />
          </div>
          <div>
            <h4 className="font-bold text-xs tracking-tight text-neutral-900 dark:text-neutral-100">
              Ask Question
            </h4>
            <p className="text-[10px] text-purple-600 dark:text-purple-400 font-medium">
              Awaits Visitor Reply
            </p>
          </div>
        </div>
        <span className="text-[9px] font-bold uppercase tracking-wider bg-purple-100/80 text-purple-700 dark:bg-purple-950 dark:text-purple-300 px-2 py-0.5 rounded-full shrink-0">
          Input
        </span>
      </div>

      <div className="p-3.5 text-xs text-neutral-800 dark:text-neutral-100 leading-relaxed font-medium bg-neutral-50/30 dark:bg-neutral-950/20 rounded-b-2xl break-words">
        <p className="line-clamp-3">{content}</p>
      </div>

      <Handle
        type="source"
        position={Position.Right}
        className="!bg-purple-500 !w-3.5 !h-3.5 !border-2 !border-white dark:!border-neutral-900 transition-transform hover:scale-125"
      />
      <Handle
        type="source"
        position={Position.Bottom}
        className="!bg-purple-500 !w-3.5 !h-3.5 !border-2 !border-white dark:!border-neutral-900 transition-transform hover:scale-125 opacity-70"
      />
    </div>
  );
}

function ChoiceNode({ data, selected }: FlowNodeProps) {
  const options = (data.options && data.options.length > 0)
    ? data.options
    : ["Inbound sales", "Customer support", "Other"];
  const content = (data.label || "").replace(/^🔘\s*(Choice:\s*)?/, "") || "Select an option:";

  return (
    <div
      className={`relative min-w-[270px] max-w-[340px] bg-white dark:bg-neutral-900 text-neutral-800 dark:text-white rounded-2xl shadow-md border-2 transition-all group ${
        selected
          ? "border-violet-500 ring-4 ring-violet-500/20 shadow-lg scale-102"
          : "border-slate-200 dark:border-neutral-800 hover:border-violet-300 dark:hover:border-violet-800/60"
      }`}
    >
      <Handle
        type="target"
        position={Position.Left}
        className="!bg-violet-500 !w-3.5 !h-3.5 !border-2 !border-white dark:!border-neutral-900"
      />
      <Handle
        type="target"
        position={Position.Top}
        className="!bg-violet-500 !w-3.5 !h-3.5 !border-2 !border-white dark:!border-neutral-900 opacity-60"
      />

      <div className="p-3.5 flex items-center justify-between gap-3 border-b border-slate-100 dark:border-neutral-800/80 bg-violet-50/50 dark:bg-violet-950/20 rounded-t-2xl">
        <div className="flex items-center gap-2.5">
          <div className="size-8 rounded-xl bg-violet-100 dark:bg-violet-900/50 text-violet-600 dark:text-violet-400 flex items-center justify-center shadow-2xs">
            <ListFilter className="size-4" />
          </div>
          <div>
            <h4 className="font-bold text-xs tracking-tight text-neutral-900 dark:text-neutral-100">
              Multi-Choice Buttons
            </h4>
            <p className="text-[10px] text-violet-600 dark:text-violet-400 font-medium">
              Interactive Branching
            </p>
          </div>
        </div>
        <span className="text-[9px] font-bold uppercase tracking-wider bg-violet-100/80 text-violet-700 dark:bg-violet-950 dark:text-violet-300 px-2 py-0.5 rounded-full shrink-0">
          Choice
        </span>
      </div>

      <div className="p-3.5 space-y-2.5 bg-neutral-50/30 dark:bg-neutral-950/20 rounded-b-2xl">
        <p className="text-xs font-medium text-neutral-800 dark:text-neutral-100 leading-relaxed line-clamp-2">
          {content}
        </p>
        <div className="flex flex-wrap gap-1.5 pt-1">
          {options.map((opt, idx) => (
            <span
              key={idx}
              className="text-[10px] font-semibold px-2.5 py-1 rounded-xl bg-violet-50 hover:bg-violet-100 dark:bg-violet-950/60 dark:hover:bg-violet-900/80 text-violet-700 dark:text-violet-300 border border-violet-200/80 dark:border-violet-800/60 truncate max-w-[150px] shadow-2xs transition-colors"
            >
              {opt}
            </span>
          ))}
        </div>
      </div>

      <Handle
        type="source"
        position={Position.Right}
        className="!bg-violet-500 !w-3.5 !h-3.5 !border-2 !border-white dark:!border-neutral-900 transition-transform hover:scale-125"
      />
      <Handle
        type="source"
        position={Position.Bottom}
        className="!bg-violet-500 !w-3.5 !h-3.5 !border-2 !border-white dark:!border-neutral-900 transition-transform hover:scale-125 opacity-70"
      />
    </div>
  );
}

function LeadCaptureNode({ data, selected }: FlowNodeProps) {
  const content = (data.label || "").replace(/^👤\s*(Capture:\s*)?/, "") || "Capture visitor details...";
  const fieldLabel = (data.field || "Business Email").toUpperCase();

  return (
    <div
      className={`relative min-w-[260px] max-w-[320px] bg-white dark:bg-neutral-900 text-neutral-800 dark:text-white rounded-2xl shadow-md border-2 transition-all group ${
        selected
          ? "border-cyan-500 ring-4 ring-cyan-500/20 shadow-lg scale-102"
          : "border-slate-200 dark:border-neutral-800 hover:border-cyan-300 dark:hover:border-cyan-800/60"
      }`}
    >
      <Handle
        type="target"
        position={Position.Left}
        className="!bg-cyan-500 !w-3.5 !h-3.5 !border-2 !border-white dark:!border-neutral-900"
      />
      <Handle
        type="target"
        position={Position.Top}
        className="!bg-cyan-500 !w-3.5 !h-3.5 !border-2 !border-white dark:!border-neutral-900 opacity-60"
      />

      <div className="p-3.5 flex items-center justify-between gap-3 border-b border-slate-100 dark:border-neutral-800/80 bg-cyan-50/50 dark:bg-cyan-950/20 rounded-t-2xl">
        <div className="flex items-center gap-2.5">
          <div className="size-8 rounded-xl bg-cyan-100 dark:bg-cyan-900/50 text-cyan-600 dark:text-cyan-400 flex items-center justify-center shadow-2xs">
            <UserCheck className="size-4" />
          </div>
          <div>
            <h4 className="font-bold text-xs tracking-tight text-neutral-900 dark:text-neutral-100">
              Lead Capture
            </h4>
            <p className="text-[10px] text-cyan-600 dark:text-cyan-400 font-medium">
              Auto-Validate & CRM Sync
            </p>
          </div>
        </div>
        <span className="text-[9px] font-bold uppercase tracking-wider bg-cyan-100/80 text-cyan-700 dark:bg-cyan-950 dark:text-cyan-300 px-2 py-0.5 rounded-full shrink-0">
          Lead
        </span>
      </div>

      <div className="p-3.5 space-y-2 bg-neutral-50/30 dark:bg-neutral-950/20 rounded-b-2xl">
        <p className="text-xs font-medium text-neutral-800 dark:text-neutral-100 leading-relaxed line-clamp-2">
          {content}
        </p>
        <div className="flex items-center gap-1.5 text-[10px] text-cyan-800 dark:text-cyan-300 font-semibold bg-cyan-50/80 dark:bg-cyan-950/60 px-2.5 py-1 rounded-xl border border-cyan-200/60 dark:border-cyan-800/40 w-fit">
          <Mail className="size-3" />
          <span>Field: {fieldLabel}</span>
        </div>
      </div>

      <Handle
        type="source"
        position={Position.Right}
        className="!bg-cyan-500 !w-3.5 !h-3.5 !border-2 !border-white dark:!border-neutral-900 transition-transform hover:scale-125"
      />
      <Handle
        type="source"
        position={Position.Bottom}
        className="!bg-cyan-500 !w-3.5 !h-3.5 !border-2 !border-white dark:!border-neutral-900 transition-transform hover:scale-125 opacity-70"
      />
    </div>
  );
}

function AiQualifyNode({ data, selected }: FlowNodeProps) {
  const content = (data.label || "").replace(/^🤖\s*(AI Qualify:\s*)?/, "") || "Understand visitor intent & qualify requirements.";

  return (
    <div
      className={`relative min-w-[280px] max-w-[340px] bg-white dark:bg-neutral-900 text-neutral-800 dark:text-white rounded-2xl shadow-md border-2 transition-all group ${
        selected
          ? "border-indigo-500 ring-4 ring-indigo-500/20 shadow-lg scale-102"
          : "border-slate-200 dark:border-neutral-800 hover:border-indigo-300 dark:hover:border-indigo-800/60"
      }`}
    >
      <Handle
        type="target"
        position={Position.Left}
        className="!bg-indigo-500 !w-3.5 !h-3.5 !border-2 !border-white dark:!border-neutral-900"
      />
      <Handle
        type="target"
        position={Position.Top}
        className="!bg-indigo-500 !w-3.5 !h-3.5 !border-2 !border-white dark:!border-neutral-900 opacity-60"
      />

      <div className="p-3.5 flex items-center justify-between gap-3 border-b border-slate-100 dark:border-neutral-800/80 bg-gradient-to-r from-indigo-50/80 via-purple-50/40 to-transparent dark:from-indigo-950/40 dark:via-purple-950/20 dark:to-transparent rounded-t-2xl">
        <div className="flex items-center gap-2.5">
          <div className="size-8 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 text-white flex items-center justify-center shadow-xs">
            <BotIcon className="size-4" />
          </div>
          <div>
            <h4 className="font-bold text-xs tracking-tight text-neutral-900 dark:text-neutral-100 flex items-center gap-1">
              AI Smart Agent <Sparkles className="size-3 text-indigo-500" />
            </h4>
            <p className="text-[10px] text-indigo-600 dark:text-indigo-400 font-semibold">
              Dynamic LLM Reasoning
            </p>
          </div>
        </div>
        <span className="text-[9px] font-extrabold uppercase tracking-wider bg-indigo-100 text-indigo-700 dark:bg-indigo-950/80 dark:text-indigo-300 px-2 py-0.5 rounded-full shrink-0">
          AI Agent
        </span>
      </div>

      <div className="p-3.5 space-y-2 bg-neutral-50/30 dark:bg-neutral-950/20 rounded-b-2xl">
        <p className="text-xs font-medium text-neutral-800 dark:text-neutral-100 leading-relaxed line-clamp-2">
          {content}
        </p>
        <div className="text-[10px] text-indigo-700 dark:text-indigo-300 font-medium bg-indigo-50/70 dark:bg-indigo-950/50 p-2 rounded-xl border border-indigo-200/50 dark:border-indigo-900/50 flex items-start gap-1.5">
          <Sparkles className="size-3 text-indigo-500 shrink-0 mt-0.5" />
          <span>Resolves ambiguous replies with consultative follow-ups</span>
        </div>
      </div>

      {/* Extension ports like n8n tools & memory handles */}
      <Handle
        type="source"
        position={Position.Right}
        className="!bg-indigo-500 !w-3.5 !h-3.5 !border-2 !border-white dark:!border-neutral-900 transition-transform hover:scale-125"
      />
      <Handle
        type="source"
        position={Position.Bottom}
        className="!bg-indigo-500 !w-3.5 !h-3.5 !border-2 !border-white dark:!border-neutral-900 transition-transform hover:scale-125 opacity-70"
      />
    </div>
  );
}

function BookMeetingNode({ data, selected }: FlowNodeProps) {
  const content = (data.label || "").replace(/^📅\s*(Schedule:\s*)?/, "") || "Schedule a demo with our team:";

  return (
    <div
      className={`relative min-w-[270px] max-w-[330px] bg-white dark:bg-neutral-900 text-neutral-800 dark:text-white rounded-2xl shadow-md border-2 transition-all group ${
        selected
          ? "border-emerald-500 ring-4 ring-emerald-500/20 shadow-lg scale-102"
          : "border-slate-200 dark:border-neutral-800 hover:border-emerald-300 dark:hover:border-emerald-800/60"
      }`}
    >
      <Handle
        type="target"
        position={Position.Left}
        className="!bg-emerald-500 !w-3.5 !h-3.5 !border-2 !border-white dark:!border-neutral-900"
      />
      <Handle
        type="target"
        position={Position.Top}
        className="!bg-emerald-500 !w-3.5 !h-3.5 !border-2 !border-white dark:!border-neutral-900 opacity-60"
      />

      <div className="p-3.5 flex items-center justify-between gap-3 border-b border-slate-100 dark:border-neutral-800/80 bg-emerald-50/50 dark:bg-emerald-950/20 rounded-t-2xl">
        <div className="flex items-center gap-2.5">
          <div className="size-8 rounded-xl bg-emerald-100 dark:bg-emerald-900/50 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shadow-2xs">
            <Calendar className="size-4" />
          </div>
          <div>
            <h4 className="font-bold text-xs tracking-tight text-neutral-900 dark:text-neutral-100">
              Schedule Meeting
            </h4>
            <p className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium">
              Real-Time Calendar Slots
            </p>
          </div>
        </div>
        <span className="text-[9px] font-bold uppercase tracking-wider bg-emerald-100/80 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 px-2 py-0.5 rounded-full shrink-0">
          Calendar
        </span>
      </div>

      <div className="p-3.5 space-y-2 bg-neutral-50/30 dark:bg-neutral-950/20 rounded-b-2xl">
        <p className="text-xs font-medium text-neutral-800 dark:text-neutral-100 leading-relaxed line-clamp-2">
          {content}
        </p>
        <div className="flex items-center gap-1.5 text-[10px] text-emerald-800 dark:text-emerald-300 font-semibold bg-emerald-50/80 dark:bg-emerald-950/60 p-2 rounded-xl border border-emerald-200/60 dark:border-emerald-800/40">
          <Clock className="size-3 text-emerald-600" />
          <span>Renders interactive booking slots directly in chat</span>
        </div>
      </div>

      <Handle
        type="source"
        position={Position.Right}
        className="!bg-emerald-500 !w-3.5 !h-3.5 !border-2 !border-white dark:!border-neutral-900 transition-transform hover:scale-125"
      />
      <Handle
        type="source"
        position={Position.Bottom}
        className="!bg-emerald-500 !w-3.5 !h-3.5 !border-2 !border-white dark:!border-neutral-900 transition-transform hover:scale-125 opacity-70"
      />
    </div>
  );
}

function TagNode({ data, selected }: FlowNodeProps) {
  const content = (data.label || "").replace(/^🏷️\s*(Tag session:\s*)?/, "") || "Lead";

  return (
    <div
      className={`relative min-w-[240px] max-w-[300px] bg-white dark:bg-neutral-900 text-neutral-800 dark:text-white rounded-2xl shadow-md border-2 transition-all group ${
        selected
          ? "border-teal-500 ring-4 ring-teal-500/20 shadow-lg scale-102"
          : "border-slate-200 dark:border-neutral-800 hover:border-teal-300 dark:hover:border-teal-800/60"
      }`}
    >
      <Handle
        type="target"
        position={Position.Left}
        className="!bg-teal-500 !w-3.5 !h-3.5 !border-2 !border-white dark:!border-neutral-900"
      />
      <Handle
        type="target"
        position={Position.Top}
        className="!bg-teal-500 !w-3.5 !h-3.5 !border-2 !border-white dark:!border-neutral-900 opacity-60"
      />

      <div className="p-3.5 flex items-center justify-between gap-3 border-b border-slate-100 dark:border-neutral-800/80 bg-teal-50/50 dark:bg-teal-950/20 rounded-t-2xl">
        <div className="flex items-center gap-2.5">
          <div className="size-8 rounded-xl bg-teal-100 dark:bg-teal-900/50 text-teal-600 dark:text-teal-400 flex items-center justify-center shadow-2xs">
            <Tag className="size-4" />
          </div>
          <div>
            <h4 className="font-bold text-xs tracking-tight text-neutral-900 dark:text-neutral-100">
              Set Session Tag
            </h4>
            <p className="text-[10px] text-teal-600 dark:text-teal-400 font-medium">
              Audience Segment
            </p>
          </div>
        </div>
        <span className="text-[9px] font-bold uppercase tracking-wider bg-teal-100/80 text-teal-700 dark:bg-teal-950 dark:text-teal-300 px-2 py-0.5 rounded-full shrink-0">
          Tag
        </span>
      </div>

      <div className="p-3.5 bg-neutral-50/30 dark:bg-neutral-950/20 rounded-b-2xl">
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-teal-50 dark:bg-teal-950/80 text-teal-800 dark:text-teal-200 border border-teal-200 dark:border-teal-800/60 font-bold text-xs">
          🏷️ {content}
        </span>
      </div>

      <Handle
        type="source"
        position={Position.Right}
        className="!bg-teal-500 !w-3.5 !h-3.5 !border-2 !border-white dark:!border-neutral-900 transition-transform hover:scale-125"
      />
      <Handle
        type="source"
        position={Position.Bottom}
        className="!bg-teal-500 !w-3.5 !h-3.5 !border-2 !border-white dark:!border-neutral-900 transition-transform hover:scale-125 opacity-70"
      />
    </div>
  );
}

function EscalateNode({ selected }: FlowNodeProps) {
  return (
    <div
      className={`relative min-w-[240px] max-w-[300px] bg-white dark:bg-neutral-900 text-neutral-800 dark:text-white rounded-2xl shadow-md border-2 transition-all group ${
        selected
          ? "border-rose-500 ring-4 ring-rose-500/20 shadow-lg scale-102"
          : "border-slate-200 dark:border-neutral-800 hover:border-rose-300 dark:hover:border-rose-800/60"
      }`}
    >
      <Handle
        type="target"
        position={Position.Left}
        className="!bg-rose-500 !w-3.5 !h-3.5 !border-2 !border-white dark:!border-neutral-900"
      />
      <Handle
        type="target"
        position={Position.Top}
        className="!bg-rose-500 !w-3.5 !h-3.5 !border-2 !border-white dark:!border-neutral-900 opacity-60"
      />

      <div className="p-3.5 flex items-center justify-between gap-3 border-b border-slate-100 dark:border-neutral-800/80 bg-rose-50/50 dark:bg-rose-950/20 rounded-t-2xl">
        <div className="flex items-center gap-2.5">
          <div className="size-8 rounded-xl bg-rose-100 dark:bg-rose-900/50 text-rose-600 dark:text-rose-400 flex items-center justify-center shadow-2xs">
            <PhoneCall className="size-4" />
          </div>
          <div>
            <h4 className="font-bold text-xs tracking-tight text-neutral-900 dark:text-neutral-100">
              Human Escalation
            </h4>
            <p className="text-[10px] text-rose-600 dark:text-rose-400 font-medium">
              Live Agent Transfer
            </p>
          </div>
        </div>
        <span className="text-[9px] font-bold uppercase tracking-wider bg-rose-100/80 text-rose-700 dark:bg-rose-950 dark:text-rose-300 px-2 py-0.5 rounded-full shrink-0">
          Escalate
        </span>
      </div>

      <div className="p-3.5 text-xs font-semibold text-rose-800 dark:text-rose-200 flex items-center gap-2 bg-neutral-50/30 dark:bg-neutral-950/20 rounded-b-2xl">
        <span className="size-2 rounded-full bg-rose-500 animate-pulse" />
        <span>Instantly triggers webhook & operator dispatch</span>
      </div>

      <Handle
        type="source"
        position={Position.Right}
        className="!bg-rose-500 !w-3.5 !h-3.5 !border-2 !border-white dark:!border-neutral-900 transition-transform hover:scale-125"
      />
      <Handle
        type="source"
        position={Position.Bottom}
        className="!bg-rose-500 !w-3.5 !h-3.5 !border-2 !border-white dark:!border-neutral-900 transition-transform hover:scale-125 opacity-70"
      />
    </div>
  );
}

function AutomationNode({ data, selected }: FlowNodeProps) {
  const kind = data.automationKind || "Automation";
  const palette = kind === "Webhook"
    ? { icon: <Zap className="size-4 text-blue-500" />, badge: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300", border: "border-blue-500", handle: "!bg-blue-500" }
    : kind === "Condition" || kind.includes("Condition")
      ? { icon: <GitBranch className="size-4 text-emerald-500" />, badge: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300", border: "border-emerald-500", handle: "!bg-emerald-500" }
      : kind === "Loop"
        ? { icon: <Repeat className="size-4 text-amber-500" />, badge: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300", border: "border-amber-500", handle: "!bg-amber-500" }
        : { icon: <Clock className="size-4 text-slate-500" />, badge: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300", border: "border-slate-500", handle: "!bg-slate-500" };

  return (
    <div
      className={`relative min-w-[260px] max-w-[320px] bg-white dark:bg-neutral-900 text-neutral-800 dark:text-white rounded-2xl shadow-md border-2 transition-all group ${
        selected
          ? `${palette.border} ring-4 ring-primary/20 shadow-lg scale-102`
          : "border-slate-200 dark:border-neutral-800 hover:border-slate-300 dark:hover:border-neutral-700"
      }`}
    >
      <Handle
        type="target"
        position={Position.Left}
        className={`${palette.handle} !w-3.5 !h-3.5 !border-2 !border-white dark:!border-neutral-900`}
      />
      <Handle
        type="target"
        position={Position.Top}
        className={`${palette.handle} !w-3.5 !h-3.5 !border-2 !border-white dark:!border-neutral-900 opacity-60`}
      />

      <div className="p-3.5 flex items-center justify-between gap-3 border-b border-slate-100 dark:border-neutral-800/80 bg-neutral-50/70 dark:bg-neutral-950/40 rounded-t-2xl">
        <div className="flex items-center gap-2.5">
          <div className="size-8 rounded-xl bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center shadow-2xs">
            {palette.icon}
          </div>
          <div>
            <h4 className="font-bold text-xs tracking-tight text-neutral-900 dark:text-neutral-100">
              {kind}
            </h4>
            <p className="text-[10px] text-neutral-500 dark:text-neutral-400 font-medium">
              Logic & Control
            </p>
          </div>
        </div>
        <span className={`text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full shrink-0 ${palette.badge}`}>
          {kind}
        </span>
      </div>

      <div className="p-3.5 space-y-2 bg-neutral-50/30 dark:bg-neutral-950/20 rounded-b-2xl">
        <p className="text-xs font-medium text-neutral-800 dark:text-neutral-100 leading-relaxed line-clamp-2">
          {data.label || "Configurable automation step"}
        </p>
        {kind.includes("Condition") && (
          <div className="flex items-center justify-between gap-2 pt-1 text-[10px] font-bold">
            <span className="text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded-lg border border-emerald-200 dark:border-emerald-800">
              true →
            </span>
            <span className="text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/60 px-2 py-0.5 rounded-lg border border-rose-200 dark:border-rose-800">
              false →
            </span>
          </div>
        )}
      </div>

      <Handle
        type="source"
        position={Position.Right}
        className={`${palette.handle} !w-3.5 !h-3.5 !border-2 !border-white dark:!border-neutral-900 transition-transform hover:scale-125`}
      />
      <Handle
        type="source"
        position={Position.Bottom}
        className={`${palette.handle} !w-3.5 !h-3.5 !border-2 !border-white dark:!border-neutral-900 transition-transform hover:scale-125 opacity-70`}
      />
    </div>
  );
}

const initialNodes: Node[] = [
  {
    id: "start",
    type: "start",
    data: { label: "🚀 Start Conversation" },
    position: { x: 80, y: 120 },
    measured: { width: 280, height: 110 },
  },
];
const initialEdges: Edge[] = [];

interface FlowSchema {
  nodes: Node[];
  edges: Edge[];
}

interface FlowValidation {
  errors: string[];
  warnings: string[];
}

function validateFlow(nodes: Node[], edges: Edge[]): FlowValidation {
  const errors: string[] = [];
  const warnings: string[] = [];
  const ids = new Set<string>();
  nodes.forEach((node) => {
    if (!node.id.trim()) errors.push("Every step needs an ID.");
    if (ids.has(node.id)) errors.push(`Duplicate step ID: ${node.id}`);
    ids.add(node.id);
    if (!String((node.data as FlowNodeData)?.label ?? "").trim()) warnings.push(`${node.id} has no label.`);

    // Validate operational controls before a flow can be published. These
    // limits protect the worker from accidental hot loops, unbounded retries,
    // and webhook calls that can hang an execution indefinitely.
    const data = (node.data as FlowNodeData) || {};
    const config = data.config || {};
    const numberConfig = (key: string) => {
      const value = Number(config[key]);
      return Number.isFinite(value) ? value : null;
    };
    if (node.type === "webhook") {
      const url = String(config.url || "").trim();
      if (!url) errors.push(`Webhook ${node.id} needs a destination URL.`);
      else if (!/^https:\/\//i.test(url)) errors.push(`Webhook ${node.id} must use HTTPS.`);
      const timeout = numberConfig("timeout_ms");
      if (timeout !== null && (timeout < 100 || timeout > 120000)) {
        errors.push(`Webhook ${node.id} timeout must be between 100ms and 120s.`);
      }
    }
    if (node.type === "retry") {
      const attempts = numberConfig("max_attempts");
      if (attempts !== null && (attempts < 1 || attempts > 10)) {
        errors.push(`Retry ${node.id} must allow between 1 and 10 attempts.`);
      }
      const backoff = numberConfig("backoff_ms");
      if (backoff !== null && (backoff < 0 || backoff > 300000)) {
        errors.push(`Retry ${node.id} backoff must be between 0 and 5 minutes.`);
      }
    }
    if (node.type === "delay") {
      const delay = numberConfig("delay_ms");
      if (delay !== null && (delay < 0 || delay > 86400000)) {
        errors.push(`Delay ${node.id} must be between 0 and 24 hours.`);
      }
    }
    if (node.type === "loop") {
      const maxIterations = numberConfig("max_iterations");
      if (maxIterations !== null && (maxIterations < 1 || maxIterations > 1000)) {
        errors.push(`Loop ${node.id} must allow between 1 and 1,000 iterations.`);
      }
    }
    if (config.mapping !== undefined) {
      const mapping = config.mapping;
      if (!mapping || typeof mapping !== "object" || Array.isArray(mapping)) {
        errors.push(`Data mapping for ${node.id} must be an object of target fields.`);
      } else if (Object.entries(mapping as Record<string, unknown>).some(([key, value]) => !key.trim() || typeof value !== "string" || !value.trim())) {
        errors.push(`Data mapping for ${node.id} must contain non-empty string field paths.`);
      }
    }
  });
  const starts = nodes.filter((node) => node.type === "start" || node.type === "input");
  if (starts.length !== 1) errors.push(`Flow must contain exactly one Start trigger step (found ${starts.length}).`);
  const nodeIds = new Set(nodes.map((node) => node.id));
  const incoming = new Map<string, number>();
  const outgoing = new Map<string, number>();
  const adjacency = new Map<string, string[]>();
  edges.forEach((edge) => {
    if (!nodeIds.has(edge.source) || !nodeIds.has(edge.target)) errors.push(`Connection ${edge.id} points to a missing step.`);
    if (nodeIds.has(edge.source)) {
      outgoing.set(edge.source, (outgoing.get(edge.source) ?? 0) + 1);
      const targets = adjacency.get(edge.source) ?? [];
      targets.push(edge.target);
      adjacency.set(edge.source, targets);
    }
    if (nodeIds.has(edge.target)) incoming.set(edge.target, (incoming.get(edge.target) ?? 0) + 1);
  });
  if (starts.length === 1 && (incoming.get(starts[0].id) ?? 0) > 0) {
    errors.push("The Start step cannot have an incoming connection.");
  }
  if (starts.length === 1) {
    const reachable = new Set<string>([starts[0].id]);
    const pending = [starts[0].id];
    while (pending.length) {
      const current = pending.shift()!;
      for (const target of adjacency.get(current) ?? []) {
        if (!reachable.has(target)) { reachable.add(target); pending.push(target); }
      }
    }
    nodes.filter((node) => !reachable.has(node.id)).forEach((node) => {
      errors.push(`Step ${node.id} is unreachable from the Start step.`);
    });

    // A cycle is only safe when it is explicitly represented by a Loop step.
    // Reject accidental back-edges (a common drag/connect mistake) before a
    // published workflow can cause an unbounded worker execution.
    const visiting = new Set<string>();
    const visited = new Set<string>();
    const walk = (id: string) => {
      if (visiting.has(id)) return true;
      if (visited.has(id)) return false;
      visiting.add(id);
      const hasCycle = (adjacency.get(id) ?? []).some((target) => walk(target));
      visiting.delete(id);
      visited.add(id);
      return hasCycle;
    };
    if (walk(starts[0].id)) {
      const loopIds = new Set(nodes.filter((node) => node.type === "loop").map((node) => node.id));
      if (!loopIds.size) {
        errors.push("Flow contains a cycle without an explicit Loop step.");
      }
    }
  }
  nodes.filter((node) => node.type !== "start" && node.type !== "input" && (incoming.get(node.id) ?? 0) === 0).forEach((node) => {
    warnings.push(`${node.id} has no incoming connection.`);
  });
  nodes.filter((node) => node.type !== "start" && node.type !== "input" && (outgoing.get(node.id) ?? 0) === 0 && !["bookMeeting", "escalate"].includes(String(node.type))).forEach((node) => {
    warnings.push(`${node.id} ends the workflow without a next step.`);
  });
  nodes.filter((node) => node.type === "choice").forEach((node) => {
    const options = ((node.data as FlowNodeData)?.options ?? []).map(String).filter(Boolean);
    const labels = edges.filter((edge) => edge.source === node.id).map((edge) => String(edge.label ?? ""));
    options.filter((option) => !labels.includes(option)).forEach((option) => {
      errors.push(`Choice ${node.id} is missing a connection for “${option}”.`);
    });
  });
  if (nodes.length > 1 && edges.length === 0) errors.push("Connect the Start step before publishing.");
  return { errors: [...new Set(errors)], warnings: [...new Set(warnings)] };
}

function extractFlowFromJs(customJs: string): (FlowSchema & { status: "active" | "paused" }) | null {
  if (!customJs) return null;
  try {
    const match = customJs.match(/\/\* CHATTY_FLOW_DATA([\s\S]*?)CHATTY_FLOW_DATA \*\//);
    if (match && match[1]) {
      const flow = JSON.parse(match[1].trim());
      if (flow && flow.nodes && flow.edges) return flow;
    }
  } catch {}
  return null;
}

export function ChatbotFlowBuilder({ botId, color = "#f97316", fetchBackend: fetchDashboardBackend }: Props) {
  // Navigation / Tabs (Editor | Executions | Versions | Simulation)
  const [activeTab, setActiveTab] = useState<ActiveEditorTab>("editor");

  // React Flow state
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);

  // Inspector edit form state
  const [nodeLabel, setNodeLabel] = useState("");
  const [nodeOptions, setNodeOptions] = useState<string[]>([]);
  const [newOptionText, setNewOptionText] = useState("");
  const [nodeField, setNodeField] = useState("email");
  const [nodeAiPrompt, setNodeAiPrompt] = useState("");
  const [nodeConfigText, setNodeConfigText] = useState("{}");

  // Flow status & auto-save
  const [flowStatus, setFlowStatus] = useState<"active" | "paused">("paused");
  const [autoSave, setAutoSave] = useState(true);
  const [saveStatus, setSaveStatus] = useState<"saved" | "saving" | "unsaved">("saved");
  const [loading, setLoading] = useState(() => !!botId);

  // Modals & Drawers
  const [nodePaletteOpen, setNodePaletteOpen] = useState(false);
  const [paletteSearch, setPaletteSearch] = useState("");
  const [templatesOpen, setTemplatesOpen] = useState(false);
  const [aiCopilotOpen, setAiCopilotOpen] = useState(false);
  const [validationOpen, setValidationOpen] = useState(false);

  // AI Generation
  const [aiPrompt, setAiPrompt] = useState("");
  const [generating, setGenerating] = useState(false);

  // Test Simulation State
  const [testRunning, setTestRunning] = useState(false);
  const [testInputsText, setTestInputsText] = useState("Hello\nI'd like to book a demo\nenterprise tier");
  const [testContextText, setTestContextText] = useState('{\n  "visitor": {\n    "channel": "web",\n    "page": "/pricing"\n  }\n}');
  type DryRunStep = {
    node_id: string;
    label: string;
    node_type?: string;
    runtime?: {
      branch_reason?: string;
      mapped_payload?: Record<string, unknown>;
      unresolved_fields?: string[];
      outcome?: string;
      side_effect?: string;
    };
  };
  const [testTrace, setTestTrace] = useState<DryRunStep[] | null>(null);

  // Versions and Executions
  const [versions, setVersions] = useState<Array<{ id: string; version: number; status: string; note?: string | null; created_at: string }>>([]);
  const [loadingVersions, setLoadingVersions] = useState(false);
  const [runHistory, setRunHistory] = useState<Array<{ id: string; status: string; duration_ms?: number | null; created_at: string; trace?: Array<{ label: string }> }>>([]);
  const [loadingRuns, setLoadingRuns] = useState(false);
  const [selectedRun, setSelectedRun] = useState<{ id: string; status: string; error?: string | null; trace?: Array<{ node_id?: string; node_type?: string; label?: string; runtime?: Record<string, unknown> }>; flow_data?: unknown } | null>(null);
  const [runStatusFilter, setRunStatusFilter] = useState<"all" | "completed" | "failed">("all");
  const [runsOpen, setRunsOpen] = useState(false);
  const [toolboxCollapsed, setToolboxCollapsed] = useState(false);
  const [moreMenuOpen, setMoreMenuOpen] = useState(false);

  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);
  const isInitialMount = useRef(true);
  const autoSaveTimerRef = useRef<NodeJS.Timeout | null>(null);
  const importInputRef = useRef<HTMLInputElement | null>(null);
  const reactFlowInstanceRef = useRef<ReactFlowInstance | null>(null);

  const validation = useMemo(() => validateFlow(nodes, edges), [nodes, edges]);

  const showToast = (message: string, type: "success" | "error" = "success") => {
    setToast({ message, type });
  };

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 3200);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  const safeFitView = useCallback((padding = 0.2, duration = 250) => {
    const instance = reactFlowInstanceRef.current;
    if (!instance) return;
    try {
      const vp = instance.getViewport();
      if (!Number.isFinite(vp?.x) || !Number.isFinite(vp?.y) || !Number.isFinite(vp?.zoom) || (vp?.zoom ?? 0) <= 0) {
        instance.setViewport({ x: 0, y: 0, zoom: 1 });
      }
      const allNodes = instance.getNodes();
      if (!allNodes || allNodes.length === 0) return;

      if (duration > 0) {
        instance.fitView({ padding, duration, minZoom: 0.2, maxZoom: 1.4 });
      } else {
        instance.fitView({ padding, minZoom: 0.2, maxZoom: 1.4 });
      }
    } catch {}
  }, []);

  const nodeTypes = useMemo(
    () => ({
      start: StartNode,
      input: StartNode,
      message: MessageNode,
      question: QuestionNode,
      choice: ChoiceNode,
      leadCapture: LeadCaptureNode,
      aiQualify: AiQualifyNode,
      bookMeeting: BookMeetingNode,
      setTag: TagNode,
      escalate: EscalateNode,
      delay: AutomationNode,
      condition: AutomationNode,
      loop: AutomationNode,
      webhook: AutomationNode,
      retry: AutomationNode,
    }),
    []
  );

  // Load flow on mount
  useEffect(() => {
    if (!botId) return;
    (async () => {
      try {
        let data: { custom_js?: string | null } | null = null;
        if (SELF_HOST_MODE) {
          const response = await fetchBackend(`/api/bots/${botId}`);
          if (response.ok) data = await response.json();
        } else {
          const supabase = createClient();
          const result = await supabase
            .from("chatty_bots")
            .select("custom_js")
            .eq("id", botId)
            .maybeSingle();
          data = result.data;
        }
        if (data?.custom_js) {
          const flow = extractFlowFromJs(data.custom_js);
          if (flow) {
            const formattedNodes = flow.nodes.map((n) => {
              let type = n.type || "message";
              const label = (n.data as FlowNodeData)?.label || "";
              if (n.id === "start" || label.includes("Start")) type = "start";
              else if (n.type === "choice" || label.startsWith("🔘") || n.id.startsWith("choice-")) type = "choice";
              else if (n.type === "leadCapture" || label.startsWith("👤") || n.id.startsWith("lead-")) type = "leadCapture";
              else if (n.type === "aiQualify" || label.startsWith("🤖") || n.id.startsWith("ai-")) type = "aiQualify";
              else if (n.type === "bookMeeting" || label.startsWith("📅") || n.id.startsWith("meet-")) type = "bookMeeting";
              else if (label.startsWith("❓") || n.id.startsWith("q-")) type = "question";
              else if (label.startsWith("🏷️") || n.id.startsWith("tag-")) type = "setTag";
              else if (label.startsWith("🔔") || n.id.startsWith("esc-")) type = "escalate";
              else if (label.startsWith("💬") || n.id.startsWith("msg-")) type = "message";
              return { ...n, type };
            });
            setNodes(formattedNodes);
            setEdges(flow.edges);
            setFlowStatus(flow.status || "paused");
          }
        }
      } catch {
        // ignore load errors
      } finally {
        setTimeout(() => {
          safeFitView(0.25, 0);
          isInitialMount.current = false;
        }, 200);
        setLoading(false);
      }
    })();
  }, [botId, setNodes, setEdges, safeFitView]);

  const onConnect = useCallback(
    (params: Connection) => setEdges((eds) => addEdge({ ...params, animated: true }, eds)),
    [setEdges]
  );

  const saveFlowToBackend = useCallback(
    async (showNotification = false) => {
      if (!botId) return;
      if (validation.errors.length) {
        setSaveStatus("unsaved");
        if (showNotification) showToast("Fix flow validation errors before saving.", "error");
        return;
      }
      setSaveStatus("saving");
      try {
        if (showNotification && fetchDashboardBackend) {
          const response = await fetchDashboardBackend(`/api/bots/${botId}/flow/versions`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              nodes,
              edges,
              status: flowStatus === "active" ? "published" : "draft",
              note: flowStatus === "active" ? "Published from Flow Builder" : "Saved draft from Flow Builder",
            }),
          });
          if (!response.ok) throw new Error(`Flow version save failed (${response.status})`);
          setSaveStatus("saved");
          showToast(flowStatus === "active" ? "Flow published and versioned." : "Draft version saved.", "success");
          return;
        }

        const flowConfig = { status: flowStatus, nodes, edges };
        let botData: { custom_js?: string | null } | null = null;
        if (SELF_HOST_MODE) {
          const response = await fetchBackend(`/api/bots/${botId}`);
          if (response.ok) botData = await response.json();
        } else {
          const supabase = createClient();
          const result = await supabase
            .from("chatty_bots")
            .select("custom_js")
            .eq("id", botId)
            .maybeSingle();
          botData = result.data;
        }

        let baseJs = botData?.custom_js || "";
        baseJs = baseJs.replace(/\/\* CHATTY_FLOW_START \*\/[\s\S]*?\/\* CHATTY_FLOW_END \*\//g, "").trim();
        baseJs = baseJs.replace(/\/\* CHATTY_FLOW_DATA[\s\S]*?CHATTY_FLOW_DATA \*\//g, "").trim();

        const flowJs = `\n/* CHATTY_FLOW_DATA\n${JSON.stringify(flowConfig, null, 2)}\nCHATTY_FLOW_DATA */`;
        const finalJs = (baseJs + flowJs).trim();

        if (SELF_HOST_MODE) {
          const response = await fetchBackend(`/api/bots/${botId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ custom_js: finalJs }),
          });
          if (!response.ok) throw new Error(`Flow save failed (${response.status})`);
        } else {
          const supabase = createClient();
          const { error } = await supabase
            .from("chatty_bots")
            .update({ custom_js: finalJs })
            .eq("id", botId);
          if (error) throw error;
        }
        setSaveStatus("saved");
        if (showNotification) {
          showToast("Flow saved! Real-time widget synced.", "success");
        }
      } catch {
        setSaveStatus("unsaved");
        if (showNotification) {
          showToast("Failed to save flow.", "error");
        }
      }
    },
    [botId, nodes, edges, flowStatus, validation.errors.length, fetchDashboardBackend]
  );

  // Debounced auto-save
  useEffect(() => {
    if (isInitialMount.current || loading || !autoSave || !botId) return;
    setSaveStatus("unsaved");
    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    autoSaveTimerRef.current = setTimeout(() => {
      saveFlowToBackend(false);
    }, 1800);
    return () => {
      if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    };
  }, [nodes, edges, flowStatus, autoSave, botId, saveFlowToBackend, loading]);

  const onNodeClick = (_: MouseEvent, node: Node) => {
    setSelectedNode(node);
    setNodeLabel((node.data.label as string) || "");
    setNodeOptions((node.data.options as string[]) || ["Option 1", "Option 2"]);
    setNodeField((node.data.field as string) || "email");
    setNodeAiPrompt((node.data.prompt as string) || "");
    setNodeConfigText(JSON.stringify((node.data.config as Record<string, unknown>) || {}, null, 2));
  };

  const addChoiceOption = () => {
    if (!newOptionText.trim()) return;
    setNodeOptions((prev) => [...prev, newOptionText.trim()]);
    setNewOptionText("");
  };

  const removeChoiceOption = (idx: number) => {
    setNodeOptions((prev) => prev.filter((_, i) => i !== idx));
  };

  const updateSelectedNode = () => {
    if (!selectedNode) return;
    let config: Record<string, unknown> | undefined;
    if (["delay", "condition", "loop", "webhook", "retry"].includes(String(selectedNode.type))) {
      try {
        const parsed = JSON.parse(nodeConfigText);
        if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("Configuration must be a JSON object");
        config = parsed as Record<string, unknown>;
      } catch (error) {
        showToast(error instanceof Error ? error.message : "Invalid JSON configuration", "error");
        return;
      }
    }
    setNodes((nds) =>
      nds.map((n) =>
        n.id === selectedNode.id
          ? {
              ...n,
              data: {
                ...n.data,
                label: nodeLabel,
                options: selectedNode.type === "choice" ? nodeOptions : n.data.options,
                field: selectedNode.type === "leadCapture" ? nodeField : n.data.field,
                prompt: selectedNode.type === "aiQualify" ? nodeAiPrompt : n.data.prompt,
                config: config ?? n.data.config,
              },
            }
          : n
      )
    );
    setSelectedNode(null);
    showToast("Step updated!", "success");
  };

  const deleteSelectedNode = () => {
    if (!selectedNode) return;
    setNodes((nds) => nds.filter((n) => n.id !== selectedNode.id));
    setEdges((eds) => eds.filter((e) => e.source !== selectedNode.id && e.target !== selectedNode.id));
    setSelectedNode(null);
    showToast("Step deleted from canvas", "success");
  };

  // Node insertion helper
  const insertNode = (type: string, initialData: FlowNodeData) => {
    const id = `${type}-${Date.now()}`;
    const x = 320 + Math.random() * 80;
    const y = 140 + Math.random() * 80;
    const newNode: Node<FlowNodeData> = {
      id,
      type,
      data: initialData,
      position: { x, y },
    };
    setNodes((nds) => [...nds, newNode]);
    setNodePaletteOpen(false);
    showToast(`Added ${initialData.automationKind || type} step`, "success");
    setTimeout(() => safeFitView(0.2, 300), 100);
  };

  // Templates
  const FALLBACK_FIN_DEMO: FlowTemplate = {
    name: "B2B Demo Qualification (Fin Style)",
    nodes: [
      { id: "start", type: "start", data: { label: "🚀 Start Conversation" }, position: { x: 40, y: 140 } },
      { id: "msg-welcome", type: "message", data: { label: "👋 Hey there! Welcome to Chatty. How can we help accelerate your team today?" }, position: { x: 380, y: 140 } },
      { id: "lead-email", type: "leadCapture", data: { label: "📧 Capture business work email", field: "email" }, position: { x: 740, y: 140 } },
      {
        id: "choice-objective",
        type: "choice",
        data: {
          label: "🎯 What primary goal are you evaluating Chatty for?",
          options: ["Inbound sales", "Customer support", "Other"],
        },
        position: { x: 1100, y: 140 },
      },
      { id: "msg-sales-intro", type: "message", data: { label: "📈 Excellent! Chatty automates 24/7 SDR qualification, routing, and booking for revenue teams." }, position: { x: 1500, y: 0 } },
      { id: "meet-sales-demo", type: "bookMeeting", data: { label: "📅 Select a time that works best for you from our available slots to schedule your custom enterprise demo:" }, position: { x: 1860, y: 0 } },
      { id: "msg-support-intro", type: "message", data: { label: "🎧 Great! Chatty deflects up to 78% of tier-1 support inquiries autonomously using your knowledge base." }, position: { x: 1500, y: 280 } },
      { id: "meet-support-demo", type: "bookMeeting", data: { label: "📅 Select a time that works best for you to schedule your AI support walkthrough:" }, position: { x: 1860, y: 280 } },
    ],
    edges: [
      { id: "e-start-welcome", source: "start", target: "msg-welcome", animated: true },
      { id: "e-welcome-email", source: "msg-welcome", target: "lead-email", animated: true },
      { id: "e-email-objective", source: "lead-email", target: "choice-objective", animated: true },
      { id: "e-obj-sales", source: "choice-objective", target: "msg-sales-intro", label: "Inbound sales", animated: true },
      { id: "e-sales-meet", source: "msg-sales-intro", target: "meet-sales-demo", animated: true },
      { id: "e-obj-support", source: "choice-objective", target: "msg-support-intro", label: "Customer support", animated: true },
      { id: "e-support-meet", source: "msg-support-intro", target: "meet-support-demo", animated: true },
    ],
  };

  const FALLBACK_SUPPORT_TRIAGE: FlowTemplate = {
    name: "Support Triage & Deflection",
    nodes: [
      { id: "start", type: "start", data: { label: "🚀 Start Conversation" }, position: { x: 40, y: 160 } },
      { id: "msg-welcome", type: "message", data: { label: "💬 Hello! I am your Support Assistant. What can we help you solve today?" }, position: { x: 380, y: 160 } },
      {
        id: "choice-category",
        type: "choice",
        data: {
          label: "🔘 Please select the topic that best matches your issue:",
          options: ["Billing & Invoices", "Technical Problem", "Speak to Human"],
        },
        position: { x: 740, y: 160 },
      },
      { id: "q-billing", type: "question", data: { label: "❓ Please share your invoice number or account email so we can pull up your records:" }, position: { x: 1140, y: 0 } },
      { id: "ai-tech-diag", type: "aiQualify", data: { label: "🤖 Diagnose technical issue and offer knowledge base resolution steps." }, position: { x: 1140, y: 160 } },
      { id: "esc-human", type: "escalate", data: { label: "🔔 Escalate to Live Agent" }, position: { x: 1140, y: 320 } },
    ],
    edges: [
      { id: "e-start", source: "start", target: "msg-welcome", animated: true },
      { id: "e-wel-cat", source: "msg-welcome", target: "choice-category", animated: true },
      { id: "e-cat-bill", source: "choice-category", target: "q-billing", label: "Billing & Invoices", animated: true },
      { id: "e-cat-tech", source: "choice-category", target: "ai-tech-diag", label: "Technical Problem", animated: true },
      { id: "e-cat-human", source: "choice-category", target: "esc-human", label: "Speak to Human", animated: true },
    ],
  };

  const loadTemplate = (t: FlowTemplate) => {
    setNodes(t.nodes);
    setEdges(t.edges);
    setTemplatesOpen(false);
    showToast(`Loaded "${t.name}" template!`, "success");
    setTimeout(() => safeFitView(0.2, 400), 150);
  };

  const generateFlowWithAI = async () => {
    if (!aiPrompt.trim() || !botId) return;
    setGenerating(true);
    try {
      const res = await fetch(`${BACKEND_URL}/api/flow/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bot_id: botId, description: aiPrompt }),
      });
      if (res.ok) {
        const schema: FlowSchema = await res.json();
        if (schema.nodes && schema.edges) {
          setNodes(schema.nodes);
          setEdges(schema.edges);
          setAiPrompt("");
          setAiCopilotOpen(false);
          showToast("AI generated workflow successfully!", "success");
          setTimeout(() => safeFitView(0.2, 400), 150);
        } else {
          showToast("Invalid structure returned by AI.", "error");
        }
      } else {
        const body = await res.json().catch(() => ({}));
        showToast(body.detail || "Failed to generate flow with AI.", "error");
      }
    } catch {
      showToast("Failed to connect to AI server.", "error");
    } finally {
      setGenerating(false);
    }
  };

  const exportFlow = () => {
    const blob = new Blob(
      [JSON.stringify({ version: 1, exportedAt: new Date().toISOString(), status: flowStatus, nodes, edges }, null, 2)],
      { type: "application/json" }
    );
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `chatty-flow-${botId ?? "draft"}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
    showToast("Flow exported as JSON file", "success");
  };

  const importFlow = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result)) as FlowSchema & { status?: "active" | "paused" };
        if (!Array.isArray(parsed.nodes) || !Array.isArray(parsed.edges)) throw new Error("Invalid format: nodes and edges required.");
        setNodes(parsed.nodes);
        setEdges(parsed.edges);
        setFlowStatus(parsed.status === "active" ? "active" : "paused");
        showToast("Flow imported! Save to publish.", "success");
        setTimeout(() => safeFitView(0.2, 400), 150);
      } catch (error) {
        showToast(error instanceof Error ? error.message : "Invalid JSON file.", "error");
      }
    };
    reader.readAsText(file);
  };

  const runTestSimulation = async () => {
    if (!botId || !fetchDashboardBackend) return;
    if (validation.errors.length) {
      setValidationOpen(true);
      showToast("Resolve validation errors before running test.", "error");
      return;
    }
    let testContext: Record<string, unknown> = {};
    try {
      testContext = JSON.parse(testContextText || "{}");
    } catch {
      showToast("Test context must be valid JSON.", "error");
      return;
    }
    const testInputs = testInputsText.split("\n").map((i) => i.trim()).filter(Boolean);
    setTestRunning(true);
    try {
      const response = await fetchDashboardBackend(`/api/bots/${botId}/flow/simulate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ inputs: testInputs.length ? testInputs : ["Hello"], context: testContext, nodes, edges }),
      });
      if (!response.ok) throw new Error(`Simulation failed (${response.status})`);
      const result = await response.json() as { execution_path?: DryRunStep[] };
      setTestTrace(result.execution_path ?? []);
      showToast("Simulation completed without side effects!", "success");
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Simulation test failed.", "error");
    } finally {
      setTestRunning(false);
    }
  };

  const loadRuns = async (filter: "all" | "completed" | "failed" = runStatusFilter) => {
    if (!botId || !fetchDashboardBackend) return;
    setLoadingRuns(true);
    try {
      const query = filter === "all" ? "" : `?status=${filter}`;
      const response = await fetchDashboardBackend(`/api/bots/${botId}/flow/runs${query}`);
      if (response.ok) setRunHistory(await response.json());
    } finally {
      setLoadingRuns(false);
    }
  };

  const loadVersions = async () => {
    if (!botId || !fetchDashboardBackend) return;
    setLoadingVersions(true);
    try {
      const response = await fetchDashboardBackend(`/api/bots/${botId}/flow/versions`);
      if (response.ok) setVersions(await response.json());
    } finally {
      setLoadingVersions(false);
    }
  };

  const rollbackVersion = async (versionId: string) => {
    if (!botId || !fetchDashboardBackend) return;
    const response = await fetchDashboardBackend(`/api/bots/${botId}/flow/versions/${versionId}/rollback`, { method: "POST" });
    if (!response.ok) {
      showToast("Rollback failed.", "error");
      return;
    }
    showToast("Version rolled back and published.", "success");
    await loadVersions();
    window.location.reload();
  };

  // Node catalog definition for modal
  const nodeCatalog = [
    {
      category: "Conversational Steps",
      items: [
        {
          type: "message",
          label: "Bot Message",
          desc: "Sends a rich text, video, or markdown message to visitor",
          icon: <MessageSquare className="size-4 text-blue-500" />,
          data: { label: "💬 Hi! How can I assist you today?" },
        },
        {
          type: "question",
          label: "Ask Question",
          desc: "Asks a question and waits for open visitor text reply",
          icon: <HelpCircle className="size-4 text-purple-500" />,
          data: { label: "❓ What is your company size?" },
        },
        {
          type: "choice",
          label: "Multi-Choice Buttons",
          desc: "Renders clickable option chips to branch the dialogue",
          icon: <ListFilter className="size-4 text-violet-500" />,
          data: {
            label: "🔘 What would you like to explore?",
            options: ["Product Demo", "Pricing Plans", "Support FAQ"],
          },
        },
      ],
    },
    {
      category: "Conversion & Booking",
      items: [
        {
          type: "leadCapture",
          label: "Lead Capture",
          desc: "Extracts and auto-validates email, name, or phone into CRM",
          icon: <UserCheck className="size-4 text-cyan-500" />,
          data: { label: "👤 Please share your business work email:", field: "email" },
        },
        {
          type: "bookMeeting",
          label: "Schedule Meeting",
          desc: "Displays real-time calendar availability slots inline",
          icon: <Calendar className="size-4 text-emerald-500" />,
          data: { label: "📅 Select a convenient time for our live demo:" },
        },
      ],
    },
    {
      category: "AI & Smart Logic",
      items: [
        {
          type: "aiQualify",
          label: "AI Smart Agent",
          desc: "Dynamic reasoning agent that resolves ambiguity",
          icon: <BotIcon className="size-4 text-indigo-500" />,
          data: {
            label: "🤖 Understand visitor requirements & consultatively qualify",
            prompt: "Consultatively clarify needs if visitor says 'idk' or is ambiguous.",
          },
        },
        {
          type: "condition",
          label: "Condition (If / Else)",
          desc: "Evaluates rules and routes flow to true or false branches",
          icon: <GitBranch className="size-4 text-emerald-500" />,
          data: { automationKind: "Condition", label: "Check visitor response criteria", config: { expression: "input" } },
        },
        {
          type: "delay",
          label: "Wait / Delay",
          desc: "Pauses flow for specified seconds before proceeding",
          icon: <Clock className="size-4 text-slate-500" />,
          data: { automationKind: "Delay", label: "Wait 3 seconds", config: { duration_ms: 3000 } },
        },
      ],
    },
    {
      category: "Integrations & Handoff",
      items: [
        {
          type: "webhook",
          label: "Webhook (HTTP API)",
          desc: "Calls an external API endpoint with payload mapping",
          icon: <Zap className="size-4 text-blue-500" />,
          data: { automationKind: "Webhook", label: "POST to External Webhook", config: { url: "", timeout_ms: 10000, max_attempts: 3 } },
        },
        {
          type: "setTag",
          label: "Set Session Tag",
          desc: "Tags conversation for CRM segmentation and filtering",
          icon: <Tag className="size-4 text-teal-500" />,
          data: { label: "🏷️ Tag session: High Intent Prospect" },
        },
        {
          type: "escalate",
          label: "Human Escalation",
          desc: "Hands conversation off to human live agent or phone",
          icon: <PhoneCall className="size-4 text-rose-500" />,
          data: { label: "🔔 Transfer to Live Support Agent" },
        },
      ],
    },
  ];

  const filteredCatalog = nodeCatalog.map((cat) => ({
    ...cat,
    items: cat.items.filter(
      (item) =>
        !paletteSearch.trim() ||
        item.label.toLowerCase().includes(paletteSearch.toLowerCase()) ||
        item.desc.toLowerCase().includes(paletteSearch.toLowerCase())
    ),
  })).filter((cat) => cat.items.length > 0);

  return (
    <div className="w-full bg-white dark:bg-neutral-950 border border-slate-200 dark:border-neutral-800 rounded-2xl shadow-sm overflow-hidden flex flex-col min-h-[780px] h-[calc(100vh-140px)]">
      {/* ── n8n-Inspired Top Navigation Bar ── */}
      <header className="h-16 px-4 sm:px-6 border-b border-slate-200 dark:border-neutral-800 bg-white/95 dark:bg-neutral-900/95 backdrop-blur-md flex items-center justify-between gap-3 shrink-0 z-20">
        {/* Left: Workflow Title & Tags */}
        <div className="flex items-center gap-3 shrink-0 min-w-fit">
          <div className="size-9 rounded-xl bg-gradient-to-tr from-orange-500 to-amber-500 text-white flex items-center justify-center shadow-xs shrink-0">
            <GitBranch className="size-5" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-sm tracking-tight text-neutral-900 dark:text-neutral-100 whitespace-nowrap">
                Interactive Bot Flow
              </h3>
              <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-neutral-100 dark:bg-neutral-800 text-neutral-500 shrink-0">
                v1.2
              </span>
            </div>
            <div className="flex items-center gap-2 text-[10px] text-neutral-400 font-medium">
              <span className="flex items-center gap-1 shrink-0">
                {saveStatus === "saving" && <Loader2 className="size-2.5 animate-spin text-blue-500" />}
                {saveStatus === "saving" && "Saving changes..."}
                {saveStatus === "saved" && <span className="text-emerald-500 font-semibold flex items-center gap-1"><Check className="size-2.5" /> Saved</span>}
                {saveStatus === "unsaved" && <span className="text-amber-500 font-semibold">● Unsaved edits</span>}
              </span>
              <span>·</span>
              <button
                type="button"
                onClick={() => setAutoSave((v) => !v)}
                className={`hidden sm:inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-semibold cursor-pointer transition-colors ${
                  autoSave ? "text-blue-600 bg-blue-50 dark:bg-blue-950/60" : "text-neutral-400 bg-slate-100 dark:bg-neutral-800"
                }`}
              >
                Auto-save: {autoSave ? "ON" : "OFF"}
              </button>
              <span className="hidden sm:inline">·</span>
              <span className="truncate">{nodes.length} nodes · {edges.length} connections</span>
            </div>
          </div>
        </div>

        {/* Center: n8n Segmented Tab Switcher */}
        <div className="hidden md:flex items-center p-1 bg-slate-100 dark:bg-neutral-850 rounded-xl border border-slate-200/80 dark:border-neutral-800 shadow-2xs shrink-0">
          {[
            { id: "editor", label: "Editor", icon: <Sliders className="size-3.5" /> },
            { id: "executions", label: "Executions", icon: <Zap className="size-3.5" />, badge: runHistory.length },
            { id: "versions", label: "Versions", icon: <History className="size-3.5" /> },
            { id: "simulation", label: "Dry Test", icon: <Play className="size-3.5" /> },
          ].map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => {
                  setActiveTab(tab.id as ActiveEditorTab);
                  if (tab.id === "executions") loadRuns();
                  if (tab.id === "versions") loadVersions();
                  if (tab.id === "editor") setTimeout(() => safeFitView(0.2, 0), 100);
                }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  isActive
                    ? "bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white shadow-xs"
                    : "text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200"
                }`}
              >
                {tab.icon}
                <span>{tab.label}</span>
                {tab.badge !== undefined && tab.badge > 0 && (
                  <span className="text-[9px] px-1.5 py-0.2 rounded-full bg-neutral-200 dark:bg-neutral-750 text-neutral-700 dark:text-neutral-300 font-semibold">
                    {tab.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Right: Active Toggle, Add Node, Save Button, More Actions Dropdown */}
        <div className="flex items-center gap-2 shrink-0">
          <div className="hidden sm:flex items-center border-r border-slate-200 dark:border-neutral-800 pr-2.5 mr-0.5">
            <ModernSwitch
              checked={flowStatus === "active"}
              onChange={(nextChecked) => {
                const next = nextChecked ? "active" : "paused";
                setFlowStatus(next);
                showToast(`Flow marked as ${next}. Click Save to commit.`, "success");
              }}
              size="sm"
              activeLabel="Active"
              inactiveLabel="Inactive"
              activeColor="#10b981"
            />
          </div>

          <button
            type="button"
            onClick={() => setNodePaletteOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 hover:bg-slate-50 dark:hover:bg-neutral-850 text-xs font-bold text-neutral-700 dark:text-neutral-200 shadow-2xs transition-colors cursor-pointer"
          >
            <Plus className="size-3.5 text-[#f97316]" />
            <span className="hidden sm:inline">Add Step</span>
          </button>

          <button
            type="button"
            onClick={() => setAiCopilotOpen(true)}
            className="hidden xl:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-orange-500/10 to-amber-500/10 border border-orange-200 dark:border-orange-900/60 hover:border-orange-300 text-xs font-bold text-orange-700 dark:text-orange-300 shadow-2xs transition-colors cursor-pointer"
          >
            <Sparkles className="size-3.5 text-[#f97316]" />
            <span>AI Copilot</span>
          </button>

          <button
            type="button"
            onClick={() => saveFlowToBackend(true)}
            disabled={saveStatus === "saving"}
            className="flex items-center gap-1.5 px-3 sm:px-4 py-1.5 rounded-xl text-xs font-bold text-white shadow-sm transition-all cursor-pointer hover:opacity-95 disabled:opacity-50"
            style={{ background: color }}
          >
            {saveStatus === "saving" ? <Loader2 className="size-3.5 animate-spin" /> : <Save className="size-3.5" />}
            <span className="hidden sm:inline">Save & Publish</span>
            <span className="sm:hidden">Save</span>
          </button>

          {/* More actions dropdown (n8n pattern for secondary actions) */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setMoreMenuOpen((v) => !v)}
              title="More actions"
              aria-label="More flow actions"
              className="flex items-center justify-center size-8 rounded-xl border border-slate-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 hover:bg-slate-50 dark:hover:bg-neutral-850 text-neutral-600 dark:text-neutral-300 shadow-2xs transition-colors cursor-pointer"
            >
              <MoreHorizontal className="size-4" />
            </button>
            {moreMenuOpen && (
              <>
                <div
                  className="fixed inset-0 z-30"
                  onClick={() => setMoreMenuOpen(false)}
                />
                <div className="absolute right-0 mt-2 w-52 bg-white dark:bg-neutral-900 border border-slate-200 dark:border-neutral-800 rounded-xl shadow-xl py-1.5 z-40 text-xs">
                  <button
                    type="button"
                    onClick={() => {
                      setMoreMenuOpen(false);
                      setTemplatesOpen(true);
                    }}
                    className="w-full flex items-center gap-2.5 px-3.5 py-2 text-left hover:bg-slate-50 dark:hover:bg-neutral-800 font-medium text-neutral-700 dark:text-neutral-200 cursor-pointer"
                  >
                    <Layers className="size-4 text-indigo-500 shrink-0" />
                    <span>Flow Templates</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setMoreMenuOpen(false);
                      setAiCopilotOpen(true);
                    }}
                    className="w-full flex items-center gap-2.5 px-3.5 py-2 text-left hover:bg-slate-50 dark:hover:bg-neutral-800 font-medium text-neutral-700 dark:text-neutral-200 cursor-pointer xl:hidden"
                  >
                    <Sparkles className="size-4 text-[#f97316] shrink-0" />
                    <span>AI Flow Copilot</span>
                  </button>
                  <div className="my-1 border-t border-slate-100 dark:border-neutral-800" />
                  <button
                    type="button"
                    onClick={() => {
                      setMoreMenuOpen(false);
                      exportFlow();
                    }}
                    className="w-full flex items-center gap-2.5 px-3.5 py-2 text-left hover:bg-slate-50 dark:hover:bg-neutral-800 font-medium text-neutral-700 dark:text-neutral-200 cursor-pointer"
                  >
                    <Download className="size-4 text-emerald-500 shrink-0" />
                    <span>Export Workflow (JSON)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setMoreMenuOpen(false);
                      importInputRef.current?.click();
                    }}
                    className="w-full flex items-center gap-2.5 px-3.5 py-2 text-left hover:bg-slate-50 dark:hover:bg-neutral-800 font-medium text-neutral-700 dark:text-neutral-200 cursor-pointer"
                  >
                    <Upload className="size-4 text-blue-500 shrink-0" />
                    <span>Import Workflow (JSON)</span>
                  </button>
                  <div className="my-1 border-t border-slate-100 dark:border-neutral-800" />
                  <button
                    type="button"
                    onClick={() => {
                      setMoreMenuOpen(false);
                      loadTemplate(FALLBACK_FIN_DEMO);
                    }}
                    className="w-full flex items-center gap-2.5 px-3.5 py-2 text-left hover:bg-rose-50 dark:hover:bg-rose-950/30 font-medium text-rose-600 dark:text-rose-400 cursor-pointer"
                  >
                    <RotateCcw className="size-4 shrink-0" />
                    <span>Reset to Default Flow</span>
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </header>

      {/* ── Mobile View Switcher ── */}
      <div className="flex md:hidden items-center border-b border-slate-200 dark:border-neutral-800 p-2 bg-slate-50 dark:bg-neutral-900 gap-1">
        {[
          { id: "editor", label: "Editor", icon: <Sliders className="size-3" /> },
          { id: "executions", label: "Runs", icon: <Zap className="size-3" /> },
          { id: "simulation", label: "Test", icon: <Play className="size-3" /> },
          { id: "versions", label: "History", icon: <History className="size-3" /> },
        ].map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id as ActiveEditorTab)}
            className={`flex-1 py-1.5 rounded-lg text-xs font-bold flex items-center justify-center gap-1 ${
              activeTab === tab.id
                ? "bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white shadow-2xs"
                : "text-neutral-500"
            }`}
          >
            {tab.icon}
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* ── Body: Canvas or Tabs ── */}
      <div className="flex-1 relative overflow-hidden bg-slate-50 dark:bg-neutral-950">
        {/* TAB 1: VISUAL CANVAS */}
        {activeTab === "editor" && (
          <div className="w-full h-full flex relative overflow-hidden">
            {/* Left Collapsible Toolbox (n8n-style) */}
            <div
              className={`h-full bg-white dark:bg-neutral-900 border-r border-slate-200 dark:border-neutral-800 flex flex-col shrink-0 z-10 transition-[width] duration-200 ease-in-out ${
                toolboxCollapsed ? "w-12 p-2" : "w-72 sm:w-80 p-3 sm:p-4 overflow-y-auto"
              }`}
            >
              <div className="flex items-center justify-between gap-2 pb-2 border-b border-slate-100 dark:border-neutral-800 shrink-0">
                {!toolboxCollapsed && (
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-xs font-bold text-neutral-800 dark:text-neutral-200 truncate">Toolbox & Test</span>
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => setToolboxCollapsed((v) => !v)}
                  aria-label={toolboxCollapsed ? "Expand flow toolbox" : "Collapse flow toolbox"}
                  title={toolboxCollapsed ? "Expand flow toolbox" : "Collapse flow toolbox"}
                  className="p-1.5 rounded-lg border border-slate-200 dark:border-neutral-800 hover:bg-slate-100 dark:hover:bg-neutral-800 text-neutral-600 dark:text-neutral-300 transition-colors mx-auto cursor-pointer"
                >
                  {toolboxCollapsed ? <PanelLeftOpen className="size-4" /> : <PanelLeftClose className="size-4" />}
                </button>
              </div>

              {!toolboxCollapsed && (
                <div className="flex-1 space-y-4 pt-3 text-xs">
                  {/* Quick Node Adder */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-400">Node Toolbox</span>
                      <button
                        type="button"
                        onClick={() => setNodePaletteOpen(true)}
                        className="text-[10px] font-semibold text-[#f97316] hover:underline cursor-pointer"
                      >
                        + Browse All
                      </button>
                    </div>
                    <div className="grid grid-cols-2 gap-1.5">
                      <button
                        type="button"
                        onClick={() => insertNode("message", { label: "💬 Hi! How can I assist you today?" })}
                        className="flex items-center gap-1.5 p-2 rounded-lg border border-slate-200 dark:border-neutral-800 hover:bg-slate-50 dark:hover:bg-neutral-850 text-[10px] font-semibold text-neutral-700 dark:text-neutral-300 transition-colors cursor-pointer text-left"
                      >
                        <MessageSquare className="size-3 text-blue-500 shrink-0" />
                        <span className="truncate">Message</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => insertNode("question", { label: "❓ What is your company name?" })}
                        className="flex items-center gap-1.5 p-2 rounded-lg border border-slate-200 dark:border-neutral-800 hover:bg-slate-50 dark:hover:bg-neutral-850 text-[10px] font-semibold text-neutral-700 dark:text-neutral-300 transition-colors cursor-pointer text-left"
                      >
                        <HelpCircle className="size-3 text-purple-500 shrink-0" />
                        <span className="truncate">Question</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => insertNode("choice", { label: "🔘 Select option:", options: ["Sales", "Support", "Pricing"] })}
                        className="flex items-center gap-1.5 p-2 rounded-lg border border-slate-200 dark:border-neutral-800 hover:bg-slate-50 dark:hover:bg-neutral-850 text-[10px] font-semibold text-neutral-700 dark:text-neutral-300 transition-colors cursor-pointer text-left"
                      >
                        <ListFilter className="size-3 text-violet-500 shrink-0" />
                        <span className="truncate">Choices</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => insertNode("leadCapture", { label: "👤 Please share your work email:", field: "email" })}
                        className="flex items-center gap-1.5 p-2 rounded-lg border border-slate-200 dark:border-neutral-800 hover:bg-slate-50 dark:hover:bg-neutral-850 text-[10px] font-semibold text-neutral-700 dark:text-neutral-300 transition-colors cursor-pointer text-left"
                      >
                        <UserCheck className="size-3 text-cyan-500 shrink-0" />
                        <span className="truncate">Lead Capture</span>
                      </button>
                    </div>
                  </div>

                  {/* Dry Run Simulation Control */}
                  <div className="border-t border-slate-100 dark:border-neutral-800 pt-3">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-400">Dry Run & Verification</span>
                    <button
                      type="button"
                      onClick={runTestSimulation}
                      disabled={testRunning || validation.errors.length > 0}
                      className="w-full mt-2 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold text-white shadow-sm transition-all cursor-pointer disabled:opacity-50"
                      style={{ background: color }}
                      aria-label="Run dry test"
                    >
                      {testRunning ? <Loader2 className="size-3.5 animate-spin" /> : <Play className="size-3.5 fill-white" />}
                      <span>{testRunning ? "Testing..." : "Run dry test"}</span>
                    </button>

                    {/* Test Context Accordion */}
                    <details className="mt-2.5 rounded-xl border border-slate-200 dark:border-neutral-800 bg-slate-50/70 dark:bg-neutral-950/40 p-2.5 text-[10px]">
                      <summary className="cursor-pointer font-semibold text-neutral-600 dark:text-neutral-300 select-none">
                        Test data & mapping context
                      </summary>
                      <p className="mt-1 text-[9px] leading-relaxed text-neutral-400">
                        One visitor input per line. Context is safe JSON available to webhooks as <code>{"{{context.path}}"}</code>.
                      </p>
                      <label className="mt-2 block text-[9px] font-semibold uppercase tracking-wider text-neutral-400" htmlFor="flow-test-inputs">
                        Visitor inputs
                      </label>
                      <textarea
                        id="flow-test-inputs"
                        aria-label="Visitor inputs"
                        rows={3}
                        value={testInputsText}
                        onChange={(event) => setTestInputsText(event.target.value)}
                        placeholder="Hello&#10;I want to book a demo"
                        className="mt-1 w-full rounded-lg border border-neutral-200 bg-white px-2 py-1 font-mono text-[10px] focus:outline-none dark:border-neutral-800 dark:bg-neutral-900"
                        spellCheck={false}
                      />
                      <label className="mt-2 block text-[9px] font-semibold uppercase tracking-wider text-neutral-400" htmlFor="flow-test-context">
                        Context JSON
                      </label>
                      <textarea
                        id="flow-test-context"
                        aria-label="Context JSON"
                        rows={4}
                        value={testContextText}
                        onChange={(event) => setTestContextText(event.target.value)}
                        placeholder={'{"contact":{"email":"visitor@example.com"}}'}
                        className="mt-1 w-full rounded-lg border border-neutral-200 bg-white px-2 py-1 font-mono text-[10px] focus:outline-none dark:border-neutral-800 dark:bg-neutral-900"
                        spellCheck={false}
                      />
                    </details>

                    {/* View Execution History Accordion/Toggle */}
                    <button
                      type="button"
                      onClick={() => {
                        setRunsOpen((prev) => !prev);
                        if (!runsOpen) void loadRuns(runStatusFilter);
                      }}
                      className="w-full mt-2.5 rounded-lg border border-neutral-200 dark:border-neutral-800 px-3 py-2 text-left text-[10px] font-semibold text-neutral-600 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-850 cursor-pointer flex items-center justify-between"
                    >
                      <span className="flex items-center gap-1.5">
                        <Zap className="size-3 text-[#f97316]" />
                        <span>{runsOpen ? "Hide execution history" : "View execution history"}</span>
                      </span>
                      <span className="text-[9px] font-mono text-neutral-400">{runHistory.length}</span>
                    </button>

                    {runsOpen && (
                      <div className="mt-2 rounded-xl bg-slate-50 dark:bg-neutral-950 p-2.5 border border-slate-200 dark:border-neutral-800 space-y-2">
                        <div>
                          <label htmlFor="flow-run-status" className="block text-[9px] font-bold uppercase tracking-wider text-neutral-400 mb-1">
                            Execution status filter
                          </label>
                          <select
                            id="flow-run-status"
                            aria-label="Execution status filter"
                            name="Execution status filter"
                            value={runStatusFilter}
                            onChange={(event) => {
                              const next = event.target.value as "all" | "completed" | "failed";
                              setRunStatusFilter(next);
                              void loadRuns(next);
                            }}
                            className="w-full rounded-lg border border-neutral-200 bg-white px-2 py-1 text-[10px] text-neutral-700 dark:text-neutral-300 dark:border-neutral-800 dark:bg-neutral-900 focus:outline-none"
                          >
                            <option value="all">All executions</option>
                            <option value="completed">Completed</option>
                            <option value="failed">Failed</option>
                          </select>
                        </div>
                        <div className="max-h-40 space-y-1.5 overflow-y-auto">
                          {!runHistory.length && <p className="text-[10px] text-neutral-400 text-center py-2">No executions recorded.</p>}
                          {runHistory.map((run) => (
                            <div
                              key={run.id}
                              onClick={() => {
                                setSelectedRun(run as any);
                                setActiveTab("executions");
                              }}
                              className="p-1.5 rounded-lg border border-slate-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 hover:border-slate-300 text-[10px] flex items-center justify-between gap-1 cursor-pointer"
                            >
                              <span className="truncate text-neutral-600 dark:text-neutral-300 font-medium">
                                {new Date(run.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} · {run.duration_ms ?? 0}ms
                              </span>
                              <span
                                className={`text-[8px] font-extrabold uppercase px-1.5 py-0.2 rounded-full ${
                                  run.status === "completed"
                                    ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
                                    : "bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300"
                                }`}
                              >
                                {run.status}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Right: Flow Canvas & Inspector */}
            <div className="flex-1 h-full relative min-w-0">
            {loading && (
              <div className="absolute inset-0 flex items-center justify-center bg-white/70 dark:bg-neutral-950/70 z-30">
                <div className="flex flex-col items-center gap-2">
                  <Loader2 className="size-8 animate-spin text-[#f97316]" />
                  <span className="text-xs font-bold text-neutral-600 dark:text-neutral-300">Loading flow canvas...</span>
                </div>
              </div>
            )}

            <ReactFlow
              nodes={nodes}
              edges={edges}
              nodeTypes={nodeTypes}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onConnect={onConnect}
              onNodeClick={onNodeClick}
              defaultViewport={{ x: 0, y: 0, zoom: 1 }}
              minZoom={0.15}
              maxZoom={1.8}
              className="w-full h-full"
              onInit={(instance) => {
                reactFlowInstanceRef.current = instance;
                setTimeout(() => safeFitView(0.2, 0), 100);
              }}
              deleteKeyCode={["Backspace", "Delete"]}
              panOnDrag={true}
              zoomOnPinch={true}
            >
              <Background color="#94a3b8" gap={20} size={1} />
              <MiniMap
                zoomable
                pannable
                nodeColor="#f97316"
                className="hidden lg:block !bg-white dark:!bg-neutral-900 !border-slate-200 dark:!border-neutral-800 !rounded-xl !shadow-md"
              />

              {/* Top-Right Info Badge */}
              <Panel position="top-right" className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setValidationOpen((prev) => !prev)}
                  className={`px-3 py-1.5 rounded-xl border text-xs font-bold shadow-sm backdrop-blur-md flex items-center gap-1.5 cursor-pointer transition-colors ${
                    validation.errors.length
                      ? "bg-rose-50/90 dark:bg-rose-950/80 border-rose-200 text-rose-600 dark:text-rose-300"
                      : "bg-emerald-50/90 dark:bg-emerald-950/80 border-emerald-200 text-emerald-700 dark:text-emerald-300"
                  }`}
                >
                  {validation.errors.length ? (
                    <>
                      <ShieldAlert className="size-3.5 text-rose-500" />
                      <span>{validation.errors.length} Issues</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="size-3.5 text-emerald-500" />
                      <span>Valid Workflow</span>
                    </>
                  )}
                </button>

                <div className="hidden sm:flex items-center gap-1 bg-white/90 dark:bg-neutral-900/90 border border-slate-200 dark:border-neutral-800 px-3 py-1.5 rounded-xl shadow-xs text-[11px] font-medium text-neutral-500">
                  <span>Press</span>
                  <kbd className="px-1.5 py-0.5 bg-slate-100 dark:bg-neutral-800 border border-slate-300 dark:border-neutral-700 rounded font-mono text-[10px] font-semibold text-neutral-700 dark:text-neutral-300 shadow-2xs leading-none">Del</kbd>
                  <span>to remove</span>
                </div>
              </Panel>

              {/* Floating Bottom-Left Zoom & Fit Bar (exact n8n design) */}
              <Panel position="bottom-left" className="m-4">
                <div className="flex items-center bg-white/95 dark:bg-neutral-900/95 border border-slate-200 dark:border-neutral-800 rounded-xl shadow-md p-1 gap-0.5 text-neutral-600 dark:text-neutral-300">
                  <button
                    type="button"
                    onClick={() => safeFitView(0.2, 300)}
                    title="Fit to Screen"
                    className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-neutral-800 transition-colors cursor-pointer"
                  >
                    <Maximize2 className="size-4" />
                  </button>
                  <div className="w-[1px] h-4 bg-slate-200 dark:bg-neutral-800" />
                  <button
                    type="button"
                    onClick={() => reactFlowInstanceRef.current?.zoomIn({ duration: 200 })}
                    title="Zoom In"
                    className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-neutral-800 transition-colors cursor-pointer"
                  >
                    <ZoomIn className="size-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => reactFlowInstanceRef.current?.zoomOut({ duration: 200 })}
                    title="Zoom Out"
                    className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-neutral-800 transition-colors cursor-pointer"
                  >
                    <ZoomOut className="size-4" />
                  </button>
                  <div className="w-[1px] h-4 bg-slate-200 dark:bg-neutral-800" />
                  <button
                    type="button"
                    onClick={() => {
                      reactFlowInstanceRef.current?.setViewport({ x: 0, y: 0, zoom: 1 }, { duration: 200 });
                    }}
                    title="Recenter"
                    className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-neutral-800 transition-colors cursor-pointer"
                  >
                    <RotateCcw className="size-4" />
                  </button>
                </div>
              </Panel>

              {/* Floating Bottom-Center Action: Chat & Test (exact n8n primary button) */}
              <Panel position="bottom-center" className="m-4">
                <button
                  type="button"
                  onClick={() => {
                    setActiveTab("simulation");
                    runTestSimulation();
                  }}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-full font-bold text-xs text-white shadow-xl transition-all cursor-pointer hover:scale-105 active:scale-95 bg-[#f97316] hover:bg-[#ea580c]"
                >
                  <MessageSquare className="size-4 fill-white" />
                  <span>Chat & Test Flow</span>
                </button>
              </Panel>
            </ReactFlow>

            {/* Validation Details Drawer */}
            <AnimatePresence>
              {validationOpen && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="absolute top-16 right-4 z-40 w-96 max-w-[calc(100vw-2rem)] bg-white dark:bg-neutral-900 border border-slate-200 dark:border-neutral-800 rounded-2xl shadow-2xl p-4 space-y-3"
                >
                  <div className="flex items-center justify-between border-b border-slate-100 dark:border-neutral-800 pb-2">
                    <h4 className="text-xs font-bold text-neutral-900 dark:text-neutral-100 flex items-center gap-1.5">
                      <ShieldAlert className="size-4 text-orange-500" /> Workflow Validation
                    </h4>
                    <button
                      type="button"
                      onClick={() => setValidationOpen(false)}
                      className="p-1 rounded-lg text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200"
                    >
                      <X className="size-4" />
                    </button>
                  </div>
                  <div className="max-h-60 overflow-y-auto space-y-2 text-xs">
                    {validation.errors.map((err, i) => (
                      <ModernAlert key={i} variant="error">
                        {err}
                      </ModernAlert>
                    ))}
                    {validation.warnings.map((warn, i) => (
                      <ModernAlert key={i} variant="warning">
                        {warn}
                      </ModernAlert>
                    ))}
                    {!validation.errors.length && !validation.warnings.length && (
                      <ModernAlert variant="success" title="Ready to Publish">
                        All steps have valid IDs, triggers, and reachable connection pathways.
                      </ModernAlert>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Slide-Over Right Inspector Sheet (When a node is selected) */}
            <AnimatePresence>
              {selectedNode && (
                <motion.aside
                  initial={{ opacity: 0, x: 340 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 340 }}
                  transition={{ duration: 0.22, ease: "easeOut" }}
                  className="absolute top-0 right-0 bottom-0 z-40 w-96 max-w-full bg-white dark:bg-neutral-900 border-l border-slate-200 dark:border-neutral-800 shadow-2xl flex flex-col"
                >
                  {/* Inspector Header */}
                  <div className="p-4 border-b border-slate-100 dark:border-neutral-800 flex items-center justify-between bg-slate-50/60 dark:bg-neutral-950/40">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-neutral-900 dark:text-neutral-100">
                        Edit Step Configuration
                      </span>
                      <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-orange-100 dark:bg-orange-950/80 text-orange-700 dark:text-orange-300">
                        {selectedNode.type}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSelectedNode(null)}
                      className="p-1.5 rounded-lg text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 hover:bg-slate-100 dark:hover:bg-neutral-800 transition-colors"
                    >
                      <X className="size-4" />
                    </button>
                  </div>

                  {/* Inspector Form */}
                  <div className="flex-1 overflow-y-auto p-5 space-y-4">
                    <div className="space-y-1.5">
                      <label className="block text-[11px] font-bold uppercase tracking-wider text-neutral-400">
                        Step Prompt / Text
                      </label>
                      <textarea
                        rows={3}
                        value={nodeLabel}
                        onChange={(e) => setNodeLabel(e.target.value)}
                        className="w-full bg-slate-50 dark:bg-neutral-950 border border-slate-200 dark:border-neutral-800 rounded-xl p-3 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-[#f97316]/20 focus:border-[#f97316]"
                        placeholder="Content or prompt displayed to visitor..."
                      />
                    </div>

                    {/* Multi-choice options */}
                    {selectedNode.type === "choice" && (
                      <div className="space-y-2.5 p-3.5 bg-violet-50/60 dark:bg-violet-950/30 border border-violet-100 dark:border-violet-900/40 rounded-2xl">
                        <label className="block text-[10px] font-extrabold uppercase tracking-wider text-violet-700 dark:text-violet-300">
                          Button Choices
                        </label>
                        <div className="flex flex-wrap gap-1.5">
                          {nodeOptions.map((opt, i) => (
                            <span
                              key={i}
                              className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full bg-white dark:bg-neutral-900 border border-violet-200 dark:border-violet-800 text-violet-800 dark:text-violet-200 shadow-2xs"
                            >
                              <span>{opt}</span>
                              <button
                                type="button"
                                onClick={() => removeChoiceOption(i)}
                                className="text-neutral-400 hover:text-red-500 cursor-pointer"
                              >
                                <X className="size-3" />
                              </button>
                            </span>
                          ))}
                        </div>
                        <div className="flex gap-1.5 pt-1">
                          <input
                            value={newOptionText}
                            onChange={(e) => setNewOptionText(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                e.preventDefault();
                                addChoiceOption();
                              }
                            }}
                            placeholder="Add option..."
                            className="flex-1 bg-white dark:bg-neutral-900 border border-violet-200 dark:border-violet-800 rounded-xl px-2.5 py-1.5 text-xs focus:outline-none"
                          />
                          <button
                            type="button"
                            onClick={addChoiceOption}
                            className="px-3 py-1.5 bg-violet-600 hover:bg-violet-700 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer"
                          >
                            <Plus className="size-3.5" />
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Lead Capture Field Selector */}
                    {selectedNode.type === "leadCapture" && (
                      <div className="space-y-2 p-3.5 bg-cyan-50/60 dark:bg-cyan-950/30 border border-cyan-100 dark:border-cyan-900/40 rounded-2xl">
                        <label className="block text-[10px] font-extrabold uppercase tracking-wider text-cyan-700 dark:text-cyan-300">
                          Target Field To Capture
                        </label>
                        <ModernSelect
                          value={nodeField}
                          options={[
                            { value: "email", label: "Business Email (Validated)" },
                            { value: "name", label: "Full Name" },
                            { value: "company", label: "Company / Organization" },
                            { value: "phone", label: "Phone Number" },
                          ]}
                          onChange={(val) => setNodeField(val)}
                        />
                      </div>
                    )}

                    {/* AI Qualify Objective */}
                    {selectedNode.type === "aiQualify" && (
                      <div className="space-y-2 p-3.5 bg-indigo-50/60 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-900/40 rounded-2xl">
                        <label className="block text-[10px] font-extrabold uppercase tracking-wider text-indigo-700 dark:text-indigo-300">
                          AI Reasoning Prompt & Ambiguity Resolution
                        </label>
                        <textarea
                          rows={3}
                          value={nodeAiPrompt}
                          onChange={(e) => setNodeAiPrompt(e.target.value)}
                          placeholder="e.g. Consultatively guide visitor if they reply with 'idk' or ambiguous intent..."
                          className="w-full bg-white dark:bg-neutral-900 border border-indigo-200 dark:border-indigo-800 rounded-xl p-2.5 text-xs font-medium focus:outline-none"
                        />
                      </div>
                    )}

                    {/* Automation JSON */}
                    {["delay", "condition", "loop", "webhook", "retry"].includes(String(selectedNode.type)) && (
                      <div className="space-y-2 p-3.5 bg-slate-50 dark:bg-neutral-950 border border-slate-200 dark:border-neutral-800 rounded-2xl">
                        <label className="block text-[10px] font-extrabold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                          Automation Config (JSON)
                        </label>
                        <textarea
                          rows={4}
                          value={nodeConfigText}
                          onChange={(e) => setNodeConfigText(e.target.value)}
                          className="w-full font-mono text-[11px] bg-white dark:bg-neutral-900 border border-slate-200 dark:border-neutral-800 rounded-xl p-2.5 focus:outline-none"
                        />
                      </div>
                    )}
                  </div>

                  {/* Inspector Footer Actions */}
                  <div className="p-4 border-t border-slate-100 dark:border-neutral-800 flex items-center justify-between gap-2 bg-slate-50/60 dark:bg-neutral-950/40">
                    <button
                      type="button"
                      onClick={deleteSelectedNode}
                      className="p-2.5 rounded-xl border border-rose-200 dark:border-rose-900/60 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer"
                      title="Delete step"
                    >
                      <Trash2 className="size-4" />
                    </button>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setSelectedNode(null)}
                        className="px-3.5 py-2 rounded-xl text-xs font-bold text-neutral-600 dark:text-neutral-300 hover:bg-slate-200 dark:hover:bg-neutral-800 transition-colors cursor-pointer"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={updateSelectedNode}
                        className="px-4 py-2 rounded-xl text-xs font-bold text-white shadow-sm transition-colors cursor-pointer"
                        style={{ background: color }}
                      >
                        Apply Changes
                      </button>
                    </div>
                  </div>
                </motion.aside>
              )}
            </AnimatePresence>
            </div>
          </div>
        )}

        {/* TAB 2: EXECUTIONS (RUNS) */}
        {activeTab === "executions" && (
          <div className="p-6 max-w-5xl mx-auto space-y-6 overflow-y-auto h-full">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-base font-bold text-neutral-900 dark:text-neutral-100 flex items-center gap-2">
                  <Zap className="size-5 text-[#f97316]" /> Execution History
                </h4>
                <p className="text-xs text-neutral-500 mt-0.5">
                  Trace test runs and real visitor workflow executions step-by-step.
                </p>
              </div>

              <div className="flex items-center gap-3">
                <label htmlFor="executions-tab-status-filter" className="sr-only">
                  Execution status filter
                </label>
                <select
                  id="executions-tab-status-filter"
                  aria-label="Execution status filter"
                  name="Execution status filter"
                  value={runStatusFilter}
                  onChange={(e) => {
                    const next = e.target.value as "all" | "completed" | "failed";
                    setRunStatusFilter(next);
                    void loadRuns(next);
                  }}
                  className="rounded-xl border border-slate-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 px-3 py-1.5 text-xs font-bold text-neutral-700 dark:text-neutral-300 shadow-2xs focus:outline-none cursor-pointer"
                >
                  <option value="all">All Statuses</option>
                  <option value="completed">Completed</option>
                  <option value="failed">Failed</option>
                </select>
                <button
                  type="button"
                  onClick={() => loadRuns(runStatusFilter)}
                  className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 text-xs font-bold text-neutral-700 dark:text-neutral-300 hover:bg-slate-50 cursor-pointer shadow-2xs"
                >
                  {loadingRuns ? <Loader2 className="size-3.5 animate-spin" /> : "Refresh"}
                </button>
              </div>
            </div>

            {loadingRuns && (
              <div className="py-12 flex justify-center">
                <Loader2 className="size-6 animate-spin text-[#f97316]" />
              </div>
            )}

            {!loadingRuns && runHistory.length === 0 && (
              <div className="text-center py-16 bg-white dark:bg-neutral-900 border border-slate-200 dark:border-neutral-800 rounded-2xl p-8 space-y-3">
                <Zap className="size-8 text-neutral-300 mx-auto" />
                <h5 className="font-bold text-sm text-neutral-800 dark:text-neutral-200">No Executions Recorded</h5>
                <p className="text-xs text-neutral-400 max-w-sm mx-auto">
                  Run a simulation test or activate your bot to record live visitor pathways.
                </p>
                <button
                  type="button"
                  onClick={() => setActiveTab("simulation")}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-white shadow-sm cursor-pointer"
                  style={{ background: color }}
                >
                  Run Simulation Test
                </button>
              </div>
            )}

            <div className="space-y-3">
              {runHistory.map((run) => (
                <div
                  key={run.id}
                  className="p-4 bg-white dark:bg-neutral-900 border border-slate-200 dark:border-neutral-800 rounded-2xl shadow-xs flex items-center justify-between gap-4"
                >
                  <div className="flex items-center gap-3">
                    <span
                      className={`size-2.5 rounded-full shrink-0 ${
                        run.status === "completed" ? "bg-emerald-500" : "bg-rose-500"
                      }`}
                    />
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-xs text-neutral-900 dark:text-neutral-100">
                          {new Date(run.created_at).toLocaleString()}
                        </span>
                        <span
                          className={`text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                            run.status === "completed"
                              ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300"
                              : "bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300"
                          }`}
                        >
                          {run.status}
                        </span>
                      </div>
                      <p className="text-[11px] text-neutral-400 mt-0.5 font-medium">
                        Duration: {run.duration_ms ?? 0}ms · {run.trace?.length ?? 0} steps executed
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={async () => {
                        if (!botId || !fetchDashboardBackend) return;
                        const response = await fetchDashboardBackend(`/api/bots/${botId}/flow/runs/${run.id}`);
                        if (response.ok) setSelectedRun(await response.json());
                      }}
                      className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-neutral-800 text-xs font-bold text-neutral-700 dark:text-neutral-300 hover:bg-slate-50 dark:hover:bg-neutral-800 transition-colors cursor-pointer"
                    >
                      Inspect Details
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Run Detail Modal */}
            <AnimatePresence>
              {selectedRun && (
                <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="bg-white dark:bg-neutral-900 border border-slate-200 dark:border-neutral-800 rounded-2xl p-6 max-w-xl w-full max-h-[80vh] flex flex-col shadow-2xl"
                  >
                    <div className="flex items-center justify-between border-b border-slate-100 dark:border-neutral-800 pb-3">
                      <h4 className="font-bold text-sm text-neutral-900 dark:text-neutral-100">
                        Execution Trace Details
                      </h4>
                      <button
                        type="button"
                        onClick={() => setSelectedRun(null)}
                        className="p-1.5 rounded-lg text-neutral-400 hover:text-neutral-600"
                      >
                        <X className="size-4" />
                      </button>
                    </div>
                    <div className="flex-1 overflow-y-auto py-4 space-y-3">
                      {selectedRun.error && (
                        <ModernAlert variant="error" title="Execution Error">
                          {selectedRun.error}
                        </ModernAlert>
                      )}
                      <ol className="space-y-2">
                        {(selectedRun.trace ?? []).map((step, idx) => (
                          <li
                            key={idx}
                            className="p-3 rounded-xl border border-slate-200 dark:border-neutral-800 bg-slate-50/50 dark:bg-neutral-950/40 text-xs space-y-1"
                          >
                            <span className="font-bold text-neutral-900 dark:text-neutral-100">
                              {idx + 1}. {step.label || step.node_type || step.node_id}
                            </span>
                            {step.runtime && (
                              <p className="text-[11px] text-neutral-500 dark:text-neutral-400">
                                Outcome: {String(step.runtime.outcome || step.runtime.side_effect || "Proceeded")}
                              </p>
                            )}
                          </li>
                        ))}
                      </ol>
                    </div>
                  </motion.div>
                </div>
              )}
            </AnimatePresence>
          </div>
        )}

        {/* TAB 3: VERSIONS */}
        {activeTab === "versions" && (
          <div className="p-6 max-w-4xl mx-auto space-y-6 overflow-y-auto h-full">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-base font-bold text-neutral-900 dark:text-neutral-100 flex items-center gap-2">
                  <History className="size-5 text-indigo-500" /> Version History
                </h4>
                <p className="text-xs text-neutral-500 mt-0.5">
                  Rollback to any previously published revision at any time.
                </p>
              </div>
              <button
                type="button"
                onClick={loadVersions}
                className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 text-xs font-bold hover:bg-slate-50 cursor-pointer shadow-2xs"
              >
                {loadingVersions ? <Loader2 className="size-3.5 animate-spin" /> : "Refresh"}
              </button>
            </div>

            {versions.length === 0 && !loadingVersions && (
              <div className="text-center py-12 bg-white dark:bg-neutral-900 border border-slate-200 dark:border-neutral-800 rounded-2xl p-6">
                <p className="text-xs text-neutral-400">No published revisions recorded yet.</p>
              </div>
            )}

            <div className="space-y-3">
              {versions.map((ver) => (
                <div
                  key={ver.id}
                  className="p-4 bg-white dark:bg-neutral-900 border border-slate-200 dark:border-neutral-800 rounded-2xl shadow-xs flex items-center justify-between"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-extrabold text-xs text-neutral-900 dark:text-neutral-100">
                        v{ver.version}
                      </span>
                      <span
                        className={`text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                          ver.status === "published"
                            ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
                            : "bg-neutral-100 text-neutral-600 dark:bg-neutral-800"
                        }`}
                      >
                        {ver.status}
                      </span>
                    </div>
                    <p className="text-[11px] text-neutral-500 mt-0.5">
                      {ver.note || "Workflow snapshot"} · {new Date(ver.created_at).toLocaleString()}
                    </p>
                  </div>
                  {ver.status === "published" && (
                    <button
                      type="button"
                      onClick={() => rollbackVersion(ver.id)}
                      className="px-3 py-1.5 rounded-xl border border-indigo-200 text-indigo-600 dark:border-indigo-800 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 text-xs font-bold transition-colors cursor-pointer"
                    >
                      Rollback
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 4: SIMULATION TEST */}
        {activeTab === "simulation" && (
          <div className="p-6 max-w-5xl mx-auto space-y-6 overflow-y-auto h-full">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-base font-bold text-neutral-900 dark:text-neutral-100 flex items-center gap-2">
                  <Play className="size-5 text-[#f97316]" /> Dry-Run Simulation Test
                </h4>
                <p className="text-xs text-neutral-500 mt-0.5">
                  Simulate visitor conversation flow step-by-step without triggering production webhooks.
                </p>
              </div>
              <button
                type="button"
                onClick={runTestSimulation}
                disabled={testRunning || validation.errors.length > 0}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-white shadow-sm transition-all cursor-pointer disabled:opacity-50"
                style={{ background: color }}
              >
                {testRunning ? <Loader2 className="size-3.5 animate-spin" /> : <Play className="size-3.5 fill-white" />}
                <span>{testRunning ? "Testing Flow..." : "Execute Simulation"}</span>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Test Inputs */}
              <div className="bg-white dark:bg-neutral-900 border border-slate-200 dark:border-neutral-800 rounded-2xl p-5 space-y-4 shadow-xs">
                <div className="space-y-1.5">
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-neutral-400">
                    Visitor Inputs (1 reply per line)
                  </label>
                  <textarea
                    rows={4}
                    value={testInputsText}
                    onChange={(e) => setTestInputsText(e.target.value)}
                    className="w-full font-mono text-xs bg-slate-50 dark:bg-neutral-950 border border-slate-200 dark:border-neutral-800 rounded-xl p-3 focus:outline-none"
                    placeholder="Hello&#10;I want to book a demo"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-neutral-400">
                    Mock Session Context (JSON)
                  </label>
                  <textarea
                    rows={4}
                    value={testContextText}
                    onChange={(e) => setTestContextText(e.target.value)}
                    className="w-full font-mono text-xs bg-slate-50 dark:bg-neutral-950 border border-slate-200 dark:border-neutral-800 rounded-xl p-3 focus:outline-none"
                  />
                </div>
              </div>

              {/* Simulation Result Waterfall */}
              <div className="bg-white dark:bg-neutral-900 border border-slate-200 dark:border-neutral-800 rounded-2xl p-5 space-y-4 shadow-xs">
                <h5 className="text-xs font-bold uppercase tracking-wider text-neutral-400">
                  Execution Pathway ({testTrace ? testTrace.length : 0} steps)
                </h5>

                {!testTrace && (
                  <div className="text-center py-12 text-neutral-400 text-xs">
                    Click &quot;Execute Simulation&quot; to trace the execution pathway.
                  </div>
                )}

                {testTrace && (
                  <ol className="space-y-2.5 max-h-96 overflow-y-auto">
                    {testTrace.map((step, idx) => (
                      <li
                        key={idx}
                        className="p-3 rounded-xl border border-indigo-100 dark:border-indigo-900/50 bg-indigo-50/40 dark:bg-indigo-950/20 text-xs space-y-1"
                      >
                        <div className="flex items-center justify-between font-bold text-neutral-900 dark:text-neutral-100">
                          <span>{idx + 1}. {step.label || step.node_id}</span>
                          <span className="text-[9px] px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700 dark:bg-indigo-900 dark:text-indigo-300 font-extrabold uppercase">
                            {step.node_type || "step"}
                          </span>
                        </div>
                        {step.runtime?.branch_reason && (
                          <p className="text-[11px] text-indigo-600 dark:text-indigo-400 font-medium">
                            Branch: {step.runtime.branch_reason.replace(/_/g, " ")}
                          </p>
                        )}
                        {step.runtime?.outcome && (
                          <p className="text-[11px] text-neutral-600 dark:text-neutral-300">
                            {step.runtime.outcome}
                          </p>
                        )}
                      </li>
                    ))}
                  </ol>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── Node Palette Modal (Add Step) ── */}
      <AnimatePresence>
        {nodePaletteOpen && (
          <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white dark:bg-neutral-900 border border-slate-200 dark:border-neutral-800 rounded-2xl p-6 max-w-2xl w-full max-h-[85vh] flex flex-col shadow-2xl space-y-4"
            >
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-neutral-800 pb-3">
                <div className="flex items-center gap-2">
                  <div className="size-7 rounded-lg bg-orange-500 text-white flex items-center justify-center shadow-xs">
                    <Plus className="size-4" />
                  </div>
                  <div>
                    <h4 className="font-bold text-sm text-neutral-900 dark:text-neutral-100">
                      Add Workflow Step
                    </h4>
                    <p className="text-[11px] text-neutral-400">
                      Select an interactive step to insert into the canvas.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setNodePaletteOpen(false)}
                  className="p-1.5 rounded-lg text-neutral-400 hover:text-neutral-600"
                >
                  <X className="size-4" />
                </button>
              </div>

              {/* Search bar */}
              <div className="relative">
                <Search className="size-4 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  value={paletteSearch}
                  onChange={(e) => setPaletteSearch(e.target.value)}
                  placeholder="Search steps (e.g. Question, Meeting, Webhook)..."
                  className="w-full bg-slate-50 dark:bg-neutral-950 border border-slate-200 dark:border-neutral-800 rounded-xl pl-9 pr-3 py-2 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-[#f97316]/20 focus:border-[#f97316]"
                />
              </div>

              {/* Categorized Steps Grid */}
              <div className="flex-1 overflow-y-auto space-y-5 pr-1">
                {filteredCatalog.map((category) => (
                  <div key={category.category} className="space-y-2">
                    <h5 className="text-[10px] font-extrabold uppercase tracking-wider text-neutral-400">
                      {category.category}
                    </h5>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      {category.items.map((item) => (
                        <button
                          key={item.label}
                          type="button"
                          onClick={() => insertNode(item.type, item.data)}
                          className="flex items-start gap-3 p-3 rounded-xl border border-slate-200 dark:border-neutral-800 bg-white dark:bg-neutral-850 hover:border-orange-300 dark:hover:border-orange-700/60 hover:shadow-xs transition-all text-left cursor-pointer group"
                        >
                          <div className="p-2 rounded-xl bg-slate-100 dark:bg-neutral-800 group-hover:scale-105 transition-transform shrink-0">
                            {item.icon}
                          </div>
                          <div>
                            <div className="font-bold text-xs text-neutral-900 dark:text-neutral-100">
                              {item.label}
                            </div>
                            <p className="text-[10px] text-neutral-500 dark:text-neutral-400 leading-normal mt-0.5">
                              {item.desc}
                            </p>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── Templates Modal ── */}
      <AnimatePresence>
        {templatesOpen && (
          <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white dark:bg-neutral-900 border border-slate-200 dark:border-neutral-800 rounded-2xl p-6 max-w-lg w-full shadow-2xl space-y-4"
            >
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-neutral-800 pb-3">
                <h4 className="font-bold text-sm text-neutral-900 dark:text-neutral-100 flex items-center gap-2">
                  <Layers className="size-4 text-indigo-500" /> 1-Click Templates
                </h4>
                <button
                  type="button"
                  onClick={() => setTemplatesOpen(false)}
                  className="p-1.5 rounded-lg text-neutral-400 hover:text-neutral-600"
                >
                  <X className="size-4" />
                </button>
              </div>
              <div className="space-y-3">
                <div
                  onClick={() => loadTemplate(FALLBACK_FIN_DEMO)}
                  className="p-4 rounded-xl border border-orange-200 dark:border-orange-900/60 bg-orange-50/60 dark:bg-orange-950/20 hover:border-orange-400 transition-colors cursor-pointer space-y-1"
                >
                  <h5 className="font-bold text-xs text-orange-900 dark:text-orange-200">
                    🚀 B2B Demo Qualification (Fin Style)
                  </h5>
                  <p className="text-[11px] text-orange-800/80 dark:text-orange-300/80 leading-relaxed">
                    Email capture, 4-way use case branching, sales qualification, and calendar slot booking.
                  </p>
                </div>

                <div
                  onClick={() => loadTemplate(FALLBACK_SUPPORT_TRIAGE)}
                  className="p-4 rounded-xl border border-slate-200 dark:border-neutral-800 bg-white dark:bg-neutral-850 hover:border-slate-400 transition-colors cursor-pointer space-y-1"
                >
                  <h5 className="font-bold text-xs text-neutral-900 dark:text-neutral-100">
                    🎧 Support Triage & Deflection
                  </h5>
                  <p className="text-[11px] text-neutral-500 dark:text-neutral-400 leading-relaxed">
                    Categorizes issues, checks knowledge base answers, and escalates to human agent if needed.
                  </p>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── AI Flow Architect Modal ── */}
      <AnimatePresence>
        {aiCopilotOpen && (
          <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white dark:bg-neutral-900 border border-slate-200 dark:border-neutral-800 rounded-2xl p-6 max-w-lg w-full shadow-2xl space-y-4"
            >
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-neutral-800 pb-3">
                <h4 className="font-bold text-sm text-neutral-900 dark:text-neutral-100 flex items-center gap-2">
                  <Sparkles className="size-4 text-[#f97316]" /> AI Workflow Architect
                </h4>
                <button
                  type="button"
                  onClick={() => setAiCopilotOpen(false)}
                  className="p-1.5 rounded-lg text-neutral-400 hover:text-neutral-600"
                >
                  <X className="size-4" />
                </button>
              </div>

              <div className="space-y-3">
                <p className="text-xs text-neutral-500">
                  Describe what you want the bot to do in plain English, and AI will create and layout the workflow.
                </p>
                <textarea
                  rows={4}
                  value={aiPrompt}
                  onChange={(e) => setAiPrompt(e.target.value)}
                  placeholder="e.g. Ask for the visitor's company email, check if they are looking for enterprise plans, and schedule a 30-min call..."
                  className="w-full bg-slate-50 dark:bg-neutral-950 border border-slate-200 dark:border-neutral-800 rounded-xl p-3 text-xs focus:outline-none focus:ring-2 focus:ring-[#f97316]/20"
                />
                <button
                  type="button"
                  onClick={generateFlowWithAI}
                  disabled={!aiPrompt.trim() || generating}
                  className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-bold text-white shadow-sm transition-all cursor-pointer disabled:opacity-50"
                  style={{ background: color }}
                >
                  {generating ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
                  <span>{generating ? "Generating Workflow..." : "Generate Workflow with AI"}</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Hidden file input for JSON import */}
      <input
        ref={importInputRef}
        type="file"
        accept="application/json,.json"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) importFlow(file);
          e.currentTarget.value = "";
        }}
      />

      {/* Floating Global Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 15, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 15, scale: 0.95 }}
            className="fixed bottom-6 right-6 z-[9999] flex items-center gap-2.5 bg-white dark:bg-neutral-900 border border-slate-200 dark:border-neutral-800 rounded-2xl px-4 py-3 shadow-2xl text-xs font-semibold text-neutral-800 dark:text-white"
          >
            {toast.type === "success" ? (
              <span className="flex size-5 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 shrink-0">
                <Check className="size-3.5" />
              </span>
            ) : (
              <span className="flex size-5 items-center justify-center rounded-full bg-rose-100 dark:bg-rose-950 text-rose-600 dark:text-rose-400 shrink-0">
                <AlertCircle className="size-3.5" />
              </span>
            )}
            <span className="leading-relaxed">{toast.message}</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
