import { getValidStaffSession } from "@/admin/adminApi";

const SUPABASE_URL = "https://yiwiykbuaggyslfyhlfo.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_1MORh5rY7uMDVYLYVX5VAA_cyoph4-7";

type ApiError = { message?: string; details?: string };

export type AcademicStudentOption = {
  id: string;
  name: string;
  branch: string;
  groupName: string;
  lessonTime: string;
};

export type AcademicGradeHistoryRecord = {
  id: string;
  subject: string;
  grade: number;
  lessonDate: string;
  teacherName: string;
  createdAt: string;
};

export type AcademicHomeworkHistoryRecord = {
  id: string;
  subject: string;
  title: string;
  description: string;
  dueDate: string;
  lessonDate: string;
  teacherName: string;
  createdAt: string;
  createdBy: string;
};

export type AcademicCommentHistoryRecord = {
  id: string;
  subject: string;
  title: string;
  text: string;
  date: string;
  teacherName: string;
  createdAt: string;
  publicationId: string;
  audienceScope: "individual" | "group";
};

export type AcademicAchievementHistoryRecord = {
  id: string;
  title: string;
  description: string;
  achievedAt: string;
  coinsAwarded: number;
  createdAt: string;
};

export type AcademicFullHistory = {
  grades: AcademicGradeHistoryRecord[];
  homework: AcademicHomeworkHistoryRecord[];
  comments: AcademicCommentHistoryRecord[];
  achievements: AcademicAchievementHistoryRecord[];
};

async function getSession() {
  const session = await getValidStaffSession();
  if (!session) throw new Error("Сессия сотрудника не найдена. Войдите снова.");
  return session;
}

function friendlyMessage(message: string) {
  if (message.toLowerCase().includes("row-level security")) return "У вас нет доступа к этой записи.";
  if (message.includes("not authorized")) return "У вас нет доступа к этому ученику или предмету.";
  return message;
}

async function tableRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const session = await getSession();
  const headers = new Headers(init.headers);
  headers.set("apikey", SUPABASE_PUBLISHABLE_KEY);
  headers.set("Authorization", `Bearer ${session.access_token}`);
  if (init.body) headers.set("Content-Type", "application/json");

  const response = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, { ...init, headers });
  if (!response.ok) {
    let message = "Не удалось выполнить действие.";
    try {
      const payload = (await response.json()) as ApiError;
      message = payload.message || payload.details || message;
    } catch {
      // ignore invalid JSON error bodies
    }
    throw new Error(friendlyMessage(message));
  }

  if (response.status === 204) return undefined as T;
  const text = await response.text();
  return (text ? JSON.parse(text) : undefined) as T;
}

function tablePath(table: string, params: Record<string, string>) {
  return `${table}?${new URLSearchParams(params).toString()}`;
}

function ensureChanged(rows: unknown[], message: string) {
  if (!Array.isArray(rows) || rows.length === 0) throw new Error(message);
}

function createdByFilter(createdBy: string) {
  return createdBy ? `eq.${createdBy}` : "is.null";
}

function commentPath(record: AcademicCommentHistoryRecord) {
  return record.audienceScope === "group" && record.publicationId
    ? tablePath("teacher_comments", { publication_id: `eq.${record.publicationId}` })
    : tablePath("teacher_comments", { id: `eq.${record.id}` });
}

export async function searchAcademicStudents(query: string): Promise<AcademicStudentOption[]> {
  const terms = query.trim().toLocaleLowerCase("ru-RU").split(/\s+/).filter(Boolean);
  if (!terms.length) return [];

  const firstTerm = terms[0].replace(/[,*()]/g, "");
  const rows = await tableRequest<any[]>(tablePath("children", {
    select: "id,first_name,last_name,branch,group_name,lesson_time",
    archived_at: "is.null",
    or: `(first_name.ilike.*${firstTerm}*,last_name.ilike.*${firstTerm}*)`,
    order: "last_name.asc,first_name.asc",
    limit: "100",
  }));

  return (rows || [])
    .map((row) => ({
      id: row.id,
      name: `${row.last_name || ""} ${row.first_name || ""}`.trim() || "Ученик",
      branch: row.branch || "",
      groupName: row.group_name || "",
      lessonTime: row.lesson_time || "",
    }))
    .filter((student) => {
      const haystack = student.name.toLocaleLowerCase("ru-RU");
      return terms.every((term) => haystack.includes(term));
    });
}

