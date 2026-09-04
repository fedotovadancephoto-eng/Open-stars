import { getValidStaffSession } from "@/admin/adminApi";

const SUPABASE_URL = "https://yiwiykbuaggyslfyhlfo.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_1MORh5rY7uMDVYLYVX5VAA_cyoph4-7";

export type PayrollRole = "owner" | "admin";
export type PayrollPaymentMethod = "cash" | "bank" | "card" | "other";

export type PayrollTeacher = {
  profileId: string;
  name: string;
  branch: string;
};

export type PayrollPayout = {
  id: string;
  teacherProfileId: string;
  teacherName: string;
  branchId: string;
  branch: string;
  weekStart: string;
  payoutDate: string;
  amount: number;
  paymentMethod: PayrollPaymentMethod;
  comment: string;
  createdAt: string;
  createdBy: string;
};

export type PayrollBranchSummary = {
  branchId: string;
  branch: string;
  amount: number;
};

export type PayrollContext = {
  role: PayrollRole;
  staffBranch: string;
  from: string;
  to: string;
  totalAmount: number;
  teachers: PayrollTeacher[];
  payouts: PayrollPayout[];
  branches: PayrollBranchSummary[];
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
      // ignore
    }
    if (message.includes("not authorized")) message = "Недостаточно прав для этой операции.";
    if (message.includes("invalid period")) message = "Проверьте период.";
    if (message.includes("teacher required") || message.includes("invalid teacher")) message = "Выберите педагога.";
    if (message.includes("week required")) message = "Укажите неделю выплаты.";
    if (message.includes("invalid amount")) message = "Введите корректную сумму зарплаты.";
    if (message.includes("payout date required")) message = "Укажите дату выплаты.";
    if (message.includes("invalid payment method")) message = "Выберите способ выплаты.";
    if (message.includes("payroll already exists")) message = "Для этого педагога зарплата за выбранную неделю уже внесена.";
    if (message.includes("payroll account not found")) message = "Не найден счёт или касса для этой выплаты.";
    if (message.includes("payroll not found")) message = "Запись зарплаты не найдена.";
    if (message.includes("void reason required")) message = "Укажите причину отмены.";
    throw new Error(message);
  }
  return response.json() as Promise<T>;
}

function normalizeContext(data: any, from: string, to: string): PayrollContext {
  return {
    role: data.role === "owner" ? "owner" : "admin",
    staffBranch: data.staffBranch || "",
    from: data.from || from,
    to: data.to || to,
    totalAmount: Number(data.totalAmount || 0),
    teachers: (Array.isArray(data.teachers) ? data.teachers : []).map((item: any) => ({
      profileId: item.profileId || "",
      name: item.name || "Педагог",
      branch: item.branch || "",
    })),
    payouts: (Array.isArray(data.payouts) ? data.payouts : []).map((item: any) => ({
      id: item.id || "",
      teacherProfileId: item.teacherProfileId || "",
      teacherName: item.teacherName || "Педагог",
      branchId: item.branchId || "",
      branch: item.branch || "",
      weekStart: item.weekStart || "",
      payoutDate: item.payoutDate || "",
      amount: Number(item.amount || 0),
      paymentMethod: (item.paymentMethod || "cash") as PayrollPaymentMethod,
      comment: item.comment || "",
      createdAt: item.createdAt || "",
      createdBy: item.createdBy || "",
    })),
    branches: (Array.isArray(data.branches) ? data.branches : []).map((item: any) => ({
      branchId: item.branchId || "",
      branch: item.branch || "",
      amount: Number(item.amount || 0),
    })),
  };
}

export async function fetchPayrollContext(from: string, to: string) {
  const data = await rpc<any>("staff_payroll_context", { p_from: from, p_to: to });
  return normalizeContext(data, from, to);
}

export async function recordTeacherPayroll(input: {
  teacherProfileId: string;
  weekStart: string;
  amount: number;
  payoutDate: string;
  paymentMethod: PayrollPaymentMethod;
  comment?: string;
}) {
  return rpc("staff_record_teacher_payroll", {
    p_teacher_profile_id: input.teacherProfileId,
    p_week_start: input.weekStart,
    p_amount: input.amount,
    p_payout_date: input.payoutDate,
    p_payment_method: input.paymentMethod,
    p_comment: input.comment?.trim() || null,
  });
}

export async function correctTeacherPayroll(input: {
  payoutId: string;
  weekStart: string;
  amount: number;
  payoutDate: string;
  paymentMethod: PayrollPaymentMethod;
  comment?: string;
}) {
  return rpc("staff_correct_teacher_payroll", {
    p_payout_id: input.payoutId,
    p_week_start: input.weekStart,
    p_amount: input.amount,
    p_payout_date: input.payoutDate,
    p_payment_method: input.paymentMethod,
    p_comment: input.comment?.trim() || null,
  });
}

export async function voidTeacherPayroll(payoutId: string, reason: string) {
  return rpc("staff_void_teacher_payroll", {
    p_payout_id: payoutId,
    p_reason: reason.trim(),
  });
}
