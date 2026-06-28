/**
 * AdminLoginPage.jsx — routed at /admin/login.
 * ─────────────────────────────────────────────────────────────
 * The Admin Portal's own, standalone login page. This is a fully
 * separate screen from the Employee Portal's login (no shared
 * component, no shared layout) — it is reached only by navigating
 * directly to /admin/login, never via a link inside the Employee
 * Portal.
 */
import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAppData } from "../../data/AppDataContext";
import { useAdminAuth } from "./AdminAuthContext";
import logo from "../../assets/successviews-logo.png";

export default function AdminLoginPage() {
  const { adminPwd, showToast } = useAppData();
  const { adminLoggedIn, setAdminLoggedIn } = useAdminAuth();
  const [pwdInput, setPwdInput] = useState("");
  const navigate = useNavigate();
  const location = useLocation();

  if (adminLoggedIn) {
    const redirectTo = location.state?.from || "/admin";
    navigate(redirectTo, { replace: true });
    return null;
  }

  const handleSubmit = () => {
    if (pwdInput === adminPwd) {
      setAdminLoggedIn(true);
      setPwdInput("");
      showToast("Admin access granted.", "success");
      navigate("/admin", { replace: true });
    } else {
      showToast("Incorrect admin password.", "error");
    }
  };

  return (
    <div className="sv-login-wrap">
      <div className="sv-login-card">
        <div className="sv-login-logo">
          <img src={logo} alt="SuccessViews" />
        </div>
        <p className="sv-login-subtitle">Admin Console</p>

        <label className="sv-label">🔑 Admin Password</label>
        <input
          type="password"
          className="sv-input"
          value={pwdInput}
          onChange={(e) => setPwdInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") handleSubmit(); }}
          autoFocus
          style={{ marginBottom: 18 }}
        />

        <button className="sv-btn sv-btn--sign-in sv-btn--full" onClick={handleSubmit}>
          Sign In to Admin Console
        </button>
      </div>
    </div>
  );
}
