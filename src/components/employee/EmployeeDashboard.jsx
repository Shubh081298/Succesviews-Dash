import { useState, useEffect } from "react";
import FormLabel from "./FormLabel.jsx";
import { Avatar } from "../ui/index.js";
import { getTodayStr, fmtDate, fmtDateTime, daysDiff, normAssignedId, parsePayslipPayload, stripPayslipPayload } from "../../utils/helpers.js";
import PayslipView from "../PayslipView.jsx";
import PhotoCropper from "./PhotoCropper.jsx";
import {
  blankLead, blankContractOrder, blankFollowup, blankCall, blankSale, blankPayment,
} from "../../utils/helpers.js";
import { ATTENDANCE, CURRENCIES, DOMAINS, BLUE } from "../../utils/constants.js";
import { Mail, Send, Clock, Globe2, ClipboardList, Megaphone, CheckCircle2, XCircle, Info, CalendarDays, Sparkles, CheckCheck } from "lucide-react";

// Brand icons aren't in this lucide version — small inline SVGs (with brand colours).
const FbIcon = ({ size = 16 }) => (<svg width={size} height={size} viewBox="0 0 24 24" fill="#1877F2"><path d="M24 12a12 12 0 1 0-13.87 11.85v-8.38H7.08V12h3.05V9.36c0-3 1.79-4.67 4.53-4.67 1.31 0 2.68.23 2.68.23v2.95h-1.51c-1.49 0-1.96.93-1.96 1.87V12h3.33l-.53 3.47h-2.8v8.38A12 12 0 0 0 24 12z"/></svg>);
const IgIcon = ({ size = 16 }) => (<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="#E4405F" strokeWidth="2"><rect x="2" y="2" width="20" height="20" rx="5.5"/><circle cx="12" cy="12" r="4.2"/><circle cx="17.6" cy="6.4" r="1.1" fill="#E4405F" stroke="none"/></svg>);
const LiIcon = ({ size = 16 }) => (<svg width={size} height={size} viewBox="0 0 24 24" fill="#0A66C2"><path d="M20.45 20.45h-3.56v-5.57c0-1.33-.02-3.04-1.85-3.04-1.85 0-2.14 1.45-2.14 2.94v5.67H9.35V9h3.41v1.56h.05c.48-.9 1.63-1.85 3.36-1.85 3.6 0 4.27 2.37 4.27 5.45v6.29zM5.34 7.43a2.06 2.06 0 1 1 0-4.13 2.06 2.06 0 0 1 0 4.13zM7.12 20.45H3.56V9h3.56v11.45zM22.22 0H1.77C.79 0 0 .77 0 1.73v20.54C0 23.23.79 24 1.77 24h20.45c.98 0 1.78-.77 1.78-1.73V1.73C24 .77 23.2 0 22.22 0z"/></svg>);

