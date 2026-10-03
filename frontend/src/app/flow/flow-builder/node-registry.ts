export type NodeKind = "trigger" | "action" | "logic" | "chatty";

export type NodeField = {
  key: string;
  label: string;
  type: "text" | "url" | "number" | "select" | "textarea" | "json";
  required?: boolean;
  placeholder?: string;
  helpText?: string;
  options?: string[];
};

export type NodeDefinition = {
  type: string;
  title: string;
  subtitle: string;
  kind: NodeKind;
  icon: string;
  color: string;
  provider: string;
  credentialType?: string;
  operations: string[];
  category: "triggers" | "core" | "transform" | "communication" | "data" | "apps";
  fields: NodeField[];
  defaultConfig: Record<string, string>;
  n8nType?: string;
  n8nTypeVersion?: number;
};

const adapterUrl = (label = "Endpoint URL") => ({ key: "url", label, type: "url" as const, required: true, placeholder: "https://..." });
const method = { key: "method", label: "Method", type: "select" as const, required: true, options: ["GET", "POST", "PUT", "PATCH", "DELETE"] };

/** Chatty owns this palette. External automation platforms use webhooks and the public API. */
export const nodeCatalog: NodeDefinition[] = [
  {
    type: "chatty.event", title: "Chatty event", subtitle: "New lead, message, call, booking", kind: "trigger", icon: "chatty", color: "#f97316", provider: "Chatty", operations: ["Listen for event"], category: "triggers",
    fields: [{ key: "event", label: "Event type", type: "select", required: true, options: ["session.started", "session.ended", "message.user", "message.assistant", "lead.created", "lead.updated", "meeting.booked", "csat.submitted"] }],
    defaultConfig: { event: "lead.created", operation: "Listen for event" }, n8nType: "chatty.event", n8nTypeVersion: 1,
  },
  {
    type: "chatty.reply", title: "Reply in chat", subtitle: "Send a message to the visitor", kind: "chatty", icon: "chatty", color: "#f97316", provider: "Chatty", operations: ["Send reply"], category: "communication",
    fields: [{ key: "message", label: "Message", type: "textarea", required: true, placeholder: "Hi {{data.visitor_name}}, how can we help?", helpText: "Use {{data.content}}, {{data.visitor_name}}, {{data.visitor_email}}, and {{session_id}}." }],
    defaultConfig: { operation: "Send reply", message: "" },
  },
  {
    type: "n8n.webhook", title: "Webhook", subtitle: "Receive an HTTP event", kind: "trigger", icon: "webhook", color: "#8b5cf6", provider: "HTTP", operations: ["Receive request"], category: "triggers",
    fields: [{ key: "path", label: "Path", type: "text", required: true, placeholder: "/incoming-event" }],
    defaultConfig: { path: "/incoming-event", operation: "Receive request" }, n8nType: "n8n-nodes-base.webhook", n8nTypeVersion: 2,
  },
  {
    type: "n8n.httpRequest", title: "HTTP request", subtitle: "Call a custom HTTPS endpoint", kind: "action", icon: "globe", color: "#0ea5e9", provider: "HTTP", operations: ["GET", "POST", "PUT", "DELETE"], category: "core",
    fields: [adapterUrl(), method, { key: "body", label: "Request body", type: "json", placeholder: "{\"event\":\"{{data.event}}\"}", helpText: "Use valid JSON for a service that is not a native Chatty action." }],
    defaultConfig: { method: "POST", operation: "POST" }, n8nType: "n8n-nodes-base.httpRequest", n8nTypeVersion: 4.2,
  },
  {
    type: "core.wait", title: "Wait", subtitle: "Pause for time or event", kind: "logic", icon: "clock", color: "#64748b", provider: "Flow control", operations: ["Delay", "Wait for event"], category: "core",
    fields: [{ key: "duration", label: "Duration (seconds)", type: "number", required: true }], defaultConfig: { operation: "Delay", duration: "1" },
  },
  {
    type: "core.condition", title: "Condition", subtitle: "Branch on customer data", kind: "logic", icon: "branch", color: "#f59e0b", provider: "Flow control", operations: ["Compare", "Contains", "Matches"], category: "core",
    fields: [{ key: "field", label: "Input field", type: "text", required: true, placeholder: "data.status" }, { key: "operator", label: "Operator", type: "select", options: ["equals", "not_equals", "contains", "matches"] }, { key: "value", label: "Value", type: "text", required: true }], defaultConfig: { operation: "Compare", operator: "equals", value: "" },
  },
  {
    type: "chatty.ai", title: "AI transform", subtitle: "Classify, extract, summarize", kind: "chatty", icon: "spark", color: "#a855f7", provider: "Chatty AI", operations: ["Classify", "Extract", "Summarize"], category: "transform",
    fields: [adapterUrl("Chatty AI endpoint"), { key: "instruction", label: "Instruction", type: "textarea", required: true, placeholder: "Classify the visitor message as sales, support, billing, or other." }], defaultConfig: { operation: "Classify", method: "POST" },
  },
];

export function findNodeDefinition(node: { provider?: string; n8nType?: string; title: string }): NodeDefinition | undefined {
  return nodeCatalog.find((item) => item.n8nType && item.n8nType === node.n8nType)
    ?? nodeCatalog.find((item) => item.title === node.title)
    ?? nodeCatalog.find((item) => item.provider === node.provider);
}
