/* Design push — client helpers (Web Push API + Service Worker).
   Registers /sw.js, creates a PushSubscription with the public VAPID key, and stores it in
   Supabase (design_push_subscriptions) keyed to the current user. Design-module only. */
import { supabase } from "./supabaseClient";

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY || "";

export const pushSupported = () =>
  typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;

export const pushConfigured = () => !!VAPID_PUBLIC_KEY;

function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

async function getRegistration() {
  const existing = await navigator.serviceWorker.getRegistration("/");
  if (existing) return existing;
  return navigator.serviceWorker.register("/sw.js", { scope: "/" });
}

// Current push state for UI: supported / configured / permission / already subscribed.
export async function getPushState() {
  const supported = pushSupported();
  const state = { supported, configured: pushConfigured(), permission: supported ? Notification.permission : "unsupported", subscribed: false };
  if (!supported) return state;
  try {
    const reg = await navigator.serviceWorker.getRegistration("/");
    const sub = reg ? await reg.pushManager.getSubscription() : null;
    state.subscribed = !!sub;
  } catch (e) { /* ignore */ }
  return state;
}

// Ask permission, register SW, subscribe, and save to Supabase for this user. Returns {ok, reason}.
export async function enablePush(userId, role) {
  if (!pushSupported()) return { ok: false, reason: "unsupported" };
  if (!pushConfigured()) return { ok: false, reason: "not-configured" };
  if (!userId) return { ok: false, reason: "no-user" };
  let perm = Notification.permission;
  if (perm === "default") perm = await Notification.requestPermission();
  if (perm !== "granted") return { ok: false, reason: perm === "denied" ? "blocked" : "dismissed" };
  try {
    const reg = await getRegistration();
    await navigator.serviceWorker.ready;
    let sub = await reg.pushManager.getSubscription();
    if (!sub) {
      sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY) });
    }
    const json = sub.toJSON();
    const { error } = await supabase.from("design_push_subscriptions").upsert(
      { user_id: String(userId), role: role || "", endpoint: sub.endpoint, subscription: json, user_agent: (navigator.userAgent || "").slice(0, 200), updated_at: new Date().toISOString(), last_used_at: new Date().toISOString() },
      { onConflict: "endpoint" }
    );
    if (error) return { ok: false, reason: "save-failed", error: error.message };
    return { ok: true };
  } catch (e) {
    return { ok: false, reason: "subscribe-failed", error: String(e && e.message || e) };
  }
}

// Unsubscribe this device and remove it from Supabase.
export async function disablePush() {
  if (!pushSupported()) return { ok: false, reason: "unsupported" };
  try {
    const reg = await navigator.serviceWorker.getRegistration("/");
    const sub = reg ? await reg.pushManager.getSubscription() : null;
    if (sub) {
      try { await supabase.from("design_push_subscriptions").delete().eq("endpoint", sub.endpoint); } catch (e) { /* ignore */ }
      await sub.unsubscribe();
    }
    return { ok: true };
  } catch (e) { return { ok: false, reason: "unsubscribe-failed" }; }
}
