import { useEffect, useState } from "react";
import { Bell, CheckCircle2, LoaderCircle, Newspaper, Send, X } from "lucide-react";

import { NewsItem, NewsScope, fetchNewsContext, publishNews, setNewsActive } from "@/admin/newsApi";

const branches = ["Свердловский", "НЛО", "Октябрьский"];
const groups = ["Базовый", "Продвинутый", "PRO"];
const inputClass = "mt-1.5 w-full rounded-[13px] border border-black/[0.08] bg-white px-3.5 py-3 text-sm text-[#171717] outline-none focus:border-[#D96A24]/45 focus:ring-4 focus:ring-[#D96A24]/[0.06]";

function fmt(value: string) {
  if (!value) return "";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? value : new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(d).replace(".", "");
}

function audience(item: NewsItem) {
  if (item.audienceScope === "all_school") return "Вся школа";
  if (item.audienceScope === "branch") return item.branch;
  return `${item.branch} · ${item.groupName}`;
}

export function AdminNewsManager() {
  const [enabled, setEnabled] = useState(false);
  const [open, setOpen] = useState(false);
  const [role, setRole] = useState("");
  const [staffBranch, setStaffBranch] = useState("");
  const [items, setItems] = useState<NewsItem[]>([]);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [category, setCategory] = useState("OPEN STARS");
  const [scope, setScope] = useState<NewsScope>("all_school");
  const [branch, setBranch] = useState("Октябрьский");
  const [groupName, setGroupName] = useState("PRO");
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function refresh() {
    const context = await fetchNewsContext();
    setEnabled(true); setRole(context.role); setStaffBranch(context.staffBranch); setItems(context.news);
    if (context.role === "admin" && context.staffBranch) { setScope("branch"); setBranch(context.staffBranch); }
  }

  useEffect(() => {
    let cancelled = false; let timer = 0;
    async function detect() { try { const c = await fetchNewsContext(); if (cancelled) return; setEnabled(true); setRole(c.role); setStaffBranch(c.staffBranch); setItems(c.news); if (c.role === "admin" && c.staffBranch) { setScope("branch"); setBranch(c.staffBranch); } } catch { if (!cancelled) timer=window.setTimeout(detect,1400); } }
    detect(); return ()=>{cancelled=true;if(timer)window.clearTimeout(timer)};
  }, []);

  useEffect(() => { const h=()=>setOpen(true); window.addEventListener("openstars:open-news",h); return()=>window.removeEventListener("openstars:open-news",h); }, []);

  async function openManager() { setOpen(true); setLoading(true); setError(""); try { await refresh(); } catch(e){setError(e instanceof Error?e.message:"Не удалось загрузить новости.")} finally {setLoading(false)} }

  async function send() {
    if (!title.trim()) return setError("Введите заголовок новости.");
    setSaving(true); setError(""); setSuccess("");
    try {
      const result = await publishNews({ title, body, category, audienceScope: scope, branch, groupName });
      setSuccess(`Новость опубликована. Уведомлений создано: ${Number(result.recipient_count || 0)}.`);
      setTitle(""); setBody(""); await refresh();
    } catch(e){setError(e instanceof Error?e.message:"Не удалось опубликовать новость.")} finally {setSaving(false)}
  }

  async function toggle(item: NewsItem) {
    setSaving(true); setError("");
    try { await setNewsActive(item.id,!item.active); await refresh(); }
    catch(e){setError(e instanceof Error?e.message:"Не удалось изменить новость.")} finally {setSaving(false)}
  }

  if (!enabled) return null;
  const isAdmin = role === "admin";

  return <>
    <button type="button" onClick={openManager} className="fixed bottom-[24.7rem] right-4 z-40 flex items-center gap-2 rounded-full bg-[#171717] px-4 py-3 text-sm font-semibold text-white shadow-[0_10px_30px_rgba(0,0,0,0.18)] sm:right-6"><Newspaper size={17}/> Новости</button>
    {open && <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/30 backdrop-blur-[2px] sm:items-center sm:p-5" onClick={()=>!saving&&setOpen(false)}>
      <div className="max-h-[96vh] w-full max-w-5xl overflow-y-auto rounded-t-[28px] bg-[#FAF9F5] p-5 shadow-2xl sm:rounded-[28px] sm:p-7" onClick={e=>e.stopPropagation()}>
        <div className="flex items-start justify-between gap-4"><div><p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#D96A24]">OPEN STARS ADMIN</p><h2 className="mt-1 text-2xl font-semibold">Новости и уведомления</h2><p className="mt-2 text-sm text-black/45">Публикация для всей школы, филиала или группы.</p></div><button onClick={()=>setOpen(false)} className="grid h-10 w-10 place-items-center rounded-full bg-white text-black/55"><X size={20}/></button></div>

        <div className="mt-6 grid gap-5 lg:grid-cols-[0.9fr_1.1fr]">
          <section className="rounded-[24px] border border-black/[0.06] bg-white p-5">
            <div className="flex items-center gap-2"><Send size={18} className="text-[#D96A24]"/><h3 className="font-semibold">Новая публикация</h3></div>
            <label className="mt-4 block text-xs font-semibold text-black/55">Заголовок<input className={inputClass} value={title} onChange={e=>setTitle(e.target.value)} placeholder="Например: Изменение расписания"/></label>
            <label className="mt-3 block text-xs font-semibold text-black/55">Текст<textarea className={`${inputClass} min-h-[130px] resize-y`} value={body} onChange={e=>setBody(e.target.value)} placeholder="Напишите сообщение родителям..."/></label>
            <label className="mt-3 block text-xs font-semibold text-black/55">Категория<input className={inputClass} value={category} onChange={e=>setCategory(e.target.value)} /></label>
            <label className="mt-3 block text-xs font-semibold text-black/55">Кому<select className={inputClass} value={scope} onChange={e=>setScope(e.target.value as NewsScope)} disabled={isAdmin}><option value="all_school">Вся школа</option><option value="branch">Филиал</option><option value="group">Группа</option></select></label>
            {scope!=="all_school" && <label className="mt-3 block text-xs font-semibold text-black/55">Филиал<select className={inputClass} value={branch} onChange={e=>setBranch(e.target.value)} disabled={isAdmin}>{branches.map(v=><option key={v}>{v}</option>)}</select></label>}
            {scope==="group" && <label className="mt-3 block text-xs font-semibold text-black/55">Группа<select className={inputClass} value={groupName} onChange={e=>setGroupName(e.target.value)}>{groups.map(v=><option key={v}>{v}</option>)}</select></label>}
            {isAdmin && <p className="mt-2 text-[11px] leading-5 text-black/35">Администратор публикует только для своего филиала или его группы: {staffBranch}.</p>}
            <button type="button" onClick={send} disabled={saving} className="mt-5 flex w-full items-center justify-center gap-2 rounded-[14px] bg-[#D96A24] px-5 py-3.5 text-sm font-semibold text-white disabled:opacity-50">{saving?<LoaderCircle className="animate-spin" size={17}/>:<Bell size={17}/>} Опубликовать и уведомить</button>
          </section>

          <section className="rounded-[24px] border border-black/[0.06] bg-white p-5">
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-black/35">Опубликовано</p><h3 className="mt-1 text-lg font-semibold">Последние новости</h3>
            {loading?<div className="grid min-h-[180px] place-items-center"><LoaderCircle className="animate-spin text-black/25"/></div>:items.length===0?<div className="mt-4 rounded-[18px] bg-[#FAF9F5] px-5 py-9 text-center text-sm text-black/40">Новостей пока нет.</div>:<div className="mt-4 space-y-3">{items.slice(0,30).map(item=><div key={item.id} className={`rounded-[17px] border p-4 ${item.active?"border-black/[0.06]":"border-black/[0.04] bg-black/[0.025] opacity-65"}`}><div className="flex items-start justify-between gap-3"><div><p className="font-semibold">{item.title}</p><p className="mt-1 text-[11px] text-black/35">{audience(item)} · {fmt(item.publishedAt||item.createdAt)}</p></div><button onClick={()=>toggle(item)} disabled={saving} className="shrink-0 rounded-[10px] bg-[#FAF9F5] px-2.5 py-2 text-[11px] font-semibold text-black/50">{item.active?"Скрыть":"Вернуть"}</button></div>{item.body&&<p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-black/55">{item.body}</p>}</div>)}</div>}
          </section>
        </div>
        {error&&<div className="mt-5 rounded-[15px] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
        {success&&<div className="mt-5 flex gap-2 rounded-[15px] border border-[#5F6338]/15 bg-[#5F6338]/[0.07] px-4 py-3 text-sm font-medium text-[#4D512E]"><CheckCircle2 size={17}/>{success}</div>}
      </div>
    </div>}
  </>;
}
