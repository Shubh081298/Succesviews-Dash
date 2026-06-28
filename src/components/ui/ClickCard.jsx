import { useState } from "react";

/**
 * ClickCard — clickable metric tile that opens a drill-down DetailModal.
 * Used in the Overview tab's "Employee Activity" / "Client Activity"
 * sections. Hover state lifts the card and tints its shadow with `color`.
 */
export default function ClickCard({ label, value, icon, color, sub, onClick }) {
  const [hov, setHov] = useState(false);
  return (
    <div
      className="sv-card"
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        borderTop: `3px solid ${color}`,
        padding: "16px 18px",
        cursor: "pointer",
        boxShadow: hov ? `0 8px 24px ${color}28` : undefined,
        transform: hov ? "translateY(-3px)" : "none",
        transition: "all 0.18s ease",
        userSelect: "none",
      }}
    >
      <div className="sv-flex sv-justify-between" style={{ alignItems: "flex-start", marginBottom: 6 }}>
        <div className="sv-text-navy sv-font-800" style={{ fontSize: 28, lineHeight: 1 }}>{value}</div>
        <div style={{ fontSize: 24 }}>{icon}</div>
      </div>
      <div className="sv-font-700" style={{ fontSize: 12.5, color: "#64748B", marginBottom: 2 }}>{label}</div>
      {sub && <div className="sv-text-muted sv-text-xs" style={{ marginBottom: 4 }}>{sub}</div>}
      <div className="sv-font-700 sv-text-xs" style={{ color }}>View details →</div>
    </div>
  );
}
