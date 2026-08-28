import { AdminChild, StaffRole, fetchAdminChildren, fetchStaffIdentity, getValidStaffSession } from "@/admin/adminApi";
import { fetchAcademicContext } from "@/admin/academicApi";
import { STAFF_VIEW_MODE_KEY } from "@/admin/StaffModeSwitch";

const SUPABASE_URL = "https://yiwiykbuaggyslfyhlfo.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_1MORh5rY7uMDVYLYVX5VAA_cyoph4-7";
const REPORT_PAGE_SIZE = 1000;
const REPORT_MAX_PAGES = 100;

export type ReportFilters = { branch: string; groupName: string; childId: string; fromDate: string; toDate: string };
export type ReportContext = { role: StaffRole; teacherView: boolean; staffBranch: string; children: AdminChild[] };
export type RestRow = Record<string, any>;
type Assignment = { branch?: string | null; groupName: string; subject: string };

export async function reportRestSelect(table: string, select = "*", order = "") {
  const session = await getValidStaffSession();
  if (!session) throw new Error("Сессия сотрудника истекла. Войдите снова.");
  const params = new URLSearchParams({ select });
  if (order) params.set("order", order);
  const url = `${SUPABASE_URL}/rest/v1/${table}?${params.toString()}`;
  const rows: RestRow[] = [];

  for (let page = 0; page < REPORT_MAX_PAGES; page += 1) {
    const start = page * REPORT_PAGE_SIZE;
    const end = start + REPORT_PAGE_SIZE - 1;
    const response = await fetch(url, {
      headers: {
        apikey: SUPABASE_PUBLISHABLE_KEY,
        Authorization: `Bearer ${session.access_token}`,
        Range: `${start}-${end}`,
        "Range-Unit": "items",
      },
    });
    if (!response.ok) throw new Error(`Не удалось подготовить лист «${table}».`);
    const pageRows = (await response.json()) as RestRow[];
    rows.push(...pageRows);
    if (pageRows.length < REPORT_PAGE_SIZE) return rows;
  }

  throw new Error(`В таблице «${table}» слишком много строк для одной выгрузки. Уточните период или группу.`);
}

function assignmentAllowsChild(child: AdminChild, assignments: Assignment[]) {
  return assignments.some((item) => (!item.branch || item.branch === child.branch) && (!item.groupName || item.groupName === child.groupName));
}

export async function fetchReportContext(): Promise<ReportContext> {
  const [identity, academic] = await Promise.all([fetchStaffIdentity(), fetchAcademicContext()]);
  const allChildren = await fetchAdminChildren(identity.role);
  const teacherView = identity.role === "teacher" || (typeof window !== "undefined" && localStorage.getItem(STAFF_VIEW_MODE_KEY) === "teacher");
  return {
    role: identity.role,
    teacherView,
    staffBranch: academic.staffBranch || "",
    children: teacherView ? allChildren.filter((child) => assignmentAllowsChild(child, academic.assignments || [])) : allChildren,
  };
}

export function filterChildren(context: ReportContext, filters: ReportFilters) {
  return context.children.filter((child) => (!filters.branch || child.branch === filters.branch) && (!filters.groupName || child.groupName === filters.groupName) && (!filters.childId || child.id === filters.childId));
}

export function inPeriod(value: unknown, filters: ReportFilters) {
  if (!value) return !filters.fromDate && !filters.toDate;
  const date = String(value).slice(0, 10);
  return (!filters.fromDate || date >= filters.fromDate) && (!filters.toDate || date <= filters.toDate);
}

export function childName(map: Map<string, AdminChild>, id: string) { return map.get(id)?.fullName || "Ученик"; }
export function paymentLabel(value: string) { return value === "paid" ? "Оплачено" : value === "overdue" ? "Просрочено" : value === "pending" ? "Ожидает оплаты" : value || "Не указан"; }
export function activationLabel(value: AdminChild["activationStatus"]) { return value === "active" ? "Активирован" : value === "invited" ? "Приглашение выдано" : "Не активирован"; }
