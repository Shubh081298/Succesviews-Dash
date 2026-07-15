import { fmtSalary } from "../utils/helpers.js";

/**
 * PayslipView — the single, shared on-screen payslip.
 * Rendered identically in the admin "Payslip" preview (before sending)
 * and in the employee's "View" modal, so what the admin reviews is
 * exactly what the employee sees. Shows incentive reasons and deduction
 * reasons; if there are no deductions it shows "Deduction: N/A".
 * Net Salary = Fixed + Incentives - Deductions. All amounts use the
 * Indian "X /-" format. Fed by a payslip payload (see helpers).
 */
export default function PayslipView({ payload, employee = {}, logo = "" }) {
  if (!payload) return null;
  const {
    month, year, date,
    fixed = 0,
    incentives = [], incentiveTotal = 0,
    deductions = [], deductionTotal = 0,
    total = 0,
    empName, empId,
  } = payload;

  const name = employee.name || empName || "-";
  const id = employee.id || empId || "-";
  const dept = employee.department || "-";
  const email = employee.email || "-";
  const prettyDate = (() => {
    try {
      return new Date((date || "") + "T00:00:00").toLocaleDateString("en-IN", {
        day: "2-digit", month: "long", year: "numeric",
      });
    } catch (e) { return date || ""; }
  })();

  return (
    <div className="sv-payslip">
      <div className="sv-payslip-head">
        <div className="sv-payslip-brand">
          {logo ? <img src={logo} alt="" className="sv-payslip-logo" /> : <span className="sv-payslip-brand-name">SuccessViews</span>}
          <div className="sv-payslip-sub">Salary Payslip</div>
        </div>
        <div className="sv-payslip-period">
          <div className="sv-payslip-period-label">Pay Period</div>
          <div className="sv-payslip-period-val">{month} {year}</div>
        </div>
      </div>

      <div className="sv-payslip-emp">
        <div><span>Employee</span><strong>{name}</strong></div>
        <div><span>Employee ID</span><strong>{id}</strong></div>
        <div><span>Department</span><strong>{dept}</strong></div>
        <div><span>Email</span><strong>{email}</strong></div>
      </div>

      <table className="sv-payslip-table">
        <thead>
          <tr><th>Earnings</th><th style={{ textAlign: "right" }}>Amount</th></tr>
        </thead>
        <tbody>
          <tr>
            <td>Fixed Salary</td>
            <td style={{ textAlign: "right" }}>{fmtSalary(fixed)}</td>
          </tr>
          {incentives.length === 0 ? (
            <tr>
              <td>Incentives</td>
              <td style={{ textAlign: "right" }}>{fmtSalary(0)}</td>
            </tr>
          ) : (
            incentives.map((inc, i) => (
              <tr key={`inc-${i}`}>
                <td>Incentive - {inc.reason || "Bonus"}</td>
                <td style={{ textAlign: "right" }}>{fmtSalary(inc.amount)}</td>
              </tr>
            ))
          )}
          {incentives.length > 0 && (
            <tr className="sv-payslip-subtotal">
              <td>Total Incentives</td>
              <td style={{ textAlign: "right" }}>{fmtSalary(incentiveTotal)}</td>
            </tr>
          )}

          {deductions.length === 0 ? (
            <tr>
              <td>Deduction</td>
              <td style={{ textAlign: "right" }}>N/A</td>
            </tr>
          ) : (
            deductions.map((ded, i) => (
              <tr key={`ded-${i}`} className="sv-payslip-deduct">
                <td>Deduction - {ded.reason || "Deduction"}</td>
                <td style={{ textAlign: "right" }}>- {fmtSalary(ded.amount)}</td>
              </tr>
            ))
          )}
          {deductions.length > 0 && (
            <tr className="sv-payslip-deduct-subtotal">
              <td>Total Deductions</td>
              <td style={{ textAlign: "right" }}>- {fmtSalary(deductionTotal)}</td>
            </tr>
          )}
        </tbody>
        <tfoot>
          <tr className="sv-payslip-total">
            <td>Net Salary</td>
            <td style={{ textAlign: "right" }}>{fmtSalary(total)}</td>
          </tr>
        </tfoot>
      </table>

      <div className="sv-payslip-foot">Generated on {prettyDate}</div>
    </div>
  );
}
