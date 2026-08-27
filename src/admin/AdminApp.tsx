import { useEffect, useMemo, useState } from "react";
import {
  Award,
  BookOpenCheck,
  CalendarDays,
  Camera,
  ChevronRight,
  Coins,
  CreditCard,
  LayoutDashboard,
  LoaderCircle,
  LogOut,
  Newspaper,
  Pencil,
  Save,
  Search,
  Settings,
  ShieldCheck,
  UserRound,
  UsersRound,
  X,
} from "lucide-react";

import { AdminFeedbackInbox } from "@/admin/AdminFeedbackInbox";
import {
  AdminChild,
  ChildUpdateInput,
  StaffIdentity,
  StaffRole,
  clearStaffSession,
  fetchAdminChildren,
  fetchStaffIdentity,
  getValidStaffSession,
  updateAdminChild,
  updateParentDisplayName,
} from "@/admin/adminApi";
import { administratorForBranch } from "@/admin/branchAdministrators";
import { StaffAuth } from "@/admin/StaffAuth";
import { Logo } from "@/components/Logo";

type AdminState = "checking" | "guest" | "loading" | "ready" | "error";
type SectionId = "students" | "schedule" | "study" | "coins" | "news" | "payments" | "photos" | "team";

const roleLabels: Record<StaffRole, string> = {
  owner: "Директор",
  admin: "Администратор",
  manager: "Управляющий",
  teacher: "Преподаватель",
};

const activationLabels: Record<AdminChild["activationStatus"], string> = {
  active: "Активирован",
  invited: "Приглашение выдано",
  not_invited: "Нет активации",
};

const paymentLabels: Record<string, string> = {
  paid: "Оплачено",
  pending: "Не оплачено",
  overdue: "Просрочено",
};

const branchOptions = ["Свердловский", "НЛО", "Октябрьский"] as const;
const groupOptions = ["Базовый", "Продвинутый", "PRO"] as const;

const navItems = [
  { id: "students" as SectionId, label: "Ученики", icon: UsersRound, roles: ["owner", "admin", "manager", "teacher"] },
  { id: "schedule" as SectionId, label: "Расписание", icon: CalendarDays, roles: ["owner", "admin", "manager", "teacher"] },
  { id: "study" as SectionId, label: "Учебная часть", icon: BookOpenCheck, roles: ["owner", "admin", "manager", "teacher"] },
  { id: "coins" as SectionId, label: "Star Coin", icon: Coins, roles: ["owner", "admin", "manager"] },
  { id: "news" as SectionId, label: "Новости", icon: Newspaper, roles: ["owner", "admin", "manager"] },
  { id: "payments" as SectionId, label: "Оплата", icon: CreditCard, roles: ["owner", "admin", "manager"] },
  { id: "photos" as SectionId, label: "Фотосессии", icon: Camera, roles: ["owner", "admin", "manager"] },
  { id: "team" as SectionId, label: "Сотрудники", icon: ShieldCheck, roles: ["owner"] },
];

const inputClass = "mt-1.5 w-full rounded-[13px] border border-black/[0.08] bg-[#FAF9F5] px-3.5 py-3 text-sm text-[#171717] outline-none placeholder:text-black/25 focus:border-[#D96A24]/45 focus:ring-4 focus:ring-[#D96A24]/[0.06]";

function LoadingScreen() {
  return (
    <div className="grid min-h-screen place-items-center bg-[#FAF9F5]">
      <div className="text-center"><Logo /><p className="mt-5 text-xs font-bold uppercase tracking-[0.2em] text-black/35">Загрузка админ-панели</p></div>
    </div>
  );
}

function initials(child: AdminChild) {
  return `${child.firstName.charAt(0)}${child.lastName.charAt(0)}`.toUpperCase() || "OS";
}

