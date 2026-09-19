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

export type DismissedStaffRow = {
  profileId: string;
  fullName: string;
  roleName: string;
  branch: string;
  dismissedAt: string;
  reason: string;
};

type ApiError = { message?: string; details?: string };

function friendly(message: string) {
  if (message.includes("phone already active")) return "На этот телефон уже активирован аккаунт сотрудника.";
  if (message.includes("invalid phone")) return "Проверьте номер телефона сотрудника.";
  if (message.includes("full name required")) return "Введите имя и фамилию сотрудника.";
  if (message.includes("branch required")) return "Выберите филиал.";
  if (message.includes("teaching subject required")) return "Для педагога укажите предмет.";
  if (message.includes("invite already claimed")) return "Сотрудник уже активировал доступ. Новый код ему не нужен.";
  if (message.includes("invite revoked")) return "Это приглашение уже отозвано.";
  if (message.includes("invite not found")) return "Приглашение не найдено. Обновите список сотрудников.";
  if (message.includes("not authorized")) return "У вас нет доступа к управлению сотрудниками.";
  if (message.includes("cannot dismiss yourself")) return "Нельзя уволить собственный аккаунт.";
  if (message.includes("dismiss reason required")) return "Укажите причину прекращения работы.";
  if (message.includes("staff not found")) return "Сотрудник не найден. Обновите список.";
  if (message.includes("staff is not dismissed")) return "Этот сотрудник уже восстановлен или не находится в списке уволенных.";
  if (message.includes("dismissal history not found")) return "Не найдена история прежней роли сотрудника. Обратитесь к директору.";
  if (message.includes("staff account is not activated")) return "У сотрудника нет активированного аккаунта — создайте новый доступ.";
  if (message.includes("teacher assignments missing")) return "В истории не найдены прежние предметы педагога.";
  if (message.includes("invalid staff role")) return "Этот аккаунт нельзя уволить через список сотрудников.";
  if (message.includes("staff account is not active")) return "У сотрудника нет активного аккаунта для повторной активации.";
  if (message.includes("cannot reactivate owner")) return "Доступ директора нельзя перевыпустить из списка сотрудников.";
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

function mapInvite(row: any, fallback?: Partial<StaffInviteRow>): StaffInviteRow {
  return {
    inviteId: row.invite_id || fallback?.inviteId || "",
    fullName: row.full_name || fallback?.fullName || "Сотрудник",
    phone: row.phone || fallback?.phone || "",
    roleName: row.role_name || fallback?.roleName || "",
    branch: row.branch || fallback?.branch || "",
    teachingSubject: row.teaching_subject || fallback?.teachingSubject || "",
    expiresAt: row.expires_at || fallback?.expiresAt || "",
    claimedAt: row.claimed_at || fallback?.claimedAt || "",
    revokedAt: row.revoked_at || fallback?.revokedAt || "",
    createdAt: row.created_at || fallback?.createdAt || "",
  };
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
  return (rows || []).map((row) => mapInvite(row)) as StaffInviteRow[];
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
    ...mapInvite(row, {
      fullName: input.fullName,
      phone: input.phone,
      roleName: input.roleName,
      branch: input.branch,
      teachingSubject: input.teachingSubject,
      createdAt: new Date().toISOString(),
    }),
    activationCode: row.activation_code || "",
  } as CreatedStaffInvite;
}

export async function reissueStaffInvite(invite: StaffInviteRow) {
  const rows: any[] = await rpc("staff_reissue_staff_invite", {
    p_invite_id: invite.inviteId,
    p_valid_hours: 168,
  });
  const row = rows?.[0];
  if (!row?.activation_code) throw new Error("Не удалось выпустить новый код.");
  return {
    ...mapInvite(row, invite),
    activationCode: row.activation_code,
  } as CreatedStaffInvite;
}

export async function createStaffReactivationInvite(person: StaffDirectoryRow) {
  const rows: any[] = await rpc("staff_create_staff_reactivation_invite", {
    p_profile_id: person.profileId,
    p_valid_hours: 168,
  });
  const row = rows?.[0];
  if (!row?.activation_code) throw new Error("Не удалось выпустить код повторной активации.");
  return {
    ...mapInvite(row, {
      fullName: person.fullName,
      phone: person.phone,
      roleName: person.roleName,
      branch: person.branch,
      teachingSubject: person.teachingSubjects[0] || "",
      createdAt: new Date().toISOString(),
    }),
    activationCode: row.activation_code,
  } as CreatedStaffInvite;
}

export async function revokeStaffInvite(inviteId: string) {
  return rpc<boolean>("staff_revoke_staff_invite", { p_invite_id: inviteId });
}

export async function fetchDismissedStaff() {
  return rpc<DismissedStaffRow[]>("staff_list_dismissed_staff");
}

export async function dismissStaff(profileId: string, reason: string) {
  return rpc("staff_dismiss_staff", { p_profile_id: profileId, p_reason: reason.trim() });
}

export async function restoreStaff(profileId: string, fullName: string) {
  return rpc("staff_restore_staff", {
    p_profile_id: profileId,
    p_full_name: fullName.trim(),
    p_reason: "Восстановление существующего аккаунта",
  });
}
