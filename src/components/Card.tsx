import type { ReactNode } from 'react';

interface CardProps {
  children: ReactNode;
  className?: string;
  hover?: boolean;
}

export function Card({ children, className = '', hover = true }: CardProps) {
  return (
    <div
      className={`rounded-4xl border border-neutral-100 bg-white shadow-card transition-all duration-300 ${
        hover ? 'hover:shadow-cardHover hover:-translate-y-0.5' : ''
      } ${className}`}
    >
      {children}
    </div>
  );
}
