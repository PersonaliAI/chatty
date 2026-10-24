"use client";

import {
  applyEdgeChanges,
  applyNodeChanges,
  Background,
  Controls,
  Handle,
  MiniMap,
  Position,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
  useUpdateNodeInternals,
  type Connection,
  type Edge,
  type EdgeChange,
  type Node,
  type NodeChange,
  type NodeProps,
} from "@xyflow/react";
import { AlertCircle, CheckCircle2, ChevronDown, Clock3, Code2, Copy, Loader2, Minus, MoreHorizontal, Plus, Trash2, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type MutableRefObject } from "react";
import { FLOW_NODE_LAYOUT } from "./graph-layout";
import { nodeCatalog, type NodeDefinition } from "./node-registry";
import type { FlowEdge, FlowNode } from "./types";
import { NodeIcon } from "./node-icon";

const STEP_CATALOG_ITEMS = nodeCatalog.filter((item) => item.kind !== "trigger");

type NodeActions = {
  onSelect: (nodeId: string) => void;
  onDuplicate: (node: FlowNode) => void;
  onRemove: (nodeId: string) => void;
  onToggleMenu: (nodeId: string) => void;
  onAddStep: (nodeId: string) => void;
  onAddBranch: (nodeId: string) => void;
  onQuickInsertStep?: (parentId: string, item: NodeDefinition, isBranch: boolean, branchLabel?: string) => void;
  openMenuId: string | null;
};

type CanvasNodeData = FlowNode & NodeActions;
type CanvasNode = Node<CanvasNodeData, "chatty">;

export type FlowCanvasCommands = {
  zoomIn: () => void;
  zoomOut: () => void;
  resetZoom: () => void;
  fitView: () => void;
};

type Props = {
  nodes: FlowNode[];
  edges: FlowEdge[];
  selectedId: string;
  nodeMenuId: string | null;
  onSelect: (nodeId: string) => void;
  onNodesChange: (nodes: FlowNode[]) => void;
  onEdgesChange: (edges: FlowEdge[]) => void;
  onConnect: (source: string, target: string) => void;
  onDuplicate: (node: FlowNode) => void;
  onRemove: (nodeId: string) => void;
  onToggleMenu: (nodeId: string) => void;
  onAddStep: (nodeId: string) => void;
  onAddBranch: (nodeId: string) => void;
  onQuickInsertStep?: (parentId: string, item: NodeDefinition, isBranch: boolean, branchLabel?: string) => void;
  onCreateNode: () => void;
  onOpenCopilot?: () => void;
  commandsRef?: MutableRefObject<FlowCanvasCommands | null>;
};

function NodeExecutionMark({ status }: { status: NonNullable<FlowNode["executionState"]> }) {
  const StatusIcon = status === "completed" ? CheckCircle2 : status === "failed" ? AlertCircle : status === "running" ? Loader2 : status === "queued" ? Clock3 : status === "skipped" ? Minus : null;
  if (!StatusIcon) return null;
  const label = status === "completed" ? "Executed" : status === "failed" ? "Error" : status === "running" ? "Running" : status === "queued" ? "Queued" : "Skipped";
  return <span className={`n8n-node-status n8n-node-status-${status}`} title={label} aria-label={label}><StatusIcon className={status === "running" ? "n8n-node-status-spin" : ""} size={14} /></span>;
}

function summarizeNodeAction(data: FlowNode): string {
  const cfg = data.config ?? {};
  if (data.type === "core.condition" && cfg.field) {
    return `${cfg.field} ${cfg.operator || "equals"} "${cfg.value || ""}"`;
  }
  if (data.type === "core.wait" && cfg.duration) {
    return `Delay ${cfg.duration}s`;
  }
  if (data.type === "chatty.ai" && cfg.instruction) {
    const outField = cfg.output_field ? ` → data.${cfg.output_field}` : "";
    return `${cfg.operation || "Classify"}${outField}: ${cfg.instruction.slice(0, 34)}${cfg.instruction.length > 34 ? "…" : ""}`;
  }
  if (data.type === "action.slack" && cfg.channel) {
    return `Post to ${cfg.channel}`;
  }
  if (data.type === "action.email" && cfg.to) {
    return `Email → ${cfg.to}`;
  }
  if (data.type === "action.crm" && cfg.stage) {
    return `CRM stage → ${cfg.stage}`;
  }
  if (data.type === "n8n.httpRequest" && cfg.url) {
    return `${cfg.method || "POST"} ${cfg.url.replace(/^https?:\/\//, "").slice(0, 32)}`;
  }
  return cfg.operation || (data.kind === "trigger" ? "Start when this event occurs" : data.subtitle);
}

