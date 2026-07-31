/**
 * ResetPasswordPage.jsx — routed at /reset-password.
 * ─────────────────────────────────────────────────────────────
 * Landing page for the Supabase password-reset email link. Supabase
 * detects the recovery token in the URL and creates a temporary
 * session; the user then sets a new password here. We also mirror the
 * new value into employees.password_plain so the admin's "current
 * password" view stays accurate after a self-service reset.
 */
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../utils/supabaseClient";
import { updateCurrentUserPassword } from "../../utils/auth";
import logo from "../../assets/successviews-logo.png";

export default function ResetPasswordPage() {
  const [ready, setReady] = useState(false);
  const [pwd, setPwd] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [done, setDone] = useState(false);
  const navigate = useNavigate();

  // Wait for Supabase to establish the recovery session from the URL.
  useEffect(() => {
    let active = true;
    supabase.auth.getSession().then(({ data }) => {
      if (active && data?.session) setReady(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (active && session && (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN")) {
        setReady(true);
      }
    });
    return () => { active = false; sub?.subscription?.unsubscribe?.(); };
  }, []);

  const submit = async () => {
    if (pwd.length < 6) { setMsg("Password must be at least 6 characters."); return; }
    if (pwd !== confirm) { setMsg("Passwords do not match."); return; }
    setBusy(true);
    setMsg("");
    const res = await updateCurrentUserPassword(pwd);
    if (res.success) {
      if (res.email) {
        try {
          // Keep the employees table's bcrypt hash in sync (no plaintext is ever stored).
          const { hashPassword } = await import("../../utils/auth");
          const password_hash = await hashPassword(pwd);
          await supabase.from("employees").update({ password_hash }).eq("email", res.email);
        } catch (e) { /* non-fatal */ }
      }
      setDone(true);
    } else {
      setMsg(res.error || "Could not update password. Request a new reset link.");
    }
    setBusy(false);
  };

  return (
    <div className="sv-login-wrap">
      <div className="sv-login-card">
        <div className="sv-login-logo">
          <img src={logo} alt="SuccessViews" />
        </div>
        <p className="sv-login-subtitle">Reset Password</p>

        {done ? (
          <>
            <p style={{ fontSize: 13.5, color: "#475569", marginBottom: 16 }}>
              ✅ Your password has been updated. You can now sign in with your new password.
            </p>
            <button className="sv-btn sv-btn--sign-in sv-btn--full" onClick={() => navigate("/", { replace: true })}>
              Go to Sign In
            </button>
          </>
        ) : !ready ? (
          <p style={{ fontSize: 13.5, color: "#475569" }}>
            Validating your reset link… If this doesn't proceed, request a new reset email.
          </p>
        ) : (
          <>
            <label className="sv-label">🔒 New Password</label>
            <input
              type="password"
              className="sv-input"
              value={pwd}
              onChange={(e) => setPwd(e.target.value)}
              style={{ marginBottom: 12 }}
            />
            <label className="sv-label">🔒 Confirm New Password</label>
            <input
              type="password"
              className="sv-input"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") submit(); }}
              style={{ marginBottom: 14 }}
            />
            {msg && <p style={{ fontSize: 12.5, color: "#DC2626", marginBottom: 10 }}>{msg}</p>}
            <button className="sv-btn sv-btn--sign-in sv-btn--full" onClick={submit} disabled={busy}>
              {busy ? "Updating…" : "Update Password"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
