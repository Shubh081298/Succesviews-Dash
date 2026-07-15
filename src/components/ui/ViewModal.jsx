import { fmtDate, fmtDateTime, fmtCurr, downloadCSV } from "../../utils/helpers.js";
import { BLUE } from "../../utils/constants.js";

/**
 * ViewModal — read-only detail view for one submitted DSR, opened from
 * the admin Reports tab. `report` is a normalized submission record.
 */
export default function ViewModal({ report, onClose, toast }) {
  if (!report) return null;

  const meta = (label, value) => (
    <div className="sv-meta-cell">
      <div className="sv-meta-label">{label}</div>
      <div className="sv-meta-value">{value}</div>
    </div>
  );

  const rowsBlock = (label, rows, render) => {
    const list = Array.isArray(rows) ? rows : [];
    if (list.length === 0) return null;
    return (
      <div style={{ marginBottom: 12 }}>
        <div className="sv-section-label">{label}</div>
        <ul style={{ margin: "4px 0 0", paddingLeft: 18, fontSize: 13, color: "#374151", lineHeight: 1.6 }}>
          {list.map((r, i) => <li key={i}>{render(r)}</li>)}
        </ul>
      </div>
    );
  };

  const textBlock = (label, value) => (
    <div style={{ marginBottom: 12 }}>
      <div className="sv-section-label">{label}</div>
      <div style={{ background: "#F8FAFC", border: "1px solid #E2E8F0", borderRadius: 8, padding: "10px 12px", fontSize: 13.5, color: "#374151", lineHeight: 1.6 }}>
        {value || "—"}
      </div>
    </div>
  );

  const badgeClass = `sv-badge sv-badge--${(report.status || "pending").toLowerCase().replace(/\s+/g, "-")}`;

  return (
    <div className="sv-modal-overlay" onClick={onClose}>
      <div className="sv-modal" onClick={(e) => e.stopPropagation()}>
        <div className="sv-modal-header">
          <div>
            <div className="sv-text-navy sv-font-700" style={{ fontSize: 17 }}>
              {report.empName} — {report.department} DSR
            </div>
            <div className="sv-text-muted" style={{ fontSize: 12.5, marginTop: 4 }}>
              {fmtDate(report.date)}{report.ts ? ` · Submitted ${fmtDateTime(report.ts)}` : ""}
            </div>
          </div>
          <div className="sv-flex sv-items-center sv-gap-3">
            <span className={badgeClass}>{report.status}</span>
            <button onClick={onClose} className="sv-modal-close">×</button>
          </div>
        </div>
        <div className="sv-modal-body">
          {report.attendance === "Absent" ? (
            <p className="sv-text-muted" style={{ fontSize: 13.5, marginBottom: 14 }}>Marked absent — no activity recorded for this day.</p>
          ) : (
            <>
              <div className="sv-grid-2" style={{ marginBottom: 18 }}>
                {meta("Attendance", report.attendance)}
                {meta("Hours Worked", report.workingHours || 0)}
                {meta("Fresh Emails", report.freshEmails || 0)}
                {meta("Reminder Emails", report.reminderEmails || 0)}
                {meta("Sales", fmtCurr(report.salesGenerated))}
                {meta("Payments", fmtCurr(report.paymentReceived))}
              </div>
              {rowsBlock("New Leads / Interested", report.leads, (r) => `${r.clientName || "—"} · ${r.idName || "—"} · ${r.domain || "—"}${r.price ? ` · ${r.price}` : ""}`)}
              {rowsBlock("Client Follow-ups", report.followups, (r) => `${r.clientName || "—"} · ${r.domain || "—"}`)}
              {rowsBlock("Scheduled Calls", report.calls, (r) => `${r.clientName || "—"} · ${r.idName || "—"} · ${r.domain || "—"} · ${r.time || "—"}${r.tz ? ` (${r.tz})` : ""}`)}
              {rowsBlock("Sales Generated", report.sales, (r) => `${r.amount || 0} ${r.currency || ""} · ${r.idName || "—"}`)}
              {rowsBlock("Payments Received", report.payments, (r) => `${r.amount || 0} ${r.currency || ""} · ${r.idName || "—"}`)}
              {rowsBlock("Website Work", report.websitesData, (w) => `${w.name || "—"}: ${w.description || ""}`)}
              {textBlock("Pending Tasks", report.pendingTasks)}
              {textBlock("Updates for Team Lead", report.updatesForTeamLead)}
            </>
          )}
          <div className="sv-flex sv-gap-3" style={{ justifyContent: "flex-end", marginTop: 6 }}>
            <button
              className="sv-btn sv-btn--ghost"
              style={{ borderColor: BLUE, color: BLUE }}
              onClick={() => {
                downloadCSV(
                  `Report_${(report.empName || "emp").replace(/\s/g, "_")}_${report.date}.csv`,
                  [
                    ["Employee", "Department", "Date", "Status", "Attendance", "Fresh Emails", "Reminder Emails", "Leads", "Follow-ups", "Calls", "Sales", "Payments", "Hours", "Pending", "Updates"],
                    [report.empName, report.department, report.date, report.status, report.attendance, report.freshEmails, report.reminderEmails, report.newLeadsInterested, report.newFollowUps, report.callsScheduled, report.salesGenerated, report.paymentReceived, report.workingHours, report.pendingTasks, report.updatesForTeamLead],
                  ]
                );
                toast && toast("Report exported");
              }}
            >
              Export CSV
            </button>
            <button className="sv-btn sv-btn--teal" onClick={onClose}>Close</button>
          </div>
        </div>
      </div>
    </div>
  );
}
