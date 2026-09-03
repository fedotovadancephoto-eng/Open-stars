import { getValidStaffSession } from "@/admin/adminApi";

const SUPABASE_URL = "https://yiwiykbuaggyslfyhlfo.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_1MORh5rY7uMDVYLYVX5VAA_cyoph4-7";

export type BranchGoal = {
  branchId: string;
  branch: string;
  target: number;
  activeStudents: number;
  missing: number;
  overTarget: number;
  progress: number;
};

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
    if (message.includes("owner only")) message = "Этот раздел доступен только владельцу.";
    if (message.includes("invalid target")) message = "Цель должна быть больше нуля.";
    throw new Error(message);
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

export async function fetchOwnerBranchGoals(): Promise<BranchGoal[]> {
  const rows: any[] = await rpc("owner_business_branch_goals");
  return (Array.isArray(rows) ? rows : []).map((item: any) => ({
    branchId: item.branchId || "",
    branch: item.branch || "",
    target: Number(item.target || 0),
    activeStudents: Number(item.activeStudents || 0),
    missing: Number(item.missing || 0),
    overTarget: Number(item.overTarget || 0),
    progress: Number(item.progress || 0),
  }));
}

export async function setOwnerBranchTarget(branchId: string, target: number) {
  await rpc<void>("owner_set_branch_student_target", {
    p_branch_id: branchId,
    p_target: target,
  });
}
