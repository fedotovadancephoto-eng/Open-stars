import { Coins, TrendingUp, CalendarDays, BookOpen } from 'lucide-react';
import { Card } from '@/components/Card';
import { quickStats } from '@/data/demoData';

interface OverviewCardsProps {
  onTabSelect: (tab: string) => void;
}

export function OverviewCards({ onTabSelect }: OverviewCardsProps) {
  const cards = [
    {
      label: 'Coins',
      value: quickStats.coins,
      icon: Coins,
      accent: 'orange',
      tab: 'coins',
      sublabel: 'earned',
    },
    {
      label: 'Progress',
      value: `${quickStats.progress}%`,
      icon: TrendingUp,
      accent: 'olive',
      tab: 'progress',
      sublabel: 'overall',
    },
    {
      label: 'Upcoming',
      value: quickStats.upcomingClasses,
      icon: CalendarDays,
      accent: 'orange',
      tab: 'schedule',
      sublabel: 'this week',
    },
    {
      label: 'Homework',
      value: quickStats.homeworkPending,
      icon: BookOpen,
      accent: 'olive',
      tab: 'homework',
      sublabel: 'pending',
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
      {cards.map((c, i) => {
        const isOrange = c.accent === 'orange';
        const Icon = c.icon;
        return (
          <button
            key={c.label}
            onClick={() => onTabSelect(c.tab)}
            className="group text-left animate-fade-up"
            style={{ animationDelay: `${i * 0.05}s` }}
          >
            <Card className="p-4 sm:p-5">
              <div className="flex items-center justify-between">
                <div
                  className={`grid h-10 w-10 place-items-center rounded-2xl ${
                    isOrange ? 'bg-orange-100 text-orange-600' : 'bg-olive-100 text-olive-700'
                  }`}
                >
                  <Icon className="h-5 w-5" />
                </div>
                <span
                  className={`text-xs font-bold uppercase tracking-wide ${
                    isOrange ? 'text-orange-500' : 'text-olive-500'
                  } opacity-0 transition-opacity group-hover:opacity-100`}
                >
                  View →
                </span>
              </div>
              <p className="mt-3 font-display text-2xl font-700 text-ink sm:text-3xl">
                {c.value}
              </p>
              <p className="mt-0.5 text-sm font-semibold text-ink-soft">{c.label}</p>
              <p className="text-xs text-ink-muted">{c.sublabel}</p>
            </Card>
          </button>
        );
      })}
    </div>
  );
}
