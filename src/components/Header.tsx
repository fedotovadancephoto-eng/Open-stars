import { useEffect, useState } from "react";
import {
  Award,
  Bell,
  BookOpen,
  CalendarDays,
  Camera,
  Coins,
  CreditCard,
  LogOut,
  Menu,
  MessageCircle,
  Newspaper,
  TrendingUp,
  X,
} from "lucide-react";

import { Logo } from "@/components/Logo";
import { child } from "@/data/demoData";
import { ParentNotification, fetchParentNotifications, markParentNotificationRead } from "@/parentNotificationsApi";

type HeaderPanel = "menu" | "notifications" | "profile" | null;

interface HeaderProps {
  onNavigate?: (tab: string) => void;
  onLogout?: () => void;
}

const menuItems = [
  { id: "coins", label: "Star Coin", icon: Coins },
  { id: "progress", label: "Успеваемость", icon: TrendingUp },
  { id: "homework", label: "Домашние задания", icon: BookOpen },
  { id: "comments", label: "Комментарии", icon: MessageCircle },
  { id: "achievements", label: "Достижения", icon: Award },
  { id: "schedule", label: "Расписание", icon: CalendarDays },
  { id: "news", label: "Новости", icon: Newspaper },
  { id: "payments", label: "Оплата", icon: CreditCard },
  { id: "photos", label: "Фотосессии", icon: Camera },
];

function formatNotificationDate(value: string) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(date).replace(".", "");
}

