import {
  CalendarDays,
  MessageCircle,
} from "lucide-react";

import { Card } from "@/components/Card";

const teacherComments = [
  {
    id: "comment-1",
    teacher: "Елена В.",
    initials: "ЕВ",
    subject: "Хореография",
    date: "25 августа 2026",
    title: "Хорошая динамика",
    text:
      "Мия стала увереннее держать корпус и лучше чувствует музыку. Продолжаем работать над координацией, линиями и чистотой движений.",
    accent: "orange",
    isNew: true,
  },
  {
    id: "comment-2",
    teacher: "Даниил К.",
    initials: "ДК",
    subject: "Фотопозирование",
    date: "23 августа 2026",
    title: "Стала увереннее перед камерой",
    text:
      "Мия хорошо включается в работу и быстрее находит удачные положения корпуса. Рекомендую дома повторить базовые позы перед зеркалом и обратить внимание на положение рук.",
    accent: "olive",
    isNew: false,
  },
  {
    id: "comment-3",
    teacher: "Анна Р.",
    initials: "АР",
    subject: "Актёрское мастерство",
    date: "20 августа 2026",
    title: "Хорошая работа на занятии",
    text:
      "Сегодня Мия активно участвовала в упражнениях и стала свободнее проявлять эмоции. Особенно хорошо справилась с заданиями на внимание, мимику и импровизацию.",
    accent: "orange",
    isNew: false,
  },
  {
    id: "comment-4",
    teacher: "Елена В.",
    initials: "ЕВ",
    subject: "Дефиле",
    date: "17 августа 2026",
    title: "Есть заметный прогресс",
    text:
      "Походка стала спокойнее и увереннее. Мия лучше держит осанку и контролирует темп. Сейчас важно закрепить развороты, остановки и положение рук.",
    accent: "olive",
    isNew: false,
  },
  {
    id: "comment-5",
    teacher: "Мария С.",
    initials: "МС",
    subject: "Мастер-класс",
    date: "15 августа 2026",
    title: "Мастер-класс: сценическое присутствие",
    text:
      "Мия активно включилась в упражнения приглашённого специалиста. Хорошо работала со взглядом, выходом и подачей. Продолжаем развивать уверенность перед аудиторией.",
    accent: "orange",
    isNew: false,
  },
];

export function CommentsTab() {
  return (
    <div className="space-y-5">
      {/* Заголовок */}
      <Card className="p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.20em] text-black/40">
              Обратная связь
            </p>

            <h2 className="mt-1 text-2xl font-semibold tracking-[-0.03em] text-[#171717]">
              Комментарии педагогов
            </h2>

            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-black/45">
              Здесь собрана обратная связь педагогов по занятиям,
              развитию и результатам Мии.
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
            <MessageCircle
              className="h-4 w-4 text-[#5F6338]"
              strokeWidth={2}
            />

            {teacherComments.length} комментариев
          </div>
        </div>
      </Card>

      {/* Комментарии */}
      <div className="space-y-3">
        {teacherComments.map((comment) => {
          const isOrange =
            comment.accent === "orange";

          return (
            <Card
              key={comment.id}
              className="overflow-hidden p-0"
              hover={false}
            >
              <div className="relative p-5 sm:p-6">
                {/* Цветная линия слева */}
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
                  {/* Инициалы */}
                  <div
                    className={`
                      grid
                      h-11
                      w-11
                      shrink-0
                      place-items-center
                      rounded-full
                      text-xs
                      font-bold
                      ${
                        isOrange
                          ? "bg-[#D96A24]/10 text-[#C95320]"
                          : "bg-[#5F6338]/10 text-[#4D512E]"
                      }
                    `}
                  >
                    {comment.initials}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="text-[15px] font-semibold text-[#171717]">
                          {comment.teacher}
                        </p>

                        <div className="mt-1 flex flex-wrap items-center gap-2">
                          <span
                            className={`
                              inline-flex
                              rounded-full
                              px-2.5
                              py-1
                              text-[11px]
                              font-semibold
                              ${
                                isOrange
                                  ? "bg-[#D96A24]/10 text-[#C95320]"
                                  : "bg-[#5F6338]/10 text-[#4D512E]"
                              }
                            `}
                          >
                            {comment.subject}
                          </span>

                          {comment.isNew && (
                            <span
                              className="
                                rounded-full
                                bg-black/[0.05]
                                px-2.5
                                py-1
                                text-[10px]
                                font-bold
                                uppercase
                                tracking-[0.14em]
                                text-black/45
                              "
                            >
                              Новый
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 text-xs text-black/35">
                        <CalendarDays
                          className="h-3.5 w-3.5"
                          strokeWidth={1.8}
                        />
                        {comment.date}
                      </div>
                    </div>

                    <h3 className="mt-4 text-lg font-semibold tracking-[-0.02em] text-[#171717]">
                      {comment.title}
                    </h3>

                    <p className="mt-2 max-w-4xl text-sm leading-7 text-black/60">
                      {comment.text}
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
        <MessageCircle
          className="mt-0.5 h-5 w-5 shrink-0 text-[#5F6338]"
          strokeWidth={2}
        />

        <p className="text-xs leading-relaxed text-black/45">
          Комментарий к конкретному домашнему заданию будет
          отображаться внутри этого задания. Здесь собрана общая
          обратная связь педагогов по развитию ученика.
        </p>
      </div>
    </div>
  );
}