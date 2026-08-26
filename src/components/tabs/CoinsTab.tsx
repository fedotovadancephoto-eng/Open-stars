import {
  Award,
  CalendarCheck,
  Camera,
  Car,
  Check,
  Plus,
  Sparkles,
  Star,
  Trophy,
  UserPlus,
} from "lucide-react";

import { Card } from "@/components/Card";
import { coinHistory, coins } from "@/data/demoData";

const automaticRules = [
  {
    id: "grade-5",
    title: "Оценка 5",
    description: "Начисляется автоматически",
    amount: "+5",
    icon: Star,
    accent: "orange",
  },
  {
    id: "grade-4",
    title: "Оценка 4",
    description: "Начисляется автоматически",
    amount: "+4",
    icon: Check,
    accent: "olive",
  },
  {
    id: "attendance",
    title: "Месяц без пропусков",
    description: "После завершения месяца",
    amount: "+5",
    icon: CalendarCheck,
    accent: "olive",
  },
];

const achievementRules = [
  {
    id: "show",
    title: "Участие в показе",
    amount: "+10",
    icon: Trophy,
    accent: "orange",
  },
  {
    id: "shoot",
    title: "Рекламная съёмка",
    amount: "+10",
    icon: Camera,
    accent: "olive",
  },
  {
    id: "event",
    title: "Выездное мероприятие",
    amount: "+20",
    icon: Car,
    accent: "orange",
  },
  {
    id: "friend",
    title: "Приведи друга",
    amount: "+50",
    icon: UserPlus,
    accent: "olive",
  },
  {
    id: "school-life",
    title: "Участие в жизни школы",
    amount: "+5–10",
    icon: Sparkles,
    accent: "orange",
  },
];

export function CoinsTab() {
  return (
    <div className="grid gap-5 lg:grid-cols-[0.9fr_1.6fr] lg:gap-6">
      <div className="space-y-5">
        <Card className="overflow-hidden p-0">
          <div className="p-5 sm:p-6">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-black/40">
                  STAR COIN
                </p>
                <h3 className="mt-1 text-xl font-semibold tracking-[-0.025em] text-[#171717]">
                  Баланс
                </h3>
              </div>

              <div className="inline-flex shrink-0 items-center gap-1 rounded-full bg-[#D96A24]/12 px-2.5 py-1 text-[11px] font-semibold text-[#C95320]">
                <Plus className="h-3 w-3" strokeWidth={2.3} />
                {coins.earnedThisMonth} в этом месяце
              </div>
            </div>

            <div className="mt-5 rounded-[22px] border border-black/[0.06] bg-[#FAF9F5] p-5">
              <div className="flex items-center gap-4">
                <div className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-[#D96A24]/10 text-[#C95320]">
                  <Star className="h-6 w-6" strokeWidth={2.2} />
                </div>
                <div>
                  <p className="text-4xl font-semibold tracking-[-0.045em] text-[#171717]">
                    {coins.balance}
                  </p>
                  <p className="mt-1 text-sm font-medium text-black/45">Star Coin</p>
                </div>
              </div>
            </div>

            <div className="mt-6">
              <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-black/40">
                Последние начисления
              </p>

              {coinHistory.length === 0 ? (
                <div className="mt-3 rounded-[18px] bg-black/[0.025] px-4 py-5 text-sm text-black/45">
                  Начислений пока нет. История появится после первой операции со Star Coin.
                </div>
              ) : (
                <div className="mt-3 divide-y divide-black/[0.06]">
                  {coinHistory.slice(0, 8).map((item: any) => (
                    <div key={item.id} className="flex items-center justify-between gap-4 py-3.5">
                      <div className="flex min-w-0 items-center gap-3">
                        <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-[#5F6338]/10 text-[#4D512E]">
                          <Plus className="h-4 w-4" strokeWidth={2.2} />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold leading-snug text-[#171717]">
                            {item.title}
                          </p>
                          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-black/40">
                            <span>{item.date}</span>
                            {item.source && <span>· {item.source}</span>}
                          </div>
                        </div>
                      </div>
                      <span
                        className={`shrink-0 text-base font-bold ${
                          Number(item.amount) >= 0 ? "text-[#C95320]" : "text-red-600"
                        }`}
                      >
                        {Number(item.amount) >= 0 ? "+" : ""}{item.amount}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </Card>

        <div className="rounded-[20px] border border-black/[0.06] bg-white px-4 py-4">
          <div className="flex items-start gap-3">
            <Award className="mt-0.5 h-5 w-5 shrink-0 text-[#5F6338]" strokeWidth={2} />
            <p className="text-xs leading-relaxed text-black/45">
              Дополнительные Star Coin могут быть начислены администратором OPEN STARS за достижения, события и специальные активности.
            </p>
          </div>
        </div>
      </div>

      <Card className="p-5 sm:p-6">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.20em] text-black/40">
            Система поощрений
          </p>
          <h3 className="mt-1 text-xl font-semibold tracking-[-0.025em] text-[#171717]">
            Как получить Star Coin
          </h3>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-black/45">
            За оценки и посещаемость Star Coin начисляются автоматически. Дополнительные достижения фиксирует администрация школы.
          </p>
        </div>

        <div className="mt-7">
          <div className="flex items-center gap-3">
            <span className="h-px w-7 bg-[#D96A24]" />
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-black/45">
              Автоматически
            </p>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-3">
            {automaticRules.map((rule) => {
              const Icon = rule.icon;
              const isOrange = rule.accent === "orange";
              return (
                <div key={rule.id} className="rounded-[20px] border border-black/[0.06] bg-white p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div
                      className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${
                        isOrange
                          ? "bg-[#D96A24]/10 text-[#C95320]"
                          : "bg-[#5F6338]/10 text-[#4D512E]"
                      }`}
                    >
                      <Icon className="h-5 w-5" strokeWidth={2.1} />
                    </div>
                    <span className={`shrink-0 text-base font-bold ${isOrange ? "text-[#C95320]" : "text-[#4D512E]"}`}>
                      {rule.amount}
                    </span>
                  </div>
                  <p className="mt-4 text-sm font-semibold leading-snug text-[#171717]">{rule.title}</p>
                  <p className="mt-1 text-xs leading-relaxed text-black/40">{rule.description}</p>
                </div>
              );
            })}
          </div>
        </div>

        <div className="mt-7">
          <div className="flex items-center gap-3">
            <span className="h-px w-7 bg-[#5F6338]" />
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-black/45">
              Дополнительные достижения
            </p>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {achievementRules.map((rule) => {
              const Icon = rule.icon;
              const isOrange = rule.accent === "orange";
              return (
                <div key={rule.id} className="flex min-h-[70px] items-center justify-between gap-4 rounded-[18px] border border-black/[0.06] bg-white px-4 py-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <div
                      className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${
                        isOrange
                          ? "bg-[#D96A24]/10 text-[#C95320]"
                          : "bg-[#5F6338]/10 text-[#4D512E]"
                      }`}
                    >
                      <Icon className="h-5 w-5" strokeWidth={2.1} />
                    </div>
                    <p className="text-sm font-semibold leading-snug text-[#171717]">{rule.title}</p>
                  </div>
                  <span className={`shrink-0 text-base font-bold ${isOrange ? "text-[#C95320]" : "text-[#4D512E]"}`}>
                    {rule.amount}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </Card>
    </div>
  );
}
