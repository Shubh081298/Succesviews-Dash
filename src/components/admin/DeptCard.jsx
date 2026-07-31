import { useState } from "react";
import { Building2, ClipboardCheck, Clock, FileText, IndianRupee, Puzzle, Megaphone, Pencil, X, Plus, ChevronDown } from "lucide-react";
import { FIELD_TYPES } from "../../utils/constants.js";
import { sum } from "../../utils/helpers.js";

/**
 * DeptCard — one premium card per department on the Departments tab.
 * Colored accent (per-department), KPI mini-tiles, a pending-employees
 * warning, and collapsible DSR-field + announcement managers.
 * Owns its own local UI state so multiple instances never collide.
 */
export default function DeptCard({
  dept, accent = "#3B82F6", deptEmps, deptSubmittedNames, deptPendingNames, deptFiltered,
  customFields, onAddField, onEditField, onRemoveField,
  announcements, onPublishAnnouncement, onDeleteAnnouncement,
}) {
  const [cfLabel, setCfLabel] = useState("");
  const [cfType, setCfType] = useState("text");
  const [cfRequired, setCfRequired] = useState(false);
  const [annText, setAnnText] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [editLabel, setEditLabel] = useState("");
  const [open, setOpen] = useState(false);

  const submitField = () => { if (!cfLabel.trim()) return; onAddField(cfLabel, cfType, cfRequired); setCfLabel(""); setCfRequired(false); };
  const submitAnn = () => { if (!annText.trim()) return; onPublishAnnouncement(annText); setAnnText(""); };
  const startEdit = (f) => { setEditingId(f.id); setEditLabel(f.label); };
  const saveEdit = (f) => { if (editLabel.trim()) onEditField(f.id, editLabel.trim()); setEditingId(null); };

  const allIn = deptEmps.length > 0 && deptSubmittedNames.length === deptEmps.length;
  const initials = (dept || "?").slice(0, 2).toUpperCase();

  const Stat = ({ icon, label, value, color }) => (
    <div className="sv-dept-stat">
      <span className="sv-dept-stat-ic" style={{ background: `${color}1A`, color }}>{icon}</span>
      <div><div className="sv-dept-stat-v">{value}</div><div className="sv-dept-stat-l">{label}</div></div>
    </div>
  );

  return (
    <div className="sv-dept-card" style={{ "--dc": accent }}>
      <div className="sv-dept-card-top">
        <span className="sv-dept-badge" style={{ background: accent }}>{initials}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p className="sv-text-navy sv-font-800" style={{ margin: 0, fontSize: 15.5 }}>{dept}</p>
          <p className="sv-text-muted" style={{ margin: 0, fontSize: 11.5 }}>{deptEmps.length} employee{deptEmps.length !== 1 ? "s" : ""}</p>
        </div>
        <Building2 size={18} style={{ color: accent, opacity: .5 }} />
      </div>

      <div className="sv-dept-stats">
        <Stat icon={<ClipboardCheck size={15} />} label="Submitted today" value={`${deptSubmittedNames.length}/${deptEmps.length}`} color={allIn ? "#22C55E" : "#F97316"} />
        <Stat icon={<Clock size={15} />} label="Pending today" value={deptPendingNames.length} color="#F59E0B" />
        <Stat icon={<FileText size={15} />} label="Records (period)" value={deptFiltered.length} color="#3B82F6" />
        <Stat icon={<IndianRupee size={15} />} label="Sales (period)" value={"₹" + Number(sum(deptFiltered, "salesGenerated") || 0).toLocaleString("en-IN")} color="#22C55E" />
      </div>

      {deptPendingNames.length > 0 && (
        <div className="sv-dept-pending">⏳ Pending: {deptPendingNames.map((e) => e.name).join(", ")}</div>
      )}
      {deptEmps.length === 0 && <p className="sv-text-muted" style={{ fontSize: 12.5, margin: "0 0 4px" }}>No employees in this department yet.</p>}

      <button className="sv-dept-toggle" onClick={() => setOpen(!open)}>
        <span>Form fields &amp; announcements</span>
        <ChevronDown size={16} style={{ transform: open ? "rotate(180deg)" : "none", transition: "transform .2s" }} />
      </button>

      {open && (
        <div className="sv-dept-manage">
          <div>
            <p className="sv-dept-sub"><Puzzle size={13} /> DSR Form Fields</p>
            <p className="sv-text-muted" style={{ margin: "0 0 10px", fontSize: 11 }}>Custom fields for {dept}'s Daily Status Report.</p>
            <div style={{ display: "grid", gap: 6, marginBottom: 8 }}>
              <input className="sv-input" placeholder="Field label…" value={cfLabel} onChange={(e) => setCfLabel(e.target.value)} style={{ padding: "7px 10px", fontSize: 12.5 }} />
              <div className="sv-flex sv-gap-2">
                <select className="sv-select" value={cfType} onChange={(e) => setCfType(e.target.value)} style={{ flex: 1, padding: "7px 10px", fontSize: 12.5 }}>
                  {FIELD_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
                <label style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11.5, color: "var(--sv-text-2,#374151)", whiteSpace: "nowrap" }}>
                  <input type="checkbox" checked={cfRequired} onChange={(e) => setCfRequired(e.target.checked)} /> Required
                </label>
              </div>
              <button className="sv-btn sv-btn--primary" onClick={submitField} style={{ fontSize: 12, padding: "7px 12px" }}><Plus size={13} /> Add Field</button>
            </div>
            <div className="sv-flex-col sv-gap-2">
              {customFields.length === 0 && <p className="sv-text-muted" style={{ fontSize: 11.5, margin: 0 }}>No custom fields yet.</p>}
              {customFields.map((f) => (
                <div key={f.id} className="sv-dept-field">
                  {editingId === f.id ? (
                    <div className="sv-flex sv-gap-2">
                      <input className="sv-input" value={editLabel} onChange={(e) => setEditLabel(e.target.value)} style={{ flex: 1, padding: "4px 8px", fontSize: 12 }} autoFocus />
                      <button className="sv-btn sv-btn--primary sv-btn--sm" onClick={() => saveEdit(f)}>Save</button>
                      <button className="sv-icon-btn" onClick={() => setEditingId(null)}><X size={13} /></button>
                    </div>
                  ) : (
                    <div className="sv-flex sv-justify-between sv-items-center">
                      <span className="sv-text-navy sv-font-600" style={{ fontSize: 11.5 }}>{f.label} <span style={{ color: "#94A3B8", fontWeight: 400 }}>({f.type}{f.required ? ", required" : ""})</span></span>
                      <div className="sv-flex sv-gap-2">
                        <button className="sv-icon-btn sv-icon-btn--edit" onClick={() => startEdit(f)}><Pencil size={12} /></button>
                        <button className="sv-icon-btn sv-icon-btn--del" onClick={() => onRemoveField(f.id)}><X size={12} /></button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div>
            <p className="sv-dept-sub"><Megaphone size={13} /> Announcements</p>
            <p className="sv-text-muted" style={{ margin: "0 0 10px", fontSize: 11 }}>Visible only to {dept} employees.</p>
            <textarea className="sv-textarea" rows={2} placeholder='e.g. "Tomorrow is a holiday!"' value={annText} onChange={(e) => setAnnText(e.target.value)} style={{ marginBottom: 8, fontSize: 12.5 }} />
            <button className="sv-btn sv-btn--full sv-btn--primary" onClick={submitAnn} style={{ fontSize: 12, marginBottom: 10 }}><Megaphone size={13} /> Publish to {dept}</button>
            <div className="sv-flex-col sv-gap-2" style={{ maxHeight: 160, overflowY: "auto" }}>
              {announcements.length === 0 && <p className="sv-text-muted" style={{ fontSize: 11.5, margin: 0 }}>No announcements.</p>}
              {announcements.map((a) => (
                <div key={a.id} className="sv-dept-ann">
                  <span style={{ fontSize: 11.5, fontWeight: 700, color: "#DC2626" }}>{a.text}</span>
                  <button className="sv-icon-btn sv-icon-btn--del" onClick={() => onDeleteAnnouncement(a.id)}><X size={12} /></button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
