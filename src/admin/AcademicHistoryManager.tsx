import { FormEvent, useCallback, useEffect, useState } from "react";
import { Award, History, LoaderCircle, Pencil, RefreshCw, Save, Search, Trash2, X } from "lucide-react";

import {
  AcademicAchievementHistoryRecord,
  AcademicCommentHistoryRecord,
  AcademicFullHistory,
  AcademicGradeHistoryRecord,
  AcademicHomeworkHistoryRecord,
  AcademicStudentOption,
  deleteHistoryAchievement,
  deleteHistoryComment,
  deleteHistoryGrade,
  deleteHistoryHomework,
  fetchAcademicFullHistory,
  searchAcademicStudents,
  updateHistoryAchievement,
  updateHistoryComment,
  updateHistoryGrade,
  updateHistoryHomework,
} from "@/admin/academicHistoryApi";

const emptyHistory: AcademicFullHistory = { grades: [], homework: [], comments: [], achievements: [] };
const fieldClass = "w-full rounded-[11px] border border-black/[0.08] bg-white px-3 py-2.5 text-sm outline-none focus:border-[#D96A24]/45 focus:ring-4 focus:ring-[#D96A24]/[0.06]";

type Props = { childId: string; childName: string; subject?: string; refreshKey: number };
type GradeDraft = { record: AcademicGradeHistoryRecord; grade: number };
type HomeworkDraft = { record: AcademicHomeworkHistoryRecord; title: string; description: string; dueDate: string };
type CommentDraft = { record: AcademicCommentHistoryRecord; title: string; text: string; date: string };
type AchievementDraft = { record: AcademicAchievementHistoryRecord; title: string; description: string; achievedAt: string };

function formatDate(value: string) {
  if (!value) return "Без даты";
  const [year, month, day] = value.slice(0, 10).split("-");
  return year && month && day ? `${day}.${month}.${year}` : value;
}

function meta(student: AcademicStudentOption) {
  return [student.branch, student.groupName, student.lessonTime?.slice(0, 5)].filter(Boolean).join(" · ");
}

