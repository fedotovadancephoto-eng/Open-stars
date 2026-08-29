import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, LoaderCircle, Pencil, Save, Trash2, X, XCircle } from "lucide-react";

import { getValidStaffSession } from "@/admin/adminApi";

const SUPABASE_URL = "https://yiwiykbuaggyslfyhlfo.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_1MORh5rY7uMDVYLYVX5VAA_cyoph4-7";
const fieldClass = "w-full rounded-[11px] border border-black/[0.08] bg-white px-3 py-2.5 text-sm outline-none focus:border-[#D96A24]/45 focus:ring-4 focus:ring-[#D96A24]/[0.06]";

type AttendanceRecord = {
  id: string;
  subject: string;
  present: boolean;
  lessonDate: string;
  createdAt: string;
};

type AttendanceDraft = {
  record: AttendanceRecord;
  present: boolean;
  lessonDate: string;
};

type Props = {
  childId: string;
  refreshKey: number;
};

type ApiError = { message?: string; details?: string };

function formatDate(value: string) {
  if (!value) return "Без даты";
  const [year, month, day] = value.slice(0, 10).split("-");
  return year && month && day ? `${day}.${month}.${year}` : value;
}

async function getSession() {
  const session = await getValidStaffSession();
  if (!session) throw new Error("Сессия сотрудника не найдена. Войдите снова.");
  return session;
}

function friendlyMessage(message: string) {
  if (message.toLowerCase().includes("row-level security")) return "У вас нет доступа к этой отметке посещаемости.";
  if (message.toLowerCase().includes("duplicate key")) return "На эту дату по этому предмету уже есть отметка посещаемости.";
  return message;
}

async function tableRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const session = await getSession();
  const headers = new Headers(init.headers);
  headers.set("apikey", SUPABASE_PUBLISHABLE_KEY);
  headers.set("Authorization", `Bearer ${session.access_token}`);
  if (init.body) headers.set("Content-Type", "application/json");

  const response = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, { ...init, headers });
  if (!response.ok) {
    let message = "Не удалось выполнить действие.";
    try {
      const payload = (await response.json()) as ApiError;
      message = payload.message || payload.details || message;
    } catch {
      // ignore invalid JSON error bodies
    }
    throw new Error(friendlyMessage(message));
  }

  if (response.status === 204) return undefined as T;
  const text = await response.text();
  return (text ? JSON.parse(text) : undefined) as T;
}

async function fetchAttendance(childId: string): Promise<AttendanceRecord[]> {
  if (!childId) return [];
  const query = new URLSearchParams({
    select: "id,subject,present,lesson_date,created_at",
    child_id: `eq.${childId}`,
    order: "lesson_date.desc,created_at.desc",
    limit: "250",
  });
  const rows = await tableRequest<any[]>(`attendance?${query.toString()}`);
  return (rows || []).map((row) => ({
    id: row.id,
    subject: row.subject || "Без предмета",
    present: Boolean(row.present),
    lessonDate: row.lesson_date || "",
    createdAt: row.created_at || "",
  }));
}

async function updateAttendance(input: { id: string; present: boolean; lessonDate: string }) {
  if (!input.lessonDate) throw new Error("Укажите дату занятия.");
  const query = new URLSearchParams({ id: `eq.${input.id}` });
  const rows = await tableRequest<any[]>(`attendance?${query.toString()}`, {
    method: "PATCH",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({ present: input.present, lesson_date: input.lessonDate }),
  });
  if (!rows?.length) throw new Error("Отметка не найдена или у вас нет доступа к ней.");
}

async function deleteAttendance(id: string) {
  const query = new URLSearchParams({ id: `eq.${id}` });
  const rows = await tableRequest<any[]>(`attendance?${query.toString()}`, {
    method: "DELETE",
    headers: { Prefer: "return=representation" },
  });
  if (!rows?.length) throw new Error("Отметка уже удалена или у вас нет доступа к ней.");
}

