import { useState, useMemo } from "react";
import Avatar from "../ui/Avatar.jsx";
import { storageSet } from "../../utils/storage.js";
import { fmtSalary, fmtDate, getTodayStr, empLabel, buildPayslipMessage } from "../../utils/helpers.js";
import { GREEN, BLUE, NAVY, RED } from "../../utils/constants.js";
import PayslipView from "../PayslipView.jsx";
import {
  Wallet, Users, Briefcase, IndianRupee, TrendingUp, TrendingDown,
  Plus, Pencil, Trash2, Eye, CheckCircle2, FileText, Search, X, CalendarDays,
} from "lucide-react";

/**
 * SalaryModule — Admin "Salary" tab (premium payroll workspace).
 *
 * UI/UX redesign only — the employee salary engine is unchanged: fixed
 * salary, incentives, deductions, mark-Paid (records a payment + captures an
 * expense), and payslip preview/send all behave exactly as before. New:
 *   • KPI dashboard + monthly payroll summary
 *   • Full-Time / Freelancers / History sub-tabs
 *   • Freelancers (manual, non-user payees) with add/edit/delete/pay, stored
 *     in the settings-backed `freelancers` list (no schema change). Their
 *     payments show in the combined Salary History.
 */
const money = (n) => fmtSalary(n || 0);
const mKey = (d) => String(d || "").slice(0, 7);
const PTYPES = ["Monthly", "Per Project", "Hourly"];

