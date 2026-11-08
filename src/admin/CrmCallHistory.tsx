import { useEffect, useState } from "react";
import { Headphones, LoaderCircle, PhoneIncoming, PhoneOutgoing } from "lucide-react";

import { CrmCallLog, fetchCrmCallLogs, fetchCrmCallRecording } from "@/admin/crmApi";

function formatCallDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("ru-RU", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }).format(date);
}

function formatDuration(value: number | null) {
  if (value == null) return "—";
  const minutes = Math.floor(value / 60);
  const seconds = value % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

const outcomeLabels: Record<CrmCallLog["outcome"], string> = {
  answered: "Состоялся",
  missed: "Пропущен",
  busy: "Занято",
  failed: "Не состоялся",
  unknown: "Статус не определён",
};

export function CrmCallHistory({ leadId }: { leadId: string }) {
  const [calls, setCalls] = useState<CrmCallLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [playingId, setPlayingId] = useState("");
  const [audioUrl, setAudioUrl] = useState("");
  const [audioError, setAudioError] = useState("");
  const [audioBusy, setAudioBusy] = useState("");
  useEffect(() => () => { if (audioUrl) URL.revokeObjectURL(audioUrl); }, [audioUrl]);
  async function play(callId: string) {
    setAudioBusy(callId); setAudioError("");
    try {
      const blob = await fetchCrmCallRecording(callId);
      const url = URL.createObjectURL(blob);
      setAudioUrl(url);
      setPlayingId(callId);
    } catch (e) { setAudioError(e instanceof Error ? e.message : "Не удалось открыть запись."); }
    finally { setAudioBusy(""); }
  }


  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    setCalls([]);
    void fetchCrmCallLogs(leadId)
      .then((rows) => { if (active) setCalls(rows); })
      .catch(() => { if (active) setError("Не удалось загрузить историю звонков."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [leadId]);

  return (
    <section className="mt-4 rounded-[18px] bg-white p-4">
      <div className="flex items-center gap-2">
        <Headphones size={18} className="text-[#D96A24]" />
        <h3 className="font-semibold">Звонки и записи</h3>
      </div>
      {loading && <p className="mt-3 flex items-center gap-2 text-sm text-black/45"><LoaderCircle size={15} className="animate-spin" />Загружаем историю…</p>}
      {!loading && error && <p role="alert" className="mt-3 text-sm text-red-600">{error}</p>}
      {!loading && !error && calls.length === 0 && (
        <p className="mt-2 text-sm leading-6 text-black/50">Звонков пока нет. Раздел подготовлен, но АТС и автоматическая запись ещё не подключены.</p>
      )}
      {audioError && <p role="alert" className="mt-2 text-xs text-red-600">{audioError}</p>}
      {!loading && !error && calls.length > 0 && (
        <ul className="mt-3 space-y-2">
          {calls.map((call) => (
            <li key={call.id} className="rounded-[14px] border border-black/[0.06] bg-[#FAF9F5] p-3">
              <div className="flex items-center gap-2">
                {call.direction === "inbound" ? <PhoneIncoming size={16} className="text-[#5F6338]" /> : <PhoneOutgoing size={16} className="text-[#D96A24]" />}
                <span className="text-sm font-semibold">{call.direction === "inbound" ? "Входящий" : "Исходящий"}</span>
                <span className="ml-auto text-xs text-black/45">{formatCallDate(call.startedAt)}</span>
              </div>
              <p className="mt-1 text-xs text-black/55">{outcomeLabels[call.outcome]} · {formatDuration(call.durationSeconds)} · {call.clientPhone || "Номер скрыт"}</p>
              {call.recordingState === "ready" && <div className="mt-2">
                <button type="button" disabled={Boolean(audioBusy)} onClick={() => void play(call.id)} className="rounded-lg bg-[#5F6338]/10 px-3 py-2 text-xs font-semibold text-[#4D512E] disabled:opacity-40">
                  {audioBusy === call.id ? "Загрузка записи…" : "Слушать запись"}
                </button>
                {playingId === call.id && audioUrl && <audio controls preload="none" src={audioUrl} className="mt-2 w-full" />}
              </div>}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
