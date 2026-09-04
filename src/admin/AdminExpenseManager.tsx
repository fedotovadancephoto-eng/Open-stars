import { useEffect, useMemo, useRef, useState } from "react";
import {
  BarChart3,
  CheckCircle2,
  FileText,
  Layers3,
  LoaderCircle,
  Paperclip,
  Plus,
  ReceiptText,
  RefreshCw,
  Upload,
  WalletCards,
  X,
} from "lucide-react";

import { onAdminSection, openAdminSection } from "@/admin/adminNavigation";
import {
  BusinessExpenseContext,
  ExpenseRequest,
  fetchBusinessExpenseContext,
  openExpenseReceipt,
  uploadExpenseReceipt,
  attachReceiptToExpense,
} from "@/admin/businessApi";
import {
  createOwnerDirectExpense,
  ExpenseAllocationInput,
  ExpenseAllocationType,
  ExpensePaymentMethod,
  fetchOwnerExpenseSummary,
  OwnerExpenseSummary,
  submitExpenseV2,
} from "@/admin/expenseAllocationApi";

const inputClass = "mt-1.5 w-full rounded-[14px] border border-black/[0.08] bg-white px-3.5 py-3 text-sm text-[#171717] outline-none focus:border-[#D96A24]/45 focus:ring-4 focus:ring-[#D96A24]/[0.06]";
const paymentLabels: Record<ExpensePaymentMethod, string> = {
  cash: "Наличные",
  bank: "Перевод / расчётный счёт",
  card: "Карта / онлайн",
  other: "Другое",
};
const statusLabel: Record<string, string> = {
  submitted: "На подтверждении",
  approved: "Подтверждён",
  rejected: "Отклонён",
  cancelled: "Отменён",
  draft: "Черновик",
};
const adminExpenseCategoryCodes = new Set(["cleaning", "inventory_purchase", "household", "client_change"]);

function today() {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function monthStart() {
  const value = today();
  return `${value.slice(0, 7)}-01`;
}

function money(value: number) {
  return new Intl.NumberFormat("ru-RU", { style: "currency", currency: "RUB", maximumFractionDigits: 0 }).format(value || 0);
}

function shortDate(value: string) {
  if (!value) return "";
  const date = new Date(`${value.slice(0, 10)}T12:00:00`);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "short", year: "numeric" }).format(date).replace(".", "");
}

function parseMoney(value: string) {
  return Number(value.replace(/\s/g, "").replace(",", "."));
}

function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}

function equalAmounts(total: number, ids: string[]) {
  if (!ids.length || !Number.isFinite(total) || total <= 0) return {} as Record<string, string>;
  const cents = Math.round(total * 100);
  const base = Math.floor(cents / ids.length);
  let rest = cents - base * ids.length;
  const result: Record<string, string> = {};
  ids.forEach((id) => {
    const value = base + (rest > 0 ? 1 : 0);
    if (rest > 0) rest -= 1;
    result[id] = String(value / 100);
  });
  return result;
}

