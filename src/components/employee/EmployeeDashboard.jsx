import { useState } from "react";
import FormLabel from "./FormLabel.jsx";
import { Avatar } from "../ui/index.js";
import { getTodayStr, fmtDate, fmtDateTime, daysDiff, normAssignedId, parsePayslipPayload, stripPayslipPayload } from "../../utils/helpers.js";
import PayslipView from "../PayslipView.jsx";
import {
  blankLead, blankContractOrder, blankFollowup, blankCall, blankSale, blankPayment,
} from "../../utils/helpers.js";
import { ATTENDANCE, CURRENCIES, DOMAINS, BLUE } from "../../utils/constants.js";

const LOCAL_TZ = (() => {
  try { return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC"; }
  catch { return "UTC"; }
})();
const TZ_OPTIONS = Array.from(new Set([
  LOCAL_TZ,
  "Asia/Kolkata", "Asia/Karachi", "Asia/Dhaka", "Asia/Colombo",
  "Asia/Kathmandu", "Asia/Kabul", "Asia/Tashkent", "Asia/Almaty",
  "Asia/Dubai", "Asia/Muscat", "Asia/Riyadh", "Asia/Kuwait",
  "Asia/Baghdad", "Asia/Tehran", "Asia/Beirut", "Asia/Jerusalem",
  "Asia/Singapore", "Asia/Bangkok", "Asia/Jakarta", "Asia/Manila",
  "Asia/Kuala_Lumpur", "Asia/Hong_Kong", "Asia/Shanghai", "Asia/Tokyo",
  "Asia/Seoul", "Asia/Taipei", "Asia/Yangon",
  "Australia/Sydney", "Australia/Melbourne", "Australia/Brisbane",
  "Australia/Perth", "Australia/Adelaide", "Pacific/Auckland",
  "Pacific/Fiji", "Pacific/Honolulu", "Pacific/Guam",
  "Europe/London", "Europe/Dublin", "Europe/Lisbon",
  "Europe/Paris", "Europe/Berlin", "Europe/Rome", "Europe/Madrid",
  "Europe/Amsterdam", "Europe/Brussels", "Europe/Zurich",
  "Europe/Stockholm", "Europe/Oslo", "Europe/Copenhagen",
  "Europe/Helsinki", "Europe/Warsaw", "Europe/Prague",
  "Europe/Budapest", "Europe/Bucharest", "Europe/Athens",
  "Europe/Istanbul", "Europe/Moscow", "Europe/Kiev",
  "Africa/Cairo", "Africa/Nairobi", "Africa/Lagos",
  "Africa/Johannesburg", "Africa/Casablanca", "Africa/Accra",
  "America/New_York", "America/Chicago", "America/Denver",
  "America/Los_Angeles", "America/Phoenix", "America/Anchorage",
  "America/Toronto", "America/Vancouver", "America/Montreal",
  "America/Mexico_City", "America/Bogota", "America/Lima",
  "America/Santiago", "America/Sao_Paulo", "America/Buenos_Aires",
  "America/Caracas", "America/Halifax",
  "UTC",
]));

export default function EmployeeDashboard({
  emp, empTab, setEmpTab, dsrDate, dsrForm, setDsrForm, onDateChange, onSave,
  submissions, websites, onLogout, histSearch, setHistSearch, viewingDsr, setViewingDsr,
  customFields = [], announcements = [], onDismissAnn, myMessages = [], onDismissMsg,
  theme = "light", onToggleTheme, leaves = [], leaveForm, setLeaveForm, onApplyLeave,
  onUpdatePhoto, employees = [], logo = "", onSaveAssignedIds,
}) {
  const today = getTodayStr();
  const dark = theme === "dark";
  const [viewingPayslip, setViewingPayslip] = useState(null);
  const cardClass = dark ? "sv-card sv-dark" : "sv-card";

  /* Employee-owned fields on their assigned mail IDs (project + start date).
     The admin still owns which IDs exist; this only fills in the details. */
  const saveMyId = (targetId, field, value) => {
    if (!onSaveAssignedIds) return;
    const next = (emp.assignedIds || []).map(normAssignedId)
      .map((r) => (r.id === targetId ? { ...r, [field]: value } : r));
    onSaveAssignedIds(next);
  };
  const myReports = submissions.filter((s) => s.empId === emp.id).sort((a, b) => b.date.localeCompare(a.date));
  const filteredHist = histSearch ? myReports.filter((r) => r.date === histSearch) : myReports;
  const existingForDate = submissions.find((s) => s.empId === emp.id && s.date === dsrDate);
  const locked = dsrDate !== today && daysDiff(dsrDate) > 2;
  const isOps = emp.department === "Operations";
  const isSales = emp.department === "Sales";
  const richDept = isSales || isOps;

  const teamLeadObj = emp.teamLead ? employees.find((e) => e.id === emp.teamLead || e.name === emp.teamLead) : null;
  const teamLeadName = teamLeadObj ? teamLeadObj.name : emp.teamLead || "—";

  const addRow = (key, factory) => setDsrForm({ ...dsrForm, [key]: [...(dsrForm[key] || []), factory()] });
  const setNA = (key) => setDsrForm({ ...dsrForm, [key]: [] });
  const updateRow = (key, i, field, val) =>
    setDsrForm({ ...dsrForm, [key]: dsrForm[key].map((r, idx) => (idx === i ? { ...r, [field]: val } : r)) });
  const removeRow = (key, i) =>
    setDsrForm({ ...dsrForm, [key]: dsrForm[key].filter((_, idx) => idx !== i) });

  const setWebsiteRow = (i, key, val) => {
    const ws = dsrForm.websites.map((w, idx) => (idx === i ? { ...w, [key]: val } : w));
    setDsrForm({ ...dsrForm, websites: ws });
  };
  const addWebsiteRow = () => setDsrForm({ ...dsrForm, websites: [...dsrForm.websites, { name: "", description: "" }] });
  const removeWebsiteRow = (i) => setDsrForm({ ...dsrForm, websites: dsrForm.websites.filter((_, idx) => idx !== i) });
  const setCustomVal = (id, val) => setDsrForm({ ...dsrForm, customFields: { ...dsrForm.customFields, [id]: val } });

  const badgeClass = (status) => `sv-badge sv-badge--${String(status).toLowerCase().replace(/\s+/g, "-")}`;
  const attendance = dsrForm.attendance || "Present";
  const showFields = attendance !== "Absent";

  function backdateMin() {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().split("T")[0];
  }

  const payslipMessages = myMessages.filter((m) => m.text?.toLowerCase().includes("payslip"));
  const newPayslips = payslipMessages.filter((m) => !m.dismissed);
  const adminMessages = myMessages.filter((m) => !m.text?.toLowerCase().includes("payslip") && !m.dismissed);

  return (
    <div>
      {announcements.map((a) => (
        <div key={a.id} className="sv-flex sv-justify-between sv-items-center" style={{ gap: 10, padding: "12px 16px", background: "#DC2626", color: "#fff", borderRadius: 10, marginBottom: 10, fontWeight: 800, fontSize: 14, boxShadow: "0 4px 14px rgba(220,38,38,0.35)" }}>
          <span>📢 {a.text}</span>
          <button onClick={() => onDismissAnn?.(a.id)} style={{ border: "none", background: "rgba(255,255,255,0.2)", color: "#fff", borderRadius: 6, cursor: "pointer", fontWeight: 700, padding: "2px 9px", flexShrink: 0 }}>×</button>
        </div>
      ))}

      {newPayslips.map((m) => (
        <div key={m.id} style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "11px 16px", background: dark ? "#14532D" : "#F0FDF4", border: "1.5px solid #16A34A", borderRadius: 10, marginBottom: 10 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#16A34A", marginBottom: 2 }}>📄 Payslip from Admin</div>
            <div style={{ fontSize: 13.5, color: dark ? "#A7F3D0" : "#15803D", fontWeight: 600 }}>{stripPayslipPayload(m.text)}</div>
            <div className="sv-flex sv-gap-2" style={{ marginTop: 8, flexWrap: "wrap" }}>
              {parsePayslipPayload(m.text) && <button onClick={() => setViewingPayslip(parsePayslipPayload(m.text))} style={{ padding: "5px 14px", background: "#16A34A", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", fontWeight: 700, fontSize: 12 }}>👁️ View Payslip</button>}
              <button onClick={async () => { const { generatePayslipPDF } = await import("../../utils/generatePayslipPDF.js"); await generatePayslipPDF({ employee: emp, message: m.text, logo }); }} style={{ padding: "5px 14px", background: "#fff", color: "#16A34A", border: "1.5px solid #16A34A", borderRadius: 6, cursor: "pointer", fontWeight: 700, fontSize: 12 }}>⬇️ Download PDF</button>
            </div>
          </div>
          <button onClick={() => onDismissMsg?.(m.id)} title="Dismiss — payslip saved in History tab" style={{ border: "none", background: "transparent", color: "#16A34A", cursor: "pointer", fontWeight: 700, fontSize: 16, flexShrink: 0 }}>×</button>
        </div>
      ))}

      {adminMessages.map((m) => (
        <div key={m.id} className="sv-flex sv-justify-between" style={{ alignItems: "flex-start", gap: 10, padding: "11px 16px", background: dark ? "#1E3A8A" : "#EFF6FF", border: `1.5px solid ${BLUE}`, borderRadius: 10, marginBottom: 10 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: BLUE, marginBottom: 2 }}>✉️ Message from Admin</div>
            <div style={{ fontSize: 13.5, color: dark ? "#E2E8F0" : "#1E293B", fontWeight: 600 }}>{m.text}</div>
          </div>
          <button onClick={() => onDismissMsg?.(m.id)} style={{ border: "none", background: "transparent", color: BLUE, cursor: "pointer", fontWeight: 700, fontSize: 16, flexShrink: 0 }}>×</button>
        </div>
      ))}

      <div className="sv-welcome-card">
        <div className="sv-welcome-main">
          <Avatar emp={emp} size={56} />
          <div>
            <h1 className="sv-welcome-title">Welcome back, {emp.name.split(" ")[0]} 👋</h1>
            <p className="sv-welcome-msg">Please submit your Daily Status Report for today.</p>
          </div>
        </div>
        <div className="sv-welcome-meta">
          <div><span className="sv-welcome-meta-k">Department</span><span className="sv-welcome-meta-v">{emp.department || "—"}</span></div>
          <div><span className="sv-welcome-meta-k">Email</span><span className="sv-welcome-meta-v">{emp.email || "—"}</span></div>
          <div><span className="sv-welcome-meta-k">Team Lead</span><span className="sv-welcome-meta-v">{teamLeadName}</span></div>
          <div><span className="sv-welcome-meta-k">Today</span><span className="sv-welcome-meta-v">{new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}</span></div>
        </div>
      </div>

      {empTab === "form" && (
        <div className={cardClass} style={{ marginTop: 14 }}>
          <div className="sv-flex sv-justify-between sv-items-center" style={{ marginBottom: 14, flexWrap: "wrap", gap: 8 }}>
            <div className="sv-flex sv-items-center sv-gap-3">
              <p className={dark ? "sv-text-white sv-font-700" : "sv-text-navy sv-font-700"} style={{ margin: 0, fontSize: 15 }}>{emp.department} DSR — {fmtDate(dsrDate)}</p>
              {existingForDate && <span className={badgeClass(existingForDate.status === "Submitted" ? "Completed" : "Pending")}>{existingForDate.status}</span>}
            </div>
            <input type="date" className="sv-input" value={dsrDate} max={today} onChange={(e) => onDateChange(e.target.value)} style={{ width: 160 }} />
          </div>

          {locked && (
            <div style={{ marginBottom: 14, padding: 10, background: "#FEF3C7", border: "1.5px solid #FDE68A", borderRadius: 8, fontSize: 13, color: "#92400E", fontWeight: 600 }}>
              🔒 This report is older than 2 days and is locked. Read-only view.
            </div>
          )}

          <fieldset disabled={locked} style={{ border: "none", padding: 0, margin: 0 }}>
            <FormLabel text="🗓️ Attendance Status *" />
            <div className="sv-flex sv-gap-2" style={{ flexWrap: "wrap", marginBottom: 18 }}>
              {ATTENDANCE.map((a) => (
                <button key={a} type="button" disabled={locked} onClick={() => setDsrForm({ ...dsrForm, attendance: a })}
                  style={{ padding: "8px 18px", borderRadius: 8, border: `1.5px solid ${attendance === a ? BLUE : "var(--border-input)"}`, background: attendance === a ? "#E6F6F6" : "#fff", color: attendance === a ? "#0E8A8A" : "#475569", fontWeight: 700, fontSize: 13, cursor: locked ? "default" : "pointer" }}>
                  {a}
                </button>
              ))}
            </div>

            {attendance === "Absent" && (
              <div style={{ padding: "14px 16px", background: dark ? "#3F1D1D" : "#FEF2F2", border: "1.5px solid #FECACA", borderRadius: 10, fontSize: 13.5, color: dark ? "#FCA5A5" : "#B91C1C", fontWeight: 600, marginBottom: 4 }}>
                Marked <b>Absent</b> for {fmtDate(dsrDate)}. No activity fields are required — just submit.
              </div>
            )}

            {showFields && richDept && (
              <div className="sv-grid-2">
                <div>
                  <FormLabel text="📧 Fresh Emails Sent" />
                  <input type="number" min="0" disabled={locked} placeholder="0" className="sv-input" value={dsrForm.freshEmails} onChange={(e) => setDsrForm({ ...dsrForm, freshEmails: e.target.value })} />
                </div>
                <div>
                  <FormLabel text="📨 Reminder Emails Sent" />
                  <input type="number" min="0" disabled={locked} placeholder="0" className="sv-input" value={dsrForm.reminderEmails} onChange={(e) => setDsrForm({ ...dsrForm, reminderEmails: e.target.value })} />
                </div>

                <RepeatSection dsrForm={dsrForm} locked={locked} setNA={setNA} addRow={addRow} updateRow={updateRow} removeRow={removeRow}
                  label="🎯 New Leads / Interested" fieldKey="leads" factory={blankLead}
                  gridCols="1.4fr 0.8fr 1fr 0.9fr auto"
                  columns={[{ field: "clientName", type: "text", placeholder: "Client name" }, { field: "price", type: "number", placeholder: "Price" }, { field: "idName", type: "text", placeholder: "ID name" }, { field: "domain", type: "select", options: DOMAINS }]}
                />
                <RepeatSection dsrForm={dsrForm} locked={locked} setNA={setNA} addRow={addRow} updateRow={updateRow} removeRow={removeRow}
                  label="🧾 Contract Order Sent" fieldKey="contractOrders" factory={blankContractOrder}
                  gridCols="1.4fr 0.8fr 1fr 0.9fr auto"
                  columns={[{ field: "clientName", type: "text", placeholder: "Client name" }, { field: "price", type: "number", placeholder: "Price" }, { field: "idName", type: "text", placeholder: "ID name" }, { field: "domain", type: "select", options: DOMAINS }]}
                />
                <RepeatSection dsrForm={dsrForm} locked={locked} setNA={setNA} addRow={addRow} updateRow={updateRow} removeRow={removeRow}
                  label="🤝 Client Follow-ups" fieldKey="followups" factory={blankFollowup}
                  gridCols="1.6fr 1fr auto"
                  columns={[{ field: "clientName", type: "text", placeholder: "Client name" }, { field: "domain", type: "select", options: DOMAINS }]}
                />
                <RepeatSection dsrForm={dsrForm} locked={locked} setNA={setNA} addRow={addRow} updateRow={updateRow} removeRow={removeRow}
                  label="📞 Scheduled Calls" fieldKey="calls" factory={blankCall}
                  gridCols="1.3fr 1fr 0.9fr 0.9fr 1.1fr auto"
                  columns={[{ field: "clientName", type: "text", placeholder: "Client name" }, { field: "idName", type: "text", placeholder: "ID name" }, { field: "domain", type: "select", options: DOMAINS }, { field: "time", type: "time" }, { field: "tz", type: "select", options: TZ_OPTIONS }]}
                />

                <div>
                  <FormLabel text="⏱️ Working Hours" />
                  <input type="number" min="0" step="0.5" disabled={locked} placeholder="0" className="sv-input" value={dsrForm.workingHours} onChange={(e) => setDsrForm({ ...dsrForm, workingHours: e.target.value })} />
                </div>
                <div />

                <RepeatSection dsrForm={dsrForm} locked={locked} setNA={setNA} addRow={addRow} updateRow={updateRow} removeRow={removeRow}
                  label="💰 Sales Generated" fieldKey="sales" factory={blankSale}
                  gridCols="1fr 0.9fr 1.2fr auto"
                  columns={[{ field: "amount", type: "number", placeholder: "Amount" }, { field: "currency", type: "select", options: CURRENCIES }, { field: "idName", type: "text", placeholder: "ID name" }]}
                />
                <RepeatSection dsrForm={dsrForm} locked={locked} setNA={setNA} addRow={addRow} updateRow={updateRow} removeRow={removeRow}
                  label="💵 Payment Received" fieldKey="payments" factory={blankPayment}
                  gridCols="1fr 0.9fr 1.2fr auto"
                  columns={[{ field: "amount", type: "number", placeholder: "Amount" }, { field: "currency", type: "select", options: CURRENCIES }, { field: "idName", type: "text", placeholder: "ID name" }]}
                />

                {isOps && (
                  <div style={{ gridColumn: "1/-1" }}>
                    <FormLabel text="🌐 Website Work" />
                    {dsrForm.websites.map((w, i) => (
                      <div key={i} style={{ display: "grid", gridTemplateColumns: "1fr 2fr auto", gap: 8, marginBottom: 8, alignItems: "start" }}>
                        <select disabled={locked} className="sv-select" value={w.name} onChange={(e) => setWebsiteRow(i, "name", e.target.value)}>
                          <option value="">-- Select Website --</option>
                          {websites.map((wn) => <option key={wn} value={wn}>{wn}</option>)}
                        </select>
                        <textarea rows={2} disabled={locked} maxLength={2000} className="sv-textarea" value={w.description} onChange={(e) => setWebsiteRow(i, "description", e.target.value)} placeholder="Work description…" />
                        {dsrForm.websites.length > 1 && !locked && <button onClick={() => removeWebsiteRow(i)} className="sv-row-remove">✕</button>}
                      </div>
                    ))}
                    {!locked && <button type="button" onClick={addWebsiteRow} className="sv-pill sv-pill--add" style={{ marginTop: 2 }}>+ Add Another Website</button>}
                  </div>
                )}

                <div style={{ gridColumn: "1/-1" }}>
                  <FormLabel text="📌 Pending Tasks * (max 1000 chars)" />
                  <textarea rows={3} maxLength={1000} disabled={locked} className="sv-textarea" value={dsrForm.pendingTasks} onChange={(e) => setDsrForm({ ...dsrForm, pendingTasks: e.target.value })} placeholder="Describe here…" />
                  <div className="sv-text-muted" style={{ textAlign: "right", fontSize: 11 }}>{(dsrForm.pendingTasks || "").length}/1000</div>
                </div>
                <div style={{ gridColumn: "1/-1" }}>
                  <FormLabel text={`📣 Updates for ${teamLeadName} (max 1000 chars)`} />
                  <textarea rows={3} maxLength={1000} disabled={locked} className="sv-textarea" value={dsrForm.updatesForTeamLead} onChange={(e) => setDsrForm({ ...dsrForm, updatesForTeamLead: e.target.value })} placeholder="Describe here…" />
                  <div className="sv-text-muted" style={{ textAlign: "right", fontSize: 11 }}>{(dsrForm.updatesForTeamLead || "").length}/1000</div>
                </div>
              </div>
            )}

            {showFields && !richDept && (
              <div>
                <div style={{ marginBottom: 14 }}>
                  <FormLabel text="📌 Pending Tasks * (max 1000 chars)" />
                  <textarea rows={3} maxLength={1000} disabled={locked} className="sv-textarea" value={dsrForm.pendingTasks} onChange={(e) => setDsrForm({ ...dsrForm, pendingTasks: e.target.value })} placeholder="Describe here…" />
                </div>
                <div style={{ marginBottom: 14 }}>
                  <FormLabel text={`📣 Updates for ${teamLeadName} (max 1000 chars)`} />
                  <textarea rows={3} maxLength={1000} disabled={locked} className="sv-textarea" value={dsrForm.updatesForTeamLead} onChange={(e) => setDsrForm({ ...dsrForm, updatesForTeamLead: e.target.value })} placeholder="Describe here…" />
                </div>
              </div>
            )}

            {showFields && customFields.length > 0 && (
              <div style={{ marginTop: 4, marginBottom: 14, paddingTop: 14, borderTop: "1.5px dashed var(--border-light)" }}>
                <div className="sv-grid-2">
                  {customFields.map((f) => (
                    <div key={f.id} style={{ gridColumn: f.type === "textarea" ? "1/-1" : "auto" }}>
                      <FormLabel text={`${f.label}${f.required ? " *" : ""}`} />
                      {f.type === "textarea" ? (
                        <textarea rows={3} disabled={locked} className="sv-textarea" value={dsrForm.customFields?.[f.id] || ""} onChange={(e) => setCustomVal(f.id, e.target.value)} placeholder="Describe here…" />
                      ) : (
                        <input type={f.type === "number" ? "number" : "text"} disabled={locked} className="sv-input" value={dsrForm.customFields?.[f.id] || ""} onChange={(e) => setCustomVal(f.id, e.target.value)} />
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </fieldset>

          {!locked && (
            <div className="sv-flex" style={{ marginTop: 18 }}>
              <button className="sv-btn sv-btn--primary sv-btn--full" onClick={() => onSave("Submitted")}>🚀 Submit DSR</button>
            </div>
          )}
        </div>
      )}

      {empTab === "history" && (
        <>
          <div className={cardClass} style={{ marginTop: 14 }}>
            <div className="sv-flex sv-justify-between sv-items-center" style={{ marginBottom: 14, flexWrap: "wrap", gap: 8 }}>
              <p className={dark ? "sv-text-white sv-font-700" : "sv-text-navy sv-font-700"} style={{ margin: 0, fontSize: 15 }}>📂 My DSR History</p>
              <div className="sv-flex sv-gap-2">
                <input type="date" className="sv-input" value={histSearch} max={today} onChange={(e) => setHistSearch(e.target.value)} style={{ width: 160 }} />
                {histSearch && <button onClick={() => setHistSearch("")} style={{ padding: "6px 10px", background: "var(--bg-muted)", border: "none", borderRadius: 7, cursor: "pointer", fontSize: 12, fontWeight: 700 }}>Clear</button>}
              </div>
            </div>
            <div className="sv-flex-col sv-gap-2">
              {filteredHist.length === 0 && <p className="sv-text-muted" style={{ fontSize: 13 }}>No reports found.</p>}
              {filteredHist.map((r) => (
                <div key={r.id} className="sv-flex sv-items-center sv-gap-3" style={{ padding: "10px 12px", background: "var(--bg-muted)", border: "1.5px solid var(--border-light)", borderRadius: 8, flexWrap: "wrap" }}>
                  <div className="sv-text-navy sv-font-700" style={{ minWidth: 96, fontSize: 13 }}>{fmtDate(r.date)}{r.ts ? <span className="sv-text-muted" style={{ display: "block", fontSize: 11, fontWeight: 400 }}>{fmtDateTime(r.ts)}</span> : null}</div>
                  <span className={badgeClass(r.attendance === "Present" ? "Completed" : r.attendance === "Absent" ? "Pending" : "In Progress")}>{r.attendance}</span>
                  <span className={badgeClass(r.status === "Submitted" ? "Completed" : "Pending")}>{r.status}</span>
                  <div className="sv-flex sv-gap-2" style={{ marginLeft: "auto" }}>
                    <button onClick={() => setViewingDsr(r)} style={{ padding: "5px 12px", borderRadius: 7, border: `1.5px solid ${BLUE}`, background: "#fff", color: BLUE, cursor: "pointer", fontSize: 12, fontWeight: 700 }}>View</button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className={cardClass} style={{ marginTop: 14 }}>
            <p className={dark ? "sv-text-white sv-font-700" : "sv-text-navy sv-font-700"} style={{ margin: "0 0 14px", fontSize: 15 }}>💰 My Payslips</p>
            <div className="sv-flex-col sv-gap-2">
              {payslipMessages.length === 0 && <p className="sv-text-muted" style={{ fontSize: 13 }}>No payslips received yet.</p>}
              {payslipMessages.map((m) => {
                const payload = parsePayslipPayload(m.text);
                const dateMatch = m.text.match(/\((\d{4}-\d{2}-\d{2})\)/);
                const payDate = payload?.date || (dateMatch ? dateMatch[1] : new Date(m.ts).toISOString().slice(0, 10));
                const label = payload ? `${payload.month} ${payload.year}` : new Date(payDate).toLocaleDateString("en-IN", { day: "2-digit", month: "long", year: "numeric" });
                return (
                  <div key={m.id} style={{ padding: "12px 14px", background: dark ? "#14532D" : "#F0FDF4", border: "1.5px solid #16A34A", borderRadius: 10, display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                    <div style={{ fontSize: 22 }}>📄</div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: "#16A34A", marginBottom: 2 }}>Payslip — {label}</div>
                      <div style={{ fontSize: 12, color: dark ? "#A7F3D0" : "#15803D" }}>{stripPayslipPayload(m.text)}</div>
                    </div>
                    <div className="sv-flex sv-gap-2" style={{ flexWrap: "wrap" }}>
                      {payload && <button onClick={() => setViewingPayslip(payload)} style={{ padding: "7px 14px", background: "#16A34A", color: "#fff", border: "none", borderRadius: 7, cursor: "pointer", fontWeight: 700, fontSize: 12, whiteSpace: "nowrap" }}>👁️ View</button>}
                      <button onClick={async () => { const { generatePayslipPDF } = await import("../../utils/generatePayslipPDF.js"); await generatePayslipPDF({ employee: emp, message: m.text, logo }); }} style={{ padding: "7px 14px", background: "#fff", color: "#16A34A", border: "1.5px solid #16A34A", borderRadius: 7, cursor: "pointer", fontWeight: 700, fontSize: 12, whiteSpace: "nowrap" }}>⬇️ Download PDF</button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}

      {empTab === "leave" && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1.3fr", gap: 14, marginTop: 14 }}>
          <div className={cardClass}>
            <p className={dark ? "sv-text-white sv-font-700" : "sv-text-navy sv-font-700"} style={{ margin: "0 0 4px", fontSize: 15 }}>🏖️ Apply for Leave</p>
            <p className="sv-text-muted" style={{ margin: "0 0 14px", fontSize: 11.5 }}>You can back-date a leave request up to 30 days.</p>
            <FormLabel text="From Date" />
            <input type="date" className="sv-input" value={leaveForm.fromDate} min={backdateMin()} onChange={(e) => setLeaveForm({ ...leaveForm, fromDate: e.target.value })} style={{ marginBottom: 12 }} />
            <FormLabel text="To Date" />
            <input type="date" className="sv-input" value={leaveForm.toDate} min={leaveForm.fromDate || backdateMin()} onChange={(e) => setLeaveForm({ ...leaveForm, toDate: e.target.value })} style={{ marginBottom: 12 }} />
            <FormLabel text="Reason" />
            <textarea rows={3} className="sv-textarea" value={leaveForm.reason} onChange={(e) => setLeaveForm({ ...leaveForm, reason: e.target.value })} placeholder="Reason for leave…" style={{ marginBottom: 14 }} />
            <button className="sv-btn sv-btn--primary sv-btn--full" onClick={onApplyLeave}>📨 Submit Leave Application</button>
          </div>
          <div className={cardClass}>
            <p className={dark ? "sv-text-white sv-font-700" : "sv-text-navy sv-font-700"} style={{ margin: "0 0 14px", fontSize: 15 }}>📋 My Leave Applications</p>
            <div className="sv-flex-col sv-gap-2">
              {leaves.length === 0 && <p className="sv-text-muted" style={{ fontSize: 13 }}>No leave applications yet.</p>}
              {leaves.map((l) => (
                <div key={l.id} className="sv-flex sv-items-center sv-gap-3" style={{ padding: "10px 12px", background: dark ? "#1E293B" : "var(--bg-muted)", border: `1.5px solid ${dark ? "#334155" : "var(--border-light)"}`, borderRadius: 8, flexWrap: "wrap" }}>
                  <div className="sv-font-700" style={{ fontSize: 12.5 }}>{fmtDate(l.fromDate)} → {fmtDate(l.toDate)}</div>
                  <div className="sv-text-muted" style={{ fontSize: 12, flex: 1, minWidth: 120 }}>{l.reason}{l.remark ? ` · Note: ${l.remark}` : ""}</div>
                  {l.status === "Pending" ? <span className="sv-badge sv-badge--pending">⏳ Waiting for Manager Approval</span> : <span className={badgeClass(l.status === "Approved" ? "Approved" : "Rejected")}>{l.status}</span>}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {empTab === "settings" && (
        <div className={cardClass} style={{ marginTop: 14 }}>
          <p className={dark ? "sv-text-white sv-font-700" : "sv-text-navy sv-font-700"} style={{ margin: "0 0 4px", fontSize: 15 }}>⚙️ My Profile Settings</p>
          <p className="sv-text-muted" style={{ margin: "0 0 16px", fontSize: 12 }}>Update your profile picture. Name, Employee ID and Team Lead are managed by your admin.</p>
          <div className="sv-flex sv-items-center sv-gap-4" style={{ flexWrap: "wrap" }}>
            <Avatar emp={emp} size={72} />
            <div className="sv-flex-col sv-gap-2">
              <label style={{ padding: "9px 16px", background: "#1D4ED8", color: "#fff", borderRadius: 8, cursor: "pointer", fontWeight: 700, fontSize: 13, textAlign: "center" }}>
                📷 Upload Photo
                <input type="file" accept="image/*" style={{ display: "none" }} onChange={(ev) => {
                  const file = ev.target.files?.[0]; if (!file) return;
                  const reader = new FileReader();
                  reader.onload = () => onUpdatePhoto?.(reader.result);
                  reader.readAsDataURL(file);
                }} />
              </label>
              {emp.photo && <button onClick={() => onUpdatePhoto?.("")} style={{ padding: "7px 16px", background: "#FEE2E2", color: "#DC2626", border: "none", borderRadius: 7, cursor: "pointer", fontSize: 12, fontWeight: 700 }}>Remove Photo</button>}
            </div>
          </div>
          <div className="sv-grid-2" style={{ marginTop: 20 }}>
            <div className="sv-meta-cell"><div className="sv-meta-label">Name</div><div className="sv-meta-value">{emp.name}</div></div>
            <div className="sv-meta-cell"><div className="sv-meta-label">Employee ID</div><div className="sv-meta-value">{emp.id}</div></div>
            <div className="sv-meta-cell"><div className="sv-meta-label">Team Lead</div><div className="sv-meta-value">{teamLeadName}</div></div>
            <div className="sv-meta-cell"><div className="sv-meta-label">Email</div><div className="sv-meta-value">{emp.email || "—"}</div></div>
          </div>
          <ChangePasswordSection empId={emp.id} dark={dark} />
        </div>
      )}

      {empTab === "assigned" && (
        <div className={cardClass} style={{ marginTop: 14 }}>
          <p className={dark ? "sv-text-white sv-font-700" : "sv-text-navy sv-font-700"} style={{ margin: "0 0 4px", fontSize: 15 }}>🆔 My Assigned IDs</p>
          <p className="sv-text-muted" style={{ margin: "0 0 14px", fontSize: 12 }}>
            Your admin assigns the mail IDs. Add the <b>project name</b> and the <b>date the project starts</b> next to each ID — your admin can then see what is running on it.
          </p>
          {(emp.assignedIds || []).length === 0 ? (
            <p className="sv-text-muted" style={{ fontSize: 13 }}>No IDs assigned yet.</p>
          ) : (
            <div className="sv-myid-list">
              <div className="sv-myid-head">
                <span>Mail ID</span><span>Project name</span><span>Project start date</span>
              </div>
              {(emp.assignedIds || []).map(normAssignedId).map((r) => (
                <div key={r.id} className="sv-myid-row">
                  <span className="sv-myid-id" title={r.id}>{r.id}</span>
                  <input
                    className="sv-input sv-myid-input"
                    placeholder="Project name"
                    defaultValue={r.project}
                    onBlur={(e) => saveMyId(r.id, "project", e.target.value)}
                  />
                  <input
                    type="date"
                    className="sv-input sv-myid-input"
                    defaultValue={r.startDate}
                    onChange={(e) => saveMyId(r.id, "startDate", e.target.value)}
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {viewingDsr && (
        <div className="sv-modal-overlay" onClick={() => setViewingDsr(null)}>
          <div className="sv-modal" style={{ maxWidth: 600 }} onClick={(e) => e.stopPropagation()}>
            <div className="sv-modal-header">
              <p className="sv-text-navy sv-font-800" style={{ margin: 0, fontSize: 16 }}>{viewingDsr.department} DSR — {fmtDate(viewingDsr.date)}{viewingDsr.ts ? ` · Submitted ${fmtDateTime(viewingDsr.ts)}` : ""}</p>
              <button onClick={() => setViewingDsr(null)} className="sv-modal-close">×</button>
            </div>
            <div className="sv-modal-body">
              <p style={{ fontSize: 13.5 }}><b>Attendance:</b> {viewingDsr.attendance} &nbsp; <b>Status:</b> {viewingDsr.status}</p>
              {viewingDsr.attendance === "Absent" ? (
                <p className="sv-text-muted" style={{ fontSize: 13.5 }}>Marked absent — no activity recorded.</p>
              ) : (
                <>
                  <p style={{ fontSize: 13.5 }}><b>Fresh Emails:</b> {viewingDsr.freshEmails || 0} &nbsp; <b>Reminder Emails:</b> {viewingDsr.reminderEmails || 0} &nbsp; <b>Hours:</b> {viewingDsr.workingHours || 0}</p>
                  <DsrRows title="🎯 New Leads / Interested" rows={viewingDsr.leads} render={(r) => `${r.clientName || "—"} · ${r.idName || "—"} · ${r.domain_custom || r.domain || "—"}${r.price ? ` · ${r.price}` : ""}`} />
                  <DsrRows title="🧾 Contract Order Sent" rows={viewingDsr.contractOrders} render={(r) => `${r.clientName || "—"} · ${r.idName || "—"} · ${r.domain_custom || r.domain || "—"}${r.price ? ` · ${r.price}` : ""}`} />
                  <DsrRows title="🤝 Follow-ups" rows={viewingDsr.followups} render={(r) => `${r.clientName || "—"} · ${r.domain_custom || r.domain || "—"}`} />
                  <DsrRows title="📞 Scheduled Calls" rows={viewingDsr.calls} render={(r) => `${r.clientName || "—"} · ${r.idName || "—"} · ${r.domain_custom || r.domain || "—"} · ${r.time || "—"}${r.tz ? ` (${r.tz})` : ""}`} />
                  <DsrRows title="💰 Sales" rows={viewingDsr.sales} render={(r) => `${r.amount || 0} ${r.currency || ""} · ${r.idName || "—"}`} />
                  <DsrRows title="💵 Payments" rows={viewingDsr.payments} render={(r) => `${r.amount || 0} ${r.currency || ""} · ${r.idName || "—"}`} />
                  {(viewingDsr.websitesData || []).length > 0 && <DsrRows title="🌐 Website Work" rows={viewingDsr.websitesData} render={(w) => `${w.name || "—"}: ${w.description || ""}`} />}
                  <p style={{ fontSize: 13.5 }}><b>Pending Tasks:</b> {viewingDsr.pendingTasks || "—"}</p>
                  <p style={{ fontSize: 13.5 }}><b>Updates for Team Lead:</b> {viewingDsr.updatesForTeamLead || "—"}</p>
                </>
              )}
            </div>
          </div>
        </div>
      )}
      {viewingPayslip && (
        <div className="sv-modal-overlay" onClick={() => setViewingPayslip(null)}>
          <div className="sv-modal" style={{ maxWidth: 580, maxHeight: "88vh", display: "flex", flexDirection: "column" }} onClick={(e) => e.stopPropagation()}>
            <div className="sv-modal-header" style={{ flexShrink: 0 }}>
              <span className="sv-text-navy sv-font-800" style={{ fontSize: 15 }}>Payslip — {viewingPayslip.month} {viewingPayslip.year}</span>
              <button onClick={() => setViewingPayslip(null)} className="sv-modal-close">×</button>
            </div>
            <div className="sv-modal-body" style={{ overflowY: "auto", background: "#F1F5F9" }}>
              <PayslipView payload={viewingPayslip} employee={emp} logo={logo} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ChangePasswordSection({ empId, dark }) {
  const [open, setOpen] = useState(false);
  const [current, setCurrent] = useState("");
  const [newPwd, setNewPwd] = useState("");
  const [confirm, setConfirm] = useState("");
  const [msg, setMsg] = useState("");
  const [saving, setSaving] = useState(false);

  const handleChange = async () => {
    setMsg("");
    if (!current.trim() || !newPwd.trim() || !confirm.trim()) { setMsg("Please fill in all fields."); return; }
    if (newPwd !== confirm) { setMsg("New passwords don't match."); return; }
    if (newPwd.length < 4) { setMsg("Password must be at least 4 characters."); return; }
    setSaving(true);
    try {
      const { supabase } = await import("../../utils/supabaseClient.js");
      const { data } = await supabase.from("employees").select("password_hash").eq("id", empId).single();
      const { verifyPassword, hashPassword } = await import("../../utils/auth.js");
      const valid = data ? await verifyPassword(current, data.password_hash) : false;
      if (!valid) { setMsg("❌ Current password is incorrect."); setSaving(false); return; }
      const hash = await hashPassword(newPwd);
      const { error } = await supabase.from("employees").update({ password_hash: hash }).eq("id", empId);
      setSaving(false);
      if (!error) {
        setMsg("✅ Password changed successfully!");
        setCurrent(""); setNewPwd(""); setConfirm("");
        setTimeout(() => { setOpen(false); setMsg(""); }, 2500);
      } else { setMsg("❌ Failed to update. Try again."); }
    } catch (e) { setSaving(false); setMsg("❌ Something went wrong: " + e.message); }
  };

  return (
    <div style={{ marginTop: 20, paddingTop: 16, borderTop: "1px solid #E2E8F0" }}>
      <div className="sv-flex sv-justify-between sv-items-center" style={{ marginBottom: open ? 12 : 0 }}>
        <div>
          <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: dark ? "#E2E8F0" : "#0F172A" }}>🔑 Change Password</p>
          <p style={{ margin: 0, fontSize: 11, color: "#64748B" }}>Update your login password</p>
        </div>
        <button onClick={() => { setOpen((o) => !o); setMsg(""); }} style={{ padding: "6px 14px", background: open ? "#F1F5F9" : "#1D4ED8", color: open ? "#64748B" : "#fff", border: "none", borderRadius: 7, cursor: "pointer", fontWeight: 700, fontSize: 12 }}>
          {open ? "Cancel" : "Change"}
        </button>
      </div>
      {open && (
        <div style={{ display: "grid", gap: 8 }}>
          <input className="sv-input" type="password" placeholder="Current password" value={current} onChange={(e) => setCurrent(e.target.value)} />
          <input className="sv-input" type="password" placeholder="New password (min 4 characters)" value={newPwd} onChange={(e) => setNewPwd(e.target.value)} />
          <input className="sv-input" type="password" placeholder="Confirm new password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
          {msg && <p style={{ margin: 0, fontSize: 12, fontWeight: 600, color: msg.startsWith("✅") ? "#16A34A" : "#DC2626" }}>{msg}</p>}
          <button onClick={handleChange} disabled={saving} style={{ padding: "9px 0", background: "#16A34A", color: "#fff", border: "none", borderRadius: 8, cursor: saving ? "not-allowed" : "pointer", fontWeight: 700, fontSize: 13, opacity: saving ? 0.7 : 1 }}>
            {saving ? "Updating..." : "Update Password"}
          </button>
        </div>
      )}
    </div>
  );
}

// ── RepeatSection — outside main component to prevent focus loss on typing ──
function RepeatSection({ label, fieldKey, factory, columns, gridCols, dsrForm, locked, setNA, addRow, updateRow, removeRow }) {
  const rows = dsrForm[fieldKey] || [];
  return (
    <div className="sv-repeat" style={{ gridColumn: "1/-1" }}>
      <div className="sv-flex sv-justify-between sv-items-center" style={{ marginBottom: 6, flexWrap: "wrap", gap: 6 }}>
        <FormLabel text={label} />
        <div className="sv-flex sv-gap-2">
          <button type="button" disabled={locked} onClick={() => setNA(fieldKey)} className={`sv-pill ${rows.length === 0 ? "sv-pill--active" : ""}`}>NA</button>
          <button type="button" disabled={locked} onClick={() => addRow(fieldKey, factory)} className="sv-pill sv-pill--add">+ Add</button>
        </div>
      </div>
      {rows.length === 0 ? (
        <div className="sv-repeat-empty">Marked N/A — nothing to report.</div>
      ) : (
        rows.map((row, i) => (
          <div key={i} className="sv-repeat-row" style={{ gridTemplateColumns: gridCols }}>
            {columns.map((c) => (
              <div key={c.field}>
                {c.type === "select" ? (
                  <div>
                    <select className="sv-select" disabled={locked} value={row[c.field] ?? ""}
                      onChange={(e) => updateRow(fieldKey, i, c.field, e.target.value)}>
                      {c.options.map((o) => <option key={o} value={o}>{o}</option>)}
                    </select>
                    {row[c.field] === "Others" && (
                      <input className="sv-input" disabled={locked} placeholder="Specify domain..."
                        style={{ marginTop: 4 }} value={row[c.field + "_custom"] ?? ""}
                        onChange={(e) => updateRow(fieldKey, i, c.field + "_custom", e.target.value)} />
                    )}
                  </div>
                ) : (
                  <input className="sv-input" disabled={locked}
                    type={c.type === "number" ? "number" : c.type === "time" ? "time" : "text"}
                    min={c.type === "number" ? "0" : undefined}
                    step={c.type === "number" ? "0.01" : undefined}
                    placeholder={c.placeholder || ""} value={row[c.field] ?? ""}
                    onChange={(e) => updateRow(fieldKey, i, c.field, e.target.value)} />
                )}
              </div>
            ))}
            <button type="button" disabled={locked} className="sv-row-remove" onClick={() => removeRow(fieldKey, i)} title="Remove">✕</button>
          </div>
        ))
      )}
    </div>
  );
}

function DsrRows({ title, rows, render }) {
  const list = Array.isArray(rows) ? rows : [];
  if (list.length === 0) return null;
  return (
    <div style={{ marginBottom: 8 }}>
      <div className="sv-section-label">{title}</div>
      <ul style={{ margin: "4px 0 0", paddingLeft: 18, fontSize: 13, color: "#374151" }}>
        {list.map((r, i) => <li key={i}>{render(r)}</li>)}
      </ul>
    </div>
  );
}
