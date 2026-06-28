import { useState } from "react";
import { storageSet } from "../../utils/storage.js";
import { fmtCurr, fmtDate, getTodayStr, empLabel } from "../../utils/helpers.js";
import { GREEN, BLUE, NAVY, RED } from "../../utils/constants.js";

/**
 * SalaryModule — Admin "Salary" tab.
 * Lets a manager set each employee's fixed salary, add ad-hoc
 * incentives, mark a payment as paid (which clears pending
 * incentives into payment history), and "send" a payslip
 * (logged as a notification — wire up real email/SMS here later).
 */
export default function SalaryModule({ employees, salaries, setSalaries, showToast, pushNotification }) {
  const [modal, setModal] = useState(null); // { empId, type: "incentive" | "history" }
  const [incAmount, setIncAmount] = useState("");
  const [incReason, setIncReason] = useState("");
  const [editIncId, setEditIncId] = useState(null);
  const [editIncAmt, setEditIncAmt] = useState("");
  const [editIncReason, setEditIncReason] = useState("");

  const getSal = (id) => salaries[id] || { fixedSalary: 0, incentives: [], payments: [] };

  const setFixed = async (empId, v) => {
    const curr = getSal(empId);
    const u = { ...salaries, [empId]: { ...curr, fixedSalary: +v || 0 } };
    setSalaries(u); await storageSet("svd_salaries", JSON.stringify(u));
  };

  const addIncentive = async () => {
    if (!incAmount || !incReason.trim()) { showToast("Enter amount and reason", "err"); return; }
    const id = modal?.empId;
    const curr = getSal(id);
    const inc = { id: `inc${Date.now()}`, amount: +incAmount, reason: incReason.trim(), date: getTodayStr() };
    const u = { ...salaries, [id]: { ...curr, incentives: [...(curr.incentives || []), inc] } };
    setSalaries(u); await storageSet("svd_salaries", JSON.stringify(u));
    setIncAmount(""); setIncReason(""); setModal(null);
    showToast("Incentive added!");
  };

  const saveEditIncentive = async (empId) => {
    const curr = getSal(empId);
    const u = { ...salaries, [empId]: { ...curr, incentives: (curr.incentives || []).map((i) => (i.id === editIncId ? { ...i, amount: +editIncAmt || 0, reason: editIncReason } : i)) } };
    setSalaries(u); await storageSet("svd_salaries", JSON.stringify(u));
    setEditIncId(null); showToast("Incentive updated!");
  };

  const removeIncentive = async (empId, incId) => {
    const curr = getSal(empId);
    const u = { ...salaries, [empId]: { ...curr, incentives: (curr.incentives || []).filter((i) => i.id !== incId) } };
    setSalaries(u); await storageSet("svd_salaries", JSON.stringify(u));
    showToast("Incentive removed");
  };

  const markPaid = async (empId) => {
    const curr = getSal(empId);
    const emp = employees.find((e) => e.id === empId);
    const totalInc = (curr.incentives || []).reduce((a, b) => a + (b.amount || 0), 0);
    const total = (curr.fixedSalary || 0) + totalInc;
    const pay = { id: `pay${Date.now()}`, amount: total, fixed: curr.fixedSalary || 0, incentiveTotal: totalInc, date: getTodayStr() };
    const u = { ...salaries, [empId]: { ...curr, payments: [...(curr.payments || []), pay], incentives: [] } };
    setSalaries(u); await storageSet("svd_salaries", JSON.stringify(u));
    showToast("Payment marked as done!");
    if (emp) pushNotification("💰", `Salary paid to ${empLabel(emp)}: ${fmtCurr(total)}`);
  };

  const sendPayslip = (empId) => {
    const emp = employees.find((e) => e.id === empId);
    const curr = getSal(empId);
    const totalInc = (curr.incentives || []).reduce((a, b) => a + (b.amount || 0), 0);
    const total = (curr.fixedSalary || 0) + totalInc;
    if (emp) pushNotification("📄", `Payslip for ${empLabel(emp)} — Fixed: ${fmtCurr(curr.fixedSalary || 0)}, Incentives: ${fmtCurr(totalInc)}, Total: ${fmtCurr(total)}`);
    showToast(`Payslip sent to ${emp?.name || "employee"}`);
  };

  return (
    <div className="sv-flex-col sv-gap-4">
      <div className="sv-card">
        <p className="sv-text-navy sv-font-800" style={{ margin: "0 0 4px", fontSize: 16 }}>💼 Employee Salary Management</p>
        <p className="sv-text-muted" style={{ margin: "0 0 16px", fontSize: 12 }}>Set fixed salaries, add incentives, mark payments, and send payslips.</p>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ background: "#F8FAFC" }}>
                {["Employee", "Dept", "Fixed Salary (₹)", "Incentives", "Total Salary", "Actions"].map((h) => (
                  <th key={h} style={{ padding: "10px 12px", textAlign: "left", fontWeight: 700, color: "#475569", borderBottom: "2px solid #E2E8F0", fontSize: 12, whiteSpace: "nowrap" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {employees.length === 0 && <tr><td colSpan={6} style={{ padding: 28, textAlign: "center", color: "#94A3B8" }}>No employees added yet.</td></tr>}
              {employees.map((emp, i) => {
                const sal = getSal(emp.id);
                const totalInc = (sal.incentives || []).reduce((a, b) => a + (b.amount || 0), 0);
                const total = (sal.fixedSalary || 0) + totalInc;
                return (
                  <tr key={emp.id} style={{ background: i % 2 === 0 ? "#fff" : "#F8FAFC" }}>
                    <td style={{ padding: "10px 12px" }}>
                      <div className="sv-text-navy sv-font-700" style={{ fontSize: 13 }}>{emp.name}</div>
                      <div className="sv-text-muted" style={{ fontSize: 11 }}>{emp.id}</div>
                    </td>
                    <td style={{ padding: "10px 12px", color: "#64748B", fontSize: 12 }}>{emp.department || "Sales"}</td>
                    <td style={{ padding: "10px 12px" }}>
                      <input type="number" min="0" className="sv-input" value={sal.fixedSalary || ""} placeholder="0"
                        onChange={(e) => setFixed(emp.id, e.target.value)}
                        style={{ width: 110, padding: "5px 8px", fontSize: 12 }} />
                    </td>
                    <td style={{ padding: "10px 12px", fontWeight: 700, color: GREEN }}>{fmtCurr(totalInc)}</td>
                    <td className="sv-text-navy" style={{ padding: "10px 12px", fontWeight: 800, fontSize: 14 }}>{fmtCurr(total)}</td>
                    <td style={{ padding: "10px 12px" }}>
                      <div className="sv-flex sv-gap-2" style={{ flexWrap: "wrap" }}>
                        <button onClick={() => setModal({ empId: emp.id, type: "incentive" })} style={{ padding: "4px 9px", background: "#EFF6FF", color: "#2563EB", border: "1px solid #BFDBFE", borderRadius: 6, cursor: "pointer", fontSize: 11, fontWeight: 700 }}>+ Incentive</button>
                        <button onClick={() => setModal({ empId: emp.id, type: "history" })} style={{ padding: "4px 9px", background: "#F3E8FF", color: "#7C3AED", border: "1px solid #DDD6FE", borderRadius: 6, cursor: "pointer", fontSize: 11, fontWeight: 700 }}>View</button>
                        <button onClick={() => markPaid(emp.id)} style={{ padding: "4px 9px", background: "#DCFCE7", color: "#16A34A", border: "1px solid #BBF7D0", borderRadius: 6, cursor: "pointer", fontSize: 11, fontWeight: 700 }}>✅ Paid</button>
                        <button onClick={() => sendPayslip(emp.id)} style={{ padding: "4px 9px", background: "#FFF7ED", color: "#EA580C", border: "1px solid #FED7AA", borderRadius: 6, cursor: "pointer", fontSize: 11, fontWeight: 700 }}>📄 Payslip</button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add / view incentives modal */}
      {modal?.type === "incentive" && (() => {
        const emp = employees.find((e) => e.id === modal.empId);
        const sal = getSal(modal.empId);
        return (
          <div className="sv-modal-overlay" onClick={() => setModal(null)}>
            <div className="sv-modal" style={{ maxWidth: 400, padding: 24 }} onClick={(e) => e.stopPropagation()}>
              <div className="sv-flex sv-justify-between sv-items-center" style={{ marginBottom: 16 }}>
                <span className="sv-text-navy sv-font-800" style={{ fontSize: 16 }}>Incentives — {emp?.name}</span>
                <button onClick={() => setModal(null)} className="sv-modal-close">×</button>
              </div>
              {(sal.incentives || []).length > 0 && (
                <div className="sv-flex-col sv-gap-2" style={{ marginBottom: 16 }}>
                  {sal.incentives.map((inc) => (
                    <div key={inc.id} className="sv-flex sv-items-center sv-gap-2" style={{ padding: "7px 10px", background: "#F8FAFC", border: "1px solid #E2E8F0", borderRadius: 8 }}>
                      {editIncId === inc.id ? (
                        <>
                          <input type="number" className="sv-input" value={editIncAmt} onChange={(e) => setEditIncAmt(e.target.value)} style={{ width: 80, padding: "4px 6px", fontSize: 12 }} />
                          <input className="sv-input" value={editIncReason} onChange={(e) => setEditIncReason(e.target.value)} style={{ flex: 1, padding: "4px 6px", fontSize: 12 }} />
                          <button onClick={() => saveEditIncentive(modal.empId)} style={{ padding: "4px 8px", background: GREEN, color: "#fff", border: "none", borderRadius: 5, cursor: "pointer", fontSize: 11, fontWeight: 700 }}>Save</button>
                          <button onClick={() => setEditIncId(null)} style={{ padding: "4px 8px", background: "#F1F5F9", color: "#64748B", border: "none", borderRadius: 5, cursor: "pointer", fontSize: 11 }}>×</button>
                        </>
                      ) : (
                        <>
                          <span style={{ fontWeight: 700, color: GREEN, fontSize: 13 }}>{fmtCurr(inc.amount)}</span>
                          <span style={{ flex: 1, fontSize: 12, color: "#374151" }}>{inc.reason}</span>
                          <span className="sv-text-muted" style={{ fontSize: 11 }}>{fmtDate(inc.date)}</span>
                          <button onClick={() => { setEditIncId(inc.id); setEditIncAmt(String(inc.amount)); setEditIncReason(inc.reason); }} style={{ border: "none", background: "transparent", color: BLUE, cursor: "pointer", fontSize: 12 }}>✏️</button>
                          <button onClick={() => removeIncentive(modal.empId, inc.id)} style={{ border: "none", background: "transparent", color: RED, cursor: "pointer", fontSize: 14, fontWeight: 700 }}>×</button>
                        </>
                      )}
                    </div>
                  ))}
                </div>
              )}
              <div style={{ marginBottom: 10 }}>
                <label className="sv-label">Amount (₹)</label>
                <input type="number" min="0" className="sv-input" value={incAmount} onChange={(e) => setIncAmount(e.target.value)} placeholder="e.g. 5000" />
              </div>
              <div style={{ marginBottom: 16 }}>
                <label className="sv-label">Reason</label>
                <input className="sv-input" value={incReason} onChange={(e) => setIncReason(e.target.value)} placeholder="e.g. Performance bonus" />
              </div>
              <div className="sv-flex sv-gap-2">
                <button className="sv-btn sv-btn--ghost sv-btn--full" onClick={() => setModal(null)}>Cancel</button>
                <button className="sv-btn sv-btn--primary sv-btn--full" onClick={addIncentive}>Add Incentive</button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Payment history modal */}
      {modal?.type === "history" && (() => {
        const emp = employees.find((e) => e.id === modal.empId);
        const sal = getSal(modal.empId);
        const totalInc = (sal.incentives || []).reduce((a, b) => a + (b.amount || 0), 0);
        const total = (sal.fixedSalary || 0) + totalInc;
        return (
          <div className="sv-modal-overlay" onClick={() => setModal(null)}>
            <div className="sv-modal" style={{ maxWidth: 520, maxHeight: "80vh", display: "flex", flexDirection: "column" }} onClick={(e) => e.stopPropagation()}>
              <div className="sv-modal-header" style={{ flexShrink: 0 }}>
                <div>
                  <span className="sv-text-navy sv-font-800" style={{ fontSize: 15 }}>Salary View — {emp?.name}</span>
                  <div className="sv-text-muted" style={{ fontSize: 12, marginTop: 2 }}>{emp?.id} · {emp?.department}</div>
                </div>
                <button onClick={() => setModal(null)} className="sv-modal-close">×</button>
              </div>
              <div className="sv-modal-body" style={{ overflowY: "auto" }}>
                <div className="sv-grid-3" style={{ marginBottom: 16 }}>
                  {[["Fixed Salary", fmtCurr(sal.fixedSalary || 0), NAVY], ["Incentives", fmtCurr(totalInc), GREEN], ["Total", fmtCurr(total), BLUE]].map(([l, v, c]) => (
                    <div key={l} style={{ textAlign: "center", padding: "12px 8px", background: "#F8FAFC", borderRadius: 10, border: `2px solid ${c}20` }}>
                      <div className="sv-text-muted sv-font-700" style={{ fontSize: 11, marginBottom: 4 }}>{l}</div>
                      <div style={{ fontSize: 16, fontWeight: 800, color: c }}>{v}</div>
                    </div>
                  ))}
                </div>
                <p className="sv-text-navy sv-font-700" style={{ margin: "0 0 8px", fontSize: 13 }}>Payment History</p>
                {(sal.payments || []).length === 0 ? (
                  <p className="sv-text-muted" style={{ fontSize: 13, textAlign: "center", padding: "16px 0" }}>No payments recorded yet.</p>
                ) : (
                  [...(sal.payments || [])].reverse().map((p, i) => (
                    <div key={p.id || i} style={{ padding: "10px 14px", background: "#F8FAFC", border: "1px solid #E2E8F0", borderRadius: 8, marginBottom: 6 }}>
                      <div className="sv-flex sv-justify-between sv-items-center">
                        <span className="sv-text-navy sv-font-700" style={{ fontSize: 13 }}>{fmtDate(p.date)}</span>
                        <span style={{ fontWeight: 800, color: GREEN, fontSize: 14 }}>{fmtCurr(p.amount)}</span>
                      </div>
                      <div style={{ fontSize: 11.5, color: "#64748B", marginTop: 3 }}>Fixed: {fmtCurr(p.fixed)} + Incentives: {fmtCurr(p.incentiveTotal)}</div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
