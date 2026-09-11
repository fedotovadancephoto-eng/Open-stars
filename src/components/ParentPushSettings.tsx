import { useEffect, useRef, useState } from "react";
import { Bell } from "lucide-react";
import { applicationKey, disconnectParentPush, parentPushAction, prepareParentPush, pushSupport, syncPushSubscription } from "@/parentPushApi";

export function ParentPushSettings() {
  const [support] = useState(pushSupport);
  const [ready, setReady] = useState(false);
  const [connected, setConnected] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [blocked, setBlocked] = useState(() => "Notification" in window && Notification.permission === "denied");
  const [retry, setRetry] = useState(0);
  const prepared = useRef<{ registration: ServiceWorkerRegistration; publicKey: string } | null>(null);

  useEffect(() => {
    if (support !== "supported") return;
    let cancelled = false;
    setMessage("");
    setReady(false);
    void (async () => {
      try {
        const [registration, config] = await Promise.all([
          prepareParentPush(), parentPushAction<{ publicKey: string | null }>("config"),
        ]);
        if (!config.publicKey) throw new Error("Подключение уведомлений временно недоступно. Попробуйте позже.");
        const subscription = await registration.pushManager.getSubscription();
        if (subscription) await syncPushSubscription(subscription);
        if (!cancelled) {
          prepared.current = { registration, publicKey: config.publicKey };
          setConnected(Boolean(subscription));
          setReady(true);
        }
      } catch (error) {
        if (!cancelled) setMessage(error instanceof Error ? error.message : "Не удалось подготовить уведомления.");
      }
    })();
    return () => { cancelled = true; };
  }, [support, retry]);

  async function enable() {
    if (!prepared.current || busy) return;
    // Keep this request in the original tap event: iOS requires a direct user gesture.
    const permissionRequest = Notification.requestPermission();
    setBusy(true);
    setMessage("");
    try {
      const permission = await permissionRequest;
      setBlocked(permission === "denied");
      if (permission !== "granted") { setMessage("Чтобы получать уведомления, разрешите их на этом устройстве."); return; }
      const { registration, publicKey } = prepared.current;
      const subscription = await registration.pushManager.getSubscription() || await registration.pushManager.subscribe({
        userVisibleOnly: true, applicationServerKey: applicationKey(publicKey),
      });
      await syncPushSubscription(subscription);
      setConnected(true);
      setMessage("Уведомления включены на этом устройстве.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Не удалось включить уведомления."); }
    finally { setBusy(false); }
  }

  async function disable() {
    setBusy(true);
    try { await disconnectParentPush(); setConnected(false); setMessage("Уведомления на этом устройстве отключены."); }
    catch (error) { setMessage(error instanceof Error ? error.message : "Не удалось отключить уведомления."); }
    finally { setBusy(false); }
  }

  return <section id="phone-notifications" aria-label="Уведомления на телефоне" className="mb-6 rounded-[22px] border border-[#D96A24]/15 bg-white p-4 sm:p-5">
    <div className="flex items-center gap-3">
      <Bell className="h-5 w-5 shrink-0 text-[#D96A24]" />
      <div className="min-w-0 flex-1"><p className="text-sm font-semibold">Уведомления на телефоне</p><p className="mt-1 text-xs text-black/50">{connected ? "Подключены на этом устройстве" : "Новости, оценки, задания, комментарии, оплата и Star Coin"}</p></div>
      {support === "supported" && !blocked && <button type="button" disabled={!ready || busy} onClick={connected ? disable : enable} aria-label={connected ? "Выключить уведомления" : "Включить уведомления"} className={`shrink-0 rounded-xl px-4 py-2.5 text-sm font-semibold disabled:opacity-50 ${connected ? "bg-[#F4F2EC] text-[#171717]" : "bg-[#D96A24] text-white"}`}>{busy ? "Сохраняем…" : connected ? "Выключить" : "Включить"}</button>}
    </div>
    <div className="mt-3 space-y-3 text-sm leading-6">
      {support === "install-ios" && <p>На iPhone откройте кабинет в Safari → «Поделиться» → «На экран Домой». Затем откройте OPEN STARS с новой иконки и нажмите «Включить уведомления». Нужна iOS 16.4 или новее.</p>}
      {support === "unsupported" && <p>В этом браузере уведомления недоступны. Откройте кабинет в обновлённом Chrome, Edge, Firefox или Safari. На iPhone — с иконки на экране «Домой».</p>}
      {blocked && <p>Уведомления запрещены в настройках телефона или браузера. Разрешите уведомления для OPEN STARS, затем откройте кабинет снова.</p>}
      {support === "supported" && !ready && message && <button type="button" onClick={() => setRetry(v => v + 1)} className="rounded-xl border px-4 py-2.5">Повторить</button>}
      <p className="text-xs leading-5 text-black/50">Для звука включите «Звуки» в настройках уведомлений OPEN STARS. Беззвучный режим и «Не беспокоить» могут приглушать уведомления.</p>
    </div>
    {message && <p role="status" className="mt-3 text-xs leading-5 text-[#5F6338]">{message}</p>}
  </section>;
}
