import { Bell, Clock, Megaphone } from "lucide-react";

import { Card } from "@/components/Card";
import { news } from "@/data/demoData";

export function NewsTab() {
  return (
    <div className="space-y-4">
      <Card className="p-5 sm:p-6">
        <p className="text-[11px] font-bold uppercase tracking-[0.20em] text-black/40">
          OPEN STARS
        </p>
        <h2 className="mt-1 text-2xl font-semibold tracking-[-0.03em] text-[#171717]">
          Новости
        </h2>
        <p className="mt-2 text-sm text-black/45">
          Объявления, события и важная информация школы.
        </p>
      </Card>

      {news.length === 0 ? (
        <Card className="p-6" hover={false}>
          <div className="flex items-start gap-3">
            <Bell className="mt-0.5 h-5 w-5 shrink-0 text-[#5F6338]" />
            <div>
              <p className="font-semibold text-[#171717]">Новых публикаций пока нет</p>
              <p className="mt-1 text-sm text-black/45">
                Когда администрация OPEN STARS опубликует новость, она появится здесь.
              </p>
            </div>
          </div>
        </Card>
      ) : (
        news.map((item, index) => (
          <Card key={item.id} className="p-5 sm:p-6" hover={false}>
            <div className="flex items-start gap-4">
              <div
                className={`grid h-11 w-11 shrink-0 place-items-center rounded-2xl ${
                  index % 2 === 0
                    ? "bg-[#D96A24]/10 text-[#C95320]"
                    : "bg-[#5F6338]/10 text-[#4D512E]"
                }`}
              >
                <Megaphone className="h-5 w-5" />
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2 text-xs text-black/40">
                  <span className="rounded-full bg-black/[0.04] px-2.5 py-1 font-semibold text-black/55">
                    {item.category || "OPEN STARS"}
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {item.date}
                  </span>
                </div>

                <h3 className="mt-3 text-lg font-semibold tracking-[-0.02em] text-[#171717]">
                  {item.title}
                </h3>
                <p className="mt-2 text-sm leading-7 text-black/55">
                  {item.body || item.description || item.excerpt}
                </p>
              </div>
            </div>
          </Card>
        ))
      )}
    </div>
  );
}
