import type { XlsxSheet } from "@/admin/xlsxExport";
import { ReportContext, ReportFilters, activationLabel, childName, filterChildren, inPeriod, paymentLabel, reportRestSelect } from "@/admin/reportExportShared";

function feedbackStatus(value: string) {
  return value === "new" ? "Новое" : value === "read" ? "В работе" : value === "closed" ? "Обработано" : value === "archived" ? "Архив" : value || "";
}

export async function buildAdminSheets(filters: ReportFilters, context: ReportContext): Promise<XlsxSheet[]> {
  if (context.teacherView) return [];
  const children = filterChildren(context, filters);
  const childMap = new Map(children.map((child) => [child.id, child]));
  const ids = new Set(children.map((child) => child.id));
  const [coins, payments, feedback, news, photos] = await Promise.all([
    reportRestSelect("coin_transactions", "child_id,amount,transaction_type,reason,source,created_at", "created_at.asc"),
    reportRestSelect("payments", "child_id,month,due_date,status,amount,created_at", "month.asc"),
    reportRestSelect("parent_feedback", "child_id,category,message,status,branch_snapshot,child_name_snapshot,parent_name_snapshot,created_at", "created_at.asc"),
    reportRestSelect("school_news", "title,body,category,audience_scope,branch,group_name,active,published_at,created_at", "created_at.asc"),
    reportRestSelect("photo_sessions", "title,description,gallery_url,is_published,published_at,branch,group_name,lesson_day,lesson_time,created_at", "created_at.asc"),
  ]);

  const sheets: XlsxSheet[] = [
    {
      name: "Родители",
      columns: [{ key: "child", label: "Ученик", width: 28 }, { key: "parent", label: "Родитель", width: 28 }, { key: "phone", label: "Телефон", width: 18 }, { key: "branch", label: "Филиал", width: 18 }, { key: "group", label: "Группа", width: 18 }, { key: "activation", label: "Кабинет", width: 22 }],
      rows: children.map((child) => ({ child: child.fullName, parent: child.parentName, phone: child.parentPhone, branch: child.branch, group: child.groupName, activation: activationLabel(child.activationStatus) })),
    },
    {
      name: "Star Coin",
      columns: [{ key: "date", label: "Дата", width: 20 }, { key: "child", label: "Ученик", width: 28 }, { key: "amount", label: "Изменение", width: 12 }, { key: "type", label: "Тип", width: 14 }, { key: "reason", label: "Причина", width: 48 }, { key: "source", label: "Источник", width: 18 }],
      rows: coins.filter((row) => ids.has(row.child_id) && inPeriod(row.created_at, filters)).map((row) => ({ date: row.created_at, child: childName(childMap, row.child_id), amount: Number(row.amount || 0), type: row.transaction_type, reason: row.reason || "", source: row.source || "" })),
    },
    {
      name: "Оплата",
      columns: [{ key: "month", label: "Месяц", width: 14 }, { key: "child", label: "Ученик", width: 28 }, { key: "status", label: "Статус", width: 20 }, { key: "dueDate", label: "Срок", width: 14 }, { key: "amount", label: "Сумма", width: 14 }],
      rows: payments.filter((row) => ids.has(row.child_id) && inPeriod(row.month || row.created_at, filters)).map((row) => ({ month: row.month, child: childName(childMap, row.child_id), status: paymentLabel(row.status), dueDate: row.due_date, amount: Number(row.amount || 0) })),
    },
    {
      name: "Обратная связь",
      columns: [{ key: "date", label: "Дата", width: 20 }, { key: "branch", label: "Филиал", width: 18 }, { key: "child", label: "Ученик", width: 28 }, { key: "parent", label: "Родитель", width: 28 }, { key: "category", label: "Категория", width: 18 }, { key: "status", label: "Статус", width: 18 }, { key: "message", label: "Сообщение", width: 65 }],
      rows: feedback.filter((row) => inPeriod(row.created_at, filters) && (!filters.branch || row.branch_snapshot === filters.branch) && (!filters.childId || row.child_id === filters.childId) && (!row.child_id || ids.has(row.child_id))).map((row) => ({ date: row.created_at, branch: row.branch_snapshot || "", child: row.child_name_snapshot || (row.child_id ? childName(childMap, row.child_id) : ""), parent: row.parent_name_snapshot || "", category: row.category === "education" ? "Об обучении" : "О приложении", status: feedbackStatus(row.status), message: row.message || "" })),
    },
    {
      name: "Новости",
      columns: [{ key: "date", label: "Дата", width: 20 }, { key: "audience", label: "Аудитория", width: 20 }, { key: "branch", label: "Филиал", width: 18 }, { key: "group", label: "Группа", width: 18 }, { key: "title", label: "Заголовок", width: 36 }, { key: "body", label: "Текст", width: 65 }, { key: "active", label: "Активна", width: 12 }],
      rows: news.filter((row) => inPeriod(row.published_at || row.created_at, filters) && (!filters.branch || !row.branch || row.branch === filters.branch) && (!filters.groupName || !row.group_name || row.group_name === filters.groupName)).map((row) => ({ date: row.published_at || row.created_at, audience: row.audience_scope === "all_school" ? "Вся школа" : row.audience_scope === "branch" ? "Филиал" : "Группа", branch: row.branch || "", group: row.group_name || "", title: row.title, body: row.body || "", active: Boolean(row.active) })),
    },
    {
      name: "Фотосессии",
      columns: [{ key: "date", label: "Дата публикации", width: 20 }, { key: "branch", label: "Филиал", width: 18 }, { key: "group", label: "Группа", width: 18 }, { key: "stream", label: "Поток", width: 12 }, { key: "title", label: "Название", width: 34 }, { key: "description", label: "Описание", width: 55 }, { key: "url", label: "Ссылка", width: 55 }, { key: "published", label: "Опубликована", width: 14 }],
      rows: photos.filter((row) => inPeriod(row.published_at || row.created_at, filters) && (!filters.branch || !row.branch || row.branch === filters.branch) && (!filters.groupName || !row.group_name || row.group_name === filters.groupName)).map((row) => ({ date: row.published_at || row.created_at, branch: row.branch || "", group: row.group_name || "", stream: String(row.lesson_time || "").slice(0, 5), title: row.title, description: row.description || "", url: row.gallery_url || "", published: Boolean(row.is_published) })),
    },
  ];

  return sheets;
}
