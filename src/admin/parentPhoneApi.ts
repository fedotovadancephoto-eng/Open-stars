import { getValidStaffSession } from "@/admin/adminApi";

const SUPABASE_URL = "https://yiwiykbuaggyslfyhlfo.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_1MORh5rY7uMDVYLYVX5VAA_cyoph4-7";

type ApiError = { message?: string; details?: string };

export type PendingParentPhoneUpdate = {
  profileId: string;
  familyId: string;
  phone: string;
  invitesRevoked: number;
};

function friendlyMessage(message: string) {
  if (message.includes("parent already active")) return "Родитель уже активировал кабинет. Для активного аккаунта номер меняется отдельной процедурой.";
  if (message.includes("invalid phone")) return "Проверьте номер телефона родителя.";
  if (message.includes("phone already registered") || message.includes("phone already invited")) return "Этот номер уже используется другим родительским кабинетом или приглашением.";
  if (message.includes("parent profile missing")) return "У семьи не найден профиль родителя.";
  if (message.includes("student not found")) return "Ученик не найден или уже находится в архиве.";
  if (message.includes("not authorized")) return "Недостаточно прав для изменения номера.";
  return message || "Не удалось изменить номер родителя.";
}

export async function updatePendingParentPhone(childId: string, newPhone: string): Promise<PendingParentPhoneUpdate> {
  const phone = newPhone.trim();
  if (!phone) throw new Error("Введите новый номер телефона родителя.");

  const session = await getValidStaffSession();
  if (!session) throw new Error("Сессия сотрудника истекла. Войдите снова.");

  const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/staff_update_pending_parent_phone`, {
    method: "POST",
    headers: {
      apikey: SUPABASE_PUBLISHABLE_KEY,
      Authorization: `Bearer ${session.access_token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ p_child_id: childId, p_new_phone: phone }),
  });

  if (!response.ok) {
    let message = "";
    try {
      const payload = (await response.json()) as ApiError;
      message = payload.message || payload.details || "";
    } catch {
      // ignore non-json response
    }
    throw new Error(friendlyMessage(message));
  }

  const rows = response.status === 204 ? [] : await response.json();
  const row = rows?.[0];
  if (!row?.phone) throw new Error("Номер не был изменён.");

  return {
    profileId: row.profile_id || "",
    familyId: row.family_id || "",
    phone: row.phone,
    invitesRevoked: Number(row.invites_revoked || 0),
  };
}
