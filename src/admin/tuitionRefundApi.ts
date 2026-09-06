import { getValidStaffSession } from "@/admin/adminApi";

const SUPABASE_URL = "https://yiwiykbuaggyslfyhlfo.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_1MORh5rY7uMDVYLYVX5VAA_cyoph4-7";

export type RefundableTuitionReceipt = {
  receiptId: string;
  childId: string;
  childName: string;
  branch: string;
  month: string;
  amount: number;
  paymentMethod: string;
  receivedAt: string;
  note: string;
};

type ApiError = { message?: string; details?: string; hint?: string };

async function rpc<T>(name: string, body: Record<string, unknown> = {}) {
  const session = await getValidStaffSession();
  if (!session) throw new Error("Сессия сотрудника истекла. Войдите снова.");

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
      const data = (await response.json()) as ApiError;
      message = data.message || data.details || data.hint || message;
    } catch {
      // ignore non-json response
    }
    if (message.includes("not authorized")) message = "Возврат оплаты доступен только руководителю.";
    if (message.includes("refund reason required")) message = "Укажите причину возврата.";
    if (message.includes("receipt not found")) message = "Оплата уже отменена, возвращена или не найдена.";
    throw new Error(message);
  }

  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

export async function fetchRefundableTuitionReceipts() {
  const rows: any[] = await rpc("owner_refundable_tuition_receipts");
  return (rows || []).map((row: any) => ({
    receiptId: row.receipt_id || "",
    childId: row.child_id || "",
    childName: row.child_name || "Ученик",
    branch: row.branch || "",
    month: row.month || "",
    amount: Number(row.amount || 0),
    paymentMethod: row.payment_method || "",
    receivedAt: row.received_at || "",
    note: row.note || "",
  })) as RefundableTuitionReceipt[];
}

export async function refundTuitionReceipt(receiptId: string, reason: string) {
  return rpc<string>("owner_refund_payment_receipt", {
    p_receipt_id: receiptId,
    p_refunded_at: new Date().toISOString(),
    p_reason: reason.trim(),
  });
}
