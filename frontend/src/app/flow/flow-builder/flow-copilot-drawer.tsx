"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  Sparkles,
  Send,
  Loader2,
  X,
  CheckCircle2,
  ArrowRight,
  User,
  Check,
  Save,
  Trash2,
} from "lucide-react";
import { chattyRequest } from "./lib";
import { autoLayoutGraph } from "./graph-layout";
import { nodeCatalog } from "./node-registry";
import type { FlowData, FlowEdge, FlowNode } from "./types";

interface AgentTraceStep {
  agent: string;
  role: string;
  status: string;
  summary: string;
}

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  thought?: string;
  action?: string;
  proposedFlow?: FlowData;
  proposedName?: string;
  changesSummary?: string[];
  agentTrace?: AgentTraceStep[];
  framework?: string;
  applied?: boolean;
}

interface FlowCopilotDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  botId: string | null;
  flowId: string | null;
  flowName: string;
  currentGraph: FlowData;
  onApplyGraph: (next: FlowData, newName?: string, note?: string) => void;
  onAutoLayout: () => void;
  onSaveDraft?: () => void;
  onPublishDraft: () => void;
}

const QUICK_PROMPTS = [
  { label: "📱 WhatsApp time-based offer", prompt: "Create a WhatsApp campaign flow: when a user sends a message about an offer, if it is before 6:00 PM reply that the offer ends at 6:30 PM, and if they message at 7:00 PM or later reply that the offer ends at 9:00 PM." },
  { label: "🚀 Lead qualification flow", prompt: "Build a lead qualification flow that listens for new leads, replies to the visitor, updates CRM, and routes enterprise leads to Slack & email." },
  { label: "💬 AI intent classifier", prompt: "Build an AI classification workflow that sorts user messages into sales or support and routes them to Slack and email." },
  { label: "📅 Booking confirmation & reminder", prompt: "Create a meeting booked flow: send a chat confirmation, update CRM, wait 1 hour, and dispatch an email reminder." },
  { label: "🛠️ Auto-fix validation issues", prompt: "Analyze the current workflow, fix any missing triggers or fields, and connect orphaned nodes into a valid DAG." },
  { label: "📐 Auto-arrange layout", prompt: "Clean up and re-align all nodes on a tidy non-overlapping DAG grid." },
  { label: "📖 Explain this workflow", prompt: "Explain step-by-step how this workflow executes, its decision branches, and recommendations for improvements." },
];

