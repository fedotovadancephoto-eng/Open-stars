import { useEffect, useRef, useState } from "react";
import { Bell, BellOff, CheckCircle2, LoaderCircle, X } from "lucide-react";
import { applicationKey, prepareParentPush, pushSupport } from "@/parentPushApi";
import { crmPushAction, fetchCrmInboundAlertIds } from "@/admin/crmPushApi";

type Prepared = { registration: ServiceWorkerRegistration; publicKey: string };

export function CrmPushAlerts() {
  const [support] = useState(pushSupport);
  const [count, setCount] = useState(0);
  const [connected, setConnected] = useState(false);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [minimized, setMinimized] = useState(false);
  const [notice, setNotice] = useState("");
  const [message, setMessage] = useState("");
  const [blocked, setBlocked] = useState(() => "Notification" in window && Notification.permission === "denied");
  const seen = useRef<Set<string> | null>(null);
  const prepared = useRef<Prepared | null>(null);

  useEffect(() => {
    let active = true;
    async function refresh() {
      try {
        const ids = await fetchCrmInboundAlertIds();
        if (!active) return;
        const previous = seen.current;
        if (previous && ids.some(id => !previous.has(id))) {
          setNotice("Новая заявка! Откройте входящие обращения.");
          setMinimized(false);
        }
        seen.current = new Set(ids);
        setCount(ids.length);
      } catch {
        // Network interruptions do not reset the last known badge or create false alerts.
      }
    }
    void refresh();
    const interval = window.setInterval(() => {
      if (document.visibilityState === "visible") void refresh();
    }, 20000);
    const onFocus = () => void refresh();
    const onVisibility = () => { if (document.visibilityState === "visible") void refresh(); };
    const onPush = (event: MessageEvent) => {
      if (event.data?.type === "OPEN_STARS_PUSH_RECEIVED") void refresh();
    };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibility);
    navigator.serviceWorker?.addEventListener("message", onPush);
    return () => {
      active = false;
      window.clearInterval(interval);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibility);
      navigator.serviceWorker?.removeEventListener("message", onPush);
    };
  }, []);

  useEffect(() => {
    if (support !== "supported") return;
    let active = true;
    void (async () => {
      try {
        const [registration, config] = await Promise.all([
          prepareParentPush(),
          crmPushAction<{ publicKey: string | null }>("config"),
        ]);
        if (!config.publicKey) throw new Error("Push-сервис временно недоступен.");
        const subscription = await registration.pushManager.getSubscription();
        if (subscription) {
          const keys = subscription.toJSON().keys;
          await crmPushAction("subscribe", {
            endpoint: subscription.endpoint, p256dh: keys?.p256dh, auth: keys?.auth,
          });
        }
        if (active) {
          prepared.current = { registration, publicKey: config.publicKey };
          setConnected(Boolean(subscription));
          setReady(true);
        }
      } catch (cause) {
        if (active) setMessage(cause instanceof Error ? cause.message : "Не удалось подготовить уведомления.");
      }
    })();
    return () => { active = false; };
  }, [support]);

  async function enable() {
    if (!prepared.current || busy) return;
    // iOS requires the permission request to begin directly from a tap.
    const permissionRequest = Notification.requestPermission();
    setBusy(true);
    setMessage("");
    try {
      const permission = await permissionRequest;
      setBlocked(permission === "denied");
      if (permission !== "granted") {
        setMessage("Разрешите уведомления для OPEN STARS в настройках телефона.");
        return;
      }
      const { registration, publicKey } = prepared.current;
      const subscription = await registration.pushManager.getSubscription() ||
        await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: applicationKey(publicKey),
        });
      const keys = subscription.toJSON().keys;
      await crmPushAction("subscribe", {
        endpoint: subscription.endpoint, p256dh: keys?.p256dh, auth: keys?.auth,
      });
      setConnected(true);
      setMessage("Push-уведомления подключены на этом устройстве.");
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : "Не удалось включить push.");
    } finally {
      setBusy(false);
    }
  }

  async function disable() {
    if (busy) return;
    setBusy(true);
    setMessage("");
    try {
      const registration = await navigator.serviceWorker.getRegistration("/");
      const subscription = await registration?.pushManager.getSubscription();
      if (subscription) {
        await crmPushAction("unsubscribe", { endpoint: subscription.endpoint });
        await subscription.unsubscribe();
      }
      setConnected(false);
      setMessage("Push-уведомления отключены на этом устройстве.");
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : "Не удалось отключить push.");
    } finally {
      setBusy(false);
    }
  }

  async function test() {
    if (busy || !connected) return;
    setBusy(true);
    setMessage("");
    try {
      await crmPushAction("test");
      setMessage("Тест отправлен. Проверьте уведомление на телефоне.");
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : "Не удалось отправить тест.");
    } finally {
      setBusy(false);
    }
  }

  const openInbox = () => window.location.assign("/admin/crm?inbox=1");

  if (minimized) return (
    <button type="button" onClick={() => setMinimized(false)}
      aria-label="Показать уведомления о заявках"
      className="fixed bottom-4 right-4 z-[120] flex items-center gap-2 rounded-full bg-[#171717] px-4 py-3 text-sm font-semibold text-white shadow-xl">
      <Bell size={17}/> Заявки {count > 0 ? count : ""}
    </button>
  );

  return (
    <aside aria-label="Уведомления о новых заявках"
      className="fixed bottom-4 right-3 z-[120] w-[min(360px,calc(100vw-24px))] rounded-[20px] border border-black/10 bg-white p-4 text-[#171717] shadow-[0_12px_40px_rgba(0,0,0,0.16)]">
      <div className="flex items-center gap-2">
        <Bell size={19} className="text-[#D96A24]"/>
        <p className="flex-1 text-sm font-semibold">Уведомления CRM</p>
        <button type="button" onClick={() => setMinimized(true)}
          aria-label="Свернуть уведомления" className="rounded-full p-1 text-black/50"><X size={17}/></button>
      </div>
      <button type="button" onClick={openInbox}
        className="mt-3 w-full rounded-xl bg-[#F7F5EF] px-4 py-3 text-left text-sm font-semibold">
        {count > 0 ? "Новых обращений: " + (count >= 100 ? "100+" : count) : "Открыть входящие обращения"}
      </button>
      {notice && <div role="status" className="mt-2 rounded-xl bg-[#FFF3E9] px-3 py-2 text-xs font-semibold text-[#9B4612]">
        {notice}
      </div>}
      {connected && <p className="mt-2 text-xs font-semibold text-[#4D512E]">Push-уведомления активны на этом устройстве</p>}
      {support === "supported" && !blocked && (
        <div className="mt-3 flex flex-wrap gap-2">
          <button type="button" disabled={!ready || busy} onClick={() => void (connected ? disable() : enable())}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-[#D96A24] px-3 py-2.5 text-xs font-semibold text-white disabled:opacity-50">
            {busy ? <LoaderCircle size={15} className="animate-spin"/> :
              connected ? <CheckCircle2 size={15}/> : <Bell size={15}/>}
            {connected ? "Выключить push" : "Включить на телефоне"}
          </button>
          {connected && <button type="button" disabled={busy} onClick={() => void test()}
            className="rounded-xl bg-[#F7F5EF] px-3 py-2.5 text-xs font-semibold disabled:opacity-50">
            Проверить
          </button>}
        </div>
      )}
      {support === "install-ios" && <p className="mt-3 text-xs leading-5 text-black/55">
        На iPhone: откройте CRM в Safari → «Поделиться» → «На экран Домой».
        Откройте CRM с иконки и включите уведомления.
      </p>}
      {support === "unsupported" && <p className="mt-3 text-xs leading-5 text-black/55">
        Push недоступен в этом браузере. Откройте CRM в Chrome, Edge или установленном приложении.
      </p>}
      {blocked && <p className="mt-3 flex items-center gap-2 text-xs text-amber-800">
        <BellOff size={15}/> Уведомления запрещены в настройках браузера или телефона.
      </p>}
      {message && <p role="status" className="mt-2 text-xs leading-5 text-[#4D512E]">{message}</p>}
      <p className="mt-2 text-[11px] leading-4 text-black/40">
        Новые заявки проверяются автоматически. Push приходит и при закрытой CRM после разрешения на устройстве.
      </p>
    </aside>
  );
}
