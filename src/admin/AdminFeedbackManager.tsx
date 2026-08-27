import { useEffect, useMemo, useState } from "react";
import { Archive, CheckCircle2, Inbox, LoaderCircle, MessageSquareHeart, Trash2, X } from "lucide-react";

import { getValidStaffSession } from "@/admin/adminApi";

const SUPABASE_URL = "https://yiwiykbuaggyslfyhlfo.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_1MORh5rY7uMDVYLYVX5VAA_cyoph4-7";

type FeedbackStatus = "new" | "read" | "closed" | "archived";

type FeedbackRow = {
  id: string;
  category: "app" | "education";
  message: string;
  status: FeedbackStatus;
  branch_snapshot: string | null;
  child_name_snapshot: string | null;
  parent_name_snapshot: string | null;
  created_at: string;
  read_at: string | null;
  closed_at: string | null;
  archived_at: string | null;
};

const statusLabels: Record<FeedbackStatus, string> = {
  new: "Новое",
  read: "В работе",
  closed: "Обработано",
  archived: "Архив",
};

const categoryLabels = { app: "О приложении", education: "Об обучении" } as const;

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("ru-RU", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(date);
}

async function staffRequest(path: string, options?: RequestInit) {
  const session = await getValidStaffSession();
  if (!session) throw new Error("Сессия сотрудника истекла.");
  return fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...options,
    headers: {
      apikey: SUPABASE_PUBLISHABLE_KEY,
      Authorization: `Bearer ${session.access_token}`,
      "Content-Type": "application/json",
      ...(options?.headers || {}),
    },
  });
}

async function loadFeedback(): Promise<FeedbackRow[]> {
  const response = await staffRequest("parent_feedback?select=id,category,message,status,branch_snapshot,child_name_snapshot,parent_name_snapshot,created_at,read_at,closed_at,archived_at&order=created_at.desc");
  if (!response.ok) throw new Error("Не удалось загрузить обратную связь.");
  return response.json();
}

