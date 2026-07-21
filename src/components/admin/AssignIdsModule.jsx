import { useState } from "react";
import { IdCard, Plus, X } from "lucide-react";
import Avatar from "../ui/Avatar.jsx";
import { normAssignedId } from "../../utils/helpers.js";

/**
 * AssignIdsModule — Admin "Assign IDs" panel (lives in the
 * Manager/IDs Assign tab next to the existing Manager Assignment).
 * Assign one or more mail IDs to each employee, each with an optional
 * Project label. Every add/edit/remove is saved automatically; the IDs
 * then appear in that employee's "My Assigned IDs" tab.
 *
 * Storage is backward compatible: legacy entries are plain strings and
 * new entries are { id, project } objects — both handled via normAssignedId.
 */
function IdRows({ items, onChange }) {
  const rows = items.map(normAssignedId);
  const [id, setId] = useState("");
  const [project, setProject] = useState("");

  const add = () => {
    const v = id.trim();
    if (!v) return;
    if (rows.some((r) => r.id === v)) { setId(""); setProject(""); return; }
    onChange([...rows, { id: v, project: project.trim() }]);
    setId(""); setProject("");
  };
  const remove = (target) => onChange(rows.filter((r) => r.id !== target));
  const setProj = (target, val) =>
    onChange(rows.map((r) => (r.id === target ? { ...r, project: val } : r)));

  return (
    <div className="sv-idrows">
      {rows.map((r) => (
        <div key={r.id} className="sv-idrow">
          <span className="sv-idrow-id" title={r.id}>{r.id}</span>
          <input
            className="sv-input sv-idrow-proj"
            placeholder="Project (optional)"
            value={r.project}
            onChange={(e) => setProj(r.id, e.target.value)}
          />
          <button type="button" onClick={() => remove(r.id)} aria-label={`Remove ${r.id}`} className="sv-idrow-x"><X size={13} /></button>
        </div>
      ))}
      <div className="sv-idrow sv-idrow--add">
        <input
          className="sv-input sv-idrow-id-input"
          placeholder="Add mail ID"
          value={id}
          onChange={(e) => setId(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(); } }}
        />
        <input
          className="sv-input sv-idrow-proj"
          placeholder="Project (optional)"
          value={project}
          onChange={(e) => setProject(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(); } }}
        />
        <button type="button" className="sv-idrow-add" onClick={add} disabled={!id.trim()}><Plus size={13} /> Add</button>
      </div>
    </div>
  );
}

export default function AssignIdsModule({ employees, assignEmployeeIds }) {
  if (!employees.length) {
    return (
      <div className="sv-card">
        <p className="sv-text-muted" style={{ fontSize: 13, textAlign: "center", padding: "24px 0" }}>No employees yet. Add employees in Settings first.</p>
      </div>
    );
  }

  return (
    <div className="sv-card">
      <div className="sv-flex sv-items-center sv-gap-2" style={{ marginBottom: 4 }}>
        <span className="sv-mod-icon"><IdCard size={16} /></span>
        <p className="sv-text-navy sv-font-800" style={{ margin: 0, fontSize: 16 }}>Assign Mail IDs</p>
      </div>
      <p className="sv-text-muted" style={{ margin: "0 0 14px", fontSize: 12 }}>
        Assign one or more mail IDs to each employee, each with an optional project. Changes save automatically and appear in the employee's <b>Assigned IDs</b> tab.
      </p>
      <div style={{ overflowX: "auto" }}>
        <table className="sv-assign-table" style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ background: "var(--sv-surface-2)" }}>
              {["Employee", "Mail IDs & Projects"].map((h) => (
                <th key={h} style={{ padding: "10px 12px", textAlign: "left", fontWeight: 700, color: "var(--sv-text-2)", borderBottom: "2px solid var(--sv-border)", fontSize: 12, whiteSpace: "nowrap" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {employees.map((emp, i) => (
              <tr key={emp.id} style={{ background: i % 2 === 0 ? "var(--sv-surface)" : "var(--sv-surface-2)" }}>
                <td style={{ padding: "10px 12px", whiteSpace: "nowrap", verticalAlign: "top", minWidth: 150 }}>
                  <div className="sv-flex sv-items-center sv-gap-2">
                    <Avatar emp={emp} idx={i} size={30} />
                    <div>
                      <div className="sv-text-navy sv-font-700" style={{ fontSize: 13 }}>{emp.name}</div>
                      <div className="sv-text-muted" style={{ fontSize: 11 }}>{emp.department || "Sales"}</div>
                    </div>
                  </div>
                </td>
                <td style={{ padding: "10px 12px" }}>
                  <IdRows items={emp.assignedIds || []} onChange={(ids) => assignEmployeeIds(emp.id, ids)} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
