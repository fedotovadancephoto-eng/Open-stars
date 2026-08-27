import { useEffect, useMemo, useRef, useState } from "react";
import {
  Bell,
  BellOff,
  CheckCircle2,
  Inbox,
  LoaderCircle,
  MessageSquareHeart,
} from "lucide-react";

import { getValidStaffSession } from "@/admin/adminApi";

const SUPABASE_URL = "https://yiwiykbuaggyslfyhlfo.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_1MORh5rY7uMDVYLYVX5VAA_cyoph4-7";

type FeedbackStatus = "new" | "read" | "closed";
type FeedbackCategory = "app" | "education";
type NotificationState = NotificationPermission | "unsupported";

type FeedbackRow = {
  id: string;
  category: FeedbackCategory;
  message: string;
  status: FeedbackStatus;
  branch_snapshot: string | null;
  child_name_snapshot: string | null;
  parent_name_snapshot: string | null;
  created_at: string;
  read_at: string | null;
  closed_at: string | null;
};

const categoryLabels: Record<FeedbackCategory, string> = {
  app: "О приложении",
  education: "Об обучении",
};

const statusLabels: Record<FeedbackStatus, string> = {
  new: "Новое",
  read: "Просмотрено",
  closed: "Закрыто",
};

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function currentNotificationState(): NotificationState {
  if (typeof window === "undefined" || !("Notification" in window)) return "unsupported";
  return Notification.permission;
}

function showSystemNotification(count: number, latest?: FeedbackRow) {
  if (typeof window === "undefined" || !("Notification" in window) || Notification.permission !== "granted") return;

  const details = [
    latest?.parent_name_snapshot,
    latest?.child_name_snapshot,
    latest?.branch_snapshot,
  ].filter(Boolean).join(" · ");

  try {
    const notification = new Notification(
      count === 1 ? "Новая обратная связь OPEN STARS" : `Новых сообщений: ${count}`,
      {
        body: details || "Родитель отправил новое сообщение.",
        tag: "open-stars-parent-feedback",
      }
    );

    notification.onclick = () => {
      window.focus();
      notification.close();
    };
  } catch {
    // Некоторые мобильные браузеры поддерживают разрешение только через установленное веб-приложение.
  }
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
  const response = await staffRequest(
    "parent_feedback?select=id,category,message,status,branch_snapshot,child_name_snapshot,parent_name_snapshot,created_at,read_at,closed_at&order=created_at.desc"
  );
  if (!response.ok) throw new Error("Не удалось загрузить обратную связь.");
  return response.json();
}

