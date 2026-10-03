import { calculateTemplateLayers, getTemplateNodePosition } from "./graph-layout";
import { nodeCatalog } from "./node-registry";
import type { FlowData, FlowNode, FlowPath } from "./types";

export type FlowTemplateStep = {
  type: string;
  config?: Record<string, string>;
  pathId?: string;
  pathTitle?: string;
};

export type FlowTemplate = {
  id: string;
  title: string;
  description: string;
  category: string;
  icon: string;
  color: string;
  setup: string[];
  steps: FlowTemplateStep[];
  connections: Array<[number, number, string?]>;
};

export const flowTemplates: FlowTemplate[] = [
  {
    id: "lead-qualification-and-handoff",
    title: "Lead qualification and handoff",
    description: "A production lead journey with qualification, a routed response, and an automation handoff.",
    category: "Revenue operations",
    icon: "chatty",
    color: "#f97316",
    setup: ["Review the qualification field and values", "Configure the automation webhook endpoint", "Replace the reply copy with your approved sales language"],
    steps: [
      { type: "chatty.event", config: { event: "lead.created" } },
      { type: "chatty.reply", config: { message: "Thanks for contacting us. We have your details and will ask a few quick questions." } },
      { type: "core.condition", config: { field: "data.intent", operator: "equals", value: "sales" } },
      { type: "chatty.reply", pathId: "qualified", pathTitle: "Qualified", config: { message: "Thanks. A specialist will follow up with the next steps." } },
      { type: "n8n.httpRequest", pathId: "qualified", pathTitle: "Qualified", config: { method: "POST", body: "{\"event\":\"lead.qualified\",\"lead\":{{data}}}" } },
      { type: "core.wait", pathId: "follow-up", pathTitle: "Follow-up", config: { duration: "900" } },
      { type: "chatty.reply", pathId: "follow-up", pathTitle: "Follow-up", config: { message: "We are still here if you need help. Reply to continue." } },
    ],
    connections: [[0, 1], [1, 2], [2, 3, "sales"], [3, 4], [2, 5, "else"], [5, 6]],
  },
  {
    id: "support-triage-and-escalation",
    title: "Support triage and escalation",
    description: "Classify an inbound message, acknowledge the visitor, and route urgent work to an external queue.",
    category: "Customer support",
    icon: "spark",
    color: "#a855f7",
    setup: ["Connect the Chatty AI adapter", "Configure the escalation webhook endpoint", "Review the urgent and standard response paths"],
    steps: [
      { type: "chatty.event", config: { event: "message.user" } },
      { type: "chatty.ai", config: { instruction: "Classify the visitor message as urgent, billing, technical, sales, or other. Return a category and a short reason." } },
      { type: "chatty.reply", config: { message: "Thanks for your message. We are checking the right next step for you." } },
      { type: "core.condition", config: { field: "data.category", operator: "equals", value: "urgent" } },
      { type: "chatty.reply", pathId: "urgent", pathTitle: "Urgent", config: { message: "We have marked this as urgent and are notifying the support team now." } },
      { type: "n8n.httpRequest", pathId: "urgent", pathTitle: "Urgent", config: { method: "POST", body: "{\"event\":\"support.escalation\",\"priority\":\"urgent\",\"data\":{{data}}}" } },
      { type: "core.wait", pathId: "standard", pathTitle: "Standard", config: { duration: "300" } },
      { type: "chatty.reply", pathId: "standard", pathTitle: "Standard", config: { message: "A specialist will review your message and follow up as soon as possible." } },
    ],
    connections: [[0, 1], [1, 2], [2, 3], [3, 4, "urgent"], [4, 5], [3, 6, "standard"], [6, 7]],
  },
  {
    id: "booking-confirmation-and-reminder",
    title: "Booking confirmation and reminder",
    description: "Confirm a booked meeting, notify an external system, and send a timed reminder.",
    category: "Meetings",
    icon: "calendar",
    color: "#3b82f6",
    setup: ["Review confirmation and reminder copy", "Configure the booking webhook endpoint", "Set the reminder delay for your process"],
    steps: [
      { type: "chatty.event", config: { event: "meeting.booked" } },
      { type: "chatty.reply", config: { message: "Your meeting is booked. We look forward to speaking with you." } },
      { type: "n8n.httpRequest", config: { method: "POST", body: "{\"event\":\"meeting.booked\",\"session_id\":\"{{session_id}}\",\"data\":{{data}}}" } },
      { type: "core.wait", config: { duration: "86400" } },
      { type: "chatty.reply", config: { message: "This is a reminder for your upcoming meeting. Reply here if you need to reschedule." } },
      { type: "n8n.httpRequest", config: { method: "POST", body: "{\"event\":\"meeting.reminder\",\"session_id\":\"{{session_id}}\",\"data\":{{data}}}" } },
    ],
    connections: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5]],
  },
  {
    id: "csat-recovery-and-escalation",
    title: "CSAT recovery and escalation",
    description: "Thank every respondent, identify low satisfaction, and notify the team when recovery is needed.",
    category: "Customer success",
    icon: "chatty",
    color: "#22c55e",
    setup: ["Confirm the rating field used by your widget", "Configure the recovery webhook endpoint", "Review the customer-facing recovery message"],
    steps: [
      { type: "chatty.event", config: { event: "csat.submitted" } },
      { type: "core.condition", config: { field: "data.rating", operator: "equals", value: "1" } },
      { type: "chatty.reply", pathId: "recovery", pathTitle: "Recovery", config: { message: "Thank you for the honest feedback. We are sorry the experience fell short. A specialist will follow up." } },
      { type: "n8n.httpRequest", pathId: "recovery", pathTitle: "Recovery", config: { method: "POST", body: "{\"event\":\"csat.recovery\",\"data\":{{data}}}" } },
      { type: "chatty.reply", pathId: "positive", pathTitle: "Positive", config: { message: "Thank you for your feedback. We are glad we could help." } },
      { type: "n8n.httpRequest", pathId: "positive", pathTitle: "Positive", config: { method: "POST", body: "{\"event\":\"csat.positive\",\"data\":{{data}}}" } },
    ],
    connections: [[0, 1], [1, 2, "low score"], [2, 3], [1, 4, "other score"], [4, 5]],
  },
];

