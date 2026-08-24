import { Award, Calendar, MapPin } from 'lucide-react';
import { Card } from '@/components/Card';
import { Badge } from '@/components/Badge';
import { child } from '@/data/demoData';

export function ProfileCard() {
  return (
    <Card className="overflow-hidden" hover={false}>
      <div className="relative h-24 bg-gradient-to-r from-orange-500 via-orange-600 to-olive-600">
        <div
          className="absolute inset-0 opacity-15"
          style={{
            backgroundImage:
              'radial-gradient(circle at 15% 50%, white 1.5px, transparent 1.5px), radial-gradient(circle at 75% 30%, white 1.5px, transparent 1.5px)',
            backgroundSize: '28px 28px',
          }}
        />
      </div>
      <div className="px-5 pb-5 sm:px-6">
        <div className="-mt-14 flex flex-col gap-4 sm:flex-row sm:items-end">
          <div className="relative shrink-0">
            <img
              src={child.photo}
              alt={child.name}
              className="h-28 w-28 rounded-3xl border-4 border-white object-cover shadow-card"
            />
            <div className="absolute -bottom-1 -right-1 grid h-8 w-8 place-items-center rounded-full border-2 border-white bg-olive-500 text-white shadow-badge">
              <Award className="h-4 w-4" />
            </div>
          </div>
          <div className="flex flex-1 flex-col gap-2 pb-1 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="font-display text-2xl font-700 tracking-tight text-ink">
                {child.name}
              </h2>
              <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm font-medium text-ink-muted">
                <span className="text-ink-soft">{child.age} years old</span>
                <span className="h-1 w-1 rounded-full bg-neutral-400" />
                <span>{child.group}</span>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge variant="orange">
                <Award className="h-3 w-3" /> {child.streak} week streak
              </Badge>
              <Badge variant="olive">
                <Calendar className="h-3 w-3" /> Since {child.enrolledSince}
              </Badge>
            </div>
          </div>
        </div>

        <div className="mt-4 flex items-center gap-2.5 rounded-2xl bg-neutral-50 px-4 py-3 text-sm">
          <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-olive-100 text-olive-700">
            <MapPin className="h-4 w-4" />
          </div>
          <p className="text-ink-soft">
            Mentor <span className="font-bold text-ink">{child.mentor}</span> · Main Campus, Studio A
          </p>
        </div>
      </div>
    </Card>
  );
}
