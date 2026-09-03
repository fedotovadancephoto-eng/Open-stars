import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Banknote,
  CheckCircle2,
  ChevronDown,
  Clock3,
  CreditCard,
  History,
  LoaderCircle,
  Pencil,
  RotateCcw,
  Search,
  UsersRound,
  WalletCards,
  X,
} from "lucide-react";

import { AdminPaymentLinkSettings } from "@/admin/AdminPaymentLinkSettings";
import {
  confirmPaymentReceipt,
  correctPaymentReceipt,
  fetchPaymentContext,
  fetchPaymentHistory,
  fetchPaymentOverview,
  fetchPaymentReceipts,
  PaymentHistory,
  PaymentMethod,
  PaymentOverview,
  PaymentOverviewState,
  PaymentOverviewStudent,
  PaymentReceipt,
  PaymentStatus,
  setPaymentStatus,
  voidPaymentReceipt,
} from "@/admin/paymentApi";

const inputClass = "mt-1.5 w-full rounded-[13px] border border-black/[0.08] bg-white px-3.5 py-3 text-sm text-[#171717] outline-none focus:border-[#D96A24]/45 focus:ring-4 focus:ring-[#D96A24]/[0.06]";
const labels: Record<string, string> = { paid: "Оплачено", pending: "Ожидает оплаты", overdue: "Просрочено", "": "Статус не указан" };
const methodLabels: Record<PaymentMethod, string> = { online: "Онлайн · Точка", cash: "Наличные", bank_transfer: "Перевод на счёт", other: "Другое" };
const overviewLabels: Record<PaymentOverviewState, string> = {
  paid: "Оплатил",
  needs_amount: "Нужно внести сумму",
  pending: "Ожидает оплаты",
  overdue: "Просрочено",
};

type OverviewFilter = "all" | "paid" | "unpaid" | "needs_amount" | "overdue";

