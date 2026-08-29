import { getValidParentSession } from "@/openStarsApi";

const SUPABASE_URL = "https://yiwiykbuaggyslfyhlfo.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_1MORh5rY7uMDVYLYVX5VAA_cyoph4-7";

export type ParentNotification = {
  id: string;
  title: string;
  body: string;
  target: string;
  targetId: string;
  isRead: boolean;
  createdAt: string;
};

function jwtSubject(accessToken: string) {
  const part = accessToken.split(".")[1];
  if (!part || typeof window === "undefined") return "";
  try {
    const normalized = part.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
    const payload = JSON.parse(window.atob(padded));
    return typeof payload?.sub === "string" ? payload.sub : "";
  } catch {
    return "";
  }
}

async function sessionContext() {
  const session = await getValidParentSession();
  if (!session) throw new Error("Сессия родителя не найдена.");
  const userId = jwtSubject(session.access_token);
  if (!userId) throw new Error("Не удалось определить пользователя уведомлений.");
  return { token: session.access_token, userId };
}

export async function fetchParentNotifications(): Promise<ParentNotification[]> {
  const { token, userId } = await sessionContext();
  const query = new URLSearchParams({
    select: "id,title,body,target,target_id,is_read,created_at",
    recipient_user_id: `eq.${userId}`,
    order: "created_at.desc",
    limit: "30",
  });
  const response = await fetch(`${SUPABASE_URL}/rest/v1/notifications?${query.toString()}`, {
    headers: { apikey: SUPABASE_PUBLISHABLE_KEY, Authorization: `Bearer ${token}` },
  });
  if (!response.ok) throw new Error("Не удалось загрузить уведомления.");
  const rows = await response.json();
  return (rows || []).map((row: any) => ({
    id: row.id,
    title: row.title || "OPEN STARS",
    body: row.body || "",
    target: row.target || "",
    targetId: row.target_id || "",
    isRead: Boolean(row.is_read),
    createdAt: row.created_at || "",
  }));
}

export async function markParentNotificationRead(id: string) {
  const { token } = await sessionContext();
  const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/parent_mark_notification_read`, {
    method: "POST",
    headers: { apikey: SUPABASE_PUBLISHABLE_KEY, Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ p_notification_id: id }),
  });
  if (!response.ok) throw new Error("Не удалось отметить уведомление прочитанным.");
}
