import type { FlowNode } from "./types";

export const FLOW_NODE_LAYOUT = {
  width: 312,
  height: 260,
  horizontalGap: 136,
  verticalGap: 92,
  originX: 96,
  originY: 96,
} as const;

type TemplateConnection = readonly [number, number, string?];

function snapToGrid(value: number, grid = 16): number {
  return Math.round(value / grid) * grid;
}

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

  for (let index = 0; index < stepCount; index += 1) {
    if (!visited.has(index)) layers[index] = Math.max(layers[index], 0);
  }

  return layers;
}

export function getTemplateNodePosition(layer: number, row: number): { x: number; y: number } {
  return {
    x: snapToGrid(FLOW_NODE_LAYOUT.originX + layer * (FLOW_NODE_LAYOUT.width + FLOW_NODE_LAYOUT.horizontalGap)),
    y: snapToGrid(FLOW_NODE_LAYOUT.originY + row * (FLOW_NODE_LAYOUT.height + FLOW_NODE_LAYOUT.verticalGap)),
  };
}

export function nodesOverlap(
  first: { x: number; y: number },
  second: { x: number; y: number },
  paddingX = 64,
  paddingY = 48,
): boolean {
  const minDx = FLOW_NODE_LAYOUT.width + paddingX;
  const minDy = FLOW_NODE_LAYOUT.height + paddingY;
  return Math.abs(first.x - second.x) < minDx && Math.abs(first.y - second.y) < minDy;
}

export function findAvailableNodePosition(
  nodes: Pick<FlowNode, "x" | "y">[],
  preferred: { x: number; y: number },
): { x: number; y: number } {
  const rowOffsets = [0, 1, -1, 2, -2, 3, -3, 4, -4, 5, -5];
  const columnStep = FLOW_NODE_LAYOUT.width + FLOW_NODE_LAYOUT.horizontalGap;
  const rowStep = FLOW_NODE_LAYOUT.height + FLOW_NODE_LAYOUT.verticalGap;

  for (let column = 0; column < 14; column += 1) {
    for (const rowOffset of rowOffsets) {
      const candidate = {
        x: snapToGrid(preferred.x + column * columnStep),
        y: snapToGrid(preferred.y + rowOffset * rowStep),
      };
      if (nodes.every((node) => !nodesOverlap(candidate, node))) return candidate;
    }
  }

  return {
    x: snapToGrid(preferred.x + 14 * columnStep),
    y: snapToGrid(preferred.y),
  };
}

/**
 * Computes a clean, non-overlapping topological DAG layout:
 * 1. Kahn's longest-path layering (handles branches, merges, diamonds, and cycle fallback).
 * 2. Sugiyama barycenter row ordering within each column to eliminate edge crossings.
 * 3. Symmetrical vertical centering around the workflow spine.
 * 4. Strict bounding-box collision guard so no two nodes ever overlap.
 */
