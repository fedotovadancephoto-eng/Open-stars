import { useCallback, useEffect, useState } from "react";
import { History, LoaderCircle, Pencil, RefreshCw, Save, Trash2, X } from "lucide-react";

import {
  AcademicGradeRecord,
  AcademicHistory,
  AcademicHomeworkRecord,
  AcademicTeacherCommentRecord,
  deleteAcademicGrade,
  deleteAcademicHomeworkBatch,
  deleteAcademicTeacherComment,
  fetchAcademicHistory,
  updateAcademicGrade,
  updateAcademicHomeworkBatch,
  updateAcademicTeacherComment,
} from "@/admin/academicApi";

const emptyHistory: AcademicHistory = { grades: [], homework: [], comments: [] };
const fieldClass = "w-full rounded-[11px] border border-black/[0.08] bg-white px-3 py-2.5 text-sm text-[#171717] outline-none focus:border-[#D96A24]/45 focus:ring-4 focus:ring-[#D96A24]/[0.06]";

function formatDate(value: string) {
  if (!value) return "Без даты";
  const [year, month, day] = value.slice(0, 10).split("-");
  return year && month && day ? `${day}.${month}.${year}` : value;
}

type Props = {
  childId: string;
  childName: string;
  subject: string;
  refreshKey: number;
};

type HomeworkDraft = {
  record: AcademicHomeworkRecord;
  title: string;
  description: string;
  dueDate: string;
};

type CommentDraft = {
  record: AcademicTeacherCommentRecord;
  title: string;
  text: string;
  date: string;
};

