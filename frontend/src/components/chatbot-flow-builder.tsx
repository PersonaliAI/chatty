"use client";

import { useState, useCallback, useEffect, useMemo, useRef, type MouseEvent } from "react";
import {
  ReactFlow,
  MiniMap,
  Controls,
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
  CloudCheck,
  ListFilter,
  Calendar,
  Clock,
  Mail,
  Plus,
  X,
  GitBranch,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { createClient } from "@/lib/supabase/client";
import { BACKEND_URL } from "@/lib/backend-client";

interface Props {
  botId: string | null;
  color?: string;
}

interface FlowNodeData {
  label?: string;
  options?: string[];
  field?: string;
  validation?: string;
  prompt?: string;
}

interface FlowNodeProps {
  data: FlowNodeData;
  selected?: boolean;
}

// ── Custom Industrial Node Components ──

function StartNode({ data, selected }: FlowNodeProps) {
  return (
    <div
      className={`min-w-[200px] bg-gradient-to-r from-orange-500 to-amber-500 text-white rounded-xl shadow-lg border-2 transition-all ${
        selected ? "border-white ring-4 ring-orange-400/40 scale-105" : "border-transparent"
      }`}
    >
      <div className="p-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 font-bold text-xs">
          <div className="p-1.5 bg-white/20 rounded-lg">
            <Play className="size-3.5 fill-white text-white" />
          </div>
          <span>Start Trigger</span>
        </div>
        <span className="text-[9px] font-semibold bg-white/20 px-2 py-0.5 rounded-full uppercase tracking-wider">
          Entry Point
        </span>
      </div>
      <div className="px-3 pb-3 text-[11px] font-medium opacity-90">
        {data.label || "🚀 Start Conversation"}
      </div>
      <Handle
        type="source"
        position={Position.Bottom}
        className="!bg-orange-600 !w-3.5 !h-3.5 !border-2 !border-white transition-transform hover:scale-125"
      />
    </div>
  );
}

function MessageNode({ data, selected }: FlowNodeProps) {
  return (
    <div
      className={`min-w-[220px] max-w-[280px] bg-white dark:bg-neutral-900 text-neutral-800 dark:text-white rounded-xl shadow-md border-2 transition-all ${
        selected ? "border-blue-500 ring-4 ring-blue-500/20 scale-105" : "border-blue-100 dark:border-blue-900/50"
      }`}
    >
      <Handle
        type="target"
        position={Position.Top}
        className="!bg-blue-500 !w-3 !h-3 !border-2 !border-white"
      />
      <div className="p-2.5 bg-blue-50/80 dark:bg-blue-950/40 border-b border-blue-100 dark:border-blue-900/30 flex items-center justify-between rounded-t-lg">
        <div className="flex items-center gap-1.5 text-blue-600 dark:text-blue-400 font-bold text-[11px]">
          <MessageSquare className="size-3.5" />
          <span>Bot Message</span>
        </div>
        <span className="text-[9px] text-blue-500 font-semibold bg-blue-100 dark:bg-blue-900/50 px-1.5 py-0.5 rounded">
          Display
        </span>
      </div>
      <div className="p-3 text-[11px] leading-relaxed break-words font-normal text-neutral-700 dark:text-neutral-200">
        {(data.label || "").replace(/^💬\s*(Message:\s*)?/, "")}
      </div>
      <Handle
        type="source"
        position={Position.Bottom}
        className="!bg-blue-500 !w-3 !h-3 !border-2 !border-white"
      />
    </div>
  );
}

function QuestionNode({ data, selected }: FlowNodeProps) {
  return (
    <div
      className={`min-w-[220px] max-w-[280px] bg-white dark:bg-neutral-900 text-neutral-800 dark:text-white rounded-xl shadow-md border-2 transition-all ${
        selected ? "border-purple-500 ring-4 ring-purple-500/20 scale-105" : "border-purple-100 dark:border-purple-900/50"
      }`}
    >
      <Handle
        type="target"
        position={Position.Top}
        className="!bg-purple-500 !w-3 !h-3 !border-2 !border-white"
      />
      <div className="p-2.5 bg-purple-50/80 dark:bg-purple-950/40 border-b border-purple-100 dark:border-purple-900/30 flex items-center justify-between rounded-t-lg">
        <div className="flex items-center gap-1.5 text-purple-600 dark:text-purple-400 font-bold text-[11px]">
          <HelpCircle className="size-3.5" />
          <span>Ask Question</span>
        </div>
        <span className="text-[9px] text-purple-500 font-semibold bg-purple-100 dark:bg-purple-900/50 px-1.5 py-0.5 rounded">
          Awaits Input
        </span>
      </div>
      <div className="p-3 text-[11px] leading-relaxed break-words font-medium text-neutral-800 dark:text-neutral-100">
        {(data.label || "").replace(/^❓\s*(Ask:\s*)?/, "")}
      </div>
      <Handle
        type="source"
        position={Position.Bottom}
        className="!bg-purple-500 !w-3 !h-3 !border-2 !border-white"
      />
    </div>
  );
}

function ChoiceNode({ data, selected }: FlowNodeProps) {
  const options = (data.options && data.options.length > 0)
    ? data.options
    : ["Inbound sales", "Customer support", "Other"];
  return (
    <div
      className={`min-w-[240px] max-w-[300px] bg-white dark:bg-neutral-900 text-neutral-800 dark:text-white rounded-xl shadow-md border-2 transition-all ${
        selected ? "border-violet-500 ring-4 ring-violet-500/20 scale-105" : "border-violet-100 dark:border-violet-900/50"
      }`}
    >
      <Handle
        type="target"
        position={Position.Top}
        className="!bg-violet-500 !w-3 !h-3 !border-2 !border-white"
      />
      <div className="p-2.5 bg-violet-50/80 dark:bg-violet-950/40 border-b border-violet-100 dark:border-violet-900/30 flex items-center justify-between rounded-t-lg">
        <div className="flex items-center gap-1.5 text-violet-600 dark:text-violet-400 font-bold text-[11px]">
          <ListFilter className="size-3.5" />
          <span>Multi-Choice Buttons</span>
        </div>
        <span className="text-[9px] text-violet-600 font-semibold bg-violet-100 dark:bg-violet-900/50 px-1.5 py-0.5 rounded">
          Interactive
        </span>
      </div>
      <div className="p-3 space-y-2">
        <p className="text-[11px] leading-relaxed break-words font-medium text-neutral-800 dark:text-neutral-100">
          {(data.label || "").replace(/^🔘\s*(Choice:\s*)?/, "")}
        </p>
        <div className="flex flex-wrap gap-1 pt-1">
          {options.map((opt, idx) => (
            <span
              key={idx}
              className="text-[9px] font-semibold px-2 py-0.5 rounded-full bg-violet-100 dark:bg-violet-950 text-violet-700 dark:text-violet-300 border border-violet-200 dark:border-violet-800 truncate max-w-[130px]"
            >
              {opt}
            </span>
          ))}
        </div>
      </div>
      <Handle
        type="source"
        position={Position.Bottom}
        className="!bg-violet-500 !w-3.5 !h-3.5 !border-2 !border-white transition-transform hover:scale-125"
      />
    </div>
  );
}

function LeadCaptureNode({ data, selected }: FlowNodeProps) {
  return (
    <div
      className={`min-w-[230px] max-w-[290px] bg-white dark:bg-neutral-900 text-neutral-800 dark:text-white rounded-xl shadow-md border-2 transition-all ${
        selected ? "border-cyan-500 ring-4 ring-cyan-500/20 scale-105" : "border-cyan-100 dark:border-cyan-900/50"
      }`}
    >
      <Handle
        type="target"
        position={Position.Top}
        className="!bg-cyan-500 !w-3 !h-3 !border-2 !border-white"
      />
      <div className="p-2.5 bg-cyan-50/80 dark:bg-cyan-950/40 border-b border-cyan-100 dark:border-cyan-900/30 flex items-center justify-between rounded-t-lg">
        <div className="flex items-center gap-1.5 text-cyan-600 dark:text-cyan-400 font-bold text-[11px]">
          <UserCheck className="size-3.5" />
          <span>Lead Capture</span>
        </div>
        <span className="text-[9px] text-cyan-600 font-semibold bg-cyan-100 dark:bg-cyan-900/50 px-1.5 py-0.5 rounded">
          Auto-Validate
        </span>
      </div>
      <div className="p-3 text-[11px] leading-relaxed break-words font-medium text-neutral-800 dark:text-neutral-100 space-y-1.5">
        <p>{(data.label || "").replace(/^👤\s*(Capture:\s*)?/, "")}</p>
        <div className="flex items-center gap-1 text-[9px] text-cyan-700 dark:text-cyan-300 font-semibold bg-cyan-50 dark:bg-cyan-950/60 px-2 py-0.5 rounded border border-cyan-200/60 dark:border-cyan-800/40">
          <Mail className="size-2.5" />
          <span>Field: {data.field || "Business Email"}</span>
        </div>
      </div>
      <Handle
        type="source"
        position={Position.Bottom}
        className="!bg-cyan-500 !w-3 !h-3 !border-2 !border-white"
      />
    </div>
  );
}

function AiQualifyNode({ data, selected }: FlowNodeProps) {
  return (
    <div
      className={`min-w-[240px] max-w-[300px] bg-gradient-to-br from-indigo-50/60 via-purple-50/40 to-white dark:from-indigo-950/30 dark:via-purple-950/20 dark:to-neutral-900 text-neutral-800 dark:text-white rounded-xl shadow-md border-2 transition-all ${
        selected ? "border-indigo-500 ring-4 ring-indigo-500/20 scale-105" : "border-indigo-200 dark:border-indigo-800/60"
      }`}
    >
      <Handle
        type="target"
        position={Position.Top}
        className="!bg-indigo-500 !w-3 !h-3 !border-2 !border-white"
      />
      <div className="p-2.5 bg-indigo-50/80 dark:bg-indigo-950/60 border-b border-indigo-100 dark:border-indigo-900/40 flex items-center justify-between rounded-t-lg">
        <div className="flex items-center gap-1.5 text-indigo-600 dark:text-indigo-400 font-bold text-[11px]">
          <Sparkles className="size-3.5" />
          <span>AI Smart Qualify</span>
        </div>
        <span className="text-[8px] text-indigo-700 dark:text-indigo-300 font-bold bg-indigo-100 dark:bg-indigo-900/60 px-1.5 py-0.5 rounded uppercase">
          Dynamic AI
        </span>
      </div>
      <div className="p-3 text-[11px] leading-relaxed break-words font-medium text-neutral-800 dark:text-neutral-100 space-y-1.5">
        <p>{(data.label || "").replace(/^🤖\s*(AI Qualify:\s*)?/, "")}</p>
        <div className="text-[9px] text-indigo-600 dark:text-indigo-300 font-semibold bg-white/70 dark:bg-neutral-950/60 p-1.5 rounded-lg border border-indigo-100 dark:border-indigo-900/40">
          💡 Resolves ambiguous replies (e.g. &quot;idk&quot;) with clarifying guidance
        </div>
      </div>
      <Handle
        type="source"
        position={Position.Bottom}
        className="!bg-indigo-500 !w-3 !h-3 !border-2 !border-white"
      />
    </div>
  );
}

function BookMeetingNode({ data, selected }: FlowNodeProps) {
  return (
    <div
      className={`min-w-[240px] max-w-[300px] bg-white dark:bg-neutral-900 text-neutral-800 dark:text-white rounded-xl shadow-md border-2 transition-all ${
        selected ? "border-emerald-500 ring-4 ring-emerald-500/20 scale-105" : "border-emerald-200 dark:border-emerald-800/60"
      }`}
    >
      <Handle
        type="target"
        position={Position.Top}
        className="!bg-emerald-500 !w-3 !h-3 !border-2 !border-white"
      />
      <div className="p-2.5 bg-emerald-50/80 dark:bg-emerald-950/40 border-b border-emerald-100 dark:border-emerald-900/30 flex items-center justify-between rounded-t-lg">
        <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-bold text-[11px]">
          <Calendar className="size-3.5" />
          <span>Schedule Demo / Meeting</span>
        </div>
        <span className="text-[9px] text-emerald-600 font-semibold bg-emerald-100 dark:bg-emerald-900/50 px-1.5 py-0.5 rounded">
          Inline Calendar
        </span>
      </div>
      <div className="p-3 text-[11px] leading-relaxed break-words font-medium text-neutral-800 dark:text-neutral-100 space-y-1">
        <p>{(data.label || "").replace(/^📅\s*(Schedule:\s*)?/, "")}</p>
        <div className="text-[9px] text-emerald-700 dark:text-emerald-300 font-semibold bg-emerald-50 dark:bg-emerald-950/60 p-1.5 rounded-lg border border-emerald-200/60 dark:border-emerald-800/40 flex items-center gap-1">
          <Clock className="size-3" />
          <span>Renders real-time calendar slots in chat</span>
        </div>
      </div>
      <Handle
        type="source"
        position={Position.Bottom}
        className="!bg-emerald-500 !w-3 !h-3 !border-2 !border-white"
      />
    </div>
  );
}

function TagNode({ data, selected }: FlowNodeProps) {
  return (
    <div
      className={`min-w-[200px] bg-emerald-50 dark:bg-emerald-950/40 text-emerald-900 dark:text-emerald-100 rounded-xl shadow-sm border-2 transition-all ${
        selected ? "border-emerald-500 ring-4 ring-emerald-500/20 scale-105" : "border-emerald-200 dark:border-emerald-800/50"
      }`}
    >
      <Handle
        type="target"
        position={Position.Top}
        className="!bg-emerald-500 !w-3 !h-3 !border-2 !border-white"
      />
      <div className="p-2.5 flex items-center gap-2 border-b border-emerald-200/50 dark:border-emerald-800/30">
        <Tag className="size-3.5 text-emerald-600 dark:text-emerald-400" />
        <span className="font-bold text-[11px] text-emerald-700 dark:text-emerald-300">Set Session Tag</span>
      </div>
      <div className="p-3 text-[11px] font-semibold text-emerald-800 dark:text-emerald-200">
        {(data.label || "").replace(/^🏷️\s*(Tag session:\s*)?/, "")}
      </div>
      <Handle
        type="source"
        position={Position.Bottom}
        className="!bg-emerald-500 !w-3 !h-3 !border-2 !border-white"
      />
    </div>
  );
}

function EscalateNode({ selected }: FlowNodeProps) {
  return (
    <div
      className={`min-w-[210px] bg-rose-50 dark:bg-rose-950/40 text-rose-900 dark:text-rose-100 rounded-xl shadow-sm border-2 transition-all ${
        selected ? "border-rose-500 ring-4 ring-rose-500/20 scale-105" : "border-rose-200 dark:border-rose-800/50"
      }`}
    >
      <Handle
        type="target"
        position={Position.Top}
        className="!bg-rose-500 !w-3 !h-3 !border-2 !border-white"
      />
      <div className="p-2.5 flex items-center gap-2 border-b border-rose-200/50 dark:border-rose-800/30">
        <PhoneCall className="size-3.5 text-rose-600 dark:text-rose-400" />
        <span className="font-bold text-[11px] text-rose-700 dark:text-rose-300">Human Escalation</span>
      </div>
      <div className="p-3 text-[11px] font-bold text-rose-800 dark:text-rose-200 flex items-center gap-1.5">
        <Zap className="size-3 text-rose-500 fill-rose-500" />
        <span>Transfer to Live Agent</span>
      </div>
      <Handle
        type="source"
        position={Position.Bottom}
        className="!bg-rose-500 !w-3 !h-3 !border-2 !border-white"
      />
    </div>
  );
}

const initialNodes: Node[] = [
  {
    id: "start",
    type: "start",
    data: { label: "🚀 Start Conversation" },
    position: { x: 80, y: 40 },
  },
];
const initialEdges: Edge[] = [];

interface FlowSchema {
  nodes: Node[];
  edges: Edge[];
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

export function ChatbotFlowBuilder({ botId, color = "#f97316" }: Props) {
  const [mobileTab, setMobileTab] = useState<"canvas" | "toolbox">("canvas");
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  const [nodeLabel, setNodeLabel] = useState("");
  const [nodeOptions, setNodeOptions] = useState<string[]>([]);
  const [newOptionText, setNewOptionText] = useState("");
  const [nodeField, setNodeField] = useState("email");
  const [nodeAiPrompt, setNodeAiPrompt] = useState("");
  const [aiPrompt, setAiPrompt] = useState("");
  const [generating, setGenerating] = useState(false);
  const [loading, setLoading] = useState(() => !!botId);
  const [flowStatus, setFlowStatus] = useState<"active" | "paused">("paused");

  // Auto-Save state
  const [autoSave, setAutoSave] = useState(true);
  const [saveStatus, setSaveStatus] = useState<"saved" | "saving" | "unsaved">("saved");
  const isInitialMount = useRef(true);
  const autoSaveTimerRef = useRef<NodeJS.Timeout | null>(null);

  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  const reactFlowInstanceRef = useRef<ReactFlowInstance | null>(null);

  // Resize handler to re-center viewport
  useEffect(() => {
    const handleResize = () => {
      reactFlowInstanceRef.current?.fitView({ padding: 0.25, duration: 200 });
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
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
    }),
    []
  );

  const showToast = (message: string, type: "success" | "error" = "success") => {
    setToast({ message, type });
  };

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  // Load saved flow from Supabase on mount
  useEffect(() => {
    if (!botId) return;
    (async () => {
      try {
        const supabase = createClient();
        const { data } = await supabase
          .from("chatty_bots")
          .select("custom_js")
          .eq("id", botId)
          .maybeSingle();
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
          reactFlowInstanceRef.current?.fitView({ padding: 0.25, duration: 500 });
          isInitialMount.current = false;
        }, 250);
        setLoading(false);
      }
    })();
  }, [botId, setNodes, setEdges]);

  const onConnect = useCallback(
    (params: Connection) => setEdges((eds) => addEdge({ ...params, animated: true }, eds)),
    [setEdges]
  );

  const saveFlowToBackend = useCallback(
    async (showNotification = false) => {
      if (!botId) return;
      setSaveStatus("saving");
      try {
        const supabase = createClient();
        const flowConfig = { status: flowStatus, nodes, edges };

        const { data: botData } = await supabase
          .from("chatty_bots")
          .select("custom_js")
          .eq("id", botId)
          .maybeSingle();

        let baseJs = botData?.custom_js || "";
        baseJs = baseJs.replace(/\/\* CHATTY_FLOW_START \*\/[\s\S]*?\/\* CHATTY_FLOW_END \*\//g, "").trim();
        baseJs = baseJs.replace(/\/\* CHATTY_FLOW_DATA[\s\S]*?CHATTY_FLOW_DATA \*\//g, "").trim();

        const flowJs = `\n/* CHATTY_FLOW_DATA\n${JSON.stringify(flowConfig, null, 2)}\nCHATTY_FLOW_DATA */`;
        const finalJs = (baseJs + flowJs).trim();

        const { error } = await supabase
          .from("chatty_bots")
          .update({ custom_js: finalJs })
          .eq("id", botId);

        if (error) throw error;
        setSaveStatus("saved");
        if (showNotification) {
          showToast("Flow saved! Widget will sync in real time.", "success");
        }
      } catch {
        setSaveStatus("unsaved");
        if (showNotification) {
          showToast("Failed to save flow.", "error");
        }
      }
    },
    [botId, nodes, edges, flowStatus]
  );

  // Debounced Auto-Save Trigger
  useEffect(() => {
    if (isInitialMount.current || loading || !autoSave || !botId) return;

    setSaveStatus("unsaved");

    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
    }

    autoSaveTimerRef.current = setTimeout(() => {
      saveFlowToBackend(false);
    }, 1800);

    return () => {
      if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    };
  }, [nodes, edges, flowStatus, autoSave, botId, saveFlowToBackend, loading]);

  const onSaveManual = () => {
    saveFlowToBackend(true);
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
          const formattedNodes = schema.nodes.map((n) => {
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
          setEdges(schema.edges);
          setAiPrompt("");
          showToast("AI generated workflow successfully!", "success");

          // Auto-center workflow view after generation
          setTimeout(() => {
            reactFlowInstanceRef.current?.fitView({ padding: 0.25, duration: 800 });
            switchCanvasOnMobile();
          }, 150);
        } else {
          showToast("Invalid flow structure returned by AI.", "error");
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

  const switchCanvasOnMobile = useCallback(() => {
    if (typeof window !== "undefined" && window.innerWidth < 1024) {
      setMobileTab("canvas");
      setTimeout(() => {
        reactFlowInstanceRef.current?.fitView({ padding: 0.25, duration: 400 });
      }, 120);
    }
  }, []);

  const addMessageNode = () => {
    const id = `msg-${Date.now()}`;
    setNodes((nds) => [
      ...nds,
      {
        id,
        type: "message",
        data: { label: "💬 Message text here..." },
        position: { x: 120 + Math.random() * 80, y: 160 + Math.random() * 80 },
      },
    ]);
    switchCanvasOnMobile();
    showToast("Message step added to canvas", "success");
  };

  const addQuestionNode = () => {
    const id = `q-${Date.now()}`;
    setNodes((nds) => [
      ...nds,
      {
        id,
        type: "question",
        data: { label: "❓ Ask: Question text here..." },
        position: { x: 120 + Math.random() * 80, y: 160 + Math.random() * 80 },
      },
    ]);
    switchCanvasOnMobile();
    showToast("Question step added to canvas", "success");
  };

  const addChoiceNode = () => {
    const id = `choice-${Date.now()}`;
    setNodes((nds) => [
      ...nds,
      {
        id,
        type: "choice",
        data: {
          label: "🔘 To get you to the right demo, how are you looking to use our product?",
          options: ["Inbound sales", "Customer support", "Other"],
        },
        position: { x: 120 + Math.random() * 80, y: 160 + Math.random() * 80 },
      },
    ]);
    switchCanvasOnMobile();
    showToast("Multi-choice step added to canvas", "success");
  };

  const addLeadCaptureNode = () => {
    const id = `lead-${Date.now()}`;
    setNodes((nds) => [
      ...nds,
      {
        id,
        type: "leadCapture",
        data: {
          label: "👤 First, could you share your business email? This will help me follow up in case you need to step away.",
          field: "email",
        },
        position: { x: 120 + Math.random() * 80, y: 160 + Math.random() * 80 },
      },
    ]);
    switchCanvasOnMobile();
    showToast("Lead capture step added to canvas", "success");
  };

  const addAiQualifyNode = () => {
    const id = `ai-${Date.now()}`;
    setNodes((nds) => [
      ...nds,
      {
        id,
        type: "aiQualify",
        data: {
          label: "🤖 Understand visitor's primary objective and team workflow requirements.",
          prompt: "Identify user's objective and company context. If user says 'idk' or is unsure, clarify with helpful options.",
        },
        position: { x: 120 + Math.random() * 80, y: 160 + Math.random() * 80 },
      },
    ]);
    switchCanvasOnMobile();
    showToast("AI qualify step added to canvas", "success");
  };

  const addBookMeetingNode = () => {
    const id = `meet-${Date.now()}`;
    setNodes((nds) => [
      ...nds,
      {
        id,
        type: "bookMeeting",
        data: {
          label: "📅 Select a time that works best for you from our available slots to schedule your demo meeting:",
        },
        position: { x: 120 + Math.random() * 80, y: 160 + Math.random() * 80 },
      },
    ]);
    switchCanvasOnMobile();
    showToast("Booking step added to canvas", "success");
  };

  const addTagNode = () => {
    const id = `tag-${Date.now()}`;
    setNodes((nds) => [
      ...nds,
      {
        id,
        type: "setTag",
        data: { label: "🏷️ Tag session: Lead" },
        position: { x: 120 + Math.random() * 80, y: 160 + Math.random() * 80 },
      },
    ]);
    switchCanvasOnMobile();
    showToast("Tag step added to canvas", "success");
  };

  const addEscalateNode = () => {
    const id = `esc-${Date.now()}`;
    setNodes((nds) => [
      ...nds,
      {
        id,
        type: "escalate",
        data: { label: "🔔 Escalate to Live Agent" },
        position: { x: 120 + Math.random() * 80, y: 160 + Math.random() * 80 },
      },
    ]);
    switchCanvasOnMobile();
    showToast("Escalation step added to canvas", "success");
  };

  const loadTemplate = async (templateName: "fin_demo" | "support_triage") => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/flow/templates`);
      if (res.ok) {
        const data = await res.json();
        const t = data.templates?.find((tpl: any) =>
          templateName === "fin_demo" ? tpl.name.includes("Demo") : tpl.name.includes("Support")
        );
        if (t && t.nodes && t.edges) {
          setNodes(t.nodes);
          setEdges(t.edges);
          showToast(`Loaded ${t.name} template!`, "success");
          setTimeout(() => {
            reactFlowInstanceRef.current?.fitView({ padding: 0.25, duration: 800 });
            switchCanvasOnMobile();
          }, 150);
        }
      }
    } catch {
      showToast("Failed to load template", "error");
    }
  };

  const onNodeClick = (_: MouseEvent, node: Node) => {
    setSelectedNode(node);
    setNodeLabel((node.data.label as string) || "");
    setNodeOptions((node.data.options as string[]) || ["Option 1", "Option 2"]);
    setNodeField((node.data.field as string) || "email");
    setNodeAiPrompt((node.data.prompt as string) || "");
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
              },
            }
          : n
      )
    );
    setSelectedNode(null);
    showToast("Node properties updated!", "success");
  };

  const deleteSelectedNode = () => {
    if (!selectedNode) return;
    setNodes((nds) => nds.filter((n) => n.id !== selectedNode.id));
    setEdges((eds) =>
      eds.filter((e) => e.source !== selectedNode.id && e.target !== selectedNode.id)
    );
    setSelectedNode(null);
  };

  const onDeleteFlow = async () => {
    if (!confirm("Are you sure you want to delete and reset the current flow?")) return;
    setNodes(initialNodes);
    setEdges(initialEdges);
    setFlowStatus("paused");
    if (!botId) return;
    try {
      const supabase = createClient();
      const { data: botData } = await supabase
        .from("chatty_bots")
        .select("custom_js")
        .eq("id", botId)
        .maybeSingle();
      let baseJs = botData?.custom_js || "";
      baseJs = baseJs.replace(/\/\* CHATTY_FLOW_START \*\/[\s\S]*?\/\* CHATTY_FLOW_END \*\//g, "").trim();
      baseJs = baseJs.replace(/\/\* CHATTY_FLOW_DATA[\s\S]*?CHATTY_FLOW_DATA \*\//g, "").trim();
      await supabase.from("chatty_bots").update({ custom_js: baseJs || null }).eq("id", botId);
    } catch {}
    showToast("Flow deleted and reset.", "success");
  };

  return (
    <div className="w-full space-y-3">
      {/* Mobile View Switcher */}
      <div className="flex lg:hidden items-center bg-neutral-100 dark:bg-neutral-850 p-1 rounded-xl gap-1 border border-neutral-200 dark:border-neutral-800">
        <button
          type="button"
          onClick={() => {
            setMobileTab("canvas");
            setTimeout(() => reactFlowInstanceRef.current?.fitView({ padding: 0.25, duration: 400 }), 80);
          }}
          className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
            mobileTab === "canvas"
              ? "bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white shadow-xs"
              : "text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200"
          }`}
        >
          <GitBranch className="size-3.5 text-[#f97316]" />
          Visual Canvas
        </button>
        <button
          type="button"
          onClick={() => setMobileTab("toolbox")}
          className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
            mobileTab === "toolbox"
              ? "bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white shadow-xs"
              : "text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200"
          }`}
        >
          <Plus className="size-3.5 text-indigo-500" />
          Toolbox & AI
        </button>
      </div>

      <div className="flex flex-col lg:flex-row gap-4 lg:h-[700px] w-full">
        {/* Node Toolbox Sidebar */}
        <div
          className={`w-full lg:w-80 lg:h-full bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl p-4 flex flex-col justify-between shrink-0 overflow-y-auto gap-4 shadow-sm ${
            mobileTab === "toolbox" ? "flex" : "hidden lg:flex"
          }`}
        >
          <div className="space-y-4">
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-neutral-400">Node Toolbox</h4>
              <p className="text-[10px] text-neutral-500 mt-1">
                Add interactive logic steps, qualification questions, calendar booking, or escalation.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={addMessageNode}
                className="flex items-center gap-1.5 p-2.5 border border-neutral-200 dark:border-neutral-800 rounded-xl hover:bg-blue-50/50 dark:hover:bg-blue-950/20 text-[10px] font-bold text-neutral-700 dark:text-neutral-200 transition-colors cursor-pointer"
              >
                <MessageSquare className="size-3.5 text-blue-500" /> Message
              </button>
              <button
                onClick={addChoiceNode}
                className="flex items-center gap-1.5 p-2.5 border border-neutral-200 dark:border-neutral-800 rounded-xl hover:bg-violet-50/50 dark:hover:bg-violet-950/20 text-[10px] font-bold text-neutral-700 dark:text-neutral-200 transition-colors cursor-pointer"
              >
                <ListFilter className="size-3.5 text-violet-500" /> Multi-Choice
              </button>
              <button
                onClick={addLeadCaptureNode}
                className="flex items-center gap-1.5 p-2.5 border border-neutral-200 dark:border-neutral-800 rounded-xl hover:bg-cyan-50/50 dark:hover:bg-cyan-950/20 text-[10px] font-bold text-neutral-700 dark:text-neutral-200 transition-colors cursor-pointer"
              >
                <UserCheck className="size-3.5 text-cyan-500" /> Lead Capture
              </button>
              <button
                onClick={addAiQualifyNode}
                className="flex items-center gap-1.5 p-2.5 border border-neutral-200 dark:border-neutral-800 rounded-xl hover:bg-indigo-50/50 dark:hover:bg-indigo-950/20 text-[10px] font-bold text-neutral-700 dark:text-neutral-200 transition-colors cursor-pointer"
              >
                <Sparkles className="size-3.5 text-indigo-500" /> AI Qualify
              </button>
              <button
                onClick={addBookMeetingNode}
                className="flex items-center gap-1.5 p-2.5 border border-neutral-200 dark:border-neutral-800 rounded-xl hover:bg-emerald-50/50 dark:hover:bg-emerald-950/20 text-[10px] font-bold text-neutral-700 dark:text-neutral-200 transition-colors cursor-pointer"
              >
                <Calendar className="size-3.5 text-emerald-500" /> Book Demo
              </button>
              <button
                onClick={addQuestionNode}
                className="flex items-center gap-1.5 p-2.5 border border-neutral-200 dark:border-neutral-800 rounded-xl hover:bg-purple-50/50 dark:hover:bg-purple-950/20 text-[10px] font-bold text-neutral-700 dark:text-neutral-200 transition-colors cursor-pointer"
              >
                <HelpCircle className="size-3.5 text-purple-500" /> Question
              </button>
              <button
                onClick={addTagNode}
                className="flex items-center gap-1.5 p-2.5 border border-neutral-200 dark:border-neutral-800 rounded-xl hover:bg-emerald-50/50 dark:hover:bg-emerald-950/20 text-[10px] font-bold text-neutral-700 dark:text-neutral-200 transition-colors cursor-pointer"
              >
                <Tag className="size-3.5 text-emerald-500" /> Set Tag
              </button>
              <button
                onClick={addEscalateNode}
                className="flex items-center gap-1.5 p-2.5 border border-neutral-200 dark:border-neutral-800 rounded-xl hover:bg-rose-50/50 dark:hover:bg-rose-950/20 text-[10px] font-bold text-neutral-700 dark:text-neutral-200 transition-colors cursor-pointer"
              >
                <PhoneCall className="size-3.5 text-rose-500" /> Escalate
              </button>
            </div>

            {selectedNode && (
              <div className="border-t border-neutral-100 dark:border-neutral-800 pt-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h5 className="text-[10px] font-bold uppercase text-neutral-400">Edit Node Properties</h5>
                  <span className="text-[9px] font-semibold text-neutral-400 bg-neutral-100 dark:bg-neutral-800 px-1.5 py-0.5 rounded">
                    {selectedNode.type}
                  </span>
                </div>
                <textarea
                  rows={3}
                  value={nodeLabel}
                  onChange={(e) => setNodeLabel(e.target.value)}
                  className="w-full bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-xl px-2.5 py-1.5 text-xs font-medium focus:outline-none"
                  placeholder="Text / Prompt displayed to visitor..."
                />

                {/* Multi-Choice Option Manager */}
                {selectedNode.type === "choice" && (
                  <div className="space-y-2 p-2 bg-violet-50/60 dark:bg-violet-950/30 border border-violet-100 dark:border-violet-900/40 rounded-xl">
                    <span className="text-[9px] font-bold uppercase tracking-wider text-violet-700 dark:text-violet-300">
                      Choice Buttons
                    </span>
                    <div className="flex flex-wrap gap-1">
                      {nodeOptions.map((opt, i) => (
                        <span
                          key={i}
                          className="flex items-center gap-1 text-[9px] font-semibold px-2 py-0.5 rounded-full bg-white dark:bg-neutral-900 border border-violet-200 dark:border-violet-800 text-violet-800 dark:text-violet-200"
                        >
                          <span>{opt}</span>
                          <button
                            type="button"
                            onClick={() => removeChoiceOption(i)}
                            className="hover:text-red-500 cursor-pointer ml-0.5"
                          >
                            <X className="size-2.5" />
                          </button>
                        </span>
                      ))}
                    </div>
                    <div className="flex gap-1 pt-1">
                      <input
                        value={newOptionText}
                        onChange={(e) => setNewOptionText(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            addChoiceOption();
                          }
                        }}
                        placeholder="New choice option..."
                        className="flex-1 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-lg px-2 py-1 text-[10px] focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={addChoiceOption}
                        className="px-2 py-1 bg-violet-600 hover:bg-violet-700 text-white rounded-lg text-[10px] font-bold cursor-pointer"
                      >
                        <Plus className="size-3" />
                      </button>
                    </div>
                  </div>
                )}

                {/* Lead Capture Field Selector */}
                {selectedNode.type === "leadCapture" && (
                  <div className="space-y-1 p-2 bg-cyan-50/60 dark:bg-cyan-950/30 border border-cyan-100 dark:border-cyan-900/40 rounded-xl">
                    <span className="text-[9px] font-bold uppercase tracking-wider text-cyan-700 dark:text-cyan-300">
                      Field To Capture
                    </span>
                    <select
                      value={nodeField}
                      onChange={(e) => setNodeField(e.target.value)}
                      className="w-full bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-lg px-2 py-1 text-[11px] focus:outline-none cursor-pointer"
                    >
                      <option value="email">Business Email (Validated)</option>
                      <option value="name">Full Name</option>
                      <option value="company">Company Name</option>
                      <option value="phone">Phone Number</option>
                    </select>
                  </div>
                )}

                {/* AI Qualify Objective Prompt */}
                {selectedNode.type === "aiQualify" && (
                  <div className="space-y-1 p-2 bg-indigo-50/60 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-900/40 rounded-xl">
                    <span className="text-[9px] font-bold uppercase tracking-wider text-indigo-700 dark:text-indigo-300">
                      AI Objective & Ambiguity Instruction
                    </span>
                    <textarea
                      rows={2}
                      value={nodeAiPrompt}
                      onChange={(e) => setNodeAiPrompt(e.target.value)}
                      placeholder="e.g. Understand user's core use case..."
                      className="w-full bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-lg px-2 py-1 text-[10px] focus:outline-none"
                    />
                  </div>
                )}

                <p className="text-[9px] text-neutral-400">
                  💡 Tip: Click on a connecting edge line on the canvas to set branch labels matching choice buttons.
                </p>
                <div className="flex gap-2 justify-end">
                  <button
                    onClick={deleteSelectedNode}
                    className="p-2 border border-rose-200 text-rose-500 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/20 cursor-pointer"
                    title="Delete selected block"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                  <button
                    onClick={updateSelectedNode}
                    className="px-3.5 py-1.5 text-[10px] font-bold text-white rounded-lg cursor-pointer"
                    style={{ background: color }}
                  >
                    Apply Changes
                  </button>
                </div>
              </div>
            )}

            {/* AI Flow Copilot & Enterprise Templates */}
            <div className="border-t border-neutral-100 dark:border-neutral-800 pt-4 space-y-3">
              <div className="flex items-center justify-between">
                <h5 className="text-[10px] font-bold uppercase text-neutral-400 flex items-center gap-1.5">
                  <Sparkles className="size-3.5 text-[#f97316]" /> 1-Click Templates
                </h5>
              </div>

              <div className="space-y-1.5">
                <button
                  type="button"
                  onClick={() => loadTemplate("fin_demo")}
                  className="w-full text-left p-2 rounded-xl bg-orange-50/70 hover:bg-orange-100/70 dark:bg-orange-950/30 dark:hover:bg-orange-900/40 border border-orange-200/80 dark:border-orange-800/60 transition-colors cursor-pointer group"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-orange-900 dark:text-orange-200">
                      🚀 B2B Demo Qualification (Fin Style)
                    </span>
                  </div>
                  <p className="text-[9px] text-orange-700/80 dark:text-orange-300/80 mt-0.5 leading-relaxed">
                    Email capture, 4-way use case branching, sales discovery, and inline demo booking.
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => loadTemplate("support_triage")}
                  className="w-full text-left p-2 rounded-xl bg-neutral-50 hover:bg-neutral-100 dark:bg-neutral-850 dark:hover:bg-neutral-800 border border-neutral-200 dark:border-neutral-750 transition-colors cursor-pointer"
                >
                  <span className="text-[11px] font-bold text-neutral-800 dark:text-neutral-200">
                    🎧 Support Triage & Deflection
                  </span>
                  <p className="text-[9px] text-neutral-500 dark:text-neutral-400 mt-0.5">
                    Categorizes issues, checks KB articles, and escalates to live agent if unresolved.
                  </p>
                </button>
              </div>

              <div className="space-y-2 pt-2 border-t border-neutral-100 dark:border-neutral-800">
                <h5 className="text-[10px] font-bold uppercase text-neutral-400 flex items-center gap-1.5">
                  <Zap className="size-3.5 text-[#f97316]" /> AI Custom Flow Architect
                </h5>
                <textarea
                  rows={3}
                  value={aiPrompt}
                  onChange={(e) => setAiPrompt(e.target.value)}
                  placeholder="Describe your desired workflow (e.g. 'Ask for lead's email, check validity, qualify demo use case, and schedule demo')..."
                  className="w-full bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-xl px-2.5 py-1.5 text-xs font-medium focus:outline-none"
                />
                <button
                  type="button"
                  onClick={generateFlowWithAI}
                  disabled={!aiPrompt.trim() || generating}
                  className="w-full flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-bold text-white rounded-xl cursor-pointer disabled:opacity-40 shadow-sm"
                  style={{ background: color }}
                >
                  {generating && <Loader2 className="size-3.5 animate-spin" />}
                  Generate & Layout Workflow
                </button>
              </div>
            </div>
          </div>

          <button
            onClick={onSaveManual}
            className="w-full mt-4 flex items-center justify-center gap-1.5 px-4 py-2.5 text-xs font-bold text-white rounded-xl cursor-pointer shrink-0 shadow"
            style={{ background: color }}
          >
            <Save className="size-4" /> Save Flow Configuration
          </button>
        </div>

        {/* Industrial Visual Editor Canvas */}
        <div
          className={`w-full flex-1 h-[560px] sm:h-[640px] lg:h-full lg:min-h-0 min-h-[480px] bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-2xl overflow-hidden relative shadow-inner ${
            mobileTab === "canvas" ? "flex flex-col" : "hidden lg:flex lg:flex-col"
          }`}
        >
          {loading && (
            <div className="absolute inset-0 flex items-center justify-center bg-white/60 dark:bg-neutral-950/60 z-20">
              <Loader2 className="size-7 animate-spin text-[#f97316]" />
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
            onInit={(instance) => {
              reactFlowInstanceRef.current = instance;
              setTimeout(() => {
                instance.fitView({ padding: 0.25 });
              }, 100);
            }}
            deleteKeyCode={["Backspace", "Delete"]}
            fitView
            fitViewOptions={{ padding: 0.25 }}
            panOnDrag={true}
            zoomOnPinch={true}
          >
            <Controls className="!bg-white dark:!bg-neutral-900 !border-neutral-200 dark:!border-neutral-800" />
            <MiniMap
              zoomable
              pannable
              nodeColor="#f97316"
              className="hidden md:block !bg-white dark:!bg-neutral-900 !border-neutral-200 dark:!border-neutral-800"
            />
            <Background color="#cbd5e1" gap={18} size={1} />

            <Panel
              position="top-left"
              className="bg-white/95 dark:bg-neutral-900/95 border border-neutral-200 dark:border-neutral-800 p-2 sm:p-2.5 rounded-xl shadow-md flex flex-wrap items-center gap-1.5 sm:gap-3 text-xs font-semibold text-neutral-700 dark:text-neutral-200 max-w-[calc(100vw-3.5rem)] sm:max-w-none"
            >
              <div className="flex items-center gap-1.5 sm:gap-2 border-r border-neutral-200 dark:border-neutral-800 pr-2 sm:pr-3">
                <span className="text-[9px] sm:text-[10px] uppercase tracking-wider text-neutral-400 font-bold">Status:</span>
                <button
                  type="button"
                  onClick={() => {
                    const next = flowStatus === "active" ? "paused" : "active";
                    setFlowStatus(next);
                    showToast(`Flow ${next === "active" ? "Activated" : "Paused"}. Click Save to publish.`, "success");
                  }}
                  className={`px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-lg text-[9px] sm:text-[10px] font-extrabold uppercase tracking-wide cursor-pointer transition-colors ${
                    flowStatus === "active"
                      ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400"
                      : "bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-400"
                  }`}
                >
                  ● {flowStatus === "active" ? "Active" : "Paused"}
                </button>
              </div>

              {/* Auto Save Status & Toggle */}
              <div className="flex items-center gap-1.5 sm:gap-2 border-r border-neutral-200 dark:border-neutral-800 pr-2 sm:pr-3">
                <button
                  type="button"
                  onClick={() => setAutoSave(!autoSave)}
                  className={`px-1.5 sm:px-2 py-0.5 rounded text-[9px] sm:text-[10px] font-bold flex items-center gap-1 cursor-pointer transition-colors ${
                    autoSave
                      ? "bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400"
                      : "bg-neutral-100 text-neutral-400 dark:bg-neutral-800"
                  }`}
                >
                  <CloudCheck className="size-3" />
                  <span className="hidden xs:inline">Auto-save:</span> {autoSave ? "ON" : "OFF"}
                </button>
                {autoSave && (
                  <span className="text-[9px] font-medium text-neutral-400 hidden sm:flex items-center gap-1">
                    {saveStatus === "saving" && <Loader2 className="size-2.5 animate-spin text-blue-500" />}
                    {saveStatus === "saving" && "Saving..."}
                    {saveStatus === "saved" && <span className="text-emerald-500">Saved</span>}
                    {saveStatus === "unsaved" && <span className="text-amber-500">Unsaved</span>}
                  </span>
                )}
              </div>

              {/* Mobile Quick Add Step Button */}
              <button
                type="button"
                onClick={() => setMobileTab("toolbox")}
                className="lg:hidden flex items-center gap-1 px-2 py-1 text-[9px] font-bold text-white rounded-lg shadow-xs cursor-pointer transition-colors"
                style={{ background: color }}
              >
                <Plus className="size-3" /> Add Step
              </button>

              <button
                type="button"
                onClick={() => reactFlowInstanceRef.current?.fitView({ padding: 0.25, duration: 500 })}
                className="p-1 sm:p-1.5 border border-neutral-200 dark:border-neutral-700 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-600 dark:text-neutral-300 cursor-pointer"
                title="Center Canvas"
              >
                <Maximize2 className="size-3 sm:size-3.5" />
              </button>

              <button
                type="button"
                onClick={onDeleteFlow}
                className="px-2 sm:px-2.5 py-0.5 sm:py-1 text-[9px] sm:text-[10px] font-bold border border-rose-200 text-rose-500 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/30 cursor-pointer transition-colors"
              >
                Reset
              </button>
            </Panel>

            <Panel
              position="top-right"
              className="hidden md:flex bg-white/90 dark:bg-neutral-900/90 border border-neutral-200 dark:border-neutral-800 px-3 py-1.5 rounded-xl shadow-sm text-[10px] font-medium text-neutral-500 dark:text-neutral-400"
            >
              ⌨️ Press <kbd className="px-1 py-0.5 bg-neutral-100 dark:bg-neutral-800 border rounded font-mono text-[9px]">Del</kbd> or <kbd className="px-1 py-0.5 bg-neutral-100 dark:bg-neutral-800 border rounded font-mono text-[9px]">Backspace</kbd> to delete selected node/connection.
            </Panel>
          </ReactFlow>

          {/* Mobile Slide-Up Sheet for Node Editing */}
          {selectedNode && (
            <div className="lg:hidden absolute inset-x-0 bottom-0 z-30 max-h-[85%] overflow-y-auto bg-white dark:bg-neutral-900 border-t border-neutral-200 dark:border-neutral-800 rounded-t-2xl shadow-2xl p-4 space-y-3 animate-in slide-in-from-bottom duration-200">
              <div className="flex items-center justify-between border-b border-neutral-100 dark:border-neutral-800 pb-2">
                <div className="flex items-center gap-2">
                  <h5 className="text-xs font-bold text-neutral-800 dark:text-neutral-200">Edit Node Properties</h5>
                  <span className="text-[9px] font-semibold text-neutral-400 bg-neutral-100 dark:bg-neutral-800 px-1.5 py-0.5 rounded">
                    {selectedNode.type}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedNode(null)}
                  className="p-1 rounded-lg text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 cursor-pointer"
                >
                  <X className="size-4" />
                </button>
              </div>

              <textarea
                rows={3}
                value={nodeLabel}
                onChange={(e) => setNodeLabel(e.target.value)}
                className="w-full bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-xl px-2.5 py-1.5 text-xs font-medium focus:outline-none"
                placeholder="Text / Prompt displayed to visitor..."
              />

              {/* Multi-Choice Option Manager */}
              {selectedNode.type === "choice" && (
                <div className="space-y-2 p-2 bg-violet-50/60 dark:bg-violet-950/30 border border-violet-100 dark:border-violet-900/40 rounded-xl">
                  <span className="text-[9px] font-bold uppercase tracking-wider text-violet-700 dark:text-violet-300">
                    Choice Buttons
                  </span>
                  <div className="flex flex-wrap gap-1">
                    {nodeOptions.map((opt, i) => (
                      <span
                        key={i}
                        className="flex items-center gap-1 text-[9px] font-semibold px-2 py-0.5 rounded-full bg-white dark:bg-neutral-900 border border-violet-200 dark:border-violet-800 text-violet-800 dark:text-violet-200"
                      >
                        <span>{opt}</span>
                        <button
                          type="button"
                          onClick={() => removeChoiceOption(i)}
                          className="hover:text-red-500 cursor-pointer ml-0.5"
                        >
                          <X className="size-2.5" />
                        </button>
                      </span>
                    ))}
                  </div>
                  <div className="flex gap-1 pt-1">
                    <input
                      value={newOptionText}
                      onChange={(e) => setNewOptionText(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          addChoiceOption();
                        }
                      }}
                      placeholder="New choice option..."
                      className="flex-1 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-lg px-2 py-1 text-[10px] focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={addChoiceOption}
                      className="px-2 py-1 bg-violet-600 hover:bg-violet-700 text-white rounded-lg text-[10px] font-bold cursor-pointer"
                    >
                      <Plus className="size-3" />
                    </button>
                  </div>
                </div>
              )}

              {/* Lead Capture Field Selector */}
              {selectedNode.type === "leadCapture" && (
                <div className="space-y-1 p-2 bg-cyan-50/60 dark:bg-cyan-950/30 border border-cyan-100 dark:border-cyan-900/40 rounded-xl">
                  <span className="text-[9px] font-bold uppercase tracking-wider text-cyan-700 dark:text-cyan-300">
                    Field To Capture
                  </span>
                  <select
                    value={nodeField}
                    onChange={(e) => setNodeField(e.target.value)}
                    className="w-full bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-lg px-2 py-1 text-[11px] focus:outline-none cursor-pointer"
                  >
                    <option value="email">Business Email (Validated)</option>
                    <option value="name">Full Name</option>
                    <option value="company">Company Name</option>
                    <option value="phone">Phone Number</option>
                  </select>
                </div>
              )}

              {/* AI Qualify Objective Prompt */}
              {selectedNode.type === "aiQualify" && (
                <div className="space-y-1 p-2 bg-indigo-50/60 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-900/40 rounded-xl">
                  <span className="text-[9px] font-bold uppercase tracking-wider text-indigo-700 dark:text-indigo-300">
                    AI Objective & Ambiguity Instruction
                  </span>
                  <textarea
                    rows={2}
                    value={nodeAiPrompt}
                    onChange={(e) => setNodeAiPrompt(e.target.value)}
                    placeholder="e.g. Understand user's core use case..."
                    className="w-full bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-lg px-2 py-1 text-[10px] focus:outline-none"
                  />
                </div>
              )}

              <div className="flex gap-2 justify-end pt-1">
                <button
                  type="button"
                  onClick={deleteSelectedNode}
                  className="p-2 border border-rose-200 text-rose-500 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/20 cursor-pointer"
                  title="Delete block"
                >
                  <Trash2 className="size-3.5" />
                </button>
                <button
                  type="button"
                  onClick={updateSelectedNode}
                  className="px-4 py-1.5 text-xs font-bold text-white rounded-lg cursor-pointer shadow-xs"
                  style={{ background: color }}
                >
                  Apply Changes
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Toast */}
        <AnimatePresence>
          {toast && (
            <motion.div
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20, scale: 0.95 }}
              className="fixed bottom-6 right-6 z-[9999] flex items-center gap-2.5 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl px-4 py-3 shadow-2xl text-xs font-semibold text-neutral-800 dark:text-white"
            >
              {toast.type === "success" ? (
                <span className="flex size-5 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 shrink-0">
                  <Check className="size-3.5" />
                </span>
              ) : (
                <span className="flex size-5 items-center justify-center rounded-full bg-rose-100 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400 shrink-0">
                  <AlertCircle className="size-3.5" />
                </span>
              )}
              <span className="leading-relaxed">{toast.message}</span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
