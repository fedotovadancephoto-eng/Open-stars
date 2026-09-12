import { FinanceRegister } from "@/admin/FinanceRegister";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Banknote,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Link2,
  Plus,
  RefreshCw,
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

import { notifyAdminDataUpdated } from "@/admin/adminNavigation";
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
  setMonthlyCharge,
  voidPaymentReceipt,
} from "@/admin/paymentApi";

const inputClass = "mt-1.5 w-full min-w-0 max-w-full rounded-[13px] border border-black/[0.08] bg-white px-3.5 py-3 text-sm text-[#171717] outline-none focus:border-[#D96A24]/45 focus:ring-4 focus:ring-[#D96A24]/[0.06]";
const labels: Record<string, string> = { paid: "Оплачено", pending: "Ожидает оплаты", overdue: "Просрочено", "": "Статус не указан" };
const methodLabels: Record<PaymentMethod, string> = { online: "Онлайн · Точка", cash: "Наличные", bank_transfer: "Перевод на счёт", other: "Другое" };
const overviewLabels: Record<PaymentOverviewState, string> = {
  paid: "Оплачено полностью",
  partial: "Частично оплачено",
  needs_charge: "Нужно начислить",
  needs_amount: "Нужно внести сумму",
  pending: "Ожидает оплаты",
  overdue: "Просрочено",
  overpaid: "Переплата",
  no_charge: "Без начисления",
};

type OverviewFilter = "all" | "charged" | "needs_amount" | "received" | "paid" | "partial" | "debt" | "needs_charge" | "overdue" | "overpaid";

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

function numericInput(value: string) {
  return Number(value.replace(/\s/g, "").replace(",", "."));
}

function effectiveState(student: PaymentOverviewStudent): PaymentOverviewState {
  if (!student.chargeSet) {
    if (student.state === "needs_amount") return "needs_amount";
    return "needs_charge";
  }
  return student.state;
}

