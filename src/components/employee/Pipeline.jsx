/**
 * Pipeline.jsx — Employee CRM workspace (workflow rebuild).
 * After a lead is created the only action is Edit, which opens a single
 * hub: lead details, a follow-up logger, the production workflow, and a
 * premium activity timeline. All writes roll up to Admin in real time.
 */
import { useState, useMemo } from "react";
import {
  Search, Filter, Plus, Pencil, ArrowLeft, Mail, Globe, Hash,
  CalendarDays, FileText, CheckCircle2, AlertTriangle, Users,
  Layers, Target, TrendingUp, Wallet, Clock,
} from "lucide-react";
import { useAppData } from "../../data/AppDataContext";
import LeadWorkflow from "../crm/LeadWorkflow";
import LeadTimeline from "../crm/LeadTimeline";
import { NURTURE_STATUSES, DEAD, WORKFLOW_CONTROLLED, stageColour, progressOf, isClosed, ACTION_TYPES, OUTCOMES, actionLabel, autoStageFromOutcome } from "../../utils/crmWorkflow";

const FALLBACK_DOMAINS = ["CIO Visionaries", "CEO Vision", "Arab World Leaders", "CXO Leaders", "Healthcare Leaders"];
const REGIONS = ["UAE", "Saudi Arabia", "India", "USA", "UK", "Australia", "Singapore", "Europe", "Africa"];
const COMM_TYPES = ["Email", "Phone Call", "WhatsApp", "LinkedIn", "Zoom Meeting", "Google Meet", "Other"];
const todayStr = () => { const d = new Date(); return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10); };
const isEmail = (e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(e || "").trim());
const fmt = (d) => (d ? new Date(d + (String(d).length <= 10 ? "T00:00:00" : "")).toLocaleDateString() : "—");
const fmt12 = (t) => { if (!t) return ""; const [h, m] = String(t).split(":"); const H = +h; const ap = H >= 12 ? "PM" : "AM"; const h12 = ((H + 11) % 12) + 1; return `${h12}:${m || "00"} ${ap}`; };
const clientCode = (id) => "SV-" + String(id || "").replace(/[^a-zA-Z0-9]/g, "").slice(0, 6).toUpperCase();
const needsFU = (c) => { const p = progressOf(c.status); return p >= 0 && p < 3; };

