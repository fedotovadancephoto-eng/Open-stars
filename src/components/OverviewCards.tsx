import {
  Star,
  TrendingUp,
  Newspaper,
  BookOpen,
  ArrowUpRight,
} from "lucide-react";

import { Card } from "@/components/Card";
import { quickStats, news } from "@/data/demoData";

interface OverviewCardsProps {
  onTabSelect: (tab: string) => void;
}

export function OverviewCards({
  onTabSelect,
}: OverviewCardsProps) {
  const cards = [
    {
      label: "Star Coin",
      value: quickStats.coins,
      subtitle: "начислено за неделю",
      icon: Star,
      color: "#D96A24",
      softColor: "bg-[#D96A24]/10",
      tab: "coins",
    },
    {
      label: "Успеваемость",
      value: `${quickStats.progress}%`,
      subtitle: "за месяц",
      icon: TrendingUp,
      color: "#5F6338",
      softColor: "bg-[#5F6338]/10",
      tab: "progress",
    },
    {
      label: "Новости",
      value: news.length,
      subtitle: "на этой неделе",
      icon: Newspaper,
      color: "#D96A24",
      softColor: "bg-[#D96A24]/10",
      tab: "news",
    },
    {
      label: "Задания",
      value: quickStats.homeworkPending,
      subtitle: "ждут выполнения",
      icon: BookOpen,
      color: "#5F6338",
      softColor: "bg-[#5F6338]/10",
      tab: "homework",
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      {cards.map((card) => {
        const Icon = card.icon;

        return (
          <button
            key={card.label}
            type="button"
            onClick={() => onTabSelect(card.tab)}
            className="
              group
              block
              w-full
              text-left
              outline-none
            "
          >
            <Card
              className="
                relative
                min-h-[168px]
                overflow-hidden
                rounded-[24px]
                border
                border-black/[0.055]
                bg-white
                p-5
                shadow-[0_9px_26px_rgba(0,0,0,0.045)]
                transition-all
                duration-300
                group-hover:-translate-y-1
                group-hover:shadow-[0_15px_34px_rgba(0,0,0,0.075)]
              "
            >
              {/* Фирменная линия слева */}
              <div
                className="
                  absolute
                  bottom-5
                  left-0
                  top-5
                  w-[3px]
                  rounded-r-full
                "
                style={{
                  backgroundColor: card.color,
                }}
              />

              {/* Верх карточки */}
              <div className="flex items-start justify-between">
                <div
                  className={`
                    grid
                    h-12
                    w-12
                    place-items-center
                    rounded-[15px]
                    ${card.softColor}
                  `}
                >
                  <Icon
                    size={24}
                    strokeWidth={2.2}
                    style={{
                      color: card.color,
                    }}
                  />
                </div>

                <ArrowUpRight
                  className="
                    h-4
                    w-4
                    text-black/30
                    transition-all
                    duration-200
                    group-hover:-translate-y-0.5
                    group-hover:translate-x-0.5
                    group-hover:text-black/60
                  "
                  strokeWidth={1.8}
                />
              </div>

              {/* Значение */}
              <div className="mt-5">
                <div
                  className="
                    text-[35px]
                    font-semibold
                    leading-none
                    tracking-[-0.045em]
                  "
                  style={{
                    color:
                      card.tab === "coins" ||
                      card.tab === "news"
                        ? "#A84423"
                        : "#171717",
                  }}
                >
                  {card.value}
                </div>

                <div
                  className="
                    mt-3
                    text-[15px]
                    font-semibold
                    tracking-[-0.01em]
                    text-[#171717]
                  "
                >
                  {card.label}
                </div>

                <div
                  className="
                    mt-1
                    text-[13px]
                    leading-snug
                    text-black/45
                  "
                >
                  {card.subtitle}
                </div>
              </div>
            </Card>
          </button>
        );
      })}
    </div>
  );
}