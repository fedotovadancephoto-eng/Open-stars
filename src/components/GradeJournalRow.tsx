import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { gradeDate, gradeSubject, type GradeSubjectRow, type GradedLesson } from "@/gradeJournal";

const averageFormat = new Intl.NumberFormat("ru-RU", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function gradeColor(grade: number) {
  if (grade === 5) return "bg-[#5F6338]/10 text-[#4D512E]";
  if (grade === 4) return "bg-[#D96A24]/10 text-[#C95320]";
  if (grade === 3) return "bg-amber-50 text-amber-800";
  return "bg-rose-50 text-rose-700";
}

export function GradeJournalRow({ row, onSelect }: { row: GradeSubjectRow; onSelect: (id: string) => void }) {
  const strip = useRef<HTMLDivElement>(null);
  const latestId = row.grades[row.grades.length - 1]?.id;
  useEffect(() => {
    // Start at the most recent marks; older marks remain in the same horizontal row.
    if (strip.current) strip.current.scrollLeft = strip.current.scrollWidth;
  }, [latestId]);

  return <article className="min-w-0 py-4" aria-label={row.label}>
    <div className="flex items-start justify-between gap-3">
      <h3 className="min-w-0 break-words text-base font-semibold leading-6 text-[#171717]">{row.label}</h3>
      <div className="shrink-0 text-right">
        <p className="text-xl font-semibold leading-6 text-[#4D512E]">{row.average === null ? "—" : averageFormat.format(row.average)}</p>
        <p className="mt-0.5 text-[10px] text-black/45">Средний балл</p>
      </div>
    </div>
    {row.grades.length ? <div ref={strip} role="region" aria-label={`Оценки: ${row.label}`} tabIndex={0} className="mt-2 flex max-w-full gap-1.5 overflow-x-auto overscroll-x-contain rounded-lg pb-2 pt-1 outline-none focus-visible:ring-2 focus-visible:ring-[#5F6338]/40">
      {row.grades.map(item => <button key={item.id} type="button" aria-label={`${row.label}, оценка ${item.grade}, ${gradeDate(item.lessonDate, true)}`} title={gradeDate(item.lessonDate, true)} onClick={() => onSelect(item.id)} className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl text-lg font-bold transition hover:brightness-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#5F6338] ${gradeColor(item.grade)}`}>
        {item.grade}
      </button>)}
    </div> : <p className="mt-2 text-sm text-black/40">Пока нет оценок за этот период</p>}
  </article>;
}

export function GradeDetails({ grade, onClose }: { grade: GradedLesson; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    dialog?.showModal();
    return () => { if (dialog?.open) dialog.close(); };
  }, []);

  return createPortal(<dialog ref={ref} aria-labelledby="grade-details-title" onCancel={event => { event.preventDefault(); onClose(); }} onClick={event => { if (event.target === event.currentTarget) onClose(); }} className="m-auto max-h-[85vh] w-[min(420px,calc(100vw-32px))] overflow-y-auto rounded-3xl border-0 bg-white p-0 text-[#171717] shadow-xl backdrop:bg-black/40">
    <div className="p-5 sm:p-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-widest text-black/40">Оценка за занятие</p>
          <h2 id="grade-details-title" className="mt-2 break-words text-xl font-semibold">{gradeSubject(grade.subject).label}</h2>
        </div>
        <button type="button" autoFocus aria-label="Закрыть оценку" onClick={onClose} className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-[#F2F0E8]"><X size={20} /></button>
      </div>
      <div className={`mt-5 grid h-16 w-16 place-items-center rounded-2xl text-3xl font-bold ${gradeColor(grade.grade)}`}>{grade.grade}</div>
      <dl className="mt-5 space-y-4 text-sm">
        <div><dt className="text-black/45">Дата занятия</dt><dd className="mt-1 font-semibold">{gradeDate(grade.lessonDate, true)}</dd></div>
        <div><dt className="text-black/45">Педагог</dt><dd className="mt-1 break-words font-semibold">{grade.teacher}</dd></div>
      </dl>
      {grade.comment && <p className="mt-4 whitespace-pre-wrap break-words text-sm leading-6">{grade.comment}</p>}
    </div>
  </dialog>, document.body);
}