function currentMonth() {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function monthLabel(value: string) {
  if (!value) return "";
  const date = new Date(`${value.slice(0, 7)}-01T12:00:00`);
  return new Intl.DateTimeFormat("ru-RU", { month: "long", year: "numeric" }).format(date);
}

function dateLabel(value: string) {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(date).replace(".", "");
}

function money(value: number) {
  return new Intl.NumberFormat("ru-RU", { style: "currency", currency: "RUB", maximumFractionDigits: 0 }).format(value || 0);
}

function stateStyle(state: PaymentOverviewState) {
  if (state === "paid") return "bg-[#5F6338]/10 text-[#4D512E]";
  if (state === "overdue") return "bg-red-50 text-red-600";
  if (state === "needs_amount") return "bg-amber-50 text-amber-700";
  return "bg-[#D96A24]/10 text-[#C95320]";
}

export function AdminPaymentManager() {
  const [enabled, setEnabled] = useState(false);
  const [open, setOpen] = useState(false);
  const [role, setRole] = useState("");
  const [staffBranch, setStaffBranch] = useState("");
  const [branchFilter, setBranchFilter] = useState("");
  const [availableBranches, setAvailableBranches] = useState<string[]>([]);
  const [overview, setOverview] = useState<PaymentOverview | null>(null);
  const [overviewFilter, setOverviewFilter] = useState<OverviewFilter>("all");
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState("");
  const [month, setMonth] = useState(currentMonth());
  const [status, setStatus] = useState<PaymentStatus>("pending");
  const [amount, setAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("online");
  const [note, setNote] = useState("");
  const [history, setHistory] = useState<PaymentHistory[]>([]);
  const [receipts, setReceipts] = useState<PaymentReceipt[]>([]);
  const [serviceHistoryOpen, setServiceHistoryOpen] = useState(false);
  const [editingReceiptId, setEditingReceiptId] = useState("");
  const [editMonth, setEditMonth] = useState("");
  const [editAmount, setEditAmount] = useState("");
  const [editMethod, setEditMethod] = useState<PaymentMethod>("online");
  const [editNote, setEditNote] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    let cancelled = false;
    let timer = 0;
    async function detect() {
      try {
        const context = await fetchPaymentContext();
        if (cancelled) return;
        setEnabled(true);
        setRole(context.role);
        setStaffBranch(context.staffBranch);
        const branches = Array.from(new Set(context.children.map((item) => item.branch).filter(Boolean))).sort();
        setAvailableBranches(branches);
        if (context.role === "admin") setBranchFilter(context.staffBranch);
      } catch {
        if (!cancelled) timer = window.setTimeout(detect, 1400);
      }
    }
    void detect();
    return () => {
      cancelled = true;
      if (timer) window.clearTimeout(timer);
    };
  }, []);

  const selected = useMemo(
    () => overview?.students.find((student) => student.childId === selectedId) || null,
    [overview, selectedId]
  );

  const visibleStudents = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return (overview?.students || []).filter((student) => {
      if (overviewFilter === "paid" && student.state !== "paid") return false;
      if (overviewFilter === "unpaid" && !["pending", "overdue"].includes(student.state)) return false;
      if (overviewFilter === "needs_amount" && student.state !== "needs_amount") return false;
      if (overviewFilter === "overdue" && student.state !== "overdue") return false;
      if (!normalized) return true;
      return [student.name, student.branch, student.groupName].join(" ").toLowerCase().includes(normalized);
    });
  }, [overview, overviewFilter, query]);

  const activeReceipts = useMemo(() => receipts.filter((receipt) => !receipt.voidedAt), [receipts]);
  const cancelledReceipts = useMemo(() => receipts.filter((receipt) => Boolean(receipt.voidedAt)), [receipts]);

  async function refreshOverview(nextMonth = month, nextBranch = branchFilter) {
    const branch = role === "admin" ? staffBranch : nextBranch;
    const next = await fetchPaymentOverview(nextMonth, branch);
    setOverview(next);
    return next;
  }

  async function refreshChild(childId: string) {
    const [nextHistory, nextReceipts] = await Promise.all([fetchPaymentHistory(childId), fetchPaymentReceipts(childId)]);
    setHistory(nextHistory);
    setReceipts(nextReceipts);
  }

  async function openManager() {
    setOpen(true);
    setLoading(true);
    setError("");
    setSuccess("");
    try {
      const context = await fetchPaymentContext();
      setRole(context.role);
      setStaffBranch(context.staffBranch);
      const branches = Array.from(new Set(context.children.map((item) => item.branch).filter(Boolean))).sort();
      setAvailableBranches(branches);
      const branch = context.role === "admin" ? context.staffBranch : branchFilter;
      if (context.role === "admin") setBranchFilter(context.staffBranch);
      await fetchPaymentOverview(month, branch).then(setOverview);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Не удалось загрузить оплату.");
    } finally {
      setLoading(false);
    }
  }

  async function changeMonth(nextMonth: string) {
    setMonth(nextMonth);
    setSelectedId("");
    setReceipts([]);
    setHistory([]);
    setLoading(true);
    setError("");
    try {
      await refreshOverview(nextMonth, branchFilter);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Не удалось обновить месяц.");
    } finally {
      setLoading(false);
    }
  }

  async function changeBranch(nextBranch: string) {
    if (role === "admin") return;
    setBranchFilter(nextBranch);
    setSelectedId("");
    setReceipts([]);
    setHistory([]);
    setLoading(true);
    setError("");
    try {
      await refreshOverview(month, nextBranch);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Не удалось обновить филиал.");
    } finally {
      setLoading(false);
    }
  }

  async function choose(student: PaymentOverviewStudent) {
    setSelectedId(student.childId);
    setStatus(student.state === "paid" || student.state === "needs_amount" ? "paid" : student.state);
    setAmount("");
    setNote("");
    setEditingReceiptId("");
    setServiceHistoryOpen(false);
    setLoading(true);
    setError("");
    setSuccess("");
    try {
      await refreshChild(student.childId);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Не удалось загрузить поступления.");
    } finally {
      setLoading(false);
    }
  }

  async function save() {
    if (!selected) return setError("Выберите ребёнка.");
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      if (status === "paid") {
        const numericAmount = Number(amount.replace(/\s/g, "").replace(",", "."));
        if (!Number.isFinite(numericAmount) || numericAmount <= 0) throw new Error("Введите сумму фактической оплаты.");
        await confirmPaymentReceipt({
          childId: selected.childId,
          month,
          amount: numericAmount,
          paymentMethod,
          note,
        });
        setSuccess(`${selected.name}: подтверждено ${money(numericAmount)} за ${monthLabel(month)}.`);
        setAmount("");
        setNote("");
      } else {
        await setPaymentStatus(selected.childId, month, status);
        setSuccess(`Статус за ${monthLabel(month)}: ${labels[status]}.`);
      }
      await refreshOverview();
      await refreshChild(selected.childId);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Не удалось сохранить оплату.");
    } finally {
      setSaving(false);
    }
  }

  function startEdit(receipt: PaymentReceipt) {
    setEditingReceiptId(receipt.id);
    setEditMonth(receipt.month.slice(0, 7));
    setEditAmount(String(receipt.amount));
    setEditMethod(receipt.paymentMethod);
    setEditNote(receipt.note);
    setError("");
    setSuccess("");
  }

  async function saveCorrection(receipt: PaymentReceipt) {
    const numericAmount = Number(editAmount.replace(/\s/g, "").replace(",", "."));
    if (!Number.isFinite(numericAmount) || numericAmount <= 0) return setError("Введите корректную сумму оплаты.");
    if (!editMonth) return setError("Выберите месяц оплаты.");
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      await correctPaymentReceipt({
        receiptId: receipt.id,
        month: editMonth,
        amount: numericAmount,
        paymentMethod: editMethod,
        receivedAt: receipt.receivedAt,
        note: editNote,
      });
      setEditingReceiptId("");
      if (selected) {
        await refreshOverview();
        await refreshChild(selected.childId);
      }
      setSuccess("Оплата исправлена. ДДС обновлён автоматически.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Не удалось исправить оплату.");
    } finally {
      setSaving(false);
    }
  }

  async function voidReceipt(receipt: PaymentReceipt) {
    const reason = window.prompt(`Почему отменяем оплату ${money(receipt.amount)} за ${monthLabel(receipt.month)}?`);
    if (reason === null) return;
    if (!reason.trim()) return setError("Укажите причину отмены оплаты.");
    if (!window.confirm("Отменить поступление? Связанная строка ДДС будет удалена автоматически.")) return;
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      await voidPaymentReceipt(receipt.id, reason);
      if (selected) {
        await refreshOverview();
        await refreshChild(selected.childId);
      }
      setSuccess("Оплата отменена. Связанная проводка ДДС удалена.");
    } catch (reasonValue) {
      setError(reasonValue instanceof Error ? reasonValue.message : "Не удалось отменить оплату.");
    } finally {
      setSaving(false);
    }
  }

  if (!enabled) return null;

  const unpaidCount = (overview?.pendingStudents || 0) + (overview?.overdueStudents || 0);
  const displayBranch = role === "admin" ? staffBranch : (branchFilter || "Все филиалы");

  const filters: Array<{ id: OverviewFilter; label: string; count: number }> = [
    { id: "all", label: "Все", count: overview?.totalStudents || 0 },
    { id: "paid", label: "Оплатили", count: overview?.paidStudents || 0 },
    { id: "unpaid", label: "Не оплатили", count: unpaidCount },
    { id: "needs_amount", label: "Нужно внести сумму", count: overview?.needsAmountStudents || 0 },
    { id: "overdue", label: "Просрочено", count: overview?.overdueStudents || 0 },
  ];

  return (
    <>
      <button type="button" onClick={openManager} className="fixed bottom-[28.7rem] right-4 z-40 flex items-center gap-2 rounded-full bg-white px-4 py-3 text-sm font-semibold text-[#171717] shadow-[0_10px_30px_rgba(0,0,0,0.18)] ring-1 ring-black/[0.06] sm:right-6">
        <CreditCard size={17} className="text-[#5F6338]" /> Оплата
      </button>

      {open && (
        <div className="fixed inset-0 z-[81] flex items-end justify-center bg-black/30 backdrop-blur-[2px] sm:items-center sm:p-5" onClick={() => !saving && setOpen(false)}>
          <div className="max-h-[96vh] w-full max-w-6xl overflow-y-auto rounded-t-[28px] bg-[#FAF9F5] p-5 shadow-2xl sm:rounded-[28px] sm:p-7" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#D96A24]">OPEN STARS ADMIN</p>
                <h2 className="mt-1 text-2xl font-semibold">Оплата · {displayBranch}</h2>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-black/45">Сводка считается только по фактическим поступлениям. Старый статус «Оплачено» без суммы отдельно помечается как «Нужно внести сумму».</p>
              </div>
              <button type="button" onClick={() => setOpen(false)} className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-white"><X size={20} /></button>
            </div>

            <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <label className="text-xs font-semibold text-black/55">Месяц
                <input type="month" className={`${inputClass} sm:w-[210px]`} value={month} onChange={(event) => void changeMonth(event.target.value)} />
              </label>
              {role !== "admin" && availableBranches.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  <button type="button" onClick={() => void changeBranch("")} className={`rounded-full px-3.5 py-2 text-xs font-semibold ${!branchFilter ? "bg-[#171717] text-white" : "bg-white text-black/50"}`}>Все филиалы</button>
                  {availableBranches.map((branch) => <button key={branch} type="button" onClick={() => void changeBranch(branch)} className={`rounded-full px-3.5 py-2 text-xs font-semibold ${branchFilter === branch ? "bg-[#171717] text-white" : "bg-white text-black/50"}`}>{branch}</button>)}
                </div>
              )}
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
              <div className="rounded-[20px] border border-black/[0.05] bg-[#171717] p-4 text-white"><div className="flex items-center gap-2 text-white/55"><WalletCards size={16} /><p className="text-xs font-semibold">Собрано</p></div><p className="mt-2 text-2xl font-semibold tracking-[-0.04em]">{money(overview?.collectedAmount || 0)}</p><p className="mt-1 text-[11px] text-white/35">за {monthLabel(month)}</p></div>
              <div className="rounded-[20px] border border-black/[0.05] bg-white p-4"><div className="flex items-center gap-2 text-[#4D512E]"><CheckCircle2 size={16} /><p className="text-xs font-semibold">Оплатили</p></div><p className="mt-2 text-2xl font-semibold tracking-[-0.04em]">{overview?.paidStudents || 0} <span className="text-base text-black/25">/ {overview?.totalStudents || 0}</span></p></div>
              <div className="rounded-[20px] border border-black/[0.05] bg-white p-4"><div className="flex items-center gap-2 text-[#C95320]"><Clock3 size={16} /><p className="text-xs font-semibold">Не оплатили</p></div><p className="mt-2 text-2xl font-semibold tracking-[-0.04em]">{unpaidCount}</p><p className="mt-1 text-[11px] text-black/35">ожидают + просрочено</p></div>
              <div className="rounded-[20px] border border-red-100 bg-red-50/60 p-4"><div className="flex items-center gap-2 text-red-600"><AlertTriangle size={16} /><p className="text-xs font-semibold">Просрочено</p></div><p className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-red-700">{overview?.overdueStudents || 0}</p></div>
              <div className="rounded-[20px] border border-amber-100 bg-amber-50/60 p-4"><div className="flex items-center gap-2 text-amber-700"><Banknote size={16} /><p className="text-xs font-semibold">Без суммы</p></div><p className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-amber-800">{overview?.needsAmountStudents || 0}</p><p className="mt-1 text-[11px] text-amber-700/60">старое «Оплачено»</p></div>
            </div>

            <AdminPaymentLinkSettings />

            {error && <div className="mt-5 rounded-[15px] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
            {success && <div className="mt-5 flex gap-2 rounded-[15px] bg-[#5F6338]/[0.07] px-4 py-3 text-sm text-[#4D512E]"><CheckCircle2 size={17} className="shrink-0" />{success}</div>}

            <div className="mt-6 grid gap-5 lg:grid-cols-[0.95fr_1.05fr]">
              <section className="rounded-[24px] border border-black/[0.06] bg-white p-5">
                <div className="flex items-center gap-2"><UsersRound size={17} className="text-[#D96A24]" /><h3 className="font-semibold">Реестр оплат</h3></div>
                <div className="mt-4 relative"><Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-black/25" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Найти ребёнка" className="w-full rounded-[14px] bg-[#FAF9F5] py-3 pl-10 pr-3 text-sm outline-none" /></div>
                <div className="mt-3 flex flex-wrap gap-2">{filters.map((item) => <button key={item.id} type="button" onClick={() => setOverviewFilter(item.id)} className={`rounded-full px-3 py-2 text-[11px] font-semibold ${overviewFilter === item.id ? "bg-[#171717] text-white" : "bg-[#FAF9F5] text-black/45"}`}>{item.label} · {item.count}</button>)}</div>
                {loading && !overview ? <div className="grid min-h-[300px] place-items-center"><LoaderCircle className="animate-spin text-black/20" /></div> : (
                  <div className="mt-4 max-h-[620px] space-y-2 overflow-y-auto">
                    {visibleStudents.length === 0 ? <div className="rounded-[18px] bg-[#FAF9F5] px-4 py-10 text-center text-sm text-black/35">По выбранному фильтру никого нет.</div> : visibleStudents.map((student) => (
                      <button key={student.childId} type="button" onClick={() => void choose(student)} className={`w-full rounded-[16px] border p-3.5 text-left transition ${student.childId === selectedId ? "border-[#D96A24]/30 bg-[#D96A24]/[0.04]" : "border-black/[0.055] hover:bg-[#FAF9F5]"}`}>
                        <div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="truncate text-sm font-semibold">{student.name}</p><p className="mt-1 text-xs text-black/35">{student.groupName || "Группа не указана"}</p></div><span className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-semibold ${stateStyle(student.state)}`}>{overviewLabels[student.state]}</span></div>
                        {student.state === "paid" && <div className="mt-2 flex items-center justify-between gap-3 text-xs"><span className="font-semibold text-[#4D512E]">{money(student.amountPaid)}</span><span className="text-black/30">{student.latestMethod ? methodLabels[student.latestMethod] : ""}</span></div>}
                      </button>
                    ))}
                  </div>
                )}
              </section>

              <div className="space-y-5">
                <section className="rounded-[24px] border border-black/[0.06] bg-white p-5">
                  {selected ? (
                    <>
                      <div className="flex items-start justify-between gap-3"><div><h3 className="text-lg font-semibold">{selected.name}</h3><p className="mt-1 text-xs text-black/35">{selected.branch} · {selected.groupName || "группа не указана"}</p></div><span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold ${stateStyle(selected.state)}`}>{overviewLabels[selected.state]}</span></div>
                      <div className="mt-5 grid gap-3 sm:grid-cols-2">
                        <label className="text-xs font-semibold text-black/55">Месяц<input type="month" className={inputClass} value={month} onChange={(event) => void changeMonth(event.target.value)} /></label>
                        <label className="text-xs font-semibold text-black/55">Статус<select className={inputClass} value={status} onChange={(event) => setStatus(event.target.value as PaymentStatus)}><option value="paid">Оплачено</option><option value="pending">Ожидает оплаты</option><option value="overdue">Просрочено</option></select></label>
                      </div>

                      {status === "paid" && (
                        <div className="mt-4 rounded-[18px] bg-[#F7F5EF] p-4">
                          <div className="flex items-center gap-2"><Banknote size={17} className="text-[#5F6338]" /><p className="text-sm font-semibold">Добавить фактическое поступление</p></div>
                          <div className="mt-3 grid gap-3 sm:grid-cols-2">
                            <label className="text-xs font-semibold text-black/55">Сумма, ₽<input inputMode="decimal" className={inputClass} value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="5500" /></label>
                            <label className="text-xs font-semibold text-black/55">Способ оплаты<select className={inputClass} value={paymentMethod} onChange={(event) => setPaymentMethod(event.target.value as PaymentMethod)}><option value="online">Онлайн · Точка</option><option value="cash">Наличные</option><option value="bank_transfer">Перевод на счёт</option><option value="other">Другое</option></select></label>
                          </div>
                          <label className="mt-3 block text-xs font-semibold text-black/55">Комментарий<input className={inputClass} value={note} onChange={(event) => setNote(event.target.value)} placeholder="Необязательно" /></label>
                        </div>
                      )}

                      <button onClick={() => void save()} disabled={saving} className="mt-5 flex w-full items-center justify-center gap-2 rounded-[14px] bg-[#171717] px-5 py-3.5 text-sm font-semibold text-white disabled:opacity-50">{saving ? <LoaderCircle className="animate-spin" size={17} /> : <CreditCard size={17} />}{status === "paid" ? "Подтвердить оплату" : "Сохранить статус"}</button>
                    </>
                  ) : <div className="grid min-h-[230px] place-items-center text-center text-sm text-black/40"><div><CreditCard className="mx-auto text-black/15" size={28} /><p className="mt-3">Выберите ребёнка в реестре слева.</p></div></div>}
                </section>

                {selected && (
                  <section className="rounded-[24px] border border-black/[0.06] bg-white p-5">
                    <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-black/35">Фактические поступления</p>
                    {loading ? <div className="grid min-h-[100px] place-items-center"><LoaderCircle className="animate-spin text-black/20" /></div> : activeReceipts.length === 0 ? <p className="mt-4 text-sm text-black/40">Фактических поступлений пока нет.</p> : (
                      <div className="mt-3 divide-y divide-black/[0.06]">
                        {activeReceipts.map((receipt) => (
                          <div key={receipt.id} className="py-4">
                            {editingReceiptId === receipt.id ? (
                              <div className="rounded-[16px] bg-[#FAF9F5] p-4">
                                <div className="grid gap-3 sm:grid-cols-2"><label className="text-xs font-semibold text-black/55">Месяц<input type="month" className={inputClass} value={editMonth} onChange={(event) => setEditMonth(event.target.value)} /></label><label className="text-xs font-semibold text-black/55">Сумма, ₽<input inputMode="decimal" className={inputClass} value={editAmount} onChange={(event) => setEditAmount(event.target.value)} /></label></div>
                                <label className="mt-3 block text-xs font-semibold text-black/55">Способ оплаты<select className={inputClass} value={editMethod} onChange={(event) => setEditMethod(event.target.value as PaymentMethod)}><option value="online">Онлайн · Точка</option><option value="cash">Наличные</option><option value="bank_transfer">Перевод на счёт</option><option value="other">Другое</option></select></label>
                                <label className="mt-3 block text-xs font-semibold text-black/55">Комментарий<input className={inputClass} value={editNote} onChange={(event) => setEditNote(event.target.value)} /></label>
                                <div className="mt-3 grid grid-cols-2 gap-2"><button type="button" disabled={saving} onClick={() => setEditingReceiptId("")} className="rounded-[12px] border border-black/[0.08] bg-white px-3 py-2.5 text-xs font-semibold">Отмена</button><button type="button" disabled={saving} onClick={() => void saveCorrection(receipt)} className="rounded-[12px] bg-[#171717] px-3 py-2.5 text-xs font-semibold text-white">Сохранить исправление</button></div>
                              </div>
                            ) : (
                              <div className="flex items-start justify-between gap-3"><div><p className="text-sm font-semibold">{money(receipt.amount)} · {methodLabels[receipt.paymentMethod]}</p><p className="mt-1 text-[11px] text-black/35">{monthLabel(receipt.month)} · {dateLabel(receipt.receivedAt)} · {receipt.confirmedByName}</p>{receipt.note && <p className="mt-1 text-xs text-black/45">{receipt.note}</p>}</div><div className="flex shrink-0 flex-col gap-1.5 sm:flex-row"><button type="button" disabled={saving} onClick={() => startEdit(receipt)} className="flex items-center justify-center gap-1 rounded-full bg-[#F6F5F1] px-2.5 py-1.5 text-[11px] font-semibold text-black/55"><Pencil size={12} />Исправить</button><button type="button" disabled={saving} onClick={() => void voidReceipt(receipt)} className="flex items-center justify-center gap-1 rounded-full bg-red-50 px-2.5 py-1.5 text-[11px] font-semibold text-red-600"><RotateCcw size={12} />Отменить</button></div></div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </section>
                )}

                {selected && (
                  <section className="rounded-[24px] border border-black/[0.06] bg-white p-5">
                    <button type="button" onClick={() => setServiceHistoryOpen((current) => !current)} className="flex w-full items-center justify-between gap-3 text-left"><div className="flex items-center gap-2"><History size={16} className="text-black/35" /><div><p className="text-sm font-semibold">Служебная история</p><p className="mt-0.5 text-xs text-black/35">Старые статусы и отменённые операции</p></div></div><ChevronDown size={18} className={`text-black/30 transition ${serviceHistoryOpen ? "rotate-180" : ""}`} /></button>
                    {serviceHistoryOpen && <div className="mt-4 space-y-5">
                      {cancelledReceipts.length > 0 && <div><p className="text-[10px] font-bold uppercase tracking-[0.16em] text-black/30">Отменённые поступления</p><div className="mt-2 divide-y divide-black/[0.06]">{cancelledReceipts.map((receipt) => <div key={receipt.id} className="py-3 opacity-55"><p className="text-sm font-semibold line-through">{money(receipt.amount)} · {methodLabels[receipt.paymentMethod]}</p><p className="mt-1 text-[11px] text-red-600">Отменено: {receipt.voidReason}</p></div>)}</div></div>}
                      <div><p className="text-[10px] font-bold uppercase tracking-[0.16em] text-black/30">История статусов</p>{history.length === 0 ? <p className="mt-2 text-sm text-black/35">Изменений нет.</p> : <div className="mt-2 divide-y divide-black/[0.06]">{history.map((item) => <div key={item.id} className="py-3"><div className="flex items-center gap-2">{item.newStatus === "paid" ? <CheckCircle2 size={15} className="text-[#5F6338]" /> : <Clock3 size={15} className={item.newStatus === "overdue" ? "text-red-500" : "text-[#D96A24]"} />}<p className="text-sm font-semibold">{monthLabel(item.month)} · {labels[item.newStatus]}</p></div><p className="mt-1 pl-6 text-[11px] text-black/35">{dateLabel(item.changedAt)} · {item.changedByName}</p></div>)}</div>}</div>
                    </div>}
                  </section>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}