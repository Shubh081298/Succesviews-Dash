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
import { ClickCard, Avatar } from "../../components/ui";
import { DeptCard } from "../../components/admin";
import {
  CHART_COLORS, TT, LEG, TICK, NAVY, BLUE, GREEN, ORANGE, PURPLE, AMBER,
} from "../../utils/constants";
import { fmtDate, fmtCurr, fmtSalary, sum, empLabel, humanizeKey, downloadCSV } from "../../utils/helpers";
import { Mail, Send, Target, Handshake, CheckCircle2, Phone, Megaphone, IndianRupee, FileText, Banknote } from "lucide-react";
import { Download, Plus, Pencil, KeyRound, Eye, EyeOff, X } from "lucide-react";

/* ───────────────────────────────────────────────────────────────
 * OverviewTab — 5 primary + 5 secondary KPI cards (period-filtered)
 * + analytics charts + today's submission grid + recent pending.
 * ──────────────────────────────────────────────────────────────*/
export function OverviewTab({ empStats, ovFiltered, employees = [], ovPeriod, setOvPeriod, ovDateFrom, setOvDateFrom, ovDateTo, setOvDateTo, ovPieData, ovBarData, openDM }) {
  const freshEmails = sum(ovFiltered, "freshEmails");
  const reminderEmails = sum(ovFiltered, "reminderEmails");
  const leads = sum(ovFiltered, "newLeadsInterested");
  const followups = sum(ovFiltered, "newFollowUps");
  const dsrSubmitted = ovFiltered.filter((s) => s.status === "Submitted").length;
  const calls = sum(ovFiltered, "callsScheduled");
  const updates = ovFiltered.filter((s) => s.updatesForTeamLead).length;
  const sales = sum(ovFiltered, "salesGenerated");
  const orders = ovFiltered.reduce((a, s) => a + ((s.contractOrders || []).length), 0);
  const payments = sum(ovFiltered, "paymentReceived");
  const grid5 = { display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 16 };

  // Team Messages — employee updates written to the team lead in their DSR
  // (existing data; no backend change). Newest first.
  const todayISO = new Date().toISOString().slice(0, 10);
  const empMap = Object.fromEntries((employees || []).map((e) => [e.id, e]));
  const teamMessages = (ovFiltered || [])
    .filter((s) => s.updatesForTeamLead && String(s.updatesForTeamLead).trim())
    .sort((a, b) => (a.date < b.date ? 1 : -1))
    .slice(0, 8)
    .map((s) => {
      const e = empMap[s.empId] || {};
      return {
        id: s.id || `${s.empId}-${s.date}`,
        name: s.empName || e.name || "Employee",
        teamLead: e.team_lead || e.teamLead || "",
        photo: e.photo || "",
        text: String(s.updatesForTeamLead).trim(),
        date: s.date,
        unread: s.date === todayISO,
      };
    });
  const initials = (n) => (n || "?").split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();
  const statusMeta = { submitted: { cls: "submitted", label: "Submitted" }, draft: { cls: "draft", label: "Draft" }, none: { cls: "none", label: "Not Submitted" } };

  return (
    <div className="sv-tab">
      <div className="sv-ov-banner">
        <div>
          <h2 className="sv-ov-banner-title">Welcome back, Admin 👋</h2>
          <p className="sv-ov-banner-sub">Here's what's happening today.</p>
        </div>
      </div>

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
        <ClickCard label="Fresh Emails" value={freshEmails} icon={<Mail size={18} />} color={BLUE} onClick={() => openDM("emails")} />
        <ClickCard label="Reminder Emails" value={reminderEmails} icon={<Send size={18} />} color={PURPLE} onClick={() => openDM("reminders")} />
        <ClickCard label="New Leads" value={leads} icon={<Target size={18} />} color={GREEN} onClick={() => openDM("leads")} />
        <ClickCard label="Follow-ups" value={followups} icon={<Handshake size={18} />} color={AMBER} onClick={() => openDM("followups")} />
        <ClickCard label="DSR Submitted" value={dsrSubmitted} icon={<CheckCircle2 size={18} />} color={NAVY} onClick={() => openDM("dsr")} />
      </div>

      <div style={grid5}>
        <ClickCard label="Scheduled Calls" value={calls} icon={<Phone size={18} />} color={ORANGE} onClick={() => openDM("calls")} />
        <ClickCard label="Team Lead Updates" value={updates} icon={<Megaphone size={18} />} color={BLUE} onClick={() => openDM("updates")} />
        <ClickCard label="Sales" value={fmtCurr(sales)} icon={<IndianRupee size={18} />} color={GREEN} onClick={() => openDM("sales")} />
        <ClickCard label="Contract Order Sent" value={orders} icon={<FileText size={18} />} color={PURPLE} onClick={() => openDM("orders")} />
        <ClickCard label="Payment Received" value={fmtCurr(payments)} icon={<Banknote size={18} />} color={AMBER} onClick={() => openDM("payments")} />
      </div>

      <div className="sv-card">
        <h3>Analytics</h3>
        <div className="sv-grid-2 sv-gap-md" style={{ marginTop: 16 }}>
          <div>
            <h4>Activity Mix</h4>
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={ovPieData} dataKey="value" nameKey="name" innerRadius={54} outerRadius={82} paddingAngle={2}>
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
          <div className="sv-status-grid">
            {empStats.map((e) => {
              const m = statusMeta[e.todayStatus] || statusMeta.none;
              return (
                <div key={e.id} className={`sv-status-pill sv-status-pill--${m.cls}`}>
                  <span className="sv-status-pill-dot" />
                  <span className="sv-status-pill-name">{e.name}</span>
                  <span className="sv-status-pill-tag">{m.label}</span>
                </div>
              );
            })}
          </div>
        </div>
        <div className="sv-card">
          <h3>Team Messages</h3>
          <div className="sv-msg-list">
            {teamMessages.length === 0 && (
              <p className="sv-msg-empty">No team messages in this period. 💬</p>
            )}
            {teamMessages.map((msg) => (
              <div key={msg.id} className={`sv-msg-card${msg.unread ? " sv-msg-card--unread" : ""}`}>
                <div className="sv-msg-avatar">
                  {msg.photo ? <img src={msg.photo} alt="" /> : <span>{initials(msg.name)}</span>}
                </div>
                <div className="sv-msg-body">
                  <div className="sv-msg-head">
                    <span className="sv-msg-name">{msg.name}</span>
                    {msg.teamLead && <span className="sv-msg-lead">→ {msg.teamLead}</span>}
                    {msg.unread && <span className="sv-msg-unread-dot" title="Unread" />}
                    <span className="sv-msg-time">{fmtDate(msg.date)}</span>
                  </div>
                  <div className="sv-msg-preview">{msg.text}</div>
                </div>
              </div>
            ))}
          </div>
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
        <button className="sv-btn sv-btn--outline" onClick={onExport}><Download size={15} /> Export CSV</button>
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
export function AnalyticsTab({ empStats, statusPie, chartData, monthlySalary = [] }) {
  const [selMonth, setSelMonth] = useState(null);
  return (
    <div className="sv-tab">
      <h2 className="sv-tab-title">Analytics</h2>
      <div className="sv-grid-2 sv-gap-md">
        <div className="sv-card">
          <h4>Individual Sales Performance</h4>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={empStats} layout="vertical" barGap={4} barCategoryGap="24%" margin={{ left: 4, right: 12 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} />
              <XAxis type="number" tick={TICK} /><YAxis type="category" dataKey="name" tick={TICK} width={100} />
              <Tooltip {...TT} /><Legend {...LEG} />
              <Bar dataKey="totalSales" name="Sales" fill={GREEN} radius={[0, 5, 5, 0]} />
              <Bar dataKey="totalPayments" name="Payment Received" fill={ORANGE} radius={[0, 5, 5, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="sv-card">
          <h4>Monthly Salary Distribution</h4>
          {monthlySalary.length === 0 ? (
            <p className="sv-text-muted" style={{ fontSize: 13, padding: "40px 0", textAlign: "center" }}>No salary payments recorded yet. Mark salaries as Paid to see monthly totals.</p>
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={monthlySalary}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="label" tick={TICK} /><YAxis tick={TICK} />
                <Tooltip {...TT} formatter={(v) => [fmtSalary(v), "Total Paid"]} />
                <Bar dataKey="total" fill={GREEN} cursor="pointer" radius={[6, 6, 0, 0]} onClick={(d) => setSelMonth(d && d.monthKey)} />
              </BarChart>
            </ResponsiveContainer>
          )}
          <p className="sv-text-muted" style={{ fontSize: 11, marginTop: 6 }}>Click a bar to see the employee-wise breakdown.</p>
        </div>
        <div className="sv-card">
          <h4>Work Status Breakdown</h4>
          <ResponsiveContainer width="100%" height={240}>
            <PieChart>
              <Pie data={statusPie} dataKey="value" nameKey="name" innerRadius={54} outerRadius={82} paddingAngle={2}>
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
      {selMonth && (() => {
        const mo = monthlySalary.find((m) => m.monthKey === selMonth);
        if (!mo) return null;
        return (
          <div className="sv-card" style={{ marginTop: 16 }}>
            <div className="sv-flex sv-justify-between sv-items-center" style={{ marginBottom: 10 }}>
              <h4 style={{ margin: 0 }}>{mo.label} Salary Distribution</h4>
              <button onClick={() => setSelMonth(null)} style={{ border: "none", background: "transparent", color: "#64748B", cursor: "pointer", fontWeight: 700, fontSize: 13 }}><X size={14} /> Close</button>
            </div>
            <table className="sv-table">
              <thead><tr><th>Employee</th><th style={{ textAlign: "right" }}>Salary Paid</th></tr></thead>
              <tbody>
                {mo.breakdown.map((r, i) => (
                  <tr key={i}><td>{r.name}</td><td style={{ textAlign: "right", fontWeight: 700 }}>{fmtSalary(r.amount)}</td></tr>
                ))}
                <tr><td style={{ fontWeight: 800 }}>Total</td><td style={{ textAlign: "right", fontWeight: 800, color: GREEN }}>{fmtSalary(mo.total)}</td></tr>
              </tbody>
            </table>
          </div>
        );
      })()}
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
export function DepartmentsTab({ departments, employees, submissions, newDept, setNewDept, addDept, removeDept, annText, setAnnText, annDepts, setAnnDepts, publishAnnouncement, announcements, customFields, setCustomFields, onPublishDeptAnnouncement, onDeleteAnnouncement, onAddField, onEditField, onRemoveField, todayStr, editMode = false }) {
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
export function LeaveBoardTab({ leaves, setLeaveStatus, editMode = false }) {
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
export function SettingsTab({ employees, setEmployees, onUpdateEmp, onDeleteEmp, onResetPwd, newEmp, setNewEmp, addEmployeeQuick, adminPwd, setAdminPwd, msgEmpId, setMsgEmpId, msgText, setMsgText, sendMessage, messages, deleteMessage, targets, setTargets, logo, onLogoChange, onLogoRemove, websites, newWebsite, setNewWebsite, addWebsite, removeWebsite, pushNotification, showToast, editMode = false, setEditMode, settingsPwd = "Settings@123", setSettingsPwd }) {
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
      <SettingsLockBar editMode={editMode} setEditMode={setEditMode} settingsPwd={settingsPwd} setSettingsPwd={setSettingsPwd} showToast={showToast} />
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
          <button className="sv-btn sv-btn--primary" onClick={changeAdminPwd} disabled={!editMode}>Update Password</button>
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
          <h3>Company Branding</h3>
          <div className="sv-logo-preview">
            {logo ? <img src={logo} alt="Logo" /> : <span>SV</span>}
          </div>
          <input type="file" accept="image/*" disabled={!editMode} onChange={(e) => e.target.files[0] && onLogoFile(e.target.files[0])} />
          <button className="sv-btn sv-btn--sm sv-btn--outline" style={{ marginTop: 8 }} onClick={onLogoRemove} disabled={!editMode}>Remove</button>
        </div>

        <div className="sv-card">
          <h3>Website Master List</h3>
          <div className="sv-flex sv-gap-sm">
            <input className="sv-input" placeholder="Website name" disabled={!editMode} value={newWebsite} onChange={(e) => setNewWebsite(e.target.value)} />
            <button className="sv-btn sv-btn--primary" onClick={addWebsite} disabled={!editMode}>Add</button>
          </div>
          <div className="sv-flex sv-gap-xs" style={{ marginTop: 12, flexWrap: "wrap" }}>
            {websites.map((w) => <span key={w} className="sv-chip">{w} <button disabled={!editMode} onClick={() => removeWebsite(w)} style={{ border: "none", background: "transparent", cursor: editMode ? "pointer" : "not-allowed", marginLeft: 4 }}>×</button></span>)}
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
  const [open, setOpen] = useState(false);
  useEffect(() => { setDraft(emp); }, [emp.id]);
  const set = (field, val) => setDraft((d) => ({ ...d, [field]: val }));
  return (
    <li className={`sv-emp-row${open ? " sv-emp-row--open" : ""}`}>
      <div className="sv-emp-head" onClick={() => setOpen((v) => !v)}>
        <span className="sv-flex sv-items-center sv-gap-2">
          <Avatar name={draft.name} photo={draft.photo} size={30} />
          <span className="sv-emp-name">{draft.name}</span>
          <span className="sv-emp-dept">{draft.department}</span>
        </span>
        <span className="sv-flex sv-items-center sv-gap-2">
          <button className="sv-btn sv-btn--sm sv-btn--danger" onClick={(ev) => { ev.stopPropagation(); if (window.confirm(`Remove ${emp.name}?`)) onDeleteEmp(emp.id); }}>Remove</button>
          <span className="sv-emp-chevron">{open ? "▲" : "▼"}</span>
        </span>
      </div>
      {open && (
      <div className="sv-emp-body">
      <div className="sv-emp-grid">
        <label className="sv-field"><span>Department</span>
          <select className="sv-select" value={draft.department} onChange={(e) => { const v = e.target.value; const next = { ...draft, department: v }; setDraft(next); onUpdateEmp(next); }}>
            <option>Sales</option><option>Operations</option>
          </select>
        </label>
        <label className="sv-field"><span>Employee Code</span>
          <input className="sv-input" maxLength={4} placeholder="e.g. 1234" value={draft.code || ""} onChange={(e) => set("code", e.target.value)} onBlur={() => onUpdateEmp(draft)} />
        </label>
        <label className="sv-field"><span>Email</span>
          <input className="sv-input" placeholder="name@company.com" value={draft.email || ""} onChange={(e) => set("email", e.target.value)} onBlur={() => onUpdateEmp(draft)} />
        </label>
        <label className="sv-field"><span>Team Lead</span>
          <input className="sv-input" placeholder="Team lead name" value={draft.teamLead || ""} onChange={(e) => set("teamLead", e.target.value)} onBlur={() => onUpdateEmp(draft)} />
        </label>
      </div>
      <ResetPasswordInline empId={emp.id} empName={emp.name} onResetPwd={onResetPwd} currentPassword={emp.passwordPlain} />
      </div>
      )}
    </li>
  );
}

function ResetPasswordInline({ empId, empName, onResetPwd, currentPassword }) {
  const [open, setOpen] = useState(false);
  const [reveal, setReveal] = useState(false);
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
      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        <button
          className="sv-btn sv-btn--sm sv-btn--outline"
          onClick={() => { setOpen((o) => !o); setMsg(""); }}
        >
          {open ? <><X size={14} /> Cancel</> : <><KeyRound size={14} /> Reset Password</>}
        </button>
        <button
          type="button"
          className="sv-btn sv-btn--sm sv-btn--outline"
          onClick={() => setReveal((r) => !r)}
        >
          {reveal ? <><EyeOff size={14} /> Hide password</> : <><Eye size={14} /> View password</>}
        </button>
        {reveal && (
          <code style={{ fontSize: 12, background: "#F1F5F9", padding: "3px 8px", borderRadius: 6, color: "#0F172A" }}>
            {currentPassword ? currentPassword : "— not available —"}
          </code>
        )}
      </div>
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
  return (
    <div style={{ marginTop: 12 }}>
      <div className="sv-emp-count">{employees.length} employee{employees.length === 1 ? "" : "s"} — click a name to view details</div>
      <div className="sv-emp-list">
        <ul className="sv-list" style={{ margin: 0, padding: 0 }}>
          {employees.map((e) => (
            <EmployeeRow key={e.id} emp={e} onUpdateEmp={onUpdateEmp} onDeleteEmp={onDeleteEmp} onResetPwd={onResetPwd} />
          ))}
        </ul>
      </div>
    </div>
  );
}

/* ───────────────────────────────────────────────────────────────
 * SettingsLockBar — gates editing of Settings config + the Salary
 * tab behind a SEPARATE "Settings Password" (distinct from the admin
 * login password). Supports resetting the Settings Password after
 * verifying either the current Settings Password or an OTP.
 *
 * NOTE: OTP delivery is a demo — there is no SMS/WhatsApp backend yet,
 * so the generated code is surfaced on screen. Wire `sendOtp` to a real
 * SMS/WhatsApp provider (to the registered mobile) when available.
 * ──────────────────────────────────────────────────────────────*/
function SettingsLockBar({ editMode, setEditMode, settingsPwd, setSettingsPwd, showToast }) {
  const [panel, setPanel] = useState(null);           // null | "unlock" | "reset"
  const [unlockPwd, setUnlockPwd] = useState("");
  const [rMethod, setRMethod] = useState("password"); // "password" | "otp"
  const [rVerified, setRVerified] = useState(false);
  const [rCurrent, setRCurrent] = useState("");
  const [rOtpSent, setROtpSent] = useState("");
  const [rOtpInput, setROtpInput] = useState("");
  const [rNew, setRNew] = useState("");
  const [rConfirm, setRConfirm] = useState("");

  const closeAll = () => {
    setPanel(null); setUnlockPwd(""); setRVerified(false); setRCurrent("");
    setROtpSent(""); setROtpInput(""); setRNew(""); setRConfirm(""); setRMethod("password");
  };

  const doUnlock = () => {
    if (unlockPwd === settingsPwd) { setEditMode(true); showToast("Settings & Salary unlocked.", "success"); closeAll(); }
    else showToast("Incorrect Settings Password.", "error");
  };

  const sendOtp = () => {
    const code = String(Math.floor(100000 + Math.random() * 900000));
    setROtpSent(code);
    // DEMO: no SMS/WhatsApp backend — surface the code so it can be entered.
    // TODO: replace with a real send to the admin's registered mobile.
    showToast(`Demo OTP (wire SMS/WhatsApp later): ${code}`, "info");
  };

  const verifyReset = () => {
    if (rMethod === "password") {
      if (rCurrent === settingsPwd) setRVerified(true);
      else showToast("Current Settings Password is incorrect.", "error");
    } else {
      if (rOtpInput && rOtpInput === rOtpSent) setRVerified(true);
      else showToast("Incorrect OTP.", "error");
    }
  };

  const saveNew = () => {
    if (!rNew || rNew.length < 4) { showToast("New password must be at least 4 characters.", "error"); return; }
    if (rNew !== rConfirm) { showToast("New passwords do not match.", "error"); return; }
    setSettingsPwd && setSettingsPwd(rNew);
    showToast("Settings Password updated.", "success");
    closeAll();
  };

  return (
    <div style={{
      padding: "10px 16px", marginBottom: 4,
      background: editMode ? "#DCFCE7" : "#FEF3C7",
      border: `1.5px solid ${editMode ? "#86EFAC" : "#FDE68A"}`,
      borderRadius: 10,
    }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 18 }}>{editMode ? "🔓" : "🔒"}</span>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: editMode ? "#166534" : "#92400E" }}>
              {editMode ? "Settings & Salary — editing unlocked" : "Settings & Salary are locked"}
            </div>
            <div style={{ fontSize: 11, color: editMode ? "#15803D" : "#B45309" }}>
              {editMode ? "Config fields and the Salary tab are editable. Click Lock when done." : "Enter the Settings Password to edit config & salary. Employee info stays editable without it."}
            </div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {editMode ? (
            <button onClick={() => { setEditMode(false); closeAll(); }} style={{ padding: "8px 18px", borderRadius: 8, border: "none", cursor: "pointer", fontWeight: 700, fontSize: 13, background: "#DC2626", color: "#fff" }}>🔒 Lock</button>
          ) : (
            <>
              <button onClick={() => setPanel(panel === "unlock" ? null : "unlock")} style={{ padding: "8px 18px", borderRadius: 8, border: "none", cursor: "pointer", fontWeight: 700, fontSize: 13, background: "#1D4ED8", color: "#fff" }}><Pencil size={14} /> Edit</button>
              <button onClick={() => { setPanel(panel === "reset" ? null : "reset"); setRVerified(false); }} style={{ padding: "8px 14px", borderRadius: 8, border: "1.5px solid #CBD5E1", cursor: "pointer", fontWeight: 700, fontSize: 12.5, background: "#fff", color: "#475569" }}>Reset Password</button>
            </>
          )}
        </div>
      </div>

      {/* Unlock panel */}
      {!editMode && panel === "unlock" && (
        <div style={{ marginTop: 10, padding: "10px 12px", background: "#fff", border: "1px solid #E2E8F0", borderRadius: 8, display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <input className="sv-input" type="password" placeholder="Settings Password" value={unlockPwd} onChange={(e) => setUnlockPwd(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") doUnlock(); }} style={{ maxWidth: 220 }} />
          <button className="sv-btn sv-btn--primary" onClick={doUnlock}>Unlock</button>
        </div>
      )}

      {/* Reset panel */}
      {!editMode && panel === "reset" && (
        <div style={{ marginTop: 10, padding: "12px 14px", background: "#fff", border: "1px solid #E2E8F0", borderRadius: 8 }}>
          <div style={{ fontSize: 12.5, fontWeight: 700, color: "#475569", marginBottom: 8 }}>Reset Settings Password</div>
          {!rVerified ? (
            <>
              <div style={{ display: "flex", gap: 8, marginBottom: 10, flexWrap: "wrap" }}>
                <button onClick={() => setRMethod("password")} className={`sv-period-btn ${rMethod === "password" ? "sv-period-btn--active" : ""}`}>Current Password</button>
                <button onClick={() => setRMethod("otp")} className={`sv-period-btn ${rMethod === "otp" ? "sv-period-btn--active" : ""}`}>OTP</button>
              </div>
              {rMethod === "password" ? (
                <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                  <input className="sv-input" type="password" placeholder="Current Settings Password" value={rCurrent} onChange={(e) => setRCurrent(e.target.value)} style={{ maxWidth: 240 }} />
                  <button className="sv-btn sv-btn--primary" onClick={verifyReset}>Verify</button>
                </div>
              ) : (
                <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                  <button className="sv-btn sv-btn--outline" onClick={sendOtp}>{rOtpSent ? "Resend OTP" : "Send OTP"}</button>
                  <input className="sv-input" placeholder="Enter OTP" value={rOtpInput} onChange={(e) => setROtpInput(e.target.value)} style={{ maxWidth: 160 }} disabled={!rOtpSent} />
                  <button className="sv-btn sv-btn--primary" onClick={verifyReset} disabled={!rOtpSent}>Verify</button>
                  <span style={{ fontSize: 11, color: "#94A3B8" }}>Sent to registered mobile (demo — wire SMS/WhatsApp later).</span>
                </div>
              )}
            </>
          ) : (
            <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
              <input className="sv-input" type="password" placeholder="New Settings Password" value={rNew} onChange={(e) => setRNew(e.target.value)} style={{ maxWidth: 220 }} />
              <input className="sv-input" type="password" placeholder="Confirm new password" value={rConfirm} onChange={(e) => setRConfirm(e.target.value)} style={{ maxWidth: 220 }} />
              <button className="sv-btn sv-btn--primary" onClick={saveNew}>Save New Password</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ───────────────────────────────────────────────────────────────
 * ExpenseTab — SaaS financial management (3 sections + dashboard).
 *   • Insertion Orders  — auto-captured when a Confirmation Order is downloaded
 *   • Salary Expenses   — auto-captured when a salary is marked Paid
 *   • SuccessViews Expenses — manual company operating expenses
 * Reuses existing .sv-* styles. Attachments deferred to a follow-up.
 * ──────────────────────────────────────────────────────────────*/
const EXP_CURRENCIES = ["INR", "USD", "AED", "AUD", "EUR", "GBP", "CAD", "Other"];
const EXP_METHODS = ["PayPal", "Skydo", "Bank Transfer", "Wise", "Stripe", "Cash", "Other"];
const CO_CATEGORIES = ["Office Rent", "Internet", "Electricity", "Software Subscriptions", "Marketing", "Travel", "Food", "Office Equipment", "Miscellaneous"];
const CO_BLANK = { type: "company", title: "", category: "Miscellaneous", clientName: "", amount: "", currency: "INR", paymentDate: "", paymentMethod: "", paymentStatus: "Paid", notes: "", details: { vendor: "" } };
const EXP_MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

function expMoney(v, code) {
  if (v === null || v === undefined || v === "") return "—";
  const n = Number(v);
  if (Number.isNaN(n)) return "—";
  return n.toLocaleString(code === "INR" ? "en-IN" : "en-US") + (code ? " " + code : "");
}
function expMonthKey(rec) { return (rec.paymentDate || rec.createdAt || "").slice(0, 7); }
function expMonthLabel(key) {
  if (!key) return "Undated";
  const [y, m] = key.split("-");
  return `${EXP_MONTHS[(+m) - 1] || m} ${y}`;
}
function expBag(list) {
  const bag = {};
  list.forEach((r) => { const n = Number(r.amount); if (!Number.isNaN(n) && r.amount !== null && r.amount !== "") bag[r.currency || "INR"] = (bag[r.currency || "INR"] || 0) + n; });
  return bag;
}
function expFmtBag(bag) {
  const k = Object.keys(bag);
  if (!k.length) return "—";
  return k.map((c) => expMoney(bag[c], c)).join(" · ");
}
function expEsc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c])); }

export function ExpenseTab({ expenses = [], addExpense, updateExpense, deleteExpense, logo = "" }) {
  const [section, setSection] = useState("dashboard");
  const [search, setSearch] = useState("");
  const [fMonth, setFMonth] = useState("");
  const [fYear, setFYear] = useState("");
  const [fCur, setFCur] = useState("");
  const [fStatus, setFStatus] = useState("");
  const [fCat, setFCat] = useState("");
  const [detail, setDetail] = useState(null);
  const [detailEdit, setDetailEdit] = useState(null); // { paymentStatus, notes } while editing a captured record
  const [form, setForm] = useState(null);             // company add/edit form
  const [isNew, setIsNew] = useState(false);
  const [confirmDel, setConfirmDel] = useState(null);
  const [saving, setSaving] = useState(false);

  const io = expenses.filter((e) => e.type === "insertion_order");
  const sal = expenses.filter((e) => e.type === "salary");
  const co = expenses.filter((e) => e.type === "company");

  const years = Array.from(new Set(expenses.map((e) => expMonthKey(e).slice(0, 4)).filter(Boolean))).sort().reverse();

  const applyFilters = (list) => list.filter((e) => {
    const q = search.trim().toLowerCase();
    if (q) {
      const hay = `${e.clientName || ""} ${e.title || ""} ${e.contractOrder || ""} ${e.category || ""} ${(e.details && e.details.employeeName) || ""} ${(e.details && e.details.employeeId) || ""} ${(e.details && e.details.confirmationNo) || ""} ${(e.details && e.details.vendor) || ""}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    const mk = expMonthKey(e);
    if (fMonth && mk.slice(5, 7) !== fMonth) return false;
    if (fYear && mk.slice(0, 4) !== fYear) return false;
    if (fCur && e.currency !== fCur) return false;
    if (fStatus && (e.paymentStatus || "") !== fStatus) return false;
    if (fCat && (e.category || "") !== fCat) return false;
    return true;
  });

  // Monthly summaries (all months, newest first)
  const monthMap = {};
  expenses.forEach((e) => { const k = expMonthKey(e); if (!k) return; (monthMap[k] = monthMap[k] || []).push(e); });
  const monthKeys = Object.keys(monthMap).sort().reverse();

  const openAddCompany = () => { setForm({ ...CO_BLANK, details: { vendor: "" } }); setIsNew(true); };
  const openEditCompany = (e) => { setForm({ ...e, details: { ...(e.details || {}) } }); setIsNew(false); setDetail(null); };
  const updF = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const updFDetail = (k, v) => setForm((f) => ({ ...f, details: { ...(f.details || {}), [k]: v } }));
  const saveCompany = async () => {
    if (!form.title.trim() && !form.clientName.trim()) return;
    if (!form.clientName) form.clientName = form.title;
    setSaving(true);
    const ok = isNew ? await addExpense(form) : await updateExpense(form);
    setSaving(false);
    if (ok !== false) setForm(null);
  };

  const openDetail = (rec) => { setDetail(rec); setDetailEdit({ paymentStatus: rec.paymentStatus || "", notes: rec.notes || "" }); };
  const saveDetailEdit = async () => {
    setSaving(true);
    await updateExpense({ ...detail, paymentStatus: detailEdit.paymentStatus, notes: detailEdit.notes });
    setSaving(false);
    setDetail(null);
  };
  const doDelete = async () => { const id = confirmDel.id; setConfirmDel(null); setDetail(null); await deleteExpense(id); };

  const currentList = section === "insertion" ? applyFilters(io) : section === "salary" ? applyFilters(sal) : section === "company" ? applyFilters(co) : [];

  const exportRows = () => {
    if (section === "insertion") {
      const rows = [["Confirmation No", "Client", "Company", "Feature", "Magazine", "Date", "Contract Value", "Currency", "Payment Status", "Order Status"]];
      applyFilters(io).forEach((e) => { const d = e.details || {}; rows.push([d.confirmationNo || e.contractOrder, e.clientName, d.companyName, d.featureTitle, d.magazine, e.paymentDate, e.amount ?? "", e.currency, e.paymentStatus, d.orderStatus]); });
      return rows;
    }
    if (section === "salary") {
      const rows = [["Employee", "Employee ID", "Department", "Month", "Year", "Fixed", "Incentives", "Deductions", "Final Salary", "Payment Date", "Status"]];
      applyFilters(sal).forEach((e) => { const d = e.details || {}; rows.push([d.employeeName || e.clientName, d.employeeId, d.department, d.month, d.year, d.fixed ?? "", d.incentiveTotal ?? "", d.deductionTotal ?? "", e.amount ?? "", e.paymentDate, e.paymentStatus]); });
      return rows;
    }
    const rows = [["Title", "Category", "Vendor", "Amount", "Currency", "Payment Date", "Method", "Status", "Notes"]];
    applyFilters(co).forEach((e) => rows.push([e.title || e.clientName, e.category, (e.details || {}).vendor, e.amount ?? "", e.currency, e.paymentDate, e.paymentMethod, e.paymentStatus, e.notes]));
    return rows;
  };
  const doExportCSV = () => downloadCSV(`successviews-${section}-${new Date().toISOString().slice(0, 10)}.csv`, exportRows());
  const doExportExcel = () => {
    const rows = exportRows();
    const html = `<html xmlns:x="urn:schemas-microsoft-com:office:excel"><head><meta charset="utf-8"></head><body><table border="1">${rows.map((r, i) => `<tr>${r.map((c) => `<${i === 0 ? "th" : "td"}>${expEsc(c)}</${i === 0 ? "th" : "td"}>`).join("")}</tr>`).join("")}</table></body></html>`;
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([html], { type: "application/vnd.ms-excel" }));
    a.download = `successviews-${section}-${new Date().toISOString().slice(0, 10)}.xls`;
    a.click();
  };

  const downloadSlip = (rec) => {
    const d = rec.details || {};
    const inr = (v) => (v === null || v === undefined || v === "" ? "0" : Number(v).toLocaleString("en-IN"));
    const rows = [];
    rows.push(`<tr><td>Fixed Salary</td><td class="r">₹ ${inr(d.fixed)}/-</td></tr>`);
    (d.incentives || []).forEach((i) => rows.push(`<tr><td>Incentive — ${expEsc(i.reason || "")}</td><td class="r pos">+ ₹ ${inr(i.amount)}/-</td></tr>`));
    (d.deductions || []).forEach((i) => rows.push(`<tr><td>Deduction — ${expEsc(i.reason || "")}</td><td class="r neg">- ₹ ${inr(i.amount)}/-</td></tr>`));
    const logoHtml = logo ? `<img src="${logo}" style="max-height:54px;max-width:220px;object-fit:contain;" />` : `<h2 style="margin:0;color:#162B55;">SuccessViews</h2>`;
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>Salary Slip — ${expEsc(d.employeeName || "")}</title>
<style>*{box-sizing:border-box;font-family:Arial,Helvetica,sans-serif;-webkit-print-color-adjust:exact;print-color-adjust:exact;}
body{margin:0;padding:32px;color:#1f2937;}.wrap{max-width:640px;margin:0 auto;border:1px solid #e5e7eb;border-radius:12px;padding:28px;}
.head{display:flex;justify-content:space-between;align-items:center;border-bottom:2px solid #eef2f7;padding-bottom:14px;margin-bottom:16px;}
.title{font-size:18px;font-weight:800;color:#162B55;}h3{margin:2px 0 0;font-size:13px;color:#64748b;font-weight:600;}
table{width:100%;border-collapse:collapse;margin-top:8px;font-size:14px;}td{padding:9px 4px;border-bottom:1px solid #f1f5f9;}
.r{text-align:right;}.pos{color:#15803d;}.neg{color:#b91c1c;}.net{font-size:17px;font-weight:800;color:#162B55;border-top:2px solid #e5e7eb;}
.meta{display:flex;gap:24px;flex-wrap:wrap;font-size:13px;color:#475569;margin-bottom:6px;}.meta b{color:#0f172a;}</style></head>
<body><div class="wrap">
<div class="head"><div>${logoHtml}</div><div style="text-align:right;"><div class="title">Salary Slip</div><h3>${expEsc(d.month || "")} ${expEsc(String(d.year || ""))}</h3></div></div>
<div class="meta"><div><b>${expEsc(d.employeeName || rec.clientName || "")}</b></div><div>ID: ${expEsc(d.employeeId || "")}</div><div>Dept: ${expEsc(d.department || "")}</div></div>
<div class="meta"><div>Payment Date: <b>${expEsc(rec.paymentDate || "")}</b></div><div>Status: <b>${expEsc(rec.paymentStatus || "Paid")}</b></div></div>
<table>${rows.join("")}<tr class="net"><td>Net Salary Paid</td><td class="r net">₹ ${inr(d.finalSalary != null ? d.finalSalary : rec.amount)}/-</td></tr></table>
<p style="margin-top:18px;font-size:11px;color:#94a3b8;text-align:center;">Computer-generated salary slip · SuccessViews</p>
</div><script>window.onload=function(){setTimeout(function(){window.focus();window.print();},350);};</script></body></html>`;
    const w = window.open("", "_blank");
    if (!w) return;
    w.document.open(); w.document.write(html); w.document.close();
  };

  const sectionBtn = (key, label) => (
    <button className={`sv-period-btn ${section === key ? "sv-period-btn--active" : ""}`} onClick={() => setSection(key)}>{label}</button>
  );
  const metaCell = (l, v) => (<div className="sv-meta-cell"><div className="sv-meta-label">{l}</div><div className="sv-meta-value">{v}</div></div>);

  return (
    <div className="sv-tab">
      <h2 className="sv-tab-title">Expense</h2>

      <div className="sv-flex sv-gap-sm" style={{ flexWrap: "wrap" }}>
        {sectionBtn("dashboard", "Monthly Dashboard")}
        {sectionBtn("insertion", `Insertion Orders (${io.length})`)}
        {sectionBtn("salary", `Salary (${sal.length})`)}
        {sectionBtn("company", `SuccessViews Expenses (${co.length})`)}
      </div>

      {/* ── Monthly dashboard ── */}
      {section === "dashboard" && (
        <div className="sv-card">
          <h3>Monthly Financial Summary</h3>
          {monthKeys.length === 0 ? (
            <p className="sv-text-muted" style={{ padding: "24px 0", textAlign: "center" }}>No financial records yet. Download a Confirmation Order or mark a salary as Paid — records appear here automatically.</p>
          ) : (
            <div style={{ overflowX: "auto", marginTop: 12 }}>
              <table className="sv-table">
                <thead>
                  <tr><th>Month</th><th>Revenue (Orders)</th><th>Salary Expense</th><th>Other Expenses</th><th>Total Expense</th><th>Transactions</th></tr>
                </thead>
                <tbody>
                  {monthKeys.map((k) => {
                    const list = monthMap[k];
                    const rev = expBag(list.filter((e) => e.type === "insertion_order"));
                    const salB = expBag(list.filter((e) => e.type === "salary"));
                    const othB = expBag(list.filter((e) => e.type === "company"));
                    const totB = {}; [salB, othB].forEach((b) => Object.entries(b).forEach(([c, v]) => totB[c] = (totB[c] || 0) + v));
                    return (
                      <tr key={k}>
                        <td style={{ fontWeight: 700 }}>{expMonthLabel(k)}</td>
                        <td>{expFmtBag(rev)}</td>
                        <td>{expFmtBag(salB)}</td>
                        <td>{expFmtBag(othB)}</td>
                        <td style={{ fontWeight: 600 }}>{expFmtBag(totB)}</td>
                        <td>{list.length}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              <p className="sv-text-muted" style={{ fontSize: 11, marginTop: 8 }}>Amounts are grouped by their own currency (orders are often USD, salary/company INR) — no automatic conversion is applied.</p>
            </div>
          )}
        </div>
      )}

      {/* ── List sections ── */}
      {section !== "dashboard" && (
        <div className="sv-card">
          <div className="sv-flex sv-justify-between" style={{ alignItems: "center", flexWrap: "wrap", gap: 10, marginBottom: 12 }}>
            <div>
              <h3 style={{ margin: 0 }}>{section === "insertion" ? "Insertion Orders" : section === "salary" ? "Salary Expenses" : "SuccessViews Expenses"}</h3>
              <p className="sv-text-muted" style={{ fontSize: 12.5, margin: "2px 0 0" }}>
                {section === "insertion" ? "Auto-created when a Confirmation Order is downloaded." : section === "salary" ? "Auto-created when a salary is marked Paid." : "Company operating expenses (manually added)."}
              </p>
            </div>
            <div className="sv-flex sv-gap-sm" style={{ flexWrap: "wrap" }}>
              <button className="sv-btn sv-btn--ghost" onClick={doExportCSV} disabled={currentList.length === 0}><Download size={15} /> CSV</button>
              <button className="sv-btn sv-btn--ghost" onClick={doExportExcel} disabled={currentList.length === 0}><Download size={15} /> Excel</button>
              {section === "company" && <button className="sv-btn sv-btn--primary" onClick={openAddCompany}><Plus size={15} /> Add Expense</button>}
            </div>
          </div>

          {/* Filters */}
          <div className="sv-flex sv-gap-sm" style={{ flexWrap: "wrap", marginBottom: 14 }}>
            <input className="sv-input" placeholder="Search…" value={search} onChange={(e) => setSearch(e.target.value)} style={{ minWidth: 200, flex: 1 }} />
            <select className="sv-select" value={fMonth} onChange={(e) => setFMonth(e.target.value)} style={{ maxWidth: 140 }}>
              <option value="">All months</option>
              {EXP_MONTHS.map((m, i) => <option key={m} value={String(i + 1).padStart(2, "0")}>{m}</option>)}
            </select>
            <select className="sv-select" value={fYear} onChange={(e) => setFYear(e.target.value)} style={{ maxWidth: 110 }}>
              <option value="">All years</option>
              {years.map((y) => <option key={y} value={y}>{y}</option>)}
            </select>
            <select className="sv-select" value={fCur} onChange={(e) => setFCur(e.target.value)} style={{ maxWidth: 120 }}>
              <option value="">Currency</option>
              {EXP_CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
            <select className="sv-select" value={fStatus} onChange={(e) => setFStatus(e.target.value)} style={{ maxWidth: 130 }}>
              <option value="">Status</option>
              {["Paid", "Pending", "Partial", "Overdue"].map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
            {section === "company" && (
              <select className="sv-select" value={fCat} onChange={(e) => setFCat(e.target.value)} style={{ maxWidth: 160 }}>
                <option value="">Category</option>
                {CO_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            )}
          </div>

          {currentList.length === 0 ? (
            <div style={{ textAlign: "center", padding: "38px 16px", color: "#64748B" }}>
              <div style={{ fontSize: 38 }}>{section === "insertion" ? "🧾" : section === "salary" ? "👥" : "🏢"}</div>
              <p style={{ fontWeight: 700, color: "#334155", margin: "8px 0 2px" }}>No records</p>
              <p style={{ fontSize: 13, margin: 0 }}>{section === "company" ? "Add your first company expense." : "Records appear here automatically."}</p>
            </div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table className="sv-table">
                {section === "insertion" && <thead><tr><th>Confirmation No</th><th>Client</th><th>Company</th><th>Date</th><th>Value</th><th>Payment</th></tr></thead>}
                {section === "salary" && <thead><tr><th>Employee</th><th>Dept</th><th>Month</th><th>Final Salary</th><th>Paid On</th><th>Status</th></tr></thead>}
                {section === "company" && <thead><tr><th>Title</th><th>Category</th><th>Vendor</th><th>Amount</th><th>Date</th><th>Status</th></tr></thead>}
                <tbody>
                  {currentList.map((e) => {
                    const d = e.details || {};
                    return (
                      <tr key={e.id} style={{ cursor: "pointer" }} onClick={() => openDetail(e)}>
                        {section === "insertion" && <>
                          <td style={{ fontWeight: 600 }}>{d.confirmationNo || e.contractOrder || "—"}</td>
                          <td>{e.clientName || "—"}</td><td>{d.companyName || "—"}</td>
                          <td>{e.paymentDate ? fmtDate(e.paymentDate) : "—"}</td>
                          <td>{expMoney(e.amount, e.currency)}</td>
                          <td><span className={`sv-badge sv-badge--${(e.paymentStatus || "pending").toLowerCase()}`}>{e.paymentStatus || "Pending"}</span></td>
                        </>}
                        {section === "salary" && <>
                          <td style={{ fontWeight: 600 }}>{d.employeeName || e.clientName || "—"}</td>
                          <td>{d.department || "—"}</td><td>{d.month} {d.year}</td>
                          <td>{expMoney(e.amount, e.currency)}</td>
                          <td>{e.paymentDate ? fmtDate(e.paymentDate) : "—"}</td>
                          <td><span className="sv-badge sv-badge--completed">{e.paymentStatus || "Paid"}</span></td>
                        </>}
                        {section === "company" && <>
                          <td style={{ fontWeight: 600 }}>{e.title || e.clientName || "—"}</td>
                          <td>{e.category || "—"}</td><td>{d.vendor || "—"}</td>
                          <td>{expMoney(e.amount, e.currency)}</td>
                          <td>{e.paymentDate ? fmtDate(e.paymentDate) : "—"}</td>
                          <td><span className={`sv-badge sv-badge--${(e.paymentStatus || "paid").toLowerCase()}`}>{e.paymentStatus || "Paid"}</span></td>
                        </>}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── Detail modal ── */}
      {detail && (
        <div className="sv-modal-overlay" onClick={() => setDetail(null)}>
          <div className="sv-modal" style={{ maxWidth: 600, maxHeight: "88vh", display: "flex", flexDirection: "column" }} onClick={(ev) => ev.stopPropagation()}>
            <div className="sv-modal-header" style={{ flexShrink: 0 }}>
              <span className="sv-text-navy sv-font-800" style={{ fontSize: 16 }}>{detail.title || detail.clientName || "Record"}</span>
              <button className="sv-modal-close" onClick={() => setDetail(null)}>×</button>
            </div>
            <div style={{ overflowY: "auto", padding: "16px 20px" }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                {detail.type === "insertion_order" && (() => { const d = detail.details || {}; return [
                  ["Confirmation No", d.confirmationNo || detail.contractOrder], ["Contract No", d.contractNo || "—"],
                  ["Client", detail.clientName], ["Company", d.companyName || "—"],
                  ["Feature", d.featureTitle || "—"], ["Magazine", d.magazine || "—"],
                  ["Contract Value", expMoney(detail.amount, detail.currency)], ["Generated", d.generatedAt ? new Date(d.generatedAt).toLocaleString() : "—"],
                  ["Order Status", d.orderStatus || "—"], ["Payment Status", detail.paymentStatus || "—"],
                ].map(([l, v]) => metaCell(l, v)); })()}
                {detail.type === "salary" && (() => { const d = detail.details || {}; return [
                  ["Employee", d.employeeName || detail.clientName], ["Employee ID", d.employeeId || "—"],
                  ["Department", d.department || "—"], ["Period", `${d.month || ""} ${d.year || ""}`],
                  ["Fixed", expMoney(d.fixed, "INR")], ["Incentives", expMoney(d.incentiveTotal, "INR")],
                  ["Deductions", expMoney(d.deductionTotal, "INR")], ["Final Salary", expMoney(detail.amount, "INR")],
                  ["Payment Date", detail.paymentDate ? fmtDate(detail.paymentDate) : "—"], ["Status", detail.paymentStatus || "Paid"],
                ].map(([l, v]) => metaCell(l, v)); })()}
                {detail.type === "company" && (() => { const d = detail.details || {}; return [
                  ["Title", detail.title || detail.clientName], ["Category", detail.category || "—"],
                  ["Vendor", d.vendor || "—"], ["Amount", expMoney(detail.amount, detail.currency)],
                  ["Payment Date", detail.paymentDate ? fmtDate(detail.paymentDate) : "—"], ["Method", detail.paymentMethod || "—"],
                  ["Status", detail.paymentStatus || "—"], ["Currency", detail.currency || "—"],
                ].map(([l, v]) => metaCell(l, v)); })()}
              </div>

              {/* Editable status + notes for captured records */}
              {detailEdit && (
                <div style={{ marginTop: 16, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                  <label style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 12.5, fontWeight: 600, color: "#475569" }}>Payment Status
                    <select className="sv-select" value={detailEdit.paymentStatus} onChange={(e) => setDetailEdit((s) => ({ ...s, paymentStatus: e.target.value }))}>
                      {["", "Paid", "Pending", "Partial", "Overdue"].map((s) => <option key={s} value={s}>{s || "—"}</option>)}
                    </select>
                  </label>
                  <div />
                  <div style={{ gridColumn: "1 / -1" }}>
                    <label style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 12.5, fontWeight: 600, color: "#475569" }}>Notes / Remarks
                      <textarea className="sv-input" rows={3} value={detailEdit.notes} onChange={(e) => setDetailEdit((s) => ({ ...s, notes: e.target.value }))} style={{ resize: "vertical" }} />
                    </label>
                  </div>
                </div>
              )}
              <p className="sv-text-muted" style={{ fontSize: 11, marginTop: 14 }}>📎 File attachments are coming in a follow-up update.</p>
            </div>
            <div className="sv-flex sv-justify-between" style={{ padding: "12px 20px", borderTop: "1px solid #F1F5F9", flexShrink: 0, alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <button className="sv-btn sv-btn--danger" onClick={() => setConfirmDel(detail)}>Delete</button>
              <div className="sv-flex sv-gap-sm" style={{ flexWrap: "wrap" }}>
                {detail.type === "salary" && <button className="sv-btn sv-btn--ghost" onClick={() => downloadSlip(detail)}><FileText size={15} /> Download Slip</button>}
                {detail.type === "company" && <button className="sv-btn sv-btn--ghost" onClick={() => openEditCompany(detail)}>Edit</button>}
                <button className="sv-btn sv-btn--primary" onClick={saveDetailEdit} disabled={saving}>{saving ? "Saving…" : "Save"}</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Company add/edit modal ── */}
      {form && (
        <div className="sv-modal-overlay" onClick={() => setForm(null)}>
          <div className="sv-modal" style={{ maxWidth: 620, maxHeight: "88vh", display: "flex", flexDirection: "column" }} onClick={(ev) => ev.stopPropagation()}>
            <div className="sv-modal-header" style={{ flexShrink: 0 }}>
              <span className="sv-text-navy sv-font-800" style={{ fontSize: 16 }}>{isNew ? "Add Company Expense" : "Edit Expense"}</span>
              <button className="sv-modal-close" onClick={() => setForm(null)}>×</button>
            </div>
            <div style={{ overflowY: "auto", padding: "16px 20px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              <label style={lblS}>Expense Title *<input className="sv-input" value={form.title} onChange={(e) => updF("title", e.target.value)} placeholder="e.g. Office Rent — July" /></label>
              <label style={lblS}>Category
                <select className="sv-select" value={form.category} onChange={(e) => updF("category", e.target.value)}>{CO_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}</select>
              </label>
              <label style={lblS}>Amount<input className="sv-input" type="number" value={form.amount} onChange={(e) => updF("amount", e.target.value)} placeholder="0.00" /></label>
              <label style={lblS}>Currency
                <select className="sv-select" value={form.currency} onChange={(e) => updF("currency", e.target.value)}>{EXP_CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}</select>
              </label>
              <label style={lblS}>Payment Date<input className="sv-input" type="date" value={form.paymentDate || ""} onChange={(e) => updF("paymentDate", e.target.value)} /></label>
              <label style={lblS}>Payment Method
                <select className="sv-select" value={form.paymentMethod} onChange={(e) => updF("paymentMethod", e.target.value)}><option value="">Select…</option>{EXP_METHODS.map((m) => <option key={m} value={m}>{m}</option>)}</select>
              </label>
              <label style={lblS}>Vendor<input className="sv-input" value={(form.details || {}).vendor || ""} onChange={(e) => updFDetail("vendor", e.target.value)} placeholder="Vendor / payee" /></label>
              <label style={lblS}>Payment Status
                <select className="sv-select" value={form.paymentStatus} onChange={(e) => updF("paymentStatus", e.target.value)}>{["Paid", "Pending", "Partial", "Overdue"].map((s) => <option key={s} value={s}>{s}</option>)}</select>
              </label>
              <div style={{ gridColumn: "1 / -1" }}>
                <label style={lblS}>Notes / Remarks<textarea className="sv-input" rows={3} value={form.notes} onChange={(e) => updF("notes", e.target.value)} style={{ resize: "vertical" }} /></label>
              </div>
            </div>
            <div className="sv-flex sv-justify-between" style={{ padding: "12px 20px", borderTop: "1px solid #F1F5F9", flexShrink: 0, alignItems: "center" }}>
              <span className="sv-text-muted" style={{ fontSize: 12 }}>* Title is required</span>
              <div className="sv-flex sv-gap-sm">
                <button className="sv-btn sv-btn--ghost" onClick={() => setForm(null)}>Cancel</button>
                <button className="sv-btn sv-btn--primary" onClick={saveCompany} disabled={saving || !form.title.trim()}>{saving ? "Saving…" : isNew ? "Add" : "Save"}</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Delete confirm ── */}
      {confirmDel && (
        <div className="sv-modal-overlay" onClick={() => setConfirmDel(null)}>
          <div className="sv-modal" style={{ maxWidth: 380 }} onClick={(ev) => ev.stopPropagation()}>
            <div className="sv-modal-header">
              <span className="sv-text-navy sv-font-800" style={{ fontSize: 15 }}>Delete record?</span>
              <button className="sv-modal-close" onClick={() => setConfirmDel(null)}>×</button>
            </div>
            <div style={{ padding: "16px 20px", fontSize: 13.5, color: "#475569" }}>
              This permanently removes <strong>{confirmDel.title || confirmDel.clientName || "this record"}</strong>. This cannot be undone.
            </div>
            <div className="sv-flex sv-justify-between" style={{ padding: "12px 20px", borderTop: "1px solid #F1F5F9" }}>
              <button className="sv-btn sv-btn--ghost" onClick={() => setConfirmDel(null)}>Cancel</button>
              <button className="sv-btn sv-btn--danger" onClick={doDelete}>Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const lblS = { display: "flex", flexDirection: "column", gap: 6, fontSize: 12.5, fontWeight: 600, color: "#475569" };
