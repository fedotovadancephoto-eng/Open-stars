import { Award, CalendarDays, Star, Trophy } from "lucide-react";

import { Card } from "@/components/Card";
import { achievements } from "@/data/demoData";

export function AchievementsTab() {
  return (
    <div className="space-y-5">
      <Card className="p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.20em] text-black/40">
              Результаты и участие
            </p>
            <h2 className="mt-1 text-2xl font-semibold tracking-[-0.03em] text-[#171717]">
              Достижения
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-black/45">
              Здесь отображаются достижения и дополнительные Star Coin, зафиксированные администрацией OPEN STARS.
            </p>
          </div>

          <div className="inline-flex items-center gap-2 rounded-full border border-black/[0.07] bg-white px-3.5 py-2 text-xs font-semibold text-black/55">
            <Award className="h-4 w-4 text-[#5F6338]" strokeWidth={2} />
            {achievements.length} достижений
          </div>
        </div>
      </Card>

      {achievements.length === 0 ? (
        <Card className="p-6" hover={false}>
          <div className="flex items-start gap-3">
            <Trophy className="mt-0.5 h-5 w-5 shrink-0 text-[#D96A24]" />
            <div>
              <p className="font-semibold text-[#171717]">Достижений пока нет</p>
              <p className="mt-1 text-sm leading-6 text-black/45">
                Когда администрация отметит участие в показе, съёмке или другом событии, запись появится здесь.
              </p>
            </div>
          </div>
        </Card>
      ) : (
        <div className="space-y-3">
          {achievements.map((item: any, index: number) => {
            const isOrange = index % 2 === 0;

            return (
              <Card key={item.id} className="overflow-hidden p-0" hover={false}>
                <div className="relative p-5 sm:p-6">
                  <div
                    className={`absolute bottom-0 left-0 top-0 w-[3px] ${
                      isOrange ? "bg-[#D96A24]" : "bg-[#5F6338]"
                    }`}
                  />

                  <div className="flex items-start gap-4">
                    <div
                      className={`grid h-11 w-11 shrink-0 place-items-center rounded-full ${
                        isOrange
                          ? "bg-[#D96A24]/10 text-[#C95320]"
                          : "bg-[#5F6338]/10 text-[#4D512E]"
                      }`}
                    >
                      <Trophy className="h-5 w-5" strokeWidth={2} />
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-start justify-between gap-4">
                        <div>
                          <h3 className="text-lg font-semibold tracking-[-0.02em] text-[#171717]">
                            {item.title}
                          </h3>
                          <div className="mt-2 flex items-center gap-1.5 text-xs text-black/35">
                            <CalendarDays className="h-3.5 w-3.5" strokeWidth={1.8} />
                            {item.date}
                          </div>
                        </div>

                        {Number(item.coins || item.amount || 0) > 0 && (
                          <div
                            className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-semibold ${
                              isOrange
                                ? "bg-[#D96A24]/10 text-[#C95320]"
                                : "bg-[#5F6338]/10 text-[#4D512E]"
                            }`}
                          >
                            <Star className="h-4 w-4" strokeWidth={2} />
                            +{item.coins || item.amount} Star Coin
                          </div>
                        )}
                      </div>

                      {item.description && (
                        <p className="mt-4 max-w-3xl text-sm leading-7 text-black/55">
                          {item.description}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
