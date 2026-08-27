import { useEffect, useMemo, useState } from "react";
import {
  Archive,
  BookOpenCheck,
  CalendarDays,
  Camera,
  Coins,
  CreditCard,
  ImagePlus,
  KeyRound,
  Menu,
  MessageSquareHeart,
  Newspaper,
  UserPlus,
  X,
} from "lucide-react";

const items = [
  { label: "Добавить ученика", icon: UserPlus, accent: "orange" },
  { label: "Выбывшие", icon: Archive, accent: "neutral" },
  { label: "Активация родителей", icon: KeyRound, accent: "orange" },
  { label: "Фото ребёнка", icon: ImagePlus, accent: "olive" },
  { label: "Расписание", icon: CalendarDays, accent: "neutral" },
  { label: "Учебная часть", icon: BookOpenCheck, accent: "orange" },
  { label: "Star Coin", icon: Coins, accent: "olive" },
  { label: "Новости", icon: Newspaper, accent: "neutral" },
  { label: "Оплата", icon: CreditCard, accent: "olive" },
  { label: "Фотосессии", icon: Camera, accent: "orange" },
  { label: "Обратная связь", icon: MessageSquareHeart, accent: "olive" },
] as const;

type MenuLabel = (typeof items)[number]["label"];

const normalize = (value: string | null | undefined) =>
  (value || "").replace(/\s+/g, " ").trim();

function findLegacyButton(label: MenuLabel) {
  return Array.from(document.querySelectorAll<HTMLButtonElement>("button")).find((button) => {
    if (button.dataset.adminTopMenu === "true") return false;
    const className = typeof button.className === "string" ? button.className : "";
    if (!className.includes("fixed")) return false;
    return normalize(button.textContent).includes(label);
  });
}

const accentClass = {
  orange: "bg-[#D96A24]/10 text-[#C95320]",
  olive: "bg-[#5F6338]/10 text-[#4D512E]",
  neutral: "bg-black/[0.055] text-[#171717]",
};

export function AdminTopMenu() {
  const [open, setOpen] = useState(false);
  const [available, setAvailable] = useState<Set<MenuLabel>>(new Set());

  useEffect(() => {
    let raf = 0;

    const sync = () => {
      window.cancelAnimationFrame(raf);
      raf = window.requestAnimationFrame(() => {
        const next = new Set<MenuLabel>();
        for (const item of items) {
          const button = findLegacyButton(item.label);
          if (!button) continue;
          next.add(item.label);
          button.dataset.adminLegacyMenuButton = "true";
          button.style.setProperty("display", "none", "important");
        }
        setAvailable(next);
      });
    };

    sync();
    const observer = new MutationObserver(sync);
    observer.observe(document.body, { childList: true, subtree: true });

    return () => {
      observer.disconnect();
      window.cancelAnimationFrame(raf);
      document
        .querySelectorAll<HTMLButtonElement>('button[data-admin-legacy-menu-button="true"]')
        .forEach((button) => {
          button.style.removeProperty("display");
          delete button.dataset.adminLegacyMenuButton;
        });
    };
  }, []);

  const visibleItems = useMemo(
    () => items.filter((item) => available.has(item.label)),
    [available],
  );

  if (visibleItems.length === 0) return null;

  const openSection = (label: MenuLabel) => {
    setOpen(false);
    window.setTimeout(() => findLegacyButton(label)?.click(), 0);
  };

  return (
    <>
      {open && (
        <button
          type="button"
          aria-label="Закрыть меню разделов"
          data-admin-top-menu="true"
          className="fixed inset-0 z-[64] cursor-default bg-black/10 backdrop-blur-[1px]"
          onClick={() => setOpen(false)}
        />
      )}

      <div
        className="fixed right-4 z-[66] sm:right-6"
        style={{ top: "calc(env(safe-area-inset-top, 0px) + 5.6rem)" }}
      >
        <button
          type="button"
          data-admin-top-menu="true"
          aria-expanded={open}
          onClick={() => setOpen((value) => !value)}
          className="flex h-12 items-center gap-2 rounded-full border border-black/[0.06] bg-[#171717] px-4 text-sm font-semibold text-white shadow-[0_10px_30px_rgba(0,0,0,0.18)] active:scale-[0.98]"
        >
          {open ? <X size={18} /> : <Menu size={18} />}
          {open ? "Закрыть" : "Разделы"}
        </button>
      </div>

      {open && (
        <div
          className="fixed left-4 right-4 z-[66] mx-auto max-w-xl rounded-[24px] border border-black/[0.07] bg-white p-3 shadow-[0_22px_60px_rgba(0,0,0,0.20)] sm:left-auto sm:right-6 sm:w-[520px]"
          style={{ top: "calc(env(safe-area-inset-top, 0px) + 9.25rem)" }}
        >
          <div className="px-2 pb-2 pt-1">
            <p className="text-[10px] font-bold uppercase tracking-[0.19em] text-[#D96A24]">
              OPEN STARS ADMIN
            </p>
            <p className="mt-1 text-lg font-semibold tracking-[-0.02em] text-[#171717]">
              Разделы управления
            </p>
          </div>

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {visibleItems.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.label}
                  type="button"
                  data-admin-top-menu="true"
                  onClick={() => openSection(item.label)}
                  className="flex min-h-[76px] items-center gap-3 rounded-[18px] border border-black/[0.05] bg-[#FAF9F5] p-3 text-left transition hover:bg-white active:scale-[0.99]"
                >
                  <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-[13px] ${accentClass[item.accent]}`}>
                    <Icon size={19} strokeWidth={2.15} />
                  </span>
                  <span className="text-[12px] font-semibold leading-tight text-[#171717]">
                    {item.label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </>
  );
}
