import { getValidStaffSession } from "@/admin/adminApi";

const SUPABASE_URL = "https://yiwiykbuaggyslfyhlfo.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_1MORh5rY7uMDVYLYVX5VAA_cyoph4-7";

export type PaymentStatus = "paid" | "pending" | "overdue";
export type PaymentChild = { id:string; name:string; branch:string; groupName:string; paymentStatus:string };
export type PaymentHistory = { id:string; month:string; oldStatus:string; newStatus:string; changedAt:string; changedByName:string };
export type PaymentLink = { branch:string; paymentUrl:string; enabled:boolean; updatedAt:string };
export type PaymentLinkContext = { role:string; staffBranch:string; links:PaymentLink[] };

type ApiError={message?:string;details?:string};
async function rpc<T>(name:string,body:Record<string,unknown>={}){
  const session=await getValidStaffSession();
  if(!session) throw new Error("Сессия сотрудника не найдена. Войдите снова.");
  const response=await fetch(`${SUPABASE_URL}/rest/v1/rpc/${name}`,{method:"POST",headers:{apikey:SUPABASE_PUBLISHABLE_KEY,Authorization:`Bearer ${session.access_token}`,"Content-Type":"application/json"},body:JSON.stringify(body)});
  if(!response.ok){let message="Не удалось выполнить операцию.";try{const p=(await response.json()) as ApiError;message=p.message||p.details||message}catch{};if(message.includes("not authorized"))message="У вас нет доступа к этой операции.";if(message.includes("invalid status"))message="Выберите корректный статус оплаты.";if(message.includes("invalid payment url"))message="Ссылка должна начинаться с http:// или https://";if(message.includes("invalid branch"))message="Выберите корректный филиал.";throw new Error(message)}
  if(response.status===204)return undefined as T;return response.json() as Promise<T>;
}

export async function fetchPaymentContext(){const d:any=await rpc("staff_payment_context");return{role:d.role||"",staffBranch:d.staffBranch||"",children:(Array.isArray(d.children)?d.children:[]).map((c:any)=>({id:c.id,name:c.name||"Ученик",branch:c.branch||"",groupName:c.groupName||"",paymentStatus:c.paymentStatus||""})) as PaymentChild[]}}
export async function setPaymentStatus(childId:string,month:string,status:PaymentStatus){return rpc<string>("staff_set_payment_status",{p_child_id:childId,p_month:`${month}-01`,p_status:status})}
export async function fetchPaymentHistory(childId:string){const rows:any[]=await rpc("staff_payment_history",{p_child_id:childId});return(rows||[]).map((r:any)=>({id:r.id,month:r.month||"",oldStatus:r.old_status||"",newStatus:r.new_status||"",changedAt:r.changed_at||"",changedByName:r.changed_by_name||""})) as PaymentHistory[]}

export async function fetchPaymentLinkContext(): Promise<PaymentLinkContext>{
  const d:any=await rpc("staff_payment_link_context");
  return {
    role:d.role||"",
    staffBranch:d.staffBranch||"",
    links:(Array.isArray(d.links)?d.links:[]).map((item:any)=>({
      branch:item.branch||"",
      paymentUrl:item.paymentUrl||"",
      enabled:Boolean(item.enabled),
      updatedAt:item.updatedAt||"",
    })),
  };
}

export async function savePaymentLink(branch:string,paymentUrl:string){
  const url=paymentUrl.trim();
  const d:any=await rpc("staff_set_payment_link",{p_branch:branch,p_payment_url:url,p_enabled:Boolean(url)});
  return {
    branch:d.branch||branch,
    paymentUrl:d.paymentUrl||url,
    enabled:Boolean(d.enabled),
    updatedAt:new Date().toISOString(),
  } as PaymentLink;
}
