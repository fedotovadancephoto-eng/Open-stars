import {
  Building2,
  Clock3,
  Sparkles,
  Star,
} from "lucide-react";

import { Card } from "@/components/Card";
import { child } from "@/data/demoData";

function getChildValue(
  keys: string[],
  fallback: string
) {
  const data = child as unknown as Record<string, unknown>;

  for (const key of keys) {
    const value = data[key];

    if (
      typeof value === "string" &&
      value.trim().length > 0
    ) {
      return value;
    }
  }

  return fallback;
}

export function ProfileCard() {
  const branch = getChildValue(
    ["branch", "campus", "location"],
    "Октябрьский"
  );

  const lessonDay = getChildValue(
    ["lessonDay", "lesson_day", "day"],
    "Суббота"
  );

  const lessonTime = getChildValue(
    ["lessonTime", "lesson_time", "time"],
    "16:00"
  );

  const administrator = getChildValue(
    [
      "administrator",
      "administratorName",
      "mentorName",
      "mentor_name",
    ],
    "Мария Иванова"
  );

  return (
    <Card
      className="
        relative
        overflow-hidden
        rounded-[28px]
        border
        border-black/[0.055]
        bg-white
        p-0
        shadow-[0_12px_34px_rgba(0,0,0,0.055)]
      "
    >
      {/* Декоративный верх */}
      <div
        className="
          absolute
          inset-x-0
          top-0
          h-[8px]
          bg-gradient-to-r
          from-[#D96A24]
          via-[#E8752A]
          to-[#8B8735]
        "
      />

      <div className="p-5 pt-7 sm:p-7 sm:pt-8">
        <div
          className="
            grid
            gap-6
            md:grid-cols-[170px_1fr_auto]
            md:items-start
          "
        >
          {/* Карточка ребёнка */}
          <div
            className="
              relative
              h-[145px]
              overflow-hidden
              rounded-[24px]
              border
              border-black/[0.06]
              bg-[#F5F3EC]
              shadow-[0_8px_22px_rgba(0,0,0,0.05)]
            "
          >
            <div
              className="
                absolute
                inset-x-0
                bottom-0
                h-[55px]
                bg-gradient-to-r
                from-[#D9D6C5]
                to-[#C4C2AD]
              "
            />

            <div
              className="
                absolute
                left-5
                top-5
                grid
                h-12
                w-12
                place-items-center
                rounded-full
                bg-white/75
                text-sm
                font-bold
                text-[#171717]
                shadow-sm
                backdrop-blur
              "
            >
              МП
            </div>

            <div
              className="
                absolute
                bottom-4
                right-4
                grid
                h-10
                w-10
                place-items-center
                rounded-full
                bg-[#5F6338]
                text-white
                shadow-[0_6px_14px_rgba(0,0,0,0.16)]
              "
            >
              <Star
                className="h-5 w-5"
                strokeWidth={2.2}
              />
            </div>
          </div>

          {/* Основная информация */}
          <div className="min-w-0">
            <div
              className="
                inline-flex
                items-center
                rounded-full
                bg-[#5F6338]
                px-3
                py-1
                text-[11px]
                font-bold
                uppercase
                tracking-[0.08em]
                text-white
              "
            >
              PRO
            </div>

            <div className="mt-5 space-y-4">
              <div className="flex items-start gap-3">
                <Building2
                  className="
                    mt-0.5
                    h-5
                    w-5
                    shrink-0
                    text-[#5F6338]
                  "
                  strokeWidth={2}
                />

                <div>
                  <p className="text-xs text-black/40">
                    Филиал
                  </p>

                  <p
                    className="
                      mt-0.5
                      text-[16px]
                      font-semibold
                      text-[#171717]
                    "
                  >
                    {branch}
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <Clock3
                  className="
                    mt-0.5
                    h-5
                    w-5
                    shrink-0
                    text-[#5F6338]
                  "
                  strokeWidth={2}
                />

                <div>
                  <p className="text-xs text-black/40">
                    Время занятий
                  </p>

                  <p
                    className="
                      mt-0.5
                      text-[16px]
                      font-semibold
                      text-[#171717]
                    "
                  >
                    {lessonDay} {lessonTime}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Правый акцент */}
          <div
            className="
              hidden
              items-center
              gap-2
              pt-1
              text-sm
              font-medium
              text-black/60
              md:flex
            "
          >
            <Sparkles
              className="h-4 w-4 text-[#D96A24]"
              strokeWidth={2}
            />

            <span>В центре внимания!</span>
          </div>
        </div>

        {/* Плашка администратора */}
        <div
          className="
            mt-6
            flex
            min-h-[58px]
            items-center
            rounded-[18px]
            bg-gradient-to-r
            from-[#D56722]
            via-[#E57B27]
            to-[#D99A2D]
            px-5
            text-white
            shadow-[0_8px_20px_rgba(217,106,36,0.18)]
          "
        >
          <span className="text-sm text-white/80 sm:text-base">
            Администратор:
          </span>

          <span
            className="
              ml-2
              text-sm
              font-semibold
              sm:text-base
            "
          >
            {administrator}
          </span>
        </div>
      </div>
    </Card>
  );
}