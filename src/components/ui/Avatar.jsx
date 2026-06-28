import { CHART_COLORS } from "../../utils/constants.js";

/**
 * Avatar — circular employee avatar.
 * Renders the employee's uploaded photo if present, otherwise falls
 * back to a colored circle with their initials. The color is picked
 * deterministically from CHART_COLORS based on list index, so the
 * same employee gets a consistent color across renders.
 */
export default function Avatar({ emp, idx = 0, size = 32 }) {
  const color = CHART_COLORS[idx % CHART_COLORS.length];
  const initials = (emp?.name || "")
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  if (emp?.photo) {
    return (
      <img
        src={emp.photo}
        alt={emp.name}
        className="sv-avatar"
        style={{ width: size, height: size, border: `1.5px solid ${color}` }}
      />
    );
  }
  return (
    <div
      className="sv-avatar"
      style={{ width: size, height: size, background: color, fontSize: size * 0.38 }}
    >
      {initials}
    </div>
  );
}
