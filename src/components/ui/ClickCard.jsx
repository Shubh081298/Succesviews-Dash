/**
 * ClickCard — calm, analytical KPI tile (Stripe / Ramp / Notion Analytics style).
 * Light pastel gradient, frosted circular icon, dark text with an accent-coloured
 * number, large pill-style radius, soft shadow, hover lift + staggered entry.
 * Deliberately distinct from the vibrant, square Client Pipeline cards.
 */
export default function ClickCard({ label, value, icon, c1, c2, accent, color, sub, onClick, idx = 0 }) {
  const from = c1 || "#F1F5F9";
  const to = c2 || "#E2E8F0";
  const ac = accent || color || "#2563EB";
  return (
    <button
      type="button"
      className="sv-kpi-tile"
      onClick={onClick}
      style={{ "--c1": from, "--c2": to, "--accent": ac, animationDelay: `${idx * 55}ms` }}
    >
      <span className="sv-kpi-tile-icon">{icon}</span>
      <span className="sv-kpi-tile-value">{value}</span>
      <span className="sv-kpi-tile-label">{label}</span>
      {sub && <span className="sv-kpi-tile-sub">{sub}</span>}
    </button>
  );
}
