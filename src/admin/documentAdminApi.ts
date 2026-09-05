import { getValidStaffSession } from "@/admin/adminApi";

const SUPABASE_URL = "https://yiwiykbuaggyslfyhlfo.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_1MORh5rY7uMDVYLYVX5VAA_cyoph4-7";

export type StaffDocumentRow = {
  child_id: string;
  child_name: string;
  branch: string;
  parent_name: string;
  parent_phone: string;
  terms_ready: boolean;
  monthly_price: number | null;
  total_price: number | null;
  start_date: string | null;
  end_date: string | null;
  esign_status: string;
  personal_data_status: string;
  contract_status: string;
  photo_status: string;
};

type RpcError = { message?: string; details?: string; hint?: string };

async function staffRpc<T>(name: string, body: Record<string, unknown>): Promise<T> {
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
    let payload: RpcError = {};
    try { payload = await response.json(); } catch { /* ignore */ }
    throw new Error(payload.message || payload.details || "Не удалось выполнить действие.");
  }

  if (response.status === 204) return undefined as T;
  const text = await response.text();
  return (text ? JSON.parse(text) : undefined) as T;
}

export function fetchStaffDocumentRegistry(branch = "") {
  return staffRpc<StaffDocumentRow[]>("staff_document_registry", { p_branch: branch || null });
}

export function upsertContractTerms(input: {
  childId: string;
  startDate: string;
  endDate: string;
  monthlyPrice: number;
  totalPrice?: number | null;
  tariffName?: string;
  tariffDescription?: string;
}) {
  return staffRpc<void>("staff_upsert_contract_terms", {
    p_child_id: input.childId,
    p_start_date: input.startDate,
    p_end_date: input.endDate,
    p_monthly_price: input.monthlyPrice,
    p_total_price: input.totalPrice ?? null,
    p_tariff_name: input.tariffName || "Индивидуальный",
    p_tariff_description: input.tariffDescription || "Обучение по программе OPEN STARS согласно расписанию.",
  });
}
