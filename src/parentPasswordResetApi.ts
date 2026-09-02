const SUPABASE_URL = "https://yiwiykbuaggyslfyhlfo.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_1MORh5rY7uMDVYLYVX5VAA_cyoph4-7";

type ApiError = { message?: string };

export type ParentPasswordResetResult = {
  ok: true;
  phone: string;
  message: string;
};

export async function resetParentPassword(phone: string, resetCode: string, password: string) {
  const response = await fetch(`${SUPABASE_URL}/functions/v1/reset-parent-password`, {
    method: "POST",
    headers: {
      apikey: SUPABASE_PUBLISHABLE_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ phone, resetCode, password }),
  });

  let data: ParentPasswordResetResult | ApiError;
  try {
    data = await response.json();
  } catch {
    throw new Error("Не удалось получить ответ от сервера.");
  }

  if (!response.ok) {
    throw new Error((data as ApiError).message || "Не удалось изменить пароль.");
  }

  return data as ParentPasswordResetResult;
}
