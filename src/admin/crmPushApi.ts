import { getValidStaffSession } from "@/admin/adminApi";

const BASE = "https://yiwiykbuaggyslfyhlfo.supabase.co";
const KEY = "sb_publishable_1MORh5rY7uMDVYLYVX5VAA_cyoph4-7";

async function staffToken() {
  const session = await getValidStaffSession();
  if (!session) throw new Error("Войдите в CRM, чтобы получать уведомления.");
  return session.access_token;
}

export async function crmPushAction<T>(action: "config" | "subscribe" | "unsubscribe" | "test", data: Record<string, unknown> = {}): Promise<T> {
  const token = await staffToken();
  const response = await fetch(`${BASE}/rest/v1/rpc/crm_push`, {
    method: "POST",
    headers: {
      apikey: KEY,
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ p_action: action, p_data: data }),
    signal: AbortSignal.timeout(12000),
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => ({})) as { message?: string };
    throw new Error(payload.message || "Не удалось настроить уведомления. Попробуйте ещё раз.");
  }
  return response.json() as Promise<T>;
}

// Only IDs are transferred to the notification widget. Contact data stays inside CRM.
export async function fetchCrmInboundAlertIds(): Promise<string[]> {
  const token = await staffToken();
  const response = await fetch(
    `${BASE}/rest/v1/crm_inbound_items?select=id&status=eq.new&order=received_at.desc&limit=100`,
    {
      headers: { apikey: KEY, Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(12000),
    },
  );
  if (!response.ok) throw new Error("Не удалось проверить новые заявки.");
  const rows = await response.json() as Array<{ id: string }>;
  return rows.map(row => row.id);
}
