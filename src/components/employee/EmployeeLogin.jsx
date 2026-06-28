import FormLabel from "./FormLabel.jsx";
import { empLabel } from "../../utils/helpers.js";
import logo from "../../assets/successviews-logo.png";

/**
 * EmployeeLogin — the Employee Portal's only entry point.
 *
 * This screen, and the Employee Portal as a whole, must contain zero
 * admin buttons, links, or functionality. Admin access lives entirely
 * outside this portal at its own dedicated route (/admin/login) — it
 * is never reachable from here.
 */
export default function EmployeeLogin({ employees, loginSel, setLoginSel, loginPwd, setLoginPwd, onLogin }) {
  return (
    <div className="sv-login-wrap">
      <div className="sv-login-card">
        <div className="sv-login-logo">
          <img src={logo} alt="SuccessViews" />
        </div>
        <p className="sv-login-subtitle">Employee Daily Reporting</p>

        <FormLabel text="👤 Employee Name" />
        {/* value/onChange bind to the employee's id (loginSel), matching
            handleLogin's `employees.find(e => e.id === loginSel)` lookup
            in EmployeePortal.jsx — keep these two in sync if either side changes. */}
        <select
          className="sv-select"
          value={loginSel}
          onChange={(e) => setLoginSel(e.target.value)}
          style={{ marginBottom: 12 }}
        >
          <option value="">-- Select Your Name --</option>
          {employees.map((e) => (
            <option key={e.id} value={e.id}>{empLabel(e)}</option>
          ))}
        </select>

        <FormLabel text="🔒 Password" />
        <input
          type="password"
          className="sv-input"
          value={loginPwd}
          onChange={(e) => setLoginPwd(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") onLogin(); }}
          style={{ marginBottom: 18 }}
        />

        <button className="sv-btn sv-btn--sign-in sv-btn--full" onClick={onLogin}>
          Sign In
        </button>
      </div>
    </div>
  );
}
