/**
 * AdminTabs.jsx
 * ─────────────────────────────────────────────────────────────
 * The Admin Portal's tab content components — Overview, Reports,
 * Leaderboard, Analytics, Departments, Leave Board, and Settings.
 * Moved here unchanged (behavior-wise) from the old monolithic
 * App.jsx as part of separating the Admin Portal into its own tree
 * under src/portals/admin. These are admin-only and are never
 * imported by the Employee Portal.
 */
import {
  PieChart, Pie, Cell, BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from "recharts";
import { ClickCard, Avatar } from "../../components/ui";
import { DeptCard } from "../../components/admin";
import {
  CHART_COLORS, TT, LEG, TICK, NAVY, BLUE, GREEN, ORANGE,
} from "../../utils/constants";
import { fmtDate, fmtCurr, sum, empLabel, humanizeKey } from "../../utils/helpers";

/* ───────────────────────────────────────────────────────────────
 * OverviewTab — KPI click-cards + period-filtered analytics charts
 * + today's submission grid + recent pending tasks.
 * ──────────────────────────────────────────────────────────────*/
export function OverviewTab({ empStats, todaySubs, employees, submissions, ovPeriod, setOvPeriod, ovDateFrom, setOvDateFrom, ovDateTo, setOvDateTo, ovPieData, ovBarData, openDM }) {
  const totalEmails = sum(todaySubs, "freshEmails") + sum(todaySubs, "reminderEmails");
  const totalSales = sum(todaySubs, "salesGenerated");
  const totalPayments = sum(todaySubs, "paymentReceived");
  const totalLeads = sum(todaySubs, "newLeadsInterested");
  const pendingList = submissions.filter((s) => s.status !== "Submitted").slice(-5).reverse();

  return (
    <div className="sv-tab">
      <h2 className="sv-tab-title">Overview</h2>
      <div className="sv-grid-4 sv-gap-md">
        <ClickCard label="Emails Sent" value={totalEmails} color={BLUE} onClick={() => openDM("emails")} />
        <ClickCard label="Sales Generated" value={fmtCurr(totalSales)} color={GREEN} onClick={() => openDM("sales")} />
        <ClickCard label="Payments Received" value={fmtCurr(totalPayments)} color={ORANGE} onClick={() => openDM("payments")} />
        <ClickCard label="New Leads" value={totalLeads} color={NAVY} onClick={() => openDM("leads")} />
      </div>

      <div className="sv-card" style={{ marginTop: 24 }}>
        <div className="sv-flex sv-flex--between">
          <h3>Analytics</h3>
          <div className="sv-flex sv-gap-sm">
            {["today", "week", "month", "custom"].map((p) => (
              <button key={p} className={`sv-btn sv-btn--sm ${ovPeriod === p ? "sv-btn--primary" : "sv-btn--outline"}`} onClick={() => setOvPeriod(p)}>
                {p[0].toUpperCase() + p.slice(1)}
              </button>
            ))}
          </div>
        </div>
        {ovPeriod === "custom" && (
          <div className="sv-flex sv-gap-sm" style={{ marginTop: 12 }}>
            <input className="sv-input" type="date" value={ovDateFrom} onChange={(e) => setOvDateFrom(e.target.value)} />
            <input className="sv-input" type="date" value={ovDateTo} onChange={(e) => setOvDateTo(e.target.value)} />
          </div>
        )}
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

      <div className="sv-grid-2 sv-gap-md" style={{ marginTop: 24 }}>
        <div className="sv-card">
          <h3>Today's Submission Status</h3>
          <div className="sv-grid-3 sv-gap-sm" style={{ marginTop: 12 }}>
            {empStats.map((e) => (
              <div key={e.id} className="sv-flex sv-gap-xs sv-flex--center">
                <span className={`sv-dot ${e.submittedToday ? "sv-dot--green" : "sv-dot--red"}`} />
                <span>{e.name}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="sv-card">
          <h3>Recent Pending Tasks</h3>
          <ul className="sv-list">
            {pendingList.length === 0 && <li className="sv-muted">Nothing pending. 🎉</li>}
            {pendingList.map((s) => (
              <li key={s.id}>{s.empName} — {fmtDate(s.date)} ({s.status})</li>
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
export function ReportsTab({ reportEmpSearch, setReportEmpSearch, reportDateFrom, setReportDateFrom, reportDateTo, setReportDateTo, rows, onView, onExport }) {
  return (
    <div className="sv-tab">
      <div className="sv-flex sv-flex--between">
        <h2 className="sv-tab-title">Reports</h2>
        <button className="sv-btn sv-btn--outline" onClick={onExport}>⬇️ Export CSV</button>
      </div>
      <div className="sv-flex sv-gap-sm" style={{ marginBottom: 16 }}>
        <input className="sv-input" placeholder="Search employee..." value={reportEmpSearch} onChange={(e) => setReportEmpSearch(e.target.value)} />
        <input className="sv-input" type="date" value={reportDateFrom} onChange={(e) => setReportDateFrom(e.target.value)} />
        <input className="sv-input" type="date" value={reportDateTo} onChange={(e) => setReportDateTo(e.target.value)} />
      </div>
      <table className="sv-table">
        <thead>
          <tr>
            <th>Employee</th><th>Attendance</th><th>Date</th><th>Status</th>
            <th>Emails</th><th>Leads</th><th>Calls</th><th>Sales</th><th>Hrs</th><th></th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id}>
              <td>{r.empName}</td><td>{r.attendance}</td><td>{fmtDate(r.date)}</td>
              <td><span className={`sv-badge sv-badge--${r.status?.toLowerCase()}`}>{r.status}</span></td>
              <td>{(Number(r.freshEmails) || 0) + (Number(r.reminderEmails) || 0)}</td>
              <td>{r.newLeadsInterested}</td><td>{r.callsScheduled}</td>
              <td>{fmtCurr(r.salesGenerated)}</td><td>{r.workingHours}</td>
              <td><button className="sv-btn sv-btn--sm sv-btn--outline" onClick={() => onView(r)}>View</button></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ───────────────────────────────────────────────────────────────
 * LeaderboardTab — ranked employees + target-vs-achievement bars.
 * ──────────────────────────────────────────────────────────────*/
export function LeaderboardTab({ empStats, targets, submissions }) {
  const ranked = [...empStats].sort((a, b) => b.totalSales - a.totalSales);
  const medals = ["🥇", "🥈", "🥉"];
  return (
    <div className="sv-tab">
      <h2 className="sv-tab-title">Leaderboard</h2>
      <ul className="sv-list">
        {ranked.map((e, i) => (
          <li key={e.id} className="sv-flex sv-flex--between sv-leaderboard-row">
            <span>{medals[i] || `#${i + 1}`} {e.name}</span>
            <span>{fmtCurr(e.totalSales)}</span>
          </li>
        ))}
      </ul>
      <h3 style={{ marginTop: 24 }}>7-Day Submission Tracker</h3>
      <div className="sv-grid-7 sv-gap-xs">
        {empStats.map((e) => {
          const days = Array.from({ length: 7 }, (_, i) => {
            const d = new Date(); d.setDate(d.getDate() - i);
            const ds = d.toISOString().split("T")[0];
            return submissions.some((s) => s.empId === e.id && s.date === ds && s.status === "Submitted");
          });
          return (
            <div key={e.id} className="sv-flex sv-gap-xs sv-flex--center">
              <span>{e.name}</span>
              {days.reverse().map((ok, i) => <span key={i} className={`sv-dot ${ok ? "sv-dot--green" : "sv-dot--red"}`} />)}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ───────────────────────────────────────────────────────────────
 * AnalyticsTab — four chart cards + full employee summary table.
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
        <thead><tr><th>Employee</th><th>Emails</th><th>Leads</th><th>Calls</th><th>Sales</th><th>Follow-ups</th></tr></thead>
        <tbody>
          {empStats.map((e) => (
            <tr key={e.id}><td>{e.name}</td><td>{e.totalEmails}</td><td>{e.totalLeads}</td><td>{e.totalCalls}</td><td>{fmtCurr(e.totalSales)}</td><td>{e.totalFollowUps}</td></tr>
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
            <span key={d} className="sv-chip">{d} <button onClick={() => removeDept(d)}>×</button></span>
          ))}
        </div>
      </div>

      <div className="sv-card" style={{ marginTop: 16 }}>
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

      <div className="sv-grid-2 sv-gap-md" style={{ marginTop: 16 }}>
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
 * LeaveBoardTab — approve/reject pending leave requests.
 * ──────────────────────────────────────────────────────────────*/
export function LeaveBoardTab({ leaves, setLeaveStatus }) {
  return (
    <div className="sv-tab">
      <h2 className="sv-tab-title">Leave Board</h2>
      <ul className="sv-list sv-leave-list">
        {leaves.length === 0 && <li className="sv-muted">No leave requests yet.</li>}
        {leaves.map((l) => (
          <li key={l.id} className="sv-leave-item sv-flex sv-flex--between">
            <span>
              <strong>{l.empName}</strong> — {fmtDate(l.fromDate)} → {fmtDate(l.toDate)}
              <span className="sv-muted"> ({l.reason})</span>
            </span>
            <span className="sv-flex sv-gap-xs">
              <span className={`sv-badge sv-badge--${l.status.toLowerCase()}`}>{l.status}</span>
              {l.status === "Pending" && (
                <>
                  <button className="sv-btn sv-btn--sm sv-btn--success" onClick={() => setLeaveStatus(l.id, "Approved")}>Approve</button>
                  <button className="sv-btn sv-btn--sm sv-btn--danger" onClick={() => setLeaveStatus(l.id, "Rejected")}>Reject</button>
                </>
              )}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ───────────────────────────────────────────────────────────────
 * SettingsTab — employee management, admin password, messaging,
 * targets, branding (logo), and website master list.
 * ──────────────────────────────────────────────────────────────*/
export function SettingsTab({ employees, setEmployees, newEmp, setNewEmp, addEmployeeQuick, adminPwd, setAdminPwd, msgEmpId, setMsgEmpId, msgText, setMsgText, sendMessage, messages, deleteMessage, targets, setTargets, logo, onLogoChange, onLogoRemove, websites, newWebsite, setNewWebsite, addWebsite, removeWebsite, pushNotification, showToast }) {
  const resetPwd = (id) => {
    setEmployees(employees.map((e) => (e.id === id ? { ...e, password: "1234" } : e)));
    pushNotification(`Password reset for ${employees.find((e) => e.id === id)?.name}.`);
    showToast("Password reset to 1234.", "success");
  };
  const removeEmployee = (id) => setEmployees(employees.filter((e) => e.id !== id));
  const updateEmpField = (id, field, val) => setEmployees(employees.map((e) => (e.id === id ? { ...e, [field]: val } : e)));

  const onLogoFile = (file) => {
    const reader = new FileReader();
    reader.onload = () => onLogoChange(reader.result);
    reader.readAsDataURL(file);
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
          <ul className="sv-list" style={{ marginTop: 12 }}>
            {employees.map((e) => (
              <li key={e.id} className="sv-emp-row">
                <div className="sv-flex sv-flex--between">
                  <span><Avatar name={e.name} photo={e.photo} size={28} /> {e.name} ({e.department})</span>
                  <button className="sv-btn sv-btn--sm sv-btn--danger" onClick={() => removeEmployee(e.id)}>Remove</button>
                </div>
                <div className="sv-grid-4 sv-gap-xs" style={{ marginTop: 6 }}>
                  <select className="sv-select" value={e.department} onChange={(ev) => updateEmpField(e.id, "department", ev.target.value)}>
                    <option>Sales</option><option>Operations</option>
                  </select>
                  <input className="sv-input" maxLength={4} value={e.code} onChange={(ev) => updateEmpField(e.id, "code", ev.target.value)} />
                  <input className="sv-input" value={e.teamLead || ""} placeholder="Team lead" onChange={(ev) => updateEmpField(e.id, "teamLead", ev.target.value)} />
                  <button className="sv-btn sv-btn--sm sv-btn--outline" onClick={() => resetPwd(e.id)}>Reset Pwd</button>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <div className="sv-card">
          <h3>Admin Security</h3>
          <label className="sv-label">🔑 Admin Password</label>
          <input className="sv-input" value={adminPwd} onChange={(e) => setAdminPwd(e.target.value)} />
        </div>

        <div className="sv-card">
          <h3>Message an Employee</h3>
          <select className="sv-select" value={msgEmpId} onChange={(e) => setMsgEmpId(e.target.value)}>
            <option value="">Select employee...</option>
            {employees.map((e) => <option key={e.id} value={e.id}>{empLabel(e)}</option>)}
          </select>
          <textarea className="sv-textarea" placeholder="Message..." value={msgText} onChange={(e) => setMsgText(e.target.value)} />
          <button className="sv-btn sv-btn--primary" onClick={sendMessage}>Send</button>
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
              <input className="sv-input" type="number" value={targets[k]} onChange={(e) => setTargets({ ...targets, [k]: Number(e.target.value) })} />
            </div>
          ))}
        </div>

        <div className="sv-card">
          <h3>Company Branding</h3>
          <div className="sv-logo-preview">
            {logo ? <img src={logo} alt="Logo" /> : <span>SV</span>}
          </div>
          <input type="file" accept="image/*" onChange={(e) => e.target.files[0] && onLogoFile(e.target.files[0])} />
          <button className="sv-btn sv-btn--sm sv-btn--outline" onClick={onLogoRemove}>Remove</button>
        </div>

        <div className="sv-card">
          <h3>Website Master List</h3>
          <div className="sv-flex sv-gap-sm">
            <input className="sv-input" placeholder="Website name" value={newWebsite} onChange={(e) => setNewWebsite(e.target.value)} />
            <button className="sv-btn sv-btn--primary" onClick={addWebsite}>Add</button>
          </div>
          <div className="sv-flex sv-gap-xs" style={{ marginTop: 12, flexWrap: "wrap" }}>
            {websites.map((w) => <span key={w} className="sv-chip">{w} <button onClick={() => removeWebsite(w)}>×</button></span>)}
          </div>
        </div>
      </div>
    </div>
  );
}
