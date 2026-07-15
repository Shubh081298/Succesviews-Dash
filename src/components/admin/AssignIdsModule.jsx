import { useState } from "react";
import Avatar from "../ui/Avatar.jsx";
import { empLabel } from "../../utils/helpers.js";
import { GREEN, RED } from "../../utils/constants.js";

/**
 * AssignIdsModule — Admin "Assign IDs" panel (lives in the
 * Manager/IDs Assign tab next to the existing Manager Assignment).
 * Assign one or more mail IDs to each employee. Every add/remove is
 * saved automatically; the IDs then appear in that employee's
 * "My Assigned IDs" tab without any further action.
 */
function IdTags({ ids, onChange }) {
  const [text, setText] = useState("");

  const add = () => {
    const v = text.trim();
    if (!v) return;
    if (ids.includes(v)) { setText(""); return; }
    onChange([...ids, v]);
    setText("");
  };
  const remove = (id) => onChange(ids.filter((x) => x !== id));

  return (
    <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 6 }}>
      {ids.map((id) => (
        <span key={id} className="sv-id-tag">
          {id}
          <button type="button" onClick={() => remove(id)} aria-label={`Remove ${id}`} className="sv-id-tag-x">×</button>
        </span>
      ))}
      <input
        className="sv-input sv-id-input"
        placeholder="Add ID"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(); } }}
      />
      <button type="button" className="sv-id-add" onClick={add} disabled={!text.trim()}>+ Add</button>
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
      <p className="sv-text-navy sv-font-800" style={{ margin: "0 0 4px", fontSize: 16 }}>🆔 Assign Mail IDs</p>
      <p className="sv-text-muted" style={{ margin: "0 0 14px", fontSize: 12 }}>
        Assign one or more mail IDs to each employee. Changes save automatically and appear in the employee's <b>Assigned IDs</b> tab.
      </p>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ background: "var(--sv-surface-2)" }}>
              {["Employee Name", "Assign IDs"].map((h) => (
                <th key={h} style={{ padding: "10px 12px", textAlign: "left", fontWeight: 700, color: "var(--sv-text-2)", borderBottom: "2px solid var(--sv-border)", fontSize: 12, whiteSpace: "nowrap" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {employees.map((emp, i) => (
              <tr key={emp.id} style={{ background: i % 2 === 0 ? "var(--sv-surface)" : "var(--sv-surface-2)" }}>
                <td style={{ padding: "10px 12px", whiteSpace: "nowrap", verticalAlign: "top" }}>
                  <div className="sv-flex sv-items-center sv-gap-2">
                    <Avatar emp={emp} idx={i} size={30} />
                    <div>
                      <div className="sv-text-navy sv-font-700" style={{ fontSize: 13 }}>{emp.name}</div>
                      <div className="sv-text-muted" style={{ fontSize: 11 }}>{emp.department || "Sales"}</div>
                    </div>
                  </div>
                </td>
                <td style={{ padding: "10px 12px" }}>
                  <IdTags ids={emp.assignedIds || []} onChange={(ids) => assignEmployeeIds(emp.id, ids)} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
