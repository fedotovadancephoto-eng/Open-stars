import { Coins, Plus } from 'lucide-react';
import { Card } from '@/components/Card';
import { Badge } from '@/components/Badge';
import { coins, coinReasons } from '@/data/demoData';

export function CoinsTab() {
  return (
    <div className="grid gap-5 lg:grid-cols-5 lg:gap-6">
      <div className="lg:col-span-2">
        <Card className="overflow-hidden p-5 sm:p-6">
          <div className="flex items-center justify-between">
            <h3 className="font-display text-lg font-700 text-ink">Coin Balance</h3>
            <Badge variant="orange">
              <Plus className="h-3 w-3" /> +{coins.earnedThisMonth} this month
            </Badge>
          </div>

          <div className="mt-4 flex items-center gap-4 rounded-3xl bg-gradient-to-br from-orange-50 to-olive-50 p-5">
            <div className="relative grid h-16 w-16 shrink-0 place-items-center rounded-full bg-gradient-to-br from-orange-400 to-orange-600 text-white shadow-card">
              <Coins className="h-8 w-8" />
              <span className="absolute -bottom-1 -right-1 rounded-full bg-white px-1.5 py-0.5 text-[10px] font-bold text-orange-600 shadow-badge">
                ✦
              </span>
            </div>
            <div>
              <p className="font-display text-4xl font-700 tracking-tight text-ink">
                {coins.balance}
              </p>
              <p className="text-sm font-medium text-ink-muted">coins earned</p>
            </div>
          </div>

          <div className="mt-5">
            <p className="mb-2.5 text-xs font-bold uppercase tracking-wide text-ink-muted">
              Recent Earnings
            </p>
            <div className="space-y-2">
              {coins.history.map((h) => (
                <div
                  key={h.label}
                  className="flex items-center justify-between rounded-2xl bg-neutral-50 px-3.5 py-2.5"
                >
                  <div className="flex items-center gap-2.5">
                    <div className="grid h-8 w-8 place-items-center rounded-full bg-orange-100 text-orange-600">
                      <Coins className="h-4 w-4" />
                    </div>
                    <div className="leading-tight">
                      <p className="text-sm font-semibold text-ink-soft">{h.label}</p>
                      <p className="text-[11px] text-ink-muted">{h.date}</p>
                    </div>
                  </div>
                  <span className="text-sm font-bold text-orange-600">+{h.amount}</span>
                </div>
              ))}
            </div>
          </div>
        </Card>
      </div>

      <div className="lg:col-span-3">
        <Card className="p-5 sm:p-6">
          <h3 className="font-display text-lg font-700 text-ink">How Coins Are Earned</h3>
          <p className="mt-0.5 text-sm text-ink-muted">
            Students collect coins by showing positive habits in and out of class.
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {coinReasons.map((r) => (
              <div
                key={r.label}
                className="group flex items-start gap-3 rounded-2xl border border-neutral-100 p-3.5 transition-all hover:-translate-y-0.5 hover:border-orange-200 hover:bg-orange-50"
              >
                <span className="text-2xl transition-transform group-hover:scale-110 group-hover:animate-wiggle">
                  {r.icon}
                </span>
                <div>
                  <p className="text-sm font-bold text-ink">{r.label}</p>
                  <p className="text-xs text-ink-muted">{r.description}</p>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
