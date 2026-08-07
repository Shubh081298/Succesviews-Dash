import { useState, useMemo, useEffect } from "react";
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

export default function SalaryModule({ employees, salaries, setSalaries, showToast, pushNotification, addMessage, captureExpense, editMode = false, setEditMode, settingsPwd = "Settings@123", logo = "", freelancers = [], saveFreelancers, bankDetails = {}, saveBankDetails }) {
  const [view, setView] = useState("payroll"); // payroll | freelancers | history | bank
  const [search, setSearch] = useState("");
  // The Full-Time / Freelancers / Bank tabs share one search box — clear it when
  // switching tabs so a filter typed on one tab can't silently hide people on another.
  useEffect(() => { setSearch(""); }, [view]);
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
  const [bankEdit, setBankEdit] = useState(null); // { empId, name, recipientName, accountNumber, ifscCode, upiId }
  const [preview, setPreview] = useState(null);
  const [sending, setSending] = useState(false);

  // ── Payroll Cycle (additive month-based workflow) state ──
  const [payMonth, setPayMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [pcEntry, setPcEntry] = useState(null);   // { empId, type: 'incentive'|'deduction' }
  const [pcAmt, setPcAmt] = useState("");
  const [pcReason, setPcReason] = useState("");
  const [pcRelease, setPcRelease] = useState(null); // empId pending release confirmation
  const [pcManage, setPcManage] = useState(null);   // { empId, type } — view/remove entries

  // ── freelancer state ──
  const [fModal, setFModal] = useState(null); // { mode:"add"|"edit", id? }
  const blankF = { name: "", company: "", role: "", paymentType: "Monthly", amount: "", paymentDate: getTodayStr(), status: "Active", notes: "" };
  const [fForm, setFForm] = useState(blankF);
  const [fPay, setFPay] = useState(null); // freelancer id being paid
  const [fPayForm, setFPayForm] = useState({ amount: "", date: getTodayStr(), note: "" });
  const [confirm, setConfirm] = useState(null); // { message, onYes }

  const getSal = (id) => salaries[id] || { fixedSalary: 0, incentives: [], deductions: [], payments: [] };
  const sumAmt = (arr) => (arr || []).reduce((a, b) => a + (b.amount || 0), 0);

  /* ═══════════════════════════════════════════════════════════════════════════
     Payroll Cycle — month-based Draft → Ready → Approved → Released workflow.
     Fully ADDITIVE: per-month records live in salaries[emp].months[mk]; on
     Release we push into the SAME legacy payments[] array, so the employee
     portal, payslip history, expense capture and dashboard KPIs keep working
     unchanged. The existing Full-Time tab / "Paid" flow are not touched.
     ═══════════════════════════════════════════════════════════════════════════ */
  const PC_STATUS = {
    Draft: { c: "#64748B", bg: "#F1F5F9", soft: "#F8FAFC", bd: "#E9EEF4" },
    Ready: { c: "#B45309", bg: "#FEF3C7", soft: "#FFFBEB", bd: "#FDE9C8" },
    Approved: { c: "#1D4ED8", bg: "#DBEAFE", soft: "#EFF6FF", bd: "#D3E3FF" },
    Released: { c: "#15803D", bg: "#DCFCE7", soft: "#F0FDF4", bd: "#CBEFD5" },
  };
  const monthLabel = (mk) => { const [y, m] = String(mk).split("-"); return new Date(+y, +m - 1, 1).toLocaleDateString("en-IN", { month: "long", year: "numeric" }); };
  const PC_MONTHS = useMemo(() => { const arr = []; const d = new Date(); d.setDate(1); for (let i = 0; i < 15; i++) { arr.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`); d.setMonth(d.getMonth() - 1); } return arr; }, []);

  // Read a month's payroll record, seeding from the employee's base fixed salary.
  // For the current month with no record yet, carry over any pending top-level
  // incentives/deductions so nothing already entered is lost.
  const getMonthRec = (empId, mk) => {
    const s = salaries[empId] || {};
    const existing = s.months && s.months[mk];
    if (existing) return existing;
    const seed = { fixed: s.fixedSalary || 0, incentives: [], deductions: [], notes: "", status: "Draft", releaseDate: "", paidDate: "" };
    if (mk === new Date().toISOString().slice(0, 7)) { seed.incentives = s.incentives || []; seed.deductions = s.deductions || []; }
    return seed;
  };
  const saveMonthRec = async (empId, mk, patch) => {
    const s = salaries[empId] || { fixedSalary: 0, incentives: [], deductions: [], payments: [] };
    const nextMonth = { ...getMonthRec(empId, mk), ...patch };
    const u = { ...salaries, [empId]: { ...s, months: { ...(s.months || {}), [mk]: nextMonth } } };
    setSalaries(u); await storageSet("svd_salaries", JSON.stringify(u));
  };
  const pcNet = (rec) => (rec.fixed || 0) + sumAmt(rec.incentives) - sumAmt(rec.deductions);
  const pcSetStatus = (empId, status) => saveMonthRec(empId, payMonth, { status });
  const pcAddEntry = async () => {
    if (!pcEntry) return; const amt = +pcAmt || 0;
    if (amt <= 0 || !pcReason.trim()) { showToast("Enter amount and reason", "err"); return; }
    const { empId, type } = pcEntry; const rec = getMonthRec(empId, payMonth);
    const key = type === "incentive" ? "incentives" : "deductions";
    const item = { id: `${type}${Date.now()}`, amount: amt, reason: pcReason.trim(), date: getTodayStr() };
    await saveMonthRec(empId, payMonth, { [key]: [...(rec[key] || []), item] });
    setPcEntry(null); setPcAmt(""); setPcReason(""); showToast(type === "incentive" ? "Incentive added." : "Deduction added.");
  };
  const pcRemoveEntry = async (empId, type, id) => {
    const rec = getMonthRec(empId, payMonth); const key = type === "incentive" ? "incentives" : "deductions";
    await saveMonthRec(empId, payMonth, { [key]: (rec[key] || []).filter((x) => x.id !== id) });
  };
  // Build a payslip payload straight from the month record (accurate before release).
  const pcPayslip = (empId) => {
    const emp = employees.find((x) => x.id === empId); const rec = getMonthRec(empId, payMonth);
    const [y, m] = payMonth.split("-");
    setPreview({ empId, payload: {
      month: new Date(+y, +m - 1, 1).toLocaleDateString("en-IN", { month: "long" }), year: +y, monthKey: payMonth,
      date: rec.releaseDate || getTodayStr(), empName: emp?.name || "", empId,
      fixed: rec.fixed || 0,
      incentives: (rec.incentives || []).map((i) => ({ reason: i.reason, amount: i.amount })), incentiveTotal: sumAmt(rec.incentives),
      deductions: (rec.deductions || []).map((i) => ({ reason: i.reason, amount: i.amount })), deductionTotal: sumAmt(rec.deductions),
      total: pcNet(rec),
    } });
  };
  const pcReleaseNow = async (empId) => {
    const rec = getMonthRec(empId, payMonth); const emp = employees.find((e) => e.id === empId); const s = salaries[empId] || {};
    const already = (s.payments || []).some((p) => (p.monthKey || mKey(p.date)) === payMonth);
    const net = pcNet(rec);
    const date = rec.releaseDate || getTodayStr();
    const pay = { id: `pay${Date.now()}`, amount: net, fixed: rec.fixed || 0, incentiveTotal: sumAmt(rec.incentives), deductionTotal: sumAmt(rec.deductions), incentives: rec.incentives || [], deductions: rec.deductions || [], date, monthKey: payMonth };
    const nextMonth = { ...rec, status: "Released", paidDate: getTodayStr(), releaseDate: date };
    const u = { ...salaries, [empId]: { ...s, months: { ...(s.months || {}), [payMonth]: nextMonth }, payments: already ? (s.payments || []) : [...(s.payments || []), pay] } };
    setSalaries(u); await storageSet("svd_salaries", JSON.stringify(u));
    setPcRelease(null);
    showToast(`Salary released for ${monthLabel(payMonth)}.`, "success");
    if (emp) { pushNotification(`Salary released to ${empLabel(emp)} (${monthLabel(payMonth)}): ${fmtSalary(net)}`); try { await addMessage(empId, buildPayslipMessage(buildPayloadFromPayment(emp, pay))); } catch (e) { /* message optional */ } }
    if (captureExpense && emp && !already) {
      const d = new Date(date + "T00:00:00");
      captureExpense({ type: "salary", sourceKey: `salary:${empId}:${payMonth}`, title: `Salary — ${emp.name || empId}`, category: "Salary", clientName: emp.name || "", paymentStatus: "Paid", paymentDate: date, amount: net, currency: "INR", paymentMethod: "Salary", details: { employeeId: empId, employeeName: emp.name || "", department: emp.department || "", month: monthLabel(payMonth).split(" ")[0], year: d.getFullYear(), monthKey: payMonth, fixed: pay.fixed, incentiveTotal: pay.incentiveTotal, deductionTotal: pay.deductionTotal, incentives: pay.incentives, deductions: pay.deductions, finalSalary: net } });
    }
  };

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
    // Prefer the payroll month the payment belongs to over the release date's month.
    const mk = p.monthKey || `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const [ly, lm] = mk.split("-"); const ld = new Date(+ly, +lm - 1, 1);
    return {
      month: ld.toLocaleDateString("en-IN", { month: "long" }), year: +ly,
      monthKey: mk, date: p.date,
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
    // All top KPIs follow the SELECTED payroll month so the dashboard and the
    // Payroll Cycle cards always agree. Only Released pay counts as paid.
    let empPaid = 0, freePaid = 0, incPaid = 0, dedPaid = 0;
    const empPaidIds = new Set(), freePaidIds = new Set();
    Object.entries(salaries || {}).forEach(([id, s]) => {
      (s.payments || []).forEach((p) => { if ((p.monthKey || mKey(p.date)) === payMonth) { empPaid += p.amount || 0; incPaid += p.incentiveTotal || 0; dedPaid += p.deductionTotal || 0; empPaidIds.add(id); } });
    });
    (freelancers || []).forEach((f) => (f.payments || []).forEach((p) => { if (mKey(p.date) === payMonth) { freePaid += p.amount || 0; freePaidIds.add(f.id); } }));
    // Pending / net payable = the selected month's records that are NOT released yet.
    let pendingInc = 0, pendingDed = 0, netPayable = 0;
    employees.forEach((e) => { const rec = getMonthRec(e.id, payMonth); if (rec.status !== "Released") { pendingInc += sumAmt(rec.incentives); pendingDed += sumAmt(rec.deductions); netPayable += (rec.fixed || 0) + sumAmt(rec.incentives) - sumAmt(rec.deductions); } });
    const withSalary = employees.filter((e) => (getMonthRec(e.id, payMonth).fixed || 0) > 0).length;
    const completion = withSalary > 0 ? Math.round((empPaidIds.size / withSalary) * 100) : 0;
    return { empPaid, freePaid, total: empPaid + freePaid, incPaid, dedPaid, pendingInc, pendingDed, netPayable, empPaidCount: empPaidIds.size, freePaidCount: freePaidIds.size, pending: Math.max(0, withSalary - empPaidIds.size), completion };
  }, [salaries, freelancers, employees, payMonth]);

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
            <p className="sv-text-navy sv-font-800" style={{ margin: 0, fontSize: 15.5 }}>Payroll Summary · {monthLabel(payMonth)}</p>
            <p className="sv-text-muted" style={{ margin: 0, fontSize: 12 }}>Selected month's payroll at a glance</p>
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
            {[["payroll", "Salary"], ["freelancers", "Freelancers"], ["history", "History"], ["bank", "Bank Details"]].map(([k, l]) => (
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

        {/* ── Payroll Cycle (month-based workflow) ── */}
        {view === "payroll" && (() => {
          const recs = empFiltered.map((e) => ({ e, rec: getMonthRec(e.id, payMonth) }));
          const cnt = { Draft: 0, Ready: 0, Approved: 0, Released: 0 };
          let releasedTotal = 0, netPayable = 0;
          recs.forEach(({ rec }) => { cnt[rec.status] = (cnt[rec.status] || 0) + 1; const n = pcNet(rec); if (rec.status === "Released") releasedTotal += n; else netPayable += n; });
          return (
            <>
              <div className="sv-flex sv-items-center sv-gap-2" style={{ flexWrap: "wrap", margin: "4px 0 14px" }}>
                <div className="sv-flex sv-items-center sv-gap-2">
                  <span className="sv-mod-icon" style={{ background: "rgba(37,99,235,.12)", color: "#2563EB" }}><CalendarDays size={16} /></span>
                  <div><div className="sv-text-navy sv-font-800" style={{ fontSize: 15 }}>Payroll Cycle</div><div className="sv-text-muted" style={{ fontSize: 11.5 }}>Process each month on its own: Draft → Ready → Approved → Released. Only released pay reaches the employee & counts as paid.</div></div>
                </div>
                <div className="sv-flex sv-items-center sv-gap-2" style={{ marginLeft: "auto" }}>
                  <label className="sv-text-muted" style={{ fontSize: 12, fontWeight: 700 }}>Payroll Month</label>
                  <select className="sv-select" value={payMonth} onChange={(e) => setPayMonth(e.target.value)} style={{ minWidth: 170 }}>{PC_MONTHS.map((mk) => <option key={mk} value={mk}>{monthLabel(mk)}</option>)}</select>
                </div>
              </div>
              <div className="sv-pc-summary">
                {[["Draft", cnt.Draft, "#64748B"], ["Ready", cnt.Ready, "#B45309"], ["Approved", cnt.Approved, "#1D4ED8"], ["Released", cnt.Released, "#15803D"], ["Released total", money(releasedTotal), "#15803D"], ["Net payable", money(netPayable), "#F59E0B"]].map(([l, v, c]) => (
                  <div key={l} className="sv-pc-sum"><span className="sv-pc-sum-v" style={{ color: c }}>{v}</span><span className="sv-pc-sum-l">{l}</span></div>
                ))}
              </div>
              {recs.length === 0 ? (
                <div className="sv-leave-empty"><Users size={26} /><span>No employees to show.</span></div>
              ) : (
                <div className="sv-sal-grid" style={{ marginTop: 12 }}>
                  {recs.map(({ e, rec }, i) => {
                    const st = PC_STATUS[rec.status] || PC_STATUS.Draft; const net = pcNet(rec); const locked = rec.status === "Released"; const canEdit = editMode && !locked;
                    return (
                      <div key={e.id} className="sv-sal-card sv-pc-card" style={{ background: st.soft, borderColor: st.bd, borderTop: `3px solid ${st.c}` }}>
                        <div className="sv-sal-card-top">
                          <Avatar emp={e} idx={i} size={40} />
                          <div style={{ flex: 1, minWidth: 0 }}><div className="sv-text-navy sv-font-700" style={{ fontSize: 14 }}>{e.name}</div><div className="sv-text-muted" style={{ fontSize: 11 }}>{e.id} · {e.department || "—"}</div></div>
                          <span className="sv-team-badge" style={{ background: st.bg, color: st.c }}><span className="sv-team-badge-dot" style={{ background: st.c }} />{rec.status}</span>
                        </div>
                        <div className="sv-sal-figs">
                          <div className="sv-sal-fig"><span>Fixed</span><input type="number" min="0" disabled={!canEdit} className="sv-input sv-sal-fixed" value={rec.fixed || ""} placeholder="0" onChange={(ev) => saveMonthRec(e.id, payMonth, { fixed: +ev.target.value || 0 })} /></div>
                          <div className="sv-sal-fig" style={{ cursor: canEdit && (rec.incentives || []).length ? "pointer" : "default" }} title={canEdit && (rec.incentives || []).length ? "Click to view / remove incentives" : undefined} onClick={() => { if (canEdit && (rec.incentives || []).length) setPcManage({ empId: e.id, type: "incentive" }); }}><span>Incentives{(rec.incentives || []).length ? ` (${rec.incentives.length})` : ""}</span><b style={{ color: GREEN }}>{money(sumAmt(rec.incentives))}</b></div>
                          <div className="sv-sal-fig" style={{ cursor: canEdit && (rec.deductions || []).length ? "pointer" : "default" }} title={canEdit && (rec.deductions || []).length ? "Click to view / remove deductions" : undefined} onClick={() => { if (canEdit && (rec.deductions || []).length) setPcManage({ empId: e.id, type: "deduction" }); }}><span>Deductions{(rec.deductions || []).length ? ` (${rec.deductions.length})` : ""}</span><b style={{ color: RED }}>{sumAmt(rec.deductions) > 0 ? money(sumAmt(rec.deductions)) : "N/A"}</b></div>
                          <div className="sv-sal-fig sv-sal-fig--net"><span>Net Salary</span><b>{money(net)}</b></div>
                        </div>
                        <div className="sv-sal-meta sv-flex sv-items-center" style={{ justifyContent: "space-between", gap: 8 }}>
                          <span>{monthLabel(payMonth)}</span>
                          <label className="sv-flex sv-items-center" style={{ fontSize: 11, gap: 4 }}>Release
                            <input type="date" disabled={!canEdit} className="sv-input" style={{ padding: "2px 6px", fontSize: 11, width: 130 }} value={rec.releaseDate || ""} onChange={(ev) => saveMonthRec(e.id, payMonth, { releaseDate: ev.target.value })} />
                          </label>
                        </div>
                        <div className="sv-sal-actions">
                          {!locked && (<>
                            <button disabled={!editMode} className="sv-chip-btn sv-chip-btn--blue" onClick={() => { setPcEntry({ empId: e.id, type: "incentive" }); setPcAmt(""); setPcReason(""); }}><Plus size={12} /> Incentive</button>
                            <button disabled={!editMode} className="sv-chip-btn sv-chip-btn--red" onClick={() => { setPcEntry({ empId: e.id, type: "deduction" }); setPcAmt(""); setPcReason(""); }}><TrendingDown size={12} /> Deduction</button>
                          </>)}
                          {rec.status === "Draft" && <button disabled={!editMode} className="sv-chip-btn sv-chip-btn--amber" onClick={() => pcSetStatus(e.id, "Ready")}>Mark Ready →</button>}
                          {rec.status === "Ready" && (<>
                            <button disabled={!editMode} className="sv-chip-btn" onClick={() => pcSetStatus(e.id, "Draft")}>← Draft</button>
                            <button disabled={!editMode} className="sv-chip-btn sv-chip-btn--blue" onClick={() => pcSetStatus(e.id, "Approved")}>Approve →</button>
                          </>)}
                          {rec.status === "Approved" && (<>
                            <button disabled={!editMode} className="sv-chip-btn" onClick={() => pcSetStatus(e.id, "Ready")}>← Ready</button>
                            <button className="sv-chip-btn sv-chip-btn--violet" onClick={() => pcPayslip(e.id)}><FileText size={12} /> Payslip</button>
                            <button disabled={!editMode} className="sv-chip-btn sv-chip-btn--green" onClick={() => setPcRelease(e.id)}><CheckCircle2 size={12} /> Release Salary</button>
                          </>)}
                          {locked && (<>
                            <span className="sv-text-muted" style={{ fontSize: 11 }}>Released {rec.paidDate ? fmtDate(rec.paidDate) : ""}</span>
                            <button className="sv-chip-btn sv-chip-btn--violet" onClick={() => pcPayslip(e.id)}><FileText size={12} /> Payslip</button>
                          </>)}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          );
        })()}

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

        {/* ── Bank Details ── */}
        {view === "bank" && (() => {
          const q = search.trim().toLowerCase();
          const rows = employees.filter((e) => {
            const b = bankDetails[e.id] || {};
            return !q || `${e.name} ${e.id} ${b.recipientName || ""} ${b.accountNumber || ""} ${b.ifscCode || ""} ${b.upiId || ""}`.toLowerCase().includes(q);
          });
          return (
            <div>
              <p className="sv-text-muted" style={{ fontSize: 12.5, margin: "0 0 12px" }}>Bank details are entered by employees under their Settings. You can add or correct them here too.</p>
              {rows.length === 0 ? (
                <div className="sv-leave-empty"><Users size={26} /><span>No employees to show.</span></div>
              ) : (
                <div className="sv-mailids-scroll sv-bank-scroll">
                  <table className="sv-mailids-table">
                    <thead><tr>{["Employee", "Recipient Name", "Account Number", "IFSC Code", "UPI ID", ""].map((h) => <th key={h}>{h}</th>)}</tr></thead>
                    <tbody>
                      {rows.map((e) => {
                        const b = bankDetails[e.id] || {};
                        const filled = b.recipientName || b.accountNumber || b.ifscCode;
                        return (
                          <tr key={e.id}>
                            <td><div className="sv-text-navy sv-font-700" style={{ fontSize: 13 }}>{e.name}</div><div className="sv-text-muted" style={{ fontSize: 11 }}>{e.id} · {e.department || "—"}</div></td>
                            <td className={filled ? "sv-text-navy" : "sv-text-muted"} style={{ fontSize: 12.5 }}>{b.recipientName || "—"}</td>
                            <td className={filled ? "sv-text-navy" : "sv-text-muted"} style={{ fontSize: 12.5 }}>{b.accountNumber || "—"}</td>
                            <td className={filled ? "sv-text-navy" : "sv-text-muted"} style={{ fontSize: 12.5 }}>{b.ifscCode || "—"}</td>
                            <td className="sv-text-muted" style={{ fontSize: 12.5 }}>{b.upiId || "—"}</td>
                            <td><button className="sv-btn sv-btn--sm sv-btn--outline" disabled={!editMode} onClick={() => setBankEdit({ empId: e.id, name: e.name, recipientName: b.recipientName || "", accountNumber: b.accountNumber || "", ifscCode: b.ifscCode || "", upiId: b.upiId || "" })}>{filled ? "Edit" : "Add"}</button></td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          );
        })()}
      </div>

      {/* Payroll Cycle — add incentive/deduction for the selected month */}
      {pcEntry && (
        <div className="sv-modal-overlay" onClick={() => setPcEntry(null)}>
          <div className="sv-modal" style={{ maxWidth: 380 }} onClick={(e) => e.stopPropagation()}>
            <div className="sv-modal-header"><span className="sv-text-navy sv-font-800" style={{ fontSize: 15.5 }}>{pcEntry.type === "incentive" ? "Add Incentive" : "Add Deduction"} · {monthLabel(payMonth)}</span><button className="sv-modal-close" onClick={() => setPcEntry(null)}>×</button></div>
            <div style={{ padding: "16px 20px", display: "grid", gap: 10 }}>
              <input className="sv-input" type="number" min="0" placeholder="Amount" value={pcAmt} autoFocus onChange={(e) => setPcAmt(e.target.value)} />
              <input className="sv-input" placeholder="Reason" value={pcReason} onChange={(e) => setPcReason(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") pcAddEntry(); }} />
              <div className="sv-flex sv-gap-2"><button className="sv-btn sv-btn--outline" style={{ flex: 1 }} onClick={() => setPcEntry(null)}>Cancel</button><button className="sv-btn sv-btn--primary" style={{ flex: 1 }} onClick={pcAddEntry}>Add</button></div>
            </div>
          </div>
        </div>
      )}

      {/* Payroll Cycle — view / remove incentives or deductions for the month */}
      {pcManage && (() => {
        const rec = getMonthRec(pcManage.empId, payMonth);
        const emp = employees.find((x) => x.id === pcManage.empId);
        const list = pcManage.type === "incentive" ? (rec.incentives || []) : (rec.deductions || []);
        const col = pcManage.type === "incentive" ? GREEN : RED;
        return (
          <div className="sv-modal-overlay" onClick={() => setPcManage(null)}>
            <div className="sv-modal" style={{ maxWidth: 400 }} onClick={(e) => e.stopPropagation()}>
              <div className="sv-modal-header"><span className="sv-text-navy sv-font-800" style={{ fontSize: 15 }}>{pcManage.type === "incentive" ? "Incentives" : "Deductions"} · {emp?.name} · {monthLabel(payMonth)}</span><button className="sv-modal-close" onClick={() => setPcManage(null)}>×</button></div>
              <div style={{ padding: "14px 20px", display: "grid", gap: 8 }}>
                {list.length === 0 ? <p className="sv-text-muted" style={{ fontSize: 13, margin: 0 }}>None yet.</p> : list.map((it) => (
                  <div key={it.id} className="sv-flex sv-items-center sv-gap-2" style={{ padding: "7px 10px", background: "#F8FAFC", border: "1px solid #EEF2F7", borderRadius: 8 }}>
                    <b style={{ color: col, fontSize: 13 }}>{money(it.amount)}</b>
                    <span style={{ flex: 1, fontSize: 12.5, color: "#475569" }}>{it.reason}</span>
                    <button onClick={() => pcRemoveEntry(pcManage.empId, pcManage.type, it.id)} title="Remove" style={{ border: "none", background: "#FEE2E2", color: "#B91C1C", borderRadius: 6, cursor: "pointer", padding: "3px 9px", fontWeight: 800, fontSize: 13 }}>×</button>
                  </div>
                ))}
                <button className="sv-btn sv-btn--outline sv-btn--sm" style={{ marginTop: 2 }} onClick={() => { setPcEntry({ empId: pcManage.empId, type: pcManage.type }); setPcAmt(""); setPcReason(""); setPcManage(null); }}><Plus size={13} /> Add {pcManage.type}</button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Payroll Cycle — release confirmation */}
      {pcRelease && (() => {
        const emp = employees.find((e) => e.id === pcRelease); const rec = getMonthRec(pcRelease, payMonth);
        return (
          <div className="sv-modal-overlay" onClick={() => setPcRelease(null)}>
            <div className="sv-modal sv-confirm" onClick={(e) => e.stopPropagation()}>
              <p className="sv-confirm-msg">Release {emp?.name}'s salary for {monthLabel(payMonth)}?</p>
              <p className="sv-confirm-sub">Net {money(pcNet(rec))} · Release date {rec.releaseDate ? fmtDate(rec.releaseDate) : "today"}. This marks it Paid, adds it to payroll totals &amp; history, and sends the payslip to the employee.</p>
              <div className="sv-confirm-actions"><button className="sv-btn sv-btn--outline" onClick={() => setPcRelease(null)}>No</button><button className="sv-btn sv-btn--success" onClick={() => pcReleaseNow(pcRelease)}>Yes, Release</button></div>
            </div>
          </div>
        );
      })()}

      {/* Bank details edit modal (admin) */}
      {bankEdit && (
        <div className="sv-modal-overlay" onClick={() => setBankEdit(null)}>
          <div className="sv-modal" style={{ maxWidth: 460 }} onClick={(e) => e.stopPropagation()}>
            <div className="sv-modal-header"><span className="sv-text-navy sv-font-800" style={{ fontSize: 16 }}>Bank Details — {bankEdit.name}</span><button className="sv-modal-close" onClick={() => setBankEdit(null)}>×</button></div>
            <div style={{ padding: "16px 20px", display: "grid", gap: 12 }}>
              <label style={{ display: "flex", flexDirection: "column", gap: 5, fontSize: 12.5, fontWeight: 600, color: "#475569" }}>Recipient Name *<input className="sv-input" value={bankEdit.recipientName} onChange={(ev) => setBankEdit({ ...bankEdit, recipientName: ev.target.value })} placeholder="As per bank account" /></label>
              <label style={{ display: "flex", flexDirection: "column", gap: 5, fontSize: 12.5, fontWeight: 600, color: "#475569" }}>Account Number *<input className="sv-input" value={bankEdit.accountNumber} onChange={(ev) => setBankEdit({ ...bankEdit, accountNumber: ev.target.value })} placeholder="Bank account number" /></label>
              <label style={{ display: "flex", flexDirection: "column", gap: 5, fontSize: 12.5, fontWeight: 600, color: "#475569" }}>IFSC Code *<input className="sv-input" value={bankEdit.ifscCode} onChange={(ev) => setBankEdit({ ...bankEdit, ifscCode: ev.target.value.toUpperCase() })} placeholder="e.g. HDFC0001234" /></label>
              <label style={{ display: "flex", flexDirection: "column", gap: 5, fontSize: 12.5, fontWeight: 600, color: "#475569" }}>UPI ID (optional)<input className="sv-input" value={bankEdit.upiId} onChange={(ev) => setBankEdit({ ...bankEdit, upiId: ev.target.value })} placeholder="name@bank" /></label>
              <div className="sv-flex sv-gap-2" style={{ marginTop: 4 }}>
                <button className="sv-btn sv-btn--outline" style={{ flex: 1 }} onClick={() => setBankEdit(null)}>Cancel</button>
                <button className="sv-btn sv-btn--primary" style={{ flex: 1 }} onClick={async () => {
                  if (!bankEdit.recipientName.trim() || !bankEdit.accountNumber.trim() || !bankEdit.ifscCode.trim()) { showToast("Recipient, account number and IFSC are required.", "err"); return; }
                  const ok = saveBankDetails && await saveBankDetails(bankEdit.empId, bankEdit);
                  if (ok) setBankEdit(null);
                }}>Save</button>
              </div>
            </div>
          </div>
        </div>
      )}

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
        const alreadyPaid = (sal.payments || []).some((p) => mKey(p.date) === cur);
        return (
          <div className="sv-modal-overlay" onClick={() => setConfirmPaid(null)}>
            <div className="sv-modal sv-confirm" onClick={(e) => e.stopPropagation()}>
              <p className="sv-confirm-msg">Mark salary as Paid for {emp?.name}?</p>
              {alreadyPaid && <p className="sv-confirm-sub" style={{ color: "#B91C1C", fontWeight: 700 }}>⚠ This employee has already been paid this month. Confirming will record a second payment.</p>}
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
                {/* Preview is view-only — the payslip is delivered to the employee
                    automatically on Release, so there's no manual "Send" here
                    (that caused duplicate payslips). */}
                <button className="sv-btn sv-btn--primary sv-btn--full" onClick={() => setPreview(null)}>Close</button>
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
