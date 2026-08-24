import { CheckCircle2, Clock, Circle, BookOpen } from 'lucide-react';
import { Card } from '@/components/Card';
import { Badge } from '@/components/Badge';
import { homework } from '@/data/demoData';

const statusConfig = {
  new: {
    icon: Circle,
    label: 'New',
    badge: 'orange' as const,
    bg: 'bg-orange-100 text-orange-600',
  },
  'in-progress': {
    icon: Clock,
    label: 'In Progress',
    badge: 'olive' as const,
    bg: 'bg-olive-100 text-olive-700',
  },
  completed: {
    icon: CheckCircle2,
    label: 'Completed',
    badge: 'success' as const,
    bg: 'bg-olive-100 text-olive-800',
  },
};

export function HomeworkTab() {
  return (
    <Card className="p-5 sm:p-6" hover={false}>
      <div className="flex items-center justify-between">
        <h3 className="font-display text-lg font-700 text-ink">Homework Assignments</h3>
        <Badge variant="soft">
          <BookOpen className="h-3 w-3" /> {homework.length} total
        </Badge>
      </div>

      <div className="mt-4 space-y-3">
        {homework.map((hw) => {
          const config = statusConfig[hw.status as keyof typeof statusConfig];
          const StatusIcon = config.icon;
          return (
            <div
              key={hw.id}
              className="group flex flex-col gap-3 rounded-3xl border border-neutral-100 p-4 transition-all hover:border-neutral-200 hover:bg-neutral-50 sm:flex-row sm:items-center"
            >
              <div className={`grid h-11 w-11 shrink-0 place-items-center rounded-2xl ${config.bg}`}>
                <StatusIcon className="h-5 w-5" />
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-bold text-ink">{hw.title}</p>
                  <Badge variant={config.badge} className="shrink-0">
                    {config.label}
                  </Badge>
                </div>
                <p className="mt-1 text-sm text-ink-muted">{hw.description}</p>
                <div className="mt-2 flex items-center gap-3 text-xs font-medium text-ink-muted">
                  <span className="rounded-md bg-neutral-100 px-2 py-0.5 text-ink-soft">
                    {hw.subject}
                  </span>
                  <span>Due: {hw.dueDate}</span>
                </div>
              </div>

              {hw.status !== 'completed' && (
                <button className="shrink-0 rounded-full bg-ink px-4 py-2 text-xs font-bold text-white transition-transform hover:scale-105 active:scale-95">
                  {hw.status === 'new' ? 'Start' : 'Continue'}
                </button>
              )}
            </div>
          );
        })}
      </div>
    </Card>
  );
}
