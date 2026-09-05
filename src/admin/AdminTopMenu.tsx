import { useEffect, useMemo, useState } from "react";
import {
  Archive,
  BookOpenCheck,
  CalendarDays,
  Camera,
  Coins,
  CreditCard,
  FileCheck2,
  FileSpreadsheet,
  ImagePlus,
  KeyRound,
  Menu,
  MessageSquareHeart,
  Newspaper,
  ReceiptText,
  ShieldCheck,
  Target,
  UserPlus,
  WalletCards,
  X,
} from "lucide-react";

import { fetchStaffIdentity, StaffRole } from "@/admin/adminApi";
import { AdminSection, openAdminSection } from "@/admin/adminNavigation";
import { STAFF_VIEW_MODE_EVENT, STAFF_VIEW_MODE_KEY, StaffViewMode } from "@/admin/StaffModeSwitch";

const items: Array<{
  section: AdminSection;
  label: string;
  icon: typeof UserPlus;
  accent: "orange" | "olive" | "neutral";
  roles: StaffRole[];
  teacherVisible?: boolean;
}> = [
  { section: "business", label: "Бизнес", icon: WalletCards, accent: "orange", roles: ["owner"] },
  { section: "crm", label: "CRM · Продажи", icon: Target, accent: "orange", roles: ["owner", "project_director", "admin", "manager"] },
  { section: "crm-access", label: "Доступы CRM", icon: ShieldCheck, accent: "neutral", roles: ["owner", "project_director"] },
  { section: "expenses", label: "Расходы", icon: ReceiptText, accent: "olive", roles: ["owner", "project_director", "admin", "manager"] },
  { section: "documents", label: "Документы родителей", icon: FileCheck2, accent: "orange", roles: ["owner", "project_director", "admin", "manager"] },
  { section: "add-student", label: "Добавить ученика", icon: UserPlus, accent: "orange", roles: ["owner", "project_director", "admin", "manager"] },
  { section: "archive", label: "Выбывшие", icon: Archive, accent: "neutral", roles: ["owner", "project_director", "admin", "manager"] },
  { section: "parent-activation", label: "Доступ родителей", icon: KeyRound, accent: "orange", roles: ["owner", "project_director", "admin", "manager"] },
  { section: "child-photo", label: "Фото ребёнка", icon: ImagePlus, accent: "olive", roles: ["owner", "project_director", "admin", "manager"] },
  { section: "schedule", label: "Расписание", icon: CalendarDays, accent: "neutral", roles: ["owner", "project_director", "admin", "manager", "teacher"], teacherVisible: true },
  { section: "study", label: "Учебная часть", icon: BookOpenCheck, accent: "orange", roles: ["owner", "project_director", "admin", "manager", "teacher"], teacherVisible: true },
  { section: "reports", label: "Excel-отчёты", icon: FileSpreadsheet, accent: "olive", roles: ["owner", "project_director", "admin", "manager", "teacher"], teacherVisible: true },
  { section: "coins", label: "Star Coin", icon: Coins, accent: "olive", roles: ["owner", "project_director", "admin", "manager"] },
  { section: "news", label: "Новости", icon: Newspaper, accent: "neutral", roles: ["owner", "project_director", "admin", "manager"] },
  { section: "payments", label: "Оплата", icon: CreditCard, accent: "olive", roles: ["owner", "project_director", "admin", "manager"] },
  { section: "photos", label: "Фотосессии", icon: Camera, accent: "orange", roles: ["owner", "project_director", "admin", "manager"] },
  { section: "feedback", label: "Обратная связь", icon: MessageSquareHeart, accent: "olive", roles: ["owner", "project_director", "admin", "manager"] },
  { section: "team", label: "Сотрудники", icon: ShieldCheck, accent: "neutral", roles: ["owner", "project_director"] },
];

const accentClass = {
  orange: "bg-[#D96A24]/10 text-[#C95320]",
  olive: "bg-[#5F6338]/10 text-[#4D512E]",
  neutral: "bg-black/[0.055] text-[#171717]",
};

const legacyLabels = new Set([
  ...items.filter((item) => !["team", "reports", "expenses", "business", "documents", "crm", "crm-access"].includes(item.section)).map((item) => item.label),
  "Активация родителей",
  "Пароль родителя",
  "Зарплата педагогам",
]);

function normalize(value: string | null | undefined) {
  return (value || "").replace(/\s+/g, " ").trim();
}

