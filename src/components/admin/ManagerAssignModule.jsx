import { useState, useMemo } from "react";
import { Users, ChevronDown, Plus, Pencil, Trash2, X, UserMinus } from "lucide-react";
import Avatar from "../ui/Avatar.jsx";
import { storageSet } from "../../utils/storage.js";
import { empLabel } from "../../utils/helpers.js";

/**
 * ManagerAssignModule — Admin "Manager Assignment" as premium team cards.
 *
 * UI/UX only. Assignment logic unchanged (employees[i].teamLead via storageSet).
 * Per-team target / status / colour live in the settings-backed `teamMeta` map.
 * Completion % is DERIVED live: this month's DSR sales for the team's members
 * (sum of submission.salesGenerated) ÷ the team's Target, capped at 100%.
 */
export const PALETTES = [
  { key: 0, header: "#EAF4FF", border: "#3B82F6", avatar: "#3B82F6" },
  { key: 1, header: "#EFFFF2", border: "#22C55E", avatar: "#22C55E" },
  { key: 2, header: "#F4EDFF", border: "#8B5CF6", avatar: "#8B5CF6" },
  { key: 3, header: "#FFF4E8", border: "#F59E0B", avatar: "#F59E0B" },
  { key: 4, header: "#FFEDF2", border: "#EC4899", avatar: "#EC4899" },
  { key: 5, header: "#E9FBFA", border: "#14B8A6", avatar: "#14B8A6" },
];
const STATUS_META = {
  Active:   { cls: "active",   label: "Active" },
  Pending:  { cls: "pending",  label: "Pending" },
  Inactive: { cls: "inactive", label: "Inactive" },
};
const fmtMoney = (n) => "₹" + Number(n || 0).toLocaleString("en-IN");

