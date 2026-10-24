"use client";

import React from "react";
import { AlertCircle, CheckCircle2, Sparkles, X, ArrowRight, ShieldCheck, Wrench, HelpCircle } from "lucide-react";
import type { FlowNode } from "./types";

interface FlowHealthModalProps {
  isOpen: boolean;
  onClose: () => void;
  issues: string[];
  nodes: FlowNode[];
  onFocusNode: (nodeId: string) => void;
  onAutoFixWithAI: () => void;
  isFixing?: boolean;
}

export function FlowHealthModal({
  isOpen,
  onClose,
  issues,
  nodes,
  onFocusNode,
  onAutoFixWithAI,
  isFixing = false,
}: FlowHealthModalProps) {
  if (!isOpen) return null;

  const nodeMap = new Map(nodes.map((n) => [n.id, n]));

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="flow-health-dialog"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="flow-health-title"
      >
        <div className="flow-health-header">
          <div className="flex items-center gap-2.5">
            <div className={`flow-health-icon ${issues.length > 0 ? "has-issues" : "healthy"}`}>
              {issues.length > 0 ? <AlertCircle size={20} /> : <ShieldCheck size={20} />}
            </div>
            <div>
              <small className="flow-health-eyebrow">WORKFLOW DIAGNOSTICS</small>
              <h2 id="flow-health-title" className="flow-health-title">
                {issues.length > 0 ? `${issues.length} Issue${issues.length > 1 ? "s" : ""} to Resolve` : "Workflow is Healthy"}
              </h2>
            </div>
          </div>
          <button
            type="button"
            className="icon-btn"
            onClick={onClose}
            aria-label="Close diagnostic modal"
          >
            <X size={18} />
          </button>
        </div>

        <div className="flow-health-body">
          {issues.length === 0 ? (
            <div className="flow-health-empty">
              <CheckCircle2 size={40} className="text-emerald-500 mb-2" />
              <p className="font-semibold text-neutral-800 text-sm">All checks passed</p>
              <span className="text-xs text-neutral-500 max-w-xs text-center">
                Your workflow has a valid trigger, complete node configurations, and no connection cycles. It is ready to publish.
              </span>
            </div>
          ) : (
            <div className="flow-health-list">
              {issues.map((issue, idx) => {
                const targetNode = nodes.find(
                  (n) => issue.startsWith(`${n.title}:`) || issue.includes(n.id)
                );
                return (
                  <div key={idx} className="flow-health-card">
                    <div className="flow-health-card-head">
                      <div className="flex items-center gap-2">
                        <span className="flow-health-tag">Error</span>
                        <strong className="text-xs text-neutral-800 font-semibold">{issue}</strong>
                      </div>
                      {targetNode && (
                        <button
                          type="button"
                          className="flow-health-locate-btn"
                          onClick={() => {
                            onFocusNode(targetNode.id);
                            onClose();
                          }}
                        >
                          <span>Locate</span>
                          <ArrowRight size={12} />
                        </button>
                      )}
                    </div>
                    {targetNode && (
                      <div className="flow-health-card-meta">
                        <span>Node: <b>{targetNode.title}</b> ({targetNode.kind})</span>
                        <span>ID: <code>{targetNode.id}</code></span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="flow-health-footer">
          {issues.length > 0 && (
            <button
              type="button"
              className="flow-health-autofix-btn"
              onClick={onAutoFixWithAI}
              disabled={isFixing}
            >
              <Sparkles size={14} className={isFixing ? "spin" : ""} />
              <span>{isFixing ? "Auto-fixing with AI..." : "Auto-fix All with AI"}</span>
            </button>
          )}
          <button
            type="button"
            className="secondary"
            onClick={onClose}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
