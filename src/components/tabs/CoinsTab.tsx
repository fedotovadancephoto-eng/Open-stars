import {
  Award,
  CalendarCheck,
  Camera,
  Car,
  Check,
  Gift,
  Plus,
  Sparkles,
  Star,
  Trophy,
  UserPlus,
} from "lucide-react";

import { Card } from "@/components/Card";
import { coinHistory, coins, starCoinRules } from "@/data/demoData";

const ruleIcons = {
  grade_5: Star,
  grade_4: Check,
  attendance_present: CalendarCheck,
} as const;

const extraActivities = [
  { id: "show", title: "Участие в показах", icon: Trophy },
  { id: "shoot", title: "Рекламные и творческие съёмки", icon: Camera },
  { id: "event", title: "Выездные мероприятия", icon: Car },
  { id: "friend", title: "Приведи друга", icon: UserPlus },
  { id: "school-life", title: "Активность в жизни школы", icon: Sparkles },
];

function sourceLabel(source: string) {
  if (source === "grade") return "оценка";
  if (source === "attendance") return "посещение";
  if (source === "birthday") return "день рождения";
  if (source === "manual") return "команда OPEN STARS";
  return source || "OPEN STARS";
}

export function CoinsTab() {
  const activeRules = starCoinRules.filter((rule) => rule.active && rule.amount > 0);

  return (
    <div className="grid gap-5 lg:grid-cols-[0.9fr_1.6fr] lg:gap-6">
      <div className="space-y-5">
        <Card className="overflow-hidden p-0">
          <div className="p-5 sm:p-6">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-black/40">STAR COIN</p>
                <h3 className="mt-1 text-xl font-semibold tracking-[-0.025em] text-[#171717]">Баланс</h3>
              </div>
              <div className="inline-flex shrink-0 items-center gap-1 rounded-full bg-[#D96A24]/12 px-2.5 py-1 text-[11px] font-semibold text-[#C95320]">
                <Plus className="h-3 w-3" strokeWidth={2.3} />
                {coins.earnedThisMonth} в этом месяце
              </div>
            </div>

            <div className="mt-5 rounded-[22px] border border-black/[0.06] bg-[#FAF9F5] p-5">
              <div className="flex items-center gap-4">
                <div className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-[#D96A24]/10 text-[#C95320]"><Star className="h-6 w-6" strokeWidth={2.2} /></div>
                <div><p className="text-4xl font-semibold tracking-[-0.045em] text-[#171717]">{coins.balance}</p><p className="mt-1 text-sm font-medium text-black/45">Star Coin</p></div>
              </div>
            </div>

            <div className="mt-6">
              <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-black/40">Последние операции</p>
              {coinHistory.length === 0 ? (
                <div className="mt-3 rounded-[18px] bg-black/[0.025] px-4 py-5 text-sm text-black/45">История появится после первой операции со Star Coin.</div>
              ) : (
                <div className="mt-3 divide-y divide-black/[0.06]">
                  {coinHistory.slice(0, 10).map((item: any) => (
                    <div key={item.id} className="flex items-center justify-between gap-4 py-3.5">
                      <div className="flex min-w-0 items-center gap-3">
                        <div className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg ${Number(item.amount) >= 0 ? "bg-[#5F6338]/10 text-[#4D512E]" : "bg-red-50 text-red-600"}`}>
                          <Plus className={`h-4 w-4 ${Number(item.amount) < 0 ? "rotate-45" : ""}`} strokeWidth={2.2} />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold leading-snug text-[#171717]">{item.title}</p>
                          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-black/40"><span>{item.date}</span><span>· {sourceLabel(item.source)}</span></div>
                        </div>
                      </div>
                      <span className={`shrink-0 text-base font-bold ${Number(item.amount) >= 0 ? "text-[#C95320]" : "text-red-600"}`}>{Number(item.amount) >= 0 ? "+" : ""}{item.amount}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </Card>

        <div className="rounded-[20px] border border-black/[0.06] bg-white px-4 py-4">
          <div className="flex items-start gap-3"><Award className="mt-0.5 h-5 w-5 shrink-0 text-[#5F6338]" strokeWidth={2} /><p className="text-xs leading-relaxed text-black/45">Баланс считается по истории операций. Если педагог исправляет или удаляет оценку/посещение, связанное начисление пересчитывается автоматически.</p></div>
        </div>
      </div>

      <Card className="p-5 sm:p-6">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.20em] text-black/40">Система поощрений</p>
          <h3 className="mt-1 text-xl font-semibold tracking-[-0.025em] text-[#171717]">Как получить Star Coin</h3>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-black/45">Автоматические правила ниже загружаются из действующих настроек OPEN STARS — поэтому сумма в кабинете всегда совпадает с фактическим начислением.</p>
        </div>

        <div className="mt-7">
          <div className="flex items-center gap-3"><span className="h-px w-7 bg-[#D96A24]" /><p className="text-[11px] font-bold uppercase tracking-[0.18em] text-black/45">Автоматически</p></div>
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            {activeRules.map((rule, index) => {
              const Icon = ruleIcons[rule.code as keyof typeof ruleIcons] || Star;
              const orange = index % 2 === 0;
              return (
                <div key={rule.code} className="rounded-[20px] border border-black/[0.06] bg-white p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${orange ? "bg-[#D96A24]/10 text-[#C95320]" : "bg-[#5F6338]/10 text-[#4D512E]"}`}><Icon className="h-5 w-5" strokeWidth={2.1} /></div>
                    <span className={`shrink-0 text-base font-bold ${orange ? "text-[#C95320]" : "text-[#4D512E]"}`}>+{rule.amount}</span>
                  </div>
                  <p className="mt-4 text-sm font-semibold leading-snug text-[#171717]">{rule.title}</p>
                  <p className="mt-1 text-xs leading-relaxed text-black/40">Начисляется системой автоматически</p>
                </div>
              );
            })}
            <div className="rounded-[20px] border border-[#D96A24]/15 bg-[#D96A24]/[0.045] p-4">
              <div className="flex items-start justify-between gap-3"><div className="grid h-10 w-10 place-items-center rounded-xl bg-[#D96A24]/10 text-[#C95320]"><Gift className="h-5 w-5" /></div><span className="text-base font-bold text-[#C95320]">+10</span></div>
              <p className="mt-4 text-sm font-semibold text-[#171717]">Подарок ко дню рождения</p>
              <p className="mt-1 text-xs leading-relaxed text-black/40">Один раз в год, автоматически в день рождения</p>
            </div>
          </div>
        </div>

        <div className="mt-7">
          <div className="flex items-center gap-3"><span className="h-px w-7 bg-[#5F6338]" /><p className="text-[11px] font-bold uppercase tracking-[0.18em] text-black/45">Дополнительные активности</p></div>
          <p className="mt-3 text-xs leading-5 text-black/40">За эти активности команда OPEN STARS может начислить дополнительный бонус. Размер зависит от конкретного события и всегда виден в истории операций.</p>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {extraActivities.map((item, index) => {
              const Icon = item.icon;
              const orange = index % 2 === 0;
              return <div key={item.id} className="flex min-h-[70px] items-center gap-3 rounded-[18px] border border-black/[0.06] bg-white px-4 py-3"><div className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${orange ? "bg-[#D96A24]/10 text-[#C95320]" : "bg-[#5F6338]/10 text-[#4D512E]"}`}><Icon className="h-5 w-5" strokeWidth={2.1} /></div><p className="text-sm font-semibold leading-snug text-[#171717]">{item.title}</p></div>;
            })}
          </div>
        </div>
      </Card>
    </div>
  );
}
