import Avatar from "../ui/Avatar.jsx";
import { storageSet } from "../../utils/storage.js";
import { empLabel } from "../../utils/helpers.js";
import { BLUE } from "../../utils/constants.js";

/**
 * ManagerAssignModule — Admin "Manager Assignment" tab.
 * Groups employees by their assigned team lead, and lets the admin
 * reassign anyone via a per-row dropdown. Unassigned employees get
 * their own section at the bottom.
 */
export default function ManagerAssignModule({ employees, setEmployees, showToast, editMode = false }) {
  const allLeadNames = [...new Set(employees.map((e) => e.teamLead).filter(Boolean))];
  const grouped = allLeadNames.map((lead) => ({ lead, members: employees.filter((e) => e.teamLead === lead) }));
  const unassigned = employees.filter((e) => !e.teamLead);

  const assign = async (empId, lead) => {
    const u = employees.map((e) => (e.id === empId ? { ...e, teamLead: lead } : e));
    setEmployees(u); await storageSet("svd_emps", JSON.stringify(u));
    showToast(lead ? `Assigned to ${lead}` : "Team lead removed");
  };

  const TeamRow = ({ emp, idx }) => (
    <div className="sv-flex sv-items-center sv-gap-3" style={{ padding: "9px 12px", background: "var(--sv-surface-2)", borderRadius: 8, border: "1px solid var(--sv-border)" }}>
      <Avatar emp={emp} idx={idx} size={32} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="sv-text-navy sv-font-700" style={{ fontSize: 13 }}>{empLabel(emp)}</div>
        <div className="sv-text-muted" style={{ fontSize: 11 }}>{emp.department || "Sales"}</div>
      </div>
      <select className="sv-select" value={emp.teamLead || ""} onChange={(e) => assign(emp.id, e.target.value)} style={{ width: 180, padding: "5px 8px", fontSize: 12, background: "var(--sv-surface)" }}>
        <option value="">— No Team Lead —</option>
        {employees.filter((x) => x.id !== emp.id).map((x) => (
          <option key={x.id} value={x.name}>{x.name}</option>
        ))}
      </select>
    </div>
  );

  if (employees.length === 0) {
    return (
      <div className="sv-card">
        <p className="sv-text-muted" style={{ fontSize: 13, textAlign: "center", padding: "24px 0" }}>No employees yet. Add employees in Settings first.</p>
      </div>
    );
  }

  return (
    <div className="sv-flex-col sv-gap-4">
      <div className="sv-card">
        <p className="sv-text-navy sv-font-800" style={{ margin: "0 0 4px", fontSize: 16 }}>👥 Manager & Team Assignment</p>
        <p className="sv-text-muted" style={{ margin: 0, fontSize: 12 }}>Assign employees to team leads. Changes reflect instantly across DSR and reports.</p>
      </div>

      {grouped.map(({ lead, members }) => (
        <div key={lead} className="sv-card">
          <div className="sv-flex sv-items-center sv-gap-2" style={{ marginBottom: 14 }}>
            <div style={{ width: 10, height: 10, borderRadius: "50%", background: BLUE, flexShrink: 0 }} />
            <p className="sv-text-navy sv-font-800" style={{ margin: 0, fontSize: 15 }}>Team: {lead}</p>
            <span className="sv-text-muted" style={{ fontSize: 12 }}>({members.length} member{members.length !== 1 ? "s" : ""})</span>
          </div>
          <div className="sv-flex-col sv-gap-2">
            {members.map((emp, i) => <TeamRow key={emp.id} emp={emp} idx={i} />)}
          </div>
        </div>
      ))}

      {unassigned.length > 0 && (
        <div className="sv-card">
          <div className="sv-flex sv-items-center sv-gap-2" style={{ marginBottom: 14 }}>
            <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#94A3B8", flexShrink: 0 }} />
            <p className="sv-text-navy sv-font-800" style={{ margin: 0, fontSize: 15 }}>Unassigned</p>
            <span className="sv-text-muted" style={{ fontSize: 12 }}>({unassigned.length} employee{unassigned.length !== 1 ? "s" : ""})</span>
          </div>
          <div className="sv-flex-col sv-gap-2">
            {unassigned.map((emp, i) => <TeamRow key={emp.id} emp={emp} idx={i} />)}
          </div>
        </div>
      )}
    </div>
  );
}
