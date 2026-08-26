import {
  Building2,
  Clock3,
  Sparkles,
  Star,
  UserRound,
} from "lucide-react";

import { Card } from "@/components/Card";
import { child } from "@/data/demoData";

function valueOrFallback(value: string | undefined, fallback: string) {
  return value && value.trim() ? value : fallback;
}

export function ProfileCard() {
  const branch = valueOrFallback(child.branch, "Филиал не указан");
  const lessonDay = valueOrFallback(child.lessonDay, "День уточняется");
  const lessonTime = valueOrFallback(child.lessonTime, "");
  const administrator = valueOrFallback(
    child.administrator || child.mentorName,
    "Администратор не указан"
  );
  const group = valueOrFallback(child.groupName || child.group, "OPEN STARS");

  const initials = [child.firstName, child.lastName]
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase())
    .join("")
    .slice(0, 2) || "OS";

  return (
    <Card className="relative overflow-hidden rounded-[28px] border border-black/[0.055] bg-white p-0 shadow-[0_12px_34px_rgba(0,0,0,0.055)]">
      <div className="absolute inset-x-0 top-0 h-[8px] bg-gradient-to-r from-[#D96A24] via-[#E8752A] to-[#8B8735]" />

      <div className="p-5 pt-7 sm:p-7 sm:pt-8">
        <div className="grid gap-6 md:grid-cols-[170px_1fr_auto] md:items-start">
          <div className="relative h-[170px] overflow-hidden rounded-[24px] border border-black/[0.06] bg-[#F5F3EC] shadow-[0_8px_22px_rgba(0,0,0,0.05)]">
            {child.photo ? (
              <img
                src={child.photo}
                alt={child.name || "Ученик OPEN STARS"}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="grid h-full w-full place-items-center bg-gradient-to-br from-[#F8F5ED] to-[#E3E0D1]">
                <div className="text-center">
                  <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-white/80 text-xl font-bold text-[#171717] shadow-sm">
                    {initials}
                  </div>
                  <div className="mt-3 flex items-center justify-center gap-1.5 text-xs font-medium text-black/40">
                    <UserRound className="h-3.5 w-3.5" />
                    Фото пока не загружено
                  </div>
                </div>
              </div>
            )}

            <div className="absolute bottom-4 right-4 grid h-10 w-10 place-items-center rounded-full bg-[#5F6338] text-white shadow-[0_6px_14px_rgba(0,0,0,0.16)]">
              <Star className="h-5 w-5" strokeWidth={2.2} />
            </div>
          </div>

          <div className="min-w-0">
            <div className="inline-flex items-center rounded-full bg-[#5F6338] px-3 py-1 text-[11px] font-bold uppercase tracking-[0.08em] text-white">
              {group}
            </div>

            <h2 className="mt-4 text-2xl font-semibold tracking-[-0.03em] text-[#171717]">
              {child.name || "Ученик OPEN STARS"}
            </h2>

            <div className="mt-5 space-y-4">
              <div className="flex items-start gap-3">
                <Building2 className="mt-0.5 h-5 w-5 shrink-0 text-[#5F6338]" strokeWidth={2} />
                <div>
                  <p className="text-xs text-black/40">Филиал</p>
                  <p className="mt-0.5 text-[16px] font-semibold text-[#171717]">
                    {branch}
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <Clock3 className="mt-0.5 h-5 w-5 shrink-0 text-[#5F6338]" strokeWidth={2} />
                <div>
                  <p className="text-xs text-black/40">Время занятий</p>
                  <p className="mt-0.5 text-[16px] font-semibold text-[#171717]">
                    {lessonDay}{lessonTime ? ` ${lessonTime}` : ""}
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="hidden items-center gap-2 pt-1 text-sm font-medium text-black/60 md:flex">
            <Sparkles className="h-4 w-4 text-[#D96A24]" strokeWidth={2} />
            <span>В центре внимания</span>
          </div>
        </div>

        <div className="mt-6 flex min-h-[58px] items-center rounded-[18px] bg-gradient-to-r from-[#D56722] via-[#E57B27] to-[#D99A2D] px-5 text-white shadow-[0_8px_20px_rgba(217,106,36,0.18)]">
          <span className="text-sm text-white/80 sm:text-base">Администратор:</span>
          <span className="ml-2 text-sm font-semibold sm:text-base">
            {administrator}
          </span>
        </div>
      </div>
    </Card>
  );
}
