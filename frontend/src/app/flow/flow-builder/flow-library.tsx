"use client";

import { ArrowRight, Plus, Search, ShieldCheck, X } from "lucide-react";
import { NodeIcon } from "./node-icon";
import type { NodeDefinition } from "./node-registry";
import type { FlowTemplate } from "./templates";

type Props = {
  libraryView: "nodes" | "templates";
  search: string;
  sourceFilter: "all" | "native" | "apps";
  filteredCatalog: NodeDefinition[];
  templates: FlowTemplate[];
  mobileOpen: boolean;
  onSetLibraryView: (view: "nodes" | "templates") => void;
  onSearch: (value: string) => void;
  onSourceFilter: (filter: "all" | "native" | "apps") => void;
  onAddNode: (item: NodeDefinition) => void;
  onApplyTemplate: (template: FlowTemplate) => void;
  onCloseMobile: () => void;
};

export function FlowLibrary({ libraryView, search, sourceFilter, filteredCatalog, templates, mobileOpen, onSetLibraryView, onSearch, onSourceFilter, onAddNode, onApplyTemplate, onCloseMobile }: Props) {
  return <aside className={`palette ${mobileOpen ? "mobile-open" : ""}`}>
    <div className="panel-head"><div><small>BUILD</small><h2>{libraryView === "nodes" ? "Node library" : "Workflow templates"}</h2></div><button type="button" className="icon-btn mobile-only" onClick={onCloseMobile} aria-label="Close node library"><X size={17} /></button></div>
    <div className="library-tabs" role="tablist" aria-label="Build resources"><button type="button" role="tab" aria-selected={libraryView === "nodes"} className={libraryView === "nodes" ? "active" : ""} onClick={() => onSetLibraryView("nodes")}>Nodes</button><button type="button" role="tab" aria-selected={libraryView === "templates"} className={libraryView === "templates" ? "active" : ""} onClick={() => onSetLibraryView("templates")}>Templates</button></div>
    {libraryView === "nodes" ? <><div className="search"><Search size={15} /><input value={search} onChange={(event) => onSearch(event.target.value)} placeholder="Search Chatty nodes" /></div><div className="source-row"><button type="button" className={`source ${sourceFilter === "all" ? "active" : ""}`} onClick={() => onSourceFilter("all")}>All</button><button type="button" className={`source ${sourceFilter === "native" ? "active" : ""}`} onClick={() => onSourceFilter("native")}>Built-in</button></div><div className="catalog">{filteredCatalog.map((item) => <button type="button" key={item.type} className="catalog-item" onClick={() => onAddNode(item)}><span className="catalog-icon" style={{ color: item.color, background: `${item.color}16` }}><NodeIcon icon={item.icon} size={16} /></span><span><b>{item.title}</b><small>{item.subtitle}</small></span><Plus size={14} className="add-icon" /></button>)}</div></> : <div className="template-list">{templates.map((template) => <button type="button" key={template.id} className="template-card" onClick={() => onApplyTemplate(template)}><span className="template-icon" style={{ color: template.color, background: `${template.color}16` }}><NodeIcon icon={template.icon} size={17} /></span><span className="template-copy"><b>{template.title}</b><small>{template.description}</small><em>{template.steps.length} steps · {template.category}</em></span><ArrowRight size={14} className="template-arrow" /></button>)}</div>}
    <div className="library-foot"><ShieldCheck size={15} /><span>Chatty owns the conversation flow. Connect n8n, Zapier, or Make through signed Chatty webhooks.</span></div>
  </aside>;
}