export function AdminExpenseManager() {
  const [open, setOpen] = useState(false);
  const [context, setContext] = useState<BusinessExpenseContext | null>(null);
  const [summary, setSummary] = useState<OwnerExpenseSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [branchId, setBranchId] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [amount, setAmount] = useState("");
  const [expenseDate, setExpenseDate] = useState(today());
  const [description, setDescription] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<ExpensePaymentMethod>("cash");
  const [receipt, setReceipt] = useState<File | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);

  const [allocationType, setAllocationType] = useState<ExpenseAllocationType>("branch");
  const [accountId, setAccountId] = useState("");
  const [distributionMode, setDistributionMode] = useState<"amount" | "percent">("amount");
  const [distribution, setDistribution] = useState<Record<string, string>>({});
  const [periodFrom, setPeriodFrom] = useState(monthStart());
  const [periodTo, setPeriodTo] = useState(today());

  async function refresh(nextFrom = periodFrom, nextTo = periodTo) {
    const next = await fetchBusinessExpenseContext();
    setContext(next);
    if (next.role === "admin") {
      const branch = next.branches.find((item) => item.name === next.staffBranch);
      setBranchId(branch?.id || "");
    } else if (!branchId && next.branches.length) {
      setBranchId(next.branches[0].id);
    }
    const nextCategories = next.role === "admin"
      ? next.categories.filter((item) => adminExpenseCategoryCodes.has(item.code))
      : next.categories;
    if (!categoryId || !nextCategories.some((item) => item.id === categoryId)) {
      setCategoryId(nextCategories[0]?.id || "");
    }
    if (next.role === "owner") {
      const nextSummary = await fetchOwnerExpenseSummary(nextFrom, nextTo);
      setSummary(nextSummary);
      if (!accountId && next.accounts.length) setAccountId(next.accounts[0].id);
    } else {
      setSummary(null);
    }
    return next;
  }

  useEffect(() => onAdminSection("expenses", () => {
    setOpen(true);
    setError("");
    setSuccess("");
    setLoading(true);
    void refresh().catch((reason) => setError(reason instanceof Error ? reason.message : "Не удалось открыть расходы.")).finally(() => setLoading(false));
  }), []);

  const isOwner = context?.role === "owner";
  const myBranchLocked = context?.role === "admin";
  const visibleCategories = useMemo(
    () => context?.role === "admin"
      ? context.categories.filter((item) => adminExpenseCategoryCodes.has(item.code))
      : context?.categories || [],
    [context]
  );
  const recent = useMemo(() => context?.requests.slice(0, 40) || [], [context]);
  const ownerCashflow = useMemo(() => (context?.cashflow || []).filter((item) => item.direction === "expense").slice(0, 30), [context]);

  function resetForm() {
    setAmount("");
    setDescription("");
    setReceipt(null);
    setDistribution({});
    if (fileRef.current) fileRef.current.value = "";
  }

  async function createStaffExpense() {
    const numericAmount = parseMoney(amount);
    if (!branchId) return setError("Выберите филиал.");
    if (!categoryId) return setError("Выберите категорию.");
    if (!Number.isFinite(numericAmount) || numericAmount <= 0) return setError("Введите сумму больше нуля.");

    setSaving(true);
    setError("");
    setSuccess("");
    try {
      const expenseId = await submitExpenseV2({ branchId, categoryId, amount: numericAmount, expenseDate, paymentMethod, description });
      const branch = context?.branches.find((item) => item.id === branchId);
      let receiptWarning = "";
      if (receipt && branch) {
        try {
          await uploadExpenseReceipt({ id: expenseId, branchCode: branch.code }, receipt);
        } catch (reason) {
          receiptWarning = reason instanceof Error ? ` Расход отправлен, но чек не загрузился: ${reason.message}` : " Расход отправлен, но чек не загрузился.";
        }
      }
      await refresh();
      resetForm();
      setSuccess(`Расход отправлен владельцу.${receiptWarning}`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Не удалось отправить расход.");
    } finally {
      setSaving(false);
    }
  }

  function buildAllocations(total: number): ExpenseAllocationInput[] {
    if (!context || allocationType !== "distributed") return [];
    if (distributionMode === "amount") {
      const rows = context.branches
        .map((branch) => ({ branchId: branch.id, amount: parseMoney(distribution[branch.id] || "0") }))
        .filter((item) => Number.isFinite(item.amount) && item.amount > 0)
        .map((item) => ({ ...item, amount: roundMoney(item.amount) }));
      const sum = roundMoney(rows.reduce((acc, item) => acc + item.amount, 0));
      if (rows.length < 2 || Math.abs(sum - roundMoney(total)) > 0.009) throw new Error(`Распределено ${money(sum)}, а общая сумма ${money(total)}.`);
      return rows;
    }

    const percentages = context.branches
      .map((branch) => ({ branchId: branch.id, percent: Number((distribution[branch.id] || "0").replace(",", ".")) }))
      .filter((item) => Number.isFinite(item.percent) && item.percent > 0);
    const percentTotal = percentages.reduce((acc, item) => acc + item.percent, 0);
    if (percentages.length < 2 || Math.abs(percentTotal - 100) > 0.001) throw new Error(`Сумма процентов должна быть 100%. Сейчас ${percentTotal}%.`);

    let assigned = 0;
    return percentages.map((item, index) => {
      const value = index === percentages.length - 1 ? roundMoney(total - assigned) : roundMoney(total * item.percent / 100);
      assigned = roundMoney(assigned + value);
      return { branchId: item.branchId, amount: value };
    });
  }

  function distributeEqually() {
    if (!context) return;
    const numericAmount = parseMoney(amount);
    if (!Number.isFinite(numericAmount) || numericAmount <= 0) return setError("Сначала укажите общую сумму расхода.");
    setError("");
    if (distributionMode === "percent") {
      const count = context.branches.length;
      const base = Math.floor((10000 / count)) / 100;
      let used = 0;
      const values: Record<string, string> = {};
      context.branches.forEach((branch, index) => {
        const value = index === count - 1 ? roundMoney(100 - used) : base;
        used = roundMoney(used + value);
        values[branch.id] = String(value);
      });
      setDistribution(values);
    } else {
      setDistribution(equalAmounts(numericAmount, context.branches.map((item) => item.id)));
    }
  }

  async function createOwnerExpense() {
    const numericAmount = parseMoney(amount);
    if (!categoryId) return setError("Выберите категорию.");
    if (!Number.isFinite(numericAmount) || numericAmount <= 0) return setError("Введите сумму больше нуля.");
    if (allocationType === "branch" && !branchId) return setError("Выберите филиал.");

    let allocations: ExpenseAllocationInput[] = [];
    try {
      allocations = buildAllocations(numericAmount);
    } catch (reason) {
      return setError(reason instanceof Error ? reason.message : "Проверьте распределение расхода.");
    }

    setSaving(true);
    setError("");
    setSuccess("");
    try {
      const result = await createOwnerDirectExpense({
        allocationType,
        branchId,
        allocations,
        categoryId,
        accountId,
        amount: numericAmount,
        expenseDate,
        paymentMethod,
        description,
      });
      let receiptWarning = "";
      if (receipt) {
        const branchCode = allocationType === "branch"
          ? context?.branches.find((item) => item.id === branchId)?.code || "common"
          : "common";
        try {
          await uploadExpenseReceipt({ id: result.expenseId, branchCode }, receipt);
        } catch (reason) {
          receiptWarning = reason instanceof Error ? ` Расход проведён, но чек не загрузился: ${reason.message}` : " Расход проведён, но чек не загрузился.";
        }
      }
      await refresh();
      resetForm();
      setSuccess(`Расход ${money(numericAmount)} сразу добавлен в единый ДДС.${receiptWarning}`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Не удалось провести расход.");
    } finally {
      setSaving(false);
    }
  }

  async function retryReceipt(expense: ExpenseRequest, file: File) {
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      await attachReceiptToExpense(expense, file);
      await refresh();
      setSuccess("Чек прикреплён к расходу.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Не удалось прикрепить чек.");
    } finally {
      setSaving(false);
    }
  }

  async function changePeriod(from: string, to: string) {
    setPeriodFrom(from);
    setPeriodTo(to);
    if (!isOwner) return;
    setLoading(true);
    setError("");
    try {
      await refresh(from, to);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Не удалось обновить свод.");
    } finally {
      setLoading(false);
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[84] flex items-end justify-center bg-black/30 backdrop-blur-[2px] sm:items-center sm:p-5" onClick={() => !saving && setOpen(false)}>
      <div className="max-h-[96vh] w-full max-w-7xl overflow-y-auto rounded-t-[30px] bg-[#FAF9F5] p-5 shadow-2xl sm:rounded-[30px] sm:p-7" onClick={(event) => event.stopPropagation()}>
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#D96A24]">{isOwner ? "OPEN STARS · OWNER" : "OPEN STARS ADMIN"}</p>
            <h2 className="mt-1 text-2xl font-semibold tracking-[-0.02em]">{isOwner ? "Расходы" : "Расходы филиала"}</h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-black/45">
              {isOwner
                ? "Ваш расход сразу попадает в единый ДДС. Можно отнести его к одному филиалу, оставить общим или распределить между филиалами."
                : "Фиксируйте расходы своего филиала. После подтверждения владельцем они автоматически попадут в единый ДДС."}
            </p>
          </div>
          <div className="flex gap-2">
            <button type="button" disabled={loading || saving} onClick={() => { setLoading(true); void refresh().catch((reason) => setError(reason instanceof Error ? reason.message : "Не удалось обновить расходы.")).finally(() => setLoading(false)); }} className="grid h-10 w-10 place-items-center rounded-full bg-white shadow-sm disabled:opacity-50"><RefreshCw size={18} className={loading ? "animate-spin" : ""}/></button>
            <button type="button" onClick={() => setOpen(false)} className="grid h-10 w-10 place-items-center rounded-full bg-white shadow-sm"><X size={20}/></button>
          </div>
        </div>

        {loading && !context ? <div className="grid min-h-[420px] place-items-center"><LoaderCircle className="animate-spin text-black/25" size={30}/></div> : (
          <>
            {isOwner && summary && (
              <section className="mt-6">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                  <div><p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#5F6338]">Единый свод расходов</p><h3 className="mt-1 text-xl font-semibold">Куда уходят деньги</h3></div>
                  <div className="grid grid-cols-2 gap-2">
                    <label className="text-[10px] font-semibold text-black/40">С<input type="date" className="mt-1 block rounded-[11px] border border-black/[0.07] bg-white px-2.5 py-2 text-xs" value={periodFrom} onChange={(event) => void changePeriod(event.target.value, periodTo)}/></label>
                    <label className="text-[10px] font-semibold text-black/40">По<input type="date" className="mt-1 block rounded-[11px] border border-black/[0.07] bg-white px-2.5 py-2 text-xs" value={periodTo} onChange={(event) => void changePeriod(periodFrom, event.target.value)}/></label>
                  </div>
                </div>
                <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
                  <div className="rounded-[20px] bg-[#171717] p-4 text-white"><p className="text-xs text-white/45">Всего подтверждено</p><p className="mt-2 text-2xl font-semibold">{money(summary.totalApproved)}</p></div>
                  <div className="rounded-[20px] border border-black/[0.05] bg-white p-4"><p className="text-xs text-black/40">По филиалам</p><p className="mt-2 text-2xl font-semibold">{money(summary.branchDirectAmount)}</p></div>
                  <div className="rounded-[20px] border border-[#5F6338]/15 bg-[#5F6338]/[0.06] p-4"><p className="text-xs text-[#4D512E]">Распределено</p><p className="mt-2 text-2xl font-semibold text-[#4D512E]">{money(summary.distributedAmount)}</p></div>
                  <div className="rounded-[20px] border border-[#D96A24]/15 bg-[#D96A24]/[0.06] p-4"><p className="text-xs text-[#C95320]">Общие OPEN STARS</p><p className="mt-2 text-2xl font-semibold text-[#C95320]">{money(summary.commonAmount)}</p></div>
                </div>
                <div className="mt-3 grid gap-3 lg:grid-cols-[1fr_1fr]">
                  <div className="rounded-[20px] border border-black/[0.05] bg-white p-4">
                    <div className="flex items-center gap-2"><Layers3 size={16} className="text-[#5F6338]"/><h4 className="text-sm font-semibold">Нагрузка на филиалы</h4></div>
                    <div className="mt-3 divide-y divide-black/[0.06]">{summary.branches.map((item) => <div key={item.branchId} className="flex items-center justify-between py-2.5 text-sm"><span className="text-black/55">{item.branch}</span><strong>{money(item.amount)}</strong></div>)}</div>
                  </div>
                  <div className="rounded-[20px] border border-black/[0.05] bg-white p-4">
                    <div className="flex items-center gap-2"><BarChart3 size={16} className="text-[#D96A24]"/><h4 className="text-sm font-semibold">По категориям</h4></div>
                    {summary.categories.length === 0 ? <p className="mt-4 text-sm text-black/35">За период расходов нет.</p> : <div className="mt-3 divide-y divide-black/[0.06]">{summary.categories.slice(0, 8).map((item) => <div key={item.categoryId} className="flex items-center justify-between gap-3 py-2.5 text-sm"><span className="min-w-0 truncate text-black/55">{item.category}</span><strong className="shrink-0">{money(item.amount)}</strong></div>)}</div>}
                  </div>
                </div>
                {summary.pendingCount > 0 && <div className="mt-3 rounded-[16px] bg-amber-50 px-4 py-3 text-sm text-amber-800">Ждут вашего подтверждения: <strong>{summary.pendingCount}</strong> · {money(summary.pendingAmount)}. Подтвердить их можно в разделе «Бизнес».</div>}
              </section>
            )}

            <div className="mt-6 grid gap-5 lg:grid-cols-[0.9fr_1.1fr]">
              <section className="rounded-[26px] border border-black/[0.06] bg-white p-5 sm:p-6">
                <div className="flex items-center gap-3"><span className="grid h-11 w-11 place-items-center rounded-[15px] bg-[#D96A24]/10 text-[#C95320]"><Plus size={20}/></span><div><h3 className="font-semibold">{isOwner ? "Внести расход" : "Добавить расход"}</h3><p className="mt-0.5 text-xs text-black/40">{isOwner ? "Без самоутверждения" : "Обычно меньше минуты"}</p></div></div>

                {isOwner && (
                  <div className="mt-5 grid grid-cols-3 gap-2">
                    {([['branch','Филиал'],['common','Общий'],['distributed','Распределить']] as Array<[ExpenseAllocationType,string]>).map(([value,label]) => <button key={value} type="button" onClick={() => { setAllocationType(value); setDistribution({}); }} className={`rounded-[13px] px-2 py-3 text-xs font-semibold ${allocationType === value ? "bg-[#171717] text-white" : "bg-[#FAF9F5] text-black/50"}`}>{label}</button>)}
                  </div>
                )}

                <div className="mt-5 space-y-4">
                  {(!isOwner || allocationType === "branch") && <label className="block text-xs font-semibold text-black/55">Филиал
                    <select className={inputClass} value={branchId} disabled={myBranchLocked} onChange={(event) => setBranchId(event.target.value)}>
                      <option value="">Выберите филиал</option>
                      {context?.branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}
                    </select>
                  </label>}

                  <label className="block text-xs font-semibold text-black/55">Категория
                    <select className={inputClass} value={categoryId} onChange={(event) => {
                      const value = event.target.value;
                      if (value === "__payroll__") {
                        setOpen(false);
                        window.setTimeout(() => openAdminSection("payroll"), 0);
                        return;
                      }
                      setCategoryId(value);
                    }}>
                      <option value="">Выберите категорию</option>
                      {isOwner ? context?.categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>) : (
                        <>
                          {visibleCategories.filter((category) => category.code !== "client_change").map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
                          <option value="__payroll__">Зарплата педагогам</option>
                          {visibleCategories.filter((category) => category.code === "client_change").map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
                        </>
                      )}
                    </select>
                    {!isOwner && <span className="mt-1.5 block text-[11px] text-black/30">Зарплата педагогам оформляется отдельным блоком с педагогом и неделей.</span>}
                  </label>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="block text-xs font-semibold text-black/55">Сумма, ₽<input className={inputClass} inputMode="decimal" value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="3500"/></label>
                    <label className="block text-xs font-semibold text-black/55">Дата расхода<input className={inputClass} type="date" value={expenseDate} onChange={(event) => setExpenseDate(event.target.value)}/></label>
                  </div>

                  <label className="block text-xs font-semibold text-black/55">Как оплачено
                    <select className={inputClass} value={paymentMethod} onChange={(event) => setPaymentMethod(event.target.value as ExpensePaymentMethod)}>
                      {Object.entries(paymentLabels).map(([value,label]) => <option key={value} value={value}>{label}</option>)}
                    </select>
                  </label>

                  {isOwner && <label className="block text-xs font-semibold text-black/55">Счёт / касса
                    <select className={inputClass} value={accountId} onChange={(event) => setAccountId(event.target.value)}><option value="">Не указывать</option>{context?.accounts.map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}</select>
                  </label>}

                  {isOwner && allocationType === "distributed" && (
                    <div className="rounded-[18px] bg-[#F6F5EF] p-4">
                      <div className="flex flex-wrap items-center justify-between gap-2"><div><p className="text-sm font-semibold">Распределение по филиалам</p><p className="mt-1 text-[11px] text-black/35">Общий платёж останется одной строкой ДДС, а для аналитики сумма разложится по филиалам.</p></div><button type="button" onClick={distributeEqually} className="rounded-full bg-white px-3 py-2 text-[11px] font-semibold text-[#4D512E]">Поровну</button></div>
                      <div className="mt-3 flex gap-2"><button type="button" onClick={() => { setDistributionMode("amount"); setDistribution({}); }} className={`rounded-full px-3 py-1.5 text-[10px] font-semibold ${distributionMode === "amount" ? "bg-[#171717] text-white" : "bg-white text-black/45"}`}>Суммами</button><button type="button" onClick={() => { setDistributionMode("percent"); setDistribution({}); }} className={`rounded-full px-3 py-1.5 text-[10px] font-semibold ${distributionMode === "percent" ? "bg-[#171717] text-white" : "bg-white text-black/45"}`}>Процентами</button></div>
                      <div className="mt-3 space-y-2">{context?.branches.map((branch) => <label key={branch.id} className="grid grid-cols-[1fr_120px] items-center gap-3 rounded-[12px] bg-white px-3 py-2 text-xs"><span className="font-medium">{branch.name}</span><div className="relative"><input inputMode="decimal" value={distribution[branch.id] || ""} onChange={(event) => setDistribution((current) => ({ ...current, [branch.id]: event.target.value }))} placeholder="0" className="w-full rounded-[10px] border border-black/[0.07] px-3 py-2 pr-7 text-right outline-none"/><span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-black/30">{distributionMode === "percent" ? "%" : "₽"}</span></div></label>)}</div>
                    </div>
                  )}

                  <label className="block text-xs font-semibold text-black/55">Комментарий<textarea className={`${inputClass} min-h-[90px] resize-none`} value={description} onChange={(event) => setDescription(event.target.value)} placeholder={isOwner ? "Например: аренда, реклама или закупка" : "Например: бытовая химия или инвентарь"}/></label>

                  <label className="block text-xs font-semibold text-black/55">Чек или подтверждающий файл
                    <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp,application/pdf" className="hidden" onChange={(event) => setReceipt(event.target.files?.[0] || null)}/>
                    <button type="button" onClick={() => fileRef.current?.click()} className="mt-1.5 flex w-full items-center justify-center gap-2 rounded-[14px] border border-dashed border-black/[0.14] bg-[#FAF9F5] px-4 py-4 text-sm font-semibold text-black/65">{receipt ? <><Paperclip size={17}/>{receipt.name}</> : <><Upload size={17}/>Прикрепить чек</>}</button>
                    <span className="mt-2 block text-[11px] text-black/35">JPG, PNG, WEBP или PDF · до 10 МБ</span>
                  </label>

                  <button type="button" disabled={saving} onClick={() => void (isOwner ? createOwnerExpense() : createStaffExpense())} className="flex w-full items-center justify-center gap-2 rounded-[15px] bg-[#171717] px-5 py-4 text-sm font-semibold text-white shadow-sm disabled:opacity-50">{saving ? <LoaderCircle className="animate-spin" size={18}/> : <ReceiptText size={18}/>} {isOwner ? "Провести в ДДС" : "Отправить владельцу"}</button>
                </div>
              </section>

              <section className="rounded-[26px] border border-black/[0.06] bg-white p-5 sm:p-6">
                <div className="flex items-center justify-between gap-3"><div><h3 className="font-semibold">{isOwner ? "Последние расходы ДДС" : "Последние расходы"}</h3><p className="mt-1 text-xs text-black/40">{isOwner ? "Из всех источников" : "Только доступные вашей роли и филиалу"}</p></div><span className="rounded-full bg-black/[0.05] px-3 py-1.5 text-xs font-semibold text-black/50">{isOwner ? ownerCashflow.length : recent.length}</span></div>

                {isOwner ? (
                  ownerCashflow.length === 0 ? <div className="grid min-h-[260px] place-items-center text-center text-sm text-black/35">Расходов пока нет.</div> : <div className="mt-4 max-h-[640px] divide-y divide-black/[0.06] overflow-y-auto pr-1">{ownerCashflow.map((item) => <article key={item.id} className="py-3.5"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="truncate text-sm font-semibold">{item.description || item.categoryName || "Расход"}</p><p className="mt-1 text-xs text-black/35">{item.branchName || "Общий / распределённый"} · {shortDate(item.transactionDate)} · {item.accountName || "счёт не указан"}</p></div><strong className="shrink-0 text-sm text-red-600">−{money(item.amount)}</strong></div></article>)}</div>
                ) : recent.length === 0 ? (
                  <div className="grid min-h-[260px] place-items-center text-center text-sm text-black/35">Расходов пока нет.</div>
                ) : (
                  <div className="mt-4 max-h-[640px] space-y-3 overflow-y-auto pr-1">
                    {recent.map((expense) => <article key={expense.id} className="rounded-[20px] border border-black/[0.06] bg-[#FAF9F5] p-4"><div className="flex items-start justify-between gap-3"><div><p className="font-semibold">{expense.categoryName}</p><p className="mt-1 text-xs text-black/40">{expense.branchName} · {shortDate(expense.expenseDate)} · {expense.requesterName}</p></div><p className="shrink-0 text-lg font-semibold">{money(expense.amount)}</p></div>{expense.description && <p className="mt-3 text-sm leading-5 text-black/60">{expense.description}</p>}<div className="mt-3 flex flex-wrap items-center gap-2"><span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${expense.status === "approved" ? "bg-[#5F6338]/10 text-[#4D512E]" : expense.status === "rejected" ? "bg-red-50 text-red-600" : expense.status === "submitted" ? "bg-[#D96A24]/10 text-[#C95320]" : "bg-black/[0.05] text-black/50"}`}>{statusLabel[expense.status] || expense.status}</span>{expense.attachments.map((attachment) => <button key={attachment.id} type="button" onClick={() => void openExpenseReceipt(attachment).catch((reason) => setError(reason instanceof Error ? reason.message : "Не удалось открыть чек."))} className="flex items-center gap-1.5 rounded-full bg-white px-2.5 py-1 text-[11px] font-semibold text-black/60"><FileText size={13}/>Чек</button>)}{expense.status === "submitted" && expense.attachments.length === 0 && <label className="cursor-pointer rounded-full bg-white px-2.5 py-1 text-[11px] font-semibold text-[#C95320]">+ Добавить чек<input type="file" accept="image/jpeg,image/png,image/webp,application/pdf" className="hidden" onChange={(event) => { const file = event.target.files?.[0]; if (file) void retryReceipt(expense, file); event.currentTarget.value = ""; }}/></label>}</div>{expense.status === "approved" && <div className="mt-3 flex items-center gap-2 text-xs font-medium text-[#4D512E]"><CheckCircle2 size={15}/>Операция уже попала в ДДС</div>}{expense.reviewComment && <p className="mt-3 rounded-[12px] bg-white px-3 py-2 text-xs text-black/50">Комментарий владельца: {expense.reviewComment}</p>}</article>)}
                  </div>
                )}
              </section>
            </div>
          </>
        )}

        {error && <div className="mt-5 rounded-[16px] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
        {success && <div className="mt-5 flex gap-2 rounded-[16px] bg-[#5F6338]/[0.08] px-4 py-3 text-sm text-[#4D512E]"><CheckCircle2 className="mt-0.5 shrink-0" size={17}/>{success}</div>}
        {isOwner && <div className="mt-5 flex items-start gap-2 rounded-[15px] bg-white px-4 py-3 text-xs leading-5 text-black/40"><WalletCards className="mt-0.5 shrink-0" size={15}/><span>Филиальный расход учитывается целиком в выбранном филиале. «Общий» остаётся отдельным расходом OPEN STARS. «Распределить» создаёт одну реальную операцию ДДС и аналитически делит её между филиалами.</span></div>}
      </div>
    </div>
  );
}
