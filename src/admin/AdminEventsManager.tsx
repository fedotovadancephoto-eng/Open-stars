import { useEffect, useMemo, useState } from "react";
import {
  CalendarDays,
  CheckCircle2,
  CirclePlus,
  CreditCard,
  Edit3,
  LoaderCircle,
  RefreshCw,
  RotateCcw,
  Search,
  Users,
  WalletCards,
  X,
} from "lucide-react";

import { AdminChild, fetchAdminChildren, fetchStaffIdentity, StaffRole } from "@/admin/adminApi";
import { onAdminSection } from "@/admin/adminNavigation";
import {
  addEventExpense,
  confirmEventPayment,
  createEvent,
  EventBranch,
  EventExpenseCategory,
  EventFinancialSummary,
  EventParticipant,
  EventPayment,
  EventPaymentMethod,
  EventStatus,
  fetchEventBranches,
  fetchOwnerEventExpenses,
  fetchOwnerEventSummary,
  fetchStaffEventParticipants,
  fetchStaffEventPayments,
  fetchStaffEvents,
  refundEventPayment,
  SchoolEvent,
  setEventParticipantFee,
  updateEvent,
} from "@/eventsApi";

const inputClass = "mt-1.5 w-full rounded-[13px] border border-black/[0.08] bg-white px-3.5 py-3 text-sm outline-none focus:border-[#D96A24]/45";
const paymentMethods: Array<[EventPaymentMethod, string]> = [["cash", "Наличные"], ["bank_transfer", "Перевод"], ["online", "Онлайн / карта"], ["other", "Другое"]];
const expenseCategories: Array<[EventExpenseCategory, string]> = [["venue", "Аренда / площадка"], ["materials", "Материалы"], ["transport", "Транспорт"], ["catering", "Питание"], ["contractors", "Подрядчики"], ["other", "Другое"]];
const statusLabels: Record<EventStatus, string> = { planned: "Планируется", open: "Открыта запись", closed: "Запись закрыта", completed: "Завершено", cancelled: "Отменено" };

function localDateTime(hours = 24) { const date = new Date(Date.now() + hours * 3600000); date.setMinutes(date.getMinutes() - date.getTimezoneOffset()); return date.toISOString().slice(0, 16); }
function fromIso(value: string) { if (!value) return ""; const date = new Date(value); if (Number.isNaN(date.getTime())) return ""; date.setMinutes(date.getMinutes() - date.getTimezoneOffset()); return date.toISOString().slice(0, 16); }
function today() { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; }
function money(value: number) { return new Intl.NumberFormat("ru-RU", { style: "currency", currency: "RUB", maximumFractionDigits: 0 }).format(value || 0); }
function dateTime(value: string) { if (!value) return ""; return new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(value)).replace(".", ""); }
function toIso(value: string) { return value ? new Date(value).toISOString() : ""; }
function parseAmount(value: string) { return Number(value.replace(/\s/g, "").replace(",", ".")); }

