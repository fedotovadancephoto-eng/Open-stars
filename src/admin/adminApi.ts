const SUPABASE_URL = "https://yiwiykbuaggyslfyhlfo.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_1MORh5rY7uMDVYLYVX5VAA_cyoph4-7";
const STAFF_SESSION_KEY = "openstars_staff_session";

export type StaffRole = "owner" | "admin" | "manager" | "teacher";

export type StaffSession = {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  expires_at: number;
  token_type: string;
};

export type StaffIdentity = {
  role: StaffRole;
  profile: {
    id: string;
    full_name: string | null;
    phone: string | null;
  };
  user: { id: string };
};

export type AdminChild = {
  id: string;
  familyId: string | null;
  firstName: string;
  lastName: string;
  fullName: string;
  birthDate: string;
  groupName: string;
  branch: string;
  level: string;
  lessonDay: string;
  lessonTime: string;
  mentorName: string;
  photoUrl: string;
  coins: number;
  paymentStatus: string;
  parentProfileId: string;
  parentName: string;
  parentPhone: string;
  activationStatus: "active" | "invited" | "not_invited";
};

export type ChildUpdateInput = {
  firstName: string;
  lastName: string;
  birthDate: string;
  groupName: string;
  branch: string;
  level: string;
  lessonDay: string;
  lessonTime: string;
  mentorName: string;
  photoUrl: string;
};

type LoginResponse = StaffIdentity & {
  ok: true;
  phone: string;
  session: StaffSession;
};

type ApiError = { message?: string; error?: string };

function saveStaffSession(session: StaffSession) {
  localStorage.setItem(STAFF_SESSION_KEY, JSON.stringify(session));
}

export function clearStaffSession() {
  localStorage.removeItem(STAFF_SESSION_KEY);
}

export function getStaffSession(): StaffSession | null {
  const stored = localStorage.getItem(STAFF_SESSION_KEY);
  if (!stored) return null;
  try {
    return JSON.parse(stored) as StaffSession;
  } catch {
    clearStaffSession();
    return null;
  }
}

function isExpired(session: StaffSession) {
  return session.expires_at <= Math.floor(Date.now() / 1000) + 30;
}

export async function loginStaff(phone: string, password: string) {
  const response = await fetch(`${SUPABASE_URL}/functions/v1/login-staff`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: SUPABASE_PUBLISHABLE_KEY,
    },
    body: JSON.stringify({ phone, password }),
  });

  let data: LoginResponse | ApiError;
  try {
    data = await response.json();
  } catch {
    throw new Error("Не удалось получить ответ от сервера.");
  }

  if (!response.ok) {
    throw new Error((data as ApiError).message || "Не удалось войти в админ-панель.");
  }

  const result = data as LoginResponse;
  saveStaffSession(result.session);
  return result;
}

export async function refreshStaffSession() {
  const session = getStaffSession();
  if (!session) return null;

  const response = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: SUPABASE_PUBLISHABLE_KEY,
    },
    body: JSON.stringify({ refresh_token: session.refresh_token }),
  });

  if (!response.ok) {
    clearStaffSession();
    return null;
  }

  const data = await response.json();
  const next: StaffSession = {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expires_in: data.expires_in,
    expires_at: data.expires_at ?? Math.floor(Date.now() / 1000) + data.expires_in,
    token_type: data.token_type,
  };
  saveStaffSession(next);
  return next;
}

export async function getValidStaffSession() {
  const session = getStaffSession();
  if (!session) return null;
  if (!isExpired(session)) return session;
  return refreshStaffSession();
}

