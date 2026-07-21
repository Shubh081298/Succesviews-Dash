/**
 * EmployeePortal.jsx — the entire Employee Portal (login + dashboard).
 * HARD RULE: zero admin buttons, links, menus or imports. Admin is
 * reached only via /admin/login, never from inside this tree.
 */
import { useState, useEffect } from "react";
import { ClipboardList, History, Palmtree, IdCard, Settings } from "lucide-react";
import { useAppData } from "../../data/AppDataContext";
import Sidebar from "../../components/layout/Sidebar";
import { EmployeeLogin, EmployeeDashboard } from "../../components/employee";
import DesignerDashboard from "../../components/designer/DesignerDashboard";
import { getTodayStr, fmtDate, blankDsr, dsrFromExisting } from "../../utils/helpers";
import { supabase } from "../../utils/supabaseClient";
import { employeeSignIn, employeeSignOut, sendPasswordReset } from "../../utils/auth";

export default function EmployeePortal() {
  const {
    employees, saveEmployees, assignEmployeeIds,
    submissions, saveSubs, upsertSubmission,
    leaves, saveLeaves, addLeave,
    customFields,
    announcements, saveAnnouncements,
    messages, saveMessages, dismissMessage,
    websites,
    designProjects, designFiles, uploadDesignFile, deleteDesignFile, updateDesignProject,
    designActivity, changeProjectStatus,
    expenses, addExpense,
    logo, theme, toggleTheme,
    showToast, pushNotification,
  } = useAppData();

  /* ── Employee session state (local to this portal) ───────── */
  const [loggedIn, setLoggedIn] = useState(false);
  const [emp, setEmp] = useState(null);
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPwd, setLoginPwd] = useState("");
  const [remember, setRemember] = useState(true);
  const [busy, setBusy] = useState(false);

  /* ── Employee dashboard UI state ──────────────────────────── */
  const [empTab, setEmpTab] = useState("form");
  const [dsrDate, setDsrDate] = useState(getTodayStr());
  const [dsrForm, setDsrForm] = useState(blankDsr());
  const [histSearch, setHistSearch] = useState("");
  const [viewingDsr, setViewingDsr] = useState(null);
  const [leaveForm, setLeaveForm] = useState({ fromDate: "", toDate: "", reason: "" });

  /* ── Auth handlers ─────────────────────────────────────────── */
  const handleLogin = async () => {
    const email = loginEmail.trim();
    if (!email || !loginPwd) { showToast("Enter your email and password.", "error"); return; }
    setBusy(true);
    try { localStorage.setItem("svd_remember", remember ? "true" : "false"); } catch (e) { /* ignore */ }

    let empId = null;

    // 1) Supabase Auth (for employees provisioned that way).
    try {
      const res = await employeeSignIn(email, loginPwd);
      if (res.success) {
        const m = employees.find((e) => (e.email || "").toLowerCase() === email.toLowerCase());
        if (m) empId = m.id;
      }
    } catch (e) { /* ignore */ }

    // 2) Server-side verification — the password is checked INSIDE the
    //    database (SECURITY DEFINER RPC), so plaintext passwords are never
    //    downloaded to the browser.
    if (!empId) {
      try {
        const { data } = await supabase.rpc("emp_login", { p_email: email, p_password: loginPwd });
        const row = Array.isArray(data) ? data[0] : data;
        if (row && row.id) empId = row.id;
      } catch (e) { /* ignore */ }
    }

    if (!empId) { showToast("Invalid email or password.", "error"); setBusy(false); return; }
    const found = employees.find((e) => e.id === empId);
    if (!found) { showToast("No employee profile found. Contact your admin.", "error"); setBusy(false); return; }

    try {
      const store = remember ? localStorage : sessionStorage;
      const other = remember ? sessionStorage : localStorage;
      store.setItem("svd_emp_session", empId);
      other.removeItem("svd_emp_session");
    } catch (e) { /* ignore */ }

    setEmp(found);
    setLoggedIn(true);
    setLoginPwd("");
    setBusy(false);
    showToast(`Welcome back, ${found.name}!`, "success");
  };

  const handleForgot = async () => {
    const email = loginEmail.trim();
    if (!email) { showToast("Enter your email first, then click Forgot password.", "error"); return; }
    const res = await sendPasswordReset(email);
    if (res.success) showToast("Password reset email sent. Check your inbox.", "success");
    else showToast(res.error || "Could not send reset email.", "error");
  };

  const handleLogout = async () => {
    await employeeSignOut();
    try { localStorage.removeItem("svd_emp_session"); sessionStorage.removeItem("svd_emp_session"); } catch (e) { /* ignore */ }
    setLoggedIn(false);
    setEmp(null);
    setLoginEmail("");
    setLoginPwd("");
    setEmpTab("form");
  };

  /* Restore an existing (remembered) session once employees are loaded. */
  useEffect(() => {
    let active = true;
    (async () => {
      if (loggedIn || !employees.length) return;
      // a) Local session (RPC login) — remembered across reloads.
      let sid = null;
      try { sid = localStorage.getItem("svd_emp_session") || sessionStorage.getItem("svd_emp_session"); } catch (e) { /* ignore */ }
      if (sid) {
        const f = employees.find((e) => e.id === sid);
        if (active && f) { setEmp(f); setLoggedIn(true); return; }
      }
      // b) Supabase Auth session (for provisioned accounts).
      const { data } = await supabase.auth.getSession();
      const sessEmail = data?.session?.user?.email;
      if (!active || !sessEmail) return;
      const found = employees.find((e) => (e.email || "").toLowerCase() === sessEmail.toLowerCase());
      if (found) { setEmp(found); setLoggedIn(true); }
    })();
    return () => { active = false; };
  }, [employees, loggedIn]);

  /* ── Employee self-service handlers ──────────────────────── */
  /* Employee fills in project name + start date on the IDs the admin gave them. */
  const saveMyAssignedIds = async (list) => {
    setEmp((prev) => (prev ? { ...prev, assignedIds: list } : prev));
    await assignEmployeeIds(emp.id, list);
  };

  const updateMyPhoto = (dataUrl) => {
    const next = employees.map((e) => (e.id === emp.id ? { ...e, photo: dataUrl } : e));
    saveEmployees(next);
    setEmp({ ...emp, photo: dataUrl });
  };

  const onApplyLeave = async () => {
    if (!leaveForm.fromDate || !leaveForm.toDate || !leaveForm.reason.trim()) {
      showToast("Fill in all leave fields.", "error");
      return;
    }
    await addLeave(emp.id, emp.name, leaveForm.fromDate, leaveForm.toDate, leaveForm.reason);
    setLeaveForm({ fromDate: "", toDate: "", reason: "" });
    showToast("Leave request submitted.", "success");
    pushNotification(`${emp.name} applied for leave (${leaveForm.fromDate} -> ${leaveForm.toDate}).`);
  };

  const dismissAnnouncement = (id) => {
    saveAnnouncements(announcements.map((a) => (a.id === id ? { ...a, dismissedBy: [...(a.dismissedBy || []), emp.id] } : a)));
  };
  const handleDismissMessage = (id) => dismissMessage(id);

  /* ── DSR (Daily Status Report) handlers ──────────────────── */
  const onDateChange = (date) => {
    setDsrDate(date);
    const existing = submissions.find((s) => s.empId === emp.id && s.date === date);
    setDsrForm(dsrFromExisting(existing));
  };

  const handleDsrSave = async (status) => {
    if (status === "Submitted" && dsrForm.attendance !== "Absent") {
      // Mandatory fields validation
      if (!String(dsrForm.freshEmails || "").trim() || Number(dsrForm.freshEmails) < 0) {
        showToast(" Fresh Emails Sent is required.", "error"); return;
      }
      if (!String(dsrForm.reminderEmails || "").trim() || Number(dsrForm.reminderEmails) < 0) {
        showToast(" Reminder Emails Sent is required.", "error"); return;
      }
      // Scheduled Calls: NA is allowed (empty array). Only block if undefined.
      if (!String(dsrForm.workingHours || "").trim() || Number(dsrForm.workingHours) <= 0) {
        showToast(" Working Hours is required.", "error"); return;
      }
      if (!String(dsrForm.pendingTasks || "").trim() || !String(dsrForm.updatesForTeamLead || "").trim()) {
        showToast(" Please fill Pending Tasks and Updates for Team Lead.", "error"); return;
      }
    }
    const existing = submissions.find((s) => s.empId === emp.id && s.date === dsrDate);
    const websitesData = dsrForm.websites;
    const rec = {
      id: existing ? existing.id : String(Date.now()),
      empId: emp.id, empName: emp.name, department: emp.department, date: dsrDate,
      status, ts: Date.now(),
      ...dsrForm, websitesData,
    };
    const res = await upsertSubmission(rec);
    if (res && res.success === false) return; // save failed; error toast already shown
    showToast(status === "Submitted" ? "DSR submitted!" : "Draft saved.", "success");
    if (status === "Submitted") pushNotification(`${emp.name} submitted their DSR for ${fmtDate(dsrDate)}.`);
  };

  /* ── Render: not logged in -> Employee login only ─────────── */
  if (!loggedIn) {
    return (
      <EmployeeLogin
        email={loginEmail}
        setEmail={setLoginEmail}
        password={loginPwd}
        setPassword={setLoginPwd}
        remember={remember}
        setRemember={setRemember}
        onLogin={handleLogin}
        onForgot={handleForgot}
        busy={busy}
      />
    );
  }

  /* ── Render: Designer dashboard (Design department) ───────── */
  if (emp && (emp.department || "").toLowerCase() === "design") {
    return (
      <DesignerDashboard
        emp={emp} logo={logo} theme={theme} toggleTheme={toggleTheme} onLogout={handleLogout}
        designProjects={designProjects} designFiles={designFiles}
        uploadDesignFile={uploadDesignFile} deleteDesignFile={deleteDesignFile} updateDesignProject={updateDesignProject}
        designActivity={designActivity} changeProjectStatus={changeProjectStatus}
        expenses={expenses} addExpense={addExpense} showToast={showToast}
      />
    );
  }

  /* ── Render: Employee dashboard ───────────────────────────── */
  return (
    <div className={`sv-app-shell${theme === "dark" ? " sv-dark" : ""}`}>
      <Sidebar
        logo={logo} brandTitle={emp.name} brandSubtitle={emp.department} brandPhoto={emp.photo}
        theme={theme} onToggleTheme={toggleTheme}
        nav={[
          { key: "form", label: "Daily Report", icon: <ClipboardList size={18} /> },
          { key: "history", label: "My History", icon: <History size={18} /> },
          { key: "leave", label: "Leave", icon: <Palmtree size={18} /> },
          { key: "assigned", label: "Assigned IDs", icon: <IdCard size={18} /> },
          { key: "settings", label: "Settings", icon: <Settings size={18} /> },
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
          onDismissMsg={handleDismissMessage}
          theme={theme} onToggleTheme={toggleTheme}
          leaves={leaves.filter((l) => l.empId === emp.id)}
          leaveForm={leaveForm} setLeaveForm={setLeaveForm} onApplyLeave={onApplyLeave}
          onUpdatePhoto={updateMyPhoto}
          onSaveAssignedIds={saveMyAssignedIds}
          employees={employees}
          logo={logo}
        />
      </main>
    </div>
  );
}
