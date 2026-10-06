/**
 * Pipeline.jsx — Employee Pipeline (Contract Sent → Signed → Payment).
 * Sales = signedAmount (Phase 2). Multiple payments via pipeline_payments table.
 */
import { useState, useMemo } from "react";
import {
  Search, Filter, Plus, Pencil, ArrowLeft, Mail, Globe, Hash, Users,
  FileText, CheckCircle2, Wallet, TrendingUp, Send, X, Lock, History,
  ChevronDown, ChevronUp, UserX, AlertCircle, RotateCcw,
} from "lucide-react";
import { useAppData } from "../../data/AppDataContext";

const FALLBACK_DOMAINS = ["CIO Visionaries", "CEO Vision", "Arab World Leaders", "CXO Leaders", "Healthcare Leaders"];
const REGIONS = ["UAE", "Saudi Arabia", "India", "USA", "UK", "Australia", "Singapore", "Europe", "Africa"];
const CURRENCIES = ["INR", "USD", "AED", "AUD", "GBP", "EUR", "SGD"];
const CONTRACT_STATUSES = ["Contract Sent", "Signed", "Not Signed"];
const PAYMENT_STATUSES = ["Pending", "Partially Paid", "Paid"];
const PAYMENT_METHODS = ["Bank Transfer", "UPI", "Cash", "Cheque", "Wire Transfer", "Online", "Other"];

