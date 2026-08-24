interface LogoProps {
  className?: string;
  showText?: boolean;
}

export function Logo({ className = '', showText = true }: LogoProps) {
  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      <svg viewBox="0 0 48 48" className="h-9 w-9 shrink-0" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="24" cy="24" r="23" fill="#F97316" />
        <circle cx="24" cy="24" r="23" stroke="#1A1A1A" strokeWidth="1.5" />
        <path
          d="M24 9.5L27.8 19.2L38 20.0L30.2 26.8L32.6 36.8L24 31.4L15.4 36.8L17.8 26.8L10 20.0L20.2 19.2L24 9.5Z"
          fill="white"
          stroke="#1A1A1A"
          strokeWidth="1.2"
          strokeLinejoin="round"
        />
      </svg>
      {showText && (
        <div className="leading-none">
          <p className="font-display text-lg font-700 tracking-tight text-ink">
            OPEN STARS
          </p>
          <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-[0.15em] text-olive-600">
            Model Academy
          </p>
        </div>
      )}
    </div>
  );
}