export default function ManagerAssignModule({ employees, setEmployees, showToast, editMode = false, teamMeta = {}, saveTeamMeta, targets = {}, submissions = [] }) {
  const [expanded, setExpanded] = useState(null);
  const [editingTeam, setEditingTeam] = useState(null);
  const [form, setForm] = useState({ lead: "", target: 0, color: 0, status: "Active" });
  const [adding, setAdding] = useState(false);
  const [newLead, setNewLead] = useState("");
  const [confirm, setConfirm] = useState(null); // { message, onYes }

  const defaultTarget = Number(targets?.salesGenerated || 0);
  const monthPrefix = new Date().toISOString().slice(0, 7); // YYYY-MM

  // Month-to-date DSR sales per employee id.
  const salesByEmp = useMemo(() => {
    const m = {};
    submissions.forEach((s) => {
      if (!s.date || !String(s.date).startsWith(monthPrefix)) return;
      m[s.empId] = (m[s.empId] || 0) + (Number(s.salesGenerated) || 0);
    });
    return m;
  }, [submissions, monthPrefix]);

  const leadNames = [...new Set([
    ...employees.map((e) => e.teamLead).filter(Boolean),
    ...Object.keys(teamMeta || {}),
  ])];
  const grouped = leadNames.map((lead) => ({ lead, members: employees.filter((e) => e.teamLead === lead) }));

  const persist = async (list) => { setEmployees(list); await storageSet("svd_emps", JSON.stringify(list)); };
  const assign = async (empId, lead) => {
    await persist(employees.map((e) => (e.id === empId ? { ...e, teamLead: lead } : e)));
    showToast?.(lead ? `Assigned to ${lead}` : "Removed from team");
  };
  const metaFor = (lead, idx = 0) => ({ target: defaultTarget, status: "Active", color: idx % PALETTES.length, ...(teamMeta[lead] || {}) });

  const teamSales = (members) => members.reduce((a, m) => a + (salesByEmp[m.id] || 0), 0);
  const completionOf = (members, target) => {
    const t = Number(target) || 0;
    if (t <= 0) return 0;
    return Math.min(100, Math.round((teamSales(members) / t) * 100));
  };

  const createTeam = () => {
    const lead = newLead.trim();
    if (!lead) return;
    if (!teamMeta[lead]) saveTeamMeta?.({ ...teamMeta, [lead]: { target: defaultTarget, status: "Pending", color: leadNames.length % PALETTES.length } });
    setNewLead(""); setAdding(false); setExpanded(lead);
    showToast?.(`Team "${lead}" created`);
  };

  const openEdit = (lead, idx) => {
    const m = metaFor(lead, idx);
    setForm({ lead, target: m.target, color: m.color, status: m.status });
    setEditingTeam(lead);
  };
  const saveEdit = async () => {
    const old = editingTeam;
    const next = (form.lead || "").trim() || old;
    if (next !== old) await persist(employees.map((e) => (e.teamLead === old ? { ...e, teamLead: next } : e)));
    const nm = { ...teamMeta };
    if (next !== old) delete nm[old];
    nm[next] = { target: Number(form.target) || 0, status: form.status, color: form.color };
    saveTeamMeta?.(nm);
    setEditingTeam(null);
    showToast?.("Team updated");
  };
  const doDeleteTeam = async (lead) => {
    await persist(employees.map((e) => (e.teamLead === lead ? { ...e, teamLead: "" } : e)));
    const nm = { ...teamMeta }; delete nm[lead]; saveTeamMeta?.(nm);
    if (expanded === lead) setExpanded(null);
    showToast?.(`Team "${lead}" deleted`);
  };

  const askDeleteTeam = (lead) => setConfirm({ message: `Delete team "${lead}"? Its members will no longer belong to a team.`, onYes: () => doDeleteTeam(lead) });
  const askRemoveMember = (m, lead) => setConfirm({ message: `Remove ${m.name} from team "${lead}"?`, onYes: () => assign(m.id, "") });

  if (employees.length === 0) {
    return (
      <div className="sv-card">
        <p className="sv-text-muted" style={{ fontSize: 13, textAlign: "center", padding: "24px 0" }}>No employees yet. Add employees in Settings first.</p>
      </div>
    );
  }

  const TeamCard = ({ lead, members, idx }) => {
    const meta = metaFor(lead, idx);
    const pal = PALETTES[meta.color % PALETTES.length] || PALETTES[0];
    const st = STATUS_META[meta.status] || STATUS_META.Active;
    const leadEmp = employees.find((e) => e.name === lead);
    const isOpen = expanded === lead;
    const completion = completionOf(members, meta.target);
    return (
      <div className="sv-team-card" style={{ borderColor: pal.border }}>
        <div className="sv-team-card-head" style={{ background: pal.header }}>
          <div className="sv-team-avatar" style={{ background: pal.avatar }}>
            {leadEmp?.photo ? <img src={leadEmp.photo} alt="" /> : <span>{(lead || "?").slice(0, 2).toUpperCase()}</span>}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="sv-team-name" title={lead}>{lead}</div>
            <div className="sv-team-count">{members.length} Member{members.length !== 1 ? "s" : ""} · <span className={`sv-team-badge sv-team-badge--${st.cls}`} style={{ padding: "1px 8px", fontSize: 10.5 }}><span className="sv-team-badge-dot" />{st.label}</span></div>
          </div>
          <div className="sv-team-head-actions">
            <button className="sv-team-icon" title="Edit team" onClick={() => openEdit(lead, idx)}><Pencil size={14} /></button>
            <button className="sv-team-icon sv-team-icon--del" title="Delete team" onClick={() => askDeleteTeam(lead)}><Trash2 size={14} /></button>
            <button className="sv-team-expand" onClick={() => setExpanded(isOpen ? null : lead)} aria-label="Expand team">
              <ChevronDown size={18} style={{ transform: isOpen ? "rotate(180deg)" : "none", transition: "transform .2s" }} />
            </button>
          </div>
        </div>

        <div className="sv-team-body">
          {members.length === 0 && <div className="sv-team-empty">No members yet — expand to add.</div>}
          {members.map((m, i) => (
            <div key={m.id} className="sv-team-member">
              <Avatar emp={m} idx={i} size={30} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="sv-team-member-name">{empLabel(m)}</div>
                <div className="sv-team-member-dept">{m.department || "Sales"}</div>
              </div>
              {isOpen && (
                <button className="sv-team-icon sv-team-icon--del" title="Remove from team" onClick={() => askRemoveMember(m, lead)}><UserMinus size={14} /></button>
              )}
            </div>
          ))}

          {isOpen && (
            <label className="sv-team-ctl" style={{ marginTop: 4 }}>
              <span>Add member</span>
              <select className="sv-select" value="" onChange={(e) => e.target.value && assign(e.target.value, lead)}>
                <option value="">Select employee…</option>
                {employees.filter((e) => e.teamLead !== lead && e.name !== lead).map((e) => <option key={e.id} value={e.id}>{e.name}{e.teamLead ? ` (in ${e.teamLead})` : ""}</option>)}
              </select>
            </label>
          )}
        </div>

        <div className="sv-team-foot">
          <div className="sv-team-stat"><span className="sv-team-stat-k">Active</span><span className="sv-team-stat-v">{members.length}</span></div>
          <div className="sv-team-stat"><span className="sv-team-stat-k">Target</span><span className="sv-team-stat-v">{fmtMoney(meta.target)}</span></div>
          <div className="sv-team-stat sv-team-stat--prog">
            <span className="sv-team-stat-k" title="This month's DSR sales ÷ Target">Completion</span>
            <span className="sv-team-stat-v">{completion}%</span>
            <span className="sv-team-prog"><span className="sv-team-prog-bar" style={{ width: `${completion}%`, background: pal.avatar }} /></span>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="sv-flex-col sv-gap-4">
      <div className="sv-card sv-manager-head">
        <div className="sv-flex sv-items-center sv-gap-2">
          <span className="sv-mod-icon"><Users size={16} /></span>
          <div>
            <p className="sv-text-navy sv-font-800" style={{ margin: 0, fontSize: 16 }}>Manager Assignment</p>
            <p className="sv-text-muted" style={{ margin: 0, fontSize: 12 }}>Teams and their members</p>
          </div>
        </div>
        {adding ? (
          <div className="sv-flex sv-items-center sv-gap-2">
            <select className="sv-select" value={newLead} onChange={(e) => setNewLead(e.target.value)} style={{ minWidth: 160 }}>
              <option value="">Pick team lead…</option>
              {employees.map((e) => <option key={e.id} value={e.name}>{e.name}</option>)}
            </select>
            <button className="sv-btn sv-btn--primary sv-btn--sm" onClick={createTeam} disabled={!newLead}>Create</button>
            <button className="sv-btn sv-btn--outline sv-btn--sm" onClick={() => { setAdding(false); setNewLead(""); }}>Cancel</button>
          </div>
        ) : (
          <button className="sv-btn sv-btn--primary sv-btn--sm" onClick={() => setAdding(true)}><Plus size={14} /> Add Team</button>
        )}
      </div>

      <div className="sv-team-grid">
        {grouped.map(({ lead, members }, i) => <TeamCard key={lead} lead={lead} members={members} idx={i} />)}
      </div>

      {editingTeam && (
        <div className="sv-modal-overlay" onClick={() => setEditingTeam(null)}>
          <div className="sv-modal" style={{ maxWidth: 440 }} onClick={(e) => e.stopPropagation()}>
            <div className="sv-modal-header">
              <p className="sv-text-navy sv-font-800" style={{ margin: 0, fontSize: 16 }}>Edit Team</p>
              <button className="sv-modal-close" onClick={() => setEditingTeam(null)}><X size={18} /></button>
            </div>
            <div style={{ padding: "16px 20px", display: "flex", flexDirection: "column", gap: 12 }}>
              <label className="sv-team-ctl">
                <span>Team lead (rename)</span>
                <select className="sv-select" value={form.lead} onChange={(e) => setForm({ ...form, lead: e.target.value })}>
                  {[...new Set([form.lead, ...employees.map((e) => e.name)])].filter(Boolean).map((n) => <option key={n} value={n}>{n}</option>)}
                </select>
              </label>
              <div className="sv-team-ctl-row">
                <label className="sv-team-ctl">
                  <span>Target (₹)</span>
                  <input type="number" className="sv-input" value={form.target} onChange={(e) => setForm({ ...form, target: e.target.value })} />
                </label>
                <label className="sv-team-ctl">
                  <span>Status</span>
                  <select className="sv-select" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                    <option>Active</option><option>Pending</option><option>Inactive</option>
                  </select>
                </label>
              </div>
              <label className="sv-team-ctl">
                <span>Colour</span>
                <div className="sv-swatches">
                  {PALETTES.map((p) => (
                    <button key={p.key} type="button" className={`sv-swatch${form.color === p.key ? " sv-swatch--on" : ""}`} style={{ background: p.avatar }} onClick={() => setForm({ ...form, color: p.key })} aria-label={`Colour ${p.key + 1}`} />
                  ))}
                </div>
              </label>
              <p className="sv-text-muted" style={{ margin: 0, fontSize: 11.5 }}>Completion % is calculated automatically from this month's DSR sales vs the Target.</p>
            </div>
            <div className="sv-modal-footer" style={{ display: "flex", justifyContent: "space-between", gap: 8, padding: "12px 20px" }}>
              <button className="sv-btn sv-btn--outline sv-btn--danger" onClick={() => { const l = editingTeam; setEditingTeam(null); askDeleteTeam(l); }}>Delete Team</button>
              <div className="sv-flex sv-gap-2">
                <button className="sv-btn sv-btn--outline" onClick={() => setEditingTeam(null)}>Cancel</button>
                <button className="sv-btn sv-btn--primary" onClick={saveEdit}>Save</button>
              </div>
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
