import type { FlowData } from "./types";

type N8nExportNode = {
  id: string;
  name: string;
  type: string;
  typeVersion: number;
  position: [number, number];
  parameters: Record<string, unknown>;
};

export function exportN8nWorkflow(flow: FlowData) {
  const nodes: N8nExportNode[] = flow.nodes.map((node) => ({
    id: node.id,
    name: node.title,
    type: node.n8nType ?? `chatty.${node.provider?.toLowerCase().replace(/\s+/g, "-") ?? node.kind}`,
    typeVersion: node.n8nTypeVersion ?? 1,
    position: [node.x, node.y],
    parameters: node.n8nParameters ?? { ...node.config },
  }));

  const connections: Record<string, { main: Array<Array<{ node: string; type: string; index: number }>> }> = {};
  for (const node of flow.nodes) {
    const children = flow.edges.filter((edge) => edge.from === node.id);
    if (children.length === 0) continue;
    connections[node.title] = {
      main: [children.map((edge) => ({ node: flow.nodes.find((candidate) => candidate.id === edge.to)?.title ?? edge.to, type: "main", index: 0 }))],
    };
  }

  return {
    name: "Chatty workflow",
    nodes,
    connections,
    active: false,
    settings: {},
    versionId: crypto.randomUUID(),
    meta: { generatedBy: "Chatty Flow Builder" },
  };
}
