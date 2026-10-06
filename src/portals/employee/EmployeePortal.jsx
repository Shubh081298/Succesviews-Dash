/**
 * EmployeePortal.jsx — the entire Employee Portal (login + dashboard).
 * HARD RULE: zero admin buttons, links, menus or imports. Admin is
 * reached only via /admin/login, never from inside this tree.
 */
import { useState, useEffect } from "react";
import { ClipboardList, History, Palmtree, IdCard, Settings, Contact, CalendarDays } from "lucide-react";
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
    employees, saveEmployees, assignEmployeeIds, updateEmployee,
    submissions, saveSubs, upsertSubmission,
    bankDetails, saveBankDetails,
    leaves, saveLeaves, addLeave, cancelLeave, attendanceOverrides,
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

  // Merge old bank_details table data into employee object so pre-existing
  // bank info shows up in the new profile fields without manual re-entry.
  const enrichEmp = (empObj) => {
    if (!empObj) return empObj;
    const bd = bankDetails[empObj.id] || {};
    return {
      ...empObj,
      bankHolder: empObj.bankHolder || bd.recipientName || "",
      bankAccount: empObj.bankAccount || bd.accountNumber || "",
      bankIfsc: empObj.bankIfsc || bd.ifscCode || "",
      bankUpi: empObj.bankUpi || bd.upiId || "",
      // bankName / bankBranch have no equivalent in the old table — keep as-is
    };
  };
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
  const [leaveForm, setLeaveForm] = useState({ fromDate: "", toDate: "", reason: "", leaveType: "" });

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
          .select("id, name, department, code, photo, team_lead, email, assigned_ids, status, terminated_at, terminated_reason, terminated_by, gender, dob, personal_email, mobile, employment_type, address, bank_account, bank_name, bank_ifsc, bank_branch, bank_holder, bank_upi")
          .ilike("email", email).maybeSingle();
        if (data) found = {
          id: data.id, name: data.name, department: data.department, code: data.code, photo: data.photo || "",
          teamLead: data.team_lead || "", email: data.email || "",
          assignedIds: Array.isArray(data.assigned_ids) ? data.assigned_ids : [],
          status: data.status === "terminated" ? "terminated" : "active",
          terminatedAt: data.terminated_at || null, terminatedReason: data.terminated_reason || "", terminatedBy: data.terminated_by || "",
          gender: data.gender || "", dob: data.dob || "", personalEmail: data.personal_email || "",
          mobile: data.mobile || "", employmentType: data.employment_type || "Full-Time",
          address: data.address || "", bankAccount: data.bank_account || "",
          bankName: data.bank_name || "", bankIfsc: data.bank_ifsc || "", bankBranch: data.bank_branch || "", bankHolder: data.bank_holder || "",
          bankUpi: data.bank_upi || "",
        };
        found = enrichEmp(found);
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

    setEmp(enrichEmp(found));
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
        if (active && f) { setEmp(enrichEmp(f)); setLoggedIn(true); return; }
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
      if (found) { setEmp(enrichEmp(found)); setLoggedIn(true); }
    })();
    return () => { active = false; };
  }, [employees, loggedIn]);

  // Keep emp in sync when the employees list or bankDetails refreshes (e.g. real-time update).
  // Preserve any locally-set fields (like photo changes) that haven't persisted yet.
  useEffect(() => {
    if (!emp || !loggedIn) return;
    const fresh = employees.find((e) => e.id === emp.id);
    if (fresh) setEmp((prev) => enrichEmp({ ...fresh, photo: prev?.photo || fresh.photo }));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [employees, bankDetails]);

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
    if (leaveForm.toDate < leaveForm.fromDate) {
      showToast("To Date cannot be before From Date.", "error");
      return;
    }
    await addLeave(emp.id, emp.name, leaveForm.fromDate, leaveForm.toDate, leaveForm.reason, leaveForm.leaveType);
    setLeaveForm({ fromDate: "", toDate: "", reason: "", leaveType: "" });
    showToast("Leave request submitted.", "success");
    pushNotification(`${emp.name} applied for leave (${leaveForm.fromDate} → ${leaveForm.toDate}).`);
  };

  const onCancelLeave = async (id) => {
    await cancelLeave(id);
    showToast("Leave request cancelled.", "success");
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

  // Profile completeness — employee must fill: mobile, dob, personalEmail, address, bank details
  const isProfileComplete = (e) => !!(
    e && e.mobile && e.dob && e.personalEmail && e.address &&
    e.bankHolder && e.bankAccount && e.bankName && e.bankIfsc && e.bankBranch
  );
  const [profileBannerDismissed, setProfileBannerDismissed] = useState(false);

  const handleUpdateProfile = async (fields) => {
    if (!emp) return;
    const updated = { ...emp, ...fields };
    await updateEmployee(updated);
    setEmp(updated);
    if (isProfileComplete(updated)) setProfileBannerDismissed(true);
    showToast("Profile updated successfully!", "success");
  };
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
          { key: "attendance", label: "Attendance", icon: <CalendarDays size={18} /> },
          { key: "leave", label: "Leave", icon: <Palmtree size={18} /> },
          { key: "assigned", label: "Assigned IDs", icon: <IdCard size={18} /> },
          { key: "settings", label: "Settings", icon: <Settings size={18} /> },
        ]}
        active={empTab} onSelect={setEmpTab}
        onSignOut={handleLogout}
      />
      <main className="sv-main">
        {/* Profile completion popup */}
        {emp && !isProfileComplete(emp) && !profileBannerDismissed && (
          <div style={{ position: "fixed", inset: 0, zIndex: 9990, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(15,23,42,.5)", backdropFilter: "blur(3px)" }}>
            <div style={{ background: "#fff", borderRadius: 18, width: "min(94vw,480px)", boxShadow: "0 20px 50px rgba(15,23,42,.18)", overflow: "hidden" }}>
              <div style={{ background: "linear-gradient(135deg,#2563EB,#7C3AED)", padding: "28px 28px 22px", textAlign: "center" }}>
                <div style={{ width: 56, height: 56, borderRadius: 16, background: "rgba(255,255,255,.2)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 14px" }}>
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="4"/><path d="M20 21a8 8 0 1 0-16 0"/></svg>
                </div>
                <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: "#fff" }}>Complete Your Profile</h3>
                <p style={{ margin: "6px 0 0", fontSize: 13, color: "rgba(255,255,255,.8)" }}>Your profile is incomplete. Please fill in the required details.</p>
              </div>
              <div style={{ padding: "20px 24px" }}>
                <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 18 }}>
                  {[
                    { label: "Mobile Number", done: !!emp.mobile },
                    { label: "Date of Birth", done: !!emp.dob },
                    { label: "Personal Email", done: !!emp.personalEmail },
                    { label: "Address", done: !!emp.address },
                    { label: "Bank Account Details", done: !!(emp.bankHolder && emp.bankAccount && emp.bankName && emp.bankIfsc && emp.bankBranch) },
                  ].map(({ label, done }) => (
                    <div key={label} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", background: done ? "#F0FDF4" : "#FFF7ED", border: `1px solid ${done ? "#BBF7D0" : "#FED7AA"}`, borderRadius: 8 }}>
                      <span style={{ width: 20, height: 20, borderRadius: "50%", background: done ? "#16A34A" : "#EA580C", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                        {done
                          ? <svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="2,6 5,9 10,3"/></svg>
                          : <svg width="10" height="10" viewBox="0 0 12 12" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round"><line x1="3" y1="3" x2="9" y2="9"/><line x1="9" y1="3" x2="3" y2="9"/></svg>
                        }
                      </span>
                      <span style={{ fontSize: 13, color: done ? "#15803D" : "#C2410C", fontWeight: done ? 400 : 600 }}>{label}</span>
                    </div>
                  ))}
                </div>
                <div style={{ display: "flex", gap: 10 }}>
                  <button onClick={() => { setProfileBannerDismissed(true); setEmpTab("settings"); }}
                    style={{ flex: 1, background: "#2563EB", color: "#fff", border: "none", borderRadius: 10, padding: "11px 0", fontSize: 14, fontWeight: 600, cursor: "pointer" }}>
                    Go to Settings →
                  </button>
                  <button onClick={() => setProfileBannerDismissed(true)}
                    style={{ padding: "11px 16px", background: "#F1F5F9", border: "none", borderRadius: 10, fontSize: 13, color: "#64748B", cursor: "pointer" }}>
                    Later
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
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
          allLeaves={leaves}
          attendanceOverrides={attendanceOverrides}
          leaveForm={leaveForm} setLeaveForm={setLeaveForm} onApplyLeave={onApplyLeave} onCancelLeave={onCancelLeave}
          onUpdatePhoto={updateMyPhoto}
          onSaveAssignedIds={saveMyAssignedIds}
          bankDetails={bankDetails} onSaveBank={saveBankDetails}
          employees={employees}
          logo={logo}
          onUpdateProfile={handleUpdateProfile}
        />
        )}
      </main>
    </div>
  );
}
