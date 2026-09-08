import { useEffect, useState } from "react";
import { workRpc } from "@/admin/teamWorkApi";

type Sources = { total:number;rows:{source:string;count:number}[] };
export function MarketingStudentSources({branch}:{branch:string}) {
 const [data,setData]=useState<Sources|null>(null);
 const [error,setError]=useState("");
 const [revision,setRevision]=useState(0);
 useEffect(()=>{
  let cancelled=false;setData(null);setError("");
  void workRpc<Sources>("marketing_student_sources",{p_branch:branch||null})
   .then(value=>{if(!cancelled)setData(value);})
   .catch(reason=>{if(!cancelled)setError(reason instanceof Error?reason.message:"Не удалось загрузить источники.");});
  return ()=>{cancelled=true;};
 },[branch,revision]);
 return <section className="mt-4 rounded-[22px] bg-white p-4">
  <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-lg font-semibold">Действующие ученики по источникам</h2><p className="mt-1 text-xs text-black/50">Состав школы на сейчас · {branch||"Все округа"} · выбывшие исключены</p></div><button onClick={()=>setRevision(v=>v+1)} className="rounded-xl bg-[#F7F5EF] px-3 py-2 text-sm">Обновить источники</button></div>
  <p className="mt-2 text-xs text-black/45">Этот блок показывает всех действующих учеников, независимо от периода рекламного отчёта выше.</p>
  {error&&<p role="alert" className="mt-3 text-sm text-red-700">{error}</p>}
  {!data?<p className="py-5 text-sm text-black/40">{error?"Источники не загружены.":"Загружаем источники…"}</p>:<>
   <p className="mt-4 text-3xl font-semibold">{data.total} <span className="text-sm font-normal text-black/45">действующих учеников</span></p>
   <div className="mt-4 overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr><th className="py-2">Источник</th><th className="py-2">Ученики</th><th className="py-2">Доля</th></tr></thead><tbody>{[...data.rows].sort((a,b)=>b.count-a.count||a.source.localeCompare(b.source,"ru")).map(row=><tr key={row.source} className="border-t border-black/5"><td className="py-3">{row.source}</td><td className="py-3 font-semibold">{row.count}</td><td className="py-3">{data.total?Math.round(row.count/data.total*100):0}%</td></tr>)}</tbody><tfoot><tr className="border-t font-semibold"><td className="py-3">Всего</td><td>{data.total}</td><td>{data.total?"100%":"—"}</td></tr></tfoot></table></div>
   {(data.rows.find(r=>r.source==="Не указан")?.count||0)>0&&<p className="rounded-xl bg-orange-50 p-3 text-xs leading-5 text-orange-800">«Не указан» — источник не заполнен в карточке ученика и связанной CRM-карточке. После заполнения он появится в соответствующей строке. Нулевой результат канала не означает, что он не привёл учеников: сначала нужно заполнить пропуски.</p>}
  </>}
 </section>;
}
