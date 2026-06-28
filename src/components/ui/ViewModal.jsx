import { fmtDate, fmtDateTime, fmtCurr, downloadCSV } from "../../utils/helpers.js";
import { BLUE } from "../../utils/constants.js";

/**
 * ViewModal — read-only detail view for a single submitted Daily
 * Status Report, opened from the Reports tab. Includes a CSV export
 * button for that one record.
 */
export default function ViewModal({ report, onClose, toast }) {
  if (!report) return null;

  const meta = (label, value) => (
    <div className="sv-meta-cell">
      <div className="sv-meta-label">{label}</div>
      <div className="sv-meta-value">{value}</div>
    </div>
  );
  const section = (label, value) => (
    <div style={{ marginBottom: 14 }}>
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
              {report.employee}{report.employeeId ? ` (${report.employeeId})` : ""} — Daily Report
            </div>
            <div className="sv-text-muted" style={{ fontSize: 12.5, marginTop: 4 }}>
              {fmtDate(report.date)} · Submitted {fmtDateTime(report.submittedAt)}
            </div>
          </div>
          <div className="sv-flex sv-items-center sv-gap-3">
            <span className={badgeClass}>{report.status}</span>
            <button onClick={onClose} className="sv-modal-close">×</button>
          </div>
        </div>
        <div className="sv-modal-body">
          <div className="sv-grid-2" style={{ marginBottom: 18 }}>
            {meta("Sales Generated", fmtCurr(report.salesGenerated))}
            {meta("Payment Received", fmtCurr(report.paymentReceived))}
            {meta("Hours Worked", report.workingHours)}
            {meta("Status", <span className={badgeClass}>{report.status}</span>)}
          </div>
          {section("Pending Tasks", report.pendingTasks)}
          {section("Challenges / Blockers", report.challengesFaced || report.challenges || "None")}
          {section("Updates for Team Lead", report.updatesForTeamLead)}
          {report.remarks && section("Remarks", report.remarks)}
          <div className="sv-flex sv-gap-3" style={{ justifyContent: "flex-end", marginTop: 6 }}>
            <button
              className="sv-btn sv-btn--ghost"
              style={{ borderColor: BLUE, color: BLUE }}
              onClick={() => {
                downloadCSV(
                  `Report_${report.employee.replace(/\s/g, "_")}_${report.date}.csv`,
                  [
                    ["Employee", "Date", "Status", "Emails", "Leads", "Calls", "Sales", "Payment", "Hours", "Pending", "Challenges", "Updates"],
                    [report.employee, report.date, report.status, report.emailsSent, report.newLeads, report.callsMade, report.salesGenerated, report.paymentReceived, report.workingHours, report.pendingTasks, report.challengesFaced, report.updatesForTeamLead],
                  ]
                );
                toast("Report exported");
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
