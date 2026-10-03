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
import { AlertCircle, CheckCircle2, Clock3, Code2, Copy, Loader2, Minus, MoreHorizontal, Plus, Trash2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type MutableRefObject } from "react";
import type { FlowEdge, FlowNode } from "./types";
import { NodeIcon } from "./node-icon";

type NodeActions = {
  onSelect: (nodeId: string) => void;
  onDuplicate: (node: FlowNode) => void;
  onRemove: (nodeId: string) => void;
  onToggleMenu: (nodeId: string) => void;
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
  onCreateNode: () => void;
  commandsRef?: MutableRefObject<FlowCanvasCommands | null>;
};

function NodeExecutionMark({ status }: { status: NonNullable<FlowNode["executionState"]> }) {
  const StatusIcon = status === "completed" ? CheckCircle2 : status === "failed" ? AlertCircle : status === "running" ? Loader2 : status === "queued" ? Clock3 : status === "skipped" ? Minus : null;
  if (!StatusIcon) return null;
  const label = status === "completed" ? "Executed" : status === "failed" ? "Error" : status === "running" ? "Running" : status === "queued" ? "Queued" : "Skipped";
  return <span className={`n8n-node-status n8n-node-status-${status}`} title={label} aria-label={label}><StatusIcon className={status === "running" ? "n8n-node-status-spin" : ""} size={14} /></span>;
}

function ChattyCanvasNode({ data, selected }: NodeProps<CanvasNode>) {
  const updateNodeInternals = useUpdateNodeInternals();
  useEffect(() => {
    const frame = window.requestAnimationFrame(() => updateNodeInternals(data.id));
    return () => window.cancelAnimationFrame(frame);
  }, [data.id, updateNodeInternals]);

  const status = data.executionState ?? "idle";
  return (
    <div
      className={`n8n-canvas-node ${selected ? "is-selected" : ""} ${data.kind === "trigger" ? "n8n-trigger" : ""} n8n-state-${status}`}
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
      <div className="n8n-node-card">
        <span className="n8n-node-icon"><NodeIcon icon={data.icon} size={28} /></span>
        <span className="n8n-node-status-icons"><NodeExecutionMark status={status} /></span>
      </div>
      <div className="n8n-node-description">
        <div className="n8n-node-title" title={data.title}>{data.title}</div>
        <div className="n8n-node-subtitle" title={data.subtitle}>{data.subtitle}</div>
        {data.isImported && <span className="n8n-node-badge">Imported</span>}
      </div>
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
  const actionRefs = useRef({ onSelect: props.onSelect, onDuplicate: props.onDuplicate, onRemove: props.onRemove, onToggleMenu: props.onToggleMenu });
  actionRefs.current = { onSelect: props.onSelect, onDuplicate: props.onDuplicate, onRemove: props.onRemove, onToggleMenu: props.onToggleMenu };
  const stableActions = useMemo<NodeActions>(() => ({
    onSelect: (nodeId) => actionRefs.current.onSelect(nodeId),
    onDuplicate: (node) => actionRefs.current.onDuplicate(node),
    onRemove: (nodeId) => actionRefs.current.onRemove(nodeId),
    onToggleMenu: (nodeId) => actionRefs.current.onToggleMenu(nodeId),
    openMenuId: null,
  }), []);

  const toCanvasNode = useCallback((node: FlowNode): CanvasNode => ({
    id: node.id,
    type: "chatty",
    position: { x: node.x, y: node.y },
    // React Flow keeps nodes hidden until it has dimensions. The card has a
    // stable n8n-style size, so provide it up front while ResizeObserver
    // measures the rendered handles.
    width: 236,
    height: 146,
    data: { ...node, ...stableActions, openMenuId: props.nodeMenuId },
    selected: node.id === props.selectedId,
  }), [props.nodeMenuId, props.selectedId, stableActions]);
  const [canvasNodes, setCanvasNodes] = useState<CanvasNode[]>(() => props.nodes.map(toCanvasNode));
  const [canvasEdges, setCanvasEdges] = useState<Edge[]>(() => props.edges.map((edge) => ({
    id: `${edge.from}->${edge.to}`,
    source: edge.from,
    target: edge.to,
    type: "smoothstep",
    animated: false,
    style: { stroke: "#9aaabd", strokeWidth: 1.8 },
  })));

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
    setCanvasEdges(props.edges.map((edge) => ({
      id: `${edge.from}->${edge.to}`,
      source: edge.from,
      target: edge.to,
      type: "smoothstep",
      animated: false,
      style: { stroke: "#9aaabd", strokeWidth: 1.8 },
    })));
  }, [props.edges]);

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
      fitView: () => { void reactFlow.fitView({ padding: 0.35, duration: 160 }); },
    };
    return () => { if (props.commandsRef) props.commandsRef.current = null; };
  }, [props.commandsRef, reactFlow]);

  const handleNodesChange = useCallback((changes: NodeChange<CanvasNode>[]) => {
    const next = applyNodeChanges(changes, canvasNodes);
    setCanvasNodes(next);
    const removed = new Set(changes.filter((change) => change.type === "remove").map((change) => change.id));
    if (removed.size > 0) {
      props.onEdgesChange(canvasEdges.filter((edge) => !removed.has(edge.source) && !removed.has(edge.target)).map((edge) => ({ from: edge.source, to: edge.target })));
    }
    props.onNodesChange(next.map((node) => {
      const source = props.nodes.find((item) => item.id === node.id);
      return source ? { ...source, x: node.position.x, y: node.position.y } : source;
    }).filter((node): node is FlowNode => Boolean(node)));
  }, [canvasNodes, props]);

  const handleEdgesChange = useCallback((changes: EdgeChange[]) => {
    const next = applyEdgeChanges(changes, canvasEdges);
    setCanvasEdges(next);
    props.onEdgesChange(next.map((edge) => ({ from: edge.source, to: edge.target })));
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
        fitViewOptions={{ padding: 0.35, minZoom: 0.55, maxZoom: 1.1 }}
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
          pannable
          zoomable
          position="bottom-left"
          nodeColor={(node) => String((node.data as CanvasNodeData).color || "#cbd5e1")}
          maskColor="rgba(247, 249, 252, 0.75)"
        />}
        <button type="button" className="n8n-fit-view" onClick={() => reactFlow.fitView({ padding: 0.35 })} aria-label="Fit workflow to view">
          <Code2 size={14} /> Fit view
        </button>
      </ReactFlow>
      {canvasNodes.length === 0 && <div className="canvas-empty-state"><div className="canvas-empty-icon"><Plus size={20} /></div><strong>Start with a trigger</strong><span>Add the first step to define when this workflow runs.</span><button type="button" onClick={props.onCreateNode}>Open node library</button></div>}
    </div>
  );
}

export function FlowCanvas(props: Props) {
  return <ReactFlowProvider><FlowCanvasInner {...props} /></ReactFlowProvider>;
}
