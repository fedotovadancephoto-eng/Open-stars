import { getValidStaffSession } from "@/admin/adminApi";

const SUPABASE_URL = "https://yiwiykbuaggyslfyhlfo.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_1MORh5rY7uMDVYLYVX5VAA_cyoph4-7";

export type PaymentStatus = "paid" | "pending" | "overdue";
export type PaymentMethod = "online" | "cash" | "bank_transfer" | "other";
export type PaymentOverviewState = "paid" | "needs_amount" | "pending" | "overdue";
export type PaymentChild = { id: string; name: string; branch: string; groupName: string; paymentStatus: string };
export type PaymentHistory = { id: string; month: string; oldStatus: string; newStatus: string; changedAt: string; changedByName: string };
export type PaymentReceipt = {
  id: string;
  paymentId: string;
  month: string;
  amount: number;
  paymentMethod: PaymentMethod;
  receivedAt: string;
  note: string;
  confirmedByName: string;
  voidedAt: string;
  voidReason: string;
};
export type PaymentOverviewStudent = {
  childId: string;
  name: string;
  branch: string;
  groupName: string;
  state: PaymentOverviewState;
  amountPaid: number;
  latestReceiptId: string;
  latestMethod: PaymentMethod | "";
  latestReceivedAt: string;
  paymentRecordStatus: string;
};
export type PaymentOverview = {
  role: string;
  staffBranch: string;
  branch: string;
  month: string;
  totalStudents: number;
  paidStudents: number;
  needsAmountStudents: number;
  pendingStudents: number;
  overdueStudents: number;
  outstandingStudents: number;
  collectedAmount: number;
  students: PaymentOverviewStudent[];
};
export type PaymentLink = { branch: string; paymentUrl: string; enabled: boolean; updatedAt: string };
export type PaymentLinkContext = { role: string; staffBranch: string; links: PaymentLink[] };

type ApiError = { message?: string; details?: string };

