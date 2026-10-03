import type { FlowConnection, FlowNode } from "./types";

export type ConnectionField = {
  key: string;
  label: string;
  type: "text" | "password";
  required?: boolean;
  placeholder?: string;
  helpText?: string;
};

export type ProviderConnectionDefinition = {
  provider: string;
  authType: FlowConnection["auth_type"];
  title: string;
  description: string;
  fields: ConnectionField[];
  oauthStartPath?: string;
};

const definitions: Record<string, ProviderConnectionDefinition> = {
  Email: {
    provider: "Email", authType: "basic", title: "Email SMTP connection", description: "Use an SMTP credential for outbound messages.",
    fields: [
      { key: "host", label: "SMTP host", type: "text", required: true, placeholder: "smtp.example.com" },
      { key: "port", label: "Port", type: "text", required: true, placeholder: "587" },
      { key: "username", label: "Username", type: "text", required: true },
      { key: "password", label: "Password", type: "password", required: true },
    ],
  },
  Google: {
    provider: "Google", authType: "oauth", title: "Google account", description: "Connect Google Calendar or Sheets through Chatty OAuth.", oauthStartPath: "/api/integrations/google/start",
    fields: [],
  },
  Slack: {
    provider: "Slack", authType: "token", title: "Slack bot token", description: "Store a Slack bot token for the selected workspace.",
    fields: [{ key: "token", label: "Bot token", type: "password", required: true, placeholder: "xoxb-…" }],
  },
  Discord: {
    provider: "Discord", authType: "token", title: "Discord bot token", description: "Store a Discord bot token for the selected application.",
    fields: [{ key: "token", label: "Bot token", type: "password", required: true }],
  },
  HubSpot: {
    provider: "HubSpot", authType: "api_key", title: "HubSpot private app", description: "Store a HubSpot private app token.",
    fields: [{ key: "token", label: "Private app token", type: "password", required: true }],
  },
  Notion: {
    provider: "Notion", authType: "token", title: "Notion integration", description: "Store a Notion internal integration token.",
    fields: [{ key: "token", label: "Integration token", type: "password", required: true }],
  },
  Airtable: {
    provider: "Airtable", authType: "token", title: "Airtable personal access token", description: "Store an Airtable personal access token.",
    fields: [{ key: "token", label: "Personal access token", type: "password", required: true }],
  },
  Stripe: {
    provider: "Stripe", authType: "api_key", title: "Stripe secret key", description: "Store the server-side Stripe secret key.",
    fields: [{ key: "secret_key", label: "Secret key", type: "password", required: true, placeholder: "sk_live_…" }],
  },
  Telegram: {
    provider: "Telegram", authType: "token", title: "Telegram bot", description: "Store the bot token issued by BotFather.",
    fields: [{ key: "token", label: "Bot token", type: "password", required: true }],
  },
  Twilio: {
    provider: "Twilio", authType: "basic", title: "Twilio account", description: "Store the account SID and auth token.",
    fields: [
      { key: "account_sid", label: "Account SID", type: "text", required: true },
      { key: "auth_token", label: "Auth token", type: "password", required: true },
    ],
  },
};

export function getProviderConnection(node: Pick<FlowNode, "provider" | "credentialType">): ProviderConnectionDefinition | undefined {
  if (!node.credentialType || node.credentialType.endsWith("webhook")) return undefined;
  return definitions[node.provider ?? ""];
}

export function providerConnectionLabel(connection: FlowConnection): string {
  return `${connection.name} · ${connection.provider}`;
}