export function createTemplateGraph(template: FlowTemplate): FlowData {
  const layers = calculateTemplateLayers(template.steps.length, template.connections);
  const rowsByLayer = new Map<number, number>();
  const paths = new Map<string, FlowPath>();

  const nodes = template.steps.map((step, index) => {
    const definition = nodeCatalog.find((item) => item.type === step.type);
    if (!definition) throw new Error(`Template node ${step.type} is not available.`);
    const layer = layers[index] ?? 0;
    const row = rowsByLayer.get(layer) ?? 0;
    rowsByLayer.set(layer, row + 1);
    const position = getTemplateNodePosition(layer, row);
    const pathId = step.pathId ?? "main";
    const pathTitle = step.pathTitle ?? "Main path";
    if (!paths.has(pathId)) paths.set(pathId, { id: pathId, title: pathTitle, color: step.pathId ? template.color : "#94a3b8" });

    const node: FlowNode = {
      id: `${template.id}-${index + 1}`,
      type: definition.type,
      kind: definition.kind,
      title: definition.title,
      subtitle: definition.subtitle,
      icon: definition.icon,
      color: definition.color,
      x: position.x,
      y: position.y,
      provider: definition.provider,
      credentialType: definition.credentialType,
      n8nType: definition.n8nType,
      n8nTypeVersion: definition.n8nTypeVersion,
      n8nParameters: {},
      operations: definition.operations,
      config: { ...definition.defaultConfig, ...step.config, provider: definition.provider },
      pathId,
      pathTitle,
      stepIndex: layer,
    };
    return node;
  });

  return {
    nodes,
    edges: template.connections.map(([from, to, label]) => ({
      from: nodes[from].id,
      to: nodes[to].id,
      ...(label ? { label } : {}),
    })),
    paths: [...paths.values()],
  };
}
