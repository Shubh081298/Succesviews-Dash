/**
 * DesignerDashboard.jsx — the Designer view (Phase 3 of the Design module).
 * Shown to a logged-in employee whose department is "Design". Reuses the
 * shared Sidebar + .sv-* styles. Designer can: see ONLY assigned projects,
 * read client details + instructions, view/download reference files, upload
 * their own drafts/samples/finals (auto-versioned), update project status,
 * and submit expenses. Cannot edit admin-entered project info.
 */
import { useState, useRef } from "react";
import Sidebar from "../layout/Sidebar";
import { Palette, CreditCard, User, FileText, ArrowLeft } from "lucide-react";
import { fmtDate } from "../../utils/helpers";

const DZ_STATUSES = ["Pending", "Draft Started", "Sample Ready", "Revision Required", "Final Design Ready", "Completed"];
const DZ_KINDS = { draft: "Draft", sample: "Sample", revised: "Revised", final: "Final" };
const CO_CATEGORIES = ["Software Subscriptions", "Fonts / Assets", "Stock Images", "Printing", "Travel", "Equipment", "Miscellaneous"];
const dzStatusStyle = (s) => ({
  "Pending": { bg: "#F1F5F9", fg: "#475569" },
  "Draft Started": { bg: "#FEE2E2", fg: "#B91C1C" },
  "Sample Ready": { bg: "#FEF3C7", fg: "#B45309" },
  "Revision Required": { bg: "#FFEDD5", fg: "#C2410C" },
  "Final Design Ready": { bg: "#DBEAFE", fg: "#1D4ED8" },
  "Completed": { bg: "#DCFCE7", fg: "#15803D" },
}[s] || { bg: "#F1F5F9", fg: "#475569" });
const dzBadge = (t, st) => <span style={{ display: "inline-block", fontSize: 11.5, fontWeight: 700, padding: "3px 10px", borderRadius: 999, background: st.bg, color: st.fg }}>{t}</span>;
const fmtSize = (b) => (!b ? "" : b < 1024 ? b + " B" : b < 1048576 ? (b / 1024).toFixed(0) + " KB" : (b / 1048576).toFixed(1) + " MB");

