import { CalendarDays, MessageCircle } from "lucide-react";

import { Card } from "@/components/Card";
import { comments } from "@/data/demoData";

export function CommentsTab() {
  return (
    <div className="space-y-5">
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
              Здесь появляется обратная связь по занятиям и развитию ребёнка.
            </p>
          </div>

          <div className="inline-flex items-center gap-2 rounded-full border border-black/[0.07] bg-white px-3.5 py-2 text-xs font-semibold text-black/55">
            <MessageCircle className="h-4 w-4 text-[#5F6338]" strokeWidth={2} />
            {comments.length} комментариев
          </div>
        </div>
      </Card>

      {comments.length === 0 ? (
        <Card className="p-6" hover={false}>
          <div className="flex items-start gap-3">
            <MessageCircle className="mt-0.5 h-5 w-5 shrink-0 text-[#5F6338]" />
            <div>
              <p className="font-semibold text-[#171717]">Комментариев пока нет</p>
              <p className="mt-1 text-sm leading-6 text-black/45">
                После публикации педагогом комментарий появится в этом разделе.
              </p>
            </div>
          </div>
        </Card>
      ) : (
        <div className="space-y-3">
          {comments.map((comment: any, index: number) => {
            const isOrange = index % 2 === 0;
            const initials = (comment.teacher || "Преподаватель")
              .split(" ")
              .map((part: string) => part.charAt(0))
              .join("")
              .slice(0, 2)
              .toUpperCase();

            return (
              <Card key={comment.id} className="overflow-hidden p-0" hover={false}>
                <div className="relative p-5 sm:p-6">
                  <div
                    className={`absolute bottom-0 left-0 top-0 w-[3px] ${
                      isOrange ? "bg-[#D96A24]" : "bg-[#5F6338]"
                    }`}
                  />

                  <div className="flex items-start gap-4">
                    <div
                      className={`grid h-11 w-11 shrink-0 place-items-center rounded-full text-xs font-bold ${
                        isOrange
                          ? "bg-[#D96A24]/10 text-[#C95320]"
                          : "bg-[#5F6338]/10 text-[#4D512E]"
                      }`}
                    >
                      {initials}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="text-[15px] font-semibold text-[#171717]">
                            {comment.teacher || "Преподаватель"}
                          </p>
                          <span
                            className={`mt-1 inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                              isOrange
                                ? "bg-[#D96A24]/10 text-[#C95320]"
                                : "bg-[#5F6338]/10 text-[#4D512E]"
                            }`}
                          >
                            {comment.subject || "Занятие"}
                          </span>
                        </div>

                        <div className="flex items-center gap-1.5 text-xs text-black/35">
                          <CalendarDays className="h-3.5 w-3.5" strokeWidth={1.8} />
                          {comment.date}
                        </div>
                      </div>

                      <h3 className="mt-4 text-lg font-semibold tracking-[-0.02em] text-[#171717]">
                        {comment.title || "Комментарий педагога"}
                      </h3>
                      <p className="mt-2 max-w-4xl text-sm leading-7 text-black/60">
                        {comment.text || comment.comment}
                      </p>
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
