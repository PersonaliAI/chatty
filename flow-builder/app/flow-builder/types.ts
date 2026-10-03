import type { NodeKind } from "./node-registry";

export type NodeExecutionState = "idle" | "queued" | "running" | "completed" | "failed" | "skipped";

export type FlowNode = {
  id: string;
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
  n8nParameters?: Record<string, unknown>;
  executionState?: NodeExecutionState;
  lastError?: string;
};

export type FlowEdge = { from: string; to: string; sourceHandle?: string; targetHandle?: string; label?: string };

export type FlowData = { nodes: FlowNode[]; edges: FlowEdge[] };

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