export function autoLayoutGraph(
  nodes: FlowNode[],
  edges: Array<{ from: string; to: string; label?: string }>,
): FlowNode[] {
  if (nodes.length === 0) return [];

  const orderedIds = nodes.map((n) => n.id);
  const nodeIds = new Set(orderedIds);
  const orderIndex = new Map(orderedIds.map((id, idx) => [id, idx]));

  const inDegree = new Map<string, number>();
  const outgoing = new Map<string, string[]>();
  const parents = new Map<string, string[]>();

  for (const id of orderedIds) {
    inDegree.set(id, 0);
    outgoing.set(id, []);
    parents.set(id, []);
  }

  const seenEdges = new Set<string>();
  for (const edge of edges) {
    const u = edge.from;
    const v = edge.to;
    const key = `${u}->${v}`;
    if (nodeIds.has(u) && nodeIds.has(v) && u !== v && !seenEdges.has(key)) {
      seenEdges.add(key);
      outgoing.get(u)?.push(v);
      parents.get(v)?.push(u);
      inDegree.set(v, (inDegree.get(v) ?? 0) + 1);
    }
  }

  const layers = new Map<string, number>();
  const queue: string[] = orderedIds.filter((id) => (inDegree.get(id) ?? 0) === 0);
  for (const id of queue) {
    layers.set(id, 0);
  }

  const processed = new Set<string>();
  while (processed.size < orderedIds.length) {
    if (queue.length === 0) {
      const remaining = orderedIds.find((id) => !processed.has(id));
      if (!remaining) break;
      const parentLayers = (parents.get(remaining) ?? [])
        .filter((p) => layers.has(p))
        .map((p) => (layers.get(p) ?? 0) + 1);
      layers.set(remaining, parentLayers.length > 0 ? Math.max(...parentLayers) : 0);
      queue.push(remaining);
    }

    const current = queue.shift();
    if (!current || processed.has(current)) continue;
    processed.add(current);
    const curLayer = layers.get(current) ?? 0;

    for (const child of outgoing.get(current) ?? []) {
      if (processed.has(child)) continue;
      layers.set(child, Math.max(layers.get(child) ?? 0, curLayer + 1));
      const nextIn = (inDegree.get(child) ?? 1) - 1;
      inDegree.set(child, nextIn);
      if (nextIn <= 0) {
        queue.push(child);
      }
    }
  }

  const nodesByLayer = new Map<number, FlowNode[]>();
  for (const node of nodes) {
    const l = layers.get(node.id) ?? 0;
    const list = nodesByLayer.get(l) ?? [];
    list.push(node);
    nodesByLayer.set(l, list);
  }

  const stepX = FLOW_NODE_LAYOUT.width + FLOW_NODE_LAYOUT.horizontalGap;
  const stepY = FLOW_NODE_LAYOUT.height + FLOW_NODE_LAYOUT.verticalGap;

  let maxRows = 1;
  for (const list of nodesByLayer.values()) {
    if (list.length > maxRows) maxRows = list.length;
  }
  const spineY = FLOW_NODE_LAYOUT.originY + ((maxRows - 1) * stepY) / 2;

  const assignedY = new Map<string, number>();
  const coords = new Map<string, { x: number; y: number; stepIndex: number }>();
  const placedBoxes: Array<{ x: number; y: number }> = [];

  const sortedLayerIndices = [...nodesByLayer.keys()].sort((a, b) => a - b);
  for (const layerIdx of sortedLayerIndices) {
    const colNodes = [...(nodesByLayer.get(layerIdx) ?? [])];
    if (layerIdx > 0 && colNodes.length > 1) {
      colNodes.sort((a, b) => {
        const pa = (parents.get(a.id) ?? []).filter((p) => assignedY.has(p));
        const pb = (parents.get(b.id) ?? []).filter((p) => assignedY.has(p));
        const avgA = pa.length > 0 ? pa.reduce((s, p) => s + (assignedY.get(p) ?? 0), 0) / pa.length : (orderIndex.get(a.id) ?? 0) * stepY;
        const avgB = pb.length > 0 ? pb.reduce((s, p) => s + (assignedY.get(p) ?? 0), 0) / pb.length : (orderIndex.get(b.id) ?? 0) * stepY;
        if (Math.abs(avgA - avgB) > 1) return avgA - avgB;
        return (orderIndex.get(a.id) ?? 0) - (orderIndex.get(b.id) ?? 0);
      });
    }

    const k = colNodes.length;
    const colStartY = spineY - ((k - 1) * stepY) / 2;
    const targetX = snapToGrid(FLOW_NODE_LAYOUT.originX + layerIdx * stepX);

    for (let rowIdx = 0; rowIdx < k; rowIdx += 1) {
      const node = colNodes[rowIdx];
      let targetY = snapToGrid(colStartY + rowIdx * stepY);

      while (placedBoxes.some((box) => nodesOverlap({ x: targetX, y: targetY }, box))) {
        targetY = snapToGrid(targetY + stepY);
      }

      placedBoxes.push({ x: targetX, y: targetY });
      assignedY.set(node.id, targetY);
      coords.set(node.id, { x: targetX, y: targetY, stepIndex: layerIdx });
    }
  }

  return nodes.map((node) => {
    const pos = coords.get(node.id) ?? {
      x: FLOW_NODE_LAYOUT.originX,
      y: FLOW_NODE_LAYOUT.originY,
      stepIndex: 0,
    };
    return {
      ...node,
      x: pos.x,
      y: pos.y,
      stepIndex: pos.stepIndex,
    };
  });
}
