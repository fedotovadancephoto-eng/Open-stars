import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Bell, X } from "lucide-react";
import { applicationKey, disconnectParentPush, parentPushAction, prepareParentPush, pushSupport, syncPushSubscription } from "@/parentPushApi";

export function ParentPushSettings({ settingsOpen = false, onCloseSettings }: { settingsOpen?: boolean; onCloseSettings?: () => void }) {
  const [support] = useState(pushSupport);
  const [ready, setReady] = useState(false);
  const [connected, setConnected] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [blocked, setBlocked] = useState(() => "Notification" in window && Notification.permission === "denied");
  const [retry, setRetry] = useState(0);
  const prepared = useRef<{ registration: ServiceWorkerRegistration; publicKey: string } | null>(null);
  const dialogRef = useRef<HTMLDialogElement | null>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (settingsOpen && dialog && !dialog.open) dialog.showModal();
    return () => { if (dialog?.open) dialog.close(); };
  }, [settingsOpen]);

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
      onCloseSettings?.();
    } catch (error) { setMessage(error instanceof Error ? error.message : "Не удалось включить уведомления."); }
    finally { setBusy(false); }
  }

  async function disable() {
    setBusy(true);
    try { await disconnectParentPush(); setConnected(false); setMessage("Уведомления на этом устройстве отключены."); }
    catch (error) { setMessage(error instanceof Error ? error.message : "Не удалось отключить уведомления."); }
    finally { setBusy(false); }
  }

  // Read the actual device subscription before showing the invitation again on page load.
  const checkingSubscription = support === "supported" && !ready && !message;
  if (!settingsOpen && (connected || checkingSubscription)) return null;

  const content = <section id="phone-notifications" aria-label="Уведомления на телефоне" className={`${settingsOpen ? "" : "mb-6 rounded-[22px] border border-[#D96A24]/15"} bg-white p-4 sm:p-5`}>
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

  if (!settingsOpen) return content;
  return createPortal(<dialog ref={dialogRef} aria-labelledby="push-settings-title" onCancel={(event) => { event.preventDefault(); onCloseSettings?.(); }} className="m-auto w-[min(440px,calc(100vw-32px))] max-h-[85vh] overflow-y-auto rounded-[24px] border-0 bg-white p-0 text-[#171717] shadow-xl backdrop:bg-black/40">
    <div className="flex items-center justify-between gap-3 border-b border-black/5 px-5 py-4">
      <h2 id="push-settings-title" className="font-semibold">Настройки уведомлений</h2>
      <button type="button" onClick={onCloseSettings} aria-label="Закрыть настройки уведомлений" className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[#F4F2EC]"><X className="h-5 w-5" /></button>
    </div>
    {content}
  </dialog>, document.body);
}
