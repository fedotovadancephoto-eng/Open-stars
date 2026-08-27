import { getValidStaffSession } from "@/admin/adminApi";

const SUPABASE_URL = "https://yiwiykbuaggyslfyhlfo.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_1MORh5rY7uMDVYLYVX5VAA_cyoph4-7";

type ApiError = { message?: string; details?: string };

export type ParentActivationCode = {
  childId: string;
  familyId: string;
  childName: string;
  parentName: string;
  phone: string;
  activationCode: string;
  expiresAt: string;
};

export type BulkParentActivationCode = {
  familyId: string;
  children: string;
  parentName: string;
  phone: string;
  branch: string;
  groupName: string;
  activationCode: string;
  expiresAt: string;
  error: string;
};

async function rpc(functionName: string, body: Record<string, unknown>) {
  const session = await getValidStaffSession();
  if (!session) throw new Error("Сессия сотрудника истекла. Войдите снова.");

  const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${functionName}`, {
    method: "POST",
    headers: {
      apikey: SUPABASE_PUBLISHABLE_KEY,
      Authorization: `Bearer ${session.access_token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    let message = "Не удалось выполнить действие.";
    try {
      const payload = (await response.json()) as ApiError;
      message = payload.message || payload.details || message;
    } catch {
      // ignore non-json response
    }
    if (message.includes("parent already active")) message = "Кабинет этого родителя уже активирован.";
    if (message.includes("parent phone missing")) message = "У родителя не указан телефон.";
    if (message.includes("not authorized")) message = "Недостаточно прав для этого действия.";
    throw new Error(message);
  }

  return response.status === 204 ? [] : response.json();
}

export async function generateParentActivationCode(childId: string): Promise<ParentActivationCode> {
  const rows = await rpc("staff_generate_parent_invite", { p_child_id: childId, p_valid_hours: 168 });
  const row = rows?.[0];
  if (!row?.activation_code) throw new Error("Код не был создан.");
  return {
    childId: row.child_id,
    familyId: row.family_id,
    childName: row.child_name || "",
    parentName: row.parent_name || "Родитель",
    phone: row.phone || "",
    activationCode: row.activation_code,
    expiresAt: row.expires_at || "",
  };
}

export async function generateBulkParentActivationCodes(branch?: string): Promise<BulkParentActivationCode[]> {
  const rows = await rpc("staff_generate_parent_invites", { p_branch: branch || null, p_valid_hours: 168 });
  return (rows || []).map((row: any) => ({
    familyId: row.family_id,
    children: row.children || "",
    parentName: row.parent_name || "Родитель",
    phone: row.phone || "",
    branch: row.branch || "",
    groupName: row.group_name || "",
    activationCode: row.activation_code || "",
    expiresAt: row.expires_at || "",
    error: row.error || "",
  }));
}
