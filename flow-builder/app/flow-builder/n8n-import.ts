import type { FlowEdge, FlowNode } from "./types";

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

function text(value: unknown, fallback: string): string {
  return typeof value === "string" && value.trim() ? value : fallback;
}

export function importN8nWorkflow(payload: unknown): { nodes: FlowNode[]; edges: FlowEdge[] } {
  if (!payload || typeof payload !== "object") throw new Error("The n8n file must contain a JSON object.");
  const workflow = payload as N8nWorkflow;
  if (!Array.isArray(workflow.nodes) || workflow.nodes.length === 0) throw new Error("The n8n file has no workflow nodes.");

  const ids = new Map<string, string>();
  const nodes = workflow.nodes.map((source, index) => {
    const name = text(source.name, `n8n node ${index + 1}`);
    const id = `n8n-${text(source.id, String(index + 1)).replace(/[^a-zA-Z0-9_-]/g, "-")}`;
    const n8nType = text(source.type, "n8n-unknown");
    ids.set(name, id);
    const isTrigger = n8nType.toLowerCase().includes("trigger") || n8nType.toLowerCase().includes("webhook");
    return {
      id,
      kind: isTrigger ? "trigger" : "action",
      title: name,
      subtitle: n8nType,
      icon: isTrigger ? "webhook" : "n8n",
      color: "#ff6d5a",
      x: source.position?.[0] ?? 120 + (index % 4) * 280,
      y: source.position?.[1] ?? 120 + Math.floor(index / 4) * 150,
      provider: "n8n",
      n8nType,
      n8nTypeVersion: source.typeVersion,
      n8nParameters: source.parameters ?? {},
      config: { provider: "n8n", operation: "Run node", imported: "true" },
      operations: ["Run workflow"],
    } satisfies FlowNode;
  });

  const edges: FlowEdge[] = [];
  for (const [sourceName, output] of Object.entries(workflow.connections ?? {})) {
    const from = ids.get(sourceName);
    if (!from) continue;
    for (const branch of output.main ?? []) {
      for (const connection of branch) {
        const to = connection.node ? ids.get(connection.node) : undefined;
        if (to) edges.push({ from, to });
      }
    }
  }
  return { nodes, edges };
}
