import { useEffect, useMemo, useState } from "react";
import { AlertCircle, CalendarClock, Check, ChevronRight, CirclePlus, LoaderCircle, Search, UserRoundPlus, X } from "lucide-react";

import { onAdminSection } from "@/admin/adminNavigation";
import {
  completeCrmTask,
  convertCrmLeadToStudent,
  createCrmLead,
  createCrmTask,
  CrmLead,
  CrmLostReason,
  CrmRole,
  CrmStage,
  CrmTask,
  fetchCrmContext,
  fetchCrmLeads,
  fetchCrmMarketingSummary,
  fetchCrmTasks,
  updateCrmLead,
} from "@/admin/crmApi";

const branches = ["НЛО", "Октябрьский", "Свердловский"];
const groups = ["Базовый", "Продвинутый", "PRO"] as const;
const sources = ["Instagram", "Звонок", "VK", "Рекомендация", "2ГИС", "Яндекс", "Сайт", "Старая база", "Наружная реклама", "Партнёры", "Мероприятие", "Другое"];
const stages: CrmStage[] = ["new", "contacted", "trial_booked", "trial_attended", "thinking", "awaiting_payment", "paid", "student"];
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
const inputClass = "mt-1.5 w-full rounded-[15px] border border-black/[0.08] bg-white px-4 py-3 text-sm outline-none focus:border-[#D96A24]/40";

function localDateTime(hours = 24) {
  const date = new Date(Date.now() + hours * 60 * 60 * 1000);
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().slice(0, 16);
}
function toIso(value: string) { return value ? new Date(value).toISOString() : ""; }
function localInput(value: string) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().slice(0, 16);
}
function dateOnly(daysAgo = 0) {
  const date = new Date();
  date.setDate(date.getDate() - daysAgo);
  return date.toISOString().slice(0, 10);
}
function shortDate(value: string) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(value)).replace(".", "");
}
function splitChildName(value: string) {
  const parts = value.trim().split(/\s+/).filter(Boolean);
  return { firstName: parts[0] || "", lastName: parts.slice(1).join(" ") };
}
function percent(value: number, base: number) { return base > 0 ? Math.round((value / base) * 100) : 0; }

