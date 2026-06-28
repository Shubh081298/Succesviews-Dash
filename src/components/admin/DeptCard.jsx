import { useState } from "react";
import { KPI } from "../ui/index.js";
import { FIELD_TYPES, AMBER, BLUE, GREEN, RED } from "../../utils/constants.js";
import { sum } from "../../utils/helpers.js";

/**
 * DeptCard — one card per department on the Departments tab.
 * Owns its own local UI state (the field-builder and announcement
 * composer inputs) so multiple DeptCard instances never collide.
 * Renders: department KPIs, a pending-employees warning, a DSR
 * custom-field manager, and a single-department announcement composer.
 */
export default function DeptCard({
  dept, deptEmps, deptSubmittedNames, deptPendingNames, deptFiltered,
  customFields, onAddField, onEditField, onRemoveField,
  announcements, onPublishAnnouncement, onDeleteAnnouncement,
}) {
  const [cfLabel, setCfLabel] = useState("");
  const [cfType, setCfType] = useState("text");
  const [cfRequired, setCfRequired] = useState(false);
  const [annText, setAnnText] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [editLabel, setEditLabel] = useState("");

  const submitField = () => {
    if (!cfLabel.trim()) return;
    onAddField(cfLabel, cfType, cfRequired);
    setCfLabel(""); setCfRequired(false);
  };
  const submitAnn = () => {
    if (!annText.trim()) return;
    onPublishAnnouncement(annText);
    setAnnText("");
  };
  const startEdit = (f) => { setEditingId(f.id); setEditLabel(f.label); };
  const saveEdit = (f) => { if (editLabel.trim()) onEditField(f.id, editLabel.trim()); setEditingId(null); };

  return (
    <div className="sv-card">
      <div className="sv-flex sv-justify-between sv-items-center" style={{ marginBottom: 12, flexWrap: "wrap", gap: 8 }}>
        <p className="sv-text-navy sv-font-800" style={{ margin: 0, fontSize: 16 }}>🏢 {dept} Department</p>
        <span style={{ fontSize: 12.5, color: "#64748B" }}>{deptEmps.length} employee(s)</span>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(150px,1fr))", gap: 10, marginBottom: 12 }}>
        <KPI label="Submitted Today" value={`${deptSubmittedNames.length}/${deptEmps.length}`} icon="✅" color={deptSubmittedNames.length === deptEmps.length && deptEmps.length > 0 ? "#22C55E" : "#F97316"} />
        <KPI label="Pending Today" value={deptPendingNames.length} icon="⏳" color={AMBER} />
        <KPI label="Records (Period)" value={deptFiltered.length} icon="📋" color={BLUE} />
        <KPI label="Sales (Period)" value={sum(deptFiltered, "salesGenerated")} prefix="₹" icon="💰" color={GREEN} />
      </div>

      {deptPendingNames.length > 0 && (
        <div style={{ padding: "8px 10px", background: "#FFF1F2", border: "1.5px solid #FEE2E2", borderRadius: 8, fontSize: 12, color: "#DC2626", fontWeight: 600, marginBottom: 12 }}>
          ⚠️ Pending: {deptPendingNames.map((e) => e.name).join(", ")}
        </div>
      )}
      {deptEmps.length === 0 && <p className="sv-text-muted" style={{ fontSize: 13, margin: "0 0 12px" }}>No employees in this department yet.</p>}

      <div className="sv-grid-2" style={{ marginTop: 4, paddingTop: 14, borderTop: "1.5px dashed #E2E8F0" }}>
        {/* DSR custom fields */}
        <div>
          <p className="sv-text-navy sv-font-700" style={{ margin: "0 0 4px", fontSize: 13.5 }}>🧩 DSR Form Fields</p>
          <p className="sv-text-muted" style={{ margin: "0 0 10px", fontSize: 11.5 }}>Custom fields for {dept}'s Daily Status Report.</p>
          <div style={{ display: "grid", gap: 6, marginBottom: 8 }}>
            <input className="sv-input" placeholder="Field label…" value={cfLabel} onChange={(e) => setCfLabel(e.target.value)} style={{ padding: "7px 10px", fontSize: 12.5 }} />
            <div className="sv-flex sv-gap-2">
              <select className="sv-select" value={cfType} onChange={(e) => setCfType(e.target.value)} style={{ flex: 1, padding: "7px 10px", fontSize: 12.5 }}>
                {FIELD_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
              <label style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11.5, color: "#374151", whiteSpace: "nowrap" }}>
                <input type="checkbox" checked={cfRequired} onChange={(e) => setCfRequired(e.target.checked)} /> Required
              </label>
            </div>
            <button className="sv-btn sv-btn--primary" onClick={submitField} style={{ fontSize: 12, padding: "7px 12px" }}>+ Add Field</button>
          </div>
          <div className="sv-flex-col sv-gap-2">
            {customFields.length === 0 && <p className="sv-text-muted" style={{ fontSize: 11.5, margin: 0 }}>No custom fields yet.</p>}
            {customFields.map((f) => (
              <div key={f.id} style={{ padding: "6px 9px", background: "#F8FAFC", border: "1.5px solid #E2E8F0", borderRadius: 7 }}>
                {editingId === f.id ? (
                  <div className="sv-flex sv-gap-2">
                    <input className="sv-input" value={editLabel} onChange={(e) => setEditLabel(e.target.value)} style={{ flex: 1, padding: "4px 8px", fontSize: 12 }} autoFocus />
                    <button onClick={() => saveEdit(f)} style={{ padding: "4px 8px", background: "#5F9E30", color: "#fff", border: "none", borderRadius: 5, cursor: "pointer", fontSize: 11, fontWeight: 700 }}>Save</button>
                    <button onClick={() => setEditingId(null)} style={{ padding: "4px 8px", background: "#F1F5F9", color: "#64748B", border: "none", borderRadius: 5, cursor: "pointer", fontSize: 11, fontWeight: 700 }}>×</button>
                  </div>
                ) : (
                  <div className="sv-flex sv-justify-between sv-items-center">
                    <span className="sv-text-navy sv-font-600" style={{ fontSize: 11.5 }}>
                      {f.label} <span style={{ color: "#94A3B8", fontWeight: 400 }}>({f.type}{f.required ? ", required" : ""})</span>
                    </span>
                    <div className="sv-flex sv-gap-2">
                      <button onClick={() => startEdit(f)} style={{ border: "none", background: "transparent", color: BLUE, cursor: "pointer", fontSize: 12 }}>✏️</button>
                      <button onClick={() => onRemoveField(f.id)} style={{ border: "none", background: "transparent", color: RED, cursor: "pointer", fontWeight: 700, fontSize: 13 }}>×</button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Single-department announcement composer */}
        <div>
          <p className="sv-text-navy sv-font-700" style={{ margin: "0 0 4px", fontSize: 13.5 }}>📢 Announcements</p>
          <p className="sv-text-muted" style={{ margin: "0 0 10px", fontSize: 11.5 }}>Visible only to {dept} employees.</p>
          <textarea className="sv-textarea" rows={2} placeholder='e.g. "Tomorrow is a holiday!"' value={annText} onChange={(e) => setAnnText(e.target.value)} style={{ marginBottom: 8, fontSize: 12.5 }} />
          <button className="sv-btn sv-btn--full" onClick={submitAnn} style={{ background: RED, color: "#fff", fontSize: 12, marginBottom: 10 }}>📢 Publish to {dept}</button>
          <div className="sv-flex-col sv-gap-2" style={{ maxHeight: 160, overflowY: "auto" }}>
            {announcements.length === 0 && <p className="sv-text-muted" style={{ fontSize: 11.5, margin: 0 }}>No announcements.</p>}
            {announcements.map((a) => (
              <div key={a.id} className="sv-flex sv-justify-between" style={{ alignItems: "flex-start", gap: 6, padding: "6px 9px", background: "#FFF1F2", border: "1.5px solid #FECDD3", borderRadius: 7 }}>
                <span style={{ fontSize: 11.5, fontWeight: 700, color: "#DC2626" }}>{a.text}</span>
                <button onClick={() => onDeleteAnnouncement(a.id)} style={{ border: "none", background: "transparent", color: "#DC2626", cursor: "pointer", fontWeight: 700, fontSize: 13, flexShrink: 0 }}>×</button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
