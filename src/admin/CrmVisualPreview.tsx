import { AlertCircle, CalendarClock, ShieldCheck, Target, UserRoundPlus } from "lucide-react";
import { Logo } from "@/components/Logo";

const stages = [
  "Новый лид",
  "Связались",
  "Записан на пробное",
  "Пришёл",
  "Думает",
  "Ждём оплату",
  "Оплатил",
  "Стал учеником",
];

export default function CrmVisualPreview() {
  return (
    <div className="min-h-screen bg-[#F7F5EF] px-4 pb-16 pt-[calc(env(safe-area-inset-top,0px)+1rem)] sm:px-6">
      <div className="mx-auto max-w-5xl">
        <header className="rounded-[26px] border border-black/[0.06] bg-white p-5 shadow-sm sm:p-7">
          <div className="flex items-start justify-between gap-4">
            <div>
              <Logo />
              <p className="mt-6 text-[11px] font-bold uppercase tracking-[0.2em] text-[#D96A24]">OPEN STARS · CRM</p>
              <h1 className="mt-2 text-3xl font-semibold tracking-[-0.04em] text-[#171717]">Лиды и продажи</h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-black/45">Визуальный preview владельца. Рабочие данные не подключены, ничего в production не записывается.</p>
            </div>
            <span className="rounded-full bg-[#5F6338]/10 px-3 py-2 text-[10px] font-bold uppercase tracking-[0.14em] text-[#4D512E]">PREVIEW</span>
          </div>
        </header>

        <section className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            ["Требует внимания", "Просроченные контакты", AlertCircle],
            ["Сегодня", "Задачи и звонки", CalendarClock],
            ["Продажи", "Оплатили", Target],
            ["Новые ученики", "Оформлены из CRM", UserRoundPlus],
          ].map(([title, subtitle, Icon]) => (
            <div key={String(title)} className="rounded-[20px] border border-black/[0.055] bg-white p-4">
              <Icon size={19} className="text-[#D96A24]" />
              <p className="mt-3 text-sm font-semibold text-[#171717]">{String(title)}</p>
              <p className="mt-1 text-xs leading-5 text-black/40">{String(subtitle)}</p>
              <p className="mt-3 text-xl font-semibold text-black/25">—</p>
            </div>
          ))}
        </section>

        <section className="mt-4 rounded-[24px] border border-black/[0.055] bg-white p-5 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#D96A24]">Воронка</p>
              <h2 className="mt-1 text-xl font-semibold tracking-[-0.02em]">Путь клиента</h2>
            </div>
            <button disabled className="rounded-[14px] bg-[#171717] px-4 py-3 text-sm font-semibold text-white opacity-45">+ Новый лид</button>
          </div>
          <div className="mt-5 flex gap-2 overflow-x-auto pb-2">
            {stages.map((stage, index) => (
              <div key={stage} className="min-w-[145px] rounded-[16px] border border-black/[0.06] bg-[#FAF9F5] p-3">
                <span className="text-[10px] font-bold text-black/25">{index + 1}</span>
                <p className="mt-2 text-xs font-semibold leading-4 text-[#171717]">{stage}</p>
                <p className="mt-3 text-lg font-semibold text-black/20">—</p>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-4 grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
          <div className="rounded-[24px] border border-black/[0.055] bg-white p-5 sm:p-6">
            <div className="flex items-center justify-between gap-3">
              <div><p className="text-[11px] font-bold uppercase tracking-[0.18em] text-black/35">Лиды</p><h2 className="mt-1 text-lg font-semibold">Рабочий список</h2></div>
              <span className="rounded-full bg-[#FFF3E9] px-3 py-1.5 text-xs font-semibold text-[#C95320]">Все филиалы</span>
            </div>
            <div className="mt-5 rounded-[18px] bg-[#FAF9F5] px-5 py-8 text-center">
              <p className="text-sm font-semibold text-[#171717]">В preview реальные лиды не показываются</p>
              <p className="mt-2 text-xs leading-5 text-black/40">После запуска здесь будут ребёнок, родитель, телефон, источник, стадия, пробное, следующий контакт и ответственный.</p>
            </div>
          </div>

          <div className="rounded-[24px] border border-black/[0.055] bg-white p-5 sm:p-6">
            <div className="flex items-center gap-2"><ShieldCheck size={19} className="text-[#5F6338]"/><h2 className="text-lg font-semibold">Доступы CRM</h2></div>
            <p className="mt-3 text-sm leading-6 text-black/45">Владелец создаёт отдельные доступы сотрудникам продаж и маркетологу.</p>
            <div className="mt-4 space-y-2">
              <div className="rounded-[16px] bg-[#FAF9F5] p-4"><p className="text-sm font-semibold">Продажи</p><p className="mt-1 text-xs leading-5 text-black/40">Лиды, контакты, пробные, задачи, продажи. Без ДДС, зарплат и прибыли.</p></div>
              <div className="rounded-[16px] bg-[#FAF9F5] p-4"><p className="text-sm font-semibold">Маркетолог</p><p className="mt-1 text-xs leading-5 text-black/40">Только агрегированная аналитика каналов и конверсий. Без телефонов родителей и детских карточек.</p></div>
            </div>
            <button disabled className="mt-4 w-full rounded-[14px] bg-[#5F6338] py-3 text-sm font-semibold text-white opacity-45">Создать доступ</button>
          </div>
        </section>

        <section className="mt-4 rounded-[22px] border border-[#D96A24]/15 bg-[#FFF8F1] p-5">
          <p className="text-sm font-semibold text-[#8B431C]">Что будет автоматически</p>
          <p className="mt-2 text-xs leading-6 text-[#8B431C]/75">Защита дублей по телефону · следующий контакт и просроченные задачи · причины потери лида · «Оплатил → Оформить ученика» без повторного ввода родителя · перенос источника клиента в карточку ребёнка.</p>
        </section>
      </div>
    </div>
  );
}
