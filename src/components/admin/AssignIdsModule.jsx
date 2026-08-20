import { useState, useMemo } from "react";
import { Mail, Plus, Pencil, Trash2, Search, X } from "lucide-react";
import Avatar from "../ui/Avatar.jsx";
import { normAssignedId, fmtDate } from "../../utils/helpers.js";
import { PALETTES } from "./ManagerAssignModule.jsx";

/**
 * AssignIdsModule — Admin "Mail IDs Assign".
 *
 * UI/UX only. Ownership split unchanged:
 *   • ADMIN adds / edits / removes the mail ID (via assignEmployeeIds).
 *   • EMPLOYEE fills Project + Start date from their "Assigned IDs" tab.
 * v2: one row per employee, all their mail IDs grouped underneath, coloured
 * left border by team, Search + Add Mail ID only (no filters, no Primary tag).
 */
const PER_PAGE = 6;

export default function AssignIdsModule({ employees, assignEmployeeIds, teamMeta = {}, showToast }) {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [addOpen, setAddOpen] = useState(false);
  const [addEmp, setAddEmp] = useState("");
  const [addId, setAddId] = useState("");
  const [editing, setEditing] = useState(null); // { empId, oldId }
  const [editVal, setEditVal] = useState("");
  const [confirm, setConfirm] = useState(null); // { message, onYes }

  // Active roster only — terminated employees drop out of ID assignment.
  const activeEmployees = employees.filter((e) => e.status !== "terminated");

  // One entry per employee that has at least one mail ID.
  const groups = useMemo(() => activeEmployees
    .map((emp) => ({ emp, ids: (emp.assignedIds || []).map(normAssignedId) }))
    .filter((g) => g.ids.length > 0), [employees]);

  const teamColor = (team) => {
    if (!team) return "#CBD5E1";
    const c = teamMeta[team]?.color;
    return (PALETTES[c % PALETTES.length] || {}).border || "#3B82F6";
  };

  const filtered = groups.filter(({ emp, ids }) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return [emp.name, emp.teamLead, ...ids.map((r) => r.id), ...ids.map((r) => r.project)]
      .some((v) => (v || "").toLowerCase().includes(q));
  });

  const pageCount = Math.max(1, Math.ceil(filtered.length / PER_PAGE));
  const safePage = Math.min(page, pageCount);
  const pageRows = filtered.slice((safePage - 1) * PER_PAGE, safePage * PER_PAGE);

  const addMailId = () => {
    const v = addId.trim();
    if (!addEmp || !v) return;
    const emp = employees.find((e) => e.id === addEmp);
    const list = (emp.assignedIds || []).map(normAssignedId);
    if (list.some((r) => r.id === v)) { showToast?.("That ID is already assigned.", "error"); return; }
    assignEmployeeIds(addEmp, [...list, { id: v, project: "", startDate: "" }]);
    setAddEmp(""); setAddId(""); setAddOpen(false);
    showToast?.("Mail ID assigned.");
  };
  const saveEdit = () => {
    const v = editVal.trim();
    if (!editing || !v) { setEditing(null); return; }
    const emp = employees.find((e) => e.id === editing.empId);
    const list = (emp.assignedIds || []).map(normAssignedId).map((r) => (r.id === editing.oldId ? { ...r, id: v } : r));
    assignEmployeeIds(editing.empId, list);
    setEditing(null); setEditVal("");
    showToast?.("Mail ID updated.");
  };
  const doRemoveMailId = (empId, mailId) => {
    const emp = employees.find((e) => e.id === empId);
    const list = (emp.assignedIds || []).map(normAssignedId).filter((r) => r.id !== mailId);
    assignEmployeeIds(empId, list);
    showToast?.("Mail ID removed.");
  };
  const askRemoveMailId = (empId, mailId) => setConfirm({ message: `Remove mail ID "${mailId}"?`, onYes: () => doRemoveMailId(empId, mailId) });

  return (
    <div className="sv-card sv-mailids">
      <div className="sv-mailids-top">
        <div className="sv-flex sv-items-center sv-gap-2">
          <span className="sv-mod-icon"><Mail size={16} /></span>
          <div>
            <p className="sv-text-navy sv-font-800" style={{ margin: 0, fontSize: 16 }}>Mail IDs Assign</p>
            <p className="sv-text-muted" style={{ margin: 0, fontSize: 12 }}>Manage employee mail IDs and their project assignments</p>
          </div>
        </div>
        <div className="sv-mailids-filters">
          <div className="sv-mailids-search">
            <Search size={14} />
            <input placeholder="Search employee, mail ID, project…" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
          </div>
          <button className="sv-btn sv-btn--primary sv-btn--sm" onClick={() => setAddOpen(true)}><Plus size={14} /> Add Mail ID</button>
        </div>
      </div>

      <div className="sv-empgroups">
        {pageRows.length === 0 && <div className="sv-mailids-empty" style={{ padding: "30px 0" }}>No mail IDs found.</div>}
        {pageRows.map(({ emp, ids }, i) => (
          <div key={emp.id} className="sv-empgroup" style={{ borderLeftColor: teamColor(emp.teamLead) }}>
            <div className="sv-empgroup-person">
              <Avatar emp={emp} idx={i} size={38} />
              <div style={{ minWidth: 0 }}>
                <div className="sv-text-navy sv-font-700" style={{ fontSize: 14 }}>{emp.name}</div>
                <div className="sv-text-muted" style={{ fontSize: 11.5 }}>{emp.department || "Sales"}</div>
                <div className="sv-empgroup-meta">
                  {emp.teamLead ? <span className="sv-team-pill"><span className="sv-team-pill-dot" style={{ background: teamColor(emp.teamLead) }} />{emp.teamLead}</span> : <span className="sv-mailids-muted">No team</span>}
                  <span className={`sv-team-badge sv-team-badge--${emp.teamLead ? "active" : "pending"}`}><span className="sv-team-badge-dot" />{emp.teamLead ? "Active" : "Pending"}</span>
                </div>
              </div>
            </div>

            <div className="sv-empgroup-ids">
              {ids.map((r) => (
                <div key={r.id} className="sv-idline">
                  {editing && editing.empId === emp.id && editing.oldId === r.id ? (
                    <input className="sv-input sv-idline-edit" value={editVal} autoFocus
                      onChange={(e) => setEditVal(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") saveEdit(); if (e.key === "Escape") setEditing(null); }}
                      onBlur={saveEdit} />
                  ) : (
                    <span className="sv-mail-chip">{r.id}</span>
                  )}
                  <span className="sv-idline-proj">{r.project ? r.project : <span className="sv-mailids-muted">No project set</span>}</span>
                  <span className="sv-idline-date">{r.startDate ? fmtDate(r.startDate) : <span className="sv-mailids-muted">No start date</span>}</span>
                  <span className="sv-idline-actions">
                    <button className="sv-icon-btn sv-icon-btn--edit" title="Edit mail ID" onClick={() => { setEditing({ empId: emp.id, oldId: r.id }); setEditVal(r.id); }}><Pencil size={13} /></button>
                    <button className="sv-icon-btn sv-icon-btn--del" title="Remove mail ID" onClick={() => askRemoveMailId(emp.id, r.id)}><Trash2 size={13} /></button>
                  </span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="sv-mailids-footer">
        <span className="sv-text-muted" style={{ fontSize: 12 }}>
          {filtered.length === 0 ? "No employees" : `Showing ${(safePage - 1) * PER_PAGE + 1}–${Math.min(safePage * PER_PAGE, filtered.length)} of ${filtered.length} employees`}
        </span>
        {pageCount > 1 && (
          <div className="sv-pager">
            <button className="sv-pager-btn" disabled={safePage === 1} onClick={() => setPage(safePage - 1)}>‹</button>
            {Array.from({ length: pageCount }, (_, i) => i + 1).map((n) => (
              <button key={n} className={`sv-pager-btn${n === safePage ? " sv-pager-btn--active" : ""}`} onClick={() => setPage(n)}>{n}</button>
            ))}
            <button className="sv-pager-btn" disabled={safePage === pageCount} onClick={() => setPage(safePage + 1)}>›</button>
          </div>
        )}
      </div>

      {addOpen && (
        <div className="sv-modal-overlay" onClick={() => setAddOpen(false)}>
          <div className="sv-modal" style={{ maxWidth: 440 }} onClick={(e) => e.stopPropagation()}>
            <div className="sv-modal-header">
              <p className="sv-text-navy sv-font-800" style={{ margin: 0, fontSize: 16 }}>Add Mail ID</p>
              <button className="sv-modal-close" onClick={() => setAddOpen(false)}><X size={18} /></button>
            </div>
            <div style={{ padding: "16px 20px", display: "flex", flexDirection: "column", gap: 12 }}>
              <label className="sv-team-ctl">
                <span>Employee</span>
                <select className="sv-select" value={addEmp} onChange={(e) => setAddEmp(e.target.value)}>
                  <option value="">Select employee…</option>
                  {activeEmployees.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
                </select>
              </label>
              <label className="sv-team-ctl">
                <span>Mail ID</span>
                <input className="sv-input" placeholder="name@domain.com" value={addId}
                  onChange={(e) => setAddId(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") addMailId(); }} />
              </label>
              <p className="sv-text-muted" style={{ margin: 0, fontSize: 11.5 }}>The employee adds the project name and start date from their Assigned IDs tab.</p>
            </div>
            <div className="sv-modal-footer" style={{ display: "flex", justifyContent: "flex-end", gap: 8, padding: "12px 20px" }}>
              <button className="sv-btn sv-btn--outline" onClick={() => setAddOpen(false)}>Cancel</button>
              <button className="sv-btn sv-btn--primary" onClick={addMailId} disabled={!addEmp || !addId.trim()}>Add Mail ID</button>
            </div>
          </div>
        </div>
      )}

      {confirm && (
        <div className="sv-modal-overlay" onClick={() => setConfirm(null)}>
          <div className="sv-modal sv-confirm" onClick={(e) => e.stopPropagation()}>
            <p className="sv-confirm-msg">{confirm.message}</p>
            <p className="sv-confirm-sub">Do you want to proceed?</p>
            <div className="sv-confirm-actions">
              <button className="sv-btn sv-btn--outline" onClick={() => setConfirm(null)}>No</button>
              <button className="sv-btn sv-btn--primary sv-btn--danger-solid" onClick={() => { const fn = confirm.onYes; setConfirm(null); fn?.(); }}>Yes</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
