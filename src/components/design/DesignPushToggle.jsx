/* Small "Enable push notifications" control for the Design section (admin + designer).
   Non-intrusive: a single button. Registers the Service Worker + push subscription for THIS device
   and stores it in Supabase against the given user. Hidden on browsers without push support. */
import { useEffect, useState } from "react";
import { Bell } from "lucide-react";
import { getPushState, enablePush, disablePush, pushSupported, pushConfigured } from "../../utils/push";

export default function DesignPushToggle({ userId, role }) {
  const [st, setSt] = useState({ supported: true, configured: true, permission: "default", subscribed: false });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const refresh = () => getPushState().then(setSt).catch(() => {});
  useEffect(() => { refresh(); }, []);

  if (!pushSupported()) return null; // browser can't do web push — don't clutter the UI

  const blocked = st.permission === "denied";
  const on = st.subscribed && st.permission === "granted";
  const configured = pushConfigured();

  const toggle = async () => {
    setMsg("");
    setBusy(true);
    if (on) {
      await disablePush();
    } else {
      const r = await enablePush(userId, role);
      if (!r.ok) {
        setMsg(r.reason === "not-configured" ? "Push isn't set up yet (missing VAPID key)."
          : r.reason === "blocked" ? "Blocked in browser settings — allow notifications for this site, then try again."
          : r.reason === "save-failed" ? "Couldn't save subscription."
          : "Couldn't enable push.");
      }
    }
    await refresh();
    setBusy(false);
  };

  const label = !configured ? "Push unavailable" : blocked ? "Push blocked" : on ? "Push on" : "Enable push";
  const title = blocked
    ? "Notifications are blocked for this site in your browser settings. Allow them, then try again."
    : "Real push notifications for Design updates — arrive even when the dashboard is closed.";

  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
      <button className={`sv-btn sv-btn--sm ${on ? "sv-btn--primary" : "sv-btn--outline"}`} onClick={toggle} disabled={busy || blocked || !configured} title={title}>
        <Bell size={15} /> {busy ? "…" : label}
      </button>
      {msg ? <span className="sv-text-muted" style={{ fontSize: 11, maxWidth: 220 }}>{msg}</span> : null}
    </span>
  );
}
