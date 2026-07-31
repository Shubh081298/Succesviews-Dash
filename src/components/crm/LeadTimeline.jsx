/**
 * LeadTimeline.jsx — premium, deduped activity feed.
 * Each event is a card with a coloured status/action badge, date+time,
 * employee, notes, and next follow-up. Newest first, scrollable, latest
 * event highlighted. Redundant status/edit noise is filtered out.
 */
import { useAppData } from "../../data/AppDataContext";
import { stageColour } from "../../utils/crmWorkflow";
import { Mail, Phone, MessageCircle, Video, Globe, IndianRupee, CheckCircle2, FileText, PlusCircle, RotateCcw, Ban, Clock } from "lucide-react";

const CUR_SYM = { USD: "$", INR: "₹", AED: "AED ", EUR: "€", GBP: "£", AUD: "A$", SGD: "S$" };
const money = (v, c) => `${CUR_SYM[c] || (c || "") + " "}${Number(v).toLocaleString()}`;
const commIcon = (t) => ({ "Email": Mail, "Phone Call": Phone, "WhatsApp": MessageCircle, "LinkedIn": Globe, "Zoom Meeting": Video, "Google Meet": Video }[t] || MessageCircle);
const when = (ts) => {
  if (!ts) return "";
  const d = new Date(ts);
  return d.toLocaleDateString(undefined, { day: "2-digit", month: "short" }) + " · " + d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
};
const fmtDay = (d) => (d ? new Date(String(d).length <= 10 ? d + "T00:00:00" : d).toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" }) : "");

// history actions that duplicate the record/follow-up rows — hide them
const HIDE_EXACT = new Set(["Client Edited", "Contract Sent", "Sale Closed", "Sales Generated", "Payment Received", "Note Added"]);

export default function LeadTimeline({ clientId }) {
  const { employees = [], pipelineHistory = [], pipelineFollowups = [], pipelineSales = [], pipelinePayments = [], pipelineContracts = [], pipelineNotes = [] } = useAppData();
  const empName = (id) => (employees.find((e) => e.id === id) || {}).name || "";

  const items = [];
  pipelineFollowups.filter((x) => x.clientId === clientId).forEach((x) => items.push({
    ts: x.createdAt, icon: commIcon(x.communicationType), color: stageColour(x.status) || "#EA580C",
    badge: x.status || "Follow-up", title: `Follow-up · ${x.communicationType || "Update"}`,
    notes: x.notes, next: x.nextFollowUp, emp: empName(x.employeeId),
  }));
  pipelineContracts.filter((x) => x.clientId === clientId).forEach((x) => items.push({
    ts: x.createdAt, icon: FileText, color: "#7C3AED", badge: "Contract", title: "Contract sent",
    notes: `#${x.contractNumber || "—"}${x.contractDate ? " · " + fmtDay(x.contractDate) : ""}`,
  }));
  pipelineSales.filter((x) => x.clientId === clientId).forEach((x) => items.push({
    ts: x.createdAt, icon: IndianRupee, color: "#0D9488", badge: "Sale", title: "Sale generated",
    notes: `${money(x.amount, x.currency)}${x.packageName ? " · " + x.packageName : ""}`,
  }));
  pipelinePayments.filter((x) => x.clientId === clientId).forEach((x) => { const rev = Number(x.amount) < 0; items.push({
    ts: x.createdAt, icon: rev ? RotateCcw : CheckCircle2, color: rev ? "#DC2626" : "#059669",
    badge: rev ? "Refund" : "Payment", title: rev ? "Payment reversed" : "Payment received",
    notes: `${money(Math.abs(x.amount), x.currency)}${x.paymentMethod ? " · " + x.paymentMethod : ""}`,
  }); });
  pipelineNotes.filter((x) => x.clientId === clientId).forEach((x) => items.push({
    ts: x.createdAt, icon: MessageCircle, color: "#64748B", badge: "Note", title: "Note added", notes: x.note, emp: empName(x.employeeId),
  }));
  pipelineHistory.filter((h) => h.clientId === clientId).forEach((h) => {
    const a = String(h.action || "");
    if (HIDE_EXACT.has(a) || a.startsWith("Status → ")) return;
    const created = a === "Client Created";
    const dead = /Deleted|Cancelled|Lost/i.test(a);
    items.push({ ts: h.createdAt, icon: created ? PlusCircle : dead ? Ban : Clock, color: created ? "#2563EB" : dead ? "#DC2626" : "#64748B", badge: created ? "Created" : a, title: a, emp: empName(h.employeeId) });
  });
  items.sort((a, b) => String(b.ts).localeCompare(String(a.ts)));

  if (!items.length) return <p className="sv-text-muted" style={{ fontSize: 12.5 }}>No activity yet.</p>;
  return (
    <div className="sv-tl2">
      {items.map((it, i) => { const Ic = it.icon || Clock; return (
        <div key={i} className={`sv-tl2-card${i === 0 ? " is-latest" : ""}`} style={{ "--tc": it.color }}>
          <span className="sv-tl2-ic"><Ic size={14} /></span>
          <div className="sv-tl2-body">
            <div className="sv-tl2-top">
              <span className="sv-tl2-badge" style={{ background: it.color + "1A", color: it.color }}>{it.badge}</span>
              <span className="sv-tl2-time">{when(it.ts)}</span>
            </div>
            <div className="sv-tl2-title">{it.title}</div>
            {it.notes ? <div className="sv-tl2-notes">{it.notes}</div> : null}
            {(it.emp || it.next) && (
              <div className="sv-tl2-meta">
                {it.emp ? <span>👤 {it.emp}</span> : null}
                {it.next ? <span>📅 Next: {fmtDay(it.next)}</span> : null}
              </div>
            )}
          </div>
        </div>
      ); })}
    </div>
  );
}
