import { useEffect, useId, useRef, useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { getValidStaffSession } from "@/admin/adminApi";
import { ADMIN_DATA_UPDATED_EVENT } from "@/admin/adminNavigation";

export type FinanceRow = {
  id: string; date: string; title: string; branch: string; amount: number;
  method: string; description: string; actor: string; refunded: boolean; month: string;
  source?: string; sourceId?: string; editable?: boolean; category?: string;
};
type Register = {
  rows: FinanceRow[]; count: number; total: number; refunded: number;
  categories?: Array<{ id: string; name: string; amount: number; count: number }>;
};
type Props = {
  kind: "payments" | "expenses";
  lockedBranch?: string;
  onEditExpense?: (row: FinanceRow) => void;
  onCancelExpense?: (row: FinanceRow) => void;
  onPayroll?: (row: FinanceRow) => void;
  onPeriodChange?: (from: string, to: string) => void;
  initialPeriod?: { from: string; to: string };
  busy?: boolean;
};
const control = "min-w-0 max-w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-sm";
const money = (value: number) => Number(value).toLocaleString("ru-RU") + " ₽";
const methods: Record<string, string> = { cash: "Наличные", online: "Онлайн · Точка", bank_transfer: "Перевод на счёт", bank: "Перевод", card: "Карта", other: "Способ не указан / другое" };
function today() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function FinanceRegister({ kind, lockedBranch = "", onEditExpense, onCancelExpense, onPayroll, onPeriodChange, initialPeriod, busy = false }: Props) {
  const isExpense = kind === "expenses";
  const detailsId = useId();
  const detailsHeading = useRef<HTMLDivElement | null>(null);
  const lastTrigger = useRef<HTMLButtonElement | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [category, setCategory] = useState("");
  const [from, setFrom] = useState(initialPeriod?.from ?? today().slice(0, 7) + "-01");
  const [to, setTo] = useState(initialPeriod?.to ?? today());
  const [branch, setBranch] = useState("");
  const [method, setMethod] = useState("all");
  const [page, setPage] = useState(0);
  const [revision, setRevision] = useState(0);
  const [loaded, setLoaded] = useState<{ data: Register; scope: string; query: string } | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const scope = JSON.stringify([kind, from, to, lockedBranch || branch, method]);
  const query = JSON.stringify([scope, category, page, revision]);
  const data = loaded?.query === query ? loaded.data : null;
  // Category totals cover the whole selected period and branch, independently of the open list.
  const categories = loaded?.scope === scope ? loaded.data.categories : undefined;
  const total = categories?.reduce((sum, item) => sum + Math.round(Number(item.amount) * 100), 0);
  const count = categories?.reduce((sum, item) => sum + Number(item.count), 0);
  const selectedName = category ? categories?.find(item => item.id === category)?.name || "Расходы категории" : "Все расходы";

  useEffect(() => { onPeriodChange?.(from, to); }, [from, to, onPeriodChange]);
  useEffect(() => {
    const refresh = () => { setPage(0); setRevision(v => v + 1); };
    window.addEventListener(ADMIN_DATA_UPDATED_EVENT, refresh);
    return () => window.removeEventListener(ADMIN_DATA_UPDATED_EVENT, refresh);
  }, []);
  useEffect(() => {
    if (isExpense && expanded) detailsHeading.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [isExpense, expanded, category, page]);
  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    setError(""); setLoading(true);
    async function load() {
      try {
        if (!to || (from && from > to)) throw new Error("Проверьте период.");
        const session = await getValidStaffSession();
        if (!session) throw new Error("Войдите в кабинет сотрудника.");
        const response = await fetch(`https://yiwiykbuaggyslfyhlfo.supabase.co/rest/v1/rpc/${kind === "expenses" ? "owner_expense_register" : "staff_finance_register"}`, {
          method: "POST", signal: controller.signal,
          headers: { apikey: "sb_publishable_1MORh5rY7uMDVYLYVX5VAA_cyoph4-7", Authorization: `Bearer ${session.access_token}`, "Content-Type": "application/json" },
          body: JSON.stringify({ p_from: from || "1900-01-01", p_to: to, p_branch: lockedBranch || branch, p_page: page, ...(kind === "expenses" ? { p_category: category } : { p_kind: kind, p_method: method }) }),
        });
        if (!response.ok) throw new Error("Не удалось загрузить реестр. Попробуйте обновить.");
        const result: Register = await response.json();
        if (active) setLoaded({ data: result, scope, query });
      } catch (reason) {
        if (active) setError(reason instanceof Error ? reason.message : "Ошибка загрузки.");
      } finally {
        if (active) setLoading(false);
      }
    }
    void load();
    return () => { active = false; controller.abort(); };
  }, [kind, from, to, branch, lockedBranch, method, page, revision, category, scope, query]);

  function selectExpenses(nextCategory: string, button: HTMLButtonElement) {
    lastTrigger.current = button;
    if (expanded && category === nextCategory) {
      setExpanded(false);
      return;
    }
    setCategory(nextCategory);
    setPage(0);
    setExpanded(true);
  }

  function collapseExpenses() {
    setExpanded(false);
    lastTrigger.current?.focus({ preventScroll: true });
    lastTrigger.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  function changeFilters() {
    setPage(0);
    if (isExpense) { setExpanded(false); setCategory(""); }
  }

  return <section className="mt-5 min-w-0 rounded-3xl border border-black/5 bg-white p-4 sm:p-5">
    {isExpense ? (
      <button type="button" aria-expanded={expanded && !category} aria-controls={detailsId} disabled={total === undefined}
        onClick={event => selectExpenses("", event.currentTarget)}
        className="flex w-full items-center justify-between gap-3 rounded-[20px] bg-[#171717] p-4 text-left text-white disabled:opacity-60">
        <span className="min-w-0">
          <span className="block text-sm text-white/65">Всего расходов</span>
          <strong className="mt-1 block text-2xl sm:text-3xl">{total === undefined ? "…" : money(total / 100)}</strong>
          <span className="mt-1 block text-xs text-white/60">{lockedBranch || branch || "Все округа"} · {from ? from.split("-").reverse().join(".") : "За всё время"} — {to.split("-").reverse().join(".")}</span>
          {count !== undefined && <span className="mt-1 block text-xs text-white/60">Операций: {count} · Нажмите для просмотра</span>}
        </span>
        {expanded && !category ? <ChevronUp className="shrink-0" size={20}/> : <ChevronDown className="shrink-0" size={20}/>}
      </button>
    ) : <h3 className="text-lg font-semibold">Кто оплатил · наличные и безналичные</h3>}
    <p className="mt-2 text-xs text-black/50">{isExpense
      ? "Все расходы ДДС, включая зарплаты, маркетинг и возвраты."
      : "По дате поступления денег. Частичные платежи показаны отдельно. Возвращённые оплаты отмечены и исключены из итога; отменённые не показываются."}</p>
    <div className="mt-4 grid min-w-0 grid-cols-2 items-end gap-2 sm:flex sm:flex-wrap sm:gap-3">
      <label className="grid min-w-0 gap-1 text-xs">С даты<input aria-label="Начало периода реестра" type="date" className={`${control} w-full`} value={from} onChange={e => { setFrom(e.target.value); changeFilters(); }}/></label>
      <label className="grid min-w-0 gap-1 text-xs">По дату<input aria-label="Конец периода реестра" type="date" className={`${control} w-full`} value={to} onChange={e => { setTo(e.target.value); changeFilters(); }}/></label>
      <label className="col-span-2 grid min-w-0 gap-1 text-xs">Округ<select className={control} value={lockedBranch || branch} disabled={!!lockedBranch} onChange={e => { setBranch(e.target.value); changeFilters(); }}>
        <option value="">Все округа</option>{["Октябрьский", "Свердловский", "НЛО", ...(isExpense ? ["Общий / распределённый"] : [])].map(b => <option key={b}>{b}</option>)}
      </select></label>
      {!isExpense && <label className="col-span-2 grid min-w-0 gap-1 text-xs">Способ оплаты<select className={control} value={method} onChange={e => { setMethod(e.target.value); changeFilters(); }}>
        <option value="all">Все способы</option><option value="cash">Наличные</option><option value="noncash">Безналичные</option><option value="unknown">Не указан / другое</option>
      </select></label>}
      <button type="button" className={control} onClick={() => { setFrom(""); setTo(today()); changeFilters(); }}>За всё время</button>
      <button type="button" disabled={loading} className={control} onClick={() => setRevision(v => v + 1)}>Обновить</button>
    </div>
    {error && <p role="alert" className="mt-4 text-red-700">{error}</p>}
    {loading && (!isExpense || !categories) && <p role="status" className="mt-4 text-sm text-black/50">Загружаем реестр…</p>}
    {isExpense && categories && <div className="mt-5">
      <h3 className="font-semibold">По категориям</h3>
      <p className="mt-1 text-xs text-black/50">Выберите плашку, чтобы открыть список расходов.</p>
      {categories.length === 0 && <p className="mt-3 text-sm text-black/50">За выбранный период расходов нет.</p>}
      <div className="mt-3 grid grid-cols-2 gap-2 lg:grid-cols-3">{categories.map(item => {
        const selected = expanded && category === item.id;
        return <button key={item.id} type="button" aria-expanded={selected} aria-controls={detailsId}
          onClick={event => selectExpenses(item.id, event.currentTarget)}
          className={`flex min-w-0 flex-col justify-between gap-2 rounded-2xl border p-3 text-left ${selected ? "border-[#D96A24] bg-[#FFF2E8]" : "border-black/10 bg-[#FAF9F5]/60"}`}>
          <span className="break-words text-sm leading-snug">{item.name}</span>
          <span><strong className="block text-base">{money(item.amount)}</strong><span className="mt-1 flex items-center justify-between gap-1 text-xs text-black/45">Операций: {item.count}{selected ? <ChevronUp size={15}/> : <ChevronDown size={15}/>}</span></span>
        </button>;
      })}</div>
    </div>}

    {(!isExpense || expanded) && <div id={detailsId} className="mt-4">
      {isExpense && <div ref={detailsHeading} className="sticky top-0 z-10 flex items-center justify-between gap-2 border-b border-black/5 bg-white py-3">
        <div className="min-w-0"><h4 className="break-words font-semibold">{selectedName}</h4>{data && <p className="mt-1 text-xs text-black/50">{data.count} операций · {money(data.total)}</p>}</div>
        <button type="button" className={`${control} inline-flex shrink-0 items-center gap-1`} onClick={collapseExpenses}><ChevronUp size={16}/>Свернуть</button>
      </div>}
      {!isExpense && data && <p className="font-semibold">Операций: {data.count} · Итого: {money(data.total)}</p>}
      {isExpense && loading && <p role="status" className="py-4 text-sm text-black/50">Загружаем расходы…</p>}
      {data && <>
        {Number(data.refunded) > 0 && <p className="mt-1 text-xs text-black/50">Возвращённые поступления: {money(data.refunded)}</p>}
        <div className="divide-y divide-black/5">{data.rows.length === 0
          ? <p className="py-4 text-sm text-black/50">За выбранный период операций нет.</p>
          : data.rows.map(row => <article key={row.id} className="py-3">
            <div className="flex justify-between gap-3"><strong className="min-w-0 break-words">{row.title}</strong><strong className="shrink-0 whitespace-nowrap">{money(row.amount)}</strong></div>
            <p className="mt-1 break-words text-sm text-black/60">{row.branch} · {row.date.split("-").reverse().join(".")} · {isExpense ? row.method : (methods[row.method] || "Способ не указан")}</p>
            {row.month && <p className="text-xs text-black/50">За занятия: {row.month}</p>}
            {row.description && <p className="mt-1 break-words text-sm text-black/60">{row.description}</p>}
            {row.actor && <p className="text-xs text-black/45">Внёс: {row.actor}</p>}
            {row.refunded && <p className="mt-1 text-sm text-orange-700">Возврат произведён</p>}
            {isExpense && row.editable && <div className="mt-3 flex flex-wrap gap-2">
              {onEditExpense && <button type="button" disabled={busy} className={`${control} disabled:opacity-50`} onClick={() => onEditExpense(row)}>Исправить расход</button>}
              {onCancelExpense && <button type="button" disabled={busy} className={`${control} text-red-700 disabled:opacity-50`} onClick={() => onCancelExpense(row)}>Отменить расход</button>}
            </div>}
            {isExpense && row.source === "teacher_payroll" && onPayroll && <button type="button" disabled={busy} className={`${control} mt-3 disabled:opacity-50`} onClick={() => onPayroll(row)}>Исправить зарплату</button>}
            {isExpense && row.source === "tuition_refund" && <p className="mt-2 text-xs text-black/45">Возврат связан с оплатой ребёнка.</p>}
          </article>)}</div>
        {data.count > 50 && <div className="mt-4 flex flex-wrap items-center gap-3">
          <button type="button" disabled={page === 0} className={control} onClick={() => setPage(v => v - 1)}>Назад</button>
          <span className="text-sm">{page + 1} / {Math.ceil(data.count / 50)}</span>
          <button type="button" disabled={(page + 1) * 50 >= data.count} className={control} onClick={() => setPage(v => v + 1)}>Далее</button>
        </div>}
        {isExpense && data.rows.length > 0 && <button type="button" className={`${control} mt-4 flex w-full items-center justify-center gap-2`} onClick={collapseExpenses}><ChevronUp size={16}/>Свернуть</button>}
      </>}
    </div>}
  </section>;
}
