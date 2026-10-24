import test from "node:test";
import assert from "node:assert/strict";
import {
  autoLayoutGraph,
  calculateTemplateLayers,
  findAvailableNodePosition,
  getTemplateNodePosition,
  nodesOverlap,
} from "../src/app/flow/flow-builder/graph-layout.ts";
import {
  findNodeDefinition,
  nodeCatalog,
} from "../src/app/flow/flow-builder/node-registry.ts";

function assertNoOverlaps(nodes, label = "") {
  for (let i = 0; i < nodes.length; i += 1) {
    for (let j = i + 1; j < nodes.length; j += 1) {
      const a = nodes[i];
      const b = nodes[j];
      assert.equal(
        nodesOverlap(a, b),
        false,
        `${label}: Node ${a.id} (${a.x},${a.y}) overlaps with ${b.id} (${b.x},${b.y})`,
      );
    }
  }
}

test("findNodeDefinition resolves by node.type even when AI customizes title", () => {
  const customReplyNode = {
    type: "chatty.reply",
    provider: "Chatty",
    title: "Greet Enterprise Lead",
  };
  const def = findNodeDefinition(customReplyNode);
  assert.ok(def);
  assert.equal(def.type, "chatty.reply");
  assert.equal(def.kind, "chatty");

  const customConditionNode = {
    type: "core.condition",
    provider: "Flow control",
    title: "Is Urgent Ticket?",
  };
  const condDef = findNodeDefinition(customConditionNode);
  assert.ok(condDef);
  assert.equal(condDef.type, "core.condition");
  assert.equal(condDef.kind, "logic");
});

test("nodeCatalog provides valid defaultConfig for every required field", () => {
  for (const item of nodeCatalog) {
    for (const field of item.fields) {
      if (field.required) {
        assert.ok(
          String(item.defaultConfig[field.key] ?? "").trim().length > 0,
          `Catalog node ${item.type} is missing defaultConfig for required field ${field.key}`,
        );
      }
    }
  }
});

test("autoLayoutGraph handles diamond topology, multi-branching, and eliminates edge crossings without overlap", () => {
  const rawNodes = [
    { id: "trig", type: "chatty.event", kind: "trigger", title: "Trigger", subtitle: "", icon: "chatty", color: "#f97316", x: 0, y: 0, config: {} },
    { id: "cond", type: "core.condition", kind: "logic", title: "Condition", subtitle: "", icon: "branch", color: "#f59e0b", x: 0, y: 0, config: {} },
    { id: "ai", type: "chatty.ai", kind: "chatty", title: "AI", subtitle: "", icon: "spark", color: "#a855f7", x: 0, y: 0, config: {} },
    { id: "b1", type: "chatty.reply", kind: "chatty", title: "Sales Reply", subtitle: "", icon: "chatty", color: "#f97316", x: 0, y: 0, config: {} },
    { id: "b2", type: "chatty.reply", kind: "chatty", title: "Support Reply", subtitle: "", icon: "chatty", color: "#f97316", x: 0, y: 0, config: {} },
    { id: "leaf2", type: "action.email", kind: "action", title: "Support Email", subtitle: "", icon: "mail", color: "#2563eb", x: 0, y: 0, config: {} },
    { id: "leaf1", type: "action.slack", kind: "action", title: "Sales Slack", subtitle: "", icon: "slack", color: "#4a154b", x: 0, y: 0, config: {} },
    { id: "merge", type: "action.crm", kind: "action", title: "Update CRM", subtitle: "", icon: "crm", color: "#10b981", x: 0, y: 0, config: {} },
  ];
  const edges = [
    { from: "trig", to: "cond" },
    { from: "trig", to: "ai" },
    { from: "ai", to: "cond" },
    { from: "cond", to: "b1", label: "sales" },
    { from: "cond", to: "b2", label: "support" },
    { from: "b1", to: "leaf1" },
    { from: "b2", to: "leaf2" },
    { from: "leaf1", to: "merge" },
    { from: "leaf2", to: "merge" },
  ];

  const layouted = autoLayoutGraph(rawNodes, edges);
  assert.equal(layouted.length, 8);
  assertNoOverlaps(layouted, "diamond-multi-branch");

  const byId = new Map(layouted.map((n) => [n.id, n]));
  // Longest-path layering ensures cond is after ai
  assert.ok(byId.get("trig").x < byId.get("ai").x);
  assert.ok(byId.get("ai").x < byId.get("cond").x);
  assert.ok(byId.get("cond").x < byId.get("b1").x);
  assert.equal(byId.get("b1").x, byId.get("b2").x);
  // Barycenter ordering ensures leaf1 stays above leaf2 matching b1 above b2
  assert.ok(byId.get("b1").y < byId.get("b2").y);
  assert.ok(byId.get("leaf1").y < byId.get("leaf2").y);
  // Merge node is placed to the right of both leaves
  assert.ok(byId.get("leaf1").x < byId.get("merge").x);
});

test("findAvailableNodePosition and calculateTemplateLayers never overlap existing nodes", () => {
  const placed = [];
  for (let i = 0; i < 10; i += 1) {
    const pos = findAvailableNodePosition(placed, { x: 96, y: 96 });
    placed.push({ id: `n-${i}`, x: pos.x, y: pos.y });
  }
  assertNoOverlaps(placed, "sequential-placement");

  const layers = calculateTemplateLayers(7, [[0, 1], [1, 2], [2, 3], [3, 4], [2, 5], [5, 6]]);
  assert.deepEqual(layers, [0, 1, 2, 3, 4, 3, 4]);
  const p0 = getTemplateNodePosition(0, 0);
  const p1 = getTemplateNodePosition(1, 0);
  assert.equal(nodesOverlap(p0, p1), false);
});
