/**
 * AdminDashboard.jsx — routed at /admin (protected). Admin-only shell
 * with its own sidebar and modules. Reads/writes the same shared data
 * layer (AppDataContext) as the Employee Portal — nothing more.
 */
import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useAppData } from "../../data/AppDataContext";
import { useAdminAuth } from "./AdminAuthContext";
import Sidebar from "../layout/Sidebar";
import { ViewModal, DetailModal } from "../ui";
import { SalaryModule, ManagerAssignModule } from ".";
import {
  OverviewTab, ReportsTab, LeaderboardTab, AnalyticsTab,
  DepartmentsTab, LeaveBoardTab, SettingsTab,
} from "./AdminTabs";
import { DSR_STATUSES, CHART_COLORS } from "../../utils/constants";
import { genCode, getTodayStr, fmtCurr, fmtDate, sum, downloadCSV } from "../../utils/helpers";

export default function AdminDashboard() {
  const {
    employees, saveEmployees, addEmployee, deleteEmployee, updateEmployee, resetEmployeePassword,
    submissions, saveSubs,
    departments, saveDepartments,
    websites, saveWebsites,
    targets, saveTargets,
    customFields, saveCustomFields,
    announcements, saveAnnouncements, addAnnouncement, deleteAnnouncement,
    messages, saveMessages, addMessage, deleteMessage,
    leaves, saveLeaves, updateLeaveStatus,
    salaries, saveSalaries,
    logo, onLogoChange, onLogoRemove,
    adminPwd, setAdminPwd,
    theme, toggleTheme,
    showToast, pushNotification,
  } = useAppData();
  const { setAdminLoggedIn } = useAdminAuth();
  const navigate = useNavigate();

  /* ── Admin dashboard UI state ─────────────────────────────── */
  const [tab, setTab] = useState("overview");
  const [editMode, setEditMode] = useState(false);
  const [viewing, setViewing] = useState(null);
  const [detailModal, setDetailModal] = useState(null);

  const [ovPeriod, setOvPeriod] = useState("today");
  const [ovDateFrom, setOvDateFrom] = useState("");
  const [ovDateTo, setOvDateTo] = useState("");

  const [reportEmpSearch, setReportEmpSearch] = useState("");
  const [reportDept, setReportDept] = useState("");
  const [reportDateFrom, setReportDateFrom] = useState("");
  const [reportDateTo, setReportDateTo] = useState("");

  const [lbPeriod, setLbPeriod] = useState("month");

  const [newEmp, setNewEmp] = useState("");
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
    const ok = await addEmployee({ id, name, department: "Sales", code: genCode(), teamLead: "", email: "", photo: "" });
    if (!ok) return;
    setNewEmp("");
    showToast(`${name} added. Default password: 1234`, "success");
  };

  /* ── Leave board ──────────────────────────────────────────── */
  const setLeaveStatus = (id, status, remark = "") => {
    updateLeaveStatus(id, status, remark);
    showToast(`Leave ${status.toLowerCase()}.`, "success");
  };
  const pendingLeaveCount = useMemo(() => leaves.filter((l) => l.status === "Pending").length, [leaves]);

  /* ── Departments / announcements / messages ──────────────── */
  const addDept = () => {
    if (!newDept.trim() || departments.includes(newDept.trim())) return;
    saveDepartments([...departments, newDept.trim()]);
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
    if (ovPeriod !== "custom") {
      const days = { today: 0, week: 6, month: 29 }[ovPeriod] ?? 0;
      const fromDate = new Date(todayStr + "T00:00:00");
      fromDate.setDate(fromDate.getDate() - days);
      from = fromDate.toISOString().split("T")[0];
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
    } else if (type === "sales" || type === "orders") {
      title = type === "orders" ? "Contract Orders" : "Sales Generated"; columns = ["Employee", "Amount", "Currency", "ID Name"];
      each((s) => (s.sales || []).forEach((x) => rows.push([s.empName, x.amount, x.currency, x.idName])));
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
    <div className={`sv-app-shell${theme === "dark" ? " sv-dark" : ""}`}>
      <Sidebar
        logo={logo} brandTitle="SuccessViews" brandSubtitle="Admin Console"
        theme={theme} onToggleTheme={toggleTheme}
        nav={[
          { key: "overview", label: "📊 Overview" },
          { key: "reports", label: "📋 Reports" },
          { key: "leaderboard", label: "🏆 Leaderboard" },
          { key: "analytics", label: "📈 Analytics" },
          { key: "departments", label: "🏢 Departments" },
          { key: "leaveboard", label: "🌴 Leave Board", badge: pendingLeaveCount || null },
          { key: "salary", label: "💰 Salary" },
          { key: "managerassign", label: "🧑‍💼 Manager Assign" },
          { key: "settings", label: "⚙️ Settings" },
        ]}
        active={tab} onSelect={setTab}
        onSignOut={handleAdminLogout}
      />
      <main className="sv-main">

        {/* ── Edit Mode Toggle Bar ── */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "10px 20px", marginBottom: 16,
          background: editMode ? "#FEF3C7" : "#F1F5F9",
          border: `1.5px solid ${editMode ? "#FDE68A" : "#E2E8F0"}`,
          borderRadius: 10, gap: 12,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 18 }}>{editMode ? "✏️" : "👁️"}</span>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: editMode ? "#92400E" : "#475569" }}>
                {editMode ? "Edit Mode — ON" : "View Mode — Read Only"}
              </div>
              <div style={{ fontSize: 11, color: editMode ? "#B45309" : "#94A3B8" }}>
                {editMode ? "You can now make changes. Click Lock to go back to view mode." : "Click Edit to make changes."}
              </div>
            </div>
          </div>
          <button
            onClick={() => setEditMode((e) => !e)}
            style={{
              padding: "8px 20px", borderRadius: 8, border: "none", cursor: "pointer",
              fontWeight: 700, fontSize: 13,
              background: editMode ? "#DC2626" : "#1D4ED8",
              color: "#fff", whiteSpace: "nowrap",
            }}
          >
            {editMode ? "🔒 Lock" : "✏️ Edit"}
          </button>
        </div>

        {tab === "overview" && (
          <OverviewTab
            empStats={empStats} ovFiltered={ovFiltered} employees={employees}
            ovPeriod={ovPeriod} setOvPeriod={setOvPeriod}
            ovDateFrom={ovDateFrom} setOvDateFrom={setOvDateFrom}
            ovDateTo={ovDateTo} setOvDateTo={setOvDateTo}
            ovPieData={ovPieData} ovBarData={ovBarData} openDM={openDM}
          />
        )}
        {tab === "reports" && (
          <ReportsTab
            reportEmpSearch={reportEmpSearch} setReportEmpSearch={setReportEmpSearch}
            reportDept={reportDept} setReportDept={setReportDept} departments={departments}
            reportDateFrom={reportDateFrom} setReportDateFrom={setReportDateFrom}
            reportDateTo={reportDateTo} setReportDateTo={setReportDateTo}
            rows={reportsFiltered} onView={setViewing} onExport={exportCSV}
          />
        )}
        {tab === "leaderboard" && <LeaderboardTab empStats={empStats} submissions={submissions} lbPeriod={lbPeriod} setLbPeriod={setLbPeriod} />}
        {tab === "analytics" && <AnalyticsTab empStats={empStats} pieData={pieData} statusPie={statusPie} chartData={chartData} />}
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
        {tab === "leaveboard" && <LeaveBoardTab leaves={leaves} setLeaveStatus={setLeaveStatus} editMode={editMode} />}
        {tab === "salary" && (
          <SalaryModule employees={employees} salaries={salaries} setSalaries={saveSalaries}
            showToast={showToast} pushNotification={pushNotification}
            addMessage={addMessage} editMode={editMode} />
        )}
        {tab === "managerassign" && (
          <ManagerAssignModule employees={employees} setEmployees={saveEmployees}
            showToast={showToast} editMode={editMode} />
        )}
        {tab === "settings" && (
          <SettingsTab
            employees={employees} setEmployees={saveEmployees}
            onUpdateEmp={updateEmployee} onDeleteEmp={deleteEmployee} onResetPwd={resetEmployeePassword}
            newEmp={newEmp} setNewEmp={setNewEmp} addEmployeeQuick={addEmployeeQuick}
            adminPwd={adminPwd} setAdminPwd={setAdminPwd}
            msgEmpId={msgEmpId} setMsgEmpId={setMsgEmpId} msgText={msgText} setMsgText={setMsgText}
            sendMessage={sendMessage} messages={messages} deleteMessage={deleteMessage}
            targets={targets} setTargets={saveTargets}
            logo={logo} onLogoChange={onLogoChange} onLogoRemove={onLogoRemove}
            websites={websites} newWebsite={newWebsite} setNewWebsite={setNewWebsite}
            addWebsite={() => { if (newWebsite.trim()) { saveWebsites([...websites, newWebsite.trim()]); setNewWebsite(""); } }}
            removeWebsite={(w) => saveWebsites(websites.filter((x) => x !== w))}
            pushNotification={pushNotification} showToast={showToast} editMode={editMode}
          />
        )}
      </main>

      {viewing && <ViewModal report={viewing} onClose={() => setViewing(null)} toast={(m) => showToast(m, "success")} />}
      {detailModal && <DetailModal {...detailModal} onClose={() => setDetailModal(null)} />}
    </div>
  );
}
