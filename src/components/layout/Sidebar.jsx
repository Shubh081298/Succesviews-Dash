/**
 * Sidebar.jsx
 * Shared nav column used by BOTH portals. Purely presentational and
 * role-agnostic — it renders whatever nav/footer items it is given.
 * Nav items carry a Lucide `icon` element + `label`, and an optional
 * numeric `badge` (e.g. pending leave count) rendered as a pill.
 */
import { Avatar } from "../ui";
import { Moon, Sun, LogOut } from "lucide-react";

export default function Sidebar({ logo, brandTitle, brandSubtitle, brandPhoto, nav, active, onSelect, onSignOut, theme, onToggleTheme, footerExtra, hideAvatar, profileVariant }) {
  return (
    <aside className={`sv-sidebar${theme === "dark" ? " sv-sidebar--dark" : ""}`}>
      <div className="sv-sidebar-brand">
        <div className="sv-sidebar-logo">
          <img src={logo} alt="Logo" />
        </div>
      </div>
      <div className={`sv-sidebar-identity sv-sidebar-user-card${profileVariant ? ` sv-sidebar-user-card--${profileVariant}` : ""}`}>
        {!hideAvatar && <Avatar name={brandTitle} photo={brandPhoto} size={38} />}
        <div style={{ minWidth: 0 }}>
          <div className="sv-sidebar-name sv-truncate">{brandTitle}</div>
          {brandSubtitle && <div className="sv-sidebar-sub sv-truncate">{brandSubtitle}</div>}
        </div>
      </div>
      <nav className="sv-sidebar-nav">
        {nav.map((n) => (
          <button
            key={n.key}
            className={`sv-nav-btn ${active === n.key ? "sv-nav-btn--active" : ""}`}
            onClick={() => onSelect(n.key)}
          >
            {n.icon && <span className="sv-nav-icon">{n.icon}</span>}
            <span className="sv-nav-label">{n.label}</span>
            {n.badge ? <span className="sv-nav-badge">{n.badge}</span> : null}
          </button>
        ))}
      </nav>
      <div className="sv-sidebar-footer">
        <button className="sv-nav-btn sv-nav-btn--ghost" onClick={onToggleTheme}>
          <span className="sv-nav-icon">{theme === "light" ? <Moon size={17} /> : <Sun size={17} />}</span>
          <span className="sv-nav-label">{theme === "light" ? "Dark Mode" : "Light Mode"}</span>
        </button>
        {footerExtra}
        <button className="sv-nav-btn sv-nav-btn--ghost" onClick={onSignOut}>
          <span className="sv-nav-icon"><LogOut size={17} /></span>
          <span className="sv-nav-label">Sign Out</span>
        </button>
      </div>
    </aside>
  );
}
