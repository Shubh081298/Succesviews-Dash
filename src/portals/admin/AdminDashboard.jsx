/**
 * AdminDashboard.jsx — routed at /admin (protected).
 * ─────────────────────────────────────────────────────────────
 * The Admin Portal's main shell: its own sidebar/navigation and all
 * admin-only modules (Overview, Reports, Leaderboard, Analytics,
 * Departments, Leave Board, Salary, Manager Assign, Settings).
 *
 * This is a completely separate tree from the Employee Portal —
 * it imports nothing from src/portals/employee, and the Employee
 * Portal imports nothing from here. Both read/write the same
 * shared records through AppDataContext, which is the only thing
 * the two portals have in common.
 */
import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useAppData } from "../../data/AppDataContext";
import { useAdminAuth } from "./AdminAuthContext";
import Sidebar from "../../components/layout/Sidebar";
import { ViewModal, DetailModal } from "../../components/ui";
import { SalaryModule, ManagerAssignModule } from "../../components/admin";
import {
  OverviewTab, ReportsTab, LeaderboardTab, AnalyticsTab,
  DepartmentsTab, LeaveBoardTab, SettingsTab,
} from "./AdminTabs";
import { DSR_STATUSES, CHART_COLORS } from "../../utils/constants";
import { genCode, getTodayStr, fmtCurr, sum, downloadCSV } from "../../utils/helpers";

