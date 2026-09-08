import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { onAdminSection } from "@/admin/adminNavigation";
import { CrmDay, WorkContext, WorkMetric, WorkTask, teamAction, workRoles } from "@/admin/teamWorkApi";

const field="mt-1 block w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-sm";
const button="rounded-xl bg-[#171717] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-40";
const statuses={todo:"Запланировано",in_progress:"В работе",submitted:"На проверке",accepted:"Принято",returned:"На доработке",cancelled:"Отменено"};
const metrics:Record<WorkMetric,string>={none:"Без числового показателя",calls:"Звонки",leads:"Заявки CRM",enrollment:"Действующие ученики"};
const today=()=>new Intl.DateTimeFormat("sv-SE",{timeZone:"Asia/Irkutsk"}).format(new Date());
const dateLabel=(s:string)=>s.split("-").reverse().join(".");
type Action=(action:string,payload:Record<string,unknown>)=>Promise<boolean>;
function CrmNumbers({data}:{data:CrmDay}) {
 return <div className="mt-2 flex flex-wrap gap-3 text-xs text-black/50"><span>Заявки: {data.leads}</span><span>Записаны на пробное: {data.trials}</span><span>Этап «Оплатил»: {data.paid}</span><span>Оформлены ученики: {data.students}</span></div>;
}
function TaskEditor({context,task,busy,onAction,onClose}:{context:WorkContext;task?:WorkTask;busy:boolean;onAction:Action;onClose:()=>void}) {
 const [title,setTitle]=useState(task?.title||"");
 const [description,setDescription]=useState(task?.description||"");
 const [assignee,setAssignee]=useState(task?.assignee_id||context.actorId);
 const [due,setDue]=useState(task?.due_date||context.day);
 const [branch,setBranch]=useState(task?.branch||"");
 const [metric,setMetric]=useState<WorkMetric>(task?.metric||"none");
 const [plan,setPlan]=useState(task?.planned_amount==null?"":String(task.planned_amount));
 const [priority,setPriority]=useState(task?.priority||"normal");
 const person=context.staff.find(s=>s.id===assignee);
 return <form className="mt-4 rounded-2xl border border-[#D96A24]/20 bg-orange-50 p-4" onSubmit={e=>{e.preventDefault();void onAction("save",{
   id:task?.id,version:task?.version,assigneeId:assignee,title,description,day:due,branch:person?.role==="admin"?person.branch:branch,
   metric,plannedAmount:metric==="none"||plan===""?null:Number(plan),priority,
 }).then(ok=>{if(ok)onClose();});}}>
  <h3 className="font-semibold">{task?"Изменить план задачи":"Новая задача"}</h3>
  <fieldset disabled={busy} className="mt-3 grid gap-3 sm:grid-cols-2">
   <label className="text-xs">Задача<input required maxLength={250} className={field} value={title} onChange={e=>setTitle(e.target.value)}/></label>
   <label className="text-xs">Ответственный<select disabled={Boolean(task)} className={field} value={assignee} onChange={e=>setAssignee(e.target.value)}>{context.staff.map(s=><option key={s.id} value={s.id}>{s.name} · {workRoles[s.role]}</option>)}</select></label>
   <label className="text-xs">Срок<input required type="date" min="2026-09-08" className={field} value={due} onChange={e=>setDue(e.target.value)}/></label>
   <label className="text-xs">Округ<select disabled={person?.role==="admin"} className={field} value={person?.role==="admin"?person.branch||"":branch} onChange={e=>setBranch(e.target.value)}><option value="">Вся школа</option>{context.branches.map(b=><option key={b.branch}>{b.branch}</option>)}</select></label>
   <label className="text-xs">Показатель<select className={field} value={metric} onChange={e=>setMetric(e.target.value as WorkMetric)}>{Object.entries(metrics).map(([k,v])=><option key={k} value={k}>{v}</option>)}</select></label>
   <label className="text-xs">План на день<input type="number" min="0" max="100000" step="1" disabled={metric==="none"} placeholder="Не задан" className={field} value={plan} onChange={e=>setPlan(e.target.value)}/></label>
   <label className="text-xs">Приоритет<select className={field} value={priority} onChange={e=>setPriority(e.target.value as "normal"|"high")}><option value="normal">Обычный</option><option value="high">Высокий</option></select></label>
   <label className="text-xs sm:col-span-2">Ожидаемый результат / инструкция<textarea maxLength={4000} className={field} value={description} onChange={e=>setDescription(e.target.value)}/></label>
  </fieldset>
  <div className="mt-3 flex gap-2"><button disabled={busy} className={button}>Сохранить задачу</button><button type="button" disabled={busy} onClick={onClose} className="px-3 text-sm">Закрыть</button></div>
 </form>;
}
function TaskCard({task,context,busy,onAction}:{task:WorkTask;context:WorkContext;busy:boolean;onAction:Action}) {
 const [edit,setEdit]=useState(false);
 const [report,setReport]=useState(false);
 const latest=task.events.filter(e=>e.action==="report").slice(-1)[0];
 const [actual,setActual]=useState(latest?.payload.actual==null?"":String(latest.payload.actual));
 const [reached,setReached]=useState(latest?.payload.reached==null?"":String(latest.payload.reached));
 const [outcome,setOutcome]=useState(latest?.payload.outcome||"");
 const [nextStep,setNextStep]=useState(latest?.payload.nextStep||"");
 const [comment,setComment]=useState("");
 const mine=task.assignee_id===context.actorId;
 const review=context.canReview && (context.role==="owner"||!mine);
 const unfinished=!["accepted","cancelled"].includes(task.status);
 const overdue=unfinished&&task.due_date<context.today;
 const act=(action:string,extra:Record<string,unknown>={})=>onAction(action,{id:task.id,version:task.version,...extra});
 return <article className="rounded-2xl border border-black/10 bg-white p-4">
  <div className="flex flex-wrap items-start justify-between gap-2"><div><h3 className="font-semibold">{task.title}</h3><p className="mt-1 text-xs text-black/50">{task.assigneeName} · {task.branch||"Вся школа"} · до {dateLabel(task.due_date)}</p></div><span className={`rounded-full px-3 py-1 text-xs ${overdue?"bg-red-50 text-red-700":"bg-[#F7F5EF]"}`}>{statuses[task.status]}{overdue?" · просрочено":""}{task.priority==="high"?" · важно":""}</span></div>
  {task.description&&<p className="mt-2 whitespace-pre-wrap text-sm text-black/60">{task.description}</p>}
  {task.metric!=="none"&&<p className="mt-3 text-sm font-semibold">{metrics[task.metric]} · план: {task.planned_amount??"не задан"} · факт: {latest?.payload.actual??"нет отчёта"}</p>}
  {latest&&<div className="mt-3 rounded-xl bg-[#F7F5EF] p-3"><p className="text-xs font-semibold">Последний отчёт · {new Date(latest.created_at).toLocaleString("ru-RU",{timeZone:"Asia/Irkutsk"})}</p>{latest.payload.reached!=null&&<p className="mt-1 text-xs">Дозвонились: {latest.payload.reached}</p>}<p className="mt-2 whitespace-pre-wrap text-sm">{latest.payload.outcome}</p>{latest.payload.nextStep&&<p className="mt-2 whitespace-pre-wrap text-sm">Следующий шаг: {latest.payload.nextStep}</p>}{latest.payload.crm&&<><p className="mt-2 text-xs text-black/40">CRM на момент отчёта</p><CrmNumbers data={latest.payload.crm}/></>}</div>}
  <div className="mt-3 flex flex-wrap gap-2">
   {(mine||context.canReview)&&["todo","in_progress"].includes(task.status)&&<button disabled={busy} onClick={()=>setEdit(v=>!v)} className="rounded-xl bg-[#F7F5EF] px-3 py-2 text-sm">Изменить план</button>}
   {mine&&["todo","returned"].includes(task.status)&&<button disabled={busy} onClick={()=>void act("start")} className={button}>Взять в работу</button>}
   {mine&&["todo","in_progress","returned"].includes(task.status)&&<button disabled={busy||task.due_date>context.today} onClick={()=>setReport(v=>!v)} className={button}>Отчитаться</button>}
  </div>
  {edit&&<TaskEditor context={context} task={task} busy={busy} onAction={onAction} onClose={()=>setEdit(false)}/>}
  {report&&<form className="mt-3 rounded-xl bg-[#F7F5EF] p-3" onSubmit={e=>{e.preventDefault();void act("report",{actual:actual===""?null:Number(actual),reached:reached===""?null:Number(reached),outcome,nextStep});}}>
   <fieldset disabled={busy} className="grid gap-3 sm:grid-cols-2">
    {task.metric==="calls"&&<><label className="text-xs">Сделано звонков<input required type="number" min="0" max="100000" step="1" className={field} value={actual} onChange={e=>setActual(e.target.value)}/></label><label className="text-xs">Дозвонились<input type="number" min="0" max={actual||"100000"} step="1" className={field} value={reached} onChange={e=>setReached(e.target.value)}/></label></>}
    {["leads","enrollment"].includes(task.metric)&&<p className="text-xs text-black/50 sm:col-span-2">Факт подставится автоматически при отправке: {task.metric==="leads"?"новые заявки CRM за день задачи, по её округу или всей школе":"действующие ученики по округу задачи или всей школе на момент отчёта"}.</p>}
    <label className="text-xs sm:col-span-2">Результат / что сделано / что помешало<textarea required maxLength={4000} className={field} value={outcome} onChange={e=>setOutcome(e.target.value)}/></label>
    <label className="text-xs sm:col-span-2">Следующий шаг<textarea maxLength={4000} className={field} value={nextStep} onChange={e=>setNextStep(e.target.value)}/></label>
   </fieldset><button disabled={busy} className={button+" mt-3"}>Отправить на проверку</button>
  </form>}
  {review&&unfinished&&<div className="mt-3 border-t pt-3"><label className="text-xs">Комментарий проверяющего / причина возврата или отмены<textarea maxLength={4000} className={field} value={comment} onChange={e=>setComment(e.target.value)}/></label><div className="mt-2 flex flex-wrap gap-2">{task.status==="submitted"&&<><button disabled={busy} onClick={()=>void act("accept",{comment})} className={button}>Принять отчёт</button><button disabled={busy||!comment.trim()} onClick={()=>void act("return",{comment})} className="rounded-xl bg-orange-50 px-3 py-2 text-sm text-orange-800">На доработку</button></>}<button disabled={busy||!comment.trim()} onClick={()=>void act("cancel",{comment})} className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">Отменить задачу</button></div></div>}
  {task.events.length>0&&<details className="mt-3 text-xs text-black/50"><summary className="cursor-pointer">История задачи и отчётов ({task.events.length})</summary>{task.events.map(e=><div key={e.id} className="mt-2 border-t pt-2"><p>{new Date(e.created_at).toLocaleString("ru-RU",{timeZone:"Asia/Irkutsk"})} · {context.staff.find(s=>s.id===e.actor_id)?.name||"Проверяющий"} · {({plan:"Изменён план",start:"В работе",report:"Отчёт",accept:"Принято",return:"Возвращено",cancel:"Отменено"} as Record<string,string>)[e.action]||e.action}</p>{e.payload.outcome&&<p className="mt-1 whitespace-pre-wrap">Факт: {e.payload.actual??"—"} · {e.payload.outcome}</p>}{e.payload.comment&&<p className="mt-1 whitespace-pre-wrap">{e.payload.comment}</p>}</div>)}</details>}
 </article>;
}
export function TeamWorkBoard() {
 const [open,setOpen]=useState(false);
 const [day,setDay]=useState(today);
 const [context,setContext]=useState<WorkContext|null>(null);
 const [revision,setRevision]=useState(0);
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState("");
 const [success,setSuccess]=useState("");
 const [branch,setBranch]=useState("");
 const [person,setPerson]=useState("");
 const [filter,setFilter]=useState("all");
 const [create,setCreate]=useState(false);
 useEffect(()=>onAdminSection("team-work",()=>setOpen(true)),[]);
 useEffect(()=>{
  if(!open)return;
  let cancelled=false;setContext(null);setError("");
  void teamAction<WorkContext>("prepare",{day}).then(data=>{if(!cancelled)setContext(data);})
    .catch(reason=>{if(!cancelled)setError(reason instanceof Error?reason.message:"Не удалось открыть план.");});
  return ()=>{cancelled=true;};
 },[open,day,revision]);
 const run:Action=async(action,payload)=>{
  setBusy(true);setError("");setSuccess("");
  try {await teamAction(action,payload);setSuccess("Сохранено.");setRevision(v=>v+1);return true;}
  catch(reason){setError(reason instanceof Error?reason.message:"Не удалось сохранить.");return false;}
  finally{setBusy(false);}
 };
 if(!open)return null;
 const target=context?.branches.reduce((sum,b)=>sum+b.target,0)||0;
 const active=context?.branches.reduce((sum,b)=>sum+b.active,0)||0;
 const missing=Math.max(target-active,0);
 const daysLeft=context?Math.max(0,Math.floor((Date.parse(context.goal.due_on)-Date.parse(context.today))/86400000)+1):0;
 const tasks=(context?.tasks||[]).filter(t=>(!branch||t.branch===branch)&&(!person||t.assignee_id===person));
 const filtered=tasks.filter(t=>filter==="all"||(filter==="overdue"?t.due_date<(context?.today||today())&&!["accepted","cancelled"].includes(t.status):t.status===filter));
 return <div className="fixed inset-0 z-[95] overflow-y-auto bg-[#F7F5EF] p-4 sm:p-6"><div className="mx-auto max-w-6xl">
  <header className="flex items-start justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-widest text-[#D96A24]">OPEN STARS · Команда</p><h1 className="mt-1 text-3xl font-semibold">Общий план и задачи</h1></div><button aria-label="Закрыть план команды" disabled={busy} onClick={()=>setOpen(false)} className="rounded-full bg-white p-3"><X/></button></header>
  <div className="mt-4 flex flex-wrap items-end gap-3"><label className="text-sm">День работы<input type="date" min="2026-09-08" value={day} disabled={busy} onChange={e=>{if(e.target.value){setDay(e.target.value);setCreate(false);}}} className={field}/></label><button disabled={busy} onClick={()=>setRevision(v=>v+1)} className={button}>Обновить</button></div>
  {error&&<p role="alert" className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
  {success&&<p role="status" className="mt-4 rounded-xl bg-green-50 p-3 text-sm text-green-800">{success}</p>}
  {!context?<p className="py-10 text-black/50">{error?"План не загружен.":"Загружаем план команды…"}</p>:<>
   <section className="mt-5 rounded-3xl bg-[#171717] p-5 text-white"><p className="text-sm text-white/60">Общая цель до {dateLabel(context.goal.due_on)} включительно</p><p className="mt-2 text-5xl font-semibold">{active} <span className="text-2xl text-white/40">/ {target}</span></p><p className="mt-2 text-sm">Осталось набрать: {missing} · {daysLeft?daysLeft+" дней до срока":"срок завершён"}</p><div className="mt-4 h-2 overflow-hidden rounded-full bg-white/20"><div className="h-full bg-[#D96A24]" style={{width:Math.min(100,target?active/target*100:0)+"%"}}/></div><p className="mt-3 text-xs text-white/60">Только действующие ученики на сейчас. Выбывшие исключены. Выбор дня меняет задачи и отчёты; численность школы всегда текущая.</p></section>
   <div className="mt-3 grid gap-3 md:grid-cols-3">{context.branches.map(b=><button key={b.branch} onClick={()=>setBranch(branch===b.branch?"":b.branch)} className={`rounded-2xl border p-4 text-left ${branch===b.branch?"border-[#D96A24] bg-orange-50":"border-transparent bg-white"}`}><p className="font-semibold">{b.branch}</p><p className="mt-2 text-3xl font-semibold">{b.active} <span className="text-lg text-black/40">/ {b.target}</span></p><p className="mt-1 text-sm text-black/50">Осталось: {Math.max(0,b.target-b.active)}</p></button>)}</div>
   {context.crm&&<section className="mt-4 rounded-2xl bg-white p-4"><h2 className="text-sm font-semibold">События CRM за {dateLabel(day)} · {context.role==="sales"?"ваши ответственные лиды":context.role==="admin"?"ваш округ":"вся школа"}</h2><CrmNumbers data={context.crm}/><p className="mt-2 text-xs text-black/40">«Оплатил» — переход этапа CRM, не сумма поступлений ДДС. Повторные переходы одного лида за день считаются один раз.</p></section>}
   <section className="mt-5 rounded-2xl bg-white p-4"><div className="flex flex-wrap justify-between gap-3"><h2 className="text-xl font-semibold">{context.canReview?"Задачи и отчёты команды":"Мои задачи и отчёты"}</h2><button disabled={busy} onClick={()=>setCreate(v=>!v)} className={button}>Добавить задачу</button></div>
    <div className="mt-3 grid gap-3 sm:grid-cols-3"><label className="text-xs">Округ<select className={field} value={branch} onChange={e=>setBranch(e.target.value)}><option value="">Все округа и общие задачи</option>{context.branches.map(b=><option key={b.branch}>{b.branch}</option>)}</select></label>{context.canReview&&<label className="text-xs">Сотрудник<select className={field} value={person} onChange={e=>setPerson(e.target.value)}><option value="">Все сотрудники</option>{context.staff.map(s=><option key={s.id} value={s.id}>{s.name} · {workRoles[s.role]}</option>)}</select></label>}<label className="text-xs">Статус<select className={field} value={filter} onChange={e=>setFilter(e.target.value)}><option value="all">Все статусы</option><option value="overdue">Просрочено</option>{Object.entries(statuses).map(([k,v])=><option key={k} value={k}>{v}</option>)}</select></label></div>
    <div className="mt-3 flex flex-wrap gap-4 text-sm"><span>Задач: {tasks.length}</span><button onClick={()=>setFilter("submitted")} className="text-[#C95320]">На проверке: {tasks.filter(t=>t.status==="submitted").length}</button><button onClick={()=>setFilter("accepted")} className="text-[#5F6338]">Принято: {tasks.filter(t=>t.status==="accepted").length}</button><button onClick={()=>setFilter("overdue")} className="text-red-700">Просрочено: {tasks.filter(t=>t.due_date<context.today&&!["accepted","cancelled"].includes(t.status)).length}</button></div>
    <p className="mt-3 text-xs leading-5 text-black/45">Здесь задачи выбранного дня и незакрытые задачи прошлых дней. Ежедневные задачи по ролям действуют до 30 сентября. Числовые планы звонков и заявок нужно установить в задаче. Отчёт не считается принятым до проверки руководителем.</p>
    {create&&<TaskEditor context={context} busy={busy} onAction={run} onClose={()=>setCreate(false)}/>}
   </section>
   {context.canReview&&<details className="mt-4 rounded-2xl bg-white p-4"><summary className="cursor-pointer font-semibold">Контроль по сотрудникам</summary><div className="mt-3 overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr><th className="p-2">Сотрудник</th><th className="p-2">Задачи</th><th className="p-2">На проверке</th><th className="p-2">Принято</th><th className="p-2">Просрочено</th></tr></thead><tbody>{context.staff.map(s=>{const own=tasks.filter(t=>t.assignee_id===s.id);return <tr key={s.id} className="border-t"><td className="p-2"><button className="text-[#C95320]" onClick={()=>setPerson(s.id)}>{s.name}</button></td><td className="p-2">{own.length}</td><td className="p-2">{own.filter(t=>t.status==="submitted").length}</td><td className="p-2">{own.filter(t=>t.status==="accepted").length}</td><td className="p-2">{own.filter(t=>t.due_date<context.today&&!["accepted","cancelled"].includes(t.status)).length}</td></tr>;})}</tbody></table></div></details>}
   <div className="mt-4 space-y-3">{filtered.map(task=><TaskCard key={task.id+":"+task.version} task={task} context={context} busy={busy} onAction={run}/>)}</div>
   {!filtered.length&&<p className="py-10 text-center text-black/40">Нет задач по выбранным фильтрам.</p>}
  </>}
 </div></div>;
}
