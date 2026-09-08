import { useEffect, useMemo, useState } from "react";
import { RefreshCw, X } from "lucide-react";
import { onAdminSection } from "@/admin/adminNavigation";
import { AttendanceOverview, AttendanceRow, fetchAttendanceOverview } from "@/admin/attendanceOverviewApi";
import { groupLabel } from "@/groupLabels";

function today() { return new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Irkutsk" }).format(new Date()); }
function weekend() {
  const end = new Date(today() + "T12:00:00Z");
  end.setUTCDate(end.getUTCDate() - end.getUTCDay());
  const start = new Date(end); start.setUTCDate(start.getUTCDate() - 1);
  return { from: start.toISOString().slice(0,10), to: end.toISOString().slice(0,10) };
}
const labels = { all: "Все записи", expected: "Ожидалось", present: "Пришли", absent: "Отсутствовали", unmarked: "Не отмечены" };
type Filter = keyof typeof labels;
function stats(rows: AttendanceRow[]) {
  const present = rows.filter(r=>r.status==="present");
  return {
    expected: rows.filter(r=>r.expected).length,
    present: present.length,
    absent: rows.filter(r=>r.expected && r.status==="absent").length,
    unmarked: rows.filter(r=>r.expected && r.status==="unmarked").length,
    unique: new Set(present.map(r=>r.childId)).size,
    extra: present.filter(r=>!r.expected).length,
  };
}
export function AttendanceOverviewPanel() {
  const [period,setPeriod]=useState(weekend);
  const [draft,setDraft]=useState(weekend);
  const [data,setData]=useState<AttendanceOverview | null>(null);
  const [error,setError]=useState("");
  const [version,setVersion]=useState(0);
  const [branch,setBranch]=useState("");
  const [filter,setFilter]=useState<Filter>("present");
  const [query,setQuery]=useState("");
  const [limit,setLimit]=useState(50);
  useEffect(()=>{
    let cancelled=false; setData(null); setError("");
    void fetchAttendanceOverview(period.from,period.to).then(result=>{if(!cancelled)setData(result);})
      .catch(reason=>{if(!cancelled)setError(reason instanceof Error?reason.message:"Не удалось загрузить свод.");});
    return ()=>{cancelled=true;};
  },[period.from,period.to,version]);
  useEffect(()=>setLimit(50),[branch,filter,query,period.from,period.to]);
  const branches=useMemo(()=>Array.from(new Set([...(data?.branches||[]),...(data?.rows.map(r=>r.branch)||[]),...(data?.unassigned.map(r=>r.branch)||[])])).sort(),[data]);
  const rows=useMemo(()=>(data?.rows||[]).filter(r=>!branch||r.branch===branch),[data,branch]);
  const totals=stats(rows);
  const shown=rows.filter(r=>(filter==="all" || (filter==="expected"?r.expected:r.status===filter && (filter==="present" || r.expected)))
    && (!query || r.name.toLocaleLowerCase("ru").includes(query.toLocaleLowerCase("ru"))));
  const unassigned=(data?.unassigned||[]).filter(r=>!branch||r.branch===branch);
  function choosePeriod(value:{from:string;to:string}) { setDraft(value);setPeriod(value);setVersion(v=>v+1); }
  function apply() {
    if(!draft.from||!draft.to||draft.from>draft.to||(Date.parse(draft.to)-Date.parse(draft.from))/86400000>92) {
      setError("Выберите период от 1 до 93 дней.");return;
    }
    choosePeriod(draft);
  }
  return <section className="rounded-[24px] bg-white p-5 sm:p-6">
    <div className="flex items-start justify-between gap-3"><div><h2 className="text-2xl font-semibold">Посещаемость по округам</h2><p className="mt-1 text-sm text-black/50">Фактические приходы по отметкам педагогов.</p></div><button aria-label="Обновить посещаемость" onClick={()=>setVersion(v=>v+1)} className="rounded-full bg-[#F7F5EF] p-3"><RefreshCw size={18}/></button></div>
    <div className="mt-4 flex flex-wrap gap-2">
      <button onClick={()=>choosePeriod(weekend())} className="rounded-xl bg-[#F7F5EF] px-3 py-2 text-sm">Последние выходные</button>
      <button onClick={()=>choosePeriod({from:today(),to:today()})} className="rounded-xl bg-[#F7F5EF] px-3 py-2 text-sm">Сегодня</button>
      <button onClick={()=>choosePeriod({from:today().slice(0,7)+"-01",to:today()})} className="rounded-xl bg-[#F7F5EF] px-3 py-2 text-sm">Этот месяц</button>
    </div>
    <div className="mt-3 flex flex-wrap items-end gap-3">
      <label className="text-sm">С даты<input type="date" value={draft.from} onChange={e=>setDraft({...draft,from:e.target.value})} className="mt-1 block rounded-xl border p-2"/></label>
      <label className="text-sm">По дату<input type="date" value={draft.to} onChange={e=>setDraft({...draft,to:e.target.value})} className="mt-1 block rounded-xl border p-2"/></label>
      <button onClick={apply} className="rounded-xl bg-[#171717] px-4 py-3 text-sm font-semibold text-white">Показать</button>
    </div>
    {error && <p role="alert" className="mt-3 text-sm text-red-700">{error}</p>}
    {!data ? <p className="py-8 text-black/50">{error?"Данные не загружены.":"Загружаем посещаемость…"}</p> : <>
      <div className="mt-5 flex flex-wrap gap-2">{["",...branches].map(name=><button key={name} onClick={()=>setBranch(name)} className={`rounded-full px-4 py-2 text-sm ${branch===name?"bg-[#171717] text-white":"bg-[#F7F5EF]"}`}>{name||"Все округа"}</button>)}</div>
      <p className="mt-4 text-sm font-semibold">{period.from.split("-").reverse().join(".")} — {period.to.split("-").reverse().join(".")} · {branch||"Все округа"}</p>
      <div className="mt-3 rounded-2xl bg-[#5F6338]/10 p-4"><p className="text-sm">Детей пришло хотя бы раз</p><p className="text-4xl font-semibold">{totals.unique}</p><p className="mt-1 text-xs text-black/50">Уникальные дети за выбранный период</p></div>
      <div className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-4">{(["expected","present","absent","unmarked"] as const).map(key=><button key={key} onClick={()=>{setFilter(key);setQuery("");}} className={`rounded-2xl border p-4 text-left ${filter===key?"border-[#D96A24] bg-orange-50":"border-black/10"}`}><p className="text-sm">{labels[key]}</p><p className="mt-1 text-3xl font-semibold">{totals[key]}</p></button>)}</div>
      <p className="mt-3 text-xs leading-5 text-black/50">Четыре показателя считаются по дням: один ребёнок на трёх предметах — один приход. В разные недели его приходы считаются отдельно. «Ожидалось» — опубликованное расписание и закреплённые дни с учётом дат добавления и выбытия. Для прошлых периодов используются текущие настройки группы и округа.</p>
      <p className="mt-2 text-xs leading-5 text-black/50">«Пришли» — есть хотя бы одна отметка «Был». «Отсутствовали» — «Нет» по всем предметам опубликованного расписания. Неполный журнал или отсутствие расписания без отметок «Был» остаются в «Не отмечены».</p>
      {totals.extra>0&&<p className="mt-2 text-sm text-orange-700">Приходов вне плана: {totals.extra}. Они включены в «Пришли», но не в «Ожидалось».</p>}
      <div className="mt-5 overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr>{["Округ","Ожидалось","Пришли","Отсутствовали","Не отмечены"].map(t=><th key={t} className="p-2">{t}</th>)}</tr></thead><tbody>{branches.filter(b=>!branch||b===branch).map(b=>{const s=stats(data.rows.filter(r=>r.branch===b));return <tr key={b} className="border-t"><th className="p-2"><button className="text-[#C95320] underline" onClick={()=>{setBranch(b);setFilter("present");}}>{b}</button></th>{(["expected","present","absent","unmarked"] as const).map(k=><td key={k} className="p-2"><button className="min-w-10 rounded-lg bg-[#F7F5EF] p-2" onClick={()=>{setBranch(b);setFilter(k);}}>{s[k]}</button></td>)}</tr>;})}</tbody></table></div>
      {unassigned.length>0&&<details className="mt-4 rounded-xl bg-orange-50 p-3"><summary className="cursor-pointer text-sm">Нет дня занятий: {unassigned.length} — не включены в план по дням</summary>{unassigned.map(c=><p key={c.childId} className="mt-2 text-sm">{c.name} · {c.branch}</p>)}</details>}
      <div className="mt-5 flex flex-wrap gap-2">{(Object.keys(labels) as Filter[]).map(k=><button key={k} onClick={()=>setFilter(k)} className={`rounded-xl px-3 py-2 text-sm ${filter===k?"bg-[#171717] text-white":"bg-[#F7F5EF]"}`}>{labels[k]}</button>)}</div>
      <label className="mt-3 block text-sm">Поиск ребёнка<input value={query} onChange={e=>setQuery(e.target.value)} className="mt-1 block w-full rounded-xl border px-3 py-2" placeholder="Имя или фамилия"/></label>
      <p className="mt-3 text-sm text-black/50">{labels[filter]} · {shown.length} записей</p>
      <div className="mt-2 space-y-2">{shown.slice(0,limit).map(r=><article key={r.childId+r.date} className="rounded-xl border border-black/10 p-3"><div className="flex flex-wrap justify-between gap-2"><p className="font-semibold">{r.name}</p><p className="text-sm">{labels[r.status]}</p></div><p className="mt-1 text-sm text-black/50">{r.date.split("-").reverse().join(".")} · {r.branch} · {groupLabel(r.group||"",r.branch,r.lessonDay||"",r.time||"")} · {(r.time||"").slice(0,5)}</p><p className="mt-1 text-xs text-black/50">{r.scheduledSubjects?`Отмечено предметов: ${r.markedSubjects}; в расписании: ${r.scheduledSubjects}`:"Нет опубликованного расписания на эту дату"}{!r.expected?" · Вне плана":""}</p></article>)}</div>
      {shown.length===0&&<p className="py-6 text-sm text-black/50">Записей по выбранному фильтру нет.</p>}
      {shown.length>limit&&<button onClick={()=>setLimit(n=>n+50)} className="mt-3 rounded-xl bg-[#F7F5EF] px-4 py-3">Показать ещё</button>}
    </>}
  </section>;
}
export function AttendanceOverviewModal() {
  const [open,setOpen]=useState(false);
  useEffect(()=>onAdminSection("attendance-overview",()=>setOpen(true)),[]);
  if(!open)return null;
  return <div className="fixed inset-0 z-[92] overflow-y-auto bg-black/30 p-3 sm:p-6"><div className="mx-auto max-w-6xl rounded-3xl bg-[#F7F5EF] p-3"><div className="mb-2 flex justify-end"><button aria-label="Закрыть посещаемость" onClick={()=>setOpen(false)} className="rounded-full bg-white p-3"><X size={22}/></button></div><AttendanceOverviewPanel/></div></div>;
}