export function AttendanceHistorySection({ childId, refreshKey }: Props) {
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [draft, setDraft] = useState<AttendanceDraft | null>(null);

  const load = useCallback(async () => {
    if (!childId) {
      setRecords([]);
      return;
    }
    setLoading(true);
    setError("");
    try {
      setRecords(await fetchAttendance(childId));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось загрузить посещаемость.");
    } finally {
      setLoading(false);
    }
  }, [childId]);

  useEffect(() => {
    setDraft(null);
    setSuccess("");
    void load();
  }, [load, refreshKey]);

  async function run(action: () => Promise<string>, fallback: string) {
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      const message = await action();
      await load();
      setSuccess(message);
      window.dispatchEvent(new Event("openstars:student-data-changed"));
    } catch (err) {
      setError(err instanceof Error ? err.message : fallback);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-black/35">Посещаемость · {records.length}</p>
      <p className="mt-1 text-[11px] leading-5 text-black/35">Если исправить «Присутствовал» на «Отсутствовал» или удалить отметку, связанный Star Coin пересчитается автоматически.</p>

      {error && <div className="mt-2 rounded-[11px] border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{error}</div>}
      {success && <div className="mt-2 rounded-[11px] border border-[#5F6338]/15 bg-[#5F6338]/[0.07] px-3 py-2 text-xs font-medium text-[#4D512E]">{success}</div>}

      {loading ? (
        <div className="flex items-center gap-2 py-4 text-sm text-black/35"><LoaderCircle size={16} className="animate-spin"/> Загрузка посещаемости...</div>
      ) : records.length === 0 ? (
        <p className="mt-2 text-sm text-black/35">Нет отметок посещаемости.</p>
      ) : (
        <div className="mt-2 space-y-2">
          {records.map((record) => {
            const activeDraft = draft?.record.id === record.id ? draft : null;
            return (
              <div key={record.id} className="rounded-[13px] bg-[#FAF9F5] p-3">
                {activeDraft ? (
                  <div className="space-y-2">
                    <div className="grid gap-2 sm:grid-cols-2">
                      <label className="text-xs font-semibold text-black/50">Статус
                        <select className={`${fieldClass} mt-1`} value={activeDraft.present ? "present" : "absent"} onChange={(e) => setDraft({ ...activeDraft, present: e.target.value === "present" })}>
                          <option value="present">Присутствовал</option>
                          <option value="absent">Отсутствовал</option>
                        </select>
                      </label>
                      <label className="text-xs font-semibold text-black/50">Дата занятия
                        <input type="date" className={`${fieldClass} mt-1`} value={activeDraft.lessonDate} onChange={(e) => setDraft({ ...activeDraft, lessonDate: e.target.value })}/>
                      </label>
                    </div>
                    <p className="text-[11px] text-black/35">Предмет: {record.subject}</p>
                    <div className="flex gap-2">
                      <button type="button" disabled={saving} onClick={() => void run(async () => {
                        await updateAttendance({ id: record.id, present: activeDraft.present, lessonDate: activeDraft.lessonDate });
                        setDraft(null);
                        return activeDraft.present ? "Посещаемость исправлена. Star Coin пересчитаны автоматически." : "Отметка изменена на «Отсутствовал». Star Coin пересчитаны автоматически.";
                      }, "Не удалось изменить посещаемость.")} className="flex items-center gap-1 rounded-[9px] bg-[#5F6338] px-3 py-2 text-xs font-semibold text-white disabled:opacity-50"><Save size={14}/> Сохранить</button>
                      <button type="button" disabled={saving} onClick={() => setDraft(null)} className="flex items-center gap-1 rounded-[9px] bg-white px-3 py-2 text-xs text-black/55 disabled:opacity-50"><X size={14}/> Отмена</button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <div className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ${record.present ? "bg-[#5F6338]/10 text-[#5F6338]" : "bg-red-50 text-red-500"}`}>
                      {record.present ? <CheckCircle2 size={18}/> : <XCircle size={18}/>} 
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold">{record.subject}</p>
                      <p className="text-[11px] text-black/40">{formatDate(record.lessonDate)} · {record.present ? "Присутствовал" : "Отсутствовал"}</p>
                    </div>
                    <button type="button" disabled={saving} onClick={() => setDraft({ record, present: record.present, lessonDate: record.lessonDate })} className="grid h-8 w-8 shrink-0 place-items-center rounded-[9px] bg-white text-black/45 disabled:opacity-40"><Pencil size={14}/></button>
                    <button type="button" disabled={saving} onClick={() => {
                      if (window.confirm(`Удалить отметку посещаемости по предмету «${record.subject}» за ${formatDate(record.lessonDate)}? Связанный Star Coin будет пересчитан автоматически.`)) {
                        void run(async () => {
                          await deleteAttendance(record.id);
                          return "Отметка посещаемости удалена. Star Coin пересчитаны автоматически.";
                        }, "Не удалось удалить посещаемость.");
                      }
                    }} className="grid h-8 w-8 shrink-0 place-items-center rounded-[9px] bg-red-50 text-red-600 disabled:opacity-40"><Trash2 size={14}/></button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
