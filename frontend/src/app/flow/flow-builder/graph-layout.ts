import type { FlowNode } from "./types";

export const FLOW_NODE_LAYOUT = {
  width: 312,
  height: 260,
  horizontalGap: 108,
  verticalGap: 72,
  originX: 96,
  originY: 96,
} as const;

type TemplateConnection = readonly [number, number, string?];

export function calculateTemplateLayers(stepCount: number, connections: readonly TemplateConnection[]): number[] {
  const children = Array.from({ length: stepCount }, () => [] as number[]);
  const incoming = Array.from({ length: stepCount }, () => 0);
  const layers = Array.from({ length: stepCount }, () => 0);

  for (const [from, to] of connections) {
    if (from < 0 || from >= stepCount || to < 0 || to >= stepCount || from === to) continue;
    children[from].push(to);
    incoming[to] += 1;
  }

  const queue = incoming
    .map((count, index) => (count === 0 ? index : -1))
    .filter((index) => index >= 0);
  const visited = new Set<number>();

  while (queue.length > 0) {
    const current = queue.shift();
    if (current === undefined) continue;
    visited.add(current);
    for (const child of children[current]) {
      layers[child] = Math.max(layers[child], layers[current] + 1);
      incoming[child] -= 1;
      if (incoming[child] === 0) queue.push(child);
    }
  }

  // Keep a deterministic position for an invalid cyclic template. The API
  // still rejects the cycle before publish, but the draft must remain usable.
  for (let index = 0; index < stepCount; index += 1) {
    if (!visited.has(index)) layers[index] = Math.max(layers[index], 0);
  }

  return layers;
}

export function getTemplateNodePosition(layer: number, row: number): { x: number; y: number } {
  return {
    x: FLOW_NODE_LAYOUT.originX + layer * (FLOW_NODE_LAYOUT.width + FLOW_NODE_LAYOUT.horizontalGap),
    y: FLOW_NODE_LAYOUT.originY + row * (FLOW_NODE_LAYOUT.height + FLOW_NODE_LAYOUT.verticalGap),
  };
}

function overlaps(first: { x: number; y: number }, second: { x: number; y: number }): boolean {
  const horizontal = first.x < second.x + FLOW_NODE_LAYOUT.width + FLOW_NODE_LAYOUT.horizontalGap
    && first.x + FLOW_NODE_LAYOUT.width + FLOW_NODE_LAYOUT.horizontalGap > second.x;
  const vertical = first.y < second.y + FLOW_NODE_LAYOUT.height + FLOW_NODE_LAYOUT.verticalGap
    && first.y + FLOW_NODE_LAYOUT.height + FLOW_NODE_LAYOUT.verticalGap > second.y;
  return horizontal && vertical;
}

export function findAvailableNodePosition(
  nodes: Pick<FlowNode, "x" | "y">[],
  preferred: { x: number; y: number },
): { x: number; y: number } {
  const rowOffsets = [0, 1, -1, 2, -2, 3, -3, 4, -4, 5, -5];
  const columnStep = FLOW_NODE_LAYOUT.width + FLOW_NODE_LAYOUT.horizontalGap;
  const rowStep = FLOW_NODE_LAYOUT.height + FLOW_NODE_LAYOUT.verticalGap;

  for (let column = 0; column < 12; column += 1) {
    for (const rowOffset of rowOffsets) {
      const candidate = {
        x: preferred.x + column * columnStep,
        y: preferred.y + rowOffset * rowStep,
      };
      if (nodes.every((node) => !overlaps(candidate, node))) return candidate;
    }
  }

  return { x: preferred.x + 12 * columnStep, y: preferred.y };
}
