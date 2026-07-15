import { CHART_COLORS } from "../../utils/constants.js";

/**
 * Avatar — circular employee avatar. Renders the uploaded photo if
 * present, otherwise a colored circle with initials. Accepts either an
 * `emp` object or loose `name`/`photo` props.
 */
export default function Avatar({ emp, name, photo, idx = 0, size = 32 }) {
  const displayName = emp?.name ?? name ?? "";
  const displayPhoto = emp?.photo ?? photo ?? "";
  const color = CHART_COLORS[idx % CHART_COLORS.length];
  const initials = displayName
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  if (displayPhoto) {
    return (
      <img
        src={displayPhoto}
        alt={displayName}
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
