/**
 * Pipeline.jsx — Employee Pipeline (Contract Order → Signed → Payment Received → Paid).
 *
 * The pipeline is client-based. For each client the employee tracks ONE contract order and
 * ONE payment. A SIGNED contract counts as Sales; a PAID payment counts as Payment Received.
 * Follow-up management has been removed — this is the single source of truth for sales/payments.
 * The logged-in employee is attached automatically; employees only see their own clients.
 */
import { useState, useMemo } from "react";
import {
  Search, Filter, Plus, Pencil, ArrowLeft, Mail, Globe, Hash, Users,
  FileText, CheckCircle2, Wallet, TrendingUp, Send, X,
} from "lucide-react";
import { useAppData } from "../../data/AppDataContext";

const FALLBACK_DOMAINS = ["CIO Visionaries", "CEO Vision", "Arab World Leaders", "CXO Leaders", "Healthcare Leaders"];
const REGIONS = ["UAE", "Saudi Arabia", "India", "USA", "UK", "Australia", "Singapore", "Europe", "Africa"];
const CURRENCIES = ["INR", "USD", "AED", "AUD", "GBP", "EUR", "SGD"];
const CONTRACT_STATUSES = ["Contract Sent", "Signed", "Not Signed"];
const PAYMENT_STATUSES = ["Pending", "Paid"];
const todayStr = () => { const d = new Date(); return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10); };
const isEmail = (e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(e || "").trim());
const fmt = (d) => (d ? new Date(d + (String(d).length <= 10 ? "T00:00:00" : "")).toLocaleDateString() : "—");
const money = (a, c) => (a === "" || a == null || Number.isNaN(Number(a)) ? "—" : `${Number(a).toLocaleString()} ${c || ""}`.trim());
const clientCode = (id) => "SV-" + String(id || "").replace(/[^a-zA-Z0-9]/g, "").slice(0, 6).toUpperCase();

const cStatusColour = (s) => (s === "Signed" ? "#16A34A" : s === "Not Signed" ? "#DC2626" : s === "Contract Sent" ? "#2563EB" : "#94A3B8");
const pStatusColour = (s) => (s === "Paid" ? "#16A34A" : s === "Pending" ? "#D97706" : "#94A3B8");

export default function Pipeline({ emp, onToast }) {
  const { pipelineClients = [], domains = [], addPipelineClient, updatePipelineClient, uploadPipelineFile } = useAppData();
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

  const mine = useMemo(() => pipelineClients.filter((c) => c.employeeId === emp.id && !c.isDeleted), [pipelineClients, emp.id]);

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

  const hub = mine.find((c) => c.id === hubId) || null;

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
          <Wallet size={12} style={{ verticalAlign: "-2px", color: pStatusColour(c.paymentStatus) }} /> <span style={{ color: pStatusColour(c.paymentStatus), fontWeight: 600 }}>{c.paymentStatus || "—"}</span>
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
        <div><h2 className="sv-tab-title" style={{ margin: 0 }}>My Pipeline</h2><p className="sv-text-muted" style={{ fontSize: 12.5, margin: "2px 0 0" }}>Client → Contract Order → Signed → Payment Received → Paid.</p></div>
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

      {/* Add client */}
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
              <p className="sv-text-muted" style={{ fontSize: 11.5, marginTop: 8 }}>You'll add the Contract and Payment after the client is created. This client is automatically credited to you ({emp.name}).</p>
              <button className="sv-btn sv-btn--primary" style={{ width: "100%", marginTop: 12 }} disabled={saving} onClick={doAddClient}>{saving ? "Saving…" : "Save Client"}</button>
            </div>
          </div>
        </div>
      )}

      {hub && <ClientHub key={hub.id} client={hub} emp={emp} onClose={() => setHubId(null)} toast={toast}
        updatePipelineClient={updatePipelineClient} uploadPipelineFile={uploadPipelineFile} field={field} readOnly={false} />}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
 * ClientHub — the client's record: details + Contract Order + Payment.
 * Reused by Admin (readOnly=false, admin can edit everything).
 * ────────────────────────────────────────────────────────────*/