async function setFeedbackStatus(id: string, status: FeedbackStatus) {
  const now = new Date().toISOString();
  const body: Record<string, unknown> = { status };
  if (status === "read") body.read_at = now;
  if (status === "closed") {
    body.read_at = now;
    body.closed_at = now;
  }

  const response = await staffRequest(`parent_feedback?id=eq.${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new Error("Не удалось изменить статус сообщения.");
}

export function AdminFeedbackInbox() {
  const [rows, setRows] = useState<FeedbackRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [updatingId, setUpdatingId] = useState("");
  const [filter, setFilter] = useState<"all" | FeedbackStatus>("all");
  const [toastCount, setToastCount] = useState(0);
  const [notificationState, setNotificationState] = useState<NotificationState>(() => currentNotificationState());
  const previousNewCount = useRef<number | null>(null);

  async function enableNotifications() {
    if (typeof window === "undefined" || !("Notification" in window)) {
      setNotificationState("unsupported");
      return;
    }

    try {
      const permission = await Notification.requestPermission();
      setNotificationState(permission);
      if (permission === "granted") {
        showSystemNotification(1, {
          id: "preview",
          category: "app",
          message: "",
          status: "new",
          branch_snapshot: null,
          child_name_snapshot: null,
          parent_name_snapshot: "Уведомления включены",
          created_at: new Date().toISOString(),
          read_at: null,
          closed_at: null,
        });
      }
    } catch {
      setNotificationState(currentNotificationState());
    }
  }

  async function refresh(silent = false) {
    if (!silent) setLoading(true);
    try {
      const next = await loadFeedback();
      const newRows = next.filter((item) => item.status === "new");
      const newCount = newRows.length;

      if (previousNewCount.current !== null && newCount > previousNewCount.current) {
        const delta = newCount - previousNewCount.current;
        setToastCount(delta);
        showSystemNotification(delta, newRows[0]);
        window.setTimeout(() => setToastCount(0), 6500);
      }

      previousNewCount.current = newCount;
      setRows(next);
      setError("");
    } catch (err) {
      if (!silent) setError(err instanceof Error ? err.message : "Не удалось загрузить обратную связь.");
    } finally {
      if (!silent) setLoading(false);
    }
  }

  useEffect(() => {
    setNotificationState(currentNotificationState());
    refresh();
    const timer = window.setInterval(() => refresh(true), 5000);
    return () => window.clearInterval(timer);
  }, []);

  const newCount = rows.filter((item) => item.status === "new").length;
  const visible = useMemo(
    () => (filter === "all" ? rows : rows.filter((item) => item.status === filter)),
    [filter, rows]
  );

  async function changeStatus(id: string, status: FeedbackStatus) {
    setUpdatingId(id);
    setError("");
    try {
      await setFeedbackStatus(id, status);
      await refresh(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось изменить статус.");
    } finally {
      setUpdatingId("");
    }
  }

  return (
    <>
      {toastCount > 0 && (
        <div className="fixed right-4 top-4 z-[80] flex max-w-sm items-center gap-3 rounded-[18px] bg-[#171717] px-4 py-3 text-sm font-semibold text-white shadow-2xl sm:right-6 sm:top-6">
          <MessageSquareHeart className="shrink-0 text-[#E8752A]" size={20} />
          Новая обратная связь от родителей: {toastCount}
        </div>
      )}

      <section className="mt-6 rounded-[26px] border border-black/[0.05] bg-white p-4 shadow-[0_10px_35px_rgba(0,0,0,0.035)] sm:p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="grid h-11 w-11 shrink-0 place-items-center rounded-[15px] bg-[#D96A24]/10 text-[#C95320]">
              <Inbox size={21} />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-xl font-semibold tracking-[-0.025em]">Обратная связь от родителей</h2>
                {newCount > 0 && <span className="rounded-full bg-[#D96A24] px-2.5 py-1 text-[11px] font-bold text-white">{newCount} новых</span>}
              </div>
              <p className="mt-1 text-sm text-black/40">Сообщения о приложении и обучении. Список обновляется автоматически.</p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {notificationState === "default" && (
              <button type="button" onClick={enableNotifications} className="flex items-center gap-1.5 rounded-full bg-[#D96A24] px-3.5 py-2 text-xs font-semibold text-white">
                <Bell size={14} /> Включить уведомления
              </button>
            )}
            {notificationState === "granted" && (
              <span className="flex items-center gap-1.5 rounded-full bg-[#5F6338]/10 px-3.5 py-2 text-xs font-semibold text-[#4D512E]">
                <Bell size={14} /> Уведомления включены
              </span>
            )}
            {notificationState === "denied" && (
              <span className="flex items-center gap-1.5 rounded-full bg-black/[0.06] px-3.5 py-2 text-xs font-semibold text-black/40">
                <BellOff size={14} /> Уведомления запрещены в браузере
              </span>
            )}
            {(["all", "new", "read", "closed"] as const).map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => setFilter(item)}
                className={`rounded-full px-3 py-2 text-xs font-semibold ${filter === item ? "bg-[#171717] text-white" : "bg-[#F2F0E8] text-black/50"}`}
              >
                {item === "all" ? "Все" : statusLabels[item]}
              </button>
            ))}
          </div>
        </div>

        {notificationState === "unsupported" && (
          <div className="mt-4 rounded-[15px] bg-[#F5F3EC] px-4 py-3 text-xs leading-5 text-black/45">
            Этот браузер не поддерживает системные уведомления для обычной вкладки. Внутренний счётчик и всплывающее уведомление в админке продолжат работать.
          </div>
        )}

        {error && <div className="mt-4 rounded-[15px] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

        {loading ? (
          <div className="grid min-h-[150px] place-items-center"><LoaderCircle className="animate-spin text-black/25" /></div>
        ) : visible.length === 0 ? (
          <div className="mt-5 rounded-[20px] bg-[#FAF9F5] px-5 py-10 text-center text-sm text-black/40">Сообщений пока нет.</div>
        ) : (
          <div className="mt-5 space-y-3">
            {visible.map((item) => (
              <article key={item.id} className={`rounded-[20px] border p-4 sm:p-5 ${item.status === "new" ? "border-[#D96A24]/25 bg-[#D96A24]/[0.035]" : "border-black/[0.055] bg-[#FAF9F5]/55"}`}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-white px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-black/50">{categoryLabels[item.category]}</span>
                      <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${item.status === "new" ? "bg-[#D96A24] text-white" : item.status === "closed" ? "bg-black/8 text-black/40" : "bg-[#5F6338]/10 text-[#4D512E]"}`}>{statusLabels[item.status]}</span>
                    </div>
                    <p className="mt-3 text-sm font-semibold text-[#171717]">{item.parent_name_snapshot || "Родитель"}</p>
                    <p className="mt-1 text-xs text-black/40">{[item.child_name_snapshot, item.branch_snapshot, formatDate(item.created_at)].filter(Boolean).join(" · ")}</p>
                  </div>
                </div>

                <p className="mt-4 whitespace-pre-wrap text-sm leading-6 text-black/65">{item.message}</p>

                <div className="mt-4 flex flex-wrap gap-2">
                  {item.status === "new" && (
                    <button type="button" disabled={updatingId === item.id} onClick={() => changeStatus(item.id, "read")} className="rounded-[12px] border border-black/[0.07] bg-white px-3.5 py-2 text-xs font-semibold text-black/55 disabled:opacity-50">Просмотрено</button>
                  )}
                  {item.status !== "closed" && (
                    <button type="button" disabled={updatingId === item.id} onClick={() => changeStatus(item.id, "closed")} className="flex items-center gap-1.5 rounded-[12px] bg-[#171717] px-3.5 py-2 text-xs font-semibold text-white disabled:opacity-50"><CheckCircle2 size={14} /> Закрыть</button>
                  )}
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </>
  );
}
