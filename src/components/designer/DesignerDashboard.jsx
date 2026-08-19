/**
 * DesignerDashboard.jsx — the Designer portal (premium redesign).
 * Assigned projects only. Designer can: read client details + instructions,
 * view/download reference files, upload versioned drafts/samples/finals,
 * move the project through the shared workflow, log client-wise WORK ITEMS
 * with amounts (Cover Page, Layout, Ads, Revisions…), and track earnings.
 * Company expenses (subscriptions etc.) remain a separate submission.
 */
import { useState, useRef, useMemo } from "react";
import Sidebar from "../layout/Sidebar";
import { Palette, CreditCard, User, FileText, ArrowLeft, Wallet, Plus, Pencil, Trash2, IndianRupee, FolderOpen, Bell, AlertTriangle, Search } from "lucide-react";
import WorkflowTimeline, { buildRevisions } from "../design/WorkflowTimeline";
import { fmtDate, domainColor } from "../../utils/helpers";

const STEPS = [
  { key: "Draft", label: "Draft", color: "#64748B" },
  { key: "Sample Design", label: "Sample Design", color: "#7C3AED" },
  { key: "Client Review", label: "Client Review", color: "#0EA5E9" },
  { key: "Final CP/CS", label: "Final CP/CS", color: "#8B5CF6" },
  { key: "Index Page", label: "Index Page", color: "#0891B2" },
  { key: "Magazine", label: "Magazine", color: "#4F46E5" },
  { key: "Final Review", label: "Final Review", color: "#D97706" },
  { key: "Completed", label: "Completed", color: "#16A34A" },
];
const STEP_KEYS = STEPS.map((x) => x.key);
const STEP_ALIAS = {
  "Pending": "Draft", "Draft Started": "Draft", "Draft": "Draft", "Draft Sent": "Draft",
  "Cover Design": "Sample Design", "Cover Ready": "Sample Design", "Sample": "Sample Design", "Sample Ready": "Sample Design", "Sample Design": "Sample Design",
  "Admin Review": "Client Review", "Sent to Client": "Client Review", "Client Review": "Client Review",
  "Final CP/CS": "Final CP/CS", "CP/CS Review": "Final CP/CS",
  "Index Page": "Index Page", "Index Approval": "Index Page",
  "Content Designing": "Magazine", "Final Magazine": "Magazine", "Final Design Ready": "Magazine", "Final Uploaded": "Magazine", "Magazine": "Magazine",
  "Admin Final Review": "Final Review", "Final Review": "Final Review", "Revision Required": "Sample Design",
  "Approved": "Completed", "Completed": "Completed",
};
const dzCanon = (st) => STEP_ALIAS[st] || (STEP_KEYS.includes(st) ? st : "Draft");
const dzStep = (st) => STEP_KEYS.indexOf(dzCanon(st));
const dzProgress = (st) => { const i = dzStep(st); return i < 0 ? 0 : Math.round((i / (STEP_KEYS.length - 1)) * 100); };
/* Designer upload categories (label shown → internal workflow kind kept intact).
   "sample" = Sample CP/CS (once only), "cp" = Final CP/CS (combined), magazine, revised. */
