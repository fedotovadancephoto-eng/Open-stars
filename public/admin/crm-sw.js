/* OPEN STARS CRM push worker. Only handles CRM staff notifications. */
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));
const validId = (value) => typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);

self.addEventListener("push", (event) => {
  event.waitUntil((async () => {
    let data = {};
    try { data = event.data ? event.data.json() : {}; } catch {}
    if (data.target !== "crm_inbound" && data.target !== "crm_push_test") return;
    const id = validId(data.notificationId) ? data.notificationId : null;
    const tag = id ? "open-stars-crm-" + id : "open-stars-crm";
    const existing = await self.registration.getNotifications({ tag });
    if (!existing.length) await self.registration.showNotification(
      typeof data.title === "string" ? data.title.slice(0,120) : "Новая заявка OPEN STARS", {
        body: "Откройте CRM → Входящие обращения",
        icon: "/icons/open-stars-192.png",
        badge: "/icons/open-stars-72.png",
        tag, renotify: false, data: { notificationId: id, target: data.target },
      });
    const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const client of windows) client.postMessage({ type: "OPEN_STARS_PUSH_RECEIVED" });
  })());
});
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil((async () => {
    const path = "/admin/crm?inbox=1";
    const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    const crm = windows.find((client) => {
      const url = new URL(client.url);
      return url.origin === self.location.origin && url.pathname.startsWith("/admin/crm");
    });
    if (crm) {
      await crm.focus();
      await crm.navigate(path);
    } else await self.clients.openWindow(path);
  })());
});
