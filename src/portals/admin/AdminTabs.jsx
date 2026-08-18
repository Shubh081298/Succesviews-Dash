/**
 * AdminTabs.jsx — Admin Portal tab content (Overview, Reports,
 * Leaderboard, Analytics, Departments, Leave Board, Settings).
 * Admin-only; never imported by the Employee Portal.
 */
import { useState, useEffect, useRef } from "react";
import {
  PieChart, Pie, Cell, BarChart, Bar, LineChart, Line, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from "recharts";
import { ClickCard, Avatar } from "../../components/ui";
import { DeptCard } from "../../components/admin";
import {
  CHART_COLORS, TT, LEG, TICK, NAVY, BLUE, GREEN, ORANGE, PURPLE, AMBER,
} from "../../utils/constants";
import { fmtDate, fmtCurr, fmtSalary, sum, empLabel, humanizeKey, downloadCSV, domainColor } from "../../utils/helpers";
import { supabase } from "../../utils/supabaseClient";
import { Mail, Send, Target, Handshake, CheckCircle2, Phone, Megaphone, IndianRupee, FileText, Banknote } from "lucide-react";
import { Download, Plus, Pencil, KeyRound, Eye, EyeOff, X, Palette, Building2 } from "lucide-react";
import { Palmtree, CalendarDays, Clock, XCircle, Check, Search as SearchIcon, Inbox } from "lucide-react";
import { LayoutDashboard, Receipt, Users as UsersIcon } from "lucide-react";
import { Layers, TrendingUp, Trash2, UserPlus, CalendarCheck, FileSignature } from "lucide-react";
import { Users, ShieldCheck, MessageSquare, Globe2, Image as ImageIcon, Briefcase as BriefcaseIcon, UserCog } from "lucide-react";
import { FolderOpen, BookOpen, Wallet, Bell, ArrowLeft, AlertTriangle } from "lucide-react";
import WorkflowTimeline, { buildRevisions } from "../../components/design/WorkflowTimeline";
import LeadWorkflow from "../../components/crm/LeadWorkflow";
import LeadTimeline from "../../components/crm/LeadTimeline";
import LeadReverseActions from "../../components/crm/LeadReverseActions";
import { NURTURE_STATUSES, WORKFLOW_STEPS, stageColour, progressOf, isClosed } from "../../utils/crmWorkflow";

/* ───────────────────────────────────────────────────────────────
 * OverviewTab — 5 primary + 5 secondary KPI cards (period-filtered)
 * + analytics charts + today's submission grid + recent pending.
 * ──────────────────────────────────────────────────────────────*/
export function OverviewTab({ empStats, ovFiltered, employees = [], ovPeriod, setOvPeriod, ovDateFrom, setOvDateFrom, ovDateTo, setOvDateTo, ovPieData, ovBarData, openDM, pipelineClients = [], pipelineStatuses = [], pipelineFollowups = [], pipelineSales = [], pipelinePayments = [], pipelineContracts = [], pipelineNotes = [], pipelineHistory = [], softDeletePipelineClient = () => {}, restorePipelineClient = () => {}, hardDeletePipelineClient = () => {} }) {
  const [clpOpen, setClpOpen] = useState(false);
  const [clpPanel, setClpPanel] = useState(null); // inline expandable KPI panel (quick key)
  const [clpSearch, setClpSearch] = useState("");
  const [clpFilter, setClpFilter] = useState({ employee: "", status: "", domain: "" });
  const [clpDetail, setClpDetail] = useState(null);
  const [clpDelete, setClpDelete] = useState(null);
  const [clpShowDeleted, setClpShowDeleted] = useState(false);
  const [clpHardDel, setClpHardDel] = useState(null); // client pending permanent delete
  const [opDetail, setOpDetail] = useState(null); // Operations Overview block drill-down: 'web'|'social'|'attendance'|'updates'
  const [trendCur, setTrendCur] = useState("");
  // Emails/reminders/leads/calls are Sales activities — only count Sales-department
  // submissions so Operations/Design/Manager don't dilute these metrics.
  const salesSubs = ovFiltered.filter((s) => (s.department || "") === "Sales");
  const freshEmails = sum(salesSubs, "freshEmails");
  const reminderEmails = sum(salesSubs, "reminderEmails");
  const leads = sum(salesSubs, "newLeadsInterested");
  const followups = sum(salesSubs, "newFollowUps");
  const dsrSubmitted = ovFiltered.filter((s) => s.status === "Submitted").length;
  const calls = sum(salesSubs, "callsScheduled");
  const updates = ovFiltered.filter((s) => s.updatesForTeamLead).length;
  // Operations submissions in the period (used by the Operations Overview + its drill-down modal)
  const opSubsAll = (ovFiltered || []).filter((s) => (s.department || "") === "Operations");
  const sales = sum(ovFiltered, "salesGenerated");
  const orders = ovFiltered.reduce((a, s) => a + ((s.contractOrders || []).length), 0);
  const payments = sum(ovFiltered, "paymentReceived");

  // C1: currency-correct money — read the real pipeline rows and group by
  // currency for the selected period (never sum different currencies together).
  const CUR_SYM = { USD: "$", INR: "₹", AED: "AED ", EUR: "€", GBP: "£", AUD: "A$", SGD: "S$" };
  const _dts = ovFiltered.map((s) => s.date).filter(Boolean).sort();
  const _from = ovDateFrom || _dts[0];
  const _to = ovDateTo || _dts[_dts.length - 1];
  const _inRange = (d) => !!d && (!_from || d >= _from) && (!_to || d <= _to);
  // F1: only count money for live (non-deleted) clients — deleted clients must
  // not leave orphaned sales/payments inflating the analytics.
  const _liveIds = new Set((pipelineClients || []).filter((c) => !c.isDeleted).map((c) => c.id));
  const groupByCur = (rows, dateKey) => {
    const m = {};
    (rows || []).forEach((x) => { if (_liveIds.has(x.clientId) && _inRange(String(x[dateKey]))) { const c = x.currency || "USD"; m[c] = (m[c] || 0) + (Number(x.amount) || 0); } });
    return m;
  };
  const fmtMoneyByCur = (m) => {
    const ents = Object.entries(m).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]);
    if (!ents.length) return `${CUR_SYM.USD}0`;
    const [c, v] = ents[0];
    const head = `${CUR_SYM[c] || c + " "}${Number(v).toLocaleString()}`;
    return ents.length > 1 ? `${head} +${ents.length - 1}` : head; // never mixes; extra currencies flagged
  };
  const salesByCur = groupByCur(pipelineSales, "salesDate");
  const payByCur = groupByCur(pipelinePayments, "paymentDate");
  // Outstanding = Sales − Payments, computed strictly within each currency (never mixed).
  const outstandingByCur = (() => {
    const m = {};
    new Set([...Object.keys(salesByCur), ...Object.keys(payByCur)]).forEach((c) => {
      const o = (salesByCur[c] || 0) - (payByCur[c] || 0);
      if (o > 0) m[c] = o;
    });
    return m;
  })();

  // Team Messages — employee updates written to the team lead in their DSR
  // (existing data; no backend change). Newest first.
  const todayISO = new Date().toISOString().slice(0, 10);
  const empMap = Object.fromEntries((employees || []).map((e) => [e.id, e]));
  const teamMessages = (ovFiltered || [])
    .filter((s) => s.updatesForTeamLead && String(s.updatesForTeamLead).trim())
    .sort((a, b) => (a.date < b.date ? 1 : -1))
    .slice(0, 8)
    .map((s) => {
      const e = empMap[s.empId] || {};
      return {
        id: s.id || `${s.empId}-${s.date}`,
        name: s.empName || e.name || "Employee",
        teamLead: e.team_lead || e.teamLead || "",
        photo: e.photo || "",
        text: String(s.updatesForTeamLead).trim(),
        date: s.date,
        unread: s.date === todayISO,
      };
    });
  const initials = (n) => (n || "?").split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();
  const statusMeta = { submitted: { cls: "submitted", label: "Submitted" }, draft: { cls: "draft", label: "Draft" }, none: { cls: "none", label: "Not Submitted" } };

  return (
    <div className="sv-tab">
      <div className="sv-ov-banner">
        <div>
          <h2 className="sv-ov-banner-title">Welcome back, Admin 👋</h2>
          <p className="sv-ov-banner-sub">Here's what's happening today.</p>
        </div>
      </div>

      <div className="sv-flex sv-gap-sm" style={{ flexWrap: "wrap" }}>
        {["today", "week", "month", "custom"].map((p) => (
          <button key={p} className={`sv-period-btn ${ovPeriod === p ? "sv-period-btn--active" : ""}`} onClick={() => setOvPeriod(p)}>
            {p === "today" ? "Today" : p === "week" ? "This Week" : p === "month" ? "This Month" : "Custom"}
          </button>
        ))}
        {ovPeriod === "custom" && (
          <div className="sv-flex sv-gap-sm">
            <input className="sv-input" type="date" value={ovDateFrom} onChange={(e) => setOvDateFrom(e.target.value)} style={{ width: 150 }} />
            <input className="sv-input" type="date" value={ovDateTo} onChange={(e) => setOvDateTo(e.target.value)} style={{ width: 150 }} />
          </div>
        )}
      </div>

      <div className="sv-kpi-grid">
        <ClickCard idx={0} label="Fresh Emails" value={freshEmails} icon={<Mail size={20} />} c1="#EAF4FF" c2="#CFE6FF" accent="#2563EB" onClick={() => openDM("emails")} />
        <ClickCard idx={1} label="Reminder Emails" value={reminderEmails} icon={<Bell size={20} />} c1="#F3E8FF" c2="#E3D0FF" accent="#7C3AED" onClick={() => openDM("reminders")} />
        <ClickCard idx={2} label="New Leads" value={leads} icon={<UserPlus size={20} />} c1="#ECFDF3" c2="#C8F5DA" accent="#16A34A" onClick={() => openDM("leads")} />
        <ClickCard idx={3} label="Follow-ups" value={followups} icon={<CalendarCheck size={20} />} c1="#FFF6E5" c2="#FFE1A8" accent="#D97706" onClick={() => openDM("followups")} />
        <ClickCard idx={4} label="DSR Submitted" value={dsrSubmitted} icon={<CheckCircle2 size={20} />} c1="#EEF2FF" c2="#DCE7FF" accent="#4F46E5" onClick={() => openDM("dsr")} />
      </div>

      <div className="sv-kpi-grid">
        <ClickCard idx={5} label="Scheduled Calls" value={calls} icon={<Phone size={20} />} c1="#FFF1EC" c2="#FFD4C5" accent="#EA580C" onClick={() => openDM("calls")} />
        <ClickCard idx={6} label="Team Lead Updates" value={updates} icon={<Megaphone size={20} />} c1="#ECFEFF" c2="#C9F7FF" accent="#0891B2" onClick={() => openDM("updates")} />
        <ClickCard idx={7} label="Sales" value={fmtMoneyByCur(salesByCur)} icon={<TrendingUp size={20} />} c1="#ECFDF5" c2="#C9F7D8" accent="#059669" onClick={() => openDM("sales")} />
        <ClickCard idx={8} label="Contract Order Sent" value={orders} icon={<FileSignature size={20} />} c1="#F5F0FF" c2="#DDCCFF" accent="#6D28D9" onClick={() => openDM("orders")} />
        <ClickCard idx={9} label="Payment Received" value={fmtMoneyByCur(payByCur)} icon={<Wallet size={20} />} c1="#FFF8E6" c2="#FFE49C" accent="#CA8A04" onClick={() => openDM("payments")} />
        <ClickCard idx={10} label="Outstanding" value={fmtMoneyByCur(outstandingByCur)} icon={<AlertTriangle size={20} />} c1="#FEF2F2" c2="#FEE2E2" accent="#DC2626" onClick={() => openDM("sales")} />
      </div>

      {(() => {
        const ALL_ST = [...NURTURE_STATUSES, ...WORKFLOW_STEPS];
        const statusList = ALL_ST.map((name) => ({ name, colour: stageColour(name) }));
        const colourOf = (name) => stageColour(name);
        const needsFU = (c) => { const p = progressOf(c.status); return p >= 0 && p < 3; };
        const live = (pipelineClients || []).filter((c) => !c.isDeleted);
        const t = todayISO;
        const isOver = (c) => needsFU(c) && c.nextFollowUp && c.nextFollowUp < t;
        const isDue = (c) => needsFU(c) && c.nextFollowUp === t;
        const active = live.filter((c) => progressOf(c.status) >= 0 && !isClosed(c.status)).length;
        const overdue = live.filter(isOver).length;
        const dueToday = live.filter(isDue).length;
        const byStatus = {}; live.forEach((c) => { byStatus[c.status] = (byStatus[c.status] || 0) + 1; });
        const segments = statusList.filter((s) => byStatus[s.name]);
        const rank = (c) => (isDue(c) ? 0 : isOver(c) ? 1 : 2);
        const recent = [...live].sort((a, b) => (rank(a) - rank(b)) || String(b.updatedAt || "").localeCompare(String(a.updatedAt || ""))).slice(0, 12);
        const empMapAll = Object.fromEntries((employees || []).map((e) => [e.id, e]));
        const empName = (id) => (empMapAll[id] || {}).name || "—";
        const codeOf = (id) => "SV-" + String(id || "").replace(/[^a-zA-Z0-9]/g, "").slice(0, 6).toUpperCase();
        const hasRec = (cid, arr) => (arr || []).some((x) => x.clientId === cid);
        const lastActivityOf = (cid) => {
          let best = "";
          [pipelineHistory, pipelineFollowups, pipelineSales, pipelinePayments, pipelineContracts, pipelineNotes]
            .forEach((arr) => (arr || []).forEach((x) => { if (x.clientId === cid && String(x.createdAt) > best) best = String(x.createdAt); }));
          return best || null;
        };
        const domainOpts = [...new Set(live.map((c) => c.domainName).filter(Boolean))];
        const q = clpSearch.trim().toLowerCase();
        const matchesQuick = (c) => !clpFilter.quick
          || (clpFilter.quick === "active" ? !["Not Interested", "Lost", "Payment Received"].includes(c.status)
            : clpFilter.quick === "today" ? isDue(c)
              : clpFilter.quick === "overdue" ? isOver(c)
                : clpFilter.quick === "interested" ? c.status === "Interested"
                  : clpFilter.quick === "contracts" ? hasRec(c.id, pipelineContracts)
                    : clpFilter.quick === "sales" ? hasRec(c.id, pipelineSales)
                      : clpFilter.quick === "payments" ? hasRec(c.id, pipelinePayments) : true);
        const filtered = live.filter((c) =>
          (!q || `${c.clientName} ${c.companyName} ${c.clientEmail} ${c.domainName} ${codeOf(c.id)} ${empName(c.employeeId)}`.toLowerCase().includes(q)) &&
          (!clpFilter.employee || c.employeeId === clpFilter.employee) &&
          (!clpFilter.status || c.status === clpFilter.status) &&
          (!clpFilter.domain || c.domainName === clpFilter.domain) && matchesQuick(c)
        ).sort((a, b) => (rank(a) - rank(b)) || String(b.updatedAt || "").localeCompare(String(a.updatedAt || "")));
        const openClp = (quick) => { setClpSearch(""); setClpFilter({ employee: "", status: "", domain: "", quick: quick || "" }); setClpOpen(true); };
        const togglePanel = (k) => { setClpSearch(""); setClpFilter({ employee: "", status: "", domain: "", quick: k }); setClpPanel((p) => (p === k ? null : k)); };
        const dc = clpDetail ? live.find((c) => c.id === clpDetail) : null;
        const Controls = () => (
          <div className="sv-flex sv-gap-2" style={{ flexWrap: "wrap" }}>
            <div className="sv-mailids-search"><SearchIcon size={14} /><input placeholder="Search client / company / email / ID…" value={clpSearch} onChange={(e) => setClpSearch(e.target.value)} /></div>
            <select className="sv-select" value={clpFilter.employee} onChange={(e) => setClpFilter({ ...clpFilter, employee: e.target.value })} style={{ maxWidth: 160 }}><option value="">All employees</option>{[...new Set(live.map((c) => c.employeeId))].map((id) => <option key={id} value={id}>{empName(id)}</option>)}</select>
            <select className="sv-select" value={clpFilter.status} onChange={(e) => setClpFilter({ ...clpFilter, status: e.target.value })} style={{ maxWidth: 160 }}><option value="">All statuses</option>{statusList.map((sx) => <option key={sx.name}>{sx.name}</option>)}</select>
            <select className="sv-select" value={clpFilter.domain} onChange={(e) => setClpFilter({ ...clpFilter, domain: e.target.value })} style={{ maxWidth: 150 }}><option value="">All domains</option>{domainOpts.map((d) => <option key={d}>{d}</option>)}</select>
          </div>
        );
        const RowsTable = () => (
          filtered.length === 0 ? (
            <div className="sv-clp-empty">
              <span className="sv-clp-empty-ic"><Inbox size={26} /></span>
              <p className="sv-clp-empty-t">No leads here</p>
              <p className="sv-clp-empty-s">Nothing matches this view yet — try clearing the filters or pick another KPI card above.</p>
            </div>
          ) : (
            <div className="sv-mailids-scroll">
              <table className="sv-mailids-table" style={{ minWidth: 1240 }}>
                <thead><tr>{["Client", "Project", "Employee", "Assigned Email", "Region", "Status", "Next Follow-up", "Last Activity", "Contract", "Sale", "Payment", "Outstanding"].map((h) => <th key={h}>{h}</th>)}</tr></thead>
                <tbody>
                  {filtered.slice(0, 300).map((c) => {
                    const over = isOver(c); const due = isDue(c); const col = colourOf(c.status); const la = lastActivityOf(c.id);
                    const pill = (on, label, onCol, tip) => <span className="sv-clp-pill" title={tip} style={{ background: on ? onCol + "1A" : "#F1F5F9", color: on ? onCol : "#94A3B8" }}>{on ? label : "—"}</span>;
                    const _exp = Number(c.expectedAmount) || 0; const _cur = c.expectedCurrency || "USD";
                    const _paid = (pipelinePayments || []).filter((p) => p.clientId === c.id && (p.currency || "USD") === _cur).reduce((a, b) => a + (Number(b.amount) || 0), 0);
                    const _out = _exp > 0 ? Math.max(0, _exp - _paid) : 0;
                    return (
                      <tr key={c.id} onClick={() => setClpDetail(c.id)} style={{ cursor: "pointer" }}>
                        <td className="sv-text-navy sv-font-700" style={{ fontSize: 13 }}>{c.clientName}</td>
                        <td className="sv-text-muted" style={{ fontSize: 12.5 }}>{c.projectName || "—"}</td>
                        <td className="sv-text-muted" style={{ fontSize: 12.5 }}>{empName(c.employeeId)}</td>
                        <td className="sv-text-muted" style={{ fontSize: 12 }}>{c.assignedEmailId || "—"}</td>
                        <td className="sv-text-muted" style={{ fontSize: 12 }}>{c.region || "—"}</td>
                        <td><span className="sv-clp-badge" style={{ background: col + "1A", color: col }}>{c.status}</span></td>
                        <td className={over ? "sv-clp-over" : due ? "sv-clp-due" : "sv-text-muted"} style={{ fontSize: 12.5, whiteSpace: "nowrap" }}>{over ? "Overdue · " : due ? "Today · " : ""}{c.nextFollowUp ? fmtDate(c.nextFollowUp) : "—"}</td>
                        <td className="sv-text-muted" style={{ fontSize: 12, whiteSpace: "nowrap" }}>{la ? fmtDate(String(la).slice(0, 10)) : "—"}</td>
                        <td>{pill(hasRec(c.id, pipelineContracts), "Sent", "#7C3AED", "Contract sent")}</td>
                        <td>{pill(hasRec(c.id, pipelineSales), "Done", "#0D9488", "Sale generated")}</td>
                        <td>{pill(hasRec(c.id, pipelinePayments), "Paid", "#15803D", "Payment received")}</td>
                        <td style={{ fontSize: 12.5, whiteSpace: "nowrap", fontWeight: 700, color: _out > 0 ? "#B91C1C" : "#15803D" }}>{_exp > 0 ? (_out > 0 ? `${CUR_SYM[_cur] || _cur + " "}${_out.toLocaleString()}` : "Paid") : "—"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {filtered.length > 300 && <p className="sv-text-muted" style={{ fontSize: 12, padding: "8px 4px", textAlign: "center" }}>Showing first 300 of {filtered.length.toLocaleString()} — refine your search or filters to narrow the list.</p>}
            </div>
          )
        );
        const KPIS = [
          ["", "Total Leads", live.length, "#475569", "#64748B", Layers],
          ["active", "Active", active, "#2563EB", "#3B82F6", Users],
          ["today", "Today's Follow-ups", dueToday, "#16A34A", "#22C55E", CalendarDays],
          ["overdue", "Overdue", overdue, "#DC2626", "#F05252", AlertTriangle],
          ["interested", "Interested", byStatus["Interested"] || 0, "#EA580C", "#F97316", Target],
          ["contracts", "Contracts", (pipelineContracts || []).filter((x) => live.some((c) => c.id === x.clientId)).length, "#7C3AED", "#8B5CF6", FileText],
          ["sales", "Sales", (pipelineSales || []).filter((x) => live.some((c) => c.id === x.clientId)).length, "#0D9488", "#14B8A6", TrendingUp],
          ["payments", "Payments", (pipelinePayments || []).filter((x) => live.some((c) => c.id === x.clientId)).length, "#059669", "#10B981", Banknote],
        ];
        const panelMeta = KPIS.find((x) => x[0] === clpPanel) || ["", "All Leads", 0, "#475569", "#64748B", Layers];
        const panelLabel = panelMeta[1];
        const PanelIcon = panelMeta[5];
        return (<>
          <div className="sv-card">
            <div className="sv-flex sv-justify-between sv-items-center" style={{ flexWrap: "wrap", gap: 10 }}>
              <div><h3 style={{ margin: 0 }}>Client Pipeline</h3><p className="sv-text-muted" style={{ fontSize: 12.5, margin: "2px 0 0" }}>Live status of every client your team is working — updated in real time.</p></div>
              {live.length > 0 && <button className="sv-btn sv-btn--sm sv-btn--primary" onClick={() => openClp("")}>View all clients</button>}
            </div>
            {/* Full-colour KPI cards — click to expand an inline panel below */}
            <div className="sv-clp-kpigrid">
              {KPIS.map(([k, l, v, c1, c2, Ic]) => (
                <button key={l} className={`sv-clp-card${clpPanel === k ? " is-open" : ""}`} style={{ "--c1": c1, "--c2": c2 }} onClick={() => togglePanel(k)}>
                  <span className="sv-clp-card-ic"><Ic size={18} /></span>
                  <div className="sv-clp-card-v">{v}</div>
                  <div className="sv-clp-card-l">{l}</div>
                  <span className="sv-clp-card-caret" aria-hidden>{clpPanel === k ? "▲" : "▼"}</span>
                </button>
              ))}
            </div>
            {/* Inline expandable panel — appears in context under the cards */}
            <div className={`sv-clp-panel${clpPanel !== null ? " is-open" : ""}`}>
              {clpPanel !== null && (
                <div className="sv-clp-panel-inner" style={{ "--pc": panelMeta[3], "--pc2": panelMeta[4] }}>
                  <div className="sv-clp-phead">
                    <span className="sv-clp-phead-ic"><PanelIcon size={18} /></span>
                    <div className="sv-clp-phead-txt">
                      <div className="sv-clp-phead-title">{panelLabel}</div>
                      <div className="sv-clp-phead-sub">{filtered.length} {filtered.length === 1 ? "lead" : "leads"}</div>
                    </div>
                    <button className="sv-clp-phead-x" onClick={() => setClpPanel(null)} aria-label="Close"><X size={16} /></button>
                  </div>
                  <div className="sv-clp-fbar"><Controls /></div>
                  <RowsTable />
                </div>
              )}
            </div>

            {live.length === 0 ? (
              <p className="sv-text-muted" style={{ fontSize: 13, marginTop: 12 }}>No clients in the pipeline yet — they appear here as employees add them from their Pipeline module.</p>
            ) : (
              <>
                <div className="sv-section-label" style={{ marginTop: 16 }}>Recent clients {overdue > 0 && <span className="sv-clp-flag">{overdue} need follow-up</span>}</div>
                <div className="sv-mailids-scroll">
                  <table className="sv-mailids-table" style={{ minWidth: 760 }}>
                    <thead><tr>{["Client", "Project", "Domain", "Employee", "Status", "Next Follow-up"].map((h) => <th key={h}>{h}</th>)}</tr></thead>
                    <tbody>
                      {recent.map((c) => {
                        const over = isOver(c);
                        const due = isDue(c);
                        const col = colourOf(c.status);
                        return (
                          <tr key={c.id} onClick={() => setClpDetail(c.id)} style={{ cursor: "pointer" }}>
                            <td className="sv-text-navy sv-font-700" style={{ fontSize: 13 }}>{c.clientName}</td>
                            <td className="sv-text-muted" style={{ fontSize: 12.5 }}>{c.projectName || "—"}</td>
                            <td className="sv-text-muted" style={{ fontSize: 12 }}>{c.domainName || "—"}</td>
                            <td className="sv-text-muted" style={{ fontSize: 12.5 }}>{(employees.find((e) => e.id === c.employeeId) || {}).name || "—"}</td>
                            <td><span className="sv-clp-badge" style={{ background: col + "1A", color: col }}>{c.status}</span></td>
                            <td className={over ? "sv-clp-over" : due ? "sv-clp-due" : "sv-text-muted"} style={{ fontSize: 12.5, whiteSpace: "nowrap" }}>{over ? "Overdue · " : due ? "Today · " : ""}{c.nextFollowUp ? fmtDate(c.nextFollowUp) : "—"}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </>
            )}
            {(pipelineClients || []).filter((c) => c.isDeleted).length > 0 && (
              <div style={{ marginTop: 14, borderTop: "1px solid #F1F5F9", paddingTop: 10 }}>
                <button className="sv-btn sv-btn--sm sv-btn--ghost" onClick={() => setClpShowDeleted((v) => !v)}>
                  <Trash2 size={13} /> Recently deleted ({(pipelineClients || []).filter((c) => c.isDeleted).length})
                </button>
                {clpShowDeleted && (
                  <div className="sv-rev-list" style={{ marginTop: 8 }}>
                    {(pipelineClients || []).filter((c) => c.isDeleted).map((c) => (
                      <div key={c.id} className="sv-rev-row">
                        <span className="sv-text-navy sv-font-700" style={{ fontSize: 12.5 }}>{c.clientName}</span>
                        <span className="sv-text-muted" style={{ fontSize: 11.5 }}>{c.projectName || c.domainName || ""}</span>
                        <button className="sv-btn sv-btn--sm sv-btn--outline" style={{ marginLeft: "auto" }} onClick={async () => { await restorePipelineClient(c.id, c.employeeId); }}>Restore</button>
                        <button className="sv-btn sv-btn--sm" style={{ background: "#FEE2E2", color: "#B91C1C", border: "1px solid #FCA5A5" }} onClick={() => setClpHardDel(c)}><Trash2 size={12} /> Delete forever</button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
            {clpHardDel && (
              <div className="sv-modal-overlay" onClick={() => setClpHardDel(null)}>
                <div className="sv-modal" style={{ maxWidth: 400 }} onClick={(e) => e.stopPropagation()}>
                  <div className="sv-modal-header"><span className="sv-text-navy sv-font-800" style={{ fontSize: 16 }}>Delete permanently?</span><button className="sv-modal-close" onClick={() => setClpHardDel(null)}>×</button></div>
                  <div style={{ padding: "16px 20px" }}>
                    <p className="sv-text-muted" style={{ fontSize: 13, marginTop: 0 }}><b className="sv-text-navy">{clpHardDel.clientName}</b>{clpHardDel.projectName ? ` — ${clpHardDel.projectName}` : ""} and all its follow-ups, contracts, sales and payments will be erased. This cannot be undone.</p>
                    <div className="sv-flex sv-gap-2" style={{ marginTop: 12 }}>
                      <button className="sv-btn sv-btn--ghost" style={{ flex: 1 }} onClick={() => setClpHardDel(null)}>Cancel</button>
                      <button className="sv-btn" style={{ flex: 1, background: "#DC2626", color: "#fff" }} onClick={async () => { await hardDeletePipelineClient(clpHardDel.id); setClpHardDel(null); }}>Delete forever</button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {clpOpen && (
            <div className="sv-modal-overlay" onClick={() => setClpOpen(false)}>
              <div className="sv-modal" style={{ maxWidth: 920, maxHeight: "90vh", display: "flex", flexDirection: "column" }} onClick={(e) => e.stopPropagation()}>
                <div className="sv-modal-header" style={{ flexShrink: 0 }}>
                  <span className="sv-text-navy sv-font-800" style={{ fontSize: 16 }}>All Clients <span className="sv-text-muted" style={{ fontSize: 13, fontWeight: 600 }}>({filtered.length})</span></span>
                  <button className="sv-modal-close" onClick={() => setClpOpen(false)}>×</button>
                </div>
                <div style={{ padding: "12px 20px", flexShrink: 0, borderBottom: "1px solid #F1F5F9" }}>
                  <div className="sv-flex sv-gap-2" style={{ flexWrap: "wrap" }}>
                    <div className="sv-mailids-search"><SearchIcon size={14} /><input placeholder="Search client / company / email / domain…" value={clpSearch} onChange={(e) => setClpSearch(e.target.value)} /></div>
                    <select className="sv-select" value={clpFilter.employee} onChange={(e) => setClpFilter({ ...clpFilter, employee: e.target.value })} style={{ maxWidth: 170 }}><option value="">All employees</option>{[...new Set(live.map((c) => c.employeeId))].map((id) => <option key={id} value={id}>{empName(id)}</option>)}</select>
                    <select className="sv-select" value={clpFilter.status} onChange={(e) => setClpFilter({ ...clpFilter, status: e.target.value })} style={{ maxWidth: 170 }}><option value="">All statuses</option>{statusList.map((sx) => <option key={sx.name}>{sx.name}</option>)}</select>
                    <select className="sv-select" value={clpFilter.domain} onChange={(e) => setClpFilter({ ...clpFilter, domain: e.target.value })} style={{ maxWidth: 160 }}><option value="">All domains</option>{domainOpts.map((d) => <option key={d}>{d}</option>)}</select>
                    {(clpSearch || clpFilter.employee || clpFilter.status || clpFilter.domain) && <button className="sv-btn sv-btn--sm sv-btn--ghost" onClick={() => { setClpSearch(""); setClpFilter({ employee: "", status: "", domain: "" }); }}>Clear</button>}
                  </div>
                </div>
                <div style={{ overflowY: "auto", padding: "10px 20px 18px" }}>
                  {filtered.length === 0 ? <p className="sv-text-muted" style={{ fontSize: 13 }}>No clients match your search / filters.</p> : (
                    <div className="sv-mailids-scroll">
                      <table className="sv-mailids-table" style={{ minWidth: 1180 }}>
                        <thead><tr>{["Client ID", "Client", "Company", "Employee", "Assigned Email", "Region", "Status", "Next Follow-up", "Last Activity", "Contract", "Sale", "Payment"].map((h) => <th key={h}>{h}</th>)}</tr></thead>
                        <tbody>
                          {filtered.map((c) => {
                            const over = isOver(c); const due = isDue(c); const col = colourOf(c.status);
                            const la = lastActivityOf(c.id);
                            const dot = (on, onCol) => <span className="sv-clp-dot" style={{ background: on ? onCol : "#E2E8F0", color: on ? "#fff" : "#94A3B8" }}>{on ? "✓" : "—"}</span>;
                            return (
                              <tr key={c.id} onClick={() => setClpDetail(c.id)} style={{ cursor: "pointer" }}>
                                <td><span className="sv-clp-code">{codeOf(c.id)}</span></td>
                                <td className="sv-text-navy sv-font-700" style={{ fontSize: 13 }}>{c.clientName}</td>
                                <td className="sv-text-muted" style={{ fontSize: 12.5 }}>{c.companyName || "—"}</td>
                                <td className="sv-text-muted" style={{ fontSize: 12.5 }}>{empName(c.employeeId)}</td>
                                <td className="sv-text-muted" style={{ fontSize: 12 }}>{c.assignedEmailId || "—"}</td>
                                <td className="sv-text-muted" style={{ fontSize: 12 }}>{c.region || "—"}</td>
                                <td><span className="sv-clp-badge" style={{ background: col + "1A", color: col }}>{c.status}</span></td>
                                <td className={over ? "sv-clp-over" : due ? "sv-clp-due" : "sv-text-muted"} style={{ fontSize: 12.5, whiteSpace: "nowrap" }}>{over ? "Overdue · " : due ? "Today · " : ""}{c.nextFollowUp ? fmtDate(c.nextFollowUp) : "—"}</td>
                                <td className="sv-text-muted" style={{ fontSize: 12, whiteSpace: "nowrap" }}>{la ? fmtDate(String(la).slice(0, 10)) : "—"}</td>
                                <td>{dot(hasRec(c.id, pipelineContracts), "#7C3AED")}</td>
                                <td>{dot(hasRec(c.id, pipelineSales), "#0D9488")}</td>
                                <td>{dot(hasRec(c.id, pipelinePayments), "#15803D")}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {dc && (() => {
            const dcol = colourOf(dc.status);
            const cell = (l, v) => <div className="sv-meta-cell"><div className="sv-meta-label">{l}</div><div className="sv-meta-value">{v || "—"}</div></div>;
            return (
              <div className="sv-modal-overlay" style={{ zIndex: 320 }} onClick={() => setClpDetail(null)}>
                <div className="sv-modal" style={{ maxWidth: 680, maxHeight: "92vh", display: "flex", flexDirection: "column" }} onClick={(e) => e.stopPropagation()}>
                  <div className="sv-modal-header" style={{ flexShrink: 0 }}>
                    <span className="sv-text-navy sv-font-800" style={{ fontSize: 16 }}>{dc.clientName} <span className="sv-clp-badge" style={{ background: dcol + "1A", color: dcol, marginLeft: 6 }}>{dc.status}</span></span>
                    <button className="sv-modal-close" onClick={() => setClpDetail(null)}>×</button>
                  </div>
                  <div style={{ overflowY: "auto", padding: "16px 20px" }}>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                      {cell("Project", dc.projectName)}
                      {cell("Client Email", dc.clientEmail)}
                      {cell("Domain", dc.domainName)}
                      {cell("Region", dc.region)}
                      {cell("Assigned Email", dc.assignedEmailId)}
                      {cell("Employee", empName(dc.employeeId))}
                      {cell("Last Follow-up", dc.lastFollowUp ? fmtDate(dc.lastFollowUp) : "—")}
                      {cell("Next Follow-up", dc.nextFollowUp ? fmtDate(dc.nextFollowUp) : "—")}
                    </div>
                    {dc.notes && <p className="sv-text-muted" style={{ fontSize: 12.5, marginTop: 10, whiteSpace: "pre-wrap" }}>{dc.notes}</p>}

                    <div className="sv-section-label" style={{ marginTop: 14 }}>Production Workflow</div>
                    <LeadWorkflow client={dc} actorId={dc.employeeId} onToast={() => {}} />

                    <div className="sv-section-label" style={{ marginTop: 16 }}>Reverse / Cancel</div>
                    <LeadReverseActions client={dc} actorId={dc.employeeId} onToast={() => {}} />

                    <div className="sv-section-label" style={{ marginTop: 16 }}>Activity Timeline</div>
                    <LeadTimeline clientId={dc.id} />

                    <div className="sv-flex sv-justify-between sv-items-center" style={{ marginTop: 18, borderTop: "1px solid #F1F5F9", paddingTop: 14 }}>
                      <span className="sv-text-muted" style={{ fontSize: 11.5 }}>Admin action</span>
                      {clpDelete === dc.id ? (
                        <div className="sv-flex sv-gap-2 sv-items-center">
                          <span className="sv-text-muted" style={{ fontSize: 12.5 }}>Delete this project?</span>
                          <button className="sv-btn sv-btn--sm sv-btn--ghost" onClick={() => setClpDelete(null)}>Cancel</button>
                          <button className="sv-btn sv-btn--sm" style={{ background: "#DC2626", color: "#fff" }} onClick={async () => { await softDeletePipelineClient(dc.id, dc.employeeId); setClpDelete(null); setClpDetail(null); }}>Delete</button>
                        </div>
                      ) : (
                        <button className="sv-btn sv-btn--sm sv-btn--outline" style={{ color: "#DC2626", borderColor: "#FCA5A5" }} onClick={() => setClpDelete(dc.id)}><Trash2 size={13} /> Delete Project</button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })()}
        </>);
      })()}

      <div className="sv-card">
        {(() => {
          // Period-aware DSR counts (respect Today / Week / Month / Custom via ovFiltered)
          const dsrSub = ovFiltered.filter((s) => s.status === "Submitted").length;
          const dsrPend = ovFiltered.filter((s) => s.status !== "Submitted").length;
          // Two distinct pools: email activity vs DSR compliance. Percentages are
          // shown relative to each row's own pool (otherwise the huge email counts
          // swamp DSR and it always reads 0%).
          const emailPool = (Number(freshEmails) || 0) + (Number(reminderEmails) || 0) || 1;
          const dsrPool = (Number(dsrSub) || 0) + (Number(dsrPend) || 0) || 1;
          const taskData = [
            { name: "Fresh Emails", value: freshEmails, color: "#2563EB", pool: emailPool },
            { name: "Reminder Emails", value: reminderEmails, color: "#7C3AED", pool: emailPool },
            { name: "DSR Submitted", value: dsrSub, color: "#16A34A", pool: dsrPool },
            { name: "DSR Pending", value: dsrPend, color: "#F59E0B", pool: dsrPool },
          ];
          const taskTotal = taskData.reduce((s, d) => s + (Number(d.value) || 0), 0) || 1;
          const pct = (d) => Math.round(((Number(d.value) || 0) / d.pool) * 100);
          // Currency-aware Sales & Payments trend — built from real pipeline records,
          // grouped by the selected currency so different currencies are never mixed.
          const CUR_SYM = { USD: "$", INR: "₹", AED: "AED ", EUR: "€", GBP: "£", AUD: "A$", SGD: "S$" };
          const liveIdsForCur = new Set((pipelineClients || []).filter((c) => !c.isDeleted).map((c) => c.id));
          // total sales+payments volume per currency (live clients only) — used to
          // order the currency list and pick a sensible default with real data.
          const curVol = {};
          for (const s of (pipelineSales || [])) if (s.currency && liveIdsForCur.has(s.clientId)) curVol[s.currency] = (curVol[s.currency] || 0) + (Number(s.amount) || 0);
          for (const p of (pipelinePayments || [])) if (p.currency && liveIdsForCur.has(p.clientId)) curVol[p.currency] = (curVol[p.currency] || 0) + (Number(p.amount) || 0);
          const curList = [...new Set([...(pipelineSales || []), ...(pipelinePayments || [])].filter((x) => liveIdsForCur.has(x.clientId)).map((x) => x.currency).filter(Boolean))]
            .sort((a, b) => (curVol[b] || 0) - (curVol[a] || 0));
          if (!curList.length) curList.push("USD");
          const activeCur = curList.includes(trendCur) ? trendCur : curList[0];
          const curSym = CUR_SYM[activeCur] || (activeCur + " ");
          const liveClientIds = new Set((pipelineClients || []).filter((c) => !c.isDeleted).map((c) => c.id));
          const trendData = (ovBarData || []).map((row) => ({
            date: row.date,
            sales: (pipelineSales || []).filter((s) => liveClientIds.has(s.clientId) && s.currency === activeCur && String(s.salesDate) === row.date).reduce((a, b) => a + (Number(b.amount) || 0), 0),
            payment: (pipelinePayments || []).filter((p) => liveClientIds.has(p.clientId) && p.currency === activeCur && String(p.paymentDate) === row.date).reduce((a, b) => a + (Number(b.amount) || 0), 0),
          }));
          return (
            <>
              <h3>Analytics</h3>
              <div className="sv-grid-2 sv-gap-md" style={{ marginTop: 16 }}>
                <div className="sv-anacard">
                  <div className="sv-anacard-head"><h4>Task Summary</h4><span className="sv-anacard-sub">Today's distribution</span></div>
                  <div className="sv-tasksum">
                    <div className="sv-tasksum-chart">
                      <ResponsiveContainer width="100%" height={196}>
                        <PieChart>
                          <Pie data={taskData} dataKey="value" nameKey="name" innerRadius={58} outerRadius={84} paddingAngle={2} stroke="none">
                            {taskData.map((d, i) => <Cell key={i} fill={d.color} />)}
                          </Pie>
                          <Tooltip {...TT} />
                        </PieChart>
                      </ResponsiveContainer>
                      <div className="sv-tasksum-center"><b>{taskTotal.toLocaleString()}</b><span>total</span></div>
                    </div>
                    <div className="sv-tasksum-list">
                      {taskData.map((d) => (
                        <div key={d.name} className="sv-tasksum-row">
                          <span className="sv-tasksum-dot" style={{ background: d.color }} />
                          <span className="sv-tasksum-label">{d.name}</span>
                          <span className="sv-tasksum-count">{Number(d.value).toLocaleString()}</span>
                          <span className="sv-tasksum-pct" style={{ color: d.color }}>{pct(d)}%</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="sv-anacard">
                  <div className="sv-anacard-head">
                    <h4>Sales &amp; Payments Trend</h4>
                    <div className="sv-flex sv-gap-sm" style={{ flexWrap: "wrap", alignItems: "center" }}>
                      <select className="sv-select sv-select--sm" value={activeCur} onChange={(e) => setTrendCur(e.target.value)} title="Currency">
                        {curList.map((c) => <option key={c} value={c}>{c}{curVol[c] ? ` · ${curSym}${Math.round(curVol[c]).toLocaleString()}` : ""}</option>)}
                      </select>
                      {["today", "week", "month"].map((p) => (
                        <button key={p} className={`sv-period-btn sv-period-btn--sm ${ovPeriod === p ? "sv-period-btn--active" : ""}`} onClick={() => setOvPeriod(p)}>{p === "today" ? "Today" : p === "week" ? "Week" : "Month"}</button>
                      ))}
                    </div>
                  </div>
                  <ResponsiveContainer width="100%" height={220}>
                    <AreaChart data={trendData} margin={{ top: 8, right: 8, left: -6, bottom: 0 }}>
                      <defs>
                        <linearGradient id="gSales" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#16A34A" stopOpacity={0.32} /><stop offset="100%" stopColor="#16A34A" stopOpacity={0} /></linearGradient>
                        <linearGradient id="gPay" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#2563EB" stopOpacity={0.30} /><stop offset="100%" stopColor="#2563EB" stopOpacity={0} /></linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="4 4" vertical={false} stroke="#EEF2F7" />
                      <XAxis dataKey="date" tick={TICK} axisLine={false} tickLine={false} />
                      <YAxis tick={TICK} axisLine={false} tickLine={false} width={54} tickFormatter={(v) => `${curSym}${Number(v).toLocaleString()}`} />
                      <Tooltip {...TT} formatter={(v, n) => [`${curSym}${Number(v).toLocaleString()}`, n]} />
                      <Legend {...LEG} />
                      <Area type="monotone" dataKey="sales" name={`Sales (${activeCur})`} stroke="#16A34A" strokeWidth={2.5} fill="url(#gSales)" dot={false} activeDot={{ r: 4 }} />
                      <Area type="monotone" dataKey="payment" name={`Payments (${activeCur})`} stroke="#2563EB" strokeWidth={2.5} fill="url(#gPay)" dot={false} activeDot={{ r: 4 }} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </>
          );
        })()}
      </div>

      <div className="sv-grid-2 sv-gap-md">
        <div className="sv-card">
          <h3>Today's Submission Status</h3>
          <div className="sv-status-grid">
            {empStats.map((e) => {
              const m = statusMeta[e.todayStatus] || statusMeta.none;
              const att = e.todayAttendance;
              const attStyle = att === "Absent" ? { bg: "#FEE2E2", fg: "#B91C1C", label: "On Leave" }
                : att === "Half Day" ? { bg: "#FEF3C7", fg: "#B45309", label: "Half Day" } : null;
              return (
                <div key={e.id} className={`sv-status-pill sv-status-pill--${m.cls}`}>
                  <span className="sv-status-pill-dot" />
                  <span className="sv-status-pill-name">{e.name}</span>
                  {attStyle && <span className="sv-status-att" style={{ background: attStyle.bg, color: attStyle.fg }}>{attStyle.label}</span>}
                  <span className="sv-status-pill-tag">{m.label}</span>
                </div>
              );
            })}
          </div>
        </div>
        <div className="sv-card">
          <h3>Team Messages</h3>
          <div className="sv-msg-list">
            {teamMessages.length === 0 && (
              <p className="sv-msg-empty">No team messages in this period. 💬</p>
            )}
            {teamMessages.map((msg) => (
              <div key={msg.id} className={`sv-msg-card${msg.unread ? " sv-msg-card--unread" : ""}`}>
                <div className="sv-msg-avatar">
                  {msg.photo ? <img src={msg.photo} alt="" /> : <span>{initials(msg.name)}</span>}
                </div>
                <div className="sv-msg-body">
                  <div className="sv-msg-head">
                    <span className="sv-msg-name">{msg.name}</span>
                    {msg.teamLead && <span className="sv-msg-lead">→ {msg.teamLead}</span>}
                    {msg.unread && <span className="sv-msg-unread-dot" title="Unread" />}
                    <span className="sv-msg-time">{fmtDate(msg.date)}</span>
                  </div>
                  <div className="sv-msg-preview">{msg.text}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Operations Overview — Web/Digital Live, Social, Attendance, Team Lead Updates ── */}
      {(() => {
        const opSubs = (ovFiltered || []).filter((s) => (s.department || "") === "Operations");
        let webLive = 0, digitalLive = 0, postsDone = 0;
        const plat = { Facebook: 0, Instagram: 0, LinkedIn: 0 };
        let present = 0, half = 0, absent = 0;
        opSubs.forEach((s) => {
          const op = s.customFields && s.customFields.__op;
          if (op) {
            (op.magazine || []).forEach((m) => { if (m.webLive === "Yes") webLive++; if (m.digitalLive === "Yes") digitalLive++; });
            (op.social || []).forEach((x) => {
              if (x.fb === "Yes") { postsDone++; plat.Facebook++; }
              if (x.ig === "Yes") { postsDone++; plat.Instagram++; }
              if (x.li === "Yes") { postsDone++; plat.LinkedIn++; }
            });
          }
          const a = s.attendance; if (a === "Present") present++; else if (a === "Half Day") half++; else if (a === "Absent") absent++;
        });
        const opUpd = opSubs.filter((s) => s.updatesForTeamLead && String(s.updatesForTeamLead).trim()).sort((a, b) => (a.date < b.date ? 1 : -1));
        const stat = (label, value, color) => (
          <div className="sv-op-ov-stat"><span className="sv-op-ov-statv" style={{ color }}>{value}</span><span className="sv-op-ov-statl">{label}</span></div>
        );
        return (
          <div style={{ marginTop: 20 }}>
            <h3 style={{ display: "flex", alignItems: "center", gap: 8 }}><span style={{ width: 4, height: 18, background: "#2563EB", borderRadius: 3, display: "inline-block" }} />Operations Overview</h3>
            <div className="sv-op-ov-grid">
              <div className="sv-op-ov-card sv-op-ov-card--click" style={{ "--oc": "#2563EB" }} onClick={() => setOpDetail("web")}>
                <div className="sv-op-ov-head"><Globe2 size={16} /> Web &amp; Digital Live <span className="sv-op-ov-more">View →</span></div>
                <div className="sv-op-ov-stats">{stat("Web Live", webLive, "#2563EB")}{stat("Digital Live", digitalLive, "#0891B2")}</div>
              </div>
              <div className="sv-op-ov-card sv-op-ov-card--click" style={{ "--oc": "#7C3AED" }} onClick={() => setOpDetail("social")}>
                <div className="sv-op-ov-head"><Megaphone size={16} /> Social Media Posts <span className="sv-op-ov-more">View →</span></div>
                <div className="sv-op-ov-stats">{stat("Posts Done", postsDone, "#7C3AED")}</div>
                <div className="sv-op-ov-sub">FB {plat.Facebook} · IG {plat.Instagram} · IN {plat.LinkedIn}</div>
              </div>
              <div className="sv-op-ov-card sv-op-ov-card--click" style={{ "--oc": "#16A34A" }} onClick={() => setOpDetail("attendance")}>
                <div className="sv-op-ov-head"><CheckCircle2 size={16} /> Attendance <span className="sv-op-ov-more">View →</span></div>
                <div className="sv-op-ov-stats">{stat("Present", present, "#16A34A")}{stat("Half Day", half, "#CA8A04")}{stat("Absent", absent, "#DC2626")}</div>
              </div>
              <div className="sv-op-ov-card sv-op-ov-card--click" style={{ "--oc": "#0891B2" }} onClick={() => setOpDetail("updates")}>
                <div className="sv-op-ov-head"><Megaphone size={16} /> Team Lead Updates <span className="sv-op-ov-more">View →</span></div>
                <div className="sv-op-ov-stats">{stat("Updates", opUpd.length, "#0891B2")}</div>
                <div className="sv-op-ov-updlist">
                  {opUpd.length === 0 ? <span className="sv-text-muted" style={{ fontSize: 12 }}>No updates in this period.</span>
                    : opUpd.slice(0, 3).map((s) => <div key={s.id || `${s.empId}-${s.date}`} className="sv-op-ov-upd"><b>{s.empName}:</b> {String(s.updatesForTeamLead).slice(0, 80)}</div>)}
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Operations Overview drill-down — rendered at tab root so the overlay
          centres correctly in the viewport (not buried in the section). */}
      {opDetail && (() => {
        const TITLES = { web: "Web & Digital Live — by domain", social: "Social Media Posts — by domain", attendance: "Attendance — by employee", updates: "Team Lead Updates" };
        const webMap = {}, socMap = {};
        opSubsAll.forEach((s) => {
          const op = (s.customFields && s.customFields.__op) || {};
          (op.magazine || []).forEach((m) => { if (!m.domain) return; const d = webMap[m.domain] || (webMap[m.domain] = { web: 0, digital: 0, clients: [] }); if (m.webLive === "Yes") { d.web++; if (m.webClient) d.clients.push("Web: " + m.webClient); } if (m.digitalLive === "Yes") { d.digital++; if (m.digitalClient) d.clients.push("Digital: " + m.digitalClient); } });
          (op.social || []).forEach((x) => { if (!x.domain) return; const d = socMap[x.domain] || (socMap[x.domain] = { fb: 0, ig: 0, li: 0 }); if (x.fb === "Yes") d.fb++; if (x.ig === "Yes") d.ig++; if (x.li === "Yes") d.li++; });
        });
        const webRows = Object.entries(webMap), socRows = Object.entries(socMap);
        const updRows = opSubsAll.filter((s) => s.updatesForTeamLead && String(s.updatesForTeamLead).trim()).sort((a, b) => (a.date < b.date ? 1 : -1));
        return (
          <div className="sv-modal-overlay" onClick={() => setOpDetail(null)}>
            <div className="sv-modal" style={{ maxWidth: 560, maxHeight: "85vh", display: "flex", flexDirection: "column" }} onClick={(e) => e.stopPropagation()}>
              <div className="sv-modal-header"><span className="sv-text-navy sv-font-800" style={{ fontSize: 15.5 }}>{TITLES[opDetail]}</span><button className="sv-modal-close" onClick={() => setOpDetail(null)}>×</button></div>
              <div style={{ padding: "14px 20px", overflowY: "auto" }}>
                {opDetail === "web" && (webRows.length === 0 ? <p className="sv-text-muted" style={{ fontSize: 13 }}>No Web/Digital Live reported in this period.</p> : webRows.map(([dom, d]) => (
                  <div key={dom} className="sv-op-dt-row"><div className="sv-op-dt-dom">{dom}</div><div className="sv-op-dt-val">Web Live: <b>{d.web}</b> · Digital Live: <b>{d.digital}</b>{d.clients.length ? <div className="sv-op-dt-sub">{d.clients.join(" · ")}</div> : null}</div></div>
                )))}
                {opDetail === "social" && (socRows.length === 0 ? <p className="sv-text-muted" style={{ fontSize: 13 }}>No social posts reported in this period.</p> : socRows.map(([dom, d]) => (
                  <div key={dom} className="sv-op-dt-row"><div className="sv-op-dt-dom">{dom}</div><div className="sv-op-dt-val">Facebook: <b>{d.fb}</b> · Instagram: <b>{d.ig}</b> · LinkedIn: <b>{d.li}</b></div></div>
                )))}
                {opDetail === "attendance" && (opSubsAll.length === 0 ? <p className="sv-text-muted" style={{ fontSize: 13 }}>No operation submissions in this period.</p> : opSubsAll.slice().sort((a, b) => (a.date < b.date ? 1 : -1)).map((s) => (
                  <div key={s.id || `${s.empId}-${s.date}`} className="sv-op-dt-row"><div className="sv-op-dt-dom">{s.empName}</div><div className="sv-op-dt-val">{s.attendance} · {fmtDate(s.date)} · {s.workingHours || 0}h</div></div>
                )))}
                {opDetail === "updates" && (updRows.length === 0 ? <p className="sv-text-muted" style={{ fontSize: 13 }}>No updates in this period.</p> : updRows.map((s) => (
                  <div key={s.id || `${s.empId}-${s.date}`} className="sv-op-dt-row"><div className="sv-op-dt-dom">{s.empName} <span className="sv-text-muted" style={{ fontWeight: 500, fontSize: 11 }}>{fmtDate(s.date)}</span></div><div className="sv-op-dt-val">{s.updatesForTeamLead}</div></div>
                )))}
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}

/* ───────────────────────────────────────────────────────────────
 * ReportsTab — filterable submissions table + CSV export + view.
 * ──────────────────────────────────────────────────────────────*/
export function ReportsTab({ reportEmpSearch, setReportEmpSearch, reportDept, setReportDept, departments = [], reportDateFrom, setReportDateFrom, reportDateTo, setReportDateTo, rows, onView, onExport, pipelineClients = [], pipelineSales = [], pipelinePayments = [] }) {
  // C1: currency-correct money per row — read the real pipeline rows for that
  // employee + date and group by currency (never sum different currencies).
  const CUR_SYM = { USD: "$", INR: "₹", AED: "AED ", EUR: "€", GBP: "£", AUD: "A$", SGD: "S$" };
  const cliEmp = Object.fromEntries((pipelineClients || []).filter((c) => !c.isDeleted).map((c) => [c.id, c.employeeId]));
  const moneyFor = (src, dateKey, empId, date) => {
    const m = {};
    (src || []).forEach((x) => { if (cliEmp[x.clientId] === empId && String(x[dateKey]) === date) { const c = x.currency || "USD"; m[c] = (m[c] || 0) + (Number(x.amount) || 0); } });
    return m;
  };
  const fmtMoneyByCur = (m, fallback) => {
    const ents = Object.entries(m).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]);
    if (!ents.length) return fallback; // no pipeline rows that day → show the legacy scalar
    const [c, v] = ents[0];
    const head = `${CUR_SYM[c] || c + " "}${Number(v).toLocaleString()}`;
    return ents.length > 1 ? `${head} +${ents.length - 1}` : head;
  };
  return (
    <div className="sv-tab">
      <div className="sv-flex sv-flex--between" style={{ flexWrap: "wrap", gap: 10 }}>
        <h2 className="sv-tab-title">Reports</h2>
        <button className="sv-btn sv-btn--outline" onClick={onExport}><Download size={15} /> Export CSV</button>
      </div>
      <div className="sv-card">
        <div className="sv-flex sv-justify-between sv-items-center" style={{ flexWrap: "wrap", gap: 10, marginBottom: 14 }}>
          <div className="sv-flex sv-gap-sm" style={{ flexWrap: "wrap" }}>
            <div className="sv-mailids-search"><SearchIcon size={14} /><input placeholder="Search employee…" value={reportEmpSearch} onChange={(e) => setReportEmpSearch(e.target.value)} /></div>
            <select className="sv-select" value={reportDept} onChange={(e) => setReportDept(e.target.value)} style={{ maxWidth: 180 }}>
              <option value="">All Departments</option>
              {departments.map((d) => <option key={d} value={d}>{d}</option>)}
            </select>
            <input className="sv-input" type="date" value={reportDateFrom} onChange={(e) => setReportDateFrom(e.target.value)} style={{ maxWidth: 160 }} />
            <input className="sv-input" type="date" value={reportDateTo} onChange={(e) => setReportDateTo(e.target.value)} style={{ maxWidth: 160 }} />
          </div>
          <span className="sv-text-muted" style={{ fontSize: 12.5, whiteSpace: "nowrap" }}>{rows.length} report{rows.length !== 1 ? "s" : ""}</span>
        </div>
        {rows.length === 0 ? (
          <div className="sv-leave-empty"><FileText size={26} /><span>No reports match your search / filters.</span></div>
        ) : (
          <div className="sv-mailids-scroll">
            <table className="sv-mailids-table" style={{ minWidth: 920 }}>
              <thead>
                <tr>
                  <th>Employee</th><th>Dept</th><th>Attendance</th><th>Date</th><th>Status</th>
                  <th>Emails</th><th>Leads</th><th>Calls</th><th>Sales</th><th>Payments</th><th>Hrs</th><th></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td className="sv-text-navy sv-font-700" style={{ fontSize: 13 }}>{r.empName}</td>
                    <td className="sv-text-muted">{r.department}</td><td className="sv-text-muted">{r.attendance}</td><td className="sv-text-muted" style={{ whiteSpace: "nowrap" }}>{fmtDate(r.date)}</td>
                    <td><span className={`sv-badge sv-badge--${(r.status || "pending").toLowerCase()}`}>{r.status}</span></td>
                    <td>{(Number(r.freshEmails) || 0) + (Number(r.reminderEmails) || 0)}</td>
                    <td>{r.newLeadsInterested}</td><td>{r.callsScheduled}</td>
                    <td className="sv-font-700" style={{ whiteSpace: "nowrap" }}>{fmtMoneyByCur(moneyFor(pipelineSales, "salesDate", r.empId, r.date), fmtCurr(r.salesGenerated))}</td>
                    <td className="sv-font-700" style={{ whiteSpace: "nowrap" }}>{fmtMoneyByCur(moneyFor(pipelinePayments, "paymentDate", r.empId, r.date), fmtCurr(r.paymentReceived))}</td>
                    <td>{r.workingHours}</td>
                    <td><button className="sv-btn sv-btn--sm sv-btn--outline" onClick={() => onView(r)}>View</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

/* ───────────────────────────────────────────────────────────────
 * LeaderboardTab — Sales & Payments ranking with Week/Month/Year.
 * ──────────────────────────────────────────────────────────────*/
export function LeaderboardTab({ empStats, submissions, lbPeriod, setLbPeriod }) {
  const days = { week: 7, month: 30, year: 365 }[lbPeriod] ?? 30;
  const fromDate = new Date(); fromDate.setDate(fromDate.getDate() - days);
  const fromStr = fromDate.toISOString().split("T")[0];

  const ranked = empStats.map((e) => {
    const mine = submissions.filter((s) => s.empId === e.id && s.date >= fromStr);
    return { id: e.id, name: e.name, sales: sum(mine, "salesGenerated"), payments: sum(mine, "paymentReceived") };
  }).sort((a, b) => b.sales - a.sales);
  const medals = ["🥇", "🥈", "🥉"];

  return (
    <div className="sv-tab">
      <div className="sv-flex sv-flex--between">
        <h2 className="sv-tab-title">Leaderboard</h2>
        <div className="sv-flex sv-gap-sm">
          {["week", "month", "year"].map((p) => (
            <button key={p} className={`sv-period-btn ${lbPeriod === p ? "sv-period-btn--active" : ""}`} onClick={() => setLbPeriod(p)}>
              {p[0].toUpperCase() + p.slice(1)}
            </button>
          ))}
        </div>
      </div>

      <table className="sv-table">
        <thead><tr><th>Rank</th><th>Employee</th><th>Sales</th><th>Payments</th></tr></thead>
        <tbody>
          {ranked.map((e, i) => (
            <tr key={e.id}>
              <td>{medals[i] || `#${i + 1}`}</td><td>{e.name}</td>
              <td>{fmtCurr(e.sales)}</td><td>{fmtCurr(e.payments)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h3 style={{ marginTop: 12 }}>7-Day Submission Tracker</h3>
      <div className="sv-grid-7 sv-gap-xs">
        {empStats.map((e) => {
          const daysArr = Array.from({ length: 7 }, (_, i) => {
            const d = new Date(); d.setDate(d.getDate() - i);
            const ds = d.toISOString().split("T")[0];
            return submissions.some((s) => s.empId === e.id && s.date === ds && s.status === "Submitted");
          });
          return (
            <div key={e.id} className="sv-flex sv-gap-xs sv-flex--center" style={{ justifyContent: "flex-start" }}>
              <span>{e.name}</span>
              {daysArr.reverse().map((ok, i) => <span key={i} className={`sv-dot ${ok ? "sv-dot--green" : "sv-dot--red"}`} />)}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ───────────────────────────────────────────────────────────────
 * AnalyticsTab — chart cards + full employee summary table.
 * ──────────────────────────────────────────────────────────────*/
export function AnalyticsTab({ empStats, statusPie, chartData, monthlySalary = [] }) {
  const [selMonth, setSelMonth] = useState(null);
  return (
    <div className="sv-tab">
      <h2 className="sv-tab-title">Analytics</h2>
      <div className="sv-grid-2 sv-gap-md">
        <div className="sv-card">
          <h4>Individual Sales Performance</h4>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={empStats} layout="vertical" barGap={4} barCategoryGap="24%" margin={{ left: 4, right: 12 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} />
              <XAxis type="number" tick={TICK} /><YAxis type="category" dataKey="name" tick={TICK} width={100} />
              <Tooltip {...TT} /><Legend {...LEG} />
              <Bar dataKey="totalSales" name="Sales" fill={GREEN} radius={[0, 5, 5, 0]} />
              <Bar dataKey="totalPayments" name="Payment Received" fill={ORANGE} radius={[0, 5, 5, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="sv-card">
          <h4>Monthly Salary Distribution</h4>
          {monthlySalary.length === 0 ? (
            <p className="sv-text-muted" style={{ fontSize: 13, padding: "40px 0", textAlign: "center" }}>No salary payments recorded yet. Mark salaries as Paid to see monthly totals.</p>
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={monthlySalary}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="label" tick={TICK} /><YAxis tick={TICK} />
                <Tooltip {...TT} formatter={(v, n) => [fmtSalary(v), n]} />
                <Legend {...LEG} />
                <Bar dataKey="empTotal" stackId="sal" name="Employees" fill={GREEN} cursor="pointer" radius={[0, 0, 0, 0]} onClick={(d) => setSelMonth(d && d.monthKey)} />
                <Bar dataKey="freeTotal" stackId="sal" name="Freelancers" fill={AMBER} cursor="pointer" radius={[6, 6, 0, 0]} onClick={(d) => setSelMonth(d && d.monthKey)} />
              </BarChart>
            </ResponsiveContainer>
          )}
          <p className="sv-text-muted" style={{ fontSize: 11, marginTop: 6 }}>Click a bar to see the employee-wise breakdown.</p>
        </div>
        <div className="sv-card">
          <h4>Work Status Breakdown</h4>
          <ResponsiveContainer width="100%" height={240}>
            <PieChart>
              <Pie data={statusPie} dataKey="value" nameKey="name" innerRadius={54} outerRadius={82} paddingAngle={2}>
                {statusPie.map((d, i) => <Cell key={i} fill={d.color} />)}
              </Pie>
              <Tooltip {...TT} /><Legend {...LEG} />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="sv-card">
          <h4>Multi-Metric Trend</h4>
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" tick={TICK} /><YAxis tick={TICK} />
              <Tooltip {...TT} /><Legend {...LEG} />
              <Line dataKey="emails" name="Emails" stroke={BLUE} /><Line dataKey="leads" name="Leads" stroke={GREEN} />
              <Line dataKey="calls" name="Calls" stroke={ORANGE} /><Line dataKey="fu" name="Follow-ups" stroke={NAVY} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
      {selMonth && (() => {
        const mo = monthlySalary.find((m) => m.monthKey === selMonth);
        if (!mo) return null;
        return (
          <div className="sv-card" style={{ marginTop: 16 }}>
            <div className="sv-flex sv-justify-between sv-items-center" style={{ marginBottom: 10 }}>
              <h4 style={{ margin: 0 }}>{mo.label} Salary Distribution</h4>
              <button onClick={() => setSelMonth(null)} style={{ border: "none", background: "transparent", color: "#64748B", cursor: "pointer", fontWeight: 700, fontSize: 13 }}><X size={14} /> Close</button>
            </div>
            <table className="sv-table">
              <thead><tr><th>Name</th><th>Type</th><th style={{ textAlign: "right" }}>Salary Paid</th></tr></thead>
              <tbody>
                {mo.breakdown.map((r, i) => (
                  <tr key={i}>
                    <td>{r.name}</td>
                    <td><span style={{ fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 999, color: r.kind === "Freelancer" ? "#B45309" : "#15803D", background: r.kind === "Freelancer" ? "#FEF3C7" : "#DCFCE7" }}>{r.kind}</span></td>
                    <td style={{ textAlign: "right", fontWeight: 700 }}>{fmtSalary(r.amount)}</td>
                  </tr>
                ))}
                <tr><td style={{ fontWeight: 800 }}>Total</td><td /><td style={{ textAlign: "right", fontWeight: 800, color: GREEN }}>{fmtSalary(mo.total)}</td></tr>
              </tbody>
            </table>
          </div>
        );
      })()}
      <table className="sv-table" style={{ marginTop: 24 }}>
        <thead><tr><th>Employee</th><th>Emails</th><th>Leads</th><th>Calls</th><th>Sales</th><th>Payments</th><th>Follow-ups</th></tr></thead>
        <tbody>
          {empStats.map((e) => (
            <tr key={e.id}><td>{e.name}</td><td>{e.totalEmails}</td><td>{e.totalLeads}</td><td>{e.totalCalls}</td><td>{fmtCurr(e.totalSales)}</td><td>{fmtCurr(e.totalPayments)}</td><td>{e.totalFollowUps}</td></tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ───────────────────────────────────────────────────────────────
 * DepartmentsTab — add/remove depts, broadcast announcements,
 * per-department breakdown cards.
 * ──────────────────────────────────────────────────────────────*/
export function DepartmentsTab({ departments, employees, submissions, newDept, setNewDept, addDept, removeDept, annText, setAnnText, annDepts, setAnnDepts, publishAnnouncement, announcements, customFields, setCustomFields, onPublishDeptAnnouncement, onDeleteAnnouncement, onAddField, onEditField, onRemoveField, todayStr, editMode = false }) {
  const toggleAnnDept = (d) => setAnnDepts((prev) => prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d]);
  const DEPT_COLORS = ["#3B82F6", "#22C55E", "#8B5CF6", "#F59E0B", "#EC4899", "#14B8A6"];
  const colorFor = (d) => { let h = 0; for (let i = 0; i < d.length; i++) h = (h * 31 + d.charCodeAt(i)) >>> 0; return DEPT_COLORS[h % DEPT_COLORS.length]; };

  // Case-insensitive union of configured departments + departments actually
  // used by employees — so e.g. "Design" (designers) always shows, and any
  // case-variant duplicates ("Sales"/"sales") collapse into one.
  const lc = (x) => (x || "").trim().toLowerCase();
  const map = new Map();
  departments.forEach((d) => { const k = lc(d); if (d && !map.has(k)) map.set(k, d.trim()); });
  employees.forEach((e) => { const d = (e.department || "").trim(); const k = lc(d); if (d && !map.has(k)) map.set(k, d); });
  const allDepts = [...map.values()];
  const configuredLc = new Set(departments.map(lc));
  const autoDetected = allDepts.filter((d) => !configuredLc.has(lc(d)));
  const countFor = (d) => employees.filter((e) => lc(e.department) === lc(d)).length;

  return (
    <div className="sv-tab">
      <h2 className="sv-tab-title">Departments</h2>

      <div className="sv-card">
        <div className="sv-flex sv-items-center sv-gap-2" style={{ marginBottom: 4 }}>
          <span className="sv-mod-icon"><Building2 size={16} /></span>
          <div>
            <p className="sv-text-navy sv-font-800" style={{ margin: 0, fontSize: 16 }}>Manage Departments</p>
            <p className="sv-text-muted" style={{ margin: 0, fontSize: 12 }}>Add or remove departments used across the workspace</p>
          </div>
        </div>
        <div className="sv-flex sv-gap-sm" style={{ marginTop: 12 }}>
          <input className="sv-input" placeholder="New department name" value={newDept} onChange={(e) => setNewDept(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") addDept(); }} />
          <button className="sv-btn sv-btn--primary" onClick={addDept}><Plus size={14} /> Add</button>
        </div>
        <div className="sv-dept-chips">
          {departments.map((d) => (
            <span key={d} className="sv-dept-chip" style={{ "--dc": colorFor(d) }}>
              <span className="sv-dept-chip-dot" />
              {d}
              <span className="sv-dept-chip-count">{countFor(d)}</span>
              <button className="sv-dept-chip-x" title={`Remove ${d}`} onClick={() => removeDept(d)}><X size={12} /></button>
            </span>
          ))}
        </div>
        {autoDetected.length > 0 && (
          <div className="sv-dept-auto">
            <span className="sv-dept-auto-label">On employees but not in your list:</span>
            {autoDetected.map((d) => (
              <button key={d} className="sv-dept-auto-chip" onClick={() => { setNewDept(d); }}>
                {d} <span className="sv-dept-auto-count">{countFor(d)}</span> <Plus size={11} />
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="sv-card">
        <div className="sv-flex sv-items-center sv-gap-2" style={{ marginBottom: 4 }}>
          <span className="sv-mod-icon"><Megaphone size={16} /></span>
          <div>
            <p className="sv-text-navy sv-font-800" style={{ margin: 0, fontSize: 16 }}>Broadcast Announcement</p>
            <p className="sv-text-muted" style={{ margin: 0, fontSize: 12 }}>Send a message to one or more departments</p>
          </div>
        </div>
        <textarea className="sv-textarea" placeholder="Announcement text..." value={annText} onChange={(e) => setAnnText(e.target.value)} style={{ marginTop: 12 }} />
        <div className="sv-flex sv-gap-sm" style={{ marginTop: 10, flexWrap: "wrap" }}>
          {["All", ...allDepts].map((d) => (
            <label key={d} className={`sv-dept-pick${annDepts.includes(d) ? " sv-dept-pick--on" : ""}`}>
              <input type="checkbox" checked={annDepts.includes(d)} onChange={() => toggleAnnDept(d)} /> {d}
            </label>
          ))}
        </div>
        <button className="sv-btn sv-btn--primary" style={{ marginTop: 14 }} onClick={publishAnnouncement}><Megaphone size={14} /> Publish</button>
      </div>

      <div className="sv-dept-grid">
        {allDepts.map((d, i) => {
          const deptEmps = employees.filter((e) => lc(e.department) === lc(d));
          const deptSubsToday = submissions.filter((s) => s.date === todayStr && s.status === "Submitted" && deptEmps.some((e) => e.id === s.empId));
          const deptSubmittedNames = deptSubsToday.map((s) => s.empName);
          const deptPendingNames = deptEmps.filter((e) => !deptSubsToday.some((s) => s.empId === e.id));
          const deptFiltered = submissions.filter((s) => deptEmps.some((e) => e.id === s.empId));
          return (
            <DeptCard
              key={d}
              dept={d}
              accent={colorFor(d)}
              deptEmps={deptEmps}
              deptSubmittedNames={deptSubmittedNames}
              deptPendingNames={deptPendingNames}
              deptFiltered={deptFiltered}
              customFields={customFields}
              onAddField={onAddField}
              onEditField={onEditField}
              onRemoveField={onRemoveField}
              announcements={announcements.filter((a) => a.departments?.includes(d))}
              onPublishAnnouncement={(text) => onPublishDeptAnnouncement(d, text)}
              onDeleteAnnouncement={onDeleteAnnouncement}
            />
          );
        })}
      </div>
    </div>
  );
}

/* ───────────────────────────────────────────────────────────────
 * LeaveBoardTab — approve/reject with mandatory remark + history.
 * ──────────────────────────────────────────────────────────────*/
export function LeaveBoardTab({ leaves, employees = [], setLeaveStatus, editMode = false, submissions = [], attendanceOverrides = [], saveAttendanceOverride }) {
  const [remarks, setRemarks] = useState({});
  const [pendingRemark, setPendingRemark] = useState({}); // id -> "Approved"|"Rejected" awaiting confirm
  const [errorId, setErrorId] = useState(null);
  const [confirm, setConfirm] = useState(null); // { leave, status, remark }
  const [histSearch, setHistSearch] = useState("");
  const [histFilter, setHistFilter] = useState("All");
  const [histPeriod, setHistPeriod] = useState("Month"); // Month | Year
  // Employee attendance overview + detail
  const [calDetail, setCalDetail] = useState(null); // empId whose detail modal is open
  const [calMonth, setCalMonth] = useState(() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1); });
  const [attEdit, setAttEdit] = useState(null); // { empId, date, status, remark, prevStatus }
  const [attSaving, setAttSaving] = useState(false);
  const overrideMap = Object.fromEntries((attendanceOverrides || []).map((o) => [`${o.empId}|${o.date}`, o]));
  // Self-marked attendance from the DSR (Absent / Half Day) — all departments
  const [attSearch, setAttSearch] = useState("");
  const [attType, setAttType] = useState("All"); // All | Absent | Half Day
  const [attPeriod, setAttPeriod] = useState("Month"); // Month | Year | All

  const empById = Object.fromEntries(employees.map((e) => [e.id, e]));
  const pending = leaves.filter((l) => l.status === "Pending");
  const decided = leaves.filter((l) => l.status !== "Pending");
  const approvedCount = decided.filter((l) => l.status === "Approved").length;
  const rejectedCount = decided.filter((l) => l.status === "Rejected").length;

  const days = (from, to) => {
    try { const a = new Date(from + "T00:00:00"); const b = new Date(to + "T00:00:00");
      return Math.max(1, Math.round((b - a) / 86400000) + 1); } catch { return 1; }
  };

  const ask = (l, status) => {
    const remark = (remarks[l.id] || "").trim();
    if (!remark) { setErrorId(l.id); return; }
    setErrorId(null);
    setConfirm({ leave: l, status, remark });
  };
  const applyDecision = () => {
    if (!confirm) return;
    setLeaveStatus(confirm.leave.id, confirm.status, confirm.remark);
    setRemarks((prev) => ({ ...prev, [confirm.leave.id]: "" }));
    setConfirm(null);
  };
  const ATT_STATUSES = ["Present", "Half Day", "Leave", "Absent", "Holiday"];
  const doSaveAtt = async () => {
    if (!saveAttendanceOverride || !attEdit) return;
    setAttSaving(true);
    const ok = await saveAttendanceOverride({ empId: attEdit.empId, date: attEdit.date, status: attEdit.status, remark: attEdit.remark, prevStatus: attEdit.prevStatus, updatedBy: "Admin" });
    setAttSaving(false);
    if (ok) setAttEdit(null);
  };

  const StatCard = ({ icon, label, value, color }) => (
    <div className="sv-leave-stat">
      <span className="sv-leave-stat-ic" style={{ background: `${color}1A`, color }}>{icon}</span>
      <div><div className="sv-leave-stat-v">{value}</div><div className="sv-leave-stat-l">{label}</div></div>
    </div>
  );

  const Person = ({ l, size = 38 }) => {
    const emp = empById[l.empId];
    return (
      <div className="sv-flex sv-items-center sv-gap-2" style={{ minWidth: 0 }}>
        <Avatar emp={emp} name={l.empName} idx={0} size={size} />
        <div style={{ minWidth: 0 }}>
          <div className="sv-text-navy sv-font-700" style={{ fontSize: 13.5 }}>{l.empName}</div>
          <div className="sv-text-muted" style={{ fontSize: 11 }}>{emp?.department || "—"}</div>
        </div>
      </div>
    );
  };

  const DateRange = ({ l }) => {
    const d = days(l.fromDate, l.toDate);
    return (
      <span className="sv-leave-range">
        <CalendarDays size={13} /> {fmtDate(l.fromDate)}{l.toDate !== l.fromDate ? ` → ${fmtDate(l.toDate)}` : ""}
        <span className="sv-leave-days">{d} day{d !== 1 ? "s" : ""}</span>
      </span>
    );
  };

  const nowIso = new Date().toISOString();
  const periodPrefix = histPeriod === "Month" ? nowIso.slice(0, 7) : nowIso.slice(0, 4);
  const histFiltered = decided.filter((l) => {
    if (histFilter !== "All" && l.status !== histFilter) return false;
    if (!String(l.fromDate || "").startsWith(periodPrefix)) return false;
    if (histSearch) { const q = histSearch.toLowerCase();
      return [l.empName, l.reason, l.remark].some((v) => (v || "").toLowerCase().includes(q)); }
    return true;
  });

  return (
    <div className="sv-tab">
      <h2 className="sv-tab-title">Leave Board {pending.length > 0 && <span className="sv-badge sv-badge--pending" style={{ marginLeft: 8 }}>{pending.length} pending</span>}</h2>

      <div className="sv-leave-stats">
        <StatCard icon={<Clock size={18} />} label="Pending" value={pending.length} color="#F59E0B" />
        <StatCard icon={<Check size={18} />} label="Approved" value={approvedCount} color="#22C55E" />
        <StatCard icon={<XCircle size={18} />} label="Rejected" value={rejectedCount} color="#EF4444" />
        <StatCard icon={<Palmtree size={18} />} label="Total requests" value={leaves.length} color="#3B82F6" />
      </div>

      {/* ── Compact Multi-Employee Attendance Overview ── */}
      {(() => {
        const y = calMonth.getFullYear(), m = calMonth.getMonth();
        const monthLabel = calMonth.toLocaleDateString("en-IN", { month: "long", year: "numeric" });
        const pad = (n) => String(n).padStart(2, "0");
        const keyOf = (day) => `${y}-${pad(m + 1)}-${pad(day)}`;
        const daysInMonth = new Date(y, m + 1, 0).getDate();
        const dowOf = (day) => new Date(y, m, day).getDay();
        const todayKey = new Date().toISOString().slice(0, 10);
        const STc = {
          present: { bg: "#DCFCE7", bd: "#86EFAC", fg: "#15803D", label: "Present" },
          leave: { bg: "#FEE2E2", bd: "#FCA5A5", fg: "#B91C1C", label: "Leave" },
          absent: { bg: "#E2E8F0", bd: "#94A3B8", fg: "#334155", label: "Absent" },
          half: { bg: "#FEF3C7", bd: "#FDE68A", fg: "#B45309", label: "Half Day" },
          holiday: { bg: "#EDE9FE", bd: "#C4B5FD", fg: "#6D28D9", label: "Holiday" },
          weekend: { bg: "#F1F5F9", bd: "#E2E8F0", fg: "#94A3B8", label: "Weekend" },
          none: { bg: "#fff", bd: "#EEF2F7", fg: "#CBD5E1", label: "No data" },
        };
        const ovKey = (s) => ({ "Present": "present", "Present — Full Day": "present", "Present — Half Day": "half", "Half Day": "half", "Leave": "leave", "Absent": "absent", "Holiday": "holiday" }[s] || "present");
        // Precompute approved-leave dates per employee, and DSR submissions by emp+date.
        const leavesByEmp = {};
        (leaves || []).filter((l) => l.status === "Approved").forEach((l) => {
          try { let d = new Date((l.fromDate) + "T00:00:00"); const end = new Date((l.toDate || l.fromDate) + "T00:00:00"); let g = 0;
            while (d <= end && g < 400) { const k = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; (leavesByEmp[l.empId] = leavesByEmp[l.empId] || new Set()).add(k); d.setDate(d.getDate() + 1); g++; } } catch (e) { /* ignore */ }
        });
        const subMap = {};
        (submissions || []).forEach((s) => { subMap[`${s.empId}|${s.date}`] = s; });
        const statusOf = (empId, day) => {
          const key = keyOf(day); const dow = dowOf(day);
          const ov = overrideMap[`${empId}|${key}`];
          if (ov) return ovKey(ov.status); // admin override wins over everything
          if (leavesByEmp[empId] && leavesByEmp[empId].has(key)) return "leave";
          const s = subMap[`${empId}|${key}`];
          if (s) { if (s.attendance === "Absent") return "absent"; if (s.attendance === "Half Day") return "half"; return "present"; }
          if (dow === 0 || dow === 6) return "weekend";
          return "none";
        };
        let workingDays = 0; for (let d = 1; d <= daysInMonth; d++) { const dw = dowOf(d); if (dw !== 0 && dw !== 6) workingDays++; }
        let totLeave = 0, totAbsent = 0;
        employees.forEach((e) => { for (let d = 1; d <= daysInMonth; d++) { const st = statusOf(e.id, d); if (st === "leave") totLeave++; else if (st === "absent") totAbsent++; } });
        const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);
        const NAMEW = 170, COLW = 24, ROWH = 40;
        const totalW = NAMEW + daysInMonth * COLW;
        const initials = (n) => (n || "?").split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();
        const DOW = ["S", "M", "T", "W", "T", "F", "S"];
        const legendItem = (k) => (<span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11.5, color: "#475569" }}><span style={{ width: 11, height: 11, borderRadius: 4, background: STc[k].bg, border: `1px solid ${STc[k].bd}` }} />{STc[k].label}</span>);
        const stickyName = { position: "sticky", left: 0, zIndex: 2, background: "#fff" };
        return (
          <div className="sv-card">
            <div className="sv-flex sv-items-center sv-gap-2" style={{ justifyContent: "space-between", flexWrap: "wrap", gap: 10, marginBottom: 10 }}>
              <div className="sv-flex sv-items-center sv-gap-2" style={{ minWidth: 0 }}>
                <span className="sv-mod-icon" style={{ background: "rgba(37,99,235,.12)", color: "#2563EB" }}><CalendarDays size={16} /></span>
                <div style={{ minWidth: 0 }}>
                  <p className="sv-text-navy sv-font-800" style={{ margin: 0, fontSize: 16 }}>Attendance</p>
                  <p className="sv-text-muted" style={{ margin: 0, fontSize: 12 }}>{employees.length} employees · {workingDays} working days · {totLeave} leaves{totAbsent ? ` · ${totAbsent} absent` : ""}</p>
                </div>
              </div>
              <div className="sv-flex sv-items-center" style={{ gap: 4, border: "1px solid #E9EEF4", borderRadius: 10, padding: 3 }}>
                <button className="sv-icon-btn" onClick={() => setCalMonth(new Date(y, m - 1, 1))} title="Previous month">‹</button>
                <span style={{ fontWeight: 800, color: "#162B55", fontSize: 13, minWidth: 120, textAlign: "center" }}>{monthLabel}</span>
                <button className="sv-icon-btn" onClick={() => setCalMonth(new Date(y, m + 1, 1))} title="Next month">›</button>
                <button className="sv-btn sv-btn--sm sv-btn--ghost" style={{ marginLeft: 4 }} onClick={() => { const d = new Date(); setCalMonth(new Date(d.getFullYear(), d.getMonth(), 1)); }}>Today</button>
              </div>
            </div>

            {employees.length === 0 ? (
              <div className="sv-leave-empty"><Inbox size={26} /><span>No employees to show.</span></div>
            ) : (
              <div style={{ overflowX: "auto", border: "1px solid #EEF2F7", borderRadius: 12 }}>
                <div style={{ width: totalW, minWidth: "100%" }}>
                  {/* header row: date numbers */}
                  <div style={{ display: "grid", gridTemplateColumns: `${NAMEW}px repeat(${daysInMonth}, ${COLW}px)`, borderBottom: "1px solid #EEF2F7", background: "#F8FAFC" }}>
                    <div style={{ ...stickyName, background: "#F8FAFC", padding: "8px 12px", fontSize: 11, fontWeight: 800, color: "#64748B", textTransform: "uppercase", letterSpacing: .3 }}>Employee</div>
                    {days.map((d) => { const dw = dowOf(d); const wknd = dw === 0 || dw === 6; return (
                      <div key={d} title={new Date(y, m, d).toLocaleDateString("en-IN", { weekday: "long" })} style={{ textAlign: "center", padding: "4px 0", color: wknd ? "#CBD5E1" : "#94A3B8" }}>
                        <div style={{ fontSize: 10.5, fontWeight: 700 }}>{d}</div>
                        <div style={{ fontSize: 8.5, fontWeight: 700 }}>{DOW[dw]}</div>
                      </div>
                    ); })}
                  </div>
                  {/* body: max 5 rows visible, rest scroll */}
                  <div style={{ maxHeight: ROWH * 5, overflowY: "auto" }}>
                    {employees.map((e, ri) => (
                      <div key={e.id} onClick={() => setCalDetail(e.id)} title="Open detailed calendar"
                        style={{ display: "grid", gridTemplateColumns: `${NAMEW}px repeat(${daysInMonth}, ${COLW}px)`, alignItems: "center", cursor: "pointer", borderTop: ri ? "1px solid #F1F5F9" : "none" }}>
                        <div style={{ ...stickyName, display: "flex", alignItems: "center", gap: 8, padding: "5px 12px", height: ROWH, borderRight: "1px solid #EEF2F7" }}>
                          <span style={{ flexShrink: 0 }}><Avatar emp={e} name={e.name} idx={ri} size={26} /></span>
                          <span style={{ minWidth: 0 }}>
                            <span style={{ display: "block", fontSize: 12.5, fontWeight: 700, color: "#162B55", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 108 }}>{e.name}</span>
                            <span style={{ display: "block", fontSize: 10.5, color: "#94A3B8", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 108 }}>{e.department || "—"}</span>
                          </span>
                        </div>
                        {days.map((d) => { const st = statusOf(e.id, d); const c = STc[st]; const wknd = st === "weekend"; const isToday = keyOf(d) === todayKey; const dot = st !== "none" && st !== "weekend";
                          return (
                            <div key={d} title={`${e.name} · ${monthLabel.split(" ")[0]} ${d} · ${c.label}`} style={{ height: ROWH, display: "flex", alignItems: "center", justifyContent: "center", background: wknd ? "#F8FAFC" : (isToday ? "#EFF6FF" : "transparent") }}>
                              <span style={{ width: 13, height: 13, borderRadius: 5, background: dot ? c.bg : "transparent", border: dot ? `1px solid ${c.bd}` : (wknd ? "none" : "1px dashed #E2E8F0") }} />
                            </div>
                          );
                        })}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
            <div className="sv-flex sv-items-center" style={{ gap: 14, flexWrap: "wrap", marginTop: 10 }}>
              {legendItem("present")}{legendItem("leave")}{legendItem("absent")}{legendItem("half")}{legendItem("holiday")}{legendItem("weekend")}
              {employees.length > 5 && <span style={{ marginLeft: "auto", fontSize: 11.5, color: "#94A3B8" }}>Scroll for all {employees.length} employees · click a row for details</span>}
            </div>

            {/* ── Employee detail modal ── */}
            {calDetail && (() => {
              const emp = empById[calDetail];
              const firstDow = new Date(y, m, 1).getDay();
              const cells = []; for (let i = 0; i < firstDow; i++) cells.push(null); for (let d = 1; d <= daysInMonth; d++) cells.push(d);
              let cP = 0, cL = 0, cA = 0, cH = 0;
              for (let d = 1; d <= daysInMonth; d++) { const st = statusOf(calDetail, d); if (st === "present") cP++; else if (st === "leave") cL++; else if (st === "absent") cA++; else if (st === "half") cH++; }
              return (
                <div className="sv-modal-overlay" onClick={() => setCalDetail(null)} style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9999, padding: 16 }}>
                  <div className="sv-modal" style={{ maxWidth: 560, width: "100%", background: "#fff", borderRadius: 16, overflow: "hidden" }} onClick={(ev) => ev.stopPropagation()}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 18px", borderBottom: "1px solid #F1F5F9" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <Avatar emp={emp} name={emp?.name} idx={0} size={34} />
                        <div><div style={{ fontWeight: 800, color: "#162B55", fontSize: 15 }}>{emp?.name || "Employee"}</div><div style={{ fontSize: 12, color: "#94A3B8" }}>{emp?.department || "—"} · {monthLabel}</div></div>
                      </div>
                      <button onClick={() => setCalDetail(null)} style={{ border: "none", background: "transparent", fontSize: 22, cursor: "pointer", color: "#64748B", lineHeight: 1 }}>×</button>
                    </div>
                    <div style={{ padding: "14px 18px" }}>
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 5 }}>
                        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((w) => <div key={w} style={{ textAlign: "center", fontSize: 10.5, fontWeight: 700, color: "#94A3B8", textTransform: "uppercase" }}>{w}</div>)}
                        {cells.map((day, i) => {
                          if (day == null) return <div key={`b${i}`} />;
                          const st = statusOf(calDetail, day); const c = STc[st]; const isToday = keyOf(day) === todayKey; const show = st !== "none" && st !== "weekend";
                          const ov = overrideMap[`${calDetail}|${keyOf(day)}`];
                          return (
                            <div key={day} title={`${c.label} — click to edit`} onClick={() => setAttEdit({ empId: calDetail, date: keyOf(day), status: STc[st].label === "No data" || STc[st].label === "Weekend" ? "Present" : STc[st].label, remark: (ov && ov.remark) || "", prevStatus: c.label })}
                              style={{ minHeight: 46, borderRadius: 9, background: st === "weekend" ? "#F8FAFC" : (show ? c.bg : "#fff"), border: `1px solid ${isToday ? "#2563EB" : (show ? c.bd : "#EEF2F7")}`, padding: "5px 7px", display: "flex", flexDirection: "column", justifyContent: "space-between", cursor: "pointer", position: "relative" }}>
                              <span style={{ fontSize: 12, fontWeight: 700, color: show ? c.fg : "#64748B" }}>{day}</span>
                              {show && <span style={{ fontSize: 8.5, fontWeight: 800, color: c.fg, textTransform: "uppercase" }}>{c.label}</span>}
                              {ov && <span title="Admin edited" style={{ position: "absolute", top: 3, right: 4, width: 5, height: 5, borderRadius: "50%", background: "#2563EB" }} />}
                            </div>
                          );
                        })}
                      </div>
                      <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginTop: 12, fontSize: 12.5, fontWeight: 600, alignItems: "center" }}>
                        <span style={{ color: "#15803D" }}>{cP} Present</span>
                        <span style={{ color: "#B91C1C" }}>{cL} Leave</span>
                        {cH > 0 && <span style={{ color: "#B45309" }}>{cH} Half Day</span>}
                        {cA > 0 && <span style={{ color: "#334155" }}>{cA} Absent</span>}
                        <span style={{ marginLeft: "auto", fontSize: 11, color: "#94A3B8", fontWeight: 500 }}>Click any day to edit</span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })()}
          </div>
        );
      })()}

      {pending.length > 0 && (
      <div className="sv-card">
        <div className="sv-flex sv-items-center sv-gap-2" style={{ marginBottom: 4 }}>
          <span className="sv-mod-icon" style={{ background: "rgba(245,158,11,.14)", color: "#D97706" }}><Clock size={16} /></span>
          <div>
            <p className="sv-text-navy sv-font-800" style={{ margin: 0, fontSize: 16 }}>Pending Requests</p>
            <p className="sv-text-muted" style={{ margin: 0, fontSize: 12 }}>Review and decide — a remark is required</p>
          </div>
        </div>

        {(
          <div className="sv-leave-pending-list">
            {pending.map((l) => (
              <div key={l.id} className="sv-leave-req">
                <div className="sv-leave-req-top">
                  <Person l={l} />
                  <span className="sv-badge sv-badge--pending">Pending</span>
                </div>
                <div className="sv-leave-req-meta">
                  <DateRange l={l} />
                  <span className="sv-leave-reason">{l.reason}</span>
                </div>
                <input className={`sv-input sv-leave-remark${errorId === l.id ? " sv-input--err" : ""}`} placeholder="Add a remark (required)…"
                  value={remarks[l.id] || ""} onChange={(e) => { setRemarks((p) => ({ ...p, [l.id]: e.target.value })); if (errorId === l.id) setErrorId(null); }} />
                {errorId === l.id && <p className="sv-leave-err-msg">Please add a remark before deciding.</p>}
                <div className="sv-flex sv-gap-2" style={{ marginTop: 8 }}>
                  <button className="sv-btn sv-btn--sm sv-btn--success" onClick={() => ask(l, "Approved")}><Check size={13} /> Approve</button>
                  <button className="sv-btn sv-btn--sm sv-btn--danger" onClick={() => ask(l, "Rejected")}><XCircle size={13} /> Reject</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      )}

      <div className="sv-card">
        <div className="sv-leave-hist-head">
          <div className="sv-flex sv-items-center sv-gap-2">
            <span className="sv-mod-icon"><CalendarDays size={16} /></span>
            <div>
              <p className="sv-text-navy sv-font-800" style={{ margin: 0, fontSize: 16 }}>History</p>
              <p className="sv-text-muted" style={{ margin: 0, fontSize: 12 }}>{decided.length} decided request{decided.length !== 1 ? "s" : ""}</p>
            </div>
          </div>
          <div className="sv-leave-hist-tools">
            <div className="sv-mailids-search">
              <SearchIcon size={14} />
              <input placeholder="Search name, reason…" value={histSearch} onChange={(e) => setHistSearch(e.target.value)} />
            </div>
            <div className="sv-seg">
              {["Month", "Year"].map((p) => (
                <button key={p} className={`sv-seg-btn${histPeriod === p ? " sv-seg-btn--on" : ""}`} onClick={() => setHistPeriod(p)}>{p}</button>
              ))}
            </div>
            <div className="sv-seg">
              {["All", "Approved", "Rejected"].map((f) => (
                <button key={f} className={`sv-seg-btn${histFilter === f ? " sv-seg-btn--on" : ""}`} onClick={() => setHistFilter(f)}>{f}</button>
              ))}
            </div>
          </div>
        </div>

        {histFiltered.length === 0 ? (
          <div className="sv-leave-empty"><Inbox size={26} /><span>No matching leave records.</span></div>
        ) : (
          <div className="sv-leave-hist-list">
            {histFiltered.map((l) => (
              <div key={l.id} className={`sv-leave-hrow sv-leave-hrow--${l.status.toLowerCase()}`}>
                <Person l={l} size={34} />
                <div className="sv-leave-hrow-mid">
                  <DateRange l={l} />
                  <span className="sv-leave-reason">{l.reason}</span>
                  {l.remark && <span className="sv-leave-note">Note: {l.remark}</span>}
                </div>
                <span className={`sv-badge sv-badge--${l.status.toLowerCase()}`}>{l.status}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Self-Marked Attendance (from DSR) — every department ── */}
      {(() => {
        const attPrefix = attPeriod === "Month" ? nowIso.slice(0, 7) : attPeriod === "Year" ? nowIso.slice(0, 4) : "";
        const attRecords = (submissions || [])
          .filter((s) => s.attendance === "Absent" || s.attendance === "Half Day")
          .filter((s) => attType === "All" || s.attendance === attType)
          .filter((s) => !attPrefix || String(s.date || "").startsWith(attPrefix))
          .filter((s) => { if (!attSearch) return true; const q = attSearch.toLowerCase(); const dep = (empById[s.empId]?.department || ""); return [s.empName, dep].some((v) => (v || "").toLowerCase().includes(q)); })
          .sort((a, b) => (a.date < b.date ? 1 : -1));
        return (
          <div className="sv-card" style={{ marginTop: 16 }}>
            <div className="sv-flex sv-items-center sv-gap-2" style={{ marginBottom: 4 }}>
              <span className="sv-mod-icon" style={{ background: "rgba(220,38,38,.12)", color: "#DC2626" }}><CalendarDays size={16} /></span>
              <div>
                <p className="sv-text-navy sv-font-800" style={{ margin: 0, fontSize: 15.5 }}>Self-Marked Attendance <span className="sv-text-muted" style={{ fontSize: 12, fontWeight: 600 }}>(from Daily Report — all employees)</span></p>
                <p className="sv-text-muted" style={{ margin: 0, fontSize: 12 }}>Everyone who marked themselves Absent or Half Day in their DSR. These are self-reported and need no approval.</p>
              </div>
            </div>
            <div className="sv-flex sv-items-center sv-gap-2" style={{ flexWrap: "wrap", margin: "10px 0 12px" }}>
              <div className="sv-mailids-search"><SearchIcon size={14} /><input placeholder="Search name / department…" value={attSearch} onChange={(e) => setAttSearch(e.target.value)} /></div>
              <div className="sv-seg">{["Month", "Year", "All"].map((p) => <button key={p} className={`sv-seg-btn${attPeriod === p ? " sv-seg-btn--on" : ""}`} onClick={() => setAttPeriod(p)}>{p}</button>)}</div>
              <div className="sv-seg">{["All", "Absent", "Half Day"].map((t) => <button key={t} className={`sv-seg-btn${attType === t ? " sv-seg-btn--on" : ""}`} onClick={() => setAttType(t)}>{t}</button>)}</div>
              <span className="sv-text-muted" style={{ fontSize: 12, marginLeft: "auto" }}>{attRecords.length} record{attRecords.length !== 1 ? "s" : ""}</span>
            </div>
            {attRecords.length === 0 ? (
              <div className="sv-leave-empty"><Inbox size={26} /><span>No self-marked absences for this filter.</span></div>
            ) : (
              <div className="sv-leave-hist-list">
                {attRecords.map((s) => {
                  const emp = empById[s.empId];
                  const isAbs = s.attendance === "Absent";
                  return (
                    <div key={s.id || `${s.empId}-${s.date}`} className="sv-leave-hrow">
                      <div className="sv-flex sv-items-center sv-gap-2" style={{ minWidth: 0 }}>
                        <Avatar emp={emp} name={s.empName} idx={0} size={34} />
                        <div style={{ minWidth: 0 }}>
                          <div className="sv-text-navy sv-font-700" style={{ fontSize: 13.5 }}>{s.empName}</div>
                          <div className="sv-text-muted" style={{ fontSize: 11 }}>{emp?.department || s.department || "—"}</div>
                        </div>
                      </div>
                      <div className="sv-leave-hrow-mid">
                        <span className="sv-leave-range"><CalendarDays size={13} /> {fmtDate(s.date)}</span>
                      </div>
                      <span className="sv-badge" style={{ background: isAbs ? "#FEE2E2" : "#FEF3C7", color: isAbs ? "#B91C1C" : "#B45309" }}>{isAbs ? "On Leave" : "Half Day"}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })()}

      {/* ── Admin attendance edit ── */}
      {attEdit && (() => {
        const emp = empById[attEdit.empId]; const existing = overrideMap[`${attEdit.empId}|${attEdit.date}`];
        return (
          <div className="sv-modal-overlay" onClick={() => setAttEdit(null)} style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 10001, padding: 16 }}>
            <div className="sv-modal" style={{ maxWidth: 400, width: "100%", background: "#fff", borderRadius: 16, overflow: "hidden" }} onClick={(e) => e.stopPropagation()}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 18px", borderBottom: "1px solid #F1F5F9" }}>
                <div><div style={{ fontWeight: 800, color: "#162B55", fontSize: 15 }}>Attendance — {emp?.name || "Employee"}</div><div style={{ fontSize: 12, color: "#94A3B8" }}>{fmtDate(attEdit.date)}</div></div>
                <button onClick={() => setAttEdit(null)} style={{ border: "none", background: "transparent", fontSize: 22, cursor: "pointer", color: "#64748B", lineHeight: 1 }}>×</button>
              </div>
              <div style={{ padding: "16px 18px", display: "grid", gap: 12 }}>
                <label style={lblS}>Status
                  <select className="sv-select" value={attEdit.status} onChange={(e) => setAttEdit({ ...attEdit, status: e.target.value })}>{ATT_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}</select>
                </label>
                <label style={lblS}>Remark / Reason
                  <textarea className="sv-input" rows={2} value={attEdit.remark} onChange={(e) => setAttEdit({ ...attEdit, remark: e.target.value })} placeholder="e.g. Worked until 1:00 PM · manually corrected by Admin" style={{ resize: "vertical" }} />
                </label>
                <div style={{ fontSize: 11.5, color: "#94A3B8", background: "#F8FAFC", borderRadius: 8, padding: "8px 10px" }}>
                  Previous status: <b style={{ color: "#475569" }}>{attEdit.prevStatus}</b>
                  {existing && <><br />Last edited by {existing.updatedBy || "Admin"} · {existing.updatedAt ? new Date(existing.updatedAt).toLocaleString() : ""}</>}
                </div>
              </div>
              <div className="sv-flex sv-justify-between" style={{ padding: "12px 18px", borderTop: "1px solid #F1F5F9", alignItems: "center" }}>
                <span className="sv-text-muted" style={{ fontSize: 11 }}>Admin override · reflects everywhere</span>
                <div className="sv-flex sv-gap-sm">
                  <button className="sv-btn sv-btn--ghost" onClick={() => setAttEdit(null)}>Cancel</button>
                  <button className="sv-btn sv-btn--primary" onClick={doSaveAtt} disabled={attSaving}>{attSaving ? "Saving…" : "Save Changes"}</button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {confirm && (
        <div className="sv-modal-overlay" onClick={() => setConfirm(null)}>
          <div className="sv-modal sv-confirm" onClick={(e) => e.stopPropagation()}>
            <p className="sv-confirm-msg">{confirm.status === "Approved" ? "Approve" : "Reject"} {confirm.leave.empName}'s leave?</p>
            <p className="sv-confirm-sub">{fmtDate(confirm.leave.fromDate)}{confirm.leave.toDate !== confirm.leave.fromDate ? ` → ${fmtDate(confirm.leave.toDate)}` : ""} · Note: {confirm.remark}</p>
            <div className="sv-confirm-actions">
              <button className="sv-btn sv-btn--outline" onClick={() => setConfirm(null)}>No</button>
              <button className={`sv-btn ${confirm.status === "Approved" ? "sv-btn--success" : "sv-btn--danger-solid"}`} onClick={applyDecision}>Yes, {confirm.status === "Approved" ? "Approve" : "Reject"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ───────────────────────────────────────────────────────────────
 * SettingsTab — employee management (incl. email), two-step admin
 * password, messaging, targets, branding, website list.
 * ──────────────────────────────────────────────────────────────*/
export function SettingsTab({ employees, setEmployees, departments = [], freelancers = [], teamMeta = {}, onUpdateEmp, onDeleteEmp, onResetPwd, newEmp, setNewEmp, addEmployeeQuick, newEmpEmail, setNewEmpEmail, newEmpPwd, setNewEmpPwd, adminPwd, setAdminPwd, msgEmpId, setMsgEmpId, msgText, setMsgText, sendMessage, messages, deleteMessage, targets, setTargets, logo, onLogoChange, onLogoRemove, websites, newWebsite, setNewWebsite, addWebsite, removeWebsite, domains = [], addDomain, updateDomain, deleteDomain, pushNotification, showToast, editMode = false, setEditMode, settingsPwd = "Settings@123", setSettingsPwd }) {
  const [newDomain, setNewDomain] = useState("");
  const [editDomainId, setEditDomainId] = useState(null);
  const [editDomainVal, setEditDomainVal] = useState("");
  const [curPwd, setCurPwd] = useState("");
  const [newPwd, setNewPwd] = useState("");
  const [confirmPwd, setConfirmPwd] = useState("");
  const [unlockOpen, setUnlockOpen] = useState(false);
  const [unlockPwd, setUnlockPwd] = useState("");

  // Inline unlock (same check as the lock bar) so config sections can be
  // unlocked right where they are, without scrolling back to the top.
  const doInlineUnlock = () => {
    if (unlockPwd === settingsPwd) { setEditMode && setEditMode(true); setUnlockOpen(false); setUnlockPwd(""); showToast("Settings unlocked.", "success"); }
    else showToast("Incorrect Settings Password.", "error");
  };
  // Rendered as a function call (not a nested <Component/>) so the password
  // input keeps focus while typing.
  const lockHint = () => (editMode ? null : (
    <div className="sv-sal-lock" style={{ marginTop: 12 }}>
      <span className="sv-sal-lock-msg">🔒 Locked — unlock with the Settings Password to edit.</span>
      {unlockOpen ? (
        <div className="sv-sal-unlock-form">
          <input type="password" className="sv-input" autoFocus placeholder="Settings Password" value={unlockPwd}
            onChange={(e) => setUnlockPwd(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") doInlineUnlock(); if (e.key === "Escape") { setUnlockOpen(false); setUnlockPwd(""); } }} />
          <button className="sv-btn sv-btn--primary sv-btn--sm" onClick={doInlineUnlock} disabled={!unlockPwd}>Unlock</button>
          <button className="sv-btn sv-btn--outline sv-btn--sm" onClick={() => { setUnlockOpen(false); setUnlockPwd(""); }}>Cancel</button>
        </div>
      ) : (
        <button className="sv-btn sv-btn--primary sv-btn--sm" onClick={() => setUnlockOpen(true)}>Unlock</button>
      )}
    </div>
  ));

  const onLogoFile = (file) => {
    const reader = new FileReader();
    reader.onload = () => onLogoChange(reader.result);
    reader.readAsDataURL(file);
  };

  const changeAdminPwd = async () => {
    let okCur = false;
    try { const { data } = await supabase.rpc("admin_login", { p_password: curPwd }); okCur = data === true; } catch (e) { /* ignore */ }
    if (!okCur) { showToast("Current password is incorrect.", "error"); return; }
    if (!newPwd || newPwd.length < 4) { showToast("New password must be at least 4 characters.", "error"); return; }
    if (newPwd !== confirmPwd) { showToast("New passwords do not match.", "error"); return; }
    setAdminPwd(newPwd);
    setCurPwd(""); setNewPwd(""); setConfirmPwd("");
    showToast("Admin password updated.", "success");
  };

  const deptCount = new Set(employees.map((e) => (e.department || "").trim().toLowerCase()).filter(Boolean)).size || departments.length;
  const managerCount = new Set(employees.map((e) => e.teamLead).filter(Boolean)).size;
  const designerCount = employees.filter((e) => (e.department || "").toLowerCase() === "design").length;
  const stats = [
    { icon: <Users size={18} />, label: "Employees", value: employees.length, color: "#3B82F6" },
    { icon: <Building2 size={18} />, label: "Departments", value: deptCount, color: "#8B5CF6" },
    { icon: <UserCog size={18} />, label: "Managers", value: managerCount, color: "#0EA5E9" },
    { icon: <Palette size={18} />, label: "Designers", value: designerCount, color: "#EC4899" },
    { icon: <BriefcaseIcon size={18} />, label: "Freelancers", value: (freelancers || []).length, color: "#F59E0B" },
    { icon: <Globe2 size={18} />, label: "Websites", value: (websites || []).length, color: "#22C55E" },
  ];
  const SecHead = ({ icon, color = "#2563EB", bg, title, desc }) => (
    <div className="sv-flex sv-items-center sv-gap-2" style={{ marginBottom: 12 }}>
      <span className="sv-mod-icon" style={{ background: bg || "rgba(37,99,235,.1)", color }}>{icon}</span>
      <div><p className="sv-text-navy sv-font-800" style={{ margin: 0, fontSize: 15.5 }}>{title}</p><p className="sv-text-muted" style={{ margin: 0, fontSize: 12 }}>{desc}</p></div>
    </div>
  );

  return (
    <div className="sv-tab">
      <h2 className="sv-tab-title">Settings</h2>

      <div className="sv-leave-stats" style={{ gridTemplateColumns: "repeat(6, 1fr)" }}>
        {stats.map((s) => (
          <div key={s.label} className="sv-leave-stat">
            <span className="sv-leave-stat-ic" style={{ background: `${s.color}1A`, color: s.color }}>{s.icon}</span>
            <div><div className="sv-leave-stat-v">{s.value}</div><div className="sv-leave-stat-l">{s.label}</div></div>
          </div>
        ))}
      </div>

      <SettingsLockBar editMode={editMode} setEditMode={setEditMode} settingsPwd={settingsPwd} setSettingsPwd={setSettingsPwd} showToast={showToast} />
      <div className="sv-grid-2 sv-gap-md">
        <div className="sv-card">
          <SecHead icon={<Users size={16} />} title="Employee Management" desc="Add employees and manage their details" />
          <div className="sv-flex sv-gap-sm" style={{ flexWrap: "wrap" }}>
            <input className="sv-input" placeholder="Full name" value={newEmp} onChange={(e) => setNewEmp(e.target.value)} style={{ flex: "1 1 150px" }} />
            <input className="sv-input" type="email" placeholder="Email (for login)" value={newEmpEmail} onChange={(e) => setNewEmpEmail(e.target.value)} style={{ flex: "1 1 190px" }} />
            <input className="sv-input" placeholder="Password (default 1234)" value={newEmpPwd} onChange={(e) => setNewEmpPwd(e.target.value)} style={{ flex: "1 1 150px" }} />
            <button className="sv-btn sv-btn--primary" onClick={addEmployeeQuick}><Plus size={14} /> Add</button>
          </div>
          {/* Compact employee list — shows 4, scrollable, View All toggle */}
          <EmployeeListCompact employees={employees} onUpdateEmp={onUpdateEmp} onDeleteEmp={onDeleteEmp} onResetPwd={onResetPwd} departments={departments} />
        </div>

        <div className="sv-card">
          <SecHead icon={<ShieldCheck size={16} />} color="#16A34A" bg="rgba(22,163,74,.12)" title="Admin Security" desc="Two-step admin password change" />
          <label className="sv-label">Current Password</label>
          <input className="sv-input" type="password" value={curPwd} onChange={(e) => setCurPwd(e.target.value)} style={{ marginBottom: 8 }} />
          <label className="sv-label">New Password</label>
          <input className="sv-input" type="password" value={newPwd} onChange={(e) => setNewPwd(e.target.value)} style={{ marginBottom: 8 }} />
          <label className="sv-label">Confirm New Password</label>
          <input className="sv-input" type="password" value={confirmPwd} onChange={(e) => setConfirmPwd(e.target.value)} style={{ marginBottom: 12 }} />
          <button className="sv-btn sv-btn--primary" onClick={changeAdminPwd} disabled={!editMode}>Update Password</button>
        </div>

        <div className="sv-card">
          <SecHead icon={<MessageSquare size={16} />} color="#7C3AED" bg="rgba(124,58,237,.12)" title="Message an Employee" desc="Send a direct message to any employee" />
          <select className="sv-select" value={msgEmpId} onChange={(e) => setMsgEmpId(e.target.value)}>
            <option value="">Select employee...</option>
            {employees.map((e) => <option key={e.id} value={e.id}>{empLabel(e)}</option>)}
          </select>
          <textarea className="sv-textarea" placeholder="Message..." value={msgText} onChange={(e) => setMsgText(e.target.value)} style={{ marginTop: 8 }} />
          <button className="sv-btn sv-btn--primary" style={{ marginTop: 8 }} onClick={sendMessage}>Send</button>
          <ul className="sv-list" style={{ marginTop: 12 }}>
            {messages.map((m) => (
              <li key={m.id} className="sv-flex sv-flex--between">
                <span>{employees.find((e) => e.id === m.empId)?.name}: {m.text}</span>
                <button className="sv-btn sv-btn--sm sv-btn--danger" onClick={() => deleteMessage(m.id)}>Delete</button>
              </li>
            ))}
          </ul>
        </div>


        <div className="sv-card">
          <SecHead icon={<ImageIcon size={16} />} color="#EA580C" bg="rgba(234,88,12,.12)" title="Company Branding" desc="Logo shown across the dashboard" />
          {lockHint()}
          <div className="sv-logo-preview">
            {logo ? <img src={logo} alt="Logo" /> : <span>SV</span>}
          </div>
          <input type="file" accept="image/*" disabled={!editMode} onChange={(e) => e.target.files[0] && onLogoFile(e.target.files[0])} />
          <button className="sv-btn sv-btn--sm sv-btn--outline" style={{ marginTop: 8 }} onClick={onLogoRemove} disabled={!editMode}>Remove</button>
        </div>

        <div className="sv-card">
          <SecHead icon={<Globe2 size={16} />} color="#16A34A" bg="rgba(22,163,74,.12)" title="Website Management" desc="Websites your team works on" />
          <div className="sv-info-note">
            <Globe2 size={15} />
            <span>These are the websites your team works on. When an employee fills their <b>Daily Status Report</b>, they pick a website from this list and describe what they did on it that day. Add every site your team handles so it appears as an option in their report.</span>
          </div>
          {lockHint()}
          <label className="sv-label" style={{ marginTop: 12 }}>Add a website</label>
          <div className="sv-flex sv-gap-sm">
            <input className="sv-input" placeholder="e.g. Main Website, Company Blog" disabled={!editMode} value={newWebsite} onChange={(e) => setNewWebsite(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && editMode) addWebsite(); }} />
            <button className="sv-btn sv-btn--primary" onClick={addWebsite} disabled={!editMode}><Plus size={14} /> Add</button>
          </div>
          <div className="sv-website-list">
            <span className="sv-website-list-label">Employees can report on {websites.length} website{websites.length !== 1 ? "s" : ""}:</span>
            {websites.length === 0 ? (
              <span className="sv-text-muted" style={{ fontSize: 12.5 }}>None yet — add your first website above.</span>
            ) : (
              <div className="sv-flex sv-gap-xs" style={{ flexWrap: "wrap", marginTop: 6 }}>
                {websites.map((w) => <span key={w} className="sv-chip">{w} <button disabled={!editMode} onClick={() => removeWebsite(w)} style={{ border: "none", background: "transparent", cursor: editMode ? "pointer" : "not-allowed", marginLeft: 4 }}>×</button></span>)}
              </div>
            )}
          </div>
        </div>

        <div className="sv-card">
          <SecHead icon={<Globe2 size={16} />} color="#2563EB" bg="rgba(37,99,235,.12)" title="Websites / Domains" desc="One shared domain list — powers the Sales Pipeline and every DSR (Operation, Social, Magazine Live). Add once, appears everywhere." />
          <div className="sv-info-note">
            <Globe2 size={15} />
            <span>These domains appear automatically in the <b>Sales Pipeline</b> and in the <b>Operation DSR</b> (Website Work, Social Media, Magazine Live). Add or remove one here and it updates everywhere.</span>
          </div>
          {lockHint()}
          <label className="sv-label" style={{ marginTop: 12 }}>Add a domain</label>
          <div className="sv-flex sv-gap-sm">
            <input className="sv-input" placeholder="e.g. AWL, CIO Visionaries" disabled={!editMode} value={newDomain} onChange={(e) => setNewDomain(e.target.value)} onKeyDown={async (e) => { if (e.key === "Enter" && editMode && newDomain.trim()) { const ok = await addDomain(newDomain); if (ok) setNewDomain(""); } }} />
            <button className="sv-btn sv-btn--primary" disabled={!editMode || !newDomain.trim()} onClick={async () => { const ok = await addDomain(newDomain); if (ok) setNewDomain(""); }}><Plus size={14} /> Add</button>
          </div>
          <div className="sv-website-list">
            <span className="sv-website-list-label">{domains.length} domain{domains.length !== 1 ? "s" : ""} available across Pipeline &amp; DSR:</span>
            {domains.length === 0 ? (
              <span className="sv-text-muted" style={{ fontSize: 12.5 }}>None yet — add your first domain above.</span>
            ) : (
              <div className="sv-flex sv-gap-xs" style={{ flexWrap: "wrap", marginTop: 6 }}>
                {domains.map((d) => (
                  editDomainId === d.id ? (
                    <span key={d.id} className="sv-chip" style={{ gap: 4 }}>
                      <input className="sv-input" style={{ height: 26, padding: "2px 6px", fontSize: 12.5, width: 150 }} value={editDomainVal} autoFocus onChange={(e) => setEditDomainVal(e.target.value)} onKeyDown={async (e) => { if (e.key === "Enter" && editDomainVal.trim()) { await updateDomain(d.id, editDomainVal); setEditDomainId(null); } if (e.key === "Escape") setEditDomainId(null); }} />
                      <button onClick={async () => { if (editDomainVal.trim()) { await updateDomain(d.id, editDomainVal); setEditDomainId(null); } }} style={{ border: "none", background: "transparent", cursor: "pointer", color: "#16A34A", fontWeight: 700 }}>✓</button>
                      <button onClick={() => setEditDomainId(null)} style={{ border: "none", background: "transparent", cursor: "pointer", color: "#94A3B8" }}>×</button>
                    </span>
                  ) : (
                    <span key={d.id} className="sv-chip">{d.name}
                      <button disabled={!editMode} title="Edit" onClick={() => { setEditDomainId(d.id); setEditDomainVal(d.name); }} style={{ border: "none", background: "transparent", cursor: editMode ? "pointer" : "not-allowed", marginLeft: 6, color: "#2563EB" }}><Pencil size={12} /></button>
                      <button disabled={!editMode} title="Delete" onClick={() => { if (window.confirm(`Delete domain "${d.name}"?`)) deleteDomain(d.id); }} style={{ border: "none", background: "transparent", cursor: editMode ? "pointer" : "not-allowed", marginLeft: 2 }}>×</button>
                    </span>
                  )
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}


/* Single employee row in admin Settings. Holds a local draft and persists
   text edits on blur (avoids per-keystroke writes & save races). */
function EmployeeRow({ emp, onUpdateEmp, onDeleteEmp, onResetPwd, departments = [] }) {
  const [draft, setDraft] = useState(emp);
  const [open, setOpen] = useState(false);
  useEffect(() => { setDraft(emp); }, [emp.id]);
  const set = (field, val) => setDraft((d) => ({ ...d, [field]: val }));
  return (
    <li className={`sv-emp-row${open ? " sv-emp-row--open" : ""}`}>
      <div className="sv-emp-head" onClick={() => setOpen((v) => !v)}>
        <span className="sv-flex sv-items-center sv-gap-2">
          <Avatar name={draft.name} photo={draft.photo} size={30} />
          <span className="sv-emp-name">{draft.name}</span>
          <span className="sv-emp-dept">{draft.department}</span>
        </span>
        <span className="sv-flex sv-items-center sv-gap-2">
          <button className="sv-btn sv-btn--sm sv-btn--danger" onClick={(ev) => { ev.stopPropagation(); if (window.confirm(`Remove ${emp.name}?`)) onDeleteEmp(emp.id); }}>Remove</button>
          <span className="sv-emp-chevron">{open ? "▲" : "▼"}</span>
        </span>
      </div>
      {open && (
      <div className="sv-emp-body">
      <div className="sv-emp-grid">
        <label className="sv-field"><span>Department</span>
          <select className="sv-select" value={draft.department || ""} onChange={(e) => { const v = e.target.value; const next = { ...draft, department: v }; setDraft(next); onUpdateEmp(next); }}>
            <option value="">— Select department —</option>
            {(() => {
              // Dynamic list from the Departments section; keep the employee's current
              // value even if it isn't in the list, so editing never drops it.
              const seen = new Set(); const opts = [];
              [...(draft.department ? [draft.department] : []), ...departments].forEach((d) => {
                const k = (d || "").trim().toLowerCase();
                if (d && !seen.has(k)) { seen.add(k); opts.push(d); }
              });
              return opts.map((d) => <option key={d} value={d}>{d}</option>);
            })()}
          </select>
        </label>
        <label className="sv-field"><span>Employee Code</span>
          <input className="sv-input" maxLength={4} placeholder="e.g. 1234" value={draft.code || ""} onChange={(e) => set("code", e.target.value)} onBlur={() => onUpdateEmp(draft)} />
        </label>
        <label className="sv-field"><span>Email</span>
          <input className="sv-input" placeholder="name@company.com" value={draft.email || ""} onChange={(e) => set("email", e.target.value)} onBlur={() => onUpdateEmp(draft)} />
        </label>
      </div>
      <ResetPasswordInline empId={emp.id} empName={emp.name} onResetPwd={onResetPwd} />
      </div>
      )}
    </li>
  );
}

function ResetPasswordInline({ empId, empName, onResetPwd }) {
  const [open, setOpen] = useState(false);
  const [newPwd, setNewPwd] = useState("");
  const [confirm, setConfirm] = useState("");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  const handleReset = async () => {
    if (!newPwd.trim()) { setMsg("Enter a new password."); return; }
    if (newPwd !== confirm) { setMsg("Passwords don't match."); return; }
    if (newPwd.length < 4) { setMsg("Password must be at least 4 characters."); return; }
    setSaving(true);
    const result = await onResetPwd(empId, newPwd);
    setSaving(false);
    if (result !== false) {
      setMsg(`✅ Password updated for ${empName}!`);
      setNewPwd(""); setConfirm("");
      setTimeout(() => { setOpen(false); setMsg(""); }, 2000);
    } else {
      setMsg("❌ Failed to update password.");
    }
  };

  return (
    <div style={{ marginTop: 4 }}>
      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        <button
          className="sv-btn sv-btn--sm sv-btn--outline"
          onClick={() => { setOpen((o) => !o); setMsg(""); }}
        >
          {open ? <><X size={14} /> Cancel</> : <><KeyRound size={14} /> Reset Password</>}
        </button>
        <span className="sv-text-muted" style={{ fontSize: 11 }}>Passwords are encrypted and can't be viewed — reset to set a new one.</span>
      </div>
      {open && (
        <div style={{ marginTop: 8, padding: "10px 12px", background: "#F8FAFC", border: "1px solid #E2E8F0", borderRadius: 8 }}>
          <div style={{ fontSize: 11, color: "#64748B", marginBottom: 6, fontWeight: 600 }}>
            Set new password for {empName}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
            <input
              className="sv-input" type="password"
              placeholder="New password" value={newPwd}
              onChange={(e) => setNewPwd(e.target.value)}
            />
            <input
              className="sv-input" type="password"
              placeholder="Confirm password" value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
            />
          </div>
          {msg && <div style={{ fontSize: 11, marginTop: 6, color: msg.startsWith("✅") ? "#16A34A" : "#DC2626" }}>{msg}</div>}
          <button
            className="sv-btn sv-btn--sm sv-btn--primary"
            onClick={handleReset} disabled={saving}
            style={{ marginTop: 8 }}
          >
            {saving ? "Saving..." : "Update Password"}
          </button>
        </div>
      )}
    </div>
  );
}

// ── EmployeeListCompact ──────────────────────────────────────
// Shows 4 employees by default with a scrollable "View All" expansion
function EmployeeListCompact({ employees, onUpdateEmp, onDeleteEmp, onResetPwd, departments = [] }) {
  return (
    <div style={{ marginTop: 12 }}>
      <div className="sv-emp-count">{employees.length} employee{employees.length === 1 ? "" : "s"} — click a name to view details</div>
      <div className="sv-emp-list">
        <ul className="sv-list" style={{ margin: 0, padding: 0 }}>
          {employees.map((e) => (
            <EmployeeRow key={e.id} emp={e} onUpdateEmp={onUpdateEmp} onDeleteEmp={onDeleteEmp} onResetPwd={onResetPwd} departments={departments} />
          ))}
        </ul>
      </div>
    </div>
  );
}

/* ───────────────────────────────────────────────────────────────
 * SettingsLockBar — gates editing of Settings config + the Salary
 * tab behind a SEPARATE "Settings Password" (distinct from the admin
 * login password). Supports resetting the Settings Password after
 * verifying either the current Settings Password or an OTP.
 *
 * NOTE: OTP delivery is a demo — there is no SMS/WhatsApp backend yet,
 * so the generated code is surfaced on screen. Wire `sendOtp` to a real
 * SMS/WhatsApp provider (to the registered mobile) when available.
 * ──────────────────────────────────────────────────────────────*/
function SettingsLockBar({ editMode, setEditMode, settingsPwd, setSettingsPwd, showToast }) {
  const [panel, setPanel] = useState(null);           // null | "unlock" | "reset"
  const [unlockPwd, setUnlockPwd] = useState("");
  const [rMethod, setRMethod] = useState("password"); // "password" | "otp"
  const [rVerified, setRVerified] = useState(false);
  const [rCurrent, setRCurrent] = useState("");
  const [rOtpSent, setROtpSent] = useState("");
  const [rOtpInput, setROtpInput] = useState("");
  const [rNew, setRNew] = useState("");
  const [rConfirm, setRConfirm] = useState("");

  const closeAll = () => {
    setPanel(null); setUnlockPwd(""); setRVerified(false); setRCurrent("");
    setROtpSent(""); setROtpInput(""); setRNew(""); setRConfirm(""); setRMethod("password");
  };

  const doUnlock = () => {
    if (unlockPwd === settingsPwd) { setEditMode(true); showToast("Settings & Salary unlocked.", "success"); closeAll(); }
    else showToast("Incorrect Settings Password.", "error");
  };

  const sendOtp = () => {
    const code = String(Math.floor(100000 + Math.random() * 900000));
    setROtpSent(code);
    // DEMO: no SMS/WhatsApp backend — surface the code so it can be entered.
    // TODO: replace with a real send to the admin's registered mobile.
    showToast(`Demo OTP (wire SMS/WhatsApp later): ${code}`, "info");
  };

  const verifyReset = () => {
    if (rMethod === "password") {
      if (rCurrent === settingsPwd) setRVerified(true);
      else showToast("Current Settings Password is incorrect.", "error");
    } else {
      if (rOtpInput && rOtpInput === rOtpSent) setRVerified(true);
      else showToast("Incorrect OTP.", "error");
    }
  };

  const saveNew = () => {
    if (!rNew || rNew.length < 4) { showToast("New password must be at least 4 characters.", "error"); return; }
    if (rNew !== rConfirm) { showToast("New passwords do not match.", "error"); return; }
    setSettingsPwd && setSettingsPwd(rNew);
    showToast("Settings Password updated.", "success");
    closeAll();
  };

  return (
    <div style={{
      padding: "10px 16px", marginBottom: 4,
      background: editMode ? "#DCFCE7" : "#FEF3C7",
      border: `1.5px solid ${editMode ? "#86EFAC" : "#FDE68A"}`,
      borderRadius: 10,
    }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 18 }}>{editMode ? "🔓" : "🔒"}</span>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: editMode ? "#166534" : "#92400E" }}>
              {editMode ? "Settings & Salary — editing unlocked" : "Settings & Salary are locked"}
            </div>
            <div style={{ fontSize: 11, color: editMode ? "#15803D" : "#B45309" }}>
              {editMode ? "Config fields and the Salary tab are editable. Click Lock when done." : "Enter the Settings Password to edit config & salary. Employee info stays editable without it."}
            </div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {editMode ? (
            <button onClick={() => { setEditMode(false); closeAll(); }} style={{ padding: "8px 18px", borderRadius: 8, border: "none", cursor: "pointer", fontWeight: 700, fontSize: 13, background: "#DC2626", color: "#fff" }}>🔒 Lock</button>
          ) : (
            <>
              <button onClick={() => setPanel(panel === "unlock" ? null : "unlock")} style={{ padding: "8px 18px", borderRadius: 8, border: "none", cursor: "pointer", fontWeight: 700, fontSize: 13, background: "#1D4ED8", color: "#fff" }}><Pencil size={14} /> Edit</button>
              <button onClick={() => { setPanel(panel === "reset" ? null : "reset"); setRVerified(false); }} style={{ padding: "8px 14px", borderRadius: 8, border: "1.5px solid #CBD5E1", cursor: "pointer", fontWeight: 700, fontSize: 12.5, background: "#fff", color: "#475569" }}>Reset Password</button>
            </>
          )}
        </div>
      </div>

      {/* Unlock panel */}
      {!editMode && panel === "unlock" && (
        <div style={{ marginTop: 10, padding: "10px 12px", background: "#fff", border: "1px solid #E2E8F0", borderRadius: 8, display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <input className="sv-input" type="password" placeholder="Settings Password" value={unlockPwd} onChange={(e) => setUnlockPwd(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") doUnlock(); }} style={{ maxWidth: 220 }} />
          <button className="sv-btn sv-btn--primary" onClick={doUnlock}>Unlock</button>
        </div>
      )}

      {/* Reset panel */}
      {!editMode && panel === "reset" && (
        <div style={{ marginTop: 10, padding: "12px 14px", background: "#fff", border: "1px solid #E2E8F0", borderRadius: 8 }}>
          <div style={{ fontSize: 12.5, fontWeight: 700, color: "#475569", marginBottom: 8 }}>Reset Settings Password</div>
          {!rVerified ? (
            <>
              <div style={{ display: "flex", gap: 8, marginBottom: 10, flexWrap: "wrap" }}>
                <button onClick={() => setRMethod("password")} className={`sv-period-btn ${rMethod === "password" ? "sv-period-btn--active" : ""}`}>Current Password</button>
                <button onClick={() => setRMethod("otp")} className={`sv-period-btn ${rMethod === "otp" ? "sv-period-btn--active" : ""}`}>OTP</button>
              </div>
              {rMethod === "password" ? (
                <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                  <input className="sv-input" type="password" placeholder="Current Settings Password" value={rCurrent} onChange={(e) => setRCurrent(e.target.value)} style={{ maxWidth: 240 }} />
                  <button className="sv-btn sv-btn--primary" onClick={verifyReset}>Verify</button>
                </div>
              ) : (
                <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                  <button className="sv-btn sv-btn--outline" onClick={sendOtp}>{rOtpSent ? "Resend OTP" : "Send OTP"}</button>
                  <input className="sv-input" placeholder="Enter OTP" value={rOtpInput} onChange={(e) => setROtpInput(e.target.value)} style={{ maxWidth: 160 }} disabled={!rOtpSent} />
                  <button className="sv-btn sv-btn--primary" onClick={verifyReset} disabled={!rOtpSent}>Verify</button>
                  <span style={{ fontSize: 11, color: "#94A3B8" }}>Sent to registered mobile (demo — wire SMS/WhatsApp later).</span>
                </div>
              )}
            </>
          ) : (
            <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
              <input className="sv-input" type="password" placeholder="New Settings Password" value={rNew} onChange={(e) => setRNew(e.target.value)} style={{ maxWidth: 220 }} />
              <input className="sv-input" type="password" placeholder="Confirm new password" value={rConfirm} onChange={(e) => setRConfirm(e.target.value)} style={{ maxWidth: 220 }} />
              <button className="sv-btn sv-btn--primary" onClick={saveNew}>Save New Password</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ───────────────────────────────────────────────────────────────
 * ExpenseTab — SaaS financial management (3 sections + dashboard).
 *   • Insertion Orders  — auto-captured when a Confirmation Order is downloaded
 *   • Salary Expenses   — auto-captured when a salary is marked Paid
 *   • SuccessViews Expenses — manual company operating expenses
 * Reuses existing .sv-* styles. Attachments deferred to a follow-up.
 * ──────────────────────────────────────────────────────────────*/
const EXP_CURRENCIES = ["INR", "USD", "AED", "AUD", "EUR", "GBP", "CAD", "Other"];
const EXP_METHODS = ["PayPal", "Skydo", "Bank Transfer", "Wise", "Stripe", "Cash", "Other"];
const CO_CATEGORIES = ["Office Rent", "Internet", "Electricity", "Software Subscriptions", "Marketing", "Travel", "Food", "Office Equipment", "Miscellaneous"];
const CO_BLANK = { type: "company", title: "", category: "Miscellaneous", clientName: "", amount: "", currency: "INR", paymentDate: "", paymentMethod: "", paymentStatus: "Paid", notes: "", details: { vendor: "" } };
const EXP_MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

function expMoney(v, code) {
  if (v === null || v === undefined || v === "") return "—";
  const n = Number(v);
  if (Number.isNaN(n)) return "—";
  return n.toLocaleString(code === "INR" ? "en-IN" : "en-US") + (code ? " " + code : "");
}
function expMonthKey(rec) { return (rec.paymentDate || rec.createdAt || "").slice(0, 7); }
function expMonthLabel(key) {
  if (!key) return "Undated";
  const [y, m] = key.split("-");
  return `${EXP_MONTHS[(+m) - 1] || m} ${y}`;
}
function expBag(list) {
  const bag = {};
  list.forEach((r) => { const n = Number(r.amount); if (!Number.isNaN(n) && r.amount !== null && r.amount !== "") bag[r.currency || "INR"] = (bag[r.currency || "INR"] || 0) + n; });
  return bag;
}
function expFmtBag(bag) {
  const k = Object.keys(bag);
  if (!k.length) return "—";
  return k.map((c) => expMoney(bag[c], c)).join(" · ");
}
function expEsc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c])); }

export function ExpenseTab({ expenses = [], addExpense, updateExpense, deleteExpense, logo = "", domains = [] }) {
  const domainOptions = (domains || []).filter((d) => d && d.status !== false).map((d) => d.name);
  const todayStr = (() => { const d = new Date(); const p = (n) => String(n).padStart(2, "0"); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`; })();
  const [section, setSection] = useState("dashboard");
  const [search, setSearch] = useState("");
  const [fMonth, setFMonth] = useState("");
  const [fYear, setFYear] = useState("");
  const [fCur, setFCur] = useState("");
  const [fStatus, setFStatus] = useState("");
  const [fCat, setFCat] = useState("");
  const [dashCur, setDashCur] = useState(""); // dashboard currency scope (charts never mix currencies)
  const [detail, setDetail] = useState(null);
  const [detailEdit, setDetailEdit] = useState(null); // { paymentStatus, notes } while editing a captured record
  const [form, setForm] = useState(null);             // company add/edit form
  const [isNew, setIsNew] = useState(false);
  const [confirmDel, setConfirmDel] = useState(null);
  const [saving, setSaving] = useState(false);
  const [catMode, setCatMode] = useState("list"); // "list" | "custom" — company expense category
  const [ioForm, setIoForm] = useState(null);     // Payment Received form (income)
  const [ioSaving, setIoSaving] = useState(false);
  const [ioUploading, setIoUploading] = useState(false);
  const [insForm, setInsForm] = useState(null);   // Insertion Order form (Name + mandatory file)
  const [insSaving, setInsSaving] = useState(false);
  const [insUploading, setInsUploading] = useState(false);

  const io = expenses.filter((e) => e.type === "insertion_order");
  const pay = expenses.filter((e) => e.type === "payment_received");
  const sal = expenses.filter((e) => e.type === "salary");
  const co = expenses.filter((e) => e.type === "company");

  const years = Array.from(new Set(expenses.map((e) => expMonthKey(e).slice(0, 4)).filter(Boolean))).sort().reverse();

  const applyFilters = (list) => list.filter((e) => {
    const q = search.trim().toLowerCase();
    if (q) {
      const hay = `${e.clientName || ""} ${e.title || ""} ${e.contractOrder || ""} ${e.category || ""} ${(e.details && e.details.employeeName) || ""} ${(e.details && e.details.employeeId) || ""} ${(e.details && e.details.confirmationNo) || ""} ${(e.details && e.details.vendor) || ""}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    const mk = expMonthKey(e);
    if (fMonth && mk.slice(5, 7) !== fMonth) return false;
    if (fYear && mk.slice(0, 4) !== fYear) return false;
    if (fCur && e.currency !== fCur) return false;
    if (fStatus && (e.paymentStatus || "") !== fStatus) return false;
    if (fCat && (e.category || "") !== fCat) return false;
    return true;
  });

  // Monthly summaries (all months, newest first)
  const monthMap = {};
  expenses.forEach((e) => { const k = expMonthKey(e); if (!k) return; (monthMap[k] = monthMap[k] || []).push(e); });
  const monthKeys = Object.keys(monthMap).sort().reverse();

  const openAddCompany = () => { setForm({ ...CO_BLANK, paymentDate: todayStr, details: { vendor: "" } }); setIsNew(true); setCatMode("list"); };
  const openEditCompany = (e) => { setForm({ ...e, details: { ...(e.details || {}) } }); setIsNew(false); setDetail(null); setCatMode(!e.category || CO_CATEGORIES.includes(e.category) ? "list" : "custom"); };
  const updF = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const updFDetail = (k, v) => setForm((f) => ({ ...f, details: { ...(f.details || {}), [k]: v } }));
  const saveCompany = async () => {
    if (!form.title.trim() && !form.clientName.trim()) return;
    if (!form.clientName) form.clientName = form.title;
    setSaving(true);
    const ok = isNew ? await addExpense(form) : await updateExpense(form);
    setSaving(false);
    if (ok !== false) setForm(null);
  };

  // Shared file uploader → returns { url, name } or null
  const uploadFile = async (file) => {
    if (!file) return null;
    if (file.size > 10 * 1024 * 1024) { alert("File is larger than 10 MB — please choose a smaller file."); return null; }
    const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const path = `invoices/${Date.now()}_${safe}`;
    const { error } = await supabase.storage.from("design-files").upload(path, file, { upsert: false });
    if (error) throw error;
    const { data: pub } = supabase.storage.from("design-files").getPublicUrl(path);
    return { url: pub.publicUrl, name: file.name };
  };

  // ── Payment Received (income) ──
  const openAddIO = () => setIoForm({
    id: "", clientName: "", invoice: "", invoiceUrl: "", invoiceName: "",
    amount: "", currency: "USD", paymentDate: todayStr, paymentStatus: "Received", notes: "",
  });
  const updIO = (k, v) => setIoForm((f) => ({ ...f, [k]: v }));
  const uploadInvoiceFile = async (file) => {
    if (!file) return;
    setIoUploading(true);
    try { const r = await uploadFile(file); if (r) setIoForm((f) => ({ ...f, invoiceUrl: r.url, invoiceName: r.name })); }
    catch (e) { alert("Could not upload the file: " + (e.message || "unknown error")); }
    finally { setIoUploading(false); }
  };
  const saveIO = async () => {
    if (!ioForm.clientName.trim() || !ioForm.id.trim() || !(+ioForm.amount > 0)) return;
    setIoSaving(true);
    const rec = {
      type: "payment_received",
      title: `Payment — ${ioForm.clientName.trim()}`,
      clientName: ioForm.clientName.trim(),
      contractOrder: ioForm.id.trim(),
      amount: +ioForm.amount,
      currency: ioForm.currency,
      paymentDate: ioForm.paymentDate || new Date().toISOString().slice(0, 10),
      paymentStatus: ioForm.paymentStatus,
      notes: ioForm.notes || "",
      details: {
        confirmationNo: ioForm.id.trim(),
        invoice: ioForm.invoice.trim(),
        invoiceUrl: ioForm.invoiceUrl || "",
        invoiceName: ioForm.invoiceName || "",
        manual: true,
      },
    };
    const ok = await addExpense(rec);
    setIoSaving(false);
    if (ok !== false) { setIoForm(null); setSection("payment"); }
  };

  // ── Insertion Order (name + mandatory file) ──
  const openAddInsertion = () => setInsForm({ clientName: "", paymentDate: todayStr, fileUrl: "", fileName: "", notes: "" });
  const updIns = (k, v) => setInsForm((f) => ({ ...f, [k]: v }));
  const uploadInsertionFile = async (file) => {
    if (!file) return;
    setInsUploading(true);
    try { const r = await uploadFile(file); if (r) setInsForm((f) => ({ ...f, fileUrl: r.url, fileName: r.name })); }
    catch (e) { alert("Could not upload the file: " + (e.message || "unknown error")); }
    finally { setInsUploading(false); }
  };
  const saveInsertion = async () => {
    if (!insForm.clientName.trim() || !insForm.fileUrl) return; // file is mandatory
    setInsSaving(true);
    const rec = {
      type: "insertion_order",
      title: insForm.clientName.trim(),
      clientName: insForm.clientName.trim(),
      paymentDate: insForm.paymentDate || new Date().toISOString().slice(0, 10),
      notes: insForm.notes || "",
      details: { invoiceUrl: insForm.fileUrl, invoiceName: insForm.fileName, manual: true },
    };
    const ok = await addExpense(rec);
    setInsSaving(false);
    if (ok !== false) { setInsForm(null); setSection("insertion"); }
  };

  const openDetail = (rec) => { setDetail(rec); setDetailEdit({ paymentStatus: rec.paymentStatus || "", notes: rec.notes || "", paymentDate: rec.paymentDate || "" }); };
  const saveDetailEdit = async () => {
    setSaving(true);
    await updateExpense({ ...detail, paymentStatus: detailEdit.paymentStatus, notes: detailEdit.notes, paymentDate: detailEdit.paymentDate || detail.paymentDate });
    setSaving(false);
    setDetail(null);
  };
  const doDelete = async () => { const id = confirmDel.id; setConfirmDel(null); setDetail(null); await deleteExpense(id); };

  const currentList = (section === "insertion" ? applyFilters(io) : section === "payment" ? applyFilters(pay) : section === "salary" ? applyFilters(sal) : section === "company" ? applyFilters(co) : [])
    .slice()
    .sort((a, b) => { const av = a.paymentDate || a.createdAt || "", bv = b.paymentDate || b.createdAt || ""; return av < bv ? 1 : av > bv ? -1 : 0; });

  const exportRows = () => {
    if (section === "insertion") {
      const rows = [["Name", "Date", "File"]];
      applyFilters(io).forEach((e) => { const d = e.details || {}; rows.push([e.clientName || e.title, e.paymentDate, d.invoiceUrl || ""]); });
      return rows;
    }
    if (section === "payment") {
      const rows = [["Client", "ID / Conf. No", "Amount", "Currency", "Date", "Status", "Invoice", "Notes"]];
      applyFilters(pay).forEach((e) => { const d = e.details || {}; rows.push([e.clientName, d.confirmationNo || e.contractOrder, e.amount ?? "", e.currency, e.paymentDate, e.paymentStatus, d.invoiceUrl || d.invoice || "", e.notes]); });
      return rows;
    }
    if (section === "salary") {
      const rows = [["Name", "Type", "Employee ID", "Department", "Month", "Year", "Fixed", "Incentives", "Deductions", "Final Salary", "Payment Date", "Status"]];
      applyFilters(sal).forEach((e) => { const d = e.details || {}; rows.push([d.employeeName || d.freelancerName || e.clientName, e.category === "Freelancer" ? "Freelancer" : "Employee", d.employeeId, d.department || d.company, d.month, d.year, d.fixed ?? "", d.incentiveTotal ?? "", d.deductionTotal ?? "", e.amount ?? "", e.paymentDate, e.paymentStatus]); });
      return rows;
    }
    const rows = [["Title", "Category", "Vendor", "Amount", "Currency", "Payment Date", "Method", "Status", "Notes"]];
    applyFilters(co).forEach((e) => rows.push([e.title || e.clientName, e.category, (e.details || {}).vendor, e.amount ?? "", e.currency, e.paymentDate, e.paymentMethod, e.paymentStatus, e.notes]));
    return rows;
  };
  const doExportCSV = () => downloadCSV(`successviews-${section}-${new Date().toISOString().slice(0, 10)}.csv`, exportRows());
  const doExportExcel = () => {
    const rows = exportRows();
    const html = `<html xmlns:x="urn:schemas-microsoft-com:office:excel"><head><meta charset="utf-8"></head><body><table border="1">${rows.map((r, i) => `<tr>${r.map((c) => `<${i === 0 ? "th" : "td"}>${expEsc(c)}</${i === 0 ? "th" : "td"}>`).join("")}</tr>`).join("")}</table></body></html>`;
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([html], { type: "application/vnd.ms-excel" }));
    a.download = `successviews-${section}-${new Date().toISOString().slice(0, 10)}.xls`;
    a.click();
  };

  // Unified accountant-friendly ledger — every record, one sheet, one row each.
  const ledgerKind = (e) =>
    e.type === "payment_received" ? "Payment Received (Income)"
      : e.type === "insertion_order" ? "Insertion Order (Doc)"
        : e.type === "salary" && e.category === "Freelancer" ? "Freelancer Payment"
          : e.type === "salary" ? "Employee Salary"
            : "Company Expense";
  const ledgerFlow = (e) => (e.type === "payment_received" ? "IN" : e.type === "insertion_order" ? "" : "OUT");
  const fullLedgerRows = (list) => {
    const rows = [["Date", "Month", "Flow", "Type", "Category", "Name / Title", "Reference", "Amount", "Currency", "Method", "Status", "Notes"]];
    [...list]
      .sort((a, b) => (expMonthKey(b) + (b.paymentDate || "")).localeCompare(expMonthKey(a) + (a.paymentDate || "")))
      .forEach((e) => {
        const d = e.details || {};
        rows.push([
          e.paymentDate || "", expMonthLabel(expMonthKey(e)), ledgerFlow(e), ledgerKind(e),
          e.category || "", d.employeeName || d.freelancerName || d.companyName || e.title || e.clientName || "",
          d.confirmationNo || e.contractOrder || d.employeeId || "", e.amount ?? "", e.currency || "INR",
          e.paymentMethod || "", e.paymentStatus || "", (e.notes || "").replace(/\n/g, " "),
        ]);
      });
    return rows;
  };
  const doExportLedger = (fmt) => {
    const rows = fullLedgerRows(applyFilters(expenses));
    const stamp = new Date().toISOString().slice(0, 10);
    if (fmt === "csv") { downloadCSV(`successviews-full-ledger-${stamp}.csv`, rows); return; }
    const html = `<html xmlns:x="urn:schemas-microsoft-com:office:excel"><head><meta charset="utf-8"></head><body><table border="1">${rows.map((r, i) => `<tr>${r.map((c) => `<${i === 0 ? "th" : "td"}>${expEsc(c)}</${i === 0 ? "th" : "td"}>`).join("")}</tr>`).join("")}</table></body></html>`;
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([html], { type: "application/vnd.ms-excel" }));
    a.download = `successviews-full-ledger-${stamp}.xls`;
    a.click();
  };

  const downloadSlip = (rec) => {
    const d = rec.details || {};
    const inr = (v) => (v === null || v === undefined || v === "" ? "0" : Number(v).toLocaleString("en-IN"));
    const rows = [];
    rows.push(`<tr><td>Fixed Salary</td><td class="r">₹ ${inr(d.fixed)}/-</td></tr>`);
    (d.incentives || []).forEach((i) => rows.push(`<tr><td>Incentive — ${expEsc(i.reason || "")}</td><td class="r pos">+ ₹ ${inr(i.amount)}/-</td></tr>`));
    (d.deductions || []).forEach((i) => rows.push(`<tr><td>Deduction — ${expEsc(i.reason || "")}</td><td class="r neg">- ₹ ${inr(i.amount)}/-</td></tr>`));
    const logoHtml = logo ? `<img src="${logo}" style="max-height:54px;max-width:220px;object-fit:contain;" />` : `<h2 style="margin:0;color:#162B55;">SuccessViews</h2>`;
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>Salary Slip — ${expEsc(d.employeeName || "")}</title>
<style>*{box-sizing:border-box;font-family:Arial,Helvetica,sans-serif;-webkit-print-color-adjust:exact;print-color-adjust:exact;}
body{margin:0;padding:32px;color:#1f2937;}.wrap{max-width:640px;margin:0 auto;border:1px solid #e5e7eb;border-radius:12px;padding:28px;}
.head{display:flex;justify-content:space-between;align-items:center;border-bottom:2px solid #eef2f7;padding-bottom:14px;margin-bottom:16px;}
.title{font-size:18px;font-weight:800;color:#162B55;}h3{margin:2px 0 0;font-size:13px;color:#64748b;font-weight:600;}
table{width:100%;border-collapse:collapse;margin-top:8px;font-size:14px;}td{padding:9px 4px;border-bottom:1px solid #f1f5f9;}
.r{text-align:right;}.pos{color:#15803d;}.neg{color:#b91c1c;}.net{font-size:17px;font-weight:800;color:#162B55;border-top:2px solid #e5e7eb;}
.meta{display:flex;gap:24px;flex-wrap:wrap;font-size:13px;color:#475569;margin-bottom:6px;}.meta b{color:#0f172a;}</style></head>
<body><div class="wrap">
<div class="head"><div>${logoHtml}</div><div style="text-align:right;"><div class="title">Salary Slip</div><h3>${expEsc(d.month || "")} ${expEsc(String(d.year || ""))}</h3></div></div>
<div class="meta"><div><b>${expEsc(d.employeeName || rec.clientName || "")}</b></div><div>ID: ${expEsc(d.employeeId || "")}</div><div>Dept: ${expEsc(d.department || "")}</div></div>
<div class="meta"><div>Payment Date: <b>${expEsc(rec.paymentDate || "")}</b></div><div>Status: <b>${expEsc(rec.paymentStatus || "Paid")}</b></div></div>
<table>${rows.join("")}<tr class="net"><td>Net Salary Paid</td><td class="r net">₹ ${inr(d.finalSalary != null ? d.finalSalary : rec.amount)}/-</td></tr></table>
<p style="margin-top:18px;font-size:11px;color:#94a3b8;text-align:center;">Computer-generated salary slip · SuccessViews</p>
</div><script>window.onload=function(){setTimeout(function(){window.focus();window.print();},350);};</script></body></html>`;
    const w = window.open("", "_blank");
    if (!w) return;
    w.document.open(); w.document.write(html); w.document.close();
  };

  const sectionBtn = (key, label) => (
    <button className={`sv-period-btn ${section === key ? "sv-period-btn--active" : ""}`} onClick={() => setSection(key)}>{label}</button>
  );
  const metaCell = (l, v) => (<div className="sv-meta-cell"><div className="sv-meta-label">{l}</div><div className="sv-meta-value">{v}</div></div>);

  return (
    <div className="sv-tab">
      <h2 className="sv-tab-title">Expense</h2>

      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", background: "#F1F5F9", border: "1px solid #E9EEF4", borderRadius: 12, padding: 5, marginBottom: 4 }}>
        {[
          { key: "dashboard", label: "Dashboard", icon: <LayoutDashboard size={16} />, count: null, color: "#2563EB" },
          { key: "insertion", label: "Insertion Orders", icon: <Receipt size={16} />, count: io.length, color: "#0EA5E9" },
          { key: "payment", label: "Payment Received", icon: <CheckCircle2 size={16} />, count: pay.length, color: "#16A34A" },
          { key: "salary", label: "Salary & Freelancer", icon: <UsersIcon size={16} />, count: sal.length, color: "#F59E0B" },
          { key: "company", label: "Company Expenses", icon: <Building2 size={16} />, count: co.length, color: "#8B5CF6" },
        ].map((t) => {
          const active = section === t.key;
          return (
            <button key={t.key} onClick={() => setSection(t.key)}
              style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "9px 16px", borderRadius: 9, border: "none", cursor: "pointer",
                background: active ? "#fff" : "transparent", color: active ? "#162B55" : "#64748B", fontWeight: active ? 800 : 600, fontSize: 13.5,
                boxShadow: active ? `0 1px 3px rgba(15,23,42,0.10)` : "none", borderBottom: active ? `2px solid ${t.color}` : "2px solid transparent", transition: "all .15s" }}>
              <span style={{ color: t.color, display: "inline-flex" }}>{t.icon}</span>{t.label}
              {t.count != null && <span style={{ fontSize: 11, fontWeight: 800, minWidth: 20, textAlign: "center", padding: "1px 7px", borderRadius: 999,
                background: active ? `${t.color}1A` : "#E2E8F0", color: active ? t.color : "#64748B" }}>{t.count}</span>}
            </button>
          );
        })}
      </div>

      {/* ── Monthly dashboard (CA review) ── */}
      {section === "dashboard" && (() => {
        const dashKeys = fYear ? monthKeys.filter((k) => k.slice(0, 4) === fYear) : monthKeys;
        const curOK = (e) => !dashCur || (e.currency || "INR") === dashCur;
        const scope = dashKeys.flatMap((k) => monthMap[k]).filter(curOK);
        const isFree = (e) => e.type === "salary" && e.category === "Freelancer";
        const ordersBag = expBag(scope.filter((e) => e.type === "payment_received"));
        const empSalBag = expBag(scope.filter((e) => e.type === "salary" && !isFree(e)));
        const freeBag = expBag(scope.filter(isFree));
        const coBag = expBag(scope.filter((e) => e.type === "company"));
        const outBag = {}; [empSalBag, freeBag, coBag].forEach((b) => Object.entries(b).forEach(([c, v]) => outBag[c] = (outBag[c] || 0) + v));
        const bagSum = (bag) => Object.values(bag).reduce((a, b) => a + b, 0);
        const barData = dashKeys.slice().reverse().map((k) => {
          const list = monthMap[k].filter(curOK);
          const n = (f) => list.filter(f).reduce((s, e) => s + (Number(e.amount) || 0), 0);
          const cur = (f) => [...new Set(list.filter(f).map((e) => e.currency).filter(Boolean))].join(" / ");
          const fPay = (e) => e.type === "payment_received", fEmp = (e) => e.type === "salary" && !isFree(e), fCo = (e) => e.type === "company";
          return {
            label: (EXP_MONTHS[(+k.slice(5, 7)) - 1] || "").slice(0, 3) + " " + k.slice(2, 4),
            Orders: n(fPay), OrdersCur: cur(fPay),
            Salary: n(fEmp), SalaryCur: cur(fEmp),
            Freelancer: n(isFree), FreelancerCur: cur(isFree),
            Company: n(fCo), CompanyCur: cur(fCo),
          };
        });
        const donutData = [
          { name: "Employee Salary", value: bagSum(empSalBag), color: "#16A34A" },
          { name: "Freelancer", value: bagSum(freeBag), color: "#F59E0B" },
          { name: "Company", value: bagSum(coBag), color: "#8B5CF6" },
        ].filter((d) => d.value > 0);
        const card = (label, bag, color, sub) => (
          <div style={{ flex: "1 1 160px", minWidth: 160, background: "#fff", border: "1px solid #E9EEF4", borderTop: `3px solid ${color}`, borderRadius: 12, padding: "14px 16px" }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#64748B", textTransform: "uppercase", letterSpacing: 0.3 }}>{label}</div>
            <div style={{ fontSize: 17, fontWeight: 800, color: "#0f172a", marginTop: 4 }}>{expFmtBag(bag)}</div>
            {sub && <div style={{ fontSize: 11, color: "#94A3B8", marginTop: 2 }}>{sub}</div>}
          </div>
        );
        return (
        <div className="sv-card">
          <div className="sv-flex sv-justify-between" style={{ alignItems: "center", flexWrap: "wrap", gap: 10 }}>
            <h3 style={{ margin: 0 }}>Financial Summary{fYear ? ` · ${fYear}` : ""}{dashCur ? ` · ${dashCur}` : ""}</h3>
            <div className="sv-flex sv-gap-sm" style={{ flexWrap: "wrap", alignItems: "center" }}>
              <select className="sv-select" value={fYear} onChange={(e) => setFYear(e.target.value)} style={{ maxWidth: 130 }}>
                <option value="">All years</option>
                {years.map((y) => <option key={y} value={y}>{y}</option>)}
              </select>
              <select className="sv-select" value={dashCur} onChange={(e) => setDashCur(e.target.value)} style={{ maxWidth: 150 }} title="Charts calculate only the selected currency">
                <option value="">All currencies</option>
                {[...new Set(expenses.map((e) => e.currency).filter(Boolean))].sort().map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
              <button className="sv-btn sv-btn--ghost" onClick={() => doExportLedger("csv")} disabled={expenses.length === 0}><Download size={15} /> Full Ledger CSV</button>
              <button className="sv-btn sv-btn--ghost" onClick={() => doExportLedger("excel")} disabled={expenses.length === 0}><Download size={15} /> Full Ledger Excel</button>
            </div>
          </div>

          {monthKeys.length === 0 ? (
            <p className="sv-text-muted" style={{ padding: "24px 0", textAlign: "center" }}>No financial records yet. Records are created automatically when a Confirmation Order is downloaded, a salary is released, or a freelancer is paid — and you can add company expenses manually. If this stays empty after those actions, run <b>supabase/expenses-fix.sql</b> once in Supabase.</p>
          ) : (<>
            <div className="sv-flex sv-gap-sm" style={{ flexWrap: "wrap", margin: "14px 0 4px" }}>
              {card("Payments Received (Income)", ordersBag, "#3B82F6", "Client payments")}
              {card("Employee Salary", empSalBag, "#16A34A", "Released payroll")}
              {card("Freelancer Payments", freeBag, "#F59E0B", "Contractors")}
              {card("Company Expenses", coBag, "#8B5CF6", "Operating costs")}
              {card("Total Outflow", outBag, "#DC2626", "Salary + Freelancer + Company")}
            </div>

            {/* Charts */}
            <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 2fr) minmax(0, 1fr)", gap: 16, marginTop: 18, alignItems: "stretch" }}>
              <div style={{ background: "#fff", border: "1px solid #E9EEF4", borderRadius: 12, padding: "14px 16px", display: "flex", flexDirection: "column", minHeight: 320 }}>
                <div style={{ fontSize: 13, fontWeight: 800, color: "#162B55", marginBottom: 8 }}>Income vs Outflow by Month</div>
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={barData} barGap={2} barCategoryGap="22%">
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="label" tick={TICK} /><YAxis tick={TICK} width={64} tickFormatter={(v) => v >= 1000 ? (v / 1000) + "k" : v} />
                    <Tooltip {...TT} formatter={(v, n, item) => [`${Number(v).toLocaleString("en-IN")} ${(item && item.payload && item.payload[(item.dataKey || "") + "Cur"]) || ""}`.trim(), n]} />
                    <Legend {...LEG} />
                    <Bar dataKey="Orders" name="Payments Received" stackId="in" fill="#3B82F6" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="Salary" stackId="out" fill="#16A34A" />
                    <Bar dataKey="Freelancer" stackId="out" fill="#F59E0B" />
                    <Bar dataKey="Company" stackId="out" fill="#8B5CF6" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div style={{ background: "#fff", border: "1px solid #E9EEF4", borderRadius: 12, padding: "14px 16px", display: "flex", flexDirection: "column", minHeight: 320 }}>
                <div style={{ fontSize: 13, fontWeight: 800, color: "#162B55", marginBottom: 8 }}>Outflow Composition</div>
                {donutData.length === 0 ? (
                  <p className="sv-text-muted" style={{ fontSize: 12, textAlign: "center", margin: "auto" }}>No outflow yet.</p>
                ) : (
                  <ResponsiveContainer width="100%" height={260}>
                    <PieChart>
                      <Pie data={donutData} dataKey="value" nameKey="name" innerRadius={52} outerRadius={84} paddingAngle={2}>
                        {donutData.map((d, i) => <Cell key={i} fill={d.color} />)}
                      </Pie>
                      <Tooltip {...TT} formatter={(v, n) => [Number(v).toLocaleString("en-IN"), n]} />
                      <Legend {...LEG} />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>

            <div style={{ overflowX: "auto", marginTop: 12 }}>
              <table className="sv-table">
                <thead>
                  <tr><th>Month</th><th>Payments Received</th><th>Employee Salary</th><th>Freelancer</th><th>Company Exp.</th><th>Total Outflow</th><th>Txns</th></tr>
                </thead>
                <tbody>
                  {dashKeys.map((k) => {
                    const list = monthMap[k].filter(curOK);
                    const rev = expBag(list.filter((e) => e.type === "payment_received"));
                    const emp = expBag(list.filter((e) => e.type === "salary" && !isFree(e)));
                    const fre = expBag(list.filter(isFree));
                    const co = expBag(list.filter((e) => e.type === "company"));
                    const tot = {}; [emp, fre, co].forEach((b) => Object.entries(b).forEach(([c, v]) => tot[c] = (tot[c] || 0) + v));
                    return (
                      <tr key={k}>
                        <td style={{ fontWeight: 700 }}>{expMonthLabel(k)}</td>
                        <td style={{ color: "#2563EB", fontWeight: 600 }}>{expFmtBag(rev)}</td>
                        <td style={{ color: "#16A34A", fontWeight: 600 }}>{expFmtBag(emp)}</td>
                        <td style={{ color: "#B45309", fontWeight: 600 }}>{expFmtBag(fre)}</td>
                        <td style={{ color: "#7C3AED", fontWeight: 600 }}>{expFmtBag(co)}</td>
                        <td style={{ fontWeight: 700, color: "#DC2626" }}>{expFmtBag(tot)}</td>
                        <td>{list.length}</td>
                      </tr>
                    );
                  })}
                  <tr style={{ borderTop: "2px solid #E2E8F0", background: "#F8FAFC" }}>
                    <td style={{ fontWeight: 800 }}>Grand Total</td>
                    <td style={{ fontWeight: 800 }}>{expFmtBag(ordersBag)}</td>
                    <td style={{ fontWeight: 800 }}>{expFmtBag(empSalBag)}</td>
                    <td style={{ fontWeight: 800 }}>{expFmtBag(freeBag)}</td>
                    <td style={{ fontWeight: 800 }}>{expFmtBag(coBag)}</td>
                    <td style={{ fontWeight: 800, color: "#DC2626" }}>{expFmtBag(outBag)}</td>
                    <td style={{ fontWeight: 800 }}>{scope.length}</td>
                  </tr>
                </tbody>
              </table>
              <p className="sv-text-muted" style={{ fontSize: 11, marginTop: 8 }}>Amounts are grouped by their own currency (orders are often USD, salary/company INR) — no automatic conversion is applied. "Total Outflow" = Employee Salary + Freelancer + Company Expenses.</p>
            </div>
          </>)}
        </div>
        );
      })()}

      {/* ── List sections ── */}
      {section !== "dashboard" && (
        <div className="sv-card">
          <div className="sv-flex sv-justify-between" style={{ alignItems: "center", flexWrap: "wrap", gap: 10, marginBottom: 12 }}>
            <div>
              <h3 style={{ margin: 0 }}>{section === "insertion" ? "Insertion Orders" : section === "payment" ? "Payments Received" : section === "salary" ? "Salary & Freelancer Payments" : "SuccessViews Expenses"}</h3>
              <p className="sv-text-muted" style={{ fontSize: 12.5, margin: "2px 0 0" }}>
                {section === "insertion" ? "Insertion order documents — add a name and attach the order file." : section === "payment" ? "Client payments received (income) — reflected in the dashboard and charts." : section === "salary" ? "Auto-created when a salary is released or a freelancer is paid." : "Company operating expenses (manually added)."}
              </p>
            </div>
            <div className="sv-flex sv-gap-sm" style={{ flexWrap: "wrap" }}>
              <button className="sv-btn sv-btn--ghost" onClick={doExportCSV} disabled={currentList.length === 0}><Download size={15} /> CSV</button>
              <button className="sv-btn sv-btn--ghost" onClick={doExportExcel} disabled={currentList.length === 0}><Download size={15} /> Excel</button>
              {section === "insertion" && <button className="sv-btn sv-btn--primary" onClick={openAddInsertion}><Plus size={15} /> Add Insertion Order</button>}
              {section === "payment" && <button className="sv-btn" style={{ background: "#16A34A", color: "#fff", border: "none" }} onClick={() => openAddIO("Received")}><CheckCircle2 size={15} /> Add Payment Received</button>}
              {section === "company" && <button className="sv-btn sv-btn--primary" onClick={openAddCompany}><Plus size={15} /> Add Expense</button>}
            </div>
          </div>

          {/* Filters */}
          <div className="sv-flex sv-gap-sm" style={{ flexWrap: "wrap", marginBottom: 14 }}>
            <input className="sv-input" placeholder="Search…" value={search} onChange={(e) => setSearch(e.target.value)} style={{ minWidth: 200, flex: 1 }} />
            <select className="sv-select" value={fMonth} onChange={(e) => setFMonth(e.target.value)} style={{ maxWidth: 140 }}>
              <option value="">All months</option>
              {EXP_MONTHS.map((m, i) => <option key={m} value={String(i + 1).padStart(2, "0")}>{m}</option>)}
            </select>
            <select className="sv-select" value={fYear} onChange={(e) => setFYear(e.target.value)} style={{ maxWidth: 110 }}>
              <option value="">All years</option>
              {years.map((y) => <option key={y} value={y}>{y}</option>)}
            </select>
            <select className="sv-select" value={fCur} onChange={(e) => setFCur(e.target.value)} style={{ maxWidth: 120 }}>
              <option value="">Currency</option>
              {EXP_CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
            <select className="sv-select" value={fStatus} onChange={(e) => setFStatus(e.target.value)} style={{ maxWidth: 130 }}>
              <option value="">Status</option>
              {["Paid", "Pending", "Partial", "Overdue"].map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
            {section === "company" && (
              <select className="sv-select" value={fCat} onChange={(e) => setFCat(e.target.value)} style={{ maxWidth: 160 }}>
                <option value="">Category</option>
                {CO_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            )}
          </div>

          {/* Payments Received — total-received summary (currency-aware, like the Overview card) */}
          {section === "payment" && (
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 16 }}>
              <div style={{ flex: "1 1 220px", minWidth: 200, borderRadius: 12, padding: "16px 18px", background: "linear-gradient(135deg,#ECFDF5,#D1FAE5)", border: "1px solid #C9F7D8" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, color: "#047857", fontWeight: 700, fontSize: 12.5, textTransform: "uppercase", letterSpacing: 0.3 }}><Wallet size={16} /> Total Received</div>
                <div style={{ fontSize: 20, fontWeight: 800, color: "#065F46", marginTop: 6 }}>{expFmtBag(expBag(currentList))}</div>
              </div>
              <div style={{ flex: "1 1 160px", minWidth: 150, borderRadius: 12, padding: "16px 18px", background: "#fff", border: "1px solid #E9EEF4" }}>
                <div style={{ color: "#64748B", fontWeight: 700, fontSize: 12.5, textTransform: "uppercase", letterSpacing: 0.3 }}>Payments</div>
                <div style={{ fontSize: 20, fontWeight: 800, color: "#0f172a", marginTop: 6 }}>{currentList.length}</div>
              </div>
            </div>
          )}

          {currentList.length === 0 ? (
            <div style={{ textAlign: "center", padding: "38px 16px", color: "#64748B" }}>
              <div style={{ fontSize: 38 }}>{section === "insertion" ? "🧾" : section === "payment" ? "💰" : section === "salary" ? "👥" : "🏢"}</div>
              <p style={{ fontWeight: 700, color: "#334155", margin: "8px 0 2px" }}>No records</p>
              <p style={{ fontSize: 13, margin: 0 }}>{section === "insertion" ? "Add an insertion order (name + file)." : section === "payment" ? "Record your first payment received." : section === "company" ? "Add your first company expense." : "Records appear here automatically."}</p>
            </div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table className="sv-table sv-exp-table">
                {section === "insertion" && <thead><tr><th>Name</th><th>Date</th><th>File</th><th></th></tr></thead>}
                {section === "payment" && <thead><tr><th>Client</th><th>ID</th><th>Amount</th><th>Date</th><th>Invoice</th><th>Status</th><th></th></tr></thead>}
                {section === "salary" && <thead><tr><th>Name</th><th>Type</th><th>Dept</th><th>Month</th><th>Final Salary</th><th>Paid On</th><th>Status</th></tr></thead>}
                {section === "company" && <thead><tr><th>Title</th><th>Category</th><th>Vendor</th><th>Amount</th><th>Date</th><th>Status</th></tr></thead>}
                <tbody>
                  {currentList.map((e) => {
                    const d = e.details || {};
                    return (
                      <tr key={e.id} style={{ cursor: "pointer" }} onClick={() => openDetail(e)}>
                        {section === "insertion" && <>
                          <td style={{ fontWeight: 600 }}>{e.clientName || e.title || "—"}</td>
                          <td>{e.paymentDate ? fmtDate(e.paymentDate) : "—"}</td>
                          <td>{d.invoiceUrl ? <a href={d.invoiceUrl} target="_blank" rel="noreferrer" onClick={(ev) => ev.stopPropagation()} style={{ color: "#2563EB", display: "inline-flex", alignItems: "center", gap: 4 }}><FileText size={13} /> {d.invoiceName || "View file"}</a> : "—"}</td>
                          <td><button className="sv-icon-btn" title="Delete" style={{ color: "#DC2626" }} onClick={(ev) => { ev.stopPropagation(); setConfirmDel(e); }}><Trash2 size={15} /></button></td>
                        </>}
                        {section === "payment" && <>
                          <td style={{ fontWeight: 600 }}>{e.clientName || "—"}</td>
                          <td>{d.confirmationNo || e.contractOrder || "—"}</td>
                          <td style={{ fontWeight: 600, color: "#15803D" }}>{expMoney(e.amount, e.currency)}</td>
                          <td>{e.paymentDate ? fmtDate(e.paymentDate) : "—"}</td>
                          <td>{d.invoiceUrl ? <a href={d.invoiceUrl} target="_blank" rel="noreferrer" onClick={(ev) => ev.stopPropagation()} style={{ color: "#2563EB" }}>File</a> : (d.invoice || "—")}</td>
                          <td><span className={`sv-badge sv-badge--${(e.paymentStatus === "Received" ? "paid" : (e.paymentStatus || "pending")).toLowerCase()}`}>{e.paymentStatus || "Received"}</span></td>
                          <td><button className="sv-icon-btn" title="Delete" style={{ color: "#DC2626" }} onClick={(ev) => { ev.stopPropagation(); setConfirmDel(e); }}><Trash2 size={15} /></button></td>
                        </>}
                        {section === "salary" && (() => { const isFree = e.category === "Freelancer"; return <>
                          <td style={{ fontWeight: 600 }}>{d.employeeName || d.freelancerName || e.clientName || "—"}</td>
                          <td><span style={{ fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 999, color: isFree ? "#B45309" : "#15803D", background: isFree ? "#FEF3C7" : "#DCFCE7" }}>{isFree ? "Freelancer" : "Employee"}</span></td>
                          <td>{d.department || (isFree ? d.company : "") || "—"}</td><td>{d.month || "—"} {d.year || ""}</td>
                          <td>{expMoney(e.amount, e.currency)}</td>
                          <td>{e.paymentDate ? fmtDate(e.paymentDate) : "—"}</td>
                          <td><span className="sv-badge sv-badge--completed">{e.paymentStatus || "Paid"}</span></td>
                        </>; })()}
                        {section === "company" && <>
                          <td style={{ fontWeight: 600 }}>{e.title || e.clientName || "—"}</td>
                          <td>{e.category || "—"}</td><td>{d.vendor || "—"}</td>
                          <td>{expMoney(e.amount, e.currency)}</td>
                          <td>{e.paymentDate ? fmtDate(e.paymentDate) : "—"}</td>
                          <td><span className={`sv-badge sv-badge--${(e.paymentStatus || "paid").toLowerCase()}`}>{e.paymentStatus || "Paid"}</span></td>
                        </>}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── Detail modal ── */}
      {detail && (
        <div className="sv-modal-overlay" onClick={() => setDetail(null)}>
          <div className="sv-modal" style={{ maxWidth: 600, maxHeight: "88vh", display: "flex", flexDirection: "column" }} onClick={(ev) => ev.stopPropagation()}>
            <div className="sv-modal-header" style={{ flexShrink: 0 }}>
              <span className="sv-text-navy sv-font-800" style={{ fontSize: 16 }}>{detail.title || detail.clientName || "Record"}</span>
              <button className="sv-modal-close" onClick={() => setDetail(null)}>×</button>
            </div>
            <div style={{ overflowY: "auto", padding: "16px 20px" }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                {detail.type === "insertion_order" && (() => { const d = detail.details || {}; return [
                  ["Name", detail.clientName || detail.title || "—"], ["Date", detail.paymentDate ? fmtDate(detail.paymentDate) : "—"],
                  ["File", d.invoiceUrl ? <a href={d.invoiceUrl} target="_blank" rel="noreferrer" style={{ color: "#2563EB", display: "inline-flex", alignItems: "center", gap: 4 }}><FileText size={13} /> {d.invoiceName || "View file"}</a> : "—"],
                  ["Notes", detail.notes || "—"],
                ].map(([l, v]) => metaCell(l, v)); })()}
                {detail.type === "payment_received" && (() => { const d = detail.details || {}; return [
                  ["Client", detail.clientName || "—"], ["ID / Confirmation No", d.confirmationNo || detail.contractOrder || "—"],
                  ["Price", expMoney(detail.amount, detail.currency)], ["Currency", detail.currency || "—"],
                  ["Payment Date", detail.paymentDate ? fmtDate(detail.paymentDate) : "—"], ["Status", detail.paymentStatus || "—"],
                  ["Invoice", d.invoiceUrl ? <a href={d.invoiceUrl} target="_blank" rel="noreferrer" style={{ color: "#2563EB", display: "inline-flex", alignItems: "center", gap: 4 }}><FileText size={13} /> {d.invoiceName || "View file"}</a> : (d.invoice || "—")],
                ].map(([l, v]) => metaCell(l, v)); })()}
                {detail.type === "salary" && (() => { const d = detail.details || {}; return [
                  ["Employee", d.employeeName || detail.clientName], ["Employee ID", d.employeeId || "—"],
                  ["Department", d.department || "—"], ["Period", `${d.month || ""} ${d.year || ""}`],
                  ["Fixed", expMoney(d.fixed, "INR")], ["Incentives", expMoney(d.incentiveTotal, "INR")],
                  ["Deductions", expMoney(d.deductionTotal, "INR")], ["Final Salary", expMoney(detail.amount, "INR")],
                  ["Payment Date", detail.paymentDate ? fmtDate(detail.paymentDate) : "—"], ["Status", detail.paymentStatus || "Paid"],
                ].map(([l, v]) => metaCell(l, v)); })()}
                {detail.type === "company" && (() => { const d = detail.details || {}; return [
                  ["Title", detail.title || detail.clientName], ["Category", detail.category || "—"],
                  ["Vendor", d.vendor || "—"], ["Amount", expMoney(detail.amount, detail.currency)],
                  ["Payment Date", detail.paymentDate ? fmtDate(detail.paymentDate) : "—"], ["Method", detail.paymentMethod || "—"],
                  ["Status", detail.paymentStatus || "—"], ["Currency", detail.currency || "—"],
                ].map(([l, v]) => metaCell(l, v)); })()}
              </div>

              {/* Editable date + status + notes */}
              {detailEdit && (
                <div style={{ marginTop: 16, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                  <label style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 12.5, fontWeight: 600, color: "#475569" }}>Month / Date
                    <input className="sv-input" type="date" value={detailEdit.paymentDate || ""} onChange={(e) => setDetailEdit((s) => ({ ...s, paymentDate: e.target.value }))} />
                  </label>
                  <label style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 12.5, fontWeight: 600, color: "#475569" }}>Status
                    <select className="sv-select" value={detailEdit.paymentStatus} onChange={(e) => setDetailEdit((s) => ({ ...s, paymentStatus: e.target.value }))}>
                      {["", "Received", "Paid", "Pending", "Partial", "Overdue"].map((s) => <option key={s} value={s}>{s || "—"}</option>)}
                    </select>
                  </label>
                  <div style={{ gridColumn: "1 / -1" }}>
                    <label style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 12.5, fontWeight: 600, color: "#475569" }}>Notes / Remarks
                      <textarea className="sv-input" rows={3} value={detailEdit.notes} onChange={(e) => setDetailEdit((s) => ({ ...s, notes: e.target.value }))} style={{ resize: "vertical" }} />
                    </label>
                  </div>
                  <p className="sv-text-muted" style={{ fontSize: 11, gridColumn: "1 / -1", margin: 0 }}>Changing the date moves this record to that month across the dashboard and charts.</p>
                </div>
              )}
            </div>
            <div className="sv-flex sv-justify-between" style={{ padding: "12px 20px", borderTop: "1px solid #F1F5F9", flexShrink: 0, alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <button className="sv-btn sv-btn--danger" onClick={() => setConfirmDel(detail)}>Delete</button>
              <div className="sv-flex sv-gap-sm" style={{ flexWrap: "wrap" }}>
                {detail.type === "salary" && <button className="sv-btn sv-btn--ghost" onClick={() => downloadSlip(detail)}><FileText size={15} /> Download Slip</button>}
                {detail.type === "company" && <button className="sv-btn sv-btn--ghost" onClick={() => openEditCompany(detail)}>Edit</button>}
                <button className="sv-btn sv-btn--primary" onClick={saveDetailEdit} disabled={saving}>{saving ? "Saving…" : "Save"}</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Company add/edit modal ── */}
      {form && (
        <div className="sv-modal-overlay" onClick={() => setForm(null)}>
          <div className="sv-modal" style={{ maxWidth: 620, maxHeight: "88vh", display: "flex", flexDirection: "column" }} onClick={(ev) => ev.stopPropagation()}>
            <div className="sv-modal-header" style={{ flexShrink: 0 }}>
              <span className="sv-text-navy sv-font-800" style={{ fontSize: 16 }}>{isNew ? "Add Company Expense" : "Edit Expense"}</span>
              <button className="sv-modal-close" onClick={() => setForm(null)}>×</button>
            </div>
            <div style={{ overflowY: "auto", padding: "16px 20px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              <label style={lblS}>Expense Title *<input className="sv-input" value={form.title} onChange={(e) => updF("title", e.target.value)} placeholder="e.g. Office Rent — July" /></label>
              <label style={lblS}>Category
                <select className="sv-select" value={catMode === "custom" ? "__custom__" : form.category}
                  onChange={(e) => { if (e.target.value === "__custom__") { setCatMode("custom"); updF("category", ""); } else { setCatMode("list"); updF("category", e.target.value); } }}>
                  {CO_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                  <option value="__custom__">➕ Custom / type your own…</option>
                </select>
                {catMode === "custom" && <input className="sv-input" style={{ marginTop: 8 }} autoFocus value={form.category} onChange={(e) => updF("category", e.target.value)} placeholder="Type a custom category" />}
              </label>
              <label style={lblS}>Amount<input className="sv-input" type="number" value={form.amount} onChange={(e) => updF("amount", e.target.value)} placeholder="0.00" /></label>
              <label style={lblS}>Currency
                <select className="sv-select" value={form.currency} onChange={(e) => updF("currency", e.target.value)}>{EXP_CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}</select>
              </label>
              <label style={lblS}>Payment Date<input className="sv-input" type="date" value={form.paymentDate || ""} onChange={(e) => updF("paymentDate", e.target.value)} /></label>
              <label style={lblS}>Payment Method
                <select className="sv-select" value={form.paymentMethod} onChange={(e) => updF("paymentMethod", e.target.value)}><option value="">Select…</option>{EXP_METHODS.map((m) => <option key={m} value={m}>{m}</option>)}</select>
              </label>
              <label style={lblS}>Vendor<input className="sv-input" value={(form.details || {}).vendor || ""} onChange={(e) => updFDetail("vendor", e.target.value)} placeholder="Vendor / payee" /></label>
              <label style={lblS}>Payment Status
                <select className="sv-select" value={form.paymentStatus} onChange={(e) => updF("paymentStatus", e.target.value)}>{["Paid", "Pending", "Partial", "Overdue"].map((s) => <option key={s} value={s}>{s}</option>)}</select>
              </label>
              <div style={{ gridColumn: "1 / -1" }}>
                <label style={lblS}>Notes / Remarks<textarea className="sv-input" rows={3} value={form.notes} onChange={(e) => updF("notes", e.target.value)} style={{ resize: "vertical" }} /></label>
              </div>
            </div>
            <div className="sv-flex sv-justify-between" style={{ padding: "12px 20px", borderTop: "1px solid #F1F5F9", flexShrink: 0, alignItems: "center" }}>
              <span className="sv-text-muted" style={{ fontSize: 12 }}>* Title is required</span>
              <div className="sv-flex sv-gap-sm">
                <button className="sv-btn sv-btn--ghost" onClick={() => setForm(null)}>Cancel</button>
                <button className="sv-btn sv-btn--primary" onClick={saveCompany} disabled={saving || !form.title.trim()}>{saving ? "Saving…" : isNew ? "Add" : "Save"}</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Insertion Order (name + mandatory file) modal ── */}
      {insForm && (
        <div className="sv-modal-overlay" onClick={() => setInsForm(null)}>
          <div className="sv-modal" style={{ maxWidth: 520 }} onClick={(ev) => ev.stopPropagation()}>
            <div className="sv-modal-header">
              <span className="sv-text-navy sv-font-800" style={{ fontSize: 16 }}>Add Insertion Order</span>
              <button className="sv-modal-close" onClick={() => setInsForm(null)}>×</button>
            </div>
            <div style={{ padding: "16px 20px", display: "grid", gap: 14 }}>
              <label style={lblS}>Name *<input className="sv-input" value={insForm.clientName} onChange={(e) => updIns("clientName", e.target.value)} placeholder="Client / order name" /></label>
              <label style={lblS}>Date<input className="sv-input" type="date" value={insForm.paymentDate} onChange={(e) => updIns("paymentDate", e.target.value)} /></label>
              <label style={lblS}>Attach File *
                <div className="sv-flex sv-gap-sm" style={{ alignItems: "center", flexWrap: "wrap" }}>
                  <label className="sv-btn sv-btn--ghost" style={{ cursor: "pointer", margin: 0 }}>
                    <Plus size={14} /> {insUploading ? "Uploading…" : insForm.fileUrl ? "Replace file" : "Choose file"}
                    <input type="file" accept="image/*,application/pdf,.doc,.docx,.xls,.xlsx" style={{ display: "none" }} disabled={insUploading} onChange={(e) => uploadInsertionFile(e.target.files && e.target.files[0])} />
                  </label>
                  {insForm.fileUrl && <a href={insForm.fileUrl} target="_blank" rel="noreferrer" style={{ fontSize: 12.5, color: "#2563EB", display: "inline-flex", alignItems: "center", gap: 4 }}><FileText size={13} /> {insForm.fileName || "View file"}</a>}
                  {insForm.fileUrl && <button type="button" className="sv-chip-btn sv-chip-btn--red" onClick={() => setInsForm((f) => ({ ...f, fileUrl: "", fileName: "" }))}><X size={12} /> Remove</button>}
                </div>
              </label>
              <label style={lblS}>Notes / Remarks<textarea className="sv-input" rows={2} value={insForm.notes} onChange={(e) => updIns("notes", e.target.value)} style={{ resize: "vertical" }} /></label>
            </div>
            <div className="sv-flex sv-justify-between" style={{ padding: "12px 20px", borderTop: "1px solid #F1F5F9", alignItems: "center" }}>
              <span className="sv-text-muted" style={{ fontSize: 12 }}>* Name and an attached file are required</span>
              <div className="sv-flex sv-gap-sm">
                <button className="sv-btn sv-btn--ghost" onClick={() => setInsForm(null)}>Cancel</button>
                <button className="sv-btn sv-btn--primary" onClick={saveInsertion} disabled={insSaving || insUploading || !insForm.clientName.trim() || !insForm.fileUrl}>{insSaving ? "Saving…" : "Save"}</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Payment Received (income) modal ── */}
      {ioForm && (
        <div className="sv-modal-overlay" onClick={() => setIoForm(null)}>
          <div className="sv-modal" style={{ maxWidth: 640, maxHeight: "88vh", display: "flex", flexDirection: "column" }} onClick={(ev) => ev.stopPropagation()}>
            <div className="sv-modal-header" style={{ flexShrink: 0 }}>
              <span className="sv-text-navy sv-font-800" style={{ fontSize: 16 }}>Record Payment Received</span>
              <button className="sv-modal-close" onClick={() => setIoForm(null)}>×</button>
            </div>
            <div style={{ overflowY: "auto", padding: "16px 20px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              <label style={lblS}>Client Name *<input className="sv-input" value={ioForm.clientName} onChange={(e) => updIO("clientName", e.target.value)} placeholder="Client / company" /></label>
              <label style={lblS}>ID *<input className="sv-input" value={ioForm.id} onChange={(e) => updIO("id", e.target.value)} placeholder="ID / confirmation no" /></label>
              <label style={lblS}>Price *<input className="sv-input" type="number" value={ioForm.amount} onChange={(e) => updIO("amount", e.target.value)} placeholder="0.00" /></label>
              <label style={lblS}>Currency
                <select className="sv-select" value={ioForm.currency} onChange={(e) => updIO("currency", e.target.value)}>{EXP_CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}</select>
              </label>
              <label style={lblS}>Month / Date<input className="sv-input" type="date" value={ioForm.paymentDate} onChange={(e) => updIO("paymentDate", e.target.value)} /></label>
              <label style={lblS}>Status
                <select className="sv-select" value={ioForm.paymentStatus} onChange={(e) => updIO("paymentStatus", e.target.value)}>{["Received", "Pending", "Partial", "Overdue"].map((s) => <option key={s} value={s}>{s}</option>)}</select>
              </label>
              <label style={lblS}>Invoice No. / Link (optional)<input className="sv-input" value={ioForm.invoice} onChange={(e) => updIO("invoice", e.target.value)} placeholder="Invoice number or URL" /></label>
              <div />
              <div style={{ gridColumn: "1 / -1" }}>
                <label style={lblS}>Attach Invoice / File (optional)
                  <div className="sv-flex sv-gap-sm" style={{ alignItems: "center", flexWrap: "wrap" }}>
                    <label className="sv-btn sv-btn--ghost" style={{ cursor: "pointer", margin: 0 }}>
                      <Plus size={14} /> {ioUploading ? "Uploading…" : "Choose file"}
                      <input type="file" accept="image/*,application/pdf,.doc,.docx,.xls,.xlsx" style={{ display: "none" }} disabled={ioUploading} onChange={(e) => uploadInvoiceFile(e.target.files && e.target.files[0])} />
                    </label>
                    {ioForm.invoiceUrl && <a href={ioForm.invoiceUrl} target="_blank" rel="noreferrer" style={{ fontSize: 12.5, color: "#2563EB", display: "inline-flex", alignItems: "center", gap: 4 }}><FileText size={13} /> {ioForm.invoiceName || "View file"}</a>}
                    {ioForm.invoiceUrl && <button type="button" className="sv-chip-btn sv-chip-btn--red" onClick={() => setIoForm((f) => ({ ...f, invoiceUrl: "", invoiceName: "" }))}><X size={12} /> Remove</button>}
                  </div>
                </label>
              </div>
              <div style={{ gridColumn: "1 / -1" }}>
                <label style={lblS}>Notes / Remarks<textarea className="sv-input" rows={2} value={ioForm.notes} onChange={(e) => updIO("notes", e.target.value)} style={{ resize: "vertical" }} /></label>
              </div>
            </div>
            <div className="sv-flex sv-justify-between" style={{ padding: "12px 20px", borderTop: "1px solid #F1F5F9", flexShrink: 0, alignItems: "center" }}>
              <span className="sv-text-muted" style={{ fontSize: 12 }}>* Client name, ID and price required · any currency</span>
              <div className="sv-flex sv-gap-sm">
                <button className="sv-btn sv-btn--ghost" onClick={() => setIoForm(null)}>Cancel</button>
                <button className="sv-btn" style={{ background: "#16A34A", color: "#fff", border: "none" }} onClick={saveIO} disabled={ioSaving || ioUploading || !ioForm.clientName.trim() || !ioForm.id.trim() || !(+ioForm.amount > 0)}>{ioSaving ? "Saving…" : "Save"}</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Delete confirm ── */}
      {confirmDel && (
        <div className="sv-modal-overlay" onClick={() => setConfirmDel(null)}>
          <div className="sv-modal" style={{ maxWidth: 380 }} onClick={(ev) => ev.stopPropagation()}>
            <div className="sv-modal-header">
              <span className="sv-text-navy sv-font-800" style={{ fontSize: 15 }}>Delete record?</span>
              <button className="sv-modal-close" onClick={() => setConfirmDel(null)}>×</button>
            </div>
            <div style={{ padding: "16px 20px", fontSize: 13.5, color: "#475569" }}>
              This permanently removes <strong>{confirmDel.title || confirmDel.clientName || "this record"}</strong>. This cannot be undone.
            </div>
            <div className="sv-flex sv-justify-between" style={{ padding: "12px 20px", borderTop: "1px solid #F1F5F9" }}>
              <button className="sv-btn sv-btn--ghost" onClick={() => setConfirmDel(null)}>Cancel</button>
              <button className="sv-btn sv-btn--danger" onClick={doDelete}>Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const lblS = { display: "flex", flexDirection: "column", gap: 6, fontSize: 12.5, fontWeight: 600, color: "#475569" };

/* ───────────────────────────────────────────────────────────────
 * DesignsTab — Admin Design Management (Phase 1: project tracking).
 * Create/list/search magazine design projects, assign a designer,
 * drive the status workflow, and see live stats. File uploads,
 * the Designer dashboard, versioning, revisions, notifications and
 * the timeline come in later phases. Reuses existing .sv-* styles.
 * ──────────────────────────────────────────────────────────────*/
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
  "Admin Final Review": "Final Review", "Final Review": "Final Review",
  "Revision Required": "Sample Design",
  "Approved": "Completed", "Completed": "Completed",
};
const stepOf = (st) => STEP_ALIAS[st] || (STEP_KEYS.includes(st) ? st : "Draft");
const stepIndex = (st) => STEP_KEYS.indexOf(stepOf(st));
const DESIGN_STATUSES = STEP_KEYS;
const canonicalStage = (st) => stepOf(st);
const designProgress = (st) => { const i = stepIndex(st); return i < 0 ? 0 : Math.round((i / (STEP_KEYS.length - 1)) * 100); };
const designStatusStyle = (s) => { const st = STEPS.find((x) => x.key === stepOf(s)) || STEPS[0]; return { bg: st.color + "1A", fg: st.color }; };
const DESIGN_PRIORITIES = ["High", "Medium", "Low"];
const DESIGN_BLANK = { clientName: "", companyName: "", magazineName: "", edition: "", dueDate: "", priority: "Medium", assignedDesigner: "", assignedDesignerName: "", status: "Draft", instructions: "", internalNotes: "" };
const designPriorityStyle = (p) => ({
  "High": { bg: "#FEE2E2", fg: "#B91C1C" },
  "Medium": { bg: "#FEF3C7", fg: "#B45309" },
  "Low": { bg: "#DCFCE7", fg: "#15803D" },
}[p] || { bg: "#F1F5F9", fg: "#475569" });

// Message screenshots: stored in activity.meta as a JSON array of URLs (or a bare URL for old rows).
const parseMsgImgs = (meta) => { const mm = meta || ""; if (!mm) return []; if (mm[0] === "[") { try { return (JSON.parse(mm) || []).filter(Boolean); } catch (e) { return []; } } return /^https?:\/\//.test(mm) ? [mm] : []; };

export function DesignsTab({ designProjects = [], addDesignProject, updateDesignProject, deleteDesignProject, employees = [], designFiles = [], uploadDesignFile, deleteDesignFile, designActivity = [], changeProjectStatus, requestRevision, designWork = [], saveDesignWork, pushNotification, captureExpense, designArchive = [], saveDesignArchive, addProjectComment, uploadMessageImage, designExtra = { drafts: [], folders: {}, links: {}, fileFolders: {}, acks: {} }, releaseDesign, acknowledgeDesign, addDesignFolder, deleteDesignFolder, addDesignLink, deleteDesignLink }) {
  const [search, setSearch] = useState("");
  const [fStatus, setFStatus] = useState("");
  const [fPriority, setFPriority] = useState("");
  const [fDesigner, setFDesigner] = useState("");
  const [sort, setSort] = useState("updated");
  const [view, setView] = useState("projects");
  const [payDesigner, setPayDesigner] = useState("");
  const [paySearch, setPaySearch] = useState("");
  const [payOpen, setPayOpen] = useState(null); // project id whose cost sheet is open
  const [payComment, setPayComment] = useState("");
  const [flowAsk, setFlowAsk] = useState(null); // { message, onYes, onNo }
  const [showArchived, setShowArchived] = useState(false);
  const [menuOpen, setMenuOpen] = useState(null);
  const [archiveAsk, setArchiveAsk] = useState(null); // { project, mode }
  const [archiveReason, setArchiveReason] = useState("");
  const [openKeys, setOpenKeys] = useState(() => new Set());
  const [fmSearch, setFmSearch] = useState("");
  const [convoText, setConvoText] = useState("");
  const [convoImgs, setConvoImgs] = useState([]);   // pending screenshots (multiple)
  const [convoSending, setConvoSending] = useState(false);
  const addConvoFiles = (files) => { const imgs = [...(files || [])].filter((f) => f && f.type && f.type.startsWith("image/")); if (imgs.length) setConvoImgs((p) => [...p, ...imgs]); };
  const onConvoPaste = (e) => { const items = (e.clipboardData && e.clipboardData.items) || []; const files = []; for (const it of items) { if (it.kind === "file") { const f = it.getAsFile(); if (f && f.type.startsWith("image/")) files.push(f); } } if (files.length) { e.preventDefault(); addConvoFiles(files); } };
  const removeConvoImg = (i) => setConvoImgs((p) => p.filter((_, idx) => idx !== i));
  const ask = (message, onYes, onNo) => setFlowAsk({ message, onYes, onNo });
  const [form, setForm] = useState(null);
  const [isNew, setIsNew] = useState(false);
  const [detail, setDetail] = useState(null);
  const [confirmDel, setConfirmDel] = useState(null);
  const [saving, setSaving] = useState(false);
  const [uploadKind, setUploadKind] = useState("draft");
  const [uploading, setUploading] = useState(false);
  const [revComment, setRevComment] = useState("");
  const fileRef = useRef(null);
  const KIND_LABELS = { draft: "Draft", reference: "Client Draft", images: "Images", sample: "Sample", cp: "Cover Page", cs: "Cover Story", index: "Index Page", magazine: "Magazine", revised: "Revised", final: "Final" };
  const fmtSize = (b) => (!b ? "" : b < 1024 ? b + " B" : b < 1048576 ? (b / 1024).toFixed(0) + " KB" : (b / 1048576).toFixed(1) + " MB");
  const [dragOver, setDragOver] = useState(false);
  const [uploadFolder, setUploadFolder] = useState(""); // target custom folder id
  const [newFolder, setNewFolder] = useState("");
  const [openFolders, setOpenFolders] = useState({}); // collapsed by default
  const toggleFolder = (id) => setOpenFolders((o) => ({ ...o, [id]: !o[id] }));
  const [linkLabel, setLinkLabel] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const isDraftFile = (id) => (designExtra.drafts || []).includes(id);
  // ── Designer file updates: anything the designer has submitted (released) that is newer than the
  //    admin's last acknowledgement for that project stays flagged NEW until the admin acknowledges. ──
  const isDesignerFile = (f) => !!f.uploadedByName && f.uploadedByName !== "Admin";
  const ackTsFor = (pid) => (designExtra.acks || {})[pid] || "";
  const newFilesFor = (pid) => {
    const ack = ackTsFor(pid);
    return (designFiles || []).filter((f) => f.projectId === pid && isDesignerFile(f) && !isDraftFile(f.id) && String(f.createdAt || "") > String(ack));
  };
  const isNewFile = (f) => isDesignerFile(f) && !isDraftFile(f.id) && String(f.createdAt || "") > String(ackTsFor(f.projectId));
  const uploadOne = async (file) => { if (!file || !detail) return; setUploading(true); await uploadDesignFile(detail.id, uploadKind, file, "Admin", uploadFolder); setUploading(false); };
  // Auto-expand any folder that holds an unacknowledged NEW designer file, so updated files are
  // never hidden inside a collapsed folder when the admin opens the project.
  useEffect(() => {
    if (!detail) return;
    const ff = designExtra.fileFolders || {};
    const openIds = {};
    newFilesFor(detail.id).forEach((f) => { const fid = ff[f.id]; if (fid) openIds[fid] = true; });
    if (Object.keys(openIds).length) setOpenFolders((o) => ({ ...o, ...openIds }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [detail && detail.id, designExtra.acks, designFiles.length]);
  const onUploadFile = async (e) => { const files = [...(e.target.files || [])]; for (const fl of files) await uploadOne(fl); if (fileRef.current) fileRef.current.value = ""; setUploadFolder(""); };
  const onDropFiles = async (e) => { e.preventDefault(); setDragOver(false); const files = [...((e.dataTransfer && e.dataTransfer.files) || [])]; for (const fl of files) await uploadOne(fl); setUploadFolder(""); };

  const todayISO = new Date().toISOString().slice(0, 10);
  const isOverdue = (p) => p.dueDate && p.dueDate < todayISO && p.status !== "Completed";

  const archivedIds = new Set((designArchive || []).map((a) => a.id));
  const archivedProjects = designProjects.filter((p) => archivedIds.has(p.id));
  // KPI counts reflect only active projects — archived ones are excluded so the
  // stat cards always agree with the project list below them.
  const activeProjects = designProjects.filter((p) => !archivedIds.has(p.id));
  const bucketCount = (name) => activeProjects.filter((p) => canonicalStage(p.status) === name).length;
  const stats = {
    total: activeProjects.length,
    draft: bucketCount("Draft"),
    sample: bucketCount("Sample Design"),
    review: bucketCount("Admin Review") + bucketCount("Client Review"),
    index: bucketCount("Index Approval"),
    final: bucketCount("Final Magazine") + bucketCount("Admin Final Review"),
    completed: bucketCount("Completed"),
    overdue: activeProjects.filter(isOverdue).length,
  };
  const filtered = designProjects.filter((p) => {
    if (archivedIds.has(p.id)) return false;
    const q = search.trim().toLowerCase();
    if (q && !`${p.clientName} ${p.companyName} ${p.magazineName} ${p.edition} ${p.assignedDesignerName}`.toLowerCase().includes(q)) return false;
    return true;
  });
  const PRI_ORDER = { High: 0, Medium: 1, Low: 2 };
  const sorted = [...filtered].sort((a, b) => {
    if (sort === "due") return (a.dueDate || "9999-99-99").localeCompare(b.dueDate || "9999-99-99");
    if (sort === "client") return (a.clientName || "").localeCompare(b.clientName || "");
    if (sort === "priority") return (PRI_ORDER[a.priority] ?? 9) - (PRI_ORDER[b.priority] ?? 9);
    return String(b.updatedAt || b.createdAt || "").localeCompare(String(a.updatedAt || a.createdAt || ""));
  });

  const upd = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const openAdd = () => { setForm({ ...DESIGN_BLANK }); setIsNew(true); };
  const openEdit = (p) => { setForm({ ...p }); setIsNew(false); setDetail(null); };
  const setDesigner = (id) => {
    const e = employees.find((x) => x.id === id);
    setForm((f) => ({ ...f, assignedDesigner: id, assignedDesignerName: e ? e.name : "" }));
  };
  const save = async () => {
    if (!form.clientName.trim()) return;
    setSaving(true);
    const ok = isNew ? await addDesignProject(form) : await updateDesignProject(form);
    setSaving(false);
    if (ok !== false) setForm(null);
  };
  const changeStatus = async (p, status) => { await changeProjectStatus(p, status, "admin", "Admin"); setDetail((d) => (d && d.id === p.id ? { ...d, status } : d)); };
  const stepMeta = (pid) => { const m = {}; (designActivity || []).filter((a) => a.projectId === pid).slice().sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt))).forEach((a) => { const k = a.type === "created" ? "Draft" : (a.type === "status" ? stepOf(a.meta) : null); if (k) m[k] = { actor: a.actorName, time: a.createdAt ? new Date(a.createdAt).toLocaleString() : "" }; }); return m; };
  const advance = async (p, stage) => { releaseDesign && await releaseDesign(p.id, "admin"); await changeProjectStatus(p, stage, "admin", "Admin"); pushNotification && pushNotification(`${p.clientName}: workflow → ${stage}`); setDetail((d) => (d ? { ...d, status: stage } : d)); };
  const sendBack = async (p, stage) => { const note = revComment.trim(); if (!note) return; await addProjectComment(p.id, "admin", "Admin", "🔄 Changes requested: " + note); await changeProjectStatus(p, stage, "admin", "Admin"); pushNotification && pushNotification(`Changes requested on ${p.clientName} — sent to the designer.`, "rejected"); setRevComment(""); setDetail((d) => (d ? { ...d, status: stage } : d)); };
  const sendConvo = async () => {
    if ((!convoText.trim() && convoImgs.length === 0) || !detail) return;
    setConvoSending(true);
    const urls = [];
    for (const f of convoImgs) { if (uploadMessageImage) { const u = await uploadMessageImage(detail.id, f); if (u) urls.push(u); } }
    const ok = await addProjectComment(detail.id, "admin", "Admin", convoText, urls);
    setConvoSending(false);
    if (ok !== false) { setConvoText(""); setConvoImgs([]); }
  };
  const doDelete = async () => { const id = confirmDel.id; setConfirmDel(null); setDetail(null); await deleteDesignProject(id); };
  const doArchive = () => {
    if (!archiveAsk) return;
    const p = archiveAsk.project;
    saveDesignArchive && saveDesignArchive([...(designArchive || []).filter((a) => a.id !== p.id), { id: p.id, reason: archiveReason.trim(), by: "Admin", at: new Date().toISOString() }]);
    pushNotification && pushNotification(`Project archived: ${p.clientName}${archiveReason.trim() ? ` — ${archiveReason.trim()}` : ""}`);
    setArchiveAsk(null); setArchiveReason(""); setDetail(null);
  };
  const restoreProject = (id) => saveDesignArchive && saveDesignArchive((designArchive || []).filter((a) => a.id !== id));
  const permDelete = async (id) => { saveDesignArchive && saveDesignArchive((designArchive || []).filter((a) => a.id !== id)); await deleteDesignProject(id); };

  const dMoney = (n) => "₹" + Number(n || 0).toLocaleString("en-IN");
  /* ── Accounting model (admin-controlled) ── */
  const WSTATUSES = ["Pending", "In Progress", "Under Review", "Completed", "Hold", "Approved"];
  const normPay = (ps) => (ps === "Approved" ? "Ready for Payment" : (!ps || ps === "Unpaid") ? "Pending" : ps);
  const payWorkStyle = (s) => (s === "Paid" ? { bg: "#DCFCE7", fg: "#15803D" } : s === "Ready for Payment" ? { bg: "#DBEAFE", fg: "#1D4ED8" } : s === "Rejected" ? { bg: "#FEE2E2", fg: "#B91C1C" } : { bg: "#FEF3C7", fg: "#B45309" });
  const wStatusStyle = (s) => ({ "Completed": { bg: "#DCFCE7", fg: "#15803D" }, "Approved": { bg: "#D1FAE5", fg: "#047857" }, "In Progress": { bg: "#DBEAFE", fg: "#1D4ED8" }, "Under Review": { bg: "#EDE9FE", fg: "#6D28D9" }, "Hold": { bg: "#FEE2E2", fg: "#B91C1C" } }[s] || { bg: "#F1F5F9", fg: "#64748B" });
  const withHist = (x, entry) => ({ ...x, history: [...(x.history || []), entry], updatedAt: new Date().toISOString() });
  const captureWorkPaid = (w) => {
    if (!captureExpense) return;
    const today = new Date().toISOString().slice(0, 10);
    captureExpense({
      type: "salary", sourceKey: `designwork:${w.id}`,
      title: `Designer — ${w.designerName} · ${w.name}`, category: "Designer Payment", clientName: w.clientName || w.designerName,
      paymentStatus: "Paid", paymentDate: today, amount: w.amount || 0, currency: "INR", paymentMethod: "Designer Payment",
      details: { designerId: w.designerId, designerName: w.designerName, client: w.clientName, magazine: w.magazine, work: w.name, notes: w.notes, finalSalary: w.amount || 0 },
    });
  };
  // Admin sets the WORK status (Pending → … → Approved). Yes/No confirmed.
  const setWorkStatus = (w, status) => ask(`Set work status of “${w.name}” to “${status}”?`, () => {
    const now = new Date().toISOString();
    saveDesignWork && saveDesignWork((designWork || []).map((x) => (x.id === w.id ? withHist({ ...x, workStatus: status }, { at: now, by: "Admin", action: `Work status → ${status}`, reason: payComment.trim() }) : x)));
    pushNotification && pushNotification(`${w.designerName}: “${w.name}” work status → ${status}`);
    setPayComment("");
  });
  // Payment lifecycle: Pending → Ready for Payment → Paid (or Rejected). Yes/No confirmed.
  const payTransition = (w, to, verb) => ask(`${verb} the payment for “${w.name}” (${dMoney(w.amount)})?`, () => {
    const now = new Date().toISOString();
    saveDesignWork && saveDesignWork((designWork || []).map((x) => (x.id === w.id ? withHist({ ...x, payStatus: to, paidDate: to === "Paid" ? now.slice(0, 10) : x.paidDate }, { at: now, by: "Admin", action: `Payment → ${to}`, reason: payComment.trim() }) : x)));
    pushNotification && pushNotification(`Payment ${to.toLowerCase()} — ${w.designerName}: ${w.name} (${dMoney(w.amount)})`);
    if (to === "Paid") captureWorkPaid(w);
    setPayComment("");
  });
  const sumWork = (arr, f = () => true) => arr.filter(f).reduce((a, w) => a + (w.amount || 0), 0);
  const isDue = (w) => normPay(w.payStatus) !== "Paid" && normPay(w.payStatus) !== "Rejected";
  // Only count costing for projects that still exist and aren't archived/deleted —
  // orphaned work from a removed project must not linger in the KPIs, badge or filters.
  const liveProjectIds = new Set((designProjects || []).filter((p) => !archivedIds.has(p.id)).map((p) => p.id));
  const liveWork = (designWork || []).filter((w) => liveProjectIds.has(w.projectId));
  const payKpi = { total: sumWork(liveWork), pending: sumWork(liveWork, (w) => normPay(w.payStatus) === "Pending"), ready: sumWork(liveWork, (w) => normPay(w.payStatus) === "Ready for Payment"), paid: sumWork(liveWork, (w) => normPay(w.payStatus) === "Paid") };
  const payDue = liveWork.filter((w) => normPay(w.payStatus) === "Pending").length;

  const statCard = (label, value, accent) => (
    <div className="sv-kpi-card" style={{ "--kpi-accent": accent || "#64748B" }}>
      <span className="sv-kpi-bar" />
      <div className="sv-kpi-num">{value}</div>
      <div className="sv-kpi-lbl">{label}</div>
    </div>
  );
  const badge = (text, st) => <span style={{ display: "inline-block", fontSize: 11.5, fontWeight: 700, padding: "3px 10px", borderRadius: 999, background: st.bg, color: st.fg }}>{text}</span>;
  const metaCell = (l, v) => (<div className="sv-meta-cell"><div className="sv-meta-label">{l}</div><div className="sv-meta-value">{v || "—"}</div></div>);
  const field = (label, node) => (<label style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 12.5, fontWeight: 600, color: "#475569" }}>{label}{node}</label>);

  return (
    <div className="sv-tab">
      {!detail && (<>
      <h2 className="sv-tab-title">Designs</h2>

      <div className="sv-dsn-tabs">
        {[["projects", "Projects", <FolderOpen size={16} />], ["payments", "Designer Payments", <Wallet size={16} />], ["final", "Final Magazines", <BookOpen size={16} />]].map(([k, l, ic]) => (
          <button key={k} className={`sv-dsn-tab${view === k ? " is-active" : ""}`} onClick={() => setView(k)}>
            <span className="sv-dsn-tab-ic">{ic}</span>{l}{k === "payments" && payDue > 0 && <span className="sv-dsn-tab-badge">{payDue}</span>}
          </button>
        ))}
      </div>

      {view === "payments" && (() => {
        const q = paySearch.trim().toLowerCase();
        const live = (designProjects || []).filter((p) => !archivedIds.has(p.id));
        const itemsFor = (pid) => (designWork || []).filter((w) => w.projectId === pid && (!payDesigner || w.designerId === payDesigner));
        const totalFor = (pid) => itemsFor(pid).reduce((a, w) => a + (Number(w.amount) || 0), 0);
        const rows = live.filter((p) => (!payDesigner || p.assignedDesigner === payDesigner) && (itemsFor(p.id).length > 0) && (!q || `${p.clientName} ${p.magazineName} ${p.companyName} ${p.edition} ${p.assignedDesignerName}`.toLowerCase().includes(q)));
        const payAgg = (pid) => {
          const its = itemsFor(pid); if (!its.length) return { label: "No costs", bg: "#F1F5F9", fg: "#94A3B8" };
          const ps = its.map((w) => normPay(w.payStatus));
          if (ps.every((x) => x === "Paid")) return { label: "Paid", ...payWorkStyle("Paid") };
          if (ps.some((x) => x === "Pending")) return { label: `${ps.filter((x) => x === "Pending").length} pending`, ...payWorkStyle("Pending") };
          if (ps.some((x) => x === "Ready for Payment")) return { label: "Ready to pay", ...payWorkStyle("Ready for Payment") };
          if (ps.some((x) => x === "Rejected")) return { label: "Has rejected", ...payWorkStyle("Rejected") };
          return { label: "—", bg: "#F1F5F9", fg: "#94A3B8" };
        };
        const openP = live.find((p) => p.id === payOpen) || null;
        const openItems = openP ? itemsFor(openP.id).slice().sort((a, b) => String(b.createdAt || b.date).localeCompare(String(a.createdAt || a.date))) : [];
        const designers = [...new Set(liveWork.map((w) => w.designerId))];
        return (
          <>
            <div className="sv-sal-kpis" style={{ gridTemplateColumns: "repeat(4,1fr)" }}>
              <div className="sv-sal-kpi"><span className="sv-sal-kpi-ic" style={{ background: "rgba(139,92,246,.12)", color: "#7C3AED" }}><Palette size={18} /></span><div><div className="sv-sal-kpi-v">{dMoney(payKpi.total)}</div><div className="sv-sal-kpi-l">Total work value</div></div></div>
              <div className="sv-sal-kpi"><span className="sv-sal-kpi-ic" style={{ background: "rgba(245,158,11,.12)", color: "#D97706" }}><FileText size={18} /></span><div><div className="sv-sal-kpi-v">{dMoney(payKpi.pending)}</div><div className="sv-sal-kpi-l">Pending approval</div></div></div>
              <div className="sv-sal-kpi"><span className="sv-sal-kpi-ic" style={{ background: "rgba(37,99,235,.1)", color: "#2563EB" }}><Wallet size={18} /></span><div><div className="sv-sal-kpi-v">{dMoney(payKpi.ready)}</div><div className="sv-sal-kpi-l">Ready for payment</div></div></div>
              <div className="sv-sal-kpi"><span className="sv-sal-kpi-ic" style={{ background: "rgba(34,197,94,.1)", color: "#16A34A" }}><CheckCircle2 size={18} /></span><div><div className="sv-sal-kpi-v">{dMoney(payKpi.paid)}</div><div className="sv-sal-kpi-l">Paid to designers</div></div></div>
            </div>
            <div className="sv-card">
              <div className="sv-flex sv-justify-between sv-items-center" style={{ flexWrap: "wrap", gap: 10, marginBottom: 12 }}>
                <div><h3 style={{ margin: 0 }}>Designer Costing &amp; Payments</h3><p className="sv-text-muted" style={{ fontSize: 12.5, margin: "2px 0 0" }}>Review submitted costs, control work status, and run each payment: Pending → Ready for Payment → Paid.</p></div>
                <div className="sv-flex sv-gap-2" style={{ flexWrap: "wrap" }}>
                  <div className="sv-mailids-search"><SearchIcon size={14} /><input placeholder="Search client / edition / designer…" value={paySearch} onChange={(e) => setPaySearch(e.target.value)} /></div>
                  <select className="sv-select" value={payDesigner} onChange={(e) => setPayDesigner(e.target.value)} style={{ maxWidth: 180 }}>
                    <option value="">All designers</option>{designers.map((id) => { const nm = (designWork || []).find((w) => w.designerId === id)?.designerName || id; return <option key={id} value={id}>{nm}</option>; })}
                  </select>
                </div>
              </div>
              {rows.length === 0 ? (
                <div className="sv-leave-empty"><FileText size={26} /><span>No costs logged yet{q ? " for this search" : ""}. Designers add costs from their “Client Work” tab.</span></div>
              ) : (
                <div className="sv-erp-scroll">
                  <table className="sv-erp-table">
                    <thead><tr>{["Client", "Edition", "Designer", "Project Status", "Total Value", "Payment", "Manage"].map((h) => <th key={h}>{h}</th>)}</tr></thead>
                    <tbody>
                      {rows.map((p) => { const st = designStatusStyle(p.status); const agg = payAgg(p.id); const n = itemsFor(p.id).length; return (
                        <tr key={p.id}>
                          <td><div className="sv-text-navy sv-font-700" style={{ fontSize: 13 }}>{p.clientName}</div><div className="sv-text-muted" style={{ fontSize: 11 }}>{p.magazineName || p.companyName || "—"}</div></td>
                          <td className="sv-text-muted" style={{ fontSize: 12.5 }}>{p.edition || "—"}</td>
                          <td className="sv-text-muted" style={{ fontSize: 12.5 }}>{p.assignedDesignerName || "—"}</td>
                          <td>{badge(stepOf(p.status), st)}</td>
                          <td><span className="sv-text-navy sv-font-700">{dMoney(totalFor(p.id))}</span> <span className="sv-text-muted" style={{ fontSize: 11 }}>· {n} item{n !== 1 ? "s" : ""}</span></td>
                          <td><span className="sv-erp-chip" style={{ background: agg.bg, color: agg.fg }}>{agg.label}</span></td>
                          <td><button className="sv-btn sv-btn--sm sv-btn--primary" onClick={() => { setPayOpen(p.id); setPayComment(""); }}>Review / Manage</button></td>
                        </tr>
                      ); })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {openP && (
              <div className="sv-modal-overlay" onClick={() => setPayOpen(null)}>
                <div className="sv-modal" style={{ maxWidth: 760, maxHeight: "90vh", display: "flex", flexDirection: "column" }} onClick={(e) => e.stopPropagation()}>
                  <div className="sv-modal-header" style={{ flexShrink: 0 }}>
                    <span className="sv-text-navy sv-font-800" style={{ fontSize: 16 }}>{openP.clientName} · Costing</span>
                    <button className="sv-modal-close" onClick={() => setPayOpen(null)}>×</button>
                  </div>
                  <div style={{ overflowY: "auto", padding: "16px 20px" }}>
                    <p className="sv-text-muted" style={{ fontSize: 12, marginTop: 0 }}>{openP.magazineName || "—"}{openP.edition ? ` · ${openP.edition}` : ""} · {openP.assignedDesignerName || "—"} · Total {dMoney(totalFor(openP.id))}</p>
                    <label className="sv-team-ctl" style={{ marginBottom: 12 }}><span>Comment / reason (attached to your next action)</span><input className="sv-input" value={payComment} onChange={(e) => setPayComment(e.target.value)} placeholder="Optional note for the audit trail…" /></label>
                    {openItems.length === 0 ? <p className="sv-text-muted" style={{ fontSize: 12.5 }}>No cost items yet.</p> : (
                      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                        {openItems.map((w) => { const ps = normPay(w.payStatus); return (
                          <div key={w.id} className="sv-erp-item" style={{ alignItems: "stretch", flexDirection: "column", gap: 8 }}>
                            <div className="sv-flex sv-justify-between sv-items-center" style={{ gap: 8, flexWrap: "wrap" }}>
                              <div style={{ minWidth: 0 }}>
                                <div className="sv-erp-item-top"><span className="sv-erp-item-name">{w.name}</span><span className="sv-erp-item-amt">{dMoney(w.amount)}</span></div>
                                <div className="sv-erp-item-sub">{badge(ps, payWorkStyle(ps))} {w.notes ? <span className="sv-text-muted">· {w.notes}</span> : null}</div>
                              </div>
                              {w.proofUrl ? <a className="sv-btn sv-btn--sm sv-btn--ghost" href={w.proofUrl} target="_blank" rel="noreferrer">Proof</a> : null}
                            </div>
                            <div className="sv-flex sv-gap-2" style={{ flexWrap: "wrap", alignItems: "center" }}>
                              <span className="sv-text-muted" style={{ fontSize: 11.5 }}>Work status</span>
                              <select className="sv-select" value={w.workStatus || "Under Review"} onChange={(e) => setWorkStatus(w, e.target.value)} style={{ maxWidth: 160, padding: "5px 8px", fontSize: 12.5 }}>
                                {WSTATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                              </select>
                              <span style={{ flex: 1 }} />
                              {ps === "Pending" && <button className="sv-pay-btn sv-pay-btn--approve" onClick={() => payTransition(w, "Ready for Payment", "Approve")}>✓ Approve → Ready</button>}
                              {ps === "Ready for Payment" && <button className="sv-pay-btn sv-pay-btn--paid" onClick={() => payTransition(w, "Paid", "Mark paid")}>₹ Mark Paid</button>}
                              {ps === "Rejected" && <button className="sv-pay-btn sv-pay-btn--approve" onClick={() => payTransition(w, "Pending", "Re-open")}>↺ Re-open</button>}
                              {ps !== "Paid" && ps !== "Rejected" && <button className="sv-pay-btn sv-pay-btn--reject" onClick={() => payTransition(w, "Rejected", "Reject")}>✕ Reject</button>}
                              {ps === "Paid" && <span className="sv-erp-chip" style={{ ...payWorkStyle("Paid") }}>Paid {w.paidDate || ""}</span>}
                            </div>
                            {(w.history || []).length > 0 && (
                              <details className="sv-erp-audit">
                                <summary>Audit trail ({(w.history || []).length})</summary>
                                <div className="sv-erp-audit-list">
                                  {(w.history || []).slice().reverse().map((h, i) => (
                                    <div key={i} className="sv-erp-audit-row"><span className="sv-erp-audit-dot" /><div><b>{h.action}</b> · {h.by}{h.reason ? ` — ${h.reason}` : ""}<div className="sv-text-muted" style={{ fontSize: 10.5 }}>{h.at ? new Date(h.at).toLocaleString() : ""}{h.from != null ? ` · ${dMoney(h.from)} → ${dMoney(h.to)}` : ""}</div></div></div>
                                  ))}
                                </div>
                              </details>
                            )}
                          </div>
                        ); })}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </>
        );
      })()}

      {view === "final" && (() => {
        // Only the three deliverable groups the admin cares about here.
        const FINAL_GROUPS = [["Draft", ["draft"]], ["Final CP/CS", ["cp", "cs"]], ["Final Magazine", ["magazine"]]];
        const FINAL_KINDS = FINAL_GROUPS.flatMap(([, ks]) => ks);
        const toggle = (k) => setOpenKeys((prev) => { const n = new Set(prev); n.has(k) ? n.delete(k) : n.add(k); return n; });
        const q = fmSearch.trim().toLowerCase();
        const live = designProjects.filter((p) => !archivedIds.has(p.id));
        const clients = [...new Set(live.map((p) => p.clientName))].filter((c) => !q || c.toLowerCase().includes(q) || live.some((p) => p.clientName === c && `${p.magazineName} ${p.companyName}`.toLowerCase().includes(q)));
        const dl = (fr) => { const isImg = /\.(png|jpe?g|svg|gif|webp)$/i.test(fr.fileName); return (
          <div key={fr.id} className="sv-fm-file">
            {isImg ? <img src={fr.fileUrl} alt="" /> : <span className="sv-fm-file-ic"><FileText size={15} /></span>}
            <div style={{ minWidth: 0, flex: 1 }}><div className="sv-fm-file-name">{fr.fileName}</div><div className="sv-fm-file-sub">v{fr.version} · {fr.uploadedByName} · {fr.createdAt ? fmtDate(fr.createdAt) : ""}</div></div>
            <a className="sv-btn sv-btn--sm sv-btn--ghost" href={fr.fileUrl} target="_blank" rel="noreferrer">Open</a>
            <a className="sv-btn sv-btn--sm sv-btn--ghost" href={fr.fileUrl} download={fr.fileName}><Download size={13} /></a>
          </div>
        ); };
        return (
          <div className="sv-card">
            <div className="sv-flex sv-justify-between" style={{ alignItems: "center", flexWrap: "wrap", gap: 10, marginBottom: 12 }}>
              <div><h3 style={{ margin: 0 }}>Final Magazines</h3><p className="sv-text-muted" style={{ fontSize: 12.5, margin: "2px 0 0" }}>All project files organised by client → project. Everything downloadable.</p></div>
              <div className="sv-mailids-search"><SearchIcon size={14} /><input placeholder="Search client / project…" value={fmSearch} onChange={(e) => setFmSearch(e.target.value)} /></div>
            </div>
            {clients.length === 0 ? <div className="sv-leave-empty"><FileText size={26} /><span>No files yet.</span></div> : clients.map((c) => {
              const cProjects = live.filter((p) => p.clientName === c && (!q || c.toLowerCase().includes(q) || `${p.magazineName} ${p.companyName}`.toLowerCase().includes(q)));
              const ck = `c:${c}`; const cOpen = openKeys.has(ck);
              const cFiles = designFiles.filter((fx) => cProjects.some((p) => p.id === fx.projectId) && FINAL_KINDS.includes(fx.kind)).length;
              return (
                <div key={c} className="sv-fm-client">
                  <button className="sv-fm-folder" onClick={() => toggle(ck)}><span className={`sv-fm-caret${cOpen ? " open" : ""}`}>▸</span>📁 <b>{c}</b><span className="sv-fm-count">{cProjects.length} project{cProjects.length !== 1 ? "s" : ""} · {cFiles} file{cFiles !== 1 ? "s" : ""}</span></button>
                  {cOpen && cProjects.map((p) => {
                    const pk = `p:${p.id}`; const pOpen = openKeys.has(pk);
                    const pFiles = designFiles.filter((fx) => fx.projectId === p.id && FINAL_KINDS.includes(fx.kind));
                    return (
                      <div key={p.id} className="sv-fm-project">
                        <button className="sv-fm-folder sv-fm-folder--sub" onClick={() => toggle(pk)}><span className={`sv-fm-caret${pOpen ? " open" : ""}`}>▸</span>📂 {p.magazineName || "Untitled"}{p.companyName ? ` · ${p.companyName}` : ""}<span className="sv-fm-count">{pFiles.length} file{pFiles.length !== 1 ? "s" : ""}</span></button>
                        {pOpen && (pFiles.length === 0 ? <p className="sv-text-muted" style={{ fontSize: 12, margin: "4px 0 8px 26px" }}>No Draft, Final CP/CS or Final Magazine files yet.</p> : FINAL_GROUPS.map(([label, kinds]) => {
                          const fs = pFiles.filter((fx) => kinds.includes(fx.kind)).sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
                          if (!fs.length) return null;
                          return <div key={label} className="sv-fm-kind"><div className="sv-fm-kind-label">{label} ({fs.length})</div>{fs.map(dl)}</div>;
                        }))}
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        );
      })()}

      {view === "projects" && (<>
      {/* Stats — stage-based, auto-updating */}
      <div className="sv-designs-kpis">
        {statCard("Total Projects", stats.total, "#244A86")}
        {statCard("Draft", stats.draft, "#F59E0B")}
        {statCard("Sample Design", stats.sample, "#8B5CF6")}
        {statCard("In Review", stats.review, "#0EA5E9")}
        {statCard("Index Approval", stats.index, "#F97316")}
        {statCard("Final Magazine", stats.final, "#10B981")}
        {statCard("Completed", stats.completed, "#22C55E")}
        {statCard("Overdue", stats.overdue, "#EF4444")}
      </div>

      <div className="sv-card">
        <div className="sv-flex sv-justify-between" style={{ alignItems: "center", flexWrap: "wrap", gap: 10, marginBottom: 14 }}>
          <div>
            <h3 style={{ margin: 0 }}>Client Projects</h3>
            <p className="sv-text-muted" style={{ fontSize: 12.5, margin: "2px 0 0" }}>Track every magazine design project in one place.</p>
          </div>
          <div className="sv-flex sv-gap-sm">
            {archivedProjects.length > 0 && <button className={`sv-btn sv-btn--outline${showArchived ? " sv-btn--danger" : ""}`} onClick={() => setShowArchived((v) => !v)}>{showArchived ? "← Back to Projects" : `Archived (${archivedProjects.length})`}</button>}
            <button className="sv-btn sv-btn--primary" onClick={openAdd}><Plus size={15} /> New Project</button>
          </div>
        </div>

        {/* Filters */}
        <div className="sv-flex sv-gap-sm" style={{ flexWrap: "wrap", marginBottom: 14 }}>
          <input className="sv-input" placeholder="Search client / company / magazine / designer…" value={search} onChange={(e) => setSearch(e.target.value)} style={{ minWidth: 220, flex: 1 }} />
          <select className="sv-select" value={sort} onChange={(e) => setSort(e.target.value)} style={{ maxWidth: 180 }}>
            <option value="updated">Recently updated</option>
            <option value="due">Due date</option>
            <option value="client">Client name</option>
            <option value="priority">Priority</option>
          </select>
        </div>

        {!showArchived && (filtered.length === 0 ? (
          <div style={{ textAlign: "center", padding: "40px 16px", color: "#64748B" }}>
            <div style={{ fontSize: 38 }}><Palette size={40} /></div>
            <p style={{ fontWeight: 700, color: "#334155", margin: "8px 0 2px" }}>No design projects yet</p>
            <p style={{ fontSize: 13, margin: "0 0 14px" }}>Create your first client project to start tracking.</p>
            <button className="sv-btn sv-btn--primary" onClick={openAdd}><Plus size={15} /> New Project</button>
          </div>
        ) : (
          <div className="sv-dsn-grid">
            {sorted.map((p) => {
              const st = designStatusStyle(p.status);
              const pct = designProgress(p.status);
              const files = designFiles.filter((x) => x.projectId === p.id).length;
              const od = isOverdue(p);
              const newCount = newFilesFor(p.id).length;
              return (
                <div key={p.id} className="sv-dsn-card" onClick={() => setDetail(p)} style={{ borderLeft: `4px solid ${domainColor(p.companyName).solid}`, ...(newCount ? { boxShadow: "0 0 0 2px #FDE68A inset" } : {}) }}>
                  <div className="sv-dsn-card-top">
                    <div style={{ minWidth: 0 }}>
                      <div className="sv-dsn-client">{p.clientName}</div>
                      {p.companyName ? <span className="sv-domain-chip" style={{ background: domainColor(p.companyName).bg, color: domainColor(p.companyName).fg }}><span className="sv-domain-dot" style={{ background: domainColor(p.companyName).solid }} />{p.companyName}</span> : <div className="sv-dsn-sub">—</div>}
                    </div>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                      {newCount > 0 && <span title={`${newCount} new file(s) from the designer`} style={{ fontSize: 10.5, fontWeight: 800, color: "#B45309", background: "#FEF3C7", padding: "2px 8px", borderRadius: 999 }}>🆕 {newCount} new</span>}
                      {badge(p.priority, designPriorityStyle(p.priority))}
                    </span>
                  </div>
                  <div className="sv-dsn-mag">{p.magazineName || "Untitled magazine"}{p.edition ? ` · ${p.edition}` : ""}</div>
                  <div className="sv-dsn-stage-row">{badge(p.status, st)}<span className="sv-dsn-pct">{pct}%</span></div>
                  <div className="sv-dsn-prog"><span style={{ width: `${pct}%`, background: st.fg }} /></div>
                  <div className="sv-dsn-meta">
                    <span title="Designer">👤 {p.assignedDesignerName || "Unassigned"}</span>
                    <span className={od ? "sv-dsn-over" : ""}>📅 {p.dueDate ? fmtDate(p.dueDate) : "No due date"}{od ? " ⚠" : ""}</span>
                    <span>📎 {files} file{files !== 1 ? "s" : ""}</span>
                  </div>
                  <div className="sv-dsn-actions">
                    <button className="sv-chip-btn sv-chip-btn--violet" onClick={(e) => { e.stopPropagation(); setDetail(p); }}>Open project</button>
                    <span className="sv-dsn-menu-wrap" onClick={(e) => e.stopPropagation()}>
                      <button className="sv-chip-btn sv-chip-btn--gray" onClick={() => setMenuOpen(menuOpen === p.id ? null : p.id)}>•••</button>
                      {menuOpen === p.id && (
                        <div className="sv-dsn-menu" onMouseLeave={() => setMenuOpen(null)}>
                          <button onClick={() => { setMenuOpen(null); openEdit(p); }}>Edit</button>
                          <button onClick={() => { setMenuOpen(null); setArchiveReason(""); setArchiveAsk({ project: p, mode: "archive" }); }}>Archive</button>
                          <button className="sv-dsn-menu-del" onClick={() => { setMenuOpen(null); setArchiveReason(""); setArchiveAsk({ project: p, mode: "delete" }); }}>Delete</button>
                        </div>
                      )}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        ))}
        {showArchived && (
          <div className="sv-dsn-grid" style={{ marginTop: 14 }}>
            {archivedProjects.map((p) => (
              <div key={p.id} className="sv-dsn-card" style={{ opacity: .85 }}>
                <div className="sv-dsn-card-top"><div style={{ minWidth: 0 }}><div className="sv-dsn-client">{p.clientName}</div><div className="sv-dsn-sub">{p.companyName || "—"}</div></div><span className="sv-badge sv-badge--rejected">Archived</span></div>
                <div className="sv-dsn-mag">{p.magazineName || "Untitled"}{p.edition ? ` · ${p.edition}` : ""}</div>
                <div className="sv-dsn-meta">{(designArchive.find((a) => a.id === p.id) || {}).reason ? <span>Reason: {(designArchive.find((a) => a.id === p.id) || {}).reason}</span> : <span className="sv-mailids-muted">No reason given</span>}</div>
                <div className="sv-dsn-actions">
                  <button className="sv-chip-btn sv-chip-btn--green" onClick={() => restoreProject(p.id)}>Restore</button>
                  <button className="sv-chip-btn sv-chip-btn--red" onClick={() => setConfirmDel(p)}>Delete permanently</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      </>)}
      </>)}

      {/* ── Full-page project workspace ── */}
      {detail && (() => {
        const sc = designStatusStyle(detail.status);
        const stg = stepOf(detail.status);
        const ci = stepIndex(detail.status);
        const lg = stepMeta(detail.id);
        const draftSent = detail.status === "Draft Sent";
        const isDone = stg === "Completed";
        const pct = isDone ? 100 : Math.round(((draftSent ? 1 : ci) / (STEPS.length - 1)) * 100);
        const pf = (designFiles || []).filter((f) => f.projectId === detail.id);
        const has = (k) => pf.some((f) => f.kind === k);
        const hasDraft = has("draft") || has("reference") || has("images");
        const la = (designActivity || []).filter((a) => a.projectId === detail.id).reduce((m, a) => (a.createdAt > m ? a.createdAt : m), "");
        const allActs = (designActivity || []).filter((a) => a.projectId === detail.id).slice().sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)));
        const lastAct = allActs[allActs.length - 1];
        const changeAlert = lastAct && lastAct.type === "message" && /changes requested/i.test(lastAct.comment || "") ? lastAct : null;
        const OWNER = {
          "Draft": ["Admin", "Send the client draft & images to the designer"],
          "Sample Design": ["Designer", "Designer prepares & submits the sample design"],
          "Client Review": ["Admin", "Review the sample with the client, then approve or request changes"],
          "Final CP/CS": ["Designer", "Designer submits the Cover Page + Cover Story"],
          "Index Page": ["Admin", "Provide the index page so the designer can proceed"],
          "Magazine": ["Designer", "Designer submits the full magazine layout"],
          "Final Review": ["Admin", "Do the final review, then mark the project complete"],
          "Completed": ["—", "Project complete — final files delivered"],
        };
        const own = draftSent ? ["Designer", "Designer reviews the draft & starts the sample"] : (OWNER[stg] || ["—", ""]);
        let primary = null;
        if (detail.status === "Draft" && hasDraft) primary = { label: "Send to Designer", tone: "ok", onClick: () => ask("Send the draft to the designer now?", () => advance(detail, "Draft Sent")) };
        else if (stg === "Client Review" && has("sample")) primary = { label: "Approve Sample", tone: "ok", onClick: () => ask("Approve the sample and move to Final CP/CS?", () => advance(detail, "Final CP/CS")) };
        else if (stg === "Final CP/CS" && has("cp") && has("cs")) primary = { label: "Approve CP/CS", tone: "ok", onClick: () => ask("Approve the Cover Page & Cover Story and move to Index Page?", () => advance(detail, "Index Page")) };
        else if (stg === "Magazine" && has("magazine")) primary = { label: "Approve Magazine", tone: "ok", onClick: () => ask("Approve the magazine and move to Final Review?", () => advance(detail, "Final Review")) };
        else if (stg === "Final Review") primary = { label: "Complete Project", tone: "ok", onClick: () => ask("Mark this project Completed?", () => advance(detail, "Completed")) };
        const A = ({ onClick, children, tone }) => <button className={`sv-flow-btn sv-flow-btn--${tone || "next"}`} onClick={onClick}>{children}</button>;
        const revBox = (stage, label) => (
          <div className="sv-flow-rev">
            <textarea className="sv-input" rows={2} value={revComment} onChange={(e) => setRevComment(e.target.value)} placeholder="What needs changing? (required)…" style={{ resize: "vertical" }} />
            <A tone="rev" onClick={() => revComment.trim() && ask("Send this back to the designer with your notes?", () => sendBack(detail, stage))}>{label}</A>
          </div>
        );
        return (
          <div className="sv-ws">
            <div className="sv-ws-header">
              <div className="sv-ws-head-left">
                <button className="sv-ws-back" onClick={() => setDetail(null)}><ArrowLeft size={15} /> Back to Projects</button>
                <div className="sv-ws-client">{detail.clientName}</div>
                <div className="sv-ws-mag">{detail.magazineName || "Untitled Project"}</div>
                <div className="sv-ws-sub">{detail.companyName || "—"}{detail.edition ? ` • ${detail.edition}` : ""}</div>
              </div>
              <div className="sv-ws-head-meta">
                <div className="sv-ws-hm"><span>Designer</span><b>{detail.assignedDesignerName || "Unassigned"}</b></div>
                <div className="sv-ws-hm"><span>Stage</span><b>{stg}</b></div>
                <div className="sv-ws-hm"><span>Progress</span><b>{pct}%</b></div>
                <div className="sv-ws-hm"><span>Priority</span><b>{badge(detail.priority, designPriorityStyle(detail.priority))}</b></div>
              </div>
            </div>
            <div className="sv-ws-actionbar">
              <button className="sv-ws-abtn sv-ws-abtn--ghost" onClick={() => setDetail(null)}><ArrowLeft size={15} /> Back to Projects</button>
              <span className="sv-ws-ab-stage">Stage {Math.min((draftSent ? 1 : ci) + 1, STEPS.length)}/{STEPS.length} · {stg} · {pct}%</span>
            </div>
            <div className="sv-ws-grid">
              <div className="sv-ws-left">
                <div className="sv-card">
                  <div className="sv-section-label">Workflow</div>
                  {changeAlert && (
                    <div className="sv-alertbar sv-alertbar--change">
                      <AlertTriangle size={16} />
                      <div><strong>Changes requested by {changeAlert.actorName}</strong><div className="sv-alertbar-msg">{(changeAlert.comment || "").replace(/^🔄\s*Changes requested:\s*/i, "")} · {changeAlert.createdAt ? new Date(changeAlert.createdAt).toLocaleString() : ""}</div></div>
                    </div>
                  )}
                  <WorkflowTimeline
                    steps={STEPS} currentIndex={ci} stepMeta={lg}
                    revisionsByStage={buildRevisions(designActivity, detail.id, stepOf, detail.status)}
                    progress={pct} stageNumber={Math.min((draftSent ? 1 : ci) + 1, STEPS.length)} stageTitle={stg}
                    nextAction={isDone ? "" : `${own[0]} — ${own[1]}`}
                    statusLabel={own[0] === "Admin" ? "Action needed" : "Waiting"}
                  />
                  <div className="sv-flow-actions">
                    {detail.status === "Draft" && (hasDraft
                      ? <div className="sv-draftgate"><span className="sv-draftgate-ok">✓ Draft added — not sent to the designer yet</span><A tone="ok" onClick={() => ask("Send the draft to the designer now?", () => advance(detail, "Draft Sent"))}>📤 Send Draft to Designer</A></div>
                      : <p className="sv-flow-wait">📎 Upload the client’s Draft (pick “Draft” in the file type) before you can send it to the designer.</p>)}
                    {detail.status === "Draft Sent" && <p className="sv-flow-wait">⏳ Designer is reviewing the draft. You can keep uploading files &amp; messages.</p>}
                    {stg === "Sample Design" && <p className="sv-flow-wait">⏳ Waiting for the designer's sample.</p>}
                    {stg === "Client Review" && <>{has("sample") ? <A tone="ok" onClick={() => ask("Approve the sample and move to Final CP/CS?", () => advance(detail, "Final CP/CS"))}>✓ Approve Sample → Final CP/CS</A> : <p className="sv-flow-wait">⏳ Waiting for the designer's sample upload.</p>}{revBox("Sample Design", "Request Changes")}</>}
                    {stg === "Final CP/CS" && <>{(has("cp") || has("cs")) ? <A tone="ok" onClick={() => ask("Approve the Final CP/CS and move to Index Page?", () => advance(detail, "Index Page"))}>✓ Approve CP/CS → Index Page</A> : <p className="sv-flow-wait">⏳ Waiting for the Final CP/CS.</p>}{revBox("Final CP/CS", "Request Changes")}</>}
                    {stg === "Index Page" && (has("index") ? <p className="sv-flow-wait">⏳ Index uploaded — waiting for the designer to confirm “Index Received”. You can keep uploading.</p> : <p className="sv-flow-wait">📎 Upload the Index Page / materials (as “Index Page”) so the designer can start.</p>)}
                    {stg === "Magazine" && <>{has("magazine") ? <A tone="ok" onClick={() => ask("Approve the magazine and move to Final Review?", () => advance(detail, "Final Review"))}>✓ Approve Magazine → Final Review</A> : <p className="sv-flow-wait">⏳ Waiting for the designer to upload the magazine.</p>}{revBox("Magazine", "Need Changes")}</>}
                    {stg === "Final Review" && <><A tone="ok" onClick={() => ask("Mark this project Completed?", () => advance(detail, "Completed"))}>✓ Complete Project</A><A tone="rev" onClick={() => ask("Return this project to the Magazine stage?", () => advance(detail, "Magazine"))}>Return to Magazine</A></>}
                    {stg === "Completed" && <p className="sv-flow-done">✓ Project completed.</p>}
                  </div>
                </div>
                <div className="sv-card">
                  <div className="sv-section-label">Conversation with Designer</div>
                  {(() => {
                    const thread = (designActivity || []).filter((x) => x.projectId === detail.id && x.type === "message").slice().sort((x, y) => String(x.createdAt).localeCompare(String(y.createdAt)));
                    return (
                      <div className="sv-convo">
                        {thread.length === 0 ? <p className="sv-text-muted" style={{ fontSize: 12.5, margin: "6px 0" }}>No messages yet. Start the conversation with the designer.</p> : (
                          <div className="sv-convo-thread">
                            {thread.map((m) => { const isChange = /changes requested/i.test(m.comment || ""); const imgs = parseMsgImgs(m.meta); return (
                              <div key={m.id} className={`sv-convo-row sv-convo-row--${m.actorRole === "admin" ? "me" : "them"}`}>
                                <div className={`sv-convo-bubble${isChange ? " sv-convo-bubble--change" : ""}`}>{isChange && <span className="sv-convo-tag"><AlertTriangle size={12} /> Change requested</span>}{(m.comment || "") && <div className="sv-convo-text">{(m.comment || "").replace(/^🔄\s*Changes requested:\s*/i, "")}</div>}{imgs.length > 0 && <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 6 }}>{imgs.map((u, i) => <a key={i} href={u} target="_blank" rel="noreferrer"><img src={u} alt="screenshot" style={{ maxWidth: imgs.length > 1 ? 150 : "100%", maxHeight: 220, borderRadius: 8, display: "block", border: "1px solid #e2e8f0" }} /></a>)}</div>}<div className="sv-convo-meta">{m.actorName} · {m.createdAt ? new Date(m.createdAt).toLocaleString() : ""}</div></div>
                              </div>
                            ); })}
                          </div>
                        )}
                        <div className="sv-convo-compose">
                          <textarea className="sv-input" rows={2} value={convoText} onChange={(e) => setConvoText(e.target.value)} onPaste={onConvoPaste} placeholder="Message the designer…  (paste a screenshot with Ctrl+V)" style={{ resize: "vertical" }} />
                          {convoImgs.length > 0 && <div style={{ display: "flex", flexWrap: "wrap", gap: 8, margin: "8px 0" }}>{convoImgs.map((f, i) => <span key={i} style={{ position: "relative", display: "inline-block" }}><img src={URL.createObjectURL(f)} alt="" style={{ width: 56, height: 56, objectFit: "cover", borderRadius: 6, border: "1px solid #e2e8f0" }} /><button onClick={() => removeConvoImg(i)} title="Remove" style={{ position: "absolute", top: -6, right: -6, width: 18, height: 18, borderRadius: 999, border: "none", background: "#EF4444", color: "#fff", fontSize: 12, lineHeight: "18px", cursor: "pointer" }}>×</button></span>)}</div>}
                          <div className="sv-flex sv-gap-2" style={{ alignItems: "center", flexWrap: "wrap" }}>
                            <label className="sv-btn sv-btn--sm sv-btn--ghost" style={{ cursor: "pointer" }}>📎 Screenshot<input type="file" accept="image/*" multiple hidden onChange={(e) => { addConvoFiles(e.target.files); e.target.value = ""; }} /></label>
                            <button className="sv-btn sv-btn--primary" style={{ marginLeft: "auto" }} disabled={convoSending || (!convoText.trim() && convoImgs.length === 0)} onClick={sendConvo}>{convoSending ? "Sending…" : "Send"}</button>
                          </div>
                        </div>
                      </div>
                    );
                  })()}
                </div>
                <div className="sv-card">
                  <div className="sv-section-label">Files &amp; Versions</div>
                  <div className="sv-fileadd">
                    <div className={`sv-dropzone${dragOver ? " is-drag" : ""}`}
                      onDragOver={(e) => { e.preventDefault(); setDragOver(true); }} onDragLeave={() => setDragOver(false)} onDrop={onDropFiles}>
                      <select className="sv-select" value={uploadKind} onChange={(e) => setUploadKind(e.target.value)} style={{ maxWidth: 150 }}>
                        {Object.entries(KIND_LABELS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
                      </select>
                      <select className="sv-select" value={uploadFolder} onChange={(e) => setUploadFolder(e.target.value)} style={{ maxWidth: 150 }} title="Optional folder">
                        <option value="">No folder</option>
                        {((designExtra.folders || {})[detail.id] || []).map((fo) => <option key={fo.id} value={fo.id}>{fo.name}</option>)}
                      </select>
                      <input ref={fileRef} type="file" multiple onChange={onUploadFile} disabled={uploading} accept=".pdf,.ai,.psd,.png,.jpg,.jpeg,.svg,.docx,.zip,image/*" style={{ fontSize: 12.5 }} />
                      <span className="sv-dropzone-hint">{uploading ? "Uploading…" : "or drag & drop — files stay private until sent"}</span>
                    </div>
                    <div className="sv-flex sv-gap-2" style={{ marginTop: 10, flexWrap: "wrap", alignItems: "center" }}>
                      <input className="sv-input" placeholder="New folder name…" value={newFolder} onChange={(e) => setNewFolder(e.target.value)} style={{ maxWidth: 170, fontSize: 12.5 }} />
                      <button className="sv-btn sv-btn--sm sv-btn--ghost" disabled={!newFolder.trim()} onClick={async () => { await addDesignFolder(detail.id, newFolder, "admin"); setNewFolder(""); }}><Plus size={13} /> Folder</button>
                      <input className="sv-input" placeholder="Link label" value={linkLabel} onChange={(e) => setLinkLabel(e.target.value)} style={{ maxWidth: 130, fontSize: 12.5 }} />
                      <input className="sv-input" placeholder="https://… (optional)" value={linkUrl} onChange={(e) => setLinkUrl(e.target.value)} style={{ maxWidth: 190, fontSize: 12.5 }} />
                      <button className="sv-btn sv-btn--sm sv-btn--ghost" disabled={!linkUrl.trim()} onClick={async () => { await addDesignLink(detail.id, linkLabel, linkUrl, "admin"); setLinkLabel(""); setLinkUrl(""); }}><Plus size={13} /> Link</button>
                    </div>
                  </div>
                  {(() => {
                    const all = designFiles.filter((x) => x.projectId === detail.id);
                    const visible = (f) => f.uploadedByName === "Admin" || !isDraftFile(f.id); // designer files only after they submit
                    const ff = designExtra.fileFolders || {};
                    const myDrafts = all.filter((f) => f.uploadedByName === "Admin" && isDraftFile(f.id));
                    const links = ((designExtra.links || {})[detail.id] || []).filter((l) => l.side === "admin");
                    const allFolders = ((designExtra.folders || {})[detail.id] || []); /* shared — both sides */
                    const rowA = (f, latest) => {
                      const isImg = /\.(png|jpe?g|svg|gif|webp)$/i.test(f.fileName);
                      const draft = isDraftFile(f.id) && f.uploadedByName === "Admin";
                      const isNew = isNewFile(f);
                      return (
                        <div key={f.id} className={`sv-fileitem${latest ? " is-latest" : ""}${draft ? " is-draft" : ""}`} style={isNew ? { outline: "2px solid #F59E0B", outlineOffset: "-1px", background: "rgba(245,158,11,0.08)", borderRadius: 8 } : undefined}>
                          {isImg ? <img src={f.fileUrl} alt="" style={{ width: 36, height: 36, borderRadius: 6, objectFit: "cover", flex: "none" }} /> : <span style={{ width: 36, height: 36, borderRadius: 6, background: "#F1F5F9", display: "flex", alignItems: "center", justifyContent: "center", flex: "none" }}><FileText size={16} /></span>}
                          <div style={{ minWidth: 0, flex: 1 }}>
                            <div style={{ fontSize: 13, fontWeight: 600, color: "var(--sv-text-1,#0F172A)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f.fileName}{isNew && <span style={{ marginLeft: 8, fontSize: 10.5, fontWeight: 800, color: "#B45309", background: "#FEF3C7", padding: "2px 7px", borderRadius: 999 }}>🆕 NEW</span>}{draft ? <span className="sv-file-draft">DRAFT · not sent</span> : latest && <span className="sv-file-latest">LATEST</span>}</div>
                            <div style={{ fontSize: 11, color: "var(--sv-text-3,#64748B)", marginTop: 2 }}>{badge(`${KIND_LABELS[f.kind] || f.kind} v${f.version}`, designStatusStyle("Pending"))} · {fmtSize(f.sizeBytes)} · {f.uploadedByName} · {f.createdAt ? new Date(f.createdAt).toLocaleString() : ""}</div>
                          </div>
                          <a className="sv-btn sv-btn--sm sv-btn--ghost" href={f.fileUrl} target="_blank" rel="noreferrer">Open</a>
                          <a className="sv-btn sv-btn--sm sv-btn--ghost" href={f.fileUrl} download={f.fileName}>Download</a>
                          <button className="sv-btn sv-btn--sm sv-btn--danger" onClick={() => ask(`Delete "${f.fileName}"? This cannot be undone.`, () => deleteDesignFile(f))}>Delete</button>
                        </div>
                      );
                    };
                    const sections = [];
                    allFolders.forEach((fo) => {
                      const fs = all.filter((f) => visible(f) && (ff[f.id] || "") === fo.id).sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
                      const open = !!openFolders[fo.id];
                      sections.push(
                        <div key={"fo-" + fo.id} className={`sv-folder${open ? " is-open" : ""}`}>
                          <div className="sv-folder-head" onClick={() => toggleFolder(fo.id)}>
                            <span className="sv-folder-caret">{open ? "▾" : "▸"}</span>
                            <FolderOpen size={15} className="sv-folder-ic" />
                            <span className="sv-folder-name">{fo.name}</span>
                            <span className="sv-folder-count">{fs.length} file{fs.length !== 1 ? "s" : ""}</span>
                            {!fo.released && fo.side === "admin" && <span className="sv-file-draft">private</span>}
                            <button className="sv-btn sv-btn--sm sv-btn--ghost sv-folder-del" onClick={(e) => { e.stopPropagation(); ask(`Delete folder "${fo.name}"? Files inside are kept.`, () => deleteDesignFolder(detail.id, fo.id)); }}>×</button>
                          </div>
                          {open && <div className="sv-folder-body">{fs.length === 0 ? <p className="sv-text-muted" style={{ fontSize: 12 }}>No files here yet.</p> : fs.map((f, fi) => rowA(f, fi === 0))}</div>}
                        </div>
                      );
                    });
                    // Loose = files with no folder OR whose folder no longer exists (so a deleted folder
                    // can never make a file vanish — it just falls back to the loose list).
                    const folderIdSet = new Set(allFolders.map((fo) => fo.id));
                    const loose = all.filter((f) => visible(f) && !folderIdSet.has(ff[f.id] || "")).sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
                    if (loose.length) sections.push(<div key="loose" style={{ display: "flex", flexDirection: "column", gap: 8 }}>{loose.map((f, fi) => rowA(f, fi === 0))}</div>);
                    const newFiles = newFilesFor(detail.id);
                    const latestNewTs = newFiles.reduce((m, f) => (String(f.createdAt || "") > m ? String(f.createdAt) : m), "");
                    return (
                      <>
                        {newFiles.length > 0 && (
                          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", background: "#FFFBEB", border: "1px solid #FDE68A", color: "#92400E", borderRadius: 10, padding: "9px 12px", fontSize: 12.5, marginBottom: 10 }}>
                            <span>🆕 <b>{newFiles.length} new file{newFiles.length !== 1 ? "s" : ""}</b> from {detail.assignedDesignerName || "the designer"} — highlighted below until you acknowledge.</span>
                            <button className="sv-btn sv-btn--sm sv-btn--success" style={{ marginLeft: "auto" }} onClick={() => ask(`Acknowledge ${newFiles.length} new file(s)? The highlight will clear.`, () => acknowledgeDesign(detail.id, latestNewTs))}>✓ Acknowledge</button>
                          </div>
                        )}
                        {myDrafts.length > 0 && detail.status !== "Draft" && <button className="sv-btn sv-btn--sm sv-btn--ghost" style={{ marginBottom: 10 }} onClick={() => ask(`Send ${myDrafts.length} draft file(s) to the designer now?`, () => releaseDesign(detail.id, "admin"))}>📤 Send {myDrafts.length} file(s) to designer</button>}
                        {links.length > 0 && <div style={{ marginBottom: 10 }}><div className="sv-section-label">Links</div>{links.map((l) => (<div key={l.id} className="sv-fileitem" style={{ marginTop: 6 }}><span style={{ width: 36, height: 36, borderRadius: 6, background: "#EEF2FF", display: "flex", alignItems: "center", justifyContent: "center", flex: "none", color: "#4338CA", fontWeight: 800 }}>🔗</span><div style={{ minWidth: 0, flex: 1 }}><div style={{ fontSize: 13, fontWeight: 600 }}>{l.label}{!l.released && <span className="sv-file-draft">not sent</span>}</div><div style={{ fontSize: 11, color: "#64748B", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{l.url}</div></div><a className="sv-btn sv-btn--sm sv-btn--ghost" href={l.url} target="_blank" rel="noreferrer">Open</a><button className="sv-btn sv-btn--sm sv-btn--danger" onClick={() => ask("Remove this link?", () => deleteDesignLink(detail.id, l.id))}>×</button></div>))}</div>}
                        {sections.length === 0 ? <p className="sv-text-muted" style={{ fontSize: 12.5 }}>No files yet. Pick a type and upload — every upload is versioned and stays private until sent.</p> : sections}
                      </>
                    );
                  })()}
                </div>
              </div>
              <div className="sv-ws-right">
                <div className="sv-card sv-ws-summary">
                  <div className="sv-section-label">Project Summary</div>
                  {metaCell("Magazine Domain", detail.companyName)}
                  {metaCell("Project Title", detail.magazineName)}
                  {metaCell("Edition", detail.edition)}
                  {metaCell("Designer", detail.assignedDesignerName)}
                  {metaCell("Priority", <span>{badge(detail.priority, designPriorityStyle(detail.priority))}</span>)}
                  {metaCell("Due Date", detail.dueDate ? fmtDate(detail.dueDate) : "—")}
                  {metaCell("Current Stage", <span>{badge(stg, sc)}</span>)}
                  {metaCell("Files", pf.length)}
                  {metaCell("Last Updated", la ? new Date(la).toLocaleString() : "—")}
                </div>
                <div className="sv-card">
                  <div className="sv-section-label">Quick Actions</div>
                  <div className="sv-ws-quick">
                    <button className="sv-ws-abtn sv-ws-abtn--edit" onClick={() => openEdit(detail)}><Pencil size={14} /> Edit Project</button>
                    <button className="sv-ws-abtn sv-ws-abtn--danger" onClick={() => setConfirmDel(detail)}>Delete Project</button>
                  </div>
                </div>
              </div>
            </div>
            <div className="sv-card">
              <div className="sv-section-label">Activity Timeline</div>
              {(() => {
                const acts = designActivity.filter((a) => a.projectId === detail.id).sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1)).slice(0, 10);
                if (acts.length === 0) return <p className="sv-text-muted" style={{ fontSize: 12.5, marginTop: 4 }}>No activity yet.</p>;
                return (
                  <div className="sv-activity-scroll" style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 8 }}>
                    {acts.map((a) => (
                      <div key={a.id} style={{ display: "flex", gap: 10 }}>
                        <div style={{ width: 8, height: 8, borderRadius: 999, background: a.type === "revision" ? "#C2410C" : a.type === "upload" ? "#2563EB" : a.type === "status" ? "#15803D" : a.type === "message" ? "#7C3AED" : "#94A3B8", marginTop: 5, flex: "none" }} />
                        <div style={{ fontSize: 12.5, color: "#334155" }}>
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
        );
      })()}

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

      {archiveAsk && (
        <div className="sv-modal-overlay" onClick={() => { setArchiveAsk(null); setArchiveReason(""); }}>
          <div className="sv-modal" style={{ maxWidth: 420 }} onClick={(e) => e.stopPropagation()}>
            <div className="sv-modal-header"><span className="sv-text-navy sv-font-800" style={{ fontSize: 16 }}>{archiveAsk.mode === "delete" ? "Delete Project" : "Archive Project"}</span><button className="sv-modal-close" onClick={() => { setArchiveAsk(null); setArchiveReason(""); }}>×</button></div>
            <div style={{ padding: "16px 20px" }}>
              <p className="sv-text-muted" style={{ margin: "0 0 10px", fontSize: 12.5 }}>{archiveAsk.mode === "delete" ? "This moves the project to Archive (you can permanently delete it later). A reason is required." : "This moves the project to Archive. You can restore it anytime."}</p>
              <label className="sv-team-ctl"><span>Reason{archiveAsk.mode === "delete" ? " *" : " (optional)"}</span><textarea className="sv-input" rows={3} value={archiveReason} onChange={(e) => setArchiveReason(e.target.value)} placeholder="e.g. Duplicate entry, project cancelled…" style={{ resize: "vertical" }} /></label>
            </div>
            <div className="sv-modal-footer" style={{ display: "flex", justifyContent: "flex-end", gap: 8, padding: "12px 20px" }}>
              <button className="sv-btn sv-btn--outline" onClick={() => { setArchiveAsk(null); setArchiveReason(""); }}>Cancel</button>
              <button className="sv-btn sv-btn--danger-solid" onClick={doArchive} disabled={archiveAsk.mode === "delete" && !archiveReason.trim()}>{archiveAsk.mode === "delete" ? "Delete → Archive" : "Archive"}</button>
            </div>
          </div>
        </div>
      )}

      {/* Add / Edit modal */}
      {form && (
        <div className="sv-modal-overlay" onClick={() => setForm(null)}>
          <div className="sv-modal" style={{ maxWidth: 640, maxHeight: "90vh", display: "flex", flexDirection: "column" }} onClick={(ev) => ev.stopPropagation()}>
            <div className="sv-modal-header" style={{ flexShrink: 0 }}>
              <span className="sv-text-navy sv-font-800" style={{ fontSize: 16 }}>{isNew ? "New Design Project" : "Edit Project"}</span>
              <button className="sv-modal-close" onClick={() => setForm(null)}>×</button>
            </div>
            <div style={{ overflowY: "auto", padding: "16px 20px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              {field("Client Name *", <input className="sv-input" value={form.clientName} onChange={(e) => upd("clientName", e.target.value)} placeholder="Client name" />)}
              {field("Project Title *", <input className="sv-input" value={form.magazineName} onChange={(e) => upd("magazineName", e.target.value)} placeholder="e.g. Top 10 Leaders" />)}
              {field("Magazine Domain *", <input className="sv-input" value={form.companyName} onChange={(e) => upd("companyName", e.target.value)} placeholder="e.g. CIO Visionaries" />)}
              {field("Edition *", <input className="sv-input" value={form.edition} onChange={(e) => upd("edition", e.target.value)} placeholder="e.g. Jan 2026" />)}
              {field("Assign Designer *", (
                <select className="sv-select" value={form.assignedDesigner} onChange={(e) => setDesigner(e.target.value)}>
                  <option value="">Select designer…</option>{employees.filter((e) => (e.department || "").toLowerCase() === "design").map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
                  {employees.filter((e) => (e.department || "").toLowerCase() !== "design").map((e) => <option key={e.id} value={e.id}>{e.name}{e.department ? ` (${e.department})` : ""}</option>)}
                </select>
              ))}
              {!isNew && <>
                {field("Due Date", <input className="sv-input" type="date" value={form.dueDate || ""} onChange={(e) => upd("dueDate", e.target.value)} />)}
                {field("Priority", <select className="sv-select" value={form.priority} onChange={(e) => upd("priority", e.target.value)}>{["Low", "Medium", "High", "Urgent"].map((s) => <option key={s} value={s}>{s}</option>)}</select>)}
                {field("Current Stage", <select className="sv-select" value={form.status} onChange={(e) => upd("status", e.target.value)}>{DESIGN_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}</select>)}
                <div style={{ gridColumn: "1 / -1" }}>{field("Instructions for Designer", <textarea className="sv-input" rows={3} value={form.instructions} onChange={(e) => upd("instructions", e.target.value)} placeholder="Theme, colours, references, brand guidelines, notes…" style={{ resize: "vertical" }} />)}</div>
                <div style={{ gridColumn: "1 / -1" }}>{field("Internal Notes", <textarea className="sv-input" rows={2} value={form.internalNotes} onChange={(e) => upd("internalNotes", e.target.value)} placeholder="Private notes (not shown to designer)" style={{ resize: "vertical" }} />)}</div>
              </>}
            </div>
            <div className="sv-flex sv-justify-between" style={{ padding: "12px 20px", borderTop: "1px solid #F1F5F9", flexShrink: 0, alignItems: "center" }}>
              <span className="sv-text-muted" style={{ fontSize: 12 }}>* Client name is required</span>
              <div className="sv-flex sv-gap-sm">
                <button className="sv-btn sv-btn--ghost" onClick={() => setForm(null)}>Cancel</button>
                <button className="sv-btn sv-btn--primary" onClick={save} disabled={saving || !form.clientName.trim()}>{saving ? "Saving…" : isNew ? "Create" : "Save"}</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirm */}
      {confirmDel && (
        <div className="sv-modal-overlay" onClick={() => setConfirmDel(null)}>
          <div className="sv-modal" style={{ maxWidth: 380 }} onClick={(ev) => ev.stopPropagation()}>
            <div className="sv-modal-header"><span className="sv-text-navy sv-font-800" style={{ fontSize: 15 }}>Delete project?</span><button className="sv-modal-close" onClick={() => setConfirmDel(null)}>×</button></div>
            <div style={{ padding: "16px 20px", fontSize: 13.5, color: "#475569" }}>This permanently removes the project for <strong>{confirmDel.clientName}</strong>. This cannot be undone.</div>
            <div className="sv-flex sv-justify-between" style={{ padding: "12px 20px", borderTop: "1px solid #F1F5F9" }}>
              <button className="sv-btn sv-btn--ghost" onClick={() => setConfirmDel(null)}>Cancel</button>
              <button className="sv-btn sv-btn--danger" onClick={doDelete}>Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
