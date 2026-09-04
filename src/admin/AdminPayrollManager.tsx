import { useEffect, useMemo, useState } from "react";
import { Banknote, CalendarDays, LoaderCircle, Pencil, RefreshCw, RotateCcw, WalletCards, X } from "lucide-react";

import { onAdminSection, notifyAdminDataUpdated } from "@/admin/adminNavigation";
import {
  correctTeacherPayroll,
  fetchPayrollContext,
  PayrollContext,
  PayrollPaymentMethod,
  PayrollPayout,
  recordTeacherPayroll,
  voidTeacherPayroll,
} from "@/admin/payrollApi";

const inputClass = "mt-1.5 w-full rounded-[14px] border border-black/[0.08] bg-white px-3.5 py-3 text-sm text-[#171717] outline-none focus:border-[#D96A24]/45 focus:ring-4 focus:ring-[#D96A24]/[0.06]";
const paymentLabels: Record<PayrollPaymentMethod, string> = {
  cash: "Наличные",
  bank: "Перевод / расчётный счёт",
  card: "Карта / онлайн",
  other: "Другое",
};

function isoDate(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function today() {
  return isoDate(new Date());
}

function monthStart() {
  const value = new Date();
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-01`;
}

function currentWeekStart() {
  const value = new Date();
  const day = value.getDay() || 7;
  value.setDate(value.getDate() - day + 1);
  return isoDate(value);
}

function money(value: number) {
  return new Intl.NumberFormat("ru-RU", { style: "currency", currency: "RUB", maximumFractionDigits: 0 }).format(value || 0);
}

function shortDate(value: string) {
  if (!value) return "";
  const date = new Date(`${value.slice(0, 10)}T12:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "short" }).format(date).replace(".", "");
}

function parseMoney(value: string) {
  return Number(value.replace(/\s/g, "").replace(",", "."));
}

