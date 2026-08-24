import { Clock, MapPin, User } from 'lucide-react';
import { Card } from '@/components/Card';
import { Badge } from '@/components/Badge';
import { upcomingClasses } from '@/data/demoData';

export function ScheduleTab() {
  return (
    <Card className="p-5 sm:p-6" hover={false}>
      <div className="flex items-center justify-between">
        <h3 className="font-display text-lg font-700 text-ink">Upcoming Lessons</h3>
        <button className="text-sm font-bold text-orange-600 transition-colors hover:text-orange-700">
          View calendar
        </button>
      </div>

      <div className="mt-4 space-y-3">
        {upcomingClasses.map((c) => {
          const isOrange = c.color === 'orange';
          return (
            <div
              key={c.title + c.date}
              className="group flex items-center gap-4 rounded-3xl border border-neutral-100 p-3 transition-all hover:border-neutral-200 hover:bg-neutral-50"
            >
              <div
                className="flex shrink-0 flex-col items-center justify-center rounded-2xl px-3 py-2.5 text-white shadow-badge"
                style={{
                  background: isOrange
                    ? 'linear-gradient(135deg, #FB923C, #EA580C)'
                    : 'linear-gradient(135deg, #C2BB55, #847F28)',
                }}
              >
                <span className="text-sm font-700 leading-none">{c.day}</span>
                <span className="mt-0.5 text-[11px] font-medium opacity-90">{c.date}</span>
              </div>

              <div className="flex flex-1 flex-col gap-1 min-w-0">
                <p className="truncate text-sm font-bold text-ink">{c.title}</p>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-ink-muted">
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3" /> {c.time} · {c.duration}
                  </span>
                  <span className="flex items-center gap-1">
                    <User className="h-3 w-3" /> {c.instructor}
                  </span>
                  <span className="flex items-center gap-1">
                    <MapPin className="h-3 w-3" /> {c.room}
                  </span>
                </div>
              </div>

              <Badge variant={isOrange ? 'orange' : 'olive'} className="shrink-0">
                {c.time.includes('PM') ? 'Evening' : 'Morning'}
              </Badge>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