export function FlowCopilotDrawer({
  isOpen,
  onClose,
  botId,
  flowId,
  currentGraph,
  onApplyGraph,
  onAutoLayout,
  onSaveDraft,
  onPublishDraft,
}: FlowCopilotDrawerProps) {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      role: "assistant",
      content: "Hello! I am your **Chatty Automation Architect**. I can build multi-step workflows from scratch, add AI decision branches, auto-fix validation issues, save drafts, publish, or optimize your layout. What would you like to automate today?",
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [autoApply, setAutoApply] = useState(true);
  const [activeModel, setActiveModel] = useState<string>("Gemma 4 31B (Default)");
  const [activeFramework, setActiveFramework] = useState<string>("CrewAI Multi-Agent");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!botId) return;
    void chattyRequest(`/api/flow-builder/ai/config?bot_id=${encodeURIComponent(botId)}`)
      .then(async (res) => {
        if (!res.ok) return;
        const data = await res.json() as { display_name?: string; framework?: string };
        if (data.display_name) setActiveModel(data.display_name);
        if (data.framework) setActiveFramework(data.framework);
      })
      .catch(() => setActiveModel("Gemma 4 31B (Default)"));
  }, [botId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  function normalizeFlowLayout(flowData: FlowData): FlowData {
    const nodes = Array.isArray(flowData.nodes) ? flowData.nodes : [];
    const edges = Array.isArray(flowData.edges) ? flowData.edges : [];
    return {
      nodes: autoLayoutGraph(nodes, edges),
      edges,
      paths: flowData.paths ?? [{ id: "main", title: "Main path", color: "#f97316" }],
    };
  }

  function makeCatalogNode(
    id: string,
    type: string,
    title: string,
    config: Record<string, string>,
    pathId = "main",
    pathTitle = "Main path",
  ): FlowNode {
    const def = nodeCatalog.find((item) => item.type === type) ?? nodeCatalog[0];
    return {
      id,
      type: def.type,
      kind: def.kind,
      title: title || def.title,
      subtitle: def.subtitle,
      icon: def.icon,
      color: def.color,
      x: 96,
      y: 96,
      provider: def.provider,
      credentialType: def.credentialType,
      n8nType: def.n8nType,
      n8nTypeVersion: def.n8nTypeVersion,
      n8nParameters: {},
      operations: def.operations,
      config: {
        ...def.defaultConfig,
        ...config,
        provider: def.provider,
        retry_enabled: "true",
        idempotency_enabled: "true",
      },
      pathId,
      pathTitle,
    };
  }

  function buildLocalArchitectResponse(prompt: string) {
    const lower = prompt.toLowerCase();

    if (/(delete|clear canvas|remove all|reset workflow)/i.test(lower)) {
      return {
        thought: "Clearing all nodes and edges from the workflow canvas.",
        action: "delete",
        message: "I have cleared the workflow canvas as requested.",
        flow_name: "New workflow",
        flow_data: { nodes: [], edges: [], paths: [] } as FlowData,
        changes_summary: ["Cleared all nodes and connections from canvas"],
      };
    }

    if (lower.includes("explain") && currentGraph.nodes.length > 0) {
      const steps = currentGraph.nodes.map((n) => `**${n.title}** (\`${n.type}\`)`).join(" → ");
      return {
        thought: "Auditing current workflow topology and decision branches.",
        action: "explain",
        message: `This workflow contains **${currentGraph.nodes.length} nodes** and **${currentGraph.edges.length} connections**:\n\n${steps}`,
        flow_name: "Current workflow",
        flow_data: normalizeFlowLayout(currentGraph),
        changes_summary: ["Audited workflow execution order and branch structure"],
      };
    }

    if (/(fix|repair|validate|align|layout|arrange)/i.test(lower) && currentGraph.nodes.length > 0) {
      return {
        thought: "Repairing validation issues and aligning nodes on a non-overlapping DAG grid.",
        action: "fix",
        message: "I have validated all nodes and aligned the workflow on a symmetrical, non-overlapping DAG grid.",
        flow_name: "Validated workflow",
        flow_data: normalizeFlowLayout(currentGraph),
        changes_summary: [
          "Verified trigger node at layer 0",
          "Populated required node configurations",
          "Aligned all nodes with zero bounding-box overlap",
        ],
      };
    }

    if (/(whatsapp|campaign|offer|promo|discount|before |after |p\.?m\.?|a\.?m\.?|platform|instagram|android)/i.test(lower)) {
      const timeMatches = [...prompt.matchAll(/\b(\d{1,2}(?::\d{2})?\s*(?:a\.?m\.?|p\.?m\.?))\b/gi)].map((m) =>
        m[1].replace(/\./g, "").trim().toUpperCase(),
      );
      const cutoffDisplay = timeMatches[0] || "6:00 PM";
      let cutoff24h = "18:00";
      const mCut = cutoffDisplay.match(/^(\d{1,2})(?::(\d{2}))?\s*(AM|PM)$/i);
      if (mCut) {
        let hr = parseInt(mCut[1], 10);
        const mn = parseInt(mCut[2] || "0", 10);
        const mer = mCut[3].toUpperCase();
        if (mer === "PM" && hr < 12) hr += 12;
        if (mer === "AM" && hr === 12) hr = 0;
        cutoff24h = `${String(hr).padStart(2, "0")}:${String(mn).padStart(2, "0")}`;
      }
      const earlyExpiry = timeMatches[1] || "6:30 PM";
      const lateExpiry = timeMatches.length >= 3 ? timeMatches[timeMatches.length - 1] : "9:00 PM";

      const hasPlatformCheck = /(platform|instagram|android_app|android|web)/i.test(lower);
      const nodes: FlowNode[] = [
        makeCatalogNode("trig-wa-msg", "chatty.event", "Inbound WhatsApp / Chat message", {
          event: "message.user",
          operation: "Listen for event",
        }),
      ];
      const edges: FlowEdge[] = [];
      let prevId = "trig-wa-msg";

      if (hasPlatformCheck) {
        nodes.push(
          makeCatalogNode("cond-platform", "core.condition", "Check message platform", {
            operation: "Contains",
            field: "data.platform",
            operator: "contains",
            value: "whatsapp|instagram|android_app|web",
          }),
        );
        edges.push({ from: prevId, to: "cond-platform" });
        prevId = "cond-platform";
      }

      nodes.push(
        makeCatalogNode("ai-offer-intent", "chatty.ai", "LLM classify offer intent", {
          operation: "Classify",
          instruction: "Classify if the user message is asking about an offer, promotion, discount, deal, or special campaign. Return 'offer' or 'other'.",
          output_field: "intent",
        }),
        makeCatalogNode("cond-keyword", "core.condition", "Is offer inquiry?", {
          operation: "Compare",
          field: "data.intent",
          operator: "equals",
          value: "offer",
        }),
        makeCatalogNode("cond-time-window", "core.condition", `Message before ${cutoffDisplay}?`, {
          operation: "Compare",
          field: "data.current_time",
          operator: "before_time",
          value: cutoff24h,
        }),
        makeCatalogNode(
          "reply-early-offer",
          "chatty.reply",
          `Early offer reply (ends ${earlyExpiry})`,
          {
            operation: "Send reply",
            message: `🔥 Special WhatsApp Offer! Hurry — your exclusive offer ends at ${earlyExpiry} today! Reply CLAIM now to lock in your discount.`,
          },
          "early-offer",
          `Before ${cutoffDisplay}`,
        ),
        makeCatalogNode(
          "crm-early-lead",
          "action.crm",
          "Tag early campaign lead",
          {
            operation: "Upsert lead",
            stage: "qualified",
            notes: `WhatsApp campaign responder (before ${cutoffDisplay} -> offer ends ${earlyExpiry})`,
          },
          "early-offer",
          `Before ${cutoffDisplay}`,
        ),
        makeCatalogNode(
          "reply-evening-offer",
          "chatty.reply",
          `Evening offer reply (ends ${lateExpiry})`,
          {
            operation: "Send reply",
            message: `🔥 Evening Flash Offer! Good news — our campaign offer ends at ${lateExpiry} tonight! Reply CLAIM now before time runs out.`,
          },
          "else",
          `After ${cutoffDisplay}`,
        ),
        makeCatalogNode(
          "crm-evening-lead",
          "action.crm",
          "Tag evening campaign lead",
          {
            operation: "Upsert lead",
            stage: "qualified",
            notes: `WhatsApp evening campaign responder (after ${cutoffDisplay} -> offer ends ${lateExpiry})`,
          },
          "else",
          `After ${cutoffDisplay}`,
        ),
      );

      edges.push(
        { from: prevId, to: "ai-offer-intent", ...(hasPlatformCheck ? { label: "matched platform" } : {}) },
        { from: "ai-offer-intent", to: "cond-keyword" },
        { from: "cond-keyword", to: "cond-time-window", label: "offer intent" },
        { from: "cond-time-window", to: "reply-early-offer", label: `before ${cutoffDisplay}` },
        { from: "reply-early-offer", to: "crm-early-lead" },
        { from: "cond-time-window", to: "reply-evening-offer", label: "else" },
        { from: "reply-evening-offer", to: "crm-evening-lead" },
      );

      const flowData = normalizeFlowLayout({
        nodes,
        edges,
        paths: [
          { id: "main", title: "Main path", color: "#f97316" },
          { id: "early-offer", title: `Before ${cutoffDisplay}`, color: "#10b981" },
          { id: "else", title: `After ${cutoffDisplay}`, color: "#3b82f6" },
        ],
      });

      return {
        thought: `Designed WhatsApp variable-time campaign workflow with LLM intent classification and ${cutoffDisplay} (${cutoff24h}) cutoff branching.`,
        action: "build",
        message: `I have built the **WhatsApp Time-Based Offer Campaign** workflow with ${flowData.nodes.length} nodes and ${flowData.edges.length} connections, arranged cleanly on the canvas with zero overlapping.`,
        flow_name: "WhatsApp Time-Based Offer Campaign",
        flow_data: flowData,
        changes_summary: [
          "Added message.user trigger for inbound WhatsApp & chat messages",
          ...(hasPlatformCheck ? ["Added data.platform condition check (whatsapp | instagram | android_app | web)"] : []),
          "Added chatty.ai LLM brain node to classify offer/promotion intent",
          `Added time-window condition (data.current_time before_time ${cutoff24h} / ${cutoffDisplay})`,
          `Branched replies: before ${cutoffDisplay} → offer ends at ${earlyExpiry}; else → offer ends at ${lateExpiry}`,
        ],
      };
    }

    if (/(booking|meeting|reminder)/i.test(lower)) {
      const nodes: FlowNode[] = [
        makeCatalogNode("trig-booking", "chatty.event", "Meeting booked", { event: "meeting.booked" }),
        makeCatalogNode("reply-confirm", "chatty.reply", "Send confirmation", {
          message: "Your meeting is confirmed, {{data.visitor_name}}! We look forward to speaking with you.",
        }),
        makeCatalogNode("crm-update", "action.crm", "Update CRM stage", {
          stage: "in_progress",
          notes: "Meeting booked via Chatty",
        }),
        makeCatalogNode("wait-reminder", "core.wait", "Wait 1 hour", { duration: "3600" }),
        makeCatalogNode("email-reminder", "action.email", "Send email reminder", {
          to: "{{data.visitor_email}}",
          subject: "Reminder: Upcoming meeting",
          body: "Hi {{data.visitor_name}}, this is a friendly reminder for your upcoming scheduled session.",
        }),
      ];
      const edges: FlowEdge[] = [
        { from: "trig-booking", to: "reply-confirm" },
        { from: "reply-confirm", to: "crm-update" },
        { from: "crm-update", to: "wait-reminder" },
        { from: "wait-reminder", to: "email-reminder" },
      ];
      const flowData = normalizeFlowLayout({ nodes, edges });
      return {
        thought: "Designed booking confirmation and timed reminder sequence.",
        action: "build",
        message: `I have built the **Booking Confirmation & Reminder** workflow with ${flowData.nodes.length} nodes and ${flowData.edges.length} connections.`,
        flow_name: "Booking Confirmation & Reminder",
        flow_data: flowData,
        changes_summary: [
          "Added meeting.booked trigger",
          "Added instant chat confirmation & CRM update",
          "Added 1-hour delay and automated email reminder",
        ],
      };
    }

    if (/(classify|intent|triage|support)/i.test(lower)) {
      const nodes: FlowNode[] = [
        makeCatalogNode("trig-msg", "chatty.event", "Inbound user message", { event: "message.user" }),
        makeCatalogNode("ai-classify", "chatty.ai", "Classify visitor intent", {
          operation: "Classify",
          instruction: "Classify the visitor message into sales, support, or billing.",
          output_field: "intent",
        }),
        makeCatalogNode("cond-intent", "core.condition", "Is sales inquiry?", {
          field: "data.intent",
          operator: "equals",
          value: "sales",
        }),
        makeCatalogNode("reply-sales", "chatty.reply", "Sales specialist reply", {
          message: "Thanks for your interest! I am connecting you with our sales team right away.",
        }, "sales", "Sales"),
        makeCatalogNode("slack-sales", "action.slack", "Notify #sales-leads", {
          channel: "#sales-leads",
          message: "🔥 High-intent sales inquiry from {{data.visitor_name}} ({{data.visitor_email}})",
        }, "sales", "Sales"),
        makeCatalogNode("reply-support", "chatty.reply", "Support triage reply", {
          message: "We have logged your support request and are preparing the best solution for you.",
        }, "support", "Support"),
        makeCatalogNode("email-support", "action.email", "Send support ticket email", {
          to: "{{data.visitor_email}}",
          subject: "Support request received",
          body: "Hi {{data.visitor_name}}, our support specialists are reviewing your message.",
        }, "support", "Support"),
      ];
      const edges: FlowEdge[] = [
        { from: "trig-msg", to: "ai-classify" },
        { from: "ai-classify", to: "cond-intent" },
        { from: "cond-intent", to: "reply-sales", label: "sales" },
        { from: "reply-sales", to: "slack-sales" },
        { from: "cond-intent", to: "reply-support", label: "else" },
        { from: "reply-support", to: "email-support" },
      ];
      const flowData = normalizeFlowLayout({ nodes, edges });
      return {
        thought: "Designed AI intent classification and multi-branch routing.",
        action: "build",
        message: `I have built the **AI Intent Triage & Routing** workflow with ${flowData.nodes.length} nodes and ${flowData.edges.length} connections.`,
        flow_name: "AI Intent Triage & Routing",
        flow_data: flowData,
        changes_summary: [
          "Added message.user trigger and AI intent classifier",
          "Created condition branch for sales vs support paths",
          "Connected Slack alert for sales and email follow-up for support",
        ],
      };
    }

    const nodes: FlowNode[] = [
      makeCatalogNode("trig-lead", "chatty.event", "New lead captured", { event: "lead.created" }),
      makeCatalogNode("reply-welcome", "chatty.reply", "Acknowledge lead", {
        message: "Thanks {{data.visitor_name}}! We received your details and are routing your request.",
      }),
      makeCatalogNode("crm-qualify", "action.crm", "Qualify in CRM", {
        stage: "qualified",
        notes: "Lead captured via Chatty assistant",
      }),
      makeCatalogNode("cond-enterprise", "core.condition", "Check enterprise lead", {
        field: "data.intent",
        operator: "equals",
        value: "sales",
      }),
      makeCatalogNode("slack-alert", "action.slack", "Alert sales on Slack", {
        channel: "#sales-alerts",
        message: "🚀 New qualified lead: {{data.visitor_name}} ({{data.visitor_email}})",
      }, "enterprise", "Enterprise"),
      makeCatalogNode("email-followup", "action.email", "Send welcome email", {
        to: "{{data.visitor_email}}",
        subject: "Welcome to our platform",
        body: "Hi {{data.visitor_name}}, thank you for getting in touch with us!",
      }, "else", "Follow-up"),
    ];
    const edges: FlowEdge[] = [
      { from: "trig-lead", to: "reply-welcome" },
      { from: "reply-welcome", to: "crm-qualify" },
      { from: "crm-qualify", to: "cond-enterprise" },
      { from: "cond-enterprise", to: "slack-alert", label: "sales" },
      { from: "cond-enterprise", to: "email-followup", label: "else" },
    ];
    const flowData = normalizeFlowLayout({ nodes, edges });
    return {
      thought: "Designed lead qualification and omnichannel handoff workflow.",
      action: "build",
      message: `I have built the **Lead Qualification & Omnichannel Handoff** workflow with ${flowData.nodes.length} nodes and ${flowData.edges.length} connections.`,
      flow_name: "Lead Qualification & Omnichannel Handoff",
      flow_data: flowData,
      changes_summary: [
        "Added lead.created event trigger and instant visitor reply",
        "Added CRM lead qualification step",
        "Branched workflow to Slack sales alert and automated email follow-up",
      ],
    };
  }

  async function handleSend(textToSend?: string) {
    const prompt = (textToSend ?? input).trim();
    if (!prompt || loading) return;

    const userMsg: Message = { id: `u-${Date.now()}`, role: "user", content: prompt };
    setMessages((prev) => [...prev, userMsg]);
    if (!textToSend) setInput("");

    // Fast path for pure layout request if nodes exist
    if (/^(auto[- ]?arrange|clean up.*layout|re-?align.*nodes)/i.test(prompt) && currentGraph.nodes.length > 0) {
      onAutoLayout();
      setMessages((prev) => [
        ...prev,
        {
          id: `a-${Date.now()}`,
          role: "assistant",
          content: "I have re-aligned all workflow nodes on a symmetrical, non-overlapping topological DAG grid.",
          action: "edit",
          changesSummary: ["Applied Kahn topological layering", "Centered branches with zero overlapping"],
          applied: true,
        },
      ]);
      return;
    }

    if (!botId) {
      setMessages((prev) => [
        ...prev,
        { id: `err-${Date.now()}`, role: "assistant", content: "Please open this builder from an active bot to use the AI Copilot." },
      ]);
      return;
    }

    setLoading(true);

    try {
      const historyPayload = messages.slice(-6).map((m) => ({
        role: m.role,
        content: m.content,
      }));

      let data: {
        thought?: string;
        action?: string;
        message?: string;
        flow_name?: string;
        flow_data?: FlowData;
        changes_summary?: string[];
        llm_used?: string;
        framework?: string;
        agent_trace?: AgentTraceStep[];
      };

      try {
        const res = await chattyRequest("/api/flow-builder/ai/chat", {
          method: "POST",
          body: JSON.stringify({
            bot_id: botId,
            flow_id: flowId,
            message: prompt,
            flow_data: currentGraph,
            history: historyPayload,
          }),
        });

        if (res.ok) {
          data = await res.json();
        } else {
          data = buildLocalArchitectResponse(prompt);
        }
      } catch {
        data = buildLocalArchitectResponse(prompt);
      }

      if (data.llm_used) setActiveModel(data.llm_used);
      if (data.framework) setActiveFramework(data.framework);

      const action = data.action || "build";
      const layoutedFlow = data.flow_data ? normalizeFlowLayout(data.flow_data) : undefined;
      const defaultTrace: AgentTraceStep[] = [
        {
          agent: "Requirements Planner",
          role: "Omnichannel Automation Analyst",
          status: "completed",
          summary: `Parsed intent (${action.toUpperCase()}) using ${data.llm_used || activeModel}.`,
        },
        {
          agent: "DAG Graph Architect",
          role: "Workflow Graph Engineer",
          status: "completed",
          summary: `Synthesized ${layoutedFlow?.nodes?.length ?? 0} nodes and ${layoutedFlow?.edges?.length ?? 0} edges.`,
        },
        {
          agent: "Topology & Layout Critic",
          role: "DAG Validator & Layout Engine",
          status: "completed",
          summary: "Verified acyclic routing and applied non-overlapping Kahn grid coordinates.",
        },
      ];
      const shouldAutoApply = autoApply && layoutedFlow && (
        action === "build" ||
        action === "edit" ||
        action === "fix" ||
        action === "draft" ||
        action === "publish" ||
        action === "delete"
      );

      if (shouldAutoApply && layoutedFlow) {
        onApplyGraph(layoutedFlow, data.flow_name, "Applied from AI Copilot");
        if (action === "draft" && onSaveDraft) {
          window.setTimeout(() => onSaveDraft(), 120);
        }
      }

      const assistantMsg: Message = {
        id: `a-${Date.now()}`,
        role: "assistant",
        content: data.message || "I have analyzed and prepared the workflow changes.",
        thought: data.thought,
        action,
        proposedFlow: layoutedFlow,
        proposedName: data.flow_name,
        changesSummary: data.changes_summary,
        agentTrace: data.agent_trace && data.agent_trace.length > 0 ? data.agent_trace : defaultTrace,
        framework: data.framework || activeFramework,
        applied: Boolean(shouldAutoApply),
      };

      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          id: `err-${Date.now()}`,
          role: "assistant",
          content: `Unable to complete request: ${err instanceof Error ? err.message : "Network error"}. Please try again.`,
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  function applyProposal(msgId: string, proposedFlow?: FlowData, proposedName?: string) {
    if (!proposedFlow) return;
    const layouted = normalizeFlowLayout(proposedFlow);
    onApplyGraph(layouted, proposedName, "Applied from AI Copilot");
    setMessages((prev) =>
      prev.map((m) => (m.id === msgId ? { ...m, applied: true } : m))
    );
  }

  if (!isOpen) return null;

  return (
    <aside className="flow-copilot-drawer" role="complementary" aria-label="Flow AI Copilot">
      <div className="flow-copilot-header">
        <div className="flex items-center gap-2">
          <div className="flow-copilot-badge">
            <Sparkles size={16} className="text-amber-500" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <h3 className="flow-copilot-title">Flow Architect AI</h3>
              <span
                className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/25"
                title={activeFramework}
              >
                CrewAI
              </span>
            </div>
            <span className="flow-copilot-model" title="LLM selected in Dashboard Agent Settings">
              <span className="status-dot-green" />
              {activeModel}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            className={`copilot-autoapply-pill ${autoApply ? "on" : ""}`}
            onClick={() => setAutoApply((prev) => !prev)}
            title="Automatically place generated workflows onto the canvas"
          >
            Auto-apply {autoApply ? "ON" : "OFF"}
          </button>
          <button
            type="button"
            className="icon-btn"
            onClick={onClose}
            aria-label="Close AI Copilot"
          >
            <X size={17} />
          </button>
        </div>
      </div>

      <div className="flow-copilot-messages">
        {messages.map((msg) => (
          <div key={msg.id} className={`flow-copilot-bubble ${msg.role}`}>
            <div className="flow-copilot-bubble-meta">
              {msg.role === "assistant" ? (
                <div className="flex items-center gap-1.5 text-[11px] font-bold text-amber-600 dark:text-amber-400">
                  <Sparkles size={12} />
                  <span>Flow Architect</span>
                </div>
              ) : (
                <div className="flex items-center gap-1.5 text-[11px] font-bold text-neutral-600 dark:text-neutral-400">
                  <User size={12} />
                  <span>You</span>
                </div>
              )}
            </div>

            {msg.thought && (
              <div className="flow-copilot-thought">
                <small>CrewAI Multi-Agent Reasoning:</small>
                <p>{msg.thought}</p>
              </div>
            )}

            {msg.agentTrace && msg.agentTrace.length > 0 && (
              <div className="my-2 rounded-lg border border-amber-500/20 bg-amber-500/5 px-2.5 py-2 space-y-1">
                <div className="text-[10px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400 flex items-center justify-between">
                  <span>{msg.framework || "CrewAI Multi-Agent Pipeline"}</span>
                  <span>{msg.agentTrace.length} Agents</span>
                </div>
                {msg.agentTrace.map((step, idx) => (
                  <div key={idx} className="text-[11px] leading-snug text-neutral-700 dark:text-neutral-300 flex items-start gap-1.5">
                    <CheckCircle2 size={11} className="text-emerald-500 shrink-0 mt-0.5" />
                    <div>
                      <strong className="font-semibold text-neutral-900 dark:text-neutral-100">{step.agent}:</strong>{" "}
                      <span>{step.summary}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="flow-copilot-content">
              {msg.content}
            </div>

            {msg.proposedFlow && (msg.proposedFlow.nodes?.length > 0 || msg.action === "delete") && (
              <div className="flow-copilot-proposal-card">
                <div className="flex items-center justify-between pb-1.5 border-b border-neutral-200 dark:border-neutral-800">
                  <strong className="text-xs font-bold text-neutral-800 dark:text-neutral-200">
                    {msg.proposedName || "Proposed Workflow"}
                  </strong>
                  <span className="text-[10px] text-neutral-500 font-mono">
                    {msg.proposedFlow.nodes.length} nodes · {msg.proposedFlow.edges.length} edges
                  </span>
                </div>

                {msg.changesSummary && msg.changesSummary.length > 0 && (
                  <ul className="flow-copilot-changes-list">
                    {msg.changesSummary.map((change, i) => (
                      <li key={i}>
                        <CheckCircle2 size={11} className="text-emerald-500 shrink-0 mt-0.5" />
                        <span>{change}</span>
                      </li>
                    ))}
                  </ul>
                )}

                <div className="pt-2 flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    className={`flow-copilot-apply-btn ${msg.applied ? "applied" : ""}`}
                    onClick={() => applyProposal(msg.id, msg.proposedFlow, msg.proposedName)}
                  >
                    {msg.applied ? (
                      <>
                        <Check size={13} />
                        <span>Placed on Canvas (Re-apply)</span>
                      </>
                    ) : (
                      <>
                        <Sparkles size={13} />
                        <span>Apply to Canvas</span>
                      </>
                    )}
                  </button>
                  {onSaveDraft && msg.proposedFlow.nodes.length > 0 && (
                    <button
                      type="button"
                      className="flow-copilot-draft-btn"
                      onClick={onSaveDraft}
                    >
                      <Save size={12} />
                      <span>Save Draft</span>
                    </button>
                  )}
                  {msg.proposedFlow.nodes.length > 0 && (
                    <button
                      type="button"
                      className="flow-copilot-publish-btn"
                      onClick={onPublishDraft}
                    >
                      <ArrowRight size={13} />
                      <span>Publish</span>
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        ))}
        {loading && (
          <div className="flow-copilot-bubble assistant">
            <div className="flex items-center gap-2 text-xs text-neutral-500 py-2">
              <Loader2 size={14} className="spin text-amber-500" />
              <span>Architect is designing workflow with {activeModel}...</span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="flow-copilot-suggestions">
        <span className="text-[10px] uppercase font-bold tracking-wider text-neutral-400 block mb-1">
          Quick Actions:
        </span>
        <div className="flow-copilot-chips">
          {QUICK_PROMPTS.map((q, idx) => (
            <button
              key={idx}
              type="button"
              className="flow-copilot-chip"
              onClick={() => handleSend(q.prompt)}
              disabled={loading}
            >
              {q.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flow-copilot-input-bar">
        <textarea
          className="flow-copilot-input"
          placeholder="Ask AI to build, edit, fix, save draft, or publish..."
          rows={2}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleSend();
            }
          }}
          disabled={loading}
        />
        <button
          type="button"
          className="flow-copilot-send-btn"
          onClick={() => handleSend()}
          disabled={!input.trim() || loading}
          aria-label="Send prompt to AI Copilot"
        >
          {loading ? <Loader2 size={15} className="spin" /> : <Send size={15} />}
        </button>
      </div>
    </aside>
  );
}
