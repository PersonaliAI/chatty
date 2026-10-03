import type { NodeKind } from "./node-registry";

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
};

export type FlowEdge = { from: string; to: string };