export function Header({ onNavigate, onLogout }: HeaderProps) {
  const [panel, setPanel] = useState<HeaderPanel>(null);
  const [notifications, setNotifications] = useState<ParentNotification[]>([]);
  const [notificationsLoading, setNotificationsLoading] = useState(false);

  const initials = [child.firstName, child.lastName]
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase())
    .join("")
    .slice(0, 2) || "OS";

  async function refreshNotifications() {
    setNotificationsLoading(true);
    try { setNotifications(await fetchParentNotifications()); }
    catch { /* кабинет остаётся рабочим даже при временной ошибке уведомлений */ }
    finally { setNotificationsLoading(false); }
  }

  useEffect(() => { refreshNotifications(); }, []);

  const navigate = (tab: string) => {
    setPanel(null);
    onNavigate?.(tab);
  };

  const togglePanel = (next: Exclude<HeaderPanel, null>) => {
    setPanel((current) => {
      const value = current === next ? null : next;
      if (value === "notifications") window.setTimeout(refreshNotifications, 0);
      return value;
    });
  };

  async function openNotification(item: ParentNotification) {
    if (!item.isRead) {
      try {
        await markParentNotificationRead(item.id);
        setNotifications((current) => current.map((row) => row.id === item.id ? { ...row, isRead: true } : row));
      } catch {}
    }
    if (item.target === "news") navigate("news");
  }

  const unreadCount = notifications.filter((item) => !item.isRead).length;

  return (
    <header className="sticky top-0 z-30 border-b border-neutral-200 bg-white/95 backdrop-blur-xl">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-3.5 sm:px-6 lg:px-8">
        <div className="flex items-center gap-2.5">
          <button type="button" aria-label={panel === "menu" ? "Закрыть меню" : "Открыть меню"} aria-expanded={panel === "menu"} onClick={() => togglePanel("menu")} className="grid h-10 w-10 place-items-center rounded-full text-ink-soft transition-colors hover:bg-neutral-100 active:scale-95">
            {panel === "menu" ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
          <Logo />
        </div>

        <div className="flex items-center gap-2">
          <button type="button" aria-label={`Уведомления${unreadCount ? `: ${unreadCount} новых` : ""}`} aria-expanded={panel === "notifications"} onClick={() => togglePanel("notifications")} className="relative grid h-10 w-10 place-items-center rounded-full text-ink-soft transition-colors hover:bg-neutral-100 active:scale-95">
            <Bell className="h-5 w-5" />
            {unreadCount > 0 && <><span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-orange-500 ring-2 ring-white" />{unreadCount > 1 && <span className="absolute -right-1 -top-1 grid min-h-5 min-w-5 place-items-center rounded-full bg-[#D96A24] px-1 text-[10px] font-bold text-white">{unreadCount > 9 ? "9+" : unreadCount}</span>}</>}
          </button>

          <button type="button" aria-label="Профиль ребёнка" aria-expanded={panel === "profile"} onClick={() => togglePanel("profile")} className="flex items-center gap-2 rounded-full border border-neutral-200 p-1 transition-colors hover:bg-neutral-50 active:scale-[0.98] sm:pr-3.5">
            {child.photo ? <img src={child.photo} alt={child.name || "Ученик OPEN STARS"} className="h-8 w-8 rounded-full object-cover" /> : <div className="grid h-8 w-8 place-items-center rounded-full bg-[#F3F0E7] text-[11px] font-bold text-[#5F6338]">{initials}</div>}
            <span className="hidden text-sm font-bold text-ink sm:inline">{child.firstName || "OPEN STARS"}</span>
          </button>
        </div>
      </div>

      {panel === "menu" && (
        <div className="absolute left-4 right-4 top-[calc(100%+8px)] mx-auto max-w-xl rounded-[24px] border border-black/[0.06] bg-white p-3 shadow-[0_18px_50px_rgba(0,0,0,0.14)] sm:left-6 sm:right-auto sm:w-[420px]">
          <p className="px-2 pb-2 text-[11px] font-bold uppercase tracking-[0.18em] text-black/40">Разделы кабинета</p>
          <div className="grid grid-cols-2 gap-1.5">
            {menuItems.map((item) => { const Icon = item.icon; return <button key={item.id} type="button" onClick={() => navigate(item.id)} className="flex min-h-[54px] items-center gap-2.5 rounded-[16px] px-3 text-left text-sm font-semibold text-[#171717] transition-colors hover:bg-[#FAF9F5] active:bg-[#F2F0E9]"><Icon className="h-5 w-5 shrink-0 text-[#D96A24]" strokeWidth={2} /><span>{item.label}</span></button>; })}
          </div>
        </div>
      )}

      {panel === "notifications" && (
        <div className="absolute right-4 top-[calc(100%+8px)] max-h-[70vh] w-[min(380px,calc(100vw-32px))] overflow-y-auto rounded-[24px] border border-black/[0.06] bg-white p-5 shadow-[0_18px_50px_rgba(0,0,0,0.14)] sm:right-6">
          <div className="flex items-center gap-3"><div className="grid h-10 w-10 place-items-center rounded-full bg-[#D96A24]/10 text-[#C95320]"><Bell className="h-5 w-5" /></div><div><p className="font-semibold text-[#171717]">Уведомления</p><p className="text-xs text-black/40">{unreadCount ? `${unreadCount} непрочитанных` : "OPEN STARS"}</p></div></div>
          {notificationsLoading && notifications.length === 0 ? <div className="mt-4 rounded-[18px] bg-[#FAF9F5] px-4 py-5 text-center text-sm text-black/45">Загружаем...</div> : notifications.length === 0 ? <div className="mt-4 rounded-[18px] bg-[#FAF9F5] px-4 py-5 text-center text-sm text-black/45">Новых уведомлений пока нет.</div> : <div className="mt-4 space-y-2">{notifications.map((item) => <button key={item.id} type="button" onClick={() => openNotification(item)} className={`w-full rounded-[17px] border px-4 py-3 text-left transition ${item.isRead ? "border-black/[0.05] bg-white" : "border-[#D96A24]/20 bg-[#D96A24]/[0.055]"}`}><div className="flex items-start gap-2"><span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${item.isRead ? "bg-black/10" : "bg-[#D96A24]"}`} /><div className="min-w-0"><p className="text-sm font-semibold text-[#171717]">{item.title}</p>{item.body && <p className="mt-1 line-clamp-3 text-xs leading-5 text-black/45">{item.body}</p>}<p className="mt-1.5 text-[10px] text-black/30">{formatNotificationDate(item.createdAt)}</p></div></div></button>)}</div>}
        </div>
      )}

      {panel === "profile" && (
        <div className="absolute right-4 top-[calc(100%+8px)] w-[min(340px,calc(100vw-32px))] rounded-[24px] border border-black/[0.06] bg-white p-5 shadow-[0_18px_50px_rgba(0,0,0,0.14)] sm:right-6">
          <div className="flex items-center gap-3">{child.photo ? <img src={child.photo} alt={child.name || "Ученик OPEN STARS"} className="h-12 w-12 rounded-full object-cover" /> : <div className="grid h-12 w-12 place-items-center rounded-full bg-[#F3F0E7] text-sm font-bold text-[#5F6338]">{initials}</div>}<div className="min-w-0"><p className="truncate font-semibold text-[#171717]">{child.name || "Ученик OPEN STARS"}</p><p className="mt-0.5 text-xs text-black/40">{child.groupName || child.group || "OPEN STARS"}</p></div></div>
          <button type="button" onClick={() => { setPanel(null); onLogout?.(); }} className="mt-4 flex w-full items-center justify-center gap-2 rounded-[16px] bg-[#171717] px-4 py-3 text-sm font-semibold text-white transition-opacity hover:opacity-90 active:scale-[0.99]"><LogOut className="h-4 w-4" />Выйти из кабинета</button>
        </div>
      )}
    </header>
  );
}
