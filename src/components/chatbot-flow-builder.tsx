"use client";

import { useState, useCallback, useEffect } from "react";
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
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { Play, MessageSquare, HelpCircle, UserCheck, PhoneCall, Trash2, Save, Plus } from "lucide-react";

interface Props {
  botId: string | null;
  color?: string;
}

const nodeTypes = {}; // Default nodes with customize styling

const initialNodes: Node[] = [
  {
    id: "start",
    type: "input",
    data: { label: "🚀 Start Conversation" },
    position: { x: 250, y: 5 },
    style: { background: "#f97316", color: "#fff", border: "none", borderRadius: "12px", padding: "10px", fontWeight: "bold" },
  },
  {
    id: "welcome",
    data: { label: "💬 Welcome message: 'Hi! How can I help you today?'" },
    position: { x: 250, y: 120 },
    style: { background: "#fff", border: "1px solid #e5e7eb", borderRadius: "12px", padding: "12px" },
  },
];

const initialEdges: Edge[] = [
  { id: "e-start-welcome", source: "start", target: "welcome" },
];

export function ChatbotFlowBuilder({ botId, color = "#f97316" }: Props) {
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  const [nodeLabel, setNodeLabel] = useState("");

  useEffect(() => {
    if (!botId) return;
    try {
      const saved = localStorage.getItem(`chatty_flow_${botId}`);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.nodes && parsed.edges) {
          setNodes(parsed.nodes);
          setEdges(parsed.edges);
        }
      }
    } catch {}
  }, [botId, setNodes, setEdges]);

  const onConnect = useCallback(
    (params: Connection) => setEdges((eds) => addEdge(params, eds)),
    [setEdges]
  );

  const onSave = useCallback(() => {
    if (!botId) return;
    try {
      localStorage.setItem(
        `chatty_flow_${botId}`,
        JSON.stringify({ nodes, edges })
      );
      alert("Flow configuration saved successfully!");
    } catch {
      alert("Failed to save flow.");
    }
  }, [botId, nodes, edges]);

  const addMessageNode = () => {
    const id = `msg-${Date.now()}`;
    const newNode: Node = {
      id,
      data: { label: "💬 New message text..." },
      position: { x: 100 + Math.random() * 200, y: 200 + Math.random() * 200 },
      style: { background: "#fff", border: "1px solid #e5e7eb", borderRadius: "12px", padding: "12px", minWidth: "150px" },
    };
    setNodes((nds) => [...nds, newNode]);
  };

  const addQuestionNode = () => {
    const id = `q-${Date.now()}`;
    const newNode: Node = {
      id,
      data: { label: "❓ Ask: 'Are you looking for Pricing?'" },
      position: { x: 100 + Math.random() * 200, y: 200 + Math.random() * 200 },
      style: { background: "#fff", border: "1px solid #e5e7eb", borderRadius: "12px", padding: "12px", minWidth: "150px" },
    };
    setNodes((nds) => [...nds, newNode]);
  };

  const addTagNode = () => {
    const id = `tag-${Date.now()}`;
    const newNode: Node = {
      id,
      data: { label: "🏷️ Tag session: 'Lead'" },
      position: { x: 100 + Math.random() * 200, y: 200 + Math.random() * 200 },
      style: { background: "#eff6ff", border: "1px solid #bfdbfe", color: "#1e40af", borderRadius: "12px", padding: "12px", minWidth: "150px", fontWeight: "semibold" },
    };
    setNodes((nds) => [...nds, newNode]);
  };

  const addEscalateNode = () => {
    const id = `esc-${Date.now()}`;
    const newNode: Node = {
      id,
      data: { label: "🔔 Escalate to Live Agent" },
      position: { x: 100 + Math.random() * 200, y: 200 + Math.random() * 200 },
      style: { background: "#fff5f5", border: "1px solid #feb2b2", color: "#9b2c2c", borderRadius: "12px", padding: "12px", minWidth: "150px", fontWeight: "bold" },
    };
    setNodes((nds) => [...nds, newNode]);
  };

  const onNodeClick = (_: any, node: Node) => {
    setSelectedNode(node);
    setNodeLabel(node.data.label as string || "");
  };

  const updateSelectedNode = () => {
    if (!selectedNode) return;
    setNodes((nds) =>
      nds.map((n) => {
        if (n.id === selectedNode.id) {
          n.data = { ...n.data, label: nodeLabel };
        }
        return n;
      })
    );
    setSelectedNode(null);
  };

  const deleteSelectedNode = () => {
    if (!selectedNode) return;
    setNodes((nds) => nds.filter((n) => n.id !== selectedNode.id));
    setEdges((eds) => eds.filter((e) => e.source !== selectedNode.id && e.target !== selectedNode.id));
    setSelectedNode(null);
  };

  return (
    <div className="flex flex-col lg:flex-row gap-4 h-[600px] w-full">
      {/* Node properties panel */}
      <div className="w-full lg:w-72 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl p-4 flex flex-col justify-between shrink-0">
        <div className="space-y-4">
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-neutral-400">Node Toolbox</h4>
            <p className="text-[10px] text-neutral-500 mt-1">Click to add interactive rules triggers and custom messaging blocks.</p>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button onClick={addMessageNode} className="flex items-center gap-1.5 p-2 border border-neutral-100 dark:border-neutral-800 rounded-xl hover:bg-neutral-50 text-[10px] font-semibold text-neutral-700 dark:text-neutral-350 cursor-pointer">
              <MessageSquare className="size-3.5 text-blue-500" />Message
            </button>
            <button onClick={addQuestionNode} className="flex items-center gap-1.5 p-2 border border-neutral-100 dark:border-neutral-800 rounded-xl hover:bg-neutral-50 text-[10px] font-semibold text-neutral-700 dark:text-neutral-350 cursor-pointer">
              <HelpCircle className="size-3.5 text-purple-500" />Question
            </button>
            <button onClick={addTagNode} className="flex items-center gap-1.5 p-2 border border-neutral-100 dark:border-neutral-800 rounded-xl hover:bg-neutral-50 text-[10px] font-semibold text-neutral-700 dark:text-neutral-350 cursor-pointer">
              <UserCheck className="size-3.5 text-green-500" />Set Tag
            </button>
            <button onClick={addEscalateNode} className="flex items-center gap-1.5 p-2 border border-neutral-100 dark:border-neutral-800 rounded-xl hover:bg-neutral-50 text-[10px] font-semibold text-neutral-700 dark:text-neutral-350 cursor-pointer">
              <PhoneCall className="size-3.5 text-red-500" />Escalate
            </button>
          </div>

          {selectedNode && (
            <div className="border-t border-neutral-100 dark:border-neutral-850 pt-4 space-y-3">
              <h5 className="text-[10px] font-bold uppercase text-neutral-400">Edit Node Properties</h5>
              <div className="space-y-2">
                <textarea
                  rows={3}
                  value={nodeLabel}
                  onChange={(e) => setNodeLabel(e.target.value)}
                  className="w-full bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-xl px-2.5 py-1.5 text-[11px] focus:outline-none"
                />
                <div className="flex gap-2 justify-end">
                  <button onClick={deleteSelectedNode} className="p-2 border border-red-200 text-red-500 rounded-lg hover:bg-red-50 cursor-pointer" title="Delete block"><Trash2 className="size-3.5" /></button>
                  <button onClick={updateSelectedNode} className="px-3 py-1.5 text-[10px] font-semibold text-white rounded-lg cursor-pointer" style={{ background: color }}>Apply</button>
                </div>
              </div>
            </div>
          )}
        </div>

        <button onClick={onSave} className="w-full flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-semibold text-white rounded-xl cursor-pointer" style={{ background: color }}>
          <Save className="size-4" />Save flow configuration
        </button>
      </div>

      {/* Visual Editor canvas */}
      <div className="flex-1 bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-2xl overflow-hidden relative">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onNodeClick={onNodeClick}
          fitView
        >
          <Controls />
          <MiniMap zoomable pannable />
          <Background color="#ccc" gap={16} />
          <Panel position="top-right" className="bg-white/80 dark:bg-neutral-900/80 border border-neutral-200 dark:border-neutral-850 px-2.5 py-1.5 rounded-lg shadow text-[10px] font-semibold text-neutral-600 dark:text-neutral-300">
            💡 Drag connections from nodes to wire logic paths.
          </Panel>
        </ReactFlow>
      </div>
    </div>
  );
}
