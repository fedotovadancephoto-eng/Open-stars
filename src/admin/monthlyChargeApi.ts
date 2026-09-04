import { getValidStaffSession } from "@/admin/adminApi";

const SUPABASE_URL = "https://yiwiykbuaggyslfyhlfo.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_1MORh5rY7uMDVYLYVX5VAA_cyoph4-7";

type ApiError = { message?: string; details?: string };

async function rpc<T>(name: string, body: Record<string, unknown>) {
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
    let message = "Не удалось выполнить массовое начисление.";
    try {
      const payload = (await response.json()) as ApiError;
      message = payload.message || payload.details || message;
    } catch {
      // ignore non-json response
    }
    if (message.includes("not authorized")) message = "У вас нет доступа к этому филиалу.";
    if (message.includes("invalid branch")) message = "Выберите корректный филиал.";
    if (message.includes("group required")) message = "Выберите группу.";
    if (message.includes("group has no active students")) message = "В этой группе нет активных учеников.";
    if (message.includes("invalid expected amount")) message = "Введите корректную сумму начисления.";
    throw new Error(message);
  }
  return response.json() as Promise<T>;
}

export async function bulkSetMonthlyCharge(input: {
  month: string;
  branch: string;
  groupName: string;
  expectedAmount: number;
  dueDate?: string;
  note?: string;
}) {
  return rpc<{
    month: string;
    branch: string;
    groupName: string;
    expectedAmount: number;
    dueDate: string;
    updatedStudents: number;
  }>("staff_bulk_set_monthly_charge", {
    p_month: `${input.month}-01`,
    p_branch: input.branch,
    p_group_name: input.groupName,
    p_expected_amount: input.expectedAmount,
    p_due_date: input.dueDate || null,
    p_note: input.note?.trim() || null,
  });
}