function ChattyCanvasNode({ data, selected }: NodeProps<CanvasNode>) {
  const updateNodeInternals = useUpdateNodeInternals();
  const [pickerMode, setPickerMode] = useState<"step" | "branch" | null>(null);
  const [branchLabel, setBranchLabel] = useState<string>("else");
  useEffect(() => {
    const frame = window.requestAnimationFrame(() => updateNodeInternals(data.id));
    return () => window.cancelAnimationFrame(frame);
  }, [data.id, updateNodeInternals]);

  const status = data.executionState ?? "idle";
  const message = data.config.message?.trim();
  const operationSummary = summarizeNodeAction(data);
  const triggerPill = data.type === "n8n.webhook"
    ? (data.config.path || "/incoming-event")
    : (data.config.event || "Chatty event");
  const triggerChannel = (data.config.channel || "all").trim().toLowerCase();
  const triggerChannelPill = data.type === "n8n.webhook"
    ? "HTTP Webhook"
    : triggerChannel === "all" || !triggerChannel
      ? "All channels (Omnichannel)"
      : `Channel: ${triggerChannel}`;
  const triggerCopy = data.type === "n8n.webhook"
    ? data.subtitle
    : triggerChannel === "all" || !triggerChannel
      ? "Omnichannel: Web, WhatsApp, Instagram, Mobile & Chat"
      : `Filtered to ${triggerChannel} messages & events`;

  return (
    <div
      className={`intercom-flow-node ${selected ? "is-selected" : ""} ${data.kind === "trigger" ? "is-trigger" : ""} n8n-state-${status}`}
      style={{ "--node-color": data.color } as CSSProperties}
      onClick={(event) => {
        event.stopPropagation();
        data.onSelect(data.id);
      }}
      onContextMenu={(event) => {
        event.preventDefault();
        event.stopPropagation();
        data.onToggleMenu(data.id);
      }}
    >
      <Handle type="target" position={Position.Left} className="n8n-handle n8n-handle-target" aria-label={`Connect to ${data.title}`} />
      <div className="n8n-node-toolbar">
        <button
          type="button"
          className="n8n-node-menu"
          aria-label={`Node options for ${data.title}`}
          aria-haspopup="menu"
          aria-expanded={data.openMenuId === data.id}
          onClick={(event) => {
            event.stopPropagation();
            data.onToggleMenu(data.id);
          }}
        >
          <MoreHorizontal size={16} />
        </button>
      </div>
      <div className="intercom-node-card">
        <div className="intercom-node-header">
          <span className="intercom-step-label">{data.kind === "trigger" ? "WHEN" : `${String.fromCharCode(65 + Math.min(data.stepIndex ?? 0, 25))}.`}</span>
          <strong>{data.title}</strong>
          {data.pathId && data.pathId !== "main" && <span className="intercom-path-chip">{data.pathTitle}</span>}
          <ChevronDown size={15} />
        </div>
        <div className="intercom-node-body">
          {data.kind === "trigger" ? (
            <>
              <div className="intercom-trigger-icon" style={{ color: data.color, background: `${data.color}18` }}>
                <NodeIcon icon={data.icon} size={24} />
              </div>
              <p className="intercom-node-copy">{triggerCopy}</p>
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="intercom-pill">{triggerPill}</span>
                <span className="intercom-pill">{triggerChannelPill}</span>
              </div>
            </>
          ) : data.kind === "chatty" && data.type === "chatty.reply" && message ? (
            <div className="intercom-message-preview">{message}</div>
          ) : (
            <div className="intercom-action-chip">
              <span style={{ color: data.color, background: `${data.color}18` }}>
                <NodeIcon icon={data.icon} size={15} />
              </span>
              <b>{operationSummary}</b>
            </div>
          )}
          <div className="intercom-node-actions-row">
            <button
              type="button"
              className={`intercom-add-step ${pickerMode === "step" ? "is-open" : ""}`}
              onClick={(event) => {
                event.stopPropagation();
                setPickerMode((prev) => (prev === "step" ? null : "step"));
                data.onAddStep(data.id);
              }}
            >
              <Plus size={14} /> Add step
            </button>
            {data.kind === "logic" && (
              <button
                type="button"
                className={`intercom-add-branch ${pickerMode === "branch" ? "is-open" : ""}`}
                onClick={(event) => {
                  event.stopPropagation();
                  setPickerMode((prev) => (prev === "branch" ? null : "branch"));
                  data.onAddBranch(data.id);
                }}
              >
                <Plus size={14} /> Add path
              </button>
            )}
          </div>
          {pickerMode && (
            <div className="intercom-inline-picker nodrag" onClick={(event) => event.stopPropagation()}>
              <div className="intercom-inline-picker-head">
                <strong>{pickerMode === "branch" ? "Add branch path" : "Add next step"}</strong>
                <button
                  type="button"
                  className="intercom-inline-picker-close"
                  onClick={() => setPickerMode(null)}
                  aria-label="Close step picker"
                >
                  <X size={13} />
                </button>
              </div>
              {pickerMode === "branch" && (
                <div className="intercom-inline-branch-input">
                  <label>
                    Branch edge label:
                    <input
                      type="text"
                      value={branchLabel}
                      onChange={(e) => setBranchLabel(e.target.value)}
                      placeholder="e.g. else, before 6:00 PM, whatsapp"
                    />
                  </label>
                </div>
              )}
              <div className="intercom-inline-picker-grid">
                {STEP_CATALOG_ITEMS.map((item) => (
                  <button
                    key={item.type}
                    type="button"
                    className="intercom-inline-picker-item"
                    onClick={() => {
                      data.onQuickInsertStep?.(
                        data.id,
                        item,
                        pickerMode === "branch",
                        pickerMode === "branch" ? (branchLabel.trim() || "else") : undefined,
                      );
                      setPickerMode(null);
                    }}
                  >
                    <span className="intercom-inline-picker-icon" style={{ color: item.color, background: `${item.color}18` }}>
                      <NodeIcon icon={item.icon} size={13} />
                    </span>
                    <div>
                      <b>{item.title}</b>
                      <small>{item.subtitle}</small>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
        <span className="n8n-node-status-icons"><NodeExecutionMark status={status} /></span>
      </div>
      {data.isImported && <span className="n8n-node-badge">Imported</span>}
      <Handle type="source" position={Position.Right} className="n8n-handle n8n-handle-source" aria-label={`Connect from ${data.title}`} />
      {data.openMenuId === data.id && (
        <div className="n8n-node-context-menu" role="menu" onClick={(event) => event.stopPropagation()}>
          <button type="button" role="menuitem" onClick={() => data.onDuplicate(data)}><Copy size={13} /> Duplicate</button>
          <button type="button" role="menuitem" className="danger" onClick={() => data.onRemove(data.id)}><Trash2 size={13} /> Remove</button>
        </div>
      )}
    </div>
  );
}

function FlowCanvasInner(props: Props) {
  const reactFlow = useReactFlow<CanvasNode, Edge>();
  const updateNodeInternals = useUpdateNodeInternals();
  const nodeTypes = useMemo(() => ({ chatty: ChattyCanvasNode }), []);
  const actionRefs = useRef({ onSelect: props.onSelect, onDuplicate: props.onDuplicate, onRemove: props.onRemove, onToggleMenu: props.onToggleMenu, onAddStep: props.onAddStep, onAddBranch: props.onAddBranch, onQuickInsertStep: props.onQuickInsertStep });
  actionRefs.current = { onSelect: props.onSelect, onDuplicate: props.onDuplicate, onRemove: props.onRemove, onToggleMenu: props.onToggleMenu, onAddStep: props.onAddStep, onAddBranch: props.onAddBranch, onQuickInsertStep: props.onQuickInsertStep };
  const stableActions = useMemo<NodeActions>(() => ({
    onSelect: (nodeId) => actionRefs.current.onSelect(nodeId),
    onDuplicate: (node) => actionRefs.current.onDuplicate(node),
    onRemove: (nodeId) => actionRefs.current.onRemove(nodeId),
    onToggleMenu: (nodeId) => actionRefs.current.onToggleMenu(nodeId),
    onAddStep: (nodeId) => actionRefs.current.onAddStep(nodeId),
    onAddBranch: (nodeId) => actionRefs.current.onAddBranch(nodeId),
    onQuickInsertStep: (parentId, item, isBranch, branchLabel) => actionRefs.current.onQuickInsertStep?.(parentId, item, isBranch, branchLabel),
    openMenuId: null,
  }), []);

  const toCanvasNode = useCallback((node: FlowNode): CanvasNode => ({
    id: node.id,
    type: "chatty",
    position: { x: node.x, y: node.y },
    initialWidth: FLOW_NODE_LAYOUT.width,
    initialHeight: FLOW_NODE_LAYOUT.height,
    data: { ...node, ...stableActions, openMenuId: props.nodeMenuId },
    selected: node.id === props.selectedId,
  }), [props.nodeMenuId, props.selectedId, stableActions]);

  const toCanvasEdge = useCallback((edge: FlowEdge, nodeList: FlowNode[]): Edge => {
    const srcNode = nodeList.find((n) => n.id === edge.from);
    const dstNode = nodeList.find((n) => n.id === edge.to);
    const isCompleted = srcNode?.executionState === "completed" && dstNode?.executionState === "completed";
    return {
      id: `${edge.from}->${edge.to}`,
      source: edge.from,
      target: edge.to,
      type: "smoothstep",
      animated: isCompleted,
      label: edge.label,
      labelStyle: { fill: "#334155", fontWeight: 700, fontSize: 10 },
      labelBgStyle: { fill: "#ffffff", stroke: "#cbd5e1", strokeWidth: 1 },
      labelBgPadding: [6, 3],
      labelBgBorderRadius: 6,
      style: {
        stroke: isCompleted ? "#22c55e" : "#9aaabd",
        strokeWidth: isCompleted ? 2.2 : 1.8,
      },
    };
  }, []);

  const [canvasNodes, setCanvasNodes] = useState<CanvasNode[]>(() => props.nodes.map(toCanvasNode));
  const [canvasEdges, setCanvasEdges] = useState<Edge[]>(() => props.edges.map((edge) => toCanvasEdge(edge, props.nodes)));
  const hadNodesRef = useRef(props.nodes.length > 0);

  useEffect(() => {
    setCanvasNodes((current) => {
      const currentById = new Map(current.map((node) => [node.id, node]));
      return props.nodes.map((node) => {
        const previous = currentById.get(node.id);
        const next = toCanvasNode(node);
        if (!previous) return next;
        return {
          ...previous,
          position: next.position,
          selected: next.selected,
          data: { ...previous.data, ...node, openMenuId: props.nodeMenuId },
        };
      });
    });
  }, [props.nodes, props.nodeMenuId, props.selectedId, toCanvasNode]);

  useEffect(() => {
    setCanvasEdges(props.edges.map((edge) => toCanvasEdge(edge, props.nodes)));
  }, [props.edges, props.nodes, toCanvasEdge]);

  useEffect(() => {
    const hasNodes = props.nodes.length > 0;
    if (hasNodes && !hadNodesRef.current) {
      const timer = window.setTimeout(() => reactFlow.fitView({ padding: 0.28, duration: 200 }), 80);
      hadNodesRef.current = hasNodes;
      return () => window.clearTimeout(timer);
    }
    hadNodesRef.current = hasNodes;
    return undefined;
  }, [props.nodes.length, reactFlow]);

  const refreshNodeInternals = useCallback(() => {
    const timer = window.setTimeout(() => {
      updateNodeInternals(canvasNodes.map((node) => node.id));
    }, 40);
    return () => window.clearTimeout(timer);
  }, [canvasNodes, updateNodeInternals]);

  useEffect(() => refreshNodeInternals(), [canvasNodes.length, refreshNodeInternals]);

  useEffect(() => {
    if (!props.commandsRef) return;
    props.commandsRef.current = {
      zoomIn: () => { void reactFlow.zoomIn({ duration: 160 }); },
      zoomOut: () => { void reactFlow.zoomOut({ duration: 160 }); },
      resetZoom: () => { void reactFlow.zoomTo(1, { duration: 160 }); },
      fitView: () => { void reactFlow.fitView({ padding: 0.28, duration: 180 }); },
    };
    return () => { if (props.commandsRef) props.commandsRef.current = null; };
  }, [props.commandsRef, reactFlow]);

  const handleNodesChange = useCallback((changes: NodeChange<CanvasNode>[]) => {
    const next = applyNodeChanges(changes, canvasNodes);
    setCanvasNodes(next);
    const removed = new Set(changes.filter((change) => change.type === "remove").map((change) => change.id));
    if (removed.size > 0) {
      props.onEdgesChange(
        canvasEdges
          .filter((edge) => !removed.has(edge.source) && !removed.has(edge.target))
          .map((edge) => ({
            from: edge.source,
            to: edge.target,
            ...(typeof edge.label === "string" && edge.label ? { label: edge.label } : {}),
          })),
      );
    }
    props.onNodesChange(next.map((node) => {
      const source = props.nodes.find((item) => item.id === node.id);
      return source ? { ...source, x: node.position.x, y: node.position.y } : source;
    }).filter((node): node is FlowNode => Boolean(node)));
  }, [canvasEdges, canvasNodes, props]);

  const handleEdgesChange = useCallback((changes: EdgeChange<Edge>[]) => {
    const next = applyEdgeChanges(changes, canvasEdges);
    setCanvasEdges(next);
    props.onEdgesChange(
      next.map((edge) => ({
        from: edge.source,
        to: edge.target,
        ...(typeof edge.label === "string" && edge.label ? { label: edge.label } : {}),
      })),
    );
  }, [canvasEdges, props]);

  const handleConnect = useCallback((connection: Connection) => {
    if (connection.source && connection.target) props.onConnect(connection.source, connection.target);
  }, [props]);

  return (
    <div className="n8n-flow-canvas">
      <ReactFlow
        nodes={canvasNodes}
        edges={canvasEdges}
        nodeTypes={nodeTypes}
        onNodesChange={handleNodesChange}
        onEdgesChange={handleEdgesChange}
        onConnect={handleConnect}
        onInit={refreshNodeInternals}
        onPaneClick={() => props.onSelect("")}
        fitView
        fitViewOptions={{ padding: 0.28, minZoom: 0.45, maxZoom: 1.05 }}
        minZoom={0.2}
        maxZoom={2}
        snapToGrid
        snapGrid={[16, 16]}
        panOnDrag
        selectionOnDrag
        selectionKeyCode="Shift"
        deleteKeyCode={["Backspace", "Delete"]}
        attributionPosition="bottom-left"
      >
        <Background color="#d6dee9" gap={20} size={1} />
        <Controls showInteractive={false} position="bottom-right" />
        {canvasNodes.length > 0 && <MiniMap
          className="hidden sm:block"
          pannable
          zoomable
          position="bottom-left"
          nodeColor={(node) => String((node?.data as CanvasNodeData | undefined)?.color || "#cbd5e1")}
          maskColor="rgba(247, 249, 252, 0.75)"
        />}
        <button type="button" className="n8n-fit-view" onClick={() => reactFlow.fitView({ padding: 0.28, duration: 180 })} aria-label="Fit workflow to view">
          <Code2 size={14} /> Fit view
        </button>
      </ReactFlow>
      {canvasNodes.length === 0 && (
        <div className="canvas-empty-state">
          <div className="canvas-empty-icon"><Plus size={20} /></div>
          <strong>Start with a trigger</strong>
          <span>Add the first step to define when this workflow runs, or generate an entire journey with AI.</span>
          <div className="canvas-empty-actions">
            <button type="button" onClick={props.onCreateNode}>Open node library</button>
            {props.onOpenCopilot && (
              <button
                type="button"
                className="canvas-empty-ai-btn"
                onClick={props.onOpenCopilot}
              >
                ✨ Generate with AI Copilot
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export function FlowCanvas(props: Props) {
  return <ReactFlowProvider><FlowCanvasInner {...props} /></ReactFlowProvider>;
}
