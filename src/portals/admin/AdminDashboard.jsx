/**
 * AdminDashboard.jsx — routed at /admin (protected). Admin-only shell
 * with its own sidebar and modules. Reads/writes the same shared data
 * layer (AppDataContext) as the Employee Portal — nothing more.
 */
import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { LayoutDashboard, FileText, Trophy, BarChart3, Building2, ScrollText, CreditCard, Palmtree, Wallet, Users, Settings, Search, Bell, ChevronDown, Palette } from "lucide-react";
import { useAppData } from "../../data/AppDataContext";
import { useAdminAuth } from "./AdminAuthContext";
import Sidebar from "../../components/layout/Sidebar";
import { ViewModal, DetailModal } from "../../components/ui";
import { SalaryModule, ManagerAssignModule, AssignIdsModule } from "../../components/admin";
import InsertionOrderForm from "../../components/admin/InsertionOrderFormDynamic";
import {
  OverviewTab, ReportsTab, LeaderboardTab, AnalyticsTab,
  DepartmentsTab, LeaveBoardTab, SettingsTab, ExpenseTab, DesignsTab,
} from "./AdminTabs";
import { DSR_STATUSES, CHART_COLORS } from "../../utils/constants";
import { genCode, getTodayStr, fmtCurr, fmtDate, sum, downloadCSV } from "../../utils/helpers";