export function AcademicHistoryManager({ childId, childName, refreshKey }: Props) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<AcademicStudentOption[]>([]);
  const [student, setStudent] = useState<AcademicStudentOption | null>(null);
  const [history, setHistory] = useState<AcademicFullHistory>(emptyHistory);
  const [loading, setLoading] = useState(false);
  const [searching, setSearching] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [gradeDraft, setGradeDraft] = useState<GradeDraft | null>(null);
  const [homeworkDraft, setHomeworkDraft] = useState<HomeworkDraft | null>(null);
  const [commentDraft, setCommentDraft] = useState<CommentDraft | null>(null);
  const [achievementDraft, setAchievementDraft] = useState<AchievementDraft | null>(null);

  const load = useCallback(async (id: string) => {
    if (!id) return setHistory(emptyHistory);
    setLoading(true); setError("");
    try { setHistory(await fetchAcademicFullHistory(id)); }
    catch (err) { setError(err instanceof Error ? err.message : "Не удалось загрузить историю ученика."); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    if (!childId) return;
    setStudent((current) => current?.id === childId ? current : { id: childId, name: childName || "Ученик", branch: "", groupName: "", lessonTime: "" });
  }, [childId, childName]);

  useEffect(() => {
    setGradeDraft(null); setHomeworkDraft(null); setCommentDraft(null); setAchievementDraft(null); setSuccess("");
    void load(student?.id || "");
  }, [student?.id, refreshKey, load]);

  async function search(event: FormEvent) {
    event.preventDefault();
    if (query.trim().length < 2) return setError("Введите хотя бы 2 буквы имени или фамилии.");
    setSearching(true); setError(""); setSuccess("");
    try {
      const rows = await searchAcademicStudents(query);
      setResults(rows);
      if (!rows.length) setError("Ученик не найден или у вас нет доступа к нему.");
    } catch (err) { setError(err instanceof Error ? err.message : "Не удалось выполнить поиск."); }
    finally { setSearching(false); }
  }

  function choose(next: AcademicStudentOption) {
    setStudent(next); setQuery(next.name); setResults([]); setError(""); setSuccess("");
  }

  async function run(action: () => Promise<string>, fallback: string) {
    if (!student) return;
    setSaving(true); setError(""); setSuccess("");
    try { const message = await action(); await load(student.id); setSuccess(message); }
    catch (err) { setError(err instanceof Error ? err.message : fallback); }
    finally { setSaving(false); }
  }

  const total = history.grades.length + history.homework.length + history.comments.length + history.achievements.length;

  return (
    <section className="rounded-[24px] border border-black/[0.06] bg-white p-5">
      <div className="flex items-start justify-between gap-3">
        <div><div className="flex items-center gap-2"><History size={18} className="text-[#D96A24]"/><h3 className="font-semibold">История ученика</h3></div><p className="mt-1 text-xs leading-5 text-black/40">Поиск по имени или фамилии. Показываются все доступные вашей роли оценки, ДЗ, комментарии и достижения — без привязки к текущей дате или потоку.</p></div>
        <button type="button" onClick={() => student && void load(student.id)} disabled={!student || loading || saving} className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[#FAF9F5] text-black/45 disabled:opacity-40"><RefreshCw size={16} className={loading ? "animate-spin" : ""}/></button>
      </div>

      <form onSubmit={search} className="mt-4 flex gap-2">
        <div className="relative min-w-0 flex-1"><Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-black/30"/><input value={query} onChange={(e) => setQuery(e.target.value)} className="w-full rounded-[12px] border border-black/[0.08] bg-[#FAF9F5] py-2.5 pl-9 pr-3 text-sm outline-none" placeholder="Давыдова Арина"/></div>
        <button type="submit" disabled={searching} className="rounded-[12px] bg-[#171717] px-3.5 py-2.5 text-xs font-semibold text-white disabled:opacity-50">{searching ? "..." : "Найти"}</button>
      </form>

      {results.length > 0 && <div className="mt-2 overflow-hidden rounded-[13px] border border-black/[0.07]">{results.map((item) => <button key={item.id} type="button" onClick={() => choose(item)} className="block w-full border-b border-black/[0.055] px-3 py-2.5 text-left last:border-0 hover:bg-[#FAF9F5]"><span className="block text-sm font-semibold">{item.name}</span><span className="mt-0.5 block text-[11px] text-black/40">{meta(item)}</span></button>)}</div>}
      {error && <div className="mt-3 rounded-[12px] border border-red-200 bg-red-50 px-3 py-2.5 text-xs text-red-700">{error}</div>}
      {success && <div className="mt-3 rounded-[12px] border border-[#5F6338]/15 bg-[#5F6338]/[0.07] px-3 py-2.5 text-xs font-medium text-[#4D512E]">{success}</div>}

      {!student ? <div className="mt-4 rounded-[14px] bg-[#FAF9F5] px-4 py-5 text-sm text-black/40">Найдите ученика или выберите ребёнка выше.</div> : <>
        <div className="mt-4 flex items-center justify-between gap-3 rounded-[13px] bg-[#FAF9F5] px-3 py-2.5"><div><p className="text-sm font-semibold">{student.name}</p><p className="mt-0.5 text-[11px] text-black/40">{meta(student) || "Выбран из текущего журнала"}</p></div><span className="text-xs font-semibold text-black/35">{total} запис.</span></div>
        {loading ? <div className="flex items-center justify-center gap-2 py-7 text-sm text-black/40"><LoaderCircle size={17} className="animate-spin"/> Загрузка...</div> : <div className="mt-5 space-y-6">

          <div><p className="text-[11px] font-bold uppercase tracking-[0.16em] text-black/35">Оценки · {history.grades.length}</p>{history.grades.length === 0 ? <p className="mt-2 text-sm text-black/35">Нет оценок.</p> : <div className="mt-2 space-y-2">{history.grades.map((record) => { const draft = gradeDraft?.record.id === record.id ? gradeDraft : null; return <div key={record.id} className="rounded-[13px] bg-[#FAF9F5] p-3">{draft ? <div className="flex items-end gap-2"><label className="flex-1 text-xs font-semibold text-black/50">Оценка<select className={`${fieldClass} mt-1`} value={draft.grade} onChange={(e) => setGradeDraft({ ...draft, grade: Number(e.target.value) })}>{[5,4,3,2,1].map((v) => <option key={v}>{v}</option>)}</select></label><button type="button" onClick={() => void run(async () => { await updateHistoryGrade(record.id, draft.grade); setGradeDraft(null); return "Оценка изменена. Star Coin пересчитаны автоматически."; }, "Не удалось изменить оценку.")} className="grid h-10 w-10 place-items-center rounded-[10px] bg-[#5F6338] text-white"><Save size={15}/></button><button type="button" onClick={() => setGradeDraft(null)} className="grid h-10 w-10 place-items-center rounded-[10px] bg-white text-black/45"><X size={15}/></button></div> : <div className="flex items-center gap-2"><div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[#D96A24]/10 font-bold text-[#C95320]">{record.grade}</div><div className="min-w-0 flex-1"><p className="text-sm font-semibold">{record.subject}</p><p className="text-[11px] text-black/40">{formatDate(record.lessonDate)} · {record.teacherName || "Педагог"}</p></div><button type="button" onClick={() => setGradeDraft({ record, grade: record.grade })} className="grid h-8 w-8 place-items-center rounded-[9px] bg-white text-black/45"><Pencil size={14}/></button><button type="button" onClick={() => { if (window.confirm(`Удалить оценку ${record.grade} по предмету «${record.subject}»?`)) void run(async () => { await deleteHistoryGrade(record.id); return "Оценка удалена. Star Coin скорректированы автоматически."; }, "Не удалось удалить оценку."); }} className="grid h-8 w-8 place-items-center rounded-[9px] bg-red-50 text-red-600"><Trash2 size={14}/></button></div>}</div>; })}</div>}</div>

          <div className="border-t border-black/[0.06] pt-5"><p className="text-[11px] font-bold uppercase tracking-[0.16em] text-black/35">Домашние задания · {history.homework.length}</p>{history.homework.length === 0 ? <p className="mt-2 text-sm text-black/35">Нет ДЗ.</p> : <div className="mt-2 space-y-2">{history.homework.map((record) => { const draft = homeworkDraft?.record.id === record.id ? homeworkDraft : null; return <div key={record.id} className="rounded-[13px] bg-[#FAF9F5] p-3">{draft ? <div className="space-y-2"><input className={fieldClass} value={draft.title} onChange={(e) => setHomeworkDraft({ ...draft, title: e.target.value })}/><textarea className={`${fieldClass} min-h-[70px]`} value={draft.description} onChange={(e) => setHomeworkDraft({ ...draft, description: e.target.value })}/><input type="date" className={fieldClass} value={draft.dueDate} onChange={(e) => setHomeworkDraft({ ...draft, dueDate: e.target.value })}/><p className="text-[11px] text-black/35">Изменение применяется ко всей исходной групповой публикации.</p><div className="flex gap-2"><button type="button" onClick={() => void run(async () => { const count = await updateHistoryHomework({ record, title: draft.title, description: draft.description, dueDate: draft.dueDate }); setHomeworkDraft(null); return `ДЗ изменено в ${count} кабинет(ах).`; }, "Не удалось изменить ДЗ.")} className="flex items-center gap-1 rounded-[9px] bg-[#5F6338] px-3 py-2 text-xs font-semibold text-white"><Save size={14}/> Сохранить</button><button type="button" onClick={() => setHomeworkDraft(null)} className="rounded-[9px] bg-white px-3 py-2 text-xs">Отмена</button></div></div> : <div className="flex items-start gap-2"><div className="min-w-0 flex-1"><p className="text-sm font-semibold">{record.title}</p><p className="mt-1 text-[11px] text-black/40">{record.subject} · {formatDate(record.lessonDate)}{record.dueDate ? ` · до ${formatDate(record.dueDate)}` : ""}</p>{record.description && <p className="mt-2 text-xs leading-5 text-black/55">{record.description}</p>}</div><button type="button" onClick={() => setHomeworkDraft({ record, title: record.title, description: record.description, dueDate: record.dueDate })} className="grid h-8 w-8 shrink-0 place-items-center rounded-[9px] bg-white text-black/45"><Pencil size={14}/></button><button type="button" onClick={() => { if (window.confirm(`Удалить «${record.title}» у всей группы?`)) void run(async () => { const count = await deleteHistoryHomework(record); return `ДЗ удалено из ${count} кабинет(ов).`; }, "Не удалось удалить ДЗ."); }} className="grid h-8 w-8 shrink-0 place-items-center rounded-[9px] bg-red-50 text-red-600"><Trash2 size={14}/></button></div>}</div>; })}</div>}</div>

          <div className="border-t border-black/[0.06] pt-5"><p className="text-[11px] font-bold uppercase tracking-[0.16em] text-black/35">Комментарии · {history.comments.length}</p>{history.comments.length === 0 ? <p className="mt-2 text-sm text-black/35">Нет комментариев.</p> : <div className="mt-2 space-y-2">{history.comments.map((record) => { const draft = commentDraft?.record.id === record.id ? commentDraft : null; return <div key={record.id} className="rounded-[13px] bg-[#FAF9F5] p-3">{draft ? <div className="space-y-2"><input className={fieldClass} value={draft.title} onChange={(e) => setCommentDraft({ ...draft, title: e.target.value })} placeholder="Заголовок"/><textarea className={`${fieldClass} min-h-[75px]`} value={draft.text} onChange={(e) => setCommentDraft({ ...draft, text: e.target.value })}/><input type="date" className={fieldClass} value={draft.date} onChange={(e) => setCommentDraft({ ...draft, date: e.target.value })}/><div className="flex gap-2"><button type="button" onClick={() => void run(async () => { await updateHistoryComment({ id: record.id, title: draft.title, text: draft.text, date: draft.date }); setCommentDraft(null); return "Комментарий изменён."; }, "Не удалось изменить комментарий.")} className="flex items-center gap-1 rounded-[9px] bg-[#5F6338] px-3 py-2 text-xs font-semibold text-white"><Save size={14}/> Сохранить</button><button type="button" onClick={() => setCommentDraft(null)} className="rounded-[9px] bg-white px-3 py-2 text-xs">Отмена</button></div></div> : <div className="flex items-start gap-2"><div className="min-w-0 flex-1">{record.title && <p className="text-sm font-semibold">{record.title}</p>}<p className="mt-1 text-xs leading-5 text-black/55">{record.text}</p><p className="mt-2 text-[11px] text-black/40">{record.subject} · {formatDate(record.date)} · {record.teacherName || "Педагог"}</p></div><button type="button" onClick={() => setCommentDraft({ record, title: record.title, text: record.text, date: record.date })} className="grid h-8 w-8 shrink-0 place-items-center rounded-[9px] bg-white text-black/45"><Pencil size={14}/></button><button type="button" onClick={() => { if (window.confirm("Удалить комментарий?")) void run(async () => { await deleteHistoryComment(record.id); return "Комментарий удалён."; }, "Не удалось удалить комментарий."); }} className="grid h-8 w-8 shrink-0 place-items-center rounded-[9px] bg-red-50 text-red-600"><Trash2 size={14}/></button></div>}</div>; })}</div>}</div>

          <div className="border-t border-black/[0.06] pt-5"><div className="flex items-center gap-2"><Award size={14} className="text-[#D96A24]"/><p className="text-[11px] font-bold uppercase tracking-[0.16em] text-black/35">Достижения · {history.achievements.length}</p></div>{history.achievements.length === 0 ? <p className="mt-2 text-sm text-black/35">Нет достижений.</p> : <div className="mt-2 space-y-2">{history.achievements.map((record) => { const draft = achievementDraft?.record.id === record.id ? achievementDraft : null; return <div key={record.id} className="rounded-[13px] bg-[#FAF9F5] p-3">{draft ? <div className="space-y-2"><input className={fieldClass} value={draft.title} onChange={(e) => setAchievementDraft({ ...draft, title: e.target.value })}/><textarea className={`${fieldClass} min-h-[70px]`} value={draft.description} onChange={(e) => setAchievementDraft({ ...draft, description: e.target.value })}/><input type="date" className={fieldClass} value={draft.achievedAt} onChange={(e) => setAchievementDraft({ ...draft, achievedAt: e.target.value })}/><div className="flex gap-2"><button type="button" onClick={() => void run(async () => { await updateHistoryAchievement({ id: record.id, title: draft.title, description: draft.description, achievedAt: draft.achievedAt }); setAchievementDraft(null); return "Достижение изменено."; }, "Не удалось изменить достижение.")} className="flex items-center gap-1 rounded-[9px] bg-[#5F6338] px-3 py-2 text-xs font-semibold text-white"><Save size={14}/> Сохранить</button><button type="button" onClick={() => setAchievementDraft(null)} className="rounded-[9px] bg-white px-3 py-2 text-xs">Отмена</button></div></div> : <div className="flex items-start gap-2"><div className="min-w-0 flex-1"><p className="text-sm font-semibold">{record.title}</p>{record.description && <p className="mt-1 text-xs leading-5 text-black/55">{record.description}</p>}<p className="mt-2 text-[11px] text-black/40">{formatDate(record.achievedAt)}{record.coinsAwarded ? ` · +${record.coinsAwarded} Coin` : ""}</p></div><button type="button" onClick={() => setAchievementDraft({ record, title: record.title, description: record.description, achievedAt: record.achievedAt })} className="grid h-8 w-8 shrink-0 place-items-center rounded-[9px] bg-white text-black/45"><Pencil size={14}/></button><button type="button" onClick={() => { if (window.confirm(`Удалить достижение «${record.title}»?`)) void run(async () => { await deleteHistoryAchievement(record.id); return "Достижение удалено."; }, "Не удалось удалить достижение."); }} className="grid h-8 w-8 shrink-0 place-items-center rounded-[9px] bg-red-50 text-red-600"><Trash2 size={14}/></button></div>}</div>; })}</div>}</div>

        </div>}
      </>}
    </section>
  );
}
