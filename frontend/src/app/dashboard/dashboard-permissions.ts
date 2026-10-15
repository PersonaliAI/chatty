export const CHATTY_TEAM_TABS = [
  "inbox",
  "sources",
  "design",
  "settings",
  "team",
  "meetings",
  "integrations",
  "billing",
  "byok",
  "webhooks",
] as const;
export type ChattyTeamTab = (typeof CHATTY_TEAM_TABS)[number];

export const OWNER_ONLY_TABS = new Set<ChattyTeamTab>(["billing", "byok", "webhooks"]);

export type ChattyTeamRole = "owner" | "admin" | "agent" | "editor" | "billing_manager" | "viewer";

export const ROLE_DEFAULT_TABS: Record<ChattyTeamRole, ChattyTeamTab[]> = {
  owner: ["inbox", "sources", "design", "settings", "team", "meetings", "integrations", "billing", "byok", "webhooks"],
  admin: ["inbox", "sources", "design", "settings", "team", "meetings", "integrations"],
  agent: ["inbox", "meetings"],
  editor: ["sources", "design", "inbox"],
  billing_manager: ["billing"],
  viewer: ["inbox", "meetings"],
};

export const DEFAULT_ADMIN_TABS: ChattyTeamTab[] = ROLE_DEFAULT_TABS.admin;
export const DEFAULT_AGENT_TABS: ChattyTeamTab[] = ROLE_DEFAULT_TABS.agent;

export const ROLE_INFO: Record<
  ChattyTeamRole,
  { label: string; title: string; description: string; badgeClasses: string }
> = {
  owner: {
    label: "Owner",
    title: "Account Owner",
    description: "Primary creator with full unrestricted ownership, billing, and team authority",
    badgeClasses: "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-400 border border-amber-300 dark:border-amber-800",
  },
  admin: {
    label: "Admin",
    title: "Administrator",
    description: "Full management access to settings, team roster, knowledge, and integrations",
    badgeClasses: "bg-purple-100 text-purple-800 dark:bg-purple-950/60 dark:text-purple-400 border border-purple-300 dark:border-purple-800",
  },
  agent: {
    label: "Agent",
    title: "Support Agent",
    description: "Customer conversations, visitor chats, live takeover, and calendar meetings",
    badgeClasses: "bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-400 border border-blue-300 dark:border-blue-800",
  },
  editor: {
    label: "Editor",
    title: "Content Editor",
    description: "Knowledge base training, website crawler, document uploads, and widget customizer",
    badgeClasses: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-800",
  },
  billing_manager: {
    label: "Billing Manager",
    title: "Billing Manager",
    description: "Financial management: subscription plan upgrades, quotas, and invoices",
    badgeClasses: "bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-400 border border-rose-300 dark:border-rose-800",
  },
  viewer: {
    label: "Viewer",
    title: "Viewer / Analyst",
    description: "Read-only access to customer interactions, feedback ratings, and meeting appointments",
    badgeClasses: "bg-neutral-100 text-neutral-800 dark:bg-neutral-800 dark:text-neutral-300 border border-neutral-300 dark:border-neutral-700",
  },
};

export const TAB_LABELS: Record<ChattyTeamTab, string> = {
  inbox: "Inbox",
  sources: "Knowledge",
  design: "Customizer",
  settings: "Settings",
  team: "Team",
  meetings: "Meetings",
  integrations: "Integrations",
  billing: "Billing",
  byok: "BYOK keys",
  webhooks: "Webhooks",
};

export const TAB_DESCRIPTIONS: Record<ChattyTeamTab, string> = {
  inbox: "Visitor chats, lead capture contacts & CSAT feedback",
  sources: "Documents, URLs & trained Q&A knowledge sources",
  design: "Widget appearance, avatar, greetings & theme styles",
  settings: "AI engine parameters, guardrails & abuse defenses",
  team: "Team members, roles, availability & personal calendars",
  meetings: "Appointment scheduling, calendar slots & bookings",
  integrations: "Bot-specific Google, Microsoft & Zoom accounts",
  billing: "Subscription plans, quotas & payment invoices (Owner)",
  byok: "Custom OpenAI / Anthropic / Mistral API keys (Owner)",
  webhooks: "Developer API, webhooks & MCP server tokens (Owner)",
};

export const NAV_TAB_PERMISSION: Record<string, ChattyTeamTab | null> = {
  home: null,
  customizer: "design",
  knowledge: "sources",
  playground: null,
  inbox: "inbox",
  flows: null,
  flow_builder: "design",
  campaigns: "inbox",
  automations: "settings",
  leads: "inbox",
  feedback: "inbox",
  map: "inbox",
  meetings: "meetings",
  mailbox: "inbox",
  notifications: "settings",
  audit_log: "settings",
  analytics: "inbox",
  integrations: "integrations",
  voice: "settings",
  developer: "webhooks",
  mcp: "webhooks",
  billing: "billing",
  admin_affiliates: null,
  settings: "settings",
};
