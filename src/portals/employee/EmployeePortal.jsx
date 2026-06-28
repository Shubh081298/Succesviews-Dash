/**
 * EmployeePortal.jsx
 * ─────────────────────────────────────────────────────────────
 * The entire Employee Portal — login screen + dashboard (Daily
 * Report / My History / Leave / Settings).
 *
 * HARD RULE: this file and everything it renders must contain ZERO
 * admin buttons, admin links, admin menus, or admin functionality.
 * There is no "Admin Login" link, no password-gate modal, and no
 * import from src/portals/admin or src/components/admin anywhere in
 * this tree. Admin is reached only by navigating to /admin/login
 * directly — never from inside the Employee Portal.
 *
 * Employee auth/session state (who's logged in, which form tab is
 * open, in-progress DSR draft, etc.) is local to this component —
 * it's per-portal UI state, not shared business data. The underlying
 * records (employees, submissions, leaves, announcements, messages,
 * customFields) come from the shared AppDataContext so both portals
 * stay in sync against the same "backend".
 */
import { useState } from "react";
import { useAppData } from "../../data/AppDataContext";
import Sidebar from "../../components/layout/Sidebar";
import { EmployeeLogin, EmployeeDashboard } from "../../components/employee";
import { getTodayStr, fmtDate, blankDsr, dsrFromExisting } from "../../utils/helpers";

export default function EmployeePortal() {
  const {
    employees, saveEmployees,
    submissions, saveSubs,
    leaves, saveLeaves,
    customFields,
    announcements, saveAnnouncements,
    messages, saveMessages,
    websites,
    logo, theme, toggleTheme,
    showToast, pushNotification,
  } = useAppData();

  /* ── Employee session state (local to this portal) ───────── */
  const [loggedIn, setLoggedIn] = useState(false);
  const [emp, setEmp] = useState(null);
  const [loginSel, setLoginSel] = useState("");
  const [loginPwd, setLoginPwd] = useState("");

  /* ── Employee dashboard UI state ──────────────────────────── */
  const [empTab, setEmpTab] = useState("form");
  const [dsrDate, setDsrDate] = useState(getTodayStr());
  const [dsrForm, setDsrForm] = useState(blankDsr());
  const [histSearch, setHistSearch] = useState("");
  const [viewingDsr, setViewingDsr] = useState(null);
  const [leaveForm, setLeaveForm] = useState({ fromDate: "", toDate: "", reason: "" });

  /* ── Auth handlers ─────────────────────────────────────────── */
  const handleLogin = () => {
    const found = employees.find((e) => String(e.id) === String(loginSel));
    if (!found) { showToast("Select your name first.", "error"); return; }
    if (String(found.password || "1234") !== loginPwd) { showToast("Incorrect password.", "error"); return; }
    setEmp(found);
    setLoggedIn(true);
    setLoginPwd("");
    showToast(`Welcome back, ${found.name}!`, "success");
  };

  const handleLogout = () => {
    setLoggedIn(false);
    setEmp(null);
    setLoginSel("");
    setEmpTab("form");
  };

  /* ── Employee self-service handlers ──────────────────────── */
  const updateMyPhoto = (dataUrl) => {
    const next = employees.map((e) => (e.id === emp.id ? { ...e, photo: dataUrl } : e));
    saveEmployees(next);
    setEmp({ ...emp, photo: dataUrl });
  };

  const onApplyLeave = () => {
    if (!leaveForm.fromDate || !leaveForm.toDate || !leaveForm.reason.trim()) {
      showToast("Fill in all leave fields.", "error");
      return;
    }
    const rec = { id: Date.now(), empId: emp.id, empName: emp.name, ...leaveForm, status: "Pending", ts: Date.now() };
    saveLeaves([rec, ...leaves]);
    setLeaveForm({ fromDate: "", toDate: "", reason: "" });
    showToast("Leave request submitted.", "success");
    pushNotification(`${emp.name} applied for leave (${rec.fromDate} → ${rec.toDate}).`);
  };

  const dismissAnnouncement = (id) => {
    saveAnnouncements(announcements.map((a) => (a.id === id ? { ...a, dismissedBy: [...(a.dismissedBy || []), emp.id] } : a)));
  };
  const dismissMessage = (id) => saveMessages(messages.map((m) => (m.id === id ? { ...m, dismissed: true } : m)));

  /* ── DSR (Daily Status Report) handlers ──────────────────── */
  const onDateChange = (date) => {
    setDsrDate(date);
    const existing = submissions.find((s) => s.empId === emp.id && s.date === date);
    setDsrForm(dsrFromExisting(existing));
  };

  const handleDsrSave = (status) => {
    const idx = submissions.findIndex((s) => s.empId === emp.id && s.date === dsrDate);
    const websitesData = dsrForm.websites;
    const rec = {
      id: idx >= 0 ? submissions[idx].id : Date.now(),
      empId: emp.id, empName: emp.name, department: emp.department, date: dsrDate,
      status, ts: Date.now(),
      ...dsrForm, websitesData,
    };
    const next = idx >= 0 ? submissions.map((s, i) => (i === idx ? rec : s)) : [...submissions, rec];
    saveSubs(next);
    showToast(status === "Submitted" ? "DSR submitted!" : "Draft saved.", "success");
    if (status === "Submitted") pushNotification(`${emp.name} submitted their DSR for ${fmtDate(dsrDate)}.`);
  };

  /* ── Render: not logged in → Employee login only ─────────── */
  if (!loggedIn) {
    return (
      <EmployeeLogin
        employees={employees}
        loginSel={loginSel}
        setLoginSel={setLoginSel}
        loginPwd={loginPwd}
        setLoginPwd={setLoginPwd}
        onLogin={handleLogin}
      />
    );
  }

  /* ── Render: Employee dashboard ───────────────────────────── */
  return (
    <div className={`sv-app-shell${theme === "dark" ? " sv-dark" : ""}`}>
      <Sidebar
        logo={logo} brandTitle={emp.name} brandSubtitle={emp.department}
        theme={theme} onToggleTheme={toggleTheme}
        nav={[
          { key: "form", label: "📝 Daily Report" },
          { key: "history", label: "🗂️ My History" },
          { key: "leave", label: "🌴 Leave" },
          { key: "settings", label: "⚙️ Settings" },
        ]}
        active={empTab} onSelect={setEmpTab}
        onSignOut={handleLogout}
      />
      <main className="sv-main">
        <EmployeeDashboard
          emp={emp} empTab={empTab} setEmpTab={setEmpTab}
          dsrDate={dsrDate} dsrForm={dsrForm} setDsrForm={setDsrForm}
          onDateChange={onDateChange} onSave={handleDsrSave}
          submissions={submissions} websites={websites}
          onLogout={handleLogout}
          histSearch={histSearch} setHistSearch={setHistSearch}
          viewingDsr={viewingDsr} setViewingDsr={setViewingDsr}
          customFields={customFields}
          announcements={announcements.filter((a) => a.departments?.includes(emp.department) && !a.dismissedBy?.includes(emp.id))}
          onDismissAnn={dismissAnnouncement}
          myMessages={messages.filter((m) => m.empId === emp.id && !m.dismissed)}
          onDismissMsg={dismissMessage}
          theme={theme} onToggleTheme={toggleTheme}
          leaves={leaves.filter((l) => l.empId === emp.id)}
          leaveForm={leaveForm} setLeaveForm={setLeaveForm} onApplyLeave={onApplyLeave}
          onUpdatePhoto={updateMyPhoto}
          employees={employees}
        />
      </main>
    </div>
  );
}
