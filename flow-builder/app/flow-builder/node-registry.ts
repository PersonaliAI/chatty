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

const adapterUrl = (label = "Adapter endpoint URL") => ({ key: "url", label, type: "url" as const, required: true, placeholder: "https://..." });
const method = { key: "method", label: "Method", type: "select" as const, required: true, options: ["GET", "POST", "PUT", "PATCH", "DELETE"] };

/** Portable node definitions. Runtime work stays in Chatty adapters. */
export const nodeCatalog: NodeDefinition[] = [
  {
    type: "chatty.event", title: "Chatty event", subtitle: "New lead, message, call, booking", kind: "trigger", icon: "chatty", color: "#f97316", provider: "Chatty", operations: ["Listen for event"], category: "triggers",
    fields: [{ key: "event", label: "Event type", type: "select", required: true, options: ["session.started", "session.ended", "message.user", "message.assistant", "lead.created", "lead.updated", "meeting.booked", "csat.submitted"] }],
    defaultConfig: { event: "lead.created", operation: "Listen for event" }, n8nType: "chatty.event", n8nTypeVersion: 1,
  },
  {
    type: "chatty.reply", title: "Reply in chat", subtitle: "Send a message to the visitor", kind: "chatty", icon: "chatty", color: "#f97316", provider: "Chatty", operations: ["Send reply"], category: "communication",
    fields: [{ key: "message", label: "Message", type: "textarea", required: true, placeholder: "Hi {{data.visitor_name}}, how can we help?", helpText: "You can use {{data.content}}, {{data.visitor_name}}, {{data.visitor_email}}, and {{session_id}}." }],
    defaultConfig: { operation: "Send reply", message: "" },
  },
  {
    type: "n8n.webhook", title: "Webhook", subtitle: "Receive an HTTP event", kind: "trigger", icon: "webhook", color: "#8b5cf6", provider: "HTTP", operations: ["Receive request"], category: "triggers",
    fields: [{ key: "path", label: "Path", type: "text", required: true, placeholder: "/incoming-event" }],
    defaultConfig: { path: "/incoming-event", operation: "Receive request" }, n8nType: "n8n-nodes-base.webhook", n8nTypeVersion: 2,
  },
  {
    type: "n8n.httpRequest", title: "HTTP request", subtitle: "Call any REST API", kind: "action", icon: "globe", color: "#0ea5e9", provider: "HTTP", operations: ["GET", "POST", "PUT", "DELETE"], category: "core",
    fields: [adapterUrl(), method, { key: "body", label: "Request body", type: "json", placeholder: '{"key":"value"}', helpText: "Use valid JSON for methods with a body." }],
    defaultConfig: { method: "POST", operation: "POST" }, n8nType: "n8n-nodes-base.httpRequest", n8nTypeVersion: 4.2,
  },
  {
    type: "chatty.email", title: "Send email", subtitle: "Email via provider", kind: "action", icon: "mail", color: "#ec4899", provider: "Email", credentialType: "smtp", operations: ["Send email"], category: "communication",
    fields: [adapterUrl(), { key: "to", label: "Recipient", type: "text", required: true }, { key: "subject", label: "Subject", type: "text", required: true }, { key: "message", label: "Message", type: "textarea", required: true }],
    defaultConfig: { operation: "Send email", method: "POST" },
  },
  {
    type: "google.sheets", title: "Google Sheets", subtitle: "Create or update a row", kind: "action", icon: "sheet", color: "#22c55e", provider: "Google", credentialType: "google-oauth", operations: ["Append row", "Update row", "Find rows"], category: "data",
    fields: [adapterUrl(), { key: "spreadsheet", label: "Spreadsheet ID", type: "text", required: true }, { key: "sheet", label: "Sheet name", type: "text", required: true }],
    defaultConfig: { operation: "Append row", method: "POST" },
  },
  {
    type: "google.calendar", title: "Google Calendar", subtitle: "Create or update events", kind: "action", icon: "calendar", color: "#3b82f6", provider: "Google", credentialType: "google-oauth", operations: ["Create event", "Update event", "Find events"], category: "apps",
    fields: [adapterUrl(), { key: "calendar", label: "Calendar ID", type: "text", required: true }], defaultConfig: { operation: "Create event", method: "POST" },
  },
  {
    type: "slack.message", title: "Slack message", subtitle: "Notify a channel", kind: "action", icon: "slack", color: "#14b8a6", provider: "Slack", credentialType: "slack-oauth", operations: ["Send message", "Create channel"], category: "communication",
    fields: [adapterUrl(), { key: "channel", label: "Channel", type: "text", required: true }, { key: "message", label: "Message", type: "textarea", required: true }], defaultConfig: { operation: "Send message", method: "POST" },
  },
  {
    type: "discord.message", title: "Discord message", subtitle: "Send to a Discord channel", kind: "action", icon: "discord", color: "#5865f2", provider: "Discord", credentialType: "discord-oauth", operations: ["Send message"], category: "communication",
    fields: [adapterUrl(), { key: "channel", label: "Channel", type: "text", required: true }, { key: "message", label: "Message", type: "textarea", required: true }], defaultConfig: { operation: "Send message", method: "POST" },
  },
  {
    type: "chatty.crm", title: "CRM record", subtitle: "Create a lead or contact", kind: "action", icon: "crm", color: "#6366f1", provider: "Chatty CRM", operations: ["Create lead", "Update contact", "Find contact"], category: "data",
    fields: [adapterUrl()], defaultConfig: { operation: "Create lead", method: "POST" },
  },
  {
    type: "hubspot.record", title: "HubSpot", subtitle: "Sync contacts and deals", kind: "action", icon: "hubspot", color: "#ff7a59", provider: "HubSpot", credentialType: "hubspot-oauth", operations: ["Create contact", "Update deal", "Find contact"], category: "apps",
    fields: [adapterUrl()], defaultConfig: { operation: "Create contact", method: "POST" },
  },
  {
    type: "notion.page", title: "Notion", subtitle: "Create or update a page", kind: "action", icon: "notion", color: "#111827", provider: "Notion", credentialType: "notion-oauth", operations: ["Create page", "Update page", "Query database"], category: "apps",
    fields: [adapterUrl()], defaultConfig: { operation: "Create page", method: "POST" },
  },
  {
    type: "airtable.record", title: "Airtable", subtitle: "Create or update a record", kind: "action", icon: "airtable", color: "#f59e0b", provider: "Airtable", credentialType: "airtable-token", operations: ["Create record", "Update record", "List records"], category: "data",
    fields: [adapterUrl()], defaultConfig: { operation: "Create record", method: "POST" },
  },
  {
    type: "stripe.action", title: "Stripe", subtitle: "Customers, payments, subscriptions", kind: "action", icon: "stripe", color: "#635bff", provider: "Stripe", credentialType: "stripe-secret", operations: ["Create customer", "Create payment", "Find subscription"], category: "apps",
    fields: [adapterUrl()], defaultConfig: { operation: "Create customer", method: "POST" },
  },
  {
    type: "telegram.message", title: "Telegram", subtitle: "Send a bot message", kind: "action", icon: "telegram", color: "#229ed9", provider: "Telegram", operations: ["Send message"], category: "communication",
    fields: [adapterUrl(), { key: "message", label: "Message", type: "textarea", required: true }], defaultConfig: { operation: "Send message", method: "POST" },
  },
  {
    type: "twilio.message", title: "Twilio", subtitle: "Send SMS or WhatsApp", kind: "action", icon: "twilio", color: "#ef4444", provider: "Twilio", operations: ["Send SMS", "Send WhatsApp"], category: "communication",
    fields: [adapterUrl(), { key: "to", label: "Recipient", type: "text", required: true }, { key: "message", label: "Message", type: "textarea", required: true }], defaultConfig: { operation: "Send SMS", method: "POST" },
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
    fields: [adapterUrl(), { key: "instruction", label: "Instruction", type: "textarea", required: true }], defaultConfig: { operation: "Classify", method: "POST" },
  },
  {
    type: "make.scenario", title: "Make scenario", subtitle: "Call a Make webhook", kind: "action", icon: "make", color: "#f43f5e", provider: "Make", credentialType: "make-webhook", operations: ["Run scenario"], category: "apps",
    fields: [adapterUrl("Webhook URL")], defaultConfig: { operation: "Run scenario", method: "POST" },
  },
  {
    type: "zapier.action", title: "Zapier action", subtitle: "Run a Zapier Catch Hook", kind: "action", icon: "zapier", color: "#f97316", provider: "Zapier", credentialType: "zapier-webhook", operations: ["Run action"], category: "apps",
    fields: [adapterUrl("Catch Hook URL")], defaultConfig: { operation: "Run action", method: "POST" },
  },
  {
    type: "n8n.workflow", title: "n8n workflow", subtitle: "Call an n8n webhook", kind: "action", icon: "n8n", color: "#ff6d5a", provider: "n8n", credentialType: "n8n-webhook", operations: ["Run workflow"], category: "apps",
    fields: [adapterUrl("n8n webhook URL")], defaultConfig: { operation: "Run workflow", method: "POST" },
  },
];

export function findNodeDefinition(node: { provider?: string; n8nType?: string; title: string }): NodeDefinition | undefined {
  return nodeCatalog.find((item) => item.n8nType && item.n8nType === node.n8nType)
    ?? nodeCatalog.find((item) => item.title === node.title)
    ?? nodeCatalog.find((item) => item.provider === node.provider);
}
