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
import type { FlowData } from "./types";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  thought?: string;
  action?: string;
  proposedFlow?: FlowData;
  proposedName?: string;
  changesSummary?: string[];
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
  const [activeModel, setActiveModel] = useState<string>("Gemini 2.5 Flash");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!botId) return;
    void chattyRequest(`/api/flow-builder/ai/config?bot_id=${encodeURIComponent(botId)}`)
      .then(async (res) => {
        if (!res.ok) return;
        const data = await res.json() as { display_name?: string };
        if (data.display_name) setActiveModel(data.display_name);
      })
      .catch(() => setActiveModel("Gemini 2.5 Flash"));
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

      if (!res.ok) {
        const errDetail = await res.text();
        throw new Error(errDetail.slice(0, 200) || "Agent request failed");
      }

      const data = await res.json() as {
        thought?: string;
        action?: string;
        message?: string;
        flow_name?: string;
        flow_data?: FlowData;
        changes_summary?: string[];
        llm_used?: string;
      };

      if (data.llm_used) setActiveModel(data.llm_used);

      const action = data.action || "build";
      const layoutedFlow = data.flow_data ? normalizeFlowLayout(data.flow_data) : undefined;
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
            <h3 className="flow-copilot-title">Flow Architect AI</h3>
            <span className="flow-copilot-model" title="LLM selected in agent settings">
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
                <small>Agent Reasoning:</small>
                <p>{msg.thought}</p>
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
