import { useEffect, useMemo, useState } from "react";
import { Check, FileText, LoaderCircle, Pencil, RefreshCw, Target, TrendingDown, TrendingUp, WalletCards, X, XCircle } from "lucide-react";

import { onAdminSection } from "@/admin/adminNavigation";
import {
  approveExpense,
  BusinessExpenseContext,
  ExpenseRequest,
  fetchBusinessExpenseContext,
  openExpenseReceipt,
  rejectExpense,
} from "@/admin/businessApi";
import { BranchGoal, fetchOwnerBranchGoals, setOwnerBranchTarget } from "@/admin/businessGoalsApi";

function money(value: number) {
  return new Intl.NumberFormat("ru-RU", { style: "currency", currency: "RUB", maximumFractionDigits: 0 }).format(value || 0);
}

function monthStartIso() {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-01`;
}

function dateLabel(value: string) {
  if (!value) return "";
  const date = new Date(`${value.slice(0, 10)}T12:00:00`);
  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "short", year: "numeric" }).format(date).replace(".", "");
}

function PendingExpenseCard({
  expense,
  accounts,
  busy,
  onApprove,
  onReject,
  onOpenReceipt,
}: {
  expense: ExpenseRequest;
  accounts: BusinessExpenseContext["accounts"];
  busy: boolean;
  onApprove: (expense: ExpenseRequest, accountId: string, comment: string) => void;
  onReject: (expense: ExpenseRequest, comment: string) => void;
  onOpenReceipt: (expense: ExpenseRequest) => void;
}) {
  const [accountId, setAccountId] = useState("");
  const [comment, setComment] = useState("");

  return (
    <article className="rounded-[22px] border border-black/[0.06] bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#D96A24]">{expense.branchName}</p>
          <h3 className="mt-1 text-lg font-semibold">{expense.categoryName}</h3>
          <p className="mt-1 text-xs text-black/40">{dateLabel(expense.expenseDate)} · {expense.requesterName}</p>
        </div>
        <p className="shrink-0 text-xl font-semibold tracking-[-0.04em]">{money(expense.amount)}</p>
      </div>

      {expense.description && <p className="mt-4 text-sm leading-6 text-black/60">{expense.description}</p>}

      <div className="mt-4 flex flex-wrap gap-2">
        {expense.attachments.length > 0 ? (
          <button type="button" onClick={() => onOpenReceipt(expense)} className="flex items-center gap-2 rounded-full bg-[#FAF9F5] px-3 py-2 text-xs font-semibold text-black/65"><FileText size={15} />Открыть чек</button>
        ) : (
          <span className="rounded-full bg-red-50 px-3 py-2 text-xs font-semibold text-red-600">Чек не приложен</span>
        )}
      </div>

      {accounts.length > 0 && (
        <label className="mt-4 block text-xs font-semibold text-black/50">Счёт / касса
          <select value={accountId} onChange={(event) => setAccountId(event.target.value)} className="mt-1.5 w-full rounded-[13px] border border-black/[0.08] bg-[#FAF9F5] px-3.5 py-3 text-sm outline-none">
            <option value="">Не указывать сейчас</option>
            {accounts.map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}
          </select>
        </label>
      )}

      <label className="mt-4 block text-xs font-semibold text-black/50">Комментарий владельца
        <input value={comment} onChange={(event) => setComment(event.target.value)} placeholder="Необязательно" className="mt-1.5 w-full rounded-[13px] border border-black/[0.08] bg-[#FAF9F5] px-3.5 py-3 text-sm outline-none" />
      </label>

      <div className="mt-4 grid grid-cols-2 gap-2">
        <button type="button" disabled={busy} onClick={() => onReject(expense, comment)} className="flex items-center justify-center gap-2 rounded-[14px] border border-red-200 bg-red-50 px-4 py-3.5 text-sm font-semibold text-red-700 disabled:opacity-50"><XCircle size={17} />Отклонить</button>
        <button type="button" disabled={busy} onClick={() => onApprove(expense, accountId, comment)} className="flex items-center justify-center gap-2 rounded-[14px] bg-[#171717] px-4 py-3.5 text-sm font-semibold text-white disabled:opacity-50">{busy ? <LoaderCircle className="animate-spin" size={17} /> : <Check size={17} />}Подтвердить</button>
      </div>
    </article>
  );
}

function GoalCard({ goal, busy, onEdit }: { goal: BranchGoal; busy: boolean; onEdit: (goal: BranchGoal) => void }) {
  const width = Math.min(Math.max(goal.progress, 0), 100);
  const complete = goal.activeStudents >= goal.target;
  return (
    <article className="rounded-[22px] border border-black/[0.05] bg-white p-5">
      <div className="flex items-start justify-between gap-3">
        <div><p className="text-xs font-semibold text-black/40">{goal.branch}</p><p className="mt-2 text-3xl font-semibold tracking-[-0.05em]">{goal.activeStudents} <span className="text-lg text-black/25">/ {goal.target}</span></p></div>
        <button type="button" disabled={busy} onClick={() => onEdit(goal)} className="grid h-9 w-9 place-items-center rounded-full bg-[#FAF9F5] text-black/45 disabled:opacity-50" title="Изменить цель"><Pencil size={15} /></button>
      </div>
      <div className="mt-4 h-2 overflow-hidden rounded-full bg-black/[0.06]"><div className="h-full rounded-full bg-[#5F6338] transition-all" style={{ width: `${width}%` }} /></div>
      <div className="mt-3 flex items-center justify-between gap-3 text-xs">
        <span className={complete ? "font-semibold text-[#4D512E]" : "text-[#C95320]"}>{complete ? (goal.overTarget > 0 ? `+${goal.overTarget} сверх цели` : "Цель выполнена ✓") : `Не хватает ${goal.missing}`}</span>
        <span className="font-semibold text-black/35">{Math.round(goal.progress)}%</span>
      </div>
    </article>
  );
}

export function OwnerBusinessDashboard() {
  const [open, setOpen] = useState(false);
  const [context, setContext] = useState<BusinessExpenseContext | null>(null);
  const [goals, setGoals] = useState<BranchGoal[]>([]);
  const [branchFilter, setBranchFilter] = useState("Все филиалы");
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState("");
  const [goalBusy, setGoalBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function refresh() {
    const [next, nextGoals] = await Promise.all([fetchBusinessExpenseContext(), fetchOwnerBranchGoals()]);
    if (next.role !== "owner") throw new Error("Бизнес-финансы доступны только владельцу.");
    setContext(next);
    setGoals(nextGoals);
    return next;
  }

  useEffect(() => onAdminSection("business", () => {
    setOpen(true);
    setError("");
    setSuccess("");
    setLoading(true);
    void refresh().catch((reason) => setError(reason instanceof Error ? reason.message : "Не удалось открыть бизнес-панель.")).finally(() => setLoading(false));
  }), []);

  const requests = useMemo(() => (context?.requests || []).filter((item) => branchFilter === "Все филиалы" || item.branchName === branchFilter), [context, branchFilter]);
  const cashflow = useMemo(() => (context?.cashflow || []).filter((item) => branchFilter === "Все филиалы" || item.branchName === branchFilter), [context, branchFilter]);
  const pending = useMemo(() => requests.filter((item) => item.status === "submitted"), [requests]);
  const pendingAmount = useMemo(() => pending.reduce((sum, item) => sum + item.amount, 0), [pending]);
  const monthStart = monthStartIso();
  const incomeThisMonth = useMemo(() => cashflow.filter((item) => item.direction === "income" && item.transactionDate >= monthStart).reduce((sum, item) => sum + item.amount, 0), [cashflow, monthStart]);
  const expenseThisMonth = useMemo(() => cashflow.filter((item) => item.direction === "expense" && item.transactionDate >= monthStart).reduce((sum, item) => sum + item.amount, 0), [cashflow, monthStart]);
  const netCashflow = incomeThisMonth - expenseThisMonth;

  async function processApprove(expense: ExpenseRequest, accountId: string, comment: string) {
    setBusyId(expense.id);
    setError("");
    setSuccess("");
    try {
      await approveExpense(expense.id, accountId, comment);
      await refresh();
      setSuccess(`Расход ${money(expense.amount)} подтверждён и добавлен в ДДС.`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Не удалось подтвердить расход.");
    } finally {
      setBusyId("");
    }
  }

  async function processReject(expense: ExpenseRequest, comment: string) {
    if (!window.confirm(`Отклонить расход ${money(expense.amount)} · ${expense.categoryName}?`)) return;
    setBusyId(expense.id);
    setError("");
    setSuccess("");
    try {
      await rejectExpense(expense.id, comment);
      await refresh();
      setSuccess("Расход отклонён. В ДДС он не попал.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Не удалось отклонить расход.");
    } finally {
      setBusyId("");
    }
  }

  async function openReceipt(expense: ExpenseRequest) {
    const attachment = expense.attachments[0];
    if (!attachment) return;
    try {
      await openExpenseReceipt(attachment);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Не удалось открыть чек.");
    }
  }

  async function editGoal(goal: BranchGoal) {
    const raw = window.prompt(`Цель по ученикам · ${goal.branch}`, String(goal.target));
    if (raw === null) return;
    const target = Number(raw.replace(/\s/g, ""));
    if (!Number.isInteger(target) || target <= 0) return setError("Цель должна быть целым числом больше нуля.");
    setGoalBusy(true);
    setError("");
    setSuccess("");
    try {
      await setOwnerBranchTarget(goal.branchId, target);
      await refresh();
      setSuccess(`Цель ${goal.branch} обновлена: ${target} учеников.`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Не удалось изменить цель.");
    } finally {
      setGoalBusy(false);
    }
  }

  if (!open) return null;

  const branchOptions = ["Все филиалы", ...(context?.branches.map((item) => item.name) || [])];

  return (
    <div className="fixed inset-0 z-[85] flex items-end justify-center bg-black/35 backdrop-blur-[2px] sm:items-center sm:p-5" onClick={() => !busyId && !goalBusy && setOpen(false)}>
      <div className="max-h-[96vh] w-full max-w-7xl overflow-y-auto rounded-t-[30px] bg-[#F7F5EF] p-5 shadow-2xl sm:rounded-[30px] sm:p-7" onClick={(event) => event.stopPropagation()}>
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#D96A24]">OPEN STARS · OWNER</p>
            <h2 className="mt-1 text-2xl font-semibold tracking-[-0.03em]">Бизнес</h2>
            <p className="mt-2 text-sm text-black/45">Три филиала работают отдельно. Ваш ДДС — один общий, с разрезом по филиалам.</p>
          </div>
          <div className="flex gap-2">
            <button type="button" disabled={loading || Boolean(busyId) || goalBusy} onClick={() => { setLoading(true); void refresh().catch((reason) => setError(reason instanceof Error ? reason.message : "Не удалось обновить данные.")).finally(() => setLoading(false)); }} className="grid h-10 w-10 place-items-center rounded-full bg-white shadow-sm disabled:opacity-50"><RefreshCw size={18} className={loading ? "animate-spin" : ""} /></button>
            <button type="button" onClick={() => setOpen(false)} className="grid h-10 w-10 place-items-center rounded-full bg-white shadow-sm"><X size={20} /></button>
          </div>
        </div>

        {loading && !context ? <div className="grid min-h-[420px] place-items-center"><LoaderCircle className="animate-spin text-black/25" size={30} /></div> : (
          <>
            <div className="mt-5 flex flex-wrap gap-2">
              {branchOptions.map((branch) => <button key={branch} type="button" onClick={() => setBranchFilter(branch)} className={`rounded-full px-3.5 py-2 text-xs font-semibold transition ${branchFilter === branch ? "bg-[#171717] text-white" : "bg-white text-black/50"}`}>{branch}</button>)}
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-[22px] border border-black/[0.05] bg-white p-5"><div className="flex items-center gap-2 text-[#4D512E]"><TrendingUp size={16} /><p className="text-xs font-semibold">Поступления за месяц</p></div><p className="mt-2 text-3xl font-semibold tracking-[-0.05em]">{money(incomeThisMonth)}</p><p className="mt-2 text-xs text-black/35">{branchFilter}</p></div>
              <div className="rounded-[22px] border border-black/[0.05] bg-white p-5"><div className="flex items-center gap-2 text-red-600"><TrendingDown size={16} /><p className="text-xs font-semibold">Расходы за месяц</p></div><p className="mt-2 text-3xl font-semibold tracking-[-0.05em]">{money(expenseThisMonth)}</p><p className="mt-2 text-xs text-black/35">подтверждённые операции</p></div>
              <div className="rounded-[22px] border border-black/[0.05] bg-[#171717] p-5 text-white"><div className="flex items-center gap-2 text-white/55"><WalletCards size={16} /><p className="text-xs font-semibold">Денежный поток месяца</p></div><p className="mt-2 text-3xl font-semibold tracking-[-0.05em]">{money(netCashflow)}</p><p className="mt-2 text-xs text-white/40">поступления − расходы, не бухгалтерская прибыль</p></div>
              <div className="rounded-[22px] border border-black/[0.05] bg-white p-5"><p className="text-xs font-semibold text-black/40">Ожидает подтверждения</p><p className="mt-2 text-3xl font-semibold tracking-[-0.05em]">{money(pendingAmount)}</p><p className="mt-2 text-xs text-[#C95320]">{pending.length} {pending.length === 1 ? "расход" : "расходов"}</p></div>
            </div>

            <section className="mt-6">
              <div className="flex items-center gap-2"><Target size={18} className="text-[#D96A24]" /><div><p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#D96A24]">Наполняемость</p><h3 className="mt-0.5 text-xl font-semibold">Цель по ученикам</h3></div></div>
              <div className="mt-4 grid gap-3 md:grid-cols-3">{goals.map((goal) => <GoalCard key={goal.branchId} goal={goal} busy={goalBusy} onEdit={(item) => void editGoal(item)} />)}</div>
            </section>

            <div className="mt-6 grid gap-5 lg:grid-cols-[1.05fr_0.95fr]">
              <section>
                <div className="flex items-end justify-between"><div><p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#D96A24]">Требует внимания</p><h3 className="mt-1 text-xl font-semibold">На подтверждение</h3></div><span className="rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-black/45">{pending.length}</span></div>
                {pending.length === 0 ? <div className="mt-4 grid min-h-[260px] place-items-center rounded-[24px] border border-black/[0.05] bg-white text-center"><div><Check className="mx-auto text-[#5F6338]" size={28} /><p className="mt-3 font-semibold">Все расходы обработаны</p><p className="mt-1 text-sm text-black/40">Новых заявок по выбранному фильтру нет.</p></div></div> : <div className="mt-4 space-y-3">{pending.map((expense) => <PendingExpenseCard key={expense.id} expense={expense} accounts={context?.accounts || []} busy={busyId === expense.id} onApprove={(item, accountId, comment) => void processApprove(item, accountId, comment)} onReject={(item, comment) => void processReject(item, comment)} onOpenReceipt={(item) => void openReceipt(item)} />)}</div>}
              </section>

              <section className="rounded-[26px] border border-black/[0.05] bg-white p-5 sm:p-6">
                <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-black/35">Единый ДДС</p>
                <h3 className="mt-1 text-xl font-semibold">Последние операции</h3>
                <p className="mt-2 text-sm leading-6 text-black/40">Оплаты детей и подтверждённые расходы всех филиалов сходятся сюда автоматически. Филиал сохраняется у каждой операции.</p>
                {cashflow.length === 0 ? <div className="grid min-h-[260px] place-items-center text-center text-sm text-black/35">Операций по выбранному фильтру пока нет.</div> : (
                  <div className="mt-4 max-h-[620px] divide-y divide-black/[0.06] overflow-y-auto">
                    {cashflow.slice(0, 80).map((item) => {
                      const income = item.direction === "income";
                      return <div key={item.id} className="py-4"><div className="flex items-start justify-between gap-3"><div><p className="text-sm font-semibold">{income ? (item.description || "Поступление") : (item.categoryName || item.description || "Расход")}</p><p className="mt-1 text-xs text-black/40">{item.branchName || "Общий OPEN STARS"} · {dateLabel(item.transactionDate)}</p></div><p className={`shrink-0 font-semibold ${income ? "text-[#4D512E]" : "text-red-600"}`}>{income ? "+" : "−"} {money(item.amount)}</p></div>{!income && item.description && <p className="mt-2 text-xs leading-5 text-black/45">{item.description}</p>}{item.accountName && <p className="mt-1 text-[11px] text-black/30">{item.accountName}</p>}</div>;
                    })}
                  </div>
                )}
              </section>
            </div>
          </>
        )}

        {error && <div className="mt-5 rounded-[16px] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
        {success && <div className="mt-5 rounded-[16px] bg-[#5F6338]/[0.08] px-4 py-3 text-sm text-[#4D512E]">{success}</div>}
      </div>
    </div>
  );
}
