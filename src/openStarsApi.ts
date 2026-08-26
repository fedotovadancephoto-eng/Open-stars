const SUPABASE_URL =
  "https://yiwiykbuaggyslfyhlfo.supabase.co";

const SUPABASE_PUBLISHABLE_KEY =
  "sb_publishable_1MORh5rY7uMDVYLYVX5VAA_cyoph4-7";

const SESSION_STORAGE_KEY =
  "openstars_parent_session";

export type ParentSession = {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  expires_at: number;
  token_type: string;
};

export type ParentLoginResult = {
  ok: true;
  phone: string;
  session: ParentSession;
  user: {
    id: string;
  };
};

export type ParentRegistrationResult = {
  ok: true;
  phone: string;
  message: string;
};

type ApiErrorResponse = {
  error?: string;
  message?: string;
};

async function callEdgeFunction<T>(
  functionName: string,
  body: Record<string, unknown>
): Promise<T> {
  const response = await fetch(
    `${SUPABASE_URL}/functions/v1/${functionName}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: SUPABASE_PUBLISHABLE_KEY,
      },
      body: JSON.stringify(body),
    }
  );

  let data: T | ApiErrorResponse;

  try {
    data = await response.json();
  } catch {
    throw new Error("Не удалось получить ответ от сервера.");
  }

  if (!response.ok) {
    const errorData = data as ApiErrorResponse;
    throw new Error(
      errorData.message ||
        "Что-то пошло не так. Попробуйте ещё раз."
    );
  }

  return data as T;
}

export async function registerParent(
  phone: string,
  activationCode: string,
  password: string
) {
  return callEdgeFunction<ParentRegistrationResult>(
    "register-parent",
    { phone, activationCode, password }
  );
}

export async function loginParent(
  phone: string,
  password: string
) {
  const result = await callEdgeFunction<ParentLoginResult>(
    "login-parent",
    { phone, password }
  );

  saveParentSession(result.session);
  return result;
}

export function saveParentSession(session: ParentSession) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(
    SESSION_STORAGE_KEY,
    JSON.stringify(session)
  );
}

export function getParentSession(): ParentSession | null {
  if (typeof window === "undefined") return null;

  const stored = window.localStorage.getItem(SESSION_STORAGE_KEY);
  if (!stored) return null;

  try {
    return JSON.parse(stored) as ParentSession;
  } catch {
    clearParentSession();
    return null;
  }
}

export function clearParentSession() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(SESSION_STORAGE_KEY);
}

export function isParentSessionExpired(session: ParentSession) {
  const now = Math.floor(Date.now() / 1000);
  return session.expires_at <= now + 30;
}

export async function refreshParentSession() {
  const currentSession = getParentSession();
  if (!currentSession) return null;

  const response = await fetch(
    `${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: SUPABASE_PUBLISHABLE_KEY,
      },
      body: JSON.stringify({
        refresh_token: currentSession.refresh_token,
      }),
    }
  );

  if (!response.ok) {
    clearParentSession();
    return null;
  }

  const data = await response.json();

  const session: ParentSession = {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expires_in: data.expires_in,
    expires_at:
      data.expires_at ??
      Math.floor(Date.now() / 1000) + data.expires_in,
    token_type: data.token_type,
  };

  saveParentSession(session);
  return session;
}

export async function getValidParentSession() {
  const session = getParentSession();
  if (!session) return null;
  if (!isParentSessionExpired(session)) return session;
  return refreshParentSession();
}

export function logoutParent() {
  clearParentSession();
}