const ATT_META = {
  "Present": { icon: CheckCircle2, ac: "#16A34A", bg: "#DCFCE7" },
  "Half Day": { icon: Clock, ac: "#CA8A04", bg: "#FEF9C3" },
  "Absent": { icon: XCircle, ac: "#DC2626", bg: "#FEE2E2" },
};
const autoGrow = (e) => { e.target.style.height = "auto"; e.target.style.height = Math.min(e.target.scrollHeight, 320) + "px"; };

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
  theme = "light", onToggleTheme, leaves = [], leaveForm, setLeaveForm, onApplyLeave, onCancelLeave,
  onUpdatePhoto, employees = [], logo = "", onSaveAssignedIds,
  bankDetails = {}, onSaveBank, domains = [],
  onUpdateProfile, allLeaves = [], attendanceOverrides = [],
}) {
  const today = getTodayStr();
  const dark = theme === "dark";
  const [viewingPayslip, setViewingPayslip] = useState(null);
  const [confirmSubmit, setConfirmSubmit] = useState(false);
  const [cropSrc, setCropSrc] = useState(null);
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

  // Operation DSR — merge Domains/Pipeline + Website Management, deduplicated.
  const domainNames = (domains || []).filter((d) => d.status !== false).map((d) => d.name);
  const domainOptions = [...new Set([...domainNames, ...(websites || [])])];
  const opUpdate = (key, i, field, val) => setDsrForm({ ...dsrForm, [key]: (dsrForm[key] || []).map((r, idx) => (idx === i ? { ...r, [field]: val } : r)) });
  const opAdd = (key, blank) => setDsrForm({ ...dsrForm, [key]: [...(dsrForm[key] || []), blank] });
  const opRemove = (key, i) => setDsrForm({ ...dsrForm, [key]: (dsrForm[key] || []).filter((_, idx) => idx !== i) });

  const badgeClass = (status) => `sv-badge sv-badge--${String(status).toLowerCase().replace(/\s+/g, "-")}`;
  const attendance = dsrForm.attendance || "Present";
  const showFields = attendance !== "Absent";

  function backdateMin() {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().split("T")[0];
  }
  function dsrMin() {
    const d = new Date();
    d.setDate(d.getDate() - 2);
    return d.toISOString().split("T")[0];
  }

  // Keep one payslip per payroll month (newest wins) so an accidental re-send
  // can't stack duplicates. The history includes dismissed ones (so exiting the
  // banner never loses a payslip); the banner shows only non-dismissed.
  const dedupPayslipsByMonth = (list) => {
    const byMonth = new Map();
    list.forEach((m) => {
      const p = parsePayslipPayload(m.text);
      const key = p ? (p.monthKey || `${p.month}-${p.year}`) : (m.id || m.text);
      const prev = byMonth.get(key);
      if (!prev || (m.ts || 0) >= (prev.ts || 0)) byMonth.set(key, m);
    });
    return Array.from(byMonth.values()).sort((a, b) => (b.ts || 0) - (a.ts || 0));
  };
  const allPayslips = myMessages.filter((m) => m.text?.toLowerCase().includes("payslip"));
  const payslipMessages = dedupPayslipsByMonth(allPayslips);
  const newPayslips = dedupPayslipsByMonth(allPayslips.filter((m) => !m.dismissed));
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
        <div className="sv-dsr" style={{ marginTop: 14 }}>
          {/* Absence warning */}
          <div style={{ display: "flex", alignItems: "flex-start", gap: 12, padding: "12px 16px", background: "linear-gradient(135deg,#FFF7ED,#FEF3C7)", border: "1.5px solid #FCD34D", borderRadius: 10, marginBottom: 14 }}>
            <span style={{ fontSize: 20, flexShrink: 0, marginTop: 1 }}>⚠️</span>
            <div>
              <div style={{ fontWeight: 800, color: "#92400E", fontSize: 13.5, marginBottom: 2 }}>DSR is mandatory every working day</div>
              <div style={{ fontSize: 12.5, color: "#B45309", lineHeight: 1.55 }}>If you do not submit your Daily Status Report, you will be considered <strong>Absent</strong> for that day. DSR can only be submitted for today or up to 2 previous days.</div>
            </div>
          </div>
          {/* Premium header */}
          <div className="sv-dsr-head">
            <div style={{ minWidth: 0 }}>
              <h1 className="sv-dsr-title">Daily Status Report</h1>
              <p className="sv-dsr-sub">{emp.department} · {fmtDate(dsrDate)} — a quick end-of-day summary of your work.</p>
            </div>
            <div className="sv-dsr-head-right">
              <span className={`sv-dsr-status ${existingForDate?.status === "Submitted" ? "is-submitted" : "is-draft"}`}>
                {existingForDate?.status === "Submitted" ? <><CheckCheck size={13} /> Submitted</> : <>Draft</>}
              </span>
              <label className="sv-dsr-date"><CalendarDays size={14} /><input type="date" value={dsrDate} min={dsrMin()} max={today} onChange={(e) => onDateChange(e.target.value)} /></label>
              {!locked && <span className="sv-dsr-autosave"><span className="dot" /> Auto-saving</span>}
            </div>
          </div>

          {locked && (
            <div className="sv-dsr-locked">🔒 This report is older than 2 days and is locked. Read-only view.</div>
          )}

          <fieldset disabled={locked} style={{ border: "none", padding: 0, margin: 0 }}>
            {/* Attendance */}
            <div className="sv-dsr-sec sv-dsr-sec--green" style={{ animationDelay: "40ms" }}>
              <div className="sv-dsr-sec-head"><span className="sv-dsr-sec-ic"><CalendarDays size={16} /></span>Attendance</div>
              <div className="sv-att">
                {ATTENDANCE.map((a) => {
                  const m = ATT_META[a] || ATT_META.Present; const Ic = m.icon; const on = attendance === a;
                  return (
                    <button key={a} type="button" disabled={locked} onClick={() => setDsrForm({ ...dsrForm, attendance: a })}
                      className={`sv-att-btn${on ? " is-on" : ""}`} style={{ "--ac": m.ac, "--ac-bg": m.bg }}>
                      <span className="sv-att-ic"><Ic size={18} /></span>{a}
                    </button>
                  );
                })}
              </div>
              {attendance === "Absent" && (
                <div className="sv-dsr-absent">Marked <b>Absent</b> for {fmtDate(dsrDate)}. No activity fields are required — just submit.</div>
              )}
            </div>

            {showFields && (
              <>
                {/* Daily Activity */}
                <div className="sv-dsr-sec sv-dsr-sec--blue" style={{ animationDelay: "90ms" }}>
                  <div className="sv-dsr-sec-head"><span className="sv-dsr-sec-ic"><Sparkles size={16} /></span>Daily Activity</div>
                  <div className="sv-grid-2">
                    {!isOps && (
                      <label className="sv-dsr-field">
                        <span className="sv-dsr-flabel"><Mail size={14} /> Fresh Emails Sent <b>*</b></span>
                        <input type="number" min="0" inputMode="numeric" disabled={locked} placeholder="0" className="sv-input" value={dsrForm.freshEmails} onChange={(e) => setDsrForm({ ...dsrForm, freshEmails: e.target.value })} />
                      </label>
                    )}
                    {!isOps && (
                      <label className="sv-dsr-field">
                        <span className="sv-dsr-flabel"><Send size={14} /> Reminder Emails Sent <b>*</b></span>
                        <input type="number" min="0" inputMode="numeric" disabled={locked} placeholder="0" className="sv-input" value={dsrForm.reminderEmails} onChange={(e) => setDsrForm({ ...dsrForm, reminderEmails: e.target.value })} />
                      </label>
                    )}
                    <label className="sv-dsr-field">
                      <span className="sv-dsr-flabel"><Clock size={14} /> Working Hours <b>*</b></span>
                      <input type="number" min="0" step="0.5" inputMode="decimal" disabled={locked} placeholder="0" className="sv-input" value={dsrForm.workingHours} onChange={(e) => setDsrForm({ ...dsrForm, workingHours: e.target.value })} />
                    </label>
                    {!isOps && <div />}
                  </div>
                </div>

                {/* ── Operation DSR: Website Work / Social Media / Magazine Live ── */}
                {isOps && (
                  <>
                    <div className="sv-dsr-sec sv-dsr-sec--blue" style={{ animationDelay: "110ms" }}>
                      <div className="sv-dsr-sec-head"><span className="sv-dsr-sec-ic"><Globe2 size={16} /></span>Website Work</div>
                      {(dsrForm.opWebsiteWork || []).map((r, i) => (
                        <div key={i} className="sv-op-row">
                          <div className="sv-op-row-grid">
                            <select disabled={locked} className="sv-select" value={r.domain} onChange={(e) => opUpdate("opWebsiteWork", i, "domain", e.target.value)}>
                              <option value="">-- Select Domain --</option>
                              {domainOptions.map((d) => <option key={d} value={d}>{d}</option>)}
                            </select>
                            <input disabled={locked} className="sv-input" value={r.today} onChange={(e) => opUpdate("opWebsiteWork", i, "today", e.target.value)} placeholder="Today's work (short)…" />
                            <input disabled={locked} className="sv-input" value={r.pending} onChange={(e) => opUpdate("opWebsiteWork", i, "pending", e.target.value)} placeholder="Pending work (short)…" />
                            {(dsrForm.opWebsiteWork || []).length > 1 && !locked && <button type="button" onClick={() => opRemove("opWebsiteWork", i)} className="sv-row-remove">✕</button>}
                          </div>
                        </div>
                      ))}
                      {!locked && <button type="button" onClick={() => opAdd("opWebsiteWork", { domain: "", today: "", pending: "" })} className="sv-pill sv-pill--add" style={{ marginTop: 4 }}>+ Add Another Website</button>}
                    </div>

                    <div className="sv-dsr-sec sv-dsr-sec--purple" style={{ animationDelay: "140ms" }}>
                      <div className="sv-dsr-sec-head"><span className="sv-dsr-sec-ic"><Megaphone size={16} /></span>Social Media</div>
                      {(dsrForm.opSocial || []).map((r, i) => {
                        const PLATFORMS = [
                          { key: "fb", desc: "fbDesc", label: "Facebook", Icon: FbIcon },
                          { key: "ig", desc: "igDesc", label: "Instagram", Icon: IgIcon },
                          { key: "li", desc: "liDesc", label: "LinkedIn", Icon: LiIcon },
                        ];
                        return (
                          <div key={i} className="sv-op-card">
                            <div className="sv-op-card-top">
                              <select disabled={locked} className="sv-select" value={r.domain} onChange={(e) => opUpdate("opSocial", i, "domain", e.target.value)}>
                                <option value="">-- Select Domain --</option>
                                {domainOptions.map((d) => <option key={d} value={d}>{d}</option>)}
                              </select>
                              {(dsrForm.opSocial || []).length > 1 && !locked && <button type="button" onClick={() => opRemove("opSocial", i)} className="sv-row-remove">✕</button>}
                            </div>
                            {r.domain && (
                              <div className="sv-op-plats">
                                {PLATFORMS.map(({ key, desc, label, Icon }) => (
                                  <div key={key} className="sv-op-plat">
                                    <span className="sv-op-plat-name"><Icon size={16} /> {label}</span>
                                    <div className="sv-op-plat-toggle">
                                      {["No", "Yes"].map((v) => (
                                        <button key={v} type="button" disabled={locked} onClick={() => opUpdate("opSocial", i, key, v)}
                                          className={`sv-op-yn${r[key] === v ? " is-on" : ""}${v === "Yes" ? " sv-op-yn--yes" : ""}`}>{v}</button>
                                      ))}
                                    </div>
                                    {r[key] === "Yes" && (
                                      <input disabled={locked} className="sv-input sv-op-plat-desc" value={r[desc] || ""} onChange={(e) => opUpdate("opSocial", i, desc, e.target.value)} placeholder={`${label} post details…`} />
                                    )}
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })}
                      {!locked && <button type="button" onClick={() => opAdd("opSocial", { domain: "", fb: "No", fbDesc: "", ig: "No", igDesc: "", li: "No", liDesc: "" })} className="sv-pill sv-pill--add" style={{ marginTop: 4 }}>+ Add Another Domain</button>}
                    </div>

                    <div className="sv-dsr-sec sv-dsr-sec--green" style={{ animationDelay: "170ms" }}>
                      <div className="sv-dsr-sec-head"><span className="sv-dsr-sec-ic"><CheckCircle2 size={16} /></span>Magazine Live</div>
                      {(dsrForm.opMagazine || []).map((r, i) => (
                        <div key={i} className="sv-op-row">
                          <div className="sv-op-mag-grid">
                            <select disabled={locked} className="sv-select" value={r.domain} onChange={(e) => opUpdate("opMagazine", i, "domain", e.target.value)}>
                              <option value="">-- Domain --</option>
                              {domainOptions.map((d) => <option key={d} value={d}>{d}</option>)}
                            </select>
                            <select disabled={locked} className="sv-select" value={r.webLive} onChange={(e) => opUpdate("opMagazine", i, "webLive", e.target.value)}>
                              <option value="No">Web Live? No</option>
                              <option value="Yes">Web Live? Yes</option>
                            </select>
                            {r.webLive === "Yes" && <input disabled={locked} className="sv-input" value={r.webClient} onChange={(e) => opUpdate("opMagazine", i, "webClient", e.target.value)} placeholder="Web — Client name" />}
                            <select disabled={locked} className="sv-select" value={r.digitalLive} onChange={(e) => opUpdate("opMagazine", i, "digitalLive", e.target.value)}>
                              <option value="No">Digital Live? No</option>
                              <option value="Yes">Digital Live? Yes</option>
                            </select>
                            {r.digitalLive === "Yes" && <input disabled={locked} className="sv-input" value={r.digitalClient} onChange={(e) => opUpdate("opMagazine", i, "digitalClient", e.target.value)} placeholder="Digital — Client name" />}
                            {(dsrForm.opMagazine || []).length > 1 && !locked && <button type="button" onClick={() => opRemove("opMagazine", i)} className="sv-row-remove">✕</button>}
                          </div>
                        </div>
                      ))}
                      {!locked && <button type="button" onClick={() => opAdd("opMagazine", { domain: "", webLive: "No", webClient: "", digitalLive: "No", digitalClient: "" })} className="sv-pill sv-pill--add" style={{ marginTop: 4 }}>+ Add Another Domain</button>}
                    </div>
                  </>
                )}

                {/* Pending Tasks */}
                <div className="sv-dsr-sec sv-dsr-sec--orange" style={{ animationDelay: "140ms" }}>
                  <div className="sv-dsr-sec-head"><span className="sv-dsr-sec-ic"><ClipboardList size={16} /></span>Pending Tasks {!isOps && <b style={{ color: "#EA580C" }}>*</b>}</div>
                  <div className="sv-notecard">
                    <textarea rows={3} maxLength={1000} disabled={locked} className="sv-textarea" value={dsrForm.pendingTasks} onChange={(e) => setDsrForm({ ...dsrForm, pendingTasks: e.target.value })} onInput={autoGrow} placeholder="List anything still in progress or waiting on someone — one item per line works great." />
                    <div className="sv-notecard-foot"><span>{(dsrForm.pendingTasks || "").length}/1000</span></div>
                  </div>
                </div>

                {/* Team Updates */}
                <div className="sv-dsr-sec sv-dsr-sec--purple" style={{ animationDelay: "190ms" }}>
                  <div className="sv-dsr-sec-head"><span className="sv-dsr-sec-ic"><Megaphone size={16} /></span>Updates for {teamLeadName} <span className="sv-text-muted" style={{ fontWeight: 600, fontSize: 11.5 }}>(optional)</span></div>
                  <div className="sv-notecard">
                    <textarea rows={3} maxLength={1000} disabled={locked} className="sv-textarea" value={dsrForm.updatesForTeamLead} onChange={(e) => setDsrForm({ ...dsrForm, updatesForTeamLead: e.target.value })} onInput={autoGrow} placeholder="Blockers, wins, or anything your team lead should know about today." />
                    <div className="sv-notecard-foot"><span>{(dsrForm.updatesForTeamLead || "").length}/1000</span></div>
                  </div>
                </div>

                {customFields.length > 0 && (
                  <div className="sv-dsr-sec" style={{ "--sc-bg": "#FBFCFE", "--sc-bd": "#EAEFF5", "--sc-ac": "#475569", animationDelay: "230ms" }}>
                    <div className="sv-dsr-sec-head"><span className="sv-dsr-sec-ic"><ClipboardList size={16} /></span>Additional Fields</div>
                    <div className="sv-grid-2">
                      {customFields.map((f) => (
                        <div key={f.id} style={{ gridColumn: f.type === "textarea" ? "1/-1" : "auto" }}>
                          <span className="sv-dsr-flabel">{f.label}{f.required ? " *" : ""}</span>
                          {f.type === "textarea" ? (
                            <textarea rows={3} disabled={locked} className="sv-textarea" value={dsrForm.customFields?.[f.id] || ""} onChange={(e) => setCustomVal(f.id, e.target.value)} onInput={autoGrow} placeholder="Describe here…" />
                          ) : (
                            <input type={f.type === "number" ? "number" : "text"} disabled={locked} className="sv-input" value={dsrForm.customFields?.[f.id] || ""} onChange={(e) => setCustomVal(f.id, e.target.value)} />
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

              </>
            )}
          </fieldset>

          {!locked && (
            <button className="sv-dsr-cta" onClick={() => setConfirmSubmit(true)}><Send size={17} /> Submit Daily Report</button>
          )}

          {confirmSubmit && (
            <div className="sv-modal-overlay" onClick={() => setConfirmSubmit(false)}>
              <div className="sv-modal sv-confirm" onClick={(e) => e.stopPropagation()}>
                <p className="sv-confirm-msg">Submit today's Daily Status Report?</p>
                <p className="sv-confirm-sub">You can still edit it until 11:59 PM today.</p>
                <div className="sv-confirm-actions">
                  <button className="sv-btn sv-btn--outline" onClick={() => setConfirmSubmit(false)}>Cancel</button>
                  <button className="sv-btn sv-btn--success" onClick={() => { setConfirmSubmit(false); onSave("Submitted"); }}>Submit</button>
                </div>
              </div>
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
              {filteredHist.map((r) => {
                const attMeta = r.attendance === "Present" ? { bg: "#F0FDF4", bd: "#BBF7D0", fg: "#15803D", dot: "#22C55E" }
                  : r.attendance === "Absent" ? { bg: "#FEF2F2", bd: "#FECACA", fg: "#B91C1C", dot: "#EF4444" }
                  : { bg: "#FFFBEB", bd: "#FDE68A", fg: "#A16207", dot: "#F59E0B" };
                const stMeta = r.status === "Submitted" ? { bg: "#F0FDF4", bd: "#BBF7D0", fg: "#15803D", dot: "#22C55E", label: "Submitted", icon: "✓" }
                  : r.status === "Under Review" ? { bg: "#EFF6FF", bd: "#BFDBFE", fg: "#1D4ED8", dot: "#3B82F6", label: "Under Review", icon: "◎" }
                  : { bg: "#FFFBEB", bd: "#FDE68A", fg: "#A16207", dot: "#F59E0B", label: "Draft", icon: "○" };
                return (
                  <div key={r.id} style={{ display: "flex", alignItems: "center", gap: 14, padding: "11px 14px", background: dark ? "#1E293B" : "#FAFBFC", border: `1px solid ${dark ? "#334155" : "#EEF2F7"}`, borderRadius: 10, borderLeft: `3px solid ${stMeta.dot}`, transition: "box-shadow .15s", cursor: "default" }}
                    onMouseEnter={(e) => { e.currentTarget.style.boxShadow = "0 2px 8px rgba(0,0,0,.06)"; }}
                    onMouseLeave={(e) => { e.currentTarget.style.boxShadow = "none"; }}>
                    <div style={{ minWidth: 90 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: dark ? "#E2E8F0" : "#0F172A", letterSpacing: "-.01em" }}>{fmtDate(r.date)}</div>
                      {r.ts && <div style={{ fontSize: 10.5, color: "#94A3B8", fontWeight: 500, marginTop: 1 }}>{fmtDateTime(r.ts)}</div>}
                    </div>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "3px 10px", borderRadius: 20, background: attMeta.bg, border: `1px solid ${attMeta.bd}`, fontSize: 11, fontWeight: 700, color: attMeta.fg, whiteSpace: "nowrap" }}>
                      <span style={{ width: 6, height: 6, borderRadius: "50%", background: attMeta.dot, flexShrink: 0 }} />{r.attendance}
                    </span>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "3px 10px", borderRadius: 20, background: stMeta.bg, border: `1px solid ${stMeta.bd}`, fontSize: 11, fontWeight: 700, color: stMeta.fg, whiteSpace: "nowrap" }}>
                      <span style={{ fontSize: 10, lineHeight: 1 }}>{stMeta.icon}</span>{stMeta.label}
                    </span>
                    <div style={{ marginLeft: "auto", flexShrink: 0 }}>
                      <button onClick={() => setViewingDsr(r)} style={{ padding: "5px 14px", borderRadius: 8, border: "none", background: dark ? "#1E3A8A" : "#EFF6FF", color: "#2563EB", cursor: "pointer", fontSize: 12, fontWeight: 700, transition: "background .15s" }}
                        onMouseEnter={(e) => { e.currentTarget.style.background = dark ? "#1E40AF" : "#DBEAFE"; }}
                        onMouseLeave={(e) => { e.currentTarget.style.background = dark ? "#1E3A8A" : "#EFF6FF"; }}>View</button>
                    </div>
                  </div>
                );
              })}
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
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1.4fr", gap: 16, marginTop: 16 }}>
          {/* Apply form */}
          <div className={cardClass} style={{ display: "flex", flexDirection: "column", gap: 0 }}>
            <div style={{ marginBottom: 16 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
                <span style={{ background: dark ? "#1E3A8A" : "#EFF6FF", color: "#2563EB", borderRadius: 8, padding: "6px 8px", display: "flex" }}><CalendarDays size={17} /></span>
                <div>
                  <p className={dark ? "sv-text-white sv-font-800" : "sv-text-navy sv-font-800"} style={{ margin: 0, fontSize: 15.5 }}>Apply for Leave</p>
                  <p className="sv-text-muted" style={{ margin: 0, fontSize: 11.5 }}>Back-date up to 30 days. All requests need manager approval.</p>
                </div>
              </div>
            </div>

            <FormLabel text="Leave Type" />
            <select className="sv-select" value={leaveForm.leaveType} onChange={(e) => setLeaveForm({ ...leaveForm, leaveType: e.target.value })} style={{ marginBottom: 12 }}>
              <option value="">-- Select type --</option>
              <option value="Sick Leave">Sick Leave</option>
              <option value="Casual Leave">Casual Leave</option>
              <option value="Annual Leave">Annual Leave</option>
              <option value="Emergency Leave">Emergency Leave</option>
            </select>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 12 }}>
              <div>
                <FormLabel text="From Date" />
                <input type="date" className="sv-input" value={leaveForm.fromDate} min={backdateMin()} max={today}
                  onChange={(e) => setLeaveForm({ ...leaveForm, fromDate: e.target.value, toDate: leaveForm.toDate && leaveForm.toDate < e.target.value ? e.target.value : leaveForm.toDate })} />
              </div>
              <div>
                <FormLabel text="To Date" />
                <input type="date" className="sv-input" value={leaveForm.toDate} min={leaveForm.fromDate || backdateMin()}
                  onChange={(e) => setLeaveForm({ ...leaveForm, toDate: e.target.value })} />
              </div>
            </div>

            {leaveForm.fromDate && leaveForm.toDate && leaveForm.fromDate <= leaveForm.toDate && (
              <div style={{ padding: "8px 12px", background: dark ? "#0F2942" : "#EFF6FF", borderRadius: 8, marginBottom: 12, fontSize: 12.5, color: "#2563EB", fontWeight: 600 }}>
                {(() => { try { const a = new Date(leaveForm.fromDate+"T00:00:00"), b = new Date(leaveForm.toDate+"T00:00:00"); const d = Math.round((b-a)/86400000)+1; return `📅 ${d} day${d>1?"s":""} selected`; } catch { return null; } })()}
              </div>
            )}

            <FormLabel text="Reason" />
            <textarea rows={3} className="sv-textarea" value={leaveForm.reason}
              onChange={(e) => setLeaveForm({ ...leaveForm, reason: e.target.value })}
              placeholder="Briefly describe why you need this leave…" style={{ marginBottom: 16 }} />

            <button className="sv-btn sv-btn--primary sv-btn--full" onClick={onApplyLeave} style={{ marginTop: "auto" }}>
              <CalendarDays size={15} style={{ marginRight: 6 }} /> Submit Leave Application
            </button>
          </div>

          {/* My applications */}
          <div className={cardClass}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
              <span style={{ background: dark ? "#14532D" : "#F0FDF4", color: "#16A34A", borderRadius: 8, padding: "6px 8px", display: "flex" }}><ClipboardList size={17} /></span>
              <div>
                <p className={dark ? "sv-text-white sv-font-800" : "sv-text-navy sv-font-800"} style={{ margin: 0, fontSize: 15.5 }}>My Applications</p>
                <p className="sv-text-muted" style={{ margin: 0, fontSize: 11.5 }}>{leaves.length} request{leaves.length !== 1 ? "s" : ""} submitted</p>
              </div>
            </div>
            <div className="sv-flex-col sv-gap-2">
              {leaves.length === 0 && (
                <div style={{ textAlign: "center", padding: "28px 16px", color: "#94A3B8" }}>
                  <CalendarDays size={32} style={{ marginBottom: 8, opacity: 0.4 }} />
                  <p style={{ margin: 0, fontSize: 13 }}>No leave applications yet.</p>
                </div>
              )}
              {[...leaves].sort((a,b) => (b.ts||0)-(a.ts||0)).map((l) => {
                const isPending = l.status === "Pending";
                const isApproved = l.status === "Approved";
                const accentColor = isPending ? "#F59E0B" : isApproved ? "#16A34A" : "#EF4444";
                const bgColor = isPending ? (dark?"#1C1A09":"#FFFBEB") : isApproved ? (dark?"#052E16":"#F0FDF4") : (dark?"#2D0A0A":"#FEF2F2");
                const bdColor = isPending ? "#FDE68A" : isApproved ? "#86EFAC" : "#FECACA";
                return (
                  <div key={l.id} style={{ padding: "12px 14px", background: bgColor, border: `1.5px solid ${bdColor}`, borderRadius: 10, borderLeft: `4px solid ${accentColor}` }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontWeight: 800, fontSize: 13, color: dark ? "#F1F5F9" : "#1E293B", marginBottom: 3 }}>
                          {fmtDate(l.fromDate)}{l.toDate !== l.fromDate ? ` → ${fmtDate(l.toDate)}` : ""}
                          {(() => { try { const d = Math.round((new Date(l.toDate+"T00:00:00")-new Date(l.fromDate+"T00:00:00"))/86400000)+1; return <span style={{ marginLeft: 6, fontWeight: 600, fontSize: 11, color: accentColor }}>{d}d</span>; } catch { return null; } })()}
                        </div>
                        {l.leaveType && <div style={{ fontSize: 11, fontWeight: 700, color: accentColor, marginBottom: 3 }}>{l.leaveType}</div>}
                        <div style={{ fontSize: 12, color: dark?"#CBD5E1":"#475569" }}>{l.reason}</div>
                        {l.remark && <div style={{ fontSize: 11.5, color: dark?"#94A3B8":"#64748B", marginTop: 4, fontStyle: "italic" }}>Admin note: {l.remark}</div>}
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6, flexShrink: 0 }}>
                        <span style={{ padding: "3px 10px", borderRadius: 20, fontSize: 11, fontWeight: 800, background: isPending?"#FEF3C7":isApproved?"#DCFCE7":"#FEE2E2", color: accentColor, whiteSpace: "nowrap" }}>
                          {isPending ? "⏳ Pending" : isApproved ? "✓ Approved" : "✗ Rejected"}
                        </span>
                        {isPending && (
                          <button onClick={() => onCancelLeave?.(l.id)} style={{ padding: "3px 10px", borderRadius: 20, border: "1.5px solid #EF4444", background: "transparent", color: "#EF4444", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>
                            Cancel
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {empTab === "attendance" && (
        <EmployeeAttendanceCalendar emp={emp} submissions={submissions} allLeaves={allLeaves} attendanceOverrides={attendanceOverrides} dark={dark} />
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
                  reader.onload = () => setCropSrc(reader.result);
                  reader.readAsDataURL(file);
                  ev.target.value = "";
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
          <ProfileDetailsSection emp={emp} onSave={onUpdateProfile} dark={dark} />
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
            <div className="sv-myid-blank">No mail IDs assigned to you yet.</div>
          ) : (
            <div className="sv-myid-list">
              <div className="sv-myid-head">
                <span>Mail ID</span><span>Project name</span><span>Project start date</span><span>Status</span>
              </div>
              {(emp.assignedIds || []).map(normAssignedId).map((r, i) => {
                const active = !!(r.project && r.startDate);
                return (
                  <div key={r.id} className="sv-myid-row">
                    <span className="sv-myid-id" title={r.id}>
                      <span className="sv-myid-id-text">{r.id}</span>
                    </span>
                    <input
                      className="sv-input sv-myid-input"
                      placeholder="Enter project name"
                      defaultValue={r.project}
                      onBlur={(e) => saveMyId(r.id, "project", e.target.value)}
                    />
                    <input
                      type="date"
                      className="sv-input sv-myid-input"
                      defaultValue={r.startDate}
                      onChange={(e) => saveMyId(r.id, "startDate", e.target.value)}
                    />
                    <span className={`sv-team-badge sv-team-badge--${active ? "active" : "pending"}`}><span className="sv-team-badge-dot" />{active ? "Active" : "Pending"}</span>
                  </div>
                );
              })}
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
              ) : viewingDsr.department === "Operations" ? (
                (() => {
                  const op = (viewingDsr.customFields && viewingDsr.customFields.__op) || {};
                  const socialLine = (r) => {
                    const done = [];
                    if (r.fb === "Yes") done.push(`Facebook${r.fbDesc ? ` (${r.fbDesc})` : ""}`);
                    if (r.ig === "Yes") done.push(`Instagram${r.igDesc ? ` (${r.igDesc})` : ""}`);
                    if (r.li === "Yes") done.push(`LinkedIn${r.liDesc ? ` (${r.liDesc})` : ""}`);
                    return `${r.domain || "—"} — ${done.length ? done.join(", ") : "no posts"}`;
                  };
                  const magLine = (r) => {
                    const parts = [];
                    parts.push(`Web Live: ${r.webLive || "No"}${r.webLive === "Yes" && r.webClient ? ` (${r.webClient})` : ""}`);
                    parts.push(`Digital Live: ${r.digitalLive || "No"}${r.digitalLive === "Yes" && r.digitalClient ? ` (${r.digitalClient})` : ""}`);
                    return `${r.domain || "—"} — ${parts.join(" · ")}`;
                  };
                  return (
                    <>
                      <p style={{ fontSize: 13.5 }}><b>Working Hours:</b> {viewingDsr.workingHours || 0}</p>
                      <DsrRows title="🌐 Website Work" rows={op.websiteWork} render={(r) => `${r.domain || "—"} — Today: ${r.today || "—"}${r.pending ? ` · Pending: ${r.pending}` : ""}`} />
                      <DsrRows title="📣 Social Media" rows={op.social} render={socialLine} />
                      <DsrRows title="📖 Magazine Live" rows={op.magazine} render={magLine} />
                      <p style={{ fontSize: 13.5 }}><b>Pending Tasks:</b> {viewingDsr.pendingTasks || "—"}</p>
                      <p style={{ fontSize: 13.5 }}><b>Updates for Team Lead:</b> {viewingDsr.updatesForTeamLead || "—"}</p>
                    </>
                  );
                })()
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

      {cropSrc && (
        <PhotoCropper src={cropSrc} onCancel={() => setCropSrc(null)} onSave={(dataUrl) => { onUpdatePhoto?.(dataUrl); setCropSrc(null); }} />
      )}
    </div>
  );
}

function ProfileDetailsSection({ emp, onSave, dark }) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState({
    mobile: emp?.mobile || "",
    dob: emp?.dob || "",
    personalEmail: emp?.personalEmail || "",
    address: emp?.address || "",
    bankAccount: emp?.bankAccount || "",
    bankName: emp?.bankName || "",
    bankIfsc: emp?.bankIfsc || "",
    bankBranch: emp?.bankBranch || "",
    bankHolder: emp?.bankHolder || "",
    bankUpi: emp?.bankUpi || "",
  });
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setDraft((p) => ({ ...p, [k]: v }));

  // When emp refreshes (enrichment from old bank_details, real-time update),
  // absorb newly-available values into draft fields that are still empty.
  // Never overwrite a field the employee has already typed into.
  useEffect(() => {
    if (!emp) return;
    setDraft((prev) => ({
      mobile: prev.mobile || emp.mobile || "",
      dob: prev.dob || emp.dob || "",
      personalEmail: prev.personalEmail || emp.personalEmail || "",
      address: prev.address || emp.address || "",
      bankAccount: prev.bankAccount || emp.bankAccount || "",
      bankName: prev.bankName || emp.bankName || "",
      bankIfsc: prev.bankIfsc || emp.bankIfsc || "",
      bankBranch: prev.bankBranch || emp.bankBranch || "",
      bankHolder: prev.bankHolder || emp.bankHolder || "",
      bankUpi: prev.bankUpi || emp.bankUpi || "",
    }));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [emp?.bankAccount, emp?.bankHolder, emp?.bankIfsc, emp?.mobile, emp?.dob, emp?.personalEmail, emp?.bankUpi]);

  const handleSave = async () => {
    if (!onSave) return;
    setSaving(true);
    await onSave(draft);
    setSaving(false);
    setOpen(false);
  };
  const isComplete = !!(draft.mobile && draft.dob && draft.personalEmail && draft.address &&
    draft.bankHolder && draft.bankAccount && draft.bankName && draft.bankIfsc && draft.bankBranch);
  const borderCol = dark ? "rgba(255,255,255,.1)" : "#E9EEF4";
  const bg = dark ? "#1E293B" : "#F8FAFC";
  return (
    <div style={{ marginTop: 18, border: `1px solid ${borderCol}`, borderRadius: 12, overflow: "hidden" }}>
      <button onClick={() => setOpen((v) => !v)} style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px", background: bg, border: "none", cursor: "pointer" }}>
        <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ width: 26, height: 26, borderRadius: 7, background: "#EFF6FF", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#2563EB" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="4"/><path d="M20 21a8 8 0 1 0-16 0"/></svg>
          </span>
          <span style={{ fontSize: 13, fontWeight: 700, color: dark ? "#E2E8F0" : "#0F172A" }}>Personal &amp; Bank Details</span>
          {!isComplete && <span style={{ fontSize: 10.5, background: "#FFF7ED", color: "#EA580C", border: "1px solid #FED7AA", borderRadius: 20, padding: "1px 8px", fontWeight: 600 }}>Incomplete</span>}
        </span>
        <span style={{ fontSize: 18, color: "#94A3B8" }}>{open ? "▲" : "▼"}</span>
      </button>
      {open && (
        <div style={{ padding: "16px", borderTop: `1px solid ${borderCol}` }}>
          <p style={{ margin: "0 0 14px", fontSize: 12, color: "#64748B" }}>These details are used for payroll, HR records and communication. Fill in what your admin hasn't provided yet.</p>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px 16px", marginBottom: 14 }}>
            {[
              { label: "Mobile Number", key: "mobile", placeholder: "+91 9876543210" },
              { label: "Date of Birth", key: "dob", type: "date" },
              { label: "Personal Email", key: "personalEmail", placeholder: "personal@email.com" },
            ].map(({ label, key, placeholder, type }) => (
              <label key={key} style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <span style={{ fontSize: 11.5, fontWeight: 600, color: "#475569" }}>{label}</span>
                <input type={type || "text"} className="sv-input" value={draft[key]} placeholder={placeholder}
                  onChange={(e) => set(key, e.target.value)} style={{ width: "100%" }} />
              </label>
            ))}
            <label style={{ display: "flex", flexDirection: "column", gap: 4, gridColumn: "1 / -1" }}>
              <span style={{ fontSize: 11.5, fontWeight: 600, color: "#475569" }}>Residential Address</span>
              <textarea className="sv-input" value={draft.address} rows={2} placeholder="Full residential address"
                onChange={(e) => set("address", e.target.value)} style={{ width: "100%", resize: "vertical" }} />
            </label>
          </div>
          <p style={{ margin: "0 0 10px", fontSize: 11.5, fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: "0.05em" }}>Bank Details</p>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px 16px", marginBottom: 16 }}>
            {[
              { label: "Account Holder Name", key: "bankHolder", placeholder: "As per bank records" },
              { label: "Account Number", key: "bankAccount", placeholder: "XXXXXXXXXXXX" },
              { label: "Bank Name", key: "bankName", placeholder: "e.g. HDFC Bank" },
              { label: "IFSC Code", key: "bankIfsc", placeholder: "e.g. HDFC0001234" },
              { label: "Branch Location", key: "bankBranch", placeholder: "e.g. Pune Main" },
              { label: "UPI ID (optional)", key: "bankUpi", placeholder: "name@bank" },
            ].map(({ label, key, placeholder }) => (
              <label key={key} style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <span style={{ fontSize: 11.5, fontWeight: 600, color: "#475569" }}>{label}</span>
                <input className="sv-input" value={draft[key]} placeholder={placeholder}
                  onChange={(e) => set(key, e.target.value)} style={{ width: "100%" }} />
              </label>
            ))}
          </div>
          <button onClick={handleSave} disabled={saving} style={{ background: saving ? "#93C5FD" : "#2563EB", color: "#fff", border: "none", borderRadius: 8, padding: "9px 22px", fontSize: 13, fontWeight: 600, cursor: saving ? "default" : "pointer" }}>
            {saving ? "Saving…" : "Save Profile Details"}
          </button>
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

function BankDetailsSection({ record, onSave, dark }) {
  const has = !!(record && (record.recipientName || record.accountNumber || record.ifscCode || record.upiId));
  const [editing, setEditing] = useState(!has);
  const [form, setForm] = useState({
    recipientName: record?.recipientName || "", accountNumber: record?.accountNumber || "",
    ifscCode: record?.ifscCode || "", upiId: record?.upiId || "",
  });
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  useEffect(() => {
    setForm({ recipientName: record?.recipientName || "", accountNumber: record?.accountNumber || "", ifscCode: record?.ifscCode || "", upiId: record?.upiId || "" });
  }, [record]);

  const submit = async () => {
    setMsg("");
    if (!form.recipientName.trim() || !form.accountNumber.trim() || !form.ifscCode.trim()) { setMsg("Recipient name, account number and IFSC are required."); return; }
    setSaving(true);
    const ok = await onSave(form);
    setSaving(false);
    if (ok) { setMsg("✅ Bank details saved."); setEditing(false); setTimeout(() => setMsg(""), 2500); }
    else setMsg("❌ Could not save. Try again.");
  };

  const lbl = { fontSize: 11, fontWeight: 700, color: "#64748B", marginBottom: 4, display: "block" };
  const val = { fontSize: 13.5, fontWeight: 600, color: dark ? "#E2E8F0" : "#0F172A" };

  return (
    <div style={{ marginTop: 20, paddingTop: 16, borderTop: "1px solid #E2E8F0" }}>
      <div className="sv-flex sv-justify-between sv-items-center" style={{ marginBottom: 12 }}>
        <div>
          <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: dark ? "#E2E8F0" : "#0F172A" }}>🏦 Bank Details</p>
          <p style={{ margin: 0, fontSize: 11, color: "#64748B" }}>Your admin uses this to pay your salary. Keep it accurate.</p>
        </div>
        {!editing && (
          <button onClick={() => setEditing(true)} style={{ padding: "6px 14px", background: "#1D4ED8", color: "#fff", border: "none", borderRadius: 7, cursor: "pointer", fontWeight: 700, fontSize: 12 }}>Edit</button>
        )}
      </div>
      {editing ? (
        <div style={{ display: "grid", gap: 10 }}>
          <div className="sv-grid-2" style={{ gap: 10 }}>
            <label><span style={lbl}>Recipient Name *</span><input className="sv-input" value={form.recipientName} onChange={(e) => setForm({ ...form, recipientName: e.target.value })} placeholder="As per bank account" /></label>
            <label><span style={lbl}>Account Number *</span><input className="sv-input" value={form.accountNumber} onChange={(e) => setForm({ ...form, accountNumber: e.target.value })} placeholder="Bank account number" /></label>
            <label><span style={lbl}>IFSC Code *</span><input className="sv-input" value={form.ifscCode} onChange={(e) => setForm({ ...form, ifscCode: e.target.value.toUpperCase() })} placeholder="e.g. HDFC0001234" /></label>
            <label><span style={lbl}>UPI ID <span style={{ fontWeight: 500, color: "#94A3B8" }}>(optional)</span></span><input className="sv-input" value={form.upiId} onChange={(e) => setForm({ ...form, upiId: e.target.value })} placeholder="name@bank" /></label>
          </div>
          {msg && <p style={{ margin: 0, fontSize: 12, fontWeight: 600, color: msg.startsWith("✅") ? "#16A34A" : "#DC2626" }}>{msg}</p>}
          <div className="sv-flex sv-gap-2">
            <button onClick={submit} disabled={saving} style={{ padding: "9px 20px", background: "#16A34A", color: "#fff", border: "none", borderRadius: 8, cursor: saving ? "not-allowed" : "pointer", fontWeight: 700, fontSize: 13, opacity: saving ? 0.7 : 1 }}>{saving ? "Saving…" : "Save"}</button>
            {has && <button onClick={() => { setEditing(false); setMsg(""); setForm({ recipientName: record?.recipientName || "", accountNumber: record?.accountNumber || "", ifscCode: record?.ifscCode || "", upiId: record?.upiId || "" }); }} style={{ padding: "9px 20px", background: "#F1F5F9", color: "#64748B", border: "none", borderRadius: 8, cursor: "pointer", fontWeight: 700, fontSize: 13 }}>Cancel</button>}
          </div>
        </div>
      ) : (
        <div className="sv-grid-2" style={{ gap: 12 }}>
          <div><span style={lbl}>Recipient Name</span><div style={val}>{record?.recipientName || "—"}</div></div>
          <div><span style={lbl}>Account Number</span><div style={val}>{record?.accountNumber || "—"}</div></div>
          <div><span style={lbl}>IFSC Code</span><div style={val}>{record?.ifscCode || "—"}</div></div>
          <div><span style={lbl}>UPI ID</span><div style={val}>{record?.upiId || "—"}</div></div>
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

function EmployeeAttendanceCalendar({ emp, submissions = [], allLeaves = [], attendanceOverrides = [], dark }) {
  const [calMonth, setCalMonth] = useState(() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1); });
  const y = calMonth.getFullYear(), mo = calMonth.getMonth();
  const monthLbl = calMonth.toLocaleDateString("en-IN", { month: "long", year: "numeric" });
  const pad = (n) => String(n).padStart(2, "0");
  const keyOf = (day) => `${y}-${pad(mo + 1)}-${pad(day)}`;
  const daysInMonth = new Date(y, mo + 1, 0).getDate();
  const dowOf = (day) => new Date(y, mo, day).getDay();
  const todayKey = new Date().toISOString().slice(0, 10);
  const firstDow = new Date(y, mo, 1).getDay();
  const cells = []; for (let i = 0; i < firstDow; i++) cells.push(null); for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  const STc = {
    present: { bg: "#DCFCE7", bd: "#86EFAC", fg: "#15803D", label: "Present" },
    leave: { bg: "#FEE2E2", bd: "#FCA5A5", fg: "#B91C1C", label: "Leave" },
    absent: { bg: "#E2E8F0", bd: "#94A3B8", fg: "#334155", label: "Absent" },
    half: { bg: "#FEF3C7", bd: "#FDE68A", fg: "#B45309", label: "Half Day" },
    holiday: { bg: "#EDE9FE", bd: "#C4B5FD", fg: "#6D28D9", label: "Holiday" },
    weekend: { bg: "#F1F5F9", bd: "#E2E8F0", fg: "#94A3B8", label: "Weekend" },
    none: { bg: dark ? "#1E293B" : "#fff", bd: dark ? "#334155" : "#EEF2F7", fg: "#CBD5E1", label: "No data" },
  };
  const overrideMap = Object.fromEntries((attendanceOverrides || []).map((o) => [`${o.empId}|${o.date}`, o]));
  const ovKey = (s) => ({ "Present": "present", "Half Day": "half", "Leave": "leave", "Absent": "absent", "Holiday": "holiday" }[s] || "present");
  const leaveDates = new Set();
  (allLeaves || []).filter((l) => l.empId === emp.id && l.status === "Approved").forEach((l) => {
    try { let d = new Date(l.fromDate + "T00:00:00"); const end = new Date((l.toDate || l.fromDate) + "T00:00:00"); let g = 0;
      while (d <= end && g < 400) { leaveDates.add(`${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`); d.setDate(d.getDate() + 1); g++; } } catch { /* */ }
  });
  const subMap = {};
  (submissions || []).filter((s) => s.empId === emp.id).forEach((s) => { subMap[s.date] = s; });

  const statusOf = (day) => {
    const key = keyOf(day); const dow = dowOf(day);
    const ov = overrideMap[`${emp.id}|${key}`];
    if (ov) return ovKey(ov.status);
    if (leaveDates.has(key)) return "leave";
    const s = subMap[key];
    if (s) { if (s.attendance === "Absent") return "absent"; if (s.attendance === "Half Day") return "half"; return "present"; }
    if (dow === 0 || dow === 6) return "weekend";
    return "none";
  };

  let cP = 0, cL = 0, cA = 0, cH = 0;
  for (let d = 1; d <= daysInMonth; d++) { const st = statusOf(d); if (st === "present") cP++; else if (st === "leave") cL++; else if (st === "absent") cA++; else if (st === "half") cH++; }
  let workingDays = 0; for (let d = 1; d <= daysInMonth; d++) { const dw = dowOf(d); if (dw !== 0 && dw !== 6) workingDays++; }

  const cardBg = dark ? "#0F172A" : "#fff";
  const cardBd = dark ? "#1E293B" : "#EEF2F7";
  const legendItem = (k) => (<span key={k} style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11.5, color: dark ? "#94A3B8" : "#475569" }}><span style={{ width: 11, height: 11, borderRadius: 4, background: STc[k].bg, border: `1px solid ${STc[k].bd}` }} />{STc[k].label}</span>);

  return (
    <div className={dark ? "sv-card sv-dark" : "sv-card"} style={{ marginTop: 14 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10, marginBottom: 14 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ background: dark ? "#1E3A8A" : "rgba(37,99,235,.12)", color: "#2563EB", borderRadius: 8, padding: "6px 8px", display: "flex" }}><CalendarDays size={17} /></span>
          <div>
            <p className={dark ? "sv-text-white sv-font-800" : "sv-text-navy sv-font-800"} style={{ margin: 0, fontSize: 15.5 }}>My Attendance</p>
            <p className="sv-text-muted" style={{ margin: 0, fontSize: 11.5 }}>{workingDays} working days · {cP} present · {cL} leave{cA ? ` · ${cA} absent` : ""}{cH ? ` · ${cH} half day` : ""}</p>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 4, border: `1px solid ${cardBd}`, borderRadius: 10, padding: 3 }}>
          <button type="button" onClick={() => setCalMonth(new Date(y, mo - 1, 1))} style={{ border: "none", background: "transparent", cursor: "pointer", fontSize: 18, fontWeight: 700, color: "#64748B", padding: "2px 8px", borderRadius: 6 }}>‹</button>
          <span style={{ fontWeight: 800, color: dark ? "#E2E8F0" : "#162B55", fontSize: 13, minWidth: 120, textAlign: "center" }}>{monthLbl}</span>
          <button type="button" onClick={() => setCalMonth(new Date(y, mo + 1, 1))} style={{ border: "none", background: "transparent", cursor: "pointer", fontSize: 18, fontWeight: 700, color: "#64748B", padding: "2px 8px", borderRadius: 6 }}>›</button>
          <button type="button" onClick={() => { const d = new Date(); setCalMonth(new Date(d.getFullYear(), d.getMonth(), 1)); }} style={{ marginLeft: 4, border: "none", background: dark ? "#1E293B" : "#F1F5F9", color: "#64748B", borderRadius: 6, cursor: "pointer", padding: "4px 10px", fontSize: 11, fontWeight: 700 }}>Today</button>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 5 }}>
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((w) => <div key={w} style={{ textAlign: "center", fontSize: 10.5, fontWeight: 700, color: "#94A3B8", textTransform: "uppercase" }}>{w}</div>)}
        {cells.map((day, i) => {
          if (day == null) return <div key={`b${i}`} />;
          const st = statusOf(day); const c = STc[st]; const isToday = keyOf(day) === todayKey; const show = st !== "none" && st !== "weekend";
          return (
            <div key={day} title={`${monthLbl.split(" ")[0]} ${day} — ${c.label}`}
              style={{ minHeight: 50, borderRadius: 9, background: st === "weekend" ? (dark ? "#1E293B" : "#F8FAFC") : (show ? c.bg : (dark ? "#0F172A" : "#fff")), border: `1px solid ${isToday ? "#2563EB" : (show ? c.bd : cardBd)}`, padding: "5px 7px", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: show ? c.fg : "#64748B" }}>{day}</span>
              {show && <span style={{ fontSize: 8.5, fontWeight: 800, color: c.fg, textTransform: "uppercase" }}>{c.label}</span>}
            </div>
          );
        })}
      </div>

      <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginTop: 12, fontSize: 12.5, fontWeight: 600, alignItems: "center" }}>
        <span style={{ color: "#15803D" }}>{cP} Present</span>
        <span style={{ color: "#B91C1C" }}>{cL} Leave</span>
        {cH > 0 && <span style={{ color: "#B45309" }}>{cH} Half Day</span>}
        {cA > 0 && <span style={{ color: "#334155" }}>{cA} Absent</span>}
      </div>
      <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginTop: 8 }}>
        {["present", "leave", "absent", "half", "holiday", "weekend"].map(legendItem)}
      </div>
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
