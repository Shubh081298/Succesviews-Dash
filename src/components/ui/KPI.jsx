/**
 * KPI — small metric card with an optional target/progress bar.
 * Used throughout Overview, Departments, and Analytics tabs.
 * `color` sets the left accent border and the progress-bar fill.
 */
export default function KPI({ label, value, icon, color, target, prefix = "" }) {
  const num = typeof value === "number" ? value : null;
  const pct = target && num != null ? Math.round(Math.min((num / target) * 100, 200)) : null;
  const pctClass = pct == null ? "" : pct >= 100 ? "sv-kpi-target--good" : pct >= 70 ? "sv-kpi-target--warning" : "sv-kpi-target--bad";

  return (
    <div className="sv-kpi-card" style={{ borderLeftColor: color }}>
      <div className="sv-flex sv-justify-between" style={{ alignItems: "flex-start" }}>
        <div>
          <p className="sv-kpi-label">{label}</p>
          <p className="sv-kpi-value">{prefix}{typeof value === "number" ? value.toLocaleString() : value}</p>
          {pct != null && <p className={`sv-kpi-target ${pctClass}`}>{pct}% of target</p>}
        </div>
        <div style={{ fontSize: 28 }}>{icon}</div>
      </div>
      {pct != null && (
        <div className="sv-kpi-bar-track">
          <div
            className="sv-kpi-bar-fill"
            style={{ width: `${Math.min(pct, 100)}%`, background: pct >= 100 ? "#22C55E" : pct >= 70 ? "#F59E0B" : color }}
          />
        </div>
      )}
    </div>
  );
}
