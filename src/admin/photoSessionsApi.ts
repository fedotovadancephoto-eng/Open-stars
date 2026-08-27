import { getValidStaffSession } from "@/admin/adminApi";

const SUPABASE_URL = "https://yiwiykbuaggyslfyhlfo.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_1MORh5rY7uMDVYLYVX5VAA_cyoph4-7";

export type PhotoSessionItem = {
  id: string;
  title: string;
  description: string;
  galleryUrl: string;
  branch: string;
  groupName: string;
  lessonDay: string;
  lessonTime: string;
  published: boolean;
  publishedAt: string;
  createdAt: string;
};

export type PhotoSessionContext = {
  role: string;
  staffBranch: string;
  sessions: PhotoSessionItem[];
};

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
    let message = "Не удалось выполнить действие с фотосессией.";
    try {
      const payload = (await response.json()) as ApiError;
      message = payload.message || payload.details || message;
    } catch {}
    if (message.includes("title required")) message = "Введите название фотосессии.";
    if (message.includes("gallery url required")) message = "Вставьте ссылку на галерею.";
    if (message.includes("invalid gallery url")) message = "Ссылка должна начинаться с http:// или https://.";
    if (message.includes("invalid branch")) message = "Выберите филиал.";
    if (message.includes("invalid group")) message = "Выберите группу.";
    if (message.includes("lesson day required")) message = "Выберите день занятий.";
    if (message.includes("invalid lesson time")) message = "Выберите поток 11:00, 13:00 или 16:00.";
    if (message.includes("not authorized")) message = "Недостаточно прав для этой группы.";
    throw new Error(message);
  }
  if (response.status === 204) return undefined as T;
  return response.json();
}

export async function fetchPhotoSessionContext(): Promise<PhotoSessionContext> {
  const data: any = await rpc("staff_photo_context");
  return {
    role: data.role || "",
    staffBranch: data.staffBranch || "",
    sessions: Array.isArray(data.sessions)
      ? data.sessions.map((item: any) => ({
          id: item.id,
          title: item.title || "",
          description: item.description || "",
          galleryUrl: item.galleryUrl || "",
          branch: item.branch || "",
          groupName: item.groupName || "",
          lessonDay: item.lessonDay || "",
          lessonTime: String(item.lessonTime || "").slice(0, 5),
          published: Boolean(item.published),
          publishedAt: item.publishedAt || "",
          createdAt: item.createdAt || "",
        }))
      : [],
  };
}

export async function publishGroupPhotoSession(input: {
  title: string;
  description?: string;
  galleryUrl: string;
  branch: string;
  groupName: string;
  lessonDay: string;
  lessonTime: string;
}) {
  const rows: Array<{ photo_session_id: string; recipient_count: number }> = await rpc(
    "staff_publish_group_photo_session",
    {
      p_title: input.title.trim(),
      p_description: input.description?.trim() || null,
      p_gallery_url: input.galleryUrl.trim(),
      p_branch: input.branch,
      p_group_name: input.groupName,
      p_lesson_day: input.lessonDay,
      p_lesson_time: input.lessonTime,
    }
  );
  return rows?.[0] || { photo_session_id: "", recipient_count: 0 };
}

export async function setPhotoSessionPublished(photoSessionId: string, published: boolean) {
  await rpc<void>("staff_set_photo_session_published", {
    p_photo_session_id: photoSessionId,
    p_published: published,
  });
}