const todayStr = () => { const d = new Date(); return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10); };
const fmt = (d) => (d ? new Date(d + (String(d).length <= 10 ? "T00:00:00" : "")).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—");
const money = (a, c) => (a === "" || a == null || Number.isNaN(Number(a)) ? "—" : `${Number(a).toLocaleString()} ${c || ""}`.trim());
const clientCode = (id) => "SV-" + String(id || "").replace(/[^a-zA-Z0-9]/g, "").slice(0, 6).toUpperCase();
const cStatusColour = (s) => (s === "Signed" ? "#16A34A" : s === "Not Signed" ? "#DC2626" : s === "Contract Sent" ? "#2563EB" : "#94A3B8");
const pStatusColour = (s) => (s === "Paid" ? "#16A34A" : s === "Partially Paid" ? "#0891B2" : s === "Pending" ? "#D97706" : "#94A3B8");

export default function Pipeline({ emp, onToast }) {
  const { pipelineClients = [], pipelinePayments = [], domains = [], addPipelineClient, updatePipelineClient, uploadPipelineFile, addPipelinePayment } = useAppData();
  const toast = onToast || (() => {});
  const domainNames = domains.length ? domains.filter((d) => d.status !== false).map((d) => d.name) : FALLBACK_DOMAINS;
  const assignedEmails = (emp.assignedIds || []).map((x) => (typeof x === "string" ? x : x.id)).filter(Boolean);

  const [search, setSearch] = useState("");
  const [filterOpen, setFilterOpen] = useState(false);
  const [filters, setFilters] = useState({ domain: "", contract: "", payment: "" });
  const [quick, setQuick] = useState("all");
  const [addOpen, setAddOpen] = useState(false);
  const [hubId, setHubId] = useState(null);
  const [saving, setSaving] = useState(false);

  const blankClient = { assignedEmailId: assignedEmails[0] || "", clientName: "", projectName: "", region: "", domainName: domainNames[0] || "", notes: "" };
  const [cForm, setCForm] = useState(blankClient);

  const allMine = useMemo(() => pipelineClients.filter((c) => c.employeeId === emp.id && !c.isDeleted), [pipelineClients, emp.id]);
  const mine = useMemo(() => allMine.filter((c) => c.contractStatus !== "Opted Out"), [allMine]);
  const optedOutClients = useMemo(() => allMine.filter((c) => c.contractStatus === "Opted Out").sort((a, b) => String(b.updatedAt || "").localeCompare(String(a.updatedAt || ""))), [allMine]);
  const [showOptedOut, setShowOptedOut] = useState(false);

  // Compute per-client received totals from pipeline_payments table
  const receivedByClient = useMemo(() => {
    const m = {};
    pipelinePayments.forEach((p) => { if (p.amount > 0) m[p.clientId] = (m[p.clientId] || 0) + p.amount; });
    return m;
  }, [pipelinePayments]);

  const dash = useMemo(() => ({
    all: mine.length,
    sent: mine.filter((c) => c.contractSent).length,
    signed: mine.filter((c) => c.contractStatus === "Signed").length,
    paid: mine.filter((c) => c.paymentStatus === "Paid").length,
    pendingPay: mine.filter((c) => c.contractStatus === "Signed" && c.paymentStatus !== "Paid").length,
  }), [mine]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return mine.filter((c) => {
      if (q && !`${c.clientName} ${c.projectName} ${c.assignedEmailId} ${c.domainName} ${clientCode(c.id)}`.toLowerCase().includes(q)) return false;
      if (filters.domain && c.domainName !== filters.domain) return false;
      if (filters.contract && (c.contractStatus || "") !== filters.contract) return false;
      if (filters.payment && (c.paymentStatus || "") !== filters.payment) return false;
      if (quick === "signed" && c.contractStatus !== "Signed") return false;
      if (quick === "paid" && c.paymentStatus !== "Paid") return false;
      if (quick === "pendingPay" && !(c.contractStatus === "Signed" && c.paymentStatus !== "Paid")) return false;
      if (quick === "sent" && !c.contractSent) return false;
      return true;
    }).sort((a, b) => String(b.updatedAt || "").localeCompare(String(a.updatedAt || "")));
  }, [mine, search, filters, quick]);

  const hub = allMine.find((c) => c.id === hubId) || null;

  const doAddClient = async () => {
    if (!cForm.clientName.trim()) return toast("Client Name is required.", "error");
    if (!cForm.assignedEmailId) return toast("Please select a Contact Person ID.", "error");
    if (!cForm.domainName.trim()) return toast("Domain is required.", "error");
    if (mine.some((c) => c.domainName === cForm.domainName && (c.clientName || "").trim().toLowerCase() === cForm.clientName.trim().toLowerCase()))
      return toast("This client already exists under the selected domain.", "error");
    const domainId = (domains.find((d) => d.name === cForm.domainName) || {}).id || null;
    setSaving(true);
    const rec = await addPipelineClient({ ...cForm, clientName: cForm.clientName.trim(), employeeId: emp.id, domainId, status: "Active" });
    setSaving(false);
    if (rec) { setAddOpen(false); setCForm(blankClient); setHubId(rec.id); toast("Client added.", "success"); }
  };

  const field = (label, node, req) => (<label className="sv-pl-field"><span>{label}{req && <b> *</b>}</span>{node}</label>);

  const ClientCard = (c) => (
    <div key={c.id} className="sv-pl-card" onClick={() => setHubId(c.id)}>
      <div className="sv-pl-card-top">
        <div style={{ minWidth: 0 }}>
          <div className="sv-pl-card-name">{c.clientName}</div>
          <div className="sv-pl-card-sub">{c.projectName || "No project"}{c.region ? ` · ${c.region}` : ""}</div>
        </div>
        <span className="sv-pl-badge" style={{ background: cStatusColour(c.contractStatus) + "1A", color: cStatusColour(c.contractStatus) }}>
          {c.contractStatus || "No contract"}
        </span>
      </div>
      <div className="sv-pl-card-meta">
        <span><Hash size={11} /> {clientCode(c.id)}</span>
        <span><Globe size={12} /> {c.domainName || "—"}</span>
        <span><Mail size={12} /> {c.assignedEmailId || "—"}</span>
      </div>
      <div className="sv-pl-card-foot">
        <span style={{ fontSize: 12 }}>
          <TrendingUp size={12} style={{ verticalAlign: "-2px" }} /> {c.contractStatus === "Signed" ? money(c.signedAmount, c.contractCurrency) : "—"}
          <span style={{ margin: "0 6px", color: "#CBD5E1" }}>|</span>
          <Wallet size={12} style={{ verticalAlign: "-2px", color: pStatusColour(c.paymentStatus) }} />{" "}
          <span style={{ color: pStatusColour(c.paymentStatus), fontWeight: 600 }}>{c.paymentStatus || "—"}</span>
        </span>
        <div className="sv-pl-card-acts" onClick={(e) => e.stopPropagation()}>
          <button className="sv-btn sv-btn--sm sv-btn--primary" onClick={() => setHubId(c.id)}><Pencil size={12} /> Open</button>
        </div>
      </div>
    </div>
  );

  const chips = [
    ["all", "All Clients", dash.all, "#475569", "#64748B", Users],
    ["sent", "Contract Sent", dash.sent, "#2563EB", "#3B82F6", Send],
    ["signed", "Signed (Sales)", dash.signed, "#0D9488", "#14B8A6", TrendingUp],
    ["pendingPay", "Payment Pending", dash.pendingPay, "#D97706", "#F59E0B", FileText],
    ["paid", "Paid", dash.paid, "#15803D", "#22C55E", Wallet],
  ];

  return (
    <div className="sv-tab sv-pl">
      <datalist id="pl-domain-list">{domainNames.map((d) => <option key={d} value={d} />)}</datalist>
      <datalist id="pl-region-list">{REGIONS.map((r) => <option key={r} value={r} />)}</datalist>
      <datalist id="pl-cur-list">{CURRENCIES.map((c) => <option key={c} value={c} />)}</datalist>

      <div className="sv-flex sv-flex--between" style={{ flexWrap: "wrap", gap: 10 }}>
        <div><h2 className="sv-tab-title" style={{ margin: 0 }}>My Pipeline</h2><p className="sv-text-muted" style={{ fontSize: 12.5, margin: "2px 0 0" }}>Contract Sent → Signed (Sales) → Payment Received.</p></div>
        <button className="sv-btn sv-btn--primary" onClick={() => { setCForm(blankClient); setAddOpen(true); }}><Plus size={16} /> Add Client</button>
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
        <div className="sv-pl-search"><Search size={15} /><input placeholder="Search client, company, email, Client ID…" value={search} onChange={(e) => setSearch(e.target.value)} /></div>
        <button className={`sv-pl-tool${filterOpen ? " is-on" : ""}`} onClick={() => setFilterOpen((v) => !v)}><Filter size={15} /> Filter</button>
      </div>

      {filterOpen && (
        <div className="sv-pl-filters">
          <input className="sv-input" list="pl-domain-list" placeholder="Domain" value={filters.domain} onChange={(e) => setFilters({ ...filters, domain: e.target.value })} />
          <select className="sv-select" value={filters.contract} onChange={(e) => setFilters({ ...filters, contract: e.target.value })}><option value="">Any contract status</option>{CONTRACT_STATUSES.map((s) => <option key={s}>{s}</option>)}</select>
          <select className="sv-select" value={filters.payment} onChange={(e) => setFilters({ ...filters, payment: e.target.value })}><option value="">Any payment status</option>{PAYMENT_STATUSES.map((s) => <option key={s}>{s}</option>)}</select>
          <button className="sv-btn sv-btn--sm sv-btn--ghost" onClick={() => setFilters({ domain: "", contract: "", payment: "" })}>Clear</button>
        </div>
      )}

      {filtered.length === 0 ? (
        <div className="sv-pl-empty">
          <span className="sv-pl-empty-ic"><Users size={30} /></span>
          <p className="sv-pl-empty-title">{mine.length === 0 ? "No clients yet" : "No matches"}</p>
          <p className="sv-pl-empty-sub">{mine.length === 0 ? "Add your first client to start tracking contracts and payments." : "No clients match your search or filters."}</p>
          {mine.length === 0 && <button className="sv-btn sv-btn--primary" onClick={() => { setCForm(blankClient); setAddOpen(true); }}><Plus size={15} /> Add your first client</button>}
        </div>
      ) : (
        <div className="sv-pl-list">{filtered.slice(0, 300).map(ClientCard)}{filtered.length > 300 && <p className="sv-text-muted" style={{ fontSize: 12, textAlign: "center", padding: "6px 0" }}>Showing first 300. Use search or filters to narrow.</p>}</div>
      )}

      {/* ── Opted Out Clients block ── */}
      {optedOutClients.length > 0 && (
        <div style={{ marginTop: 20 }}>
          <button
            onClick={() => setShowOptedOut((v) => !v)}
            style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", background: "#FFF1F2", border: "1px solid #FECDD3", borderRadius: 10, padding: "10px 16px", cursor: "pointer", textAlign: "left" }}
          >
            <UserX size={16} style={{ color: "#BE123C", flexShrink: 0 }} />
            <span style={{ flex: 1, fontWeight: 700, color: "#BE123C", fontSize: 13.5 }}>Opted Out Clients</span>
            <span style={{ background: "#BE123C", color: "#fff", borderRadius: 20, padding: "1px 9px", fontSize: 12, fontWeight: 700 }}>{optedOutClients.length}</span>
            {showOptedOut ? <ChevronUp size={15} style={{ color: "#BE123C" }} /> : <ChevronDown size={15} style={{ color: "#BE123C" }} />}
          </button>
          {showOptedOut && (
            <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 8 }}>
              {optedOutClients.map((c) => (
                <div key={c.id} style={{ background: "#FFF1F2", border: "1px solid #FECDD3", borderRadius: 10, padding: "12px 14px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap", opacity: 0.85 }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: 13.5, color: "#9F1239" }}>{c.clientName}</div>
                    <div style={{ fontSize: 11.5, color: "#BE123C", marginTop: 2 }}>{c.domainName || "—"} · {c.assignedEmailId || "—"}</div>
                    {c.lostReason && <div style={{ fontSize: 11.5, color: "#64748B", marginTop: 3 }}>Reason: {c.lostReason}</div>}
                  </div>
                  <button className="sv-btn sv-btn--sm sv-btn--ghost" style={{ flexShrink: 0, fontSize: 12 }} onClick={() => setHubId(c.id)}>
                    <Pencil size={12} /> View / Restore
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {addOpen && (
        <div className="sv-modal-overlay sv-pl-overlay" onClick={() => setAddOpen(false)}>
          <div className="sv-modal" style={{ maxWidth: 520, maxHeight: "90vh", display: "flex", flexDirection: "column" }} onClick={(e) => e.stopPropagation()}>
            <div className="sv-modal-header" style={{ flexShrink: 0 }}><span className="sv-text-navy sv-font-800" style={{ fontSize: 16 }}>Add Client</span><button className="sv-modal-close" onClick={() => setAddOpen(false)}>×</button></div>
            <div style={{ overflowY: "auto", padding: "16px 20px" }}>
              {field("Client Name", <input className="sv-input" value={cForm.clientName} onChange={(e) => setCForm({ ...cForm, clientName: e.target.value })} />, true)}
              {field("Project Name", <input className="sv-input" value={cForm.projectName} onChange={(e) => setCForm({ ...cForm, projectName: e.target.value })} placeholder="e.g. Q3 Feature Campaign" />)}
              {field("Contact Person ID", <select className="sv-select" value={cForm.assignedEmailId} onChange={(e) => setCForm({ ...cForm, assignedEmailId: e.target.value })}><option value="">Select…</option>{assignedEmails.map((a) => <option key={a}>{a}</option>)}</select>, true)}
              {assignedEmails.length === 0 && <p className="sv-text-muted" style={{ fontSize: 11.5, marginTop: -4 }}>No assigned mail IDs yet. Ask your admin to assign one.</p>}
              <div className="sv-pl-2col">
                {field("Domain", <input className="sv-input" list="pl-domain-list" value={cForm.domainName} onChange={(e) => setCForm({ ...cForm, domainName: e.target.value })} placeholder="Type or pick…" />, true)}
                {field("Region", <input className="sv-input" list="pl-region-list" value={cForm.region} onChange={(e) => setCForm({ ...cForm, region: e.target.value })} placeholder="Type or pick…" />)}
              </div>
              {field("Notes", <textarea className="sv-input" rows={3} value={cForm.notes} onChange={(e) => setCForm({ ...cForm, notes: e.target.value })} placeholder="Any notes about this client…" style={{ resize: "vertical" }} />)}
              <p className="sv-text-muted" style={{ fontSize: 11.5, marginTop: 8 }}>Contract and payment details are added after the client is created. This client is credited to you ({emp.name}).</p>
              <button className="sv-btn sv-btn--primary" style={{ width: "100%", marginTop: 12 }} disabled={saving} onClick={doAddClient}>{saving ? "Saving…" : "Save Client"}</button>
            </div>
          </div>
        </div>
      )}

      {hub && (
        <ClientHub
          key={hub.id}
          client={hub}
          emp={emp}
          onClose={() => setHubId(null)}
          toast={toast}
          updatePipelineClient={updatePipelineClient}
          uploadPipelineFile={uploadPipelineFile}
          addPipelinePayment={addPipelinePayment}
          pipelinePayments={pipelinePayments}
          field={field}
          readOnly={false}
        />
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
 * ClientHub — client detail: info + Contract Sent + Signed + Payments.
 * Reused by Admin (actorId="admin"). Multiple payments supported.
 * ────────────────────────────────────────────────────────────*/
const plField = (label, node, req) => (<label className="sv-pl-field"><span>{label}{req && <b> *</b>}</span>{node}</label>);

export function ClientHub({ client, emp, actorId, onClose, toast, updatePipelineClient, uploadPipelineFile, addPipelinePayment, pipelinePayments = [], field = plField, ownerName, extraFooter = null }) {
  const actor = actorId || (emp && emp.id) || "admin";
  const isAdmin = actor === "admin";

  // Phase 1 state
  const [c, setC] = useState({
    contractSent: !!client.contractSent,
    contractFileUrl: client.contractFileUrl || "", contractFileName: client.contractFileName || "",
    contractSentDate: client.contractSentDate || "",
    contractAmount: client.contractAmount === "" || client.contractAmount == null ? "" : String(client.contractAmount),
    contractCurrency: client.contractCurrency || "USD",
  });
  // Phase 2 state
  const [s, setS] = useState({
    signedFileUrl: client.contractSignedFileUrl || "", signedFileName: client.contractSignedFileName || "",
    signedAmount: client.signedAmount === "" || client.signedAmount == null ? "" : String(client.signedAmount),
    signedDate: client.signedDate || "",
  });
  // New payment form
  const contractCur = client.contractCurrency || "USD";
  const [payForm, setPayForm] = useState({ amount: "", currency: contractCur, date: todayStr(), method: "Bank Transfer", notes: "" });
  const [showPayForm, setShowPayForm] = useState(false);

  const [busyC, setBusyC] = useState(false);
  const [busyS, setBusyS] = useState(false);
  const [busyPay, setBusyPay] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadingS, setUploadingS] = useState(false);
  const [showOptOut, setShowOptOut] = useState(false);
  const [optOutReason, setOptOutReason] = useState(client.lostReason || "");
  const [busyOptOut, setBusyOptOut] = useState(false);
  const [unlockP1, setUnlockP1] = useState(false);
  const [unlockP2, setUnlockP2] = useState(false);

  // Persisted phase state
  const sent = !!client.contractSent;
  const signed = client.contractStatus === "Signed";
  const optedOut = client.contractStatus === "Opted Out";
  // Phase 1 was skipped: Phase 2 completed without Phase 1
  const phase1Skipped = signed && !sent;

  // Payments from pipeline_payments table for this client
  const clientPayments = useMemo(() =>
    (pipelinePayments || [])
      .filter((p) => p.clientId === client.id && p.amount > 0)
      .sort((a, b) => String(b.paymentDate || b.createdAt || "").localeCompare(String(a.paymentDate || a.createdAt || ""))),
    [pipelinePayments, client.id]
  );

  const contractValue = Number(client.signedAmount) || 0;
  const totalReceived = useMemo(() =>
    clientPayments.filter((p) => p.currency === contractCur).reduce((sum, p) => sum + p.amount, 0),
    [clientPayments, contractCur]
  );
  const pendingAmount = Math.max(0, contractValue - totalReceived);
  const payStatus = contractValue === 0 ? "—"
    : totalReceived === 0 ? "Not Paid"
    : totalReceived >= contractValue ? "Fully Paid"
    : "Partially Paid";
  const payStatusColor = payStatus === "Fully Paid" ? "#16A34A" : payStatus === "Partially Paid" ? "#0891B2" : payStatus === "Not Paid" ? "#D97706" : "#94A3B8";

  const uploadContract = async (fileList) => {
    const file = fileList && fileList[0]; if (!file || !uploadPipelineFile) return;
    setUploading(true); const r = await uploadPipelineFile(file); setUploading(false);
    if (r) setC((st) => ({ ...st, contractFileUrl: r.url, contractFileName: r.name }));
  };
  const uploadSigned = async (fileList) => {
    const file = fileList && fileList[0]; if (!file || !uploadPipelineFile) return;
    setUploadingS(true); const r = await uploadPipelineFile(file); setUploadingS(false);
    if (r) setS((st) => ({ ...st, signedFileUrl: r.url, signedFileName: r.name }));
  };

  // Phase 1 — Contract Sent (file is MANDATORY when marking as sent)
  const saveContractSent = async () => {
    if (c.contractSent) {
      if (!c.contractFileUrl) return toast("Contract file is required. Please upload the contract document.", "error");
      if (!c.contractSentDate) return toast("Contract Sent Date is required.", "error");
      if (c.contractAmount === "" || !(Number(c.contractAmount) > 0)) return toast("Contract Amount is required.", "error");
      if (!c.contractCurrency.trim()) return toast("Currency is required.", "error");
    }
    setBusyC(true);
    const ok = await updatePipelineClient(client.id, {
      contractSent: c.contractSent,
      contractFileUrl: c.contractFileUrl, contractFileName: c.contractFileName,
      contractSentDate: c.contractSent ? (c.contractSentDate || "") : "",
      contractAmount: c.contractSent ? c.contractAmount : "",
      contractCurrency: c.contractSent ? c.contractCurrency.toUpperCase() : "",
      contractStatus: signed ? "Signed" : (c.contractSent ? "Contract Sent" : ""),
    }, actor);
    setBusyC(false);
    if (ok) toast(c.contractSent ? "Contract Sent saved." : "Contract marked as not sent.", "success");
  };

  // Phase 2 — Contract Signed. Sales = signedAmount.
  const saveSigned = async () => {
    if (!s.signedFileUrl) return toast("Signed contract file is required.", "error");
    if (s.signedAmount === "" || !(Number(s.signedAmount) > 0)) return toast("Signed Amount is required.", "error");
    if (!s.signedDate) return toast("Signed Date is required.", "error");
    setBusyS(true);
    const ok = await updatePipelineClient(client.id, {
      contractStatus: "Signed",
      contractSignedFileUrl: s.signedFileUrl, contractSignedFileName: s.signedFileName,
      signedAmount: s.signedAmount, signedDate: s.signedDate,
    }, actor);
    setBusyS(false);
    if (ok) toast("Contract Signed saved. Signed Amount counted as Sales.", "success");
  };

  // Phase 3 — Add Payment (writes to pipeline_payments, updates client status)
  const doAddPayment = async () => {
    if (!payForm.amount || !(Number(payForm.amount) > 0)) return toast("Payment Amount is required.", "error");
    if (!payForm.currency.trim()) return toast("Currency is required.", "error");
    if (!payForm.date) return toast("Payment Date is required.", "error");
    if (!addPipelinePayment) return toast("Payment function not available.", "error");
    setBusyPay(true);
    const ok = await addPipelinePayment({
      clientId: client.id,
      employeeId: isAdmin ? (client.employeeId || null) : actor,
      amount: Number(payForm.amount),
      currency: payForm.currency.toUpperCase(),
      paymentDate: payForm.date,
      paymentMethod: payForm.method || null,
      notes: payForm.notes || null,
      clientName: client.clientName,
    });
    if (ok) {
      // Sync paymentStatus on the client row based on new total
      const newTotal = totalReceived + Number(payForm.amount);
      const newStatus = contractValue > 0 && newTotal >= contractValue ? "Paid" : "Partially Paid";
      await updatePipelineClient(client.id, {
        paymentStatus: newStatus,
        paymentAmount: newTotal,
        paymentCurrency: payForm.currency.toUpperCase(),
        paymentDate: payForm.date,
        paymentReceived: true,
      }, actor);
      toast("Payment recorded.", "success");
      setShowPayForm(false);
      setPayForm((f) => ({ ...f, amount: "", notes: "" }));
    }
    setBusyPay(false);
  };

  const saveOptOut = async () => {
    setBusyOptOut(true);
    const ok = await updatePipelineClient(client.id, {
      contractStatus: "Opted Out",
      lostReason: optOutReason.trim() || null,
    }, actor);
    setBusyOptOut(false);
    if (ok) { toast("Client marked as Opted Out.", "success"); setShowOptOut(false); onClose(); }
  };
  const undoOptOut = async () => {
    setBusyOptOut(true);
    const prev = signed ? "Signed" : sent ? "Contract Sent" : "";
    const ok = await updatePipelineClient(client.id, { contractStatus: prev, lostReason: null }, actor);
    setBusyOptOut(false);
    if (ok) toast("Client restored to active pipeline.", "success");
  };

  const phaseIcon = (done, skipped) => {
    if (skipped) return <span style={{ fontSize: 13, color: "#94A3B8" }}>○</span>;
    if (done) return <CheckCircle2 size={15} style={{ color: "#16A34A" }} />;
    return <span style={{ fontSize: 13, color: "#CBD5E1" }}>○</span>;
  };

  return (
    <div className="sv-modal-overlay sv-pl-overlay" onClick={onClose}>
      <div className="sv-modal sv-pl-detail" style={{ maxWidth: 680, maxHeight: "94vh", display: "flex", flexDirection: "column" }} onClick={(e) => e.stopPropagation()}>

        {/* Header */}
        <div className="sv-modal-header" style={{ flexShrink: 0 }}>
          <button className="sv-btn sv-btn--sm sv-btn--ghost" onClick={onClose}><ArrowLeft size={14} /> Back</button>
          <button className="sv-modal-close" onClick={onClose}>×</button>
        </div>

        <div style={{ overflowY: "auto", padding: "16px 20px", background: "#F8FAFC" }}>

          {/* Client info */}
          <div className="sv-ch2-head">
            <div className="sv-ch2-title">{client.clientName}</div>
            <div className="sv-ch2-meta">
              <div><span className="k">Client ID</span><span className="v">{clientCode(client.id)}</span></div>
              <div><span className="k">Project</span><span className="v">{client.projectName || "—"}</span></div>
              <div><span className="k">Contact Person ID</span><span className="v">{client.assignedEmailId || "—"}</span></div>
              <div><span className="k">Domain / Region</span><span className="v">{[client.domainName, client.region].filter(Boolean).join(" · ") || "—"}</span></div>
              <div><span className="k">Employee</span><span className="v">{ownerName || (emp && emp.name) || "—"}</span></div>
            </div>
            {client.notes ? <div className="sv-ch2-notes"><b>Notes:</b> {client.notes}</div> : null}
          </div>

          {/* Progress stepper */}
          <div style={{ display: "flex", alignItems: "center", gap: 0, margin: "14px 0 16px", background: "#fff", border: "1px solid #E2E8F0", borderRadius: 12, padding: "10px 16px" }}>
            {[
              { label: "Contract Sent", done: sent, skipped: phase1Skipped, color: "#EA580C" },
              { label: "Contract Signed", done: signed, skipped: false, color: "#CA8A04" },
              { label: "Payment", done: payStatus === "Fully Paid", skipped: false, color: "#16A34A" },
            ].map((step, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", flex: i < 2 ? 1 : "none" }}>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}>
                  <div style={{ width: 26, height: 26, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center",
                    background: step.done ? "#ECFDF5" : step.skipped ? "#F8FAFC" : "#F1F5F9",
                    border: `2px solid ${step.done ? step.color : step.skipped ? "#CBD5E1" : "#E2E8F0"}` }}>
                    {step.done ? <CheckCircle2 size={13} color={step.color} /> : step.skipped ? <Lock size={11} color="#94A3B8" /> : <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#CBD5E1", display: "block" }} />}
                  </div>
                  <span style={{ fontSize: 10, fontWeight: 600, color: step.done ? step.color : step.skipped ? "#94A3B8" : "#64748B", whiteSpace: "nowrap" }}>{step.label}</span>
                </div>
                {i < 2 && <div style={{ flex: 1, height: 2, background: step.done ? "#BBF7D0" : "#E2E8F0", margin: "0 6px", marginBottom: 14 }} />}
              </div>
            ))}
          </div>

          <div className="sv-ch2-grid">

            {/* ── Phase 1 — Contract Sent (Orange) ── */}
            <div className="sv-ch2-card" style={{ "--pac": "#EA580C", "--pbg": "#FFF7ED", "--pbd": "#FED7AA" }}>
              <div className="sv-ch2-chead">
                <span className="sv-ch2-ic"><Send size={18} /></span>
                <div style={{ minWidth: 0 }}>
                  <div className="sv-ch2-cphase">Phase 1</div>
                  <div className="sv-ch2-ctitle">Contract Sent</div>
                </div>
                <span className={`sv-ch2-cstatus${sent ? "" : phase1Skipped ? "--idle" : "--idle"}`}>
                  {phase1Skipped ? "Skipped" : sent ? "Sent ✓" : "Not sent"}
                </span>
              </div>
              <div className="sv-ch2-cbody">
                {/* Locked when Phase 2 is done (unless admin unlocked) */}
                {signed && !unlockP1 ? (
                  sent ? (
                    <div>
                      <div style={{ display: "flex", alignItems: "flex-start", gap: 10, background: "#FFF7ED", border: "1px solid #FED7AA", borderRadius: 8, padding: "10px 12px", marginBottom: 10 }}>
                        <Lock size={15} style={{ color: "#EA580C", flexShrink: 0, marginTop: 1 }} />
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 12.5, fontWeight: 700, color: "#9A3412" }}>Locked — Contract Signed</div>
                          <div style={{ fontSize: 11.5, color: "#C2410C", marginTop: 2 }}>{isAdmin ? "Phase 2 is complete. Unlock to edit." : "Phase 2 is complete. Contact your admin to edit."}</div>
                        </div>
                        {isAdmin && <button className="sv-btn sv-btn--sm sv-btn--outline" style={{ flexShrink: 0, fontSize: 11, borderColor: "#EA580C", color: "#EA580C" }} onClick={() => setUnlockP1(true)}><Pencil size={11} /> Unlock</button>}
                      </div>
                      <div className="sv-ch2-figure">
                        <span className="amt">{money(client.contractAmount, client.contractCurrency)}</span>
                        {client.contractSentDate && <span className="dt">Sent {fmt(client.contractSentDate)}</span>}
                      </div>
                      {client.contractFileUrl && (
                        <div style={{ marginTop: 6 }}>
                          <a href={client.contractFileUrl} target="_blank" rel="noreferrer" style={{ fontSize: 12.5, color: "#EA580C", display: "inline-flex", alignItems: "center", gap: 4 }}>
                            <FileText size={13} /> {client.contractFileName || "View contract file"}
                          </a>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div style={{ display: "flex", alignItems: "flex-start", gap: 10, background: "#FFF7ED", border: "1px solid #FED7AA", borderRadius: 8, padding: "10px 12px" }}>
                      <Lock size={15} style={{ color: "#EA580C", flexShrink: 0, marginTop: 1 }} />
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 12.5, fontWeight: 700, color: "#9A3412" }}>Skipped / Not Recorded</div>
                        <div style={{ fontSize: 11.5, color: "#C2410C", marginTop: 2 }}>{isAdmin ? "Phase 2 was recorded first. Unlock to fill." : "Phase 2 was recorded first. Contact your admin."}</div>
                      </div>
                      {isAdmin && <button className="sv-btn sv-btn--sm sv-btn--outline" style={{ flexShrink: 0, fontSize: 11, borderColor: "#EA580C", color: "#EA580C" }} onClick={() => setUnlockP1(true)}><Pencil size={11} /> Unlock</button>}
                    </div>
                  )
                ) : (
                  <>
                    <div className="sv-ch2-figure">
                      <span className={`amt${c.contractSent && c.contractAmount ? "" : "--idle"}`}>{c.contractSent && c.contractAmount ? money(c.contractAmount, c.contractCurrency) : "—"}</span>
                      {c.contractSentDate ? <span className="dt">Sent {fmt(c.contractSentDate)}</span> : null}
                    </div>
                    {field("Contract Sent?", (
                      <div className="sv-flex sv-gap-2">
                        <button type="button" className={`sv-btn sv-btn--sm ${c.contractSent ? "sv-btn--primary" : "sv-btn--outline"}`} onClick={() => setC({ ...c, contractSent: true })}>Yes</button>
                        <button type="button" className={`sv-btn sv-btn--sm ${!c.contractSent ? "sv-btn--primary" : "sv-btn--outline"}`} onClick={() => setC({ ...c, contractSent: false })}>No</button>
                      </div>
                    ))}
                    {c.contractSent && (<>
                      {field("Contract File", (
                        <div className="sv-flex sv-gap-sm" style={{ alignItems: "center", flexWrap: "wrap" }}>
                          <label className="sv-btn sv-btn--sm sv-btn--outline" style={{ cursor: "pointer", margin: 0 }}>
                            <Plus size={13} /> {uploading ? "Uploading…" : c.contractFileUrl ? "Replace file" : "Upload file"}
                            <input type="file" accept="image/*,application/pdf,.doc,.docx,.xls,.xlsx" style={{ display: "none" }} disabled={uploading} onChange={(e) => uploadContract(e.target.files)} />
                          </label>
                          {c.contractFileUrl && <a href={c.contractFileUrl} target="_blank" rel="noreferrer" style={{ fontSize: 12.5, color: "#EA580C", display: "inline-flex", alignItems: "center", gap: 4 }}><FileText size={13} /> {c.contractFileName || "View file"}</a>}
                          {c.contractFileUrl && <button type="button" className="sv-chip-btn sv-chip-btn--red" onClick={() => setC({ ...c, contractFileUrl: "", contractFileName: "" })}><X size={11} /> Remove</button>}
                        </div>
                      ), true)}
                      <div className="sv-pl-2col">
                        {field("Contract Amount", <input className="sv-input" type="number" inputMode="decimal" value={c.contractAmount} onChange={(e) => setC({ ...c, contractAmount: e.target.value })} placeholder="e.g. 3000" />, true)}
                        {field("Currency", <input className="sv-input" list="pl-cur-list" value={c.contractCurrency} onChange={(e) => setC({ ...c, contractCurrency: e.target.value.toUpperCase() })} placeholder="e.g. AED" />, true)}
                      </div>
                      {field("Sent Date", <input className="sv-input" type="date" value={c.contractSentDate} onChange={(e) => setC({ ...c, contractSentDate: e.target.value })} />, true)}
                      <p className="sv-text-muted" style={{ fontSize: 11, margin: "2px 0 0" }}>Contract file is required to save.</p>
                    </>)}
                    <button className="sv-ch2-save" disabled={busyC || uploading} onClick={saveContractSent}>{busyC ? "Saving…" : "Save Contract Sent"}</button>
                  </>
                )}
              </div>
            </div>

            {/* ── Phase 2 — Contract Signed (Yellow) — Sales = signedAmount ── */}
            <div className="sv-ch2-card" style={{ "--pac": "#CA8A04", "--pbg": "#FEFCE8", "--pbd": "#FDE68A" }}>
              <div className="sv-ch2-chead">
                <span className="sv-ch2-ic"><FileText size={18} /></span>
                <div style={{ minWidth: 0 }}>
                  <div className="sv-ch2-cphase">Phase 2</div>
                  <div className="sv-ch2-ctitle">Contract Signed</div>
                </div>
                <span className={`sv-ch2-cstatus${signed ? "" : "--idle"}`}>{signed ? "Signed ✓" : "Pending"}</span>
              </div>
              <div className="sv-ch2-cbody">
                {/* Locked when signed (unless admin unlocked) */}
                {signed && !unlockP2 ? (
                  <div>
                    <div style={{ display: "flex", alignItems: "flex-start", gap: 10, background: "#FEFCE8", border: "1px solid #FDE68A", borderRadius: 8, padding: "10px 12px", marginBottom: 10 }}>
                      <Lock size={15} style={{ color: "#CA8A04", flexShrink: 0, marginTop: 1 }} />
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 12.5, fontWeight: 700, color: "#854D0E" }}>Locked — Contract Signed</div>
                        <div style={{ fontSize: 11.5, color: "#A16207", marginTop: 2 }}>{isAdmin ? "This phase is complete. Unlock to edit." : "This phase is complete. Contact your admin."}</div>
                      </div>
                      {isAdmin && <button className="sv-btn sv-btn--sm sv-btn--outline" style={{ flexShrink: 0, fontSize: 11, borderColor: "#CA8A04", color: "#CA8A04" }} onClick={() => setUnlockP2(true)}><Pencil size={11} /> Unlock</button>}
                    </div>
                    <div className="sv-ch2-figure">
                      <span className="amt">{money(client.signedAmount, client.contractCurrency)}</span>
                      {client.signedDate && <span className="dt">Signed {fmt(client.signedDate)}</span>}
                      <span className="dt" style={{ color: "#16A34A", fontWeight: 600 }}>= Current Sales</span>
                    </div>
                    {client.contractSignedFileUrl && (
                      <div style={{ marginTop: 6 }}>
                        <a href={client.contractSignedFileUrl} target="_blank" rel="noreferrer" style={{ fontSize: 12.5, color: "#CA8A04", display: "inline-flex", alignItems: "center", gap: 4 }}>
                          <FileText size={13} /> {client.contractSignedFileName || "View signed contract"}
                        </a>
                      </div>
                    )}
                  </div>
                ) : (
                  <>
                    <div className="sv-ch2-figure">
                      <span className={`amt${signed ? "" : "--idle"}`}>{signed ? money(client.signedAmount, client.contractCurrency) : "—"}</span>
                      {client.signedDate ? <span className="dt">Signed {fmt(client.signedDate)}</span> : null}
                      {signed && <span className="dt" style={{ color: "#16A34A", fontWeight: 600 }}>= Current Sales</span>}
                    </div>
                    {field("Signed Contract by Client", (
                      <div className="sv-flex sv-gap-sm" style={{ alignItems: "center", flexWrap: "wrap" }}>
                        <label className="sv-btn sv-btn--sm sv-btn--outline" style={{ cursor: "pointer", margin: 0 }}>
                          <Plus size={13} /> {uploadingS ? "Uploading…" : s.signedFileUrl ? "Replace file" : "Upload signed file"}
                          <input type="file" accept="image/*,application/pdf,.doc,.docx,.xls,.xlsx" style={{ display: "none" }} disabled={uploadingS} onChange={(e) => uploadSigned(e.target.files)} />
                        </label>
                        {s.signedFileUrl && <a href={s.signedFileUrl} target="_blank" rel="noreferrer" style={{ fontSize: 12.5, color: "#CA8A04", display: "inline-flex", alignItems: "center", gap: 4 }}><FileText size={13} /> {s.signedFileName || "View file"}</a>}
                        {s.signedFileUrl && <button type="button" className="sv-chip-btn sv-chip-btn--red" onClick={() => setS({ ...s, signedFileUrl: "", signedFileName: "" })}><X size={11} /> Remove</button>}
                      </div>
                    ), true)}
                    <div className="sv-pl-2col">
                      {field("Signed Amount", <input className="sv-input" type="number" inputMode="decimal" value={s.signedAmount} onChange={(e) => setS({ ...s, signedAmount: e.target.value })} placeholder="e.g. 3000" />, true)}
                      {field("Signed Date", <input className="sv-input" type="date" value={s.signedDate} onChange={(e) => setS({ ...s, signedDate: e.target.value })} />, true)}
                    </div>
                    <p className="sv-text-muted" style={{ fontSize: 11, margin: "2px 0 0" }}>Signed file is required. Signed Amount counts as Sales — visible on Admin KPIs instantly.</p>
                    <button className="sv-ch2-save" disabled={busyS || uploadingS} onClick={saveSigned}>{busyS ? "Saving…" : signed ? "Update Signed Contract" : "Save Signed Contract"}</button>
                  </>
                )}
              </div>
            </div>

            {/* ── Phase 3 — Payment Received (Green) — Multiple payments ── */}
            <div className="sv-ch2-card" style={{ "--pac": "#16A34A", "--pbg": "#F0FDF4", "--pbd": "#BBF7D0" }}>
              <div className="sv-ch2-chead">
                <span className="sv-ch2-ic"><Wallet size={18} /></span>
                <div style={{ minWidth: 0 }}>
                  <div className="sv-ch2-cphase">Phase 3</div>
                  <div className="sv-ch2-ctitle">Payment Received</div>
                </div>
                <span className={`sv-ch2-cstatus${payStatus === "Fully Paid" ? "" : "--idle"}`} style={{ color: payStatusColor }}>
                  {payStatus === "—" ? "Pending" : payStatus}
                </span>
              </div>
              <div className="sv-ch2-cbody">

                {/* Payment summary */}
                {contractValue > 0 && (
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8, marginBottom: 12 }}>
                    {[
                      { label: "Contract Value", value: money(contractValue, contractCur), color: "#CA8A04" },
                      { label: "Received", value: money(totalReceived, contractCur), color: "#16A34A" },
                      { label: "Pending", value: money(pendingAmount, contractCur), color: pendingAmount > 0 ? "#EA580C" : "#16A34A" },
                    ].map(({ label, value, color }) => (
                      <div key={label} style={{ background: "#fff", border: "1px solid #E2E8F0", borderRadius: 8, padding: "8px 10px", textAlign: "center" }}>
                        <div style={{ fontSize: 10, color: "#94A3B8", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 3 }}>{label}</div>
                        <div style={{ fontSize: 13.5, fontWeight: 800, color }}>{value}</div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Payment history */}
                {clientPayments.length > 0 && (
                  <div style={{ marginBottom: 12 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 7 }}>
                      <History size={13} style={{ color: "#64748B" }} />
                      <span style={{ fontSize: 11, fontWeight: 700, color: "#64748B", textTransform: "uppercase", letterSpacing: "0.05em" }}>Payment History</span>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                      {clientPayments.map((pay, i) => (
                        <div key={pay.id || i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "#fff", border: "1px solid #E2E8F0", borderRadius: 7, padding: "7px 11px", fontSize: 12.5 }}>
                          <div style={{ display: "flex", align: "center", gap: 8 }}>
                            <span style={{ fontWeight: 700, color: "#16A34A" }}>{money(pay.amount, pay.currency)}</span>
                            {pay.paymentMethod && <span style={{ color: "#94A3B8", fontSize: 11 }}>· {pay.paymentMethod}</span>}
                          </div>
                          <span style={{ color: "#64748B", fontSize: 11 }}>{fmt(pay.paymentDate || pay.createdAt)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Add Payment */}
                {!showPayForm ? (
                  <button className="sv-btn sv-btn--sm sv-btn--outline" style={{ width: "100%", justifyContent: "center", borderColor: "#16A34A", color: "#16A34A" }} onClick={() => setShowPayForm(true)}>
                    <Plus size={14} /> Add Payment
                  </button>
                ) : (
                  <div style={{ background: "#fff", border: "1px solid #BBF7D0", borderRadius: 10, padding: "12px 14px" }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: "#15803D", marginBottom: 10 }}>Record Payment</div>
                    <div className="sv-pl-2col">
                      {plField("Amount", <input className="sv-input" type="number" inputMode="decimal" value={payForm.amount} onChange={(e) => setPayForm({ ...payForm, amount: e.target.value })} placeholder="e.g. 1000" />, true)}
                      {plField("Currency", <input className="sv-input" list="pl-cur-list" value={payForm.currency} onChange={(e) => setPayForm({ ...payForm, currency: e.target.value.toUpperCase() })} placeholder="e.g. AED" />, true)}
                    </div>
                    {plField("Payment Date", <input className="sv-input" type="date" value={payForm.date} onChange={(e) => setPayForm({ ...payForm, date: e.target.value })} />, true)}
                    {plField("Payment Method", (
                      <select className="sv-input" value={payForm.method} onChange={(e) => setPayForm({ ...payForm, method: e.target.value })}>
                        {PAYMENT_METHODS.map((m) => <option key={m}>{m}</option>)}
                      </select>
                    ))}
                    {plField("Notes (optional)", <input className="sv-input" value={payForm.notes} onChange={(e) => setPayForm({ ...payForm, notes: e.target.value })} placeholder="Reference number, remarks…" />)}
                    <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                      <button className="sv-btn sv-btn--sm sv-btn--ghost" onClick={() => setShowPayForm(false)}>Cancel</button>
                      <button className="sv-btn sv-btn--sm sv-btn--primary" style={{ flex: 1, background: "#16A34A", borderColor: "#16A34A", justifyContent: "center" }} disabled={busyPay} onClick={doAddPayment}>{busyPay ? "Saving…" : "Save Payment"}</button>
                    </div>
                  </div>
                )}

                <p className="sv-text-muted" style={{ fontSize: 11, margin: "8px 0 0" }}>Each payment is recorded separately. History is preserved.</p>
              </div>
            </div>

          </div>{/* end sv-ch2-grid */}

          {/* ── Opt Out Block ── */}
          {optedOut ? (
            <div style={{ marginTop: 16, background: "#FFF1F2", border: "1.5px solid #FECDD3", borderRadius: 12, padding: "14px 16px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                <UserX size={16} style={{ color: "#BE123C", flexShrink: 0 }} />
                <span style={{ fontWeight: 700, color: "#BE123C", fontSize: 13.5 }}>Client has Opted Out</span>
              </div>
              {client.lostReason && <p style={{ fontSize: 12.5, color: "#9F1239", margin: "0 0 10px" }}>Reason: {client.lostReason}</p>}
              <p style={{ fontSize: 12, color: "#64748B", margin: "0 0 10px" }}>This client is removed from the active pipeline. You can restore them if they change their mind.</p>
              <button className="sv-btn sv-btn--sm sv-btn--outline" style={{ borderColor: "#BE123C", color: "#BE123C" }} disabled={busyOptOut} onClick={undoOptOut}>
                <RotateCcw size={13} /> {busyOptOut ? "Restoring…" : "Restore to Active Pipeline"}
              </button>
            </div>
          ) : (
            <div style={{ marginTop: 16 }}>
              {!showOptOut ? (
                <button
                  className="sv-btn sv-btn--sm sv-btn--ghost"
                  style={{ width: "100%", justifyContent: "center", borderColor: "#FECDD3", color: "#BE123C", fontSize: 12.5 }}
                  onClick={() => setShowOptOut(true)}
                >
                  <UserX size={14} /> Client wants to opt out?
                </button>
              ) : (
                <div style={{ background: "#FFF1F2", border: "1.5px solid #FECDD3", borderRadius: 12, padding: "14px 16px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 10 }}>
                    <AlertCircle size={15} style={{ color: "#BE123C", flexShrink: 0 }} />
                    <span style={{ fontWeight: 700, color: "#BE123C", fontSize: 13 }}>Confirm Opt Out</span>
                  </div>
                  <p style={{ fontSize: 12.5, color: "#9F1239", margin: "0 0 10px" }}>This will move the client out of the active pipeline into the Opted Out list. No data is deleted and it can be reversed.</p>
                  <label className="sv-pl-field" style={{ marginBottom: 10 }}>
                    <span style={{ fontSize: 12, color: "#64748B" }}>Reason (optional)</span>
                    <input className="sv-input" value={optOutReason} onChange={(e) => setOptOutReason(e.target.value)} placeholder="e.g. Budget constraints, Not interested now…" />
                  </label>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button className="sv-btn sv-btn--sm sv-btn--ghost" onClick={() => { setShowOptOut(false); setOptOutReason(""); }}>Cancel</button>
                    <button
                      className="sv-btn sv-btn--sm sv-btn--danger"
                      style={{ flex: 1, justifyContent: "center" }}
                      disabled={busyOptOut}
                      onClick={saveOptOut}
                    >
                      <UserX size={13} /> {busyOptOut ? "Saving…" : "Confirm — Move to Opted Out"}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {extraFooter && (
            <div className="sv-flex sv-justify-between sv-items-center" style={{ marginTop: 18, borderTop: "1px solid #F1F5F9", paddingTop: 14 }}>
              <span className="sv-text-muted" style={{ fontSize: 11.5 }}>Admin action</span>
              {extraFooter}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
