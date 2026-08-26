import { BookOpenCheck, CalendarCheck2, TrendingUp } from "lucide-react";

import { Card } from "@/components/Card";
import { attendance, grades, progress } from "@/data/demoData";

export function ProgressTab() {
  return (
    <div className="grid gap-5 lg:grid-cols-2 lg:gap-6">
      <Card className="p-5 sm:p-6" hover={false}>
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.20em] text-black/40">
              Развитие ребёнка
            </p>
            <h2 className="mt-1 text-2xl font-semibold tracking-[-0.03em] text-[#171717]">
              Успеваемость
            </h2>
          </div>
          <div className="grid h-11 w-11 place-items-center rounded-2xl bg-[#5F6338]/10 text-[#4D512E]">
            <TrendingUp className="h-5 w-5" />
          </div>
        </div>

        {grades.length === 0 ? (
          <div className="mt-5 rounded-[20px] border border-black/[0.06] bg-[#FAF9F5] p-5">
            <p className="font-semibold text-[#171717]">Оценок пока нет</p>
            <p className="mt-1 text-sm leading-6 text-black/45">
              После выставления оценок педагогами здесь появятся средний результат и динамика по направлениям.
            </p>
          </div>
        ) : (
          <>
            <div className="mt-5 grid grid-cols-2 gap-3">
              <div className="rounded-[20px] bg-[#D96A24]/[0.07] p-4">
                <p className="text-xs text-black/40">Средняя оценка</p>
                <p className="mt-2 text-3xl font-semibold text-[#C95320]">
                  {progress.averageGrade}
                </p>
              </div>
              <div className="rounded-[20px] bg-[#5F6338]/[0.07] p-4">
                <p className="text-xs text-black/40">Общий результат</p>
                <p className="mt-2 text-3xl font-semibold text-[#4D512E]">
                  {progress.overall}%
                </p>
              </div>
            </div>

            <div className="mt-5 space-y-4">
              {progress.skills.map((skill: any) => (
                <div key={skill.name}>
                  <div className="mb-1.5 flex items-center justify-between text-sm">
                    <span className="font-semibold text-[#171717]">{skill.name}</span>
                    <span className="font-bold text-black/55">{skill.mastery}%</span>
                  </div>
                  <div className="h-2.5 overflow-hidden rounded-full bg-black/[0.055]">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-[#D96A24] to-[#E98A34]"
                      style={{ width: `${skill.mastery}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-6 divide-y divide-black/[0.06]">
              {grades.slice(0, 6).map((item: any) => (
                <div key={item.id} className="flex items-center justify-between gap-4 py-3">
                  <div>
                    <p className="text-sm font-semibold text-[#171717]">{item.subject}</p>
                    <p className="mt-1 text-xs text-black/40">{item.date}</p>
                  </div>
                  <div className="grid h-10 w-10 place-items-center rounded-full bg-[#D96A24]/10 text-lg font-bold text-[#C95320]">
                    {item.grade}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </Card>

      <Card className="p-5 sm:p-6" hover={false}>
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
              {attendance.slice(0, 8).map((item: any) => (
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
