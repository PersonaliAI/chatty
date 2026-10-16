export const CHATTY_TEAM_TABS = [
  // Conversations & Support
  "inbox",
  "playground",
  "meetings",
  "mailbox",
  // Intelligence & CRM
  "overview",
  "leads",
  "feedback",
  "analytics",
  "map",
  // Content & Studio
  "knowledge",
  "customizer",
  "flow_builder",
  "campaigns",
  "voice",
  // Operations & Controls
  "workspace",
  "settings",
  "team",
  "notifications",
  "audit_log",
  // Integrations & Developer
  "integrations",
  "developer",
  "mcp",
  "billing",
] as const;
export type ChattyTeamTab = (typeof CHATTY_TEAM_TABS)[number];

export const OWNER_ONLY_TABS = new Set<ChattyTeamTab>(["billing"]);

export type ChattyTeamRole = "owner" | "admin" | "agent" | "editor" | "billing_manager" | "viewer";

export const ROLE_DEFAULT_TABS: Record<ChattyTeamRole, ChattyTeamTab[]> = {
  owner: [...CHATTY_TEAM_TABS],
  admin: [
    "overview",
    "workspace",
    "customizer",
    "knowledge",
    "playground",
    "inbox",
    "campaigns",
    "flow_builder",
    "leads",
    "feedback",
    "map",
    "meetings",
    "mailbox",
    "notifications",
    "audit_log",
    "analytics",
    "integrations",
    "voice",
    "mcp",
    "developer",
    "settings",
    "team",
  ],
  agent: [
    "overview",
    "inbox",
    "playground",
    "meetings",
    "mailbox",
    "leads",
    "feedback",
  ],
  editor: [
    "overview",
    "customizer",
    "knowledge",
    "playground",
    "flow_builder",
    "campaigns",
    "voice",
    "inbox",
  ],
  billing_manager: [
    "overview",
    "billing",
    "analytics",
  ],
  viewer: [
    "overview",
    "leads",
    "feedback",
    "map",
    "analytics",
    "audit_log",
    "inbox",
  ],
};

export const DEFAULT_ADMIN_TABS: ChattyTeamTab[] = ROLE_DEFAULT_TABS.admin;
export const DEFAULT_AGENT_TABS: ChattyTeamTab[] = ROLE_DEFAULT_TABS.agent;

export const LEGACY_TAB_ALIASES: Record<string, string[]> = {
  knowledge: ["sources"],
  sources: ["knowledge"],
  customizer: ["design"],
  flow_builder: ["design"],
  design: ["customizer", "flow_builder"],
  developer: ["webhooks"],
  mcp: ["webhooks"],
  webhooks: ["developer", "mcp"],
  settings: ["byok"],
  byok: ["settings"],
  calendar: ["meetings"],
};

export const INTELLIGENT_RELATED_TABS: Partial<Record<ChattyTeamTab, readonly ChattyTeamTab[]>> = {
  inbox: ["meetings", "mailbox", "playground"],
  meetings: ["inbox"],
  mailbox: ["inbox"],
  leads: ["feedback"],
  feedback: ["leads"],
  analytics: ["overview"],
  knowledge: ["playground"],
  customizer: ["playground"],
  flow_builder: ["playground"],
  voice: ["playground"],
  developer: ["mcp", "integrations"],
  mcp: ["developer"],
  settings: ["team", "notifications"],
  team: ["meetings"],
};

export function toggleTabIntelligently(
  currentTabs: ChattyTeamTab[],
  tab: ChattyTeamTab,
  checked: boolean,
  grantableTabs: readonly ChattyTeamTab[]
): ChattyTeamTab[] {
  if (!checked) {
    // Unchecking strictly removes only this tab (user has 100% full uncheck control)
    return currentTabs.filter((t) => t !== tab);
  }
  // When checking, add this tab + any natural companions that are grantable
  const related = (INTELLIGENT_RELATED_TABS[tab] || []).filter((r) => grantableTabs.includes(r));
  const newSet = new Set([...currentTabs, tab, ...related]);
  return Array.from(newSet).filter((t) => grantableTabs.includes(t));
}

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

export const TAB_LABELS: Record<ChattyTeamTab | string, string> = {
  overview: "Overview",
  workspace: "Workspace",
  inbox: "Live Inbox",
  playground: "Playground",
  meetings: "Meetings",
  mailbox: "Mailbox",
  leads: "Leads CRM",
  feedback: "Feedback & CSAT",
  analytics: "Analytics",
  map: "Visitor Map",
  knowledge: "Knowledge Base",
  customizer: "Customizer",
  flow_builder: "Flow Builder",
  campaigns: "Campaigns",
  voice: "Voice Agent",
  settings: "Agent Settings",
  team: "Team Roster",
  notifications: "Notifications",
  audit_log: "Audit Log",
  integrations: "Embed & Integrate",
  developer: "Developer API",
  mcp: "MCP Server",
  billing: "Billing & Plans",
  // Legacy aliases
  sources: "Knowledge Base",
  design: "Customizer & Flows",
  byok: "BYOK Keys",
  webhooks: "Developer & MCP",
};

