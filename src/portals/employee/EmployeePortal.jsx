/**
 * EmployeePortal.jsx — the entire Employee Portal (login + dashboard).
 * HARD RULE: zero admin buttons, links, menus or imports. Admin is
 * reached only via /admin/login, never from inside this tree.
 */
import { useState, useEffect } from "react";
import { ClipboardList, History, Palmtree, IdCard, Settings, Contact } from "lucide-react";
import { useAppData } from "../../data/AppDataContext";
import Sidebar from "../../components/layout/Sidebar";
import { EmployeeLogin, EmployeeDashboard } from "../../components/employee";
import LoginSuccess from "../../components/ui/LoginSuccess";
import Pipeline from "../../components/employee/Pipeline";
import DesignerDashboard from "../../components/designer/DesignerDashboard";
import { getTodayStr, fmtDate, blankDsr, dsrFromExisting } from "../../utils/helpers";
import { supabase } from "../../utils/supabaseClient";
import { employeeSignIn, employeeSignOut, sendPasswordReset } from "../../utils/auth";

export default function EmployeePortal() {
  const {
    employees, saveEmployees, assignEmployeeIds,
    submissions, saveSubs, upsertSubmission,
    bankDetails, saveBankDetails,
    leaves, saveLeaves, addLeave,
    customFields,
    announcements, saveAnnouncements,
    messages, saveMessages, dismissMessage,
    websites, domains,
    designProjects, designArchive, designFiles, uploadDesignFile, deleteDesignFile, updateDesignProject,
    designActivity, changeProjectStatus, addProjectComment, uploadMessageImage,
    designWork, saveDesignWork,
    brandDomains,
    designExtra, releaseDesign, acknowledgeDesign, markDesignSeen, addDesignFolder, deleteDesignFolder,
    expenses, addExpense,
    logo, theme, toggleTheme,
    showToast, pushNotification, notifications, markNotificationRead, markAllNotificationsRead, clearNotifications, logAudit,
  } = useAppData();

  /* ── Employee session state (local to this portal) ───────── */
  const [loggedIn, setLoggedIn] = useState(false);
  const [emp, setEmp] = useState(null);
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPwd, setLoginPwd] = useState("");
  const [remember, setRemember] = useState(true);
  const [busy, setBusy] = useState(false);
  const [loginSuccess, setLoginSuccess] = useState(false);

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

    // Employees sign in via Supabase Auth so the session carries a JWT (required for
    // row-level security). No non-JWT fallback — every session is authenticated.
    let auth;
    try { auth = await employeeSignIn(email, loginPwd); } catch (e) { auth = { success: false }; }
    if (!auth || !auth.success) { showToast("Invalid email or password.", "error"); setBusy(false); return; }

    // Resolve this employee's profile. Prefer the loaded list; if it isn't there yet
    // (the list may have loaded before a session existed), fetch the row under the new
    // JWT (RLS lets a user read their own row) and normalize it to the app's shape.
    let found = employees.find((e) => (e.email || "").toLowerCase() === email.toLowerCase());
    if (!found) {
      try {
        const { data } = await supabase.from("employees")
          .select("id, name, department, code, photo, team_lead, email, assigned_ids, status, terminated_at, terminated_reason, terminated_by")
          .ilike("email", email).maybeSingle();
        if (data) found = {
          id: data.id, name: data.name, department: data.department, code: data.code, photo: data.photo || "",
          teamLead: data.team_lead || "", email: data.email || "",
          assignedIds: Array.isArray(data.assigned_ids) ? data.assigned_ids : [],
          status: data.status === "terminated" ? "terminated" : "active",
          terminatedAt: data.terminated_at || null, terminatedReason: data.terminated_reason || "", terminatedBy: data.terminated_by || "",
        };
      } catch (e) { /* ignore */ }
    }
    if (!found) { showToast("No employee profile found. Contact your admin.", "error"); setBusy(false); return; }
    const empId = found.id;
    // Link this employee row to its auth user (idempotent) so RLS can match it.
    try { if (auth.user?.id) await supabase.from("employees").update({ auth_id: auth.user.id }).eq("id", found.id).is("auth_id", null); } catch (e) { /* ignore */ }

    // Terminated / deactivated accounts cannot sign in (their data is preserved;
    // only the admin can open their DSR history from the Former Employees section).
    if (found.status === "terminated") {
      try { await employeeSignOut(); } catch (e) { /* ignore */ }
      try { localStorage.removeItem("svd_emp_session"); sessionStorage.removeItem("svd_emp_session"); } catch (e) { /* ignore */ }
      showToast("This account has been deactivated. Please contact your administrator.", "error");
      setLoginPwd(""); setBusy(false);
      return;
    }

    try {
      const store = remember ? localStorage : sessionStorage;
      const other = remember ? sessionStorage : localStorage;
      store.setItem("svd_emp_session", empId);
      other.removeItem("svd_emp_session");
    } catch (e) { /* ignore */ }

    setEmp(found);
    setLoginPwd("");
    setBusy(false);
    logAudit && logAudit("login", "employee", found.id, { name: found.name, portal: "employee" });
    // Show the centered success modal on the login page, then enter the portal.
    setLoginSuccess(true);
    setTimeout(() => setLoggedIn(true), 1300);
  };

  const handleForgot = async () => {
    const email = loginEmail.trim();
    if (!email) { showToast("Enter your email first, then click Forgot password.", "error"); return; }
    const res = await sendPasswordReset(email);
    if (res.success) showToast("Password reset email sent. Check your inbox.", "success");
    else showToast(res.error || "Could not send reset email.", "error");
  };

  const handleLogout = async () => {
    if (emp) logAudit && logAudit("logout", "employee", emp.id, { name: emp.name, portal: "employee" });
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
        // A session that belongs to a since-terminated employee is dropped.
        if (f && f.status === "terminated") {
          try { localStorage.removeItem("svd_emp_session"); sessionStorage.removeItem("svd_emp_session"); } catch (e) { /* ignore */ }
          try { await employeeSignOut(); } catch (e) { /* ignore */ }
          return;
        }
        if (active && f) { setEmp(f); setLoggedIn(true); return; }
      }
      // b) Supabase Auth session (for provisioned accounts).
      const { data } = await supabase.auth.getSession();
      const sessEmail = data?.session?.user?.email;
      if (!active || !sessEmail) return;
      const found = employees.find((e) => (e.email || "").toLowerCase() === sessEmail.toLowerCase());
      if (found && found.status === "terminated") {
        try { await employeeSignOut(); } catch (e) { /* ignore */ }
        return;
      }
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
  const draftKey = (date) => (emp ? `svd_dsr_draft_${emp.id}_${date}` : "");
  const readDraft = (date) => { try { const r = localStorage.getItem(draftKey(date)); return r ? JSON.parse(r) : null; } catch (e) { return null; } };
  const onDateChange = (date) => {
    setDsrDate(date);
    const existing = submissions.find((s) => s.empId === emp.id && s.date === date);
    const base = dsrFromExisting(existing);
    // Restore an unsubmitted local draft if one exists for this date.
    const draft = existing?.status === "Submitted" ? null : readDraft(date);
    setDsrForm(draft ? { ...base, ...draft } : base);
  };

  // Restore today's draft on first entering the portal.
  useEffect(() => {
    if (!emp) return;
    const existing = submissions.find((s) => s.empId === emp.id && s.date === dsrDate);
    const draft = existing?.status === "Submitted" ? null : readDraft(dsrDate);
    if (draft) setDsrForm((f) => ({ ...f, ...draft }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [emp?.id]);

  // Auto-save the DSR draft every 30s while editing (debounced by dep on dsrForm).
  useEffect(() => {
    if (!emp || empTab !== "form") return;
    const iv = setInterval(() => { try { localStorage.setItem(draftKey(dsrDate), JSON.stringify(dsrForm)); } catch (e) { /* ignore */ } }, 30000);
    return () => clearInterval(iv);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [emp?.id, empTab, dsrDate, dsrForm]);

  const isOpsEmp = (emp?.department || "") === "Operations";
  const handleDsrSave = async (status) => {
    if (status === "Submitted") {
      if (!dsrForm.attendance) { showToast("Please select Attendance.", "error"); return; }
      if (dsrForm.attendance !== "Absent") {
        if (isOpsEmp) {
          // Operation DSR — kept short: only Working Hours is required.
          if (!String(dsrForm.workingHours ?? "").trim() || Number(dsrForm.workingHours) <= 0) { showToast("Please enter Working Hours.", "error"); return; }
        } else {
          // Sales / default DSR — end-of-day summary fields only (CRM lives in Pipeline).
          if (!String(dsrForm.freshEmails ?? "").trim()) { showToast("Please enter Fresh Emails Sent.", "error"); return; }
          if (!String(dsrForm.reminderEmails ?? "").trim()) { showToast("Please enter Reminder Emails Sent.", "error"); return; }
          if (!String(dsrForm.workingHours ?? "").trim() || Number(dsrForm.workingHours) <= 0) { showToast("Please enter Working Hours.", "error"); return; }
          if (!String(dsrForm.pendingTasks ?? "").trim()) { showToast("Please enter Pending Tasks.", "error"); return; }
          // Updates for Team Lead is optional (recommended).
        }
      }
    }
    const existing = submissions.find((s) => s.empId === emp.id && s.date === dsrDate);
    const websitesData = dsrForm.websites;
    // Fold the Operation DSR sections into customFields.__op so they persist in the
    // submissions JSONB without any schema change.
    const opClean = (arr) => (dsrForm.attendance === "Absent" ? [] : (arr || []).filter((r) => r && r.domain && String(r.domain).trim()));
    const mergedCustom = isOpsEmp
      ? { ...(dsrForm.customFields || {}), __op: {
          websiteWork: opClean(dsrForm.opWebsiteWork),
          social: opClean(dsrForm.opSocial),
          magazine: opClean(dsrForm.opMagazine),
        } }
      : (dsrForm.customFields || {});
    const rec = {
      id: existing ? existing.id : String(Date.now()),
      empId: emp.id, empName: emp.name, department: emp.department, date: dsrDate,
      status, ts: Date.now(),
      ...dsrForm, websitesData, customFields: mergedCustom,
      // BACKWARD-COMPAT: the DSR no longer edits CRM sections — preserve whatever
      // the Pipeline already rolled up into today's row so Admin counters don't reset.
      leads: existing?.leads || dsrForm.leads || [],
      followups: existing?.followups || dsrForm.followups || [],
      calls: existing?.calls || dsrForm.calls || [],
      sales: existing?.sales || dsrForm.sales || [],
      payments: existing?.payments || dsrForm.payments || [],
      contractOrders: existing?.contractOrders || dsrForm.contractOrders || [],
    };
    const res = await upsertSubmission(rec);
    if (res && res.success === false) return; // save failed; error toast already shown
    if (status === "Submitted") { try { localStorage.removeItem(draftKey(dsrDate)); } catch (e) { /* ignore */ } }
    showToast(status === "Submitted" ? "Daily Status Report submitted successfully." : "Draft saved.", "success");
    if (status === "Submitted") pushNotification(`${emp.name} submitted their DSR for ${fmtDate(dsrDate)}.`);
  };

  /* ── Render: not logged in -> Employee login only ─────────── */
  if (!loggedIn) {
    return (
      <>
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
        {loginSuccess && <LoginSuccess message="Employee login successful" />}
      </>
    );
  }

  /* ── Render: Designer dashboard (Design department) ───────── */
  if (emp && (emp.department || "").toLowerCase() === "design") {
    return (
      <DesignerDashboard
        emp={emp} logo={logo} theme={theme} toggleTheme={toggleTheme} onLogout={handleLogout}
        designProjects={designProjects} designArchive={designArchive} designFiles={designFiles}
        uploadDesignFile={uploadDesignFile} deleteDesignFile={deleteDesignFile} updateDesignProject={updateDesignProject}
        designActivity={designActivity} changeProjectStatus={changeProjectStatus} addProjectComment={addProjectComment} uploadMessageImage={uploadMessageImage}
        notifications={notifications} markNotificationRead={markNotificationRead} markAllNotificationsRead={markAllNotificationsRead} clearNotifications={clearNotifications}
        designWork={designWork} saveDesignWork={saveDesignWork} pushNotification={pushNotification}
        brandDomains={brandDomains}
        designExtra={designExtra} releaseDesign={releaseDesign} acknowledgeDesign={acknowledgeDesign} markDesignSeen={markDesignSeen} addDesignFolder={addDesignFolder} deleteDesignFolder={deleteDesignFolder}
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
          { key: "pipeline", label: "Pipeline", icon: <Contact size={18} /> },
          { key: "history", label: "My History", icon: <History size={18} /> },
          { key: "leave", label: "Leave", icon: <Palmtree size={18} /> },
          { key: "assigned", label: "Assigned IDs", icon: <IdCard size={18} /> },
          { key: "settings", label: "Settings", icon: <Settings size={18} /> },
        ]}
        active={empTab} onSelect={setEmpTab}
        onSignOut={handleLogout}
      />
      <main className="sv-main">
        {empTab === "pipeline" ? (
          <Pipeline mode="pipeline" emp={emp} onToast={showToast} goTab={setEmpTab} />
        ) : (
        <EmployeeDashboard
          emp={emp} empTab={empTab} setEmpTab={setEmpTab}
          dsrDate={dsrDate} dsrForm={dsrForm} setDsrForm={setDsrForm}
          onDateChange={onDateChange} onSave={handleDsrSave}
          submissions={submissions} websites={websites} domains={domains}
          onLogout={handleLogout}
          histSearch={histSearch} setHistSearch={setHistSearch}
          viewingDsr={viewingDsr} setViewingDsr={setViewingDsr}
          customFields={customFields}
          announcements={announcements.filter((a) => a.departments?.includes(emp.department) && !a.dismissedBy?.includes(emp.id))}
          onDismissAnn={dismissAnnouncement}
          myMessages={messages.filter((m) => m.empId === emp.id)}
          onDismissMsg={handleDismissMessage}
          theme={theme} onToggleTheme={toggleTheme}
          leaves={leaves.filter((l) => l.empId === emp.id)}
          leaveForm={leaveForm} setLeaveForm={setLeaveForm} onApplyLeave={onApplyLeave}
          onUpdatePhoto={updateMyPhoto}
          onSaveAssignedIds={saveMyAssignedIds}
          bankDetails={bankDetails} onSaveBank={saveBankDetails}
          employees={employees}
          logo={logo}
        />
        )}
      </main>
    </div>
  );
}
