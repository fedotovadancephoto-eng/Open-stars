import { BookOpen, CheckCircle2, Clock3 } from "lucide-react";

import { Card } from "@/components/Card";
import { homework } from "@/data/demoData";

export function HomeworkTab() {
  return (
    <Card className="p-5 sm:p-6" hover={false}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.20em] text-black/40">
            Развитие ребёнка
          </p>
          <h2 className="mt-1 text-2xl font-semibold tracking-[-0.03em] text-[#171717]">
            Домашние задания
          </h2>
          <p className="mt-2 text-sm text-black/45">
            Задания от педагогов OPEN STARS.
          </p>
        </div>
        <div className="grid h-11 w-11 place-items-center rounded-2xl bg-[#D96A24]/10 text-[#C95320]">
          <BookOpen className="h-5 w-5" />
        </div>
      </div>

      {homework.length === 0 ? (
        <div className="mt-5 rounded-[20px] border border-black/[0.06] bg-[#FAF9F5] p-5">
          <p className="font-semibold text-[#171717]">Домашних заданий пока нет</p>
          <p className="mt-1 text-sm leading-6 text-black/45">
            Когда педагог добавит задание, оно появится здесь вместе со сроком выполнения.
          </p>
        </div>
      ) : (
        <div className="mt-5 space-y-3">
          {homework.map((item: any) => {
            const completed = item.status === "completed";
            const inProgress = item.status === "in-progress";

            return (
              <div
                key={item.id}
                className="rounded-[22px] border border-black/[0.06] bg-white p-4 shadow-[0_7px_20px_rgba(0,0,0,0.035)]"
              >
                <div className="flex items-start gap-4">
                  <div
                    className={`grid h-11 w-11 shrink-0 place-items-center rounded-2xl ${
                      completed
                        ? "bg-[#5F6338]/10 text-[#4D512E]"
                        : "bg-[#D96A24]/10 text-[#C95320]"
                    }`}
                  >
                    {completed ? (
                      <CheckCircle2 className="h-5 w-5" />
                    ) : (
                      <Clock3 className="h-5 w-5" />
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-black/[0.04] px-2.5 py-1 text-[11px] font-semibold text-black/55">
                        {item.subject}
                      </span>
                      <span
                        className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                          completed
                            ? "bg-[#5F6338]/10 text-[#4D512E]"
                            : "bg-[#D96A24]/10 text-[#C95320]"
                        }`}
                      >
                        {completed
                          ? "Выполнено"
                          : inProgress
                            ? "В работе"
                            : "Новое"}
                      </span>
                    </div>

                    <h3 className="mt-3 text-lg font-semibold tracking-[-0.02em] text-[#171717]">
                      {item.title}
                    </h3>
                    {item.description && (
                      <p className="mt-2 text-sm leading-7 text-black/55">
                        {item.description}
                      </p>
                    )}
                    {item.dueDate && (
                      <p className="mt-3 text-xs font-medium text-black/40">
                        Выполнить до: {item.dueDate}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}
