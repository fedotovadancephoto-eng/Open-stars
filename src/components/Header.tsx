import { Bell, Menu } from 'lucide-react';
import { Logo } from '@/components/Logo';

export function Header() {
  return (
    <header className="sticky top-0 z-30 border-b border-neutral-200 bg-white/85 backdrop-blur-xl">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-3.5 sm:px-6">
        <div className="flex items-center gap-2.5">
          <button className="grid h-9 w-9 place-items-center rounded-full text-ink-soft transition-colors hover:bg-neutral-100 lg:hidden">
            <Menu className="h-5 w-5" />
          </button>
          <Logo />
        </div>

        <div className="flex items-center gap-2">
          <button className="relative grid h-9 w-9 place-items-center rounded-full text-ink-soft transition-colors hover:bg-neutral-100">
            <Bell className="h-5 w-5" />
            <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-orange-500 ring-2 ring-white" />
          </button>
          <div className="flex items-center gap-2 rounded-full border border-neutral-200 py-1 pl-1 pr-3.5">
            <img
              src="https://images.pexels.com/photos/29311763/pexels-photo-29311763.jpeg?auto=compress&cs=tinysrgb&h=120&w=120"
              alt="Mia"
              className="h-7 w-7 rounded-full object-cover"
            />
            <span className="hidden text-sm font-bold text-ink sm:inline">Mia</span>
          </div>
        </div>
      </div>
    </header>
  );
}
