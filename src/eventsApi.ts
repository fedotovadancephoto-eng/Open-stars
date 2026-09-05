import { getValidStaffSession } from "@/admin/adminApi";
import { getValidParentSession } from "@/openStarsApi";

const SUPABASE_URL = "https://yiwiykbuaggyslfyhlfo.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_1MORh5rY7uMDVYLYVX5VAA_cyoph4-7";

export type EventStatus = "planned" | "open" | "closed" | "completed" | "cancelled";
export type EventParticipationStatus = "invited" | "participating" | "declined" | "cancelled";
export type EventPaymentMethod = "online" | "cash" | "bank_transfer" | "other";
export type EventExpenseCategory = "venue" | "materials" | "transport" | "catering" | "contractors" | "other";

export type SchoolEvent = {
  id: string;
  title: string;
  description: string;
  startsAt: string;
  endsAt: string;
  location: string;
  branchId: string;
  defaultFee: number | null;
  status: EventStatus;
};

export type EventBranch = { id: string; name: string; code: string };

export type EventParticipant = {
  id: string;
  eventId: string;
  childId: string;
  branchId: string;
  status: EventParticipationStatus;
  feeAmount: number | null;
};

export type EventPayment = {
  id: string;
  eventId: string;
  participantId: string;
  childId: string;
  branchId: string;
  amount: number;
  paymentMethod: EventPaymentMethod;
  receivedAt: string;
  note: string;
  voidedAt: string;
  refundedAt: string;
  refundReason: string;
  refundCashflowTransactionId: string;
};

export type EventExpense = {
  id: string;
  eventId: string;
  branchId: string;
  category: EventExpenseCategory;
  amount: number;
  expenseDate: string;
  description: string;
};

export type EventFinancialSummary = {
  eventId: string;
  title: string;
  revenue: number;
  expenses: number;
  profit: number;
  participants: number;
};

type ApiError = { message?: string; details?: string; hint?: string };

async function staffToken() {
  const session = await getValidStaffSession();
  if (!session) throw new Error("Сессия сотрудника истекла. Войдите снова.");
  return session.access_token;
}

async function parentToken() {
  const session = await getValidParentSession();
  if (!session) throw new Error("Сессия родителя истекла. Войдите снова.");
  return session.access_token;
}

async function rest<T>(path: string, token: string) {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: { apikey: SUPABASE_PUBLISHABLE_KEY, Authorization: `Bearer ${token}` },
  });
  if (!response.ok) {
    let message = "";
    try {
      const data = (await response.json()) as ApiError;
      message = data.message || data.details || "";
    } catch {
      // ignore non-json response
    }
    throw new Error(message || "Не удалось загрузить мероприятия.");
  }
  return response.json() as Promise<T>;
}

function friendly(message: string) {
  if (message.includes("not authorized")) return "Недостаточно прав для этого действия.";
  if (message.includes("event is not open")) return "Запись на это мероприятие уже закрыта.";
  if (message.includes("event unavailable for branch")) return "Это мероприятие недоступно для вашего филиала.";
  if (message.includes("event has active payments")) return "Сначала оформите возврат всех оплат по мероприятию, затем его можно отменить.";
  if (message.includes("refund reason required")) return "Укажите причину возврата.";
  if (message.includes("payment not found")) return "Оплата не найдена или уже отменена.";
  if (message.includes("Мероприятие отменено")) return "Мероприятие отменено. Новую оплату принять нельзя.";
  if (message.includes("invalid amount")) return "Проверьте сумму.";
  if (message.includes("invalid fee")) return "Проверьте стоимость участия.";
  if (message.includes("title required")) return "Укажите название мероприятия.";
  if (message.includes("starts_at required")) return "Укажите дату и время мероприятия.";
  if (message.includes("event not found")) return "Мероприятие не найдено.";
  return message || "Не удалось выполнить действие.";
}

