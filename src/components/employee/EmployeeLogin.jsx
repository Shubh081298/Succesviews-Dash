import { useState } from "react";
import { User, CheckSquare, Target, Lock, Eye, EyeOff, ArrowRight, ShieldCheck } from "lucide-react";
import logo from "../../assets/successviews-logo.png";

/**
 * EmployeeLogin — the Employee Portal's only entry point.
 *
 * Email + password sign in (Supabase Auth), a Remember Me option, and
 * a Forgot Password link that emails a reset link. This screen, and the
 * Employee Portal as a whole, must contain zero admin functionality —
 * the Admin Console link here only routes to /admin/login, it grants no access.
 *
 * Visual redesign only: premium two-panel SaaS layout that matches the
 * Admin Login page. Auth props, logic, and routes are unchanged.
 */
const FEATURES = [
  { Ic: User, bg: "#EFF6FF", fg: "#2563EB", title: "My Pipeline", desc: "Track your clients and deal progress." },
  { Ic: CheckSquare, bg: "#ECFDF5", fg: "#0D9488", title: "My Tasks", desc: "Stay on top of your daily activities." },
  { Ic: Target, bg: "#FFF7ED", fg: "#EA580C", title: "My Performance", desc: "View your targets and achievements." },
];

export default function EmployeeLogin({
  email, setEmail,
  password, setPassword,
  remember, setRemember,
  onLogin, onForgot, busy,
}) {
  const [showPwd, setShowPwd] = useState(false);

  return (
    <div className="sv-auth">
      <div className="sv-auth-card">
        {/* ── Left: branding ── */}
        <div className="sv-auth-left">
          <div className="sv-auth-deco" aria-hidden>
            <span className="blob" /><span className="ring r1" /><span className="ring r2" />
            <span className="conc" /><span className="dots" />
          </div>
          <div className="sv-auth-logo"><img src={logo} alt="SuccessViews" /></div>
          <h1 className="sv-auth-hello">Welcome<span className="accent">back!</span></h1>
          <div className="sv-auth-quote">
            <span className="qm">“</span>
            <p>Every step you take today brings your goals closer.</p>
          </div>
          <p className="sv-auth-lead">Manage your clients, update your progress, and achieve more every day.</p>
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
          <h2 className="sv-auth-h">Sign in to Employee Portal</h2>
          <p className="sv-auth-sub">Enter your credentials to access your workspace</p>

          <label className="sv-auth-field">
            <span>Employee ID</span>
            <span className="sv-auth-inp">
              <User size={16} />
              <input type="text" placeholder="Enter employee ID or email" autoComplete="username"
                value={email} onChange={(e) => setEmail(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") onLogin(); }} />
            </span>
          </label>

          <label className="sv-auth-field">
            <span>Password</span>
            <span className="sv-auth-inp">
              <Lock size={16} />
              <input type={showPwd ? "text" : "password"} placeholder="Enter your password" autoComplete="current-password"
                value={password} onChange={(e) => setPassword(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") onLogin(); }} />
              <button type="button" className="eye" onClick={() => setShowPwd((v) => !v)} aria-label={showPwd ? "Hide password" : "Show password"}>{showPwd ? <EyeOff size={16} /> : <Eye size={16} />}</button>
            </span>
          </label>

          <div className="sv-auth-row">
            <label className="sv-auth-remember">
              <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
              <span>Remember me</span>
            </label>
            <button type="button" className="sv-auth-link" onClick={onForgot}>Forgot password?</button>
          </div>

          <button className="sv-auth-btn sv-auth-btn--teal" onClick={onLogin} disabled={busy}>
            {busy ? "Signing in…" : <>Sign In <ArrowRight size={17} /></>}
          </button>

          <div className="sv-auth-or">or</div>
          <div className="sv-auth-secure">
            <span className="s1"><ShieldCheck size={15} /> Your data is secure with us.</span>
            <p className="s2">We never share your information with anyone.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
