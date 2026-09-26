/*
 * Sabicars staff alerts.
 *
 * Registered only by the admin, scoped to /admin/. It does one thing: show a
 * new-enquiry alert on a staff phone, and open that enquiry when tapped. It
 * caches nothing — the admin is always live data.
 */

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

self.addEventListener("push", (event) => {
  let alert = { title: "New enquiry", body: "", url: "/admin/leads", tag: "lead" };
  try {
    alert = { ...alert, ...event.data.json() };
  } catch {
    if (event.data) alert.body = event.data.text();
  }
  event.waitUntil(
    (async () => {
      await self.registration.showNotification(alert.title, {
        body: alert.body,
        tag: alert.tag,
        renotify: true,
        requireInteraction: true,
        icon: "/brand/icon-192.png",
        badge: "/brand/icon-192.png",
        data: { url: alert.url },
      });
      // An open inbox refreshes itself, so the new enquiry is already on screen.
      const open = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      for (const client of open) client.postMessage({ type: "lead-alert" });
    })(),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = new URL(event.notification.data?.url || "/admin/leads", self.location.origin).href;
  event.waitUntil(
    (async () => {
      const open = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      const admin = open.find((c) => new URL(c.url).pathname.startsWith("/admin"));
      if (admin) {
        await admin.focus();
        return admin.navigate(target);
      }
      return self.clients.openWindow(target);
    })(),
  );
});
