export const CHATTY_TEAM_TABS = ["inbox", "sources", "design", "settings", "voice", "team", "meetings", "billing", "byok", "webhooks"] as const;
export type ChattyTeamTab = (typeof CHATTY_TEAM_TABS)[number];

export const OWNER_ONLY_TABS = new Set<ChattyTeamTab>(["billing", "byok", "webhooks"]);
export const DEFAULT_ADMIN_TABS: ChattyTeamTab[] = ["inbox", "sources", "design", "settings", "voice", "team", "meetings"];
export const DEFAULT_AGENT_TABS: ChattyTeamTab[] = ["inbox"];

export const TAB_LABELS: Record<ChattyTeamTab, string> = {
  inbox: "Inbox",
  sources: "Knowledge",
  design: "Customizer",
  settings: "Settings",
  voice: "Voice Agent",
  team: "Team",
  meetings: "Meetings",
  billing: "Billing",
  byok: "BYOK keys",
  webhooks: "Webhooks",
};

export const NAV_TAB_PERMISSION: Record<string, ChattyTeamTab | null> = {
  home: null,
  customizer: "design",
  knowledge: "sources",
  playground: null,
  inbox: "inbox",
  flows: "settings",
  campaigns: "settings",
  leads: "inbox",
  feedback: "inbox",
  map: "inbox",
  meetings: "inbox",
  voice_agent: "voice",
  mailbox: "inbox",
  notifications: "settings",
  audit_log: "settings",
  analytics: "inbox",
  integrations: "settings",
  developer: "webhooks",
  mcp: "webhooks",
  billing: "billing",
  settings: "settings",
};
