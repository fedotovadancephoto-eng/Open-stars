import { useState } from "react";
import { BookOpenCheck, CalendarCheck2, TrendingUp } from "lucide-react";

import { Card } from "@/components/Card";
import { GradeDetails, GradeJournalRow } from "@/components/GradeJournalRow";
import { attendance, grades } from "@/data/demoData";
import { currentSchoolYear, gradesForPeriod, groupJournalGrades, isGraded, journalYears, JOURNAL_MONTHS } from "@/gradeJournal";

export function ProgressTab() {
  const [year, setYear] = useState(() => String(currentSchoolYear()));
  const [month, setMonth] = useState("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  // Dashboard arrays update in place; derive on each render rather than memoizing their identity.
  const years = journalYears(grades);
  const periodGrades = gradesForPeriod(grades, year === "all" ? null : Number(year), month);
  const rows = groupJournalGrades(periodGrades);
  const selected = periodGrades.find(item => item.id === selectedId);

  return (
    <div className="grid min-w-0 items-start gap-5 lg:grid-cols-2 lg:gap-6">
      <Card className="min-w-0 p-5 sm:p-6" hover={false}>
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.20em] text-black/40">Развитие ребёнка</p>
            <h2 className="mt-1 text-2xl font-semibold tracking-[-0.03em] text-[#171717]">Успеваемость</h2>
          </div>
          <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-[#5F6338]/10 text-[#4D512E]"><TrendingUp className="h-5 w-5" /></div>
        </div>

        <div className="mt-5 grid min-w-0 grid-cols-2 gap-3">
          <label className="min-w-0 text-xs text-black/50">Учебный год
            <select value={year} onChange={event => { setYear(event.target.value); setMonth("all"); setSelectedId(null); }} className="mt-1.5 min-h-11 w-full min-w-0 rounded-xl border border-black/10 bg-[#FAF9F5] px-2 text-sm font-semibold text-[#171717]">
              {years.map(value => <option key={value} value={value}>{value}/{value + 1}</option>)}
              <option value="all">Вся история</option>
            </select>
          </label>
          <label className="min-w-0 text-xs text-black/50">Месяц
            <select value={month} onChange={event => { setMonth(event.target.value); setSelectedId(null); }} className="mt-1.5 min-h-11 w-full min-w-0 rounded-xl border border-black/10 bg-[#FAF9F5] px-2 text-sm font-semibold text-[#171717]">
              <option value="all">Все месяцы</option>
              {JOURNAL_MONTHS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </label>
        </div>
        <p className="mt-3 text-xs leading-5 text-black/45">Листайте оценки по горизонтали. Нажмите на оценку, чтобы увидеть дату и педагога.</p>
        {periodGrades.length === 0 && <p role="status" className="mt-3 rounded-xl bg-[#FAF9F5] p-3 text-sm text-black/50">За выбранный период оценок пока нет.</p>}

        <section className="mt-5" aria-label="Основные предметы">
          <h3 className="text-[11px] font-bold uppercase tracking-widest text-black/40">Основные предметы</h3>
          <div className="divide-y divide-black/[0.06]">{rows.filter(row => row.kind === "core").map(row => <GradeJournalRow key={`${year}:${month}:${row.key}`} row={row} onSelect={setSelectedId} />)}</div>
        </section>
        {rows.some(row => row.kind === "masterclass") && <section className="mt-4 border-t border-black/[0.06] pt-5" aria-label="Мастер-классы">
          <h3 className="text-[11px] font-bold uppercase tracking-widest text-[#C95320]">Мастер-классы</h3>
          <div className="divide-y divide-black/[0.06]">{rows.filter(row => row.kind === "masterclass").map(row => <GradeJournalRow key={`${year}:${month}:${row.key}`} row={row} onSelect={setSelectedId} />)}</div>
        </section>}
        {rows.filter(row => row.kind === "unknown").map(row => <GradeJournalRow key={row.key} row={row} onSelect={setSelectedId} />)}
        {selected && isGraded(selected) && <GradeDetails key={selected.id} grade={selected} onClose={() => setSelectedId(null)} />}
      </Card>

      <Card className="min-w-0 p-5 sm:p-6" hover={false}>
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.20em] text-black/40">
              Посещаемость
            </p>
            <h2 className="mt-1 text-2xl font-semibold tracking-[-0.03em] text-[#171717]">
              Занятия
            </h2>
          </div>
          <div className="grid h-11 w-11 place-items-center rounded-2xl bg-[#D96A24]/10 text-[#C95320]">
            <CalendarCheck2 className="h-5 w-5" />
          </div>
        </div>

        {attendance.total === 0 ? (
          <div className="mt-5 rounded-[20px] border border-black/[0.06] bg-[#FAF9F5] p-5">
            <p className="font-semibold text-[#171717]">Посещаемость пока не отмечена</p>
            <p className="mt-1 text-sm leading-6 text-black/45">
              После первого отмеченного занятия здесь появится статистика посещений.
            </p>
          </div>
        ) : (
          <>
            <div className="mt-5 flex items-center gap-5 rounded-[22px] bg-[#FAF9F5] p-5">
              <div className="grid h-24 w-24 shrink-0 place-items-center rounded-full border-[9px] border-[#D96A24]/20 bg-white">
                <span className="text-2xl font-semibold text-[#171717]">{attendance.percentage}%</span>
              </div>
              <div>
                <p className="font-semibold text-[#171717]">
                  Посещено {attendance.present} из {attendance.total}
                </p>
                <p className="mt-1 text-sm text-black/45">
                  Пропусков: {attendance.absent}
                </p>
              </div>
            </div>

            <div className="mt-5 divide-y divide-black/[0.06]">
              {attendance.slice(0, 8).map((item: { id: string; subject: string; date: string; present: boolean }) => (
                <div key={item.id} className="flex items-center justify-between gap-4 py-3">
                  <div className="flex items-center gap-3">
                    <BookOpenCheck className="h-4 w-4 text-[#5F6338]" />
                    <div>
                      <p className="text-sm font-semibold text-[#171717]">{item.subject}</p>
                      <p className="mt-1 text-xs text-black/40">{item.date}</p>
                    </div>
                  </div>
                  <span
                    className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                      item.present
                        ? "bg-[#5F6338]/10 text-[#4D512E]"
                        : "bg-red-50 text-red-600"
                    }`}
                  >
                    {item.present ? "Посещено" : "Пропуск"}
                  </span>
                </div>
              ))}
            </div>
          </>
        )}
      </Card>
    </div>
  );
}