export default function AdminDashboard() {
  const {
    employees, saveEmployees, addEmployee, deleteEmployee, updateEmployee, resetEmployeePassword, assignEmployeeIds,
    submissions, saveSubs,
    departments, saveDepartments,
    websites, saveWebsites,
    targets, saveTargets,
    teamMeta, saveTeamMeta,
    customFields, saveCustomFields,
    announcements, saveAnnouncements, addAnnouncement, deleteAnnouncement,
    messages, saveMessages, addMessage, deleteMessage,
    leaves, saveLeaves, updateLeaveStatus,
    salaries, saveSalaries,
    freelancers, saveFreelancers,
    designWork, saveDesignWork,
    designArchive, saveDesignArchive,
    designExtra, releaseDesign, addDesignFolder, deleteDesignFolder, addDesignLink, deleteDesignLink,
    expenses, addExpense, updateExpense, deleteExpense, captureExpense,
    designProjects, addDesignProject, updateDesignProject, deleteDesignProject,
    designFiles, uploadDesignFile, deleteDesignFile,
    designActivity, changeProjectStatus, requestRevision, addProjectComment,
    logo, onLogoChange, onLogoRemove,
    adminPwd, setAdminPwd,
    settingsPwd, setSettingsPwd,
    theme, toggleTheme,
    pipelineClients, pipelineStatuses, pipelineFollowups, pipelineSales, pipelinePayments, pipelineContracts, pipelineNotes, pipelineHistory, softDeletePipelineClient, restorePipelineClient,
    showToast, pushNotification, notifications, markNotificationRead, markAllNotificationsRead, clearNotifications,
  } = useAppData();
  const { setAdminLoggedIn } = useAdminAuth();
  const navigate = useNavigate();

  /* ── Admin dashboard UI state ─────────────────────────────── */
  const [tab, setTab] = useState("overview");
  const [editMode, setEditMode] = useState(false);
  const [viewing, setViewing] = useState(null);
  const [detailModal, setDetailModal] = useState(null);
  const [profileOpen, setProfileOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const unreadNotifs = (notifications || []).filter((n) => !n.read).length;
  const timeAgo = (ts) => { const s = Math.floor((Date.now() - ts) / 1000); if (s < 60) return "just now"; const m = Math.floor(s / 60); if (m < 60) return m + "m ago"; const h = Math.floor(m / 60); if (h < 24) return h + "h ago"; return new Date(ts).toLocaleDateString(); };

  const [ovPeriod, setOvPeriod] = useState("week");
  const [ovDateFrom, setOvDateFrom] = useState("");
  const [ovDateTo, setOvDateTo] = useState("");

  const [reportEmpSearch, setReportEmpSearch] = useState("");
  const [reportDept, setReportDept] = useState("");
  const [reportDateFrom, setReportDateFrom] = useState("");
  const [reportDateTo, setReportDateTo] = useState("");

  const [lbPeriod, setLbPeriod] = useState("month");

  const [newEmp, setNewEmp] = useState("");
  const [newEmpEmail, setNewEmpEmail] = useState("");
  const [newEmpPwd, setNewEmpPwd] = useState("");
  const [newDept, setNewDept] = useState("");
  const [newWebsite, setNewWebsite] = useState("");
  const [annText, setAnnText] = useState("");
  const [annDepts, setAnnDepts] = useState([]);
  const [msgEmpId, setMsgEmpId] = useState("");
  const [msgText, setMsgText] = useState("");

  const handleAdminLogout = () => {
    setAdminLoggedIn(false);
    setTab("overview");
    navigate("/admin/login", { replace: true });
  };

  /* ── Employee management ──────────────────────────────────── */
  const addEmployeeQuick = async () => {
    const name = newEmp.trim();
    if (!name) return;
    const namePart = name.replace(/[^a-zA-Z]/g, "").split(/\s+/)[0] || "Emp";
    const id = `${namePart}-${String(Date.now()).slice(-6)}`;
    const pwd = newEmpPwd.trim() || "1234";
    const email = newEmpEmail.trim();
    const ok = await addEmployee({ id, name, department: "Sales", code: genCode(), teamLead: "", email, photo: "", password: pwd });
    if (!ok) return;
    setNewEmp(""); setNewEmpEmail(""); setNewEmpPwd("");
    showToast(email ? `${name} added. Login: ${email} / ${pwd}` : `${name} added (password ${pwd}). Add an email so they can log in.`, "success");
  };

  /* ── Leave board ──────────────────────────────────────────── */
  const setLeaveStatus = (id, status, remark = "") => {
    updateLeaveStatus(id, status, remark);
    showToast(`Leave ${status.toLowerCase()}.`, "success");
  };
  const pendingLeaveCount = useMemo(() => leaves.filter((l) => l.status === "Pending").length, [leaves]);

  /* ── Departments / announcements / messages ──────────────── */
  const addDept = () => {
    const v = newDept.trim();
    if (!v || departments.some((d) => d.toLowerCase() === v.toLowerCase())) return;
    saveDepartments([...departments, v]);
    setNewDept("");
  };
  const removeDept = (d) => { if (window.confirm(`Remove department "${d}"?`)) saveDepartments(departments.filter((x) => x !== d)); };

  const publishAnnouncement = async () => {
    if (!annText.trim() || annDepts.length === 0) { showToast("Write a message and pick departments.", "error"); return; }
    const depts = annDepts.includes("All") ? departments : annDepts;
    await addAnnouncement(annText.trim(), depts);
    setAnnText(""); setAnnDepts([]);
    showToast("Announcement published.", "success");
  };
  const publishDeptAnnouncement = async (dept, text) => {
    if (!text.trim()) return;
    await addAnnouncement(text.trim(), [dept]);
    showToast(`Announcement published to ${dept}.`, "success");
  };

  const addCustomField = (label, type, required) => {
    saveCustomFields([...customFields, { id: Date.now(), label: label.trim(), type, required }]);
  };
  const editCustomField = (id, label) => saveCustomFields(customFields.map((f) => (f.id === id ? { ...f, label } : f)));
  const removeCustomField = (id) => { if (window.confirm("Remove this DSR field?")) saveCustomFields(customFields.filter((f) => f.id !== id)); };

  const sendMessage = async () => {
    if (!msgEmpId || !msgText.trim()) { showToast("Pick an employee and write a message.", "error"); return; }
    await addMessage(msgEmpId, msgText.trim());
    setMsgText("");
    showToast("Message sent.", "success");
  };

  /* ── Derived / computed data ──────────────────────────────── */
  const todayStr = getTodayStr();

  const todaySubs = useMemo(
    () => submissions.filter((s) => s.date === todayStr && s.status === "Submitted"),
    [submissions, todayStr]
  );

  const empStats = useMemo(() => employees.map((e) => {
    const mine = submissions.filter((s) => s.empId === e.id);
    return {
      ...e,
      totalEmails: sum(mine, "freshEmails") + sum(mine, "reminderEmails"),
      totalLeads: sum(mine, "newLeadsInterested"),
      totalCalls: sum(mine, "callsScheduled"),
      totalSales: sum(mine, "salesGenerated"),
      totalPayments: sum(mine, "paymentReceived"),
      totalFollowUps: sum(mine, "newFollowUps"),
      submittedToday: mine.some((s) => s.date === todayStr && s.status === "Submitted"),
      todayStatus: mine.some((s) => s.date === todayStr && s.status === "Submitted")
        ? "submitted"
        : mine.some((s) => s.date === todayStr)
        ? "draft"
        : "none",
      pendingTasks: mine.filter((s) => s.status !== "Submitted").length,
    };
  }), [employees, submissions, todayStr]);

  const reportsFiltered = useMemo(() => submissions
    .filter((s) => !reportEmpSearch || s.empName?.toLowerCase().includes(reportEmpSearch.toLowerCase()))
    .filter((s) => !reportDept || s.department === reportDept)
    .filter((s) => !reportDateFrom || s.date >= reportDateFrom)
    .filter((s) => !reportDateTo || s.date <= reportDateTo)
    .sort((a, b) => (a.date < b.date ? 1 : -1))
    .slice(0, 200),
    [submissions, reportEmpSearch, reportDept, reportDateFrom, reportDateTo]
  );

  const exportCSV = () => {
    const rows = [["Employee", "Department", "Date", "Status", "Emails", "Leads", "Calls", "Sales", "Payments", "Hours"]];
    reportsFiltered.forEach((r) => rows.push([
      r.empName, r.department, r.date, r.status,
      (Number(r.freshEmails) || 0) + (Number(r.reminderEmails) || 0),
      r.newLeadsInterested, r.callsScheduled, r.salesGenerated, r.paymentReceived, r.workingHours,
    ]));
    downloadCSV(`successviews-report-${todayStr}.csv`, rows);
  };

  const monthlySalary = useMemo(() => {
    const byMonth = {};
    Object.entries(salaries || {}).forEach(([empId, sal]) => {
      (sal.payments || []).forEach((p) => {
        const key = (p.date || "").slice(0, 7);
        if (!key) return;
        if (!byMonth[key]) byMonth[key] = { monthKey: key, total: 0, byEmp: {} };
        byMonth[key].total += Number(p.amount) || 0;
        byMonth[key].byEmp[empId] = (byMonth[key].byEmp[empId] || 0) + (Number(p.amount) || 0);
      });
    });
    const nameOf = (id) => (employees.find((e) => e.id === id)?.name) || id;
    return Object.values(byMonth)
      .sort((a, b) => a.monthKey.localeCompare(b.monthKey))
      .map((m) => ({
        monthKey: m.monthKey,
        label: new Date(m.monthKey + "-01T00:00:00").toLocaleDateString("en-IN", { month: "short", year: "numeric" }),
        total: m.total,
        breakdown: Object.entries(m.byEmp)
          .map(([id, amt]) => ({ name: nameOf(id), amount: amt }))
          .sort((a, b) => b.amount - a.amount),
      }));
  }, [salaries, employees]);

  const statusPie = useMemo(() => DSR_STATUSES.map((s, i) => ({
    name: s, value: submissions.filter((x) => x.status === s).length, color: CHART_COLORS[i],
  })), [submissions]);

  const pieData = useMemo(() => [
    { name: "Emails", value: sum(submissions, "freshEmails") + sum(submissions, "reminderEmails"), color: CHART_COLORS[0] },
    { name: "Leads", value: sum(submissions, "newLeadsInterested"), color: CHART_COLORS[1] },
    { name: "Calls", value: sum(submissions, "callsScheduled"), color: CHART_COLORS[2] },
    { name: "Follow-ups", value: sum(submissions, "newFollowUps"), color: CHART_COLORS[3] },
  ], [submissions]);

  const chartData = useMemo(() => {
    const byDate = {};
    submissions.forEach((s) => {
      byDate[s.date] = byDate[s.date] || { date: s.date, emails: 0, leads: 0, calls: 0, fu: 0 };
      byDate[s.date].emails += (Number(s.freshEmails) || 0) + (Number(s.reminderEmails) || 0);
      byDate[s.date].leads += Number(s.newLeadsInterested) || 0;
      byDate[s.date].calls += Number(s.callsScheduled) || 0;
      byDate[s.date].fu += Number(s.newFollowUps) || 0;
    });
    return Object.values(byDate).sort((a, b) => (a.date > b.date ? 1 : -1)).slice(-14);
  }, [submissions]);

  const ovFiltered = useMemo(() => {
    let from = ovDateFrom, to = ovDateTo || todayStr;
    if (ovPeriod === "today") {
      from = todayStr; to = todayStr;
    } else if (ovPeriod === "week") {
      // "This Week" = Monday–Saturday of the current week; resets every Monday.
      const d = new Date(todayStr + "T00:00:00Z");
      const dow = d.getUTCDay();                 // 0=Sun … 6=Sat
      const toMon = dow === 0 ? -6 : 1 - dow;    // Sunday counts to the week just ended
      const mon = new Date(d); mon.setUTCDate(d.getUTCDate() + toMon);
      const sat = new Date(mon); sat.setUTCDate(mon.getUTCDate() + 5);
      from = mon.toISOString().split("T")[0];
      to = sat.toISOString().split("T")[0];
    } else if (ovPeriod === "month") {
      const d = new Date(todayStr + "T00:00:00Z");
      d.setUTCDate(d.getUTCDate() - 29);
      from = d.toISOString().split("T")[0];
      to = todayStr;
    }
    return submissions.filter((s) => s.date >= (from || "0000-00-00") && s.date <= to);
  }, [submissions, ovPeriod, ovDateFrom, ovDateTo, todayStr]);

  const ovPieData = useMemo(() => [
    { name: "Emails", value: sum(ovFiltered, "freshEmails") + sum(ovFiltered, "reminderEmails"), color: CHART_COLORS[0] },
    { name: "Leads", value: sum(ovFiltered, "newLeadsInterested"), color: CHART_COLORS[1] },
    { name: "Calls", value: sum(ovFiltered, "callsScheduled"), color: CHART_COLORS[2] },
    { name: "Follow-ups", value: sum(ovFiltered, "newFollowUps"), color: CHART_COLORS[3] },
  ], [ovFiltered]);

  const ovBarData = useMemo(() => {
    const byDate = {};
    ovFiltered.forEach((s) => {
      byDate[s.date] = byDate[s.date] || { date: s.date, sales: 0, payment: 0 };
      byDate[s.date].sales += Number(s.salesGenerated) || 0;
      byDate[s.date].payment += Number(s.paymentReceived) || 0;
    });
    return Object.values(byDate).sort((a, b) => (a.date > b.date ? 1 : -1));
  }, [ovFiltered]);

  const openDM = (type) => {
    const src = ovFiltered;
    let title = "Details", columns = [], rows = [];
    const each = (fn) => src.forEach((s) => fn(s));
    if (type === "emails") {
      title = "Emails Sent"; columns = ["Employee", "Date", "Fresh", "Reminder", "Total"];
      each((s) => rows.push([s.empName, fmtDate(s.date), Number(s.freshEmails) || 0, Number(s.reminderEmails) || 0, (Number(s.freshEmails) || 0) + (Number(s.reminderEmails) || 0)]));
    } else if (type === "reminders") {
      title = "Reminder Emails"; columns = ["Employee", "Date", "Reminder Emails"];
      each((s) => rows.push([s.empName, fmtDate(s.date), Number(s.reminderEmails) || 0]));
    } else if (type === "leads") {
      title = "New Leads / Interested"; columns = ["Employee", "Client", "ID Name", "Domain", "Price"];
      each((s) => (s.leads || []).forEach((l) => rows.push([s.empName, l.clientName, l.idName, l.domain, l.price])));
    } else if (type === "followups") {
      title = "Client Follow-ups"; columns = ["Employee", "Client", "Domain"];
      each((s) => (s.followups || []).forEach((f) => rows.push([s.empName, f.clientName, f.domain])));
    } else if (type === "calls") {
      title = "Scheduled Calls"; columns = ["Employee", "Client", "ID Name", "Domain", "Time"];
      each((s) => (s.calls || []).forEach((c) => rows.push([s.empName, c.clientName, c.idName, c.domain, `${c.time || ""}${c.tz ? " " + c.tz : ""}`])));
    } else if (type === "sales") {
      title = "Sales Generated"; columns = ["Employee", "Amount", "Currency", "ID Name"];
      each((s) => (s.sales || []).forEach((x) => rows.push([s.empName, x.amount, x.currency, x.idName])));
    } else if (type === "orders") {
      title = "Contract Order Sent"; columns = ["Date", "Client Name", "Price", "Employee", "Domain"];
      each((s) => (s.contractOrders || []).forEach((c) => rows.push([fmtDate(s.date), c.clientName, c.price, `${s.empName} (${s.empId})`, c.domain_custom || c.domain])));
    } else if (type === "payments") {
      title = "Payments Received"; columns = ["Employee", "Amount", "Currency", "ID Name"];
      each((s) => (s.payments || []).forEach((x) => rows.push([s.empName, x.amount, x.currency, x.idName])));
    } else if (type === "updates") {
      title = "Team Lead Updates"; columns = ["Employee", "Date", "Update"];
      each((s) => { if (s.updatesForTeamLead) rows.push([s.empName, fmtDate(s.date), s.updatesForTeamLead]); });
    } else if (type === "dsr") {
      title = "DSR Submitted"; columns = ["Employee", "Date", "Attendance", "Status"];
      each((s) => { if (s.status === "Submitted") rows.push([s.empName, fmtDate(s.date), s.attendance, s.status]); });
    }
    setDetailModal({ title, columns, rows });
  };

  return (
    <div className={`sv-app-shell sv-admin${theme === "dark" ? " sv-dark" : ""}`}>
      <Sidebar
        logo={logo} brandTitle="ADMIN" brandSubtitle="" hideAvatar profileVariant="admin"
        theme={theme} onToggleTheme={toggleTheme}
        nav={[
          { key: "overview", label: "Overview", icon: <LayoutDashboard size={18} /> },
          { key: "reports", label: "Reports", icon: <FileText size={18} /> },
          { key: "leaderboard", label: "Leaderboard", icon: <Trophy size={18} /> },
          { key: "analytics", label: "Analytics", icon: <BarChart3 size={18} /> },
          { key: "departments", label: "Departments", icon: <Building2 size={18} /> },
          { key: "insertionorder", label: "Insertion Order", icon: <ScrollText size={18} /> },
          { key: "leaveboard", label: "Leave Board", icon: <Palmtree size={18} />, badge: pendingLeaveCount || null },
          { key: "salary", label: "Salary", icon: <Wallet size={18} /> },
          { key: "expense", label: "Expense", icon: <CreditCard size={18} /> },
          { key: "designs", label: "Designs", icon: <Palette size={18} /> },
          { key: "managerassign", label: "Manager/IDs Assign", icon: <Users size={18} /> },
          { key: "settings", label: "Settings", icon: <Settings size={18} /> },
        ]}
        active={tab} onSelect={setTab}
        onSignOut={handleAdminLogout}
      />
      <main className="sv-main">
        <header className="sv-topbar">
          <div className="sv-topbar-search">
            <Search size={16} />
            <input type="text" placeholder="Search employees, reports, orders…" aria-label="Search" />
          </div>
          <div className="sv-topbar-actions">
            <div className="sv-topbar-notif">
              <button className="sv-topbar-iconbtn" title="Notifications" onClick={() => setNotifOpen((v) => !v)}>
                <Bell size={18} />
                {unreadNotifs ? <span className="sv-topbar-badge">{unreadNotifs}</span> : null}
              </button>
              {notifOpen && <div className="sv-notif-overlay" onClick={() => setNotifOpen(false)} />}
              {notifOpen && (
                <div className="sv-notif-panel" onClick={(e) => e.stopPropagation()}>
                  <div className="sv-notif-head">
                    <span className="sv-notif-title">Notifications{unreadNotifs ? ` · ${unreadNotifs} new` : ""}</span>
                    <div className="sv-flex sv-gap-2">
                      <button className="sv-notif-act" onClick={markAllNotificationsRead} disabled={!unreadNotifs}>Mark all read</button>
                      <button className="sv-notif-act" onClick={clearNotifications} disabled={!(notifications || []).length}>Clear</button>
                    </div>
                  </div>
                  <div className="sv-notif-list">
                    {(notifications || []).length === 0 ? (
                      <div className="sv-notif-empty">🔔 You're all caught up.</div>
                    ) : (notifications || []).map((n) => (
                      <div key={n.id} className={`sv-notif-card sv-notif-card--${n.type || "info"}${n.read ? " is-read" : ""}`} onClick={() => markNotificationRead(n.id)}>
                        <span className="sv-notif-dot" />
                        <div style={{ minWidth: 0, flex: 1 }}>
                          <div className="sv-notif-msg">{n.msg}</div>
                          <div className="sv-notif-time">{timeAgo(n.ts)}</div>
                        </div>
                        {!n.read && <span className="sv-notif-unread" title="Unread" />}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <div className="sv-topbar-profile" onClick={() => setProfileOpen((v) => !v)}>
              <span className="sv-topbar-avatar">A</span>
              <span className="sv-topbar-name">Admin</span>
              <ChevronDown size={15} />
              {profileOpen && (
                <div className="sv-topbar-menu" onClick={(e) => e.stopPropagation()}>
                  <button onClick={() => { setProfileOpen(false); setTab("settings"); }}>Settings</button>
                  <button onClick={() => { setProfileOpen(false); handleAdminLogout(); }}>Sign Out</button>
                </div>
              )}
            </div>
          </div>
        </header>

        {tab === "overview" && (
          <OverviewTab
            empStats={empStats} ovFiltered={ovFiltered} employees={employees}
            ovPeriod={ovPeriod} setOvPeriod={setOvPeriod}
            ovDateFrom={ovDateFrom} setOvDateFrom={setOvDateFrom}
            ovDateTo={ovDateTo} setOvDateTo={setOvDateTo}
            ovPieData={ovPieData} ovBarData={ovBarData} openDM={openDM}
            pipelineClients={pipelineClients} pipelineStatuses={pipelineStatuses}
            pipelineFollowups={pipelineFollowups} pipelineSales={pipelineSales} pipelinePayments={pipelinePayments}
            pipelineContracts={pipelineContracts} pipelineNotes={pipelineNotes} pipelineHistory={pipelineHistory} softDeletePipelineClient={softDeletePipelineClient} restorePipelineClient={restorePipelineClient}
          />
        )}
        {tab === "reports" && (
          <ReportsTab
            reportEmpSearch={reportEmpSearch} setReportEmpSearch={setReportEmpSearch}
            reportDept={reportDept} setReportDept={setReportDept} departments={departments}
            reportDateFrom={reportDateFrom} setReportDateFrom={setReportDateFrom}
            reportDateTo={reportDateTo} setReportDateTo={setReportDateTo}
            rows={reportsFiltered} onView={setViewing} onExport={exportCSV}
            pipelineClients={pipelineClients} pipelineSales={pipelineSales} pipelinePayments={pipelinePayments}
          />
        )}
        {tab === "leaderboard" && <LeaderboardTab empStats={empStats} submissions={submissions} lbPeriod={lbPeriod} setLbPeriod={setLbPeriod} />}
        {tab === "analytics" && <AnalyticsTab empStats={empStats} statusPie={statusPie} chartData={chartData} monthlySalary={monthlySalary} />}
        {tab === "departments" && (
          <DepartmentsTab
            departments={departments} employees={employees} submissions={submissions}
            newDept={newDept} setNewDept={setNewDept} addDept={addDept} removeDept={removeDept}
            annText={annText} setAnnText={setAnnText} annDepts={annDepts} setAnnDepts={setAnnDepts}
            publishAnnouncement={publishAnnouncement} announcements={announcements}
            customFields={customFields} setCustomFields={saveCustomFields}
            onPublishDeptAnnouncement={publishDeptAnnouncement} onDeleteAnnouncement={deleteAnnouncement}
            onAddField={addCustomField} onEditField={editCustomField} onRemoveField={removeCustomField}
            todayStr={todayStr} editMode={editMode}
          />
        )}
        {tab === "insertionorder" && <InsertionOrderForm onCapture={captureExpense} />}
        {tab === "leaveboard" && <LeaveBoardTab leaves={leaves} employees={employees} setLeaveStatus={setLeaveStatus} editMode={editMode} />}
        {tab === "salary" && (
          <SalaryModule employees={employees} salaries={salaries} setSalaries={saveSalaries} captureExpense={captureExpense}
            showToast={showToast} pushNotification={pushNotification}
            addMessage={addMessage} editMode={editMode} setEditMode={setEditMode} settingsPwd={settingsPwd} logo={logo}
            freelancers={freelancers} saveFreelancers={saveFreelancers} />
        )}
        {tab === "expense" && (
          <ExpenseTab expenses={expenses} addExpense={addExpense} updateExpense={updateExpense} deleteExpense={deleteExpense} logo={logo} />
        )}
        {tab === "designs" && (
          <DesignsTab designProjects={designProjects} addDesignProject={addDesignProject} updateDesignProject={updateDesignProject} deleteDesignProject={deleteDesignProject} employees={employees} designFiles={designFiles} uploadDesignFile={uploadDesignFile} deleteDesignFile={deleteDesignFile} designActivity={designActivity} changeProjectStatus={changeProjectStatus} requestRevision={requestRevision} designWork={designWork} saveDesignWork={saveDesignWork} pushNotification={pushNotification} captureExpense={captureExpense} designArchive={designArchive} saveDesignArchive={saveDesignArchive} addProjectComment={addProjectComment} designExtra={designExtra} releaseDesign={releaseDesign} addDesignFolder={addDesignFolder} deleteDesignFolder={deleteDesignFolder} addDesignLink={addDesignLink} deleteDesignLink={deleteDesignLink} />
        )}
        {tab === "managerassign" && (
          <div className="sv-flex-col sv-gap-4">
            <ManagerAssignModule employees={employees} setEmployees={saveEmployees}
              showToast={showToast} editMode={editMode} submissions={submissions}
              teamMeta={teamMeta} saveTeamMeta={saveTeamMeta} targets={targets} />
            <AssignIdsModule employees={employees} assignEmployeeIds={assignEmployeeIds}
              teamMeta={teamMeta} showToast={showToast} />
          </div>
        )}
        {tab === "settings" && (
          <SettingsTab
            employees={employees} setEmployees={saveEmployees}
            departments={departments} freelancers={freelancers} teamMeta={teamMeta}
            onUpdateEmp={updateEmployee} onDeleteEmp={deleteEmployee} onResetPwd={resetEmployeePassword}
            newEmp={newEmp} setNewEmp={setNewEmp} addEmployeeQuick={addEmployeeQuick}
            newEmpEmail={newEmpEmail} setNewEmpEmail={setNewEmpEmail} newEmpPwd={newEmpPwd} setNewEmpPwd={setNewEmpPwd}
            adminPwd={adminPwd} setAdminPwd={setAdminPwd}
            editMode={editMode} setEditMode={setEditMode} settingsPwd={settingsPwd} setSettingsPwd={setSettingsPwd}
            msgEmpId={msgEmpId} setMsgEmpId={setMsgEmpId} msgText={msgText} setMsgText={setMsgText}
            sendMessage={sendMessage} messages={messages} deleteMessage={deleteMessage}
            targets={targets} setTargets={saveTargets}
            logo={logo} onLogoChange={onLogoChange} onLogoRemove={onLogoRemove}
            websites={websites} newWebsite={newWebsite} setNewWebsite={setNewWebsite}
            addWebsite={() => { if (newWebsite.trim()) { saveWebsites([...websites, newWebsite.trim()]); setNewWebsite(""); } }}
            removeWebsite={(w) => saveWebsites(websites.filter((x) => x !== w))}
            pushNotification={pushNotification} showToast={showToast}
          />
        )}
      </main>

      {viewing && <ViewModal report={viewing} onClose={() => setViewing(null)} toast={(m) => showToast(m, "success")} />}
      {detailModal && <DetailModal {...detailModal} onClose={() => setDetailModal(null)} />}
    </div>
  );
}
