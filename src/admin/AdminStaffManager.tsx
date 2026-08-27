import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, Copy, KeyRound, LoaderCircle, RefreshCw, ShieldCheck, Trash2, UserPlus, X } from "lucide-react";

import { fetchStaffIdentity } from "@/admin/adminApi";
import { onAdminSection } from "@/admin/adminNavigation";
import {
  CreatedStaffInvite,
  StaffDirectoryRow,
  StaffInviteRow,
  createStaffInvite,
  fetchStaffDirectory,
  fetchStaffInvites,
  revokeStaffInvite,
} from "@/admin/staffManagementApi";

const branches = ["Свердловский", "НЛО", "Октябрьский"];
const subjects = ["Актёрское мастерство", "Дефиле и подиумный шаг", "Дефиле", "Мастер-класс", "Фотопозирование", "Хореография"];
const roleLabels: Record<string, string> = {
  owner: "Директор",
  project_director: "Директор по проекту",
  manager: "Управляющий",
  admin: "Администратор филиала",
  teacher: "Педагог",
};
const inputClass = "mt-1.5 w-full rounded-[13px] border border-black/[0.08] bg-white px-3.5 py-3 text-sm text-[#171717] outline-none focus:border-[#D96A24]/45 focus:ring-4 focus:ring-[#D96A24]/[0.06]";

function fmt(value: string) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("ru-RU", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(date);
}

function inviteStatus(item: StaffInviteRow) {
  if (item.claimedAt) return { label: "Активирован", className: "bg-[#5F6338]/10 text-[#4D512E]" };
  if (item.revokedAt) return { label: "Отозван", className: "bg-black/[0.05] text-black/40" };
  if (item.expiresAt && new Date(item.expiresAt).getTime() < Date.now()) return { label: "Истёк", className: "bg-red-50 text-red-600" };
  return { label: "Ожидает активации", className: "bg-[#D96A24]/10 text-[#C95320]" };
}