async function rpc<T>(name: string, body: Record<string, unknown> = {}) {
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
    if (message.includes("not authorized")) message = "У вас нет доступа к этой операции.";
    if (message.includes("invalid status")) message = "Выберите корректный статус оплаты.";
    if (message.includes("invalid payment url")) message = "Ссылка должна начинаться с http:// или https://";
    if (message.includes("invalid branch")) message = "Выберите корректный филиал.";
    if (message.includes("invalid amount")) message = "Введите корректную сумму оплаты.";
    if (message.includes("invalid payment method")) message = "Выберите способ оплаты.";
    if (message.includes("void reason required")) message = "Укажите причину отмены оплаты.";
    if (message.includes("receipt not found")) message = "Эта оплата уже отменена или не найдена.";
    if (message.includes("payment receipt required")) message = "Чтобы поставить «Оплачено», подтвердите фактическую сумму и способ оплаты.";
    if (message.includes("void receipt first")) message = "Сначала отмените подтверждённое поступление в блоке «Фактические поступления». После этого можно изменить статус.";
    throw new Error(message);
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

export async function fetchPaymentContext() {
  const data: any = await rpc("staff_payment_context");
  return {
    role: data.role || "",
    staffBranch: data.staffBranch || "",
    children: (Array.isArray(data.children) ? data.children : []).map((child: any) => ({
      id: child.id,
      name: child.name || "Ученик",
      branch: child.branch || "",
      groupName: child.groupName || "",
      paymentStatus: child.paymentStatus || "",
    })) as PaymentChild[],
  };
}

export async function fetchPaymentOverview(month: string, branch = ""): Promise<PaymentOverview> {
  const data: any = await rpc("staff_payment_overview", {
    p_month: `${month}-01`,
    p_branch: branch.trim() || null,
  });
  return {
    role: data.role || "",
    staffBranch: data.staffBranch || "",
    branch: data.branch || "",
    month: data.month || `${month}-01`,
    totalStudents: Number(data.totalStudents || 0),
    paidStudents: Number(data.paidStudents || 0),
    needsAmountStudents: Number(data.needsAmountStudents || 0),
    pendingStudents: Number(data.pendingStudents || 0),
    overdueStudents: Number(data.overdueStudents || 0),
    outstandingStudents: Number(data.outstandingStudents || 0),
    collectedAmount: Number(data.collectedAmount || 0),
    students: (Array.isArray(data.students) ? data.students : []).map((item: any) => ({
      childId: item.childId || "",
      name: item.name || "Ученик",
      branch: item.branch || "",
      groupName: item.groupName || "",
      state: (item.state || "pending") as PaymentOverviewState,
      amountPaid: Number(item.amountPaid || 0),
      latestReceiptId: item.latestReceiptId || "",
      latestMethod: (item.latestMethod || "") as PaymentMethod | "",
      latestReceivedAt: item.latestReceivedAt || "",
      paymentRecordStatus: item.paymentRecordStatus || "",
    })),
  };
}

export async function setPaymentStatus(childId: string, month: string, status: PaymentStatus) {
  return rpc<string>("staff_set_payment_status", {
    p_child_id: childId,
    p_month: `${month}-01`,
    p_status: status,
  });
}

export async function fetchPaymentHistory(childId: string) {
  const rows: any[] = await rpc("staff_payment_history", { p_child_id: childId });
  return (rows || []).map((row: any) => ({
    id: row.id,
    month: row.month || "",
    oldStatus: row.old_status || "",
    newStatus: row.new_status || "",
    changedAt: row.changed_at || "",
    changedByName: row.changed_by_name || "",
  })) as PaymentHistory[];
}

export async function confirmPaymentReceipt(input: {
  childId: string;
  month: string;
  amount: number;
  paymentMethod: PaymentMethod;
  note?: string;
  receivedAt?: string;
}) {
  return rpc<{
    receiptId: string;
    paymentId: string;
    cashflowTransactionId: string;
    branch: string;
    amount: number;
    paymentMethod: PaymentMethod;
  }>("staff_confirm_payment_receipt", {
    p_child_id: input.childId,
    p_month: `${input.month}-01`,
    p_amount: input.amount,
    p_payment_method: input.paymentMethod,
    p_received_at: input.receivedAt || new Date().toISOString(),
    p_note: input.note?.trim() || null,
  });
}

export async function fetchPaymentReceipts(childId: string) {
  const rows: any[] = await rpc("staff_payment_receipts_v2", { p_child_id: childId });
  return (rows || []).map((row: any) => ({
    id: row.id,
    paymentId: row.payment_id || "",
    month: row.month || "",
    amount: Number(row.amount || 0),
    paymentMethod: row.payment_method as PaymentMethod,
    receivedAt: row.received_at || "",
    note: row.note || "",
    confirmedByName: row.confirmed_by_name || "Сотрудник OPEN STARS",
    voidedAt: row.voided_at || "",
    voidReason: row.void_reason || "",
  })) as PaymentReceipt[];
}

export async function correctPaymentReceipt(input: {
  receiptId: string;
  month: string;
  amount: number;
  paymentMethod: PaymentMethod;
  receivedAt: string;
  note?: string;
}) {
  return rpc<{
    receiptId: string;
    paymentId: string;
    month: string;
    amount: number;
    paymentMethod: PaymentMethod;
    branch: string;
  }>("staff_correct_payment_receipt", {
    p_receipt_id: input.receiptId,
    p_month: `${input.month}-01`,
    p_amount: input.amount,
    p_payment_method: input.paymentMethod,
    p_received_at: input.receivedAt,
    p_note: input.note?.trim() || null,
  });
}

export async function voidPaymentReceipt(receiptId: string, reason: string) {
  return rpc<string>("staff_void_payment_receipt", {
    p_receipt_id: receiptId,
    p_reason: reason.trim(),
  });
}

export async function fetchPaymentLinkContext(): Promise<PaymentLinkContext> {
  const data: any = await rpc("staff_payment_link_context");
  return {
    role: data.role || "",
    staffBranch: data.staffBranch || "",
    links: (Array.isArray(data.links) ? data.links : []).map((item: any) => ({
      branch: item.branch || "",
      paymentUrl: item.paymentUrl || "",
      enabled: Boolean(item.enabled),
      updatedAt: item.updatedAt || "",
    })),
  };
}

export async function savePaymentLink(branch: string, paymentUrl: string) {
  const url = paymentUrl.trim();
  const data: any = await rpc("staff_set_payment_link", {
    p_branch: branch,
    p_payment_url: url,
    p_enabled: Boolean(url),
  });
  return {
    branch: data.branch || branch,
    paymentUrl: data.paymentUrl || url,
    enabled: Boolean(data.enabled),
    updatedAt: new Date().toISOString(),
  } as PaymentLink;
}