export default function Pipeline({ emp, onToast }) {
  const {
    pipelineClients = [], pipelineContracts = [], pipelineSales = [], pipelinePayments = [],
    domains = [], addPipelineClient, updatePipelineClient, addFollowup,
  } = useAppData();

  const toast = onToast || (() => {});
  const domainNames = domains.length ? domains.filter((d) => d.status !== false).map((d) => d.name) : FALLBACK_DOMAINS;
  const assignedEmails = (emp.assignedIds || []).map((x) => (typeof x === "string" ? x : x.id)).filter(Boolean);

  const [search, setSearch] = useState("");
  const [filterOpen, setFilterOpen] = useState(false);
  const [filters, setFilters] = useState({ domain: "", status: "", region: "", assignedEmail: "" });
  const [quick, setQuick] = useState("all");
  const [sort, setSort] = useState("updated");
  const [addOpen, setAddOpen] = useState(false);
  const [hubId, setHubId] = useState(null);
  const [saving, setSaving] = useState(false);

  const blankClient = { assignedEmailId: assignedEmails[0] || "", clientName: "", clientEmail: "", projectName: "", region: "", domainName: domainNames[0] || "", status: "New Lead", notes: "", nextFollowUp: "", nextTime: "", nextActionType: "follow_up_call" };
  const [cForm, setCForm] = useState(blankClient);

  const mine = useMemo(() => pipelineClients.filter((c) => c.employeeId === emp.id && !c.isDeleted), [pipelineClients, emp.id]);
  const t = todayStr();
  const isOver = (c) => needsFU(c) && c.nextFollowUp && c.nextFollowUp < t;
  const isDue = (c) => needsFU(c) && c.nextFollowUp === t;
  const hasRec = (cid, arr) => arr.some((x) => x.clientId === cid);

  const dash = useMemo(() => {
    const myIds = new Set(mine.map((c) => c.id));
    return {
      active: mine.filter((c) => progressOf(c.status) >= 0 && !isClosed(c.status)).length,
      today: mine.filter(isDue).length,
      overdue: mine.filter(isOver).length,
      upcoming: mine.filter((c) => needsFU(c) && c.nextFollowUp && c.nextFollowUp > t).length,
      interested: mine.filter((c) => c.status === "Interested").length,
      contracts: pipelineContracts.filter((x) => myIds.has(x.clientId)).length,
      sales: pipelineSales.filter((x) => myIds.has(x.clientId)).length,
      payments: pipelinePayments.filter((x) => myIds.has(x.clientId)).length,
    };
  }, [mine, pipelineContracts, pipelineSales, pipelinePayments]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    let r = mine.filter((c) => {
      if (q && !`${c.clientName} ${c.projectName} ${c.companyName} ${c.clientEmail} ${c.domainName} ${clientCode(c.id)}`.toLowerCase().includes(q)) return false;
      if (filters.domain && c.domainName !== filters.domain) return false;
      if (filters.status && c.status !== filters.status) return false;
      if (filters.region && c.region !== filters.region) return false;
      if (filters.assignedEmail && c.assignedEmailId !== filters.assignedEmail) return false;
      if (quick === "active" && (progressOf(c.status) < 0 || isClosed(c.status))) return false;
      if (quick === "today" && !isDue(c)) return false;
      if (quick === "overdue" && !isOver(c)) return false;
      if (quick === "upcoming" && !(needsFU(c) && c.nextFollowUp && c.nextFollowUp > t)) return false;
      if (quick === "interested" && c.status !== "Interested") return false;
      if (quick === "contracts" && !hasRec(c.id, pipelineContracts)) return false;
      if (quick === "sales" && !hasRec(c.id, pipelineSales)) return false;
      if (quick === "payments" && !hasRec(c.id, pipelinePayments)) return false;
      return true;
    });
    const dir = (a, b, k) => String(a[k] || "").localeCompare(String(b[k] || ""));
    r = [...r].sort((a, b) => {
      if (sort === "name") return dir(a, b, "clientName");
      if (sort === "next") return dir(a, b, "nextFollowUp");
      if (sort === "domain") return dir(a, b, "domainName");
      return String(b.updatedAt || "").localeCompare(String(a.updatedAt || ""));
    });
    return r;
  }, [mine, search, filters, quick, sort, pipelineContracts, pipelineSales, pipelinePayments]);

  const hub = mine.find((c) => c.id === hubId) || null;

  /* ── Add lead ── */
  const doAddClient = async () => {
    if (!cForm.assignedEmailId) return toast("Please select an Assigned Email ID.", "error");
    if (!cForm.clientName.trim()) return toast("Client Name is required.", "error");
    if (!isEmail(cForm.clientEmail)) return toast("Please enter a valid Client Email.", "error");
    if (!cForm.domainName.trim()) return toast("Domain is required.", "error");
    if (!cForm.status.trim()) return toast("Status is required.", "error");
    if (DEAD.includes(cForm.status) && !cForm.notes.trim()) return toast("Add a note explaining why this lead is " + cForm.status + ".", "error");
    if (!DEAD.includes(cForm.status)) {
      if (!cForm.nextFollowUp) return toast("Next Follow-up Date is required.", "error");
      // Time is optional — a follow-up can be date-only.
    }
    if (mine.some((c) => c.domainName === cForm.domainName && c.clientEmail.toLowerCase() === cForm.clientEmail.trim().toLowerCase()))
      return toast("This client already exists under the selected domain.", "error");
    const domainId = (domains.find((d) => d.name === cForm.domainName) || {}).id || null;
    setSaving(true);
    const rec = await addPipelineClient({ ...cForm, clientEmail: cForm.clientEmail.trim(), employeeId: emp.id, domainId, nextFollowUpTime: cForm.nextTime });
    setSaving(false);
    if (rec) { setAddOpen(false); setCForm(blankClient); toast("Lead created and synced to Admin.", "success"); }
  };

  const badge = (name) => { const c = stageColour(name); return <span className="sv-pl-badge" style={{ background: c + "1A", color: c }}>{name}</span>; };
  const field = (label, node, req) => (<label className="sv-pl-field"><span>{label}{req && <b> *</b>}</span>{node}</label>);

  /* ── Lead card ── */
  const LeadCard = (c) => {
    const over = isOver(c), due = isDue(c);
    return (
      <div key={c.id} className={`sv-pl-card${over ? " is-over" : due ? " is-due" : ""}`} onClick={() => setHubId(c.id)}>
        <div className="sv-pl-card-top">
          <div style={{ minWidth: 0 }}>
            <div className="sv-pl-card-name">{c.clientName}</div>
            <div className="sv-pl-card-sub">{c.projectName || c.companyName || "—"}{c.region ? ` · ${c.region}` : ""}</div>
          </div>
          {badge(c.status)}
        </div>
        <div className="sv-pl-card-meta">
          <span><Hash size={11} /> {clientCode(c.id)}</span>
          <span><Globe size={12} /> {c.domainName || "—"}</span>
          <span><Mail size={12} /> {c.assignedEmailId || "—"}</span>
        </div>
        <div className="sv-pl-card-foot">
          <span className={over ? "sv-pl-over" : due ? "sv-pl-due" : ""}>
            {needsFU(c) ? `${over ? "Overdue" : due ? "Due today" : "Next"}: ${fmt(c.nextFollowUp)}${c.nextFollowUpTime ? ` · ${fmt12(c.nextFollowUpTime)}` : ""}` : "In production"}
          </span>
          <div className="sv-pl-card-acts" onClick={(e) => e.stopPropagation()}>
            <button className="sv-btn sv-btn--sm sv-btn--primary" onClick={() => setHubId(c.id)}><Pencil size={12} /> Edit</button>
          </div>
        </div>
      </div>
    );
  };

  const overdueRows = filtered.filter(isOver);
  const todayRows = filtered.filter((c) => isDue(c) && !isOver(c));
  const restRows = filtered.filter((c) => !isOver(c) && !isDue(c));

  const chips = [
    ["all", "All", mine.length, "#475569", "#64748B", Layers],
    ["active", "Active", dash.active, "#2563EB", "#3B82F6", Users],
    ["today", "Due Today", dash.today, "#16A34A", "#22C55E", CalendarDays],
    ["overdue", "Overdue", dash.overdue, "#DC2626", "#F05252", AlertTriangle],
    ["upcoming", "Upcoming", dash.upcoming, "#0891B2", "#06B6D4", Clock],
    ["interested", "Interested", dash.interested, "#EA580C", "#F97316", Target],
    ["contracts", "Contracts", dash.contracts, "#7C3AED", "#8B5CF6", FileText],
    ["sales", "Sales", dash.sales, "#0D9488", "#14B8A6", TrendingUp],
    ["payments", "Payments", dash.payments, "#15803D", "#22C55E", Wallet],
  ];

  return (
    <div className="sv-tab sv-pl">
      <datalist id="pl-status-list">{NURTURE_STATUSES.map((s) => <option key={s} value={s} />)}</datalist>
      <datalist id="pl-domain-list">{domainNames.map((d) => <option key={d} value={d} />)}</datalist>
      <datalist id="pl-region-list">{REGIONS.map((r) => <option key={r} value={r} />)}</datalist>
      <datalist id="pl-cur-list">{["USD", "AED", "INR", "EUR", "GBP", "AUD", "SGD"].map((c) => <option key={c} value={c} />)}</datalist>

      <div className="sv-flex sv-flex--between" style={{ flexWrap: "wrap", gap: 10 }}>
        <div><h2 className="sv-tab-title" style={{ margin: 0 }}>My Pipeline</h2><p className="sv-text-muted" style={{ fontSize: 12.5, margin: "2px 0 0" }}>From first contact to a live project — one place.</p></div>
        <button className="sv-btn sv-btn--primary" onClick={() => { setCForm(blankClient); setAddOpen(true); }}><Plus size={16} /> Add Lead</button>
      </div>

      <div className="sv-clp-kpigrid" style={{ marginTop: 14 }}>
        {chips.map(([k, l, v, c1, c2, Ic]) => (
          <button key={k} className={`sv-clp-card${quick === k ? " is-open" : ""}`} style={{ "--c1": c1, "--c2": c2 }} onClick={() => setQuick(k)}>
            <span className="sv-clp-card-ic"><Ic size={17} /></span>
            <div className="sv-clp-card-v">{v}</div><div className="sv-clp-card-l">{l}</div>
          </button>
        ))}
      </div>

      <div className="sv-pl-toolbar">
        <div className="sv-pl-search"><Search size={15} /><input placeholder="Search name, project, email, Client ID…" value={search} onChange={(e) => setSearch(e.target.value)} /></div>
        <button className={`sv-pl-tool${filterOpen ? " is-on" : ""}`} onClick={() => setFilterOpen((v) => !v)}><Filter size={15} /> Filter</button>
        <select className="sv-select sv-pl-sort" value={sort} onChange={(e) => setSort(e.target.value)}>
          <option value="updated">Last Updated</option><option value="name">Client Name</option>
          <option value="next">Next Follow-up</option><option value="domain">Domain</option>
        </select>
      </div>

      {filterOpen && (
        <div className="sv-pl-filters">
          <input className="sv-input" list="pl-domain-list" placeholder="Domain" value={filters.domain} onChange={(e) => setFilters({ ...filters, domain: e.target.value })} />
          <select className="sv-select" value={filters.status} onChange={(e) => setFilters({ ...filters, status: e.target.value })}><option value="">All statuses</option>{NURTURE_STATUSES.map((s) => <option key={s}>{s}</option>)}</select>
          <input className="sv-input" list="pl-region-list" placeholder="Region" value={filters.region} onChange={(e) => setFilters({ ...filters, region: e.target.value })} />
          <select className="sv-select" value={filters.assignedEmail} onChange={(e) => setFilters({ ...filters, assignedEmail: e.target.value })}><option value="">All emails</option>{assignedEmails.map((a) => <option key={a}>{a}</option>)}</select>
          <button className="sv-btn sv-btn--sm sv-btn--ghost" onClick={() => setFilters({ domain: "", status: "", region: "", assignedEmail: "" })}>Clear</button>
        </div>
      )}

      {filtered.length === 0 ? (
        <div className="sv-pl-empty">
          <span className="sv-pl-empty-ic"><Users size={30} /></span>
          <p className="sv-pl-empty-title">{mine.length === 0 ? "No leads yet" : "No matches"}</p>
          <p className="sv-pl-empty-sub">{mine.length === 0 ? "Add your first lead to start building your pipeline." : "No leads match your search or filters."}</p>
          {mine.length === 0 && <button className="sv-btn sv-btn--primary" onClick={() => { setCForm(blankClient); setAddOpen(true); }}><Plus size={15} /> Add your first lead</button>}
        </div>
      ) : quick === "all" ? (
        <>
          {overdueRows.length > 0 && (<><div className="sv-pl-group sv-pl-group--over"><AlertTriangle size={14} /> Overdue <span>{overdueRows.length}</span></div><div className="sv-pl-list">{overdueRows.map(LeadCard)}</div></>)}
          {todayRows.length > 0 && (<><div className="sv-pl-group sv-pl-group--today"><CalendarDays size={14} /> Today's Follow-ups <span>{todayRows.length}</span></div><div className="sv-pl-list">{todayRows.map(LeadCard)}</div></>)}
          {restRows.length > 0 && (<><div className="sv-pl-group">Pipeline <span>{restRows.length}</span></div><div className="sv-pl-list">{restRows.slice(0, 300).map(LeadCard)}</div>{restRows.length > 300 && <p className="sv-text-muted" style={{ fontSize: 12, textAlign: "center", padding: "6px 0" }}>Showing first 300 — use search or filters to narrow.</p>}</>)}
        </>
      ) : (
        <><div className="sv-pl-list">{filtered.slice(0, 300).map(LeadCard)}</div>{filtered.length > 300 && <p className="sv-text-muted" style={{ fontSize: 12, textAlign: "center", padding: "6px 0" }}>Showing first 300 of {filtered.length} — use search or filters to narrow.</p>}</>
      )}

      {/* Add lead */}
      {addOpen && (
        <div className="sv-modal-overlay sv-pl-overlay" onClick={() => setAddOpen(false)}>
          <div className="sv-modal" style={{ maxWidth: 540, maxHeight: "90vh", display: "flex", flexDirection: "column" }} onClick={(e) => e.stopPropagation()}>
            <div className="sv-modal-header" style={{ flexShrink: 0 }}><span className="sv-text-navy sv-font-800" style={{ fontSize: 16 }}>Add Lead</span><button className="sv-modal-close" onClick={() => setAddOpen(false)}>×</button></div>
            <div style={{ overflowY: "auto", padding: "16px 20px" }}>
              {field("Assigned Email ID", <select className="sv-select" value={cForm.assignedEmailId} onChange={(e) => setCForm({ ...cForm, assignedEmailId: e.target.value })}><option value="">Select…</option>{assignedEmails.map((a) => <option key={a}>{a}</option>)}</select>, true)}
              {assignedEmails.length === 0 && <p className="sv-text-muted" style={{ fontSize: 11.5, marginTop: -4 }}>No Assigned Email IDs yet — ask your admin to assign one.</p>}
              {field("Client Name", <input className="sv-input" value={cForm.clientName} onChange={(e) => setCForm({ ...cForm, clientName: e.target.value })} />, true)}
              {field("Project Name", <input className="sv-input" value={cForm.projectName} onChange={(e) => setCForm({ ...cForm, projectName: e.target.value })} placeholder="e.g. CEO Feature — Q3 Magazine" />)}
              {field("Client Email", <input className="sv-input" type="email" inputMode="email" value={cForm.clientEmail} onChange={(e) => setCForm({ ...cForm, clientEmail: e.target.value })} />, true)}
              <div className="sv-pl-2col">
                {field("Region", <input className="sv-input" list="pl-region-list" value={cForm.region} onChange={(e) => setCForm({ ...cForm, region: e.target.value })} placeholder="Type or pick…" />)}
                {field("Domain", <input className="sv-input" list="pl-domain-list" value={cForm.domainName} onChange={(e) => setCForm({ ...cForm, domainName: e.target.value })} placeholder="Type or pick…" />, true)}
              </div>
              {/* Stage is set automatically to "New Lead" — no manual status on creation. */}
              {field("Next Action", <select className="sv-select" value={cForm.nextActionType} onChange={(e) => setCForm({ ...cForm, nextActionType: e.target.value })}>{ACTION_TYPES.map((a) => <option key={a.value} value={a.value}>{a.label}</option>)}</select>, true)}
              <div className="sv-pl-2col">
                {field("Next Follow-up Date", <input className="sv-input" type="date" value={cForm.nextFollowUp} onChange={(e) => setCForm({ ...cForm, nextFollowUp: e.target.value })} />, true)}
                {field("Time (optional)", <input className="sv-input" type="time" value={cForm.nextTime} onChange={(e) => setCForm({ ...cForm, nextTime: e.target.value })} />)}
              </div>
              {field("Notes", <textarea className="sv-input" rows={2} value={cForm.notes} onChange={(e) => setCForm({ ...cForm, notes: e.target.value })} />)}
              <p className="sv-text-muted" style={{ fontSize: 11.5, marginTop: 8 }}>New leads start at <b>New Lead</b>. You'll move them forward from the client's page.</p>
              <button className="sv-btn sv-btn--primary" style={{ width: "100%", marginTop: 12 }} disabled={saving} onClick={doAddClient}>{saving ? "Saving…" : "Save Lead"}</button>
            </div>
          </div>
        </div>
      )}

      {/* Edit hub */}
      {hub && <LeadHub key={hub.id} client={hub} emp={emp} domainNames={domainNames} assignedEmails={assignedEmails}
        onClose={() => setHubId(null)} toast={toast} updatePipelineClient={updatePipelineClient} addFollowup={addFollowup} badge={badge} field={field} />}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
 * LeadHub — the single Edit screen: details, follow-up logger,
 * production workflow, and premium timeline.
 * ────────────────────────────────────────────────────────────*/
function LeadHub({ client, emp, domainNames, assignedEmails, onClose, toast, updatePipelineClient, addFollowup, badge, field }) {
  const t = todayStr();
  const nurturing = progressOf(client.status) <= 0;
  const priceLocked = progressOf(client.status) >= 2; // locked once Sales Generated
  const [d, setD] = useState({
    projectName: client.projectName || "", region: client.region || "", domainName: client.domainName || "",
    assignedEmailId: client.assignedEmailId || "", status: client.status, notes: client.notes || "",
    quote: client.expectedAmount ? String(client.expectedAmount) : "", quoteCur: client.expectedCurrency || "USD",
  });
  const [f, setF] = useState({ communicationType: "Update", notes: "", status: client.status, nextFollowUp: t, nextTime: "" });
  const [savingD, setSavingD] = useState(false);
  const [savingF, setSavingF] = useState(false);

  // ── Next Action (task) model ──
  const overdue = !!client.nextFollowUp && client.nextFollowUp < t && !DEAD.includes(client.status) && !isClosed(client.status);
  const hasAction = !!client.nextFollowUp && !DEAD.includes(client.status) && !isClosed(client.status);
  const [comp, setComp] = useState(null);   // Complete Action modal state
  const [resc, setResc] = useState(null);   // Reschedule modal state
  const [busyA, setBusyA] = useState(false);

  const openComplete = () => setComp({ notes: "", outcome: "", nextActionType: client.nextActionType || "follow_up_call", nextDate: "", nextTime: "" });
  const doComplete = async () => {
    if (!comp.notes.trim()) return toast("Please note what happened.", "error");
    const dead = DEAD.includes(comp.outcome === "Not Interested" ? "Not Interested" : comp.outcome === "Lost" ? "Lost" : "");
    if (!dead && !comp.nextDate) return toast("Set the next action date (or mark the lead Not Interested / Lost).", "error");
    setBusyA(true);
    const newStage = autoStageFromOutcome(client.status, comp.outcome);
    const ok = await addFollowup({
      clientId: client.id, employeeId: emp.id, clientName: client.clientName,
      communicationType: "Update", actionType: client.nextActionType || "", outcome: comp.outcome || "",
      notes: comp.notes.trim(),
      status: newStage || undefined,
      nextFollowUp: dead ? null : (comp.nextDate || null),
      nextFollowUpTime: dead ? null : (comp.nextTime || null),
      nextActionType: dead ? null : comp.nextActionType,
    });
    setBusyA(false);
    if (ok) { setComp(null); toast(dead ? "Lead closed." : "Action completed — next action scheduled.", "success"); }
  };

  const openReschedule = () => setResc({ nextDate: client.nextFollowUp || t, nextTime: client.nextFollowUpTime || "", reason: "" });
  const doReschedule = async () => {
    if (!resc.nextDate) return toast("Pick a new date.", "error");
    setBusyA(true);
    const ok = await addFollowup({
      clientId: client.id, employeeId: emp.id, clientName: client.clientName,
      communicationType: "Update", actionType: client.nextActionType || "", outcome: "Rescheduled",
      notes: resc.reason.trim() ? `Rescheduled: ${resc.reason.trim()}` : "Rescheduled",
      nextFollowUp: resc.nextDate, nextFollowUpTime: resc.nextTime || null, nextActionType: client.nextActionType || null,
    });
    setBusyA(false);
    if (ok) { setResc(null); toast("Action rescheduled.", "success"); }
  };

  const saveDetails = async () => {
    // A1: employees cannot reopen a closed (dead) lead — that needs Admin/Manager.
    if (DEAD.includes(client.status) && !DEAD.includes(d.status)) return toast("This lead is closed. Reopening it requires Admin/Manager — please ask your admin.", "error");
    if (nurturing && d.status !== client.status && WORKFLOW_CONTROLLED.includes(d.status)) return toast(`"${d.status}" is set by the Production Workflow buttons, not manually.`, "error");
    if (DEAD.includes(d.status) && !d.notes.trim()) return toast("A note is required to mark this lead as " + d.status + ".", "error");
    setSavingD(true);
    const ok = await updatePipelineClient(client.id, {
      projectName: d.projectName, region: d.region, domainName: d.domainName, assignedEmailId: d.assignedEmailId,
      notes: d.notes,
      ...(priceLocked ? {} : { expectedAmount: Number(d.quote) || 0, expectedCurrency: (d.quoteCur || "USD").toUpperCase() }),
      ...(nurturing ? { status: d.status, ...(d.status === "Lost" ? { lostReason: d.notes } : {}) } : {}),
    }, emp.id);
    setSavingD(false);
    if (ok) toast("Lead details updated.", "success");
  };

  const logFollowup = async () => {
    if (!f.notes.trim()) return toast("Follow-up notes are required.", "error");
    // A1: employees cannot reopen a closed (dead) lead — that needs Admin/Manager.
    if (DEAD.includes(client.status) && !DEAD.includes(f.status)) return toast("This lead is closed. Reopening it requires Admin/Manager — please ask your admin.", "error");
    if (f.status !== client.status && WORKFLOW_CONTROLLED.includes(f.status)) return toast(`"${f.status}" is set by the Production Workflow buttons, not manually.`, "error");
    if (DEAD.includes(f.status) && !f.notes.trim()) return toast("Notes are required for " + f.status + ".", "error");
    if (!DEAD.includes(f.status) && progressOf(f.status) < 3) {
      if (!f.nextFollowUp) return toast("Set the next follow-up date.", "error");
    }
    setSavingF(true);
    const ok = await addFollowup({ clientId: client.id, employeeId: emp.id, clientName: client.clientName, communicationType: f.communicationType, notes: f.notes, status: f.status, followUpDate: t, nextFollowUp: f.nextFollowUp || null, nextFollowUpTime: f.nextTime || null });
    setSavingF(false);
    if (ok) { setF({ communicationType: "Update", notes: "", status: client.status, nextFollowUp: t, nextTime: "" }); toast("Follow-up logged.", "success"); }
  };

  return (
    <div className="sv-modal-overlay sv-pl-overlay" onClick={onClose}>
      <div className="sv-modal sv-pl-detail" style={{ maxWidth: 720, maxHeight: "92vh", display: "flex", flexDirection: "column" }} onClick={(e) => e.stopPropagation()}>
        <div className="sv-modal-header" style={{ flexShrink: 0 }}>
          <button className="sv-btn sv-btn--sm sv-btn--ghost" onClick={onClose}><ArrowLeft size={14} /> Back</button>
          <button className="sv-modal-close" onClick={onClose}>×</button>
        </div>
        <div style={{ overflowY: "auto", padding: "16px 20px" }}>
          <div className="sv-pl-dhead">
            <div style={{ minWidth: 0 }}>
              <div className="sv-pl-dname">{client.clientName}</div>
              <div className="sv-text-muted" style={{ fontSize: 12.5 }}><span className="sv-pl-code">{clientCode(client.id)}</span> · {client.projectName || "No project name"} · {client.clientEmail}</div>
            </div>
            {badge(client.status)}
          </div>

          {/* ── NEXT ACTION card — the employee's primary "what do I do next" ── */}
          {!DEAD.includes(client.status) && !isClosed(client.status) && (
            <div className="sv-hub-card" style={{ marginTop: 10, border: `1px solid ${overdue ? "#FECACA" : "#E2E8F0"}`, background: overdue ? "#FEF2F2" : "#F8FBFF" }}>
              <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: .3, color: overdue ? "#B91C1C" : "#2563EB", textTransform: "uppercase" }}>{overdue ? "⚠ Overdue Action" : "Next Action"}</div>
              {hasAction ? (
                <>
                  <div style={{ fontSize: 15, fontWeight: 700, color: "#0f172a", marginTop: 4 }}>{actionLabel(client.nextActionType)}</div>
                  <div className="sv-text-muted" style={{ fontSize: 12.5, marginTop: 2 }}>{fmt(client.nextFollowUp)}{client.nextFollowUpTime ? ` · ${fmt12(client.nextFollowUpTime)}` : ""}</div>
                  <div className="sv-flex sv-gap-2" style={{ marginTop: 10 }}>
                    <button className="sv-btn sv-btn--primary sv-btn--sm" onClick={openComplete}><CheckCircle2 size={14} /> Complete Action</button>
                    <button className="sv-btn sv-btn--outline sv-btn--sm" onClick={openReschedule}><CalendarDays size={14} /> Reschedule</button>
                  </div>
                </>
              ) : (
                <>
                  <div className="sv-text-muted" style={{ fontSize: 13, marginTop: 4 }}>No follow-up scheduled.</div>
                  <button className="sv-btn sv-btn--primary sv-btn--sm" style={{ marginTop: 8 }} onClick={openComplete}><Plus size={14} /> Schedule Next Action</button>
                </>
              )}
            </div>
          )}

          {/* Workflow — hidden for brand-new leads so the first step stays simple (nurture first). */}
          <div className="sv-section-label" style={{ marginTop: 6 }}>Production Workflow</div>
          {client.status === "New Lead" ? (
            <div className="sv-hub-card sv-text-muted" style={{ fontSize: 12.5 }}>
              Nurture this lead with follow-ups first. The Contract → Sale → Payment workflow appears once you move it past <b>New Lead</b> (update the status below or after logging a follow-up).
            </div>
          ) : (
            <LeadWorkflow client={client} actorId={emp.id} onToast={toast} />
          )}

          {/* Lead details */}
          <div className="sv-section-label" style={{ marginTop: 18 }}>Lead Details</div>
          <div className="sv-hub-card">
            <div className="sv-pl-2col">
              {field("Project Name", <input className="sv-input" value={d.projectName} onChange={(e) => setD({ ...d, projectName: e.target.value })} />)}
              {field("Region", <input className="sv-input" list="pl-region-list" value={d.region} onChange={(e) => setD({ ...d, region: e.target.value })} />)}
              {field("Domain", <input className="sv-input" list="pl-domain-list" value={d.domainName} onChange={(e) => setD({ ...d, domainName: e.target.value })} />)}
              {field("Assigned Email", <select className="sv-select" value={d.assignedEmailId} onChange={(e) => setD({ ...d, assignedEmailId: e.target.value })}>{assignedEmails.map((a) => <option key={a}>{a}</option>)}{d.assignedEmailId && !assignedEmails.includes(d.assignedEmailId) && <option>{d.assignedEmailId}</option>}</select>)}
            </div>
            <div className="sv-pl-2col">
              {field(priceLocked ? "Agreed Price (locked)" : "Quoted Price", <input className="sv-input" type="number" inputMode="decimal" disabled={priceLocked} value={d.quote} onChange={(e) => setD({ ...d, quote: e.target.value })} placeholder="e.g. 3500" />)}
              {field("Currency", <input className="sv-input" list="pl-cur-list" disabled={priceLocked} value={d.quoteCur} onChange={(e) => setD({ ...d, quoteCur: e.target.value.toUpperCase() })} placeholder="e.g. AED" />)}
            </div>
            {priceLocked && <p className="sv-text-muted" style={{ fontSize: 11.5, marginTop: -4 }}>🔒 Price is locked from the generated sale. Edit the sale to change it.</p>}
            {nurturing && field("Current Status", <input className="sv-input" list="pl-status-list" value={d.status} onChange={(e) => setD({ ...d, status: e.target.value })} placeholder="Select a status or type your own…" />)}
            {DEAD.includes(client.status) && <p className="sv-text-muted" style={{ fontSize: 11.5, marginTop: -4, color: "#B45309" }}>🔒 This lead is closed ({client.status}). Reopening it requires Admin/Manager.</p>}
            {field(DEAD.includes(d.status) ? "Notes (reason required)" : "Notes", <textarea className="sv-input" rows={2} value={d.notes} onChange={(e) => setD({ ...d, notes: e.target.value })} />, DEAD.includes(d.status))}
            <button className="sv-btn sv-btn--outline" style={{ marginTop: 4 }} disabled={savingD} onClick={saveDetails}>{savingD ? "Saving…" : "Save Details"}</button>
          </div>

          {/* Follow-up logger */}
          <div className="sv-section-label" style={{ marginTop: 18 }}>Log a Follow-up</div>
          <div className="sv-hub-card">
            {field("Current Status", <input className="sv-input" list="pl-status-list" value={f.status} onChange={(e) => setF({ ...f, status: e.target.value })} placeholder="Update the status after this conversation…" />)}
            {field("What happened? (notes)", <textarea className="sv-input" rows={2} value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} placeholder="Summary of the call, email, or meeting…" />, true)}
            {!DEAD.includes(f.status) && progressOf(f.status) < 3 && (
              <div className="sv-pl-2col">
                {field("Next Follow-up Date", <input className="sv-input" type="date" value={f.nextFollowUp} onChange={(e) => setF({ ...f, nextFollowUp: e.target.value })} />, true)}
                {field("Time", <input className="sv-input" type="time" value={f.nextTime} onChange={(e) => setF({ ...f, nextTime: e.target.value })} />)}
              </div>
            )}
            <button className="sv-btn sv-btn--primary" style={{ marginTop: 4 }} disabled={savingF} onClick={logFollowup}>{savingF ? "Saving…" : "Log Follow-up"}</button>
          </div>

          {/* Timeline */}
          <div className="sv-section-label" style={{ marginTop: 18 }}>Activity Timeline</div>
          <LeadTimeline clientId={client.id} />
        </div>

        {/* ── Complete Action modal ── */}
        {comp && (
          <div className="sv-modal-overlay sv-pl-overlay" onClick={() => setComp(null)}>
            <div className="sv-modal" style={{ maxWidth: 440 }} onClick={(e) => e.stopPropagation()}>
              <div className="sv-modal-header"><span className="sv-text-navy sv-font-800" style={{ fontSize: 16 }}>Complete Action</span><button className="sv-modal-close" onClick={() => setComp(null)}>×</button></div>
              <div style={{ padding: "16px 20px" }}>
                <p className="sv-text-muted" style={{ fontSize: 12.5, marginTop: 0 }}>Current action: <b>{actionLabel(client.nextActionType)}</b></p>
                {field("What happened?", <textarea className="sv-input" rows={2} value={comp.notes} onChange={(e) => setComp({ ...comp, notes: e.target.value })} placeholder="Summary of the call / email / meeting…" />, true)}
                {field("Outcome", <select className="sv-select" value={comp.outcome} onChange={(e) => setComp({ ...comp, outcome: e.target.value })}><option value="">Select…</option>{OUTCOMES.map((o) => <option key={o} value={o}>{o}</option>)}</select>)}
                {!(comp.outcome === "Not Interested" || comp.outcome === "Lost") && (<>
                  {field("Next Action", <select className="sv-select" value={comp.nextActionType} onChange={(e) => setComp({ ...comp, nextActionType: e.target.value })}>{ACTION_TYPES.map((a) => <option key={a.value} value={a.value}>{a.label}</option>)}</select>, true)}
                  <div className="sv-pl-2col">
                    {field("Next Date", <input className="sv-input" type="date" value={comp.nextDate} onChange={(e) => setComp({ ...comp, nextDate: e.target.value })} />, true)}
                    {field("Time (optional)", <input className="sv-input" type="time" value={comp.nextTime} onChange={(e) => setComp({ ...comp, nextTime: e.target.value })} />)}
                  </div>
                </>)}
                {(comp.outcome === "Not Interested" || comp.outcome === "Lost") && <p className="sv-text-muted" style={{ fontSize: 11.5, color: "#B45309" }}>This will close the lead ({comp.outcome}). No further follow-up needed.</p>}
                <button className="sv-btn sv-btn--primary" style={{ width: "100%", marginTop: 10 }} disabled={busyA} onClick={doComplete}>{busyA ? "Saving…" : "Save & Schedule Next Action"}</button>
              </div>
            </div>
          </div>
        )}

        {/* ── Reschedule modal ── */}
        {resc && (
          <div className="sv-modal-overlay sv-pl-overlay" onClick={() => setResc(null)}>
            <div className="sv-modal" style={{ maxWidth: 400 }} onClick={(e) => e.stopPropagation()}>
              <div className="sv-modal-header"><span className="sv-text-navy sv-font-800" style={{ fontSize: 16 }}>Reschedule Action</span><button className="sv-modal-close" onClick={() => setResc(null)}>×</button></div>
              <div style={{ padding: "16px 20px" }}>
                <p className="sv-text-muted" style={{ fontSize: 12.5, marginTop: 0 }}>Current action: <b>{actionLabel(client.nextActionType)}</b></p>
                <div className="sv-pl-2col">
                  {field("New Date", <input className="sv-input" type="date" value={resc.nextDate} onChange={(e) => setResc({ ...resc, nextDate: e.target.value })} />, true)}
                  {field("Time (optional)", <input className="sv-input" type="time" value={resc.nextTime} onChange={(e) => setResc({ ...resc, nextTime: e.target.value })} />)}
                </div>
                {field("Reason (optional)", <input className="sv-input" value={resc.reason} onChange={(e) => setResc({ ...resc, reason: e.target.value })} placeholder="e.g. Client requested another time" />)}
                <button className="sv-btn sv-btn--primary" style={{ width: "100%", marginTop: 10 }} disabled={busyA} onClick={doReschedule}>{busyA ? "Saving…" : "Reschedule"}</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
