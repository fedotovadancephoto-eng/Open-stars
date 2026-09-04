import { useEffect, useMemo, useState } from "react";
import { AlertCircle, CalendarClock, Check, ChevronRight, CirclePlus, LoaderCircle, Search, Target, UserRoundPlus, X } from "lucide-react";

import { StaffRole } from "@/admin/adminApi";
import { onAdminSection } from "@/admin/adminNavigation";
import {
  completeCrmTask,
  createCrmLead,
  createCrmTask,
  CrmLead,
  CrmLostReason,
  CrmStage,
  CrmTask,
  fetchCrmContext,
  fetchCrmLeads,
  fetchCrmMarketingSummary,
  fetchCrmTasks,
  updateCrmLead,
} from "@/admin/crmApi";

const branches = ["НЛО", "Октябрьский", "Свердловский"];
const sources = ["Instagram", "Звонок", "VK", "Рекомендация", "2ГИС", "Яндекс", "Сайт", "Старая база", "Наружная реклама", "Партнёры", "Мероприятие", "Другое"];
const stageOrder: CrmStage[] = ["new", "contacted", "trial_booked", "trial_attended", "thinking", "awaiting_payment", "paid", "student"];
const stageLabels: Record<CrmStage, string> = {
  new: "Новый лид",
  contacted: "Связались",
  trial_booked: "Записан на пробное",
  trial_attended: "Пришёл",
  thinking: "Думает",
  awaiting_payment: "Ждём оплату",
  paid: "Оплатил",
  student: "Стал учеником",
};
const lostLabels: Record<CrmLostReason, string> = {
  no_answer: "Не дозвонились",
  not_responding: "Не отвечает",
  rescheduled: "Перенёс",
  refusal: "Отказ",
  other_school: "Другая школа",
  unqualified: "Нецелевой",
};

const inputClass = "mt-1.5 w-full rounded-[16px] border border-black/[0.08] bg-white px-4 py-3.5 text-sm text-[#171717] outline-none focus:border-[#D96A24]/40 focus:ring-4 focus:ring-[#D96A24]/[0.06]";

function localDateTime(hours = 24) {
  const date = new Date(Date.now() + hours * 60 * 60 * 1000);
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().slice(0, 16);
}

function toIso(value: string) {
  return value ? new Date(value).toISOString() : "";
}

function localInput(value: string) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().slice(0, 16);
}

function shortDate(value: string) {
  if (!value) return "—";
  const date = new Date(value);
  return new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(date).replace(".", "");
}

function todayIso(offsetDays = 0) {
  const date = new Date();
  date.setDate(date.getDate() + offsetDays);
  return date.toISOString().slice(0, 10);
}