export default function DesignerDashboard({
  emp, logo, theme, toggleTheme, onLogout,
  designProjects = [], designFiles = [], uploadDesignFile, deleteDesignFile, updateDesignProject,
  expenses = [], addExpense, showToast,
}) {
  const [tab, setTab] = useState("designs");
  const [openId, setOpenId] = useState(null);
  const [uploadKind, setUploadKind] = useState("draft");
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef(null);
  const [exp, setExp] = useState({ title: "", amount: "", currency: "INR", category: "Software Subscriptions", paymentDate: "", notes: "" });
  const [expSaving, setExpSaving] = useState(false);

  const myProjects = designProjects.filter((p) => p.assignedDesigner === emp.id);
  const project = myProjects.find((p) => p.id === openId) || null;
  const myExpenses = expenses.filter((e) => e.type === "company" && e.details && e.details.submittedBy === emp.id);

  const onUpload = async (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file || !project) return;
    setUploading(true);
    await uploadDesignFile(project.id, uploadKind, file, emp.name);
    setUploading(false);
    if (fileRef.current) fileRef.current.value = "";
  };
  const setStatus = async (status) => { if (project) await updateDesignProject({ ...project, status }); };

  const submitExpense = async () => {
    if (!exp.title.trim()) { showToast("Enter an expense title.", "error"); return; }
    setExpSaving(true);
    const ok = await addExpense({
      type: "company", title: exp.title, category: exp.category, clientName: exp.title,
      amount: exp.amount, currency: exp.currency, paymentDate: exp.paymentDate,
      paymentMethod: "", paymentStatus: "Pending", notes: exp.notes,
      details: { vendor: "", submittedBy: emp.id, submittedByName: emp.name },
    });
    setExpSaving(false);
    if (ok !== false) { setExp({ title: "", amount: "", currency: "INR", category: "Software Subscriptions", paymentDate: "", notes: "" }); showToast("Expense submitted for approval.", "success"); }
  };

  const meta = (l, v) => (<div className="sv-meta-cell"><div className="sv-meta-label">{l}</div><div className="sv-meta-value">{v || "—"}</div></div>);
  const field = (l, node) => (<label style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 12.5, fontWeight: 600, color: "#475569" }}>{l}{node}</label>);
  const fileRow = (f, canDelete) => {
    const isImg = /\.(png|jpe?g|svg|gif|webp)$/i.test(f.fileName);
    return (
      <div key={f.id} className="sv-flex sv-gap-sm" style={{ alignItems: "center", border: "1px solid #E5E7EB", borderRadius: 10, padding: "8px 10px" }}>
        {isImg ? <img src={f.fileUrl} alt="" style={{ width: 36, height: 36, borderRadius: 6, objectFit: "cover", flex: "none" }} />
          : <span style={{ width: 36, height: 36, borderRadius: 6, background: "#F1F5F9", display: "flex", alignItems: "center", justifyContent: "center", flex: "none" }}><FileText size={16} /></span>}
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: "#0F172A", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f.fileName}</div>
          <div style={{ fontSize: 11, color: "#64748B", marginTop: 2 }}>{(DZ_KINDS[f.kind] || (f.kind === "reference" ? "Reference" : f.kind)) + " v" + f.version} · {fmtSize(f.sizeBytes)} · {f.uploadedByName} · {f.createdAt ? fmtDate(f.createdAt) : ""}</div>
        </div>
        <a className="sv-btn sv-btn--sm sv-btn--ghost" href={f.fileUrl} target="_blank" rel="noreferrer">Open</a>
        <a className="sv-btn sv-btn--sm sv-btn--ghost" href={f.fileUrl} download={f.fileName}>Download</a>
        {canDelete && <button className="sv-btn sv-btn--sm sv-btn--danger" onClick={() => deleteDesignFile(f)}>Delete</button>}
      </div>
    );
  };

  return (
    <div className={`sv-app-shell${theme === "dark" ? " sv-dark" : ""}`}>
      <Sidebar
        logo={logo} brandTitle={emp.name} brandSubtitle="Designer" brandPhoto={emp.photo}
        theme={theme} onToggleTheme={toggleTheme}
        nav={[
          { key: "designs", label: "Designs", icon: <Palette size={18} /> },
          { key: "expenses", label: "Expenses", icon: <CreditCard size={18} /> },
          { key: "profile", label: "Profile", icon: <User size={18} /> },
        ]}
        active={tab} onSelect={(k) => { setTab(k); setOpenId(null); }}
        onSignOut={onLogout}
      />
      <main className="sv-main">

        {/* ── DESIGNS: list ── */}
        {tab === "designs" && !project && (
          <div className="sv-tab">
            <h2 className="sv-tab-title">My Design Projects</h2>
            <div className="sv-card">
              {myProjects.length === 0 ? (
                <div style={{ textAlign: "center", padding: "40px 16px", color: "#64748B" }}>
                  <Palette size={40} />
                  <p style={{ fontWeight: 700, color: "#334155", margin: "8px 0 2px" }}>No projects assigned yet</p>
                  <p style={{ fontSize: 13, margin: 0 }}>When an admin assigns you a project, it appears here.</p>
                </div>
              ) : (
                <div style={{ overflowX: "auto" }}>
                  <table className="sv-table">
                    <thead><tr><th>Client</th><th>Magazine</th><th>Edition</th><th>Due</th><th>Priority</th><th>Status</th></tr></thead>
                    <tbody>
                      {myProjects.map((p) => (
                        <tr key={p.id} style={{ cursor: "pointer" }} onClick={() => setOpenId(p.id)}>
                          <td style={{ fontWeight: 600 }}>{p.clientName}</td>
                          <td>{p.magazineName || "—"}</td>
                          <td>{p.edition || "—"}</td>
                          <td>{p.dueDate ? fmtDate(p.dueDate) : "—"}</td>
                          <td>{p.priority}</td>
                          <td>{dzBadge(p.status, dzStatusStyle(p.status))}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── DESIGNS: project detail ── */}
        {tab === "designs" && project && (
          <div className="sv-tab">
            <button className="sv-btn sv-btn--ghost" onClick={() => setOpenId(null)} style={{ marginBottom: 4 }}><ArrowLeft size={15} /> Back to projects</button>
            <h2 className="sv-tab-title">{project.clientName}</h2>

            <div className="sv-card">
              <h3>Project Details</h3>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14, marginTop: 10 }}>
                {meta("Company", project.companyName)}
                {meta("Magazine", project.magazineName)}
                {meta("Edition", project.edition)}
                {meta("Due Date", project.dueDate ? fmtDate(project.dueDate) : "—")}
                {meta("Priority", project.priority)}
                {meta("Current Status", dzBadge(project.status, dzStatusStyle(project.status)))}
              </div>
              <div style={{ marginTop: 16 }}>
                <div className="sv-section-label">Update Status</div>
                <div className="sv-flex sv-gap-xs" style={{ flexWrap: "wrap", marginTop: 6 }}>
                  {DZ_STATUSES.map((s) => {
                    const st = dzStatusStyle(s); const active = project.status === s;
                    return <button key={s} onClick={() => setStatus(s)} style={{ fontSize: 12, fontWeight: 700, padding: "5px 11px", borderRadius: 999, cursor: "pointer", background: active ? st.bg : "#fff", color: active ? st.fg : "#64748B", border: `1px solid ${active ? st.bg : "#E5E7EB"}` }}>{s}</button>;
                  })}
                </div>
              </div>
              <div style={{ marginTop: 16 }}>
                <div className="sv-section-label">Instructions from Admin</div>
                <div style={{ background: "#F8FAFC", border: "1px solid #E2E8F0", borderRadius: 8, padding: "10px 12px", fontSize: 13.5, color: "#374151", lineHeight: 1.6, marginTop: 4, whiteSpace: "pre-wrap" }}>{project.instructions || "—"}</div>
              </div>
            </div>

            <div className="sv-card">
              <h3>Reference Files (from Admin)</h3>
              <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 10 }}>
                {designFiles.filter((f) => f.projectId === project.id && f.kind === "reference").length === 0
                  ? <p className="sv-text-muted" style={{ fontSize: 12.5 }}>No reference files uploaded yet.</p>
                  : designFiles.filter((f) => f.projectId === project.id && f.kind === "reference").sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1)).map((f) => fileRow(f, false))}
              </div>
            </div>

            <div className="sv-card">
              <h3>My Uploads (Drafts / Samples / Finals)</h3>
              <div className="sv-flex sv-gap-sm" style={{ margin: "10px 0 12px", flexWrap: "wrap", alignItems: "center" }}>
                <select className="sv-select" value={uploadKind} onChange={(e) => setUploadKind(e.target.value)} style={{ maxWidth: 150 }}>
                  {Object.entries(DZ_KINDS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
                </select>
                <input ref={fileRef} type="file" onChange={onUpload} disabled={uploading} accept=".pdf,.ai,.psd,.png,.jpg,.jpeg,.svg,.docx,.zip,image/*" style={{ fontSize: 12.5 }} />
                {uploading && <span className="sv-text-muted" style={{ fontSize: 12 }}>Uploading…</span>}
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {designFiles.filter((f) => f.projectId === project.id && f.kind !== "reference").length === 0
                  ? <p className="sv-text-muted" style={{ fontSize: 12.5 }}>No uploads yet. Pick a type and upload — every upload is versioned automatically.</p>
                  : designFiles.filter((f) => f.projectId === project.id && f.kind !== "reference").sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1)).map((f) => fileRow(f, true))}
              </div>
            </div>
          </div>
        )}

        {/* ── EXPENSES ── */}
        {tab === "expenses" && (
          <div className="sv-tab">
            <h2 className="sv-tab-title">Expenses</h2>
            <div className="sv-card">
              <h3>Submit an Expense</h3>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginTop: 10 }}>
                {field("Title *", <input className="sv-input" value={exp.title} onChange={(e) => setExp({ ...exp, title: e.target.value })} placeholder="e.g. Adobe subscription" />)}
                {field("Category", <select className="sv-select" value={exp.category} onChange={(e) => setExp({ ...exp, category: e.target.value })}>{CO_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}</select>)}
                {field("Amount", <input className="sv-input" type="number" value={exp.amount} onChange={(e) => setExp({ ...exp, amount: e.target.value })} placeholder="0.00" />)}
                {field("Currency", <select className="sv-select" value={exp.currency} onChange={(e) => setExp({ ...exp, currency: e.target.value })}>{["INR", "USD", "AED", "EUR", "GBP"].map((c) => <option key={c} value={c}>{c}</option>)}</select>)}
                {field("Date", <input className="sv-input" type="date" value={exp.paymentDate} onChange={(e) => setExp({ ...exp, paymentDate: e.target.value })} />)}
                <div />
                <div style={{ gridColumn: "1 / -1" }}>{field("Description", <textarea className="sv-input" rows={2} value={exp.notes} onChange={(e) => setExp({ ...exp, notes: e.target.value })} style={{ resize: "vertical" }} />)}</div>
              </div>
              <div style={{ marginTop: 12 }}>
                <button className="sv-btn sv-btn--primary" onClick={submitExpense} disabled={expSaving || !exp.title.trim()}>{expSaving ? "Submitting…" : "Submit for Approval"}</button>
              </div>
            </div>

            <div className="sv-card">
              <h3>My Submitted Expenses</h3>
              {myExpenses.length === 0 ? (
                <p className="sv-text-muted" style={{ fontSize: 12.5, marginTop: 8 }}>You haven't submitted any expenses yet.</p>
              ) : (
                <div style={{ overflowX: "auto", marginTop: 8 }}>
                  <table className="sv-table">
                    <thead><tr><th>Title</th><th>Category</th><th>Amount</th><th>Date</th><th>Status</th></tr></thead>
                    <tbody>
                      {myExpenses.map((e) => (
                        <tr key={e.id}>
                          <td style={{ fontWeight: 600 }}>{e.title}</td>
                          <td>{e.category || "—"}</td>
                          <td>{e.amount != null && e.amount !== "" ? `${Number(e.amount).toLocaleString(e.currency === "INR" ? "en-IN" : "en-US")} ${e.currency}` : "—"}</td>
                          <td>{e.paymentDate ? fmtDate(e.paymentDate) : "—"}</td>
                          <td>{dzBadge(e.paymentStatus || "Pending", (e.paymentStatus === "Paid" ? { bg: "#DCFCE7", fg: "#15803D" } : e.paymentStatus === "Rejected" ? { bg: "#FEE2E2", fg: "#B91C1C" } : { bg: "#FEF3C7", fg: "#B45309" }))}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── PROFILE ── */}
        {tab === "profile" && (
          <div className="sv-tab">
            <h2 className="sv-tab-title">Profile</h2>
            <div className="sv-card" style={{ maxWidth: 460 }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                {meta("Name", emp.name)}
                {meta("Employee Code", emp.code)}
                {meta("Email", emp.email)}
                {meta("Department", emp.department)}
                {meta("Team Lead", emp.teamLead)}
              </div>
              <p className="sv-text-muted" style={{ fontSize: 12, marginTop: 14 }}>To change your details, contact your admin.</p>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
