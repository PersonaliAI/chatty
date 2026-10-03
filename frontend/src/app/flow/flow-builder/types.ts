import type { NodeKind } from "./node-registry";

export type NodeExecutionState = "idle" | "queued" | "running" | "completed" | "failed" | "skipped";

export type FlowNode = {
  id: string;
  type?: string;
  kind: NodeKind;
  title: string;
  subtitle: string;
  icon: string;
  color: string;
  x: number;
  y: number;
  config: Record<string, string>;
  operations?: string[];
  provider?: string;
  credentialType?: string;
  n8nType?: string;
  n8nTypeVersion?: number;
  isImported?: boolean;
  n8nParameters?: Record<string, unknown>;
  executionState?: NodeExecutionState;
  lastError?: string;
  pathId?: string;
  pathTitle?: string;
  stepIndex?: number;
};

export type FlowEdge = { from: string; to: string; sourceHandle?: string; targetHandle?: string; label?: string };

export type FlowPath = {
  id: string;
  title: string;
  description?: string;
  color?: string;
};

export type FlowData = { nodes: FlowNode[]; edges: FlowEdge[]; paths?: FlowPath[] };

export type FlowConnection = {
  id: string;
  bot_id: string;
  provider: string;
  name: string;
  auth_type: "oauth" | "api_key" | "token" | "basic" | "webhook";
  status: "connected" | "disconnected" | "error";
  metadata?: Record<string, string>;
  created_at?: string;
  updated_at?: string;
};

export type FlowRunTrace = {
  node_id: string;
  title: string;
  status: string;
  error?: string | null;
};

export type FlowRun = {
  id: string;
  flow_id?: string | null;
  version_id?: string | null;
  status: "queued" | "running" | "completed" | "failed";
  inputs?: Record<string, unknown>;
  trace?: FlowRunTrace[];
  error?: string | null;
  duration_ms?: number | null;
  created_at?: string;
  completed_at?: string | null;
};
