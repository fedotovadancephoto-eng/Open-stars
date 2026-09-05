import { useEffect, useMemo, useState } from "react";
import { CalendarDays, Check, CreditCard, LoaderCircle, MapPin, RefreshCw, X } from "lucide-react";

import { fetchParentEvents, setParentEventParticipation, SchoolEvent } from "@/eventsApi";

type ParentEventRow = Awaited<ReturnType<typeof fetchParentEvents>>[number];

function money(value: number) {
  return new Intl.NumberFormat("ru-RU", { style: "currency", currency: "RUB", maximumFractionDigits: 0 }).format(value || 0);
}

function dateTime(value: string) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" }).format(date);
}

function eventStatus(event: SchoolEvent) {
  if (event.status === "completed") return "Мероприятие завершено";
  if (event.status === "open") return "Открыта запись";
  return "Запись закрыта";
}

export function EventsTab({ childId, childName }: { childId: string; childName: string }) {
  const [rows, setRows] = useState<ParentEventRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState("");
  const [error, setError] = useState("");

  async function load() {
    if (!childId) return;
    setLoading(true);
    setError("");
    try {
      setRows(await fetchParentEvents(childId));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Не удалось загрузить мероприятия.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, [childId]);

  const openCount = useMemo(() => rows.filter((row) => row.event.status === "open").length, [rows]);

  async function choose(eventId: string, status: "participating" | "declined") {
    setBusyId(eventId);
    setError("");
    try {
      await setParentEventParticipation(eventId, childId, status);
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Не удалось сохранить выбор.");
    } finally {
      setBusyId("");
    }
  }

  return (
    <div className="rounded-[28px] border border-black/[0.055] bg-white p-5 shadow-[0_8px_28px_rgba(0,0,0,0.035)] sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#D96A24]">OPEN STARS · МЕРОПРИЯТИЯ</p>
          <h2 className="mt-1 text-2xl font-semibold tracking-[-0.03em] text-[#171717]">Мероприятия для {childName || "ребёнка"}</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-black/45">Здесь можно подтвердить участие. Оплату администратор отмечает отдельно после фактического поступления денег.</p>
        </div>
        <button type="button" onClick={() => void load()} disabled={loading} className="grid h-10 w-10 place-items-center rounded-full bg-[#FAF9F5] text-black/50 disabled:opacity-50" aria-label="Обновить">
          <RefreshCw size={17} className={loading ? "animate-spin" : ""} />
        </button>
      </div>

      {!loading && rows.length > 0 && <div className="mt-5 rounded-[18px] bg-[#F2F0E8] px-4 py-3 text-sm text-[#4D512E]">Открыто для записи: <strong>{openCount}</strong></div>}

      {loading ? (
        <div className="grid min-h-[220px] place-items-center"><LoaderCircle className="animate-spin text-black/25" size={28}/></div>
      ) : rows.length === 0 ? (
        <div className="mt-5 rounded-[20px] bg-[#FAF9F5] px-5 py-10 text-center text-sm text-black/40">Сейчас доступных мероприятий нет.</div>
      ) : (
        <div className="mt-5 space-y-3">
          {rows.map(({ event, participant, payments }) => {
            const paid = payments.reduce((sum, payment) => sum + payment.amount, 0);
            const fee = participant?.feeAmount ?? event.defaultFee;
            const participating = participant?.status === "participating";
            const declined = participant?.status === "declined";
            const canChoose = event.status === "open";
            return (
              <article key={event.id} className="rounded-[22px] border border-black/[0.06] bg-[#FAF9F5] p-4 sm:p-5">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.08em] ${event.status === "open" ? "bg-[#D96A24]/10 text-[#C95320]" : "bg-black/[0.055] text-black/45"}`}>{eventStatus(event)}</span>
                      {participating && <span className="rounded-full bg-[#5F6338]/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.08em] text-[#4D512E]">Участвуем</span>}
                      {declined && <span className="rounded-full bg-black/[0.055] px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.08em] text-black/40">Отказались</span>}
                    </div>
                    <h3 className="mt-3 text-xl font-semibold tracking-[-0.02em] text-[#171717]">{event.title}</h3>
                    {event.description && <p className="mt-2 text-sm leading-6 text-black/50">{event.description}</p>}
                    <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-xs text-black/45">
                      <span className="flex items-center gap-1.5"><CalendarDays size={14}/>{dateTime(event.startsAt)}</span>
                      {event.location && <span className="flex items-center gap-1.5"><MapPin size={14}/>{event.location}</span>}
                    </div>
                  </div>
                  <div className="shrink-0 rounded-[17px] bg-white px-4 py-3 sm:min-w-[150px]">
                    <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-black/35">Стоимость</p>
                    <p className="mt-1 text-lg font-semibold">{fee == null ? "Уточняется" : money(fee)}</p>
                    {paid > 0 && <p className="mt-1 flex items-center gap-1 text-xs font-semibold text-[#4D512E]"><CreditCard size={13}/> Оплачено {money(paid)}</p>}
                  </div>
                </div>

                {canChoose && (
                  <div className="mt-4 grid grid-cols-2 gap-2">
                    <button type="button" disabled={busyId === event.id} onClick={() => void choose(event.id, "participating")} className={`flex min-h-[44px] items-center justify-center gap-2 rounded-[13px] px-3 text-sm font-semibold transition disabled:opacity-50 ${participating ? "bg-[#5F6338] text-white" : "bg-white text-[#171717]"}`}>
                      {busyId === event.id ? <LoaderCircle size={16} className="animate-spin"/> : <Check size={16}/>} Участвуем
                    </button>
                    <button type="button" disabled={busyId === event.id} onClick={() => void choose(event.id, "declined")} className={`flex min-h-[44px] items-center justify-center gap-2 rounded-[13px] px-3 text-sm font-semibold transition disabled:opacity-50 ${declined ? "bg-[#171717] text-white" : "bg-white text-black/50"}`}>
                      <X size={16}/> Не участвуем
                    </button>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}

      {error && <div className="mt-4 rounded-[14px] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
    </div>
  );
}