export function AdminStaffManager() {
  const [enabled, setEnabled] = useState(false);
  const [open, setOpen] = useState(false);
  const [actorRole, setActorRole] = useState("");
  const [directory, setDirectory] = useState<StaffDirectoryRow[]>([]);
  const [invites, setInvites] = useState<StaffInviteRow[]>([]);
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [roleName, setRoleName] = useState("teacher");
  const [branch, setBranch] = useState("НЛО");
  const [teachingSubject, setTeachingSubject] = useState("Дефиле и подиумный шаг");
  const [created, setCreated] = useState<CreatedStaffInvite | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function refresh() {
    const [people, inviteRows] = await Promise.all([fetchStaffDirectory(), fetchStaffInvites()]);
    setDirectory(people);
    setInvites(inviteRows);
  }

  useEffect(() => {
    let cancelled = false;
    let timer = 0;
    async function detect() {
      try {
        const identity = await fetchStaffIdentity();
        if (cancelled) return;
        const canManage = identity.role === "owner" || identity.role === "project_director";
        setActorRole(identity.role);
        setEnabled(canManage);
        if (canManage) await refresh();
      } catch {
        if (!cancelled) timer = window.setTimeout(detect, 1400);
      }
    }
    void detect();
    return () => { cancelled = true; if (timer) window.clearTimeout(timer); };
  }, []);

  useEffect(() => onAdminSection("team", () => {
    setOpen(true);
    setLoading(true);
    setError("");
    void refresh().catch((e) => setError(e instanceof Error ? e.message : "Не удалось загрузить сотрудников.")).finally(() => setLoading(false));
  }), []);

  useEffect(() => {
    if (roleName === "project_director") {
      setTeachingSubject("");
      return;
    }
    if (roleName === "teacher" && !teachingSubject) setTeachingSubject("Дефиле и подиумный шаг");
  }, [roleName]);

  const activeInvites = useMemo(() => invites.filter((item) => !item.claimedAt && !item.revokedAt && (!item.expiresAt || new Date(item.expiresAt).getTime() >= Date.now())), [invites]);

  async function create() {
    if (!fullName.trim()) return setError("Введите имя и фамилию сотрудника.");
    if (!phone.trim()) return setError("Введите рабочий телефон.");
    if (roleName === "teacher" && !teachingSubject.trim()) return setError("Для педагога выберите предмет.");
    setSaving(true);
    setError("");
    setSuccess("");
    setCreated(null);
    try {
      const next = await createStaffInvite({ fullName, phone, roleName, branch, teachingSubject });
      setCreated(next);
      setSuccess("Код создан. Передайте сотруднику телефон, код и ссылку /admin. Код показывается только сейчас.");
      setFullName("");
      setPhone("");
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось создать приглашение.");
    } finally {
      setSaving(false);
    }
  }

  async function revoke(item: StaffInviteRow) {
    if (!window.confirm(`Отозвать код доступа для ${item.fullName}?`)) return;
    setBusyId(item.inviteId);
    setError("");
    try {
      await revokeStaffInvite(item.inviteId);
      await refresh();
      setSuccess("Приглашение отозвано.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось отозвать приглашение.");
    } finally {
      setBusyId("");
    }
  }

  async function copyCode() {
    if (!created?.activationCode) return;
    try {
      await navigator.clipboard.writeText(created.activationCode);
      setSuccess("Код скопирован.");
    } catch {
      setSuccess(`Код доступа: ${created.activationCode}`);
    }
  }

  if (!enabled) return null;
  const needsBranch = roleName !== "project_director";
  const canChooseProjectDirector = actorRole === "owner";

  return (
    <>
      {open && <div className="fixed inset-0 z-[88] flex items-end justify-center bg-black/30 backdrop-blur-[2px] sm:items-center sm:p-5" onClick={() => !saving && setOpen(false)}>
        <div className="max-h-[96vh] w-full max-w-6xl overflow-y-auto rounded-t-[28px] bg-[#FAF9F5] p-5 shadow-2xl sm:rounded-[28px] sm:p-7" onClick={(event) => event.stopPropagation()}>
          <div className="flex items-start justify-between gap-4">
            <div><p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#D96A24]">OPEN STARS ADMIN</p><h2 className="mt-1 text-2xl font-semibold tracking-[-0.03em]">Сотрудники</h2><p className="mt-2 max-w-2xl text-sm leading-6 text-black/45">Один сотрудник — один аккаунт. Для двойной роли «администратор/управляющий + педагог» укажите основной статус и предмет.</p></div>
            <button type="button" onClick={() => setOpen(false)} disabled={saving} className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-white text-black/55 shadow-sm"><X size={20} /></button>
          </div>

          <div className="mt-6 grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
            <section className="rounded-[24px] border border-black/[0.06] bg-white p-5 sm:p-6">
              <div className="flex items-center gap-2"><UserPlus size={19} className="text-[#D96A24]" /><h3 className="font-semibold">Новый доступ</h3></div>
              <label className="mt-4 block text-xs font-semibold text-black/55">Имя и фамилия<input className={inputClass} value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Белова Марина" /></label>
              <label className="mt-3 block text-xs font-semibold text-black/55">Рабочий телефон<input className={inputClass} value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+7 999 123-45-67" inputMode="tel" /></label>
              <label className="mt-3 block text-xs font-semibold text-black/55">Основная роль<select className={inputClass} value={roleName} onChange={(e) => setRoleName(e.target.value)}><option value="teacher">Педагог</option><option value="admin">Администратор филиала</option><option value="manager">Управляющий</option>{canChooseProjectDirector && <option value="project_director">Директор по проекту</option>}</select></label>
              {needsBranch && <label className="mt-3 block text-xs font-semibold text-black/55">Филиал<select className={inputClass} value={branch} onChange={(e) => setBranch(e.target.value)}>{branches.map((item) => <option key={item}>{item}</option>)}</select></label>}
              {roleName !== "project_director" && <label className="mt-3 block text-xs font-semibold text-black/55">Педагогический предмет {roleName === "teacher" ? "· обязательно" : "· необязательно"}<input className={inputClass} list="staff-subjects" value={teachingSubject} onChange={(e) => setTeachingSubject(e.target.value)} placeholder={roleName === "teacher" ? "Выберите предмет" : "Оставьте пустым, если не педагог"} /><datalist id="staff-subjects">{subjects.map((item) => <option key={item} value={item} />)}</datalist></label>}
              <p className="mt-3 rounded-[14px] bg-[#FAF9F5] px-3.5 py-3 text-xs leading-5 text-black/45">Если предмет указан у администратора или управляющего, после активации появится переключатель в режим педагога. Второй логин не создаётся.</p>
              <button type="button" onClick={() => void create()} disabled={saving} className="mt-5 flex w-full items-center justify-center gap-2 rounded-[14px] bg-[#171717] px-5 py-3.5 text-sm font-semibold text-white disabled:opacity-50">{saving ? <LoaderCircle className="animate-spin" size={17} /> : <KeyRound size={17} />} Создать код на 7 дней</button>

              {created && <div className="mt-5 rounded-[20px] border border-[#D96A24]/20 bg-[#FFF8F1] p-4"><p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#C95320]">Код активации</p><div className="mt-2 flex items-center gap-3"><span className="font-mono text-3xl font-bold tracking-[0.18em] text-[#171717]">{created.activationCode}</span><button type="button" onClick={() => void copyCode()} className="grid h-10 w-10 place-items-center rounded-xl bg-white text-black/50 shadow-sm" aria-label="Скопировать код"><Copy size={17} /></button></div><p className="mt-2 text-xs leading-5 text-black/45">{created.fullName} · {created.phone}<br />Действует до {fmt(created.expiresAt)}.</p></div>}
              {error && <div className="mt-4 rounded-[15px] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
              {success && <div className="mt-4 flex gap-2 rounded-[15px] border border-[#5F6338]/15 bg-[#5F6338]/[0.07] px-4 py-3 text-sm text-[#4D512E]"><CheckCircle2 size={17} className="shrink-0" />{success}</div>}
            </section>

            <div className="space-y-5">
              <section className="rounded-[24px] border border-black/[0.06] bg-white p-5">
                <div className="flex items-center justify-between gap-3"><div><p className="text-[11px] font-bold uppercase tracking-[0.18em] text-black/35">Команда</p><h3 className="mt-1 text-lg font-semibold">Активные сотрудники · {directory.length}</h3></div><button type="button" onClick={() => { setLoading(true); void refresh().finally(() => setLoading(false)); }} className="grid h-9 w-9 place-items-center rounded-full bg-[#FAF9F5] text-black/45"><RefreshCw size={16} className={loading ? "animate-spin" : ""} /></button></div>
                {loading ? <div className="grid min-h-[140px] place-items-center"><LoaderCircle className="animate-spin text-black/25" /></div> : directory.length === 0 ? <p className="mt-4 text-sm text-black/40">Активных сотрудников пока нет.</p> : <div className="mt-4 max-h-[360px] space-y-2 overflow-y-auto">{directory.map((person) => <div key={person.profileId} className="rounded-[16px] border border-black/[0.055] p-3"><div className="flex flex-wrap items-start justify-between gap-2"><div><p className="text-sm font-semibold">{person.fullName}</p><p className="mt-1 text-xs text-black/40">{roleLabels[person.roleName] || person.roleName}{person.branch ? ` · ${person.branch}` : ""}</p></div><span className="rounded-full bg-[#5F6338]/10 px-2.5 py-1 text-[10px] font-bold text-[#4D512E]">Активен</span></div>{person.teachingSubjects.length > 0 && <p className="mt-2 text-xs text-[#C95320]">Педагог: {person.teachingSubjects.join(", ")}</p>}</div>)}</div>}
              </section>

              <section className="rounded-[24px] border border-black/[0.06] bg-white p-5">
                <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-black/35">Приглашения</p><h3 className="mt-1 text-lg font-semibold">Ожидают активации · {activeInvites.length}</h3>
                {invites.length === 0 ? <p className="mt-4 text-sm text-black/40">Приглашений ещё не было.</p> : <div className="mt-4 max-h-[430px] space-y-2 overflow-y-auto">{invites.map((item) => { const status = inviteStatus(item); const canRevoke = !item.claimedAt && !item.revokedAt && (!item.expiresAt || new Date(item.expiresAt).getTime() >= Date.now()); return <div key={item.inviteId} className="rounded-[16px] border border-black/[0.055] p-3"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="truncate text-sm font-semibold">{item.fullName}</p><p className="mt-1 text-xs text-black/40">{roleLabels[item.roleName] || item.roleName}{item.branch ? ` · ${item.branch}` : ""}</p><p className="mt-1 text-xs text-black/35">{item.phone}{item.teachingSubject ? ` · ${item.teachingSubject}` : ""}</p><p className="mt-1 text-[11px] text-black/30">Создано {fmt(item.createdAt)}{item.expiresAt ? ` · до ${fmt(item.expiresAt)}` : ""}</p></div><div className="flex shrink-0 items-center gap-2"><span className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${status.className}`}>{status.label}</span>{canRevoke && <button type="button" onClick={() => void revoke(item)} disabled={busyId === item.inviteId} className="grid h-8 w-8 place-items-center rounded-lg bg-red-50 text-red-600" aria-label="Отозвать приглашение"><Trash2 size={14} /></button>}</div></div></div>; })}</div>}
              </section>
            </div>
          </div>
        </div>
      </div>}
    </>
  );
}
