import { useState } from 'react';
import type { ReactNode } from 'react';

interface Tab {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

interface TabsProps {
  tabs: Tab[];
  active: string;
  onChange: (id: string) => void;
  children: ReactNode;
}

export function Tabs({ tabs, active, onChange, children }: TabsProps) {
  const [indicatorStyle, setIndicatorStyle] = useState<Record<string, string>>({});

  const handleClick = (id: string, e: React.MouseEvent<HTMLButtonElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const parent = e.currentTarget.parentElement?.getBoundingClientRect();
    if (parent) {
      setIndicatorStyle({
        width: `${rect.width}px`,
        transform: `translateX(${rect.left - parent.left}px)`,
      });
    }
    onChange(id);
  };

  return (
    <div>
      <div className="relative flex gap-1 overflow-x-auto rounded-2xl border border-neutral-200 bg-neutral-50 p-1 scrollbar-hide">
        {tabs.map((t) => {
          const Icon = t.icon;
          const isActive = t.id === active;
          return (
            <button
              key={t.id}
              onClick={(e) => handleClick(t.id, e)}
              className={`relative z-10 flex shrink-0 items-center gap-2 rounded-xl px-3.5 py-2.5 text-sm font-bold transition-colors sm:px-4 ${
                isActive ? 'text-white' : 'text-ink-soft hover:text-ink'
              }`}
            >
              <Icon className="h-4 w-4" />
              <span className="whitespace-nowrap">{t.label}</span>
            </button>
          );
        })}
        <div
          className="absolute bottom-1 top-1 rounded-xl bg-ink transition-all duration-300 ease-out"
          style={{
            width: indicatorStyle.width || '0px',
            transform: indicatorStyle.transform || 'translateX(0)',
          }}
        />
      </div>
      <div className="mt-5">{children}</div>
    </div>
  );
}
