import { useEffect, useMemo, useState } from "react";
import { Banknote, CheckCircle2, Clock3, CreditCard, LoaderCircle, RotateCcw, Search, X } from "lucide-react";

import { AdminPaymentLinkSettings } from "@/admin/AdminPaymentLinkSettings";
import {
  confirmPaymentReceipt,
  fetchPaymentContext,
  fetchPaymentHistory,
  fetchPaymentReceipts,
  PaymentChild,
  PaymentHistory,
  PaymentMethod,
  PaymentReceipt,
  PaymentStatus,
  setPaymentStatus,
  voidPaymentReceipt,
} from "@/admin/paymentApi";

const inputClass = "mt-1.5 w-full rounded-[13px] border border-black/[0.08] bg-white px-3.5 py-3 text-sm text-[#171717] outline-none focus:border-[#D96A24]/45 focus:ring-4 focus:ring-[#D96A24]/[0.06]";
const labels: Record<string, string> = { paid: "Оплачено", pending: "Ожидает оплаты", overdue: "Просрочено", "": "Статус не указан" };
const methodLabels: Record<PaymentMethod, string> = { online: "Онлайн · Точка", cash: "Наличные", bank_transfer: "Перевод на счёт", other: "Другое" };

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

export function AdminPaymentManager() {
  const [enabled, setEnabled] = useState(false);
  const [open, setOpen] = useState(false);
  const [children, setChildren] = useState<PaymentChild[]>([]);
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState("");
  const [month, setMonth] = useState(currentMonth());
  const [status, setStatus] = useState<PaymentStatus>("pending");
  const [amount, setAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("online");
  const [note, setNote] = useState("");
  const [history, setHistory] = useState<PaymentHistory[]>([]);
  const [receipts, setReceipts] = useState<PaymentReceipt[]>([]);
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
        setChildren(context.children);
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

  const selected = useMemo(() => children.find((child) => child.id === selectedId) || null, [children, selectedId]);
  const visible = useMemo(() => {
    const value = query.trim().toLowerCase();
    return (value ? children.filter((child) => [child.name, child.branch, child.groupName].join(" ").toLowerCase().includes(value)) : children).slice(0, 50);
  }, [query, children]);

  async function refresh() {
    const context = await fetchPaymentContext();
    setChildren(context.children);
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
    try {
      await refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Не удалось загрузить оплату.");
    } finally {
      setLoading(false);
    }
  }

  async function choose(child: PaymentChild) {
    setSelectedId(child.id);
    setStatus((child.paymentStatus as PaymentStatus) || "pending");
    setAmount("");
    setNote("");
    setLoading(true);
    setError("");
    setSuccess("");
    try {
      await refreshChild(child.id);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Не удалось загрузить историю.");
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
          childId: selected.id,
          month,
          amount: numericAmount,
          paymentMethod,
          note,
        });
        setSuccess(`${selected.name}: подтверждено ${money(numericAmount)} за ${monthLabel(month)}. Поступление автоматически добавлено в ДДС.`);
        setAmount("");
        setNote("");
      } else {
        await setPaymentStatus(selected.id, month, status);
        setSuccess(`Статус за ${monthLabel(month)}: ${labels[status]}.`);
      }
      await refresh();
      await refreshChild(selected.id);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Не удалось сохранить оплату.");
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
        await refresh();
        await refreshChild(selected.id);
      }
      setSuccess("Ошибочная оплата отменена. Связанная проводка ДДС удалена.");
    } catch (reasonValue) {
      setError(reasonValue instanceof Error ? reasonValue.message : "Не удалось отменить оплату.");
    } finally {
      setSaving(false);
    }
  }

  if (!enabled) return null;

  return (
    <>
      <button type="button" onClick={openManager} className="fixed bottom-[28.7rem] right-4 z-40 flex items-center gap-2 rounded-full bg-white px-4 py-3 text-sm font-semibold text-[#171717] shadow-[0_10px_30px_rgba(0,0,0,0.18)] ring-1 ring-black/[0.06] sm:right-6">
        <CreditCard size={17} className="text-[#5F6338]" /> Оплата
      </button>

      {open && (
        <div className="fixed inset-0 z-[81] flex items-end justify-center bg-black/30 backdrop-blur-[2px] sm:items-center sm:p-5" onClick={() => !saving && setOpen(false)}>
          <div className="max-h-[96vh] w-full max-w-5xl overflow-y-auto rounded-t-[28px] bg-[#FAF9F5] p-5 shadow-2xl sm:rounded-[28px] sm:p-7" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-start justify-between">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#D96A24]">OPEN STARS ADMIN</p>
                <h2 className="mt-1 text-2xl font-semibold">Оплата</h2>
                <p className="mt-2 text-sm text-black/45">Подтвердите сумму один раз — поступление автоматически попадёт в общий ДДС с меткой филиала.</p>
              </div>
              <button type="button" onClick={() => setOpen(false)} className="grid h-10 w-10 place-items-center rounded-full bg-white"><X size={20} /></button>
            </div>

            <AdminPaymentLinkSettings />

            <div className="mt-6 grid gap-5 lg:grid-cols-[0.85fr_1.15fr]">
              <section className="rounded-[24px] border border-black/[0.06] bg-white p-5">
                <div className="relative"><Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-black/25" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Найти ребёнка" className="w-full rounded-[14px] bg-[#FAF9F5] py-3 pl-10 pr-3 text-sm outline-none" /></div>
                <div className="mt-3 max-h-[520px] space-y-2 overflow-y-auto">
                  {visible.map((child) => (
                    <button key={child.id} onClick={() => void choose(child)} className={`flex w-full items-center justify-between rounded-[15px] border p-3 text-left ${child.id === selectedId ? "border-[#D96A24]/30 bg-[#D96A24]/[0.05]" : "border-black/[0.05]"}`}>
                      <div><p className="text-sm font-semibold">{child.name}</p><p className="mt-1 text-xs text-black/35">{child.branch} · {child.groupName}</p></div>
                      <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${child.paymentStatus === "paid" ? "bg-[#5F6338]/10 text-[#4D512E]" : child.paymentStatus === "overdue" ? "bg-red-50 text-red-600" : "bg-[#D96A24]/10 text-[#C95320]"}`}>{labels[child.paymentStatus] || labels[""]}</span>
                    </button>
                  ))}
                </div>
              </section>

              <div className="space-y-5">
                <section className="rounded-[24px] border border-black/[0.06] bg-white p-5">
                  {selected ? (
                    <>
                      <h3 className="text-lg font-semibold">{selected.name}</h3>
                      <p className="mt-1 text-xs text-black/35">{selected.branch} · {selected.groupName}</p>
                      <div className="mt-5 grid gap-3 sm:grid-cols-2">
                        <label className="text-xs font-semibold text-black/55">Месяц<input type="month" className={inputClass} value={month} onChange={(event) => setMonth(event.target.value)} /></label>
                        <label className="text-xs font-semibold text-black/55">Статус<select className={inputClass} value={status} onChange={(event) => setStatus(event.target.value as PaymentStatus)}><option value="paid">Оплачено</option><option value="pending">Ожидает оплаты</option><option value="overdue">Просрочено</option></select></label>
                      </div>

                      {status === "paid" && (
                        <div className="mt-4 rounded-[18px] bg-[#F7F5EF] p-4">
                          <div className="flex items-center gap-2"><Banknote size={17} className="text-[#5F6338]" /><p className="text-sm font-semibold">Фактическое поступление</p></div>
                          <div className="mt-3 grid gap-3 sm:grid-cols-2">
                            <label className="text-xs font-semibold text-black/55">Сумма, ₽<input inputMode="decimal" className={inputClass} value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="5500" /></label>
                            <label className="text-xs font-semibold text-black/55">Способ оплаты<select className={inputClass} value={paymentMethod} onChange={(event) => setPaymentMethod(event.target.value as PaymentMethod)}><option value="online">Онлайн · Точка</option><option value="cash">Наличные</option><option value="bank_transfer">Перевод на счёт</option><option value="other">Другое</option></select></label>
                          </div>
                          <label className="mt-3 block text-xs font-semibold text-black/55">Комментарий<input className={inputClass} value={note} onChange={(event) => setNote(event.target.value)} placeholder="Необязательно" /></label>
                          <p className="mt-3 text-xs leading-5 text-black/40">Безналичная оплата попадёт на общий счёт Точки, наличные — в кассу филиала. В ДДС филиал определяется автоматически по ребёнку.</p>
                        </div>
                      )}

                      <button onClick={() => void save()} disabled={saving} className="mt-5 flex w-full items-center justify-center gap-2 rounded-[14px] bg-[#171717] px-5 py-3.5 text-sm font-semibold text-white disabled:opacity-50">
                        {saving ? <LoaderCircle className="animate-spin" size={17} /> : <CreditCard size={17} />}
                        {status === "paid" ? "Подтвердить оплату" : "Сохранить статус"}
                      </button>
                    </>
                  ) : <div className="grid min-h-[220px] place-items-center text-center text-sm text-black/40">Выберите ребёнка слева.</div>}
                </section>

                {error && <div className="rounded-[15px] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
                {success && <div className="flex gap-2 rounded-[15px] bg-[#5F6338]/[0.07] px-4 py-3 text-sm text-[#4D512E]"><CheckCircle2 size={17} className="shrink-0" />{success}</div>}

                <section className="rounded-[24px] border border-black/[0.06] bg-white p-5">
                  <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-black/35">Фактические поступления</p>
                  {loading ? <div className="grid min-h-[100px] place-items-center"><LoaderCircle className="animate-spin text-black/20" /></div> : receipts.length === 0 ? <p className="mt-4 text-sm text-black/40">Подтверждённых поступлений пока нет.</p> : (
                    <div className="mt-3 divide-y divide-black/[0.06]">
                      {receipts.map((receipt) => (
                        <div key={receipt.id} className={`py-3 ${receipt.voidedAt ? "opacity-45" : ""}`}>
                          <div className="flex items-start justify-between gap-3">
                            <div><p className="text-sm font-semibold">{money(receipt.amount)} · {methodLabels[receipt.paymentMethod]}</p><p className="mt-1 text-[11px] text-black/35">{monthLabel(receipt.month)} · {dateLabel(receipt.receivedAt)} · {receipt.confirmedByName}</p>{receipt.voidedAt && <p className="mt-1 text-[11px] text-red-600">Отменено: {receipt.voidReason}</p>}</div>
                            {!receipt.voidedAt && <button type="button" disabled={saving} onClick={() => void voidReceipt(receipt)} className="flex shrink-0 items-center gap-1 rounded-full bg-red-50 px-2.5 py-1.5 text-[11px] font-semibold text-red-600 disabled:opacity-50"><RotateCcw size={13} />Отменить</button>}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </section>

                <section className="rounded-[24px] border border-black/[0.06] bg-white p-5">
                  <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-black/35">История статусов</p>
                  {loading ? <div className="grid min-h-[100px] place-items-center"><LoaderCircle className="animate-spin text-black/20" /></div> : history.length === 0 ? <p className="mt-4 text-sm text-black/40">Изменений пока нет.</p> : (
                    <div className="mt-3 divide-y divide-black/[0.06]">
                      {history.map((item) => <div key={item.id} className="py-3"><div className="flex items-center gap-2">{item.newStatus === "paid" ? <CheckCircle2 size={16} className="text-[#5F6338]" /> : <Clock3 size={16} className={item.newStatus === "overdue" ? "text-red-500" : "text-[#D96A24]"} />}<p className="text-sm font-semibold">{monthLabel(item.month)} · {labels[item.newStatus]}</p></div><p className="mt-1 pl-6 text-[11px] text-black/35">{dateLabel(item.changedAt)} · {item.changedByName}</p></div>)}
                    </div>
                  )}
                </section>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
