import { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  CreditCard,
  LoaderCircle,
  RefreshCw,
  Target,
  TrendingDown,
  TrendingUp,
  UserCheck,
  UsersRound,
  WalletCards,
} from "lucide-react";

import { AdminChild } from "@/admin/adminApi";
import { BusinessExpenseContext, fetchBusinessExpenseContext } from "@/admin/businessApi";
import { BranchGoal, fetchOwnerBranchGoals } from "@/admin/businessGoalsApi";

type Props = {
  children: AdminChild[];
  onOpenStudents: () => void;
  onOpenPayments: () => void;
  onOpenBusiness: () => void;
};

function money(value: number) {
  return new Intl.NumberFormat("ru-RU", {
    style: "currency",
    currency: "RUB",
    maximumFractionDigits: 0,
  }).format(value || 0);
}

function monthStartIso() {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-01`;
}

function todayLabel() {
  return new Intl.DateTimeFormat("ru-RU", {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(new Date());
}

function monthTrend(cashflow: BusinessExpenseContext["cashflow"]) {
  const now = new Date();
  return Array.from({ length: 6 }, (_, index) => {
    const date = new Date(now.getFullYear(), now.getMonth() - (5 - index), 1);
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
    const label = new Intl.DateTimeFormat("ru-RU", { month: "short" }).format(date).replace(".", "");
    const value = cashflow
      .filter((item) => item.direction === "income" && item.transactionDate.slice(0, 7) === key)
      .reduce((sum, item) => sum + item.amount, 0);
    return { key, label, value };
  });
}

function childNeedsProfile(child: AdminChild) {
  return !child.birthDate || !child.photoUrl || !child.branch || !child.groupName || !child.lessonDay || !child.lessonTime;
}

function KpiCard({
  label,
  value,
  hint,
  tone = "default",
  icon,
}: {
  label: string;
  value: string;
  hint: string;
  tone?: "default" | "dark" | "positive" | "warning";
  icon: React.ReactNode;
}) {
  const toneClass =
    tone === "dark"
      ? "bg-[#171717] text-white border-black"
      : tone === "positive"
        ? "bg-[#5F6338]/[0.075] border-[#5F6338]/15"
        : tone === "warning"
          ? "bg-[#D96A24]/[0.065] border-[#D96A24]/15"
          : "bg-white border-black/[0.05]";
  const secondary = tone === "dark" ? "text-white/45" : "text-black/38";

  return (
    <article className={`rounded-[22px] border p-5 shadow-[0_8px_30px_rgba(0,0,0,0.03)] ${toneClass}`}>
      <div className={`flex items-center gap-2 text-xs font-semibold ${secondary}`}>{icon}{label}</div>
      <p className="mt-3 text-[28px] font-semibold tracking-[-0.05em] sm:text-3xl">{value}</p>
      <p className={`mt-2 text-xs leading-5 ${secondary}`}>{hint}</p>
    </article>
  );
}

export function OwnerHomeDashboard({ children, onOpenStudents, onOpenPayments, onOpenBusiness }: Props) {
  const [context, setContext] = useState<BusinessExpenseContext | null>(null);
  const [goals, setGoals] = useState<BranchGoal[]>([]);
  const [branchFilter, setBranchFilter] = useState("Все филиалы");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function refresh() {
    setError("");
    setLoading(true);
    try {
      const [nextContext, nextGoals] = await Promise.all([
        fetchBusinessExpenseContext(),
        fetchOwnerBranchGoals(),
      ]);
      if (nextContext.role !== "owner") throw new Error("Главный дашборд доступен только владельцу.");
      setContext(nextContext);
      setGoals(nextGoals);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Не удалось загрузить дашборд.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void refresh(); }, []);

  const visibleGoals = useMemo(
    () => goals.filter((goal) => branchFilter === "Все филиалы" || goal.branch === branchFilter),
    [goals, branchFilter]
  );
  const visibleChildren = useMemo(
    () => children.filter((child) => branchFilter === "Все филиалы" || child.branch === branchFilter),
    [children, branchFilter]
  );
  const activeChildren = useMemo(() => visibleChildren.filter((child) => !child.archivedAt), [visibleChildren]);
  const filteredCashflow = useMemo(
    () => (context?.cashflow || []).filter((item) => branchFilter === "Все филиалы" || item.branchName === branchFilter),
    [context, branchFilter]
  );
  const filteredRequests = useMemo(
    () => (context?.requests || []).filter((item) => branchFilter === "Все филиалы" || item.branchName === branchFilter),
    [context, branchFilter]
  );

  const monthStart = monthStartIso();
  const incomeThisMonth = useMemo(
    () => filteredCashflow.filter((item) => item.direction === "income" && item.transactionDate >= monthStart).reduce((sum, item) => sum + item.amount, 0),
    [filteredCashflow, monthStart]
  );
  const expenseThisMonth = useMemo(
    () => filteredCashflow.filter((item) => item.direction === "expense" && item.transactionDate >= monthStart).reduce((sum, item) => sum + item.amount, 0),
    [filteredCashflow, monthStart]
  );
  const pending = useMemo(() => filteredRequests.filter((item) => item.status === "submitted"), [filteredRequests]);
  const pendingAmount = useMemo(() => pending.reduce((sum, item) => sum + item.amount, 0), [pending]);
  const overdueChildren = useMemo(() => activeChildren.filter((child) => child.paymentStatus === "overdue"), [activeChildren]);
  const inactiveParents = useMemo(() => activeChildren.filter((child) => child.activationStatus !== "active"), [activeChildren]);
  const incompleteCards = useMemo(() => activeChildren.filter(childNeedsProfile), [activeChildren]);
  const archivedThisMonth = useMemo(() => visibleChildren.filter((child) => child.archivedAt && child.archivedAt.slice(0, 10) >= monthStart).length, [visibleChildren, monthStart]);
  const activeParents = useMemo(() => activeChildren.filter((child) => child.activationStatus === "active").length, [activeChildren]);
  const groupsCount = useMemo(() => new Set(activeChildren.map((child) => `${child.branch}:${child.groupName}`).filter((value) => !value.endsWith(":"))).size, [activeChildren]);

  const targetTotal = visibleGoals.reduce((sum, goal) => sum + goal.target, 0);
  const activeTotalFromGoals = visibleGoals.reduce((sum, goal) => sum + goal.activeStudents, 0);
  const activeTotal = visibleGoals.length ? activeTotalFromGoals : activeChildren.length;
  const missingTotal = Math.max(targetTotal - activeTotal, 0);
  const schoolProgress = targetTotal > 0 ? Math.min((activeTotal / targetTotal) * 100, 100) : 0;
  const netCashflow = incomeThisMonth - expenseThisMonth;
  const parentActivationPercent = activeChildren.length ? Math.round((activeParents / activeChildren.length) * 100) : 0;
  const trend = useMemo(() => monthTrend(filteredCashflow), [filteredCashflow]);
  const trendMax = Math.max(...trend.map((item) => item.value), 1);

  const branchOptions = ["Все филиалы", ...(context?.branches.map((item) => item.name) || [])];
  const attention = [
    pending.length > 0 ? { key: "pending", label: "Расходы ждут вашего подтверждения", value: `${pending.length} · ${money(pendingAmount)}`, action: onOpenBusiness } : null,
    overdueChildren.length > 0 ? { key: "overdue", label: "Ученики со статусом «Просрочено»", value: String(overdueChildren.length), action: onOpenPayments } : null,
    inactiveParents.length > 0 ? { key: "inactive", label: "Родители ещё не активировали доступ", value: String(inactiveParents.length), action: onOpenStudents } : null,
    incompleteCards.length > 0 ? { key: "cards", label: "Карточки учеников нужно дозаполнить", value: String(incompleteCards.length), action: onOpenStudents } : null,
  ].filter(Boolean) as Array<{ key: string; label: string; value: string; action: () => void }>;

  return (
    <div>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#D96A24]">OPEN STARS · OWNER</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-[-0.035em] sm:text-3xl">Главная</h1>
          <p className="mt-2 text-sm capitalize text-black/40">{todayLabel()} · картина бизнеса на сейчас</p>
        </div>
        <button type="button" onClick={() => void refresh()} disabled={loading} className="flex items-center justify-center gap-2 self-start rounded-full border border-black/[0.06] bg-white px-4 py-2.5 text-xs font-semibold text-black/55 shadow-sm disabled:opacity-50">
          {loading ? <LoaderCircle className="animate-spin" size={16} /> : <RefreshCw size={16} />} Обновить
        </button>
      </div>

      <div className="mt-5 flex gap-2 overflow-x-auto pb-1">
        {branchOptions.map((branch) => (
          <button key={branch} type="button" onClick={() => setBranchFilter(branch)} className={`shrink-0 rounded-full px-3.5 py-2 text-xs font-semibold transition ${branchFilter === branch ? "bg-[#171717] text-white" : "bg-white text-black/50"}`}>
            {branch}
          </button>
        ))}
      </div>

      {error && <div className="mt-4 rounded-[16px] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

      <section className="mt-5 overflow-hidden rounded-[26px] border border-[#5F6338]/15 bg-[#F0F0E9] p-5 sm:p-6">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="flex items-center gap-2 text-[#4D512E]"><Target size={18} /><p className="text-xs font-bold uppercase tracking-[0.14em]">Ученики и цель</p></div>
            <p className="mt-3 text-[38px] font-semibold tracking-[-0.06em] sm:text-5xl">{activeTotal} <span className="text-xl text-black/25 sm:text-2xl">/ {targetTotal || "—"}</span></p>
            <p className="mt-2 text-sm text-black/45">{missingTotal > 0 ? `До цели не хватает ${missingTotal}` : targetTotal > 0 ? "Общая цель выполнена" : "Цели пока не заданы"} · {branchFilter}</p>
          </div>
          <button type="button" onClick={onOpenStudents} className="flex items-center gap-2 self-start rounded-full bg-white px-4 py-2.5 text-xs font-semibold text-black/60 shadow-sm sm:self-auto">Открыть учеников <ArrowRight size={15} /></button>
        </div>
        <div className="mt-5 h-2.5 overflow-hidden rounded-full bg-black/[0.07]"><div className="h-full rounded-full bg-[#5F6338] transition-all" style={{ width: `${schoolProgress}%` }} /></div>
        {targetTotal > 0 && <p className="mt-2 text-right text-xs font-semibold text-black/35">{Math.round((activeTotal / targetTotal) * 100)}%</p>}
      </section>

      <section className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Поступления за месяц" value={money(incomeThisMonth)} hint={branchFilter} tone="positive" icon={<TrendingUp size={16} />} />
        <KpiCard label="Расходы за месяц" value={money(expenseThisMonth)} hint="подтверждённые операции" icon={<TrendingDown size={16} />} />
        <KpiCard label="Денежный поток" value={money(netCashflow)} hint="поступления − расходы, не бухгалтерская прибыль" tone="dark" icon={<WalletCards size={16} />} />
        <KpiCard label="На подтверждении" value={money(pendingAmount)} hint={`${pending.length} ${pending.length === 1 ? "расход" : "расходов"}`} tone={pending.length ? "warning" : "default"} icon={<AlertCircle size={16} />} />
      </section>

      <div className="mt-5 grid gap-5 xl:grid-cols-[1.05fr_0.95fr]">
        <section className="rounded-[26px] border border-black/[0.05] bg-white p-5 sm:p-6">
          <div className="flex items-start justify-between gap-4">
            <div><p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#D96A24]">Филиалы</p><h2 className="mt-1 text-xl font-semibold">Цели по ученикам</h2></div>
            <Target size={20} className="text-[#D96A24]" />
          </div>
          <div className="mt-5 space-y-4">
            {visibleGoals.length === 0 ? <p className="py-8 text-center text-sm text-black/35">Цели пока не загружены.</p> : visibleGoals.map((goal) => {
              const width = Math.min(Math.max(goal.progress, 0), 100);
              return <div key={goal.branchId} className="rounded-[18px] bg-[#FAF9F5] p-4">
                <div className="flex items-start justify-between gap-3"><div><p className="text-sm font-semibold">{goal.branch}</p><p className="mt-1 text-xs text-black/40">{goal.missing > 0 ? `Не хватает ${goal.missing}` : goal.overTarget > 0 ? `+${goal.overTarget} сверх цели` : "Цель выполнена"}</p></div><p className="text-lg font-semibold">{goal.activeStudents} <span className="text-sm text-black/25">/ {goal.target}</span></p></div>
                <div className="mt-3 h-2 overflow-hidden rounded-full bg-black/[0.06]"><div className="h-full rounded-full bg-[#5F6338]" style={{ width: `${width}%` }} /></div>
              </div>;
            })}
          </div>
        </section>

        <section className="rounded-[26px] border border-black/[0.05] bg-white p-5 sm:p-6">
          <div className="flex items-start justify-between gap-4"><div><p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#D96A24]">Требует внимания</p><h2 className="mt-1 text-xl font-semibold">Что проверить сегодня</h2></div><AlertCircle size={20} className="text-[#D96A24]" /></div>
          {attention.length === 0 ? <div className="grid min-h-[250px] place-items-center text-center"><div><CheckCircle2 className="mx-auto text-[#5F6338]" size={32} /><p className="mt-3 font-semibold">Критичных задач нет</p><p className="mt-1 text-sm text-black/40">По доступным данным всё спокойно.</p></div></div> : <div className="mt-4 divide-y divide-black/[0.06]">{attention.map((item) => <button key={item.key} type="button" onClick={item.action} className="flex w-full items-center gap-3 py-4 text-left"><div className="min-w-0 flex-1"><p className="text-sm font-semibold leading-5">{item.label}</p></div><span className="shrink-0 text-sm font-semibold text-[#C95320]">{item.value}</span><ArrowRight size={16} className="shrink-0 text-black/20" /></button>)}</div>}
        </section>
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-[0.8fr_1.2fr]">
        <section className="rounded-[26px] border border-black/[0.05] bg-white p-5 sm:p-6">
          <div className="flex items-start justify-between gap-4"><div><p className="text-[11px] font-bold uppercase tracking-[0.16em] text-black/35">Ученики</p><h2 className="mt-1 text-xl font-semibold">Состояние базы</h2></div><UsersRound size={20} className="text-[#5F6338]" /></div>
          <div className="mt-5 divide-y divide-black/[0.06]">
            <div className="flex items-center justify-between py-3"><span className="text-sm text-black/50">Активных учеников</span><strong>{activeTotal}</strong></div>
            <div className="flex items-center justify-between py-3"><span className="text-sm text-black/50">Групп</span><strong>{groupsCount}</strong></div>
            <div className="flex items-center justify-between py-3"><span className="text-sm text-black/50">Активация родителей</span><strong>{parentActivationPercent}%</strong></div>
            <div className="flex items-center justify-between py-3"><span className="text-sm text-black/50">Архивировано в этом месяце</span><strong>{archivedThisMonth}</strong></div>
          </div>
          <button type="button" onClick={onOpenStudents} className="mt-4 flex w-full items-center justify-center gap-2 rounded-[14px] bg-[#FAF9F5] px-4 py-3 text-sm font-semibold text-black/60"><UserCheck size={17} />Открыть базу учеников</button>
        </section>

        <section className="rounded-[26px] border border-black/[0.05] bg-white p-5 sm:p-6">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-[11px] font-bold uppercase tracking-[0.16em] text-black/35">Динамика</p><h2 className="mt-1 text-xl font-semibold">Поступления по месяцам</h2></div><p className="text-xs text-black/30">с момента запуска BUSINESS</p></div>
          <div className="mt-5 space-y-3">
            {trend.map((item) => <div key={item.key} className="grid grid-cols-[38px_1fr_auto] items-center gap-3"><span className="text-xs capitalize text-black/40">{item.label}</span><div className="h-8 overflow-hidden rounded-[10px] bg-[#F4F2EC]"><div className="h-full rounded-[10px] bg-[#5F6338]/75 transition-all" style={{ width: item.value > 0 ? `${Math.max((item.value / trendMax) * 100, 4)}%` : "0%" }} /></div><strong className="min-w-[74px] text-right text-xs">{money(item.value)}</strong></div>)}
          </div>
        </section>
      </div>

      <section className="mt-5 rounded-[26px] border border-black/[0.05] bg-white p-5 sm:p-6">
        <div className="flex items-start justify-between gap-4"><div><p className="text-[11px] font-bold uppercase tracking-[0.16em] text-black/35">Финансы</p><h2 className="mt-1 text-xl font-semibold">Последние операции ДДС</h2><p className="mt-2 text-sm leading-6 text-black/40">Каждая сумма кликабельной аналитикой станет глубже по мере подключения CRM и мероприятий.</p></div><button type="button" onClick={onOpenBusiness} className="hidden items-center gap-2 rounded-full bg-[#FAF9F5] px-4 py-2.5 text-xs font-semibold text-black/55 sm:flex">Открыть Бизнес <ArrowRight size={15} /></button></div>
        {filteredCashflow.length === 0 ? <div className="grid min-h-[180px] place-items-center text-center text-sm text-black/35">Операций по выбранному филиалу пока нет.</div> : <div className="mt-4 divide-y divide-black/[0.06]">{filteredCashflow.slice(0, 8).map((item) => { const income = item.direction === "income"; return <div key={item.id} className="flex items-start gap-3 py-3.5"><div className={`grid h-9 w-9 shrink-0 place-items-center rounded-[12px] ${income ? "bg-[#5F6338]/10 text-[#4D512E]" : "bg-red-50 text-red-600"}`}>{income ? <TrendingUp size={16} /> : <TrendingDown size={16} />}</div><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{item.description || item.categoryName || (income ? "Поступление" : "Расход")}</p><p className="mt-1 text-xs text-black/35">{item.branchName || "Общий OPEN STARS"} · {item.transactionDate}</p></div><p className={`shrink-0 text-sm font-semibold ${income ? "text-[#4D512E]" : "text-red-600"}`}>{income ? "+" : "−"}{money(item.amount)}</p></div>; })}</div>}
        <button type="button" onClick={onOpenBusiness} className="mt-4 flex w-full items-center justify-center gap-2 rounded-[14px] bg-[#FAF9F5] px-4 py-3 text-sm font-semibold text-black/60 sm:hidden"><CreditCard size={17} />Открыть Бизнес</button>
      </section>
    </div>
  );
}
