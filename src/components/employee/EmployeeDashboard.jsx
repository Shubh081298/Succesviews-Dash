import FormLabel from "./FormLabel.jsx";
import { Avatar } from "../ui/index.js";
import { getTodayStr, fmtDate, daysDiff } from "../../utils/helpers.js";
import { ATTENDANCE, CURRENCIES, BLUE, NAVY } from "../../utils/constants.js";

/**
 * EmployeeDashboard — everything an employee sees after logging in:
 * the daily DSR form, their submission history, leave application,
 * and profile settings. Tab switching is controlled by the parent
 * (`empTab`/`setEmpTab`) so App.jsx can keep all employee state
 * in one place and persist it to storage.
 *
 * Dark mode is driven by the `theme` prop — App.jsx owns the toggle
 * and persists the choice; this component just reads it.
 */
export default function EmployeeDashboard({
  emp, empTab, setEmpTab, dsrDate, dsrForm, setDsrForm, onDateChange, onSave,
  submissions, websites, onLogout, histSearch, setHistSearch, viewingDsr, setViewingDsr,
  customFields = [], announcements = [], onDismissAnn, myMessages = [], onDismissMsg,
  theme = "light", onToggleTheme, leaves = [], leaveForm, setLeaveForm, onApplyLeave,
  onUpdatePhoto, employees = [],
}) {
  const today = getTodayStr();
  const dark = theme === "dark";
  const cardClass = dark ? "sv-card sv-dark" : "sv-card";
  const myReports = submissions.filter((s) => s.employeeId === emp.id).sort((a, b) => b.date.localeCompare(a.date));
  const filteredHist = histSearch ? myReports.filter((r) => r.date === histSearch) : myReports;
  const existingForDate = submissions.find((s) => s.employeeId === emp.id && s.date === dsrDate);
  const locked = dsrDate !== today && daysDiff(dsrDate) > 2;
  const deptKnown = ["Sales", "Operations"].includes(emp.department);

  // Resolve team lead's display name (teamLead may be stored as an id or a raw name).
  const teamLeadObj = emp.teamLead ? employees.find((e) => e.id === emp.teamLead || e.name === emp.teamLead) : null;
  const teamLeadName = teamLeadObj ? teamLeadObj.name : emp.teamLead || null;

  const setWebsiteRow = (i, key, val) => {
    const ws = dsrForm.websites.map((w, idx) => (idx === i ? { ...w, [key]: val } : w));
    setDsrForm({ ...dsrForm, websites: ws });
  };
  const addWebsiteRow = () => setDsrForm({ ...dsrForm, websites: [...dsrForm.websites, { name: "", description: "" }] });
  const removeWebsiteRow = (i) => setDsrForm({ ...dsrForm, websites: dsrForm.websites.filter((_, idx) => idx !== i) });
  const setCustomVal = (id, val) => setDsrForm({ ...dsrForm, customFields: { ...dsrForm.customFields, [id]: val } });

  const badgeClass = (status) => `sv-badge sv-badge--${String(status).toLowerCase().replace(/\s+/g, "-")}`;

  return (
    <div>
      {/* Broadcast announcements for this employee's department */}
      {announcements.map((a) => (
        <div key={a.id} className="sv-flex sv-justify-between sv-items-center" style={{ gap: 10, padding: "12px 16px", background: "#DC2626", color: "#fff", borderRadius: 10, marginBottom: 10, fontWeight: 800, fontSize: 14, boxShadow: "0 4px 14px rgba(220,38,38,0.35)" }}>
          <span>📢 {a.text}</span>
          <button onClick={() => onDismissAnn?.(a.id)} style={{ border: "none", background: "rgba(255,255,255,0.2)", color: "#fff", borderRadius: 6, cursor: "pointer", fontWeight: 700, padding: "2px 9px", flexShrink: 0 }}>×</button>
        </div>
      ))}

      {/* Direct messages sent by the admin */}
      {myMessages.map((m) => (
        <div key={m.id} className="sv-flex sv-justify-between" style={{ alignItems: "flex-start", gap: 10, padding: "11px 16px", background: dark ? "#1E3A8A" : "#EFF6FF", border: `1.5px solid ${BLUE}`, borderRadius: 10, marginBottom: 10 }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: BLUE, marginBottom: 2 }}>✉️ Message from Admin</div>
            <div style={{ fontSize: 13.5, color: dark ? "#E2E8F0" : "#1E293B", fontWeight: 600 }}>{m.text}</div>
          </div>
          <button onClick={() => onDismissMsg?.(m.id)} style={{ border: "none", background: "transparent", color: BLUE, cursor: "pointer", fontWeight: 700, fontSize: 16, flexShrink: 0 }}>×</button>
        </div>
      ))}

      {/* Page header */}
      <div className="sv-flex sv-justify-between sv-items-center" style={{ marginBottom: 16, flexWrap: "wrap", gap: 8 }}>
        <div>
          <h1 className={dark ? "sv-text-white" : "sv-text-navy"} style={{ margin: 0, fontSize: 19, fontWeight: 800 }}>Welcome back, {emp.name.split(" ")[0]}</h1>
          <p className="sv-text-muted" style={{ margin: "2px 0 0", fontSize: 13 }}>
            {emp.department} Department
            {teamLeadName && <> · Team Lead: <span className="sv-text-navy sv-font-700">{teamLeadName}</span></>}
            {" · "}Please submit your Daily Status Report for today
          </p>
        </div>
        <div className="sv-text-muted" style={{ fontSize: 12.5 }}>
          {new Date().toLocaleDateString("en-IN", { weekday: "long", day: "2-digit", month: "long", year: "numeric" })}
        </div>
      </div>

      {/* ── DSR FORM TAB ── */}
      {empTab === "form" && (
        <div className={cardClass}>
          <div className="sv-flex sv-justify-between sv-items-center" style={{ marginBottom: 14, flexWrap: "wrap", gap: 8 }}>
            <div className="sv-flex sv-items-center sv-gap-3">
              <p className={dark ? "sv-text-white sv-font-700" : "sv-text-navy sv-font-700"} style={{ margin: 0, fontSize: 15 }}>{emp.department} DSR — {fmtDate(dsrDate)}</p>
              {existingForDate && (
                <span className={badgeClass(existingForDate.dsrStatus === "Submitted" ? "Completed" : existingForDate.dsrStatus === "Draft" ? "Pending" : "In Progress")}>{existingForDate.dsrStatus}</span>
              )}
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
            <div className="sv-flex sv-gap-2" style={{ flexWrap: "wrap", marginBottom: 16 }}>
              {ATTENDANCE.map((a) => (
                <button
                  key={a} type="button" disabled={locked}
                  onClick={() => setDsrForm({ ...dsrForm, attendance: a })}
                  style={{ padding: "8px 16px", borderRadius: 8, border: `1.5px solid ${dsrForm.attendance === a ? BLUE : "var(--border-input)"}`, background: dsrForm.attendance === a ? "#EFF6FF" : "#fff", color: dsrForm.attendance === a ? "#2563EB" : "#475569", fontWeight: 700, fontSize: 13, cursor: locked ? "default" : "pointer" }}
                >
                  {a}
                </button>
              ))}
            </div>

            {emp.department === "Sales" && (
              <div className="sv-grid-2">
                {[
                  { k: "freshEmails", label: "📧 Fresh Emails Sent" },
                  { k: "reminderEmails", label: "📨 Reminder Emails Sent" },
                  { k: "newLeadsInterested", label: "🎯 New Leads / Interested" },
                  { k: "newFollowUps", label: "🤝 Client Follow-ups" },
                  { k: "callsScheduled", label: "📞 Scheduled Calls" },
                  { k: "workingHours", label: "⏱️ Working Hours" },
                ].map(({ k, label }) => (
                  <div key={k}>
                    <FormLabel text={label} />
                    <input type="number" min="0" step="0.5" disabled={locked} placeholder="0" className="sv-input" value={dsrForm[k]} onChange={(e) => setDsrForm({ ...dsrForm, [k]: e.target.value })} />
                  </div>
                ))}
                <div>
                  <FormLabel text="💰 Sales Generated" />
                  <div className="sv-flex sv-gap-2">
                    <input type="number" min="0" step="0.01" disabled={locked} placeholder="0.00" className="sv-input" value={dsrForm.salesGenerated} onChange={(e) => setDsrForm({ ...dsrForm, salesGenerated: e.target.value })} style={{ flex: 1 }} />
                    <select disabled={locked} className="sv-select" value={dsrForm.currency} onChange={(e) => setDsrForm({ ...dsrForm, currency: e.target.value })} style={{ width: 90 }}>
                      {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                </div>
                <div>
                  <FormLabel text="💵 Payment Received" />
                  <input type="number" min="0" step="0.01" disabled={locked} placeholder="0.00" className="sv-input" value={dsrForm.paymentReceived} onChange={(e) => setDsrForm({ ...dsrForm, paymentReceived: e.target.value })} />
                </div>
                {[
                  { k: "pendingTasks", label: "📌 Pending Tasks", limit: 1000, required: true },
                  { k: "challengesFaced", label: "⚠️ Challenges Faced", limit: 1000 },
                  { k: "updatesForTeamLead", label: "📣 Updates for Team Lead", limit: 1000, required: true },
                  { k: "remarks", label: "📝 Additional Remarks", limit: 1000 },
                ].map(({ k, label, limit, required }) => (
                  <div key={k} style={{ gridColumn: "1/-1" }}>
                    <FormLabel text={`${label}${required ? " *" : ""} (max ${limit} chars)`} />
                    <textarea rows={3} maxLength={limit} disabled={locked} className="sv-textarea" value={dsrForm[k]} onChange={(e) => setDsrForm({ ...dsrForm, [k]: e.target.value })} placeholder="Describe here…" />
                    <div className="sv-text-muted" style={{ textAlign: "right", fontSize: 11 }}>{dsrForm[k].length}/{limit}</div>
                  </div>
                ))}
              </div>
            )}

            {emp.department === "Operations" && (
              <div>
                <FormLabel text="🌐 Website Work" />
                {dsrForm.websites.map((w, i) => (
                  <div key={i} style={{ display: "grid", gridTemplateColumns: "1fr 2fr auto", gap: 8, marginBottom: 8, alignItems: "start" }}>
                    <select disabled={locked} className="sv-select" value={w.name} onChange={(e) => setWebsiteRow(i, "name", e.target.value)}>
                      <option value="">-- Select Website --</option>
                      {websites.map((wn) => <option key={wn} value={wn}>{wn}</option>)}
                    </select>
                    <textarea rows={2} disabled={locked} maxLength={2000} className="sv-textarea" value={w.description} onChange={(e) => setWebsiteRow(i, "description", e.target.value)} placeholder="Work description (e.g. Updated articles, uploaded banners…)" />
                    {dsrForm.websites.length > 1 && !locked && (
                      <button onClick={() => removeWebsiteRow(i)} style={{ padding: "8px 10px", background: "#FEE2E2", color: "#DC2626", border: "none", borderRadius: 7, cursor: "pointer", fontWeight: 700 }}>✕</button>
                    )}
                  </div>
                ))}
                {!locked && (
                  <button onClick={addWebsiteRow} style={{ padding: "7px 14px", background: "#EFF6FF", color: "#2563EB", border: "1.5px solid #BFDBFE", borderRadius: 8, cursor: "pointer", fontWeight: 700, fontSize: 12.5, marginBottom: 16 }}>+ Add Another Website</button>
                )}
                {[
                  { k: "pendingTasks", label: "📌 Pending Tasks", limit: 1000, required: true },
                  { k: "challengesFaced", label: "⚠️ Challenges Faced", limit: 1000 },
                  { k: "updatesForTeamLead", label: "📣 Updates for Team Lead", limit: 1000, required: true },
                ].map(({ k, label, limit, required }) => (
                  <div key={k} style={{ marginBottom: 14 }}>
                    <FormLabel text={`${label}${required ? " *" : ""} (max ${limit} chars)`} />
                    <textarea rows={3} maxLength={limit} disabled={locked} className="sv-textarea" value={dsrForm[k]} onChange={(e) => setDsrForm({ ...dsrForm, [k]: e.target.value })} placeholder="Describe here…" />
                    <div className="sv-text-muted" style={{ textAlign: "right", fontSize: 11 }}>{dsrForm[k].length}/{limit}</div>
                  </div>
                ))}
              </div>
            )}

            {!deptKnown && (
              <div>
                {[
                  { k: "pendingTasks", label: "📌 Pending Tasks", limit: 1000, required: true },
                  { k: "updatesForTeamLead", label: "📣 Updates for Team Lead", limit: 1000, required: true },
                ].map(({ k, label, limit, required }) => (
                  <div key={k} style={{ marginBottom: 14 }}>
                    <FormLabel text={`${label}${required ? " *" : ""} (max ${limit} chars)`} />
                    <textarea rows={3} maxLength={limit} disabled={locked} className="sv-textarea" value={dsrForm[k]} onChange={(e) => setDsrForm({ ...dsrForm, [k]: e.target.value })} placeholder="Describe here…" />
                    <div className="sv-text-muted" style={{ textAlign: "right", fontSize: 11 }}>{dsrForm[k].length}/{limit}</div>
                  </div>
                ))}
              </div>
            )}

            {customFields.length > 0 && (
              <div style={{ marginTop: deptKnown ? 4 : 0, marginBottom: 14, paddingTop: deptKnown ? 14 : 0, borderTop: deptKnown ? "1.5px dashed var(--border-light)" : "none" }}>
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

            {!deptKnown && (
              <div style={{ marginBottom: 14 }}>
                <FormLabel text="📝 Additional Remarks (max 1000 chars)" />
                <textarea rows={3} maxLength={1000} disabled={locked} className="sv-textarea" value={dsrForm.remarks} onChange={(e) => setDsrForm({ ...dsrForm, remarks: e.target.value })} placeholder="Describe here…" />
              </div>
            )}
          </fieldset>

          {!locked && (
            <div className="sv-flex sv-gap-3" style={{ marginTop: 18 }}>
              <button className="sv-btn sv-btn--ghost" style={{ flex: 1 }} onClick={() => onSave("Draft")}>💾 Save Draft</button>
              <button className="sv-btn sv-btn--primary" style={{ flex: 1 }} onClick={() => onSave("Submitted")}>🚀 Submit DSR</button>
            </div>
          )}
        </div>
      )}

      {/* ── HISTORY TAB ── */}
      {empTab === "history" && (
        <div className={cardClass}>
          <div className="sv-flex sv-justify-between sv-items-center" style={{ marginBottom: 14, flexWrap: "wrap", gap: 8 }}>
            <p className={dark ? "sv-text-white sv-font-700" : "sv-text-navy sv-font-700"} style={{ margin: 0, fontSize: 15 }}>📂 My DSR History</p>
            <div className="sv-flex sv-gap-2">
              <input type="date" className="sv-input" value={histSearch} max={today} onChange={(e) => setHistSearch(e.target.value)} style={{ width: 160 }} />
              {histSearch && <button onClick={() => setHistSearch("")} style={{ padding: "6px 10px", background: "var(--bg-muted)", border: "none", borderRadius: 7, cursor: "pointer", fontSize: 12, fontWeight: 700 }}>Clear</button>}
            </div>
          </div>
          <div className="sv-flex-col sv-gap-2">
            {filteredHist.length === 0 && <p className="sv-text-muted" style={{ fontSize: 13 }}>No reports found.</p>}
            {filteredHist.map((r) => {
              const rl = r.date !== today && daysDiff(r.date) > 2;
              return (
                <div key={r.id} className="sv-flex sv-items-center sv-gap-3" style={{ padding: "10px 12px", background: "var(--bg-muted)", border: "1.5px solid var(--border-light)", borderRadius: 8, flexWrap: "wrap" }}>
                  <div className="sv-text-navy sv-font-700" style={{ minWidth: 90, fontSize: 13 }}>{fmtDate(r.date)}</div>
                  <span className={badgeClass(r.attendance === "Present" ? "Completed" : r.attendance === "Absent" ? "Pending" : "In Progress")}>{r.attendance}</span>
                  <span className={badgeClass(r.dsrStatus === "Submitted" ? "Completed" : r.dsrStatus === "Draft" ? "Pending" : "In Progress")}>{r.dsrStatus}{rl ? " · Locked" : ""}</span>
                  <div className="sv-flex sv-gap-2" style={{ marginLeft: "auto" }}>
                    <button onClick={() => setViewingDsr(r)} style={{ padding: "5px 12px", borderRadius: 7, border: `1.5px solid ${BLUE}`, background: "#fff", color: BLUE, cursor: "pointer", fontSize: 12, fontWeight: 700 }}>View</button>
                    {!rl && (
                      <button onClick={() => { setEmpTab("form"); onDateChange(r.date); }} style={{ padding: "5px 12px", borderRadius: 7, border: `1.5px solid ${NAVY}`, background: "#fff", color: NAVY, cursor: "pointer", fontSize: 12, fontWeight: 700 }}>Edit</button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── LEAVE TAB ── */}
      {empTab === "leave" && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1.3fr", gap: 14 }}>
          <div className={cardClass}>
            <p className={dark ? "sv-text-white sv-font-700" : "sv-text-navy sv-font-700"} style={{ margin: "0 0 14px", fontSize: 15 }}>🏖️ Apply for Leave</p>
            <FormLabel text="From Date" />
            <input type="date" className="sv-input" value={leaveForm.fromDate} onChange={(e) => setLeaveForm({ ...leaveForm, fromDate: e.target.value })} style={{ marginBottom: 12 }} />
            <FormLabel text="To Date" />
            <input type="date" className="sv-input" value={leaveForm.toDate} min={leaveForm.fromDate} onChange={(e) => setLeaveForm({ ...leaveForm, toDate: e.target.value })} style={{ marginBottom: 12 }} />
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
                  <div className="sv-text-muted" style={{ fontSize: 12, flex: 1, minWidth: 120 }}>{l.reason}</div>
                  <span className={badgeClass(l.status === "Approved" ? "Completed" : l.status === "Rejected" ? "Pending" : "In Progress")}>{l.status}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── SETTINGS TAB ── */}
      {empTab === "settings" && (
        <div className={cardClass}>
          <p className={dark ? "sv-text-white sv-font-700" : "sv-text-navy sv-font-700"} style={{ margin: "0 0 4px", fontSize: 15 }}>⚙️ My Profile Settings</p>
          <p className="sv-text-muted" style={{ margin: "0 0 16px", fontSize: 12 }}>Update your profile picture. It will be shown across the dashboard wherever your profile appears.</p>
          <div className="sv-flex sv-items-center sv-gap-4">
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
              {emp.photo && (
                <button onClick={() => onUpdatePhoto?.("")} style={{ padding: "7px 16px", background: "#FEE2E2", color: "#DC2626", border: "none", borderRadius: 7, cursor: "pointer", fontSize: 12, fontWeight: 700 }}>Remove Photo</button>
              )}
            </div>
          </div>
          {teamLeadName && (
            <div style={{ marginTop: 20, padding: "12px 16px", background: "#F0F9FF", border: "1.5px solid #BAE6FD", borderRadius: 10 }}>
              <p style={{ margin: 0, fontSize: 13, color: "#0369A1" }}><b>Your Team Lead:</b> {teamLeadName}</p>
            </div>
          )}
        </div>
      )}

      {/* DSR detail viewer (read-only) */}
      {viewingDsr && (
        <div className="sv-modal-overlay" onClick={() => setViewingDsr(null)}>
          <div className="sv-modal" style={{ maxWidth: 560 }} onClick={(e) => e.stopPropagation()}>
            <div className="sv-modal-header">
              <p className="sv-text-navy sv-font-800" style={{ margin: 0, fontSize: 16 }}>{viewingDsr.department} DSR — {fmtDate(viewingDsr.date)}</p>
              <button onClick={() => setViewingDsr(null)} className="sv-modal-close">×</button>
            </div>
            <div className="sv-modal-body">
              <p style={{ fontSize: 13.5 }}><b>Attendance:</b> {viewingDsr.attendance}</p>
              <p style={{ fontSize: 13.5 }}><b>Status:</b> {viewingDsr.dsrStatus}</p>
              {viewingDsr.department === "Sales" ? (
                <>
                  <p style={{ fontSize: 13.5 }}><b>Fresh Emails:</b> {viewingDsr.freshEmails} &nbsp; <b>Reminder Emails:</b> {viewingDsr.reminderEmails}</p>
                  <p style={{ fontSize: 13.5 }}><b>New Leads / Interested:</b> {viewingDsr.newLeadsInterested} &nbsp; <b>Client Follow-ups:</b> {viewingDsr.newFollowUps} &nbsp; <b>Scheduled Calls:</b> {viewingDsr.callsScheduled}</p>
                  <p style={{ fontSize: 13.5 }}><b>Sales Generated:</b> {viewingDsr.salesGenerated} {viewingDsr.currency} &nbsp; <b>Payment Received:</b> {viewingDsr.paymentReceived} &nbsp; <b>Hours:</b> {viewingDsr.workingHours}</p>
                  <p style={{ fontSize: 13.5 }}><b>Pending Tasks:</b> {viewingDsr.pendingTasks || "—"}</p>
                  <p style={{ fontSize: 13.5 }}><b>Challenges:</b> {viewingDsr.challengesFaced || "—"}</p>
                  <p style={{ fontSize: 13.5 }}><b>Updates for Team Lead:</b> {viewingDsr.updatesForTeamLead || "—"}</p>
                  <p style={{ fontSize: 13.5 }}><b>Remarks:</b> {viewingDsr.remarks || "—"}</p>
                </>
              ) : viewingDsr.department === "Operations" ? (
                <>
                  {(viewingDsr.websitesData || []).map((w, i) => (
                    <p key={i} style={{ fontSize: 13.5 }}><b>{w.name}:</b> {w.description}</p>
                  ))}
                  <p style={{ fontSize: 13.5 }}><b>Pending Tasks:</b> {viewingDsr.pendingTasks || "—"}</p>
                  <p style={{ fontSize: 13.5 }}><b>Challenges:</b> {viewingDsr.challengesFaced || "—"}</p>
                  <p style={{ fontSize: 13.5 }}><b>Updates for Team Lead:</b> {viewingDsr.updatesForTeamLead || "—"}</p>
                </>
              ) : (
                <>
                  <p style={{ fontSize: 13.5 }}><b>Pending Tasks:</b> {viewingDsr.pendingTasks || "—"}</p>
                  <p style={{ fontSize: 13.5 }}><b>Updates for Team Lead:</b> {viewingDsr.updatesForTeamLead || "—"}</p>
                  <p style={{ fontSize: 13.5 }}><b>Remarks:</b> {viewingDsr.remarks || "—"}</p>
                </>
              )}
              {viewingDsr.customFields && Object.keys(viewingDsr.customFields).length > 0 && (
                <p style={{ fontSize: 13.5 }}>
                  <b>Custom Fields:</b> {Object.entries(viewingDsr.customFields).map(([, v]) => `${v}`).filter(Boolean).join(" · ") || "—"}
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
