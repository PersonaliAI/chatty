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
};

export type FlowEdge = { from: string; to: string };
