import {
  Award,
  CalendarDays,
  Camera,
  Star,
  Trophy,
} from "lucide-react";

import { Card } from "@/components/Card";

const achievements = [
  {
    id: "achievement-1",
    title: "Участие в показе",
    date: "24 августа 2026",
    description:
      "Мия приняла участие в показе OPEN STARS и успешно выступила на подиуме.",
    coins: 10,
    icon: Trophy,
    accent: "orange",
  },
  {
    id: "achievement-2",
    title: "Рекламная съёмка",
    date: "10 августа 2026",
    description:
      "Участие в рекламной съёмке и уверенная работа перед камерой.",
    coins: 10,
    icon: Camera,
    accent: "olive",
  },
  {
    id: "achievement-3",
    title: "Без пропусков за месяц",
    date: "31 июля 2026",
    description:
      "Все занятия месяца посещены без пропусков.",
    coins: 5,
    icon: Award,
    accent: "orange",
  },
  {
    id: "achievement-4",
    title: "Отличные результаты",
    date: "25 июля 2026",
    description:
      "Стабильная работа на занятиях и хорошие результаты по основным направлениям.",
    coins: 5,
    icon: Star,
    accent: "olive",
  },
];

export function AchievementsTab() {
  return (
    <div className="space-y-5">
      {/* Заголовок */}
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
              Здесь собраны достижения Мии, участие в проектах OPEN STARS
              и начисленные за них Star Coin.
            </p>
          </div>

          <div
            className="
              inline-flex
              items-center
              gap-2
              rounded-full
              border
              border-black/[0.07]
              bg-white
              px-3.5
              py-2
              text-xs
              font-semibold
              text-black/55
            "
          >
            <Award
              className="h-4 w-4 text-[#5F6338]"
              strokeWidth={2}
            />

            {achievements.length} достижения
          </div>
        </div>
      </Card>

      {/* Список достижений */}
      <div className="space-y-3">
        {achievements.map((item) => {
          const Icon = item.icon;
          const isOrange =
            item.accent === "orange";

          return (
            <Card
              key={item.id}
              className="overflow-hidden p-0"
              hover={false}
            >
              <div className="relative p-5 sm:p-6">
                <div
                  className={`
                    absolute
                    bottom-0
                    left-0
                    top-0
                    w-[3px]
                    ${
                      isOrange
                        ? "bg-[#D96A24]"
                        : "bg-[#5F6338]"
                    }
                  `}
                />

                <div className="flex items-start gap-4">
                  <div
                    className={`
                      grid
                      h-11
                      w-11
                      shrink-0
                      place-items-center
                      rounded-full
                      ${
                        isOrange
                          ? "bg-[#D96A24]/10 text-[#C95320]"
                          : "bg-[#5F6338]/10 text-[#4D512E]"
                      }
                    `}
                  >
                    <Icon
                      className="h-5 w-5"
                      strokeWidth={2}
                    />
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div>
                        <h3 className="text-lg font-semibold tracking-[-0.02em] text-[#171717]">
                          {item.title}
                        </h3>

                        <div className="mt-2 flex items-center gap-1.5 text-xs text-black/35">
                          <CalendarDays
                            className="h-3.5 w-3.5"
                            strokeWidth={1.8}
                          />

                          {item.date}
                        </div>
                      </div>

                      <div
                        className={`
                          inline-flex
                          shrink-0
                          items-center
                          gap-1.5
                          rounded-full
                          px-3
                          py-1.5
                          text-sm
                          font-semibold
                          ${
                            isOrange
                              ? "bg-[#D96A24]/10 text-[#C95320]"
                              : "bg-[#5F6338]/10 text-[#4D512E]"
                          }
                        `}
                      >
                        <Star
                          className="h-4 w-4"
                          strokeWidth={2}
                        />

                        +{item.coins} Star Coin
                      </div>
                    </div>

                    <p className="mt-4 max-w-3xl text-sm leading-7 text-black/55">
                      {item.description}
                    </p>
                  </div>
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      {/* Подсказка */}
      <div
        className="
          flex
          items-start
          gap-3
          rounded-[20px]
          border
          border-black/[0.06]
          bg-white
          px-4
          py-4
        "
      >
        <Award
          className="mt-0.5 h-5 w-5 shrink-0 text-[#5F6338]"
          strokeWidth={2}
        />

        <p className="text-xs leading-relaxed text-black/45">
          Достижения фиксируются администрацией OPEN STARS.
          За отдельные события и участие в проектах могут начисляться
          дополнительные Star Coin.
        </p>
      </div>
    </div>
  );
}