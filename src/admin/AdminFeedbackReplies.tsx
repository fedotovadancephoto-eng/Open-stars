import { useRef, useState } from "react";
import { LoaderCircle, MessageCircle, Send } from "lucide-react";
import { getValidStaffSession } from "@/admin/adminApi";
import { feedbackDate, type FeedbackReply } from "@/feedbackTypes";

async function sendReply(feedbackId: string, message: string, requestId: string): Promise<FeedbackReply> {
  const session = await getValidStaffSession();
  if (!session) throw new Error("Сессия сотрудника истекла. Войдите снова.");
  const response = await fetch("https://yiwiykbuaggyslfyhlfo.supabase.co/rest/v1/rpc/staff_reply_parent_feedback", {
    method: "POST",
    headers: {
      apikey: "sb_publishable_1MORh5rY7uMDVYLYVX5VAA_cyoph4-7",
      Authorization: `Bearer ${session.access_token}`, "Content-Type": "application/json",
    },
    body: JSON.stringify({ p_feedback_id: feedbackId, p_message: message, p_request_id: requestId }),
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload.message || "Не удалось отправить ответ. Повторите отправку.");
  }
  return response.json();
}

export function AdminFeedbackReplies({ feedbackId, replies, onSent }: {
  feedbackId: string; replies: FeedbackReply[]; onSent: (reply: FeedbackReply) => void;
}) {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);
  const attempt = useRef<{ message: string; id: string } | null>(null);
  const submitting = useRef(false);

  async function submit() {
    const clean = message.trim();
    if (!clean || submitting.current) return;
    submitting.current = true;
    setSending(true); setError(""); setSent(false);
    // Keep the request ID after a timeout: retrying cannot send the same reply twice.
    if (attempt.current?.message !== clean) attempt.current = { message: clean, id: crypto.randomUUID() };
    try {
      const reply = await sendReply(feedbackId, clean, attempt.current.id);
      onSent(reply);
      setMessage(""); setOpen(false); setSent(true); attempt.current = null;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось отправить ответ. Повторите отправку.");
    } finally { submitting.current = false; setSending(false); }
  }

  return <div className="mt-4 border-t border-black/[0.06] pt-4">
    {replies.length > 0 && <div className="mb-3 space-y-3" aria-label="Ответы школы">
      {[...replies].sort((a, b) => a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id)).map(reply => <div key={reply.id} className="rounded-2xl bg-[#5F6338]/[0.07] p-4">
        <p className="text-xs font-semibold text-[#4D512E]">{reply.staff_name_snapshot} · {feedbackDate(reply.created_at)}</p>
        <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6">{reply.message}</p>
      </div>)}
    </div>}
    {sent && <p role="status" className="mb-3 text-sm text-[#4D512E]">Ответ отправлен родителю.</p>}
    {open ? <form onSubmit={e => { e.preventDefault(); void submit(); }}>
      <label htmlFor={`feedback-reply-${feedbackId}`} className="text-sm font-semibold">Ответ родителю</label>
      <textarea id={`feedback-reply-${feedbackId}`} value={message} onChange={e => setMessage(e.target.value)} maxLength={2000} rows={4} disabled={sending} placeholder="Напишите ответ — родитель увидит его в своём кабинете." className="mt-2 w-full resize-y rounded-2xl border border-black/10 bg-white p-3 text-sm leading-6 outline-none focus:border-[#D96A24]" />
      <p className="mt-1 text-xs text-black/45">{message.length}/2000 · Родитель получит уведомление об ответе.</p>
      {error && <p role="alert" className="mt-2 text-sm text-red-700">{error}</p>}
      <div className="mt-3 flex flex-wrap gap-2">
        <button type="submit" disabled={sending || !message.trim()} className="flex items-center gap-2 rounded-xl bg-[#D96A24] px-4 py-3 text-sm font-semibold text-white disabled:opacity-40">{sending ? <LoaderCircle size={16} className="animate-spin" /> : <Send size={16} />}Отправить ответ</button>
        <button type="button" onClick={() => setOpen(false)} disabled={sending} className="rounded-xl px-4 py-3 text-sm text-black/50">Свернуть</button>
      </div>
    </form> : <button type="button" onClick={() => { setOpen(true); setSent(false); }} className="flex items-center gap-2 rounded-xl bg-[#D96A24] px-4 py-3 text-sm font-semibold text-white"><MessageCircle size={16} />{replies.length ? "Дополнить ответ" : "Ответить родителю"}</button>}
  </div>;
}
