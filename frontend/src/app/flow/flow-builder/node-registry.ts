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
    type: "chatty.event", title: "Chatty event", subtitle: "Omnichannel: Web, WhatsApp, Instagram, Mobile & Chat", kind: "trigger", icon: "chatty", color: "#f97316", provider: "Chatty", operations: ["Listen for event"], category: "triggers",
    fields: [
      { key: "event", label: "Event type", type: "select", required: true, options: ["session.started", "session.ended", "message.user", "message.assistant", "lead.created", "lead.updated", "meeting.booked", "csat.submitted"] },
      { key: "channel", label: "Channel / Platform", type: "select", options: ["all", "whatsapp", "messenger", "instagram", "tiktok", "telegram", "sms", "email", "web", "android_app", "ios_app"], helpText: "Use 'all' to trigger on every platform (Web, WhatsApp, Messenger, Instagram, TikTok, Telegram, SMS, Email, Android/iOS), or restrict to one channel." },
    ],
    defaultConfig: { event: "lead.created", channel: "all", operation: "Listen for event" }, n8nType: "chatty.event", n8nTypeVersion: 1,
  },
  {
    type: "chatty.reply", title: "Reply in chat", subtitle: "Send a message to the visitor", kind: "chatty", icon: "chatty", color: "#f97316", provider: "Chatty", operations: ["Send reply"], category: "communication",
    fields: [{ key: "message", label: "Message", type: "textarea", required: true, placeholder: "Hi {{data.visitor_name}}, how can we help?", helpText: "Use {{data.content}}, {{data.visitor_name}}, {{data.visitor_email}}, and {{session_id}}." }],
    defaultConfig: { operation: "Send reply", message: "Hi {{data.visitor_name}}, thanks for reaching out! How can we help you today?" },
  },
  {
    type: "n8n.webhook", title: "Webhook", subtitle: "Receive an HTTP event", kind: "trigger", icon: "webhook", color: "#8b5cf6", provider: "HTTP", operations: ["Receive request"], category: "triggers",
    fields: [{ key: "path", label: "Path", type: "text", required: true, placeholder: "/incoming-event" }],
    defaultConfig: { path: "/incoming-event", operation: "Receive request" }, n8nType: "n8n-nodes-base.webhook", n8nTypeVersion: 2,
  },
  {
    type: "n8n.httpRequest", title: "HTTP request", subtitle: "Call a custom HTTPS endpoint", kind: "action", icon: "globe", color: "#0ea5e9", provider: "HTTP", operations: ["GET", "POST", "PUT", "DELETE"], category: "core",
    fields: [adapterUrl(), method, { key: "body", label: "Request body", type: "json", placeholder: "{\"event\":\"{{data.event}}\"}", helpText: "Use valid JSON for a service that is not a native Chatty action." }],
    defaultConfig: { method: "POST", operation: "POST", url: "https://api.example.com/v1/webhook", body: "{\"event\":\"{{data.event}}\",\"session_id\":\"{{session_id}}\"}" }, n8nType: "n8n-nodes-base.httpRequest", n8nTypeVersion: 4.2,
  },
  {
    type: "core.wait", title: "Wait", subtitle: "Pause for time or event", kind: "logic", icon: "clock", color: "#64748b", provider: "Flow control", operations: ["Delay", "Wait for event"], category: "core",
    fields: [{ key: "duration", label: "Duration (seconds)", type: "number", required: true }], defaultConfig: { operation: "Delay", duration: "300" },
  },
  {
    type: "core.condition", title: "Condition", subtitle: "Branch on customer or time data", kind: "logic", icon: "branch", color: "#f59e0b", provider: "Flow control", operations: ["Compare", "Contains", "Matches", "Time Window"], category: "core",
    fields: [
      { key: "field", label: "Input field", type: "text", required: true, placeholder: "data.platform, data.channel, or data.current_time", helpText: "Use data.platform (whatsapp, instagram, web, android_app, ios_app), data.channel, data.device (mobile, desktop), data.os, data.content, or data.current_time (HH:MM)." },
      { key: "operator", label: "Operator", type: "select", options: ["equals", "not_equals", "contains", "matches", "before_time", "after_time", "less_than", "greater_than"] },
      { key: "value", label: "Value", type: "text", required: true, placeholder: "whatsapp, android_app, 18:00, or offer|promo" },
    ],
    defaultConfig: { operation: "Compare", field: "data.intent", operator: "equals", value: "sales" },
  },
  {
    type: "chatty.ai", title: "AI transform", subtitle: "Classify, extract, summarize", kind: "chatty", icon: "spark", color: "#a855f7", provider: "Chatty AI", operations: ["Classify", "Extract", "Summarize"], category: "transform",
    fields: [
      { key: "operation", label: "AI Operation", type: "select", options: ["Classify", "Extract", "Summarize"] },
      { key: "instruction", label: "Instruction", type: "textarea", required: true, placeholder: "Classify the visitor message as sales, support, billing, or other." },
      { key: "output_field", label: "Output variable", type: "text", placeholder: "intent", helpText: "Accessible in downstream conditions as data.<output_field>" },
    ],
    defaultConfig: { operation: "Classify", instruction: "Classify the visitor message as sales, support, billing, or other.", output_field: "intent" },
  },
  {
    type: "action.email", title: "Send email", subtitle: "Notify customer or team", kind: "action", icon: "mail", color: "#2563eb", provider: "Email", operations: ["Send notification email"], category: "communication",
    fields: [
      { key: "to", label: "Recipient email", type: "text", required: true, placeholder: "{{data.visitor_email}} or alerts@company.com" },
      { key: "subject", label: "Subject", type: "text", required: true, placeholder: "New lead from Chatty Assistant" },
      { key: "body", label: "Message body", type: "textarea", required: true, placeholder: "Hi, a new lead has arrived: {{data.visitor_name}} ({{data.visitor_email}})." },
    ],
    defaultConfig: {
      operation: "Send notification email",
      to: "{{data.visitor_email}}",
      subject: "Automated workflow update",
      body: "Hi {{data.visitor_name}}, thank you for contacting us. Our team has received your message.",
    },
  },
  {
    type: "action.slack", title: "Slack alert", subtitle: "Post message to channel", kind: "action", icon: "slack", color: "#4a154b", provider: "Slack", operations: ["Send channel message"], category: "communication",
    fields: [
      { key: "channel", label: "Channel name", type: "text", required: true, placeholder: "#sales-leads or #alerts" },
      { key: "message", label: "Message", type: "textarea", required: true, placeholder: "🚀 New high-intent lead: {{data.visitor_name}} ({{data.visitor_email}})" },
    ],
    defaultConfig: {
      operation: "Send channel message",
      channel: "#alerts",
      message: "🚀 New high-intent lead: {{data.visitor_name}} ({{data.visitor_email}})",
    },
  },
  {
    type: "action.crm", title: "Update CRM", subtitle: "Create or update lead record", kind: "action", icon: "crm", color: "#10b981", provider: "Chatty CRM", operations: ["Upsert lead", "Update stage"], category: "data",
    fields: [
      { key: "stage", label: "Lead stage", type: "select", required: true, options: ["new", "qualified", "in_progress", "won", "lost"] },
      { key: "notes", label: "Lead notes", type: "textarea", placeholder: "Captured via AI automation workflow" },
    ],
    defaultConfig: { operation: "Upsert lead", stage: "qualified", notes: "Updated automatically by Chatty Flow" },
  },
];

export function findNodeDefinition(node: { type?: string; provider?: string; n8nType?: string; title: string }): NodeDefinition | undefined {
  return (node.type ? nodeCatalog.find((item) => item.type === node.type) : undefined)
    ?? nodeCatalog.find((item) => item.n8nType && item.n8nType === node.n8nType)
    ?? nodeCatalog.find((item) => item.title === node.title)
    ?? nodeCatalog.find((item) => item.provider === node.provider);
}
