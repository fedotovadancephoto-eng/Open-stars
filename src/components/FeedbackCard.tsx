import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import {
  CheckCircle2,
  LoaderCircle,
  MessageSquareHeart,
  Send,
} from "lucide-react";

import { feedbackDate, type ParentFeedback } from "@/feedbackTypes";
import { fetchParentFeedback, sendParentFeedback } from "@/parentFeedbackApi";

type FeedbackCategory = "app" | "education";
const categories: Array<{ id: FeedbackCategory; label: string }> = [
  { id: "app", label: "О приложении" },
  { id: "education", label: "Об обучении" },
];

export function FeedbackCard({ childId, refreshKey = 0, focusId = "", focusKey = "" }: {
  childId: string; refreshKey?: number; focusId?: string; focusKey?: string;
}) {
  const [category, setCategory] = useState<FeedbackCategory>("app");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);
  const [history, setHistory] = useState<ParentFeedback[]>([]);
  const [loading, setLoading] = useState(true);
  const [historyError, setHistoryError] = useState("");
  const generation = useRef(0);
  const focused = useRef("");
  const submitting = useRef(false);

  const refresh = useCallback(async () => {
    const current = ++generation.current;
    try {
      const rows = await fetchParentFeedback(childId);
      if (current !== generation.current) return;
      setHistory(rows); setHistoryError("");
    } catch {
      if (current === generation.current) setHistoryError("Не удалось обновить историю обращений. Нажмите «Обновить».");
    } finally { if (current === generation.current) setLoading(false); }
  }, [childId]);

  useEffect(() => {
    void refresh();
    const update = () => { if (!document.hidden) void refresh(); };
    const timer = window.setInterval(update, 20000);
    window.addEventListener("focus", update);
    document.addEventListener("visibilitychange", update);
    return () => {
      generation.current += 1;
      window.clearInterval(timer);
      window.removeEventListener("focus", update);
      document.removeEventListener("visibilitychange", update);
    };
  }, [refresh, refreshKey]);

  useEffect(() => {
    if (!focusId || focused.current === `${focusId}:${focusKey}` || !history.some(item => item.id === focusId)) return;
    const element = document.getElementById(`parent-feedback-${focusId}`);
    if (element) { element.scrollIntoView({ behavior: "smooth", block: "start" }); focused.current = `${focusId}:${focusKey}`; }
  }, [focusId, focusKey, history]);


  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (submitting.current) return;
    const clean = message.trim();

    if (clean.length < 3) {
      setError("Напишите, пожалуйста, немного подробнее.");
      return;
    }

    submitting.current = true;
    setSending(true);
    setError("");
    setSent(false);

    try {
      await sendParentFeedback(childId, category, clean);
      void refresh();
      setMessage("");
      setSent(true);
      window.setTimeout(() => setSent(false), 5000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось отправить сообщение.");
    } finally {
      submitting.current = false;
      setSending(false);
    }
  }

  return (
    <section className="mt-2 pb-10">
      <div className="overflow-hidden rounded-[28px] border border-black/[0.055] bg-white shadow-[0_10px_34px_rgba(0,0,0,0.045)]">
        <div className="bg-[#171717] px-5 py-5 text-white sm:px-7">
          <div className="flex items-start gap-3">
            <div className="grid h-11 w-11 shrink-0 place-items-center rounded-[15px] bg-white/10 text-[#E8752A]">
              <MessageSquareHeart size={22} />
            </div>
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-white/45">Нам важно ваше мнение</p>
              <h2 className="mt-1 text-xl font-semibold tracking-[-0.025em]">Обратная связь</h2>
              <p className="mt-1.5 max-w-2xl text-sm leading-6 text-white/55">
                Расскажите, что можно улучшить в приложении или в обучении. Ответ школы появится здесь и в уведомлениях.
              </p>
            </div>
          </div>
        </div>

        <div className="p-5 sm:p-7">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-lg font-semibold">Мои обращения{history.length > 0 && ` · ${history.length}`}</h3>
            <button type="button" onClick={() => void refresh()} className="rounded-xl bg-[#F2F0E8] px-3 py-2 text-sm">Обновить</button>
          </div>
          {historyError && <p role="alert" className="mt-3 text-sm text-red-700">{historyError}</p>}
          {loading ? <p className="mt-3 text-sm text-black/45">Загружаем обращения…</p> : history.length === 0 && !historyError ? <p className="mt-3 text-sm text-black/45">Пока нет обращений. Напишите нам ниже.</p> : <div className="mt-4 space-y-4">
            {history.map(item => <article id={`parent-feedback-${item.id}`} key={item.id} className={`scroll-mt-24 rounded-2xl border p-4 ${focusId === item.id ? "border-[#D96A24]/50" : "border-black/10"}`}>
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-black/45">
                <span>{item.category === "app" ? "О приложении" : "Об обучении"} · {feedbackDate(item.created_at)}</span>
                <span className={`rounded-full px-3 py-1 ${item.replies.length ? "bg-[#5F6338]/10 text-[#4D512E]" : "bg-[#D96A24]/10 text-[#C95320]"}`}>{item.replies.length ? "Есть ответ школы" : "Сообщение отправлено"}</span>
              </div>
              <p className="mt-3 text-xs font-semibold text-black/45">Вы написали</p>
              <p className="mt-1 whitespace-pre-wrap break-words text-sm leading-6">{item.message}</p>
              {item.replies.map(reply => <div key={reply.id} className="mt-3 rounded-xl bg-[#5F6338]/[0.07] p-4">
                <p className="text-sm font-semibold text-[#4D512E]">Ответ школы · {reply.staff_name_snapshot}</p>
                <p className="mt-1 text-xs text-black/45">{feedbackDate(reply.created_at)}</p>
                <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6">{reply.message}</p>
              </div>)}
            </article>)}
          </div>}
        </div>
        <form onSubmit={handleSubmit} className="border-t border-black/[0.06] p-5 sm:p-7">
          <h3 className="mb-4 text-lg font-semibold">Новое обращение</h3>
          <div className="flex flex-wrap gap-2">
            {categories.map((item) => (
              <button
                key={item.id}
                disabled={sending}
                type="button"
                onClick={() => setCategory(item.id)}
                className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                  category === item.id
                    ? "bg-[#D96A24] text-white"
                    : "bg-[#F2F0E8] text-black/55 hover:bg-[#ECE9DE]"
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>

          <textarea
            disabled={sending}
            aria-label="Текст обращения"
            value={message}
            onChange={(event) => {
              setMessage(event.target.value.slice(0, 2000));
              setError("");
            }}
            rows={5}
            placeholder={category === "app" ? "Что вам удобно, чего не хватает, что стоит улучшить?" : "Что вы думаете об обучении, занятиях или организации?"}
            className="mt-4 w-full resize-none rounded-[18px] border border-black/[0.07] bg-[#FAF9F5] px-4 py-4 text-sm leading-6 text-[#171717] outline-none placeholder:text-black/25 focus:border-[#D96A24]/40 focus:ring-4 focus:ring-[#D96A24]/[0.06]"
          />

          <div className="mt-2 flex items-center justify-between gap-3">
            <span className="text-[11px] text-black/30">{message.length}/2000</span>
            <span className="text-[11px] text-black/30">Можно писать в любое время</span>
          </div>

          {error && (
            <div className="mt-4 rounded-[15px] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          {sent && (
            <div className="mt-4 flex items-center gap-2 rounded-[15px] border border-[#5F6338]/15 bg-[#5F6338]/[0.07] px-4 py-3 text-sm font-medium text-[#4D512E]">
              <CheckCircle2 size={18} />
              Сообщение отправлено. Ответ появится в «Моих обращениях».
            </div>
          )}

          <button
            type="submit"
            disabled={sending || message.trim().length < 3}
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-[16px] bg-[#171717] px-5 py-3.5 text-sm font-semibold text-white transition hover:bg-black disabled:cursor-not-allowed disabled:opacity-35 sm:w-auto sm:min-w-[190px]"
          >
            {sending ? <LoaderCircle className="animate-spin" size={18} /> : <Send size={18} />}
            Отправить
          </button>
        </form>
      </div>
    </section>
  );
}
