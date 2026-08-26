import {
  Bell,
  CalendarDays,
  Camera,
  ExternalLink,
  Images,
} from "lucide-react";

import { Card } from "@/components/Card";

const currentPhotoSession = {
  title: "Съёмка портфолио",
  month: "Август 2026",
  uploadedAt: "26 августа 2026",
  description:
    "Новые фотографии со съёмки уже загружены. Ссылка обновляется после каждой новой фотосессии OPEN STARS.",
  photosUrl: "#",
  isNew: true,
};

export function PhotosTab() {
  const handleOpenPhotos = () => {
    if (
      currentPhotoSession.photosUrl === "#"
    ) {
      return;
    }

    window.open(
      currentPhotoSession.photosUrl,
      "_blank",
      "noopener,noreferrer"
    );
  };

  return (
    <div className="space-y-5">
      {/* Заголовок */}
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
              Здесь всегда находится актуальная
              съёмка и ссылка на фотографии.
            </p>
          </div>

          {currentPhotoSession.isNew && (
            <div
              className="
                inline-flex
                items-center
                gap-2
                rounded-full
                bg-[#D96A24]/10
                px-3.5
                py-2
                text-xs
                font-semibold
                text-[#C95320]
              "
            >
              <Bell
                className="h-4 w-4"
                strokeWidth={2}
              />

              Новые фото
            </div>
          )}
        </div>
      </Card>

      {/* Актуальная съёмка */}
      <Card
        className="overflow-hidden p-0"
        hover={false}
      >
        <div className="relative p-5 sm:p-6">
          <div className="absolute bottom-0 left-0 top-0 w-[3px] bg-[#D96A24]" />

          <div className="flex flex-col gap-6 sm:flex-row sm:items-start">
            <div
              className="
                grid
                h-14
                w-14
                shrink-0
                place-items-center
                rounded-[18px]
                bg-[#D96A24]
                text-white
                shadow-[0_7px_18px_rgba(217,106,36,0.20)]
              "
            >
              <Camera
                className="h-7 w-7"
                strokeWidth={2}
              />
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-black/40">
                    Актуальная съёмка
                  </p>

                  <h3 className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-[#171717]">
                    {currentPhotoSession.title}
                  </h3>

                  <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-black/40">
                    <div className="flex items-center gap-1.5">
                      <CalendarDays
                        className="h-3.5 w-3.5"
                        strokeWidth={1.8}
                      />

                      {currentPhotoSession.month}
                    </div>

                    <div className="flex items-center gap-1.5">
                      <Images
                        className="h-3.5 w-3.5"
                        strokeWidth={1.8}
                      />

                      Загружено{" "}
                      {
                        currentPhotoSession.uploadedAt
                      }
                    </div>
                  </div>
                </div>

                {currentPhotoSession.isNew && (
                  <span
                    className="
                      rounded-full
                      bg-[#5F6338]/10
                      px-3
                      py-1.5
                      text-[11px]
                      font-semibold
                      text-[#4D512E]
                    "
                  >
                    Фото обновлены
                  </span>
                )}
              </div>

              <p className="mt-5 max-w-3xl text-sm leading-7 text-black/55">
                {
                  currentPhotoSession.description
                }
              </p>

              <button
                type="button"
                onClick={handleOpenPhotos}
                className="
                  mt-5
                  inline-flex
                  items-center
                  gap-2
                  rounded-[15px]
                  bg-[#171717]
                  px-4
                  py-3
                  text-sm
                  font-semibold
                  text-white
                  shadow-[0_7px_18px_rgba(0,0,0,0.12)]
                  transition
                  hover:bg-[#262626]
                "
              >
                Открыть фотографии

                <ExternalLink
                  className="h-4 w-4 text-[#E8752A]"
                  strokeWidth={2}
                />
              </button>
            </div>
          </div>
        </div>
      </Card>

      {/* Как работает раздел */}
      <div
        className="
          flex
          items-start
          gap-3
          rounded-[20px]
          border
          border-[#5F6338]/10
          bg-[#5F6338]/[0.055]
          px-4
          py-4
        "
      >
        <Bell
          className="mt-0.5 h-5 w-5 shrink-0 text-[#5F6338]"
          strokeWidth={2}
        />

        <p className="text-xs leading-relaxed text-black/50">
          После каждой новой съёмки
          администратор меняет название
          фотосессии и обновляет одну
          постоянную ссылку на фотографии.
          Родителям приходит уведомление о
          загрузке новых фото.
        </p>
      </div>
    </div>
  );
}