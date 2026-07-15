import { useState } from "react";
import { storageSet } from "../../utils/storage.js";
import { fmtSalary, fmtDate, getTodayStr, empLabel, buildPayslipMessage } from "../../utils/helpers.js";
import { GREEN, BLUE, NAVY, RED } from "../../utils/constants.js";
import PayslipView from "../PayslipView.jsx";

/**
 * SalaryModule — Admin "Salary" tab.
 * Set fixed salary, add incentives and deductions (both need an amount
 * and a reason), mark a payment as Paid (with a confirmation step), and
 * send a payslip. Net Salary = Fixed + Incentives − Deductions. The
 * "Payslip" button opens a preview identical to what the employee sees;
 * only after "Send to Employee" is the payslip delivered (stored as a
 * message so it lands in the employee's Payslip History) and a
 * notification sent. All amounts use the Indian "X /-" format.
 */
export default function SalaryModule({ employees, salaries, setSalaries, showToast, pushNotification, addMessage, captureExpense, editMode = false, logo = "" }) {
  const [modal, setModal] = useState(null); // { empId, type: "incentive" | "deduction" | "history" }
  const [incAmount, setIncAmount] = useState("");
  const [incReason, setIncReason] = useState("");
  const [editIncId, setEditIncId] = useState(null);
  const [editIncAmt, setEditIncAmt] = useState("");
  const [editIncReason, setEditIncReason] = useState("");
  const [dedAmount, setDedAmount] = useState("");
  const [dedReason, setDedReason] = useState("");
  const [editDedId, setEditDedId] = useState(null);
  const [editDedAmt, setEditDedAmt] = useState("");
  const [editDedReason, setEditDedReason] = useState("");
  const [confirmPaid, setConfirmPaid] = useState(null); // empId awaiting Paid confirmation
  const [preview, setPreview] = useState(null);          // { empId, payload } payslip preview
  const [sending, setSending] = useState(false);

  const getSal = (id) => salaries[id] || { fixedSalary: 0, incentives: [], deductions: [], payments: [] };
  const sumAmt = (arr) => (arr || []).reduce((a, b) => a + (b.amount || 0), 0);

  const setFixed = async (empId, v) => {
    const curr = getSal(empId);
    const u = { ...salaries, [empId]: { ...curr, fixedSalary: +v || 0 } };
    setSalaries(u); await storageSet("svd_salaries", JSON.stringify(u));
  };

  /* ── Incentives ── */
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

  /* ── Deductions (mirror incentives) ── */
  const addDeduction = async () => {
    if (!dedAmount || !dedReason.trim()) { showToast("Enter deduction amount and reason", "err"); return; }
    const id = modal?.empId;
    const curr = getSal(id);
    const ded = { id: `ded${Date.now()}`, amount: +dedAmount, reason: dedReason.trim(), date: getTodayStr() };
    const u = { ...salaries, [id]: { ...curr, deductions: [...(curr.deductions || []), ded] } };
    setSalaries(u); await storageSet("svd_salaries", JSON.stringify(u));
    setDedAmount(""); setDedReason(""); setModal(null);
    showToast("Deduction added!");
  };
  const saveEditDeduction = async (empId) => {
    const curr = getSal(empId);
    const u = { ...salaries, [empId]: { ...curr, deductions: (curr.deductions || []).map((i) => (i.id === editDedId ? { ...i, amount: +editDedAmt || 0, reason: editDedReason } : i)) } };
    setSalaries(u); await storageSet("svd_salaries", JSON.stringify(u));
    setEditDedId(null); showToast("Deduction updated!");
  };
  const removeDeduction = async (empId, dedId) => {
    const curr = getSal(empId);
    const u = { ...salaries, [empId]: { ...curr, deductions: (curr.deductions || []).filter((i) => i.id !== dedId) } };
    setSalaries(u); await storageSet("svd_salaries", JSON.stringify(u));
    showToast("Deduction removed");
  };

  const markPaid = async (empId) => {
    const curr = getSal(empId);
    const emp = employees.find((e) => e.id === empId);
    const totalInc = sumAmt(curr.incentives);
    const totalDed = sumAmt(curr.deductions);
    const total = (curr.fixedSalary || 0) + totalInc - totalDed;
    const pay = { id: `pay${Date.now()}`, amount: total, fixed: curr.fixedSalary || 0, incentiveTotal: totalInc, deductionTotal: totalDed, incentives: curr.incentives || [], deductions: curr.deductions || [], date: getTodayStr() };
    const u = { ...salaries, [empId]: { ...curr, payments: [...(curr.payments || []), pay], incentives: [], deductions: [] } };
    setSalaries(u); await storageSet("svd_salaries", JSON.stringify(u));
    setConfirmPaid(null);
    showToast("Payment marked as done!");
    if (emp) pushNotification(`💰 Salary paid to ${empLabel(emp)}: ${fmtSalary(total)}`);
    if (captureExpense && emp) {
      const d = new Date(pay.date);
      const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      captureExpense({
        type: "salary",
        sourceKey: `salary:${empId}:${monthKey}`,
        title: `Salary — ${emp.name || empId}`,
        category: "Salary",
        clientName: emp.name || "",
        paymentStatus: "Paid",
        paymentDate: pay.date,
        amount: total,
        currency: "INR",
        paymentMethod: "Salary",
        details: {
          employeeId: empId,
          employeeName: emp.name || "",
          department: emp.department || "",
          month: d.toLocaleDateString("en-IN", { month: "long" }),
          year: d.getFullYear(),
          monthKey,
          fixed: pay.fixed,
          incentiveTotal: pay.incentiveTotal,
          deductionTotal: pay.deductionTotal,
          incentives: pay.incentives,
          deductions: pay.deductions,
          finalSalary: total,
        },
      });
    }
  };

  // Build the payslip payload for the current fixed + pending incentives − deductions.
  const buildPayload = (empId) => {
    const emp = employees.find((e) => e.id === empId);
    const sal = getSal(empId);
    const pendingInc = sal.incentives || [];
    const pendingDed = sal.deductions || [];
    const payments = sal.payments || [];
    const last = payments.length ? payments[payments.length - 1] : null;
    // Pending items take priority. If none are pending but the salary was
    // already marked Paid (which clears the pending items into a payment),
    // fall back to the most recent payment's breakdown so the payslip still
    // shows the incentives/deductions that were paid.
    const usePayment = pendingInc.length === 0 && pendingDed.length === 0 && !!last;
    const srcInc = usePayment ? (last.incentives || []) : pendingInc;
    const srcDed = usePayment ? (last.deductions || []) : pendingDed;
    const fixed = usePayment && last.fixed != null ? last.fixed : (sal.fixedSalary || 0);
    const incentives = srcInc.map((i) => ({ reason: i.reason, amount: i.amount }));
    const deductions = srcDed.map((i) => ({ reason: i.reason, amount: i.amount }));
    const incentiveTotal = sumAmt(incentives);
    const deductionTotal = sumAmt(deductions);
    const total = fixed + incentiveTotal - deductionTotal;
    const baseDate = usePayment && last.date ? last.date : getTodayStr();
    const d = new Date(baseDate + "T00:00:00");
    const month = d.toLocaleDateString("en-IN", { month: "long" });
    const year = d.getFullYear();
    const monthKey = `${year}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    return {
      month, year, monthKey, date: baseDate,
      empName: emp?.name || "", empId,
      fixed,
      incentives, incentiveTotal,
      deductions, deductionTotal,
      total,
    };
  };

  const openPayslipPreview = (empId) => setPreview({ empId, payload: buildPayload(empId) });

  const sendPayslip = async () => {
    if (!preview) return;
    const { empId, payload } = preview;
    const emp = employees.find((e) => e.id === empId);
    setSending(true);
    try {
      await addMessage(empId, buildPayslipMessage(payload)); // stored + delivered to employee
    } finally {
      setSending(false);
    }
    if (emp) pushNotification(`📄 Payslip for ${empLabel(emp)} (${payload.month} ${payload.year}) sent — Net ${fmtSalary(payload.total)}`);
    showToast(`Payslip sent to ${emp?.name || "employee"}`);
    setPreview(null);
  };

  return (
    <div className="sv-flex-col sv-gap-4">
      <div className="sv-card">
        <p className="sv-text-navy sv-font-800" style={{ margin: "0 0 4px", fontSize: 16 }}>💼 Employee Salary Management</p>
        <p className="sv-text-muted" style={{ margin: "0 0 16px", fontSize: 12 }}>Set fixed salaries, add incentives &amp; deductions, mark payments, and send payslips.</p>
        {!editMode && (
          <div style={{ margin: "0 0 14px", padding: "9px 12px", background: "#FEF3C7", border: "1.5px solid #FDE68A", borderRadius: 8, fontSize: 12.5, color: "#92400E", fontWeight: 600 }}>
            🔒 Salary editing is locked. Unlock it with the Settings Password on the <b>Settings</b> tab.
          </div>
        )}
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ background: "var(--sv-surface-2)" }}>
                {["Employee", "Dept", "Fixed Salary (₹)", "Incentives", "Deductions", "Net Salary", "Actions"].map((h) => (
                  <th key={h} style={{ padding: "10px 12px", textAlign: "left", fontWeight: 700, color: "var(--sv-text-2)", borderBottom: "2px solid var(--sv-border)", fontSize: 12, whiteSpace: "nowrap" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {employees.length === 0 && <tr><td colSpan={7} style={{ padding: 28, textAlign: "center", color: "#94A3B8" }}>No employees added yet.</td></tr>}
              {employees.map((emp, i) => {
                const sal = getSal(emp.id);
                const totalInc = sumAmt(sal.incentives);
                const totalDed = sumAmt(sal.deductions);
                const total = (sal.fixedSalary || 0) + totalInc - totalDed;
                return (
                  <tr key={emp.id} style={{ background: i % 2 === 0 ? "var(--sv-surface)" : "var(--sv-surface-2)" }}>
                    <td style={{ padding: "10px 12px" }}>
                      <div className="sv-text-navy sv-font-700" style={{ fontSize: 13 }}>{emp.name}</div>
                      <div className="sv-text-muted" style={{ fontSize: 11 }}>{emp.id}</div>
                    </td>
                    <td style={{ padding: "10px 12px", color: "var(--sv-text-3)", fontSize: 12 }}>{emp.department || "Sales"}</td>
                    <td style={{ padding: "10px 12px" }}>
                      <input type="number" min="0" disabled={!editMode} className="sv-input" value={sal.fixedSalary || ""} placeholder="0"
                        onChange={(e) => setFixed(emp.id, e.target.value)}
                        style={{ width: 110, padding: "5px 8px", fontSize: 12 }} />
                    </td>
                    <td style={{ padding: "10px 12px", fontWeight: 700, color: GREEN }}>{fmtSalary(totalInc)}</td>
                    <td style={{ padding: "10px 12px", fontWeight: 700, color: RED }}>{totalDed > 0 ? fmtSalary(totalDed) : "N/A"}</td>
                    <td className="sv-text-navy" style={{ padding: "10px 12px", fontWeight: 800, fontSize: 14 }}>{fmtSalary(total)}</td>
                    <td style={{ padding: "10px 12px" }}>
                      <div className="sv-flex sv-gap-2" style={{ flexWrap: "wrap" }}>
                        <button disabled={!editMode} onClick={() => setModal({ empId: emp.id, type: "incentive" })} style={{ padding: "4px 9px", background: "#EFF6FF", color: "#2563EB", border: "1px solid #BFDBFE", borderRadius: 6, cursor: "pointer", fontSize: 11, fontWeight: 700 }}>+ Incentive</button>
                        <button disabled={!editMode} onClick={() => setModal({ empId: emp.id, type: "deduction" })} style={{ padding: "4px 9px", background: "#FEF2F2", color: "#DC2626", border: "1px solid #FECACA", borderRadius: 6, cursor: "pointer", fontSize: 11, fontWeight: 700 }}>− Deduction</button>
                        <button onClick={() => setModal({ empId: emp.id, type: "history" })} style={{ padding: "4px 9px", background: "#F3E8FF", color: "#7C3AED", border: "1px solid #DDD6FE", borderRadius: 6, cursor: "pointer", fontSize: 11, fontWeight: 700 }}>View</button>
                        <button disabled={!editMode} onClick={() => setConfirmPaid(emp.id)} style={{ padding: "4px 9px", background: "#DCFCE7", color: "#16A34A", border: "1px solid #BBF7D0", borderRadius: 6, cursor: "pointer", fontSize: 11, fontWeight: 700 }}>✅ Paid</button>
                        <button disabled={!editMode} onClick={() => openPayslipPreview(emp.id)} style={{ padding: "4px 9px", background: "#FFF7ED", color: "#EA580C", border: "1px solid #FED7AA", borderRadius: 6, cursor: "pointer", fontSize: 11, fontWeight: 700 }}>📄 Payslip</button>
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
                    <div key={inc.id} className="sv-flex sv-items-center sv-gap-2" style={{ padding: "7px 10px", background: "var(--sv-surface-2)", border: "1px solid var(--sv-border)", borderRadius: 8 }}>
                      {editIncId === inc.id ? (
                        <>
                          <input type="number" className="sv-input" value={editIncAmt} onChange={(e) => setEditIncAmt(e.target.value)} style={{ width: 80, padding: "4px 6px", fontSize: 12 }} />
                          <input className="sv-input" value={editIncReason} onChange={(e) => setEditIncReason(e.target.value)} style={{ flex: 1, padding: "4px 6px", fontSize: 12 }} />
                          <button onClick={() => saveEditIncentive(modal.empId)} style={{ padding: "4px 8px", background: GREEN, color: "var(--sv-surface)", border: "none", borderRadius: 5, cursor: "pointer", fontSize: 11, fontWeight: 700 }}>Save</button>
                          <button onClick={() => setEditIncId(null)} style={{ padding: "4px 8px", background: "var(--sv-surface-3)", color: "var(--sv-text-3)", border: "none", borderRadius: 5, cursor: "pointer", fontSize: 11 }}>×</button>
                        </>
                      ) : (
                        <>
                          <span style={{ fontWeight: 700, color: GREEN, fontSize: 13 }}>{fmtSalary(inc.amount)}</span>
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

      {/* Add / view deductions modal */}
      {modal?.type === "deduction" && (() => {
        const emp = employees.find((e) => e.id === modal.empId);
        const sal = getSal(modal.empId);
        return (
          <div className="sv-modal-overlay" onClick={() => setModal(null)}>
            <div className="sv-modal" style={{ maxWidth: 400, padding: 24 }} onClick={(e) => e.stopPropagation()}>
              <div className="sv-flex sv-justify-between sv-items-center" style={{ marginBottom: 16 }}>
                <span className="sv-text-navy sv-font-800" style={{ fontSize: 16 }}>Deductions — {emp?.name}</span>
                <button onClick={() => setModal(null)} className="sv-modal-close">×</button>
              </div>
              {(sal.deductions || []).length > 0 && (
                <div className="sv-flex-col sv-gap-2" style={{ marginBottom: 16 }}>
                  {sal.deductions.map((ded) => (
                    <div key={ded.id} className="sv-flex sv-items-center sv-gap-2" style={{ padding: "7px 10px", background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 8 }}>
                      {editDedId === ded.id ? (
                        <>
                          <input type="number" className="sv-input" value={editDedAmt} onChange={(e) => setEditDedAmt(e.target.value)} style={{ width: 80, padding: "4px 6px", fontSize: 12 }} />
                          <input className="sv-input" value={editDedReason} onChange={(e) => setEditDedReason(e.target.value)} style={{ flex: 1, padding: "4px 6px", fontSize: 12 }} />
                          <button onClick={() => saveEditDeduction(modal.empId)} style={{ padding: "4px 8px", background: GREEN, color: "var(--sv-surface)", border: "none", borderRadius: 5, cursor: "pointer", fontSize: 11, fontWeight: 700 }}>Save</button>
                          <button onClick={() => setEditDedId(null)} style={{ padding: "4px 8px", background: "var(--sv-surface-3)", color: "var(--sv-text-3)", border: "none", borderRadius: 5, cursor: "pointer", fontSize: 11 }}>×</button>
                        </>
                      ) : (
                        <>
                          <span style={{ fontWeight: 700, color: RED, fontSize: 13 }}>− {fmtSalary(ded.amount)}</span>
                          <span style={{ flex: 1, fontSize: 12, color: "#374151" }}>{ded.reason}</span>
                          <span className="sv-text-muted" style={{ fontSize: 11 }}>{fmtDate(ded.date)}</span>
                          <button onClick={() => { setEditDedId(ded.id); setEditDedAmt(String(ded.amount)); setEditDedReason(ded.reason); }} style={{ border: "none", background: "transparent", color: BLUE, cursor: "pointer", fontSize: 12 }}>✏️</button>
                          <button onClick={() => removeDeduction(modal.empId, ded.id)} style={{ border: "none", background: "transparent", color: RED, cursor: "pointer", fontSize: 14, fontWeight: 700 }}>×</button>
                        </>
                      )}
                    </div>
                  ))}
                </div>
              )}
              <div style={{ marginBottom: 10 }}>
                <label className="sv-label">Deduction Amount (₹)</label>
                <input type="number" min="0" className="sv-input" value={dedAmount} onChange={(e) => setDedAmount(e.target.value)} placeholder="e.g. 1000" />
              </div>
              <div style={{ marginBottom: 16 }}>
                <label className="sv-label">Reason</label>
                <input className="sv-input" value={dedReason} onChange={(e) => setDedReason(e.target.value)} placeholder="e.g. Loss of pay / advance" />
              </div>
              <div className="sv-flex sv-gap-2">
                <button className="sv-btn sv-btn--ghost sv-btn--full" onClick={() => setModal(null)}>Cancel</button>
                <button className="sv-btn sv-btn--primary sv-btn--full" onClick={addDeduction}>Add Deduction</button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Payment history modal */}
      {modal?.type === "history" && (() => {
        const emp = employees.find((e) => e.id === modal.empId);
        const sal = getSal(modal.empId);
        const totalInc = sumAmt(sal.incentives);
        const totalDed = sumAmt(sal.deductions);
        const total = (sal.fixedSalary || 0) + totalInc - totalDed;
        return (
          <div className="sv-modal-overlay" onClick={() => setModal(null)}>
            <div className="sv-modal" style={{ maxWidth: 560, maxHeight: "80vh", display: "flex", flexDirection: "column" }} onClick={(e) => e.stopPropagation()}>
              <div className="sv-modal-header" style={{ flexShrink: 0 }}>
                <div>
                  <span className="sv-text-navy sv-font-800" style={{ fontSize: 15 }}>Salary View — {emp?.name}</span>
                  <div className="sv-text-muted" style={{ fontSize: 12, marginTop: 2 }}>{emp?.id} · {emp?.department}</div>
                </div>
                <button onClick={() => setModal(null)} className="sv-modal-close">×</button>
              </div>
              <div className="sv-modal-body" style={{ overflowY: "auto" }}>
                <div className="sv-grid-2" style={{ gap: 10, marginBottom: 16 }}>
                  {[["Fixed Salary", fmtSalary(sal.fixedSalary || 0), NAVY], ["Incentives", fmtSalary(totalInc), GREEN], ["Deductions", totalDed > 0 ? fmtSalary(totalDed) : "N/A", RED], ["Net Salary", fmtSalary(total), BLUE]].map(([l, v, c]) => (
                    <div key={l} style={{ textAlign: "center", padding: "12px 8px", background: "var(--sv-surface-2)", borderRadius: 10, border: `2px solid ${c}20` }}>
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
                    <div key={p.id || i} style={{ padding: "10px 14px", background: "var(--sv-surface-2)", border: "1px solid var(--sv-border)", borderRadius: 8, marginBottom: 6 }}>
                      <div className="sv-flex sv-justify-between sv-items-center">
                        <span className="sv-text-navy sv-font-700" style={{ fontSize: 13 }}>{fmtDate(p.date)}</span>
                        <span style={{ fontWeight: 800, color: GREEN, fontSize: 14 }}>{fmtSalary(p.amount)}</span>
                      </div>
                      <div style={{ fontSize: 11.5, color: "var(--sv-text-3)", marginTop: 3 }}>
                        Fixed: {fmtSalary(p.fixed)} + Incentives: {fmtSalary(p.incentiveTotal)} − Deductions: {p.deductionTotal > 0 ? fmtSalary(p.deductionTotal) : "N/A"}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        );
      })()}

      {/* Confirm "Mark Salary as Paid?" */}
      {confirmPaid && (() => {
        const emp = employees.find((e) => e.id === confirmPaid);
        const sal = getSal(confirmPaid);
        const total = (sal.fixedSalary || 0) + sumAmt(sal.incentives) - sumAmt(sal.deductions);
        return (
          <div className="sv-modal-overlay" onClick={() => setConfirmPaid(null)}>
            <div className="sv-modal" style={{ maxWidth: 400, padding: 24 }} onClick={(e) => e.stopPropagation()}>
              <p className="sv-text-navy sv-font-800" style={{ fontSize: 16, margin: "0 0 8px" }}>Mark Salary as Paid?</p>
              <p className="sv-text-muted" style={{ fontSize: 13, margin: "0 0 16px" }}>
                This records a net payment of <b style={{ color: GREEN }}>{fmtSalary(total)}</b> for <b>{emp?.name}</b> and clears their pending incentives and deductions.
              </p>
              <div className="sv-flex sv-gap-2">
                <button className="sv-btn sv-btn--ghost sv-btn--full" onClick={() => setConfirmPaid(null)}>Cancel</button>
                <button className="sv-btn sv-btn--primary sv-btn--full" onClick={() => markPaid(confirmPaid)}>Yes, Mark as Paid</button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Payslip preview -> Send to Employee */}
      {preview && (() => {
        const emp = employees.find((e) => e.id === preview.empId);
        return (
          <div className="sv-modal-overlay" onClick={() => !sending && setPreview(null)}>
            <div className="sv-modal" style={{ maxWidth: 580, maxHeight: "88vh", display: "flex", flexDirection: "column" }} onClick={(e) => e.stopPropagation()}>
              <div className="sv-modal-header" style={{ flexShrink: 0 }}>
                <span className="sv-text-navy sv-font-800" style={{ fontSize: 15 }}>Payslip Preview — {emp?.name}</span>
                <button onClick={() => setPreview(null)} className="sv-modal-close">×</button>
              </div>
              <div className="sv-modal-body" style={{ overflowY: "auto", background: "var(--sv-surface-3)" }}>
                <PayslipView payload={preview.payload} employee={emp} logo={logo} />
              </div>
              <div className="sv-flex sv-gap-2" style={{ padding: 16, borderTop: "1px solid var(--sv-border)", flexShrink: 0 }}>
                <button className="sv-btn sv-btn--ghost sv-btn--full" onClick={() => setPreview(null)} disabled={sending}>Cancel</button>
                <button className="sv-btn sv-btn--primary sv-btn--full" onClick={sendPayslip} disabled={sending}>{sending ? "Sending…" : "Send to Employee"}</button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
