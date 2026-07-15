import { useState } from "react";

/**
 * ClickCard — premium clickable KPI tile that opens a drill-down DetailModal.
 * Visual redesign: colored icon chip + accent, larger number, hover lift.
 * (Purely presentational; the whole tile stays clickable — no logic change.)
 */
export default function ClickCard({ label, value, icon, color, sub, onClick }) {
  const [hov, setHov] = useState(false);
  return (
    <div
      className="sv-card sv-kpi-tile"
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{ cursor: "pointer", userSelect: "none", "--accent": color, transform: hov ? "translateY(-4px)" : "none" }}
    >
      <div className="sv-flex sv-justify-between" style={{ alignItems: "flex-start", gap: 10 }}>
        <div style={{ minWidth: 0 }}>
          <div className="sv-kpi-tile-value">{value}</div>
          <div className="sv-kpi-tile-label">{label}</div>
          {sub && <div className="sv-text-muted sv-text-xs" style={{ marginTop: 3 }}>{sub}</div>}
        </div>
        <div className="sv-kpi-tile-icon" style={{ background: `${color}1A`, color }}>{icon}</div>
      </div>
    </div>
  );
}