export function AdminCrmManager() {
  const [open, setOpen] = useState(false);
  const [role, setRole] = useState<StaffRole | null>(null);
  const [staffBranch, setStaffBranch] = useState("");
  const [branchFilter, setBranchFilter] = useState("");
  const [leads, setLeads] = useState<CrmLead[]>([]);
  const [tasks, setTasks] = useState<CrmTask[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"all" | "overdue" | "lost" | CrmStage>("all");
  const [selectedId, setSelectedId] = useState("");
  const [showCreate, setShowCreate] = useState(false);

  const [childName, setChildName] = useState("");
  const [parentName, setParentName] = useState("");
  const [parentPhone, setParentPhone] = useState("");
  const [newBranch, setNewBranch] = useState("НЛО");
  const [source, setSource] = useState("Instagram");
  const [sourceNote, setSourceNote] = useState("");
  const [campaign, setCampaign] = useState("");
  const [trialAt, setTrialAt] = useState("");
  const [nextContactAt, setNextContactAt] = useState(localDateTime());
  const [createComment, setCreateComment] = useState("");

  const [editStage, setEditStage] = useState<CrmStage>("new");
  const [editTrialAt, setEditTrialAt] = useState("");
  const [editNextContactAt, setEditNextContactAt] = useState("");
  const [editComment, setEditComment] = useState("");
  const [editLost, setEditLost] = useState(false);
  const [editLostReason, setEditLostReason] = useState<CrmLostReason>("no_answer");
  const [taskTitle, setTaskTitle] = useState("");
  const [taskDueAt, setTaskDueAt] = useState(localDateTime());

  const [marketingFrom, setMarketingFrom] = useState(todayIso(-30));
  const [marketingTo, setMarketingTo] = useState(todayIso());
  const [marketingRows, setMarketingRows] = useState<Array<{branch:string;source:string;leads:number;trials:number;paid:number;students:number;lost:number}>>([]);

  useEffect(() => onAdminSection("crm", () => { setOpen(true); void load(); }), []);

  async function load() {
    setLoading(true);
    setError("");
    try {
      const context = await fetchCrmContext();
      setRole(context.role);
      const branch = (context as any).profile?.staff_branch || "";
      // staff_branch is not part of StaffIdentity, so read branch restrictions from RLS; admin UI will resolve from visible leads after first load.
      setStaffBranch(branch);
      if (context.role === "marketer") {
        setMarketingRows(await fetchCrmMarketingSummary(marketingFrom, marketingTo, branchFilter));
      } else {
        const [nextLeads, nextTasks] = await Promise.all([fetchCrmLeads(branchFilter), fetchCrmTasks()]);
        setLeads(nextLeads);
        setTasks(nextTasks);
        if (context.role === "admin" && nextLeads[0]?.branch) {
          setStaffBranch(nextLeads[0].branch);
          setNewBranch(nextLeads[0].branch);
        }
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Не удалось загрузить CRM.");
    } finally {
      setLoading(false);
    }
  }

  async function reloadData() {
    if (role === "marketer") {
      setMarketingRows(await fetchCrmMarketingSummary(marketingFrom, marketingTo, branchFilter));
      return;
    }
    const [nextLeads, nextTasks] = await Promise.all([fetchCrmLeads(branchFilter), fetchCrmTasks()]);
    setLeads(nextLeads);
    setTasks(nextTasks);
  }

  const selected = useMemo(() => leads.find((item) => item.id === selectedId) || null, [leads, selectedId]);
  const selectedTasks = useMemo(() => tasks.filter((item) => item.leadId === selectedId && item.status === "open"), [tasks, selectedId]);
  const overdueCount = useMemo(() => leads.filter((lead) => !lead.isLost && lead.stage !== "student" && new Date(lead.nextContactAt).getTime() < Date.now()).length, [leads]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return leads.filter((lead) => {
      if (filter === "lost" && !lead.isLost) return false;
      if (filter === "overdue" && (lead.isLost || lead.stage === "student" || new Date(lead.nextContactAt).getTime() >= Date.now())) return false;
      if (stageOrder.includes(filter as CrmStage) && (lead.isLost || lead.stage !== filter)) return false;
      if (!q) return true;
      return [lead.childName, lead.parentName, lead.parentPhone, lead.source].join(" ").toLowerCase().includes(q);
    });
  }, [leads, filter, query]);

  function openLead(lead: CrmLead) {
    setSelectedId(lead.id);
    setEditStage(lead.stage);
    setEditTrialAt(localInput(lead.trialAt));
    setEditNextContactAt(localInput(lead.nextContactAt));
    setEditComment(lead.comment);
    setEditLost(lead.isLost);
    setEditLostReason((lead.lostReason || "no_answer") as CrmLostReason);
    setTaskTitle("");
    setTaskDueAt(localDateTime());
    setError("");
    setSuccess("");
  }

  function clearCreate() {
    setChildName(""); setParentName(""); setParentPhone(""); setSource("Instagram"); setSourceNote(""); setCampaign(""); setTrialAt(""); setNextContactAt(localDateTime()); setCreateComment("");
  }

  async function saveNewLead() {
    if (!childName.trim() || !parentName.trim() || !parentPhone.trim()) return setError("Заполните ребёнка, родителя и телефон.");
    if (!nextContactAt) return setError("Укажите следующий контакт.");
    setSaving(true); setError(""); setSuccess("");
    try {
      await createCrmLead({ branch: role === "admin" && staffBranch ? staffBranch : newBranch, childName, parentName, parentPhone, source, sourceNote, campaign, trialAt: toIso(trialAt), nextContactAt: toIso(nextContactAt), comment: createComment });
      await reloadData();
      clearCreate();
      setShowCreate(false);
      setSuccess("Лид добавлен. Задача на следующий контакт создана автоматически.");
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Не удалось добавить лид."); }
    finally { setSaving(false); }
  }

  async function saveLead() {
    if (!selected) return;
    if (!editLost && editStage !== "student" && !editNextContactAt) return setError("Укажите следующий контакт.");
    setSaving(true); setError(""); setSuccess("");
    try {
      await updateCrmLead({ leadId: selected.id, stage: editStage, trialAt: toIso(editTrialAt), nextContactAt: editStage === "student" ? undefined : toIso(editNextContactAt), comment: editComment, isLost: editLost, lostReason: editLost ? editLostReason : "" });
      await reloadData();
      setSuccess("Карточка лида обновлена.");
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Не удалось обновить лид."); }
    finally { setSaving(false); }
  }

  async function addTask() {
    if (!selected || !taskTitle.trim() || !taskDueAt) return setError("Укажите задачу и срок.");
    setSaving(true); setError("");
    try { await createCrmTask(selected.id, taskTitle, toIso(taskDueAt)); await reloadData(); setTaskTitle(""); setTaskDueAt(localDateTime()); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Не удалось добавить задачу."); }
    finally { setSaving(false); }
  }

  async function doneTask(id: string) {
    setSaving(true); setError("");
    try { await completeCrmTask(id); await reloadData(); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Не удалось закрыть задачу."); }
    finally { setSaving(false); }
  }

  if (!open) return null;

  const marketingTotals = marketingRows.reduce((acc, row) => ({ leads: acc.leads + row.leads, trials: acc.trials + row.trials, paid: acc.paid + row.paid, students: acc.students + row.students, lost: acc.lost + row.lost }), { leads:0,trials:0,paid:0,students:0,lost:0 });

  return (
    <div className="fixed inset-0 z-[82] overflow-y-auto bg-[#F7F5EF]">
      <div className="mx-auto min-h-full max-w-5xl px-4 pb-24 pt-[calc(env(safe-area-inset-top,0px)+1rem)] sm:px-6">
        <header className="sticky top-0 z-10 -mx-4 flex items-start justify-between border-b border-black/[0.05] bg-[#F7F5EF]/95 px-4 py-4 backdrop-blur sm:-mx-6 sm:px-6">
          <div><p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#D96A24]">OPEN STARS · CRM</p><h1 className="mt-1 text-3xl font-semibold tracking-[-0.04em]">{role === "marketer" ? "Маркетинг" : "Лиды и продажи"}</h1></div>
          <button type="button" onClick={() => setOpen(false)} className="grid h-12 w-12 place-items-center rounded-full bg-white shadow-sm"><X size={22}/></button>
        </header>

        {loading && <div className="mt-8 flex items-center gap-2 rounded-[22px] bg-white p-5 text-sm text-black/45"><LoaderCircle className="animate-spin" size={18}/> Загружаю CRM…</div>}
        {error && <div className="mt-5 flex items-start gap-2 rounded-[18px] border border-red-200 bg-red-50 p-4 text-sm text-red-700"><AlertCircle className="mt-0.5 shrink-0" size={18}/><span>{error}</span></div>}
        {success && <div className="mt-5 rounded-[18px] bg-[#5F6338]/10 p-4 text-sm font-medium text-[#4D512E]">{success}</div>}

        {role === "marketer" ? (
          <div className="mt-6 space-y-5">
            <section className="rounded-[24px] bg-white p-5">
              <div className="grid gap-3 sm:grid-cols-3">
                <label className="text-xs font-semibold text-black/50">С даты<input type="date" className={inputClass} value={marketingFrom} onChange={(e)=>setMarketingFrom(e.target.value)}/></label>
                <label className="text-xs font-semibold text-black/50">По дату<input type="date" className={inputClass} value={marketingTo} onChange={(e)=>setMarketingTo(e.target.value)}/></label>
                <button type="button" onClick={() => void reloadData()} className="mt-auto rounded-[16px] bg-[#171717] px-4 py-3.5 text-sm font-semibold text-white">Обновить</button>
              </div>
            </section>
            <section className="grid grid-cols-2 gap-3 sm:grid-cols-5">
              {[['Лиды',marketingTotals.leads],['Пробные',marketingTotals.trials],['Оплатили',marketingTotals.paid],['Ученики',marketingTotals.students],['Потеряно',marketingTotals.lost]].map(([label,value])=><div key={String(label)} className="rounded-[22px] bg-white p-4"><p className="text-xs text-black/40">{label}</p><p className="mt-2 text-3xl font-semibold">{value}</p></div>)}
            </section>
            <section className="rounded-[24px] bg-white p-5"><p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#5F6338]">Источники</p><div className="mt-4 space-y-2">{marketingRows.length===0?<p className="py-10 text-center text-sm text-black/35">Данных за период пока нет.</p>:marketingRows.map((row)=><div key={`${row.branch}-${row.source}`} className="grid grid-cols-[1fr_auto] gap-3 rounded-[16px] bg-[#FAF9F5] p-3"><div><p className="font-semibold">{row.source}</p><p className="text-xs text-black/40">{row.branch}</p></div><div className="text-right text-xs leading-5"><b>{row.leads}</b> лидов · {row.trials} пробных<br/>{row.students} учеников</div></div>)}</div><p className="mt-4 text-xs leading-5 text-black/35">Маркетолог видит только агрегированные показатели. Телефоны родителей и карточки детей ему недоступны.</p></section>
          </div>
        ) : (
          <>
            <section className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <button onClick={()=>setFilter('all')} className="rounded-[22px] bg-[#171717] p-4 text-left text-white"><p className="text-xs text-white/50">Активная база</p><p className="mt-2 text-3xl font-semibold">{leads.filter(l=>!l.isLost).length}</p></button>
              <button onClick={()=>setFilter('overdue')} className="rounded-[22px] bg-[#FFF2E8] p-4 text-left"><p className="text-xs text-[#C95320]">Просрочено</p><p className="mt-2 text-3xl font-semibold text-[#C95320]">{overdueCount}</p></button>
              <button onClick={()=>setFilter('trial_booked')} className="rounded-[22px] bg-white p-4 text-left"><p className="text-xs text-black/40">На пробное</p><p className="mt-2 text-3xl font-semibold">{leads.filter(l=>!l.isLost&&l.stage==='trial_booked').length}</p></button>
              <button onClick={()=>setFilter('lost')} className="rounded-[22px] bg-white p-4 text-left"><p className="text-xs text-black/40">Потерянные</p><p className="mt-2 text-3xl font-semibold">{leads.filter(l=>l.isLost).length}</p></button>
            </section>

            <div className="mt-5 flex gap-3"><button type="button" onClick={()=>setShowCreate(v=>!v)} className="flex min-h-12 flex-1 items-center justify-center gap-2 rounded-[16px] bg-[#D96A24] px-4 text-sm font-semibold text-white"><UserRoundPlus size={18}/> Новый лид</button></div>

            {showCreate && <section className="mt-4 rounded-[24px] bg-white p-5"><p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#D96A24]">Новая заявка</p><div className="mt-3 grid gap-3 sm:grid-cols-2">
              <label className="text-xs font-semibold text-black/50">Ребёнок<input className={inputClass} value={childName} onChange={e=>setChildName(e.target.value)} placeholder="Имя ребёнка"/></label>
              <label className="text-xs font-semibold text-black/50">Родитель<input className={inputClass} value={parentName} onChange={e=>setParentName(e.target.value)} placeholder="Имя родителя"/></label>
              <label className="text-xs font-semibold text-black/50">Телефон<input inputMode="tel" className={inputClass} value={parentPhone} onChange={e=>setParentPhone(e.target.value)} placeholder="+7…"/></label>
              <label className="text-xs font-semibold text-black/50">Филиал<select disabled={role==='admin'} className={inputClass} value={role==='admin'&&staffBranch?staffBranch:newBranch} onChange={e=>setNewBranch(e.target.value)}>{branches.map(b=><option key={b}>{b}</option>)}</select></label>
              <label className="text-xs font-semibold text-black/50">Источник<select className={inputClass} value={source} onChange={e=>setSource(e.target.value)}>{sources.map(s=><option key={s}>{s}</option>)}</select></label>
              {source==='Другое'&&<label className="text-xs font-semibold text-black/50">Как пришёл<input className={inputClass} value={sourceNote} onChange={e=>setSourceNote(e.target.value)}/></label>}
              <label className="text-xs font-semibold text-black/50">Кампания / уточнение<input className={inputClass} value={campaign} onChange={e=>setCampaign(e.target.value)} placeholder="Необязательно"/></label>
              <label className="text-xs font-semibold text-black/50">Пробное<input type="datetime-local" className={inputClass} value={trialAt} onChange={e=>setTrialAt(e.target.value)}/></label>
              <label className="text-xs font-semibold text-black/50">Следующий контакт *<input type="datetime-local" className={inputClass} value={nextContactAt} onChange={e=>setNextContactAt(e.target.value)}/></label>
              <label className="text-xs font-semibold text-black/50 sm:col-span-2">Комментарий<textarea className={`${inputClass} min-h-24`} value={createComment} onChange={e=>setCreateComment(e.target.value)}/></label>
            </div><button type="button" disabled={saving} onClick={()=>void saveNewLead()} className="mt-4 flex w-full items-center justify-center gap-2 rounded-[16px] bg-[#171717] py-3.5 text-sm font-semibold text-white disabled:opacity-50">{saving?<LoaderCircle className="animate-spin" size={17}/>:<CirclePlus size={17}/>} Добавить лид</button></section>}

            <section className="mt-5 rounded-[24px] bg-white p-4 sm:p-5">
              <div className="flex items-center gap-2 rounded-[16px] bg-[#F7F5EF] px-4"><Search size={18} className="text-black/30"/><input className="w-full bg-transparent py-3.5 text-sm outline-none" value={query} onChange={e=>setQuery(e.target.value)} placeholder="Имя, телефон, источник"/></div>
              <div className="mt-3 flex gap-2 overflow-x-auto pb-1">{(['all',...stageOrder,'overdue','lost'] as const).map(item=><button key={item} onClick={()=>setFilter(item)} className={`whitespace-nowrap rounded-full px-3 py-2 text-xs font-semibold ${filter===item?'bg-[#171717] text-white':'bg-[#F7F5EF] text-black/50'}`}>{item==='all'?'Все':item==='overdue'?'Просрочено':item==='lost'?'Потерянные':stageLabels[item]}</button>)}</div>
              <div className="mt-4 space-y-2">{visible.length===0?<p className="py-12 text-center text-sm text-black/35">По этому фильтру лидов пока нет.</p>:visible.map(lead=><button key={lead.id} onClick={()=>openLead(lead)} className="flex w-full items-center gap-3 rounded-[18px] border border-black/[0.05] p-4 text-left"><div className="min-w-0 flex-1"><div className="flex items-center gap-2"><p className="truncate font-semibold">{lead.childName}</p>{new Date(lead.nextContactAt).getTime()<Date.now()&&!lead.isLost&&lead.stage!=='student'&&<span className="rounded-full bg-red-50 px-2 py-1 text-[10px] font-bold text-red-600">Просрочено</span>}</div><p className="mt-1 truncate text-xs text-black/40">{lead.parentName} · {lead.parentPhone}</p><p className="mt-2 text-xs font-medium text-[#5F6338]">{lead.isLost?lostLabels[lead.lostReason as CrmLostReason]:stageLabels[lead.stage]} · {lead.branch}</p></div><ChevronRight size={18} className="text-black/25"/></button>)}</div>
            </section>
          </>
        )}
      </div>

      {selected && role !== "marketer" && <div className="fixed inset-0 z-[84] overflow-y-auto bg-black/20 p-3 backdrop-blur-sm sm:p-6"><div className="mx-auto max-w-xl rounded-[28px] bg-[#FAF9F5] p-5 shadow-2xl"><div className="flex items-start justify-between"><div><p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#D96A24]">Карточка лида</p><h2 className="mt-1 text-2xl font-semibold">{selected.childName}</h2><p className="mt-1 text-sm text-black/40">{selected.parentName} · {selected.parentPhone}</p></div><button onClick={()=>setSelectedId('')} className="grid h-11 w-11 place-items-center rounded-full bg-white"><X size={20}/></button></div>
        <div className="mt-5 grid gap-3 sm:grid-cols-2"><label className="text-xs font-semibold text-black/50">Этап<select className={inputClass} value={editStage} onChange={e=>setEditStage(e.target.value as CrmStage)}>{stageOrder.map(s=><option key={s} value={s}>{stageLabels[s]}</option>)}</select></label><label className="text-xs font-semibold text-black/50">Пробное<input type="datetime-local" className={inputClass} value={editTrialAt} onChange={e=>setEditTrialAt(e.target.value)}/></label><label className="text-xs font-semibold text-black/50 sm:col-span-2">Следующий контакт {editStage!=='student'&&!editLost&&'*'}<input type="datetime-local" className={inputClass} value={editNextContactAt} onChange={e=>setEditNextContactAt(e.target.value)}/></label><label className="text-xs font-semibold text-black/50 sm:col-span-2">Комментарий<textarea className={`${inputClass} min-h-24`} value={editComment} onChange={e=>setEditComment(e.target.value)}/></label></div>
        <label className="mt-4 flex items-center gap-3 rounded-[16px] bg-white p-3 text-sm font-semibold"><input type="checkbox" checked={editLost} onChange={e=>setEditLost(e.target.checked)} className="h-5 w-5"/> Потерянный лид — не удалять</label>{editLost&&<label className="mt-3 block text-xs font-semibold text-black/50">Причина<select className={inputClass} value={editLostReason} onChange={e=>setEditLostReason(e.target.value as CrmLostReason)}>{Object.entries(lostLabels).map(([key,label])=><option key={key} value={key}>{label}</option>)}</select></label>}
        <button disabled={saving} onClick={()=>void saveLead()} className="mt-4 flex w-full items-center justify-center gap-2 rounded-[16px] bg-[#D96A24] py-3.5 text-sm font-semibold text-white"><Check size={17}/> Сохранить карточку</button>
        <section className="mt-5 rounded-[20px] bg-white p-4"><div className="flex items-center gap-2"><CalendarClock size={18} className="text-[#5F6338]"/><h3 className="font-semibold">Задачи</h3></div><div className="mt-3 space-y-2">{selectedTasks.length===0?<p className="py-4 text-sm text-black/35">Открытых задач нет.</p>:selectedTasks.map(task=><div key={task.id} className="flex items-center gap-3 rounded-[14px] bg-[#F7F5EF] p-3"><button onClick={()=>void doneTask(task.id)} className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-white text-[#5F6338]"><Check size={15}/></button><div><p className="text-sm font-medium">{task.title}</p><p className={`text-xs ${new Date(task.dueAt).getTime()<Date.now()?'text-red-600':'text-black/35'}`}>{shortDate(task.dueAt)}</p></div></div>)}</div><div className="mt-3 grid gap-2"><input className={inputClass} value={taskTitle} onChange={e=>setTaskTitle(e.target.value)} placeholder="Новая задача"/><input type="datetime-local" className={inputClass} value={taskDueAt} onChange={e=>setTaskDueAt(e.target.value)}/><button onClick={()=>void addTask()} className="rounded-[14px] bg-[#5F6338] py-3 text-sm font-semibold text-white">Добавить задачу</button></div></section>
        {editStage==='paid'&&<div className="mt-4 rounded-[18px] border border-[#D96A24]/20 bg-[#FFF5EC] p-4"><div className="flex gap-2"><Target size={18} className="text-[#D96A24]"/><div><p className="font-semibold">Следующий шаг — оформить ученика</p><p className="mt-1 text-xs leading-5 text-black/45">Связку CRM → «Оформить ученика» подключим следующим шагом, с проверкой дублей семьи и ребёнка.</p></div></div></div>}
      </div></div>}
    </div>
  );
}
