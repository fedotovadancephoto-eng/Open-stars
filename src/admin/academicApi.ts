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

export type AcademicGradeRecord = {
  id: string;
  childId: string;
  subject: string;
  grade: number;
  lessonDate: string;
  teacherName: string;
  createdAt: string;
};

export type AcademicHomeworkRecord = {
  id: string;
  childId: string;
  subject: string;
  title: string;
  description: string;
  dueDate: string;
  lessonDate: string;
  status: string;
  teacherName: string;
  createdAt: string;
  createdBy: string;
};

export type AcademicTeacherCommentRecord = {
  id: string;
  childId: string;
  subject: string;
  title: string;
  text: string;
  date: string;
  teacherName: string;
  createdAt: string;
};

export type AcademicHistory = {
  grades: AcademicGradeRecord[];
  homework: AcademicHomeworkRecord[];
  comments: AcademicTeacherCommentRecord[];
};

type ApiError = { message?: string; details?: string };

async function getSession() {
  const session = await getValidStaffSession();
  if (!session) throw new Error("Сессия сотрудника не найдена. Войдите снова.");
  return session;
}

function friendlyApiMessage(message: string) {
  if (message.includes("wrong branch")) return "Администратор может работать только со своим филиалом.";
  if (message.includes("not authorized")) return "У вас нет доступа к этой группе или предмету.";
  if (message.includes("invalid grade")) return "Оценка должна быть от 1 до 5.";
  if (message.includes("title and subject")) return "Укажите предмет и название задания.";
  if (message.toLowerCase().includes("row-level security")) return "У вас нет доступа к этой записи.";
  return message;
}

async function rpc<T>(name: string, body: Record<string, unknown> = {}): Promise<T> {
  const session = await getSession();

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
    throw new Error(friendlyApiMessage(message));
  }

  if (response.status === 204) return undefined as T;
  return response.json();
}

async function tableRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const session = await getSession();
  const headers = new Headers(init.headers);
  headers.set("apikey", SUPABASE_PUBLISHABLE_KEY);
  headers.set("Authorization", `Bearer ${session.access_token}`);
  if (init.body) headers.set("Content-Type", "application/json");

  const response = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...init,
    headers,
  });

  if (!response.ok) {
    let message = "Не удалось выполнить действие.";
    try {
      const payload = (await response.json()) as ApiError;
      message = payload.message || payload.details || message;
    } catch {
      // ignore
    }
    throw new Error(friendlyApiMessage(message));
  }

  if (response.status === 204) return undefined as T;
  const text = await response.text();
  return (text ? JSON.parse(text) : undefined) as T;
}

function tablePath(table: string, params: Record<string, string>) {
  const query = new URLSearchParams(params);
  return `${table}?${query.toString()}`;
}

function ensureChanged(rows: unknown[], message: string) {
  if (!Array.isArray(rows) || rows.length === 0) throw new Error(message);
}