export const TAB_DESCRIPTIONS: Record<ChattyTeamTab | string, string> = {
  overview: "Executive performance scorecard, deflection rate & live KPIs",
  workspace: "Multi-bot management, model switching & active bot switcher",
  inbox: "Omnichannel customer chat inbox, live visitor takeover & notes",
  playground: "Interactive sandbox to test agent prompt grounding & citations",
  meetings: "Appointment booking calendar, round-robin & video room sync",
  mailbox: "Inbound email ticketing, Resend routing & thread management",
  leads: "Captured visitor contact records, metadata & CSV data exports",
  feedback: "Post-chat CSAT star ratings, sentiment analysis & friction tags",
  analytics: "Deflection rate, conversation speeds & token consumption heatmaps",
  map: "Real-time interactive Leaflet visitor geolocation telemetry",
  knowledge: "RAG document uploads, website crawling & FAQ knowledge base",
  customizer: "Widget styling, colors, logo, avatars & live theme preview",
  flow_builder: "Visual decision-tree canvas with interactive branching logic",
  campaigns: "Proactive trigger modals, announcements & exit-intent popups",
  voice: "LiveKit WebRTC bidirectional voice agent studio & audio presets",
  settings: "System prompts, safety guardrails, response parameters & BYOK",
  team: "Teammate roster seats, role permissions & availability schedules",
  notifications: "Team incident alert policies via Slack, SMS, and Email",
  audit_log: "Immutable security compliance audit trail of all workspace actions",
  integrations: "Widget embed script generators, allowed domains & bot accounts",
  developer: "Scoped REST API keys and outbound event webhook endpoints",
  mcp: "FastMCP Model Context Protocol tools & desktop client connections",
  billing: "Subscription tiers, quota allocation & Stripe invoices (Owner only)",
  // Legacy aliases
  sources: "RAG documents, website crawling & FAQ knowledge base",
  design: "Widget appearance, avatar, greetings & theme styles",
  byok: "Custom OpenAI / Anthropic / Mistral API keys",
  webhooks: "Developer API, webhooks & FastMCP server tokens",
};

export interface TabCategory {
  id: string;
  label: string;
  description: string;
  tabs: ChattyTeamTab[];
}

export const TAB_CATEGORIES: TabCategory[] = [
  {
    id: "conversations",
    label: "Conversations & Support",
    description: "Live chats, simulator sandbox, calendar appointments & email tickets",
    tabs: ["inbox", "playground", "meetings", "mailbox"],
  },
  {
    id: "intelligence",
    label: "Intelligence & CRM",
    description: "Executive KPIs, captured leads, customer sentiment & analytics",
    tabs: ["overview", "leads", "feedback", "analytics", "map"],
  },
  {
    id: "content",
    label: "Content & Studio",
    description: "Knowledge documents, widget styling, interactive flows & voice studio",
    tabs: ["knowledge", "customizer", "flow_builder", "campaigns", "voice"],
  },
  {
    id: "operations",
    label: "Operations & Controls",
    description: "Multi-bot switcher, guardrails, teammate availability & audit logs",
    tabs: ["workspace", "settings", "team", "notifications", "audit_log"],
  },
  {
    id: "developer",
    label: "Integrations & Developer",
    description: "Widget embed codes, FastMCP hub, API webhooks & billing tier",
    tabs: ["integrations", "developer", "mcp", "billing"],
  },
];

export const NAV_TAB_PERMISSION: Record<string, ChattyTeamTab | null> = {
  home: "overview",
  workspace: "workspace",
  customizer: "customizer",
  knowledge: "knowledge",
  playground: "playground",
  inbox: "inbox",
  flows: "flow_builder",
  flow_builder: "flow_builder",
  campaigns: "campaigns",
  automations: "settings",
  leads: "leads",
  feedback: "feedback",
  map: "map",
  meetings: "meetings",
  mailbox: "mailbox",
  notifications: "notifications",
  audit_log: "audit_log",
  analytics: "analytics",
  integrations: "integrations",
  voice: "voice",
  developer: "developer",
  mcp: "mcp",
  billing: "billing",
  admin_affiliates: null,
  settings: "settings",
};

export function checkUserHasTabPermission(
  tab: string | null,
  role: string | null,
  permissions: string[]
): boolean {
  if (!tab) return true;
  if (role === "owner") return true;
  if (permissions.includes(tab)) return true;
  const aliases = LEGACY_TAB_ALIASES[tab];
  if (aliases && aliases.some((a) => permissions.includes(a))) {
    return true;
  }
  return false;
}