async function restSelect<T>(
  table: string,
  query: string,
  accessToken: string
): Promise<T[]> {
  const response = await fetch(
    `${SUPABASE_URL}/rest/v1/${table}?${query}`,
    {
      headers: {
        apikey: SUPABASE_PUBLISHABLE_KEY,
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );

  if (!response.ok) {
    const text = await response.text();
    throw new Error(
      `Не удалось загрузить ${table}: ${text || response.status}`
    );
  }

  return response.json();
}

function formatDate(value?: string | null) {
  if (!value) return "";
  const date = new Date(`${value}T12:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("ru-RU", {
    day: "numeric",
    month: "short",
  })
    .format(date)
    .replace(".", "");
}

function formatDateTime(value?: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("ru-RU", {
    day: "numeric",
    month: "short",
  })
    .format(date)
    .replace(".", "");
}

function weekday(value?: string | null) {
  if (!value) return "";
  const date = new Date(`${value}T12:00:00`);
  if (Number.isNaN(date.getTime())) return "";
  const result = new Intl.DateTimeFormat("ru-RU", {
    weekday: "long",
  }).format(date);
  return result.charAt(0).toUpperCase() + result.slice(1);
}

function timeShort(value?: string | null) {
  return value ? value.slice(0, 5) : "";
}

function calculateAge(value?: string | null) {
  if (!value) return null;
  const birth = new Date(`${value}T12:00:00`);
  if (Number.isNaN(birth.getTime())) return null;
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const beforeBirthday =
    today.getMonth() < birth.getMonth() ||
    (today.getMonth() === birth.getMonth() &&
      today.getDate() < birth.getDate());
  if (beforeBirthday) age -= 1;
  return age;
}

export async function fetchParentDashboard() {
  const session = await getValidParentSession();
  if (!session) throw new Error("Сессия истекла. Войдите снова.");

  const token = session.access_token;

  const [profiles, children] = await Promise.all([
    restSelect<any>(
      "users_profile",
      "select=id,full_name&limit=1",
      token
    ),
    restSelect<any>(
      "children",
      "select=id,first_name,last_name,group_name,photo_url,coins,payment_status,branch,level,lesson_day,lesson_time,mentor_name,birth_date&limit=1",
      token
    ),
  ]);

  const profile = profiles[0];
  const dbChild = children[0];

  if (!dbChild) {
    throw new Error("К аккаунту родителя не привязан ребёнок.");
  }

  const childId = encodeURIComponent(dbChild.id);

  const [
    gradeRows,
    attendanceRows,
    homeworkRows,
    commentRows,
    achievementRows,
    scheduleRows,
    paymentRows,
    coinRows,
    newsRows,
    photoRows,
  ] = await Promise.all([
    restSelect<any>(
      "grades",
      `select=*&child_id=eq.${childId}&order=lesson_date.desc`,
      token
    ),
    restSelect<any>(
      "attendance",
      `select=*&child_id=eq.${childId}&order=lesson_date.desc`,
      token
    ),
    restSelect<any>(
      "homework",
      `select=*&child_id=eq.${childId}&order=due_date.asc`,
      token
    ),
    restSelect<any>(
      "teacher_comments",
      `select=*&child_id=eq.${childId}&order=comment_date.desc`,
      token
    ),
    restSelect<any>(
      "achievements",
      `select=*&child_id=eq.${childId}&order=achieved_at.desc`,
      token
    ),
    restSelect<any>(
      "schedules",
      `select=*&child_id=eq.${childId}&order=lesson_date.asc,start_time.asc`,
      token
    ),
    restSelect<any>(
      "payments",
      `select=*&child_id=eq.${childId}&order=month.desc`,
      token
    ),
    restSelect<any>(
      "coin_transactions",
      `select=*&child_id=eq.${childId}&order=created_at.desc`,
      token
    ),
    restSelect<any>(
      "school_news",
      "select=*&active=eq.true&order=created_at.desc",
      token
    ),
    restSelect<any>(
      "photo_sessions",
      "select=*&is_published=eq.true&order=published_at.desc.nullslast,created_at.desc",
      token
    ),
  ]);

  const fullName = [dbChild.first_name, dbChild.last_name]
    .filter(Boolean)
    .join(" ");

  const averageGrade = gradeRows.length
    ? gradeRows.reduce((sum, row) => sum + Number(row.grade || 0), 0) /
      gradeRows.length
    : 0;

  const overall = averageGrade
    ? Math.round((averageGrade / 5) * 100)
    : 0;

  const attended = attendanceRows.filter((row) => row.present).length;
  const attendancePct = attendanceRows.length
    ? Math.round((attended / attendanceRows.length) * 100)
    : 0;

  const subjects = new Map<string, number[]>();
  gradeRows.forEach((row) => {
    const key = row.subject || "Занятия";
    const list = subjects.get(key) || [];
    list.push(Number(row.grade || 0));
    subjects.set(key, list);
  });

  const skills = Array.from(subjects.entries()).map(([name, values]) => ({
    name,
    mastery: Math.round(
      (values.reduce((sum, value) => sum + value, 0) /
        Math.max(values.length, 1) /
        5) *
        100
    ),
  }));

  const monthlyAttendance = new Map<string, { total: number; present: number }>();
  attendanceRows.forEach((row) => {
    const date = new Date(`${row.lesson_date}T12:00:00`);
    const key = `${date.getFullYear()}-${date.getMonth()}`;
    const current = monthlyAttendance.get(key) || { total: 0, present: 0 };
    current.total += 1;
    if (row.present) current.present += 1;
    monthlyAttendance.set(key, current);
  });

  const monthly = Array.from(monthlyAttendance.entries())
    .slice(-4)
    .map(([key, value]) => {
      const [year, month] = key.split("-").map(Number);
      return {
        label: new Intl.DateTimeFormat("ru-RU", { month: "short" })
          .format(new Date(year, month, 1))
          .replace(".", ""),
        value: value.total
          ? Math.round((value.present / value.total) * 100)
          : 0,
      };
    });

  const now = new Date();
  const earnedThisMonth = coinRows
    .filter((row) => {
      const date = new Date(row.created_at);
      return (
        Number(row.amount) > 0 &&
        date.getMonth() === now.getMonth() &&
        date.getFullYear() === now.getFullYear()
      );
    })
    .reduce((sum, row) => sum + Number(row.amount || 0), 0);

  return {
    parent: {
      firstName: "Родитель",
      name: profile?.full_name || "Родитель",
    },
    child: {
      id: dbChild.id,
      name: fullName,
      firstName: dbChild.first_name || "",
      lastName: dbChild.last_name || "",
      age: calculateAge(dbChild.birth_date),
      group: dbChild.group_name || "",
      groupName: dbChild.group_name || "",
      branch: dbChild.branch || "",
      campus: dbChild.branch || "",
      level: dbChild.level || dbChild.group_name || "",
      lessonDay: dbChild.lesson_day || "",
      lesson_day: dbChild.lesson_day || "",
      lessonTime: dbChild.lesson_time
        ? timeShort(dbChild.lesson_time)
        : "",
      lesson_time: dbChild.lesson_time
        ? timeShort(dbChild.lesson_time)
        : "",
      mentorName: dbChild.mentor_name || "",
      mentor_name: dbChild.mentor_name || "",
      administrator: dbChild.mentor_name || "",
      administratorName: dbChild.mentor_name || "",
      coins: Number(dbChild.coins || 0),
      photo: dbChild.photo_url || "",
      avatar: dbChild.photo_url || "",
      paymentStatus: dbChild.payment_status || "",
    },
    quickStats: {
      coins: Number(dbChild.coins || 0),
      progress: overall,
      homeworkPending: homeworkRows.filter(
        (row) => row.status !== "completed"
      ).length,
    },
    coins: {
      balance: Number(dbChild.coins || 0),
      earnedThisMonth,
    },
    coinHistory: coinRows.map((row) => ({
      id: row.id,
      amount: Number(row.amount || 0),
      title: row.reason || "Начисление Star Coin",
      date: formatDateTime(row.created_at),
      source: row.source || "OPEN STARS",
      type: row.source === "automatic" ? "auto" : "manual",
    })),
    grades: gradeRows.map((row) => ({
      id: row.id,
      subject: row.subject,
      grade: Number(row.grade),
      value: Number(row.grade),
      date: formatDate(row.lesson_date),
      teacher: "Преподаватель",
      comment: "",
    })),
    progress: {
      overall,
      month: overall,
      attendance: attendancePct,
      averageGrade: Number(averageGrade.toFixed(1)),
      level: 1,
      levelName: dbChild.level || dbChild.group_name || "OPEN STARS",
      xp: overall,
      xpToNext: 100,
      skills,
      achievements: achievementRows.slice(0, 4).map((row) => ({
        label: row.title,
        month: formatDate(row.achieved_at),
        icon: "★",
      })),
    },
    attendance: {
      records: attendanceRows.map((row) => ({
        id: row.id,
        date: formatDate(row.lesson_date),
        subject: row.subject,
        present: Boolean(row.present),
        status: row.present ? "present" : "absent",
      })),
      percentage: attendancePct,
      rate: attendancePct,
      total: attendanceRows.length,
      present: attended,
      absent: attendanceRows.length - attended,
      attended,
      monthly,
    },
    homework: homeworkRows.map((row) => ({
      id: row.id,
      subject: row.subject || "Занятие",
      title: row.title || "Домашнее задание",
      description: row.description || row.text_content || "",
      dueDate: formatDate(row.due_date),
      date: formatDate(row.lesson_date),
      status:
        row.status === "completed"
          ? "completed"
          : row.status === "in-progress"
            ? "in-progress"
            : "new",
      completed: row.status === "completed",
    })),
    comments: commentRows.map((row) => ({
      id: row.id,
      subject: row.subject || "Занятие",
      teacher: "Преподаватель",
      title: row.title || "Комментарий педагога",
      text: row.comment_text || "",
      comment: row.comment_text || "",
      date: formatDate(row.comment_date),
    })),
    achievements: achievementRows.map((row) => ({
      id: row.id,
      title: row.title,
      description: row.description || "",
      date: formatDate(row.achieved_at),
      coins: Number(row.coins_awarded || 0),
      amount: Number(row.coins_awarded || 0),
    })),
    news: newsRows.map((row) => ({
      id: row.id,
      title: row.title,
      description: row.body || "",
      excerpt: row.body || "",
      body: row.body || "",
      date: formatDateTime(row.published_at || row.created_at),
      category: row.category || "OPEN STARS",
      tag: row.tag || "announcement",
    })),
    schedule: scheduleRows.map((row, index) => ({
      id: row.id,
      day: weekday(row.lesson_date),
      date: formatDate(row.lesson_date),
      time: timeShort(row.start_time),
      endTime: timeShort(row.end_time),
      duration: `${timeShort(row.start_time)}–${timeShort(row.end_time)}`,
      subject: row.subject,
      title: row.subject,
      teacher: row.instructor_name || "Преподаватель",
      instructor: row.instructor_name || "Преподаватель",
      room: row.room || "Уточняется",
      branch: dbChild.branch || "",
      color: index % 2 === 0 ? "orange" : "olive",
    })),
    payments: paymentRows.map((row) => ({
      id: row.id,
      month: row.month,
      amount: Number(row.amount || 0),
      status: row.status,
      statusLabel:
        row.status === "paid" ? "Оплачено" : "Ожидает оплаты",
      dueDate: formatDate(row.due_date),
    })),
    photos: photoRows.map((row) => ({
      id: row.id,
      title: row.title,
      description: "Фотографии опубликованы администратором OPEN STARS.",
      date: formatDateTime(row.published_at || row.created_at),
      galleryUrl: row.gallery_url || "",
      url: row.gallery_url || "",
      published: Boolean(row.is_published),
    })),
  };
}
