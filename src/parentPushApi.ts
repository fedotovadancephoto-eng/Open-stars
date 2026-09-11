import { getValidParentSession } from "@/openStarsApi";

const BASE = "https://yiwiykbuaggyslfyhlfo.supabase.co";
const KEY = "sb_publishable_1MORh5rY7uMDVYLYVX5VAA_cyoph4-7";

export async function parentPushAction<T>(action: string, data: Record<string, unknown> = {}): Promise<T> {
  const session = await getValidParentSession();
  if (!session) throw new Error("Войдите в кабинет родителя.");
  const response = await fetch(`${BASE}/rest/v1/rpc/parent_push`, {
    method: "POST",
    headers: { apikey: KEY, Authorization: `Bearer ${session.access_token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ p_action: action, p_data: data }),
    signal: AbortSignal.timeout(10000),
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    if (String(error.message || "").includes("Подождите минуту")) throw new Error(error.message);
    throw new Error("Не удалось подключиться к уведомлениям. Проверьте интернет и повторите.");
  }
  return response.json();
}

export function pushSupport(): "supported" | "install-ios" | "unsupported" {
  const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const standalone = window.matchMedia("(display-mode: standalone)").matches || Boolean((navigator as Navigator & { standalone?: boolean }).standalone);
  if (ios && !standalone) return "install-ios";
  return window.isSecureContext && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window ? "supported" : "unsupported";
}

export async function prepareParentPush() {
  await navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" });
  return navigator.serviceWorker.ready;
}

export function applicationKey(value: string): Uint8Array {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const bytes = atob(normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "="));
  const result = new Uint8Array(new ArrayBuffer(bytes.length));
  for (let i = 0; i < bytes.length; i++) result[i] = bytes.charCodeAt(i);
  return result;
}

export async function syncPushSubscription(subscription: PushSubscription) {
  const json = subscription.toJSON();
  await parentPushAction("subscribe", { endpoint: subscription.endpoint, p256dh: json.keys?.p256dh, auth: json.keys?.auth });
}

export async function disconnectParentPush() {
  if (!("serviceWorker" in navigator)) return;
  const registration = await navigator.serviceWorker.getRegistration("/");
  const subscription = await registration?.pushManager?.getSubscription();
  if (!subscription) return;
  // Revoke at the push provider even if the application server is temporarily unreachable.
  const results = await Promise.allSettled([
    parentPushAction("unsubscribe", { endpoint: subscription.endpoint }), subscription.unsubscribe(),
  ]);
  if (results[0].status === "rejected" && (results[1].status === "rejected" || !results[1].value)) {
    throw new Error("Не удалось отключить уведомления. Повторите при подключении к интернету.");
  }
}

export type NotificationDestination = { tab: string; childId: string | null } | null;
export function notificationDestination(id: string) {
  return parentPushAction<NotificationDestination>("destination", { id });
}
