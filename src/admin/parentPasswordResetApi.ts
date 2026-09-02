import { getValidStaffSession } from "@/admin/adminApi";

const SUPABASE_URL = "https://yiwiykbuaggyslfyhlfo.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_1MORh5rY7uMDVYLYVX5VAA_cyoph4-7";

type ApiError = { message?: string; details?: string };

export type ParentPasswordResetCode = {
  childId: string;
  familyId: string;
  parentProfileId: string;
  parentName: string;
  phone: string;
  resetCode: string;
  expiresAt: string;
};

export async function generateParentPasswordResetCode(childId: string): Promise<ParentPasswordResetCode> {
  const session = await getValidStaffSession();
  if (!session) throw new Error("Сессия сотрудника истекла. Войдите снова.");

  const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/staff_generate_parent_password_reset`, {
    method: "POST",
    headers: {
      apikey: SUPABASE_PUBLISHABLE_KEY,
      Authorization: `Bearer ${session.access_token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ p_child_id: childId, p_valid_minutes: 60 }),
  });

  if (!response.ok) {
    let message = "Не удалось выдать код восстановления.";
    try {
      const payload = (await response.json()) as ApiError;
      message = payload.message || payload.details || message;
    } catch {
      // ignore non-json response
    }
    if (message.includes("parent not active")) message = "Кабинет родителя ещё не активирован. Используйте код первой активации.";
    if (message.includes("parent phone missing")) message = "У родителя не указан телефон.";
    if (message.includes("not authorized")) message = "Недостаточно прав для сброса пароля этого родителя.";
    throw new Error(message);
  }

  const rows = await response.json();
  const row = rows?.[0];
  if (!row?.reset_code) throw new Error("Код восстановления не был создан.");

  return {
    childId: row.child_id,
    familyId: row.family_id,
    parentProfileId: row.parent_profile_id,
    parentName: row.parent_name || "Родитель",
    phone: row.phone || "",
    resetCode: row.reset_code,
    expiresAt: row.expires_at || "",
  };
}