const DZ_KINDS = { sample: "Sample CP/CS", cp: "Final CP/CS", magazine: "Magazine", revised: "Revised Files" };
const DZ_ONCE = []; // (no lock) — designer can always re-upload updated/revised files
const FILE_FOLDERS = [["draft", "Draft"], ["reference", "Client Draft"], ["images", "Client Images"], ["sample", "Samples"], ["cp", "Cover Page"], ["cs", "Cover Story"], ["index", "Index Page"], ["magazine", "Magazine"], ["revised", "Revised"], ["final", "Final"]];
const ADMIN_DRAFT_KINDS = ["draft", "reference", "images"];
const CO_CATEGORIES = ["Software Subscriptions", "Fonts / Assets", "Stock Images", "Printing", "Travel", "Equipment", "Miscellaneous"];
const WORK_PRESETS = ["Cover Page", "Cover Story", "Magazine", "Advertisement Page", "Back Cover", "Index Page", "Content Design", "Revision", "Other"];
const WORK_TYPES = [
  { name: "Cover Page", color: "#2563EB", bg: "rgba(37,99,235,.10)" },
  { name: "Cover Story", color: "#7C3AED", bg: "rgba(124,58,237,.10)" },
  { name: "Magazine", color: "#059669", bg: "rgba(5,150,105,.10)" },
];
const dzStatusStyle = (s) => { const st = STEPS.find((x) => x.key === dzCanon(s)) || STEPS[0]; return { bg: st.color + "1A", fg: st.color }; };
/* ── Costing / accounting model ── */
const WORK_STATUSES = ["Pending", "In Progress", "Under Review", "Completed", "Hold", "Approved"]; // admin-controlled
const normPay = (ps) => (ps === "Approved" ? "Ready for Payment" : (!ps || ps === "Unpaid") ? "Pending" : ps);
const PAY_STYLE_MAP = { "Pending": { bg: "#FEF3C7", fg: "#B45309" }, "Ready for Payment": { bg: "#DBEAFE", fg: "#1D4ED8" }, "Paid": { bg: "#DCFCE7", fg: "#15803D" }, "Rejected": { bg: "#FEE2E2", fg: "#B91C1C" } };
const WORK_STATUS_STYLE = (s) => ({ "Completed": { bg: "#DCFCE7", fg: "#15803D" }, "Approved": { bg: "#D1FAE5", fg: "#047857" }, "In Progress": { bg: "#DBEAFE", fg: "#1D4ED8" }, "Under Review": { bg: "#EDE9FE", fg: "#6D28D9" }, "Hold": { bg: "#FEE2E2", fg: "#B91C1C" } }[s] || { bg: "#F1F5F9", fg: "#64748B" });
const payStyle = (s) => ({ "Paid": { bg: "#DCFCE7", fg: "#15803D" }, "Approved": { bg: "#DBEAFE", fg: "#1D4ED8" }, "Rejected": { bg: "#FEE2E2", fg: "#B91C1C" } }[s] || { bg: "#FEF3C7", fg: "#B45309" });
const dzBadge = (t, st) => <span style={{ display: "inline-block", fontSize: 11.5, fontWeight: 700, padding: "3px 10px", borderRadius: 999, background: st.bg, color: st.fg }}>{t}</span>;
const fmtSize = (b) => (!b ? "" : b < 1024 ? b + " B" : b < 1048576 ? (b / 1024).toFixed(0) + " KB" : (b / 1048576).toFixed(1) + " MB");
const money = (n) => "₹" + Number(n || 0).toLocaleString("en-IN");
// Message screenshots: stored in activity.meta as a JSON array of URLs (or a bare URL for old rows).
const parseMsgImgs = (meta) => { const mm = meta || ""; if (!mm) return []; if (mm[0] === "[") { try { return (JSON.parse(mm) || []).filter(Boolean); } catch (e) { return []; } } return /^https?:\/\//.test(mm) ? [mm] : []; };

export default function DesignerDashboard({
  emp, logo, theme, toggleTheme, onLogout,
  designProjects = [], designArchive = [], designFiles = [], uploadDesignFile, deleteDesignFile, updateDesignProject,
  designActivity = [], changeProjectStatus, addProjectComment, uploadMessageImage,
  designWork = [], saveDesignWork, pushNotification,
  notifications = [], markNotificationRead, markAllNotificationsRead, clearNotifications,
  brandDomains = [],
  designExtra = { drafts: [], folders: {}, links: {}, fileFolders: {}, acks: {}, seen: {} }, releaseDesign, acknowledgeDesign, markDesignSeen, addDesignFolder, deleteDesignFolder,
  expenses = [], addExpense, showToast,
}) {
  const [tab, setTab] = useState("designs");
  const [openId, setOpenId] = useState(null);
  const [uploadKind, setUploadKind] = useState("sample");
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef(null);
  const [exp, setExp] = useState({ title: "", amount: "", currency: "INR", category: "Software Subscriptions", paymentDate: "", notes: "" });
  const [expSaving, setExpSaving] = useState(false);
  const blankW = { name: "Cover Page", amount: "", workStatus: "Completed", notes: "" };
  const [wForm, setWForm] = useState(blankW);
  const [wEdit, setWEdit] = useState(null); // work id being edited
  const [wProject, setWProject] = useState("");
  const [costSearch, setCostSearch] = useState("");
  const [costOpen, setCostOpen] = useState(null); // project id whose cost sheet is open
  const [addF, setAddF] = useState({ type: "Cover Page", amount: "", notes: "", proof: "" });
  const [editF, setEditF] = useState(null); // { id, amount, notes, reason }
  const [convoText, setConvoText] = useState("");
  const [convoImgs, setConvoImgs] = useState([]);   // pending screenshots (multiple)
  const [convoSending, setConvoSending] = useState(false);
  const addConvoFiles = (files) => { const imgs = [...(files || [])].filter((f) => f && f.type && f.type.startsWith("image/")); if (imgs.length) setConvoImgs((p) => [...p, ...imgs]); };
  const onConvoPaste = (e) => { const items = (e.clipboardData && e.clipboardData.items) || []; const files = []; for (const it of items) { if (it.kind === "file") { const f = it.getAsFile(); if (f && f.type.startsWith("image/")) files.push(f); } } if (files.length) { e.preventDefault(); addConvoFiles(files); } };
  const removeConvoImg = (i) => setConvoImgs((p) => p.filter((_, idx) => idx !== i));
  const sendConvo = async () => {
    if ((!convoText.trim() && convoImgs.length === 0) || !project) return;
    setConvoSending(true);
    const urls = [];
    for (const f of convoImgs) { if (uploadMessageImage) { const u = await uploadMessageImage(project.id, f); if (u) urls.push(u); } }
    const ok = await addProjectComment(project.id, "designer", emp.name, convoText, urls);
    setConvoSending(false);
    if (ok !== false) { setConvoText(""); setConvoImgs([]); }
  };
  const [flowAsk, setFlowAsk] = useState(null);
  const [notifOpen, setNotifOpen] = useState(false);
  const [uploadFolder, setUploadFolder] = useState(""); // target custom folder id ("" = none)
  const [newFolder, setNewFolder] = useState("");
  const [openFolders, setOpenFolders] = useState({}); // { [folderId]: true } — collapsed by default
  const toggleFolder = (id) => setOpenFolders((o) => ({ ...o, [id]: !o[id] }));
  const isDraftFile = (id) => (designExtra.drafts || []).includes(id);
  // Admin files newer than the designer's last acknowledgement stay flagged NEW so the designer
  // easily notices files the admin just sent (e.g. added to Client Draft after the first send).
  // Brand colour/logo (admin-configured) applied by companyName, falling back to the auto colour.
  const brandFor = (name) => { const n = String(name || "").trim().toLowerCase(); return (brandDomains || []).find((b) => String(b.name || "").trim().toLowerCase() === n) || null; };
  const hexToRgba = (hex, a) => { const h = String(hex || "").replace("#", ""); if (h.length !== 6) return `rgba(100,116,139,${a})`; const r = parseInt(h.slice(0, 2), 16), g = parseInt(h.slice(2, 4), 16), b = parseInt(h.slice(4, 6), 16); return `rgba(${r},${g},${b},${a})`; };
  const brandStyle = (name) => { const b = brandFor(name); if (b && b.color) return { solid: b.color, bg: hexToRgba(b.color, 0.12), fg: b.color }; return domainColor(name); };
  const brandZoom = (name) => { const b = brandFor(name); return (b && b.logoZoom) || 120; };
  const brandLogoStyle = (name) => ({ width: "100%", height: "100%", objectFit: "contain", transform: `scale(${brandZoom(name) / 100})` });
  const dzAckTs = (pid) => (designExtra.acks || {})[`designer:${pid}`] || "";
  const isNewAdminFile = (f) => f.uploadedByName === "Admin" && !isDraftFile(f.id) && String(f.createdAt || "") > String(dzAckTs(f.projectId));
  const ask = (message, onYes, onNo) => setFlowAsk({ message, onYes, onNo });

  // Match assigned projects by id, with a name fallback so a drifted/re-keyed
  // designer id can't hide a designer's own projects.
  const isMine = (p) => p.assignedDesigner === emp.id || (!!p.assignedDesignerName && !!emp.name && p.assignedDesignerName.trim().toLowerCase() === emp.name.trim().toLowerCase());
  // Projects the admin archived/deleted must disappear from the designer side too.
  const archivedIds = new Set((designArchive || []).map((a) => a.id));
  const isLive = (p) => !archivedIds.has(p.id);
  const myProjects = designProjects.filter((p) => isMine(p) && isLive(p));
  const unreadNotifs = (notifications || []).filter((n) => !n.read).length;
  const notifTimeAgo = (ts) => { const s2 = Math.floor((Date.now() - ts) / 1000); if (s2 < 60) return "just now"; const m2 = Math.floor(s2 / 60); if (m2 < 60) return m2 + "m ago"; const h2 = Math.floor(m2 / 60); if (h2 < 24) return h2 + "h ago"; return new Date(ts).toLocaleDateString(); };
  const project = myProjects.find((p) => p.id === openId) || null;
  // Design notification feed (designer) — from shared data (admin messages, status changes,
  // released admin files) so the designer reliably sees what the admin did. Unread = newer than seen.
  const dzSeenTs = (designExtra.seen || {})[emp.id] || "";
  const dzFeed = (() => {
    const ids = new Set(myProjects.map((p) => p.id));
    const nameOf = {}; myProjects.forEach((p) => { nameOf[p.id] = p.clientName; });
    const ev = [];
    (designActivity || []).forEach((a) => {
      if (!ids.has(a.projectId) || a.actorRole !== "admin") return;
      if (!["message", "status", "revision"].includes(a.type)) return;
      const kind = a.type === "message" ? (/changes requested/i.test(a.comment || "") ? "🔄 Changes requested" : "💬 Message") : a.type === "status" ? `→ ${a.meta || "Status"}` : "🔄 Changes requested";
      ev.push({ id: a.id, ts: a.createdAt, projectId: a.projectId, client: nameOf[a.projectId] || "", actor: a.actorName || "Admin", kind, text: (a.comment || a.meta || "").replace(/^🔄\s*Changes requested:\s*/i, "").slice(0, 90) });
    });
    (designFiles || []).forEach((f) => {
      if (!ids.has(f.projectId) || f.uploadedByName !== "Admin" || isDraftFile(f.id)) return;
      ev.push({ id: "f" + f.id, ts: f.createdAt, projectId: f.projectId, client: nameOf[f.projectId] || "", actor: "Admin", kind: "📎 New file", text: f.fileName });
    });
    ev.sort((a, b) => String(b.ts || "").localeCompare(String(a.ts || "")));
    return ev.slice(0, 40);
  })();
  const dzUnread = dzFeed.filter((e) => String(e.ts || "") > String(dzSeenTs)).length;
  const openDzNotif = () => { const willOpen = !notifOpen; setNotifOpen(willOpen); if (willOpen && markDesignSeen) markDesignSeen(emp.id); };
  const myExpenses = expenses.filter((e) => e.type === "company" && e.details && e.details.submittedBy === emp.id);
  const myWork = useMemo(() => (designWork || []).filter((w) => w.designerId === emp.id), [designWork, emp.id]);
  const projWork = project ? myWork.filter((w) => w.projectId === project.id) : [];

  const clearFile = () => { if (fileRef.current) fileRef.current.value = ""; };
  const [dragOver, setDragOver] = useState(false);
  const uploadOne = async (file) => { if (!file || !project) return; setUploading(true); await uploadDesignFile(project.id, uploadKind, file, emp.name, uploadFolder); setUploading(false); /* private draft — admin is NOT notified until Submit */ };
  const releaseMine = async () => { releaseDesign && await releaseDesign(project.id, "designer"); };
  // One clear "submit" action: release my draft files to the admin, optionally advance the stage,
  // and notify. Used by the stage buttons AND the always-available "Submit new files" button so a
  // designer can re-send updated work after changes are requested (no more getting stuck).
  const submitToAdmin = async (advanceTo) => {
    if (!project) return;
    await releaseMine();
    if (advanceTo) await setStatus(advanceTo);
    pushNotification && pushNotification(`${emp.name} submitted files for ${project.clientName}${advanceTo ? ` → ${advanceTo}` : ""}.`);
    showToast("Submitted to admin for review.");
  };
  const onUpload = async (e) => { const files = [...(e.target.files || [])]; for (const fl of files) await uploadOne(fl); if (fileRef.current) fileRef.current.value = ""; setUploadFolder(""); };
  const onDropFiles = async (e) => { e.preventDefault(); setDragOver(false); const files = [...((e.dataTransfer && e.dataTransfer.files) || [])]; for (const fl of files) await uploadOne(fl); setUploadFolder(""); };
  const setStatus = async (status) => { if (project) { await changeProjectStatus(project, status, "designer", emp.name); pushNotification && pushNotification(`${emp.name} set ${project.clientName} → ${status}.`); } };

  /* ── Work items ── */
  const addWork = (proj) => {
    if (!proj) { showToast("Pick a client project first.", "error"); return; }
    const amt = +wForm.amount || 0;
    if (!wForm.name || amt <= 0) { showToast("Enter work name and amount.", "error"); return; }
    const item = { id: `w${Date.now()}`, projectId: proj.id, clientName: proj.clientName, magazine: proj.magazineName || "", designerId: emp.id, designerName: emp.name, name: wForm.name, amount: amt, workStatus: wForm.workStatus, notes: wForm.notes.trim(), date: new Date().toISOString().slice(0, 10), payStatus: "Unpaid" };
    saveDesignWork([...(designWork || []), item]);
    setWForm(blankW);
    showToast("Work charge added.");
    pushNotification && pushNotification(`${emp.name} logged work "${item.name}" (${money(amt)}) for ${proj.clientName}.`);
  };
  const saveWorkEdit = (id, patch) => saveDesignWork((designWork || []).map((w) => (w.id === id ? { ...w, ...patch } : w)));
  const removeWork = (id) => saveDesignWork((designWork || []).filter((w) => w.id !== id));
  // ── Costing (designer): add a new cost record; edit an existing one (mandatory reason) ──
  const addCost = (proj) => {
    const amt = +addF.amount || 0;
    if (!addF.type || amt <= 0) { showToast("Pick a work type and enter an amount.", "error"); return; }
    if (!addF.notes.trim()) { showToast("A short note describing the work is required.", "error"); return; }
    ask("Add this cost and send it to the admin for review?", () => {
      const now = new Date().toISOString();
      const item = { id: `w${Date.now()}${Math.floor(Math.random() * 1000)}`, projectId: proj.id, clientName: proj.clientName, magazine: proj.magazineName || "", edition: proj.edition || "", designerId: emp.id, designerName: emp.name, name: addF.type, amount: amt, notes: addF.notes.trim(), proofUrl: addF.proof.trim(), workStatus: "Under Review", payStatus: "Pending", date: now.slice(0, 10), createdAt: now, updatedAt: now, history: [{ at: now, by: emp.name, action: "Created", reason: addF.notes.trim() }] };
      saveDesignWork([...(designWork || []), item]);
      setAddF({ type: "Cover Page", amount: "", notes: "", proof: "" });
      showToast("Cost added — sent to admin for review.");
      pushNotification && pushNotification(`${emp.name} added "${item.name}" (${money(amt)}) for ${proj.clientName} — pending review.`);
    });
  };
  const saveCostEdit = () => {
    if (!editF) return;
    const amt = +editF.amount || 0;
    if (amt <= 0) { showToast("Enter a valid amount.", "error"); return; }
    if (!editF.reason.trim()) { showToast("A reason for the edit is required.", "error"); return; }
    ask("Save these changes? The admin will see the reason and the edit history.", () => {
      const now = new Date().toISOString();
      saveDesignWork((designWork || []).map((w) => (w.id === editF.id ? { ...w, amount: amt, notes: editF.notes.trim(), payStatus: normPay(w.payStatus) === "Rejected" ? "Pending" : normPay(w.payStatus), updatedAt: now, history: [...(w.history || []), { at: now, by: emp.name, action: "Edited cost", reason: editF.reason.trim(), from: w.amount, to: amt }] } : w)));
      pushNotification && pushNotification(`${emp.name} edited a cost for ${editF.client || "a project"} — reason: ${editF.reason.trim()}`);
      setEditF(null);
    });
  };

  const submitExpense = async () => {
    if (!exp.title.trim()) { showToast("Enter an expense title.", "error"); return; }
    setExpSaving(true);
    const ok = await addExpense({ type: "company", title: exp.title, category: exp.category, clientName: exp.title, amount: exp.amount, currency: exp.currency, paymentDate: exp.paymentDate, paymentMethod: "", paymentStatus: "Pending", notes: exp.notes, details: { vendor: "", submittedBy: emp.id, submittedByName: emp.name } });
    setExpSaving(false);
    if (ok !== false) { setExp({ title: "", amount: "", currency: "INR", category: "Software Subscriptions", paymentDate: "", notes: "" }); showToast("Expense submitted for approval.", "success"); }
  };

  const sumW = (arr, f = () => true) => arr.filter(f).reduce((a, w) => a + (w.amount || 0), 0);
  const projTotals = { total: sumW(projWork), completed: sumW(projWork, (w) => w.workStatus === "Completed"), pending: sumW(projWork, (w) => w.workStatus === "Pending"), paid: sumW(projWork, (w) => w.payStatus === "Paid"), due: sumW(projWork, (w) => w.payStatus !== "Paid" && w.payStatus !== "Rejected") };
  const curMonth = new Date().toISOString().slice(0, 7);
  const earn = { paid: sumW(myWork, (w) => w.payStatus === "Paid"), due: sumW(myWork, (w) => w.payStatus !== "Paid" && w.payStatus !== "Rejected"), month: sumW(myWork, (w) => w.payStatus === "Paid" && String(w.date).startsWith(curMonth)), total: sumW(myWork) };
  const byClient = useMemo(() => { const m = {}; myWork.forEach((w) => { const k = w.clientName || "—"; m[k] = m[k] || { client: k, total: 0, paid: 0, due: 0 }; m[k].total += w.amount || 0; if (w.payStatus === "Paid") m[k].paid += w.amount || 0; else if (w.payStatus !== "Rejected") m[k].due += w.amount || 0; }); return Object.values(m); }, [myWork]);

  const meta = (l, v) => (<div className="sv-meta-cell"><div className="sv-meta-label">{l}</div><div className="sv-meta-value">{v || "—"}</div></div>);
  const field = (l, node) => (<label style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 12.5, fontWeight: 600, color: "var(--sv-text-2,#475569)" }}>{l}{node}</label>);
  const fileRow = (f, canDelete, isLatest) => {
    const isImg = /\.(png|jpe?g|svg|gif|webp)$/i.test(f.fileName);
    const draft = isDraftFile(f.id) && f.uploadedByName === emp.name; // my unsubmitted draft
    const isNew = isNewAdminFile(f);
    return (
      <div key={f.id} className={`sv-fileitem${isLatest ? " is-latest" : ""}${draft ? " is-draft" : ""}`} style={isNew ? { outline: "2px solid #F59E0B", outlineOffset: "-1px", background: "rgba(245,158,11,0.08)", borderRadius: 8 } : undefined}>
        {isImg ? <img src={f.fileUrl} alt="" style={{ width: 36, height: 36, borderRadius: 6, objectFit: "cover", flex: "none" }} />
          : <span style={{ width: 36, height: 36, borderRadius: 6, background: "var(--sv-surface-2,#F1F5F9)", display: "flex", alignItems: "center", justifyContent: "center", flex: "none" }}><FileText size={16} /></span>}
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: "var(--sv-text-1,#0F172A)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f.fileName}{isNew && <span style={{ marginLeft: 8, fontSize: 10.5, fontWeight: 800, color: "#B45309", background: "#FEF3C7", padding: "2px 7px", borderRadius: 999 }}>🆕 NEW</span>}{draft ? <span className="sv-file-draft">DRAFT · not submitted</span> : isLatest && <span className="sv-file-latest">LATEST</span>}</div>
          <div style={{ fontSize: 11, color: "var(--sv-text-3,#64748B)", marginTop: 2 }}>{"v" + f.version} · {fmtSize(f.sizeBytes)} · {f.uploadedByName} · {f.createdAt ? new Date(f.createdAt).toLocaleString() : ""}</div>
        </div>
        <a className="sv-btn sv-btn--sm sv-btn--ghost" href={f.fileUrl} target="_blank" rel="noreferrer">Open</a>
        <a className="sv-btn sv-btn--sm sv-btn--ghost" href={f.fileUrl} download={f.fileName}>Download</a>
        {canDelete && draft && <button className="sv-btn sv-btn--sm sv-btn--ghost" onClick={() => { setUploadKind(f.kind); setUploadFolder((designExtra.fileFolders || {})[f.id] || ""); ask(`Replace "${f.fileName}"? The current file is removed so you can upload a new one.`, () => deleteDesignFile(f)); }}>Replace</button>}
        {canDelete && <button className="sv-btn sv-btn--sm sv-btn--danger" onClick={() => ask(`Delete "${f.fileName}"? This cannot be undone.`, () => deleteDesignFile(f))}>Delete</button>}
      </div>
    );
  };

  return (
    <div className={`sv-app-shell${theme === "dark" ? " sv-dark" : ""}`}>
      <Sidebar
        logo={logo} brandTitle={emp.name} brandSubtitle="Designer" brandPhoto={emp.photo}
        theme={theme} onToggleTheme={toggleTheme}
        nav={[
          { key: "designs", label: "Designs", icon: <Palette size={18} />, badge: myProjects.filter((p) => p.status === "Draft Sent" || ["Sample Design", "Final CP/CS", "Index Page", "Magazine"].includes(dzCanon(p.status))).length || null },
          { key: "earnings", label: "Earnings", icon: <Wallet size={18} /> },
          { key: "expenses", label: "Client Work", icon: <CreditCard size={18} /> },
          { key: "profile", label: "Profile", icon: <User size={18} /> },
        ]}
        active={tab} onSelect={(k) => { setTab(k); setOpenId(null); }}
        onSignOut={onLogout}
      />
      <main className="sv-main">

        {/* ── DESIGNS: list (premium cards) ── */}
        {tab === "designs" && !project && (
          <div className="sv-tab">
            <div className="sv-flex sv-justify-between sv-items-center" style={{ position: "relative" }}>
              <h2 className="sv-tab-title" style={{ margin: 0 }}>My Design Projects</h2>
              <button className="sv-bell-btn" onClick={openDzNotif} title="Design updates" aria-label="Design updates">
                <Bell size={18} />
                {dzUnread ? <span className="sv-bell-dot">{dzUnread}</span> : null}
              </button>
              {notifOpen && (
                <>
                  <div className="sv-notif-backdrop" onClick={() => setNotifOpen(false)} />
                  <div className="sv-notif-panel">
                    <div className="sv-notif-panel-head"><strong>Design updates</strong><span className="sv-text-muted" style={{ fontSize: 11.5 }}>{dzFeed.length} recent</span></div>
                    {dzFeed.length === 0 ? (
                      <div className="sv-notif-empty">🔔 You're all caught up.</div>
                    ) : (
                      <div className="sv-notif-list">
                        {dzFeed.map((e) => { const unread = String(e.ts || "") > String(dzSeenTs); return (
                          <div key={e.id} className={`sv-notif-card${unread ? "" : " is-read"}`} onClick={() => { setNotifOpen(false); setOpenId(e.projectId); }} style={{ cursor: "pointer" }}>
                            <span className="sv-notif-dot" />
                            <div style={{ minWidth: 0, flex: 1 }}><div className="sv-notif-msg"><b>{e.client}</b> · {e.kind}{e.text ? ` — ${e.text}` : ""}</div><div className="sv-notif-time">{e.actor ? e.actor + " · " : ""}{e.ts ? notifTimeAgo(e.ts) : ""}</div></div>
                            {unread && <span className="sv-notif-unread" title="New" />}
                          </div>
                        ); })}
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
            {myProjects.length === 0 ? (
              <div className="sv-card"><div className="sv-leave-empty"><Palette size={30} /><span>No projects assigned yet. They'll appear here once an admin assigns you.</span></div></div>
            ) : (
              <div className="sv-dsn-grid">
                {myProjects.map((p) => {
                  const st = dzStatusStyle(p.status); const pct = dzProgress(p.status);
                  const files = designFiles.filter((x) => x.projectId === p.id && x.kind !== "reference").length;
                  const rev = p.status === "Revision Required";
                  return (
                    <div key={p.id} className="sv-dsn-card" onClick={() => setOpenId(p.id)} style={{ borderLeft: `4px solid ${brandStyle(p.companyName).solid}` }}>
                      <div className="sv-dsn-card-top">
                        <div style={{ minWidth: 0 }}><div className="sv-dsn-client">{p.clientName}</div>{p.companyName ? <span className="sv-domain-chip" style={{ background: brandStyle(p.companyName).bg, color: brandStyle(p.companyName).fg }}><span className="sv-domain-dot" style={{ background: brandStyle(p.companyName).solid }} />{p.companyName}</span> : <div className="sv-dsn-sub">—</div>}</div>
                        {dzBadge(p.priority, dzStatusStyle(p.priority))}
                      </div>
                      <div className="sv-dsn-mag">{p.magazineName || "Untitled magazine"}{p.edition ? ` · ${p.edition}` : ""}</div>
                      <div className="sv-dsn-stage-row">{dzBadge(p.status, st)}<span className="sv-dsn-pct">{pct}%</span></div>
                      <div className="sv-dsn-prog"><span style={{ width: `${pct}%`, background: brandStyle(p.companyName).solid }} /></div>
                      <div className="sv-dsn-meta" style={{ alignItems: "center" }}>
                        <span>📅 {p.dueDate ? fmtDate(p.dueDate) : "No due date"}</span>
                        <span>📎 {files} upload{files !== 1 ? "s" : ""}</span>
                        {rev && <span className="sv-dsn-over">● Revision</span>}
                        {brandFor(p.companyName) && brandFor(p.companyName).logo && <span title={p.companyName} style={{ marginLeft: "auto", flex: "none", height: 30, width: 92, display: "inline-flex", alignItems: "center", justifyContent: "center", overflow: "hidden", borderRadius: 6 }}><img src={brandFor(p.companyName).logo} alt={p.companyName} style={brandLogoStyle(p.companyName)} /></span>}
                      </div>
                      <div className="sv-dsn-actions"><button className="sv-chip-btn sv-chip-btn--violet" onClick={(e) => { e.stopPropagation(); setOpenId(p.id); }}>Open project</button></div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ── DESIGNS: project workspace ── */}
        {tab === "designs" && project && (
          <div className="sv-tab">
            <button className="sv-btn sv-btn--ghost" onClick={() => setOpenId(null)} style={{ marginBottom: 4 }}><ArrowLeft size={15} /> Back to projects</button>
            <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
              <h2 className="sv-tab-title" style={{ margin: 0 }}>{project.clientName}</h2>
              {project.companyName && <span className="sv-domain-chip" style={{ background: brandStyle(project.companyName).bg, color: brandStyle(project.companyName).fg }}><span className="sv-domain-dot" style={{ background: brandStyle(project.companyName).solid }} />{project.companyName}</span>}
              {brandFor(project.companyName) && brandFor(project.companyName).logo && <span title={project.companyName} style={{ marginLeft: "auto", flex: "none", height: 48, width: 136, display: "inline-flex", alignItems: "center", justifyContent: "center", border: "1px solid #EEF2F7", borderRadius: 12, background: "#fff", overflow: "hidden" }}><img src={brandFor(project.companyName).logo} alt={project.companyName} style={brandLogoStyle(project.companyName)} /></span>}
            </div>

            <div className="sv-card" style={project.companyName ? { borderTop: `3px solid ${brandStyle(project.companyName).solid}` } : undefined}>
              <div className="sv-dsn-stage-row" style={{ marginBottom: 8 }}>
                <span className="sv-text-navy sv-font-800" style={{ fontSize: 15 }}>{project.magazineName || "Project"}{project.edition ? ` · ${project.edition}` : ""}</span>
                <span className="sv-dsn-pct">{dzProgress(project.status)}%</span>
              </div>
              <div className="sv-dsn-prog" style={{ marginBottom: 14 }}><span style={{ width: `${dzProgress(project.status)}%`, background: brandStyle(project.companyName).solid }} /></div>
              {(() => {
                const sc = dzStatusStyle(project.status);
                const fc = designFiles.filter((f) => f.projectId === project.id).length;
                const la = (designActivity || []).filter((a) => a.projectId === project.id).reduce((m, a) => (a.createdAt > m ? a.createdAt : m), "");
                return (
                  <div className="sv-stagecard" style={{ marginBottom: 4 }}>
                    <div className="sv-stagecard-item"><span className="sv-stagecard-k">Stage</span><span className="sv-stagecard-badge" style={{ background: sc.bg, color: sc.fg }}>{dzCanon(project.status)}</span></div>
                    <div className="sv-stagecard-item"><span className="sv-stagecard-k">Due</span><span className="sv-stagecard-v">{project.dueDate ? fmtDate(project.dueDate) : "—"}</span></div>
                    <div className="sv-stagecard-item"><span className="sv-stagecard-k">Priority</span><span className="sv-stagecard-v">{project.priority || "—"}</span></div>
                    <div className="sv-stagecard-item"><span className="sv-stagecard-k">Files</span><span className="sv-stagecard-v">{fc}</span></div>
                    <div className="sv-stagecard-item"><span className="sv-stagecard-k">Updated</span><span className="sv-stagecard-v">{la ? new Date(la).toLocaleDateString() : "—"}</span></div>
                  </div>
                );
              })()}
              <div style={{ marginTop: 16 }}>
                <div className="sv-section-label">Workflow</div>
                {(() => {
                  const ci = dzStep(project.status); const lg = {};
                  (designActivity || []).filter((a) => a.projectId === project.id).slice().sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt))).forEach((a) => { const k = a.type === "created" ? "Draft" : (a.type === "status" ? dzCanon(a.meta) : null); if (k) lg[k] = { actor: a.actorName, time: a.createdAt ? new Date(a.createdAt).toLocaleString() : "" }; });
                  const stg = dzCanon(project.status);
                  const draftSent = project.status === "Draft Sent";
                  const OWNER = {
                    "Draft": ["Admin", "Admin is preparing the client draft"],
                    "Sample Design": ["You", "Prepare & submit the sample design"],
                    "Client Review": ["Admin", "Admin is reviewing your sample with the client"],
                    "Final CP/CS": ["You", "Submit the Cover Page + Cover Story"],
                    "Index Page": ["Admin", "Waiting for the admin to provide the index page"],
                    "Magazine": ["You", "Submit the full magazine layout"],
                    "Final Review": ["Admin", "Admin is doing the final review"],
                    "Completed": ["—", "Project complete — files delivered"],
                  };
                  const own = draftSent ? ["You", "Review the draft & start the sample"] : (OWNER[stg] || ["—", ""]);
                  const pct = stg === "Completed" ? 100 : Math.round(((draftSent ? 1 : ci) / (STEPS.length - 1)) * 100);
                  const isDone = stg === "Completed";
                  const allActs = (designActivity || []).filter((a) => a.projectId === project.id).slice().sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)));
                  const last = allActs[allActs.length - 1];
                  const changeAlert = last && last.type === "message" && /changes requested/i.test(last.comment || "") ? last : null;
                  return (<>
                    {changeAlert && (
                      <div className="sv-alertbar sv-alertbar--change">
                        <AlertTriangle size={16} />
                        <div><strong>Changes requested by {changeAlert.actorName}</strong><div className="sv-alertbar-msg">{(changeAlert.comment || "").replace(/^🔄\s*Changes requested:\s*/i, "")} · {changeAlert.createdAt ? new Date(changeAlert.createdAt).toLocaleString() : ""}</div></div>
                      </div>
                    )}
                    <WorkflowTimeline
                      steps={STEPS} currentIndex={ci} stepMeta={lg}
                      revisionsByStage={buildRevisions(designActivity, project.id, dzCanon, project.status)}
                      progress={pct} stageNumber={Math.min((draftSent ? 1 : ci) + 1, STEPS.length)} stageTitle={stg}
                      nextAction={isDone ? "" : `${own[0]} — ${own[1]}`}
                      statusLabel={own[0] === "You" ? "In Progress" : "Under Review"}
                      brand={project.companyName ? brandStyle(project.companyName).solid : ""}
                      logo={brandFor(project.companyName) && brandFor(project.companyName).logo ? brandFor(project.companyName).logo : ""}
                      logoZoom={brandZoom(project.companyName)}
                    />
                  </>);
                })()}
                <div className="sv-flow-actions">
                  {(() => {
                    const pf = designFiles.filter((f) => f.projectId === project.id);
                    const has = (k) => pf.some((f) => f.kind === k);
                    const st = project.status; const stg = dzCanon(st);
                    // New files the designer has added but not yet sent to the admin.
                    const pendingDrafts = pf.some((f) => f.uploadedByName === emp.name && isDraftFile(f.id));
                    const resubmitBtn = (label) => (
                      <button className="sv-flow-btn sv-flow-btn--ok" onClick={() => ask("Submit your updated files to the admin for review?", () => submitToAdmin(null))}>📤 {label}</button>
                    );
                    if (st === "Draft") return <p className="sv-flow-wait">⏳ Waiting for the admin to send the draft.</p>;
                    if (st === "Draft Sent") return (has("reference") || has("images") || has("draft"))
                      ? <button className="sv-flow-btn sv-flow-btn--ok" onClick={() => ask("Confirm you've received the draft and start the sample?", () => setStatus("Sample Design"))}>✓ Draft Received → Start Sample</button>
                      : <p className="sv-flow-wait">⏳ Draft not fully uploaded yet — you can request more files from the admin below.</p>;
                    if (stg === "Sample Design") return has("sample")
                      ? <button className="sv-flow-btn sv-flow-btn--ok" onClick={() => ask("Submit your Sample CP/CS to the admin for review? Files become visible to the admin only after this.", () => submitToAdmin("Client Review"))}>Submit Sample Design →</button>
                      : <p className="sv-flow-wait">📎 Upload your Sample CP/CS below — Submit unlocks once a file is added.</p>;
                    // Review/waiting stages: if the admin asked for changes, let the designer re-submit updated work.
                    if (stg === "Client Review") return pendingDrafts
                      ? resubmitBtn("Submit updated design to admin →")
                      : <p className="sv-flow-wait">⏳ Admin is reviewing your design. Upload updated files below to re-submit if changes were asked.</p>;
                    if (stg === "Final CP/CS") return has("cp")
                      ? <button className="sv-flow-btn sv-flow-btn--ok" onClick={() => ask("Submit the Final CP/CS to the admin?", () => submitToAdmin(null))}>Submit Final CP/CS →</button>
                      : <p className="sv-flow-wait">📎 Upload the Final CP/CS below to submit.</p>;
                    if (stg === "Index Page") return has("index")
                      ? <button className="sv-flow-btn sv-flow-btn--ok" onClick={() => ask("Confirm you've received the index and start the magazine?", () => setStatus("Magazine"))}>✓ Index Received → Start Magazine</button>
                      : <p className="sv-flow-wait">⏳ Waiting for the admin to upload the Index Page.</p>;
                    if (stg === "Magazine") return has("magazine")
                      ? <button className="sv-flow-btn sv-flow-btn--ok" onClick={() => ask("Submit the complete magazine to the admin?", () => submitToAdmin(null))}>Publish Magazine →</button>
                      : <p className="sv-flow-wait">📎 Upload the complete magazine (as “Magazine”) below to submit.</p>;
                    if (stg === "Final Review") return pendingDrafts
                      ? resubmitBtn("Submit updated files to admin →")
                      : <p className="sv-flow-wait">⏳ Admin is doing the final review. Upload updated files below to re-submit if changes were asked.</p>;
                    return <p className="sv-flow-done">✓ Project completed.</p>;
                  })()}
                </div>
              </div>
            </div>

            {/* Conversation with Admin */}
            <div className="sv-card">
              <div className="sv-section-label">Conversation with Admin</div>
              {(() => {
                const thread = (designActivity || []).filter((x) => x.projectId === project.id && x.type === "message").slice().sort((x, y) => String(x.createdAt).localeCompare(String(y.createdAt)));
                return (
                  <div className="sv-convo">
                    {thread.length === 0 ? <p className="sv-text-muted" style={{ fontSize: 12.5, margin: "6px 0" }}>No messages yet. Ask the admin anything about this project.</p> : (
                      <div className="sv-convo-thread">
                        {thread.map((m) => { const isChange = /changes requested/i.test(m.comment || ""); const imgs = parseMsgImgs(m.meta); return (
                          <div key={m.id} className={`sv-convo-row sv-convo-row--${m.actorRole === "designer" ? "me" : "them"}`}>
                            <div className={`sv-convo-bubble${isChange ? " sv-convo-bubble--change" : ""}`}>{isChange && <span className="sv-convo-tag"><AlertTriangle size={12} /> Change requested</span>}{(m.comment || "") && <div className="sv-convo-text">{(m.comment || "").replace(/^🔄\s*Changes requested:\s*/i, "")}</div>}{imgs.length > 0 && <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 6 }}>{imgs.map((u, i) => <a key={i} href={u} target="_blank" rel="noreferrer"><img src={u} alt="screenshot" style={{ maxWidth: imgs.length > 1 ? 150 : "100%", maxHeight: 220, borderRadius: 8, display: "block", border: "1px solid var(--sv-border,#e2e8f0)" }} /></a>)}</div>}<div className="sv-convo-meta">{m.actorName} · {m.createdAt ? new Date(m.createdAt).toLocaleString() : ""}</div></div>
                          </div>
                        ); })}
                      </div>
                    )}
                    <div className="sv-convo-compose">
                      <textarea className="sv-input" rows={2} value={convoText} onChange={(e) => setConvoText(e.target.value)} onPaste={onConvoPaste} placeholder="Reply to the admin…  (paste a screenshot with Ctrl+V)" style={{ resize: "vertical" }} />
                      {convoImgs.length > 0 && <div style={{ display: "flex", flexWrap: "wrap", gap: 8, margin: "8px 0" }}>{convoImgs.map((f, i) => <span key={i} style={{ position: "relative", display: "inline-block" }}><img src={URL.createObjectURL(f)} alt="" style={{ width: 56, height: 56, objectFit: "cover", borderRadius: 6, border: "1px solid var(--sv-border,#e2e8f0)" }} /><button onClick={() => removeConvoImg(i)} title="Remove" style={{ position: "absolute", top: -6, right: -6, width: 18, height: 18, borderRadius: 999, border: "none", background: "#EF4444", color: "#fff", fontSize: 12, lineHeight: "18px", cursor: "pointer" }}>×</button></span>)}</div>}
                      <div className="sv-flex sv-gap-2" style={{ alignItems: "center", flexWrap: "wrap" }}>
                        <label className="sv-btn sv-btn--sm sv-btn--ghost" style={{ cursor: "pointer" }}>📎 Screenshot<input type="file" accept="image/*" multiple hidden onChange={(e) => { addConvoFiles(e.target.files); e.target.value = ""; }} /></label>
                        <button className="sv-btn sv-btn--primary" style={{ marginLeft: "auto" }} disabled={convoSending || (!convoText.trim() && convoImgs.length === 0)} onClick={sendConvo}>{convoSending ? "Sending…" : "Send"}</button>
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>

            {/* File workspace — folders by kind */}
            <div className="sv-card">
              <div className="sv-flex sv-items-center sv-gap-2" style={{ marginBottom: 8 }}>
                <span className="sv-mod-icon"><FolderOpen size={16} /></span>
                <div><p className="sv-text-navy sv-font-800" style={{ margin: 0, fontSize: 15.5 }}>Files &amp; Versions</p><p className="sv-text-muted" style={{ margin: 0, fontSize: 12 }}>Upload your work — every file is versioned automatically</p></div>
              </div>
              {(() => {
                const projFiles = designFiles.filter((f) => f.projectId === project.id);
                const sampleExists = projFiles.some((f) => f.kind === "sample");
                const allFolders = (designExtra.folders || {})[project.id] || []; /* shared — visible to both sides */
                const hasPendingDrafts = projFiles.some((f) => f.uploadedByName === emp.name && isDraftFile(f.id));
                const fileFolders = designExtra.fileFolders || {};
                const visible = (f) => f.uploadedByName === emp.name || !isDraftFile(f.id); // own drafts + released
                const inFolder = (f, fid) => (fileFolders[f.id] || "") === fid;
                const newAdminFiles = projFiles.filter(isNewAdminFile);
                const latestNewTs = newAdminFiles.reduce((m, f) => (String(f.createdAt || "") > m ? String(f.createdAt) : m), "");
                return (<>
                  {newAdminFiles.length > 0 && (
                    <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", background: "#FFFBEB", border: "1px solid #FDE68A", color: "#92400E", borderRadius: 10, padding: "9px 12px", fontSize: 12.5, marginBottom: 10 }}>
                      <span>🆕 <b>{newAdminFiles.length} new file{newAdminFiles.length !== 1 ? "s" : ""}</b> from the admin — highlighted below until you acknowledge.</span>
                      <button className="sv-btn sv-btn--sm sv-btn--primary" style={{ marginLeft: "auto" }} onClick={() => ask(`Acknowledge ${newAdminFiles.length} new file(s)? The highlight will clear.`, () => acknowledgeDesign && acknowledgeDesign(project.id, latestNewTs, "designer"))}>✓ Acknowledge</button>
                    </div>
                  )}
                  <div className="sv-fileadd">
                    <div className={`sv-dropzone${dragOver ? " is-drag" : ""}`}
                      onDragOver={(e) => { e.preventDefault(); setDragOver(true); }} onDragLeave={() => setDragOver(false)} onDrop={onDropFiles}>
                      <label className="sv-form-label" style={{ margin: 0, whiteSpace: "nowrap" }}>Upload into:</label>
                      <select className="sv-select" value={uploadKind} onChange={(e) => setUploadKind(e.target.value)} style={{ maxWidth: 170 }} title="Files are filed automatically into this folder">
                        {Object.entries(DZ_KINDS).map(([k, l]) => { const lock = DZ_ONCE.includes(k) && sampleExists && dzCanon(project.status) !== "Sample Design"; return <option key={k} value={k} disabled={lock}>{l}{lock ? " (added)" : ""}</option>; })}
                      </select>
                      <input ref={fileRef} type="file" multiple onChange={onUpload} disabled={uploading} accept=".pdf,.ai,.psd,.png,.jpg,.jpeg,.svg,.docx,.zip,image/*" style={{ fontSize: 12.5 }} />
                      <span className="sv-dropzone-hint">{uploading ? "Uploading…" : `filed into “${DZ_KINDS[uploadKind] || uploadKind}” · stays private until you Submit`}</span>
                    </div>
                    <div className="sv-flex sv-gap-2" style={{ marginTop: 10, flexWrap: "wrap" }}>
                      {hasPendingDrafts && (
                        <button
                          className="sv-btn sv-btn--sm sv-btn--primary"
                          style={{ alignSelf: "center" }}
                          onClick={() => ask("Submit your new file(s) to the admin now?", () => submitToAdmin(dzCanon(project.status) === "Sample Design" ? "Client Review" : null))}
                        >
                          📤 Submit new file(s) to admin
                        </button>
                      )}
                    </div>
                  </div>
                  <div style={{ height: 14 }} />
                  {(() => {
                    const draftReleased = project.status !== "Draft";
                    // Clean auto-folders by kind — same premium structure the admin sees.
                    const KIND_COLOR = { draft: "#F59E0B", reference: "#0EA5E9", images: "#14B8A6", sample: "#7C3AED", cp: "#2563EB", cs: "#8B5CF6", index: "#0891B2", magazine: "#4F46E5", revised: "#EA580C", final: "#16A34A", other: "#64748B" };
                    const known = new Set(FILE_FOLDERS.map(([k]) => k));
                    const groups = FILE_FOLDERS
                      .filter(([kind]) => draftReleased || !ADMIN_DRAFT_KINDS.includes(kind))
                      .map(([kind, label]) => ({ kind, label, files: projFiles.filter((f) => visible(f) && f.kind === kind).sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1)) }))
                      .filter((g) => g.files.length);
                    const otherFiles = projFiles.filter((f) => visible(f) && !known.has(f.kind)).sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
                    if (otherFiles.length) groups.push({ kind: "other", label: "Other", files: otherFiles });
                    const sections = groups.map((g) => {
                      const key = "kind:" + g.kind;
                      const open = !openFolders[key]; // default OPEN; click collapses
                      const col = KIND_COLOR[g.kind] || "#64748B";
                      return (
                        <div key={g.kind} className={`sv-folder${open ? " is-open" : ""}`} style={{ borderLeft: `3px solid ${col}` }}>
                          <div className="sv-folder-head" onClick={() => toggleFolder(key)}>
                            <span className="sv-folder-caret">{open ? "▾" : "▸"}</span>
                            <FolderOpen size={15} className="sv-folder-ic" style={{ color: col }} />
                            <span className="sv-folder-name">{g.label}</span>
                            <span className="sv-folder-count">{g.files.length} file{g.files.length !== 1 ? "s" : ""}</span>
                          </div>
                          {open && <div className="sv-folder-body">{g.files.map((f, fi) => fileRow(f, !ADMIN_DRAFT_KINDS.includes(g.kind), fi === 0))}</div>}
                        </div>
                      );
                    });
                    if (!draftReleased) return <div className="sv-flow-wait" style={{ marginBottom: 12 }}>⏳ The admin hasn’t sent the draft yet. Client materials appear once released.{sections.length > 0 && <div style={{ marginTop: 10 }}>{sections}</div>}</div>;
                    if (sections.length === 0) return <p className="sv-text-muted" style={{ fontSize: 12.5 }}>No files yet.</p>;
                    return sections;
                  })()}
                </>);
              })()}
            </div>

            {/* Activity */}
            <div className="sv-card">
              <div className="sv-section-label">Activity &amp; Revision History</div>
              {(() => {
                const acts = designActivity.filter((a) => a.projectId === project.id).sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1)).slice(0, 10);
                if (!acts.length) return <p className="sv-text-muted" style={{ fontSize: 12.5, marginTop: 8 }}>No activity yet.</p>;
                return (
                  <div className="sv-activity-scroll" style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 8 }}>
                    {acts.map((a) => (
                      <div key={a.id} style={{ display: "flex", gap: 10 }}>
                        <div style={{ width: 8, height: 8, borderRadius: 999, background: a.type === "revision" ? "#C2410C" : a.type === "upload" ? "#2563EB" : a.type === "status" ? "#15803D" : a.type === "message" ? "#7C3AED" : "#94A3B8", marginTop: 5, flex: "none" }} />
                        <div style={{ fontSize: 12.5, color: "var(--sv-text-2,#334155)" }}>
                          <strong>{a.type === "created" ? "Project created" : a.type === "status" ? `Status → ${a.meta}` : a.type === "upload" ? `Uploaded ${a.meta}` : a.type === "revision" ? "Revision requested" : a.type === "message" ? "Message" : "Update"}</strong>
                          {(a.type === "revision" || a.type === "message") && a.comment ? <span> — {a.comment}</span> : null}
                          <span className="sv-text-muted"> · {a.actorName} · {a.createdAt ? new Date(a.createdAt).toLocaleString() : ""}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                );
              })()}
            </div>
          </div>
        )}


        {/* ── EARNINGS ── */}
        {tab === "earnings" && (
          <div className="sv-tab">
            <h2 className="sv-tab-title">Earnings</h2>
            <div className="sv-sal-kpis" style={{ gridTemplateColumns: "repeat(4,1fr)" }}>
              <div className="sv-sal-kpi"><span className="sv-sal-kpi-ic" style={{ background: "rgba(34,197,94,.1)", color: "#16A34A" }}><Wallet size={18} /></span><div><div className="sv-sal-kpi-v">{money(earn.paid)}</div><div className="sv-sal-kpi-l">Total earned</div></div></div>
              <div className="sv-sal-kpi"><span className="sv-sal-kpi-ic" style={{ background: "rgba(245,158,11,.12)", color: "#D97706" }}><IndianRupee size={18} /></span><div><div className="sv-sal-kpi-v">{money(earn.due)}</div><div className="sv-sal-kpi-l">Pending payment</div></div></div>
              <div className="sv-sal-kpi"><span className="sv-sal-kpi-ic" style={{ background: "rgba(37,99,235,.1)", color: "#2563EB" }}><CreditCard size={18} /></span><div><div className="sv-sal-kpi-v">{money(earn.month)}</div><div className="sv-sal-kpi-l">Paid this month</div></div></div>
              <div className="sv-sal-kpi"><span className="sv-sal-kpi-ic" style={{ background: "rgba(139,92,246,.12)", color: "#7C3AED" }}><Palette size={18} /></span><div><div className="sv-sal-kpi-v">{money(earn.total)}</div><div className="sv-sal-kpi-l">Total work value</div></div></div>
            </div>
            <div className="sv-card">
              <div className="sv-section-label">Client-wise Payment History</div>
              {byClient.length === 0 ? <p className="sv-text-muted" style={{ fontSize: 12.5, marginTop: 8 }}>No work logged yet.</p> : (
                <div className="sv-mailids-scroll" style={{ marginTop: 8 }}>
                  <table className="sv-mailids-table" style={{ minWidth: 480 }}>
                    <thead><tr>{["Client", "Total", "Paid", "Due"].map((h) => <th key={h}>{h}</th>)}</tr></thead>
                    <tbody>{byClient.map((c) => <tr key={c.client}><td className="sv-text-navy sv-font-700">{c.client}</td><td>{money(c.total)}</td><td style={{ color: "#16A34A", fontWeight: 700 }}>{money(c.paid)}</td><td style={{ color: "#D97706", fontWeight: 700 }}>{money(c.due)}</td></tr>)}</tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── CLIENT WORK (payment tracker) ── */}
        {tab === "expenses" && (() => {
          const q = costSearch.trim().toLowerCase();
          const itemsFor = (pid) => (designWork || []).filter((w) => w.designerId === emp.id && w.projectId === pid);
          const totalFor = (pid) => itemsFor(pid).reduce((a, w) => a + (Number(w.amount) || 0), 0);
          const payAgg = (pid) => {
            const its = itemsFor(pid); if (!its.length) return { label: "No costs", bg: "#F1F5F9", fg: "#94A3B8" };
            const ps = its.map((w) => normPay(w.payStatus));
            if (ps.every((x) => x === "Paid")) return { label: "Paid", ...PAY_STYLE_MAP["Paid"] };
            if (ps.some((x) => x === "Rejected")) return { label: "Needs fix", ...PAY_STYLE_MAP["Rejected"] };
            if (ps.some((x) => x === "Ready for Payment")) return { label: "Ready", ...PAY_STYLE_MAP["Ready for Payment"] };
            return { label: "Pending review", ...PAY_STYLE_MAP["Pending"] };
          };
          // Show assigned projects PLUS any project this designer has logged work on,
          // so their client work is never hidden by an assignment mismatch.
          const workedPids = new Set(myWork.map((w) => w.projectId));
          const visibleProjects = designProjects.filter((p) => (isMine(p) || workedPids.has(p.id)) && isLive(p));
          const rows = visibleProjects.filter((p) => !q || `${p.clientName} ${p.magazineName} ${p.companyName} ${p.edition}`.toLowerCase().includes(q));
          const openP = visibleProjects.find((p) => p.id === costOpen) || null;
          const openItems = openP ? itemsFor(openP.id).slice().sort((a, b) => String(b.createdAt || b.date).localeCompare(String(a.createdAt || a.date))) : [];
          return (
            <div className="sv-tab">
              <h2 className="sv-tab-title">Client Work &amp; Costing</h2>
              <div className="sv-erp-kpis">
                <div className="sv-erp-kpi" style={{ "--k": "#059669" }}><div className="sv-erp-kpi-v">{money(earn.paid)}</div><div className="sv-erp-kpi-l">Paid to you</div></div>
                <div className="sv-erp-kpi" style={{ "--k": "#EA580C" }}><div className="sv-erp-kpi-v">{money(earn.due)}</div><div className="sv-erp-kpi-l">Awaiting payment</div></div>
                <div className="sv-erp-kpi" style={{ "--k": "#2563EB" }}><div className="sv-erp-kpi-v">{money(earn.month)}</div><div className="sv-erp-kpi-l">Paid this month</div></div>
                <div className="sv-erp-kpi" style={{ "--k": "#7C3AED" }}><div className="sv-erp-kpi-v">{money(earn.total)}</div><div className="sv-erp-kpi-l">Total logged</div></div>
              </div>
              <div className="sv-card">
                <div className="sv-flex sv-justify-between sv-items-center" style={{ flexWrap: "wrap", gap: 10, marginBottom: 12 }}>
                  <div><p className="sv-text-navy sv-font-800" style={{ margin: 0, fontSize: 15.5 }}>My Projects</p><p className="sv-text-muted" style={{ margin: 0, fontSize: 12 }}>Add or edit your work costs per project. Admin reviews &amp; pays.</p></div>
                  <div className="sv-mailids-search"><Search size={14} /><input placeholder="Search client / magazine / edition…" value={costSearch} onChange={(e) => setCostSearch(e.target.value)} /></div>
                </div>
                {rows.length === 0 ? (
                  <div className="sv-leave-empty"><IndianRupee size={26} /><span>No projects match your search.</span></div>
                ) : (
                  <div className="sv-erp-scroll">
                    <table className="sv-erp-table">
                      <thead><tr>{["Client", "Edition", "Project Status", "Total Value", "Payment", "Cost"].map((h) => <th key={h}>{h}</th>)}</tr></thead>
                      <tbody>
                        {rows.map((p) => { const st = dzStatusStyle(p.status); const agg = payAgg(p.id); const n = itemsFor(p.id).length; return (
                          <tr key={p.id}>
                            <td><div className="sv-text-navy sv-font-700" style={{ fontSize: 13 }}>{p.clientName}</div><div className="sv-text-muted" style={{ fontSize: 11 }}>{p.magazineName || p.companyName || "—"}</div></td>
                            <td className="sv-text-muted" style={{ fontSize: 12.5 }}>{p.edition || "—"}</td>
                            <td>{dzBadge(dzCanon(p.status), st)}</td>
                            <td><span className="sv-text-navy sv-font-700">{money(totalFor(p.id))}</span> <span className="sv-text-muted" style={{ fontSize: 11 }}>· {n} item{n !== 1 ? "s" : ""}</span></td>
                            <td><span className="sv-erp-chip" style={{ background: agg.bg, color: agg.fg }}>{agg.label}</span></td>
                            <td><button className="sv-btn sv-btn--sm sv-btn--primary" onClick={() => { setCostOpen(p.id); setAddF({ type: "Cover Page", amount: "", notes: "", proof: "" }); }}>Add / Edit Cost</button></td>
                          </tr>
                        ); })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {openP && (
                <div className="sv-modal-overlay" onClick={() => setCostOpen(null)}>
                  <div className="sv-modal" style={{ maxWidth: 720, maxHeight: "88vh", display: "flex", flexDirection: "column" }} onClick={(e) => e.stopPropagation()}>
                    <div className="sv-modal-header" style={{ flexShrink: 0 }}>
                      <span className="sv-text-navy sv-font-800" style={{ fontSize: 16 }}>{openP.clientName} · Costs</span>
                      <button className="sv-modal-close" onClick={() => setCostOpen(null)}>×</button>
                    </div>
                    <div style={{ overflowY: "auto", padding: "16px 20px" }}>
                      <p className="sv-text-muted" style={{ fontSize: 12, marginTop: 0 }}>{openP.magazineName || "—"}{openP.edition ? ` · ${openP.edition}` : ""} · Total {money(totalFor(openP.id))}</p>
                      <div className="sv-section-label">Existing costs</div>
                      {openItems.length === 0 ? <p className="sv-text-muted" style={{ fontSize: 12.5 }}>No costs yet — add your first below.</p> : (
                        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 16 }}>
                          {openItems.map((w) => { const paid = normPay(w.payStatus) === "Paid"; return (
                            <div key={w.id} className="sv-erp-item">
                              <div style={{ minWidth: 0, flex: 1 }}>
                                <div className="sv-erp-item-top"><span className="sv-erp-item-name">{w.name}</span><span className="sv-erp-item-amt">{money(w.amount)}</span></div>
                                <div className="sv-erp-item-sub">{dzBadge(w.workStatus || "Under Review", WORK_STATUS_STYLE(w.workStatus))} <span className="sv-erp-chip" style={{ ...PAY_STYLE_MAP[normPay(w.payStatus)] }}>{normPay(w.payStatus)}</span>{w.notes ? <span className="sv-text-muted"> · {w.notes}</span> : null}</div>
                                {(w.history || []).length > 0 && <div className="sv-text-muted" style={{ fontSize: 10.5, marginTop: 3 }}>Last: {w.history[w.history.length - 1].action} by {w.history[w.history.length - 1].by}{w.history[w.history.length - 1].reason ? ` — ${w.history[w.history.length - 1].reason}` : ""}</div>}
                              </div>
                              {w.proofUrl ? <a className="sv-btn sv-btn--sm sv-btn--ghost" href={w.proofUrl} target="_blank" rel="noreferrer">Proof</a> : null}
                              {paid ? <span className="sv-erp-chip" style={{ ...PAY_STYLE_MAP["Paid"] }}>Locked</span> : <button className="sv-btn sv-btn--sm sv-btn--ghost" onClick={() => setEditF({ id: w.id, amount: w.amount, notes: w.notes || "", reason: "", client: openP.clientName })}><Pencil size={12} /> Edit</button>}
                            </div>
                          ); })}
                        </div>
                      )}
                      <div className="sv-section-label">Add a new cost</div>
                      <div className="sv-erp-addgrid">
                        <label className="sv-team-ctl"><span>Work type</span><select className="sv-select" value={addF.type} onChange={(e) => setAddF({ ...addF, type: e.target.value })}>{WORK_PRESETS.map((n) => <option key={n} value={n}>{n}</option>)}</select></label>
                        <label className="sv-team-ctl"><span>Amount (₹)</span><input type="number" min="0" className="sv-input" value={addF.amount} onChange={(e) => setAddF({ ...addF, amount: e.target.value })} placeholder="0" /></label>
                        <label className="sv-team-ctl" style={{ gridColumn: "1 / -1" }}><span>Notes (required)</span><input className="sv-input" value={addF.notes} onChange={(e) => setAddF({ ...addF, notes: e.target.value })} placeholder="e.g. Cover page — 2 rounds, final delivered" /></label>
                        <label className="sv-team-ctl" style={{ gridColumn: "1 / -1" }}><span>Proof link (optional)</span><input className="sv-input" value={addF.proof} onChange={(e) => setAddF({ ...addF, proof: e.target.value })} placeholder="https://… (Drive/Dropbox link to proof)" /></label>
                      </div>
                      <button className="sv-btn sv-btn--primary" style={{ marginTop: 12 }} onClick={() => addCost(openP)}><Plus size={14} /> Add cost &amp; send for review</button>
                    </div>
                  </div>
                </div>
              )}

              {editF && (
                <div className="sv-modal-overlay" onClick={() => setEditF(null)}>
                  <div className="sv-modal" style={{ maxWidth: 460 }} onClick={(e) => e.stopPropagation()}>
                    <div className="sv-modal-header"><span className="sv-text-navy sv-font-800" style={{ fontSize: 16 }}>Edit cost</span><button className="sv-modal-close" onClick={() => setEditF(null)}>×</button></div>
                    <div style={{ padding: "16px 20px" }}>
                      <label className="sv-team-ctl" style={{ marginBottom: 10 }}><span>Amount (₹)</span><input type="number" min="0" className="sv-input" value={editF.amount} onChange={(e) => setEditF({ ...editF, amount: e.target.value })} /></label>
                      <label className="sv-team-ctl" style={{ marginBottom: 10 }}><span>Notes</span><input className="sv-input" value={editF.notes} onChange={(e) => setEditF({ ...editF, notes: e.target.value })} /></label>
                      <label className="sv-team-ctl"><span>Reason for this edit (required)</span><textarea className="sv-input" rows={2} value={editF.reason} onChange={(e) => setEditF({ ...editF, reason: e.target.value })} placeholder="Why is this cost changing?" style={{ resize: "vertical" }} /></label>
                      <div className="sv-flex sv-gap-2" style={{ justifyContent: "flex-end", marginTop: 14 }}>
                        <button className="sv-btn sv-btn--outline" onClick={() => setEditF(null)}>Cancel</button>
                        <button className="sv-btn sv-btn--primary" disabled={!editF.reason.trim()} onClick={saveCostEdit}>Save changes</button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })()}

        {/* ── PROFILE ── */}
        {tab === "profile" && (
          <div className="sv-tab">
            <h2 className="sv-tab-title">Profile</h2>
            <div className="sv-card" style={{ maxWidth: 460 }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                {meta("Name", emp.name)}{meta("Employee Code", emp.code)}{meta("Email", emp.email)}{meta("Department", emp.department)}
              </div>
              <p className="sv-text-muted" style={{ fontSize: 12, marginTop: 14 }}>To change your details, contact your admin.</p>
            </div>
          </div>
        )}
      </main>
      {flowAsk && (
        <div className="sv-modal-overlay" onClick={() => { flowAsk.onNo && flowAsk.onNo(); setFlowAsk(null); }}>
          <div className="sv-modal sv-confirm" onClick={(e) => e.stopPropagation()}>
            <p className="sv-confirm-msg">{flowAsk.message}</p>
            <p className="sv-confirm-sub">Do you want to proceed?</p>
            <div className="sv-confirm-actions">
              <button className="sv-btn sv-btn--outline" onClick={() => { flowAsk.onNo && flowAsk.onNo(); setFlowAsk(null); }}>No</button>
              <button className="sv-btn sv-btn--success" onClick={() => { const fn = flowAsk.onYes; setFlowAsk(null); fn && fn(); }}>Yes</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
