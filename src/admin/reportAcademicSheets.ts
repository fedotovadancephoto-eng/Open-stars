import type { XlsxSheet } from "@/admin/xlsxExport";
import { ReportContext, ReportFilters, childName, filterChildren, inPeriod, reportRestSelect } from "@/admin/reportExportShared";

export async function buildAcademicSheets(filters: ReportFilters, context: ReportContext): Promise<XlsxSheet[]> {
  const children = filterChildren(context, filters);
  if (!children.length) throw new Error("По выбранным фильтрам учеников не найдено.");
  const childMap = new Map(children.map((child) => [child.id, child]));
  const allowedIds = new Set(children.map((child) => child.id));

  const [grades, attendance, homework, comments, achievements, schedules] = await Promise.all([
    reportRestSelect("grades", "child_id,subject,grade,lesson_date,teacher_name,created_at", "lesson_date.asc"),
    reportRestSelect("attendance", "child_id,lesson_date,subject,present,created_at", "lesson_date.asc"),
    reportRestSelect("homework", "child_id,subject,title,description,text_content,due_date,lesson_date,status,teacher_name,created_at", "lesson_date.asc"),
    reportRestSelect("teacher_comments", "child_id,subject,title,comment_text,comment_date,teacher_name,audience_scope,created_at", "comment_date.asc"),
    reportRestSelect("achievements", "child_id,title,description,coins_awarded,achieved_at,created_at", "achieved_at.asc"),
    reportRestSelect("schedules", "child_id,lesson_date,subject,start_time,end_time,instructor_name,room,created_at", "lesson_date.asc,start_time.asc"),
  ]);

  const include = (row: Record<string, any>, dateField: string) => allowedIds.has(row.child_id) && inPeriod(row[dateField] || row.created_at, filters);

  const sheets: XlsxSheet[] = [
    {
      name: "Сводка",
      columns: [{ key: "parameter", label: "Параметр", width: 28 }, { key: "value", label: "Значение", width: 42 }],
      rows: [
        { parameter: "Сформировано", value: new Date().toLocaleString("ru-RU") },
        { parameter: "Режим", value: context.teacherView ? "Педагог" : "Административный" },
        { parameter: "Филиал", value: filters.branch || "Все доступные" },
        { parameter: "Группа", value: filters.groupName || "Все доступные" },
        { parameter: "Ученик", value: filters.childId ? childMap.get(filters.childId)?.fullName || "Выбранный ученик" : "Все доступные" },
        { parameter: "Период", value: filters.fromDate || filters.toDate ? `${filters.fromDate || "начало"} — ${filters.toDate || "сегодня"}` : "Вся история" },
        { parameter: "Учеников", value: children.length },
      ],
    },
    {
      name: "Ученики",
      columns: context.teacherView
        ? [{ key: "name", label: "Ученик", width: 28 }, { key: "branch", label: "Филиал", width: 18 }, { key: "group", label: "Группа", width: 18 }, { key: "stream", label: "Поток", width: 12 }]
        : [{ key: "name", label: "Ученик", width: 28 }, { key: "birthDate", label: "Дата рождения", width: 16 }, { key: "branch", label: "Филиал", width: 18 }, { key: "group", label: "Группа", width: 18 }, { key: "lessonDay", label: "День", width: 14 }, { key: "stream", label: "Поток", width: 12 }],
      rows: children.map((child) => ({ name: child.fullName, birthDate: child.birthDate, branch: child.branch, group: child.groupName, lessonDay: child.lessonDay, stream: child.lessonTime?.slice(0, 5) || "" })),
    },
    {
      name: "Оценки",
      columns: [{ key: "date", label: "Дата", width: 14 }, { key: "child", label: "Ученик", width: 28 }, { key: "subject", label: "Предмет", width: 24 }, { key: "grade", label: "Оценка", width: 10 }, { key: "teacher", label: "Педагог", width: 28 }],
      rows: grades.filter((row) => include(row, "lesson_date")).map((row) => ({ date: row.lesson_date, child: childName(childMap, row.child_id), subject: row.subject, grade: Number(row.grade), teacher: row.teacher_name || "" })),
    },
    {
      name: "Посещаемость",
      columns: [{ key: "date", label: "Дата", width: 14 }, { key: "child", label: "Ученик", width: 28 }, { key: "subject", label: "Предмет", width: 24 }, { key: "present", label: "Присутствовал", width: 16 }],
      rows: attendance.filter((row) => include(row, "lesson_date")).map((row) => ({ date: row.lesson_date, child: childName(childMap, row.child_id), subject: row.subject, present: Boolean(row.present) })),
    },
    {
      name: "Домашние задания",
      columns: [{ key: "lessonDate", label: "Дата занятия", width: 15 }, { key: "dueDate", label: "Срок", width: 15 }, { key: "child", label: "Ученик", width: 28 }, { key: "subject", label: "Предмет", width: 24 }, { key: "title", label: "Задание", width: 32 }, { key: "description", label: "Описание", width: 55 }, { key: "status", label: "Статус", width: 16 }, { key: "teacher", label: "Педагог", width: 28 }],
      rows: homework.filter((row) => include(row, "lesson_date")).map((row) => ({ lessonDate: row.lesson_date, dueDate: row.due_date, child: childName(childMap, row.child_id), subject: row.subject, title: row.title || "Домашнее задание", description: row.description || row.text_content || "", status: row.status || "", teacher: row.teacher_name || "" })),
    },
    {
      name: "Комментарии",
      columns: [{ key: "date", label: "Дата", width: 14 }, { key: "child", label: "Ученик", width: 28 }, { key: "subject", label: "Предмет", width: 24 }, { key: "audience", label: "Аудитория", width: 18 }, { key: "title", label: "Заголовок", width: 30 }, { key: "text", label: "Комментарий", width: 60 }, { key: "teacher", label: "Педагог", width: 28 }],
      rows: comments.filter((row) => include(row, "comment_date")).map((row) => ({ date: row.comment_date, child: childName(childMap, row.child_id), subject: row.subject, audience: row.audience_scope === "group" ? "Вся группа" : "Лично", title: row.title || "", text: row.comment_text || "", teacher: row.teacher_name || "" })),
    },
    {
      name: "Достижения",
      columns: [{ key: "date", label: "Дата", width: 14 }, { key: "child", label: "Ученик", width: 28 }, { key: "title", label: "Достижение", width: 32 }, { key: "description", label: "Описание", width: 55 }, { key: "coins", label: "Star Coin", width: 12 }],
      rows: achievements.filter((row) => include(row, "achieved_at")).map((row) => ({ date: row.achieved_at, child: childName(childMap, row.child_id), title: row.title, description: row.description || "", coins: Number(row.coins_awarded || 0) })),
    },
    {
      name: "Расписание",
      columns: [{ key: "date", label: "Дата", width: 14 }, { key: "child", label: "Ученик", width: 28 }, { key: "subject", label: "Предмет", width: 24 }, { key: "start", label: "Начало", width: 12 }, { key: "end", label: "Конец", width: 12 }, { key: "teacher", label: "Педагог", width: 28 }, { key: "room", label: "Зал", width: 18 }],
      rows: schedules.filter((row) => include(row, "lesson_date")).map((row) => ({ date: row.lesson_date, child: childName(childMap, row.child_id), subject: row.subject, start: String(row.start_time || "").slice(0, 5), end: String(row.end_time || "").slice(0, 5), teacher: row.instructor_name || "", room: row.room || "" })),
    },
  ];

  return sheets;
}
