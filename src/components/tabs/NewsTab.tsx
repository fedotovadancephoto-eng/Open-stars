import { Calendar, Megaphone, Bell, Clock } from 'lucide-react';
import { Card } from '@/components/Card';
import { Badge } from '@/components/Badge';
import { news } from '@/data/demoData';

const tagConfig = {
  event: { icon: Calendar, label: 'Event', badge: 'orange' as const, bg: 'bg-orange-100 text-orange-600' },
  reminder: { icon: Bell, label: 'Reminder', badge: 'olive' as const, bg: 'bg-olive-100 text-olive-700' },
  announcement: { icon: Megaphone, label: 'Announcement', badge: 'neutral' as const, bg: 'bg-neutral-200 text-ink' },
};

export function NewsTab() {
  return (
    <div className="space-y-4">
      {news.map((n) => {
        const config = tagConfig[n.tag as keyof typeof tagConfig];
        const Icon = config.icon;
        return (
          <Card key={n.id} className="p-5 sm:p-6">
            <div className="flex items-start gap-4">
              <div className={`grid h-11 w-11 shrink-0 place-items-center rounded-2xl ${config.bg}`}>
                <Icon className="h-5 w-5" />
              </div>
              <div className="flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant={config.badge}>{config.label}</Badge>
                  <span className="flex items-center gap-1 text-xs font-medium text-ink-muted">
                    <Clock className="h-3 w-3" /> {n.date}
                  </span>
                </div>
                <h4 className="mt-2 font-display text-lg font-700 text-ink">{n.title}</h4>
                <p className="mt-1 text-sm leading-relaxed text-ink-soft">{n.body}</p>
              </div>
            </div>
          </Card>
        );
      })}
    </div>
  );
}