export function AdminCrmManager() {
  const [open, setOpen] = useState(false);
  const [role, setRole] = useState<CrmRole | null>(null);
  const [staffBranch, setStaffBranch] = useState("");
  const [branchFilter, setBranchFilter] = useState("");
  const [leads, setLeads] = useState<CrmLead[]>([]);
  const [tasks, setTasks] = useState<CrmTask[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"all" | "overdue" | "lost" | CrmStage>("all");
  const [showCreate, setShowCreate] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [childName, setChildName] = useState("");
  const [childBirthDate, setChildBirthDate] = useState("");
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

  const [studentFirstName, setStudentFirstName] = useState("");
  const [studentLastName, setStudentLastName] = useState("");
  const [studentBirthDate, setStudentBirthDate] = useState("");
  const [studentGroup, setStudentGroup] = useState<(typeof groups)[number]>("Базовый");
  const [studentLessonDay, setStudentLessonDay] = useState("");
  const [studentLessonTime, setStudentLessonTime] = useState("");

  const [marketingFrom, setMarketingFrom] = useState(dateOnly(30));
  const [marketingTo, setMarketingTo] = useState(dateOnly());
  const [marketingRows, setMarketingRows] = useState<Array<{branch:string;source:string;leads:number;trials:number;paid:number;students:number;lost:number}>>([]);

  useEffect(() => onAdminSection("crm", () => { setOpen(true); void load(); }), []);

  async function load() {
    setLoading(true); setError("");
    try {
      const context = await fetchCrmContext();
      setRole(context.role);
      setStaffBranch(context.staffBranch);
      if (context.role === "admin") {
        setBranchFilter(context.staffBranch);
        setNewBranch(context.staffBranch);
      }
      if (context.role === "marketer") {
        setMarketingRows(await fetchCrmMarketingSummary(marketingFrom, marketingTo, ""));
      } else {
        const branch = context.role === "admin" ? context.staffBranch : "";
        const [nextLeads, nextTasks] = await Promise.all([fetchCrmLeads(branch), fetchCrmTasks()]);
        setLeads(nextLeads); setTasks(nextTasks);
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Не удалось загрузить CRM.");
    } finally { setLoading(false); }
  }

  async function refresh(nextBranch = branchFilter) {
    if (role === "marketer") {
      setMarketingRows(await fetchCrmMarketingSummary(marketingFrom, marketingTo, nextBranch));
      return;
    }
    const branch = role === "admin" ? staffBranch : nextBranch;
    const [nextLeads, nextTasks] = await Promise.all([fetchCrmLeads(branch), fetchCrmTasks()]);
    setLeads(nextLeads); setTasks(nextTasks);
  }

  async function changeBranch(value: string) {
    setBranchFilter(value);
    setSelectedId("");
    setLoading(true); setError("");
    try { await refresh(value); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Не удалось сменить филиал."); }
    finally { setLoading(false); }
  }

  const selected = useMemo(() => leads.find((lead) => lead.id === selectedId) || null, [leads, selectedId]);
  const selectedTasks = useMemo(() => tasks.filter((task) => task.leadId === selectedId && task.status === "open"), [tasks, selectedId]);
  const overdueCount = useMemo(() => leads.filter((lead) => !lead.isLost && lead.stage !== "student" && new Date(lead.nextContactAt).getTime() < Date.now()).length, [leads]);
  const visible = useMemo(() => {
    const text = query.trim().toLowerCase();
    return leads.filter((lead) => {
      if (filter === "lost" && !lead.isLost) return false;
      if (filter === "overdue" && (lead.isLost || lead.stage === "student" || new Date(lead.nextContactAt).getTime() >= Date.now())) return false;
      if (stages.includes(filter as CrmStage) && (lead.isLost || lead.stage !== filter)) return false;
      return !text || [lead.childName, lead.parentName, lead.parentPhone, lead.source].join(" ").toLowerCase().includes(text);
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
    setTaskTitle(""); setTaskDueAt(localDateTime()); setError(""); setSuccess("");
    const split = splitChildName(lead.childName);
    setStudentFirstName(split.firstName);
    setStudentLastName(split.lastName);
    setStudentBirthDate(lead.childBirthDate || "");
    setStudentGroup("Базовый");
    setStudentLessonDay("");
    setStudentLessonTime("");
  }

  async function saveNewLead() {
    if (!childName.trim() || !parentName.trim() || !parentPhone.trim()) return setError("Заполните ребёнка, родителя и телефон.");
    if (!nextContactAt) return setError("Укажите следующий контакт.");
    if (source === "Другое" && !sourceNote.trim()) return setError("Уточните источник клиента.");
    setSaving(true); setError(""); setSuccess("");
    try {
      await createCrmLead({
        branch: role === "admin" ? staffBranch : newBranch,
        childName, childBirthDate, parentName, parentPhone, source, sourceNote, campaign,
        trialAt: toIso(trialAt), nextContactAt: toIso(nextContactAt), comment: createComment,
      });
      await refresh();
      setChildName(""); setChildBirthDate(""); setParentName(""); setParentPhone(""); setSource("Instagram"); setSourceNote(""); setCampaign(""); setTrialAt(""); setNextContactAt(localDateTime()); setCreateComment(""); setShowCreate(false);
      setSuccess("Лид добавлен. Следующий контакт уже создан как задача.");
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Не удалось добавить лид."); }
    finally { setSaving(false); }
  }

  async function saveLead() {
    if (!selected) return;
    if (!editLost && editStage !== "student" && !editNextContactAt) return setError("Укажите следующий контакт.");
    setSaving(true); setError("");
    try {
      await updateCrmLead({ leadId: selected.id, stage: editStage, trialAt: toIso(editTrialAt), nextContactAt: editStage === "student" ? undefined : toIso(editNextContactAt), comment: editComment, isLost: editLost, lostReason: editLost ? editLostReason : "" });
      await refresh(); setSuccess("Карточка лида обновлена.");
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Не удалось обновить лид."); }
    finally { setSaving(false); }
  }

  async function addTask() {
    if (!selected || !taskTitle.trim() || !taskDueAt) return setError("Укажите задачу и срок.");
    setSaving(true); setError("");
    try { await createCrmTask(selected.id, taskTitle, toIso(taskDueAt)); await refresh(); setTaskTitle(""); setTaskDueAt(localDateTime()); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Не удалось добавить задачу."); }
    finally { setSaving(false); }
  }

  async function doneTask(id: string) {
    setSaving(true); setError("");
    try { await completeCrmTask(id); await refresh(); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Не удалось закрыть задачу."); }
    finally { setSaving(false); }
  }

  async function convertStudent() {
    if (!selected) return;
    if (!studentFirstName.trim() || !studentLastName.trim()) return setError("Укажите имя и фамилию ребёнка.");
    setSaving(true); setError(""); setSuccess("");
    try {
      const result = await convertCrmLeadToStudent({
        leadId: selected.id,
        firstName: studentFirstName,
        lastName: studentLastName,
        groupName: studentGroup,
        birthDate: studentBirthDate,
        lessonDay: studentLessonDay,
        lessonTime: studentLessonTime,
      });
      await refresh();
      setSuccess(result.alreadyConverted ? "Ученик уже был оформлен ранее." : "Ученик оформлен. Родитель, семья, источник и CRM-связь сохранены автоматически.");
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Не удалось оформить ученика."); }
    finally { setSaving(false); }
  }

  if (!open) return null;
  const marketingTotals = marketingRows.reduce((a, r) => ({ leads:a.leads+r.leads, trials:a.trials+r.trials, paid:a.paid+r.paid, students:a.students+r.students, lost:a.lost+r.lost }), {leads:0,trials:0,paid:0,students:0,lost:0});
  const globalRole = role !== "admin";

  return <div className="fixed inset-0 z-[82] overflow-y-auto bg-[#F7F5EF]">
    <div className="mx-auto max-w-5xl px-4 pb-24 pt-[calc(env(safe-area-inset-top,0px)+1rem)] sm:px-6">
      <header className="sticky top-0 z-10 -mx-4 flex items-start justify-between border-b border-black/[0.05] bg-[#F7F5EF]/95 px-4 py-4 backdrop-blur sm:-mx-6 sm:px-6">
        <div><p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#D96A24]">OPEN STARS · CRM</p><h1 className="mt-1 text-3xl font-semibold tracking-[-0.04em]">{role === "marketer" ? "Маркетинг" : "Лиды и продажи"}</h1></div>
        <button onClick={() => setOpen(false)} className="grid h-12 w-12 place-items-center rounded-full bg-white shadow-sm"><X size={22}/></button>
      </header>

      {loading && <div className="mt-6 flex items-center gap-2 rounded-[20px] bg-white p-4 text-sm text-black/45"><LoaderCircle className="animate-spin" size={17}/>Загружаю CRM…</div>}
      {error && <div className="mt-4 flex gap-2 rounded-[18px] border border-red-200 bg-red-50 p-4 text-sm text-red-700"><AlertCircle size={18}/>{error}</div>}
      {success && <div className="mt-4 rounded-[18px] bg-[#5F6338]/10 p-4 text-sm text-[#4D512E]">{success}</div>}

      {globalRole && <section className="mt-4 rounded-[20px] bg-white p-4"><label className="text-xs font-semibold text-black/50">Филиал<select className={inputClass} value={branchFilter} onChange={e=>void changeBranch(e.target.value)}><option value="">Все филиалы</option>{branches.map(branch=><option key={branch} value={branch}>{branch}</option>)}</select></label></section>}

      {role === "marketer" ? <>
        <section className="mt-5 rounded-[22px] bg-white p-4"><div className="grid gap-3 sm:grid-cols-3"><label className="text-xs font-semibold text-black/50">С даты<input type="date" className={inputClass} value={marketingFrom} onChange={e=>setMarketingFrom(e.target.value)}/></label><label className="text-xs font-semibold text-black/50">По дату<input type="date" className={inputClass} value={marketingTo} onChange={e=>setMarketingTo(e.target.value)}/></label><button onClick={()=>void refresh()} className="mt-auto rounded-[15px] bg-[#171717] py-3 text-sm font-semibold text-white">Обновить</button></div></section>
        <section className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-5">{[["Лиды",marketingTotals.leads],["Пробные",marketingTotals.trials],["Оплатили",marketingTotals.paid],["Ученики",marketingTotals.students],["Потеряно",marketingTotals.lost]].map(([label,value])=><div key={String(label)} className="rounded-[20px] bg-white p-4"><p className="text-xs text-black/40">{label}</p><p className="mt-2 text-3xl font-semibold">{value}</p></div>)}</section>
        <section className="mt-4 rounded-[22px] bg-white p-4"><h2 className="font-semibold">Источники</h2><div className="mt-3 space-y-2">{marketingRows.map(row=><div key={`${row.branch}-${row.source}`} className="flex justify-between rounded-[14px] bg-[#F7F5EF] p-3"><div><b>{row.source}</b><p className="text-xs text-black/40">{row.branch}</p></div><p className="text-right text-xs">{row.leads} лидов · {row.trials} пробных ({percent(row.trials,row.leads)}%)<br/>{row.students} учеников ({percent(row.students,row.leads)}%)</p></div>)}</div><p className="mt-4 text-xs leading-5 text-black/35">Телефоны родителей, детские карточки, ДДС и зарплаты маркетологу не показываются.</p></section>
      </> : <>
        <section className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4"><button onClick={()=>setFilter("all")} className="rounded-[20px] bg-[#171717] p-4 text-left text-white"><p className="text-xs text-white/50">Активные</p><p className="mt-2 text-3xl font-semibold">{leads.filter(l=>!l.isLost).length}</p></button><button onClick={()=>setFilter("overdue")} className="rounded-[20px] bg-[#FFF2E8] p-4 text-left"><p className="text-xs text-[#C95320]">Просрочено</p><p className="mt-2 text-3xl font-semibold text-[#C95320]">{overdueCount}</p></button><button onClick={()=>setFilter("trial_booked")} className="rounded-[20px] bg-white p-4 text-left"><p className="text-xs text-black/40">На пробное</p><p className="mt-2 text-3xl font-semibold">{leads.filter(l=>!l.isLost&&l.stage==="trial_booked").length}</p></button><button onClick={()=>setFilter("lost")} className="rounded-[20px] bg-white p-4 text-left"><p className="text-xs text-black/40">Потерянные</p><p className="mt-2 text-3xl font-semibold">{leads.filter(l=>l.isLost).length}</p></button></section>

        <button onClick={()=>setShowCreate(v=>!v)} className="mt-4 flex w-full items-center justify-center gap-2 rounded-[16px] bg-[#D96A24] py-3.5 text-sm font-semibold text-white"><UserRoundPlus size={18}/>Новый лид</button>
        {showCreate && <section className="mt-4 rounded-[22px] bg-white p-4"><div className="grid gap-3 sm:grid-cols-2"><label className="text-xs font-semibold text-black/50">Ребёнок<input className={inputClass} value={childName} onChange={e=>setChildName(e.target.value)} placeholder="Имя Фамилия"/></label><label className="text-xs font-semibold text-black/50">Дата рождения<input type="date" className={inputClass} value={childBirthDate} onChange={e=>setChildBirthDate(e.target.value)}/></label><label className="text-xs font-semibold text-black/50">Родитель<input className={inputClass} value={parentName} onChange={e=>setParentName(e.target.value)}/></label><label className="text-xs font-semibold text-black/50">Телефон<input inputMode="tel" className={inputClass} value={parentPhone} onChange={e=>setParentPhone(e.target.value)}/></label><label className="text-xs font-semibold text-black/50">Филиал<select disabled={role==="admin"} className={inputClass} value={role==="admin"?staffBranch:newBranch} onChange={e=>setNewBranch(e.target.value)}>{branches.map(branch=><option key={branch}>{branch}</option>)}</select></label><label className="text-xs font-semibold text-black/50">Источник<select className={inputClass} value={source} onChange={e=>setSource(e.target.value)}>{sources.map(item=><option key={item}>{item}</option>)}</select></label>{source==="Другое"&&<label className="text-xs font-semibold text-black/50">Уточнение<input className={inputClass} value={sourceNote} onChange={e=>setSourceNote(e.target.value)}/></label>}<label className="text-xs font-semibold text-black/50">Кампания / реклама<input className={inputClass} value={campaign} onChange={e=>setCampaign(e.target.value)} placeholder="необязательно"/></label><label className="text-xs font-semibold text-black/50">Пробное<input type="datetime-local" className={inputClass} value={trialAt} onChange={e=>setTrialAt(e.target.value)}/></label><label className="text-xs font-semibold text-black/50">Следующий контакт *<input type="datetime-local" className={inputClass} value={nextContactAt} onChange={e=>setNextContactAt(e.target.value)}/></label><label className="text-xs font-semibold text-black/50 sm:col-span-2">Комментарий<textarea className={`${inputClass} min-h-20`} value={createComment} onChange={e=>setCreateComment(e.target.value)}/></label></div><button disabled={saving} onClick={()=>void saveNewLead()} className="mt-4 flex w-full items-center justify-center gap-2 rounded-[15px] bg-[#171717] py-3 text-sm font-semibold text-white disabled:opacity-50">{saving?<LoaderCircle className="animate-spin" size={16}/>:<CirclePlus size={16}/>}Добавить лид</button></section>}

        <section className="mt-4 rounded-[22px] bg-white p-4"><div className="flex items-center gap-2 rounded-[15px] bg-[#F7F5EF] px-4"><Search size={17} className="text-black/30"/><input className="w-full bg-transparent py-3 outline-none" value={query} onChange={e=>setQuery(e.target.value)} placeholder="Имя, телефон, источник"/></div><div className="mt-3 flex gap-2 overflow-x-auto pb-1">{(["all",...stages,"overdue","lost"] as const).map(item=><button key={item} onClick={()=>setFilter(item)} className={`whitespace-nowrap rounded-full px-3 py-2 text-xs font-semibold ${filter===item?"bg-[#171717] text-white":"bg-[#F7F5EF] text-black/50"}`}>{item==="all"?"Все":item==="overdue"?"Просрочено":item==="lost"?"Потерянные":stageLabels[item]}</button>)}</div><div className="mt-3 space-y-2">{visible.map(lead=><button key={lead.id} onClick={()=>openLead(lead)} className="flex w-full items-center gap-3 rounded-[16px] border border-black/[0.05] p-3 text-left"><div className="min-w-0 flex-1"><p className="truncate font-semibold">{lead.childName}</p><p className="truncate text-xs text-black/40">{lead.parentName} · {lead.parentPhone}</p><p className="mt-1 text-xs font-medium text-[#5F6338]">{lead.isLost?lostLabels[lead.lostReason as CrmLostReason]:stageLabels[lead.stage]} · {lead.branch}</p></div><ChevronRight size={18} className="text-black/25"/></button>)}{visible.length===0&&<p className="py-10 text-center text-sm text-black/35">Лидов по этому фильтру пока нет.</p>}</div></section>
      </>}
    </div>

    {selected && role !== "marketer" && <div className="fixed inset-0 z-[84] overflow-y-auto bg-black/20 p-3 backdrop-blur-sm"><div className="mx-auto max-w-xl rounded-[26px] bg-[#FAF9F5] p-5"><div className="flex justify-between"><div><p className="text-xs font-bold uppercase tracking-[0.16em] text-[#D96A24]">Карточка лида</p><h2 className="mt-1 text-2xl font-semibold">{selected.childName}</h2><p className="text-sm text-black/40">{selected.parentName} · {selected.parentPhone}</p><p className="mt-1 text-xs text-black/35">{selected.source}{selected.campaign?` · ${selected.campaign}`:""} · {selected.branch}</p></div><button onClick={()=>setSelectedId("")} className="grid h-11 w-11 place-items-center rounded-full bg-white"><X size={20}/></button></div><div className="mt-4 grid gap-3 sm:grid-cols-2"><label className="text-xs font-semibold text-black/50">Этап<select className={inputClass} value={editStage} onChange={e=>setEditStage(e.target.value as CrmStage)}>{stages.map(stage=><option key={stage} value={stage}>{stageLabels[stage]}</option>)}</select></label><label className="text-xs font-semibold text-black/50">Пробное<input type="datetime-local" className={inputClass} value={editTrialAt} onChange={e=>setEditTrialAt(e.target.value)}/></label><label className="text-xs font-semibold text-black/50 sm:col-span-2">Следующий контакт<input type="datetime-local" className={inputClass} value={editNextContactAt} onChange={e=>setEditNextContactAt(e.target.value)}/></label><label className="text-xs font-semibold text-black/50 sm:col-span-2">Комментарий<textarea className={`${inputClass} min-h-20`} value={editComment} onChange={e=>setEditComment(e.target.value)}/></label></div><label className="mt-3 flex items-center gap-3 rounded-[14px] bg-white p-3 text-sm font-semibold"><input type="checkbox" className="h-5 w-5" checked={editLost} onChange={e=>setEditLost(e.target.checked)}/>Потерянный лид — не удалять</label>{editLost&&<label className="mt-3 block text-xs font-semibold text-black/50">Причина<select className={inputClass} value={editLostReason} onChange={e=>setEditLostReason(e.target.value as CrmLostReason)}>{Object.entries(lostLabels).map(([key,label])=><option key={key} value={key}>{label}</option>)}</select></label>}<button disabled={saving} onClick={()=>void saveLead()} className="mt-4 flex w-full items-center justify-center gap-2 rounded-[15px] bg-[#D96A24] py-3 text-sm font-semibold text-white disabled:opacity-50"><Check size={16}/>Сохранить карточку</button>

      <section className="mt-4 rounded-[18px] bg-white p-4"><div className="flex items-center gap-2"><CalendarClock size={17} className="text-[#5F6338]"/><h3 className="font-semibold">Задачи</h3></div><div className="mt-3 space-y-2">{selectedTasks.map(task=><div key={task.id} className="flex gap-3 rounded-[13px] bg-[#F7F5EF] p-3"><button onClick={()=>void doneTask(task.id)} className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-white text-[#5F6338]"><Check size={14}/></button><div><p className="text-sm font-medium">{task.title}</p><p className="text-xs text-black/40">{shortDate(task.dueAt)}</p></div></div>)}{selectedTasks.length===0&&<p className="text-xs text-black/35">Открытых задач нет.</p>}</div><input className={inputClass} value={taskTitle} onChange={e=>setTaskTitle(e.target.value)} placeholder="Новая задача"/><input type="datetime-local" className={inputClass} value={taskDueAt} onChange={e=>setTaskDueAt(e.target.value)}/><button onClick={()=>void addTask()} className="mt-2 w-full rounded-[13px] bg-[#5F6338] py-3 text-sm font-semibold text-white">Добавить задачу</button></section>

      {selected.convertedChildId ? <div className="mt-4 rounded-[16px] bg-[#5F6338]/10 p-4"><p className="font-semibold text-[#4D512E]">Ученик уже оформлен</p><p className="mt-1 text-xs text-black/45">CRM-лид связан с карточкой ребёнка.</p></div> : selected.stage === "paid" ? <section className="mt-4 rounded-[18px] border border-[#D96A24]/20 bg-[#FFF2E8] p-4"><p className="font-semibold">Оформить ученика</p><p className="mt-1 text-xs leading-5 text-black/45">Данные родителя и телефона повторно вводить не нужно. Проверьте данные ребёнка и группу.</p><div className="mt-3 grid gap-3 sm:grid-cols-2"><label className="text-xs font-semibold text-black/50">Имя<input className={inputClass} value={studentFirstName} onChange={e=>setStudentFirstName(e.target.value)}/></label><label className="text-xs font-semibold text-black/50">Фамилия<input className={inputClass} value={studentLastName} onChange={e=>setStudentLastName(e.target.value)}/></label><label className="text-xs font-semibold text-black/50">Дата рождения<input type="date" className={inputClass} value={studentBirthDate} onChange={e=>setStudentBirthDate(e.target.value)}/></label><label className="text-xs font-semibold text-black/50">Группа<select className={inputClass} value={studentGroup} onChange={e=>setStudentGroup(e.target.value as (typeof groups)[number])}>{groups.map(group=><option key={group}>{group}</option>)}</select></label><label className="text-xs font-semibold text-black/50">День занятий<input className={inputClass} value={studentLessonDay} onChange={e=>setStudentLessonDay(e.target.value)} placeholder="необязательно"/></label><label className="text-xs font-semibold text-black/50">Время<input type="time" className={inputClass} value={studentLessonTime} onChange={e=>setStudentLessonTime(e.target.value)}/></label></div><button disabled={saving} onClick={()=>void convertStudent()} className="mt-4 flex w-full items-center justify-center gap-2 rounded-[15px] bg-[#171717] py-3 text-sm font-semibold text-white disabled:opacity-50">{saving?<LoaderCircle className="animate-spin" size={16}/>:<UserRoundPlus size={16}/>}Оформить ученика</button></section> : editStage === "paid" ? <div className="mt-4 rounded-[16px] bg-[#FFF2E8] p-4"><p className="font-semibold">Сначала сохраните этап «Оплатил»</p><p className="mt-1 text-xs leading-5 text-black/45">После сохранения здесь появится кнопка «Оформить ученика».</p></div> : null}
    </div></div>}
  </div>;
}
