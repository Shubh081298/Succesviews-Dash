/**
 * LeadWorkflow.jsx — shared production-workflow control.
 * Renders the stage stepper + the single next-action button (with a
 * confirm / date dialog), driving the exact same flow on both the
 * Employee Pipeline and the Admin Client Pipeline.
 */
import { useState, useRef } from "react";
import { useAppData } from "../../data/AppDataContext";
import { WORKFLOW_STEPS, progressOf, nextAction, stageColour, isClosed } from "../../utils/crmWorkflow";
import { FileText, IndianRupee, CheckCircle2, Palette, Rocket, BookOpen, Flag, Check } from "lucide-react";

const today = () => { const d = new Date(); return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10); };
const CURRENCIES = ["USD", "AED", "INR", "EUR", "GBP", "AUD", "SGD"];
const STEP_ICON = {
  "Contract Sent": FileText, "Sales Generated": IndianRupee, "Payment Completed": CheckCircle2,
  "Completed": Flag,
};

const CUR_SYM = { USD: "$", INR: "₹", AED: "AED ", EUR: "€", GBP: "£", AUD: "A$", SGD: "S$" };

export default function LeadWorkflow({ client, actorId, onToast }) {
  const { updatePipelineClient, addPipelineContract, addPipelineSale, addPipelinePayment, pipelineContracts = [], pipelinePayments = [] } = useAppData();
  const toast = onToast || (() => {});
  const [dlg, setDlg] = useState(null); // { w, date, amount }
  const [busy, setBusy] = useState(false);
  const runningRef = useRef(false); // hard guard against double-fire / retries

  const progress = progressOf(client.status);
  const act = nextAction(client.status);
  const owner = client.employeeId || actorId;

  // B1: partial-payment tracking — expected deal value vs what's been paid.
  const expected = Number(client.expectedAmount) || 0;
  const dealCur = client.expectedCurrency || "USD";
  const paidSoFar = (pipelinePayments || [])
    .filter((p) => p.clientId === client.id && (p.currency || "USD") === dealCur)
    .reduce((a, b) => a + (Number(b.amount) || 0), 0);
  const outstanding = Math.max(0, expected - paidSoFar);
  const paidPct = expected > 0 ? Math.min(100, Math.round((paidSoFar / expected) * 100)) : 0;
  const money = (v) => `${CUR_SYM[dealCur] || dealCur + " "}${Number(v).toLocaleString()}`;

  const run = async () => {
    // Idempotency guard: ignore re-entry, and re-check the action is still the
    // current next step so a stale/duplicate click can't advance the stage twice.
    if (runningRef.current) return;
    const { w, date, amount, cur } = dlg;
    if (progressOf(client.status) !== w.at) { toast("This step is already done.", "info"); setDlg(null); return; }
    runningRef.current = true;
    setBusy(true);
    try {
      if (w.kind === "contract") {
        // one contract per deal; don't create a duplicate if one already exists
        const hasContract = pipelineContracts.some((c) => c.clientId === client.id);
        if (!hasContract) {
          const code = String(client.id || "").replace(/[^a-zA-Z0-9]/g, "").slice(0, 6).toUpperCase();
          await addPipelineContract({ clientId: client.id, employeeId: owner, clientName: client.clientName, contractNumber: `CO-${code}-${Date.now().toString(36).slice(-4).toUpperCase()}`, contractDate: date });
        }
        await updatePipelineClient(client.id, { status: w.to, lastFollowUp: date }, owner);
      } else if (w.kind === "sale") {
        const dealAmt = Number(amount) || 0;
        await addPipelineSale({ clientId: client.id, employeeId: owner, clientName: client.clientName, amount: dealAmt, currency: cur || "USD", salesDate: date });
        // record the agreed deal value so partial payments can be tracked against it
        await updatePipelineClient(client.id, { status: w.to, expectedAmount: dealAmt, expectedCurrency: cur || "USD" }, owner);
      } else if (w.kind === "payment") {
        const thisPay = Number(amount) || 0;
        await addPipelinePayment({ clientId: client.id, employeeId: owner, clientName: client.clientName, amount: thisPay, currency: cur || "USD", paymentDate: date });
        // only mark Payment Completed once the full expected amount is covered;
        // otherwise keep it at Sales Generated so more installments can be added.
        const fullyPaid = !(expected > 0) || (paidSoFar + thisPay) >= expected;
        await updatePipelineClient(client.id, { status: fullyPaid ? "Payment Completed" : "Sales Generated" }, owner);
        toast(fullyPaid ? "Payment complete." : `Partial payment recorded — ${money(Math.max(0, expected - (paidSoFar + thisPay)))} still outstanding.`, "success");
        setDlg(null); setBusy(false); runningRef.current = false; return;
      } else {
        await updatePipelineClient(client.id, { status: w.to }, owner);
        if (w.closes) await updatePipelineClient(client.id, { status: "Project Closed" }, owner);
      }
      toast(`${w.label} — done.`, "success");
      setDlg(null);
    } catch (e) { toast("Could not complete that step.", "error"); }
    setBusy(false);
    runningRef.current = false;
  };

  return (
    <div className="sv-wf">
      <div className="sv-wf-stepper">
        {WORKFLOW_STEPS.map((s, i) => {
          const Ic = STEP_ICON[s] || Check;
          const done = progress > i + 1 || (progress >= i + 1 && isClosed(client.status));
          const current = progress === i + 1;
          const reached = progress >= i + 1;
          const col = stageColour(s);
          return (
            <div key={s} className={`sv-wf-step${current ? " is-current" : ""}${reached ? " is-done" : ""}`} style={{ "--sc": col }}>
              <span className="sv-wf-dot"><Ic size={13} /></span>
              <span className="sv-wf-lbl">{s}</span>
            </div>
          );
        })}
      </div>

      {/* payment progress — visible once a deal value is set */}
      {expected > 0 && progress >= 2 && (
        <div className="sv-wf-pay">
          <div className="sv-wf-pay-top"><span>Paid {money(paidSoFar)} of {money(expected)}</span><span className={outstanding > 0 ? "sv-wf-pay-due" : "sv-wf-pay-ok"}>{outstanding > 0 ? `${money(outstanding)} due` : "Fully paid"}</span></div>
          <div className="sv-wf-pay-bar"><span style={{ width: `${paidPct}%` }} /></div>
        </div>
      )}

      {act ? (
        <button className="sv-wf-cta" style={{ "--sc": act.colour }} onClick={() => setDlg({ w: act, date: today(), amount: act.kind === "sale" && expected > 0 ? String(expected) : act.kind === "payment" && outstanding > 0 ? String(outstanding) : "", cur: (act.kind === "payment" || act.kind === "sale") ? dealCur : "USD" })}>
          {(STEP_ICON[act.to] ? (() => { const I = STEP_ICON[act.to]; return <I size={16} />; })() : null)}
          {act.kind === "payment" && paidSoFar > 0 ? "Record Another Payment" : act.label}
        </button>
      ) : (
        <div className="sv-wf-complete"><Flag size={15} /> {progress < 0 ? "This lead is closed." : "Project completed — all stages done."}</div>
      )}

      {dlg && (
        <div className="sv-modal-overlay sv-pl-overlay" onClick={() => setDlg(null)}>
          <div className="sv-modal" style={{ maxWidth: 400 }} onClick={(e) => e.stopPropagation()}>
            <div className="sv-modal-header"><span className="sv-text-navy sv-font-800" style={{ fontSize: 16 }}>{dlg.w.label}</span><button className="sv-modal-close" onClick={() => setDlg(null)}>×</button></div>
            <div style={{ padding: "16px 20px" }}>
              <p className="sv-text-muted" style={{ fontSize: 13, marginTop: 0 }}>{dlg.w.confirm}</p>
              {(dlg.w.kind === "contract" || dlg.w.kind === "sale" || dlg.w.kind === "payment") && (
                <label className="sv-pl-field"><span>{dlg.w.dateLabel || "Date"} <b> *</b></span><input className="sv-input" type="date" value={dlg.date} onChange={(e) => setDlg({ ...dlg, date: e.target.value })} /></label>
              )}
              {(dlg.w.kind === "sale" || dlg.w.kind === "payment") && (
                <div className="sv-flex sv-gap-2">
                  <label className="sv-pl-field" style={{ flex: 2 }}><span>{dlg.w.kind === "sale" ? "Deal amount" : `Payment amount${expected > 0 ? ` · ${money(outstanding)} due` : ""}`}</span><input className="sv-input" type="number" inputMode="decimal" placeholder="Optional" value={dlg.amount} onChange={(e) => setDlg({ ...dlg, amount: e.target.value })} /></label>
                  <label className="sv-pl-field" style={{ flex: 1 }}><span>Currency</span><input className="sv-input" list="wf-cur-list" value={dlg.cur} onChange={(e) => setDlg({ ...dlg, cur: e.target.value.toUpperCase() })} placeholder="e.g. AED" /><datalist id="wf-cur-list">{CURRENCIES.map((c) => <option key={c} value={c} />)}</datalist></label>
                </div>
              )}
              <div className="sv-flex sv-gap-2" style={{ marginTop: 12 }}>
                <button className="sv-btn sv-btn--ghost" style={{ flex: 1 }} onClick={() => setDlg(null)}>No</button>
                <button className="sv-btn sv-btn--primary" style={{ flex: 1 }} disabled={busy} onClick={run}>{busy ? "Saving…" : "Yes, confirm"}</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
