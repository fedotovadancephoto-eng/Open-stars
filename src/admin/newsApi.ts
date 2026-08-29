import { getValidStaffSession } from "@/admin/adminApi";

const SUPABASE_URL = "https://yiwiykbuaggyslfyhlfo.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_1MORh5rY7uMDVYLYVX5VAA_cyoph4-7";

export type NewsScope = "all_school" | "branch" | "group";
export type NewsItem = {
  id: string;
  title: string;
  body: string;
  category: string;
  audienceScope: NewsScope;
  branch: string;
  groupName: string;
  active: boolean;
  publishedAt: string;
  createdAt: string;
};

export type NewsContext = { role: string; staffBranch: string; news: NewsItem[] };

type ApiError = { message?: string; details?: string };

async function rpc<T>(name: string, body: Record<string, unknown> = {}): Promise<T> {
  const session = await getValidStaffSession();
  if (!session) throw new Error("Сессия сотрудника не найдена. Войдите снова.");
  const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${name}`, {
    method: "POST",
    headers: {
      apikey: SUPABASE_PUBLISHABLE_KEY,
      Authorization: `Bearer ${session.access_token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    let message = "Не удалось выполнить действие с новостью.";
    try {
      const payload = (await response.json()) as ApiError;
      message = payload.message || payload.details || message;
    } catch {}
    if (message.includes("title required")) message = "Введите заголовок новости.";
    if (message.includes("invalid audience")) message = "Выберите аудиторию новости.";
    if (message.includes("not authorized")) message = "Недостаточно прав для этой аудитории.";
    throw new Error(message);
  }
  if (response.status === 204) return undefined as T;
  return response.json();
}

export async function fetchNewsContext(): Promise<NewsContext> {
  const data: any = await rpc("staff_news_context");
  return {
    role: data.role || "",
    staffBranch: data.staffBranch || "",
    news: Array.isArray(data.news) ? data.news.map((item: any) => ({
      id: item.id,
      title: item.title || "",
      body: item.body || "",
      category: item.category || "OPEN STARS",
      audienceScope: item.audienceScope || "all_school",
      branch: item.branch || "",
      groupName: item.groupName || "",
      active: Boolean(item.active),
      publishedAt: item.publishedAt || "",
      createdAt: item.createdAt || "",
    })) : [],
  };
}

export async function publishNews(input: {
  title: string;
  body: string;
  category: string;
  audienceScope: NewsScope;
  branch?: string;
  groupName?: string;
}) {
  const rows: Array<{ news_id: string; recipient_count: number }> = await rpc("staff_publish_news", {
    p_title: input.title.trim(),
    p_body: input.body.trim() || null,
    p_category: input.category.trim() || "OPEN STARS",
    p_audience_scope: input.audienceScope,
    p_branch: input.audienceScope === "all_school" ? null : input.branch || null,
    p_group_name: input.audienceScope === "group" ? input.groupName || null : null,
  });
  return rows?.[0] || { news_id: "", recipient_count: 0 };
}

export async function setNewsActive(newsId: string, active: boolean) {
  await rpc<void>("staff_set_news_active", { p_news_id: newsId, p_active: active });
}

export async function deleteNews(newsId: string) {
  await rpc<void>("staff_delete_news", { p_news_id: newsId });
}
