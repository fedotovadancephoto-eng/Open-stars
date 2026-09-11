/* Notifications only. No fetch handler or asset cache: releases always use current bundles. */
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));
const validId = (value) => typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);

self.addEventListener("push", (event) => {
  event.waitUntil((async () => {
    let data = {};
    try { data = event.data ? event.data.json() : {}; } catch { /* still show a visible notification */ }
    const id = validId(data.notificationId) ? data.notificationId : null;
    const tag = id ? `open-stars-${id}` : "open-stars-update";
    // Redeliveries can occur after a worker timeout. Do not ring twice for an existing notification.
    const existing = await self.registration.getNotifications({ tag });
    if (!existing.length) await self.registration.showNotification(
      typeof data.title === "string" ? data.title.slice(0,120) : "OPEN STARS", {
        body: typeof data.body === "string" ? data.body.slice(0,200) : "В кабинете появилась новая информация.",
        icon: "/icons/open-stars-192.png", badge: "/icons/open-stars-72.png",
        tag, renotify: false, silent: false, data: { notificationId: id },
      });
    const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const client of windows) client.postMessage({ type: "OPEN_STARS_PUSH_RECEIVED" });
  })());
});
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil((async () => {
    const id = event.notification.data?.notificationId;
    const path = validId(id) ? `/?notification=${encodeURIComponent(id)}` : "/";
    const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    const parent = windows.find((client) => {
      const url = new URL(client.url);
      return url.origin === self.location.origin && url.pathname === "/";
    });
    if (parent) {
      await parent.focus();
      // Navigating also preserves the pending destination when the parent's login has expired.
      await parent.navigate(path);
    } else await self.clients.openWindow(path);
  })());
});