export default function SalaryModule({ employees, salaries, setSalaries, showToast, pushNotification, addMessage, captureExpense, editMode = false, setEditMode, settingsPwd = "Settings@123", logo = "", freelancers = [], saveFreelancers }) {
  const [view, setView] = useState("fulltime"); // fulltime | freelancers | history
  const [search, setSearch] = useState("");
  const [unlockOpen, setUnlockOpen] = useState(false);
  const [unlockPwd, setUnlockPwd] = useState("");

  // Unlock salary editing in-place (same check as the Settings lock bar:
  // matches the Settings Password, then enables edit mode). Security unchanged.
  const doUnlock = () => {
    if (unlockPwd === settingsPwd) {
      setEditMode && setEditMode(true);
      setUnlockOpen(false); setUnlockPwd("");
      showToast("Salary editing unlocked.", "success");
    } else {
      showToast("Incorrect Settings Password.", "error");
    }
  };

  // ── existing employee-salary state (unchanged) ──
  const [modal, setModal] = useState(null); // { empId, type: "incentive"|"deduction"|"history" }
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
  const [confirmPaid, setConfirmPaid] = useState(null);
  const [preview, setPreview] = useState(null);
  const [sending, setSending] = useState(false);

  // ── freelancer state ──
  const [fModal, setFModal] = useState(null); // { mode:"add"|"edit", id? }
  const blankF = { name: "", company: "", role: "", paymentType: "Monthly", amount: "", paymentDate: getTodayStr(), status: "Active", notes: "" };
  const [fForm, setFForm] = useState(blankF);
  const [fPay, setFPay] = useState(null); // freelancer id being paid
  const [fPayForm, setFPayForm] = useState({ amount: "", date: getTodayStr(), note: "" });
  const [confirm, setConfirm] = useState(null); // { message, onYes }

  const getSal = (id) => salaries[id] || { fixedSalary: 0, incentives: [], deductions: [], payments: [] };
  const sumAmt = (arr) => (arr || []).reduce((a, b) => a + (b.amount || 0), 0);

  const setFixed = async (empId, v) => {
    const curr = getSal(empId);
    const u = { ...salaries, [empId]: { ...curr, fixedSalary: +v || 0 } };
    setSalaries(u); await storageSet("svd_salaries", JSON.stringify(u));
  };

  /* ── Incentives (unchanged) ── */
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

  /* ── Deductions (unchanged) ── */
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
    if (emp) pushNotification(`Salary paid to ${empLabel(emp)}: ${fmtSalary(total)}`);
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
          employeeId: empId, employeeName: emp.name || "", department: emp.department || "",
          month: d.toLocaleDateString("en-IN", { month: "long" }), year: d.getFullYear(), monthKey,
          fixed: pay.fixed, incentiveTotal: pay.incentiveTotal, deductionTotal: pay.deductionTotal,
          incentives: pay.incentives, deductions: pay.deductions, finalSalary: total,
        },
      });
    }
  };

  const buildPayload = (empId) => {
    const emp = employees.find((e) => e.id === empId);
    const sal = getSal(empId);
    const pendingInc = sal.incentives || [];
    const pendingDed = sal.deductions || [];
    const payments = sal.payments || [];
    const last = payments.length ? payments[payments.length - 1] : null;
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
    return { month, year, monthKey, date: baseDate, empName: emp?.name || "", empId, fixed, incentives, incentiveTotal, deductions, deductionTotal, total };
  };
  // Payslip for a specific historical payment (used from History).
  const buildPayloadFromPayment = (emp, p) => {
    const d = new Date((p.date || getTodayStr()) + "T00:00:00");
    return {
      month: d.toLocaleDateString("en-IN", { month: "long" }), year: d.getFullYear(),
      monthKey: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`, date: p.date,
      empName: emp?.name || "", empId: emp?.id,
      fixed: p.fixed || 0,
      incentives: (p.incentives || []).map((i) => ({ reason: i.reason, amount: i.amount })), incentiveTotal: p.incentiveTotal || 0,
      deductions: (p.deductions || []).map((i) => ({ reason: i.reason, amount: i.amount })), deductionTotal: p.deductionTotal || 0,
      total: p.amount || 0,
    };
  };

  const openPayslipPreview = (empId) => setPreview({ empId, payload: buildPayload(empId) });
  const sendPayslip = async () => {
    if (!preview) return;
    const { empId, payload } = preview;
    const emp = employees.find((e) => e.id === empId);
    setSending(true);
    try { await addMessage(empId, buildPayslipMessage(payload)); } finally { setSending(false); }
    if (emp) pushNotification(`Payslip for ${empLabel(emp)} (${payload.month} ${payload.year}) sent — Net ${fmtSalary(payload.total)}`);
    showToast(`Payslip sent to ${emp?.name || "employee"}`);
    setPreview(null);
  };

  /* ── Freelancers ── */
  const persistF = (next) => saveFreelancers ? saveFreelancers(next) : null;
  const openAddF = () => { setFForm(blankF); setFModal({ mode: "add" }); };
  const openEditF = (fr) => { setFForm({ ...blankF, ...fr, amount: fr.amount ?? "" }); setFModal({ mode: "edit", id: fr.id }); };
  const saveF = () => {
    if (!fForm.name.trim()) { showToast("Freelancer name is required", "err"); return; }
    const clean = { name: fForm.name.trim(), company: fForm.company.trim(), role: fForm.role.trim(), paymentType: fForm.paymentType, amount: +fForm.amount || 0, paymentDate: fForm.paymentDate, status: fForm.status, notes: fForm.notes };
    if (fModal.mode === "add") {
      persistF([...(freelancers || []), { id: `fr${Date.now()}`, ...clean, payments: [] }]);
      showToast("Freelancer added");
    } else {
      persistF((freelancers || []).map((f) => (f.id === fModal.id ? { ...f, ...clean } : f)));
      showToast("Freelancer updated");
    }
    setFModal(null);
  };
  const doDeleteF = (id) => { persistF((freelancers || []).filter((f) => f.id !== id)); showToast("Freelancer removed"); };
  const askDeleteF = (fr) => setConfirm({ message: `Remove freelancer "${fr.name}"? Their payment history will be deleted.`, onYes: () => doDeleteF(fr.id) });

  const openPayF = (fr) => { setFPayForm({ amount: fr.amount || "", date: getTodayStr(), note: "" }); setFPay(fr.id); };
  const doPayF = () => {
    const fr = (freelancers || []).find((f) => f.id === fPay);
    const amt = +fPayForm.amount || 0;
    if (!fr || amt <= 0) { showToast("Enter a valid amount", "err"); return; }
    const payment = { id: `fp${Date.now()}`, amount: amt, date: fPayForm.date, note: fPayForm.note.trim(), method: "Freelance" };
    persistF((freelancers || []).map((f) => (f.id === fr.id ? { ...f, payments: [...(f.payments || []), payment] } : f)));
    if (captureExpense) {
      captureExpense({
        type: "salary", sourceKey: `freelancer:${fr.id}:${payment.id}`,
        title: `Freelancer — ${fr.name}`, category: "Freelancer", clientName: fr.name,
        paymentStatus: "Paid", paymentDate: payment.date, amount: amt, currency: "INR", paymentMethod: "Freelance",
        details: { freelancerId: fr.id, freelancerName: fr.name, company: fr.company, role: fr.role, paymentType: fr.paymentType, note: payment.note, finalSalary: amt },
      });
    }
    pushNotification(`Freelancer paid: ${fr.name} — ${fmtSalary(amt)}`);
    showToast("Freelancer payment recorded");
    setFPay(null);
  };

  /* ── KPI + payroll (current month) ── */
  const cur = new Date().toISOString().slice(0, 7);
  const kpi = useMemo(() => {
    let empPaid = 0, freePaid = 0, incPaid = 0, dedPaid = 0;
    const empPaidIds = new Set(), freePaidIds = new Set();
    Object.entries(salaries || {}).forEach(([id, s]) => {
      (s.payments || []).forEach((p) => { if (mKey(p.date) === cur) { empPaid += p.amount || 0; incPaid += p.incentiveTotal || 0; dedPaid += p.deductionTotal || 0; empPaidIds.add(id); } });
    });
    (freelancers || []).forEach((f) => (f.payments || []).forEach((p) => { if (mKey(p.date) === cur) { freePaid += p.amount || 0; freePaidIds.add(f.id); } }));
    const pendingInc = Object.values(salaries || {}).reduce((a, s) => a + sumAmt(s.incentives), 0);
    const pendingDed = Object.values(salaries || {}).reduce((a, s) => a + sumAmt(s.deductions), 0);
    const netPayable = employees.reduce((a, e) => { const s = getSal(e.id); return a + (s.fixedSalary || 0) + sumAmt(s.incentives) - sumAmt(s.deductions); }, 0);
    const withSalary = employees.filter((e) => (getSal(e.id).fixedSalary || 0) > 0).length;
    const completion = withSalary > 0 ? Math.round((empPaidIds.size / withSalary) * 100) : 0;
    return { empPaid, freePaid, total: empPaid + freePaid, incPaid, dedPaid, pendingInc, pendingDed, netPayable, empPaidCount: empPaidIds.size, freePaidCount: freePaidIds.size, pending: Math.max(0, withSalary - empPaidIds.size), completion };
  }, [salaries, freelancers, employees, cur]);

  /* ── Combined history records ── */
  const historyRecords = useMemo(() => {
    const rows = [];
    Object.entries(salaries || {}).forEach(([id, s]) => {
      const emp = employees.find((e) => e.id === id);
      (s.payments || []).forEach((p) => rows.push({
        key: p.id || `${id}-${p.date}`, kind: "Employee", emp, name: emp?.name || id, sub: emp?.department || "—",
        gross: p.fixed || 0, incentive: p.incentiveTotal || 0, deduction: p.deductionTotal || 0, final: p.amount || 0,
        date: p.date, payment: p, empId: id,
      }));
    });
    (freelancers || []).forEach((f) => (f.payments || []).forEach((p) => rows.push({
      key: p.id, kind: "Freelancer", name: f.name, sub: f.role || f.company || "Freelancer",
      gross: p.amount || 0, incentive: 0, deduction: 0, final: p.amount || 0, date: p.date, note: p.note,
    })));
    return rows.sort((a, b) => String(b.date).localeCompare(String(a.date)));
  }, [salaries, freelancers, employees]);

  const [histType, setHistType] = useState("All");   // All | Employee | Freelancer
  const [histPeriod, setHistPeriod] = useState("Month"); // Today | Month | Year | All
  const [histSearch, setHistSearch] = useState("");
  const nowIso = new Date().toISOString();
  const periodPrefix = histPeriod === "Today" ? nowIso.slice(0, 10) : histPeriod === "Month" ? nowIso.slice(0, 7) : histPeriod === "Year" ? nowIso.slice(0, 4) : "";
  const histFiltered = historyRecords.filter((r) => {
    if (histType !== "All" && r.kind !== histType) return false;
    if (periodPrefix && !String(r.date || "").startsWith(periodPrefix)) return false;
    if (histSearch) { const q = histSearch.toLowerCase(); return [r.name, r.sub].some((v) => (v || "").toLowerCase().includes(q)); }
    return true;
  });

  const empFiltered = employees.filter((e) => !search || [e.name, e.id, e.department].some((v) => (v || "").toLowerCase().includes(search.toLowerCase())));
  const frFiltered = (freelancers || []).filter((f) => !search || [f.name, f.company, f.role].some((v) => (v || "").toLowerCase().includes(search.toLowerCase())));

  const Kpi = ({ icon, label, value, color, note }) => (
    <div className="sv-sal-kpi">
      <span className="sv-sal-kpi-ic" style={{ background: `${color}1A`, color }}>{icon}</span>
      <div style={{ minWidth: 0 }}>
        <div className="sv-sal-kpi-v">{value}</div>
        <div className="sv-sal-kpi-l">{label}</div>
        {note && <div className="sv-sal-kpi-note">{note}</div>}
      </div>
    </div>
  );

  const lastPayOf = (payments) => (payments && payments.length ? payments[payments.length - 1] : null);

  return (
    <div className="sv-flex-col sv-gap-4">
      {/* KPI dashboard */}
      <div className="sv-sal-kpis">
        <Kpi icon={<Wallet size={18} />} label="Payroll this month" value={money(kpi.total)} color="#3B82F6" note={`${kpi.empPaidCount} emp · ${kpi.freePaidCount} freelance`} />
        <Kpi icon={<Users size={18} />} label="Employee salary" value={money(kpi.empPaid)} color="#22C55E" />
        <Kpi icon={<Briefcase size={18} />} label="Freelancer payments" value={money(kpi.freePaid)} color="#8B5CF6" />
        <Kpi icon={<TrendingUp size={18} />} label="Pending incentives" value={money(kpi.pendingInc)} color="#0EA5E9" />
        <Kpi icon={<TrendingDown size={18} />} label="Pending deductions" value={money(kpi.pendingDed)} color="#EF4444" />
        <Kpi icon={<IndianRupee size={18} />} label="Net payable now" value={money(kpi.netPayable)} color="#F59E0B" />
      </div>

      {/* Monthly payroll summary */}
      <div className="sv-card sv-sal-payroll">
        <div className="sv-flex sv-items-center sv-gap-2" style={{ marginBottom: 12 }}>
          <span className="sv-mod-icon"><CalendarDays size={16} /></span>
          <div>
            <p className="sv-text-navy sv-font-800" style={{ margin: 0, fontSize: 15.5 }}>Payroll Summary · {new Date().toLocaleDateString("en-IN", { month: "long", year: "numeric" })}</p>
            <p className="sv-text-muted" style={{ margin: 0, fontSize: 12 }}>This month's payroll at a glance</p>
          </div>
        </div>
        <div className="sv-sal-payroll-grid">
          {[["Employees paid", kpi.empPaidCount], ["Freelancers paid", kpi.freePaidCount], ["Total payroll", money(kpi.total)], ["Incentives", money(kpi.incPaid)], ["Deductions", money(kpi.dedPaid)], ["Pending", kpi.pending]].map(([l, v]) => (
            <div key={l} className="sv-sal-psum"><div className="sv-sal-psum-v">{v}</div><div className="sv-sal-psum-l">{l}</div></div>
          ))}
          <div className="sv-sal-psum sv-sal-psum--prog">
            <div className="sv-sal-psum-v">{kpi.completion}%</div><div className="sv-sal-psum-l">Completed</div>
            <span className="sv-team-prog"><span className="sv-team-prog-bar" style={{ width: `${kpi.completion}%`, background: "#22C55E" }} /></span>
          </div>
        </div>
      </div>

      {/* Sub-tabs + toolbar */}
      <div className="sv-card">
        <div className="sv-sal-head">
          <div className="sv-seg">
            {[["fulltime", "Full-Time"], ["freelancers", "Freelancers"], ["history", "History"]].map(([k, l]) => (
              <button key={k} className={`sv-seg-btn${view === k ? " sv-seg-btn--on" : ""}`} onClick={() => setView(k)}>{l}</button>
            ))}
          </div>
          {view !== "history" && (
            <div className="sv-flex sv-items-center sv-gap-2">
              <div className="sv-mailids-search"><Search size={14} /><input placeholder="Search…" value={search} onChange={(e) => setSearch(e.target.value)} /></div>
              {view === "freelancers" && <button className="sv-btn sv-btn--primary sv-btn--sm" onClick={openAddF}><Plus size={14} /> Add Freelancer</button>}
            </div>
          )}
        </div>

        {!editMode && view !== "history" && (
          <div className="sv-sal-lock">
            <span className="sv-sal-lock-msg">🔒 Salary editing is locked. Unlock it with the Settings Password.</span>
            {unlockOpen ? (
              <div className="sv-sal-unlock-form">
                <input type="password" className="sv-input" autoFocus placeholder="Settings Password" value={unlockPwd}
                  onChange={(e) => setUnlockPwd(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") doUnlock(); if (e.key === "Escape") { setUnlockOpen(false); setUnlockPwd(""); } }} />
                <button className="sv-btn sv-btn--primary sv-btn--sm" onClick={doUnlock} disabled={!unlockPwd}>Unlock</button>
                <button className="sv-btn sv-btn--outline sv-btn--sm" onClick={() => { setUnlockOpen(false); setUnlockPwd(""); }}>Cancel</button>
              </div>
            ) : (
              <button className="sv-btn sv-btn--primary sv-btn--sm sv-sal-unlock-btn" onClick={() => setUnlockOpen(true)}>Unlock Salary</button>
            )}
          </div>
        )}

        {/* ── Full-Time ── */}
        {view === "fulltime" && (
          empFiltered.length === 0 ? (
            <div className="sv-leave-empty"><Users size={26} /><span>No employees to show.</span></div>
          ) : (
            <div className="sv-sal-grid">
              {empFiltered.map((emp, i) => {
                const sal = getSal(emp.id);
                const totalInc = sumAmt(sal.incentives), totalDed = sumAmt(sal.deductions);
                const total = (sal.fixedSalary || 0) + totalInc - totalDed;
                const last = lastPayOf(sal.payments);
                const paidThisMonth = (sal.payments || []).some((p) => mKey(p.date) === cur);
                return (
                  <div key={emp.id} className="sv-sal-card">
                    <div className="sv-sal-card-top">
                      <Avatar emp={emp} idx={i} size={40} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div className="sv-text-navy sv-font-700" style={{ fontSize: 14 }}>{emp.name}</div>
                        <div className="sv-text-muted" style={{ fontSize: 11 }}>{emp.id} · {emp.department || "Sales"}</div>
                      </div>
                      <span className={`sv-team-badge sv-team-badge--${paidThisMonth ? "active" : "pending"}`}><span className="sv-team-badge-dot" />{paidThisMonth ? "Paid" : "Pending"}</span>
                    </div>
                    <div className="sv-sal-figs">
                      <div className="sv-sal-fig"><span>Fixed</span>
                        <input type="number" min="0" disabled={!editMode} className="sv-input sv-sal-fixed" value={sal.fixedSalary || ""} placeholder="0" onChange={(e) => setFixed(emp.id, e.target.value)} />
                      </div>
                      <div className="sv-sal-fig"><span>Incentives</span><b style={{ color: GREEN }}>{money(totalInc)}</b></div>
                      <div className="sv-sal-fig"><span>Deductions</span><b style={{ color: RED }}>{totalDed > 0 ? money(totalDed) : "N/A"}</b></div>
                      <div className="sv-sal-fig sv-sal-fig--net"><span>Net Salary</span><b>{money(total)}</b></div>
                    </div>
                    <div className="sv-sal-meta">{last ? `Last paid ${fmtDate(last.date)} · ${money(last.amount)}` : "No payments yet"}</div>
                    <div className="sv-sal-actions">
                      <button disabled={!editMode} className="sv-chip-btn sv-chip-btn--blue" onClick={() => setModal({ empId: emp.id, type: "incentive" })}><Plus size={12} /> Incentive</button>
                      <button disabled={!editMode} className="sv-chip-btn sv-chip-btn--red" onClick={() => setModal({ empId: emp.id, type: "deduction" })}><TrendingDown size={12} /> Deduction</button>
                      <button className="sv-chip-btn sv-chip-btn--violet" onClick={() => setModal({ empId: emp.id, type: "history" })}><Eye size={12} /> View</button>
                      <button disabled={!editMode} className="sv-chip-btn sv-chip-btn--green" onClick={() => setConfirmPaid(emp.id)}><CheckCircle2 size={12} /> Paid</button>
                      <button disabled={!editMode} className="sv-chip-btn sv-chip-btn--amber" onClick={() => openPayslipPreview(emp.id)}><FileText size={12} /> Payslip</button>
                    </div>
                  </div>
                );
              })}
            </div>
          )
        )}

        {/* ── Freelancers ── */}
        {view === "freelancers" && (
          frFiltered.length === 0 ? (
            <div className="sv-leave-empty"><Briefcase size={26} /><span>No freelancers added yet.</span>
              <button className="sv-btn sv-btn--primary sv-btn--sm" style={{ marginTop: 6 }} onClick={openAddF}><Plus size={14} /> Add Freelancer</button>
            </div>
          ) : (
            <div className="sv-sal-grid">
              {frFiltered.map((fr) => {
                const paid = (fr.payments || []).reduce((a, p) => a + (p.amount || 0), 0);
                const last = lastPayOf(fr.payments);
                return (
                  <div key={fr.id} className="sv-sal-card">
                    <div className="sv-sal-card-top">
                      <span className="sv-team-avatar" style={{ background: "#8B5CF6", width: 40, height: 40, borderRadius: 11 }}>{(fr.name || "?").slice(0, 2).toUpperCase()}</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div className="sv-text-navy sv-font-700" style={{ fontSize: 14 }}>{fr.name}</div>
                        <div className="sv-text-muted" style={{ fontSize: 11 }}>{fr.role || "Freelancer"}{fr.company ? ` · ${fr.company}` : ""}</div>
                      </div>
                      <span className={`sv-team-badge sv-team-badge--${(fr.status || "Active") === "Active" ? "active" : "pending"}`}><span className="sv-team-badge-dot" />{fr.status || "Active"}</span>
                    </div>
                    <div className="sv-sal-figs">
                      <div className="sv-sal-fig"><span>Payment type</span><b>{fr.paymentType}</b></div>
                      <div className="sv-sal-fig"><span>Rate / amount</span><b>{money(fr.amount)}</b></div>
                      <div className="sv-sal-fig"><span>Total paid</span><b style={{ color: GREEN }}>{money(paid)}</b></div>
                      <div className="sv-sal-fig sv-sal-fig--net"><span>Last payment</span><b>{last ? money(last.amount) : "—"}</b></div>
                    </div>
                    <div className="sv-sal-meta">{last ? `Last paid ${fmtDate(last.date)}` : "No payments yet"}{fr.notes ? ` · ${fr.notes}` : ""}</div>
                    <div className="sv-sal-actions">
                      <button className="sv-chip-btn sv-chip-btn--green" onClick={() => openPayF(fr)}><IndianRupee size={12} /> Pay</button>
                      <button className="sv-chip-btn sv-chip-btn--violet" onClick={() => setModal({ frId: fr.id, type: "fhistory" })}><Eye size={12} /> History</button>
                      <button className="sv-chip-btn sv-chip-btn--blue" onClick={() => openEditF(fr)}><Pencil size={12} /> Edit</button>
                      <button className="sv-chip-btn sv-chip-btn--red" onClick={() => askDeleteF(fr)}><Trash2 size={12} /> Delete</button>
                    </div>
                  </div>
                );
              })}
            </div>
          )
        )}

        {/* ── History ── */}
        {view === "history" && (
          <div>
            <div className="sv-leave-hist-tools" style={{ marginBottom: 12 }}>
              <div className="sv-mailids-search"><Search size={14} /><input placeholder="Search name / role…" value={histSearch} onChange={(e) => setHistSearch(e.target.value)} /></div>
              <div className="sv-seg">{["Today", "Month", "Year", "All"].map((p) => <button key={p} className={`sv-seg-btn${histPeriod === p ? " sv-seg-btn--on" : ""}`} onClick={() => setHistPeriod(p)}>{p}</button>)}</div>
              <div className="sv-seg">{["All", "Employee", "Freelancer"].map((t) => <button key={t} className={`sv-seg-btn${histType === t ? " sv-seg-btn--on" : ""}`} onClick={() => setHistType(t)}>{t}</button>)}</div>
            </div>
            {histFiltered.length === 0 ? (
              <div className="sv-leave-empty"><FileText size={26} /><span>No payment records for this filter.</span></div>
            ) : (
              <div className="sv-mailids-scroll">
                <table className="sv-mailids-table">
                  <thead><tr>{["Payee", "Type", "Gross", "Incentive", "Deduction", "Final", "Date", ""].map((h) => <th key={h}>{h}</th>)}</tr></thead>
                  <tbody>
                    {histFiltered.map((r) => (
                      <tr key={r.key}>
                        <td><div className="sv-text-navy sv-font-700" style={{ fontSize: 13 }}>{r.name}</div><div className="sv-text-muted" style={{ fontSize: 11 }}>{r.sub}</div></td>
                        <td><span className={`sv-team-badge sv-team-badge--${r.kind === "Employee" ? "active" : "pending"}`} style={{ background: r.kind === "Freelancer" ? "rgba(139,92,246,.14)" : undefined, color: r.kind === "Freelancer" ? "#7C3AED" : undefined }}>{r.kind}</span></td>
                        <td>{money(r.gross)}</td>
                        <td style={{ color: GREEN, fontWeight: 700 }}>{r.incentive ? money(r.incentive) : "—"}</td>
                        <td style={{ color: RED, fontWeight: 700 }}>{r.deduction ? money(r.deduction) : "—"}</td>
                        <td className="sv-text-navy" style={{ fontWeight: 800 }}>{money(r.final)}</td>
                        <td>{fmtDate(r.date)}</td>
                        <td>{r.kind === "Employee" && r.emp ? <button className="sv-icon-btn sv-icon-btn--edit" title="Payslip" onClick={() => setPreview({ empId: r.empId, payload: buildPayloadFromPayment(r.emp, r.payment) })}><FileText size={13} /></button> : (r.note ? <span className="sv-mailids-muted" title={r.note}>note</span> : null)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Incentive modal (unchanged logic) */}
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
                          <button onClick={() => saveEditIncentive(modal.empId)} style={{ padding: "4px 8px", background: GREEN, color: "#fff", border: "none", borderRadius: 5, cursor: "pointer", fontSize: 11, fontWeight: 700 }}>Save</button>
                          <button onClick={() => setEditIncId(null)} style={{ padding: "4px 8px", background: "var(--sv-surface-3)", color: "var(--sv-text-3)", border: "none", borderRadius: 5, cursor: "pointer", fontSize: 11 }}>×</button>
                        </>
                      ) : (
                        <>
                          <span style={{ fontWeight: 700, color: GREEN, fontSize: 13 }}>{money(inc.amount)}</span>
                          <span style={{ flex: 1, fontSize: 12, color: "var(--sv-text-2)" }}>{inc.reason}</span>
                          <span className="sv-text-muted" style={{ fontSize: 11 }}>{fmtDate(inc.date)}</span>
                          <button onClick={() => { setEditIncId(inc.id); setEditIncAmt(String(inc.amount)); setEditIncReason(inc.reason); }} style={{ border: "none", background: "transparent", color: BLUE, cursor: "pointer" }}><Pencil size={13} /></button>
                          <button onClick={() => removeIncentive(modal.empId, inc.id)} style={{ border: "none", background: "transparent", color: RED, cursor: "pointer", fontSize: 14, fontWeight: 700 }}>×</button>
                        </>
                      )}
                    </div>
                  ))}
                </div>
              )}
              <div style={{ marginBottom: 10 }}><label className="sv-label">Amount (₹)</label><input type="number" min="0" className="sv-input" value={incAmount} onChange={(e) => setIncAmount(e.target.value)} placeholder="e.g. 5000" /></div>
              <div style={{ marginBottom: 16 }}><label className="sv-label">Reason</label><input className="sv-input" value={incReason} onChange={(e) => setIncReason(e.target.value)} placeholder="e.g. Performance bonus" /></div>
              <div className="sv-flex sv-gap-2">
                <button className="sv-btn sv-btn--ghost sv-btn--full" onClick={() => setModal(null)}>Cancel</button>
                <button className="sv-btn sv-btn--primary sv-btn--full" onClick={addIncentive}>Add Incentive</button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Deduction modal (unchanged logic) */}
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
                          <button onClick={() => saveEditDeduction(modal.empId)} style={{ padding: "4px 8px", background: GREEN, color: "#fff", border: "none", borderRadius: 5, cursor: "pointer", fontSize: 11, fontWeight: 700 }}>Save</button>
                          <button onClick={() => setEditDedId(null)} style={{ padding: "4px 8px", background: "var(--sv-surface-3)", color: "var(--sv-text-3)", border: "none", borderRadius: 5, cursor: "pointer", fontSize: 11 }}>×</button>
                        </>
                      ) : (
                        <>
                          <span style={{ fontWeight: 700, color: RED, fontSize: 13 }}>− {money(ded.amount)}</span>
                          <span style={{ flex: 1, fontSize: 12, color: "var(--sv-text-2)" }}>{ded.reason}</span>
                          <span className="sv-text-muted" style={{ fontSize: 11 }}>{fmtDate(ded.date)}</span>
                          <button onClick={() => { setEditDedId(ded.id); setEditDedAmt(String(ded.amount)); setEditDedReason(ded.reason); }} style={{ border: "none", background: "transparent", color: BLUE, cursor: "pointer" }}><Pencil size={13} /></button>
                          <button onClick={() => removeDeduction(modal.empId, ded.id)} style={{ border: "none", background: "transparent", color: RED, cursor: "pointer", fontSize: 14, fontWeight: 700 }}>×</button>
                        </>
                      )}
                    </div>
                  ))}
                </div>
              )}
              <div style={{ marginBottom: 10 }}><label className="sv-label">Deduction Amount (₹)</label><input type="number" min="0" className="sv-input" value={dedAmount} onChange={(e) => setDedAmount(e.target.value)} placeholder="e.g. 1000" /></div>
              <div style={{ marginBottom: 16 }}><label className="sv-label">Reason</label><input className="sv-input" value={dedReason} onChange={(e) => setDedReason(e.target.value)} placeholder="e.g. Loss of pay / advance" /></div>
              <div className="sv-flex sv-gap-2">
                <button className="sv-btn sv-btn--ghost sv-btn--full" onClick={() => setModal(null)}>Cancel</button>
                <button className="sv-btn sv-btn--primary sv-btn--full" onClick={addDeduction}>Add Deduction</button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Employee salary view/history modal (unchanged) */}
      {modal?.type === "history" && (() => {
        const emp = employees.find((e) => e.id === modal.empId);
        const sal = getSal(modal.empId);
        const totalInc = sumAmt(sal.incentives), totalDed = sumAmt(sal.deductions);
        const total = (sal.fixedSalary || 0) + totalInc - totalDed;
        return (
          <div className="sv-modal-overlay" onClick={() => setModal(null)}>
            <div className="sv-modal" style={{ maxWidth: 560, maxHeight: "80vh", display: "flex", flexDirection: "column" }} onClick={(e) => e.stopPropagation()}>
              <div className="sv-modal-header" style={{ flexShrink: 0 }}>
                <div><span className="sv-text-navy sv-font-800" style={{ fontSize: 15 }}>Salary View — {emp?.name}</span><div className="sv-text-muted" style={{ fontSize: 12, marginTop: 2 }}>{emp?.id} · {emp?.department}</div></div>
                <button onClick={() => setModal(null)} className="sv-modal-close">×</button>
              </div>
              <div className="sv-modal-body" style={{ overflowY: "auto" }}>
                <div className="sv-grid-2" style={{ gap: 10, marginBottom: 16 }}>
                  {[["Fixed Salary", money(sal.fixedSalary || 0), NAVY], ["Incentives", money(totalInc), GREEN], ["Deductions", totalDed > 0 ? money(totalDed) : "N/A", RED], ["Net Salary", money(total), BLUE]].map(([l, v, c]) => (
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
                        <span style={{ fontWeight: 800, color: GREEN, fontSize: 14 }}>{money(p.amount)}</span>
                      </div>
                      <div style={{ fontSize: 11.5, color: "var(--sv-text-3)", marginTop: 3 }}>Fixed: {money(p.fixed)} + Incentives: {money(p.incentiveTotal)} − Deductions: {p.deductionTotal > 0 ? money(p.deductionTotal) : "N/A"}</div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        );
      })()}

      {/* Freelancer payment history modal */}
      {modal?.type === "fhistory" && (() => {
        const fr = (freelancers || []).find((f) => f.id === modal.frId);
        if (!fr) return null;
        const paid = (fr.payments || []).reduce((a, p) => a + (p.amount || 0), 0);
        return (
          <div className="sv-modal-overlay" onClick={() => setModal(null)}>
            <div className="sv-modal" style={{ maxWidth: 520, maxHeight: "80vh", display: "flex", flexDirection: "column" }} onClick={(e) => e.stopPropagation()}>
              <div className="sv-modal-header" style={{ flexShrink: 0 }}>
                <div><span className="sv-text-navy sv-font-800" style={{ fontSize: 15 }}>{fr.name}</span><div className="sv-text-muted" style={{ fontSize: 12, marginTop: 2 }}>{fr.role || "Freelancer"}{fr.company ? ` · ${fr.company}` : ""} · Total paid {money(paid)}</div></div>
                <button onClick={() => setModal(null)} className="sv-modal-close">×</button>
              </div>
              <div className="sv-modal-body" style={{ overflowY: "auto" }}>
                {(fr.payments || []).length === 0 ? (
                  <p className="sv-text-muted" style={{ fontSize: 13, textAlign: "center", padding: "16px 0" }}>No payments recorded yet.</p>
                ) : (
                  [...(fr.payments || [])].reverse().map((p) => (
                    <div key={p.id} style={{ padding: "10px 14px", background: "var(--sv-surface-2)", border: "1px solid var(--sv-border)", borderRadius: 8, marginBottom: 6 }}>
                      <div className="sv-flex sv-justify-between sv-items-center">
                        <span className="sv-text-navy sv-font-700" style={{ fontSize: 13 }}>{fmtDate(p.date)}</span>
                        <span style={{ fontWeight: 800, color: GREEN, fontSize: 14 }}>{money(p.amount)}</span>
                      </div>
                      {p.note && <div style={{ fontSize: 11.5, color: "var(--sv-text-3)", marginTop: 3 }}>{p.note}</div>}
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        );
      })()}

      {/* Confirm Mark Paid (employee) — unchanged */}
      {confirmPaid && (() => {
        const emp = employees.find((e) => e.id === confirmPaid);
        const sal = getSal(confirmPaid);
        const total = (sal.fixedSalary || 0) + sumAmt(sal.incentives) - sumAmt(sal.deductions);
        return (
          <div className="sv-modal-overlay" onClick={() => setConfirmPaid(null)}>
            <div className="sv-modal sv-confirm" onClick={(e) => e.stopPropagation()}>
              <p className="sv-confirm-msg">Mark salary as Paid for {emp?.name}?</p>
              <p className="sv-confirm-sub">Records a net payment of {money(total)} and clears pending incentives &amp; deductions. Do you want to proceed?</p>
              <div className="sv-confirm-actions">
                <button className="sv-btn sv-btn--outline" onClick={() => setConfirmPaid(null)}>No</button>
                <button className="sv-btn sv-btn--success" onClick={() => markPaid(confirmPaid)}>Yes, Mark Paid</button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Payslip preview (unchanged) */}
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

      {/* Freelancer add/edit modal */}
      {fModal && (
        <div className="sv-modal-overlay" onClick={() => setFModal(null)}>
          <div className="sv-modal" style={{ maxWidth: 460 }} onClick={(e) => e.stopPropagation()}>
            <div className="sv-modal-header">
              <span className="sv-text-navy sv-font-800" style={{ fontSize: 16 }}>{fModal.mode === "add" ? "Add Freelancer" : "Edit Freelancer"}</span>
              <button onClick={() => setFModal(null)} className="sv-modal-close">×</button>
            </div>
            <div style={{ padding: "16px 20px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <label className="sv-team-ctl" style={{ gridColumn: "1 / -1" }}><span>Full name *</span><input className="sv-input" value={fForm.name} onChange={(e) => setFForm({ ...fForm, name: e.target.value })} placeholder="Freelancer name" /></label>
              <label className="sv-team-ctl"><span>Company (optional)</span><input className="sv-input" value={fForm.company} onChange={(e) => setFForm({ ...fForm, company: e.target.value })} /></label>
              <label className="sv-team-ctl"><span>Role</span><input className="sv-input" value={fForm.role} onChange={(e) => setFForm({ ...fForm, role: e.target.value })} placeholder="e.g. Designer" /></label>
              <label className="sv-team-ctl"><span>Payment type</span><select className="sv-select" value={fForm.paymentType} onChange={(e) => setFForm({ ...fForm, paymentType: e.target.value })}>{PTYPES.map((t) => <option key={t}>{t}</option>)}</select></label>
              <label className="sv-team-ctl"><span>Amount (₹)</span><input type="number" className="sv-input" value={fForm.amount} onChange={(e) => setFForm({ ...fForm, amount: e.target.value })} placeholder="0" /></label>
              <label className="sv-team-ctl"><span>Payment date</span><input type="date" className="sv-input" value={fForm.paymentDate} onChange={(e) => setFForm({ ...fForm, paymentDate: e.target.value })} /></label>
              <label className="sv-team-ctl"><span>Status</span><select className="sv-select" value={fForm.status} onChange={(e) => setFForm({ ...fForm, status: e.target.value })}><option>Active</option><option>Pending</option><option>Inactive</option></select></label>
              <label className="sv-team-ctl" style={{ gridColumn: "1 / -1" }}><span>Notes</span><input className="sv-input" value={fForm.notes} onChange={(e) => setFForm({ ...fForm, notes: e.target.value })} placeholder="Optional notes" /></label>
            </div>
            <div className="sv-modal-footer" style={{ display: "flex", justifyContent: "flex-end", gap: 8, padding: "12px 20px" }}>
              <button className="sv-btn sv-btn--outline" onClick={() => setFModal(null)}>Cancel</button>
              <button className="sv-btn sv-btn--primary" onClick={saveF} disabled={!fForm.name.trim()}>{fModal.mode === "add" ? "Add Freelancer" : "Save"}</button>
            </div>
          </div>
        </div>
      )}

      {/* Freelancer pay modal */}
      {fPay && (() => {
        const fr = (freelancers || []).find((f) => f.id === fPay);
        return (
          <div className="sv-modal-overlay" onClick={() => setFPay(null)}>
            <div className="sv-modal" style={{ maxWidth: 400 }} onClick={(e) => e.stopPropagation()}>
              <div className="sv-modal-header"><span className="sv-text-navy sv-font-800" style={{ fontSize: 16 }}>Pay {fr?.name}</span><button onClick={() => setFPay(null)} className="sv-modal-close">×</button></div>
              <div style={{ padding: "16px 20px", display: "flex", flexDirection: "column", gap: 12 }}>
                <label className="sv-team-ctl"><span>Amount (₹)</span><input type="number" className="sv-input" value={fPayForm.amount} onChange={(e) => setFPayForm({ ...fPayForm, amount: e.target.value })} placeholder="0" /></label>
                <label className="sv-team-ctl"><span>Payment date</span><input type="date" className="sv-input" value={fPayForm.date} onChange={(e) => setFPayForm({ ...fPayForm, date: e.target.value })} /></label>
                <label className="sv-team-ctl"><span>Note (optional)</span><input className="sv-input" value={fPayForm.note} onChange={(e) => setFPayForm({ ...fPayForm, note: e.target.value })} placeholder="e.g. Project X milestone" /></label>
              </div>
              <div className="sv-modal-footer" style={{ display: "flex", justifyContent: "flex-end", gap: 8, padding: "12px 20px" }}>
                <button className="sv-btn sv-btn--outline" onClick={() => setFPay(null)}>Cancel</button>
                <button className="sv-btn sv-btn--success" onClick={doPayF} disabled={!(+fPayForm.amount > 0)}>Record Payment</button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Shared Yes/No confirm (freelancer delete) */}
      {confirm && (
        <div className="sv-modal-overlay" onClick={() => setConfirm(null)}>
          <div className="sv-modal sv-confirm" onClick={(e) => e.stopPropagation()}>
            <p className="sv-confirm-msg">{confirm.message}</p>
            <p className="sv-confirm-sub">Do you want to proceed?</p>
            <div className="sv-confirm-actions">
              <button className="sv-btn sv-btn--outline" onClick={() => setConfirm(null)}>No</button>
              <button className="sv-btn sv-btn--danger-solid" onClick={() => { const fn = confirm.onYes; setConfirm(null); fn?.(); }}>Yes</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
