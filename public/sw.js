/* SuccessViews — Design push Service Worker.
   Handles Web Push for the Design module only. Shows notifications even when the
   dashboard tab is closed or the user is logged out, and opens the right project on click.
   Kept intentionally small; it does NOT cache/precache anything (no offline behaviour changes). */

self.addEventListener("install", (event) => {
  // Activate this SW immediately on first install so push works without a manual reload.
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch (e) { data = {}; }
  const title = data.title || "Design update";
  const body = data.body || "";
  const url = data.url || "/admin";
  // Dedup: same eventId collapses into one notification (no duplicates across retries).
  const tag = data.tag || data.eventId || (data.projectId ? "proj-" + data.projectId : "design");
  const options = {
    body,
    tag,
    renotify: false,
    data: { url, projectId: data.projectId || "", eventId: data.eventId || "" },
    icon: data.icon || "/successviews-logo.png",
    badge: data.badge || "/successviews-logo.png",
    timestamp: data.ts ? Number(data.ts) : Date.now(),
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = (event.notification.data && event.notification.data.url) || "/admin";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      // If a dashboard tab is already open, focus it and navigate there.
      for (const client of clients) {
        if ("focus" in client) {
          client.focus();
          if ("navigate" in client) { try { client.navigate(target); } catch (e) { /* ignore */ } }
          return;
        }
      }
      // Otherwise open a new tab (login → redirect handled by the app via ?next=).
      if (self.clients.openWindow) return self.clients.openWindow(target);
    })
  );
});
