import { useEffect, useState } from "react";
import { GroupOccupancy, WorkContext, teamAction } from "@/admin/teamWorkApi";
import { groupLabel } from "@/groupLabels";

const field="mt-1 w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-sm";
const days=["Понедельник","Вторник","Среда","Четверг","Пятница","Суббота","Воскресенье"];
export function GroupOccupancyTable({rows}:{rows:GroupOccupancy[]}) {
 return <div className="mt-3 overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr>{["День / время / группа","Возраст набора","План","Факт","Не хватает"].map(h=><th key={h} className="p-2">{h}</th>)}</tr></thead><tbody>{rows.map(r=><tr key={JSON.stringify([r.branch,r.day,r.time,r.group])} className="border-t"><td className="p-2">{r.day} · {r.time}<br/>{groupLabel(r.group,r.branch,r.day,r.time)}</td><td className="p-2">{r.ageFrom==null?"Не задан":`${r.ageFrom}–${r.ageTo} лет`}</td><td className="p-2">{r.target??"Не задан"}</td><td className="p-2">{r.actual}</td><td className="p-2 font-semibold">{r.missing??"—"}</td></tr>)}</tbody></table></div>;
}
export function GroupOccupancyBoard({context,busy,onAction}:{context:WorkContext;busy:boolean;onAction:(a:string,p:Record<string,unknown>)=>Promise<boolean>}) {
 const ownBranch=context.staff.find(s=>s.id===context.actorId)?.branch||"";
 const [branch,setBranch]=useState(context.role==="admin"?ownBranch:context.branches[0]?.branch||"");
 const [edit,setEdit]=useState<GroupOccupancy|null>(null);
 const [day,setDay]=useState("Суббота");const [time,setTime]=useState("11:00");const [group,setGroup]=useState("");const [target,setTarget]=useState("");
 const [ageFrom,setAgeFrom]=useState("");const [ageTo,setAgeTo]=useState("");
 const editable=context.canReview||(context.role==="admin"&&branch===ownBranch);
 const rows=context.groups.filter(r=>r.branch===branch);
 function select(row?:GroupOccupancy){setEdit(row||{branch,day:"Суббота",time:"11:00",group:"",actual:0,target:null,missing:null,ageFrom:null,ageTo:null});setAgeFrom(row?.ageFrom==null?"":String(row.ageFrom));setAgeTo(row?.ageTo==null?"":String(row.ageTo));setDay(row?.day||"Суббота");setTime(row?.time||"11:00");setGroup(row?.group||"");setTarget(row?.target==null?"":String(row.target));}
 return <details open className="mt-4 rounded-2xl bg-white p-4"><summary className="cursor-pointer text-lg font-semibold">Наполняемость по дням, времени и группам</summary>
  <label className="mt-3 block text-xs">Округ<select value={branch} onChange={e=>{setBranch(e.target.value);setEdit(null);}} className={field}>{context.branches.map(b=><option key={b.branch}>{b.branch}</option>)}</select></label>
  <p className="mt-3 text-xs text-black/50">Факт — действующие ученики из карточек на сейчас. Выбывшие исключены. План группы задаётся отдельно; недобор = план минус факт, минимум 0.</p>
  <GroupOccupancyTable rows={rows}/>
  <p className="mt-2 text-xs text-black/50">План округа: {context.branches.find(b=>b.branch===branch)?.target??0} · Задано по группам: {rows.reduce((sum,r)=>sum+(r.target||0),0)} · Групп без плана: {rows.filter(r=>r.target==null).length}</p>
  {editable&&<div className="mt-3 flex flex-wrap gap-2">{rows.filter(r=>days.includes(r.day)&&/^\d{2}:\d{2}$/.test(r.time)).map(r=><button disabled={busy} key={JSON.stringify(r)} onClick={()=>select(r)} className="rounded-xl bg-[#F7F5EF] px-3 py-2 text-xs">План: {r.day} {r.time} · {groupLabel(r.group,r.branch,r.day,r.time)}</button>)}<button disabled={busy} onClick={()=>select()} className="rounded-xl bg-[#171717] px-3 py-2 text-xs text-white">Добавить пустую группу в план</button></div>}
  {edit&&editable&&<form className="mt-3 rounded-xl bg-orange-50 p-3" onSubmit={e=>{e.preventDefault();void onAction("group_plan",{branch,lessonDay:day,lessonTime:time,groupName:group,plannedAmount:Number(target),ageFrom:ageFrom===""?null:Number(ageFrom),ageTo:ageTo===""?null:Number(ageTo)}).then(ok=>{if(ok)setEdit(null);});}}>
   <fieldset disabled={busy} className="grid gap-3 sm:grid-cols-4"><label className="text-xs">День<select disabled={Boolean(edit.group)} className={field} value={day} onChange={e=>setDay(e.target.value)}>{days.map(d=><option key={d}>{d}</option>)}</select></label><label className="text-xs">Время<input required disabled={Boolean(edit.group)} type="time" className={field} value={time} onChange={e=>setTime(e.target.value)}/></label><label className="text-xs">Группа<input required disabled={Boolean(edit.group)} maxLength={100} className={field} value={group} onChange={e=>setGroup(e.target.value)} placeholder="Название группы"/></label><label className="text-xs">План учеников<input required type="number" min="0" max="1000" step="1" className={field} value={target} onChange={e=>setTarget(e.target.value)}/></label><label className="text-xs">Возраст набора от<input type="number" min="0" max="100" required={ageTo!==""} className={field} value={ageFrom} onChange={e=>setAgeFrom(e.target.value)}/></label><label className="text-xs">Возраст набора до<input type="number" min={ageFrom||"0"} max="100" required={ageFrom!==""} className={field} value={ageTo} onChange={e=>setAgeTo(e.target.value)}/></label></fieldset>
   <button disabled={busy} className="mt-3 rounded-xl bg-[#171717] px-4 py-2 text-sm text-white">Сохранить план группы</button><button type="button" disabled={busy} onClick={()=>setEdit(null)} className="ml-3 text-sm">Закрыть</button>
  </form>}
 </details>;
}

export function MarketingGroupNeeds(){
 const [context,setContext]=useState<WorkContext|null>(null);const [error,setError]=useState("");const [revision,setRevision]=useState(0);
 useEffect(()=>{let active=true;setError("");void teamAction<WorkContext>("context").then(v=>{if(active)setContext(v);}).catch(e=>{if(active)setError(e instanceof Error?e.message:"Не удалось загрузить группы");});return()=>{active=false;};},[revision]);
 return <section className="mt-4 rounded-2xl bg-white p-4"><h2 className="text-lg font-semibold">Куда нужен набор · группы и возраст</h2><button className="mt-2 text-sm text-[#C95320]" onClick={()=>setRevision(v=>v+1)}>Обновить потребность в наборе</button>{error&&<p role="alert" className="mt-2 text-sm text-red-700">{error}</p>}{context?<GroupOccupancyBoard context={{...context,canReview:false,role:"marketer"}} busy={false} onAction={async()=>false}/>:!error&&<p className="mt-2 text-sm">Загружаем группы…</p>}</section>;
}
