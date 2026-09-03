import { BranchName, GroupName, QuickStudentInput, getValidStaffSession } from "@/admin/adminApi";

const SUPABASE_URL = "https://yiwiykbuaggyslfyhlfo.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_1MORh5rY7uMDVYLYVX5VAA_cyoph4-7";

export const ACQUISITION_SOURCES = [
  "Instagram",
  "VK",
  "2ГИС",
  "Яндекс",
  "Сайт",
  "Рекомендация",
  "Старая база",
  "Наружная реклама",
  "Партнёры",
  "Мероприятие",
  "Другое",
] as const;

export type AcquisitionSource = (typeof ACQUISITION_SOURCES)[number];

export type ChildInternalProfile = {
  childId: string;
  heightCm: number | null;
  acquisitionSource: AcquisitionSource | "";
  acquisitionSourceNote: string;
};

export type QuickStudentWithInternalInput = QuickStudentInput & {
  heightCm?: string;
  acquisitionSource?: AcquisitionSource | "";
  acquisitionSourceNote?: string;
};

type ApiError = { message?: string; details?: string; error?: string };

type InternalProfileRow = {
  child_id: string;
  height_cm: number | null;
  acquisition_source: AcquisitionSource | null;
  acquisition_source_note: string | null;
};

function friendlyError(message: string) {
  if (message.includes("invalid height")) return "Рост укажите в сантиметрах от 40 до 230.";
  if (message.includes("invalid acquisition source")) return "Выберите источник клиента из списка.";
  if (message.includes("source note is required")) return "Для варианта «Другое» напишите, откуда пришёл клиент.";
  if (message.includes("invalid phone")) return "Проверьте номер телефона родителя.";
  if (message.includes("student already exists")) return "Такой ребёнок уже есть у этого родителя.";
  if (message.includes("wrong branch")) return "Можно добавить или изменить ученика только в своём филиале.";
  if (message.includes("invalid branch")) return "Выберите филиал.";
  if (message.includes("invalid group")) return "Выберите группу.";
  if (message.includes("not authorized")) return "Недостаточно прав для этого действия.";
  return message || "Не удалось сохранить внутренние данные ребёнка.";
}

async function rpc<T>(functionName: string, body: Record<string, unknown>): Promise<T> {
  const session = await getValidStaffSession();
  if (!session) throw new Error("Сессия сотрудника не найдена.");

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
    let message = "";
    try {
      const payload = (await response.json()) as ApiError;
      message = payload.message || payload.details || payload.error || "";
    } catch {
      // ignore non-json response
    }
    throw new Error(friendlyError(message));
  }

  if (response.status === 204) return undefined as T;
  return response.json();
}

function parseHeight(value?: string | number | null) {
  if (value === null || value === undefined || String(value).trim() === "") return null;
  const height = Number(value);
  if (!Number.isInteger(height) || height < 40 || height > 230) {
    throw new Error("Рост укажите в сантиметрах от 40 до 230.");
  }
  return height;
}

export async function fetchChildInternalProfile(childId: string): Promise<ChildInternalProfile> {
  const session = await getValidStaffSession();
  if (!session) throw new Error("Сессия сотрудника не найдена.");

  const response = await fetch(
    `${SUPABASE_URL}/rest/v1/child_internal_profiles?select=child_id,height_cm,acquisition_source,acquisition_source_note&child_id=eq.${encodeURIComponent(childId)}&limit=1`,
    {
      headers: {
        apikey: SUPABASE_PUBLISHABLE_KEY,
        Authorization: `Bearer ${session.access_token}`,
      },
    }
  );

  if (!response.ok) throw new Error("Не удалось загрузить внутренние данные ребёнка.");
  const rows = (await response.json()) as InternalProfileRow[];
  const row = rows[0];

  return {
    childId,
    heightCm: row?.height_cm ?? null,
    acquisitionSource: row?.acquisition_source || "",
    acquisitionSourceNote: row?.acquisition_source_note || "",
  };
}

export async function saveChildInternalProfile(
  childId: string,
  input: { heightCm?: string | number | null; acquisitionSource?: AcquisitionSource | ""; acquisitionSourceNote?: string }
) {
  const heightCm = parseHeight(input.heightCm);
  const source = input.acquisitionSource || "";
  const note = input.acquisitionSourceNote?.trim() || "";
  if (source === "Другое" && !note) {
    throw new Error("Для варианта «Другое» напишите, откуда пришёл клиент.");
  }

  return rpc<InternalProfileRow[]>("staff_set_child_internal_profile", {
    p_child_id: childId,
    p_height_cm: heightCm,
    p_acquisition_source: source || null,
    p_acquisition_source_note: source === "Другое" ? note : null,
  });
}

export async function quickCreateStudentWithInternalProfile(input: QuickStudentWithInternalInput) {
  if (!input.firstName.trim() || !input.lastName.trim()) throw new Error("Введите имя и фамилию ребёнка.");
  if (!input.parentName.trim()) throw new Error("Введите имя родителя.");
  if (!input.parentPhone.trim()) throw new Error("Введите телефон родителя.");
  if (!input.branch) throw new Error("Выберите филиал.");
  if (!input.groupName) throw new Error("Выберите группу.");

  const heightCm = parseHeight(input.heightCm);
  const source = input.acquisitionSource || "";
  const note = input.acquisitionSourceNote?.trim() || "";
  if (source === "Другое" && !note) {
    throw new Error("Для варианта «Другое» напишите, откуда пришёл клиент.");
  }

  return rpc<Array<{ child_id: string; family_id: string; parent_profile_id: string }>>(
    "staff_quick_create_student_v2",
    {
      p_first_name: input.firstName.trim(),
      p_last_name: input.lastName.trim(),
      p_parent_name: input.parentName.trim(),
      p_parent_phone: input.parentPhone.trim(),
      p_branch: input.branch as BranchName,
      p_group_name: input.groupName as GroupName,
      p_birth_date: input.birthDate || null,
      p_lesson_day: input.lessonDay?.trim() || null,
      p_lesson_time: input.lessonTime || null,
      p_photo_url: input.photoUrl?.trim() || null,
      p_height_cm: heightCm,
      p_acquisition_source: source || null,
      p_acquisition_source_note: source === "Другое" ? note : null,
    }
  );
}