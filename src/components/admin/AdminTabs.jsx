/**
 * AdminTabs.jsx — Admin Portal tab content (Overview, Reports,
 * Leaderboard, Analytics, Departments, Leave Board, Settings).
 * Admin-only; never imported by the Employee Portal.
 */
import { useState, useEffect } from "react";
import {
  PieChart, Pie, Cell, BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from "recharts";
import { ClickCard, Avatar } from "../ui";
import { DeptCard } from ".";
import {
  CHART_COLORS, TT, LEG, TICK, NAVY, BLUE, GREEN, ORANGE, PURPLE, AMBER,
} from "../../utils/constants";
import { fmtDate, fmtCurr, sum, empLabel, humanizeKey } from "../../utils/helpers";

/* ───────────────────────────────────────────────────────────────
 * OverviewTab — 5 primary + 5 secondary KPI cards (period-filtered)
 * + analytics charts + today's submission grid + recent pending.
 * ──────────────────────────────────────────────────────────────*/
export function OverviewTab({ empStats, ovFiltered, ovPeriod, setOvPeriod, ovDateFrom, setOvDateFrom, ovDateTo, setOvDateTo, ovPieData, ovBarData, openDM }) {
  const freshEmails = sum(ovFiltered, "freshEmails");
  const reminderEmails = sum(ovFiltered, "reminderEmails");
  const leads = sum(ovFiltered, "newLeadsInterested");
  const followups = sum(ovFiltered, "newFollowUps");
  const dsrSubmitted = ovFiltered.filter((s) => s.status === "Submitted").length;
  const calls = sum(ovFiltered, "callsScheduled");
  const updates = ovFiltered.filter((s) => s.updatesForTeamLead).length;
  const sales = sum(ovFiltered, "salesGenerated");
  const orders = ovFiltered.reduce((a, s) => a + ((s.sales || []).length), 0);
  const payments = sum(ovFiltered, "paymentReceived");
  const grid5 = { display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 16 };

  return (
    <div className="sv-tab">
      <h2 className="sv-tab-title">Overview</h2>

      <div className="sv-flex sv-gap-sm" style={{ flexWrap: "wrap" }}>
        {["today", "week", "month", "custom"].map((p) => (
          <button key={p} className={`sv-period-btn ${ovPeriod === p ? "sv-period-btn--active" : ""}`} onClick={() => setOvPeriod(p)}>
            {p === "today" ? "Today" : p === "week" ? "This Week" : p === "month" ? "This Month" : "Custom"}
          </button>
        ))}
        {ovPeriod === "custom" && (
          <div className="sv-flex sv-gap-sm">
            <input className="sv-input" type="date" value={ovDateFrom} onChange={(e) => setOvDateFrom(e.target.value)} style={{ width: 150 }} />
            <input className="sv-input" type="date" value={ovDateTo} onChange={(e) => setOvDateTo(e.target.value)} style={{ width: 150 }} />
          </div>
        )}
      </div>

      <div style={grid5}>
        <ClickCard label="Fresh Emails" value={freshEmails} icon="📧" color={BLUE} onClick={() => openDM("emails")} />
        <ClickCard label="Reminder Emails" value={reminderEmails} icon="📨" color={PURPLE} onClick={() => openDM("reminders")} />
        <ClickCard label="New Leads" value={leads} icon="🎯" color={GREEN} onClick={() => openDM("leads")} />
        <ClickCard label="Follow-ups" value={followups} icon="🤝" color={AMBER} onClick={() => openDM("followups")} />
        <ClickCard label="DSR Submitted" value={dsrSubmitted} icon="✅" color={NAVY} onClick={() => openDM("dsr")} />
      </div>

      <div style={grid5}>
        <ClickCard label="Scheduled Calls" value={calls} icon="📞" color={ORANGE} onClick={() => openDM("calls")} />
        <ClickCard label="Team Lead Updates" value={updates} icon="📣" color={BLUE} onClick={() => openDM("updates")} />
        <ClickCard label="Sales" value={fmtCurr(sales)} icon="💰" color={GREEN} onClick={() => openDM("sales")} />
        <ClickCard label="Contract Orders" value={orders} icon="📄" color={PURPLE} onClick={() => openDM("orders")} />
        <ClickCard label="Payment Received" value={fmtCurr(payments)} icon="💵" color={AMBER} onClick={() => openDM("payments")} />
      </div>

      <div className="sv-card">
        <h3>Analytics</h3>
        <div className="sv-grid-2 sv-gap-md" style={{ marginTop: 16 }}>
          <div>
            <h4>Activity Mix</h4>
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={ovPieData} dataKey="value" nameKey="name" outerRadius={80}>
                  {ovPieData.map((d, i) => <Cell key={i} fill={d.color} />)}
                </Pie>
                <Tooltip {...TT} /><Legend {...LEG} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div>
            <h4>Sales vs Payments Received</h4>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={ovBarData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" tick={TICK} /><YAxis tick={TICK} />
                <Tooltip {...TT} /><Legend {...LEG} />
                <Bar dataKey="sales" fill={GREEN} name="Sales" />
                <Bar dataKey="payment" fill={ORANGE} name="Payment" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="sv-grid-2 sv-gap-md">
        <div className="sv-card">
          <h3>Today's Submission Status</h3>
          <div className="sv-grid-3 sv-gap-sm" style={{ marginTop: 12 }}>
            {empStats.map((e) => (
              <div key={e.id} className="sv-flex sv-gap-xs sv-flex--center" style={{ justifyContent: "flex-start" }}>
                <span className={`sv-dot ${e.submittedToday ? "sv-dot--green" : "sv-dot--red"}`} />
                <span>{e.name}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="sv-card">
          <h3>Recent Pending Tasks</h3>
          <ul className="sv-list">
            {empStats.filter((e) => !e.submittedToday).length === 0 && <li className="sv-muted">Everyone has submitted today. 🎉</li>}
            {empStats.filter((e) => !e.submittedToday).slice(0, 8).map((e) => (
              <li key={e.id}>{e.name} — no DSR submitted today</li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

/* ───────────────────────────────────────────────────────────────
 * ReportsTab — filterable submissions table + CSV export + view.
 * ──────────────────────────────────────────────────────────────*/
export function ReportsTab({ reportEmpSearch, setReportEmpSearch, reportDept, setReportDept, departments = [], reportDateFrom, setReportDateFrom, reportDateTo, setReportDateTo, rows, onView, onExport }) {
  return (
    <div className="sv-tab">
      <div className="sv-flex sv-flex--between">
        <h2 className="sv-tab-title">Reports</h2>
        <button className="sv-btn sv-btn--outline" onClick={onExport}>⬇️ Export CSV</button>
      </div>
      <div className="sv-flex sv-gap-sm" style={{ marginBottom: 16, flexWrap: "wrap" }}>
        <input className="sv-input" placeholder="Search employee..." value={reportEmpSearch} onChange={(e) => setReportEmpSearch(e.target.value)} style={{ maxWidth: 220 }} />
        <select className="sv-select" value={reportDept} onChange={(e) => setReportDept(e.target.value)} style={{ maxWidth: 180 }}>
          <option value="">All Departments</option>
          {departments.map((d) => <option key={d} value={d}>{d}</option>)}
        </select>
        <input className="sv-input" type="date" value={reportDateFrom} onChange={(e) => setReportDateFrom(e.target.value)} style={{ maxWidth: 160 }} />
        <input className="sv-input" type="date" value={reportDateTo} onChange={(e) => setReportDateTo(e.target.value)} style={{ maxWidth: 160 }} />
      </div>
      <table className="sv-table">
        <thead>
          <tr>
            <th>Employee</th><th>Dept</th><th>Attendance</th><th>Date</th><th>Status</th>
            <th>Emails</th><th>Leads</th><th>Calls</th><th>Sales</th><th>Payments</th><th>Hrs</th><th></th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id}>
              <td>{r.empName}</td><td>{r.department}</td><td>{r.attendance}</td><td>{fmtDate(r.date)}</td>
              <td><span className={`sv-badge sv-badge--${(r.status || "pending").toLowerCase()}`}>{r.status}</span></td>
              <td>{(Number(r.freshEmails) || 0) + (Number(r.reminderEmails) || 0)}</td>
              <td>{r.newLeadsInterested}</td><td>{r.callsScheduled}</td>
              <td>{fmtCurr(r.salesGenerated)}</td><td>{fmtCurr(r.paymentReceived)}</td><td>{r.workingHours}</td>
              <td><button className="sv-btn sv-btn--sm sv-btn--outline" onClick={() => onView(r)}>View</button></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ───────────────────────────────────────────────────────────────
 * LeaderboardTab — Sales & Payments ranking with Week/Month/Year.
 * ──────────────────────────────────────────────────────────────*/
export function LeaderboardTab({ empStats, submissions, lbPeriod, setLbPeriod }) {
  const days = { week: 7, month: 30, year: 365 }[lbPeriod] ?? 30;
  const fromDate = new Date(); fromDate.setDate(fromDate.getDate() - days);
  const fromStr = fromDate.toISOString().split("T")[0];

  const ranked = empStats.map((e) => {
    const mine = submissions.filter((s) => s.empId === e.id && s.date >= fromStr);
    return { id: e.id, name: e.name, sales: sum(mine, "salesGenerated"), payments: sum(mine, "paymentReceived") };
  }).sort((a, b) => b.sales - a.sales);
  const medals = ["🥇", "🥈", "🥉"];

  return (
    <div className="sv-tab">
      <div className="sv-flex sv-flex--between">
        <h2 className="sv-tab-title">Leaderboard</h2>
        <div className="sv-flex sv-gap-sm">
          {["week", "month", "year"].map((p) => (
            <button key={p} className={`sv-period-btn ${lbPeriod === p ? "sv-period-btn--active" : ""}`} onClick={() => setLbPeriod(p)}>
              {p[0].toUpperCase() + p.slice(1)}
            </button>
          ))}
        </div>
      </div>

      <table className="sv-table">
        <thead><tr><th>Rank</th><th>Employee</th><th>Sales</th><th>Payments</th></tr></thead>
        <tbody>
          {ranked.map((e, i) => (
            <tr key={e.id}>
              <td>{medals[i] || `#${i + 1}`}</td><td>{e.name}</td>
              <td>{fmtCurr(e.sales)}</td><td>{fmtCurr(e.payments)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h3 style={{ marginTop: 12 }}>7-Day Submission Tracker</h3>
      <div className="sv-grid-7 sv-gap-xs">
        {empStats.map((e) => {
          const daysArr = Array.from({ length: 7 }, (_, i) => {
            const d = new Date(); d.setDate(d.getDate() - i);
            const ds = d.toISOString().split("T")[0];
            return submissions.some((s) => s.empId === e.id && s.date === ds && s.status === "Submitted");
          });
          return (
            <div key={e.id} className="sv-flex sv-gap-xs sv-flex--center" style={{ justifyContent: "flex-start" }}>
              <span>{e.name}</span>
              {daysArr.reverse().map((ok, i) => <span key={i} className={`sv-dot ${ok ? "sv-dot--green" : "sv-dot--red"}`} />)}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ───────────────────────────────────────────────────────────────
 * AnalyticsTab — chart cards + full employee summary table.
 * ──────────────────────────────────────────────────────────────*/
export function AnalyticsTab({ empStats, pieData, statusPie, chartData }) {
  return (
    <div className="sv-tab">
      <h2 className="sv-tab-title">Analytics</h2>
      <div className="sv-grid-2 sv-gap-md">
        <div className="sv-card">
          <h4>Individual Sales Performance</h4>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={empStats} layout="vertical">
              <XAxis type="number" tick={TICK} /><YAxis type="category" dataKey="name" tick={TICK} width={100} />
              <Tooltip {...TT} /><Bar dataKey="totalSales" fill={GREEN} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="sv-card">
          <h4>Activity Mix</h4>
          <ResponsiveContainer width="100%" height={240}>
            <PieChart>
              <Pie data={pieData} dataKey="value" nameKey="name" outerRadius={80}>
                {pieData.map((d, i) => <Cell key={i} fill={d.color} />)}
              </Pie>
              <Tooltip {...TT} /><Legend {...LEG} />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="sv-card">
          <h4>Work Status Breakdown</h4>
          <ResponsiveContainer width="100%" height={240}>
            <PieChart>
              <Pie data={statusPie} dataKey="value" nameKey="name" outerRadius={80}>
                {statusPie.map((d, i) => <Cell key={i} fill={d.color} />)}
              </Pie>
              <Tooltip {...TT} /><Legend {...LEG} />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="sv-card">
          <h4>Multi-Metric Trend</h4>
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" tick={TICK} /><YAxis tick={TICK} />
              <Tooltip {...TT} /><Legend {...LEG} />
              <Line dataKey="emails" name="Emails" stroke={BLUE} /><Line dataKey="leads" name="Leads" stroke={GREEN} />
              <Line dataKey="calls" name="Calls" stroke={ORANGE} /><Line dataKey="fu" name="Follow-ups" stroke={NAVY} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
      <table className="sv-table" style={{ marginTop: 24 }}>
        <thead><tr><th>Employee</th><th>Emails</th><th>Leads</th><th>Calls</th><th>Sales</th><th>Payments</th><th>Follow-ups</th></tr></thead>
        <tbody>
          {empStats.map((e) => (
            <tr key={e.id}><td>{e.name}</td><td>{e.totalEmails}</td><td>{e.totalLeads}</td><td>{e.totalCalls}</td><td>{fmtCurr(e.totalSales)}</td><td>{fmtCurr(e.totalPayments)}</td><td>{e.totalFollowUps}</td></tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ───────────────────────────────────────────────────────────────
 * DepartmentsTab — add/remove depts, broadcast announcements,
 * per-department breakdown cards.
 * ──────────────────────────────────────────────────────────────*/
export function DepartmentsTab({ departments, employees, submissions, newDept, setNewDept, addDept, removeDept, annText, setAnnText, annDepts, setAnnDepts, publishAnnouncement, announcements, customFields, setCustomFields, onPublishDeptAnnouncement, onDeleteAnnouncement, onAddField, onEditField, onRemoveField, todayStr }) {
  const toggleAnnDept = (d) => setAnnDepts((prev) => prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d]);
  return (
    <div className="sv-tab">
      <h2 className="sv-tab-title">Departments</h2>
      <div className="sv-card">
        <h3>Manage Departments</h3>
        <div className="sv-flex sv-gap-sm">
          <input className="sv-input" placeholder="New department name" value={newDept} onChange={(e) => setNewDept(e.target.value)} />
          <button className="sv-btn sv-btn--primary" onClick={addDept}>Add</button>
        </div>
        <div className="sv-flex sv-gap-xs" style={{ marginTop: 12, flexWrap: "wrap" }}>
          {departments.map((d) => (
            <span key={d} className="sv-chip">{d} <button onClick={() => removeDept(d)} style={{ border: "none", background: "transparent", cursor: "pointer", marginLeft: 4 }}>×</button></span>
          ))}
        </div>
      </div>

      <div className="sv-card">
        <h3>Broadcast Announcement</h3>
        <textarea className="sv-textarea" placeholder="Announcement text..." value={annText} onChange={(e) => setAnnText(e.target.value)} />
        <div className="sv-flex sv-gap-sm" style={{ marginTop: 8, flexWrap: "wrap" }}>
          {["All", ...departments].map((d) => (
            <label key={d} className="sv-flex sv-gap-xs sv-flex--center">
              <input type="checkbox" checked={annDepts.includes(d)} onChange={() => toggleAnnDept(d)} /> {d}
            </label>
          ))}
        </div>
        <button className="sv-btn sv-btn--primary" style={{ marginTop: 12 }} onClick={publishAnnouncement}>Publish</button>
      </div>

      <div className="sv-grid-2 sv-gap-md">
        {departments.map((d) => {
          const deptEmps = employees.filter((e) => e.department === d);
          const deptSubsToday = submissions.filter((s) => s.date === todayStr && s.status === "Submitted" && deptEmps.some((e) => e.id === s.empId));
          const deptSubmittedNames = deptSubsToday.map((s) => s.empName);
          const deptPendingNames = deptEmps.filter((e) => !deptSubsToday.some((s) => s.empId === e.id));
          const deptFiltered = submissions.filter((s) => deptEmps.some((e) => e.id === s.empId));
          return (
            <DeptCard
              key={d}
              dept={d}
              deptEmps={deptEmps}
              deptSubmittedNames={deptSubmittedNames}
              deptPendingNames={deptPendingNames}
              deptFiltered={deptFiltered}
              customFields={customFields}
              onAddField={onAddField}
              onEditField={onEditField}
              onRemoveField={onRemoveField}
              announcements={announcements.filter((a) => a.departments?.includes(d))}
              onPublishAnnouncement={(text) => onPublishDeptAnnouncement(d, text)}
              onDeleteAnnouncement={onDeleteAnnouncement}
            />
          );
        })}
      </div>
    </div>
  );
}

/* ───────────────────────────────────────────────────────────────
 * LeaveBoardTab — approve/reject with mandatory remark + history.
 * ──────────────────────────────────────────────────────────────*/
export function LeaveBoardTab({ leaves, setLeaveStatus }) {
  const [remarks, setRemarks] = useState({});
  const pending = leaves.filter((l) => l.status === "Pending");
  const history = leaves.filter((l) => l.status !== "Pending");
  const decide = (l, status) => {
    const remark = (remarks[l.id] || "").trim();
    if (!remark) { alert("Please add a remark before approving or rejecting."); return; }
    setLeaveStatus(l.id, status, remark);
    setRemarks((prev) => ({ ...prev, [l.id]: "" }));
  };
  return (
    <div className="sv-tab">
      <h2 className="sv-tab-title">Leave Board {pending.length > 0 && <span className="sv-badge sv-badge--pending" style={{ marginLeft: 8 }}>{pending.length} pending</span>}</h2>

      <div className="sv-card">
        <h3>Pending Requests</h3>
        <ul className="sv-list sv-leave-list" style={{ marginTop: 12 }}>
          {pending.length === 0 && <li className="sv-muted">No pending leave requests.</li>}
          {pending.map((l) => (
            <li key={l.id} className="sv-leave-item">
              <div className="sv-flex sv-flex--between" style={{ flexWrap: "wrap", gap: 8 }}>
                <span><strong>{l.empName}</strong> — {fmtDate(l.fromDate)} → {fmtDate(l.toDate)} <span className="sv-muted">({l.reason})</span></span>
                <span className="sv-badge sv-badge--pending">Pending</span>
              </div>
              <input className="sv-input sv-leave-remark" placeholder="Remark (required)" value={remarks[l.id] || ""} onChange={(e) => setRemarks((p) => ({ ...p, [l.id]: e.target.value }))} />
              <div className="sv-flex sv-gap-xs" style={{ marginTop: 8 }}>
                <button className="sv-btn sv-btn--sm sv-btn--success" onClick={() => decide(l, "Approved")}>Approve</button>
                <button className="sv-btn sv-btn--sm sv-btn--danger" onClick={() => decide(l, "Rejected")}>Reject</button>
              </div>
            </li>
          ))}
        </ul>
      </div>

      <div className="sv-card">
        <h3>History</h3>
        <ul className="sv-list sv-leave-list" style={{ marginTop: 12 }}>
          {history.length === 0 && <li className="sv-muted">No decided leave requests yet.</li>}
          {history.map((l) => (
            <li key={l.id} className="sv-leave-item sv-flex sv-flex--between" style={{ flexWrap: "wrap", gap: 8 }}>
              <span><strong>{l.empName}</strong> — {fmtDate(l.fromDate)} → {fmtDate(l.toDate)} <span className="sv-muted">({l.reason}){l.remark ? ` · Note: ${l.remark}` : ""}</span></span>
              <span className={`sv-badge sv-badge--${l.status.toLowerCase()}`}>{l.status}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

/* ───────────────────────────────────────────────────────────────
 * SettingsTab — employee management (incl. email), two-step admin
 * password, messaging, targets, branding, website list.
 * ──────────────────────────────────────────────────────────────*/
export function SettingsTab({ employees, setEmployees, onUpdateEmp, onDeleteEmp, onResetPwd, newEmp, setNewEmp, addEmployeeQuick, adminPwd, setAdminPwd, msgEmpId, setMsgEmpId, msgText, setMsgText, sendMessage, messages, deleteMessage, targets, setTargets, logo, onLogoChange, onLogoRemove, websites, newWebsite, setNewWebsite, addWebsite, removeWebsite, pushNotification, showToast }) {
  const [curPwd, setCurPwd] = useState("");
  const [newPwd, setNewPwd] = useState("");
  const [confirmPwd, setConfirmPwd] = useState("");

  const onLogoFile = (file) => {
    const reader = new FileReader();
    reader.onload = () => onLogoChange(reader.result);
    reader.readAsDataURL(file);
  };

  const changeAdminPwd = () => {
    if (curPwd !== adminPwd) { showToast("Current password is incorrect.", "error"); return; }
    if (!newPwd || newPwd.length < 4) { showToast("New password must be at least 4 characters.", "error"); return; }
    if (newPwd !== confirmPwd) { showToast("New passwords do not match.", "error"); return; }
    setAdminPwd(newPwd);
    setCurPwd(""); setNewPwd(""); setConfirmPwd("");
    showToast("Admin password updated.", "success");
  };

  return (
    <div className="sv-tab">
      <h2 className="sv-tab-title">Settings</h2>
      <div className="sv-grid-2 sv-gap-md">
        <div className="sv-card">
          <h3>Manage Employees</h3>
          <div className="sv-flex sv-gap-sm">
            <input className="sv-input" placeholder="New employee name" value={newEmp} onChange={(e) => setNewEmp(e.target.value)} />
            <button className="sv-btn sv-btn--primary" onClick={addEmployeeQuick}>Add</button>
          </div>
          {/* Compact employee list — shows 4, scrollable, View All toggle */}
          <EmployeeListCompact employees={employees} onUpdateEmp={onUpdateEmp} onDeleteEmp={onDeleteEmp} onResetPwd={onResetPwd} />
        </div>

        <div className="sv-card">
          <h3>Admin Security (Two-step)</h3>
          <label className="sv-label">Current Password</label>
          <input className="sv-input" type="password" value={curPwd} onChange={(e) => setCurPwd(e.target.value)} style={{ marginBottom: 8 }} />
          <label className="sv-label">New Password</label>
          <input className="sv-input" type="password" value={newPwd} onChange={(e) => setNewPwd(e.target.value)} style={{ marginBottom: 8 }} />
          <label className="sv-label">Confirm New Password</label>
          <input className="sv-input" type="password" value={confirmPwd} onChange={(e) => setConfirmPwd(e.target.value)} style={{ marginBottom: 12 }} />
          <button className="sv-btn sv-btn--primary" onClick={changeAdminPwd}>Update Password</button>
        </div>

        <div className="sv-card">
          <h3>Message an Employee</h3>
          <select className="sv-select" value={msgEmpId} onChange={(e) => setMsgEmpId(e.target.value)}>
            <option value="">Select employee...</option>
            {employees.map((e) => <option key={e.id} value={e.id}>{empLabel(e)}</option>)}
          </select>
          <textarea className="sv-textarea" placeholder="Message..." value={msgText} onChange={(e) => setMsgText(e.target.value)} style={{ marginTop: 8 }} />
          <button className="sv-btn sv-btn--primary" style={{ marginTop: 8 }} onClick={sendMessage}>Send</button>
          <ul className="sv-list" style={{ marginTop: 12 }}>
            {messages.map((m) => (
              <li key={m.id} className="sv-flex sv-flex--between">
                <span>{employees.find((e) => e.id === m.empId)?.name}: {m.text}</span>
                <button className="sv-btn sv-btn--sm sv-btn--danger" onClick={() => deleteMessage(m.id)}>Delete</button>
              </li>
            ))}
          </ul>
        </div>

        <div className="sv-card">
          <h3>Daily Targets (per employee)</h3>
          {Object.keys(targets).map((k) => (
            <div key={k}>
              <label className="sv-label">{humanizeKey(k)}</label>
              <input className="sv-input" type="number" value={targets[k]} onChange={(e) => setTargets({ ...targets, [k]: Number(e.target.value) })} style={{ marginBottom: 8 }} />
            </div>
          ))}
        </div>

        <div className="sv-card">
          <h3>Company Branding</h3>
          <div className="sv-logo-preview">
            {logo ? <img src={logo} alt="Logo" /> : <span>SV</span>}
          </div>
          <input type="file" accept="image/*" onChange={(e) => e.target.files[0] && onLogoFile(e.target.files[0])} />
          <button className="sv-btn sv-btn--sm sv-btn--outline" style={{ marginTop: 8 }} onClick={onLogoRemove}>Remove</button>
        </div>

        <div className="sv-card">
          <h3>Website Master List</h3>
          <div className="sv-flex sv-gap-sm">
            <input className="sv-input" placeholder="Website name" value={newWebsite} onChange={(e) => setNewWebsite(e.target.value)} />
            <button className="sv-btn sv-btn--primary" onClick={addWebsite}>Add</button>
          </div>
          <div className="sv-flex sv-gap-xs" style={{ marginTop: 12, flexWrap: "wrap" }}>
            {websites.map((w) => <span key={w} className="sv-chip">{w} <button onClick={() => removeWebsite(w)} style={{ border: "none", background: "transparent", cursor: "pointer", marginLeft: 4 }}>×</button></span>)}
          </div>
        </div>
      </div>
    </div>
  );
}


/* Single employee row in admin Settings. Holds a local draft and persists
   text edits on blur (avoids per-keystroke writes & save races). */
function EmployeeRow({ emp, onUpdateEmp, onDeleteEmp, onResetPwd }) {
  const [draft, setDraft] = useState(emp);
  useEffect(() => { setDraft(emp); }, [emp.id]);
  const set = (field, val) => setDraft((d) => ({ ...d, [field]: val }));
  return (
    <li className="sv-emp-row" style={{ flexDirection: "column", alignItems: "stretch", gap: 8 }}>
      <div className="sv-flex sv-flex--between">
        <span className="sv-flex sv-items-center sv-gap-2"><Avatar name={draft.name} photo={draft.photo} size={28} /> {draft.name} ({draft.department})</span>
        <button className="sv-btn sv-btn--sm sv-btn--danger" onClick={() => { if (window.confirm(`Remove ${emp.name}?`)) onDeleteEmp(emp.id); }}>Remove</button>
      </div>
      <div className="sv-grid-2 sv-gap-xs">
        <select className="sv-select" value={draft.department} onChange={(e) => { const v = e.target.value; const next = { ...draft, department: v }; setDraft(next); onUpdateEmp(next); }}>
          <option>Sales</option><option>Operations</option>
        </select>
        <input className="sv-input" maxLength={4} placeholder="Code" value={draft.code || ""} onChange={(e) => set("code", e.target.value)} onBlur={() => onUpdateEmp(draft)} />
        <input className="sv-input" placeholder="Email" value={draft.email || ""} onChange={(e) => set("email", e.target.value)} onBlur={() => onUpdateEmp(draft)} />
        <input className="sv-input" placeholder="Team lead" value={draft.teamLead || ""} onChange={(e) => set("teamLead", e.target.value)} onBlur={() => onUpdateEmp(draft)} />
      </div>
      <ResetPasswordInline empId={emp.id} empName={emp.name} onResetPwd={onResetPwd} />
    </li>
  );
}

function ResetPasswordInline({ empId, empName, onResetPwd }) {
  const [open, setOpen] = useState(false);
  const [newPwd, setNewPwd] = useState("");
  const [confirm, setConfirm] = useState("");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  const handleReset = async () => {
    if (!newPwd.trim()) { setMsg("Enter a new password."); return; }
    if (newPwd !== confirm) { setMsg("Passwords don't match."); return; }
    if (newPwd.length < 4) { setMsg("Password must be at least 4 characters."); return; }
    setSaving(true);
    const result = await onResetPwd(empId, newPwd);
    setSaving(false);
    if (result !== false) {
      setMsg(`✅ Password updated for ${empName}!`);
      setNewPwd(""); setConfirm("");
      setTimeout(() => { setOpen(false); setMsg(""); }, 2000);
    } else {
      setMsg("❌ Failed to update password.");
    }
  };

  return (
    <div style={{ marginTop: 4 }}>
      <button
        className="sv-btn sv-btn--sm sv-btn--outline"
        onClick={() => { setOpen((o) => !o); setMsg(""); }}
        style={{ alignSelf: "flex-start" }}
      >
        {open ? "✕ Cancel" : "🔑 Reset Password"}
      </button>
      {open && (
        <div style={{ marginTop: 8, padding: "10px 12px", background: "#F8FAFC", border: "1px solid #E2E8F0", borderRadius: 8 }}>
          <div style={{ fontSize: 11, color: "#64748B", marginBottom: 6, fontWeight: 600 }}>
            Set new password for {empName}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
            <input
              className="sv-input" type="password"
              placeholder="New password" value={newPwd}
              onChange={(e) => setNewPwd(e.target.value)}
            />
            <input
              className="sv-input" type="password"
              placeholder="Confirm password" value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
            />
          </div>
          {msg && <div style={{ fontSize: 11, marginTop: 6, color: msg.startsWith("✅") ? "#16A34A" : "#DC2626" }}>{msg}</div>}
          <button
            className="sv-btn sv-btn--sm sv-btn--primary"
            onClick={handleReset} disabled={saving}
            style={{ marginTop: 8 }}
          >
            {saving ? "Saving..." : "Update Password"}
          </button>
        </div>
      )}
    </div>
  );
}

// ── EmployeeListCompact ──────────────────────────────────────
// Shows 4 employees by default with a scrollable "View All" expansion
function EmployeeListCompact({ employees, onUpdateEmp, onDeleteEmp, onResetPwd }) {
  const [showAll, setShowAll] = useState(false);
  const VISIBLE = 4;
  const visible = showAll ? employees : employees.slice(0, VISIBLE);
  const hiddenCount = employees.length - VISIBLE;

  return (
    <div style={{ marginTop: 12 }}>
      {/* Summary chips — always visible */}
      {!showAll && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 10 }}>
          {employees.slice(0, VISIBLE).map((e) => (
            <span key={e.id} style={{
              display: "inline-flex", alignItems: "center", gap: 5,
              padding: "4px 10px", borderRadius: 20,
              background: "#EFF6FF", border: "1px solid #BFDBFE",
              fontSize: 12, fontWeight: 600, color: "#1E40AF"
            }}>
              <Avatar name={e.name} photo={e.photo} size={18} />
              {e.name.split(" ")[0]}
            </span>
          ))}
          {hiddenCount > 0 && (
            <span style={{
              display: "inline-flex", alignItems: "center",
              padding: "4px 10px", borderRadius: 20,
              background: "#F1F5F9", border: "1px solid #CBD5E1",
              fontSize: 12, fontWeight: 600, color: "#64748B"
            }}>
              +{hiddenCount} more
            </span>
          )}
        </div>
      )}

      {/* Scrollable employee list */}
      <div style={{
        maxHeight: showAll ? 420 : "none",
        overflowY: showAll ? "auto" : "visible",
        overflowX: "hidden",
        paddingRight: showAll ? 4 : 0,
        scrollbarWidth: "thin",
        scrollbarColor: "#CBD5E1 #F8FAFC",
      }}>
        <ul className="sv-list" style={{ margin: 0, padding: 0 }}>
          {visible.map((e) => (
            <EmployeeRow key={e.id} emp={e} onUpdateEmp={onUpdateEmp} onDeleteEmp={onDeleteEmp} onResetPwd={onResetPwd} />
          ))}
        </ul>
      </div>

      {/* View All / Show Less toggle */}
      {employees.length > VISIBLE && (
        <button
          onClick={() => setShowAll((s) => !s)}
          style={{
            marginTop: 10, width: "100%", padding: "7px 0",
            background: showAll ? "#F1F5F9" : "#EFF6FF",
            border: `1px solid ${showAll ? "#CBD5E1" : "#BFDBFE"}`,
            borderRadius: 8, cursor: "pointer",
            fontSize: 12, fontWeight: 700,
            color: showAll ? "#64748B" : "#1E40AF",
          }}
        >
          {showAll ? `▲ Show Less` : `▼ View All ${employees.length} Employees`}
        </button>
      )}
    </div>
  );
}