function stateStyle(state: PaymentOverviewState) {
  if (state === "paid") return "bg-[#5F6338]/10 text-[#4D512E]";
  if (state === "overdue") return "bg-red-50 text-red-600";
  if (state === "partial" || state === "needs_charge" || state === "needs_amount") return "bg-amber-50 text-amber-700";
  if (state === "overpaid") return "bg-[#5F6338]/[0.07] text-[#4D512E]";
  if (state === "no_charge") return "bg-black/[0.05] text-black/45";
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
  const [panel, setPanel] = useState<"students" | "receipts" | "settings" | null>(null);
  const [chargeOpen, setChargeOpen] = useState(false);
  const [receiptsOpen, setReceiptsOpen] = useState(false);
  const panelHeading = useRef<HTMLDivElement | null>(null);
  const panelTrigger = useRef<HTMLButtonElement | null>(null);
  const feedback = useRef<HTMLDivElement | null>(null);
  const overviewRequest = useRef(0);
  const childRequest = useRef(0);
  const [month, setMonth] = useState(currentMonth());
  const [chargeAmount, setChargeAmount] = useState("");
  const [chargeDueDate, setChargeDueDate] = useState("");
  const [chargeNote, setChargeNote] = useState("");
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

  const stateCounts = useMemo(() => {
    const rows = overview?.students || [];
    const count = (state: PaymentOverviewState) => rows.filter((student) => effectiveState(student) === state).length;
    return {
      paid: count("paid"),
      partial: count("partial"),
      needsCharge: count("needs_charge"),
      needsAmount: count("needs_amount"),
      overdue: count("overdue"),
      overpaid: count("overpaid"),
      debt: rows.filter((student) => ["partial", "pending", "overdue"].includes(effectiveState(student))).length,
      received: rows.filter((student) => student.amountPaid > 0).length,
      chargeSet: rows.filter((student) => student.chargeSet).length,
    };
  }, [overview]);

  const visibleStudents = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return (overview?.students || []).filter((student) => {
      const state = effectiveState(student);
      if (overviewFilter === "charged" && !student.chargeSet) return false;
      if (overviewFilter === "needs_amount" && state !== "needs_amount") return false;
      if (overviewFilter === "received" && student.amountPaid <= 0) return false;
      if (overviewFilter === "paid" && state !== "paid") return false;
      if (overviewFilter === "partial" && state !== "partial") return false;
      if (overviewFilter === "debt" && !["partial", "pending", "overdue"].includes(state)) return false;
      if (overviewFilter === "needs_charge" && state !== "needs_charge") return false;
      if (overviewFilter === "overdue" && state !== "overdue") return false;
      if (overviewFilter === "overpaid" && state !== "overpaid") return false;
      if (!normalized) return true;
      return [student.name, student.branch, student.groupName].join(" ").toLowerCase().includes(normalized);
    });
  }, [overview, overviewFilter, query]);

  const activeReceipts = useMemo(() => receipts.filter((receipt) => !receipt.voidedAt && !receipt.refundedAt), [receipts]);
  const cancelledReceipts = useMemo(() => receipts.filter((receipt) => Boolean(receipt.voidedAt)), [receipts]);
  const refundedReceipts = useMemo(() => receipts.filter((receipt) => Boolean(receipt.refundedAt)), [receipts]);

  async function refreshOverview(nextMonth = month, nextBranch = branchFilter) {
    const branch = role === "admin" ? staffBranch : nextBranch;
    const request = ++overviewRequest.current;
    const next = await fetchPaymentOverview(nextMonth, branch);
    if (request === overviewRequest.current) setOverview(next);
    return next;
  }

  async function refreshChild(childId: string) {
    const request = ++childRequest.current;
    const [nextHistory, nextReceipts] = await Promise.all([fetchPaymentHistory(childId), fetchPaymentReceipts(childId)]);
    if (request === childRequest.current) {
      setHistory(nextHistory);
      setReceipts(nextReceipts);
    }
  }

  async function openManager() {
    const request = ++overviewRequest.current;
    resetSelection();
    setPanel(null);
    setOverviewFilter("all");
    setQuery("");
    setOverview(null);
    const nextMonth = month || currentMonth();
    setMonth(nextMonth);
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
      const next = await fetchPaymentOverview(nextMonth, branch);
      if (request === overviewRequest.current) setOverview(next);
    } catch (reason) {
      if (request === overviewRequest.current) setError(reason instanceof Error ? reason.message : "Не удалось загрузить оплату.");
    } finally {
      if (request === overviewRequest.current) setLoading(false);
    }
  }

  function resetSelection() {
    childRequest.current += 1;
    setSelectedId("");
    setEditingReceiptId("");
    setServiceHistoryOpen(false);
    setReceiptsOpen(false);
    setChargeOpen(false);
    setNote("");
    setChargeAmount("");
    setChargeDueDate("");
    setChargeNote("");
    setAmount("");
    setReceipts([]);
    setHistory([]);
  }

  async function changeMonth(nextMonth: string) {
    setMonth(nextMonth);
    resetSelection();
    setPanel(null);
    setOverviewFilter("all");
    setQuery("");
    setOverview(null);
    setSuccess("");
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(nextMonth)) {
      setError("Выберите месяц обучения.");
      return;
    }
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
    resetSelection();
    setPanel(null);
    setOverviewFilter("all");
    setQuery("");
    setOverview(null);
    setSuccess("");
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) {
      setError("Выберите месяц обучения.");
      return;
    }
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
    if (saving || loading) return;
    setReceipts([]);
    setHistory([]);
    setReceiptsOpen(false);
    setChargeOpen(!student.chargeSet);
    setSelectedId(student.childId);
    setChargeAmount(student.chargeSet ? String(student.expectedAmount) : "");
    setChargeDueDate(student.dueDate || "");
    setChargeNote(student.chargeNote || "");
    setAmount(student.chargeSet && student.remainingAmount > 0 ? String(student.remainingAmount) : "");
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

  async function saveCharge() {
    if (saving || loading) return;
    if (!selected) return setError("Выберите ребёнка.");
    const numericAmount = numericInput(chargeAmount);
    if (!chargeAmount.trim() || !Number.isFinite(numericAmount) || numericAmount < 0) return setError("Введите корректную сумму начисления. Можно указать 0 ₽, если за месяц платить не нужно.");
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      await setMonthlyCharge({
        childId: selected.childId,
        month,
        expectedAmount: numericAmount,
        dueDate: chargeDueDate,
        note: chargeNote,
      });
      const next = await refreshOverview();
      const updated = next.students.find((student) => student.childId === selected.childId);
      if (updated && updated.remainingAmount > 0) setAmount(String(updated.remainingAmount));
      setChargeOpen(false);
      notifyAdminDataUpdated({source:"payment-charge-saved"});
      setSuccess(`${selected.name}: начислено ${money(numericAmount)} за ${monthLabel(month)}.`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Не удалось сохранить начисление.");
    } finally {
      setSaving(false);
    }
  }

  async function saveReceipt() {
    if (saving || loading) return;
    if (!selected) return setError("Выберите ребёнка.");
    if (!selected.chargeSet) return setError("Сначала сохраните индивидуальное начисление за выбранный месяц.");
    const numericAmount = numericInput(amount);
    if (!Number.isFinite(numericAmount) || numericAmount <= 0) return setError("Введите сумму фактической оплаты.");
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      await confirmPaymentReceipt({
        childId: selected.childId,
        month,
        amount: numericAmount,
        paymentMethod,
        note,
      });
      const next = await refreshOverview();
      await refreshChild(selected.childId);
      const updated = next.students.find((student) => student.childId === selected.childId);
      setAmount(updated && updated.remainingAmount > 0 ? String(updated.remainingAmount) : "");
      setNote("");
      notifyAdminDataUpdated({source:"payment-received"});
      setSuccess(`${selected.name}: поступление ${money(numericAmount)} подтверждено.`);
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
    if (saving || loading) return;
    const numericAmount = numericInput(editAmount);
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
      notifyAdminDataUpdated({source:"payment-corrected"});
      setSuccess("Оплата исправлена. ДДС обновлён автоматически.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Не удалось исправить оплату.");
    } finally {
      setSaving(false);
    }
  }

  async function voidReceipt(receipt: PaymentReceipt) {
    if (saving || loading) return;
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
      notifyAdminDataUpdated({source:"payment-cancelled"});
      setSuccess("Оплата отменена. Связанная проводка ДДС удалена.");
    } catch (reasonValue) {
      setError(reasonValue instanceof Error ? reasonValue.message : "Не удалось отменить оплату.");
    } finally {
      setSaving(false);
    }
  }

  useEffect(() => {
    if (open && panel) panelHeading.current?.scrollIntoView({behavior:"smooth",block:"start"});
  }, [open, panel, selectedId, overviewFilter]);

  function collapsePanel() {
    if (saving || loading) return;
    setPanel(null);
    resetSelection();
    panelTrigger.current?.focus({preventScroll:true});
    panelTrigger.current?.scrollIntoView({behavior:"smooth",block:"center"});
  }

  function showStudents(filter: OverviewFilter, trigger: HTMLButtonElement, forceOpen = false) {
    if (saving || loading) return;
    if (!forceOpen && panel === "students" && overviewFilter === filter && !selected) {
      collapsePanel();
      return;
    }
    panelTrigger.current = trigger;
    resetSelection();
    setOverviewFilter(filter);
    setQuery("");
    setPanel("students");
  }

  function showPanel(next: "receipts" | "settings", trigger: HTMLButtonElement) {
    if (saving || loading) return;
    if (panel === next) { collapsePanel(); return; }
    panelTrigger.current = trigger;
    resetSelection();
    setPanel(next);
  }

  function closeManager() {
    if (saving || loading) return;
    overviewRequest.current += 1;
    resetSelection();
    setOpen(false);
    setPanel(null);
  }

  if (!enabled) return null;

  const displayBranch = role === "admin" ? staffBranch : (branchFilter || "Все филиалы");
  const chargedAmount = overview?.chargedAmount || 0;
  const remainingAmount = overview?.remainingAmount || 0;
  const hasCharges = stateCounts.chargeSet > 0;

  const filters: Array<{ id: OverviewFilter; label: string; count: number }> = [
    { id: "all", label: "Все ученики", count: overview?.totalStudents || 0 },
    { id: "received", label: "Есть поступление", count: stateCounts.received },
    { id: "charged", label: "Есть начисление", count: stateCounts.chargeSet },
    { id: "paid", label: "Оплачено полностью", count: stateCounts.paid },
    { id: "partial", label: "Частично оплачено", count: stateCounts.partial },
    { id: "debt", label: "Осталось оплатить", count: stateCounts.debt },
    { id: "needs_charge", label: "Нужно начислить", count: stateCounts.needsCharge },
    { id: "needs_amount", label: "Нужно внести сумму", count: stateCounts.needsAmount },
    { id: "overdue", label: "Просрочено", count: stateCounts.overdue },
    { id: "overpaid", label: "Переплата", count: stateCounts.overpaid },
  ];
  const tiles: Array<{ filter: OverviewFilter; title: string; value: string; caption: string; tone?: string }> = [
    { filter: "received", title: "Собрано", value: money(overview?.collectedAmount || 0), caption: `Учеников с оплатой: ${stateCounts.received}`, tone: "dark" },
    { filter: "debt", title: "Осталось оплатить", value: hasCharges ? money(remainingAmount) : "—", caption: `Учеников с остатком: ${stateCounts.debt}`, tone: "orange" },
    { filter: "charged", title: "Начислено", value: hasCharges ? money(chargedAmount) : "—", caption: `Начислений: ${stateCounts.chargeSet}` },
    { filter: "all", title: "Все ученики", value: String(overview?.totalStudents || 0), caption: "Открыть список" },
    { filter: "paid", title: "Оплатили полностью", value: String(stateCounts.paid), caption: "Без остатка", tone: "olive" },
    { filter: "partial", title: "Частично оплачено", value: String(stateCounts.partial), caption: "Открыть список", tone: "orange" },
    { filter: "needs_charge", title: "Нужно начислить", value: String(stateCounts.needsCharge), caption: "Сумма за месяц не задана" },
    { filter: "overdue", title: "Просрочено", value: String(stateCounts.overdue), caption: "Открыть список", tone: "orange" },
    ...(stateCounts.needsAmount > 0 ? [{ filter: "needs_amount" as const, title: "Нужно внести сумму", value: String(stateCounts.needsAmount), caption: "Есть статус, нет суммы оплаты" }] : []),
    ...(stateCounts.overpaid > 0 ? [{ filter: "overpaid" as const, title: "Переплата", value: money(overview?.overpaidAmount || 0), caption: `Учеников: ${stateCounts.overpaid}`, tone: "olive" }] : []),
  ];
  const panelTitle = panel === "receipts" ? "Наличные и безналичные" : panel === "settings" ? "Настройки оплаты" : selected ? "Оплата ученика" : filters.find(item => item.id === overviewFilter)?.label || "Ученики";
  const lastDay = /^\d{4}-\d{2}$/.test(month) ? new Date(Number(month.slice(0,4)), Number(month.slice(5,7)), 0).getDate() : 1;
  const receiptPeriod = { from: `${month}-01`, to: `${month}-${String(lastDay).padStart(2,"0")}` };
  const blocked = saving || loading;


  return (
    <>
      <button type="button" onClick={openManager} className="fixed bottom-[28.7rem] right-4 z-40 flex items-center gap-2 rounded-full bg-white px-4 py-3 text-sm font-semibold text-[#171717] shadow-[0_10px_30px_rgba(0,0,0,0.18)] ring-1 ring-black/[0.06] sm:right-6">
        <CreditCard size={17} className="text-[#5F6338]" /> Оплата
      </button>

      {open && (
        <div className="fixed inset-0 z-[81] flex items-end justify-center bg-black/30 backdrop-blur-[2px] sm:items-center sm:p-5" onClick={closeManager}>
          <div className="max-h-[96vh] w-full min-w-0 max-w-6xl overflow-x-hidden overflow-y-auto rounded-t-[28px] bg-[#FAF9F5] p-5 shadow-2xl sm:rounded-[28px] sm:p-7" onClick={event => event.stopPropagation()}>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#D96A24]">OPEN STARS ADMIN</p>
                <h2 className="mt-1 text-2xl font-semibold">Оплаты родителей</h2>
                <p className="mt-2 text-sm text-black/45">Сводка за месяц обучения. Выберите плашку, чтобы увидеть нужный список.</p>
              </div>
              <div className="flex shrink-0 gap-2">
                <button type="button" aria-label="Обновить оплаты" disabled={blocked || !month} onClick={() => { setLoading(true); setError(""); void Promise.all([refreshOverview(), ...(selected ? [refreshChild(selected.childId)] : [])]).then(() => notifyAdminDataUpdated({source:"payments-refreshed"})).catch(reason => setError(reason instanceof Error ? reason.message : "Не удалось обновить оплаты.")).finally(() => setLoading(false)); }} className="grid h-10 w-10 place-items-center rounded-full bg-white disabled:opacity-50"><RefreshCw size={17} className={loading ? "animate-spin" : ""}/></button>
                <button type="button" aria-label="Закрыть оплаты" disabled={blocked} onClick={closeManager} className="grid h-10 w-10 place-items-center rounded-full bg-white disabled:opacity-50"><X size={20}/></button>
              </div>
            </div>

            <button type="button" disabled={blocked || !overview} aria-expanded={panel === "students"} aria-controls="payment-details"
              onClick={event => showStudents("all", event.currentTarget, true)}
              className="mt-5 flex w-full items-center justify-center gap-2 rounded-2xl bg-[#D96A24] px-5 py-3.5 text-sm font-semibold text-white disabled:opacity-50 sm:w-auto"><Plus size={19}/>Внести оплату</button>

            <div className="mt-4 grid min-w-0 grid-cols-2 gap-3">
              <label className="min-w-0 text-xs font-semibold text-black/55">Месяц обучения
                <input type="month" disabled={blocked} className={inputClass} value={month} onChange={event => void changeMonth(event.target.value)}/>
              </label>
              <label className="min-w-0 text-xs font-semibold text-black/55">Округ
                <select className={inputClass} disabled={blocked || role === "admin"} value={role === "admin" ? staffBranch : branchFilter} onChange={event => void changeBranch(event.target.value)}>
                  <option value="">Все округа</option>
                  {Array.from(new Set([...availableBranches, staffBranch].filter(Boolean))).map(branch => <option key={branch}>{branch}</option>)}
                </select>
              </label>
            </div>

            <div ref={feedback}>
              {error && <div role="alert" className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
              {success && <div role="status" className="mt-4 flex gap-2 rounded-2xl bg-[#5F6338]/[0.07] px-4 py-3 text-sm text-[#4D512E]"><CheckCircle2 className="shrink-0" size={17}/>{success}</div>}
            </div>
            {loading && !overview && <p role="status" className="mt-4 text-sm text-black/45">Загружаем сводку…</p>}

            <div className="mt-4 grid grid-cols-2 gap-2 lg:grid-cols-4">
              {tiles.map(tile => {
                const active = panel === "students" && overviewFilter === tile.filter;
                return <button key={tile.filter} type="button" disabled={blocked || !overview} aria-expanded={active} aria-controls="payment-details"
                  onClick={event => showStudents(tile.filter, event.currentTarget)}
                  className={`flex min-w-0 flex-col justify-between gap-2 rounded-[20px] border p-3.5 text-left disabled:opacity-60 ${active ? "ring-2 ring-[#D96A24]/40" : ""} ${tile.tone === "dark" ? "border-[#171717] bg-[#171717] text-white" : tile.tone === "orange" ? "border-[#D96A24]/15 bg-[#FFF8F1]" : tile.tone === "olive" ? "border-[#5F6338]/15 bg-[#F5F5EF]" : "border-black/5 bg-white"}`}>
                  <span className="text-sm font-medium">{tile.title}</span>
                  <span><strong className="block break-words text-xl font-semibold">{overview ? tile.value : "…"}</strong>
                    <span className={`mt-1 flex items-start justify-between gap-1 text-[11px] ${tile.tone === "dark" ? "text-white/60" : "text-black/45"}`}>{overview ? tile.caption : "Загружаем данные"}{active ? <ChevronUp className="shrink-0" size={15}/> : <ChevronDown className="shrink-0" size={15}/>}</span>
                  </span>
                </button>;
              })}
            </div>

            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              <button type="button" disabled={blocked || !month} aria-expanded={panel === "receipts"} aria-controls="payment-details" onClick={event => showPanel("receipts", event.currentTarget)} className="flex items-center justify-between gap-3 rounded-2xl border border-black/5 bg-white p-4 text-left disabled:opacity-50">
                <span><span className="flex items-center gap-2 text-sm font-semibold"><WalletCards className="shrink-0 text-[#5F6338]" size={17}/>Наличные и безналичные</span><span className="mt-1 block text-xs text-black/45">Поступления по датам · {displayBranch}</span></span>{panel === "receipts" ? <ChevronUp className="shrink-0" size={17}/> : <ChevronDown className="shrink-0" size={17}/>}
              </button>
              <button type="button" disabled={blocked} aria-expanded={panel === "settings"} aria-controls="payment-details" onClick={event => showPanel("settings", event.currentTarget)} className="flex items-center justify-between gap-3 rounded-2xl border border-black/5 bg-white p-4 text-left disabled:opacity-50"><span className="flex items-center gap-2 text-sm font-semibold"><Link2 className="shrink-0 text-[#D96A24]" size={17}/>Настройки ссылки на оплату</span>{panel === "settings" ? <ChevronUp className="shrink-0" size={17}/> : <ChevronDown className="shrink-0" size={17}/>}</button>
            </div>

            {panel && <section id="payment-details" className="mt-5 min-w-0 rounded-3xl border border-black/5 bg-white p-4 sm:p-5">
              <div ref={panelHeading} className="sticky top-0 z-20 flex items-center justify-between gap-3 border-b border-black/5 bg-white py-3">
                <div className="min-w-0"><h3 className="font-semibold">{panelTitle}</h3>{panel === "students" && <p className="mt-1 text-xs text-black/45">{monthLabel(month)} · {displayBranch}</p>}</div>
                <button type="button" disabled={blocked} onClick={collapsePanel} className="inline-flex shrink-0 items-center gap-1 rounded-xl border border-black/10 bg-white px-3 py-2 text-sm disabled:opacity-50"><ChevronUp size={16}/>Свернуть</button>
              </div>

              {panel === "receipts" && <>
                <p className="mt-3 text-xs text-black/50">Даты здесь относятся к получению денег. Предоплата за будущий месяц показывается по дате поступления.</p>
                <FinanceRegister kind="payments" lockedBranch={role === "admin" ? staffBranch : branchFilter} initialPeriod={receiptPeriod}/>
              </>}
              {panel === "settings" && <AdminPaymentLinkSettings/>}

              {panel === "students" && !selected && <>
                <div className="mt-4 flex items-center gap-2"><UsersRound size={17} className="text-[#D96A24]"/><p className="text-sm text-black/55">Выберите ребёнка для внесения или исправления оплаты.</p></div>
                <div className="relative mt-3"><Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-black/25"/><input aria-label="Найти ребёнка" value={query} onChange={event => setQuery(event.target.value)} placeholder="Имя, фамилия или группа" className="w-full min-w-0 rounded-xl bg-[#FAF9F5] py-3 pl-10 pr-3 text-sm outline-none"/></div>
                <label className="mt-3 block text-xs text-black/50">Статус<select disabled={blocked} value={overviewFilter} onChange={event => setOverviewFilter(event.target.value as OverviewFilter)} className={inputClass}>{filters.map(item => <option key={item.id} value={item.id}>{item.label} · {item.count}</option>)}</select></label>
                <p className="mt-3 text-xs text-black/45">Учеников: {visibleStudents.length}</p>
                <div className="mt-3 space-y-2">{visibleStudents.length === 0 ? <p className="rounded-2xl bg-[#FAF9F5] px-4 py-8 text-center text-sm text-black/45">По выбранному фильтру никого нет.</p> : visibleStudents.map(student => {
                  const state = effectiveState(student);
                  return <button key={student.childId} type="button" disabled={blocked} onClick={() => void choose(student)} className="w-full rounded-2xl border border-black/5 p-3.5 text-left hover:bg-[#FAF9F5] disabled:opacity-50">
                    <div className="flex flex-wrap items-start justify-between gap-2"><div className="min-w-0"><p className="break-words text-sm font-semibold">{student.name}</p><p className="mt-1 text-xs text-black/40">{student.branch} · {student.groupName || "Группа не указана"}</p></div><span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold ${stateStyle(state)}`}>{overviewLabels[state]}</span></div>
                    {student.chargeSet ? <div className="mt-2 grid grid-cols-3 gap-2 text-[11px]"><span><span className="text-black/40">Начислено</span><br/><strong>{money(student.expectedAmount)}</strong></span><span><span className="text-black/40">Оплачено</span><br/><strong>{money(student.amountPaid)}</strong></span><span><span className="text-black/40">Остаток</span><br/><strong className={student.remainingAmount > 0 ? "text-[#C95320]" : "text-[#4D512E]"}>{money(student.remainingAmount)}</strong></span></div> : student.amountPaid > 0 ? <p className="mt-2 text-xs font-semibold text-[#4D512E]">Получено {money(student.amountPaid)} · начисление ещё не задано</p> : null}
                  </button>;
                })}</div>
              </>}

              {panel === "students" && selected && <div className="mt-4 min-w-0">
                <div className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-0"><h4 className="break-words text-lg font-semibold">{selected.name}</h4><p className="mt-1 text-xs text-black/45">{selected.branch} · {selected.groupName || "Группа не указана"}</p></div><button type="button" disabled={blocked} onClick={resetSelection} className="rounded-xl border border-black/10 px-3 py-2 text-xs disabled:opacity-50">Другой ребёнок</button></div>
                {selected.chargeSet && <div className="mt-4 grid grid-cols-3 gap-2 rounded-[16px] bg-[#FAF9F5] p-3 text-center"><div><p className="text-[10px] text-black/35">Начислено</p><p className="mt-1 text-sm font-semibold">{money(selected.expectedAmount)}</p></div><div><p className="text-[10px] text-black/35">Оплачено</p><p className="mt-1 text-sm font-semibold text-[#4D512E]">{money(selected.amountPaid)}</p></div><div><p className="text-[10px] text-black/35">Остаток</p><p className={`mt-1 text-sm font-semibold ${selected.remainingAmount > 0 ? "text-[#C95320]" : "text-[#4D512E]"}`}>{money(selected.remainingAmount)}</p></div></div>}
                <div className="mt-4 rounded-[18px] border border-[#5F6338]/12 bg-[#F5F5EF] p-4">
  <button type="button" disabled={blocked} aria-expanded={chargeOpen} aria-controls="payment-charge-form" onClick={() => setChargeOpen(value => !value)} className="flex w-full items-center justify-between gap-3 text-left text-sm font-semibold">
    <span>Начисление за месяц{selected.chargeSet ? ` · ${money(selected.expectedAmount)}` : " · нужно задать"}</span>
    {chargeOpen ? <ChevronUp className="shrink-0" size={18}/> : <ChevronDown className="shrink-0" size={18}/>}
  </button>
  {chargeOpen && <div id="payment-charge-form">
    <div className="mt-3 grid gap-3 sm:grid-cols-2">
                          <label className="text-xs font-semibold text-black/55">Начислено, ₽<input inputMode="decimal" className={inputClass} value={chargeAmount} onChange={(event) => setChargeAmount(event.target.value)} placeholder="Например, 6000" /></label>
                          <label className="text-xs font-semibold text-black/55">Оплатить до<input type="date" className={inputClass} value={chargeDueDate} onChange={(event) => setChargeDueDate(event.target.value)} /></label>
                        </div>
                        <label className="mt-3 block text-xs font-semibold text-black/55">Комментарий к начислению<input className={inputClass} value={chargeNote} onChange={(event) => setChargeNote(event.target.value)} placeholder="Скидка, перерасчёт, два направления — необязательно" /></label>
                        <p className="mt-2 text-[11px] leading-5 text-black/40">Можно указать 0 ₽, если в этом месяце начисления нет. Старые фактические оплаты при этом не меняются.</p>
                        <button type="button" onClick={() => void saveCharge()} disabled={blocked} className="mt-3 flex w-full items-center justify-center gap-2 rounded-[13px] bg-[#5F6338] px-4 py-3 text-xs font-semibold text-white disabled:opacity-50">{saving ? <LoaderCircle className="animate-spin" size={15} /> : <Banknote size={15} />}Сохранить начисление</button>
    <button type="button" disabled={blocked} onClick={() => setChargeOpen(false)} className="mt-3 inline-flex items-center gap-1 rounded-xl border border-black/10 bg-white px-3 py-2 text-xs"><ChevronUp size={15}/>Свернуть начисление</button>
  </div>}
</div>
                <div className="mt-4 rounded-[18px] bg-[#F7F5EF] p-4">
                        <div className="flex items-center gap-2"><CreditCard size={17} className="text-[#D96A24]" /><div><p className="text-sm font-semibold">Добавить фактическое поступление</p><p className="mt-0.5 text-[11px] text-black/40">Реально полученные деньги. Можно вносить частями.</p></div></div>
                        {!selected.chargeSet && <div className="mt-3 rounded-[12px] bg-amber-50 px-3 py-2 text-[11px] leading-5 text-amber-800">Сначала сохраните индивидуальное начисление выше. После этого можно подтвердить поступление и корректно посчитать остаток.</div>}
                        <div className="mt-3 grid gap-3 sm:grid-cols-2">
                          <label className="text-xs font-semibold text-black/55">Сумма, ₽<input inputMode="decimal" className={inputClass} value={amount} onChange={(event) => setAmount(event.target.value)} placeholder={selected.remainingAmount > 0 ? String(selected.remainingAmount) : "5500"} /></label>
                          <label className="text-xs font-semibold text-black/55">Способ оплаты<select className={inputClass} value={paymentMethod} onChange={(event) => setPaymentMethod(event.target.value as PaymentMethod)}><option value="online">Онлайн · Точка</option><option value="cash">Наличные</option><option value="bank_transfer">Перевод на счёт</option><option value="other">Другое</option></select></label>
                        </div>
                        <label className="mt-3 block text-xs font-semibold text-black/55">Комментарий<input className={inputClass} value={note} onChange={(event) => setNote(event.target.value)} placeholder="Необязательно" /></label>
                        <button onClick={() => void saveReceipt()} disabled={blocked || !selected.chargeSet} className="mt-4 flex w-full items-center justify-center gap-2 rounded-[14px] bg-[#171717] px-5 py-3.5 text-sm font-semibold text-white disabled:opacity-40">{saving ? <LoaderCircle className="animate-spin" size={17} /> : <CreditCard size={17} />}Подтвердить поступление</button>
                      </div>
                {error && <p role="alert" className="mt-3 text-sm text-red-700">{error}</p>}
                {success && <p role="status" className="mt-3 text-sm text-[#4D512E]">{success}</p>}

                <div className="mt-4 rounded-2xl border border-black/5 p-4">
                  <button type="button" disabled={blocked} aria-expanded={receiptsOpen} aria-controls="child-payment-receipts" onClick={() => setReceiptsOpen(value => !value)} className="flex w-full items-center justify-between gap-3 text-left text-sm font-semibold"><span>История оплат ребёнка · {activeReceipts.length}<span className="mt-1 block text-xs font-normal text-black/45">Фактические поступления за всё время</span></span>{receiptsOpen ? <ChevronUp className="shrink-0" size={17}/> : <ChevronDown className="shrink-0" size={17}/>}</button>
                  {receiptsOpen && <div id="child-payment-receipts">
                    {loading ? <div className="grid min-h-[100px] place-items-center"><LoaderCircle className="animate-spin text-black/20" /></div> : activeReceipts.length === 0 ? <p className="mt-4 text-sm text-black/40">Фактических поступлений пока нет.</p> : (
                      <div className="mt-3 divide-y divide-black/[0.06]">
                        {activeReceipts.map((receipt) => (
                          <div key={receipt.id} className="py-4">
                            {editingReceiptId === receipt.id ? (
                              <div className="rounded-[16px] bg-[#FAF9F5] p-4">
                                <div className="grid gap-3 sm:grid-cols-2"><label className="text-xs font-semibold text-black/55">Месяц<input type="month" className={inputClass} value={editMonth} onChange={(event) => setEditMonth(event.target.value)} /></label><label className="text-xs font-semibold text-black/55">Сумма, ₽<input inputMode="decimal" className={inputClass} value={editAmount} onChange={(event) => setEditAmount(event.target.value)} /></label></div>
                                <label className="mt-3 block text-xs font-semibold text-black/55">Способ оплаты<select className={inputClass} value={editMethod} onChange={(event) => setEditMethod(event.target.value as PaymentMethod)}><option value="online">Онлайн · Точка</option><option value="cash">Наличные</option><option value="bank_transfer">Перевод на счёт</option><option value="other">Другое</option></select></label>
                                <label className="mt-3 block text-xs font-semibold text-black/55">Комментарий<input className={inputClass} value={editNote} onChange={(event) => setEditNote(event.target.value)} /></label>
                                <div className="mt-3 grid grid-cols-2 gap-2"><button type="button" disabled={blocked} onClick={() => setEditingReceiptId("")} className="rounded-[12px] border border-black/[0.08] bg-white px-3 py-2.5 text-xs font-semibold">Отмена</button><button type="button" disabled={blocked} onClick={() => void saveCorrection(receipt)} className="rounded-[12px] bg-[#171717] px-3 py-2.5 text-xs font-semibold text-white">Сохранить исправление</button></div>
                              </div>
                            ) : (
                              <div className="flex items-start justify-between gap-3"><div><p className="text-sm font-semibold">{money(receipt.amount)} · {methodLabels[receipt.paymentMethod]}</p><p className="mt-1 text-[11px] text-black/35">{monthLabel(receipt.month)} · {dateLabel(receipt.receivedAt)} · {receipt.confirmedByName}</p>{receipt.note && <p className="mt-1 text-xs text-black/45">{receipt.note}</p>}</div><div className="flex shrink-0 flex-col gap-1.5 sm:flex-row"><button type="button" disabled={blocked} onClick={() => startEdit(receipt)} className="flex items-center justify-center gap-1 rounded-full bg-[#F6F5F1] px-2.5 py-1.5 text-[11px] font-semibold text-black/55"><Pencil size={12} />Исправить</button><button type="button" disabled={blocked} onClick={() => void voidReceipt(receipt)} className="flex items-center justify-center gap-1 rounded-full bg-red-50 px-2.5 py-1.5 text-[11px] font-semibold text-red-600"><RotateCcw size={12} />Отменить</button></div></div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                    <button type="button" disabled={blocked} onClick={() => { setReceiptsOpen(false); setEditingReceiptId(""); }} className="mt-3 inline-flex items-center gap-1 rounded-xl border border-black/10 px-3 py-2 text-xs"><ChevronUp size={15}/>Свернуть историю</button>
                  </div>}
                </div>
                <div className="mt-4 rounded-2xl border border-black/5 p-4">
                  <button type="button" aria-expanded={serviceHistoryOpen} aria-controls="payment-service-history" onClick={() => setServiceHistoryOpen(value => !value)} className="flex w-full items-center justify-between gap-3 text-left text-sm font-semibold"><span className="flex items-center gap-2"><History className="text-black/40" size={16}/>Возвраты и служебная история</span>{serviceHistoryOpen ? <ChevronUp size={17}/> : <ChevronDown size={17}/>}</button>
                  <div id="payment-service-history">{serviceHistoryOpen && <div className="mt-4 space-y-5">
                      {cancelledReceipts.length > 0 && <div><p className="text-[10px] font-bold uppercase tracking-[0.16em] text-black/30">Отменённые поступления</p><div className="mt-2 divide-y divide-black/[0.06]">{cancelledReceipts.map((receipt) => <div key={receipt.id} className="py-3 opacity-55"><p className="text-sm font-semibold line-through">{money(receipt.amount)} · {methodLabels[receipt.paymentMethod]}</p><p className="mt-1 text-[11px] text-red-600">Отменено: {receipt.voidReason}</p></div>)}</div></div>}
                      {refundedReceipts.length > 0 && <div><p className="text-[10px] font-bold uppercase tracking-[0.16em] text-black/30">Возвращённые оплаты</p><div className="mt-2 divide-y divide-black/[0.06]">{refundedReceipts.map((receipt) => <div key={receipt.id} className="py-3 opacity-65"><p className="text-sm font-semibold">{money(receipt.amount)} · {methodLabels[receipt.paymentMethod]}</p><p className="mt-1 text-[11px] text-red-600">Возврат зафиксирован: {receipt.refundReason || "причина не указана"}</p></div>)}</div></div>}
                      <div><p className="text-[10px] font-bold uppercase tracking-[0.16em] text-black/30">История старых статусов</p>{history.length === 0 ? <p className="mt-2 text-sm text-black/35">Изменений нет.</p> : <div className="mt-2 divide-y divide-black/[0.06]">{history.map((item) => <div key={item.id} className="py-3"><div className="flex items-center gap-2">{item.newStatus === "paid" ? <CheckCircle2 size={15} className="text-[#5F6338]" /> : <Clock3 size={15} className={item.newStatus === "overdue" ? "text-red-500" : "text-[#D96A24]"} />}<p className="text-sm font-semibold">{monthLabel(item.month)} · {labels[item.newStatus]}</p></div><p className="mt-1 pl-6 text-[11px] text-black/35">{dateLabel(item.changedAt)} · {item.changedByName}</p></div>)}</div>}</div>
                    </div>}</div>
                  {serviceHistoryOpen && <button type="button" onClick={() => setServiceHistoryOpen(false)} className="mt-3 inline-flex items-center gap-1 rounded-xl border border-black/10 px-3 py-2 text-xs"><ChevronUp size={15}/>Свернуть историю</button>}
                </div>
              </div>}
              <button type="button" disabled={blocked} onClick={collapsePanel} className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl border border-black/10 bg-[#FAF9F5] px-4 py-3 text-sm disabled:opacity-50"><ChevronUp size={16}/>Свернуть</button>
            </section>}
          </div>
        </div>
      )}
    </>
  );
}
