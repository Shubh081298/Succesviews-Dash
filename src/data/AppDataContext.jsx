/**
 * AppDataContext.jsx — shared data layer, powered by Supabase.
 * The Employee Portal and Admin Portal both consume this context.
 */
import { createContext, useContext, useState, useEffect } from "react";
import { supabase } from "../utils/supabaseClient";
import { hashPassword } from "../utils/auth";
import logoDefault from "../assets/successviews-logo.png";

const AppDataContext = createContext(null);

export function AppDataProvider({ children }) {
  /* ── State ───────────────────────────────────────────────── */
  const [loading, setLoading]               = useState(true);
  const [theme, setTheme]                   = useState("light");
  const [employees, setEmployees]           = useState([]);
  const [submissions, setSubmissions]       = useState([]);
  const [departments, setDepartments]       = useState(["Sales", "Operations"]);
  const [websites, setWebsites]             = useState([]);
  const [targets, setTargets]               = useState({
    emailsSent: 20, newLeads: 5, callsMade: 15,
    salesGenerated: 1000, followUps: 10, meetings: 2,
  });
  const [customFields, setCustomFields]     = useState([]);
  const [announcements, setAnnouncements]   = useState([]);
  const [messages, setMessages]             = useState([]);
  const [leaves, setLeaves]                 = useState([]);
  const [salaries, setSalaries]             = useState({});
  const [expenses, setExpenses]             = useState([]);
  const [designProjects, setDesignProjects] = useState([]);
  const [designFiles, setDesignFiles]       = useState([]);
  const [logo, setLogo]                     = useState(logoDefault);
  const [adminPwd, setAdminPwdState]        = useState(""); // login is verified server-side (admin_login RPC); no client-side password
  const [adminEmail, setAdminEmailState]    = useState("");
  const [settingsPwd, setSettingsPwdState]  = useState("Settings@123");
  const [toast, setToast]                   = useState(null);
  const [notifications, setNotifications]   = useState([]);

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
        loadSalaries(),
        loadExpenses(),
        loadDesignProjects(),
        loadDesignFiles(),
        loadSettings(),
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
        };
      });
      setSalaries(map);
    }
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
    if (!error && data) { setDesignProjects((prev) => [rowToProject(data), ...prev]); showToast("Design project created.", "success"); return true; }
    showToast(`Failed to create project${error ? ": " + error.message : ""}.`, "error");
    return false;
  }

  async function updateDesignProject(p) {
    setDesignProjects((prev) => prev.map((x) => (x.id === p.id ? { ...x, ...p } : x)));
    const { error } = await supabase.from("design_projects").update(projectToRow(p)).eq("id", p.id);
    if (error) { showToast("Failed to update project.", "error"); return false; }
    return true;
  }

  async function deleteDesignProject(id) {
    const { error } = await supabase.from("design_projects").delete().eq("id", id);
    if (!error) { setDesignProjects((prev) => prev.filter((x) => x.id !== id)); showToast("Project deleted.", "success"); }
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

  async function uploadDesignFile(projectId, kind, file, uploadedByName = "Admin") {
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
      showToast(`Uploaded ${kind} v${version}.`, "success");
      return true;
    } catch (e) { showToast("Upload error.", "error"); return false; }
  }

  async function deleteDesignFile(fileRec) {
    try { await supabase.storage.from("design-files").remove([fileRec.filePath]); } catch (e) { /* ignore */ }
    const { error } = await supabase.from("design_files").delete().eq("id", fileRec.id);
    if (!error) { setDesignFiles((prev) => prev.filter((x) => x.id !== fileRec.id)); showToast("File deleted.", "success"); }
    else showToast("Failed to delete file.", "error");
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
      passwordPlain: e.password_plain || "",
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

  async function addEmployee(emp) {
    const plain = emp.password || "1234";
    const password_hash = await hashPassword(plain);
    const { data, error } = await supabase
      .from("employees")
      .insert({
        id: emp.id, name: emp.name, department: emp.department,
        code: emp.code, photo: emp.photo || "",
        team_lead: emp.teamLead || "", email: emp.email || "", password_hash,
        password_plain: plain,
      })
      .select("id, name, department, code, photo, team_lead, email, assigned_ids")
      .single();
    if (!error && data) {
      setEmployees((prev) => [...prev, normalizeEmployee(data)]);
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
    const { error } = await supabase.from("employees").delete().eq("id", id);
    if (!error) setEmployees((prev) => prev.filter((e) => e.id !== id));
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
    setEmployees((prev) => prev.map((e) => (e.id === emp.id ? { ...e, ...emp } : e)));
    const { error } = await supabase
      .from("employees")
      .update({
        name: emp.name, department: emp.department, code: emp.code,
        photo: emp.photo || "", team_lead: emp.teamLead || "", email: emp.email || "",
      })
      .eq("id", emp.id);
    if (error) showToast("Failed to update employee.", "error");
  }

  // Reset an employee's password — accepts custom password or defaults to "1234"
  async function resetEmployeePassword(id, newPlainPassword = "1234") {
    const password_hash = await hashPassword(newPlainPassword);
    const { error } = await supabase.from("employees").update({ password_hash, password_plain: newPlainPassword }).eq("id", id);
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
    if (!delErr) setDepartments(list);
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
      await supabase.from("salaries").upsert({
        emp_id: empId,
        fixed_salary: sal.fixedSalary || 0,
        incentives: sal.incentives || [],
        deductions: sal.deductions || [],
        payments: sal.payments || [],
        updated_at: new Date().toISOString(),
      }, { onConflict: "emp_id" });
    }
  }

  /* ── Settings mutations ──────────────────────────────────── */

  async function saveTargets(t) {
    setTargets(t);
    await supabase.from("settings")
      .upsert({ key: "targets", value: JSON.stringify(t), updated_at: new Date().toISOString() }, { onConflict: "key" });
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

  const pushNotification = (msg) => {
    setNotifications((n) => [{ id: Date.now(), msg, ts: Date.now() }, ...n].slice(0, 50));
  };

  /* ── Context value ───────────────────────────────────────── */

  const value = {
    loading,
    theme, toggleTheme,
    employees, saveEmployees, addEmployee, deleteEmployee, updateEmployee, resetEmployeePassword, assignEmployeeIds,
    submissions, saveSubs, upsertSubmission,
    departments, saveDepartments,
    websites, saveWebsites,
    targets, saveTargets,
    customFields, saveCustomFields,
    announcements, saveAnnouncements, addAnnouncement, deleteAnnouncement,
    messages, saveMessages, addMessage, deleteMessage, dismissMessage,
    leaves, saveLeaves, addLeave, updateLeaveStatus,
    salaries, saveSalaries,
    expenses, addExpense, updateExpense, deleteExpense, captureExpense,
    designProjects, addDesignProject, updateDesignProject, deleteDesignProject,
    designFiles, uploadDesignFile, deleteDesignFile,
    logo, onLogoChange, onLogoRemove,
    adminPwd, setAdminPwd,
    adminEmail, setAdminEmail,
    settingsPwd, setSettingsPwd,
    toast, showToast,
    notifications, pushNotification,
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
