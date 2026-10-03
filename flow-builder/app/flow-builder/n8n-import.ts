import type { FlowEdge, FlowNode } from "./types";
import { findNodeDefinition } from "./node-registry";

type N8nNode = {
  id?: string;
  name?: string;
  type?: string;
  typeVersion?: number;
  position?: [number, number];
  parameters?: Record<string, unknown>;
};

type N8nConnection = { node?: string };

type N8nWorkflow = {
  nodes?: N8nNode[];
  connections?: Record<string, { main?: N8nConnection[][] }>;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isN8nNode(value: unknown): value is N8nNode {
  return isRecord(value);
}

function text(value: unknown, fallback: string): string {
  return typeof value === "string" && value.trim() ? value : fallback;
}

export function importN8nWorkflow(payload: unknown): { nodes: FlowNode[]; edges: FlowEdge[] } {
  if (!isRecord(payload)) throw new Error("The n8n file must contain a JSON object.");
  const workflow = payload as N8nWorkflow;
  const sourceNodes = Array.isArray(workflow.nodes) ? workflow.nodes.filter(isN8nNode) : [];
  if (sourceNodes.length === 0) throw new Error("The n8n file has no workflow nodes.");

  const ids = new Map<string, string>();
  const nodes = sourceNodes.map((source, index) => {
    const name = text(source.name, `n8n node ${index + 1}`);
    const id = `n8n-${text(source.id, String(index + 1)).replace(/[^a-zA-Z0-9_-]/g, "-")}`;
    const n8nType = text(source.type, "n8n-unknown");
    ids.set(name, id);
    const definition = findNodeDefinition({ n8nType, title: name });
    const parameters = source.parameters ?? {};
    const isTrigger = definition?.kind === "trigger" || n8nType.toLowerCase().includes("trigger") || n8nType.toLowerCase().includes("webhook");
    const method = typeof parameters.method === "string" ? parameters.method : undefined;
    const url = typeof parameters.url === "string" ? parameters.url : undefined;
    return {
      id,
      kind: definition?.kind ?? (isTrigger ? "trigger" : "action"),
      title: name,
      subtitle: definition?.subtitle ?? n8nType,
      icon: isTrigger ? "webhook" : "n8n",
      color: definition?.color ?? "#ff6d5a",
      x: source.position?.[0] ?? 120 + (index % 4) * 280,
      y: source.position?.[1] ?? 120 + Math.floor(index / 4) * 150,
      provider: definition?.provider ?? "n8n",
      n8nType,
      n8nTypeVersion: source.typeVersion,
      n8nParameters: parameters,
      config: { ...(definition?.defaultConfig ?? { operation: "Run node" }), provider: "n8n", imported: "true", ...(method ? { method } : {}), ...(url ? { url } : {}) },
      operations: definition?.operations ?? ["Run workflow"],
    } satisfies FlowNode;
  });

  const edges: FlowEdge[] = [];
  const connections = isRecord(workflow.connections) ? workflow.connections : {};
  for (const [sourceName, output] of Object.entries(connections)) {
    const from = ids.get(sourceName);
    if (!from) continue;
    const branches = isRecord(output) && Array.isArray(output.main) ? output.main : [];
    for (const branch of branches) {
      if (!Array.isArray(branch)) continue;
      for (const connection of branch) {
        if (!isRecord(connection)) continue;
        const to = typeof connection.node === "string" ? ids.get(connection.node) : undefined;
        if (to) edges.push({ from, to });
      }
    }
  }
  return { nodes, edges };
}
