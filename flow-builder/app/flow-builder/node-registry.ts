export type NodeKind = "trigger" | "action" | "logic" | "chatty";

export type NodeDefinition = {
  title: string;
  subtitle: string;
  kind: NodeKind;
  icon: string;
  color: string;
  provider: string;
  credentialType?: string;
  operations: string[];
};

/** Registry entries are portable definitions. Execution stays in Chatty adapters. */
export const nodeCatalog: NodeDefinition[] = [
  { title: "Chatty event", subtitle: "New lead, message, call, booking", kind: "trigger", icon: "chatty", color: "#f97316", provider: "Chatty", operations: ["Listen for event"] },
  { title: "Webhook", subtitle: "Receive an HTTP event", kind: "trigger", icon: "webhook", color: "#8b5cf6", provider: "HTTP", operations: ["Receive request"] },
  { title: "HTTP request", subtitle: "Call any REST API", kind: "action", icon: "globe", color: "#0ea5e9", provider: "HTTP", operations: ["GET", "POST", "PUT", "DELETE"] },
  { title: "Send email", subtitle: "Email via provider", kind: "action", icon: "mail", color: "#ec4899", provider: "Email", credentialType: "smtp", operations: ["Send email"] },
  { title: "Google Sheets", subtitle: "Create or update a row", kind: "action", icon: "sheet", color: "#22c55e", provider: "Google", credentialType: "google-oauth", operations: ["Append row", "Update row", "Find rows"] },
  { title: "Google Calendar", subtitle: "Create or update events", kind: "action", icon: "calendar", color: "#3b82f6", provider: "Google", credentialType: "google-oauth", operations: ["Create event", "Update event", "Find events"] },
  { title: "Slack message", subtitle: "Notify a channel", kind: "action", icon: "slack", color: "#14b8a6", provider: "Slack", credentialType: "slack-oauth", operations: ["Send message", "Create channel"] },
  { title: "Discord message", subtitle: "Send to a Discord channel", kind: "action", icon: "discord", color: "#5865f2", provider: "Discord", credentialType: "discord-oauth", operations: ["Send message"] },
  { title: "CRM record", subtitle: "Create a lead or contact", kind: "action", icon: "crm", color: "#6366f1", provider: "Chatty CRM", operations: ["Create lead", "Update contact", "Find contact"] },
  { title: "HubSpot", subtitle: "Sync contacts and deals", kind: "action", icon: "hubspot", color: "#ff7a59", provider: "HubSpot", credentialType: "hubspot-oauth", operations: ["Create contact", "Update deal", "Find contact"] },
  { title: "Notion", subtitle: "Create or update a page", kind: "action", icon: "notion", color: "#111827", provider: "Notion", credentialType: "notion-oauth", operations: ["Create page", "Update page", "Query database"] },
  { title: "Airtable", subtitle: "Create or update a record", kind: "action", icon: "airtable", color: "#f59e0b", provider: "Airtable", credentialType: "airtable-token", operations: ["Create record", "Update record", "List records"] },
  { title: "Stripe", subtitle: "Customers, payments, subscriptions", kind: "action", icon: "stripe", color: "#635bff", provider: "Stripe", credentialType: "stripe-secret", operations: ["Create customer", "Create payment", "Find subscription"] },
  { title: "Telegram", subtitle: "Send a bot message", kind: "action", icon: "telegram", color: "#229ed9", provider: "Telegram", credentialType: "telegram-token", operations: ["Send message"] },
  { title: "Twilio", subtitle: "Send SMS or WhatsApp", kind: "action", icon: "twilio", color: "#ef4444", provider: "Twilio", credentialType: "twilio-api", operations: ["Send SMS", "Send WhatsApp"] },
  { title: "Wait", subtitle: "Pause for time or event", kind: "logic", icon: "clock", color: "#64748b", provider: "Flow control", operations: ["Delay", "Wait for event"] },
  { title: "Condition", subtitle: "Branch on customer data", kind: "logic", icon: "branch", color: "#f59e0b", provider: "Flow control", operations: ["Compare", "Contains", "Matches"] },
  { title: "AI transform", subtitle: "Classify, extract, summarize", kind: "chatty", icon: "spark", color: "#a855f7", provider: "Chatty AI", operations: ["Classify", "Extract", "Summarize"] },
  { title: "Make scenario", subtitle: "Call a Make webhook", kind: "action", icon: "make", color: "#f43f5e", provider: "Make", credentialType: "make-webhook", operations: ["Run scenario"] },
  { title: "Zapier action", subtitle: "Run a Zapier Catch Hook", kind: "action", icon: "zapier", color: "#f97316", provider: "Zapier", credentialType: "zapier-webhook", operations: ["Run action"] },
  { title: "n8n workflow", subtitle: "Call an n8n webhook", kind: "action", icon: "n8n", color: "#ff6d5a", provider: "n8n", credentialType: "n8n-webhook", operations: ["Run workflow"] },
];
