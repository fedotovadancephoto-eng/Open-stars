import { getValidStaffSession } from "@/admin/adminApi";

const SUPABASE_URL = "https://yiwiykbuaggyslfyhlfo.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_1MORh5rY7uMDVYLYVX5VAA_cyoph4-7";

export type RevenueBreakdown = {
  category: "tuition" | "events" | "other";
  channel: "cash" | "noncash" | "unknown";
  amount: number;
};

export type OwnerCashflowBranchSummary = {
  branchId: string;
  branch: string;
  grossIncome: number;
  refunds: number;
  revenue: number;
  expenses: number;
  netCashflow: number;
  revenueBreakdown: RevenueBreakdown[];
};

export type OwnerCashflowMonthSummary = {
  month: string;
  grossIncome: number;
  refunds: number;
  revenue: number;
  expenses: number;
  netCashflow: number;
  branches: OwnerCashflowBranchSummary[];
  revenueBreakdown: RevenueBreakdown[];
};

type ApiError = { message?: string; details?: string; hint?: string };

export async function fetchOwnerCashflowMonthSummary(month?: string): Promise<OwnerCashflowMonthSummary> {
  const session = await getValidStaffSession();
  if (!session) throw new Error("Сессия сотрудника истекла. Войдите снова.");

  const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/owner_cashflow_month_summary`, {
    method: "POST",
    headers: {
      apikey: SUPABASE_PUBLISHABLE_KEY,
      Authorization: `Bearer ${session.access_token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ p_month: month ? `${month.slice(0, 7)}-01` : null }),
  });

  if (!response.ok) {
    let message = "Не удалось загрузить финансовый итог.";
    try {
      const data = (await response.json()) as ApiError;
      message = data.message || data.details || data.hint || message;
    } catch {
      // ignore non-json response
    }
    if (message.includes("not authorized")) message = "Финансовый итог доступен только руководителю.";
    throw new Error(message);
  }

  const data: any = await response.json();
  const mapBreakdown = (items: any): RevenueBreakdown[] =>
    (Array.isArray(items) ? items : []).map((item) => ({
      category: item.category, channel: item.channel, amount: Number(item.amount || 0),
    }));
  const mapBranch = (item: any): OwnerCashflowBranchSummary => ({
    branchId: item.branchId || "",
    branch: item.branch || "",
    grossIncome: Number(item.grossIncome || 0),
    refunds: Number(item.refunds || 0),
    revenue: Number(item.revenue || 0),
    expenses: Number(item.expenses || 0),
    netCashflow: Number(item.netCashflow || 0),
    revenueBreakdown: mapBreakdown(item.revenueBreakdown),
  });

  return {
    month: data.month || "",
    grossIncome: Number(data.grossIncome || 0),
    refunds: Number(data.refunds || 0),
    revenue: Number(data.revenue || 0),
    expenses: Number(data.expenses || 0),
    netCashflow: Number(data.netCashflow || 0),
    branches: (Array.isArray(data.branches) ? data.branches : []).map(mapBranch),
    revenueBreakdown: mapBreakdown(data.revenueBreakdown),
  };
}
