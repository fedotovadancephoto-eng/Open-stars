const SUPABASE_URL = "https://yiwiykbuaggyslfyhlfo.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_1MORh5rY7uMDVYLYVX5VAA_cyoph4-7";

type RegisterResponse = {
  ok?: boolean;
  message?: string;
  error?: string;
  fullName?: string;
  branch?: string;
};

export async function registerStaff(phone: string, activationCode: string, password: string) {
  const response = await fetch(`${SUPABASE_URL}/functions/v1/register-staff`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: SUPABASE_PUBLISHABLE_KEY,
    },
    body: JSON.stringify({ phone, activationCode, password }),
  });

  let data: RegisterResponse;
  try {
    data = await response.json();
  } catch {
    throw new Error("Не удалось получить ответ от сервера.");
  }

  if (!response.ok) {
    throw new Error(data.message || "Не удалось активировать доступ сотрудника.");
  }

  return data;
}
