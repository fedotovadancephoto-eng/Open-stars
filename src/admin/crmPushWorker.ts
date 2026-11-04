export async function prepareCrmPush(): Promise<ServiceWorkerRegistration> {
  const registration = await navigator.serviceWorker.register("/admin/crm-sw.js", {
    scope: "/admin/",
    updateViaCache: "none",
  });
  if (registration.active) return registration;
  await new Promise<void>((resolve, reject) => {
    const worker = registration.installing || registration.waiting;
    if (!worker) { reject(new Error("Не удалось запустить CRM-уведомления.")); return; }
    if (worker.state === "activated") { resolve(); return; }
    const onState = () => {
      if (worker.state === "activated") { worker.removeEventListener("statechange", onState); resolve(); }
      if (worker.state === "redundant") { worker.removeEventListener("statechange", onState); reject(new Error("Ошибка запуска CRM-уведомлений.")); }
    };
    worker.addEventListener("statechange", onState);
  });
  return registration;
}
