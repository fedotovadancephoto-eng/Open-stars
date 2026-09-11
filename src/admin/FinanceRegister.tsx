import { useEffect, useRef, useState } from "react";
import { getValidStaffSession } from "@/admin/adminApi";
import { ADMIN_DATA_UPDATED_EVENT } from "@/admin/adminNavigation";

export type FinanceRow = { id:string; date:string; title:string; branch:string; amount:number; method:string; description:string; actor:string; refunded:boolean; month:string; source?:string;sourceId?:string;editable?:boolean;category?:string };
type Register = { rows:FinanceRow[]; count:number; total:number; refunded:number; categories?:Array<{id:string;name:string;amount:number;count:number}> };
const control = "rounded-xl border border-black/10 bg-white px-3 py-2 text-sm";
const money = (value:number) => Number(value).toLocaleString("ru-RU") + " ₽";
const methods:Record<string,string> = {cash:"Наличные",online:"Онлайн · Точка",bank_transfer:"Перевод на счёт",bank:"Перевод",card:"Карта",other:"Способ не указан / другое"};
function today() { const d=new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`; }

export type ExpenseDrilldown = {categoryId:string;from:string;to:string;revision:number};
export function FinanceRegister({kind, lockedBranch="",onEditExpense,onCancelExpense,onPayroll,drilldown,busy=false}:{kind:"payments"|"expenses";lockedBranch?:string;onEditExpense?:(row:FinanceRow)=>void;onCancelExpense?:(row:FinanceRow)=>void;onPayroll?:(row:FinanceRow)=>void;drilldown?:ExpenseDrilldown|null;busy?:boolean}) {
 const root=useRef<HTMLElement|null>(null);
 const [category,setCategory]=useState("");
 useEffect(()=>{if(drilldown){setCategory(drilldown.categoryId);setBranch("");setFrom(drilldown.from);setTo(drilldown.to);setPage(0);root.current?.scrollIntoView({behavior:"smooth",block:"start"});}},[drilldown]);
 const [from,setFrom]=useState(today().slice(0,7)+"-01");
 const [to,setTo]=useState(today());
 const [branch,setBranch]=useState("");
 const [method,setMethod]=useState("all");
 const [page,setPage]=useState(0);
 const [revision,setRevision]=useState(0);
 const [data,setData]=useState<Register|null>(null);
 const [error,setError]=useState("");
 const [loading,setLoading]=useState(false);
 useEffect(()=>{const refresh=()=>{setPage(0);setRevision(v=>v+1);};window.addEventListener(ADMIN_DATA_UPDATED_EVENT,refresh);return()=>window.removeEventListener(ADMIN_DATA_UPDATED_EVENT,refresh);},[]);
 useEffect(()=>{
  const controller=new AbortController();let active=true;
  setData(null);setError("");setLoading(true);
  async function load(){
   try {
    if(!to || (from && from>to)) throw new Error("Проверьте период.");
    const session=await getValidStaffSession();if(!session)throw new Error("Войдите в кабинет сотрудника.");
    const response=await fetch(`https://yiwiykbuaggyslfyhlfo.supabase.co/rest/v1/rpc/${kind === "expenses" ? "owner_expense_register" : "staff_finance_register"}`,{method:"POST",signal:controller.signal,headers:{apikey:"sb_publishable_1MORh5rY7uMDVYLYVX5VAA_cyoph4-7",Authorization:`Bearer ${session.access_token}`,"Content-Type":"application/json"},body:JSON.stringify({p_from:from||"1900-01-01",p_to:to,p_branch:lockedBranch||branch,p_page:page,...(kind==="expenses"?{p_category:category}:{p_kind:kind,p_method:method})})});
    if(!response.ok)throw new Error("Не удалось загрузить реестр. Попробуйте обновить.");
    const result=await response.json();if(active)setData(result);
   }catch(e){if(active)setError(e instanceof Error?e.message:"Ошибка загрузки.");}finally{if(active)setLoading(false);}
  }
  void load();return()=>{active=false;controller.abort();};
 },[kind,from,to,branch,lockedBranch,method,page,revision,category]);
 return <section ref={root} className="mt-5 rounded-3xl border border-black/5 bg-white p-5">
  <h3 className="text-lg font-semibold">{kind==="payments"?"Кто оплатил · наличные и безналичные":"Полный реестр расходов ДДС"}</h3>
  <p className="mt-2 text-xs text-black/50">{kind==="payments"?"По дате поступления денег. Частичные платежи показаны отдельно. Возвращённые оплаты отмечены и исключены из итога; отменённые не показываются.":"Все проведённые расходы из ДДС, включая зарплаты, маркетинг и возвраты. Общие и распределённые платежи показаны одной операцией."}</p>
  <div className="mt-4 flex flex-wrap items-end gap-3">
   <label className="grid gap-1 text-xs">С даты<input aria-label="Начало периода реестра" type="date" className={control} value={from} onChange={e=>{setFrom(e.target.value);setPage(0);}}/></label>
   <label className="grid gap-1 text-xs">По дату<input aria-label="Конец периода реестра" type="date" className={control} value={to} onChange={e=>{setTo(e.target.value);setPage(0);}}/></label>
   <button type="button" className={control} onClick={()=>{setFrom("");setTo(today());setPage(0);}}>За всё время</button>
   <label className="grid gap-1 text-xs">Округ<select className={control} value={lockedBranch||branch} disabled={!!lockedBranch} onChange={e=>{setBranch(e.target.value);setPage(0);}}><option value="">Все округа</option>{["Октябрьский","Свердловский","НЛО",...(kind==="expenses"?["Общий / распределённый"]:[])].map(b=><option key={b}>{b}</option>)}</select></label>
   {kind==="payments" && <label className="grid gap-1 text-xs">Способ оплаты<select className={control} value={method} onChange={e=>{setMethod(e.target.value);setPage(0);}}><option value="all">Все способы</option><option value="cash">Наличные</option><option value="noncash">Безналичные</option><option value="unknown">Не указан / другое</option></select></label>}
   <button type="button" disabled={loading} className={control} onClick={()=>setRevision(v=>v+1)}>Обновить</button>
  </div>
  {error && <p role="alert" className="mt-4 text-red-700">{error}</p>}
  {loading && <p className="mt-4 text-sm text-black/50">Загружаем реестр…</p>}
  {data && <>
  {kind==="expenses" && <div className="mt-5"><h4 className="font-semibold">По категориям</h4><p className="mt-1 text-xs text-black/50">Нажмите на категорию, чтобы увидеть все её расходы за выбранный период.</p><button type="button" className={`${control} mt-3 ${!category?"font-bold":""}`} onClick={()=>{setCategory("");setPage(0);}}>Все категории</button><div className="mt-2 grid gap-2 sm:grid-cols-2">{data.categories?.map(item=><button key={item.id} type="button" aria-pressed={category===item.id} onClick={()=>{setCategory(item.id);setPage(0);}} className={`flex items-center justify-between gap-3 rounded-xl border p-3 text-left text-sm ${category===item.id?"border-[#D96A24] bg-[#FFF2E8]":"border-black/10"}`}><span>{item.name}<small className="block text-black/45">Операций: {item.count}</small></span><strong className="whitespace-nowrap">{money(item.amount)} →</strong></button>)}</div></div>}
  <p className="mt-4 font-semibold">Операций: {data.count} · Итого: {money(data.total)}</p>{Number(data.refunded)>0 && <p className="mt-1 text-xs text-black/50">Возвращённые поступления: {money(data.refunded)}</p>}
  <div className="mt-3 divide-y divide-black/5">{data.rows.length===0?<p className="py-4 text-sm text-black/50">За выбранный период операций нет.</p>:data.rows.map(row=><article key={row.id} className="py-3"><div className="flex justify-between gap-3"><strong>{row.title}</strong><strong className="whitespace-nowrap">{money(row.amount)}</strong></div><p className="mt-1 text-sm text-black/60">{row.branch} · {row.date.split("-").reverse().join(".")} · {kind==="payments"?(methods[row.method]||"Способ не указан"):row.method}</p>{row.month && <p className="text-xs text-black/50">За занятия: {row.month}</p>}{row.description && <p className="mt-1 text-sm text-black/60">{row.description}</p>}{row.actor && <p className="text-xs text-black/45">Внёс: {row.actor}</p>}{row.refunded && <p className="mt-1 text-sm text-orange-700">Возврат произведён</p>}
  {kind==="expenses" && row.editable && <div className="mt-3 flex flex-wrap gap-2">
    {onEditExpense && <button type="button" disabled={busy} className={`${control} disabled:opacity-50`} onClick={()=>onEditExpense(row)}>Исправить расход</button>}
    {onCancelExpense && <button type="button" disabled={busy} className={`${control} text-red-700 disabled:opacity-50`} onClick={()=>onCancelExpense(row)}>Отменить расход</button>}
  </div>}
  {kind==="expenses" && row.source==="teacher_payroll" && onPayroll && <button type="button" disabled={busy} className={`${control} mt-3 disabled:opacity-50`} onClick={()=>onPayroll(row)}>Исправить зарплату</button>}
  {kind==="expenses" && row.source==="tuition_refund" && <p className="mt-2 text-xs text-black/45">Возврат связан с оплатой ребёнка.</p>}
  </article>)}</div>
  {data.count>50 && <div className="mt-4 flex items-center gap-3"><button type="button" disabled={page===0} className={control} onClick={()=>setPage(v=>v-1)}>Назад</button><span className="text-sm">{page+1} / {Math.ceil(data.count/50)}</span><button type="button" disabled={(page+1)*50>=data.count} className={control} onClick={()=>setPage(v=>v+1)}>Далее</button></div>}</>}
 </section>;
}
