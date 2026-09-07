import { Check } from "lucide-react";

/**
 * LoginSuccess — a premium, centered success modal shown on the login page
 * immediately after a successful sign in, before the redirect completes.
 * Purely presentational; the caller controls when it mounts and when to redirect.
 */
export default function LoginSuccess({ message = "Login successful", sub = "Taking you to your dashboard…" }) {
  return (
    <div className="sv-lsuccess-overlay" role="status" aria-live="polite">
      <div className="sv-lsuccess-card">
        <span className="sv-lsuccess-check"><Check size={30} strokeWidth={3} /></span>
        <div className="sv-lsuccess-title">{message}</div>
        <div className="sv-lsuccess-sub">{sub}</div>
      </div>
    </div>
  );
}