function StudentDetails({ child, role, onClose, onSaved }: { child: AdminChild; role: StaffRole; onClose: () => void; onSaved: (childId: string) => Promise<void> }) {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [parentName, setParentName] = useState(child.parentName);
  const [form, setForm] = useState<ChildUpdateInput>({
    firstName: child.firstName,
    lastName: child.lastName,
    birthDate: child.birthDate,
    groupName: child.groupName,
    branch: child.branch,
    lessonDay: child.lessonDay,
    lessonTime: child.lessonTime,
    administratorName: child.administratorName || administratorForBranch(child.branch),
    photoUrl: child.photoUrl,
  });

  useEffect(() => {
    setParentName(child.parentName);
    setForm({
      firstName: child.firstName,
      lastName: child.lastName,
      birthDate: child.birthDate,
      groupName: child.groupName,
      branch: child.branch,
      lessonDay: child.lessonDay,
      lessonTime: child.lessonTime,
      administratorName: child.administratorName || administratorForBranch(child.branch),
      photoUrl: child.photoUrl,
    });
  }, [child]);

  function field<K extends keyof ChildUpdateInput>(key: K, value: ChildUpdateInput[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function chooseBranch(branch: string) {
    setForm((current) => ({ ...current, branch, administratorName: administratorForBranch(branch) }));
  }

  async function saveChanges() {
    setSaving(true);
    setError("");
    try {
      await updateAdminChild(child.id, { ...form, administratorName: administratorForBranch(form.branch) });
      if (child.parentProfileId && parentName.trim() !== child.parentName.trim()) {
        await updateParentDisplayName(child.parentProfileId, parentName);
      }
      await onSaved(child.id);
      setEditing(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось сохранить изменения.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/25 backdrop-blur-[2px]" onClick={onClose}>
      <div className="h-full w-full max-w-md overflow-y-auto bg-[#FAF9F5] p-5 shadow-[-20px_0_50px_rgba(0,0,0,0.12)] sm:p-7" onClick={(event) => event.stopPropagation()}>
        <div className="flex items-start justify-between gap-3">
          <div><p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#D96A24]">Карточка ученика</p><h2 className="mt-1 text-2xl font-semibold tracking-[-0.03em] text-[#171717]">{child.fullName}</h2></div>
          <div className="flex gap-2">
            {role !== "teacher" && !editing && <button type="button" onClick={() => setEditing(true)} className="grid h-10 w-10 place-items-center rounded-full bg-[#171717] text-white shadow-sm" aria-label="Редактировать"><Pencil size={17} /></button>}
            <button type="button" onClick={onClose} className="grid h-10 w-10 place-items-center rounded-full bg-white text-black/55 shadow-sm" aria-label="Закрыть"><X size={20} /></button>
          </div>
        </div>

        {editing ? (
          <div className="mt-6 space-y-4">
            <div className="rounded-[24px] border border-black/[0.06] bg-white p-5">
              <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-black/35">Основные данные</p>
              <div className="mt-4 grid grid-cols-2 gap-3">
                <label className="text-xs font-semibold text-black/55">Имя<input className={inputClass} value={form.firstName} onChange={(e) => field("firstName", e.target.value)} /></label>
                <label className="text-xs font-semibold text-black/55">Фамилия<input className={inputClass} value={form.lastName} onChange={(e) => field("lastName", e.target.value)} /></label>
              </div>
              <label className="mt-3 block text-xs font-semibold text-black/55">Дата рождения<input type="date" className={inputClass} value={form.birthDate} onChange={(e) => field("birthDate", e.target.value)} /></label>
              <label className="mt-3 block text-xs font-semibold text-black/55">Фото — ссылка<input className={inputClass} value={form.photoUrl} onChange={(e) => field("photoUrl", e.target.value)} placeholder="https://..." /></label>
            </div>

            <div className="rounded-[24px] border border-black/[0.06] bg-white p-5">
              <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-black/35">Обучение</p>
              <label className="mt-4 block text-xs font-semibold text-black/55">Группа<select className={inputClass} value={form.groupName} onChange={(e) => field("groupName", e.target.value)}><option value="">Выберите группу</option>{groupOptions.map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
              <label className="mt-3 block text-xs font-semibold text-black/55">Филиал<select className={inputClass} value={form.branch} onChange={(e) => chooseBranch(e.target.value)}><option value="">Выберите филиал</option>{branchOptions.map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
              <div className="mt-3 grid grid-cols-2 gap-3">
                <label className="text-xs font-semibold text-black/55">День<input className={inputClass} value={form.lessonDay} onChange={(e) => field("lessonDay", e.target.value)} placeholder="Суббота" /></label>
                <label className="text-xs font-semibold text-black/55">Начало группы<input type="time" className={inputClass} value={form.lessonTime} onChange={(e) => field("lessonTime", e.target.value)} /></label>
              </div>
              <label className="mt-3 block text-xs font-semibold text-black/55">Администратор<input className={`${inputClass} cursor-not-allowed bg-[#F0EEE5]`} value={form.administratorName} readOnly placeholder="Подставится после выбора филиала" /></label>
              <p className="mt-2 text-[11px] leading-5 text-black/35">Администратор закреплён за филиалом и подставляется автоматически.</p>
            </div>

            {role !== "teacher" && (
              <div className="rounded-[24px] border border-black/[0.06] bg-white p-5">
                <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-black/35">Родитель</p>
                <label className="mt-4 block text-xs font-semibold text-black/55">Как отображать имя<input className={inputClass} value={parentName} onChange={(e) => setParentName(e.target.value)} /></label>
                <label className="mt-3 block text-xs font-semibold text-black/55">Телефон<input className={`${inputClass} cursor-not-allowed opacity-60`} value={child.parentPhone} readOnly /></label>
                <p className="mt-2 text-[11px] leading-5 text-black/35">Номер связан со входом в аккаунт. Его смена будет отдельным защищённым действием.</p>
              </div>
            )}

            {error && <div className="rounded-[16px] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
            <div className="flex gap-3 pb-6">
              <button type="button" onClick={() => setEditing(false)} disabled={saving} className="flex-1 rounded-[14px] border border-black/[0.08] bg-white px-4 py-3.5 text-sm font-semibold text-black/60">Отмена</button>
              <button type="button" onClick={saveChanges} disabled={saving} className="flex flex-1 items-center justify-center gap-2 rounded-[14px] bg-[#171717] px-4 py-3.5 text-sm font-semibold text-white disabled:opacity-50">{saving ? <LoaderCircle className="animate-spin" size={17} /> : <Save size={17} />} Сохранить</button>
            </div>
          </div>
        ) : (
          <>
            <div className="mt-6 rounded-[26px] border border-black/[0.06] bg-white p-5 shadow-[0_12px_35px_rgba(0,0,0,0.05)]">
              <div className="flex items-center gap-4">
                {child.photoUrl ? <img src={child.photoUrl} alt={child.fullName} className="h-20 w-20 rounded-[22px] object-cover" /> : <div className="grid h-20 w-20 place-items-center rounded-[22px] bg-[#F0EEE5] text-xl font-bold text-[#5F6338]">{initials(child)}</div>}
                <div><p className="text-lg font-semibold text-[#171717]">{child.groupName || "Группа не указана"}</p><p className="mt-1 text-sm text-black/45">{child.branch || "Филиал не указан"}</p><p className="mt-1 text-sm text-black/45">{[child.lessonDay, child.lessonTime].filter(Boolean).join(" · ") || "Время занятий не указано"}</p>{child.birthDate && <p className="mt-1 text-sm text-black/45">Дата рождения: {child.birthDate}</p>}</div>
              </div>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <div className="rounded-[20px] border border-black/[0.06] bg-white p-4"><p className="text-xs text-black/40">Star Coin</p><p className="mt-1 text-2xl font-semibold text-[#171717]">{child.coins}</p></div>
              <div className="rounded-[20px] border border-black/[0.06] bg-white p-4"><p className="text-xs text-black/40">Оплата</p><p className="mt-1 text-sm font-semibold text-[#171717]">{paymentLabels[child.paymentStatus] || "Статус не указан"}</p></div>
            </div>
            {(child.administratorName || administratorForBranch(child.branch)) && <div className="mt-4 rounded-[24px] border border-black/[0.06] bg-white p-5"><p className="text-[11px] font-bold uppercase tracking-[0.18em] text-black/35">Администратор</p><p className="mt-3 font-semibold text-[#171717]">{child.administratorName || administratorForBranch(child.branch)}</p></div>}
            {role !== "teacher" && <div className="mt-4 rounded-[24px] border border-black/[0.06] bg-white p-5"><p className="text-[11px] font-bold uppercase tracking-[0.18em] text-black/35">Родитель</p><p className="mt-3 font-semibold text-[#171717]">{child.parentName || "Не указан"}</p><p className="mt-1 text-sm text-black/45">{child.parentPhone || "Телефон не указан"}</p><div className="mt-4 inline-flex rounded-full bg-[#5F6338]/10 px-3 py-1.5 text-xs font-semibold text-[#4D512E]">{activationLabels[child.activationStatus]}</div></div>}
          </>
        )}
      </div>
    </div>
  );
}

export default function AdminApp() {
  const [state, setState] = useState<AdminState>("checking");
  const [identity, setIdentity] = useState<StaffIdentity | null>(null);
  const [children, setChildren] = useState<AdminChild[]>([]);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [selectedChild, setSelectedChild] = useState<AdminChild | null>(null);
  const [activeSection, setActiveSection] = useState<SectionId>("students");

  async function load() {
    setError("");
    const session = await getValidStaffSession();
    if (!session) { setState("guest"); return; }
    setState("loading");
    try {
      const staff = await fetchStaffIdentity();
      const childRows = await fetchAdminChildren(staff.role);
      setIdentity(staff);
      setChildren(childRows);
      setState("ready");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось загрузить админ-панель.");
      setState("error");
    }
  }

  useEffect(() => { load(); }, []);

  const filteredChildren = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return children;
    return children.filter((child) => [child.fullName, child.groupName, child.branch, child.parentName, child.parentPhone].join(" ").toLowerCase().includes(normalized));
  }, [children, query]);

  if (state === "checking" || state === "loading") return <LoadingScreen />;
  if (state === "guest") return <StaffAuth onSuccess={load} />;
  if (state === "error" || !identity) {
    return <div className="grid min-h-screen place-items-center bg-[#FAF9F5] px-5"><div className="w-full max-w-md rounded-[26px] bg-white p-6 text-center shadow-sm"><h2 className="text-xl font-semibold text-[#171717]">Не удалось открыть админ-панель</h2><p className="mt-3 text-sm leading-6 text-black/45">{error}</p><button type="button" onClick={() => { clearStaffSession(); setState("guest"); }} className="mt-5 rounded-[14px] bg-[#171717] px-5 py-3 text-sm font-semibold text-white">Войти снова</button></div></div>;
  }

  const role = identity.role;
  const staffName = identity.profile.staff_display_name?.trim() || (role === "owner" ? "Директор" : identity.profile.full_name?.trim() || roleLabels[role]);
  const visibleNav = navItems.filter((item) => item.roles.includes(role));
  const groupsCount = new Set(children.map((child) => child.groupName).filter(Boolean)).size;
  const activeParents = children.filter((child) => child.activationStatus === "active").length;

  async function handleChildSaved(childId: string) {
    const rows = await fetchAdminChildren(role);
    setChildren(rows);
    setSelectedChild(rows.find((item) => item.id === childId) || null);
  }

  return (
    <div className="min-h-screen bg-[#F6F5F1] text-[#171717] lg:flex">
      <aside className="border-b border-black/[0.06] bg-[#171717] text-white lg:sticky lg:top-0 lg:h-screen lg:w-[260px] lg:border-b-0 lg:border-r lg:border-white/10">
        <div className="flex h-full flex-col p-4 lg:p-5">
          <div className="rounded-[20px] bg-white p-4 text-[#171717]"><Logo /></div>
          <div className="mt-5 hidden lg:block"><p className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/35">Админ-панель</p><p className="mt-1 text-sm font-semibold">{staffName}</p><p className="mt-0.5 text-xs text-white/45">{roleLabels[role]}</p></div>
          <nav className="mt-4 flex gap-2 overflow-x-auto pb-1 lg:mt-7 lg:block lg:space-y-1 lg:overflow-visible">
            {visibleNav.map((item) => {
              const Icon = item.icon;
              const enabled = item.id === "students";
              const active = activeSection === item.id;
              return <button key={item.id} type="button" disabled={!enabled} onClick={() => enabled && setActiveSection(item.id)} className={`flex shrink-0 items-center gap-3 rounded-[14px] px-3 py-2.5 text-sm font-semibold transition lg:w-full ${active ? "bg-white text-[#171717]" : enabled ? "text-white/70 hover:bg-white/[0.07]" : "cursor-default text-white/25"}`}><Icon size={18} /><span>{item.label}</span>{!enabled && <span className="ml-auto hidden text-[9px] uppercase tracking-wider text-white/20 lg:inline">скоро</span>}</button>;
            })}
          </nav>
          <button type="button" onClick={() => { clearStaffSession(); setState("guest"); }} className="mt-auto hidden items-center gap-3 rounded-[14px] px-3 py-2.5 text-sm font-semibold text-white/55 transition hover:bg-white/[0.07] hover:text-white lg:flex"><LogOut size={18} /> Выйти</button>
        </div>
      </aside>

      <main className="min-w-0 flex-1">
        <header className="sticky top-0 z-20 border-b border-black/[0.06] bg-[#F6F5F1]/90 px-5 py-4 backdrop-blur-xl sm:px-7 lg:px-9">
          <div className="mx-auto flex max-w-7xl items-center justify-between gap-4">
            <div><p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#D96A24]">OPEN STARS ADMIN</p><h1 className="mt-1 text-xl font-semibold tracking-[-0.025em] sm:text-2xl">Ученики и родители</h1></div>
            <div className="flex items-center gap-2"><div className="hidden rounded-full border border-black/[0.06] bg-white px-3 py-2 text-xs font-semibold text-black/55 sm:block">{roleLabels[role]}</div><button type="button" aria-label="Настройки" className="grid h-10 w-10 place-items-center rounded-full bg-white text-black/55 shadow-sm"><Settings size={18} /></button></div>
          </div>
        </header>

        <div className="mx-auto max-w-7xl px-5 py-6 sm:px-7 lg:px-9 lg:py-8">
          <section className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-[22px] border border-black/[0.05] bg-white p-5 shadow-[0_8px_30px_rgba(0,0,0,0.035)]"><div className="grid h-10 w-10 place-items-center rounded-[14px] bg-[#D96A24]/10 text-[#C95320]"><UsersRound size={20} /></div><p className="mt-5 text-3xl font-semibold tracking-[-0.04em]">{children.length}</p><p className="mt-1 text-sm text-black/40">учеников доступно</p></div>
            <div className="rounded-[22px] border border-black/[0.05] bg-white p-5 shadow-[0_8px_30px_rgba(0,0,0,0.035)]"><div className="grid h-10 w-10 place-items-center rounded-[14px] bg-[#5F6338]/10 text-[#4D512E]"><LayoutDashboard size={20} /></div><p className="mt-5 text-3xl font-semibold tracking-[-0.04em]">{groupsCount}</p><p className="mt-1 text-sm text-black/40">групп</p></div>
            <div className="rounded-[22px] border border-black/[0.05] bg-white p-5 shadow-[0_8px_30px_rgba(0,0,0,0.035)]"><div className="grid h-10 w-10 place-items-center rounded-[14px] bg-[#D96A24]/10 text-[#C95320]"><UserRound size={20} /></div><p className="mt-5 text-3xl font-semibold tracking-[-0.04em]">{role === "teacher" ? "—" : activeParents}</p><p className="mt-1 text-sm text-black/40">активных родителей</p></div>
          </section>

          <section className="mt-6 rounded-[26px] border border-black/[0.05] bg-white p-4 shadow-[0_10px_35px_rgba(0,0,0,0.035)] sm:p-5">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div><p className="text-[11px] font-bold uppercase tracking-[0.18em] text-black/35">База школы</p><h2 className="mt-1 text-xl font-semibold tracking-[-0.025em]">Список учеников</h2></div>
              <div className="relative w-full sm:max-w-sm"><Search className="absolute left-3.5 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-black/30" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Имя, группа, филиал, родитель..." className="w-full rounded-[14px] border border-black/[0.07] bg-[#FAF9F5] py-3 pl-11 pr-4 text-sm outline-none placeholder:text-black/25 focus:border-[#D96A24]/40 focus:ring-4 focus:ring-[#D96A24]/[0.06]" /></div>
            </div>
            <div className="mt-5 space-y-2">
              {filteredChildren.length === 0 ? <div className="rounded-[20px] bg-[#FAF9F5] px-5 py-10 text-center text-sm text-black/40">Ученики не найдены.</div> : filteredChildren.map((child) => (
                <button key={child.id} type="button" onClick={() => setSelectedChild(child)} className="flex w-full items-center gap-3 rounded-[18px] border border-black/[0.055] px-3.5 py-3 text-left transition hover:border-[#D96A24]/20 hover:bg-[#FAF9F5] sm:gap-4 sm:px-4">
                  {child.photoUrl ? <img src={child.photoUrl} alt={child.fullName} className="h-12 w-12 shrink-0 rounded-[15px] object-cover" /> : <div className="grid h-12 w-12 shrink-0 place-items-center rounded-[15px] bg-[#F0EEE5] text-sm font-bold text-[#5F6338]">{initials(child)}</div>}
                  <div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-x-2 gap-y-1"><p className="truncate font-semibold text-[#171717]">{child.fullName}</p>{child.groupName && <span className="rounded-full bg-[#5F6338]/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[#4D512E]">{child.groupName}</span>}</div><p className="mt-1 truncate text-xs text-black/40">{[child.branch, child.lessonDay, child.lessonTime].filter(Boolean).join(" · ") || "Данные группы не заполнены"}</p>{role !== "teacher" && <p className="mt-1 truncate text-xs text-black/35">{child.parentName || child.parentPhone || activationLabels[child.activationStatus]}</p>}</div>
                  <ChevronRight className="h-5 w-5 shrink-0 text-black/20" />
                </button>
              ))}
            </div>
          </section>

          {role !== "teacher" && <AdminFeedbackInbox />}

          <div className="mt-5 flex items-center gap-2 text-xs text-black/30"><Award size={15} /> Карточка ученика: филиал и группа выбираются из фиксированных списков.</div>
        </div>
      </main>

      {selectedChild && <StudentDetails child={selectedChild} role={role} onClose={() => setSelectedChild(null)} onSaved={handleChildSaved} />}
    </div>
  );
}
