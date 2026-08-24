import { Zap } from 'lucide-react';
import { Card } from '@/components/Card';
import { Badge } from '@/components/Badge';
import { progress, attendance } from '@/data/demoData';

export function ProgressTab() {
  const xpPct = Math.round((progress.xp / progress.xpToNext) * 100);

  return (
    <div className="grid gap-5 lg:grid-cols-2 lg:gap-6">
      <Card className="p-5 sm:p-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-display text-lg font-700 text-ink">Learning Progress</h3>
            <p className="mt-0.5 text-sm text-ink-muted">
              Level {progress.level} · {progress.levelName}
            </p>
          </div>
          <Badge variant="olive">
            <Zap className="h-3 w-3" /> {progress.xp} XP
          </Badge>
        </div>

        <div className="mt-4">
          <div className="mb-1.5 flex items-center justify-between text-xs font-bold text-ink-muted">
            <span>Progress to Level {progress.level + 1}</span>
            <span>
              {progress.xp} / {progress.xpToNext} XP
            </span>
          </div>
          <div className="h-2.5 w-full overflow-hidden rounded-full bg-neutral-100">
            <div
              className="h-full rounded-full bg-gradient-to-r from-olive-400 to-olive-600 transition-all duration-1000"
              style={{ width: `${xpPct}%` }}
            />
          </div>
        </div>

        <div className="mt-5 space-y-3">
          {progress.skills.map((skill) => (
            <div key={skill.name}>
              <div className="mb-1 flex items-center justify-between text-sm">
                <span className="font-semibold text-ink-soft">{skill.name}</span>
                <span className="font-bold text-ink">{skill.mastery}%</span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-neutral-100">
                <div
                  className="h-full rounded-full bg-orange-500 transition-all duration-1000"
                  style={{ width: `${skill.mastery}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </Card>

      <div className="space-y-5 lg:space-y-6">
        <Card className="p-5 sm:p-6">
          <h3 className="font-display text-lg font-700 text-ink">Attendance Overview</h3>
          <div className="mt-4 flex items-center gap-5">
            <div className="relative shrink-0">
              <svg className="h-24 w-24 -rotate-90" viewBox="0 0 120 120">
                <circle cx="60" cy="60" r="52" fill="none" stroke="#F3F3F3" strokeWidth="10" />
                <circle
                  cx="60"
                  cy="60"
                  r="52"
                  fill="none"
                  stroke="#F97316"
                  strokeWidth="10"
                  strokeLinecap="round"
                  strokeDasharray={2 * Math.PI * 52}
                  strokeDashoffset={2 * Math.PI * 52 - (attendance.percentage / 100) * 2 * Math.PI * 52}
                  className="transition-all duration-1000 ease-out"
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="font-display text-2xl font-700 text-ink">
                  {attendance.percentage}%
                </span>
              </div>
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold text-ink">
                {attendance.attended} sessions attended
              </p>
              <p className="text-xs text-ink-muted">
                out of {attendance.total} scheduled
              </p>
              <div className="mt-3 flex items-end gap-1.5">
                {attendance.monthly.map((m) => (
                  <div key={m.label} className="flex flex-1 flex-col items-center gap-1">
                    <div className="flex h-12 w-full items-end justify-center">
                      <div
                        className="w-full max-w-6 rounded-t-md bg-gradient-to-t from-orange-200 to-orange-500 transition-all duration-700"
                        style={{ height: `${m.value}%` }}
                      />
                    </div>
                    <span className="text-[10px] font-medium text-ink-muted">{m.label}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </Card>

        <Card className="p-5 sm:p-6">
          <p className="mb-2.5 text-xs font-bold uppercase tracking-wide text-ink-muted">
            Recent Achievements
          </p>
          <div className="flex flex-wrap gap-2.5">
            {progress.achievements.map((a) => (
              <div
                key={a.label}
                className="group flex items-center gap-2 rounded-2xl border border-neutral-100 bg-neutral-50 px-3 py-2 transition-all hover:-translate-y-0.5 hover:bg-orange-50"
              >
                <span className="text-lg transition-transform group-hover:scale-110 group-hover:animate-wiggle">
                  {a.icon}
                </span>
                <div className="leading-tight">
                  <p className="text-sm font-bold text-ink">{a.label}</p>
                  <p className="text-[11px] text-ink-muted">{a.month} 2026</p>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
