import { getValidStaffSession } from "@/admin/adminApi";

const SUPABASE_URL = "https://yiwiykbuaggyslfyhlfo.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_1MORh5rY7uMDVYLYVX5VAA_cyoph4-7";

export type StaffDirectoryRow = {
  profileId: string;
  fullName: string;
  roleName: string;
  branch: string;
  phone: string;
  authUserId: string;
  teachingSubjects: string[];
};

export type StaffInviteRow = {
  inviteId: string;
  fullName: string;
  phone: string;
  roleName: string;
  branch: string;
  teachingSubject: string;
  expiresAt: string;
  claimedAt: string;
  revokedAt: string;
  createdAt: string;
};

export type CreatedStaffInvite = StaffInviteRow & { activationCode: string };

type ApiError = { message?: string; details?: string };

function friendly(message: string) {
  if (message.includes("phone already active")) return "На этот телефон уже активирован аккаунт сотрудника.";
  if (message.includes("invalid phone")) return "Проверьте номер телефона сотрудника.";
  if (message.includes("full name required")) return "Введите имя и фамилию сотрудника.";
  if (message.includes("branch required")) return "Выберите филиал.";
  if (message.includes("teaching subject required")) return "Для педагога укажите предмет.";
  if (message.includes("not authorized")) return "У вас нет доступа к управлению сотрудниками.";
  return message;
}

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
    let message = "Не удалось выполнить действие.";
    try {
      const payload = (await response.json()) as ApiError;
      message = payload.message || payload.details || message;
    } catch {
      // ignore
    }
    throw new Error(friendly(message));
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

export async function fetchStaffDirectory() {
  const rows: any[] = await rpc("staff_list_staff_directory");
  return (rows || []).map((row) => ({
    profileId: row.profile_id,
    fullName: row.full_name || "Сотрудник",
    roleName: row.role_name || "",
    branch: row.branch || "",
    phone: row.phone || "",
    authUserId: row.auth_user_id || "",
    teachingSubjects: Array.isArray(row.teaching_subjects) ? row.teaching_subjects : [],
  })) as StaffDirectoryRow[];
}

export async function fetchStaffInvites() {
  const rows: any[] = await rpc("staff_list_staff_invites");
  return (rows || []).map((row) => ({
    inviteId: row.invite_id,
    fullName: row.full_name || "Сотрудник",
    phone: row.phone || "",
    roleName: row.role_name || "",
    branch: row.branch || "",
    teachingSubject: row.teaching_subject || "",
    expiresAt: row.expires_at || "",
    claimedAt: row.claimed_at || "",
    revokedAt: row.revoked_at || "",
    createdAt: row.created_at || "",
  })) as StaffInviteRow[];
}

export async function createStaffInvite(input: {
  fullName: string;
  phone: string;
  roleName: string;
  branch: string;
  teachingSubject: string;
}) {
  const rows: any[] = await rpc("staff_create_staff_invite", {
    p_full_name: input.fullName.trim(),
    p_phone: input.phone.trim(),
    p_role_name: input.roleName,
    p_branch: input.branch || null,
    p_teaching_subject: input.teachingSubject.trim() || null,
    p_valid_hours: 168,
  });
  const row = rows?.[0];
  if (!row) throw new Error("Не удалось создать приглашение.");
  return {
    inviteId: row.invite_id,
    fullName: row.full_name || input.fullName,
    phone: row.phone || input.phone,
    roleName: row.role_name || input.roleName,
    branch: row.branch || "",
    teachingSubject: row.teaching_subject || "",
    activationCode: row.activation_code || "",
    expiresAt: row.expires_at || "",
    claimedAt: "",
    revokedAt: "",
    createdAt: new Date().toISOString(),
  } as CreatedStaffInvite;
}

export async function revokeStaffInvite(inviteId: string) {
  return rpc<boolean>("staff_revoke_staff_invite", { p_invite_id: inviteId });
}
