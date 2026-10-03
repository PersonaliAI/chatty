"use client";

import { CheckCircle2, Clock3, RefreshCw, XCircle } from "lucide-react";
import type { FlowRun } from "./types";

type Props = {
  runs: FlowRun[];
  loading: boolean;
  selectedRun: FlowRun | null;
  onSelect: (run: FlowRun) => void;
  onRefresh: () => void;
};

function RunIcon({ status }: { status: FlowRun["status"] }) {
  if (status === "completed") return <CheckCircle2 size={16} />;
  if (status === "failed") return <XCircle size={16} />;
  return <Clock3 size={16} />;
}

export function RunHistory({ runs, loading, selectedRun, onSelect, onRefresh }: Props) {
  return (
    <div className="run-history">
      <div className="history-toolbar">
        <div>
          <small>OBSERVE</small>
          <h2>Execution history</h2>
          <p>Review real runs from published workflows.</p>
        </div>
        <button type="button" className="secondary" onClick={onRefresh} disabled={loading}><RefreshCw size={14} /> Refresh</button>
      </div>
      <div className="history-layout">
        <div className="history-list">
          {loading ? <div className="history-empty">Loading runs…</div> : runs.length === 0 ? <div className="history-empty">No executions yet. Publish and enable a workflow to see runs here.</div> : runs.map((run) => (
            <button type="button" key={run.id} className={`run-row ${selectedRun?.id === run.id ? "selected" : ""}`} onClick={() => onSelect(run)}>
              <span className={`run-status ${run.status}`}><RunIcon status={run.status} /></span>
              <span className="run-row-copy"><b>{run.status === "completed" ? "Completed run" : run.status === "failed" ? "Failed run" : `${run.status[0].toUpperCase()}${run.status.slice(1)} run`}</b><small>{run.created_at ? new Date(run.created_at).toLocaleString() : "Unknown time"}</small></span>
              <span className="run-duration">{typeof run.duration_ms === "number" ? `${run.duration_ms} ms` : "—"}</span>
            </button>
          ))}
        </div>
        <div className="run-detail">
          {!selectedRun ? <div className="history-empty">Select a run to inspect its node trace.</div> : <>
            <div className="run-detail-head"><div><small>RUN TRACE</small><h3>{selectedRun.status === "completed" ? "Completed" : selectedRun.status === "failed" ? "Failed" : selectedRun.status}</h3></div><span className={`run-detail-pill ${selectedRun.status}`}>{selectedRun.duration_ms ?? 0} ms</span></div>
            {selectedRun.error && <div className="run-error">{selectedRun.error}</div>}
            <div className="trace-list">{(selectedRun.trace ?? []).map((step) => <div className="trace-row" key={`${selectedRun.id}-${step.node_id}`}><span className={`trace-icon ${step.status}`}><RunIcon status={step.status === "failed" ? "failed" : "completed"} /></span><span><b>{step.title}</b><small>{step.status}{step.error ? ` · ${step.error}` : ""}</small></span></div>)}</div>
          </>}
        </div>
      </div>
    </div>
  );
}