async function rpc<T>(name: string, body: Record<string, unknown>, token: string) {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${name}`, {
    method: "POST",
    headers: {
      apikey: SUPABASE_PUBLISHABLE_KEY,
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    let message = "";
    try {
      const data = (await response.json()) as ApiError;
      message = data.message || data.details || data.hint || "";
    } catch {
      // ignore non-json response
    }
    throw new Error(friendly(message));
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

function mapEvent(row: any): SchoolEvent {
  return {
    id: row.id,
    title: row.title || "",
    description: row.description || "",
    startsAt: row.starts_at || "",
    endsAt: row.ends_at || "",
    location: row.location || "",
    branchId: row.branch_id || "",
    defaultFee: row.default_fee == null ? null : Number(row.default_fee),
    status: row.status,
  };
}

function mapParticipant(row: any): EventParticipant {
  return {
    id: row.id,
    eventId: row.event_id,
    childId: row.child_id,
    branchId: row.branch_id,
    status: row.status,
    feeAmount: row.fee_amount == null ? null : Number(row.fee_amount),
  };
}

function mapPayment(row: any): EventPayment {
  return {
    id: row.id,
    eventId: row.event_id,
    participantId: row.participant_id,
    childId: row.child_id,
    branchId: row.branch_id,
    amount: Number(row.amount || 0),
    paymentMethod: row.payment_method,
    receivedAt: row.received_at || "",
    note: row.note || "",
    voidedAt: row.voided_at || "",
    refundedAt: row.refunded_at || "",
    refundReason: row.refund_reason || "",
    refundCashflowTransactionId: row.refund_cashflow_transaction_id || "",
  };
}

function mapExpense(row: any): EventExpense {
  return {
    id: row.id,
    eventId: row.event_id,
    branchId: row.branch_id || "",
    category: row.category,
    amount: Number(row.amount || 0),
    expenseDate: row.expense_date || "",
    description: row.description || "",
  };
}

export async function fetchStaffEvents() {
  const token = await staffToken();
  const rows = await rest<any[]>("events?select=*&order=starts_at.desc", token);
  return rows.map(mapEvent);
}

export async function fetchEventBranches() {
  const token = await staffToken();
  const rows = await rest<any[]>("branches?select=id,name,code&is_active=eq.true&order=sort_order.asc", token);
  return rows.map((row) => ({ id: row.id, name: row.name || "", code: row.code || "" })) as EventBranch[];
}

export async function fetchStaffEventParticipants(eventId: string) {
  const token = await staffToken();
  const rows = await rest<any[]>(`event_participants?select=*&event_id=eq.${encodeURIComponent(eventId)}&order=created_at.asc`, token);
  return rows.map(mapParticipant);
}

export async function fetchStaffEventPayments(eventId: string) {
  const token = await staffToken();
  const rows = await rest<any[]>(`event_payments?select=*&event_id=eq.${encodeURIComponent(eventId)}&order=received_at.desc`, token);
  return rows.map(mapPayment);
}

export async function fetchOwnerEventExpenses(eventId: string) {
  const token = await staffToken();
  const rows = await rest<any[]>(`event_expenses?select=*&event_id=eq.${encodeURIComponent(eventId)}&order=expense_date.desc`, token);
  return rows.map(mapExpense);
}

export async function createEvent(input: {
  title: string;
  description?: string;
  startsAt: string;
  endsAt?: string;
  location?: string;
  branchId?: string;
  defaultFee?: number | null;
  status?: EventStatus;
}) {
  const token = await staffToken();
  return rpc<string>("owner_create_event", {
    p_title: input.title,
    p_description: input.description || null,
    p_starts_at: input.startsAt,
    p_ends_at: input.endsAt || null,
    p_location: input.location || null,
    p_branch_id: input.branchId || null,
    p_default_fee: input.defaultFee ?? null,
    p_status: input.status || "planned",
  }, token);
}

export async function updateEvent(eventId: string, input: {
  title: string;
  description?: string;
  startsAt: string;
  endsAt?: string;
  location?: string;
  branchId?: string;
  defaultFee?: number | null;
  status: EventStatus;
}) {
  const token = await staffToken();
  return rpc<string>("owner_update_event", {
    p_event_id: eventId,
    p_title: input.title,
    p_description: input.description || null,
    p_starts_at: input.startsAt,
    p_ends_at: input.endsAt || null,
    p_location: input.location || null,
    p_branch_id: input.branchId || null,
    p_default_fee: input.defaultFee ?? null,
    p_status: input.status,
  }, token);
}

export async function setEventParticipantFee(participantId: string, feeAmount: number) {
  const token = await staffToken();
  return rpc<string>("staff_set_event_participant_fee", { p_participant_id: participantId, p_fee_amount: feeAmount }, token);
}

export async function confirmEventPayment(input: {
  participantId: string;
  amount: number;
  paymentMethod: EventPaymentMethod;
  receivedAt?: string;
  note?: string;
}) {
  const token = await staffToken();
  return rpc<string>("staff_confirm_event_payment", {
    p_participant_id: input.participantId,
    p_amount: input.amount,
    p_payment_method: input.paymentMethod,
    p_received_at: input.receivedAt || null,
    p_note: input.note || null,
  }, token);
}

export async function refundEventPayment(paymentId: string, reason: string, refundedAt?: string) {
  const token = await staffToken();
  return rpc<string>("owner_refund_event_payment", {
    p_payment_id: paymentId,
    p_refunded_at: refundedAt || null,
    p_reason: reason,
  }, token);
}

export async function addEventExpense(input: {
  eventId: string;
  category: EventExpenseCategory;
  amount: number;
  expenseDate?: string;
  description?: string;
}) {
  const token = await staffToken();
  return rpc<string>("owner_add_event_expense", {
    p_event_id: input.eventId,
    p_category: input.category,
    p_amount: input.amount,
    p_expense_date: input.expenseDate || null,
    p_description: input.description || null,
  }, token);
}

export async function fetchOwnerEventSummary(eventId: string) {
  const token = await staffToken();
  return rpc<EventFinancialSummary | null>("owner_event_financial_summary", { p_event_id: eventId }, token);
}

export async function fetchParentEvents(childId: string) {
  const token = await parentToken();
  const [participantRows, paymentRows] = await Promise.all([
    rest<any[]>(`event_participants?select=*&child_id=eq.${encodeURIComponent(childId)}&order=created_at.desc`, token),
    rest<any[]>(`event_payments?select=*&child_id=eq.${encodeURIComponent(childId)}&order=received_at.desc`, token),
  ]);
  const participants = participantRows.map(mapParticipant);
  const payments = paymentRows.map(mapPayment);
  const participatedEventIds = Array.from(new Set(participants.map((row) => row.eventId).filter(Boolean)));
  const eventFilter = participatedEventIds.length
    ? `or=(status.eq.open,id.in.(${participatedEventIds.map(encodeURIComponent).join(",")}))`
    : "status=eq.open";
  const eventRows = await rest<any[]>(`events?select=*&${eventFilter}&order=starts_at.asc`, token);

  return eventRows.map(mapEvent).map((event) => ({
    event,
    participant: participants.find((row) => row.eventId === event.id) || null,
    payments: payments.filter((row) => row.eventId === event.id && !row.voidedAt),
  }));
}

export async function setParentEventParticipation(eventId: string, childId: string, status: "participating" | "declined") {
  const token = await parentToken();
  return rpc<string>("parent_set_event_participation", {
    p_event_id: eventId,
    p_child_id: childId,
    p_status: status,
  }, token);
}