async function restSelect<T>(table: string, query: string, token: string): Promise<T[]> {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${query}`, {
    headers: {
      apikey: SUPABASE_PUBLISHABLE_KEY,
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    if (response.status === 401) {
      clearStaffSession();
      throw new Error("Сессия сотрудника истекла. Войдите снова.");
    }
    throw new Error(`Не удалось загрузить ${table}.`);
  }

  return response.json();
}

async function restPatch<T>(table: string, query: string, body: unknown, token: string): Promise<T[]> {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${query}`, {
    method: "PATCH",
    headers: {
      apikey: SUPABASE_PUBLISHABLE_KEY,
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    if (response.status === 401) {
      clearStaffSession();
      throw new Error("Сессия сотрудника истекла. Войдите снова.");
    }
    let detail = "";
    try {
      const payload = await response.json();
      detail = payload?.message || payload?.details || "";
    } catch {
      // ignore non-json response
    }
    throw new Error(detail || `Не удалось сохранить ${table}.`);
  }

  return response.json();
}

function roleFromRow(row: any): StaffRole | null {
  const raw = Array.isArray(row?.roles) ? row.roles[0]?.name : row?.roles?.name;
  return ["owner", "admin", "manager", "teacher"].includes(raw) ? raw : null;
}

export async function fetchStaffIdentity(): Promise<StaffIdentity> {
  const session = await getValidStaffSession();
  if (!session) throw new Error("Сессия сотрудника не найдена.");

  const rows = await restSelect<any>(
    "users_profile",
    "select=id,full_name,phone,auth_user_id,roles(name)&limit=1",
    session.access_token
  );
  const row = rows[0];
  const role = roleFromRow(row);

  if (!row || !role) {
    clearStaffSession();
    throw new Error("У аккаунта нет доступа к админ-панели.");
  }

  return {
    role,
    profile: {
      id: row.id,
      full_name: row.full_name,
      phone: row.phone,
    },
    user: { id: row.auth_user_id },
  };
}

function shortTime(value?: string | null) {
  return value ? value.slice(0, 5) : "";
}

export async function updateAdminChild(childId: string, input: ChildUpdateInput) {
  const session = await getValidStaffSession();
  if (!session) throw new Error("Сессия сотрудника не найдена.");

  const firstName = input.firstName.trim();
  const lastName = input.lastName.trim();
  if (!firstName || !lastName) {
    throw new Error("Имя и фамилия ребёнка обязательны.");
  }

  await restPatch(
    "children",
    `id=eq.${encodeURIComponent(childId)}`,
    {
      first_name: firstName,
      last_name: lastName,
      birth_date: input.birthDate || null,
      group_name: input.groupName.trim() || null,
      branch: input.branch.trim() || null,
      level: input.level.trim() || null,
      lesson_day: input.lessonDay.trim() || null,
      lesson_time: input.lessonTime ? `${input.lessonTime}:00` : null,
      mentor_name: input.mentorName.trim() || null,
      photo_url: input.photoUrl.trim() || null,
    },
    session.access_token
  );
}

export async function updateParentDisplayName(profileId: string, fullName: string) {
  if (!profileId) return;
  const session = await getValidStaffSession();
  if (!session) throw new Error("Сессия сотрудника не найдена.");

  await restPatch(
    "users_profile",
    `id=eq.${encodeURIComponent(profileId)}`,
    { full_name: fullName.trim() || null },
    session.access_token
  );
}

export async function fetchAdminChildren(role: StaffRole): Promise<AdminChild[]> {
  const session = await getValidStaffSession();
  if (!session) throw new Error("Сессия сотрудника не найдена.");
  const token = session.access_token;

  const children = await restSelect<any>(
    "children",
    "select=id,family_id,first_name,last_name,birth_date,group_name,branch,level,lesson_day,lesson_time,mentor_name,photo_url,coins,payment_status&order=last_name.asc,first_name.asc",
    token
  );

  if (role === "teacher") {
    return children.map((child) => ({
      id: child.id,
      familyId: child.family_id,
      firstName: child.first_name || "",
      lastName: child.last_name || "",
      fullName: [child.first_name, child.last_name].filter(Boolean).join(" "),
      birthDate: child.birth_date || "",
      groupName: child.group_name || "",
      branch: child.branch || "",
      level: child.level || "",
      lessonDay: child.lesson_day || "",
      lessonTime: shortTime(child.lesson_time),
      mentorName: child.mentor_name || "",
      photoUrl: child.photo_url || "",
      coins: Number(child.coins || 0),
      paymentStatus: "",
      parentProfileId: "",
      parentName: "",
      parentPhone: "",
      activationStatus: "not_invited",
    }));
  }

  const [members, profiles, invites] = await Promise.all([
    restSelect<any>("family_members", "select=id,family_id,user_id,relationship", token),
    restSelect<any>("users_profile", "select=id,full_name,phone,auth_user_id", token),
    restSelect<any>(
      "parent_invites",
      "select=id,family_id,phone,full_name,claimed_at,revoked_at,expires_at&order=created_at.desc",
      token
    ),
  ]);

  const profilesById = new Map(profiles.map((profile) => [profile.id, profile]));

  return children.map((child) => {
    const familyMembers = members.filter((member) => member.family_id === child.family_id);
    const member = familyMembers.find((item) => item.relationship === "parent") || familyMembers[0];
    const parentProfile = member ? profilesById.get(member.user_id) : null;
    const invite = invites.find((item) => item.family_id === child.family_id && !item.revoked_at);

    let activationStatus: AdminChild["activationStatus"] = "not_invited";
    if (parentProfile?.auth_user_id || invite?.claimed_at) activationStatus = "active";
    else if (invite) activationStatus = "invited";

    return {
      id: child.id,
      familyId: child.family_id,
      firstName: child.first_name || "",
      lastName: child.last_name || "",
      fullName: [child.first_name, child.last_name].filter(Boolean).join(" "),
      birthDate: child.birth_date || "",
      groupName: child.group_name || "",
      branch: child.branch || "",
      level: child.level || "",
      lessonDay: child.lesson_day || "",
      lessonTime: shortTime(child.lesson_time),
      mentorName: child.mentor_name || "",
      photoUrl: child.photo_url || "",
      coins: Number(child.coins || 0),
      paymentStatus: child.payment_status || "",
      parentProfileId: parentProfile?.id || "",
      parentName: parentProfile?.full_name || invite?.full_name || "",
      parentPhone: parentProfile?.phone || invite?.phone || "",
      activationStatus,
    };
  });
}
