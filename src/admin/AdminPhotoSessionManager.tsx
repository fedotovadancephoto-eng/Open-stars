import { useEffect, useState } from "react";
import { Camera, CheckCircle2, ExternalLink, LoaderCircle, Send, X } from "lucide-react";

import {
  PhotoSessionItem,
  fetchPhotoSessionContext,
  publishGroupPhotoSession,
  setPhotoSessionPublished,
} from "@/admin/photoSessionsApi";

const branches = ["Свердловский", "НЛО", "Октябрьский"];
const groups = ["Базовый", "Продвинутый", "PRO"];
const days = ["Суббота", "Воскресенье"];
const streams = ["11:00", "13:00", "16:00"];
const inputClass = "mt-1.5 w-full rounded-[13px] border border-black/[0.08] bg-white px-3.5 py-3 text-sm text-[#171717] outline-none focus:border-[#D96A24]/45 focus:ring-4 focus:ring-[#D96A24]/[0.06]";

function dateLabel(value: string) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(d).replace(".", "");
}

export function AdminPhotoSessionManager() {
  const [enabled, setEnabled] = useState(false);
  const [open, setOpen] = useState(false);
  const [role, setRole] = useState("");
  const [staffBranch, setStaffBranch] = useState("");
  const [sessions, setSessions] = useState<PhotoSessionItem[]>([]);
  const [branch, setBranch] = useState("Октябрьский");
  const [groupName, setGroupName] = useState("PRO");
  const [lessonDay, setLessonDay] = useState("Суббота");
  const [lessonTime, setLessonTime] = useState("16:00");
  const [title, setTitle] = useState("Портретная съёмка");
  const [description, setDescription] = useState("");
  const [galleryUrl, setGalleryUrl] = useState("");
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    let cancelled = false;
    let timer = 0;
    async function detect() {
      try {
        const context = await fetchPhotoSessionContext();
        if (cancelled) return;
        setEnabled(true);
        setRole(context.role);
        setStaffBranch(context.staffBranch);
        setSessions(context.sessions);
        if (context.role === "admin" && context.staffBranch && branches.includes(context.staffBranch)) setBranch(context.staffBranch);
      } catch {
        if (!cancelled) timer = window.setTimeout(detect, 1400);
      }
    }
    detect();
    return () => {
      cancelled = true;
      if (timer) window.clearTimeout(timer);
    };
  }, []);

  const branchLocked = role === "admin" && Boolean(staffBranch);

  async function refresh() {
    const context = await fetchPhotoSessionContext();
    setSessions(context.sessions);
  }

  async function openManager() {
    setOpen(true);
    setLoading(true);
    setError("");
    try { await refresh(); }
    catch (e) { setError(e instanceof Error ? e.message : "Не удалось загрузить фотосессии."); }
    finally { setLoading(false); }
  }

  async function publish() {
    if (!title.trim()) return setError("Введите название фотосессии.");
    if (!galleryUrl.trim()) return setError("Вставьте ссылку на общую галерею группы.");
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      const result = await publishGroupPhotoSession({ title, description, galleryUrl, branch, groupName, lessonDay, lessonTime });
      await refresh();
      setSuccess(`Фотосессия опубликована. Уведомления получили ${result.recipient_count} активных родителя(ей).`);
      setGalleryUrl("");
      setDescription("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось опубликовать фотосессию.");
    } finally {
      setSaving(false);
    }
  }

  async function toggle(item: PhotoSessionItem) {
    setBusyId(item.id);
    setError("");
    setSuccess("");
    try {
      await setPhotoSessionPublished(item.id, !item.published);
      await refresh();
      setSuccess(item.published ? "Фотосессия скрыта у родителей." : "Фотосессия снова опубликована.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось изменить публикацию.");
    } finally {
      setBusyId("");
    }
  }

  if (!enabled) return null;

  return <>
    <button type="button" onClick={openManager} className="fixed bottom-[32.7rem] right-4 z-40 flex items-center gap-2 rounded-full bg-[#D96A24] px-4 py-3 text-sm font-semibold text-white shadow-[0_10px_30px_rgba(0,0,0,0.18)] sm:right-6"><Camera size={17}/> Фотосессии</button>
    {open && <div className="fixed inset-0 z-[82] flex items-end justify-center bg-black/30 backdrop-blur-[2px] sm:items-center sm:p-5" onClick={() => !saving && setOpen(false)}>
      <div className="max-h-[96vh] w-full max-w-5xl overflow-y-auto rounded-t-[28px] bg-[#FAF9F5] p-5 shadow-2xl sm:rounded-[28px] sm:p-7" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-4">
          <div><p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#D96A24]">OPEN STARS ADMIN</p><h2 className="mt-1 text-2xl font-semibold">Фотосессии по группам</h2><p className="mt-2 text-sm leading-6 text-black/45">Одна ссылка на общую галерею — сразу всей нужной группе. Родителям автоматически приходит уведомление.</p></div>
          <button type="button" onClick={() => setOpen(false)} disabled={saving} className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-white"><X size={20}/></button>
        </div>

        <section className="mt-6 rounded-[24px] border border-black/[0.06] bg-white p-5 sm:p-6">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <label className="text-xs font-semibold text-black/55">Филиал<select value={branch} disabled={branchLocked} onChange={(e) => setBranch(e.target.value)} className={inputClass}>{branches.map((v) => <option key={v}>{v}</option>)}</select></label>
            <label className="text-xs font-semibold text-black/55">Группа<select value={groupName} onChange={(e) => setGroupName(e.target.value)} className={inputClass}>{groups.map((v) => <option key={v}>{v}</option>)}</select></label>
            <label className="text-xs font-semibold text-black/55">День<select value={lessonDay} onChange={(e) => setLessonDay(e.target.value)} className={inputClass}>{days.map((v) => <option key={v}>{v}</option>)}</select></label>
            <label className="text-xs font-semibold text-black/55">Поток<select value={lessonTime} onChange={(e) => setLessonTime(e.target.value)} className={inputClass}>{streams.map((v) => <option key={v}>{v}</option>)}</select></label>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <label className="text-xs font-semibold text-black/55">Название<input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Например, Портретная съёмка" className={inputClass}/></label>
            <label className="text-xs font-semibold text-black/55">Ссылка на общую галерею<input value={galleryUrl} onChange={(e) => setGalleryUrl(e.target.value)} placeholder="https://..." className={inputClass}/></label>
          </div>
          <label className="mt-4 block text-xs font-semibold text-black/55">Комментарий для родителей<textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Например: найдите папку или фотографии своего ребёнка в общей галерее." rows={3} className={inputClass}/></label>
          <div className="mt-4 rounded-[16px] bg-[#FAF9F5] px-4 py-3 text-sm text-black/50"><span className="font-semibold text-[#171717]">Получатели:</span> {branch} · {lessonDay} · {lessonTime} · {groupName}</div>
          <button type="button" onClick={publish} disabled={saving} className="mt-4 flex w-full items-center justify-center gap-2 rounded-[14px] bg-[#171717] px-5 py-3.5 text-sm font-semibold text-white disabled:opacity-50">{saving ? <LoaderCircle className="animate-spin" size={17}/> : <Send size={17}/>} Опубликовать и уведомить группу</button>
        </section>

        {error && <div className="mt-4 rounded-[15px] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
        {success && <div className="mt-4 flex items-start gap-2 rounded-[15px] bg-[#5F6338]/[0.07] px-4 py-3 text-sm text-[#4D512E]"><CheckCircle2 size={17} className="mt-0.5 shrink-0"/>{success}</div>}

        <section className="mt-5 rounded-[24px] border border-black/[0.06] bg-white p-5 sm:p-6">
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-black/35">Опубликованные ссылки</p>
          {loading ? <div className="grid min-h-[120px] place-items-center"><LoaderCircle className="animate-spin text-black/20"/></div> : sessions.length === 0 ? <p className="mt-4 text-sm text-black/40">Фотосессий пока нет.</p> : <div className="mt-3 space-y-2">{sessions.map((item) => <div key={item.id} className="rounded-[17px] border border-black/[0.055] p-4"><div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><div className="flex flex-wrap items-center gap-2"><p className="font-semibold">{item.title}</p><span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${item.published ? "bg-[#5F6338]/10 text-[#4D512E]" : "bg-black/[0.05] text-black/35"}`}>{item.published ? "Опубликовано" : "Скрыто"}</span></div><p className="mt-1 text-xs text-black/40">{item.branch} · {item.lessonDay} · {item.lessonTime} · {item.groupName}</p><p className="mt-1 text-[11px] text-black/30">{dateLabel(item.publishedAt || item.createdAt)}</p></div><div className="flex gap-2"><a href={item.galleryUrl} target="_blank" rel="noreferrer" className="grid h-10 w-10 place-items-center rounded-[12px] bg-[#FAF9F5] text-black/50" aria-label="Открыть галерею"><ExternalLink size={17}/></a><button type="button" onClick={() => toggle(item)} disabled={busyId===item.id} className="rounded-[12px] bg-[#171717] px-3 py-2 text-xs font-semibold text-white disabled:opacity-50">{busyId===item.id ? "..." : item.published ? "Скрыть" : "Показать"}</button></div></div></div>)}</div>}
        </section>
      </div>
    </div>}
  </>;
}
