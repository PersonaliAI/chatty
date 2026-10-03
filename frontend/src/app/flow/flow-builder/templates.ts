import { nodeCatalog } from "./node-registry";
import type { FlowData, FlowNode } from "./types";

export type FlowTemplateStep = {
  type: string;
  config?: Record<string, string>;
  x: number;
  y: number;
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
  connections: Array<[number, number]>;
};

export const flowTemplates: FlowTemplate[] = [
  {
    id: "lead-acknowledgement",
    title: "Lead acknowledgement",
    description: "Reply to a new lead immediately and keep the conversation moving.",
    category: "Lead capture",
    icon: "chatty",
    color: "#f97316",
    setup: ["Review the reply copy", "Add your lead enrichment step if needed"],
    steps: [
      { type: "chatty.event", config: { event: "lead.created" }, x: 80, y: 170 },
      { type: "chatty.reply", config: { message: "Thanks for reaching out, {{data.visitor_name}}. We have received your request and will be in touch shortly." }, x: 390, y: 170 },
    ],
    connections: [[0, 1]],
  },
  {
    id: "new-conversation-welcome",
    title: "New conversation welcome",
    description: "Greet visitors when a chat session starts with consistent brand copy.",
    category: "Conversation",
    icon: "chatty",
    color: "#f97316",
    setup: ["Replace the welcome copy with your brand voice", "Add a routing or qualification step when ready"],
    steps: [
      { type: "chatty.event", config: { event: "session.started" }, x: 80, y: 170 },
      { type: "chatty.reply", config: { message: "Welcome to our chat. How can we help you today?" }, x: 390, y: 170 },
    ],
    connections: [[0, 1]],
  },
  {
    id: "message-triage",
    title: "Message triage and reply",
    description: "Classify inbound messages, then send a consistent first response.",
    category: "Support",
    icon: "spark",
    color: "#a855f7",
    setup: ["Connect the Chatty AI adapter", "Write the classification instruction", "Review the reply copy"],
    steps: [
      { type: "chatty.event", config: { event: "message.user" }, x: 40, y: 170 },
      { type: "chatty.ai", config: { instruction: "Classify the visitor message as sales, support, billing, or other. Return the category and a short reason." }, x: 350, y: 170 },
      { type: "chatty.reply", config: { message: "Thanks for your message. We have routed it to the right team and will get back to you shortly." }, x: 680, y: 170 },
    ],
    connections: [[0, 1], [1, 2]],
  },
  {
    id: "booking-follow-up",
    title: "Booking follow-up",
    description: "Confirm a booked meeting in chat and send a structured event to your endpoint.",
    category: "Bookings",
    icon: "calendar",
    color: "#3b82f6",
    setup: ["Review the confirmation copy", "Configure your HTTPS endpoint"],
    steps: [
      { type: "chatty.event", config: { event: "meeting.booked" }, x: 40, y: 170 },
      { type: "chatty.reply", config: { message: "Your meeting is booked. We look forward to speaking with you." }, x: 350, y: 170 },
      { type: "n8n.httpRequest", config: { url: "", method: "POST", body: "{\"event\":\"{{data.event}}\",\"session_id\":\"{{session_id}}\"}" }, x: 680, y: 170 },
    ],
    connections: [[0, 1], [1, 2]],
  },
  {
    id: "csat-recovery",
    title: "CSAT recovery",
    description: "Thank every respondent and route low scores to a support team.",
    category: "Customer success",
    icon: "chatty",
    color: "#22c55e",
    setup: ["Review the thank-you copy", "Configure the follow-up endpoint"],
    steps: [
      { type: "chatty.event", config: { event: "csat.submitted" }, x: 40, y: 170 },
      { type: "chatty.reply", config: { message: "Thank you for your feedback. We use it to improve your experience." }, x: 350, y: 170 },
      { type: "n8n.httpRequest", config: { url: "", method: "POST", body: "{\"event\":\"csat.submitted\",\"data\":{{data}}}" }, x: 680, y: 170 },
    ],
    connections: [[0, 1], [1, 2]],
  },
];

export function createTemplateGraph(template: FlowTemplate): FlowData {
  const nodes = template.steps.map((step, index) => {
    const definition = nodeCatalog.find((item) => item.type === step.type);
    if (!definition) throw new Error(`Template node ${step.type} is not available.`);
    const node: FlowNode = {
      id: `${template.id}-${index + 1}`,
      type: definition.type,
      kind: definition.kind,
      title: definition.title,
      subtitle: definition.subtitle,
      icon: definition.icon,
      color: definition.color,
      x: step.x,
      y: step.y,
      provider: definition.provider,
      credentialType: definition.credentialType,
      n8nType: definition.n8nType,
      n8nTypeVersion: definition.n8nTypeVersion,
      n8nParameters: {},
      operations: definition.operations,
      config: { ...definition.defaultConfig, ...step.config, provider: definition.provider },
    };
    return node;
  });

  return {
    nodes,
    edges: template.connections.map(([from, to]) => ({ from: nodes[from].id, to: nodes[to].id })),
  };
}
