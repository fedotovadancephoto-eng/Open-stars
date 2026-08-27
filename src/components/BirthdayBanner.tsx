import { useState } from "react";
import { Gift, Sparkles } from "lucide-react";

export function BirthdayBanner({ firstName, amount }: { firstName: string; amount: number }) {
  const [visible, setVisible] = useState(true);

  if (!visible) return null;

  return (
    <section className="mb-6 overflow-hidden rounded-[28px] border border-[#D96A24]/15 bg-gradient-to-br from-[#FFF8F1] via-white to-[#F4F1E5] p-5 shadow-[0_16px_45px_rgba(217,106,36,0.10)] sm:p-6">
      <div className="flex items-start gap-4">
        <div className="grid h-14 w-14 shrink-0 place-items-center rounded-[18px] bg-[#D96A24] text-white shadow-[0_10px_25px_rgba(217,106,36,0.25)]">
          <Gift size={27} strokeWidth={2.2} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 text-[#D96A24]"><Sparkles size={17} /><span className="text-[11px] font-bold uppercase tracking-[0.18em]">OPEN STARS поздравляет</span></div>
          <h2 className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-[#171717]">🎉 С днём рождения, {firstName}!</h2>
          <p className="mt-2 text-[15px] leading-6 text-black/55">🎁 Подарок уже ждёт тебя — <span className="font-semibold text-[#171717]">+{amount} Star Coin!</span></p>
          <p className="mt-1 text-[15px] leading-6 text-black/50">Пусть этот год будет ярким!</p>
          <button type="button" onClick={() => setVisible(false)} className="mt-4 rounded-[14px] bg-[#171717] px-5 py-3 text-sm font-semibold text-white shadow-sm active:scale-[0.99]">Спасибо! ✨</button>
        </div>
      </div>
    </section>
  );
}
