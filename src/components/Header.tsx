import { Bell, Menu } from "lucide-react";

import { Logo } from "@/components/Logo";
import { child } from "@/data/demoData";

export function Header() {
  const initials = [child.firstName, child.lastName]
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase())
    .join("")
    .slice(0, 2) || "OS";

  return (
    <header className="sticky top-0 z-30 border-b border-neutral-200 bg-white/90 backdrop-blur-xl">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-3.5 sm:px-6 lg:px-8">
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            aria-label="Меню"
            className="grid h-9 w-9 place-items-center rounded-full text-ink-soft transition-colors hover:bg-neutral-100 lg:hidden"
          >
            <Menu className="h-5 w-5" />
          </button>
          <Logo />
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            aria-label="Уведомления"
            className="relative grid h-9 w-9 place-items-center rounded-full text-ink-soft transition-colors hover:bg-neutral-100"
          >
            <Bell className="h-5 w-5" />
            <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-orange-500 ring-2 ring-white" />
          </button>

          <div className="flex items-center gap-2 rounded-full border border-neutral-200 p-1 sm:pr-3.5">
            {child.photo ? (
              <img
                src={child.photo}
                alt={child.name || "Ученик OPEN STARS"}
                className="h-8 w-8 rounded-full object-cover"
              />
            ) : (
              <div className="grid h-8 w-8 place-items-center rounded-full bg-[#F3F0E7] text-[11px] font-bold text-[#5F6338]">
                {initials}
              </div>
            )}

            <span className="hidden text-sm font-bold text-ink sm:inline">
              {child.firstName || "OPEN STARS"}
            </span>
          </div>
        </div>
      </div>
    </header>
  );
}
