import { useEffect, useState } from "react";
import { GroupOccupancy, WorkContext, teamAction } from "@/admin/teamWorkApi";

const field="mt-1 w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-sm";
const days=["Понедельник","Вторник","Среда","Четверг","Пятница","Суббота","Воскресенье"];
const times=["11:00","13:00","16:00"];
const shortage=(n:number|null)=>n==null?null:Math.max(22-n,0);
function Totals({rows,label}:{rows:GroupOccupancy[];label:string}){
 const known=rows.filter(r=>r.actual!=null);const unknown=rows.length-known.length;
 return <p className="mt-3 text-sm font-semibold">{label}: всего детей {known.length?known.reduce((s,r)=>s+(r.actual||0),0):"—"} · не хватает {known.length?known.reduce((s,r)=>s+(shortage(r.actual)||0),0):"—"}{unknown>0&&<span className="block text-xs font-normal text-orange-800">Итог неполный: не заполнено {unknown} времени. Они не включены в сумму.</span>}</p>;
}
export function GroupOccupancyTable({rows}:{rows:GroupOccupancy[]}) {
 return <div className="mt-3 overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr>{["День / время","Всего детей","Не хватает","Возраст набора"].map(h=><th key={h} className="p-2">{h}</th>)}</tr></thead><tbody>{rows.map(r=><tr key={JSON.stringify([r.branch,r.day,r.time,r.group])} className="border-t"><td className="p-2">{r.day} · {r.time}{!r.manual&&r.group&&<span className="block text-xs">{r.group} · прежний отчёт</span>}</td><td className="p-2">{r.actual??"Не заполнено"}</td><td className="p-2 font-semibold">{r.manual?shortage(r.actual)??"—":r.missing??"—"}</td><td className="p-2">{r.ageFrom==null?"Не указан":`${r.ageFrom}–${r.ageTo} лет`}</td></tr>)}</tbody></table></div>;
}
type Draft={time:string;actual:string;ageFrom:string;ageTo:string};
function DayForm({rows,busy,save}:{rows:GroupOccupancy[];busy:boolean;save:(rows:Draft[])=>Promise<boolean>}){
 const [values,setValues]=useState<Draft[]>(rows.map(r=>({time:r.time,actual:r.actual==null?"":String(r.actual),ageFrom:r.ageFrom==null?"":String(r.ageFrom),ageTo:r.ageTo==null?"":String(r.ageTo)})));
 function change(i:number,key:keyof Draft,value:string){setValues(v=>v.map((r,n)=>n===i?{...r,[key]:value}:r));}
 const draftRows=rows.map((r,i)=>({...r,actual:values[i].actual===""?null:Number(values[i].actual)}));
 return <form onSubmit={e=>{e.preventDefault();void save(values);}}><fieldset disabled={busy} className="mt-3 space-y-3">{values.map((r,i)=><div key={r.time} className="rounded-xl bg-[#F7F5EF] p-3"><div className="grid grid-cols-[60px_1fr_1fr] items-end gap-3"><p className="pb-2 font-semibold">{r.time}</p><label className="text-xs">Всего детей<input aria-label={`Всего детей на ${r.time}`} type="number" min="0" max="1000" step="1" placeholder="Не заполнено" className={field} value={r.actual} onChange={e=>change(i,"actual",e.target.value)}/></label><p className="pb-2 text-sm">Не хватает: <strong>{shortage(draftRows[i].actual)??"—"}</strong></p></div><details className="mt-2"><summary className="cursor-pointer text-xs text-black/50">Возраст для набора · необязательно</summary><div className="mt-2 grid grid-cols-2 gap-3"><label className="text-xs">От<input type="number" min="0" max="100" step="1" required={r.ageTo!==""} className={field} value={r.ageFrom} onChange={e=>change(i,"ageFrom",e.target.value)}/></label><label className="text-xs">До<input type="number" min={r.ageFrom||"0"} max="100" step="1" required={r.ageFrom!==""} className={field} value={r.ageTo} onChange={e=>change(i,"ageTo",e.target.value)}/></label></div></details></div>)}</fieldset><Totals rows={draftRows} label="Итого за выбранный день"/><button disabled={busy} className="mt-4 rounded-xl bg-[#171717] px-4 py-3 text-sm font-semibold text-white disabled:opacity-40">Сохранить количество детей</button></form>;
}
export function GroupOccupancyBoard({context,busy,onAction}:{context:WorkContext;busy:boolean;onAction:(a:string,p:Record<string,unknown>)=>Promise<boolean>}) {
 const ownBranch=context.staff.find(s=>s.id===context.actorId)?.branch||"";
 const [branch,setBranch]=useState(context.role==="admin"?ownBranch:context.branches[0]?.branch||"");
 const [day,setDay]=useState(context.groups.find(r=>r.branch===(context.role==="admin"?ownBranch:context.branches[0]?.branch))?.day||"Суббота");
 const editable=context.canReview||(context.role==="admin"&&branch===ownBranch);
 const branchRows=context.groups.filter(r=>r.branch===branch);
 const rows=times.map(time=>branchRows.find(r=>r.day===day&&r.time===time)||{branch,day,time,group:"",actual:null,target:22,missing:null,ageFrom:null,ageTo:null,manual:true});
 return <section className="mt-4 rounded-2xl bg-white p-4"><h2 className="text-lg font-semibold">Наполняемость по дням и времени</h2><div className="mt-3 grid grid-cols-2 gap-3"><label className="text-xs">Округ<select value={branch} onChange={e=>{setBranch(e.target.value);setDay(context.groups.find(r=>r.branch===e.target.value)?.day||"Суббота");}} className={field}>{context.branches.map(b=><option key={b.branch}>{b.branch}</option>)}</select></label><label className="text-xs">День недели<select className={field} value={day} onChange={e=>setDay(e.target.value)}>{days.map(d=><option key={d}>{d}</option>)}</select></label></div>
 <p className="mt-3 text-xs text-black/50">Администратор вводит фактическое количество вручную. На каждое время — 22 места. Не хватает = 22 минус количество детей, минимум 0. Цифры из карточек учеников сюда не подставляются.</p>
 {editable?<DayForm key={branch+day+JSON.stringify(rows)} rows={rows} busy={busy} save={v=>onAction("stream_day",{branch,day,rows:v.map(r=>({...r,actual:r.actual===""?null:Number(r.actual),ageFrom:r.ageFrom===""?null:Number(r.ageFrom),ageTo:r.ageTo===""?null:Number(r.ageTo)}))})}/>:<><GroupOccupancyTable rows={rows}/><Totals rows={rows} label="Итого за выбранный день"/></>}
 <div className="mt-4 border-t pt-3"><Totals rows={branchRows} label="Итого по округу · все дни"/><p className="mt-2 text-xs text-black/50">Итог округа учитывает сохранённые данные всех дней. После изменения цифр нажмите «Сохранить».</p><details className="mt-3"><summary className="cursor-pointer text-sm">Все дни округа</summary><GroupOccupancyTable rows={branchRows}/></details></div>
 </section>;
}
export function MarketingGroupNeeds(){
 const [context,setContext]=useState<WorkContext|null>(null);const [error,setError]=useState("");const [revision,setRevision]=useState(0);
 useEffect(()=>{let active=true;setError("");void teamAction<WorkContext>("context").then(v=>{if(active)setContext(v);}).catch(e=>{if(active)setError(e instanceof Error?e.message:"Не удалось загрузить наполняемость");});return()=>{active=false;};},[revision]);
 return <section className="mt-4 rounded-2xl bg-white p-4"><h2 className="text-lg font-semibold">Куда нужен набор · данные администратора</h2><button className="mt-2 text-sm text-[#C95320]" onClick={()=>setRevision(v=>v+1)}>Обновить наполняемость</button>{error&&<p role="alert" className="mt-2 text-sm text-red-700">{error}</p>}{context?<GroupOccupancyBoard context={{...context,canReview:false,role:"marketer"}} busy={false} onAction={async()=>false}/>:!error&&<p className="mt-2 text-sm">Загружаем данные…</p>}</section>;
}
