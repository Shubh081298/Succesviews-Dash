/**
 * AdminLoginPage.jsx — routed at /admin/login.
 * ─────────────────────────────────────────────────────────────
 * The Admin Portal's own, standalone login page. Fully separate from
 * the Employee Portal login. Forgot Password uses a magic link: we email
 * a one-click sign-in link to the registered admin address; when the
 * admin returns via that link (now holding a Supabase session for that
 * email) we let them set a new admin password. This works on Supabase's
 * default email template — no custom SMTP or token edit needed.
 *
 * Visual redesign only: premium two-panel SaaS layout. Auth logic,
 * routes, and the magic-link flow are unchanged.
 */
import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Users, BarChart3, DollarSign, Mail, Lock, Eye, EyeOff, ArrowRight, ShieldCheck } from "lucide-react";
import { useAppData } from "../../data/AppDataContext";
import { useAdminAuth } from "./AdminAuthContext";
import { supabase } from "../../utils/supabaseClient";
import { adminSendMagicLink } from "../../utils/auth";
import LoginSuccess from "../../components/ui/LoginSuccess";
import logo from "../../assets/successviews-logo.png";

export default function AdminLoginPage() {
  const { adminPwd, setAdminPwd, adminEmail, showToast, logAudit } = useAppData();
  const { adminLoggedIn, setAdminLoggedIn } = useAdminAuth();
  const [pwdInput, setPwdInput] = useState("");
  const [adminIdInput, setAdminIdInput] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [success, setSuccess] = useState(false);
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
      setPwdInput("");
      logAudit && logAudit("login", "admin", "admin", { portal: "admin" });
      // Show the centered success modal on the login page, then redirect.
      setSuccess(true);
      setTimeout(() => { setAdminLoggedIn(true); navigate("/admin", { replace: true }); }, 1300);
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

  const FEATURES = [
    { Ic: Users, bg: "#EFF6FF", fg: "#2563EB", title: "Client Pipeline", desc: "Track and manage every client stage." },
    { Ic: BarChart3, bg: "#ECFDF5", fg: "#0D9488", title: "Team Performance", desc: "Monitor goals and team productivity." },
    { Ic: DollarSign, bg: "#FFF7ED", fg: "#EA580C", title: "Sales & Payments", desc: "Analyze sales and payment collections." },
  ];

  return (
    <div className="sv-auth">
      {success && <LoginSuccess message="Admin access granted" />}
      <div className="sv-auth-card">
        {/* ── Left: branding ── */}
        <div className="sv-auth-left">
          <div className="sv-auth-deco" aria-hidden>
            <span className="blob" /><span className="ring r1" /><span className="ring r2" />
            <span className="conc" /><span className="dots" />
          </div>
          <div className="sv-auth-logo"><img src={logo} alt="SuccessViews" /></div>
          <h1 className="sv-auth-hello">Welcome back,<span className="accent">Admin!</span></h1>
          <div className="sv-auth-quote">
            <span className="qm">“</span>
            <p>Leadership is the capacity to translate vision into reality.</p>
          </div>
          <p className="sv-auth-lead">Oversee your team, track performance, and drive success together.</p>
          <div className="sv-auth-cards">
            {FEATURES.map(({ Ic, bg, fg, title, desc }) => (
              <div key={title} className="sv-auth-fcard">
                <span className="ic" style={{ background: bg, color: fg }}><Ic size={17} /></span>
                <h4>{title}</h4><p>{desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* ── Right: authentication ── */}
        <div className="sv-auth-right">
          {!forgot ? (
            <>
              <h2 className="sv-auth-h">Sign in to Admin Console</h2>
              <p className="sv-auth-sub">Enter your credentials to access the dashboard</p>

              <label className="sv-auth-field">
                <span>Email or Admin ID</span>
                <span className="sv-auth-inp">
                  <Mail size={16} />
                  <input type="text" placeholder="Enter email or admin ID" value={adminIdInput} onChange={(e) => setAdminIdInput(e.target.value)} autoComplete="username" />
                </span>
              </label>

              <label className="sv-auth-field">
                <span>Password</span>
                <span className="sv-auth-inp">
                  <Lock size={16} />
                  <input type={showPwd ? "text" : "password"} placeholder="Enter your password" value={pwdInput} autoFocus
                    onChange={(e) => setPwdInput(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") handleSubmit(); }} autoComplete="current-password" />
                  <button type="button" className="eye" onClick={() => setShowPwd((v) => !v)} aria-label={showPwd ? "Hide password" : "Show password"}>{showPwd ? <EyeOff size={16} /> : <Eye size={16} />}</button>
                </span>
              </label>

              <div className="sv-auth-row" style={{ justifyContent: "flex-end" }}>
                <button type="button" className="sv-auth-link" onClick={() => setForgot(true)}>Forgot password?</button>
              </div>

              <button className="sv-auth-btn" onClick={handleSubmit}>Sign In <ArrowRight size={17} /></button>

              <div className="sv-auth-or">or</div>
              <div className="sv-auth-secure">
                <span className="s1"><ShieldCheck size={15} /> Your data is secure with us.</span>
                <p className="s2">We never share your information with anyone.</p>
              </div>
            </>
          ) : (
            <>
              <h2 className="sv-auth-h">Reset Admin Password</h2>
              <p className="sv-auth-sub">Recover access to the Admin Console</p>

              {step === "send" && (
                <>
                  <p style={{ fontSize: 12.5, color: "#475569", margin: "0 0 16px", lineHeight: 1.5 }}>
                    We'll email a one-click sign-in link to the registered admin address
                    {adminEmail ? ` (${adminEmail})` : ""}. Open it in this browser to set a new password.
                  </p>
                  <button className="sv-auth-btn" onClick={sendLink} disabled={busy}>{busy ? "Sending…" : "Email me a sign-in link"}</button>
                </>
              )}

              {step === "sent" && (
                <p style={{ fontSize: 13, color: "#475569", margin: "0 0 8px", lineHeight: 1.5 }}>
                  Check <strong>{adminEmail}</strong> and open the sign-in link in this browser.
                  You'll come back here to set a new admin password.
                </p>
              )}

              {step === "setpwd" && (
                <>
                  <p style={{ fontSize: 12.5, color: "#475569", margin: "0 0 16px" }}>Verified via email. Set a new admin password.</p>
                  <label className="sv-auth-field">
                    <span>New Admin Password</span>
                    <span className="sv-auth-inp">
                      <Lock size={16} />
                      <input type={showPwd ? "text" : "password"} placeholder="Enter new password" value={newPwd} autoFocus onChange={(e) => setNewPwd(e.target.value)} />
                      <button type="button" className="eye" onClick={() => setShowPwd((v) => !v)} aria-label="Toggle password">{showPwd ? <EyeOff size={16} /> : <Eye size={16} />}</button>
                    </span>
                  </label>
                  <label className="sv-auth-field">
                    <span>Confirm New Password</span>
                    <span className="sv-auth-inp">
                      <Lock size={16} />
                      <input type={showPwd ? "text" : "password"} placeholder="Re-enter new password" value={confirmPwd}
                        onChange={(e) => setConfirmPwd(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") saveNewPwd(); }} />
                    </span>
                  </label>
                  <button className="sv-auth-btn" onClick={saveNewPwd} disabled={busy}>{busy ? "Saving…" : "Update Admin Password"}</button>
                </>
              )}

              <div className="sv-auth-row" style={{ justifyContent: "center", marginTop: 16 }}>
                <button type="button" className="sv-auth-link" onClick={backToLogin}>← Back to sign in</button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
