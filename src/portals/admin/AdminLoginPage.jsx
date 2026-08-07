/**
 * AdminLoginPage.jsx — routed at /admin/login.
 * ─────────────────────────────────────────────────────────────
 * The Admin Portal's own, standalone login page. Fully separate from
 * the Employee Portal login. Forgot Password uses a magic link: we email
 * a one-click sign-in link to the registered admin address; when the
 * admin returns via that link (now holding a Supabase session for that
 * email) we let them set a new admin password. This works on Supabase's
 * default email template — no custom SMTP or token edit needed.
 */
import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAppData } from "../../data/AppDataContext";
import { useAdminAuth } from "./AdminAuthContext";
import { supabase } from "../../utils/supabaseClient";
import { adminSendMagicLink } from "../../utils/auth";
import logo from "../../assets/successviews-logo.png";

export default function AdminLoginPage() {
  const { adminPwd, setAdminPwd, adminEmail, showToast, logAudit } = useAppData();
  const { adminLoggedIn, setAdminLoggedIn } = useAdminAuth();
  const [pwdInput, setPwdInput] = useState("");
  const navigate = useNavigate();
  const location = useLocation();

  // Forgot-password (magic link) state.
  const [forgot, setForgot] = useState(false);
  const [step, setStep] = useState("send"); // send -> sent -> setpwd
  const [newPwd, setNewPwd] = useState("");
  const [confirmPwd, setConfirmPwd] = useState("");
  const [busy, setBusy] = useState(false);

  // If the admin arrived back via the magic link, a Supabase session now
  // exists for the admin email — jump straight to the set-password step.
  useEffect(() => {
    let active = true;
    (async () => {
      const { data } = await supabase.auth.getSession();
      const email = data?.session?.user?.email;
      if (!active || !email || !adminEmail) return;
      if (email.toLowerCase() === adminEmail.toLowerCase()) {
        setForgot(true);
        setStep("setpwd");
      }
    })();
    return () => { active = false; };
  }, [adminEmail]);

  if (adminLoggedIn && !forgot) {
    const redirectTo = location.state?.from || "/admin";
    navigate(redirectTo, { replace: true });
    return null;
  }

  const handleSubmit = async () => {
    // Password is verified INSIDE the database (SECURITY DEFINER RPC), so the
    // admin password is never downloaded to the browser.
    let okPwd = false;
    try {
      const { data } = await supabase.rpc("admin_login", { p_password: pwdInput });
      okPwd = data === true;
    } catch (e) { /* ignore */ }
    if (okPwd) {
      setAdminLoggedIn(true);
      setPwdInput("");
      logAudit && logAudit("login", "admin", "admin", { portal: "admin" });
      showToast("Admin access granted.", "success");
      navigate("/admin", { replace: true });
    } else {
      showToast("Incorrect admin password.", "error");
    }
  };

  const sendLink = async () => {
    if (!adminEmail) {
      showToast("No admin email is configured. Add an 'admin_email' setting first.", "error");
      return;
    }
    setBusy(true);
    const res = await adminSendMagicLink(adminEmail);
    setBusy(false);
    if (res.success) { setStep("sent"); showToast(`Sign-in link sent to ${adminEmail}.`, "success"); }
    else showToast(res.error || "Could not send the link.", "error");
  };

  const saveNewPwd = async () => {
    if (!newPwd || newPwd.length < 4) { showToast("New password must be at least 4 characters.", "error"); return; }
    if (newPwd !== confirmPwd) { showToast("Passwords do not match.", "error"); return; }
    setBusy(true);
    await setAdminPwd(newPwd);
    try { await supabase.auth.signOut(); } catch (e) { /* ignore */ }
    setBusy(false);
    showToast("Admin password updated. Sign in with your new password.", "success");
    setForgot(false); setStep("send"); setNewPwd(""); setConfirmPwd("");
  };

  const backToLogin = async () => {
    try { await supabase.auth.signOut(); } catch (e) { /* ignore */ }
    setForgot(false); setStep("send"); setNewPwd(""); setConfirmPwd("");
  };

  return (
    <div className="sv-login-wrap">
      <div className="sv-login-card">
        <div className="sv-login-logo">
          <img src={logo} alt="SuccessViews" />
        </div>
        <p className="sv-login-subtitle">Admin Console</p>

        {!forgot ? (
          <>
            <label className="sv-label">🔑 Admin Password</label>
            <input
              type="password"
              className="sv-input"
              value={pwdInput}
              onChange={(e) => setPwdInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleSubmit(); }}
              autoFocus
              style={{ marginBottom: 12 }}
            />
            <div className="sv-login-row" style={{ justifyContent: "flex-end" }}>
              <button type="button" className="sv-link-btn" onClick={() => setForgot(true)}>
                Forgot password?
              </button>
            </div>
            <button className="sv-btn sv-btn--sign-in sv-btn--full" onClick={handleSubmit}>
              Sign In to Admin Console
            </button>
          </>
        ) : (
          <>
            {step === "send" && (
              <>
                <p style={{ fontSize: 12.5, color: "#475569", marginBottom: 12 }}>
                  We'll email a one-click sign-in link to the registered admin address
                  {adminEmail ? ` (${adminEmail})` : ""}. Open it in this browser to set a new password.
                </p>
                <button className="sv-btn sv-btn--sign-in sv-btn--full" onClick={sendLink} disabled={busy}>
                  {busy ? "Sending…" : "Email me a sign-in link"}
                </button>
              </>
            )}

            {step === "sent" && (
              <p style={{ fontSize: 13, color: "#475569", marginBottom: 8 }}>
                ✅ Check <strong>{adminEmail}</strong> and open the sign-in link in this browser.
                You'll come back here to set a new admin password.
              </p>
            )}

            {step === "setpwd" && (
              <>
                <p style={{ fontSize: 12.5, color: "#475569", marginBottom: 12 }}>
                  Verified via email. Set a new admin password.
                </p>
                <label className="sv-label">🔒 New Admin Password</label>
                <input
                  type="password"
                  className="sv-input"
                  value={newPwd}
                  onChange={(e) => setNewPwd(e.target.value)}
                  autoFocus
                  style={{ marginBottom: 10 }}
                />
                <label className="sv-label">🔒 Confirm New Password</label>
                <input
                  type="password"
                  className="sv-input"
                  value={confirmPwd}
                  onChange={(e) => setConfirmPwd(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") saveNewPwd(); }}
                  style={{ marginBottom: 12 }}
                />
                <button className="sv-btn sv-btn--sign-in sv-btn--full" onClick={saveNewPwd} disabled={busy}>
                  {busy ? "Saving…" : "Update Admin Password"}
                </button>
              </>
            )}

            <div className="sv-login-row" style={{ justifyContent: "center", marginTop: 12 }}>
              <button type="button" className="sv-link-btn" onClick={backToLogin}>
                ← Back to sign in
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
