/**
 * AppDataContext.jsx — shared data layer, powered by Supabase.
 * The Employee Portal and Admin Portal both consume this context.
 */
import { createContext, useContext, useState, useEffect, useRef } from "react";
import { supabase } from "../utils/supabaseClient";
import { hashPassword } from "../utils/auth";
import { localDateStr } from "../utils/helpers";
import logoDefault from "../assets/successviews-logo.png";

const AppDataContext = createContext(null);

export function AppDataProvider({ children }) {
  /* ── State ───────────────────────────────────────────────── */
  const [loading, setLoading]               = useState(true);
  const [theme, setTheme]                   = useState("light");
  const [employees, setEmployees]           = useState([]);
  const [submissions, setSubmissions]       = useState([]);
  const [departments, setDepartments]       = useState(["Sales", "Operations", "Design"]);
  const [websites, setWebsites]             = useState([]);
  const [targets, setTargets]               = useState({
    emailsSent: 20, newLeads: 5, callsMade: 15,
    salesGenerated: 1000, followUps: 10, meetings: 2,
  });
  const [teamMeta, setTeamMeta]             = useState({});   // { [leadName]: { target, status } }
  const [freelancers, setFreelancers]       = useState([]);  // manual (non-user) payees
  const [ioMagazines, setIoMagazines]       = useState(null); // shared Insertion-Order magazine configs (null = not loaded from DB yet)
  const [designWork, setDesignWork]         = useState([]);  // designer client-wise work items
  const [designArchive, setDesignArchive]   = useState([]);  // soft-archived design projects
  const [designExtra, setDesignExtra]       = useState({ drafts: [], folders: {}, links: {}, fileFolders: {} }); // submit-gate + custom folders + links (settings-backed)
  const designExtraRef = useRef({ drafts: [], folders: {}, links: {}, fileFolders: {} }); // synchronous mirror to avoid stale-closure across sequential uploads
  const [customFields, setCustomFields]     = useState([]);
  const [announcements, setAnnouncements]   = useState([]);
  const [messages, setMessages]             = useState([]);
  const [leaves, setLeaves]                 = useState([]);
  const [attendanceOverrides, setAttendanceOverrides] = useState([]); // admin manual attendance edits
  const [salaries, setSalaries]             = useState({});
  const [bankDetails, setBankDetails]       = useState({});
  const [expenses, setExpenses]             = useState([]);
  const [designProjects, setDesignProjects] = useState([]);
  const [designFiles, setDesignFiles]       = useState([]);
  const [designActivity, setDesignActivity] = useState([]);
  const [logo, setLogo]                     = useState(logoDefault);
  const [adminPwd, setAdminPwdState]        = useState(""); // login is verified server-side (admin_login RPC); no client-side password
  const [adminEmail, setAdminEmailState]    = useState("");
  const [settingsPwd, setSettingsPwdState]  = useState("Settings@123");
  const [toast, setToast]                   = useState(null);
  const [notifications, setNotifications]   = useState([]);
  // ── Pipeline (Employee CRM) — additive; feeds the existing submissions rollup ──
  const [pipelineClients, setPipelineClients]     = useState([]);
  const [pipelineFollowups, setPipelineFollowups] = useState([]);
  const [pipelineContracts, setPipelineContracts] = useState([]);
  const [pipelineSales, setPipelineSales]         = useState([]);
  const [pipelinePayments, setPipelinePayments]   = useState([]);
  const [pipelineNotes, setPipelineNotes]         = useState([]);
  const [pipelineHistory, setPipelineHistory]     = useState([]);
  const [domains, setDomains]                     = useState([]);
  const [pipelineStatuses, setPipelineStatuses]   = useState([]);

  /* ── Bootstrap: load all data on mount ──────────────────── */
  useEffect(() => {
    loadAll();
  }, []);

  /* Keep data fresh across separate admin/employee sessions: refetch the
     frequently-changing tables when the tab regains focus and on an interval,
     so an admin sees newly submitted employee DSRs (and leaves/messages)
     without a manual full-page reload. */
  useEffect(() => {
    const refresh = () => { loadSubmissions(); loadLeaves(); loadMessages(); };
    const onVisible = () => { if (document.visibilityState === "visible") refresh(); };
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", onVisible);
    const iv = setInterval(refresh, 30000);
    return () => {
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", onVisible);
      clearInterval(iv);
    };
  }, []);

  /* Real-time sync: subscribe to Postgres changes and re-fetch the affected
     table instantly (debounced), so Admin ↔ Designer stay in sync without
     waiting for the poll. If Realtime isn't enabled on the tables server-side,
     no events arrive and the interval poll above still keeps things fresh. */
  useEffect(() => {
    const reloaders = {
      design_projects: loadDesignProjects,
      design_files: loadDesignFiles,
      design_activity: loadDesignActivity,
      submissions: loadSubmissions,
      leaves: loadLeaves,
      messages: loadMessages,
      settings: loadSettings,
      employees: loadEmployees,
      pipeline_clients: loadPipeline,
      pipeline_followups: loadPipeline,
      pipeline_sales: loadPipeline,
      pipeline_payments: loadPipeline,
      pipeline_contracts: loadPipeline,
    };
    const timers = {};
    const bump = (tbl) => { clearTimeout(timers[tbl]); timers[tbl] = setTimeout(() => { try { reloaders[tbl] && reloaders[tbl](); } catch (e) { /* ignore */ } }, 250); };
    let ch;
    try {
      ch = supabase.channel("svd-realtime");
      Object.keys(reloaders).forEach((tbl) => ch.on("postgres_changes", { event: "*", schema: "public", table: tbl }, () => bump(tbl)));
      ch.subscribe();
    } catch (e) { /* realtime unavailable — poll remains the fallback */ }
    return () => {
      Object.values(timers).forEach(clearTimeout);
      try { if (ch) supabase.removeChannel(ch); } catch (e) { /* ignore */ }
    };
  }, []);

  async function loadAll() {
    setLoading(true);
    try {
      await Promise.all([
        loadEmployees(),
        loadSubmissions(),
        loadDepartments(),
        loadWebsites(),
        loadCustomFields(),
        loadAnnouncements(),
        loadMessages(),
        loadLeaves(),
        loadAttendanceOverrides(),
        loadSalaries(),
        loadBankDetails(),
        loadExpenses(),
        loadDesignProjects(),
        loadDesignFiles(),
        loadDesignActivity(),
        loadSettings(),
        loadPipeline(),
      ]);
    } catch (e) {
      console.error("Failed to load data:", e);
    }
    setLoading(false);
  }

  /* ── Loaders ─────────────────────────────────────────────── */

  async function loadEmployees() {
    const { data, error } = await supabase
      .from("employees")
      .select("id, name, department, code, photo, team_lead, email, assigned_ids")
      .order("created_at");
    if (error) console.error("loadEmployees failed:", error.message);
    if (data) setEmployees(data.map(normalizeEmployee));
  }

  async function loadSubmissions() {
    const { data, error } = await supabase
      .from("submissions")
      .select("*")
      .order("date", { ascending: false });
    if (error) console.error("loadSubmissions failed:", error.message);
    if (data) setSubmissions(data.map(normalizeSubmission));
  }

  async function loadDepartments() {
    const { data } = await supabase.from("departments").select("name").order("name");
    if (data && data.length > 0) setDepartments(data.map((d) => d.name));
  }

  async function loadWebsites() {
    const { data } = await supabase.from("websites").select("name").order("name");
    if (data) setWebsites(data.map((w) => w.name));
  }

  async function loadCustomFields() {
    const { data } = await supabase.from("custom_fields").select("*").order("created_at");
    if (data) setCustomFields(data.map((f) => ({
      id: f.id, label: f.label, type: f.type, required: f.required,
    })));
  }

  async function loadAnnouncements() {
    const { data } = await supabase
      .from("announcements")
      .select("*")
      .order("created_at", { ascending: false });
    if (data) setAnnouncements(data.map((a) => ({
      id: a.id, text: a.text,
      departments: a.departments,
      dismissedBy: a.dismissed_by || [],
      ts: new Date(a.created_at).getTime(),
    })));
  }

  async function loadMessages() {
    const { data } = await supabase
      .from("messages")
      .select("*")
      .order("created_at", { ascending: false });
    if (data) setMessages(data.map((m) => ({
      id: m.id, empId: m.emp_id, text: m.text,
      dismissed: m.dismissed,
      ts: new Date(m.created_at).getTime(),
    })));
  }

  async function loadLeaves() {
    const { data } = await supabase
      .from("leaves")
      .select("*")
      .order("created_at", { ascending: false });
    if (data) setLeaves(data.map((l) => ({
      id: l.id, empId: l.emp_id, empName: l.emp_name,
      fromDate: l.from_date, toDate: l.to_date,
      reason: l.reason, status: l.status, remark: l.remark || "",
      ts: new Date(l.created_at).getTime(),
    })));
  }

  async function loadAttendanceOverrides() {
    try {
      const { data } = await supabase.from("attendance_overrides").select("*");
      if (data) setAttendanceOverrides(data.map((r) => ({
        id: r.id, empId: r.emp_id, date: r.date, status: r.status,
        remark: r.remark || "", prevStatus: r.prev_status || "", updatedBy: r.updated_by || "",
        updatedAt: r.updated_at || r.created_at,
      })));
    } catch (e) { /* table may not be migrated yet */ }
  }

  // Admin sets/updates an attendance status for one employee + date (one row per emp+date).
  async function saveAttendanceOverride({ empId, date, status, remark, prevStatus, updatedBy }) {
    try {
      const row = { emp_id: empId, date, status, remark: remark || null, prev_status: prevStatus || null, updated_by: updatedBy || "Admin", updated_at: new Date().toISOString() };
      const { data, error } = await supabase.from("attendance_overrides").upsert(row, { onConflict: "emp_id,date" }).select("*").single();
      if (error || !data) { showToast("Could not save attendance." + (error ? " " + error.message : ""), "error"); return false; }
      const rec = { id: data.id, empId: data.emp_id, date: data.date, status: data.status, remark: data.remark || "", prevStatus: data.prev_status || "", updatedBy: data.updated_by || "", updatedAt: data.updated_at };
      setAttendanceOverrides((prev) => { const i = prev.findIndex((x) => x.empId === rec.empId && x.date === rec.date); if (i === -1) return [rec, ...prev]; const c = prev.slice(); c[i] = rec; return c; });
      showToast("Attendance updated.", "success");
      return true;
    } catch (e) { showToast("Could not save attendance.", "error"); return false; }
  }

  async function loadSalaries() {
    const { data } = await supabase.from("salaries").select("*");
    if (data) {
      const map = {};
      data.forEach((s) => {
        map[s.emp_id] = {
          fixedSalary: s.fixed_salary,
          incentives: s.incentives || [],
          deductions: s.deductions || [],
          payments: s.payments || [],
          months: s.months || {},
        };
      });
      setSalaries(map);
    }
  }

  // ── Bank details (per employee) — additive; own table so it stays isolated ──
  async function loadBankDetails() {
    try {
      const { data, error } = await supabase.from("bank_details").select("*");
      if (error || !data) return; // table not migrated yet — feature degrades to empty
      const map = {};
      data.forEach((b) => {
        map[b.emp_id] = {
          recipientName: b.recipient_name || "",
          accountNumber: b.account_number || "",
          ifscCode: b.ifsc_code || "",
          upiId: b.upi_id || "",
        };
      });
      setBankDetails(map);
    } catch (e) { /* table missing — ignore */ }
  }

  // Single-row upsert so an employee only ever writes their OWN bank row.
  async function saveBankDetails(empId, bank) {
    if (!empId) return false;
    const clean = {
      recipientName: (bank.recipientName || "").trim(),
      accountNumber: (bank.accountNumber || "").trim(),
      ifscCode: (bank.ifscCode || "").trim().toUpperCase(),
      upiId: (bank.upiId || "").trim(),
    };
    setBankDetails((prev) => ({ ...prev, [empId]: clean }));
    try {
      const { error } = await supabase.from("bank_details").upsert({
        emp_id: empId,
        recipient_name: clean.recipientName,
        account_number: clean.accountNumber,
        ifsc_code: clean.ifscCode,
        upi_id: clean.upiId,
        updated_at: new Date().toISOString(),
      }, { onConflict: "emp_id" });
      if (error) { showToast("Bank details table not set up yet — ask admin to run the migration.", "error"); return false; }
      showToast("Bank details saved.", "success");
      return true;
    } catch (e) { showToast("Could not save bank details.", "error"); return false; }
  }

  // ── Domains (the ONE common website/domain list — feeds Pipeline + all DSRs) ──
  async function addDomain(name) {
    const nm = (name || "").trim();
    if (!nm) return false;
    if ((domains || []).some((d) => d.name.toLowerCase() === nm.toLowerCase())) { showToast("That domain already exists.", "error"); return false; }
    try {
      const { data, error } = await supabase.from("domains").insert({ domain_name: nm, status: true }).select("*").single();
      if (error || !data) { showToast("Could not add domain.", "error"); return false; }
      setDomains((prev) => [...prev, rowToDomain(data)].sort((a, b) => a.name.localeCompare(b.name)));
      showToast("Domain added.", "success");
      return true;
    } catch (e) { showToast("Could not add domain.", "error"); return false; }
  }
  async function updateDomain(id, name) {
    const nm = (name || "").trim();
    if (!nm) return false;
    try {
      const { error } = await supabase.from("domains").update({ domain_name: nm }).eq("id", id);
      if (error) { showToast("Could not update domain.", "error"); return false; }
      setDomains((prev) => prev.map((d) => (d.id === id ? { ...d, name: nm } : d)).sort((a, b) => a.name.localeCompare(b.name)));
      return true;
    } catch (e) { showToast("Could not update domain.", "error"); return false; }
  }
  async function deleteDomain(id) {
    try {
      const { error } = await supabase.from("domains").delete().eq("id", id);
      if (error) { showToast("Could not delete domain.", "error"); return false; }
      setDomains((prev) => prev.filter((d) => d.id !== id));
      showToast("Domain deleted.", "success");
      return true;
    } catch (e) { showToast("Could not delete domain.", "error"); return false; }
  }

  /* ── Expenses (contract payments — additive financial tracker) ── */
  const rowToExpense = (r) => ({
    id: r.id,
    type: r.type || "company",
    sourceKey: r.source_key || "",
    title: r.title || "",
    category: r.category || "",
    paymentStatus: r.payment_status || "",
    contractOrder: r.contract_order || "",
    clientName: r.client_name || "",
    paymentDate: r.payment_date || "",
    amount: r.amount,
    currency: r.currency || "INR",
    bankAmount: r.bank_amount,
    bankCurrency: r.bank_currency || "INR",
    paymentMethod: r.payment_method || "",
    notes: r.notes || "",
    details: r.details || {},
    createdAt: r.created_at,
  });
  const expenseToRow = (e) => ({
    type: e.type || "company",
    source_key: e.sourceKey || null,
    title: e.title || null,
    category: e.category || null,
    payment_status: e.paymentStatus || null,
    contract_order: e.contractOrder || null,
    client_name: e.clientName || null,
    payment_date: e.paymentDate || null,
    amount: e.amount === "" || e.amount === undefined ? null : e.amount,
    currency: e.currency || "INR",
    bank_amount: e.bankAmount === "" || e.bankAmount === undefined ? null : e.bankAmount,
    bank_currency: e.bankCurrency || "INR",
    payment_method: e.paymentMethod || null,
    notes: e.notes || null,
    details: e.details || {},
  });

  async function loadExpenses() {
    const { data } = await supabase
      .from("expenses")
      .select("*")
      .order("payment_date", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false });
    if (data) setExpenses(data.map(rowToExpense));
  }

  async function addExpense(exp) {
    const { data, error } = await supabase
      .from("expenses")
      .insert(expenseToRow(exp))
      .select("*")
      .single();
    if (!error && data) {
      setExpenses((prev) => [rowToExpense(data), ...prev]);
      showToast("Expense record added.", "success");
      return true;
    }
    showToast(`Failed to add expense${error ? ": " + error.message : ""}.`, "error");
    return false;
  }

  async function updateExpense(exp) {
    setExpenses((prev) => prev.map((x) => (x.id === exp.id ? { ...x, ...exp } : x)));
    const { error } = await supabase.from("expenses").update(expenseToRow(exp)).eq("id", exp.id);
    if (error) { showToast("Failed to update expense.", "error"); return false; }
    showToast("Expense record updated.", "success");
    return true;
  }

  async function deleteExpense(id) {
    const { error } = await supabase.from("expenses").delete().eq("id", id);
    if (!error) { setExpenses((prev) => prev.filter((x) => x.id !== id)); showToast("Expense record deleted.", "success"); }
    else showToast("Failed to delete expense.", "error");
  }

  // Auto-capture (upsert by source_key so re-download / re-pay updates the
  // same record instead of creating duplicates). Silent — used by modules.
  async function captureExpense(rec) {
    if (!rec || !rec.sourceKey) return;
    try {
      const { data, error } = await supabase
        .from("expenses")
        .upsert(expenseToRow(rec), { onConflict: "source_key" })
        .select("*")
        .single();
      if (error || !data) return;
      const mapped = rowToExpense(data);
      setExpenses((prev) => {
        const i = prev.findIndex((x) => x.sourceKey === mapped.sourceKey || x.id === mapped.id);
        if (i === -1) return [mapped, ...prev];
        const copy = prev.slice(); copy[i] = mapped; return copy;
      });
    } catch (e) { /* table may not be migrated yet — ignore silently */ }
  }

  /* ── Design Projects (Design Management module) ── */
  const rowToProject = (r) => ({
    id: r.id,
    clientName: r.client_name || "",
    companyName: r.company_name || "",
    magazineName: r.magazine_name || "",
    edition: r.edition || "",
    dueDate: r.due_date || "",
    priority: r.priority || "Medium",
    assignedDesigner: r.assigned_designer || "",
    assignedDesignerName: r.assigned_designer_name || "",
    status: r.status || "Pending",
    instructions: r.instructions || "",
    internalNotes: r.internal_notes || "",
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  });
  const projectToRow = (p) => ({
    client_name: p.clientName || null,
    company_name: p.companyName || null,
    magazine_name: p.magazineName || null,
    edition: p.edition || null,
    due_date: p.dueDate || null,
    priority: p.priority || "Medium",
    assigned_designer: p.assignedDesigner || null,
    assigned_designer_name: p.assignedDesignerName || null,
    status: p.status || "Pending",
    instructions: p.instructions || null,
    internal_notes: p.internalNotes || null,
    updated_at: new Date().toISOString(),
  });

  async function loadDesignProjects() {
    const { data, error } = await supabase
      .from("design_projects")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) console.error("loadDesignProjects failed:", error.message);
    if (data) setDesignProjects(data.map(rowToProject));
  }

  async function addDesignProject(p) {
    const { data, error } = await supabase.from("design_projects").insert(projectToRow(p)).select("*").single();
    if (!error && data) { setDesignProjects((prev) => [rowToProject(data), ...prev]); addActivity(data.id, "created", "admin", "Admin", "", ""); showToast("Design project created.", "success"); return true; }
    showToast(`Failed to create project${error ? ": " + error.message : ""}.`, "error");
    return false;
  }

  async function updateDesignProject(p) {
    setDesignProjects((prev) => prev.map((x) => (x.id === p.id ? { ...x, ...p } : x)));
    const { error } = await supabase.from("design_projects").update(projectToRow(p)).eq("id", p.id);
    if (error) { showToast("Failed to update project.", "error"); return false; }
    logAudit("project.update", "design_project", p.id, { client: p.clientName, status: p.status });
    return true;
  }

  async function deleteDesignProject(id) {
    const { error } = await supabase.from("design_projects").delete().eq("id", id);
    if (!error) { setDesignProjects((prev) => prev.filter((x) => x.id !== id)); logAudit("design_project.delete", "design_project", id, {}); showToast("Project deleted.", "success"); }
    else showToast("Failed to delete project.", "error");
  }

  /* ── Design Files (Supabase Storage + versions) ── */
  const rowToFile = (r) => ({
    id: r.id,
    projectId: r.project_id,
    kind: r.kind || "reference",
    version: r.version || 1,
    fileName: r.file_name || "",
    filePath: r.file_path || "",
    fileUrl: r.file_url || "",
    fileType: r.file_type || "",
    sizeBytes: r.size_bytes || 0,
    uploadedByName: r.uploaded_by_name || "",
    createdAt: r.created_at,
  });

  async function loadDesignFiles() {
    const { data, error } = await supabase
      .from("design_files")
      .select("*")
      .order("created_at", { ascending: true });
    if (error) console.error("loadDesignFiles failed:", error.message);
    if (data) setDesignFiles(data.map(rowToFile));
  }

  async function uploadDesignFile(projectId, kind, file, uploadedByName = "Admin", folderId = "") {
    try {
      const existing = designFiles.filter((f) => f.projectId === projectId && f.kind === kind);
      const version = existing.length ? Math.max(...existing.map((f) => f.version || 1)) + 1 : 1;
      const safe = (file.name || "file").replace(/[^a-zA-Z0-9._-]/g, "_");
      const path = `${projectId}/${kind}/v${version}-${Date.now()}-${safe}`;
      const { error: upErr } = await supabase.storage.from("design-files").upload(path, file, { upsert: false });
      if (upErr) { showToast("Upload failed: " + upErr.message, "error"); return false; }
      const { data: pub } = supabase.storage.from("design-files").getPublicUrl(path);
      const { data, error } = await supabase.from("design_files").insert({
        project_id: projectId, kind, version,
        file_name: file.name, file_path: path, file_url: pub.publicUrl,
        file_type: file.type || (file.name || "").split(".").pop(), size_bytes: file.size,
        uploaded_by: "admin", uploaded_by_name: uploadedByName,
      }).select("*").single();
      if (error || !data) { showToast("File uploaded but record failed.", "error"); return false; }
      setDesignFiles((prev) => [...prev, rowToFile(data)]);
      await markFileDraft(data.id, folderId); // stays private to uploader until Submit/Send
      showToast(`Uploaded ${kind} v${version} — saved as draft (not sent yet).`, "success");
      return true;
    } catch (e) { showToast("Upload error.", "error"); return false; }
  }

  async function deleteDesignFile(fileRec) {
    try { await supabase.storage.from("design-files").remove([fileRec.filePath]); } catch (e) { /* ignore */ }
    const { error } = await supabase.from("design_files").delete().eq("id", fileRec.id);
    if (!error) { setDesignFiles((prev) => prev.filter((x) => x.id !== fileRec.id)); removeFileDraft(fileRec.id); showToast("File deleted.", "success"); }
    else showToast("Failed to delete file.", "error");
  }

  /* ── Design Activity (timeline + revision history — never deleted) ── */
  const rowToActivity = (r) => ({
    id: r.id, projectId: r.project_id, type: r.type || "note",
    actorRole: r.actor_role || "", actorName: r.actor_name || "",
    comment: r.comment || "", meta: r.meta || "", createdAt: r.created_at,
  });
  async function loadDesignActivity() {
    const { data, error } = await supabase.from("design_activity").select("*").order("created_at", { ascending: true });
    if (error) console.error("loadDesignActivity failed:", error.message);
    if (data) setDesignActivity(data.map(rowToActivity));
  }
  async function addActivity(projectId, type, actorRole, actorName, comment = "", meta = "") {
    const { data, error } = await supabase.from("design_activity")
      .insert({ project_id: projectId, type, actor_role: actorRole, actor_name: actorName, comment, meta })
      .select("*").single();
    if (!error && data) setDesignActivity((prev) => [...prev, rowToActivity(data)]);
  }
  async function changeProjectStatus(project, status, actorRole = "admin", actorName = "Admin") {
    await updateDesignProject({ ...project, status });
    await addActivity(project.id, "status", actorRole, actorName, "", status);
  }
  async function requestRevision(projectId, comment, actorName = "Admin") {
    if (!comment || !comment.trim()) { showToast("Write what needs changing.", "error"); return false; }
    await addActivity(projectId, "revision", "admin", actorName, comment.trim(), "");
    const proj = designProjects.find((p) => p.id === projectId);
    if (proj) await updateDesignProject({ ...proj, status: "Revision Required" });
    showToast("Revision requested — the designer will see it.", "success");
    return true;
  }
  // Upload an inline screenshot/image for a project message. Returns a public URL (or "").
  async function uploadMessageImage(projectId, file) {
    try {
      if (!file) return "";
      const safe = (file.name || "screenshot").replace(/[^a-zA-Z0-9._-]/g, "_");
      const path = `messages/${projectId}/${Date.now()}-${safe}`;
      const { error } = await supabase.storage.from("design-files").upload(path, file, { upsert: false });
      if (error) { showToast("Screenshot upload failed: " + error.message, "error"); return ""; }
      return supabase.storage.from("design-files").getPublicUrl(path).data.publicUrl || "";
    } catch (e) { showToast("Screenshot upload error.", "error"); return ""; }
  }

  // Project conversation (ticket-style). Stored as design_activity type "message"
  // so it lives with the project forever and is never overwritten.
  // Optional screenshots (one or many URLs) are stored in `meta` as a JSON array
  // (a bare URL string is still accepted for backward compatibility) and rendered inline.
  async function addProjectComment(projectId, actorRole, actorName, text, images = []) {
    const body = (text || "").trim();
    const urls = Array.isArray(images) ? images.filter(Boolean) : (images ? [images] : []);
    if (!body && urls.length === 0) return false;
    const meta = urls.length ? JSON.stringify(urls) : "";
    await addActivity(projectId, "message", actorRole, actorName, body, meta);
    const proj = designProjects.find((p) => p.id === projectId);
    const to = actorRole === "admin" ? "the designer" : "the admin";
    const preview = body ? body.slice(0, 50) : (urls.length > 1 ? `📷 ${urls.length} screenshots` : "📷 screenshot");
    pushNotification(`${actorName} messaged ${to} on ${proj ? proj.clientName : "a project"}: ${preview}`, "review");
    return true;
  }

  async function loadSettings() {
    const { data } = await supabase.from("settings").select("key, value");
    if (data) {
      data.forEach((row) => {
        if (row.key === "theme") setTheme(row.value);
        if (row.key === "logo" && row.value) setLogo(row.value || logoDefault);
        if (row.key === "targets") {
          try { setTargets(JSON.parse(row.value)); } catch {}
        }
        if (row.key === "team_meta") {
          try { setTeamMeta(JSON.parse(row.value) || {}); } catch {}
        }
        if (row.key === "freelancers") {
          try { setFreelancers(JSON.parse(row.value) || []); } catch {}
        }
        if (row.key === "io_magazines") {
          try { const v = JSON.parse(row.value); if (Array.isArray(v)) setIoMagazines(v); } catch {}
        }
        if (row.key === "design_work") {
          try { setDesignWork(JSON.parse(row.value) || []); } catch {}
        }
        if (row.key === "design_archive") {
          try { setDesignArchive(JSON.parse(row.value) || []); } catch {}
        }
        if (row.key === "design_extra") {
          try { const v = JSON.parse(row.value) || {}; const de = { drafts: v.drafts || [], folders: v.folders || {}, links: v.links || {}, fileFolders: v.fileFolders || {} }; designExtraRef.current = de; setDesignExtra(de); } catch {}
        }
        // admin_password is verified server-side (admin_login RPC); never loaded to the client.
        if (row.key === "admin_email") setAdminEmailState(row.value || "");
      });
    }
  }

  /* ── Column normalizers (DB -> frontend shape) ───────────── */

  function normalizeEmployee(e) {
    return {
      id: e.id, name: e.name, department: e.department,
      code: e.code, photo: e.photo || "",
      teamLead: e.team_lead || "",
      email: e.email || "",
      assignedIds: Array.isArray(e.assigned_ids) ? e.assigned_ids : [],
    };
  }

  function normalizeSubmission(s) {
    return {
      id: s.id, empId: s.emp_id, empName: s.emp_name,
      department: s.department, date: s.date, status: s.status,
      attendance: s.attendance,
      freshEmails: s.fresh_emails, reminderEmails: s.reminder_emails,
      newLeadsInterested: s.new_leads_interested,
      newFollowUps: s.new_follow_ups, callsScheduled: s.calls_scheduled,
      salesGenerated: s.sales_generated, paymentReceived: s.payment_received,
      currency: s.currency, workingHours: s.working_hours,
      websitesData: s.websites_data || [],
      leads: s.leads_data || [],
      followups: s.followups_data || [],
      calls: s.calls_data || [],
      sales: s.sales_data || [],
      payments: s.payments_data || [],
      contractOrders: s.contract_orders_data || [],
      pendingTasks: s.pending_tasks, challengesFaced: s.challenges_faced,
      updatesForTeamLead: s.updates_for_team_lead, remarks: s.remarks,
      customFields: s.custom_fields || {},
      ts: s.submitted_at ? new Date(s.submitted_at).getTime() : null,
    };
  }

  /* ── Employee mutations ──────────────────────────────────── */

  async function saveEmployees(list) {
    // Optimistic UI update first so inputs stay responsive.
    setEmployees(list);
    // Persist edits as per-row UPDATEs. We never INSERT here (new employees
    // go through addEmployee, which supplies the NOT NULL password_hash). An
    // upsert would attempt an INSERT and trip the password_hash constraint.
    for (const e of list) {
      const { error } = await supabase
        .from("employees")
        .update({
          name: e.name, department: e.department, code: e.code,
          photo: e.photo || "", team_lead: e.teamLead || "", email: e.email || "",
        })
        .eq("id", e.id);
      if (error) { showToast("Failed to save employee changes.", "error"); break; }
    }
  }

  // ── Audit trail (fire-and-forget) ──────────────────────────────────────────
  // Never blocks or fails the real action; if audit_log isn't migrated yet it
  // silently no-ops so nothing breaks.
  async function logAudit(action, entity, entityId, details) {
    try {
      await supabase.from("audit_log").insert({
        action,
        entity: entity || null,
        entity_id: entityId != null ? String(entityId) : null,
        details: details || {},
      });
    } catch (e) { /* audit table missing / offline — ignore */ }
  }

  async function addEmployee(emp) {
    const plain = emp.password || "1234";
    const password_hash = await hashPassword(plain);
    const { data, error } = await supabase
      .from("employees")
      .insert({
        id: emp.id, name: emp.name, department: emp.department,
        code: emp.code, photo: emp.photo || "",
        team_lead: emp.teamLead || "", email: emp.email || "", password_hash,
      })
      .select("id, name, department, code, photo, team_lead, email, assigned_ids")
      .single();
    if (!error && data) {
      setEmployees((prev) => [...prev, normalizeEmployee(data)]);
      logAudit("employee.create", "employee", emp.id, { name: emp.name, department: emp.department });
      if (emp.email) {
        try {
          await supabase.functions.invoke("admin-users", {
            body: { action: "upsert", email: emp.email, password: plain },
          });
        } catch (e) { /* Edge Function not deployed yet — DB row still created */ }
      }
      return true;
    }
    showToast(`Failed to add employee${error ? ": " + error.message : ""}.`, "error");
    return false;
  }

  async function deleteEmployee(id) {
    const target = employees.find((e) => e.id === id);
    const { error } = await supabase.from("employees").delete().eq("id", id);
    if (!error) { setEmployees((prev) => prev.filter((e) => e.id !== id)); logAudit("employee.delete", "employee", id, { name: target?.name }); }
    else showToast("Failed to delete employee.", "error");
  }

  // Assign / update the mail IDs for one employee (auto-saved). These show up
  // in that employee's "My Assigned IDs" tab automatically on their next load.
  async function assignEmployeeIds(empId, ids) {
    const list = Array.isArray(ids) ? ids : [];
    setEmployees((prev) => prev.map((e) => (e.id === empId ? { ...e, assignedIds: list } : e)));
    const { error } = await supabase.from("employees").update({ assigned_ids: list }).eq("id", empId);
    if (error) showToast("Failed to save assigned IDs.", "error");
  }

  // Single-row employee update (used by Settings, persisted on blur).
  async function updateEmployee(emp) {
    const prev = employees.find((e) => e.id === emp.id);
    setEmployees((p) => p.map((e) => (e.id === emp.id ? { ...e, ...emp } : e)));
    const { error } = await supabase
      .from("employees")
      .update({
        name: emp.name, department: emp.department, code: emp.code,
        photo: emp.photo || "", team_lead: emp.teamLead || "", email: emp.email || "",
      })
      .eq("id", emp.id);
    if (error) { showToast("Failed to update employee.", "error"); return; }
    // Audit the sensitive change (department) distinctly from a generic edit.
    if (prev && emp.department !== undefined && prev.department !== emp.department) {
      logAudit("employee.department_change", "employee", emp.id, { from: prev.department, to: emp.department, name: emp.name });
    }
  }

  // Reset an employee's password — accepts custom password or defaults to "1234"
  async function resetEmployeePassword(id, newPlainPassword = "1234") {
    const password_hash = await hashPassword(newPlainPassword);
    const { error } = await supabase.from("employees").update({ password_hash }).eq("id", id);
    if (error) { showToast("Failed to reset password.", "error"); return false; }
    const target = employees.find((e) => e.id === id);
    if (target && target.email) {
      try {
        await supabase.functions.invoke("admin-users", {
          body: { action: "upsert", email: target.email, password: newPlainPassword },
        });
      } catch (e) { /* Edge Function not deployed yet — DB copy still updated */ }
    }
    showToast("Password updated successfully!", "success");
    return true;
  }

  /* ── Submission mutations ────────────────────────────────── */

  async function saveSubs(list) {
    const latest = list[list.length - 1];
    if (!latest) return;
    await upsertSubmission(latest);
  }

  async function upsertSubmission(s) {
    // Absent days carry no activity rows — force the structured sections empty.
    const absent = s.attendance === "Absent";
    const leads      = absent ? [] : (Array.isArray(s.leads) ? s.leads : []);
    const followups  = absent ? [] : (Array.isArray(s.followups) ? s.followups : []);
    const calls      = absent ? [] : (Array.isArray(s.calls) ? s.calls : []);
    const salesRows  = absent ? [] : (Array.isArray(s.sales) ? s.sales : []);
    const payRows    = absent ? [] : (Array.isArray(s.payments) ? s.payments : []);
    const contractOrders = absent ? [] : (Array.isArray(s.contractOrders) ? s.contractOrders : []);
    const sumAmt = (arr) => arr.reduce((a, r) => a + (Number(r.amount) || 0), 0);
    const row = {
      id: String(s.id), emp_id: s.empId, emp_name: s.empName,
      department: s.department, date: s.date, status: s.status,
      attendance: s.attendance,
      fresh_emails: absent ? 0 : Number(s.freshEmails) || 0,
      reminder_emails: absent ? 0 : Number(s.reminderEmails) || 0,
      // Existing scalar columns now hold DERIVED totals/counts from the JSONB
      // rows, so all admin aggregations keep working unchanged.
      new_leads_interested: leads.length,
      new_follow_ups: followups.length,
      calls_scheduled: calls.length,
      sales_generated: sumAmt(salesRows),
      payment_received: sumAmt(payRows),
      currency: salesRows[0]?.currency || payRows[0]?.currency || "USD",
      working_hours: absent ? 0 : Number(s.workingHours) || 0,
      websites_data: absent ? [] : (s.websitesData || []),
      leads_data: leads,
      followups_data: followups,
      calls_data: calls,
      sales_data: salesRows,
      payments_data: payRows,
      contract_orders_data: contractOrders,
      pending_tasks: s.pendingTasks || "",
      challenges_faced: "",
      updates_for_team_lead: s.updatesForTeamLead || "",
      remarks: "",
      custom_fields: absent ? {} : (s.customFields || {}),
      submitted_at: s.status === "Submitted" ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    };
    const { data, error } = await supabase
      .from("submissions")
      .upsert(row, { onConflict: "emp_id,date" })
      .select("*")
      .single();
    if (!error && data) {
      const normalized = normalizeSubmission(data);
      setSubmissions((prev) => {
        const idx = prev.findIndex(
          (x) => x.empId === normalized.empId && x.date === normalized.date
        );
        return idx >= 0
          ? prev.map((x, i) => (i === idx ? normalized : x))
          : [...prev, normalized];
      });
      return { success: true };
    }
    showToast(`Failed to save DSR${error ? ": " + error.message : ""}.`, "error");
    return { success: false, error: error?.message };
  }

  /* ── Department mutations ────────────────────────────────── */

  async function saveDepartments(list) {
    const { error: delErr } = await supabase
      .from("departments")
      .delete()
      .not("name", "in", `(${list.map((d) => `"${d}"`).join(",")})`);

    for (const name of list) {
      await supabase
        .from("departments")
        .upsert({ name }, { onConflict: "name" });
    }
    if (!delErr) { setDepartments(list); logAudit("department.update", "department", null, { departments: list }); }
  }

  /* ── Website mutations ───────────────────────────────────── */

  async function saveWebsites(list) {
    await supabase.from("websites").delete().neq("id", 0);
    for (const name of list) {
      await supabase.from("websites").insert({ name });
    }
    setWebsites(list);
  }

  /* ── Custom field mutations ──────────────────────────────── */

  async function saveCustomFields(list) {
    await supabase.from("custom_fields").delete().neq("id", 0);
    if (list.length > 0) {
      await supabase.from("custom_fields").insert(
        list.map((f) => ({ label: f.label, type: f.type, required: f.required }))
      );
    }
    await loadCustomFields();
  }

  /* ── Announcement mutations ──────────────────────────────── */

  async function saveAnnouncements(list) {
    setAnnouncements(list);
    for (const a of list) {
      await supabase
        .from("announcements")
        .update({ dismissed_by: a.dismissedBy || [] })
        .eq("id", a.id);
    }
  }

  async function addAnnouncement(text, depts) {
    const { data, error } = await supabase
      .from("announcements")
      .insert({ text, departments: depts, dismissed_by: [] })
      .select()
      .single();
    if (!error && data) {
      const normalized = {
        id: data.id, text: data.text,
        departments: data.departments,
        dismissedBy: [],
        ts: new Date(data.created_at).getTime(),
      };
      setAnnouncements((prev) => [normalized, ...prev]);
    }
  }

  async function deleteAnnouncement(id) {
    await supabase.from("announcements").delete().eq("id", id);
    setAnnouncements((prev) => prev.filter((a) => a.id !== id));
  }

  /* ── Message mutations ───────────────────────────────────── */

  async function saveMessages(list) {
    setMessages(list);
  }

  async function addMessage(empId, text) {
    const { data, error } = await supabase
      .from("messages")
      .insert({ emp_id: empId, text, dismissed: false })
      .select()
      .single();
    if (!error && data) {
      setMessages((prev) => [{
        id: data.id, empId: data.emp_id, text: data.text,
        dismissed: false, ts: new Date(data.created_at).getTime(),
      }, ...prev]);
    }
  }

  async function deleteMessage(id) {
    await supabase.from("messages").delete().eq("id", id);
    setMessages((prev) => prev.filter((m) => m.id !== id));
  }

  async function dismissMessage(id) {
    await supabase.from("messages").update({ dismissed: true }).eq("id", id);
    setMessages((prev) => prev.map((m) => m.id === id ? { ...m, dismissed: true } : m));
  }

  /* ── Leave mutations ─────────────────────────────────────── */

  async function saveLeaves(list) {
    setLeaves(list);
  }

  async function addLeave(empId, empName, fromDate, toDate, reason) {
    const { data, error } = await supabase
      .from("leaves")
      .insert({ emp_id: empId, emp_name: empName, from_date: fromDate, to_date: toDate, reason, status: "Pending" })
      .select()
      .single();
    if (!error && data) {
      setLeaves((prev) => [{
        id: data.id, empId: data.emp_id, empName: data.emp_name,
        fromDate: data.from_date, toDate: data.to_date,
        reason: data.reason, status: data.status, remark: data.remark || "",
        ts: new Date(data.created_at).getTime(),
      }, ...prev]);
    }
  }

  async function updateLeaveStatus(id, status, remark = "") {
    await supabase.from("leaves")
      .update({ status, remark, updated_at: new Date().toISOString() })
      .eq("id", id);
    setLeaves((prev) => prev.map((l) => l.id === id ? { ...l, status, remark } : l));
  }

  /* ── Salary mutations ────────────────────────────────────── */

  async function saveSalaries(map) {
    setSalaries(map);
    for (const [empId, sal] of Object.entries(map)) {
      const base = {
        emp_id: empId,
        fixed_salary: sal.fixedSalary || 0,
        incentives: sal.incentives || [],
        deductions: sal.deductions || [],
        payments: sal.payments || [],
        updated_at: new Date().toISOString(),
      };
      // Persist the Payroll-Cycle month records too. If the `months` column
      // isn't migrated yet, retry without it so salary saving never breaks.
      let { error } = await supabase.from("salaries").upsert({ ...base, months: sal.months || {} }, { onConflict: "emp_id" });
      if (error && /months/i.test(error.message || "")) {
        await supabase.from("salaries").upsert(base, { onConflict: "emp_id" });
      }
    }
    logAudit("salary.update", "salary", null, { employees: Object.keys(map).length });
  }

  /* ── Settings mutations ──────────────────────────────────── */

  async function saveTargets(t) {
    setTargets(t);
    await supabase.from("settings")
      .upsert({ key: "targets", value: JSON.stringify(t), updated_at: new Date().toISOString() }, { onConflict: "key" });
  }

  // Per-team metadata (target + status), keyed by team-lead name. Stored in
  // the existing settings key/value table — no schema change.
  async function saveTeamMeta(next) {
    setTeamMeta(next);
    await supabase.from("settings")
      .upsert({ key: "team_meta", value: JSON.stringify(next), updated_at: new Date().toISOString() }, { onConflict: "key" });
  }

  // Freelancers are manual payees (not dashboard users). Stored in the existing
  // settings key/value table — no schema change. Each holds a payments[] log.
  async function saveFreelancers(next) {
    setFreelancers(next);
    await supabase.from("settings")
      .upsert({ key: "freelancers", value: JSON.stringify(next), updated_at: new Date().toISOString() }, { onConflict: "key" });
  }

  // Insertion-Order magazine configs (logo, watermark, perks, terms …) — shared
  // across devices via the settings table so PC and mobile show the same branding.
  async function saveIoMagazines(next) {
    setIoMagazines(next);
    try {
      await supabase.from("settings")
        .upsert({ key: "io_magazines", value: JSON.stringify(next), updated_at: new Date().toISOString() }, { onConflict: "key" });
    } catch (e) { /* keep local copy even if the write fails */ }
  }

  // Designer client-wise work items (Cover Page, Layout, Ads, Revisions …) with
  // amount + work status + payment status. Settings-backed — no schema change.
  async function saveDesignWork(next) {
    setDesignWork(next);
    await supabase.from("settings")
      .upsert({ key: "design_work", value: JSON.stringify(next), updated_at: new Date().toISOString() }, { onConflict: "key" });
  }

  // Soft-archived design projects (id + reason + who + when). Settings-backed.
  async function saveDesignArchive(next) {
    setDesignArchive(next);
    await supabase.from("settings")
      .upsert({ key: "design_archive", value: JSON.stringify(next), updated_at: new Date().toISOString() }, { onConflict: "key" });
  }

  /* ── Design "extra" store: submit-gate (drafts) + custom folders + links.
     Settings-backed, one key. A file is PRIVATE to its uploader while its id is
     in `drafts`; releasing (Submit/Send) removes it so the other party can see it.
     Legacy files (never added to drafts) are treated as released → no regressions. */
  async function saveDesignExtra(next) {
    designExtraRef.current = next;
    setDesignExtra(next);
    await supabase.from("settings")
      .upsert({ key: "design_extra", value: JSON.stringify(next), updated_at: new Date().toISOString() }, { onConflict: "key" });
  }
  const genId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  // Mark a freshly-uploaded file as an unsubmitted draft (optionally inside a folder).
  async function markFileDraft(fileId, folderId = "") {
    const cur = designExtraRef.current;
    const next = { ...cur, drafts: [...new Set([...(cur.drafts || []), fileId])], fileFolders: { ...(cur.fileFolders || {}) } };
    if (folderId) next.fileFolders[fileId] = folderId;
    await saveDesignExtra(next);
  }
  async function removeFileDraft(fileId) {
    const cur = designExtraRef.current;
    const ff = { ...(cur.fileFolders || {}) }; delete ff[fileId];
    await saveDesignExtra({ ...cur, drafts: (cur.drafts || []).filter((id) => id !== fileId), fileFolders: ff });
  }
  // Release everything the given side currently has pending for a project (files + folders + links).
  async function releaseDesign(projectId, role) {
    const cur = designExtraRef.current;
    const mineIds = (designFiles || [])
      .filter((f) => f.projectId === projectId && ((role === "admin") === (f.uploadedByName === "Admin")))
      .map((f) => f.id);
    const folders = { ...(cur.folders || {}) };
    folders[projectId] = (folders[projectId] || []).map((fo) => (fo.side === role ? { ...fo, released: true } : fo));
    const links = { ...(cur.links || {}) };
    links[projectId] = (links[projectId] || []).map((ln) => (ln.side === role ? { ...ln, released: true } : ln));
    await saveDesignExtra({ ...cur, drafts: (cur.drafts || []).filter((id) => !mineIds.includes(id)), folders, links });
  }
  async function addDesignFolder(projectId, name, side) {
    const cur = designExtraRef.current;
    const folders = { ...(cur.folders || {}) };
    folders[projectId] = [...(folders[projectId] || []), { id: genId(), name: (name || "Folder").trim(), side, released: false, createdAt: new Date().toISOString() }];
    await saveDesignExtra({ ...cur, folders });
  }
  async function deleteDesignFolder(projectId, folderId) {
    const cur = designExtraRef.current;
    const folders = { ...(cur.folders || {}) };
    folders[projectId] = (folders[projectId] || []).filter((f) => f.id !== folderId);
    const ff = { ...(cur.fileFolders || {}) };
    Object.keys(ff).forEach((fid) => { if (ff[fid] === folderId) delete ff[fid]; });
    await saveDesignExtra({ ...cur, folders, fileFolders: ff });
  }
  async function addDesignLink(projectId, label, url, side) {
    const cur = designExtraRef.current;
    const links = { ...(cur.links || {}) };
    links[projectId] = [...(links[projectId] || []), { id: genId(), label: (label || url || "Link").trim(), url: (url || "").trim(), side, released: false, createdAt: new Date().toISOString() }];
    await saveDesignExtra({ ...cur, links });
  }
  async function deleteDesignLink(projectId, linkId) {
    const cur = designExtraRef.current;
    const links = { ...(cur.links || {}) };
    links[projectId] = (links[projectId] || []).filter((l) => l.id !== linkId);
    await saveDesignExtra({ ...cur, links });
  }

  async function setAdminPwd(v) {
    setAdminPwdState(v);
    await supabase.from("settings")
      .upsert({ key: "admin_password", value: v, updated_at: new Date().toISOString() }, { onConflict: "key" });
  }

  async function setAdminEmail(v) {
    setAdminEmailState(v);
    await supabase.from("settings")
      .upsert({ key: "admin_email", value: v, updated_at: new Date().toISOString() }, { onConflict: "key" });
  }

  // Separate Settings/Salary edit password (in-memory, predefined default).
  function setSettingsPwd(v) {
    setSettingsPwdState(v);
  }

  const toggleTheme = async () => {
    const next = theme === "light" ? "dark" : "light";
    setTheme(next);
    await supabase.from("settings")
      .upsert({ key: "theme", value: next, updated_at: new Date().toISOString() }, { onConflict: "key" });
  };

  const onLogoChange = async (dataUrl) => {
    setLogo(dataUrl);
    await supabase.from("settings")
      .upsert({ key: "logo", value: dataUrl, updated_at: new Date().toISOString() }, { onConflict: "key" });
  };

  const onLogoRemove = async () => {
    setLogo(logoDefault);
    await supabase.from("settings")
      .upsert({ key: "logo", value: "", updated_at: new Date().toISOString() }, { onConflict: "key" });
  };

  /* ── Toast ───────────────────────────────────────────────── */

  const showToast = (msg, kind = "info") => {
    setToast({ msg, kind });
    setTimeout(() => setToast(null), 3000);
  };

  // Classify a notification message into a colour/priority type from keywords.
  const classifyNotif = (msg) => {
    const m = String(msg || "").toLowerCase();
    if (/reject|revision|correction|declin/.test(m)) return "rejected";
    if (/approv|complete|paid|released|✓/.test(m)) return "completed";
    if (/review|sample|submit|uploaded|ready/.test(m)) return "review";
    if (/wait|pending|due|required|request/.test(m)) return "waiting";
    return "info";
  };
  const pushNotification = (msg, type) => {
    setNotifications((n) => [{ id: `${Date.now()}${Math.floor(Math.random() * 1000)}`, msg, ts: Date.now(), read: false, type: type || classifyNotif(msg) }, ...n].slice(0, 80));
  };
  const markNotificationRead = (id) => setNotifications((n) => n.map((x) => (x.id === id ? { ...x, read: true } : x)));
  const markAllNotificationsRead = () => setNotifications((n) => n.map((x) => ({ ...x, read: true })));
  const clearNotifications = () => setNotifications([]);

  /* ══════════════════════════════════════════════════════════
     Pipeline (Employee CRM) — additive data layer.
     Every write also (a) appends a pipeline_history audit row and
     (b) rolls up into TODAY's submissions row so the existing Admin
     Dashboard / Reports / Analytics keep working unchanged.
     ══════════════════════════════════════════════════════════ */
  const rowToPClient = (r) => ({ id: r.id, employeeId: r.employee_id, assignedEmailId: r.assigned_email_id || "", domainId: r.domain_id || "", domainName: r.domain_name || "", clientName: r.client_name || "", companyName: r.company_name || "", projectName: r.project_name || "", clientEmail: r.client_email || "", region: r.region || "", status: r.status || "New Lead", notes: r.notes || "", lastFollowUp: r.last_follow_up || "", nextFollowUp: r.next_follow_up || "", nextFollowUpTime: r.next_follow_up_time || "", nextActionType: r.next_action_type || "", expectedAmount: Number(r.expected_amount) || 0, expectedCurrency: r.expected_currency || "", lostReason: r.lost_reason || "", isDeleted: !!r.is_deleted, createdAt: r.created_at, updatedAt: r.updated_at });
  const rowToPFollowup = (r) => ({ id: r.id, clientId: r.client_id, employeeId: r.employee_id, followUpDate: r.follow_up_date || "", followUpTime: r.follow_up_time || "", communicationType: r.communication_type || "", notes: r.notes || "", status: r.status || "", nextFollowUp: r.next_follow_up || "", actionType: r.action_type || "", outcome: r.outcome || "", createdAt: r.created_at });
  const rowToPContract = (r) => ({ id: r.id, clientId: r.client_id, contractNumber: r.contract_number || "", contractDate: r.contract_date || "", notes: r.notes || "", createdAt: r.created_at });
  const rowToPSale = (r) => ({ id: r.id, clientId: r.client_id, packageName: r.package_name || "", amount: Number(r.amount) || 0, currency: r.currency || "USD", salesDate: r.sales_date || "", notes: r.notes || "", createdAt: r.created_at });
  const rowToPPayment = (r) => ({ id: r.id, clientId: r.client_id, amount: Number(r.amount) || 0, currency: r.currency || "USD", paymentMethod: r.payment_method || "", referenceNumber: r.reference_number || "", paymentDate: r.payment_date || "", notes: r.notes || "", createdAt: r.created_at });
  const rowToPNote = (r) => ({ id: r.id, clientId: r.client_id, employeeId: r.employee_id, note: r.note || "", createdAt: r.created_at });
  const rowToPHistory = (r) => ({ id: r.id, clientId: r.client_id, employeeId: r.employee_id, action: r.action || "", oldValue: r.old_value || null, newValue: r.new_value || null, createdAt: r.created_at });
  const rowToDomain = (r) => ({ id: r.id, name: r.domain_name, status: r.status !== false });
  const rowToPStatus = (r) => ({ id: r.id, name: r.status_name, colour: r.colour || "", order: r.display_order || 0 });

  async function loadPipeline() {
    const grab = async (table, order, setter, mapper) => {
      try {
        const { data, error } = await supabase.from(table).select("*").order(order, { ascending: table === "domains" || table === "pipeline_status_master" });
        if (!error && data) setter(data.map(mapper));
      } catch (e) { /* table not migrated yet — ignore */ }
    };
    await Promise.all([
      grab("pipeline_clients", "updated_at", setPipelineClients, rowToPClient),
      grab("pipeline_followups", "created_at", setPipelineFollowups, rowToPFollowup),
      grab("pipeline_contracts", "created_at", setPipelineContracts, rowToPContract),
      grab("pipeline_sales", "created_at", setPipelineSales, rowToPSale),
      grab("pipeline_payments", "created_at", setPipelinePayments, rowToPPayment),
      grab("pipeline_notes", "created_at", setPipelineNotes, rowToPNote),
      grab("pipeline_history", "created_at", setPipelineHistory, rowToPHistory),
      grab("domains", "domain_name", setDomains, rowToDomain),
      grab("pipeline_status_master", "display_order", setPipelineStatuses, rowToPStatus),
    ]);
  }

  async function addPipelineHistory(clientId, employeeId, action, oldValue, newValue) {
    try {
      const { data } = await supabase.from("pipeline_history").insert({ client_id: clientId, employee_id: employeeId || null, action, old_value: oldValue || null, new_value: newValue || null }).select("*").single();
      if (data) setPipelineHistory((prev) => [rowToPHistory(data), ...prev]);
    } catch (e) { /* ignore */ }
  }

  // Roll a Pipeline event into TODAY's submission so the Admin numbers keep flowing.
  async function rollupToSubmission(empId, kind, row) {
    const emp = employees.find((e) => e.id === empId);
    const today = localDateStr();
    const base = submissions.find((x) => x.empId === empId && x.date === today) || {
      id: String(Date.now()), empId, empName: emp?.name || "", department: emp?.department || "",
      date: today, status: "Draft", attendance: "Present",
      freshEmails: 0, reminderEmails: 0, workingHours: 0, pendingTasks: "", updatesForTeamLead: "",
      leads: [], followups: [], calls: [], sales: [], payments: [], contractOrders: [], websitesData: [], customFields: {},
    };
    const key = { lead: "leads", followup: "followups", call: "calls", sale: "sales", payment: "payments", contract: "contractOrders" }[kind];
    if (!key) return;
    const merged = { ...base, [key]: [...(base[key] || []), row] };
    try { await upsertSubmission(merged); } catch (e) { /* keep Pipeline write even if rollup hiccups */ }
  }

  async function addPipelineClient(p) {
    try {
      // F2: global duplicate prevention (across ALL employees) on (email, domain).
      // Works even when domain_id is null — the DB unique index can't, so we check here.
      const dupEmail = (p.clientEmail || "").trim();
      if (dupEmail) {
        try {
          const { data: dup } = await supabase
            .from("pipeline_clients").select("id, employee_id")
            .eq("is_deleted", false).ilike("client_email", dupEmail)
            .eq("domain_name", p.domainName || "").limit(1);
          if (dup && dup.length) {
            showToast("This client already exists under this domain (possibly with another team member).", "error");
            return false;
          }
        } catch (e) { /* if the check itself fails, fall through and let the insert try */ }
      }
      const payload = {
        employee_id: p.employeeId, assigned_email_id: p.assignedEmailId || null, domain_id: p.domainId || null,
        domain_name: p.domainName || null, client_name: p.clientName, company_name: p.companyName || null,
        project_name: p.projectName || null,
        client_email: p.clientEmail || null, region: p.region || null, status: p.status || "New Lead",
        notes: p.notes || null, next_follow_up: p.nextFollowUp || null, next_follow_up_time: p.nextFollowUpTime || null,
        next_action_type: p.nextActionType || null,
      };
      let { data, error } = await supabase.from("pipeline_clients").insert(payload).select("*").single();
      if (error && /next_follow_up_time|project_name|next_action_type/.test(error.message || "")) { // columns not migrated yet — save without them
        delete payload.next_follow_up_time; delete payload.project_name; delete payload.next_action_type;
        ({ data, error } = await supabase.from("pipeline_clients").insert(payload).select("*").single());
      }
      if (error || !data) {
        const m = error?.message || "";
        showToast(m.includes("uq_client_email_domain") ? "This client already exists under the selected domain."
          : /relation .*pipeline_clients.* does not exist|schema cache|Could not find the table/i.test(m) ? "Pipeline tables not found — please run the database migration (pipeline-schema.sql)."
          : "Could not save client" + (m ? " — " + m : "."), "error");
        return false;
      }
      const rec = rowToPClient(data);
      setPipelineClients((prev) => [rec, ...prev]);
      await addPipelineHistory(rec.id, p.employeeId, "Client Created", null, { clientName: rec.clientName, status: rec.status });
      await rollupToSubmission(p.employeeId, "lead", { client: rec.clientName, status: rec.status, ts: Date.now() });
      pushNotification && pushNotification(`New client added: ${rec.clientName}`, "info");
      return rec;
    } catch (e) { showToast("Could not save client.", "error"); return false; }
  }

  async function updatePipelineClient(id, patch, employeeId) {
    const old = pipelineClients.find((c) => c.id === id);
    try {
      const upd = {}; const map = { assignedEmailId: "assigned_email_id", domainId: "domain_id", domainName: "domain_name", clientName: "client_name", companyName: "company_name", projectName: "project_name", clientEmail: "client_email", region: "region", status: "status", notes: "notes", nextFollowUp: "next_follow_up", nextFollowUpTime: "next_follow_up_time", nextActionType: "next_action_type", expectedAmount: "expected_amount", expectedCurrency: "expected_currency", lastFollowUp: "last_follow_up", lostReason: "lost_reason", isDeleted: "is_deleted" };
      Object.keys(patch).forEach((k) => { if (map[k] !== undefined) upd[map[k]] = patch[k]; });
      upd.updated_at = new Date().toISOString();
      let { data, error } = await supabase.from("pipeline_clients").update(upd).eq("id", id).select("*").single();
      if (error && /next_follow_up_time|project_name|expected_amount|expected_currency|next_action_type/.test(error.message || "")) { // columns not migrated yet
        delete upd.next_follow_up_time; delete upd.project_name; delete upd.expected_amount; delete upd.expected_currency; delete upd.next_action_type;
        ({ data, error } = await supabase.from("pipeline_clients").update(upd).eq("id", id).select("*").single());
      }
      if (error || !data) { showToast("Could not update client.", "error"); return false; }
      const rec = rowToPClient(data);
      setPipelineClients((prev) => prev.map((c) => (c.id === id ? rec : c)));
      await addPipelineHistory(id, employeeId, patch.status && old && old.status !== patch.status ? `Status → ${patch.status}` : "Client Edited", old ? { status: old.status, notes: old.notes, nextFollowUp: old.nextFollowUp } : null, { status: rec.status, notes: rec.notes, nextFollowUp: rec.nextFollowUp });
      return rec;
    } catch (e) { showToast("Could not update client.", "error"); return false; }
  }

  // Admin-only soft delete (never a hard delete — the row is kept with is_deleted=true
  // so it can be restored). Views filter out !isDeleted; the row stays in state for undo.
  async function softDeletePipelineClient(id, employeeId) {
    try {
      const { error } = await supabase.from("pipeline_clients").update({ is_deleted: true, updated_at: new Date().toISOString() }).eq("id", id);
      if (error) { showToast("Could not delete client.", "error"); return false; }
      setPipelineClients((prev) => prev.map((c) => (c.id === id ? { ...c, isDeleted: true } : c)));
      await addPipelineHistory(id, employeeId, "Project Deleted", null, null);
      logAudit("pipeline_client.soft_delete", "pipeline_client", id, { by: employeeId });
      return true;
    } catch (e) { showToast("Could not delete client.", "error"); return false; }
  }

  // Restore a soft-deleted client (undo).
  async function restorePipelineClient(id, employeeId) {
    try {
      const { error } = await supabase.from("pipeline_clients").update({ is_deleted: false, updated_at: new Date().toISOString() }).eq("id", id);
      if (error) { showToast("Could not restore client.", "error"); return false; }
      setPipelineClients((prev) => prev.map((c) => (c.id === id ? { ...c, isDeleted: false } : c)));
      await addPipelineHistory(id, employeeId, "Project Restored", null, null);
      return true;
    } catch (e) { showToast("Could not restore client.", "error"); return false; }
  }

  // Permanently delete a client and all of its related pipeline rows (irreversible).
  async function hardDeletePipelineClient(id) {
    try {
      // remove children first (best-effort; ignore per-table errors so one missing table can't block)
      for (const tbl of ["pipeline_followups", "pipeline_contracts", "pipeline_sales", "pipeline_payments", "pipeline_notes", "pipeline_history"]) {
        try { await supabase.from(tbl).delete().eq("client_id", id); } catch (e) { /* table may not exist */ }
      }
      const { error } = await supabase.from("pipeline_clients").delete().eq("id", id);
      if (error) { showToast("Could not permanently delete client.", "error"); return false; }
      setPipelineClients((prev) => prev.filter((c) => c.id !== id));
      setPipelineFollowups((prev) => prev.filter((r) => r.clientId !== id));
      setPipelineContracts((prev) => prev.filter((r) => r.clientId !== id));
      setPipelineSales((prev) => prev.filter((r) => r.clientId !== id));
      setPipelinePayments((prev) => prev.filter((r) => r.clientId !== id));
      logAudit("pipeline_client.hard_delete", "pipeline_client", id, {});
      showToast("Client permanently deleted.", "success");
      return true;
    } catch (e) { showToast("Could not permanently delete client.", "error"); return false; }
  }

  async function addFollowup(p) {
    try {
      const fuInsert = {
        client_id: p.clientId, employee_id: p.employeeId, follow_up_date: p.followUpDate || localDateStr(),
        follow_up_time: p.followUpTime || null, communication_type: p.communicationType || null, notes: p.notes || null,
        status: p.status || null, next_follow_up: p.nextFollowUp || null,
        action_type: p.actionType || null, outcome: p.outcome || null,
      };
      let { data, error } = await supabase.from("pipeline_followups").insert(fuInsert).select("*").single();
      if (error && /action_type|outcome/.test(error.message || "")) { // columns not migrated yet — save without them
        delete fuInsert.action_type; delete fuInsert.outcome;
        ({ data, error } = await supabase.from("pipeline_followups").insert(fuInsert).select("*").single());
      }
      if (error || !data) { showToast("Could not save follow-up.", "error"); return false; }
      const rec = rowToPFollowup(data);
      setPipelineFollowups((prev) => [rec, ...prev]);
      // keep the client's last/next follow-up + next action + status current
      await updatePipelineClient(p.clientId, { lastFollowUp: rec.followUpDate, nextFollowUp: p.nextFollowUp || undefined, ...(p.nextFollowUpTime !== undefined ? { nextFollowUpTime: p.nextFollowUpTime || null } : {}), ...(p.nextActionType !== undefined ? { nextActionType: p.nextActionType || null } : {}), ...(p.status ? { status: p.status } : {}) }, p.employeeId);
      await rollupToSubmission(p.employeeId, "followup", { client: p.clientName || "", type: rec.communicationType, ts: Date.now() });
      if (["Phone Call", "Zoom Meeting", "Google Meet"].includes(rec.communicationType)) {
        await rollupToSubmission(p.employeeId, "call", { client: p.clientName || "", type: rec.communicationType, ts: Date.now() });
      }
      pushNotification && pushNotification(`Follow-up added${p.clientName ? " · " + p.clientName : ""}`, "review");
      return rec;
    } catch (e) { showToast("Could not save follow-up.", "error"); return false; }
  }

  async function addPipelineContract(p) {
    try {
      const { data, error } = await supabase.from("pipeline_contracts").insert({ client_id: p.clientId, contract_number: p.contractNumber || null, contract_date: p.contractDate || localDateStr(), notes: p.notes || null }).select("*").single();
      if (error || !data) { showToast("Could not save contract.", "error"); return false; }
      const rec = rowToPContract(data);
      setPipelineContracts((prev) => [rec, ...prev]);
      await addPipelineHistory(p.clientId, p.employeeId, "Contract Sent", null, { number: rec.contractNumber, date: rec.contractDate });
      await rollupToSubmission(p.employeeId, "contract", { number: rec.contractNumber, date: rec.contractDate, ts: Date.now() });
      pushNotification && pushNotification(`Contract sent${p.clientName ? " · " + p.clientName : ""}`, "info");
      return rec;
    } catch (e) { showToast("Could not save contract.", "error"); return false; }
  }

  async function addPipelineSale(p) {
    try {
      const { data, error } = await supabase.from("pipeline_sales").insert({ client_id: p.clientId, package_name: p.packageName || null, amount: Number(p.amount) || 0, currency: p.currency || "USD", sales_date: p.salesDate || localDateStr(), notes: p.notes || null }).select("*").single();
      if (error || !data) { showToast("Could not save sale.", "error"); return false; }
      const rec = rowToPSale(data);
      setPipelineSales((prev) => [rec, ...prev]);
      await addPipelineHistory(p.clientId, p.employeeId, "Sale Closed", null, { package: rec.packageName, amount: rec.amount, currency: rec.currency });
      await rollupToSubmission(p.employeeId, "sale", { amount: rec.amount, currency: rec.currency, package: rec.packageName, ts: Date.now() });
      pushNotification && pushNotification(`Sale closed${p.clientName ? " · " + p.clientName : ""} (${rec.currency} ${rec.amount})`, "completed");
      return rec;
    } catch (e) { showToast("Could not save sale.", "error"); return false; }
  }

  async function addPipelinePayment(p) {
    try {
      const { data, error } = await supabase.from("pipeline_payments").insert({ client_id: p.clientId, amount: Number(p.amount) || 0, currency: p.currency || "USD", payment_method: p.paymentMethod || null, reference_number: p.referenceNumber || null, payment_date: p.paymentDate || localDateStr(), notes: p.notes || null }).select("*").single();
      if (error || !data) { showToast("Could not save payment.", "error"); return false; }
      const rec = rowToPPayment(data);
      setPipelinePayments((prev) => [rec, ...prev]);
      await addPipelineHistory(p.clientId, p.employeeId, "Payment Received", null, { amount: rec.amount, currency: rec.currency, method: rec.paymentMethod });
      await rollupToSubmission(p.employeeId, "payment", { amount: rec.amount, currency: rec.currency, method: rec.paymentMethod, ts: Date.now() });
      pushNotification && pushNotification(`Payment received${p.clientName ? " · " + p.clientName : ""} (${rec.currency} ${rec.amount})`, "completed");
      return rec;
    } catch (e) { showToast("Could not save payment.", "error"); return false; }
  }

  // B3: reverse/refund a payment by recording a negative offsetting entry, so
  // analytics net out correctly and there's a full audit trail. Never edits the original.
  async function reversePipelinePayment(clientId, employeeId, amount, currency) {
    try {
      const amt = -Math.abs(Number(amount) || 0);
      const { data, error } = await supabase.from("pipeline_payments").insert({ client_id: clientId, amount: amt, currency: currency || "USD", payment_method: "Reversal / Refund", payment_date: localDateStr(), notes: "Payment reversed by admin" }).select("*").single();
      if (error || !data) { showToast("Could not reverse payment.", "error"); return false; }
      setPipelinePayments((prev) => [rowToPPayment(data), ...prev]);
      await addPipelineHistory(clientId, employeeId, "Payment Reversed", null, { amount: amt, currency: currency || "USD" });
      return true;
    } catch (e) { showToast("Could not reverse payment.", "error"); return false; }
  }

  async function addPipelineNote(p) {
    try {
      const { data, error } = await supabase.from("pipeline_notes").insert({ client_id: p.clientId, employee_id: p.employeeId, note: p.note }).select("*").single();
      if (error || !data) { showToast("Could not save note.", "error"); return false; }
      const rec = rowToPNote(data);
      setPipelineNotes((prev) => [rec, ...prev]);
      await addPipelineHistory(p.clientId, p.employeeId, "Note Added", null, { note: rec.note });
      return rec;
    } catch (e) { showToast("Could not save note.", "error"); return false; }
  }

  /* ── Context value ───────────────────────────────────────── */

  const value = {
    loading,
    theme, toggleTheme,
    employees, saveEmployees, addEmployee, deleteEmployee, updateEmployee, resetEmployeePassword, assignEmployeeIds, logAudit,
    submissions, saveSubs, upsertSubmission,
    departments, saveDepartments,
    websites, saveWebsites,
    targets, saveTargets,
    teamMeta, saveTeamMeta,
    freelancers, saveFreelancers, ioMagazines, saveIoMagazines,
    designWork, saveDesignWork,
    designArchive, saveDesignArchive,
    designExtra, releaseDesign, addDesignFolder, deleteDesignFolder, addDesignLink, deleteDesignLink,
    // Pipeline (Employee CRM)
    pipelineClients, pipelineFollowups, pipelineContracts, pipelineSales, pipelinePayments, pipelineNotes, pipelineHistory,
    domains, addDomain, updateDomain, deleteDomain, pipelineStatuses,
    addPipelineClient, updatePipelineClient, softDeletePipelineClient, restorePipelineClient, hardDeletePipelineClient, addFollowup, addPipelineContract, addPipelineSale, addPipelinePayment, reversePipelinePayment, addPipelineNote,
    customFields, saveCustomFields,
    announcements, saveAnnouncements, addAnnouncement, deleteAnnouncement,
    messages, saveMessages, addMessage, deleteMessage, dismissMessage,
    leaves, saveLeaves, addLeave, updateLeaveStatus,
    attendanceOverrides, saveAttendanceOverride,
    salaries, saveSalaries, bankDetails, saveBankDetails,
    expenses, addExpense, updateExpense, deleteExpense, captureExpense,
    designProjects, addDesignProject, updateDesignProject, deleteDesignProject,
    designFiles, uploadDesignFile, deleteDesignFile,
    designActivity, changeProjectStatus, requestRevision, addProjectComment, uploadMessageImage,
    logo, onLogoChange, onLogoRemove,
    adminPwd, setAdminPwd,
    adminEmail, setAdminEmail,
    settingsPwd, setSettingsPwd,
    toast, showToast,
    notifications, pushNotification, markNotificationRead, markAllNotificationsRead, clearNotifications,
  };

  return (
    <AppDataContext.Provider value={value}>
      {children}
    </AppDataContext.Provider>
  );
}

export function useAppData() {
  const ctx = useContext(AppDataContext);
  if (!ctx) throw new Error("useAppData must be used within AppDataProvider");
  return ctx;
}