export async function fetchAcademicFullHistory(childId: string): Promise<AcademicFullHistory> {
  if (!childId) return { grades: [], homework: [], comments: [], achievements: [] };
  const childFilter = { child_id: `eq.${childId}` };

  const [gradeRows, homeworkRows, commentRows, achievementRows] = await Promise.all([
    tableRequest<any[]>(tablePath("grades", {
      select: "id,subject,grade,lesson_date,teacher_name,created_at",
      ...childFilter,
      order: "lesson_date.desc,created_at.desc",
      limit: "250",
    })),
    tableRequest<any[]>(tablePath("homework", {
      select: "id,subject,title,description,text_content,due_date,lesson_date,teacher_name,created_at,created_by",
      ...childFilter,
      order: "lesson_date.desc,created_at.desc",
      limit: "250",
    })),
    tableRequest<any[]>(tablePath("teacher_comments", {
      select: "id,subject,title,comment_text,comment_date,teacher_name,created_at,publication_id,audience_scope",
      ...childFilter,
      order: "comment_date.desc,created_at.desc",
      limit: "250",
    })),
    tableRequest<any[]>(tablePath("achievements", {
      select: "id,title,description,coins_awarded,achieved_at,created_at",
      ...childFilter,
      order: "achieved_at.desc,created_at.desc",
      limit: "250",
    })),
  ]);

  return {
    grades: (gradeRows || []).map((row) => ({
      id: row.id,
      subject: row.subject || "Без предмета",
      grade: Number(row.grade),
      lessonDate: row.lesson_date || "",
      teacherName: row.teacher_name || "",
      createdAt: row.created_at || "",
    })),
    homework: (homeworkRows || []).map((row) => ({
      id: row.id,
      subject: row.subject || "Без предмета",
      title: row.title || "Домашнее задание",
      description: row.description || row.text_content || "",
      dueDate: row.due_date || "",
      lessonDate: row.lesson_date || "",
      teacherName: row.teacher_name || "",
      createdAt: row.created_at || "",
      createdBy: row.created_by || "",
    })),
    comments: (commentRows || []).map((row) => ({
      id: row.id,
      subject: row.subject || "Без предмета",
      title: row.title || "",
      text: row.comment_text || "",
      date: row.comment_date || "",
      teacherName: row.teacher_name || "",
      createdAt: row.created_at || "",
      publicationId: row.publication_id || "",
      audienceScope: row.audience_scope === "group" ? "group" : "individual",
    })),
    achievements: (achievementRows || []).map((row) => ({
      id: row.id,
      title: row.title || "Достижение",
      description: row.description || "",
      achievedAt: row.achieved_at || "",
      coinsAwarded: Number(row.coins_awarded || 0),
      createdAt: row.created_at || "",
    })),
  };
}

export async function updateHistoryGrade(id: string, grade: number) {
  if (!Number.isInteger(grade) || grade < 1 || grade > 5) throw new Error("Оценка должна быть от 1 до 5.");
  const rows = await tableRequest<any[]>(tablePath("grades", { id: `eq.${id}` }), {
    method: "PATCH",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({ grade }),
  });
  ensureChanged(rows, "Оценка не найдена или у вас нет доступа к ней.");
}

export async function deleteHistoryGrade(id: string) {
  const rows = await tableRequest<any[]>(tablePath("grades", { id: `eq.${id}` }), {
    method: "DELETE",
    headers: { Prefer: "return=representation" },
  });
  ensureChanged(rows, "Оценка уже удалена или у вас нет доступа к ней.");
}

export async function updateHistoryHomework(input: {
  record: AcademicHomeworkHistoryRecord;
  title: string;
  description: string;
  dueDate: string;
}) {
  if (!input.title.trim()) throw new Error("Введите название домашнего задания.");
  const rows = await tableRequest<any[]>(tablePath("homework", {
    subject: `eq.${input.record.subject}`,
    created_at: `eq.${input.record.createdAt}`,
    created_by: createdByFilter(input.record.createdBy),
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

export async function deleteHistoryHomework(record: AcademicHomeworkHistoryRecord) {
  const rows = await tableRequest<any[]>(tablePath("homework", {
    subject: `eq.${record.subject}`,
    created_at: `eq.${record.createdAt}`,
    created_by: createdByFilter(record.createdBy),
  }), {
    method: "DELETE",
    headers: { Prefer: "return=representation" },
  });
  ensureChanged(rows, "Домашнее задание уже удалено или у вас нет доступа к нему.");
  return rows.length;
}

export async function updateHistoryComment(input: {
  record: AcademicCommentHistoryRecord;
  title: string;
  text: string;
  date: string;
}) {
  if (!input.text.trim()) throw new Error("Введите текст комментария.");
  if (!input.date) throw new Error("Укажите дату комментария.");
  const rows = await tableRequest<any[]>(commentPath(input.record), {
    method: "PATCH",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({
      title: input.title.trim() || null,
      comment_text: input.text.trim(),
      comment_date: input.date,
    }),
  });
  ensureChanged(rows, "Комментарий не найден или у вас нет доступа к нему.");
  return rows.length;
}

export async function deleteHistoryComment(record: AcademicCommentHistoryRecord) {
  const rows = await tableRequest<any[]>(commentPath(record), {
    method: "DELETE",
    headers: { Prefer: "return=representation" },
  });
  ensureChanged(rows, "Комментарий уже удалён или у вас нет доступа к нему.");
  return rows.length;
}

export async function updateHistoryAchievement(input: {
  id: string;
  title: string;
  description: string;
  achievedAt: string;
}) {
  if (!input.title.trim()) throw new Error("Введите название достижения.");
  if (!input.achievedAt) throw new Error("Укажите дату достижения.");
  const rows = await tableRequest<any[]>(tablePath("achievements", { id: `eq.${input.id}` }), {
    method: "PATCH",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({
      title: input.title.trim(),
      description: input.description.trim() || null,
      achieved_at: input.achievedAt,
    }),
  });
  ensureChanged(rows, "Достижение не найдено или у вас нет доступа к нему.");
}

export async function deleteHistoryAchievement(id: string) {
  const rows = await tableRequest<any[]>(tablePath("achievements", { id: `eq.${id}` }), {
    method: "DELETE",
    headers: { Prefer: "return=representation" },
  });
  ensureChanged(rows, "Достижение уже удалено или у вас нет доступа к нему.");
}
