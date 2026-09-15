export type ParentGrade = {
  id: string;
  subject: string;
  grade: number | null;
  value: number | null;
  lessonDate: string;
  createdAt: string;
  date: string;
  teacher: string;
  comment: string;
};

export type DatabaseGrade = {
  id: string;
  subject: string | null;
  grade: number | null;
  lesson_date: string | null;
  created_at: string | null;
  teacher_name: string | null;
};

export type GradedLesson = ParentGrade & { grade: number };
export type GradeSubject = { key: string; label: string; kind: "core" | "masterclass" | "unknown" };
export type GradeSubjectRow = GradeSubject & { grades: GradedLesson[]; average: number | null };

export const CORE_SUBJECTS: GradeSubject[] = [
  { key: "choreography", label: "Хореография", kind: "core" },
  { key: "photoposing", label: "Фотопозирование", kind: "core" },
  { key: "runway", label: "Дефиле", kind: "core" },
  { key: "acting", label: "Актёрское мастерство", kind: "core" },
];

export const JOURNAL_MONTHS = [
  ["09", "Сентябрь"], ["10", "Октябрь"], ["11", "Ноябрь"], ["12", "Декабрь"],
  ["01", "Январь"], ["02", "Февраль"], ["03", "Март"], ["04", "Апрель"],
  ["05", "Май"], ["06", "Июнь"], ["07", "Июль"], ["08", "Август"],
] as const;

const normalize = (value: string) => value.trim().replace(/\s+/g, " ").toLocaleLowerCase("ru-RU").replace(/ё/g, "е");
const coreKeys: Record<string, string> = {
  "хореография": "choreography", "фотопозирование": "photoposing",
  "дефиле": "runway", "дефиле и подиумный шаг": "runway", "актерское мастерство": "acting",
};
const masterclassTopics: Record<string, { key: string; label: string }> = {
  "стиль": { key: "style", label: "МК по стилю" },
  "стилю": { key: "style", label: "МК по стилю" },
  "визаж": { key: "visage", label: "МК по визажу" },
  "визажу": { key: "visage", label: "МК по визажу" },
};

export function gradeSubject(subject: string): GradeSubject {
  const name = subject.trim().replace(/\s+/g, " ");
  const coreKey = coreKeys[normalize(name)];
  const core = CORE_SUBJECTS.find(item => item.key === coreKey);
  if (core) return core;
  if (!name || ["без предмета", "занятие", "занятия"].includes(normalize(name))) {
    return { key: "unknown", label: "Без предмета", kind: "unknown" };
  }
  // Strip only an explicit prefix. A named MK about a core subject stays a separate MK.
  const parsedName = name.replace(/[\u2010-\u2015]/g, "-");
  const topic = parsedName.replace(/^(?:мк|мастер[\s-]?класс)(?=\s|[:-]|$)[\s:-]*/iu, "").replace(/^по\s+/iu, "").trim();
  if (!topic) return { key: "mk:untitled", label: "МК без названия", kind: "masterclass" };
  const known = masterclassTopics[normalize(topic)];
  return {
    key: `mk:${known?.key || normalize(topic)}`,
    label: known?.label || (/^(?:мк|мастер[\s-]?класс)\s+по\s+/iu.test(parsedName) ? `МК по ${topic}` : `МК: ${topic}`),
    kind: "masterclass",
  };
}

export function validGrade(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 1 && value <= 5;
}

export function isGraded(lesson: ParentGrade): lesson is GradedLesson {
  return validGrade(lesson.grade);
}

function validLessonDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value)
    && Number.isFinite(Date.parse(`${value}T12:00:00Z`))
    && new Date(`${value}T12:00:00Z`).toISOString().slice(0, 10) === value;
}

export function gradeDate(value: string, full = false) {
  if (!validLessonDate(value)) return "Дата не указана";
  return new Intl.DateTimeFormat("ru-RU", {
    day: "numeric", month: full ? "long" : "short", ...(full ? { year: "numeric" } as const : {}), timeZone: "UTC",
  }).format(new Date(`${value}T12:00:00Z`)).replace(/\.$/, "");
}

export function mapParentGrade(row: DatabaseGrade): ParentGrade {
  const grade = validGrade(row.grade) ? row.grade : null;
  return {
    id: row.id, subject: row.subject || "Без предмета", grade, value: grade,
    lessonDate: row.lesson_date || "", createdAt: row.created_at || "", date: gradeDate(row.lesson_date || ""),
    teacher: row.teacher_name || "Преподаватель OPEN STARS", comment: "",
  };
}

export function currentSchoolYear(now = new Date()) {
  const day = new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Irkutsk" }).format(now);
  return Number(day.slice(0, 4)) - (Number(day.slice(5, 7)) < 9 ? 1 : 0);
}

function schoolYearOf(lessonDate: string) {
  return Number(lessonDate.slice(0, 4)) - (Number(lessonDate.slice(5, 7)) < 9 ? 1 : 0);
}

export function journalYears(grades: ParentGrade[], current = currentSchoolYear()) {
  const years = new Set([current]);
  for (const item of grades) if (isGraded(item) && validLessonDate(item.lessonDate)) years.add(schoolYearOf(item.lessonDate));
  return [...years].sort((a, b) => b - a);
}

export function gradesForPeriod(grades: ParentGrade[], year: number | null, month = "all") {
  return grades.filter(isGraded).filter(item => {
    if (year === null && month === "all") return true;
    if (!validLessonDate(item.lessonDate)) return false;
    return (year === null || schoolYearOf(item.lessonDate) === year)
      && (month === "all" || item.lessonDate.slice(5, 7) === month);
  });
}

export function gradeAverage(grades: ParentGrade[]) {
  const values = grades.filter(isGraded);
  return values.length ? values.reduce((sum, item) => sum + item.grade, 0) / values.length : null;
}

export function groupJournalGrades(grades: ParentGrade[]): GradeSubjectRow[] {
  const rows = new Map<string, GradeSubjectRow>(CORE_SUBJECTS.map(subject => [subject.key, { ...subject, grades: [], average: null }]));
  for (const item of grades) {
    if (!isGraded(item)) continue;
    const subject = gradeSubject(item.subject);
    if (!rows.has(subject.key)) rows.set(subject.key, { ...subject, grades: [], average: null });
    rows.get(subject.key)!.grades.push(item);
  }
  for (const row of rows.values()) {
    row.grades.sort((a, b) => a.lessonDate.localeCompare(b.lessonDate) || a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id));
    row.average = gradeAverage(row.grades);
  }
  return [...rows.values()].sort((a, b) => {
    const ai = CORE_SUBJECTS.findIndex(item => item.key === a.key);
    const bi = CORE_SUBJECTS.findIndex(item => item.key === b.key);
    if (ai >= 0 || bi >= 0) return (ai < 0 ? CORE_SUBJECTS.length : ai) - (bi < 0 ? CORE_SUBJECTS.length : bi);
    return a.label.localeCompare(b.label, "ru");
  });
}
