import { Clock, MapPin, User } from "lucide-react";

import { Card } from "@/components/Card";
import { schedule } from "@/data/demoData";

export function ScheduleTab() {
  return (
    <Card className="p-5 sm:p-6" hover={false}>
      <div>
        <p className="text-[11px] font-bold uppercase tracking-[0.20em] text-black/40">
          Для родителей
        </p>
        <h3 className="mt-1 text-2xl font-semibold tracking-[-0.03em] text-[#171717]">
          Расписание
        </h3>
        <p className="mt-2 text-sm text-black/45">
          Актуальные занятия ребёнка в OPEN STARS.
        </p>
      </div>

      {schedule.length === 0 ? (
        <div className="mt-5 rounded-[20px] border border-black/[0.06] bg-[#FAF9F5] px-5 py-8 text-center text-sm text-black/45">
          Расписание пока не опубликовано.
        </div>
      ) : (
        <div className="mt-5 space-y-3">
          {schedule.map((lesson) => (
            <div
              key={lesson.id}
              className="rounded-[22px] border border-black/[0.06] bg-white p-4 shadow-[0_7px_20px_rgba(0,0,0,0.035)]"
            >
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                <div className="flex shrink-0 items-center gap-3 sm:w-[150px]">
                  <div className="grid h-14 w-14 place-items-center rounded-[18px] bg-[#D96A24]/10 text-[#C95320]">
                    <Clock className="h-6 w-6" strokeWidth={2} />
                  </div>
                  <div>
                    <p className="text-lg font-semibold text-[#171717]">
                      {lesson.time}
                    </p>
                    <p className="text-xs text-black/40">
                      {lesson.endTime ? `до ${lesson.endTime}` : lesson.duration}
                    </p>
                  </div>
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-[#5F6338]/10 px-2.5 py-1 text-[11px] font-semibold text-[#4D512E]">
                      {lesson.day}
                    </span>
                    <span className="text-xs text-black/35">{lesson.date}</span>
                  </div>

                  <h4 className="mt-2 text-lg font-semibold tracking-[-0.02em] text-[#171717]">
                    {lesson.subject || lesson.title}
                  </h4>

                  <div className="mt-2 flex flex-wrap gap-x-4 gap-y-2 text-xs text-black/45">
                    <span className="flex items-center gap-1.5">
                      <User className="h-3.5 w-3.5" />
                      {lesson.instructor || lesson.teacher || "Преподаватель"}
                    </span>
                    <span className="flex items-center gap-1.5">
                      <MapPin className="h-3.5 w-3.5" />
                      {lesson.room || "Место уточняется"}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
