import type { ReactNode } from 'react';

interface BadgeProps {
  children: ReactNode;
  variant?: 'orange' | 'olive' | 'neutral' | 'soft' | 'success';
  className?: string;
}

const variants: Record<NonNullable<BadgeProps['variant']>, string> = {
  orange: 'bg-orange-100 text-orange-700 border-orange-200',
  olive: 'bg-olive-100 text-olive-700 border-olive-200',
  neutral: 'bg-ink text-white border-ink',
  soft: 'bg-neutral-100 text-ink-soft border-neutral-200',
  success: 'bg-olive-100 text-olive-800 border-olive-300',
};

export function Badge({ children, variant = 'soft', className = '' }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-bold shadow-badge ${variants[variant]} ${className}`}
    >
      {children}
    </span>
  );
}
