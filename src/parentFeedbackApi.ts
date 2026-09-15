import { getValidParentSession } from "@/openStarsApi";
import type { ParentFeedback } from "@/feedbackTypes";

const BASE = "https://yiwiykbuaggyslfyhlfo.supabase.co";
const KEY = "sb_publishable_1MORh5rY7uMDVYLYVX5VAA_cyoph4-7";

async function request<T>(rpc: string, body: Record<string, unknown>): Promise<T> {
  const session = await getValidParentSession();
  if (!session) throw new Error("Сессия истекла. Войдите снова.");
  const response = await fetch(`${BASE}/rest/v1/rpc/${rpc}`, {
    method: "POST",
    headers: { apikey: KEY, Authorization: `Bearer ${session.access_token}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) throw new Error("Не удалось загрузить или отправить обращение. Проверьте интернет и повторите.");
  return response.json();
}

export function fetchParentFeedback(childId: string) {
  return request<ParentFeedback[]>("parent_list_feedback", { p_child_id: childId });
}

export function sendParentFeedback(childId: string, category: "app" | "education", message: string) {
  return request<string>("submit_parent_feedback", { p_child_id: childId, p_category: category, p_message: message });
}
