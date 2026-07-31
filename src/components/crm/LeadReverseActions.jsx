import { useState } from "react";
import { useAppData } from "../../data/AppDataContext";
import { RotateCcw, Ban } from "lucide-react";

const CUR_SYM = { USD: "$", INR: "₹", AED: "AED ", EUR: "€", GBP: "£", AUD: "A$", SGD: "S$" };
const money = (v, c) => `${CUR_SYM[c] || (c || "USD") + " "}${Number(v).toLocaleString()}`;

/**
 * LeadReverseActions — admin-only reverse/cancel path (B3).
 * Reverse a specific payment (records a negative offsetting entry so analytics
 * net out) or cancel the whole deal (status → Cancelled). Full audit trail.
 */
export default function LeadReverseActions({ client, actorId, onToast }) {
  const { pipelinePayments = [], reversePipelinePayment, updatePipelineClient } = useAppData();
  const toast = onToast || (() => {});
  const [busy, setBusy] = useState("");
  const [confirmRev, setConfirmRev] = useState(null);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const owner = client.employeeId || actorId;

  // only positive, not-yet-reversed payments (a negative entry already offsets one)
  const pays = pipelinePayments.filter((p) => p.clientId === client.id && Number(p.amount) > 0);
  const cancelled = client.status === "Cancelled";

  const doReverse = async (p) => {
    setBusy(p.id);
    const ok = await reversePipelinePayment(client.id, owner, p.amount, p.currency);
    setBusy(""); setConfirmRev(null);
    if (ok) toast(`Reversed ${money(p.amount, p.currency)}.`, "success");
  };
  const doCancel = async () => {
    setBusy("cancel");
    const ok = await updatePipelineClient(client.id, { status: "Cancelled" }, owner);
    setBusy(""); setConfirmCancel(false);
    if (ok) toast("Deal cancelled.", "success");
  };

  return (
    <div>
      {pays.length > 0 && (
        <div className="sv-rev-list">
          {pays.map((p) => (
            <div key={p.id} className="sv-rev-row">
              <span className="sv-rev-amt">{money(p.amount, p.currency)}</span>
              <span className="sv-text-muted" style={{ fontSize: 11.5 }}>{p.paymentDate || ""}</span>
              {confirmRev === p.id ? (
                <span className="sv-flex sv-gap-2" style={{ marginLeft: "auto" }}>
                  <button className="sv-btn sv-btn--sm sv-btn--ghost" onClick={() => setConfirmRev(null)}>No</button>
                  <button className="sv-btn sv-btn--sm" style={{ background: "#DC2626", color: "#fff" }} disabled={busy === p.id} onClick={() => doReverse(p)}>{busy === p.id ? "…" : "Reverse"}</button>
                </span>
              ) : (
                <button className="sv-btn sv-btn--sm sv-btn--outline" style={{ marginLeft: "auto", color: "#B45309", borderColor: "#FCD34D" }} onClick={() => setConfirmRev(p.id)}><RotateCcw size={12} /> Reverse</button>
              )}
            </div>
          ))}
        </div>
      )}
      <div className="sv-flex sv-justify-between sv-items-center" style={{ marginTop: 10 }}>
        <span className="sv-text-muted" style={{ fontSize: 11.5 }}>{cancelled ? "This deal is cancelled." : "Cancel the whole deal"}</span>
        {!cancelled && (confirmCancel ? (
          <div className="sv-flex sv-gap-2 sv-items-center">
            <span className="sv-text-muted" style={{ fontSize: 12.5 }}>Cancel this deal?</span>
            <button className="sv-btn sv-btn--sm sv-btn--ghost" onClick={() => setConfirmCancel(false)}>No</button>
            <button className="sv-btn sv-btn--sm" style={{ background: "#78716C", color: "#fff" }} disabled={busy === "cancel"} onClick={doCancel}>{busy === "cancel" ? "…" : "Cancel Deal"}</button>
          </div>
        ) : (
          <button className="sv-btn sv-btn--sm sv-btn--outline" style={{ color: "#78716C", borderColor: "#D6D3D1" }} onClick={() => setConfirmCancel(true)}><Ban size={13} /> Cancel Deal</button>
        ))}
      </div>
    </div>
  );
}
