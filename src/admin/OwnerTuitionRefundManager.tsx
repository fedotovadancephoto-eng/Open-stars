import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowRight, LoaderCircle, RefreshCw, RotateCcw, Search, WalletCards, X } from "lucide-react";

import { fetchStaffIdentity } from "@/admin/adminApi";
import { notifyAdminDataUpdated, onAdminSection, openAdminSection } from "@/admin/adminNavigation";
import {
  fetchRefundableTuitionReceipts,
  RefundableTuitionReceipt,
  refundTuitionReceipt,
} from "@/admin/tuitionRefundApi";

const methodLabels: Record<string, string> = {
  online: "Онлайн · Точка",
  cash: "Наличные",
  bank_transfer: "Перевод на счёт",
  other: "Другое",
};

function money(value: number) {
  return new Intl.NumberFormat("ru-RU", {
    style: "currency",
    currency: "RUB",
    maximumFractionDigits: 0,
  }).format(value || 0);
}

function monthLabel(value: string) {
  if (!value) return "";
  const date = new Date(`${value.slice(0, 7)}-01T12:00:00`);
  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat("ru-RU", { month: "long", year: "numeric" }).format(date);
}

function dateLabel(value: string) {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })
        .format(date)
        .replace(".", "");
}

export function OwnerTuitionRefundManager() {
  const [isOwner, setIsOwner] = useState(false);
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<RefundableTuitionReceipt[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    let cancelled = false;
    let timer = 0;

    async function detect() {
      try {
        const identity = await fetchStaffIdentity();
        if (cancelled) return;
        setIsOwner(identity.role === "owner");
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

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setRows(await fetchRefundableTuitionReceipts());
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Не удалось загрузить оплаты для возврата.");
    } finally {
      setLoading(false);
    }
  }, []);

  const openManager = useCallback(async () => {
    setOpen(true);
    setSuccess("");
    await load();
  }, [load]);

  useEffect(() => onAdminSection("tuition-refund", () => { void openManager(); }), [openManager]);

  async function refund(row: RefundableTuitionReceipt) {
    const reason = window.prompt(
      `Причина уже произведённого возврата ${money(row.amount)} · ${row.childName}?`,
      "Прекращение обучения"
    );
    if (reason === null) return;
    if (!reason.trim()) return setError("Укажите причину возврата.");

    const confirmed = window.confirm(
      `Зафиксировать возврат ${money(row.amount)} родителю?\n\n` +
      "Приложение не переводит деньги через банк. Сумма уйдёт из собранных оплат, в ДДС появится расход «Возврат обучения», а исходная оплата останется в истории."
    );
    if (!confirmed) return;

    setBusyId(row.receiptId);
    setError("");
    setSuccess("");
    try {
      await refundTuitionReceipt(row.receiptId, reason);
      await load();
      notifyAdminDataUpdated({ source: "tuition-refund", childId: row.childId });
      setSuccess(`${row.childName}: возврат ${money(row.amount)} зафиксирован. Выручка и ДДС пересчитаны.`);
    } catch (reasonValue) {
      setError(reasonValue instanceof Error ? reasonValue.message : "Не удалось оформить возврат.");
    } finally {
      setBusyId("");
    }
  }

  const visible = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return rows;
    return rows.filter((row) =>
      [row.childName, row.branch, monthLabel(row.month), row.note]
        .join(" ")
        .toLowerCase()
        .includes(normalized)
    );
  }, [rows, query]);

  if (!isOwner) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => void openManager()}
        className="fixed bottom-[25.2rem] right-4 z-40 flex items-center gap-2 rounded-full bg-white px-4 py-3 text-sm font-semibold text-[#171717] shadow-[0_10px_30px_rgba(0,0,0,0.18)] ring-1 ring-black/[0.06] sm:right-6"
      >
        <RotateCcw size={17} className="text-red-600" /> Зафиксировать возврат
      </button>

      {open && (
        <div
          className="fixed inset-0 z-[92] flex items-end justify-center bg-black/35 backdrop-blur-[2px] sm:items-center sm:p-5"
          onClick={() => !busyId && setOpen(false)}
        >
          <div
            className="max-h-[96vh] w-full max-w-3xl overflow-y-auto rounded-t-[28px] bg-[#FAF9F5] p-5 shadow-2xl sm:rounded-[28px] sm:p-7"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-red-600">OPEN STARS · РУКОВОДИТЕЛЬ</p>
                <h2 className="mt-1 text-2xl font-semibold tracking-[-0.03em]">Зафиксировать возврат оплаты</h2>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-black/45">
                  Сначала верните деньги через банк или кассу, затем зафиксируйте операцию здесь. Ошибочно внесённую оплату исправляйте в разделе «Оплата».
                </p>
              </div>
              <div className="flex gap-2">
                <button type="button" disabled={loading} onClick={() => void load()} className="grid h-10 w-10 place-items-center rounded-full bg-white text-black/50 disabled:opacity-50">
                  <RefreshCw size={17} className={loading ? "animate-spin" : ""} />
                </button>
                <button type="button" disabled={Boolean(busyId)} onClick={() => setOpen(false)} className="grid h-10 w-10 place-items-center rounded-full bg-white text-black/55 disabled:opacity-50">
                  <X size={20} />
                </button>
              </div>
            </div>

            <div className="mt-5 rounded-[18px] border border-red-100 bg-red-50 px-4 py-3 text-xs leading-5 text-red-700">
              Эта кнопка не отправляет деньги родителю. Она сохраняет историю, исключает уже возвращённую сумму из собранных оплат и создаёт расход возврата в ДДС того же округа.
            </div>

            {error && <div className="mt-4 rounded-[15px] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
            {success && (
              <div className="mt-4 rounded-[16px] border border-[#5F6338]/15 bg-[#5F6338]/[0.07] p-4">
                <p className="text-sm font-semibold text-[#4D512E]">{success}</p>
                <button
                  type="button"
                  onClick={() => { setOpen(false); openAdminSection("archive"); }}
                  className="mt-3 flex items-center gap-2 rounded-full bg-[#171717] px-4 py-2.5 text-xs font-semibold text-white"
                >
                  Теперь перевести ребёнка в «Выбывшие» <ArrowRight size={14} />
                </button>
              </div>
            )}

            <div className="relative mt-5">
              <Search className="absolute left-3.5 top-1/2 h-[17px] w-[17px] -translate-y-1/2 text-black/25" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Найти ребёнка, округ или месяц"
                className="w-full rounded-[14px] border border-black/[0.07] bg-white py-3 pl-10 pr-4 text-sm outline-none placeholder:text-black/25"
              />
            </div>

            {loading && rows.length === 0 ? (
              <div className="grid min-h-[260px] place-items-center"><LoaderCircle className="animate-spin text-black/25" size={28} /></div>
            ) : visible.length === 0 ? (
              <div className="mt-4 rounded-[20px] bg-white px-5 py-12 text-center text-sm text-black/40">Подходящих оплат для возврата нет.</div>
            ) : (
              <div className="mt-4 space-y-2">
                {visible.map((row) => (
                  <article key={row.receiptId} className="rounded-[20px] border border-black/[0.055] bg-white p-4 sm:p-5">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2"><WalletCards size={16} className="text-[#5F6338]" /><p className="font-semibold">{row.childName}</p></div>
                        <p className="mt-1 text-xs text-black/40">{row.branch || "Округ не указан"} · {monthLabel(row.month)}</p>
                        <p className="mt-1 text-xs text-black/35">Получено {dateLabel(row.receivedAt)} · {methodLabels[row.paymentMethod] || row.paymentMethod}</p>
                        {row.note && <p className="mt-2 text-xs text-black/45">{row.note}</p>}
                      </div>
                      <div className="shrink-0 sm:text-right">
                        <p className="text-xl font-semibold tracking-[-0.03em]">{money(row.amount)}</p>
                        <button
                          type="button"
                          disabled={busyId === row.receiptId}
                          onClick={() => void refund(row)}
                          className="mt-2 flex min-h-[40px] items-center justify-center gap-2 rounded-[12px] bg-red-600 px-4 py-2.5 text-xs font-semibold text-white disabled:opacity-50 sm:ml-auto"
                        >
                          {busyId === row.receiptId ? <LoaderCircle className="animate-spin" size={15} /> : <RotateCcw size={15} />}
                          Зафиксировать возврат
                        </button>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