export function AdminPayrollManager() {
  const [open, setOpen] = useState(false);
  const [context, setContext] = useState<PayrollContext | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [periodFrom, setPeriodFrom] = useState(monthStart());
  const [periodTo, setPeriodTo] = useState(today());

  const [teacherProfileId, setTeacherProfileId] = useState("");
  const [weekStart, setWeekStart] = useState(currentWeekStart());
  const [payoutDate, setPayoutDate] = useState(today());
  const [amount, setAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<PayrollPaymentMethod>("cash");
  const [comment, setComment] = useState("");
  const [editing, setEditing] = useState<PayrollPayout | null>(null);

  async function refresh(from = periodFrom, to = periodTo) {
    const next = await fetchPayrollContext(from, to);
    setContext(next);
    setTeacherProfileId((current) => current && next.teachers.some((item) => item.profileId === current) ? current : next.teachers[0]?.profileId || "");
    return next;
  }

  useEffect(() => onAdminSection("payroll", () => {
    setOpen(true);
    setError("");
    setSuccess("");
    setLoading(true);
    void refresh().catch((reason) => setError(reason instanceof Error ? reason.message : "Не удалось открыть зарплаты.")).finally(() => setLoading(false));
  }), []);

  const selectedTeacher = useMemo(() => context?.teachers.find((item) => item.profileId === teacherProfileId) || null, [context, teacherProfileId]);
  const payouts = context?.payouts || [];

  function resetForm() {
    setEditing(null);
    setWeekStart(currentWeekStart());
    setPayoutDate(today());
    setAmount("");
    setPaymentMethod("cash");
    setComment("");
  }

  function startEdit(item: PayrollPayout) {
    setEditing(item);
    setTeacherProfileId(item.teacherProfileId);
    setWeekStart(item.weekStart);
    setPayoutDate(item.payoutDate);
    setAmount(String(item.amount));
    setPaymentMethod(item.paymentMethod);
    setComment(item.comment || "");
    setError("");
    setSuccess("");
  }

  async function save() {
    const numericAmount = parseMoney(amount);
    if (!teacherProfileId) return setError("Выберите педагога.");
    if (!weekStart) return setError("Укажите неделю.");
    if (!payoutDate) return setError("Укажите дату выплаты.");
    if (!Number.isFinite(numericAmount) || numericAmount <= 0) return setError("Введите сумму больше нуля.");

    setSaving(true);
    setError("");
    setSuccess("");
    try {
      if (editing) {
        await correctTeacherPayroll({ payoutId: editing.id, weekStart, amount: numericAmount, payoutDate, paymentMethod, comment });
        setSuccess("Выплата исправлена. ДДС и свод обновлены автоматически.");
      } else {
        await recordTeacherPayroll({ teacherProfileId, weekStart, amount: numericAmount, payoutDate, paymentMethod, comment });
        setSuccess(`Выплата ${selectedTeacher?.name || "педагогу"} на ${money(numericAmount)} записана в расходы филиала.`);
      }
      resetForm();
      await refresh();
      notifyAdminDataUpdated({ source: "payroll" });
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Не удалось сохранить выплату.");
    } finally {
      setSaving(false);
    }
  }

  async function cancelPayout(item: PayrollPayout) {
    const reason = window.prompt(`Почему отменяем выплату ${item.teacherName} за неделю с ${shortDate(item.weekStart)}?`);
    if (!reason?.trim()) return;
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      await voidTeacherPayroll(item.id, reason);
      setSuccess("Выплата отменена. Связанная операция удалена из ДДС, запись осталась в аудите.");
      if (editing?.id === item.id) resetForm();
      await refresh();
      notifyAdminDataUpdated({ source: "payroll" });
    } catch (reasonValue) {
      setError(reasonValue instanceof Error ? reasonValue.message : "Не удалось отменить выплату.");
    } finally {
      setSaving(false);
    }
  }

  async function changePeriod(from: string, to: string) {
    setPeriodFrom(from);
    setPeriodTo(to);
    setLoading(true);
    setError("");
    try {
      await refresh(from, to);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Не удалось обновить период.");
    } finally {
      setLoading(false);
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[86] flex items-end justify-center bg-black/30 backdrop-blur-[2px] sm:items-center sm:p-5" onClick={() => !saving && setOpen(false)}>
      <div className="max-h-[96vh] w-full max-w-6xl overflow-y-auto rounded-t-[30px] bg-[#FAF9F5] p-5 shadow-2xl sm:rounded-[30px] sm:p-7" onClick={(event) => event.stopPropagation()}>
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#D96A24]">{context?.role === "owner" ? "OPEN STARS · OWNER" : "OPEN STARS ADMIN"}</p>
            <h2 className="mt-1 text-2xl font-semibold tracking-[-0.02em] text-[#171717]">Зарплата педагогам</h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-black/45">
              {context?.role === "owner"
                ? "Еженедельные выплаты педагогам по всем филиалам. Каждая выплата сразу учитывается в расходах и едином ДДС."
                : `Вы фиксируете фактически выданную зарплату педагогам филиала ${context?.staffBranch || ""}. Общий ДДС и финансы владельца здесь не показываются.`}
            </p>
          </div>
          <div className="flex gap-2">
            <button type="button" disabled={loading || saving} onClick={() => { setLoading(true); void refresh().catch((reason) => setError(reason instanceof Error ? reason.message : "Не удалось обновить зарплаты.")).finally(() => setLoading(false)); }} className="grid h-10 w-10 place-items-center rounded-full bg-white shadow-sm disabled:opacity-50"><RefreshCw size={18} className={loading ? "animate-spin" : ""}/></button>
            <button type="button" onClick={() => setOpen(false)} className="grid h-10 w-10 place-items-center rounded-full bg-white shadow-sm"><X size={18}/></button>
          </div>
        </div>

        {error && <div className="mt-4 rounded-[16px] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
        {success && <div className="mt-4 rounded-[16px] border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{success}</div>}

        {context?.role === "owner" && (
          <div className="mt-5 grid gap-3 sm:grid-cols-4">
            <div className="rounded-[20px] bg-[#171717] p-4 text-white"><p className="text-xs text-white/55">Выплачено за период</p><p className="mt-2 text-2xl font-semibold">{money(context.totalAmount)}</p></div>
            {context.branches.map((item) => <div key={item.branchId} className="rounded-[20px] border border-black/[0.06] bg-white p-4"><p className="text-xs text-black/45">{item.branch}</p><p className="mt-2 text-xl font-semibold text-[#171717]">{money(item.amount)}</p></div>)}
          </div>
        )}

        <div className="mt-5 grid gap-4 lg:grid-cols-[minmax(0,420px)_1fr]">
          <section className="rounded-[24px] border border-black/[0.06] bg-white p-4 sm:p-5">
            <div className="flex items-center justify-between gap-3">
              <div><p className="text-xs font-bold uppercase tracking-[0.14em] text-[#5F6338]">{editing ? "Исправление" : "Новая выплата"}</p><h3 className="mt-1 text-lg font-semibold">{editing ? editing.teacherName : "Выдать зарплату"}</h3></div>
              {editing && <button type="button" onClick={resetForm} className="inline-flex items-center gap-1.5 rounded-full bg-black/[0.05] px-3 py-2 text-xs font-semibold"><RotateCcw size={14}/>Отмена</button>}
            </div>

            <label className="mt-4 block text-xs font-semibold text-black/55">Педагог
              <select value={teacherProfileId} disabled={Boolean(editing)} onChange={(event) => setTeacherProfileId(event.target.value)} className={inputClass}>
                {context?.teachers.map((item) => <option key={item.profileId} value={item.profileId}>{item.name}{context.role === "owner" ? ` · ${item.branch}` : ""}</option>)}
              </select>
            </label>

            <div className="mt-3 grid grid-cols-2 gap-3">
              <label className="text-xs font-semibold text-black/55">Неделя с
                <input type="date" value={weekStart} onChange={(event) => setWeekStart(event.target.value)} className={inputClass}/>
              </label>
              <label className="text-xs font-semibold text-black/55">Дата выплаты
                <input type="date" value={payoutDate} onChange={(event) => setPayoutDate(event.target.value)} className={inputClass}/>
              </label>
            </div>

            <label className="mt-3 block text-xs font-semibold text-black/55">Сумма, ₽
              <input inputMode="decimal" value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="Например, 7500" className={inputClass}/>
            </label>

            <label className="mt-3 block text-xs font-semibold text-black/55">Способ выплаты
              <select value={paymentMethod} onChange={(event) => setPaymentMethod(event.target.value as PayrollPaymentMethod)} className={inputClass}>
                {(Object.keys(paymentLabels) as PayrollPaymentMethod[]).map((key) => <option key={key} value={key}>{paymentLabels[key]}</option>)}
              </select>
            </label>

            <label className="mt-3 block text-xs font-semibold text-black/55">Комментарий
              <textarea value={comment} onChange={(event) => setComment(event.target.value)} rows={3} placeholder="Премия, замена, корректировка и т. п." className={inputClass}/>
            </label>

            <button type="button" disabled={saving || loading || !context?.teachers.length} onClick={() => void save()} className="mt-4 flex w-full items-center justify-center gap-2 rounded-[16px] bg-[#D96A24] px-4 py-3.5 text-sm font-semibold text-white shadow-sm disabled:opacity-50">
              {saving ? <LoaderCircle size={18} className="animate-spin"/> : <Banknote size={18}/>} {editing ? "Сохранить исправление" : "Записать выплату"}
            </button>
            {!context?.teachers.length && <p className="mt-3 text-xs leading-5 text-black/45">В вашем филиале пока нет активных аккаунтов с ролью «Педагог».</p>}
          </section>

          <section className="rounded-[24px] border border-black/[0.06] bg-white p-4 sm:p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div><p className="text-xs font-bold uppercase tracking-[0.14em] text-[#D96A24]">История</p><h3 className="mt-1 text-lg font-semibold">Выплаты педагогам</h3></div>
              <div className="flex items-center gap-2 rounded-[14px] bg-[#FAF9F5] p-2">
                <CalendarDays size={16} className="text-black/45"/>
                <input type="date" value={periodFrom} onChange={(event) => void changePeriod(event.target.value, periodTo)} className="w-[126px] bg-transparent text-xs outline-none"/>
                <span className="text-black/25">—</span>
                <input type="date" value={periodTo} onChange={(event) => void changePeriod(periodFrom, event.target.value)} className="w-[126px] bg-transparent text-xs outline-none"/>
              </div>
            </div>

            {loading ? <div className="grid min-h-[220px] place-items-center text-sm text-black/40"><LoaderCircle size={24} className="animate-spin"/></div> : payouts.length === 0 ? (
              <div className="mt-5 rounded-[18px] bg-[#FAF9F5] px-4 py-8 text-center text-sm text-black/40">За выбранный период выплат пока нет.</div>
            ) : (
              <div className="mt-4 space-y-2.5">
                {payouts.map((item) => (
                  <div key={item.id} className="rounded-[18px] border border-black/[0.06] bg-[#FAF9F5] p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2"><p className="font-semibold text-[#171717]">{item.teacherName}</p><span className="rounded-full bg-[#5F6338]/10 px-2 py-1 text-[10px] font-semibold text-[#4D512E]">{item.branch}</span></div>
                        <p className="mt-1 text-xs text-black/45">Неделя с {shortDate(item.weekStart)} · выплачено {shortDate(item.payoutDate)} · {paymentLabels[item.paymentMethod]}</p>
                        {item.comment && <p className="mt-2 text-xs leading-5 text-black/55">{item.comment}</p>}
                      </div>
                      <p className="shrink-0 text-lg font-semibold text-[#171717]">{money(item.amount)}</p>
                    </div>
                    <div className="mt-3 flex items-center justify-between gap-3 border-t border-black/[0.05] pt-3">
                      <p className="truncate text-[11px] text-black/35">Внёс: {item.createdBy}</p>
                      <div className="flex gap-2">
                        <button type="button" disabled={saving} onClick={() => startEdit(item)} className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-2 text-xs font-semibold shadow-sm disabled:opacity-50"><Pencil size={13}/>Исправить</button>
                        <button type="button" disabled={saving} onClick={() => void cancelPayout(item)} className="rounded-full bg-white px-3 py-2 text-xs font-semibold text-red-600 shadow-sm disabled:opacity-50">Отменить</button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>

        <div className="mt-4 flex items-start gap-3 rounded-[18px] border border-[#5F6338]/15 bg-[#5F6338]/[0.055] px-4 py-3 text-xs leading-5 text-[#4D512E]">
          <WalletCards size={18} className="mt-0.5 shrink-0"/><p>Эта страница показывает только зарплаты педагогов. Администратор не получает доступ к общему ДДС, прибыли или банковским остаткам. Владелец видит полный свод в своём режиме.</p>
        </div>
      </div>
    </div>
  );
}
