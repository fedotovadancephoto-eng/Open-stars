import { Bell, Camera, ExternalLink, Images } from "lucide-react";

import { Card } from "@/components/Card";
import { photos } from "@/data/demoData";

export function PhotosTab() {
  return (
    <div className="space-y-5">
      <Card className="p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.20em] text-black/40">
              Фотосессии OPEN STARS
            </p>
            <h2 className="mt-1 text-2xl font-semibold tracking-[-0.03em] text-[#171717]">
              Фотосессии
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-black/45">
              Здесь отображаются опубликованные администрацией ссылки на фотографии.
            </p>
          </div>
          <div className="grid h-11 w-11 place-items-center rounded-2xl bg-[#D96A24]/10 text-[#C95320]">
            <Camera className="h-5 w-5" />
          </div>
        </div>
      </Card>

      {photos.length === 0 ? (
        <Card className="p-6" hover={false}>
          <div className="flex items-start gap-3">
            <Images className="mt-0.5 h-5 w-5 shrink-0 text-[#5F6338]" />
            <div>
              <p className="font-semibold text-[#171717]">Фотографии пока не опубликованы</p>
              <p className="mt-1 text-sm leading-6 text-black/45">
                Когда администратор OPEN STARS добавит фотосессию и ссылку на галерею, она появится здесь автоматически.
              </p>
            </div>
          </div>
        </Card>
      ) : (
        <div className="space-y-3">
          {photos.map((session: any) => (
            <Card key={session.id} className="overflow-hidden p-0" hover={false}>
              <div className="relative p-5 sm:p-6">
                <div className="absolute bottom-0 left-0 top-0 w-[3px] bg-[#D96A24]" />

                <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
                  <div className="grid h-14 w-14 shrink-0 place-items-center rounded-[18px] bg-[#D96A24] text-white shadow-[0_7px_18px_rgba(217,106,36,0.20)]">
                    <Camera className="h-7 w-7" strokeWidth={2} />
                  </div>

                  <div className="min-w-0 flex-1">
                    <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-black/40">
                      Опубликованная съёмка
                    </p>
                    <h3 className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-[#171717]">
                      {session.title}
                    </h3>
                    {session.date && (
                      <p className="mt-2 text-xs text-black/40">Опубликовано {session.date}</p>
                    )}
                    {session.description && (
                      <p className="mt-4 max-w-3xl text-sm leading-7 text-black/55">
                        {session.description}
                      </p>
                    )}

                    {session.galleryUrl || session.url ? (
                      <a
                        href={session.galleryUrl || session.url}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-5 inline-flex items-center gap-2 rounded-[15px] bg-[#171717] px-4 py-3 text-sm font-semibold text-white shadow-[0_7px_18px_rgba(0,0,0,0.12)] transition hover:bg-[#262626]"
                      >
                        Открыть фотографии
                        <ExternalLink className="h-4 w-4 text-[#E8752A]" />
                      </a>
                    ) : (
                      <div className="mt-5 inline-flex items-center gap-2 rounded-[15px] bg-black/[0.04] px-4 py-3 text-sm font-medium text-black/40">
                        <Bell className="h-4 w-4" />
                        Ссылка ещё не добавлена
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