export function AdminEventsManager() {
  const [open, setOpen] = useState(false);
  const [role, setRole] = useState<StaffRole | null>(null);
  const [events, setEvents] = useState<SchoolEvent[]>([]);
  const [branches, setBranches] = useState<EventBranch[]>([]);
  const [children, setChildren] = useState<AdminChild[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [participants, setParticipants] = useState<EventParticipant[]>([]);
  const [payments, setPayments] = useState<EventPayment[]>([]);
  const [summary, setSummary] = useState<EventFinancialSummary | null>(null);
  const [allSummaries, setAllSummaries] = useState<EventFinancialSummary[]>([]);
  const [expenseRows, setExpenseRows] = useState<Array<{ id: string; amount: number; expenseDate: string; category: EventExpenseCategory; description: string }>>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [query, setQuery] = useState("");

  const [showCreate, setShowCreate] = useState(false);
  const [title, setTitle] = useState("");
  const [startsAt, setStartsAt] = useState(localDateTime());
  const [location, setLocation] = useState("");
  const [branchId, setBranchId] = useState("");
  const [defaultFee, setDefaultFee] = useState("");
  const [description, setDescription] = useState("");

  const [showEdit, setShowEdit] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editStartsAt, setEditStartsAt] = useState("");
  const [editLocation, setEditLocation] = useState("");
  const [editBranchId, setEditBranchId] = useState("");
  const [editDefaultFee, setEditDefaultFee] = useState("");
  const [editDescription, setEditDescription] = useState("");

  const [payParticipantId, setPayParticipantId] = useState("");
  const [payAmount, setPayAmount] = useState("");
  const [payFee, setPayFee] = useState("");
  const [payMethod, setPayMethod] = useState<EventPaymentMethod>("cash");
  const [payDate, setPayDate] = useState(today());
  const [payNote, setPayNote] = useState("");

  const [expenseCategory, setExpenseCategory] = useState<EventExpenseCategory>("venue");
  const [expenseAmount, setExpenseAmount] = useState("");
  const [expenseDate, setExpenseDate] = useState(today());
  const [expenseDescription, setExpenseDescription] = useState("");

  const isOwner = role === "owner";
  const selected = useMemo(() => events.find((event) => event.id === selectedId) || null, [events, selectedId]);
  const childMap = useMemo(() => new Map(children.map((child) => [child.id, child])), [children]);
  const activePayments = useMemo(() => payments.filter((payment) => !payment.voidedAt && !payment.refundedAt), [payments]);
  const paymentTotals = useMemo(() => {
    const totals = new Map<string, number>();
    activePayments.forEach((payment) => totals.set(payment.participantId, (totals.get(payment.participantId) || 0) + payment.amount));
    return totals;
  }, [activePayments]);
  const selectedParticipantPayments = useMemo(() => payments.filter((payment) => payment.participantId === payParticipantId && !payment.voidedAt), [payments, payParticipantId]);
  const filteredParticipants = useMemo(() => {
    const text = query.trim().toLowerCase();
    return participants.filter((participant) => {
      const child = childMap.get(participant.childId);
      return !text || [child?.fullName, child?.parentName, child?.parentPhone].join(" ").toLowerCase().includes(text);
    });
  }, [participants, childMap, query]);
  const participantStats = useMemo(() => ({
    participating: participants.filter((row) => row.status === "participating").length,
    declined: participants.filter((row) => row.status === "declined").length,
    paid: participants.filter((row) => (paymentTotals.get(row.id) || 0) > 0).length,
  }), [participants, paymentTotals]);
  const overview = useMemo(() => allSummaries.reduce((acc, row) => ({
    revenue: acc.revenue + Number(row.revenue || 0), expenses: acc.expenses + Number(row.expenses || 0), profit: acc.profit + Number(row.profit || 0), participants: acc.participants + Number(row.participants || 0),
  }), { revenue: 0, expenses: 0, profit: 0, participants: 0 }), [allSummaries]);

  async function loadOwnerOverview(eventRows: SchoolEvent[], owner: boolean) {
    if (!owner || eventRows.length === 0) { setAllSummaries([]); return; }
    const rows = await Promise.all(eventRows.map(async (event) => { try { return await fetchOwnerEventSummary(event.id); } catch { return null; } }));
    setAllSummaries(rows.filter((row): row is EventFinancialSummary => Boolean(row)));
  }

  async function loadBase() {
    const identity = await fetchStaffIdentity();
    if (identity.role === "teacher") throw new Error("Мероприятия недоступны педагогу в административном режиме.");
    setRole(identity.role);
    const [eventRows, branchRows, childRows] = await Promise.all([fetchStaffEvents(), fetchEventBranches(), fetchAdminChildren(identity.role)]);
    setEvents(eventRows); setBranches(branchRows); setChildren(childRows.filter((child) => !child.archivedAt));
    await loadOwnerOverview(eventRows, identity.role === "owner");
    if (!selectedId && eventRows.length) setSelectedId(eventRows[0].id);
    return { eventRows, identity };
  }

  async function loadEvent(eventId: string, owner = isOwner) {
    if (!eventId) { setParticipants([]); setPayments([]); setSummary(null); setExpenseRows([]); return; }
    const [participantRows, paymentRows] = await Promise.all([fetchStaffEventParticipants(eventId), fetchStaffEventPayments(eventId)]);
    setParticipants(participantRows); setPayments(paymentRows);
    if (owner) {
      const [nextSummary, nextExpenses] = await Promise.all([fetchOwnerEventSummary(eventId), fetchOwnerEventExpenses(eventId)]);
      setSummary(nextSummary);
      setExpenseRows(nextExpenses.map((row) => ({ id: row.id, amount: row.amount, expenseDate: row.expenseDate, category: row.category, description: row.description })));
    } else { setSummary(null); setExpenseRows([]); }
  }

  async function refresh() {
    setLoading(true); setError("");
    try {
      const { eventRows, identity } = await loadBase();
      const id = selectedId && eventRows.some((event) => event.id === selectedId) ? selectedId : eventRows[0]?.id || "";
      setSelectedId(id); await loadEvent(id, identity.role === "owner");
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Не удалось загрузить мероприятия."); }
    finally { setLoading(false); }
  }

  useEffect(() => onAdminSection("events", () => { setOpen(true); setSuccess(""); void refresh(); }), [selectedId]);

  async function selectEvent(id: string) {
    setSelectedId(id); setLoading(true); setError(""); setSuccess(""); setShowEdit(false); setPayParticipantId("");
    try { await loadEvent(id); } catch (reason) { setError(reason instanceof Error ? reason.message : "Не удалось открыть мероприятие."); }
    finally { setLoading(false); }
  }

  async function saveEvent() {
    const fee = defaultFee.trim() ? parseAmount(defaultFee) : null;
    if (!title.trim()) return setError("Укажите название мероприятия.");
    if (!startsAt) return setError("Укажите дату и время.");
    if (fee !== null && (!Number.isFinite(fee) || fee < 0)) return setError("Проверьте стоимость участия.");
    setSaving(true); setError("");
    try {
      const id = await createEvent({ title, description, startsAt: toIso(startsAt), location, branchId, defaultFee: fee, status: "open" });
      setTitle(""); setDescription(""); setLocation(""); setBranchId(""); setDefaultFee(""); setStartsAt(localDateTime()); setShowCreate(false);
      await loadBase(); setSelectedId(id); await loadEvent(id, true); setSuccess("Мероприятие создано и открыто для записи родителей.");
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Не удалось создать мероприятие."); }
    finally { setSaving(false); }
  }

  function beginEdit() {
    if (!selected) return;
    setEditTitle(selected.title); setEditStartsAt(fromIso(selected.startsAt)); setEditLocation(selected.location || ""); setEditBranchId(selected.branchId || ""); setEditDefaultFee(selected.defaultFee == null ? "" : String(selected.defaultFee)); setEditDescription(selected.description || ""); setShowEdit(true);
  }

  async function saveEdit() {
    if (!selected) return;
    const fee = editDefaultFee.trim() ? parseAmount(editDefaultFee) : null;
    if (!editTitle.trim()) return setError("Укажите название мероприятия.");
    if (!editStartsAt) return setError("Укажите дату и время.");
    if (fee !== null && (!Number.isFinite(fee) || fee < 0)) return setError("Проверьте стоимость участия.");
    setSaving(true); setError(""); setSuccess("");
    try {
      await updateEvent(selected.id, { title: editTitle, description: editDescription, startsAt: toIso(editStartsAt), endsAt: selected.endsAt || undefined, location: editLocation, branchId: editBranchId, defaultFee: fee, status: selected.status });
      setShowEdit(false); await refresh(); setSuccess("Изменения мероприятия сохранены.");
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Не удалось сохранить изменения."); }
    finally { setSaving(false); }
  }

  async function changeStatus(status: EventStatus) {
    if (!selected || selected.status === status) return;
    setSaving(true); setError(""); setSuccess("");
    try {
      await updateEvent(selected.id, { title: selected.title, description: selected.description, startsAt: selected.startsAt, endsAt: selected.endsAt || undefined, location: selected.location, branchId: selected.branchId, defaultFee: selected.defaultFee, status });
      await refresh();
      setSuccess(status === "open" ? "Запись на мероприятие открыта." : status === "closed" ? "Запись на мероприятие закрыта." : status === "completed" ? "Мероприятие отмечено завершённым." : status === "cancelled" ? "Мероприятие отменено." : "Статус мероприятия изменён.");
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Не удалось изменить статус."); }
    finally { setSaving(false); }
  }

  function chooseParticipant(participant: EventParticipant) {
    if (participant.status === "declined") return;
    const paid = paymentTotals.get(participant.id) || 0;
    const fee = participant.feeAmount ?? selected?.defaultFee;
    setPayParticipantId(participant.id); setPayFee(fee == null ? "" : String(fee)); setPayAmount(fee != null ? String(Math.max(0, fee - paid)) : "");
  }

  async function savePayment() {
    const participant = participants.find((row) => row.id === payParticipantId);
    const amount = parseAmount(payAmount); const fee = payFee.trim() ? parseAmount(payFee) : null;
    if (!participant) return setError("Выберите участника.");
    if (participant.status === "declined") return setError("Участник отказался. Сначала нужно подтвердить участие.");
    if (!Number.isFinite(amount) || amount <= 0) return setError("Введите сумму оплаты.");
    if (fee !== null && (!Number.isFinite(fee) || fee < 0)) return setError("Проверьте стоимость для ребёнка.");
    setSaving(true); setError(""); setSuccess("");
    try {
      if (fee !== null && fee !== participant.feeAmount) await setEventParticipantFee(participant.id, fee);
      await confirmEventPayment({ participantId: participant.id, amount, paymentMethod: payMethod, receivedAt: new Date(`${payDate}T12:00:00`).toISOString(), note: payNote });
      setPayAmount(""); setPayFee(""); setPayNote(""); setPayParticipantId(""); await loadEvent(selectedId); if (isOwner) await loadOwnerOverview(events, true); setSuccess("Оплата мероприятия сохранена и попала в ДДС мероприятий.");
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Не удалось сохранить оплату."); }
    finally { setSaving(false); }
  }

  async function refundPayment(payment: EventPayment) {
    if (!isOwner || payment.refundedAt) return;
    const reason = window.prompt(`Причина возврата ${money(payment.amount)}`, "Отмена участия / мероприятия");
    if (reason === null) return;
    if (!reason.trim()) return setError("Укажите причину возврата.");
    if (!window.confirm(`Оформить полный возврат ${money(payment.amount)}? В общем ДДС появится расход «Возврат мероприятия».`)) return;
    setSaving(true); setError(""); setSuccess("");
    try {
      await refundEventPayment(payment.id, reason.trim());
      await loadEvent(selectedId, true); await loadOwnerOverview(events, true);
      setSuccess(`Возврат ${money(payment.amount)} оформлен и отражён в общем ДДС.`);
    } catch (reasonValue) { setError(reasonValue instanceof Error ? reasonValue.message : "Не удалось оформить возврат."); }
    finally { setSaving(false); }
  }

  async function saveExpense() {
    const amount = parseAmount(expenseAmount);
    if (!selectedId) return;
    if (!Number.isFinite(amount) || amount <= 0) return setError("Введите сумму расхода.");
    setSaving(true); setError(""); setSuccess("");
    try {
      await addEventExpense({ eventId: selectedId, category: expenseCategory, amount, expenseDate, description: expenseDescription });
      setExpenseAmount(""); setExpenseDescription(""); await loadEvent(selectedId, true); await loadOwnerOverview(events, true); setSuccess("Расход мероприятия сохранён.");
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Не удалось сохранить расход."); }
    finally { setSaving(false); }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[86] flex items-end justify-center bg-black/30 backdrop-blur-[2px] sm:items-center sm:p-5" onClick={() => !saving && setOpen(false)}>
      <div className="max-h-[96vh] w-full max-w-7xl overflow-y-auto rounded-t-[30px] bg-[#FAF9F5] p-5 shadow-2xl sm:rounded-[30px] sm:p-7" onClick={(event) => event.stopPropagation()}>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div><p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#D96A24]">OPEN STARS · МЕРОПРИЯТИЯ</p><h2 className="mt-1 text-2xl font-semibold">{isOwner ? "Управление мероприятиями" : "Мероприятия филиала"}</h2><p className="mt-2 text-sm text-black/45">Оплаты мероприятий ведутся отдельно от обучения. Расходы, возвраты и прибыль контролирует руководитель.</p></div>
          <div className="flex gap-2">{isOwner && <button type="button" onClick={() => setShowCreate((value) => !value)} className="flex h-10 items-center gap-2 rounded-full bg-[#D96A24] px-4 text-sm font-semibold text-white"><CirclePlus size={17}/> Новое</button>}<button type="button" onClick={() => void refresh()} className="grid h-10 w-10 place-items-center rounded-full bg-white"><RefreshCw size={18} className={loading ? "animate-spin" : ""}/></button><button type="button" onClick={() => setOpen(false)} className="grid h-10 w-10 place-items-center rounded-full bg-white"><X size={20}/></button></div>
        </div>

        {isOwner && allSummaries.length > 0 && <section className="mt-5 grid gap-2 sm:grid-cols-4"><div className="rounded-[18px] bg-white p-4"><p className="text-[10px] font-bold uppercase tracking-[0.12em] text-black/35">Выручка мероприятий</p><strong className="mt-1 block text-xl text-[#4D512E]">{money(overview.revenue)}</strong></div><div className="rounded-[18px] bg-white p-4"><p className="text-[10px] font-bold uppercase tracking-[0.12em] text-black/35">Расходы мероприятий</p><strong className="mt-1 block text-xl text-[#C95320]">{money(overview.expenses)}</strong></div><div className="rounded-[18px] bg-[#171717] p-4 text-white"><p className="text-[10px] font-bold uppercase tracking-[0.12em] text-white/45">Прибыль мероприятий</p><strong className="mt-1 block text-xl">{money(overview.profit)}</strong></div><div className="rounded-[18px] bg-white p-4"><p className="text-[10px] font-bold uppercase tracking-[0.12em] text-black/35">Участников</p><strong className="mt-1 block text-xl">{overview.participants}</strong></div></section>}

        {showCreate && isOwner && <section className="mt-5 rounded-[24px] border border-[#D96A24]/15 bg-white p-5"><h3 className="font-semibold">Новое мероприятие</h3><div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><label className="text-xs font-semibold text-black/55">Название<input className={inputClass} value={title} onChange={(e) => setTitle(e.target.value)}/></label><label className="text-xs font-semibold text-black/55">Дата и время<input type="datetime-local" className={inputClass} value={startsAt} onChange={(e) => setStartsAt(e.target.value)}/></label><label className="text-xs font-semibold text-black/55">Филиал<select className={inputClass} value={branchId} onChange={(e) => setBranchId(e.target.value)}><option value="">Все филиалы</option>{branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}</select></label><label className="text-xs font-semibold text-black/55">Базовая стоимость<input inputMode="decimal" className={inputClass} value={defaultFee} onChange={(e) => setDefaultFee(e.target.value)} placeholder="Можно оставить пустым"/></label></div><div className="mt-3 grid gap-3 sm:grid-cols-2"><label className="text-xs font-semibold text-black/55">Место<input className={inputClass} value={location} onChange={(e) => setLocation(e.target.value)}/></label><label className="text-xs font-semibold text-black/55">Описание<input className={inputClass} value={description} onChange={(e) => setDescription(e.target.value)}/></label></div><button type="button" disabled={saving} onClick={() => void saveEvent()} className="mt-4 rounded-[13px] bg-[#171717] px-5 py-3 text-sm font-semibold text-white disabled:opacity-50">Создать и открыть запись</button></section>}

        <div className="mt-6 grid gap-5 lg:grid-cols-[0.72fr_1.28fr]">
          <section className="rounded-[24px] border border-black/[0.06] bg-white p-4"><div className="flex items-center gap-2 px-1"><CalendarDays size={17} className="text-[#D96A24]"/><h3 className="font-semibold">Список мероприятий</h3></div><div className="mt-3 space-y-2">{events.length === 0 && <div className="rounded-[15px] bg-[#FAF9F5] p-6 text-center text-sm text-black/35">Мероприятий пока нет.</div>}{events.map((event) => <button key={event.id} type="button" onClick={() => void selectEvent(event.id)} className={`w-full rounded-[16px] border p-4 text-left transition ${selectedId === event.id ? "border-[#D96A24]/25 bg-[#D96A24]/[0.06]" : "border-black/[0.05] bg-[#FAF9F5]"}`}><div className="flex items-center justify-between gap-2"><strong className="text-sm">{event.title}</strong><span className="text-[10px] font-bold uppercase text-black/35">{statusLabels[event.status]}</span></div><p className="mt-1 text-xs text-black/40">{dateTime(event.startsAt)}{event.location ? ` · ${event.location}` : ""}</p></button>)}</div></section>

          <section className="rounded-[24px] border border-black/[0.06] bg-white p-5 sm:p-6">
            {!selected ? <div className="grid min-h-[260px] place-items-center text-sm text-black/35">Выберите мероприятие.</div> : <>
              <div className="flex flex-wrap items-start justify-between gap-3"><div><div className="flex flex-wrap items-center gap-2"><p className="text-[11px] font-bold uppercase tracking-[0.16em] text-black/35">Карточка мероприятия</p><span className="rounded-full bg-black/[0.045] px-2.5 py-1 text-[10px] font-bold text-black/45">{statusLabels[selected.status]}</span></div><h3 className="mt-1 text-xl font-semibold">{selected.title}</h3><p className="mt-1 text-sm text-black/40">{dateTime(selected.startsAt)}{selected.location ? ` · ${selected.location}` : ""}</p></div>{isOwner && summary && <div className="grid grid-cols-3 gap-2 text-center"><div className="rounded-[14px] bg-[#5F6338]/[0.07] px-3 py-2"><p className="text-[10px] text-black/35">Доход</p><strong className="text-sm text-[#4D512E]">{money(summary.revenue)}</strong></div><div className="rounded-[14px] bg-[#D96A24]/[0.07] px-3 py-2"><p className="text-[10px] text-black/35">Расход</p><strong className="text-sm text-[#C95320]">{money(summary.expenses)}</strong></div><div className="rounded-[14px] bg-[#171717] px-3 py-2 text-white"><p className="text-[10px] text-white/45">Прибыль</p><strong className="text-sm">{money(summary.profit)}</strong></div></div>}</div>

              {isOwner && <div className="mt-4 flex flex-wrap gap-2"><button type="button" onClick={beginEdit} className="flex items-center gap-2 rounded-[12px] bg-[#FAF9F5] px-3.5 py-2.5 text-xs font-semibold"><Edit3 size={14}/> Редактировать</button>{selected.status !== "open" && <button type="button" disabled={saving} onClick={() => void changeStatus("open")} className="rounded-[12px] bg-[#5F6338] px-3.5 py-2.5 text-xs font-semibold text-white disabled:opacity-50">Открыть запись</button>}{selected.status === "open" && <button type="button" disabled={saving} onClick={() => void changeStatus("closed")} className="rounded-[12px] bg-[#FAF9F5] px-3.5 py-2.5 text-xs font-semibold disabled:opacity-50">Закрыть запись</button>}{selected.status !== "completed" && selected.status !== "cancelled" && <button type="button" disabled={saving} onClick={() => void changeStatus("completed")} className="rounded-[12px] bg-[#171717] px-3.5 py-2.5 text-xs font-semibold text-white disabled:opacity-50">Завершить</button>}{selected.status !== "cancelled" && <button type="button" disabled={saving} onClick={() => void changeStatus("cancelled")} className="rounded-[12px] border border-red-200 bg-red-50 px-3.5 py-2.5 text-xs font-semibold text-red-700 disabled:opacity-50">Отменить</button>}</div>}

              {showEdit && isOwner && <div className="mt-4 rounded-[18px] border border-[#D96A24]/15 bg-[#D96A24]/[0.025] p-4"><div className="flex items-center justify-between"><h4 className="text-sm font-semibold">Редактирование мероприятия</h4><button type="button" onClick={() => setShowEdit(false)} className="grid h-8 w-8 place-items-center rounded-full bg-white"><X size={15}/></button></div><div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4"><label className="text-[11px] font-semibold text-black/50">Название<input className={inputClass} value={editTitle} onChange={(e) => setEditTitle(e.target.value)}/></label><label className="text-[11px] font-semibold text-black/50">Дата и время<input type="datetime-local" className={inputClass} value={editStartsAt} onChange={(e) => setEditStartsAt(e.target.value)}/></label><label className="text-[11px] font-semibold text-black/50">Филиал<select className={inputClass} value={editBranchId} onChange={(e) => setEditBranchId(e.target.value)}><option value="">Все филиалы</option>{branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}</select></label><label className="text-[11px] font-semibold text-black/50">Базовая стоимость<input className={inputClass} inputMode="decimal" value={editDefaultFee} onChange={(e) => setEditDefaultFee(e.target.value)}/></label></div><div className="mt-2 grid gap-2 sm:grid-cols-2"><label className="text-[11px] font-semibold text-black/50">Место<input className={inputClass} value={editLocation} onChange={(e) => setEditLocation(e.target.value)}/></label><label className="text-[11px] font-semibold text-black/50">Описание<input className={inputClass} value={editDescription} onChange={(e) => setEditDescription(e.target.value)}/></label></div><button type="button" disabled={saving} onClick={() => void saveEdit()} className="mt-3 rounded-[12px] bg-[#171717] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">Сохранить изменения</button></div>}

              <div className="mt-5 grid grid-cols-3 gap-2"><div className="rounded-[14px] bg-[#FAF9F5] px-3 py-2.5 text-center"><Users size={15} className="mx-auto text-[#5F6338]"/><p className="mt-1 text-[10px] text-black/35">Участвуют</p><strong className="text-sm">{participantStats.participating}</strong></div><div className="rounded-[14px] bg-[#FAF9F5] px-3 py-2.5 text-center"><CreditCard size={15} className="mx-auto text-[#D96A24]"/><p className="mt-1 text-[10px] text-black/35">Оплатили</p><strong className="text-sm">{participantStats.paid}</strong></div><div className="rounded-[14px] bg-[#FAF9F5] px-3 py-2.5 text-center"><X size={15} className="mx-auto text-black/35"/><p className="mt-1 text-[10px] text-black/35">Отказались</p><strong className="text-sm">{participantStats.declined}</strong></div></div>

              <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#5F6338]">Участники</p><p className="mt-1 text-sm text-black/45">У каждого ребёнка может быть своя стоимость и своя дата оплаты.</p></div><div className="relative w-full sm:max-w-xs"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-black/30"/><input className="w-full rounded-[12px] border border-black/[0.07] bg-[#FAF9F5] py-2.5 pl-9 pr-3 text-sm outline-none" placeholder="Ребёнок или родитель" value={query} onChange={(e) => setQuery(e.target.value)}/></div></div>

              <div className="mt-3 max-h-[320px] space-y-2 overflow-y-auto">{filteredParticipants.length === 0 && <div className="rounded-[15px] bg-[#FAF9F5] p-6 text-center text-sm text-black/35">Пока нет ответов родителей.</div>}{filteredParticipants.map((participant) => { const child = childMap.get(participant.childId); const paid = paymentTotals.get(participant.id) || 0; const declined = participant.status === "declined"; return <button key={participant.id} type="button" disabled={declined || selected.status === "cancelled"} onClick={() => chooseParticipant(participant)} className={`w-full rounded-[15px] border p-3 text-left ${declined ? "cursor-default border-black/[0.04] bg-black/[0.025] opacity-60" : payParticipantId === participant.id ? "border-[#D96A24]/25 bg-[#D96A24]/[0.05]" : "border-black/[0.05] bg-[#FAF9F5]"}`}><div className="flex items-center justify-between gap-3"><div><p className="text-sm font-semibold">{child?.fullName || "Ребёнок"}</p><p className="mt-0.5 text-xs text-black/40">{child?.parentName || "Родитель"} · {child?.groupName || ""}</p></div><div className="text-right"><p className={`text-xs font-semibold ${declined ? "text-black/40" : "text-[#4D512E]"}`}>{declined ? "Отказались" : paid > 0 ? `Оплачено ${money(paid)}` : "Не оплачено"}</p><p className="mt-0.5 text-[10px] text-black/35">Стоимость {participant.feeAmount == null ? "не задана" : money(participant.feeAmount)}</p></div></div></button>; })}</div>

              {payParticipantId && selected.status !== "cancelled" && <div className="mt-4 rounded-[18px] border border-[#5F6338]/12 bg-[#5F6338]/[0.04] p-4"><div className="flex items-center gap-2"><CreditCard size={16} className="text-[#4D512E]"/><h4 className="text-sm font-semibold">Оплаты выбранного участника</h4></div>{selectedParticipantPayments.length > 0 && <div className="mt-3 space-y-1.5">{selectedParticipantPayments.map((payment) => <div key={payment.id} className="flex flex-wrap items-center justify-between gap-2 rounded-[12px] bg-white px-3 py-2 text-xs"><div><strong>{money(payment.amount)}</strong><span className="ml-2 text-black/35">{dateTime(payment.receivedAt)}</span>{payment.refundedAt && <span className="ml-2 font-semibold text-blue-700">Возвращено</span>}</div>{isOwner && !payment.refundedAt && <button type="button" disabled={saving} onClick={() => void refundPayment(payment)} className="flex items-center gap-1.5 rounded-full bg-blue-50 px-3 py-1.5 font-semibold text-blue-700 disabled:opacity-50"><RotateCcw size={13}/> Возврат</button>}</div>)}</div>}<div className="mt-3 grid gap-2 sm:grid-cols-5"><label className="text-[11px] font-semibold text-black/50">Стоимость ребёнка<input className={inputClass} inputMode="decimal" value={payFee} onChange={(e) => setPayFee(e.target.value)}/></label><label className="text-[11px] font-semibold text-black/50">Поступило<input className={inputClass} inputMode="decimal" value={payAmount} onChange={(e) => setPayAmount(e.target.value)}/></label><label className="text-[11px] font-semibold text-black/50">Дата<input type="date" className={inputClass} value={payDate} onChange={(e) => setPayDate(e.target.value)}/></label><label className="text-[11px] font-semibold text-black/50">Способ<select className={inputClass} value={payMethod} onChange={(e) => setPayMethod(e.target.value as EventPaymentMethod)}>{paymentMethods.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><label className="text-[11px] font-semibold text-black/50">Комментарий<input className={inputClass} value={payNote} onChange={(e) => setPayNote(e.target.value)}/></label></div><button type="button" disabled={saving} onClick={() => void savePayment()} className="mt-3 flex items-center gap-2 rounded-[12px] bg-[#5F6338] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"><CheckCircle2 size={16}/> Сохранить оплату</button></div>}

              {isOwner && <div className="mt-5 rounded-[18px] border border-[#D96A24]/12 bg-[#D96A24]/[0.035] p-4"><div className="flex items-center gap-2"><WalletCards size={16} className="text-[#C95320]"/><h4 className="text-sm font-semibold">Расходы мероприятия · только руководитель</h4></div><div className="mt-3 grid gap-2 sm:grid-cols-4"><label className="text-[11px] font-semibold text-black/50">Статья<select className={inputClass} value={expenseCategory} onChange={(e) => setExpenseCategory(e.target.value as EventExpenseCategory)}>{expenseCategories.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><label className="text-[11px] font-semibold text-black/50">Сумма<input inputMode="decimal" className={inputClass} value={expenseAmount} onChange={(e) => setExpenseAmount(e.target.value)}/></label><label className="text-[11px] font-semibold text-black/50">Дата<input type="date" className={inputClass} value={expenseDate} onChange={(e) => setExpenseDate(e.target.value)}/></label><label className="text-[11px] font-semibold text-black/50">Комментарий<input className={inputClass} value={expenseDescription} onChange={(e) => setExpenseDescription(e.target.value)}/></label></div><button type="button" disabled={saving} onClick={() => void saveExpense()} className="mt-3 rounded-[12px] bg-[#D96A24] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">Добавить расход</button>{expenseRows.length > 0 && <div className="mt-3 space-y-1.5">{expenseRows.slice(0, 8).map((row) => <div key={row.id} className="flex items-center justify-between rounded-[12px] bg-white px-3 py-2 text-xs"><span>{row.expenseDate} · {expenseCategories.find(([value]) => value === row.category)?.[1] || row.category}{row.description ? ` · ${row.description}` : ""}</span><strong>{money(row.amount)}</strong></div>)}</div>}</div>}
            </>}
          </section>
        </div>

        {loading && <div className="mt-4 flex items-center gap-2 text-sm text-black/35"><LoaderCircle size={16} className="animate-spin"/> Обновляем данные…</div>}
        {error && <div className="mt-4 rounded-[14px] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
        {success && <div className="mt-4 rounded-[14px] border border-[#5F6338]/15 bg-[#5F6338]/[0.07] px-4 py-3 text-sm font-medium text-[#4D512E]">{success}</div>}
      </div>
    </div>
  );
}
