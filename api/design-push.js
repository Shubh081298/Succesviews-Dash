/* Vercel serverless function — sends Design Web Push notifications.
   The CLIENT only tells us { kind, projectId, actorRole }. We (server-side, with the Supabase
   service role) look up the real project and derive the recipient ourselves, so a caller can never
   target an arbitrary user or inject content. Design module only. Never exposes other clients' data.

   Required env vars (set in Vercel → Project → Settings → Environment Variables):
     VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT (e.g. mailto:you@domain.com)
     SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
*/
import webpush from "web-push";
import { createClient } from "@supabase/supabase-js";

const {
  VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT,
  SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY,
} = process.env;

let ready = false;
function init() {
  if (ready) return true;
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) return false;
  webpush.setVapidDetails(VAPID_SUBJECT || "mailto:admin@successviews.app", VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
  ready = true;
  return true;
}

export default async function handler(req, res) {
  if (req.method !== "POST") { res.status(405).json({ error: "Method not allowed" }); return; }
  if (!init()) { res.status(200).json({ ok: false, reason: "not-configured" }); return; }

  let body = req.body;
  if (typeof body === "string") { try { body = JSON.parse(body); } catch (e) { body = {}; } }
  const kind = String((body && body.kind) || "");                 // "message" | "status" | "files"
  const projectId = (body && body.projectId) || "";
  const actorRole = String((body && body.actorRole) || "");        // "admin" | "designer"
  const meta = (body && body.meta) || "";
  const eventId = (body && body.eventId) || "";
  if (!projectId || !["message", "status", "files"].includes(kind) || !["admin", "designer"].includes(actorRole)) {
    res.status(400).json({ error: "Bad request" }); return;
  }

  const supa = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

  // Verify the project exists and read the real details (server-side, service role).
  const { data: proj, error: pErr } = await supa
    .from("design_projects")
    .select("id, client_name, assigned_designer, assigned_designer_name")
    .eq("id", projectId).single();
  if (pErr || !proj) { res.status(404).json({ error: "Project not found" }); return; }

  // Derive the recipient ourselves — never trust the client for who receives it.
  let recipientUserId, sender;
  if (actorRole === "designer") { recipientUserId = "admin"; sender = "the designer"; }
  else { recipientUserId = proj.assigned_designer; sender = "the admin"; }
  if (!recipientUserId) { res.status(200).json({ ok: true, sent: 0, reason: "no-recipient" }); return; }

  const client = proj.client_name || "a project";
  let title = "Design update", text = "";
  if (kind === "message") { title = "New design message"; text = `${client} — new message from ${sender}.`; }
  else if (kind === "status") { title = "Design status updated"; text = `${client}${meta ? " — now: " + meta : " — status changed."}`; }
  else if (kind === "files") { title = "New design file"; text = `${client} — ${sender} sent a new file.`; }

  const url = recipientUserId === "admin" ? `/admin?dproject=${encodeURIComponent(projectId)}` : `/?dproject=${encodeURIComponent(projectId)}`;
  const payload = JSON.stringify({ title, body: text, url, projectId, eventId: eventId || `${kind}:${projectId}`, tag: eventId || `${kind}:${projectId}`, ts: Date.now() });

  const { data: subs, error: sErr } = await supa
    .from("design_push_subscriptions")
    .select("id, endpoint, subscription")
    .eq("user_id", String(recipientUserId));
  if (sErr) { res.status(200).json({ ok: false, reason: "subs-error" }); return; }

  let sent = 0, pruned = 0;
  await Promise.all((subs || []).map(async (row) => {
    try {
      await webpush.sendNotification(row.subscription, payload);
      sent++;
      supa.from("design_push_subscriptions").update({ last_used_at: new Date().toISOString() }).eq("id", row.id).then(() => {});
    } catch (err) {
      const code = err && err.statusCode;
      if (code === 404 || code === 410) { // subscription expired/gone → remove it
        try { await supa.from("design_push_subscriptions").delete().eq("id", row.id); pruned++; } catch (e) { /* ignore */ }
      }
    }
  }));

  res.status(200).json({ ok: true, sent, pruned });
};
