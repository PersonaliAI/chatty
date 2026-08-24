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
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { createClient } from "@/lib/supabase/client";

interface Props {
  botId: string | null;
  color?: string;
}

interface FlowNodeData {
  label?: string;
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
    position: { x: 300, y: 20 },
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
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  const [nodeLabel, setNodeLabel] = useState("");
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

  const nodeTypes = useMemo(
    () => ({
      start: StartNode,
      input: StartNode,
      message: MessageNode,
      question: QuestionNode,
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
              else if (label.startsWith("❓") || n.id.startsWith("q-")) type = "question";
              else if (label.startsWith("🏷️") || n.id.startsWith("tag-")) type = "setTag";
              else if (label.startsWith("🔔") || n.id.startsWith("esc-")) type = "escalate";
              else if (label.startsWith("💬") || n.id.startsWith("msg-")) type = "message";
              return { ...n, type };
            });
            setNodes(formattedNodes);
            setEdges(flow.edges);
            setFlowStatus(flow.status || "paused");

            setTimeout(() => {
              reactFlowInstanceRef.current?.fitView({ padding: 0.3, duration: 600 });
              isInitialMount.current = false;
            }, 300);
          } else {
            isInitialMount.current = false;
          }
        } else {
          isInitialMount.current = false;
        }
      } catch {
        isInitialMount.current = false;
      }
      setLoading(false);
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
      const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL ?? "https://api.chatty.personaliai.com";
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
            reactFlowInstanceRef.current?.fitView({ padding: 0.3, duration: 800 });
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

  const addMessageNode = () => {
    const id = `msg-${Date.now()}`;
    setNodes((nds) => [
      ...nds,
      {
        id,
        type: "message",
        data: { label: "💬 Message text here..." },
        position: { x: 200 + Math.random() * 100, y: 180 + Math.random() * 100 },
      },
    ]);
  };

  const addQuestionNode = () => {
    const id = `q-${Date.now()}`;
    setNodes((nds) => [
      ...nds,
      {
        id,
        type: "question",
        data: { label: "❓ Ask: Question text here..." },
        position: { x: 200 + Math.random() * 100, y: 180 + Math.random() * 100 },
      },
    ]);
  };

  const addTagNode = () => {
    const id = `tag-${Date.now()}`;
    setNodes((nds) => [
      ...nds,
      {
        id,
        type: "setTag",
        data: { label: "🏷️ Tag session: Lead" },
        position: { x: 200 + Math.random() * 100, y: 180 + Math.random() * 100 },
      },
    ]);
  };

  const addEscalateNode = () => {
    const id = `esc-${Date.now()}`;
    setNodes((nds) => [
      ...nds,
      {
        id,
        type: "escalate",
        data: { label: "🔔 Escalate to Live Agent" },
        position: { x: 200 + Math.random() * 100, y: 180 + Math.random() * 100 },
      },
    ]);
  };

  const onNodeClick = (_: MouseEvent, node: Node) => {
    setSelectedNode(node);
    setNodeLabel((node.data.label as string) || "");
  };

  const updateSelectedNode = () => {
    if (!selectedNode) return;
    setNodes((nds) =>
      nds.map((n) =>
        n.id === selectedNode.id ? { ...n, data: { ...n.data, label: nodeLabel } } : n
      )
    );
    setSelectedNode(null);
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
    <div className="flex flex-col lg:flex-row gap-4 lg:h-[650px] w-full">
      {/* Node Toolbox Sidebar */}
      <div className="w-full lg:w-80 lg:h-full bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl p-4 flex flex-col justify-between shrink-0 overflow-y-auto gap-4 shadow-sm">
        <div className="space-y-4">
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-neutral-400">Node Toolbox</h4>
            <p className="text-[10px] text-neutral-500 mt-1">
              Add interactive logic steps, branch questions, session tags, or live agent escalation.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={addMessageNode}
              className="flex items-center gap-2 p-2.5 border border-neutral-200 dark:border-neutral-800 rounded-xl hover:bg-blue-50/50 dark:hover:bg-blue-950/20 text-[10px] font-bold text-neutral-700 dark:text-neutral-200 transition-colors cursor-pointer"
            >
              <MessageSquare className="size-3.5 text-blue-500" /> Message
            </button>
            <button
              onClick={addQuestionNode}
              className="flex items-center gap-2 p-2.5 border border-neutral-200 dark:border-neutral-800 rounded-xl hover:bg-purple-50/50 dark:hover:bg-purple-950/20 text-[10px] font-bold text-neutral-700 dark:text-neutral-200 transition-colors cursor-pointer"
            >
              <HelpCircle className="size-3.5 text-purple-500" /> Question
            </button>
            <button
              onClick={addTagNode}
              className="flex items-center gap-2 p-2.5 border border-neutral-200 dark:border-neutral-800 rounded-xl hover:bg-emerald-50/50 dark:hover:bg-emerald-950/20 text-[10px] font-bold text-neutral-700 dark:text-neutral-200 transition-colors cursor-pointer"
            >
              <UserCheck className="size-3.5 text-emerald-500" /> Set Tag
            </button>
            <button
              onClick={addEscalateNode}
              className="flex items-center gap-2 p-2.5 border border-neutral-200 dark:border-neutral-800 rounded-xl hover:bg-rose-50/50 dark:hover:bg-rose-950/20 text-[10px] font-bold text-neutral-700 dark:text-neutral-200 transition-colors cursor-pointer"
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
              />
              <p className="text-[9px] text-neutral-400">
                💡 Tip: Click on a connecting edge line on the canvas to set branch labels (e.g. &quot;Valid Email&quot; / &quot;Invalid Email&quot;).
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

          {/* AI Flow Copilot */}
          <div className="border-t border-neutral-100 dark:border-neutral-800 pt-4 space-y-3">
            <h5 className="text-[10px] font-bold uppercase text-neutral-400 flex items-center gap-1.5">
              <Sparkles className="size-3.5 text-[#f97316]" /> AI Flow Architect
            </h5>
            <div className="space-y-2">
              <textarea
                rows={3}
                value={aiPrompt}
                onChange={(e) => setAiPrompt(e.target.value)}
                placeholder="Describe your desired workflow (e.g. 'Ask for lead's email, check validity, then offer discount code or support escalation')..."
                className="w-full bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-xl px-2.5 py-1.5 text-xs font-medium focus:outline-none"
              />
              <div className="flex gap-1.5 flex-wrap">
                <button
                  type="button"
                  onClick={() => setAiPrompt("Qualify leads by asking for email/phone, then provide the booking demo link.")}
                  className="px-2 py-0.5 border border-neutral-200 dark:border-neutral-800 rounded text-[9px] hover:bg-neutral-50 text-neutral-600 dark:text-neutral-300 cursor-pointer font-medium"
                >
                  💡 Lead Gen
                </button>
                <button
                  type="button"
                  onClick={() => setAiPrompt("Welcome user, ask if they need Support or Sales. Escalate to live agent if support.")}
                  className="px-2 py-0.5 border border-neutral-200 dark:border-neutral-800 rounded text-[9px] hover:bg-neutral-50 text-neutral-600 dark:text-neutral-300 cursor-pointer font-medium"
                >
                  💡 Support Triage
                </button>
              </div>
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
      <div className="flex-1 min-h-[450px] lg:min-h-0 bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-2xl overflow-hidden relative shadow-inner">
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
          }}
          deleteKeyCode={["Backspace", "Delete"]}
          fitView
        >
          <Controls />
          <MiniMap zoomable pannable nodeColor="#f97316" className="!bg-white dark:!bg-neutral-900 !border-neutral-200 dark:!border-neutral-800" />
          <Background color="#cbd5e1" gap={18} size={1} />

          <Panel position="top-left" className="bg-white/95 dark:bg-neutral-900/95 border border-neutral-200 dark:border-neutral-800 p-2.5 rounded-xl shadow-md flex items-center gap-3 text-xs font-semibold text-neutral-700 dark:text-neutral-200">
            <div className="flex items-center gap-2 border-r border-neutral-200 dark:border-neutral-800 pr-3">
              <span className="text-[10px] uppercase tracking-wider text-neutral-400 font-bold">Status:</span>
              <button
                type="button"
                onClick={() => {
                  const next = flowStatus === "active" ? "paused" : "active";
                  setFlowStatus(next);
                  showToast(`Flow ${next === "active" ? "Activated" : "Paused"}. Click Save to publish.`, "success");
                }}
                className={`px-2.5 py-1 rounded-lg text-[10px] font-extrabold uppercase tracking-wide cursor-pointer transition-colors ${
                  flowStatus === "active"
                    ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400"
                    : "bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-400"
                }`}
              >
                ● {flowStatus === "active" ? "Active" : "Paused"}
              </button>
            </div>

            {/* Auto Save Status & Toggle */}
            <div className="flex items-center gap-2 border-r border-neutral-200 dark:border-neutral-800 pr-3">
              <button
                type="button"
                onClick={() => setAutoSave(!autoSave)}
                className={`px-2 py-0.5 rounded text-[10px] font-bold flex items-center gap-1 cursor-pointer transition-colors ${
                  autoSave
                    ? "bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400"
                    : "bg-neutral-100 text-neutral-400 dark:bg-neutral-800"
                }`}
              >
                <CloudCheck className="size-3" />
                Auto-save: {autoSave ? "ON" : "OFF"}
              </button>
              {autoSave && (
                <span className="text-[9px] font-medium text-neutral-400 flex items-center gap-1">
                  {saveStatus === "saving" && <Loader2 className="size-2.5 animate-spin text-blue-500" />}
                  {saveStatus === "saving" && "Saving..."}
                  {saveStatus === "saved" && <span className="text-emerald-500">Saved</span>}
                  {saveStatus === "unsaved" && <span className="text-amber-500">Unsaved changes</span>}
                </span>
              )}
            </div>

            <button
              type="button"
              onClick={() => reactFlowInstanceRef.current?.fitView({ padding: 0.3, duration: 600 })}
              className="p-1.5 border border-neutral-200 dark:border-neutral-700 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-600 dark:text-neutral-300 cursor-pointer"
              title="Center Canvas"
            >
              <Maximize2 className="size-3.5" />
            </button>

            <button
              type="button"
              onClick={onDeleteFlow}
              className="px-2.5 py-1 text-[10px] font-bold border border-rose-200 text-rose-500 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/30 cursor-pointer transition-colors"
            >
              Delete Flow
            </button>
          </Panel>

          <Panel position="top-right" className="bg-white/90 dark:bg-neutral-900/90 border border-neutral-200 dark:border-neutral-800 px-3 py-1.5 rounded-xl shadow-sm text-[10px] font-medium text-neutral-500 dark:text-neutral-400">
            ⌨️ Press <kbd className="px-1 py-0.5 bg-neutral-100 dark:bg-neutral-800 border rounded font-mono text-[9px]">Del</kbd> or <kbd className="px-1 py-0.5 bg-neutral-100 dark:bg-neutral-800 border rounded font-mono text-[9px]">Backspace</kbd> to delete selected node/connection.
          </Panel>
        </ReactFlow>
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
  );
}
