import FormLabel from "./FormLabel.jsx";
import logo from "../../assets/successviews-logo.png";

/**
 * EmployeeLogin — the Employee Portal's only entry point.
 *
 * Email + password sign in (Supabase Auth), a Remember Me option, and
 * a Forgot Password link that emails a reset link. This screen, and the
 * Employee Portal as a whole, must contain zero admin buttons, links, or
 * functionality. Admin access lives entirely outside this portal at its
 * own dedicated route (/admin/login) — it is never reachable from here.
 */
export default function EmployeeLogin({
  email, setEmail,
  password, setPassword,
  remember, setRemember,
  onLogin, onForgot, busy,
}) {
  return (
    <div className="sv-login-wrap">
      <div className="sv-login-card">
        <div className="sv-login-logo">
          <img src={logo} alt="SuccessViews" />
        </div>
        <p className="sv-login-subtitle">Employee Daily Reporting</p>

        <FormLabel text="✉️ Email" />
        <input
          type="email"
          className="sv-input"
          autoComplete="username"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") onLogin(); }}
          style={{ marginBottom: 12 }}
        />

        <FormLabel text="🔒 Password" />
        <input
          type="password"
          className="sv-input"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") onLogin(); }}
          style={{ marginBottom: 12 }}
        />

        <div className="sv-login-row">
          <label className="sv-remember">
            <input
              type="checkbox"
              checked={remember}
              onChange={(e) => setRemember(e.target.checked)}
            />
            <span>Remember me</span>
          </label>
          <button type="button" className="sv-link-btn" onClick={onForgot}>
            Forgot password?
          </button>
        </div>

        <button
          className="sv-btn sv-btn--sign-in sv-btn--full"
          onClick={onLogin}
          disabled={busy}
        >
          {busy ? "Signing in…" : "Sign In"}
        </button>
      </div>
    </div>
  );
}