export function AdminTopMenu() {
  const [open, setOpen] = useState(false);
  const [role, setRole] = useState<StaffRole | null>(null);
  const [staffMode, setStaffMode] = useState<StaffViewMode>(localStorage.getItem(STAFF_VIEW_MODE_KEY) === "teacher" ? "teacher" : "primary");

  useEffect(() => {
    let cancelled = false;
    let timer = 0;
    async function detect() {
      try {
        const identity = await fetchStaffIdentity();
        if (!cancelled) setRole(identity.role);
      } catch {
        if (!cancelled) timer = window.setTimeout(detect, 1200);
      }
    }
    void detect();
    return () => { cancelled = true; if (timer) window.clearTimeout(timer); };
  }, []);

  useEffect(() => {
    const handler = (event: Event) => {
      const detail = (event as CustomEvent<{ mode?: StaffViewMode }>).detail;
      setStaffMode(detail?.mode === "teacher" ? "teacher" : "primary");
      setOpen(false);
    };
    window.addEventListener(STAFF_VIEW_MODE_EVENT, handler);
    return () => window.removeEventListener(STAFF_VIEW_MODE_EVENT, handler);
  }, []);

  useEffect(() => {
    let raf = 0;
    const hideLegacyLaunchers = () => {
      window.cancelAnimationFrame(raf);
      raf = window.requestAnimationFrame(() => {
        document.querySelectorAll<HTMLButtonElement>("button").forEach((button) => {
          if (button.dataset.adminTopMenu === "true" || button.dataset.staffModeSwitch === "true") return;
          const className = typeof button.className === "string" ? button.className : "";
          if (!className.includes("fixed")) return;
          if (!legacyLabels.has(normalize(button.textContent))) return;
          button.dataset.adminLegacyMenuButton = "true";
          button.style.setProperty("display", "none", "important");
        });
      });
    };
    hideLegacyLaunchers();
    const observer = new MutationObserver(hideLegacyLaunchers);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => {
      observer.disconnect();
      window.cancelAnimationFrame(raf);
      document.querySelectorAll<HTMLElement>('[data-admin-legacy-menu-button="true"]').forEach((element) => {
        element.style.removeProperty("display");
        delete element.dataset.adminLegacyMenuButton;
      });
    };
  }, []);

  const teacherView = role === "teacher" || staffMode === "teacher";
  const visibleItems = useMemo(() => items.filter((item) => {
    if (!role || !item.roles.includes(role)) return false;
    if (teacherView) return Boolean(item.teacherVisible);
    return true;
  }), [role, teacherView]);

  if (!role || visibleItems.length === 0) return null;

  function openSection(section: AdminSection) {
    setOpen(false);
    openAdminSection(section);
  }

  return (
    <>
      {open && <button type="button" aria-label="Закрыть меню разделов" data-admin-top-menu="true" className="fixed inset-0 z-[64] cursor-default bg-black/10 backdrop-blur-[1px]" onClick={() => setOpen(false)} />}

      <div className="fixed right-4 z-[66] sm:right-6" style={{ top: "calc(env(safe-area-inset-top, 0px) + 5.6rem)" }}>
        <button type="button" data-admin-top-menu="true" aria-expanded={open} onClick={() => setOpen((value) => !value)} className="flex h-12 items-center gap-2 rounded-full border border-black/[0.06] bg-[#171717] px-4 text-sm font-semibold text-white shadow-[0_10px_30px_rgba(0,0,0,0.18)] active:scale-[0.98]">
          {open ? <X size={18} /> : <Menu size={18} />}{open ? "Закрыть" : "Разделы"}
        </button>
      </div>

      {open && (
        <div className="fixed left-4 right-4 z-[66] mx-auto max-h-[calc(100dvh-env(safe-area-inset-top,0px)-10rem)] max-w-xl overflow-y-auto overscroll-contain rounded-[24px] border border-black/[0.07] bg-white p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom,0px))] shadow-[0_22px_60px_rgba(0,0,0,0.20)] sm:left-auto sm:right-6 sm:max-h-[calc(100vh-11rem)] sm:w-[520px]" style={{ top: "calc(env(safe-area-inset-top, 0px) + 9.25rem)" }}>
          <div className="px-2 pb-2 pt-1"><p className="text-[10px] font-bold uppercase tracking-[0.19em] text-[#D96A24]">{teacherView ? "OPEN STARS · ПЕДАГОГ" : "OPEN STARS ADMIN"}</p><p className="mt-1 text-lg font-semibold tracking-[-0.02em] text-[#171717]">{teacherView ? "Рабочие разделы педагога" : "Быстрые действия"}</p></div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {visibleItems.map((item) => {
              const Icon = item.icon;
              return <button key={item.section} type="button" data-admin-top-menu="true" onClick={() => openSection(item.section)} className="flex min-h-[76px] items-center gap-3 rounded-[18px] border border-black/[0.05] bg-[#FAF9F5] p-3 text-left transition hover:bg-white active:scale-[0.99]"><span className={`grid h-10 w-10 shrink-0 place-items-center rounded-[13px] ${accentClass[item.accent]}`}><Icon size={19} strokeWidth={2.15} /></span><span className="text-[12px] font-semibold leading-tight text-[#171717]">{item.label}</span></button>;
            })}
          </div>
        </div>
      )}
    </>
  );
}
