import { getValidStaffSession } from "@/admin/adminApi";

export type WorkMetric = "none" | "calls" | "leads" | "enrollment";
export type WorkStatus = "todo" | "in_progress" | "submitted" | "accepted" | "returned" | "cancelled";
export type CrmDay = { leads: number; trials: number; paid: number; students: number };
export type WorkEvent = {
 id: string; action: string; actor_id: string; created_at: string;
 payload: { actual?: number | null; reached?: number | null; outcome?: string; nextStep?: string;
   comment?: string; crm?: CrmDay | null; plan?: number | null };
};
export type WorkTask = {
 id: string; assignee_id: string; assigneeName: string; branch: string | null; title: string;
 description: string; due_date: string; priority: "normal" | "high"; metric: WorkMetric;
 planned_amount: number | null; status: WorkStatus; version: number; events: WorkEvent[];
};
export type WorkContext = {
 actorId: string; role: string; canReview: boolean; day: string; today: string;
 goal: { title: string; starts_on: string; due_on: string };
 branches: { branch: string; target: number; active: number }[];
 staff: { id: string; name: string; role: string; branch: string | null }[];
 tasks: WorkTask[]; crm: CrmDay | null;
};
export const workRoles: Record<string,string> = { owner:"Руководитель",project_director:"Директор проекта",manager:"Управляющий",admin:"Администратор",sales:"Продажник",marketer:"Маркетолог",teacher:"Педагог" };
export async function workRpc<T>(name: string,body: Record<string,unknown>): Promise<T> {
 const session=await getValidStaffSession();
 if(!session)throw new Error("Войдите в кабинет сотрудника заново.");
 const response=await fetch("https://yiwiykbuaggyslfyhlfo.supabase.co/rest/v1/rpc/"+name,{
  method:"POST",headers:{apikey:"sb_publishable_1MORh5rY7uMDVYLYVX5VAA_cyoph4-7",Authorization:`Bearer ${session.access_token}`,"Content-Type":"application/json"},body:JSON.stringify(body),
 });
 if(!response.ok){
  let message="Не удалось выполнить действие.";
  try { const error=await response.json();message=error.message||message; } catch { /* retain fallback */ }
  const errors: Record<string,string>={
   "not authorized":"Нет доступа к этому действию.",
   "task changed":"Задача уже изменена. Обновите список и повторите.",
   "task locked":"План задачи уже отправлен на проверку. Его нельзя менять.",
   "invalid transition":"Статус задачи изменился. Обновите список.",
   "result required":"Опишите результат выполнения.",
   "calls required":"Укажите количество звонков.",
   "invalid actual":"Проверьте числа: дозвонов не может быть больше, чем звонков.",
   "comment required":"Укажите причину возврата или отмены.",
   "title required":"Укажите название задачи (до 250 символов).",
   "future report":"Отчёт за будущий день отправить нельзя.",
   "invalid work day":"Выберите дату начиная с 8 сентября 2026 года, не более чем на год вперёд.",
  };
  throw new Error(errors[message]||message);
 }
 return response.json();
}
export function teamAction<T>(action: string,payload:Record<string,unknown>={}) {
 return workRpc<T>("team_work",{p_action:action,p_payload:payload});
}
