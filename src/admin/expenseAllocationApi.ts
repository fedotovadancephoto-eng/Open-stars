import { getValidStaffSession } from "@/admin/adminApi";

const SUPABASE_URL = "https://yiwiykbuaggyslfyhlfo.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_1MORh5rY7uMDVYLYVX5VAA_cyoph4-7";

export type ExpensePaymentMethod = "cash" | "bank" | "card" | "other";
export type ExpenseAllocationType = "branch" | "common" | "distributed";

export type ExpenseAllocationInput = { branchId: string; amount: number };
export type OwnerExpenseBranchSummary = { branchId: string; branch: string; amount: number };
export type OwnerExpenseCategorySummary = { categoryId: string; category: string; amount: number };
export type OwnerExpenseTypeSummary = { type: ExpenseAllocationType; amount: number };
export type OwnerExpenseSummary = {
  from: string;
  to: string;
  totalApproved: number;
  commonAmount: number;
  distributedAmount: number;
  branchDirectAmount: number;
  pendingAmount: number;
  pendingCount: number;
  branches: OwnerExpenseBranchSummary[];
  categories: OwnerExpenseCategorySummary[];
  allocationTypes: OwnerExpenseTypeSummary[];
};

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
    let message = "Не удалось выполнить операцию.";
    try {
      const payload = (await response.json()) as ApiError;
      message = payload.message || payload.details || message;
    } catch {
      // ignore non-json response
    }
    if (message.includes("owner only")) message = "Это действие доступно только владельцу.";
    if (message.includes("not authorized")) message = "Недостаточно прав для этой операции.";
    if (message.includes("invalid amount")) message = "Введите корректную сумму расхода.";
    if (message.includes("invalid branch")) message = "Выберите корректный филиал.";
    if (message.includes("invalid expense category")) message = "Эта категория недоступна для вашей роли.";
    if (message.includes("invalid cash account")) message = "Выберите корректный счёт или кассу.";
    if (message.includes("invalid payment method")) message = "Выберите способ оплаты.";
    if (message.includes("invalid allocation type")) message = "Выберите способ распределения расхода.";
    if (message.includes("invalid allocations")) message = "Распределение по филиалам должно точно совпадать с общей суммой.";
    if (message.includes("invalid period")) message = "Проверьте период отчёта.";
    throw new Error(message);
  }
  return response.json() as Promise<T>;
}

export async function submitExpenseV2(input: {
  branchId: string;
  categoryId: string;
  amount: number;
  expenseDate: string;
  paymentMethod: ExpensePaymentMethod;
  description?: string;
}) {
  return rpc<string>("staff_submit_expense_v2", {
    p_branch_id: input.branchId || null,
    p_category_id: input.categoryId,
    p_amount: input.amount,
    p_expense_date: input.expenseDate,
    p_payment_method: input.paymentMethod,
    p_description: input.description?.trim() || null,
  });
}

export async function createOwnerDirectExpense(input: {
  allocationType: ExpenseAllocationType;
  branchId?: string;
  allocations?: ExpenseAllocationInput[];
  categoryId: string;
  accountId?: string;
  amount: number;
  expenseDate: string;
  paymentMethod: ExpensePaymentMethod;
  description?: string;
}) {
  return rpc<{
    expenseId: string;
    cashflowTransactionId: string;
    allocationType: ExpenseAllocationType;
    amount: number;
  }>("owner_create_direct_expense", {
    p_allocation_type: input.allocationType,
    p_branch_id: input.allocationType === "branch" ? input.branchId || null : null,
    p_allocations: input.allocationType === "distributed" ? input.allocations || [] : [],
    p_category_id: input.categoryId,
    p_account_id: input.accountId || null,
    p_amount: input.amount,
    p_expense_date: input.expenseDate,
    p_payment_method: input.paymentMethod,
    p_description: input.description?.trim() || null,
  });
}

export async function fetchOwnerExpenseSummary(from: string, to: string): Promise<OwnerExpenseSummary> {
  const data: any = await rpc("owner_expense_summary", { p_from: from, p_to: to });
  return {
    from: data.from || from,
    to: data.to || to,
    totalApproved: Number(data.totalApproved || 0),
    commonAmount: Number(data.commonAmount || 0),
    distributedAmount: Number(data.distributedAmount || 0),
    branchDirectAmount: Number(data.branchDirectAmount || 0),
    pendingAmount: Number(data.pendingAmount || 0),
    pendingCount: Number(data.pendingCount || 0),
    branches: (Array.isArray(data.branches) ? data.branches : []).map((item: any) => ({
      branchId: item.branchId || "",
      branch: item.branch || "",
      amount: Number(item.amount || 0),
    })),
    categories: (Array.isArray(data.categories) ? data.categories : []).map((item: any) => ({
      categoryId: item.categoryId || "",
      category: item.category || "",
      amount: Number(item.amount || 0),
    })),
    allocationTypes: (Array.isArray(data.allocationTypes) ? data.allocationTypes : []).map((item: any) => ({
      type: item.type as ExpenseAllocationType,
      amount: Number(item.amount || 0),
    })),
  };
}
