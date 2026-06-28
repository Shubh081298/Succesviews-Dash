/**
 * Sidebar.jsx
 * ─────────────────────────────────────────────────────────────
 * Shared 232px nav column shell used by BOTH portals so they stay
 * visually consistent. This component is purely presentational and
 * role-agnostic — it has no knowledge of "admin" or "employee", it
 * just renders whatever nav/footer items it's given. The Employee
 * Portal and Admin Portal each supply their own nav lists and footer
 * buttons; neither portal's content leaks into the other through
 * this file.
 */
import { Avatar } from "../ui";

export default function Sidebar({ logo, brandTitle, brandSubtitle, nav, active, onSelect, onSignOut, theme, onToggleTheme, footerExtra }) {
  return (
    <aside className="sv-sidebar">
      <div className="sv-sidebar-brand">
        <img src={logo} alt="Logo" className="sv-sidebar-logo" />
      </div>
      <div className="sv-sidebar-identity">
        <Avatar name={brandTitle} />
        <div>
          <div className="sv-sidebar-name">{brandTitle}</div>
          <div className="sv-sidebar-sub">{brandSubtitle}</div>
        </div>
      </div>
      <nav className="sv-sidebar-nav">
        {nav.map((n) => (
          <button
            key={n.key}
            className={`sv-nav-btn ${active === n.key ? "sv-nav-btn--active" : ""}`}
            onClick={() => onSelect(n.key)}
          >
            {n.label}
          </button>
        ))}
      </nav>
      <div className="sv-sidebar-footer">
        <button className="sv-nav-btn sv-nav-btn--ghost" onClick={onToggleTheme}>
          {theme === "light" ? "🌙 Dark Mode" : "☀️ Light Mode"}
        </button>
        {footerExtra}
        <button className="sv-nav-btn sv-nav-btn--ghost" onClick={onSignOut}>🚪 Sign Out</button>
      </div>
    </aside>
  );
}
