export function Logo() {
  return (
    <div className="inline-flex flex-col">
      <div
        className="
          text-[27px]
          font-bold
          leading-none
          tracking-[-0.04em]
          text-[#171717]
          sm:text-[30px]
        "
      >
        OPEN STARS
      </div>

      <div className="mt-1.5 h-[2px] w-full bg-[#171717]" />

      <div
        className="
          mt-1.5
          text-[9px]
          font-semibold
          uppercase
          tracking-[0.32em]
          text-[#171717]
          sm:text-[10px]
        "
      >
        Модельная школа
      </div>
    </div>
  );
}