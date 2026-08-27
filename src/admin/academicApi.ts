import { getValidStaffSession } from "@/admin/adminApi";

const SUPABASE_URL = "https://yiwiykbuaggyslfyhlfo.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_1MORh5rY7uMDVYLYVX5VAA_cyoph4-7";

export type AcademicBranch = "Свердловский" | "НЛО" | "Октябрьский";
export type AcademicGroup = "Базовый" | "Продвинутый" | "PRO";
export type AcademicStream = "11:00" | "13:00" | "16:00";

export type AcademicContext = {
  role: "owner" | "project_director" | "manager" | "admin" | "teacher";
  staffBranch: string;
  staffName: string;
  assignments: Array<{ branch?: string | null; groupName: string; subject: string }>;
};

export type AcademicRosterRow = {
  childId: string;
  childName: string;
  present: boolean | null;
  grade: number | null;
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
    let message = "Не удалось выполнить действие.";
    try {
      const payload = (await response.json()) as ApiError;
      message = payload.message || payload.details || message;
    } catch {
      // ignore
    }
    if (message.includes("wrong branch")) message = "Администратор может работать только со своим филиалом.";
    if (message.includes("not authorized")) message = "У вас нет доступа к этой группе или предмету.";
    if (message.includes("invalid grade")) message = "Оценка должна быть от 1 до 5.";
    if (message.includes("title and subject")) message = "Укажите предмет и название задания.";
    throw new Error(message);
  }

  if (response.status === 204) return undefined as T;
  return response.json();
}

export async function fetchAcademicContext(): Promise<AcademicContext> {
  const data: any = await rpc("staff_academic_context");
  return {
    role: data.role,
    staffBranch: data.staffBranch || "",
    staffName: data.staffName || "Преподаватель",
    assignments: Array.isArray(data.assignments) ? data.assignments : [],
  };
}

export async function fetchAcademicRoster(input: {
  branch: AcademicBranch;
  groupName: AcademicGroup;
  stream: AcademicStream;
  lessonDate: string;
  subject: string;
}): Promise<AcademicRosterRow[]> {
  const rows: any[] = await rpc("staff_academic_roster", {
    p_branch: input.branch,
    p_group_name: input.groupName,
    p_stream_start: input.stream,
    p_lesson_date: input.lessonDate,
    p_subject: input.subject.trim(),
  });
  return (rows || []).map((row) => ({
    childId: row.child_id,
    childName: row.child_name || "Ученик",
    present: row.present === null || row.present === undefined ? null : Boolean(row.present),
    grade: row.grade === null || row.grade === undefined ? null : Number(row.grade),
  }));
}

export async function saveAcademicGroup(input: {
  lessonDate: string;
  subject: string;
  teacherName: string;
  entries: Array<{ childId: string; present: boolean | null; grade: number | null }>;
}) {
  return rpc<number>("staff_save_academic_group", {
    p_lesson_date: input.lessonDate,
    p_subject: input.subject.trim(),
    p_teacher_name: input.teacherName.trim() || null,
    p_entries: input.entries.map((entry) => ({
      childId: entry.childId,
      present: entry.present,
      grade: entry.grade,
    })),
  });
}

export async function publishGroupHomework(input: {
  branch: AcademicBranch;
  groupName: AcademicGroup;
  stream: AcademicStream;
  subject: string;
  title: string;
  description: string;
  dueDate: string;
  lessonDate: string;
  teacherName: string;
}) {
  return rpc<number>("staff_publish_group_homework", {
    p_branch: input.branch,
    p_group_name: input.groupName,
    p_stream_start: input.stream,
    p_subject: input.subject.trim(),
    p_title: input.title.trim(),
    p_description: input.description.trim() || null,
    p_due_date: input.dueDate || null,
    p_lesson_date: input.lessonDate || null,
    p_teacher_name: input.teacherName.trim() || null,
  });
}

export async function addTeacherComment(input: {
  childId: string;
  subject: string;
  title: string;
  text: string;
  date: string;
  teacherName: string;
}) {
  return rpc<string>("staff_add_teacher_comment", {
    p_child_id: input.childId,
    p_subject: input.subject.trim(),
    p_title: input.title.trim() || null,
    p_comment_text: input.text.trim(),
    p_comment_date: input.date || null,
    p_teacher_name: input.teacherName.trim() || null,
  });
}

export async function addAchievement(input: {
  childId: string;
  title: string;
  description: string;
  date: string;
}) {
  return rpc<string>("staff_add_achievement", {
    p_child_id: input.childId,
    p_title: input.title.trim(),
    p_description: input.description.trim() || null,
    p_achieved_at: input.date || null,
  });
}
