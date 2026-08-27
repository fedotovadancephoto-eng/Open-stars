import { getValidStaffSession } from "@/admin/adminApi";

const SUPABASE_URL = "https://yiwiykbuaggyslfyhlfo.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_1MORh5rY7uMDVYLYVX5VAA_cyoph4-7";

export async function deleteUnstartedStudent(childId: string) {
  const session = await getValidStaffSession();
  if (!session) throw new Error("Сессия сотрудника истекла.");

  const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/staff_delete_unstarted_student`, {
    method: "POST",
    headers: {
      apikey: SUPABASE_PUBLISHABLE_KEY,
      Authorization: `Bearer ${session.access_token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ p_child_id: childId }),
  });

  if (!response.ok) {
    let message = "Не удалось удалить ученика.";
    try {
      const payload = await response.json();
      message = payload?.message || payload?.details || message;
    } catch {
      // ignore non-json response
    }
    if (message.includes("parent account already activated")) message = "Кабинет родителя уже активирован. Такого ученика нельзя удалять — используйте «Выбыл».";
    if (message.includes("student has activity")) message = "У ребёнка уже есть учебная история. Его нельзя удалять — используйте «Выбыл», чтобы сохранить данные.";
    if (message.includes("not authorized")) message = "Недостаточно прав для удаления.";
    throw new Error(message);
  }
}
