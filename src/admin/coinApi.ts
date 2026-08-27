import { getValidStaffSession } from "@/admin/adminApi";

const SUPABASE_URL = "https://yiwiykbuaggyslfyhlfo.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_1MORh5rY7uMDVYLYVX5VAA_cyoph4-7";

export type CoinChild = {
  id: string;
  name: string;
  branch: string;
  groupName: string;
  coins: number;
};

export type CoinRule = {
  code: string;
  title: string;
  amount: number;
  active: boolean;
};

export type CoinContext = {
  role: string;
  staffBranch: string;
  children: CoinChild[];
  rules: CoinRule[];
};

export type CoinHistoryRow = {
  id: string;
  amount: number;
  reason: string;
  source: string;
  createdAt: string;
  createdByName: string;
};

type ApiError = { message?: string; details?: string };

async function rpc<T>(name: string, body: Record<string, unknown> = {}): Promise<T> {
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
    let message = "Не удалось выполнить операцию Star Coin.";
    try {
      const payload = (await response.json()) as ApiError;
      message = payload.message || payload.details || message;
    } catch {
      // ignore
    }
    if (message.includes("reason required")) message = "Обязательно укажите причину операции.";
    if (message.includes("amount required")) message = "Укажите количество Star Coin.";
    if (message.includes("insufficient balance")) message = "Нельзя списать больше Star Coin, чем есть на балансе.";
    if (message.includes("not authorized")) message = "У вас нет доступа к Star Coin этого ребёнка.";
    throw new Error(message);
  }

  if (response.status === 204) return undefined as T;
  return response.json();
}

export async function fetchCoinContext(): Promise<CoinContext> {
  const data: any = await rpc("staff_coin_context");
  return {
    role: data.role || "",
    staffBranch: data.staffBranch || "",
    children: Array.isArray(data.children)
      ? data.children.map((child: any) => ({
          id: child.id,
          name: child.name || "Ученик",
          branch: child.branch || "",
          groupName: child.groupName || "",
          coins: Number(child.coins || 0),
        }))
      : [],
    rules: Array.isArray(data.rules)
      ? data.rules.map((rule: any) => ({
          code: rule.code,
          title: rule.title,
          amount: Number(rule.amount || 0),
          active: Boolean(rule.active),
        }))
      : [],
  };
}

export async function adjustCoins(childId: string, amount: number, reason: string) {
  return rpc<string>("staff_coin_adjust", {
    p_child_id: childId,
    p_amount: amount,
    p_reason: reason.trim(),
  });
}

export async function fetchCoinHistory(childId: string): Promise<CoinHistoryRow[]> {
  const rows: any[] = await rpc("staff_coin_history", { p_child_id: childId });
  return (rows || []).map((row) => ({
    id: row.id,
    amount: Number(row.amount || 0),
    reason: row.reason || "Star Coin",
    source: row.source || "manual",
    createdAt: row.created_at || "",
    createdByName: row.created_by_name || "Система",
  }));
}
