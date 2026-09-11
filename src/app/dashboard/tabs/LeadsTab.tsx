"use client";

import { RefreshCw, FileSpreadsheet, Loader2, Users, Pencil, Trash2, Check, X } from "lucide-react";
import type { Lead } from "../dashboard-types";

interface LeadsTabProps {
  leads: Lead[];
  filteredLeads: Lead[];
  leadsSearch: string;
  setLeadsSearch: (s: string) => void;
  refreshLeads: () => void;
  refreshingLeads: boolean;
  exportLeadsCSV: () => void;
  loadingLists: boolean;
  leadFields: string[];
  editingLeadId: string | null;
  editLeadDraft: Record<string, string>;
  setEditLeadDraft: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  saveEditLead: () => void;
  cancelEditLead: () => void;
  savingLeadEdit: boolean;
  startEditLead: (l: Lead) => void;
  deleteLead: (l: Lead) => void;
  getLeadFieldValue: (l: Lead, f: string) => string;
}

export function LeadsTab({
  leads,
  filteredLeads,
  leadsSearch,
  setLeadsSearch,
  refreshLeads,
  refreshingLeads,
  exportLeadsCSV,
  loadingLists,
  leadFields,
  editingLeadId,
  editLeadDraft,
  setEditLeadDraft,
  saveEditLead,
  cancelEditLead,
  savingLeadEdit,
  startEditLead,
  deleteLead,
  getLeadFieldValue,
}: LeadsTabProps) {
  return (
    <div className="max-w-5xl mx-auto w-full py-6 px-4 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h4 className="text-xs font-bold uppercase tracking-wider text-neutral-400">
            Captured Leads ({leads.length})
          </h4>
          <p className="text-[10px] text-neutral-450 dark:text-neutral-500 mt-1">
            Contact details gathered by your AI assistant during customer interactions.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="text"
            placeholder="Search leads..."
            value={leadsSearch}
            onChange={(e) => setLeadsSearch(e.target.value)}
            className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-lg px-3 py-1.5 text-xs text-neutral-800 dark:text-neutral-200 focus:outline-none focus:border-neutral-350 dark:focus:border-neutral-700 w-48"
          />
          <button
            onClick={refreshLeads}
            disabled={refreshingLeads}
            title="Refresh leads"
            aria-label="Refresh leads"
            className="p-2 rounded-lg border border-neutral-200 dark:border-neutral-800 text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200 hover:border-neutral-350 dark:hover:border-neutral-700 cursor-pointer disabled:opacity-50 transition-colors"
          >
            <RefreshCw className={`size-3.5 ${refreshingLeads ? "animate-spin" : ""}`} />
          </button>
          <button
            onClick={exportLeadsCSV}
            disabled={leads.length === 0}
            className="text-[10px] font-semibold bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 rounded-lg px-3 py-2 flex items-center gap-1.5 cursor-pointer hover:opacity-90 disabled:opacity-50 transition-opacity"
          >
            <FileSpreadsheet className="size-3.5" />
            Export CSV
          </button>
        </div>
      </div>

      {loadingLists ? (
        <div className="flex items-center justify-center p-12 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl">
          <Loader2 className="size-5 animate-spin text-neutral-400" />
        </div>
      ) : (
        <div className="overflow-x-auto bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl">
          <table className="w-full border-collapse text-left text-xs text-neutral-500 dark:text-neutral-400">
            <thead className="bg-neutral-50 dark:bg-neutral-955 font-semibold text-neutral-700 dark:text-neutral-300">
              <tr>
                {leadFields.map((field) => (
                  <th key={field} className="px-6 py-4 border-b border-neutral-200 dark:border-neutral-800 capitalize">
                    {field.replace(/_/g, " ")}
                  </th>
                ))}
                <th className="px-6 py-4 border-b border-neutral-200 dark:border-neutral-800">Captured At</th>
                <th className="px-6 py-4 border-b border-neutral-200 dark:border-neutral-800 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800 font-medium text-neutral-800 dark:text-neutral-200">
              {filteredLeads.map((l) => {
                const isEditing = editingLeadId === l.id;
                return (
                  <tr key={l.id} className="hover:bg-neutral-50/50 dark:hover:bg-neutral-800/10">
                    {leadFields.map((field) => {
                      if (isEditing) {
                        return (
                          <td key={field} className="px-6 py-3">
                            <input
                              type="text"
                              value={editLeadDraft[field] ?? ""}
                              onChange={(e) => setEditLeadDraft((prev) => ({ ...prev, [field]: e.target.value }))}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") saveEditLead();
                                if (e.key === "Escape") cancelEditLead();
                              }}
                              className="w-full bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-md px-2 py-1.5 text-xs focus:outline-none focus:border-[#f97316]"
                            />
                          </td>
                        );
                      }
                      const val = getLeadFieldValue(l, field);
                      if (field === "name") {
                        return (
                          <td key={field} className="px-6 py-4 flex items-center gap-2.5">
                            <div className="size-7 rounded-full bg-[#f97316]/10 text-[#f97316] flex items-center justify-center font-bold shrink-0">
                              {val[0]?.toUpperCase() || "?"}
                            </div>
                            <span className="font-semibold">{val}</span>
                          </td>
                        );
                      }
                      return (
                        <td key={field} className="px-6 py-4 font-mono">
                          {val}
                        </td>
                      );
                    })}
                    <td className="px-6 py-4 text-neutral-400 dark:text-neutral-500 font-mono">{l.created_at}</td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-end gap-1">
                        {isEditing ? (
                          <>
                            <button
                              onClick={saveEditLead}
                              disabled={savingLeadEdit}
                              title="Save"
                              aria-label="Save lead"
                              className="p-1.5 rounded-md text-green-600 hover:bg-green-50 dark:hover:bg-green-950/30 cursor-pointer disabled:opacity-50"
                            >
                              {savingLeadEdit ? <Loader2 className="size-3.5 animate-spin" /> : <Check className="size-3.5" />}
                            </button>
                            <button
                              onClick={cancelEditLead}
                              disabled={savingLeadEdit}
                              title="Cancel"
                              aria-label="Cancel edit"
                              className="p-1.5 rounded-md text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800 cursor-pointer disabled:opacity-50"
                            >
                              <X className="size-3.5" />
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              onClick={() => startEditLead(l)}
                              title="Edit lead"
                              aria-label="Edit lead"
                              className="p-1.5 rounded-md text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 cursor-pointer"
                            >
                              <Pencil className="size-3.5" />
                            </button>
                            <button
                              onClick={() => deleteLead(l)}
                              title="Delete lead"
                              aria-label="Delete lead"
                              className="p-1.5 rounded-md text-neutral-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 cursor-pointer"
                            >
                              <Trash2 className="size-3.5" />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}

              {/* Empty State */}
              {filteredLeads.length === 0 && (
                <tr>
                  <td colSpan={leadFields.length + 2} className="px-6 py-12 text-center space-y-2">
                    <Users className="size-8 mx-auto text-neutral-300" />
                    <h5 className="text-xs font-bold text-neutral-700 dark:text-neutral-300">No matching leads found</h5>
                    <p className="text-[10px] text-neutral-400 max-w-xs mx-auto leading-normal">
                      {leads.length === 0
                        ? "Start conversation tests in the Playground to see captured contact details show up in this panel."
                        : "Try clearing your search query or search for other parameters."}
                    </p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
