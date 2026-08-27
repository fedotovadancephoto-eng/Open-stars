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
const fieldClass = "w-full rounded-[11px] border border-black/[0.08] bg-white px-3 py-2.5 text-sm text-[#171717] outline-none focus:border-[#D96A24]/45 focus:ring-4 focus:ring-[#D96A24]/[0.06]";

type Props = {
  initialChildId?: string;
  initialChildName?: string;
  refreshKey: number;
};

type GradeDraft = { record: AcademicGradeHistoryRecord; grade: number };
type HomeworkDraft = { record: AcademicHomeworkHistoryRecord; title: string; description: string; dueDate: string };
type CommentDraft = { record: AcademicCommentHistoryRecord; title: string; text: string; date: string };
type AchievementDraft = { record: AcademicAchievementHistoryRecord; title: string; description: string; achievedAt: string };

function formatDate(value: string) {
  if (!value) return "Без даты";
  const [year, month, day] = value.slice(0, 10).split("-");
  return year && month && day ? `${day}.${month}.${year}` : value;
}

function studentMeta(student: AcademicStudentOption) {
  return [student.branch, student.groupName, student.lessonTime ? student.lessonTime.slice(0, 5) : ""].filter(Boolean).join(" · ");
}

export function AcademicHistoryManager({ initialChildId = "", initialChildName = "", refreshKey }: Props) {
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<AcademicStudentOption[]>([]);
  const [selectedStudent, setSelectedStudent] = useState<AcademicStudentOption | null>(null);
  const [history, setHistory] = useState<AcademicFullHistory>(emptyHistory);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [gradeDraft, setGradeDraft] = useState<GradeDraft | null>(null);
  const [homeworkDraft, setHomeworkDraft] = useState<HomeworkDraft | null>(null);
  const [commentDraft, setCommentDraft] = useState<CommentDraft | null>(null);
  const [achievementDraft, setAchievementDraft] = useState<AchievementDraft | null>(null);

  const loadHistory = useCallback(async (childId: string) => {
    if (!childId) {
      setHistory(emptyHistory);
      return;
    }
    setLoading(true);
    setError("");
    try {
      setHistory(await fetchAcademicFullHistory(childId));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось загрузить историю ученика.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!initialChildId) return;
    setSelectedStudent((current) => {
      if (current?.id === initialChildId) return current;
      return { id: initialChildId, name: initialChildName || "Ученик", branch: "", groupName: "", lessonTime: "" };
    });
  }, [initialChildId, initialChildName]);

  useEffect(() => {
    setGradeDraft(null);
    setHomeworkDraft(null);
    setCommentDraft(null);
    setAchievementDraft(null);
    setSuccess("");
    void loadHistory(selectedStudent?.id || "");
  }, [selectedStudent?.id, refreshKey, loadHistory]);

  async function handleSearch(event: FormEvent) {
    event.preventDefault();
    const value = query.trim();
    if (value.length < 2) {
      setError("Введите хотя бы 2 буквы имени или фамилии.");
      return;
    }
    setSearching(true);
    setError("");
    setSuccess("");
    try {
      const rows = await searchAcademicStudents(value);
      setSearchResults(rows);
      if (!rows.length) setError("Ученик не найден или у вас нет доступа к нему.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось выполнить поиск.");
    } finally {
      setSearching(false);
    }
  }

  function selectStudent(student: AcademicStudentOption) {
    setSelectedStudent(student);
    setQuery(student.name);
    setSearchResults([]);
    setError("");
    setSuccess("");
  }

  async function runAction(action: () => Promise<string>, fallbackMessage: string) {
    if (!selectedStudent) return;
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      const message = await action();
      await loadHistory(selectedStudent.id);
      setSuccess(message);
    } catch (err) {
      setError(err instanceof Error ? err.message : fallbackMessage);
    } finally {
      setSaving(false);
    }
  }

  async function saveGrade() {
    if (!gradeDraft) return;
    await runAction(async () => {
      await updateHistoryGrade(gradeDraft.record.id, gradeDraft.grade);
      setGradeDraft(null);
      return "Оценка изменена. Star Coin пересчитаны автоматически.";
    }, "Не удалось изменить оценку.");
  }

  async function removeGrade(record: AcademicGradeHistoryRecord) {
    if (!window.confirm(`Удалить оценку ${record.grade} по предмету «${record.subject}» за ${formatDate(record.lessonDate)}? Star Coin будут скорректированы автоматически.`)) return;
    await runAction(async () => {
      await deleteHistoryGrade(record.id);
      if (gradeDraft?.record.id === record.id) setGradeDraft(null);
      return "Оценка удалена. Star Coin скорректированы автоматически.";
    }, "Не удалось удалить оценку.");
  }

  async function saveHomework() {
    if (!homeworkDraft) return;
    await runAction(async () => {
      const count = await updateHistoryHomework({
        record: homeworkDraft.record,
        title: homeworkDraft.title,
        description: homeworkDraft.description,
        dueDate: homeworkDraft.dueDate,
      });
      setHomeworkDraft(null);
      return `Домашнее задание изменено в ${count} кабинет(ах).`;
    }, "Не удалось изменить домашнее задание.");
  }

  async function removeHomework(record: AcademicHomeworkHistoryRecord) {
    if (!window.confirm(`Удалить публикацию «${record.title}» у всей группы, которой она была выдана?`)) return;
    await runAction(async () => {
      const count = await deleteHistoryHomework(record);
      if (homeworkDraft?.record.id === record.id) setHomeworkDraft(null);
      return `Домашнее задание удалено из ${count} кабинет(ов).`;
    }, "Не удалось удалить домашнее задание.");
  }

  async function saveComment() {
    if (!commentDraft) return;
    await runAction(async () => {
      await updateHistoryComment({ id: commentDraft.record.id, title: commentDraft.title, text: commentDraft.text, date: commentDraft.date });
      setCommentDraft(null);
      return "Комментарий изменён.";
    }, "Не удалось изменить комментарий.");
  }

  async function removeComment(record: AcademicCommentHistoryRecord) {
    if (!window.confirm(`Удалить комментарий по предмету «${record.subject}» за ${formatDate(record.date)}?`)) return;
    await runAction(async () => {
      await deleteHistoryComment(record.id);
      if (commentDraft?.record.id === record.id) setCommentDraft(null);
      return "Комментарий удалён.";
    }, "Не удалось удалить комментарий.");
  }

  async function saveAchievement() {
    if (!achievementDraft) return;
    await runAction(async () => {
      await updateHistoryAchievement({
        id: achievementDraft.record.id,
        title: achievementDraft.title,
        description: achievementDraft.description,
        achievedAt: achievementDraft.achievedAt,
      });
      setAchievementDraft(null);
      return "Достижение изменено.";
    }, "Не удалось изменить достижение.");
  }

  async function removeAchievement(record: AcademicAchievementHistoryRecord) {
    if (!window.confirm(`Удалить достижение «${record.title}» за ${formatDate(record.achievedAt)}?`)) return;
    await runAction(async () => {
      await deleteHistoryAchievement(record.id);
      if (achievementDraft?.record.id === record.id) setAchievementDraft(null);
      return "Достижение удалено.";
    }, "Не удалось удалить достижение.");
  }

  const totalRecords = history.grades.length + history.homework.length + history.comments.length + history.achievements.length;

  return (
    <section className="rounded-[24px] border border-black/[0.06] bg-white p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2"><History size={19} className="text-[#D96A24]" /><h3 className="text-lg font-semibold">История ученика</h3></div>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-black/45">Найдите ребёнка по имени или фамилии. Здесь видна вся учебная история, доступная вашей роли: оценки, ДЗ, комментарии и достижения по всем разрешённым предметам.</p>
        </div>
        <button type="button" onClick={() => selectedStudent && void loadHistory(selectedStudent.id)} disabled={!selectedStudent || loading || saving} className="flex items-center gap-2 rounded-[12px] bg-[#FAF9F5] px-3 py-2 text-xs font-semibold text-black/50 disabled:opacity-40"><RefreshCw size={15} className={loading ? "animate-spin" : ""}/> Обновить</button>
      </div>

      <form onSubmit={handleSearch} className="mt-5 flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <Search size={17} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-black/30" />
          <input value={query} onChange={(event) => setQuery(event.target.value)} className="w-full rounded-[14px] border border-black/[0.08] bg-[#FAF9F5] py-3 pl-10 pr-4 text-sm outline-none focus:border-[#D96A24]/45 focus:ring-4 focus:ring-[#D96A24]/[0.06]" placeholder="Например: Давыдова Арина" />
        </div>
        <button type="submit" disabled={searching} className="flex items-center justify-center gap-2 rounded-[14px] bg-[#171717] px-5 py-3 text-sm font-semibold text-white disabled:opacity-50">{searching ? <LoaderCircle size={17} className="animate-spin"/> : <Search size={17}/>} Найти</button>
      </form>

      {searchResults.length > 0 && (
        <div className="mt-3 overflow-hidden rounded-[16px] border border-black/[0.07] bg-white">
          {searchResults.map((student) => <button type="button" key={student.id} onClick={() => selectStudent(student)} className="flex w-full items-center justify-between gap-4 border-b border-black/[0.055] px-4 py-3 text-left last:border-b-0 hover:bg-[#FAF9F5]"><div><p className="text-sm font-semibold text-[#171717]">{student.name}</p><p className="mt-1 text-xs text-black/40">{studentMeta(student) || "Данные группы не указаны"}</p></div><span className="text-xs font-semibold text-[#D96A24]">Открыть</span></button>)}
        </div>
      )}

      {error && <div className="mt-4 rounded-[14px] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
      {success && <div className="mt-4 rounded-[14px] border border-[#5F6338]/15 bg-[#5F6338]/[0.07] px-4 py-3 text-sm font-medium text-[#4D512E]">{success}</div>}

      {!selectedStudent ? (
        <div className="mt-5 rounded-[18px] bg-[#FAF9F5] px-5 py-8 text-center text-sm text-black/40">Найдите ученика или выберите ребёнка в журнале занятия.</div>
      ) : (
        <>
          <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-[16px] bg-[#FAF9F5] px-4 py-3">
            <div><p className="font-semibold text-[#171717]">{selectedStudent.name}</p><p className="mt-1 text-xs text-black/40">{studentMeta(selectedStudent) || "Выбран из текущего журнала"}</p></div>
            <span className="rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-black/50">Записей: {totalRecords}</span>
          </div>

          {loading ? <div className="flex items-center justify-center gap-2 py-10 text-sm text-black/40"><LoaderCircle size={18} className="animate-spin"/> Загрузка истории...</div> : (
            <div className="mt-6 grid gap-5 xl:grid-cols-2">
              <div className="rounded-[18px] border border-black/[0.06] p-4">
                <div className="flex items-center justify-between"><p className="text-[11px] font-bold uppercase tracking-[0.16em] text-black/35">Оценки</p><span className="text-xs font-semibold text-black/35">{history.grades.length}</span></div>
                {history.grades.length === 0 ? <p className="mt-3 text-sm text-black/35">Сохранённых оценок нет.</p> : <div className="mt-3 space-y-2">{history.grades.map((record) => {
                  const draft = gradeDraft?.record.id === record.id ? gradeDraft : null;
                  return <div key={record.id} className="rounded-[14px] bg-[#FAF9F5] p-3">{draft ? <div className="flex flex-wrap items-end gap-2"><label className="min-w-[120px] flex-1 text-xs font-semibold text-black/50">Оценка<select className={`${fieldClass} mt-1`} value={draft.grade} onChange={(event) => setGradeDraft({ ...draft, grade: Number(event.target.value) })}>{[5,4,3,2,1].map((value) => <option key={value} value={value}>{value}</option>)}</select></label><button type="button" onClick={() => void saveGrade()} disabled={saving} className="grid h-10 w-10 place-items-center rounded-[10px] bg-[#5F6338] text-white"><Save size={16}/></button><button type="button" onClick={() => setGradeDraft(null)} disabled={saving} className="grid h-10 w-10 place-items-center rounded-[10px] bg-white text-black/45"><X size={16}/></button></div> : <div className="flex items-center gap-3"><div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#D96A24]/10 text-lg font-bold text-[#C95320]">{record.grade}</div><div className="min-w-0 flex-1"><p className="text-sm font-semibold">{record.subject}</p><p className="mt-1 text-xs text-black/40">{formatDate(record.lessonDate)} · {record.teacherName || "Педагог"}</p></div><button type="button" onClick={() => setGradeDraft({ record, grade: record.grade })} disabled={saving} className="grid h-9 w-9 place-items-center rounded-[10px] bg-white text-black/45" aria-label="Редактировать оценку"><Pencil size={15}/></button><button type="button" onClick={() => void removeGrade(record)} disabled={saving} className="grid h-9 w-9 place-items-center rounded-[10px] bg-red-50 text-red-600" aria-label="Удалить оценку"><Trash2 size={15}/></button></div>}</div>;
                })}</div>}
              </div>

              <div className="rounded-[18px] border border-black/[0.06] p-4">
                <div className="flex items-center justify-between"><p className="text-[11px] font-bold uppercase tracking-[0.16em] text-black/35">Домашние задания</p><span className="text-xs font-semibold text-black/35">{history.homework.length}</span></div>
                {history.homework.length === 0 ? <p className="mt-3 text-sm text-black/35">Сохранённых ДЗ нет.</p> : <div className="mt-3 space-y-2">{history.homework.map((record) => {
                  const draft = homeworkDraft?.record.id === record.id ? homeworkDraft : null;
                  return <div key={record.id} className="rounded-[14px] bg-[#FAF9F5] p-3">{draft ? <div className="space-y-2"><input className={fieldClass} value={draft.title} onChange={(event) => setHomeworkDraft({ ...draft, title: event.target.value })} placeholder="Название"/><textarea className={`${fieldClass} min-h-[72px] resize-y`} value={draft.description} onChange={(event) => setHomeworkDraft({ ...draft, description: event.target.value })} placeholder="Описание"/><label className="block text-xs font-semibold text-black/50">Выполнить до<input type="date" className={`${fieldClass} mt-1`} value={draft.dueDate} onChange={(event) => setHomeworkDraft({ ...draft, dueDate: event.target.value })}/></label><p className="text-[11px] leading-5 text-black/35">Изменение применяется ко всей исходной групповой публикации.</p><div className="flex gap-2"><button type="button" onClick={() => void saveHomework()} disabled={saving} className="flex items-center gap-1.5 rounded-[10px] bg-[#5F6338] px-3 py-2 text-xs font-semibold text-white"><Save size={14}/> Сохранить</button><button type="button" onClick={() => setHomeworkDraft(null)} disabled={saving} className="rounded-[10px] bg-white px-3 py-2 text-xs font-semibold text-black/45">Отмена</button></div></div> : <div className="flex items-start gap-2"><div className="min-w-0 flex-1"><p className="text-sm font-semibold leading-5">{record.title}</p><p className="mt-1 text-xs text-black/40">{record.subject} · занятие {formatDate(record.lessonDate)}{record.dueDate ? ` · до ${formatDate(record.dueDate)}` : ""}</p>{record.description && <p className="mt-2 text-xs leading-5 text-black/55">{record.description}</p>}<p className="mt-2 text-[11px] text-black/30">{record.teacherName || "Педагог"}</p></div><button type="button" onClick={() => setHomeworkDraft({ record, title: record.title, description: record.description, dueDate: record.dueDate })} disabled={saving} className="grid h-9 w-9 shrink-0 place-items-center rounded-[10px] bg-white text-black/45" aria-label="Редактировать домашнее задание"><Pencil size={15}/></button><button type="button" onClick={() => void removeHomework(record)} disabled={saving} className="grid h-9 w-9 shrink-0 place-items-center rounded-[10px] bg-red-50 text-red-600" aria-label="Удалить домашнее задание"><Trash2 size={15}/></button></div>}</div>;
                })}</div>}
              </div>

              <div className="rounded-[18px] border border-black/[0.06] p-4">
                <div className="flex items-center justify-between"><p className="text-[11px] font-bold uppercase tracking-[0.16em] text-black/35">Комментарии</p><span className="text-xs font-semibold text-black/35">{history.comments.length}</span></div>
                {history.comments.length === 0 ? <p className="mt-3 text-sm text-black/35">Сохранённых комментариев нет.</p> : <div className="mt-3 space-y-2">{history.comments.map((record) => {
                  const draft = commentDraft?.record.id === record.id ? commentDraft : null;
                  return <div key={record.id} className="rounded-[14px] bg-[#FAF9F5] p-3">{draft ? <div className="space-y-2"><input className={fieldClass} value={draft.title} onChange={(event) => setCommentDraft({ ...draft, title: event.target.value })} placeholder="Заголовок — необязательно"/><textarea className={`${fieldClass} min-h-[82px] resize-y`} value={draft.text} onChange={(event) => setCommentDraft({ ...draft, text: event.target.value })}/><input type="date" className={fieldClass} value={draft.date} onChange={(event) => setCommentDraft({ ...draft, date: event.target.value })}/><div className="flex gap-2"><button type="button" onClick={() => void saveComment()} disabled={saving} className="flex items-center gap-1.5 rounded-[10px] bg-[#5F6338] px-3 py-2 text-xs font-semibold text-white"><Save size={14}/> Сохранить</button><button type="button" onClick={() => setCommentDraft(null)} disabled={saving} className="rounded-[10px] bg-white px-3 py-2 text-xs font-semibold text-black/45">Отмена</button></div></div> : <div className="flex items-start gap-2"><div className="min-w-0 flex-1">{record.title && <p className="text-sm font-semibold leading-5">{record.title}</p>}<p className={`${record.title ? "mt-1" : ""} text-xs leading-5 text-black/55`}>{record.text}</p><p className="mt-2 text-xs text-black/35">{record.subject} · {formatDate(record.date)} · {record.teacherName || "Педагог"}</p></div><button type="button" onClick={() => setCommentDraft({ record, title: record.title, text: record.text, date: record.date })} disabled={saving} className="grid h-9 w-9 shrink-0 place-items-center rounded-[10px] bg-white text-black/45" aria-label="Редактировать комментарий"><Pencil size={15}/></button><button type="button" onClick={() => void removeComment(record)} disabled={saving} className="grid h-9 w-9 shrink-0 place-items-center rounded-[10px] bg-red-50 text-red-600" aria-label="Удалить комментарий"><Trash2 size={15}/></button></div>}</div>;
                })}</div>}
              </div>

              <div className="rounded-[18px] border border-black/[0.06] p-4">
                <div className="flex items-center justify-between"><div className="flex items-center gap-2"><Award size={15} className="text-[#D96A24]"/><p className="text-[11px] font-bold uppercase tracking-[0.16em] text-black/35">Достижения</p></div><span className="text-xs font-semibold text-black/35">{history.achievements.length}</span></div>
                {history.achievements.length === 0 ? <p className="mt-3 text-sm text-black/35">Сохранённых достижений нет.</p> : <div className="mt-3 space-y-2">{history.achievements.map((record) => {
                  const draft = achievementDraft?.record.id === record.id ? achievementDraft : null;
                  return <div key={record.id} className="rounded-[14px] bg-[#FAF9F5] p-3">{draft ? <div className="space-y-2"><input className={fieldClass} value={draft.title} onChange={(event) => setAchievementDraft({ ...draft, title: event.target.value })} placeholder="Название достижения"/><textarea className={`${fieldClass} min-h-[72px] resize-y`} value={draft.description} onChange={(event) => setAchievementDraft({ ...draft, description: event.target.value })} placeholder="Описание"/><input type="date" className={fieldClass} value={draft.achievedAt} onChange={(event) => setAchievementDraft({ ...draft, achievedAt: event.target.value })}/><div className="flex gap-2"><button type="button" onClick={() => void saveAchievement()} disabled={saving} className="flex items-center gap-1.5 rounded-[10px] bg-[#5F6338] px-3 py-2 text-xs font-semibold text-white"><Save size={14}/> Сохранить</button><button type="button" onClick={() => setAchievementDraft(null)} disabled={saving} className="rounded-[10px] bg-white px-3 py-2 text-xs font-semibold text-black/45">Отмена</button></div></div> : <div className="flex items-start gap-2"><div className="min-w-0 flex-1"><p className="text-sm font-semibold leading-5">{record.title}</p>{record.description && <p className="mt-1 text-xs leading-5 text-black/55">{record.description}</p>}<p className="mt-2 text-xs text-black/35">{formatDate(record.achievedAt)}{record.coinsAwarded ? ` · +${record.coinsAwarded} Coin` : ""}</p></div><button type="button" onClick={() => setAchievementDraft({ record, title: record.title, description: record.description, achievedAt: record.achievedAt })} disabled={saving} className="grid h-9 w-9 shrink-0 place-items-center rounded-[10px] bg-white text-black/45" aria-label="Редактировать достижение"><Pencil size={15}/></button><button type="button" onClick={() => void removeAchievement(record)} disabled={saving} className="grid h-9 w-9 shrink-0 place-items-center rounded-[10px] bg-red-50 text-red-600" aria-label="Удалить достижение"><Trash2 size={15}/></button></div>}</div>;
                })}</div>}
              </div>
            </div>
          )}
        </>
      )}
    </section>
  );
}