const plField = (label, node, req) => (<label className="sv-pl-field"><span>{label}{req && <b> *</b>}</span>{node}</label>);
export function ClientHub({ client, emp, actorId, onClose, toast, updatePipelineClient, uploadPipelineFile, field = plField, ownerName, extraFooter = null }) {
  const actor = actorId || (emp && emp.id) || "admin";
  const [c, setC] = useState({
    contractSent: !!client.contractSent,
    contractFileUrl: client.contractFileUrl || "", contractFileName: client.contractFileName || "",
    contractSentDate: client.contractSentDate || "", contractAmount: client.contractAmount === "" || client.contractAmount == null ? "" : String(client.contractAmount),
    contractCurrency: client.contractCurrency || "USD",
  });
  const [s, setS] = useState({
    signedFileUrl: client.contractSignedFileUrl || "", signedFileName: client.contractSignedFileName || "",
    signedAmount: client.signedAmount === "" || client.signedAmount == null ? "" : String(client.signedAmount),
    signedDate: client.signedDate || "",
  });
  const [p, setP] = useState({
    paymentReceived: !!client.paymentReceived,
    paymentAmount: client.paymentAmount === "" || client.paymentAmount == null ? "" : String(client.paymentAmount),
    paymentCurrency: client.paymentCurrency || client.contractCurrency || "USD", paymentDate: client.paymentDate || "",
    paymentStatus: client.paymentStatus || "",
  });
  const [busyC, setBusyC] = useState(false);
  const [busyS, setBusyS] = useState(false);
  const [busyP, setBusyP] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadingS, setUploadingS] = useState(false);

  // Persisted phase state (drives which blocks are unlocked).
  const sent = !!client.contractSent;
  const signed = client.contractStatus === "Signed";
  const paid = client.paymentStatus === "Paid";

  const uploadContract = async (fileList) => {
    const file = fileList && fileList[0];
    if (!file || !uploadPipelineFile) return;
    setUploading(true);
    const r = await uploadPipelineFile(file);
    setUploading(false);
    if (r) setC((st) => ({ ...st, contractFileUrl: r.url, contractFileName: r.name }));
  };

  const uploadSigned = async (fileList) => {
    const file = fileList && fileList[0];
    if (!file || !uploadPipelineFile) return;
    setUploadingS(true);
    const r = await uploadPipelineFile(file);
    setUploadingS(false);
    if (r) setS((st) => ({ ...st, signedFileUrl: r.url, signedFileName: r.name }));
  };

  // Phase 1 — Contract Sent.
  const saveContractSent = async () => {
    if (c.contractSent) {
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
      // Keep 'Signed' if already signed; otherwise reflect Contract Sent / cleared.
      contractStatus: signed ? "Signed" : (c.contractSent ? "Contract Sent" : ""),
    }, actor);
    setBusyC(false);
    if (ok) toast(c.contractSent ? "Contract Sent details saved." : "Contract marked as not sent.", "success");
  };

  // Phase 2 — Contract Signed (signed document is mandatory). Counted as Sales.
  const saveSigned = async () => {
    if (!s.signedFileUrl) return toast("Please upload the Signed Contract by Client. It is required.", "error");
    if (s.signedAmount === "" || !(Number(s.signedAmount) > 0)) return toast("Signed Amount is required.", "error");
    if (!s.signedDate) return toast("Signed Date is required.", "error");
    setBusyS(true);
    const ok = await updatePipelineClient(client.id, {
      contractStatus: "Signed",
      contractSignedFileUrl: s.signedFileUrl, contractSignedFileName: s.signedFileName,
      signedAmount: s.signedAmount, signedDate: s.signedDate,
    }, actor);
    setBusyS(false);
    if (ok) toast("Contract Signed saved and counted as Sales.", "success");
  };

  // Phase 3 — Payment Received. Counted as Payment Received.
  const savePayment = async () => {
    if (p.paymentAmount === "" || !(Number(p.paymentAmount) > 0)) return toast("Payment Amount is required.", "error");
    if (!p.paymentCurrency.trim()) return toast("Payment Currency is required.", "error");
    if (!p.paymentDate) return toast("Payment Received Date is required.", "error");
    setBusyP(true);
    const ok = await updatePipelineClient(client.id, {
      paymentReceived: true, paymentStatus: "Paid",
      paymentAmount: p.paymentAmount,
      paymentCurrency: p.paymentCurrency.toUpperCase(),
      paymentDate: p.paymentDate || "",
    }, actor);
    setBusyP(false);
    if (ok) toast("Payment saved and counted as Payment Received.", "success");
  };

  return (
    <div className="sv-modal-overlay sv-pl-overlay" onClick={onClose}>
      <div className="sv-modal sv-pl-detail" style={{ maxWidth: 700, maxHeight: "92vh", display: "flex", flexDirection: "column" }} onClick={(e) => e.stopPropagation()}>
        <div className="sv-modal-header" style={{ flexShrink: 0 }}>
          <button className="sv-btn sv-btn--sm sv-btn--ghost" onClick={onClose}><ArrowLeft size={14} /> Back</button>
          <button className="sv-modal-close" onClick={onClose}>×</button>
        </div>
        <div style={{ overflowY: "auto", padding: "16px 20px", background: "#F8FAFC" }}>
          {/* ── Client information header ── */}
          <div className="sv-ch2-head">
            <div className="sv-ch2-title">{client.clientName}</div>
            <div className="sv-ch2-meta">
              <div><span className="k">Client ID</span><span className="v">{clientCode(client.id)}</span></div>
              <div><span className="k">Project Name</span><span className="v">{client.projectName || "—"}</span></div>
              <div><span className="k">Contact Person ID</span><span className="v">{client.assignedEmailId || "—"}</span></div>
              <div><span className="k">Domain / Region</span><span className="v">{[client.domainName, client.region].filter(Boolean).join(" · ") || "—"}</span></div>
              <div><span className="k">Employee</span><span className="v">{ownerName || (emp && emp.name) || "—"}</span></div>
            </div>
            {client.notes ? <div className="sv-ch2-notes"><b>Notes:</b> {client.notes}</div> : null}
          </div>

          {/* ── Independent phase KPI cards ── */}
          <div className="sv-ch2-grid">
            {/* Phase 1 — Contract Sent (orange) */}
            <div className="sv-ch2-card" style={{ "--pac": "#EA580C", "--pbg": "#FFF7ED", "--pbd": "#FED7AA" }}>
              <div className="sv-ch2-chead">
                <span className="sv-ch2-ic"><Send size={18} /></span>
                <div style={{ minWidth: 0 }}>
                  <div className="sv-ch2-cphase">Phase 1</div>
                  <div className="sv-ch2-ctitle">Contract Sent</div>
                </div>
                <span className={`sv-ch2-cstatus${sent ? "" : "--idle"}`}>{sent ? "Sent" : "Not sent"}</span>
              </div>
              <div className="sv-ch2-cbody">
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
                  ))}
                  <div className="sv-pl-2col">
                    {field("Contract Amount", <input className="sv-input" type="number" inputMode="decimal" value={c.contractAmount} onChange={(e) => setC({ ...c, contractAmount: e.target.value })} placeholder="e.g. 1000" />, true)}
                    {field("Currency", <input className="sv-input" list="pl-cur-list" value={c.contractCurrency} onChange={(e) => setC({ ...c, contractCurrency: e.target.value.toUpperCase() })} placeholder="e.g. USD" />, true)}
                  </div>
                  {field("Sent Date", <input className="sv-input" type="date" value={c.contractSentDate} onChange={(e) => setC({ ...c, contractSentDate: e.target.value })} />, true)}
                </>)}
                <button className="sv-ch2-save" disabled={busyC || uploading} onClick={saveContractSent}>{busyC ? "Saving…" : "Save Contract Sent"}</button>
              </div>
            </div>

            {/* Phase 2 — Contract Signed (yellow). Signed file mandatory; counts as Sales. */}
            <div className="sv-ch2-card" style={{ "--pac": "#CA8A04", "--pbg": "#FEFCE8", "--pbd": "#FDE68A" }}>
              <div className="sv-ch2-chead">
                <span className="sv-ch2-ic"><FileText size={18} /></span>
                <div style={{ minWidth: 0 }}>
                  <div className="sv-ch2-cphase">Phase 2</div>
                  <div className="sv-ch2-ctitle">Contract Signed</div>
                </div>
                <span className={`sv-ch2-cstatus${signed ? "" : "--idle"}`}>{signed ? "Signed" : "Pending"}</span>
              </div>
              <div className="sv-ch2-cbody">
                <div className="sv-ch2-figure">
                  <span className={`amt${signed ? "" : "--idle"}`}>{signed ? money(client.signedAmount, client.contractCurrency) : "—"}</span>
                  {client.signedDate ? <span className="dt">Signed {fmt(client.signedDate)}</span> : null}
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
                  {field("Signed Amount", <input className="sv-input" type="number" inputMode="decimal" value={s.signedAmount} onChange={(e) => setS({ ...s, signedAmount: e.target.value })} placeholder="e.g. 1000" />, true)}
                  {field("Signed Date", <input className="sv-input" type="date" value={s.signedDate} onChange={(e) => setS({ ...s, signedDate: e.target.value })} />, true)}
                </div>
                <p className="sv-text-muted" style={{ fontSize: 11.5, margin: "2px 0 0" }}>The signed contract file is required. On save, the Signed Amount is counted as Sales.</p>
                <button className="sv-ch2-save" disabled={busyS || uploadingS} onClick={saveSigned}>{busyS ? "Saving…" : signed ? "Update Signed Contract" : "Save Signed Contract"}</button>
              </div>
            </div>

            {/* Phase 3 — Payment Received (green) */}
            <div className="sv-ch2-card" style={{ "--pac": "#16A34A", "--pbg": "#F0FDF4", "--pbd": "#BBF7D0" }}>
              <div className="sv-ch2-chead">
                <span className="sv-ch2-ic"><Wallet size={18} /></span>
                <div style={{ minWidth: 0 }}>
                  <div className="sv-ch2-cphase">Phase 3</div>
                  <div className="sv-ch2-ctitle">Payment Received</div>
                </div>
                <span className={`sv-ch2-cstatus${paid ? "" : "--idle"}`}>{paid ? "Paid" : "Pending"}</span>
              </div>
              <div className="sv-ch2-cbody">
                <div className="sv-ch2-figure">
                  <span className={`amt${paid ? "" : "--idle"}`}>{paid ? money(client.paymentAmount, client.paymentCurrency) : "—"}</span>
                  {client.paymentDate ? <span className="dt">Received {fmt(client.paymentDate)}</span> : null}
                </div>
                <div className="sv-pl-2col">
                  {field("Payment Amount", <input className="sv-input" type="number" inputMode="decimal" value={p.paymentAmount} onChange={(e) => setP({ ...p, paymentAmount: e.target.value })} placeholder="e.g. 1000" />, true)}
                  {field("Currency", <input className="sv-input" list="pl-cur-list" value={p.paymentCurrency} onChange={(e) => setP({ ...p, paymentCurrency: e.target.value.toUpperCase() })} placeholder="e.g. USD" />, true)}
                </div>
                {field("Payment Received Date", <input className="sv-input" type="date" value={p.paymentDate} onChange={(e) => setP({ ...p, paymentDate: e.target.value })} />, true)}
                <p className="sv-text-muted" style={{ fontSize: 11.5, margin: "2px 0 0" }}>On save, the amount is counted as Payment Received.</p>
                <button className="sv-ch2-save" disabled={busyP} onClick={savePayment}>{busyP ? "Saving…" : paid ? "Update Payment" : "Save Payment"}</button>
              </div>
            </div>
          </div>

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