export function AcademicHistoryManager({ childId, childName, subject, refreshKey }: Props) {
  const [history, setHistory] = useState<AcademicHistory>(emptyHistory);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [gradeDraft, setGradeDraft] = useState<{ record: AcademicGradeRecord; grade: number } | null>(null);
  const [homeworkDraft, setHomeworkDraft] = useState<HomeworkDraft | null>(null);
  const [commentDraft, setCommentDraft] = useState<CommentDraft | null>(null);

  const load = useCallback(async () => {
    if (!childId || !subject.trim()) {
      setHistory(emptyHistory);
      return;
    }
    setLoading(true);
    setError("");
    try {
      setHistory(await fetchAcademicHistory({ childId, subject }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось загрузить историю ученика.");
    } finally {
      setLoading(false);
    }
  }, [childId, subject]);

  useEffect(() => {
    setGradeDraft(null);
    setHomeworkDraft(null);
    setCommentDraft(null);
    setSuccess("");
    void load();
  }, [load, refreshKey]);

  async function runAction(action: () => Promise<void>, fallbackMessage: string) {
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      await action();
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : fallbackMessage);
    } finally {
      setSaving(false);
    }
  }

  async function saveGrade() {
    if (!gradeDraft) return;
    await runAction(async () => {
      await updateAcademicGrade(gradeDraft.record.id, gradeDraft.grade);
      setGradeDraft(null);
      setSuccess("Оценка изменена. Star Coin пересчитаны автоматически.");
    }, "Не удалось изменить оценку.");
  }

  async function removeGrade(record: AcademicGradeRecord) {
    if (!window.confirm(`Удалить оценку ${record.grade} за ${formatDate(record.lessonDate)}? Связанные Star Coin будут скорректированы автоматически.`)) return;
    await runAction(async () => {
      await deleteAcademicGrade(record.id);
      if (gradeDraft?.record.id === record.id) setGradeDraft(null);
      setSuccess("Оценка удалена. Star Coin скорректированы автоматически.");
    }, "Не удалось удалить оценку.");
  }

  async function saveHomework() {
    if (!homeworkDraft) return;
    await runAction(async () => {
      const count = await updateAcademicHomeworkBatch({
        subject: homeworkDraft.record.subject,
        createdAt: homeworkDraft.record.createdAt,
        createdBy: homeworkDraft.record.createdBy,
        title: homeworkDraft.title,
        description: homeworkDraft.description,
        dueDate: homeworkDraft.dueDate,
      });
      setHomeworkDraft(null);
      setSuccess(`Домашнее задание изменено в ${count} кабинет(ах).`);
    }, "Не удалось изменить домашнее задание.");
  }

  async function removeHomework(record: AcademicHomeworkRecord) {
    if (!window.confirm(`Удалить публикацию «${record.title}» из всех кабинетов, которым она была выдана?`)) return;
    await runAction(async () => {
      const count = await deleteAcademicHomeworkBatch({
        subject: record.subject,
        createdAt: record.createdAt,
        createdBy: record.createdBy,
      });
      if (homeworkDraft?.record.id === record.id) setHomeworkDraft(null);
      setSuccess(`Домашнее задание удалено из ${count} кабинет(ов).`);
    }, "Не удалось удалить домашнее задание.");
  }

  async function saveComment() {
    if (!commentDraft) return;
    await runAction(async () => {
      await updateAcademicTeacherComment({
        id: commentDraft.record.id,
        title: commentDraft.title,
        text: commentDraft.text,
        date: commentDraft.date,
      });
      setCommentDraft(null);
      setSuccess("Комментарий изменён.");
    }, "Не удалось изменить комментарий.");
  }

  async function removeComment(record: AcademicTeacherCommentRecord) {
    if (!window.confirm(`Удалить комментарий за ${formatDate(record.date)}?`)) return;
    await runAction(async () => {
      await deleteAcademicTeacherComment(record.id);
      if (commentDraft?.record.id === record.id) setCommentDraft(null);
      setSuccess("Комментарий удалён.");
    }, "Не удалось удалить комментарий.");
  }

  return (
    <section className="rounded-[24px] border border-black/[0.06] bg-white p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2"><History size={18} className="text-[#D96A24]" /><h3 className="font-semibold">История и управление</h3></div>
          <p className="mt-1 text-xs leading-5 text-black/40">Оценки, ДЗ и комментарии по выбранному предмету.</p>
        </div>
        <button type="button" onClick={() => void load()} disabled={loading || saving || !childId} className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[#FAF9F5] text-black/45 disabled:opacity-40" aria-label="Обновить историю">
          <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
        </button>
      </div>

      {!childId ? (
        <div className="mt-4 rounded-[15px] bg-[#FAF9F5] px-4 py-5 text-sm text-black/40">Выберите ребёнка выше.</div>
      ) : (
        <>
          <div className="mt-3 rounded-[13px] bg-[#FAF9F5] px-3.5 py-2.5 text-xs text-black/50"><span className="font-semibold text-[#171717]">{childName || "Ученик"}</span> · {subject}</div>
          {error && <div className="mt-3 rounded-[13px] border border-red-200 bg-red-50 px-3.5 py-2.5 text-xs text-red-700">{error}</div>}
          {success && <div className="mt-3 rounded-[13px] border border-[#5F6338]/15 bg-[#5F6338]/[0.07] px-3.5 py-2.5 text-xs font-medium text-[#4D512E]">{success}</div>}

          {loading ? (
            <div className="mt-5 flex items-center justify-center gap-2 py-6 text-sm text-black/40"><LoaderCircle size={17} className="animate-spin" /> Загрузка истории...</div>
          ) : (
            <div className="mt-5 space-y-6">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-black/35">Оценки</p>
                {history.grades.length === 0 ? <p className="mt-2 text-sm text-black/35">Сохранённых оценок нет.</p> : <div className="mt-2 space-y-2">{history.grades.map((record) => {
                  const draft = gradeDraft?.record.id === record.id ? gradeDraft : null;
                  return <div key={record.id} className="rounded-[14px] border border-black/[0.055] p-3">
                    {draft ? <div className="flex flex-wrap items-end gap-2"><label className="min-w-[110px] flex-1 text-xs font-semibold text-black/50">Оценка<select className={`${fieldClass} mt-1`} value={draft.grade} onChange={(e) => setGradeDraft({ ...draft, grade: Number(e.target.value) })}>{[5,4,3,2,1].map((v) => <option key={v} value={v}>{v}</option>)}</select></label><button type="button" onClick={() => void saveGrade()} disabled={saving} className="grid h-10 w-10 place-items-center rounded-[10px] bg-[#5F6338] text-white"><Save size={16}/></button><button type="button" onClick={() => setGradeDraft(null)} disabled={saving} className="grid h-10 w-10 place-items-center rounded-[10px] bg-[#FAF9F5] text-black/45"><X size={16}/></button></div> : <div className="flex items-center gap-3"><div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#D96A24]/10 text-lg font-bold text-[#C95320]">{record.grade}</div><div className="min-w-0 flex-1"><p className="text-sm font-semibold">{formatDate(record.lessonDate)}</p><p className="mt-0.5 truncate text-xs text-black/40">{record.teacherName || "Педагог"}</p></div><button type="button" onClick={() => setGradeDraft({ record, grade: record.grade })} disabled={saving} className="grid h-9 w-9 place-items-center rounded-[10px] bg-[#FAF9F5] text-black/45" aria-label="Изменить оценку"><Pencil size={15}/></button><button type="button" onClick={() => void removeGrade(record)} disabled={saving} className="grid h-9 w-9 place-items-center rounded-[10px] bg-red-50 text-red-600" aria-label="Удалить оценку"><Trash2 size={15}/></button></div>}
                  </div>;
                })}</div>}
              </div>

              <div className="border-t border-black/[0.06] pt-5">
                <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-black/35">Домашние задания</p>
                {history.homework.length === 0 ? <p className="mt-2 text-sm text-black/35">Сохранённых ДЗ нет.</p> : <div className="mt-2 space-y-2">{history.homework.map((record) => {
                  const draft = homeworkDraft?.record.id === record.id ? homeworkDraft : null;
                  return <div key={record.id} className="rounded-[14px] border border-black/[0.055] p-3">
                    {draft ? <div className="space-y-2"><input className={fieldClass} value={draft.title} onChange={(e) => setHomeworkDraft({ ...draft, title: e.target.value })} placeholder="Название"/><textarea className={`${fieldClass} min-h-[72px] resize-y`} value={draft.description} onChange={(e) => setHomeworkDraft({ ...draft, description: e.target.value })} placeholder="Описание"/><label className="block text-xs font-semibold text-black/50">Выполнить до<input type="date" className={`${fieldClass} mt-1`} value={draft.dueDate} onChange={(e) => setHomeworkDraft({ ...draft, dueDate: e.target.value })}/></label><div className="flex gap-2"><button type="button" onClick={() => void saveHomework()} disabled={saving} className="flex items-center gap-1.5 rounded-[10px] bg-[#5F6338] px-3 py-2 text-xs font-semibold text-white"><Save size={14}/> Сохранить</button><button type="button" onClick={() => setHomeworkDraft(null)} disabled={saving} className="rounded-[10px] bg-[#FAF9F5] px-3 py-2 text-xs font-semibold text-black/45">Отмена</button></div></div> : <div className="flex items-start gap-2"><div className="min-w-0 flex-1"><p className="text-sm font-semibold leading-5">{record.title}</p><p className="mt-1 text-xs text-black/40">Занятие: {formatDate(record.lessonDate)}{record.dueDate ? ` · до ${formatDate(record.dueDate)}` : ""}</p>{record.description && <p className="mt-2 text-xs leading-5 text-black/55">{record.description}</p>}</div><button type="button" onClick={() => setHomeworkDraft({ record, title: record.title, description: record.description, dueDate: record.dueDate })} disabled={saving} className="grid h-9 w-9 shrink-0 place-items-center rounded-[10px] bg-[#FAF9F5] text-black/45" aria-label="Изменить домашнее задание"><Pencil size={15}/></button><button type="button" onClick={() => void removeHomework(record)} disabled={saving} className="grid h-9 w-9 shrink-0 place-items-center rounded-[10px] bg-red-50 text-red-600" aria-label="Удалить домашнее задание"><Trash2 size={15}/></button></div>}
                  </div>;
                })}</div>}
              </div>

              <div className="border-t border-black/[0.06] pt-5">
                <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-black/35">Комментарии</p>
                {history.comments.length === 0 ? <p className="mt-2 text-sm text-black/35">Сохранённых комментариев нет.</p> : <div className="mt-2 space-y-2">{history.comments.map((record) => {
                  const draft = commentDraft?.record.id === record.id ? commentDraft : null;
                  return <div key={record.id} className="rounded-[14px] border border-black/[0.055] p-3">
                    {draft ? <div className="space-y-2"><input className={fieldClass} value={draft.title} onChange={(e) => setCommentDraft({ ...draft, title: e.target.value })} placeholder="Заголовок — необязательно"/><textarea className={`${fieldClass} min-h-[82px] resize-y`} value={draft.text} onChange={(e) => setCommentDraft({ ...draft, text: e.target.value })}/><input type="date" className={fieldClass} value={draft.date} onChange={(e) => setCommentDraft({ ...draft, date: e.target.value })}/><div className="flex gap-2"><button type="button" onClick={() => void saveComment()} disabled={saving} className="flex items-center gap-1.5 rounded-[10px] bg-[#5F6338] px-3 py-2 text-xs font-semibold text-white"><Save size={14}/> Сохранить</button><button type="button" onClick={() => setCommentDraft(null)} disabled={saving} className="rounded-[10px] bg-[#FAF9F5] px-3 py-2 text-xs font-semibold text-black/45">Отмена</button></div></div> : <div className="flex items-start gap-2"><div className="min-w-0 flex-1">{record.title && <p className="text-sm font-semibold leading-5">{record.title}</p>}<p className={`${record.title ? "mt-1" : ""} text-xs leading-5 text-black/55`}>{record.text}</p><p className="mt-2 text-xs text-black/35">{formatDate(record.date)} · {record.teacherName || "Педагог"}</p></div><button type="button" onClick={() => setCommentDraft({ record, title: record.title, text: record.text, date: record.date })} disabled={saving} className="grid h-9 w-9 shrink-0 place-items-center rounded-[10px] bg-[#FAF9F5] text-black/45" aria-label="Изменить комментарий"><Pencil size={15}/></button><button type="button" onClick={() => void removeComment(record)} disabled={saving} className="grid h-9 w-9 shrink-0 place-items-center rounded-[10px] bg-red-50 text-red-600" aria-label="Удалить комментарий"><Trash2 size={15}/></button></div>}
                  </div>;
                })}</div>}
              </div>
            </div>
          )}
        </>
      )}
    </section>
  );
}
