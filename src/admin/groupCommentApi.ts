import { getValidStaffSession } from "@/admin/adminApi";
import type { AcademicBranch, AcademicGroup, AcademicStream } from "@/admin/academicApi";

const SUPABASE_URL = "https://yiwiykbuaggyslfyhlfo.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_1MORh5rY7uMDVYLYVX5VAA_cyoph4-7";

type ApiError = { message?: string; details?: string };

export type GroupCommentResult = {
  count: number;
  publicationId: string;
};

export async function publishGroupComment(input: {
  branch: AcademicBranch;
  groupName: AcademicGroup;
  stream: AcademicStream;
  subject: string;
  title: string;
  text: string;
  date: string;
  teacherName: string;
}): Promise<GroupCommentResult> {
  const session = await getValidStaffSession();
  if (!session) throw new Error("Сессия сотрудника не найдена. Войдите снова.");
  if (!input.subject.trim()) throw new Error("Укажите предмет.");
  if (!input.text.trim()) throw new Error("Введите комментарий.");

  const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/staff_publish_group_comment`, {
    method: "POST",
    headers: {
      apikey: SUPABASE_PUBLISHABLE_KEY,
      Authorization: `Bearer ${session.access_token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      p_branch: input.branch,
      p_group_name: input.groupName,
      p_stream_start: input.stream,
      p_subject: input.subject.trim(),
      p_title: input.title.trim() || null,
      p_comment_text: input.text.trim(),
      p_comment_date: input.date || null,
      p_teacher_name: input.teacherName.trim() || null,
    }),
  });

  if (!response.ok) {
    let message = "Не удалось опубликовать комментарий группе.";
    try {
      const payload = (await response.json()) as ApiError;
      message = payload.message || payload.details || message;
    } catch {
      // ignore invalid JSON bodies
    }
    if (message.includes("wrong branch")) message = "Администратор может работать только со своим филиалом.";
    if (message.includes("not authorized")) message = "У вас нет доступа к этой группе или предмету.";
    throw new Error(message);
  }

  const payload = (await response.json()) as { count?: number; publication_id?: string };
  return {
    count: Number(payload?.count || 0),
    publicationId: payload?.publication_id || "",
  };
}
