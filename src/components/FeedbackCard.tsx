import { FormEvent, useState } from "react";
import {
  CheckCircle2,
  LoaderCircle,
  MessageSquareHeart,
  Send,
} from "lucide-react";

import { child } from "@/data/demoData";
import { getValidParentSession } from "@/openStarsApi";

const SUPABASE_URL = "https://yiwiykbuaggyslfyhlfo.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_1MORh5rY7uMDVYLYVX5VAA_cyoph4-7";

type FeedbackCategory = "app" | "education";

const categories: Array<{ id: FeedbackCategory; label: string }> = [
  { id: "app", label: "О приложении" },
  { id: "education", label: "Об обучении" },
];

const wait = (ms: number) => new Promise((resolve) => window.setTimeout(resolve, ms));

async function sendFeedback(category: FeedbackCategory, message: string) {
  const session = await getValidParentSession();
  if (!session) throw new Error("Сессия истекла. Войдите снова.");
  if (!child.id) throw new Error("Не удалось определить ребёнка.");

  const request = () =>
    fetch(`${SUPABASE_URL}/rest/v1/rpc/submit_parent_feedback`, {
      method: "POST",
      headers: {
        apikey: SUPABASE_PUBLISHABLE_KEY,
        Authorization: `Bearer ${session.access_token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        p_child_id: child.id,
        p_category: category,
        p_message: message,
      }),
    });

  let response = await request();
  if (response.status === 401) {
    await wait(1600);
    response = await request();
  }

  if (!response.ok) {
    let detail = "";
    try {
      const payload = await response.json();
      detail = payload?.message || payload?.details || "";
    } catch {
      // ignore non-json response
    }
    throw new Error(detail || "Не удалось отправить сообщение. Попробуйте ещё раз.");
  }
}

export function FeedbackCard() {
  const [category, setCategory] = useState<FeedbackCategory>("app");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const clean = message.trim();

    if (clean.length < 3) {
      setError("Напишите, пожалуйста, немного подробнее.");
      return;
    }

    setSending(true);
    setError("");
    setSent(false);

    try {
      await sendFeedback(category, clean);
      setMessage("");
      setSent(true);
      window.setTimeout(() => setSent(false), 5000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось отправить сообщение.");
    } finally {
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
                Расскажите, что можно улучшить в приложении или в обучении. Сообщение увидит команда OPEN STARS.
              </p>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-5 sm:p-7">
          <div className="flex flex-wrap gap-2">
            {categories.map((item) => (
              <button
                key={item.id}
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
              Спасибо! Сообщение отправлено команде OPEN STARS.
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
