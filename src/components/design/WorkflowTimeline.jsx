import { FileText, PenTool, Users, ClipboardList, ListOrdered, BookOpen, ShieldCheck, Award, RotateCcw, Check } from "lucide-react";

/* Premium 8-stage workflow timeline — shared by Admin & Designer.
   Pure presentation: all workflow logic stays in the parent.
   Props:
     steps            [{ key, label, color }]  (the 8 stages)
     currentIndex     number (index of current stage; -1 → none)
     stepMeta         { [stageKey]: { actor, time } }  (who/when for done/current)
     revisionsByStage { [stageKey]: [{ n, reason, by, time }] }
     progress         0..100
     stageNumber      1..8
     stageTitle       current stage title
     nextAction       string (e.g. "You — Prepare & submit the sample design")
     statusLabel      current stage badge text (Waiting / In Progress / Under Review / Revision)
*/
const STAGE_ICONS = [FileText, PenTool, Users, ClipboardList, ListOrdered, BookOpen, ShieldCheck, Award];
const R = 19, C = 2 * Math.PI * R;

const wfHexToRgba = (hex, a) => { const h = String(hex || "").replace("#", ""); if (h.length !== 6) return `rgba(99,102,241,${a})`; const r = parseInt(h.slice(0, 2), 16), g = parseInt(h.slice(2, 4), 16), b = parseInt(h.slice(4, 6), 16); return `rgba(${r},${g},${b},${a})`; };

export default function WorkflowTimeline({
  steps = [], currentIndex = 0, stepMeta = {}, revisionsByStage = {},
  progress = 0, stageNumber = 1, stageTitle = "", nextAction = "", statusLabel = "", brand = "", logo = "",
}) {
  const pct = Math.max(0, Math.min(100, Math.round(progress)));
  const brandVars = brand ? { "--brand": brand, "--brand-soft": wfHexToRgba(brand, 0.18), "--brand-bg": wfHexToRgba(brand, 0.12) } : undefined;
  return (
    <div className="sv-wf" style={brandVars}>
      <div className="sv-wf-head">
        <div className="sv-wf-head-l">
          <div className="sv-wf-eyebrow">Workflow Progress</div>
          <div className="sv-wf-stage">Stage {stageNumber} of {steps.length} <span className="sv-wf-dotsep">•</span> {stageTitle}</div>
          {nextAction && <div className="sv-wf-next"><span className="sv-wf-next-ic">⏳</span> Next up: <strong>{nextAction}</strong></div>}
        </div>
        {logo && (
          <div style={{ height: 56, width: 148, marginLeft: "auto", flex: "none", display: "flex", alignItems: "center", justifyContent: "center", border: "1px solid #EEF2F7", borderRadius: 12, background: "#fff", overflow: "hidden" }}>
            <img src={logo} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          </div>
        )}
        <div className="sv-wf-ring">
          <svg viewBox="0 0 44 44" aria-hidden="true">
            <circle className="sv-wf-ring-bg" cx="22" cy="22" r={R} />
            <circle className="sv-wf-ring-fg" cx="22" cy="22" r={R} style={{ strokeDasharray: C, strokeDashoffset: C * (1 - pct / 100), stroke: brand || undefined }} />
          </svg>
          <div className="sv-wf-ring-txt"><b>{pct}%</b><span>Overall</span></div>
        </div>
      </div>

      <div className="sv-wf-track">
        {steps.map((st, i) => {
          const Icon = STAGE_ICONS[i] || FileText;
          const done = currentIndex > i, current = currentIndex === i;
          const m = stepMeta[st.key];
          const revs = revisionsByStage[st.key] || [];
          const state = done ? "done" : current ? "current" : "todo";
          const badge = done ? "Completed" : current ? (revs.length ? "Revision" : (statusLabel || "In Progress")) : "Pending";
          const badgeCls = done ? "done" : current ? (revs.length ? "rev" : "current") : "todo";
          return (
            <div key={st.key} className={`sv-wf-col is-${state}`} style={{ "--sc": (current && brand) ? brand : st.color }}>
              <div className="sv-wf-node">
                {i > 0 && <span className={`sv-wf-line${done || current ? " is-fill" : ""}`} />}
                <span className="sv-wf-dot">{done ? <Check size={16} /> : <Icon size={15} />}</span>
                <span className="sv-wf-num">{i + 1}</span>
              </div>
              <div className="sv-wf-title">{st.label}</div>
              <span className={`sv-wf-badge is-${badgeCls}`}>{badge}</span>
              {(done || current) && m && <div className="sv-wf-time">{m.actor}{m.time ? " · " + m.time : ""}</div>}
              {revs.length > 0 && (
                <div className="sv-wf-revs">
                  {revs.map((r) => (
                    <span key={r.n} className="sv-wf-rev" title={`${r.reason || "Rework"}${r.time ? " — " + r.time : ""}`}>
                      <RotateCcw size={11} /> R{r.n}{r.by ? " · " + r.by : ""}
                    </span>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* Build a { [stageKey]: [{n,reason,by,time}] } map from design activity.
   A "changes requested" message is attributed to the stage it was sent back to
   (the next status change after it), falling back to the current stage. */
export function buildRevisions(activity, projectId, stepOf, currentStatus) {
  const acts = (activity || []).filter((a) => a.projectId === projectId)
    .slice().sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)));
  const out = {};
  for (let i = 0; i < acts.length; i++) {
    const a = acts[i];
    const isChange = (a.type === "message" || a.type === "revision") && /changes requested|revision/i.test(a.comment || "");
    if (!isChange) continue;
    let stg = null;
    for (let j = i + 1; j < acts.length; j++) { if (acts[j].type === "status") { stg = stepOf(acts[j].meta); break; } }
    if (!stg) stg = stepOf(currentStatus);
    out[stg] = out[stg] || [];
    out[stg].push({
      n: out[stg].length + 1,
      reason: (a.comment || "").replace(/^🔄\s*Changes requested:\s*/i, ""),
      by: a.actorName || "",
      time: a.createdAt ? new Date(a.createdAt).toLocaleString() : "",
    });
  }
  return out;
}
