export const CHATTY_TEAM_TABS = ["inbox", "sources", "design", "settings", "team", "meetings", "billing", "byok", "webhooks"] as const;
export type ChattyTeamTab = (typeof CHATTY_TEAM_TABS)[number];

export const OWNER_ONLY_TABS = new Set<ChattyTeamTab>(["billing", "byok", "webhooks"]);
export const DEFAULT_ADMIN_TABS: ChattyTeamTab[] = ["inbox", "sources", "design", "settings", "team", "meetings"];
export const DEFAULT_AGENT_TABS: ChattyTeamTab[] = ["inbox"];

export const TAB_LABELS: Record<ChattyTeamTab, string> = {
  inbox: "Inbox",
  sources: "Knowledge",
  design: "Customizer",
  settings: "Settings",
  team: "Team",
  meetings: "Meetings",
  billing: "Billing",
  byok: "BYOK keys",
  webhooks: "Webhooks",
};

export const NAV_TAB_PERMISSION: Record<string, ChattyTeamTab | null> = {
  home: null,
  // Viewers can inspect the live design preview; save controls enforce the
  // design permission before mutating bot configuration.
  customizer: null,
  knowledge: "sources",
  playground: null,
  inbox: "inbox",
  // Flow Builder and Campaigns are operational surfaces. Team members need
  // read/monitor access even when they cannot change settings; mutation
  // controls remain guarded inside each surface.
  flows: null,
  flow_builder: null,
  campaigns: null,
  automations: null,
  leads: "inbox",
  feedback: "inbox",
  map: "inbox",
  meetings: "inbox",
  mailbox: "inbox",
  notifications: "settings",
  audit_log: "settings",
  analytics: "inbox",
  integrations: "settings",
  developer: "webhooks",
  mcp: "webhooks",
  billing: "billing",
  admin_affiliates: null,
  settings: "settings",
};