function createdByFilter(createdBy: string) {
  return createdBy ? `eq.${createdBy}` : "is.null";
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

export async function fetchAcademicHistory(input: {
  childId: string;
  subject: string;
}): Promise<AcademicHistory> {
  const subject = input.subject.trim();
  if (!input.childId || !subject) return { grades: [], homework: [], comments: [] };

  const common = {
    child_id: `eq.${input.childId}`,
    subject: `eq.${subject}`,
  };

  const [gradeRows, homeworkRows, commentRows] = await Promise.all([
    tableRequest<any[]>(tablePath("grades", {
      select: "id,child_id,subject,grade,lesson_date,teacher_name,created_at",
      ...common,
      order: "lesson_date.desc,created_at.desc",
      limit: "100",
    })),
    tableRequest<any[]>(tablePath("homework", {
      select: "id,child_id,subject,title,description,text_content,due_date,lesson_date,status,teacher_name,created_at,created_by",
      ...common,
      order: "lesson_date.desc,created_at.desc",
      limit: "100",
    })),
    tableRequest<any[]>(tablePath("teacher_comments", {
      select: "id,child_id,subject,title,comment_text,comment_date,teacher_name,created_at",
      ...common,
      order: "comment_date.desc,created_at.desc",
      limit: "100",
    })),
  ]);

  return {
    grades: (gradeRows || []).map((row) => ({
      id: row.id,
      childId: row.child_id,
      subject: row.subject || subject,
      grade: Number(row.grade),
      lessonDate: row.lesson_date || "",
      teacherName: row.teacher_name || "",
      createdAt: row.created_at || "",
    })),
    homework: (homeworkRows || []).map((row) => ({
      id: row.id,
      childId: row.child_id,
      subject: row.subject || subject,
      title: row.title || "Домашнее задание",
      description: row.description || row.text_content || "",
      dueDate: row.due_date || "",
      lessonDate: row.lesson_date || "",
      status: row.status || "new",
      teacherName: row.teacher_name || "",
      createdAt: row.created_at || "",
      createdBy: row.created_by || "",
    })),
    comments: (commentRows || []).map((row) => ({
      id: row.id,
      childId: row.child_id,
      subject: row.subject || subject,
      title: row.title || "",
      text: row.comment_text || "",
      date: row.comment_date || "",
      teacherName: row.teacher_name || "",
      createdAt: row.created_at || "",
    })),
  };
}

export async function updateAcademicGrade(id: string, grade: number) {
  if (!Number.isInteger(grade) || grade < 1 || grade > 5) throw new Error("Оценка должна быть от 1 до 5.");
  const rows = await tableRequest<any[]>(tablePath("grades", { id: `eq.${id}` }), {
    method: "PATCH",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({ grade }),
  });
  ensureChanged(rows, "Оценка не найдена или у вас нет доступа к ней.");
}

export async function deleteAcademicGrade(id: string) {
  const rows = await tableRequest<any[]>(tablePath("grades", { id: `eq.${id}` }), {
    method: "DELETE",
    headers: { Prefer: "return=representation" },
  });
  ensureChanged(rows, "Оценка уже удалена или у вас нет доступа к ней.");
}

export async function updateAcademicHomeworkBatch(input: {
  subject: string;
  createdAt: string;
  createdBy: string;
  title: string;
  description: string;
  dueDate: string;
}) {
  if (!input.title.trim()) throw new Error("Введите название домашнего задания.");
  const rows = await tableRequest<any[]>(tablePath("homework", {
    subject: `eq.${input.subject.trim()}`,
    created_at: `eq.${input.createdAt}`,
    created_by: createdByFilter(input.createdBy),
  }), {
    method: "PATCH",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({
      title: input.title.trim(),
      description: input.description.trim() || null,
      text_content: input.description.trim() || null,
      due_date: input.dueDate || null,
    }),
  });
  ensureChanged(rows, "Домашнее задание не найдено или у вас нет доступа к нему.");
  return rows.length;
}

export async function deleteAcademicHomeworkBatch(input: {
  subject: string;
  createdAt: string;
  createdBy: string;
}) {
  const rows = await tableRequest<any[]>(tablePath("homework", {
    subject: `eq.${input.subject.trim()}`,
    created_at: `eq.${input.createdAt}`,
    created_by: createdByFilter(input.createdBy),
  }), {
    method: "DELETE",
    headers: { Prefer: "return=representation" },
  });
  ensureChanged(rows, "Домашнее задание уже удалено или у вас нет доступа к нему.");
  return rows.length;
}

export async function updateAcademicTeacherComment(input: {
  id: string;
  title: string;
  text: string;
  date: string;
}) {
  if (!input.text.trim()) throw new Error("Введите текст комментария.");
  const rows = await tableRequest<any[]>(tablePath("teacher_comments", { id: `eq.${input.id}` }), {
    method: "PATCH",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({
      title: input.title.trim() || null,
      comment_text: input.text.trim(),
      comment_date: input.date || undefined,
    }),
  });
  ensureChanged(rows, "Комментарий не найден или у вас нет доступа к нему.");
}

export async function deleteAcademicTeacherComment(id: string) {
  const rows = await tableRequest<any[]>(tablePath("teacher_comments", { id: `eq.${id}` }), {
    method: "DELETE",
    headers: { Prefer: "return=representation" },
  });
  ensureChanged(rows, "Комментарий уже удалён или у вас нет доступа к нему.");
}