async function setStatus(id: string, status: FeedbackStatus) {
  const now = new Date().toISOString();
  const body: Record<string, unknown> = { status };
  if (status === "read") body.read_at = now;
  if (status === "closed") { body.read_at = now; body.closed_at = now; }
  if (status === "archived") { body.read_at = now; body.closed_at = now; body.archived_at = now; }
  const response = await staffRequest(`parent_feedback?id=eq.${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new Error("Не удалось изменить статус сообщения.");
}

async function deleteFeedback(id: string) {
  const response = await staffRequest("rpc/staff_delete_feedback", {
    method: "POST",
    body: JSON.stringify({ p_feedback_id: id }),
  });
  if (!response.ok) throw new Error("Не удалось удалить сообщение.");
}

export function AdminFeedbackManager() {
  const [enabled, setEnabled] = useState(false);
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<FeedbackRow[]>([]);
  const [filter, setFilter] = useState<"all" | FeedbackStatus>("all");
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState("");
  const [error, setError] = useState("");

  async function refresh(silent = false) {
    if (!silent) setLoading(true);
    try {
      const next = await loadFeedback();
      setRows(next);
      setEnabled(true);
      setError("");
    } catch (e) {
      if (!silent) setError(e instanceof Error ? e.message : "Не удалось загрузить сообщения.");
    } finally {
      if (!silent) setLoading(false);
    }
  }

  useEffect(() => {
    let cancelled = false;
    let timer = 0;
    const detect = async () => {
      try { await refresh(true); }
      catch { if (!cancelled) timer = window.setTimeout(detect, 1300); }
    };
    detect();
    const polling = window.setInterval(() => { if (!cancelled && enabled) refresh(true); }, 7000);
    return () => { cancelled = true; if (timer) window.clearTimeout(timer); window.clearInterval(polling); };
  }, [enabled]);

  const visible = useMemo(() => filter === "all" ? rows : rows.filter((item) => item.status === filter), [filter, rows]);
  const newCount = rows.filter((item) => item.status === "new").length;

  async function change(id: string, status: FeedbackStatus) {
    setBusyId(id); setError("");
    try { await setStatus(id, status); await refresh(true); }
    catch (e) { setError(e instanceof Error ? e.message : "Не удалось изменить сообщение."); }
    finally { setBusyId(""); }
  }

  async function remove(item: FeedbackRow) {
    const ok = window.confirm("Удалить это сообщение навсегда? Для рабочих обращений лучше использовать Архив. Удаление предназначено прежде всего для тестовых сообщений.");
    if (!ok) return;
    setBusyId(item.id); setError("");
    try { await deleteFeedback(item.id); await refresh(true); }
    catch (e) { setError(e instanceof Error ? e.message : "Не удалось удалить сообщение."); }
    finally { setBusyId(""); }
  }

  if (!enabled) return null;

  return <>
    <button type="button" onClick={() => { setOpen(true); refresh(); }} className="fixed bottom-[40.9rem] right-4 z-40 flex items-center gap-2 rounded-full bg-[#5F6338] px-4 py-3 text-sm font-semibold text-white shadow-[0_10px_30px_rgba(0,0,0,0.18)] sm:right-6">
      <MessageSquareHeart size={17}/> Обратная связь {newCount > 0 && <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-bold text-[#4D512E]">{newCount}</span>}
    </button>

    {open && <div className="fixed inset-0 z-[86] flex items-end justify-center bg-black/30 backdrop-blur-[2px] sm:items-center sm:p-5" onClick={() => setOpen(false)}>
      <div className="max-h-[96vh] w-full max-w-5xl overflow-y-auto rounded-t-[28px] bg-[#FAF9F5] p-5 shadow-2xl sm:rounded-[28px] sm:p-7" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-4">
          <div><p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#D96A24]">OPEN STARS ADMIN</p><h2 className="mt-1 text-2xl font-semibold">Обратная связь родителей</h2><p className="mt-2 text-sm leading-6 text-black/45">Рабочие обращения храним в истории. Тестовые можно удалить навсегда.</p></div>
          <button type="button" onClick={() => setOpen(false)} className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-white"><X size={20}/></button>
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          {(["all","new","read","closed","archived"] as const).map((item) => <button key={item} type="button" onClick={() => setFilter(item)} className={`rounded-full px-3.5 py-2 text-xs font-semibold ${filter === item ? "bg-[#171717] text-white" : "bg-white text-black/50"}`}>{item === "all" ? `Все · ${rows.length}` : `${statusLabels[item]} · ${rows.filter((row) => row.status === item).length}`}</button>)}
        </div>

        {error && <div className="mt-4 rounded-[15px] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

        {loading ? <div className="grid min-h-[180px] place-items-center"><LoaderCircle className="animate-spin text-black/25"/></div> : visible.length === 0 ? <div className="mt-5 rounded-[20px] bg-white px-5 py-10 text-center text-sm text-black/40"><Inbox className="mx-auto mb-2 text-black/20"/>В этом разделе сообщений нет.</div> : <div className="mt-5 space-y-3">
          {visible.map((item) => <article key={item.id} className={`rounded-[20px] border bg-white p-4 sm:p-5 ${item.status === "new" ? "border-[#D96A24]/30" : "border-black/[0.055]"}`}>
            <div className="flex flex-wrap items-start justify-between gap-3"><div><div className="flex flex-wrap gap-2"><span className="rounded-full bg-[#FAF9F5] px-2.5 py-1 text-[10px] font-bold uppercase text-black/45">{categoryLabels[item.category]}</span><span className="rounded-full bg-[#5F6338]/10 px-2.5 py-1 text-[10px] font-bold text-[#4D512E]">{statusLabels[item.status]}</span></div><p className="mt-3 font-semibold">{item.parent_name_snapshot || "Родитель"}</p><p className="mt-1 text-xs text-black/40">{[item.child_name_snapshot,item.branch_snapshot,formatDate(item.created_at)].filter(Boolean).join(" · ")}</p></div></div>
            <p className="mt-4 whitespace-pre-wrap text-sm leading-6 text-black/65">{item.message}</p>
            <div className="mt-4 flex flex-wrap gap-2">
              {item.status === "new" && <button type="button" disabled={busyId===item.id} onClick={() => change(item.id,"read")} className="rounded-[11px] border border-black/[0.07] px-3 py-2 text-xs font-semibold">В работу</button>}
              {(item.status === "new" || item.status === "read") && <button type="button" disabled={busyId===item.id} onClick={() => change(item.id,"closed")} className="flex items-center gap-1.5 rounded-[11px] bg-[#171717] px-3 py-2 text-xs font-semibold text-white"><CheckCircle2 size={14}/> Обработано</button>}
              {item.status !== "archived" && <button type="button" disabled={busyId===item.id} onClick={() => change(item.id,"archived")} className="flex items-center gap-1.5 rounded-[11px] bg-[#F2F0E8] px-3 py-2 text-xs font-semibold text-black/55"><Archive size={14}/> В архив</button>}
              <button type="button" disabled={busyId===item.id} onClick={() => remove(item)} className="ml-auto flex items-center gap-1.5 rounded-[11px] px-3 py-2 text-xs font-semibold text-red-600 hover:bg-red-50"><Trash2 size={14}/> Удалить тестовое</button>
            </div>
          </article>)}
        </div>}
      </div>
    </div>}
  </>;
}
