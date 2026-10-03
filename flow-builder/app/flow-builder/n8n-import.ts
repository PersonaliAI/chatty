import type { FlowEdge, FlowNode } from "./types";

type N8nNode = {
  name?: string;
  type?: string;
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
    const id = `n8n-${index + 1}`;
    ids.set(name, id);
    const isTrigger = text(source.type, "").toLowerCase().includes("trigger") || text(source.type, "").toLowerCase().includes("webhook");
    return {
      id,
      kind: isTrigger ? "trigger" : "action",
      title: name,
      subtitle: text(source.type, "Imported n8n node"),
      icon: isTrigger ? "webhook" : "n8n",
      color: "#ff6d5a",
      x: source.position?.[0] ?? 120 + (index % 4) * 280,
      y: source.position?.[1] ?? 120 + Math.floor(index / 4) * 150,
      config: { provider: "n8n", operation: text(source.type, "Run workflow"), imported: "true" },
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