export default function AdminDashboard() {
  const {
    employees, saveEmployees,
    submissions, saveSubs,
    departments, saveDepartments,
    websites, saveWebsites,
    targets, saveTargets,
    customFields, saveCustomFields,
    announcements, saveAnnouncements,
    messages, saveMessages,
    leaves, saveLeaves,
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
  const [viewing, setViewing] = useState(null);
  const [detailModal, setDetailModal] = useState(null);

  const [ovPeriod, setOvPeriod] = useState("week");
  const [ovDateFrom, setOvDateFrom] = useState("");
  const [ovDateTo, setOvDateTo] = useState("");

  const [reportEmpSearch, setReportEmpSearch] = useState("");
  const [reportDateFrom, setReportDateFrom] = useState("");
  const [reportDateTo, setReportDateTo] = useState("");

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
  const addEmployeeQuick = () => {
    if (!newEmp.trim()) return;
    const id = `EMP${String(employees.length + 1).padStart(3, "0")}`;
    const rec = { id, name: newEmp.trim(), department: "Sales", code: genCode(), password: "1234", teamLead: "", photo: "" };
    saveEmployees([...employees, rec]);
    setNewEmp("");
    showToast(`${rec.name} added.`, "success");
  };

  /* ── Leave board ──────────────────────────────────────────── */
  const setLeaveStatus = (id, status) => {
    saveLeaves(leaves.map((l) => (l.id === id ? { ...l, status } : l)));
    showToast(`Leave ${status.toLowerCase()}.`, "success");
  };

  /* ── Departments / announcements / messages ──────────────── */
  const addDept = () => {
    if (!newDept.trim() || departments.includes(newDept.trim())) return;
    saveDepartments([...departments, newDept.trim()]);
    setNewDept("");
  };
  const removeDept = (d) => saveDepartments(departments.filter((x) => x !== d));

  const publishAnnouncement = () => {
    if (!annText.trim() || annDepts.length === 0) { showToast("Write a message and pick departments.", "error"); return; }
    const depts = annDepts.includes("All") ? departments : annDepts;
    const rec = { id: Date.now(), text: annText.trim(), departments: depts, ts: Date.now() };
    saveAnnouncements([rec, ...announcements]);
    setAnnText(""); setAnnDepts([]);
    showToast("Announcement published.", "success");
  };
  const publishDeptAnnouncement = (dept, text) => {
    if (!text.trim()) return;
    const rec = { id: Date.now(), text: text.trim(), departments: [dept], ts: Date.now() };
    saveAnnouncements([rec, ...announcements]);
    showToast(`Announcement published to ${dept}.`, "success");
  };
  const deleteAnnouncement = (id) => saveAnnouncements(announcements.filter((a) => a.id !== id));

  const addCustomField = (label, type, required) => {
    saveCustomFields([...customFields, { id: Date.now(), label: label.trim(), type, required }]);
  };
  const editCustomField = (id, label) => saveCustomFields(customFields.map((f) => (f.id === id ? { ...f, label } : f)));
  const removeCustomField = (id) => saveCustomFields(customFields.filter((f) => f.id !== id));

  const sendMessage = () => {
    if (!msgEmpId || !msgText.trim()) { showToast("Pick an employee and write a message.", "error"); return; }
    const rec = { id: Date.now(), empId: msgEmpId, text: msgText.trim(), ts: Date.now() };
    saveMessages([rec, ...messages]);
    setMsgText("");
    showToast("Message sent.", "success");
  };
  const deleteMessage = (id) => saveMessages(messages.filter((m) => m.id !== id));

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
      totalFollowUps: sum(mine, "newFollowUps"),
      submittedToday: mine.some((s) => s.date === todayStr && s.status === "Submitted"),
      pendingTasks: mine.filter((s) => s.status !== "Submitted").length,
    };
  }), [employees, submissions, todayStr]);

  const reportsFiltered = useMemo(() => submissions
    .filter((s) => !reportEmpSearch || s.empName?.toLowerCase().includes(reportEmpSearch.toLowerCase()))
    .filter((s) => !reportDateFrom || s.date >= reportDateFrom)
    .filter((s) => !reportDateTo || s.date <= reportDateTo)
    .sort((a, b) => (a.date < b.date ? 1 : -1))
    .slice(0, 200),
    [submissions, reportEmpSearch, reportDateFrom, reportDateTo]
  );

  const exportCSV = () => {
    const rows = [["Employee", "Date", "Status", "Emails", "Leads", "Calls", "Sales", "Hours"]];
    reportsFiltered.forEach((r) => rows.push([
      r.empName, r.date, r.status,
      (Number(r.freshEmails) || 0) + (Number(r.reminderEmails) || 0),
      r.newLeadsInterested, r.callsScheduled, r.salesGenerated, r.workingHours,
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
      const days = { today: 0, week: 6, month: 29 }[ovPeriod] ?? 6;
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
    const titles = {
      emails: "Emails Sent (Today)", sales: "Sales Generated (Today)",
      payments: "Payments Received (Today)", leads: "New Leads (Today)",
    };
    const rows = todaySubs.map((s) => ({
      empName: s.empName,
      value: type === "emails" ? (Number(s.freshEmails) || 0) + (Number(s.reminderEmails) || 0)
        : type === "sales" ? fmtCurr(s.salesGenerated)
        : type === "payments" ? fmtCurr(s.paymentReceived)
        : s.newLeadsInterested,
    }));
    setDetailModal({ title: titles[type] || "Details", rows });
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
          { key: "leaveboard", label: "🌴 Leave Board" },
          { key: "salary", label: "💰 Salary" },
          { key: "managerassign", label: "🧑‍💼 Manager Assign" },
          { key: "settings", label: "⚙️ Settings" },
        ]}
        active={tab} onSelect={setTab}
        onSignOut={handleAdminLogout}
      />
      <main className="sv-main">
        {tab === "overview" && (
          <OverviewTab
            empStats={empStats} todaySubs={todaySubs} employees={employees} submissions={submissions}
            ovPeriod={ovPeriod} setOvPeriod={setOvPeriod}
            ovDateFrom={ovDateFrom} setOvDateFrom={setOvDateFrom} ovDateTo={ovDateTo} setOvDateTo={setOvDateTo}
            ovPieData={ovPieData} ovBarData={ovBarData} openDM={openDM}
          />
        )}
        {tab === "reports" && (
          <ReportsTab
            reportEmpSearch={reportEmpSearch} setReportEmpSearch={setReportEmpSearch}
            reportDateFrom={reportDateFrom} setReportDateFrom={setReportDateFrom}
            reportDateTo={reportDateTo} setReportDateTo={setReportDateTo}
            rows={reportsFiltered} onView={setViewing} onExport={exportCSV}
          />
        )}
        {tab === "leaderboard" && <LeaderboardTab empStats={empStats} targets={targets} submissions={submissions} />}
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
            todayStr={todayStr}
          />
        )}
        {tab === "leaveboard" && <LeaveBoardTab leaves={leaves} setLeaveStatus={setLeaveStatus} />}
        {tab === "salary" && (
          <SalaryModule employees={employees} salaries={salaries} setSalaries={saveSalaries} showToast={showToast} pushNotification={pushNotification} />
        )}
        {tab === "managerassign" && (
          <ManagerAssignModule employees={employees} setEmployees={saveEmployees} showToast={showToast} />
        )}
        {tab === "settings" && (
          <SettingsTab
            employees={employees} setEmployees={saveEmployees}
            newEmp={newEmp} setNewEmp={setNewEmp} addEmployeeQuick={addEmployeeQuick}
            adminPwd={adminPwd} setAdminPwd={setAdminPwd}
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

      {viewing && <ViewModal submission={viewing} onClose={() => setViewing(null)} />}
      {detailModal && <DetailModal {...detailModal} onClose={() => setDetailModal(null)} />}
    </div>
  );
}
