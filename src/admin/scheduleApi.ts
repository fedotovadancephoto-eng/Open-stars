import { getValidStaffSession } from "@/admin/adminApi";

const SUPABASE_URL = "https://yiwiykbuaggyslfyhlfo.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_1MORh5rY7uMDVYLYVX5VAA_cyoph4-7";

export type ScheduleRole = "owner" | "project_director" | "manager" | "admin" | "teacher";
export type ScheduleBranch = "Свердловский" | "НЛО" | "Октябрьский";
export type ScheduleGroup = "Базовый" | "Продвинутый" | "PRO";
export type ScheduleStream = "11:00" | "13:00" | "16:00";

export type ScheduleLessonInput = {
  subject: string;
  instructor: string;
  room: string;
};

export type GroupSchedule = {
  id: string;
  branch: string;
  groupName: string;
  lessonDate: string;
  streamStart: string;
  studentsCount: number;
  lessons: Array<{
    position: number;
    subject: string;
    startTime: string;
    endTime: string;
    instructor: string;
    room: string;
  }>;
};

type RpcError = { message?: string; details?: string };

async function authorizedFetch(path: string, init?: RequestInit) {
  const session = await getValidStaffSession();
  if (!session) throw new Error("Сессия сотрудника не найдена. Войдите снова.");
  return fetch(`${SUPABASE_URL}${path}`, {
    ...init,
    headers: {
      apikey: SUPABASE_PUBLISHABLE_KEY,
      Authorization: `Bearer ${session.access_token}`,
      ...(init?.headers || {}),
    },
  });
}

async function rpc<T>(name: string, body: Record<string, unknown>): Promise<T> {
  const response = await authorizedFetch(`/rest/v1/rpc/${name}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    let message = "Не удалось выполнить действие с расписанием.";
    try {
      const payload = (await response.json()) as RpcError;
      message = payload.message || payload.details || message;
    } catch {
      // ignore
    }
    if (message.includes("wrong branch")) message = "Администратор может менять расписание только своего филиала.";
    if (message.includes("not authorized")) message = "Недостаточно прав для изменения расписания.";
    if (message.includes("three lessons")) message = "Нужно заполнить ровно три урока.";
    if (message.includes("subject required")) message = "Укажите название каждого из трёх уроков.";
    if (message.includes("schedule conflict")) message = "На эту дату для этой группы уже есть расписание в выбранное время.";
    if (message.includes("schedule not found")) message = "Расписание не найдено. Обновите список и попробуйте ещё раз.";
    throw new Error(message);
  }
  if (response.status === 204) return undefined as T;
  return response.json();
}

function roleFromProfile(row: any): ScheduleRole | null {
  const raw = Array.isArray(row?.roles) ? row.roles[0]?.name : row?.roles?.name;
  return ["owner", "project_director", "manager", "admin", "teacher"].includes(raw) ? raw : null;
}

function authUserIdFromToken(accessToken: string) {
  try {
    const part = accessToken.split(".")[1];
    if (!part) return "";
    const normalized = part.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
    const payload = JSON.parse(atob(padded));
    return typeof payload?.sub === "string" ? payload.sub : "";
  } catch {
    return "";
  }
}

export async function fetchScheduleContext() {
  const session = await getValidStaffSession();
  if (!session) throw new Error("Сессия сотрудника не найдена. Войдите снова.");

  const authUserId = authUserIdFromToken(session.access_token);
  if (!authUserId) throw new Error("Не удалось определить сотрудника.");

  const response = await authorizedFetch(
    `/rest/v1/users_profile?auth_user_id=eq.${encodeURIComponent(authUserId)}&select=staff_branch,roles(name)&limit=1`
  );
  if (!response.ok) throw new Error("Не удалось определить права сотрудника.");
  const rows = await response.json();
  const row = rows[0];
  const role = roleFromProfile(row);
  if (!role) throw new Error("У аккаунта нет доступа к расписанию.");
  return {
    role,
    staffBranch: (row?.staff_branch || "") as string,
    canManage: ["owner", "project_director", "manager", "admin"].includes(role),
  };
}

export async function fetchGroupSchedules(fromDate?: string): Promise<GroupSchedule[]> {
  const rows = await rpc<any[]>("staff_list_group_schedules", {
    p_from_date: fromDate || new Date().toISOString().slice(0, 10),
  });
  return (rows || []).map((row) => ({
    id: row.batch_id,
    branch: row.branch || "",
    groupName: row.group_name || "",
    lessonDate: row.lesson_date || "",
    streamStart: (row.stream_start || "").slice(0, 5),
    studentsCount: Number(row.students_count || 0),
    lessons: Array.isArray(row.lessons)
      ? row.lessons.map((lesson: any) => ({
          position: Number(lesson.position || 0),
          subject: lesson.subject || "",
          startTime: lesson.start_time || "",
          endTime: lesson.end_time || "",
          instructor: lesson.instructor || "",
          room: lesson.room || "",
        }))
      : [],
  }));
}

export async function publishGroupSchedule(input: {
  branch: ScheduleBranch;
  groupName: ScheduleGroup;
  firstDate: string;
  streamStart: ScheduleStream;
  lessons: ScheduleLessonInput[];
  weeks: number;
}) {
  return rpc<Array<{ batch_id: string; lesson_date: string; students_count: number }>>(
    "staff_publish_group_schedule",
    {
      p_branch: input.branch,
      p_group_name: input.groupName,
      p_first_date: input.firstDate,
      p_stream_start: input.streamStart,
      p_lessons: input.lessons.map((lesson) => ({
        subject: lesson.subject.trim(),
        instructor: lesson.instructor.trim(),
        room: lesson.room.trim(),
      })),
      p_weeks: input.weeks,
    }
  );
}

export async function updateGroupSchedule(input: {
  batchId: string;
  streamStart: ScheduleStream;
  lessons: ScheduleLessonInput[];
}) {
  return rpc<Array<{ batch_id: string; students_count: number }>>(
    "staff_update_group_schedule",
    {
      p_batch_id: input.batchId,
      p_stream_start: input.streamStart,
      p_lessons: input.lessons.map((lesson) => ({
        subject: lesson.subject.trim(),
        instructor: lesson.instructor.trim(),
        room: lesson.room.trim(),
      })),
    }
  );
}

export async function deleteGroupSchedule(batchId: string) {
  await rpc<void>("staff_delete_group_schedule", { p_batch_id: batchId });
}
