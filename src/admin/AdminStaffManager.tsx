import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, Copy, Download, KeyRound, LoaderCircle, RefreshCw, Trash2, UserPlus, X } from "lucide-react";

import { fetchStaffIdentity } from "@/admin/adminApi";
import { onAdminSection } from "@/admin/adminNavigation";
import {
  CreatedStaffInvite,
  StaffDirectoryRow,
  StaffInviteRow,
  createStaffInvite,
  fetchStaffDirectory,
  fetchStaffInvites,
  reissueStaffInvite,
  revokeStaffInvite,
} from "@/admin/staffManagementApi";

const branches = ["Свердловский", "НЛО", "Октябрьский"];
const standardSubjects = ["Актёрское мастерство", "Дефиле и подиумный шаг", "Фотопозирование", "Хореография"];
const CUSTOM_SUBJECT = "__custom__";
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

function csvCell(value: string) {
  return `"${String(value || "").replace(/"/g, '""')}"`;
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
  const [subjectChoice, setSubjectChoice] = useState(standardSubjects[1]);
  const [teachingSubject, setTeachingSubject] = useState(standardSubjects[1]);
  const [created, setCreated] = useState<CreatedStaffInvite | null>(null);
  const [reissuedCodes, setReissuedCodes] = useState<CreatedStaffInvite[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [bulkBusy, setBulkBusy] = useState(false);
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
    if (roleName === "teacher") {
      const defaultSubject = standardSubjects[1];
      setSubjectChoice(defaultSubject);
      setTeachingSubject(defaultSubject);
      return;
    }
    setSubjectChoice("");
    setTeachingSubject("");
  }, [roleName]);

  const pendingInvites = useMemo(() => invites.filter((item) => !item.claimedAt && !item.revokedAt), [invites]);
  const manageablePending = useMemo(
    () => pendingInvites.filter((item) => actorRole === "owner" || item.roleName !== "project_director"),
    [pendingInvites, actorRole],
  );

  function changeSubjectChoice(value: string) {
    setSubjectChoice(value);
    if (value === CUSTOM_SUBJECT) {
      setTeachingSubject("");
      return;
    }
    setTeachingSubject(value);
  }

  async function create() {
    if (!fullName.trim()) return setError("Введите имя и фамилию сотрудника.");
    if (!phone.trim()) return setError("Введите рабочий телефон.");
    if (roleName === "teacher" && !teachingSubject.trim()) return setError("Для педагога выберите предмет или введите название мастер-класса.");
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
      setReissuedCodes((current) => current.filter((code) => code.inviteId !== item.inviteId));
      await refresh();
      setSuccess("Приглашение отозвано.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось отозвать приглашение.");
    } finally {
      setBusyId("");
    }
  }

  async function reissueOne(item: StaffInviteRow) {
    if (!window.confirm(`Создать новый код для ${item.fullName}? Старый код сразу перестанет работать.`)) return;
    setBusyId(item.inviteId);
    setError("");
    setSuccess("");
    try {
      const next = await reissueStaffInvite(item);
      setReissuedCodes((current) => [...current.filter((code) => code.inviteId !== next.inviteId), next]);
      await refresh();
      setSuccess(`Новый код для ${item.fullName} создан. Сохраните его сейчас.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось создать новый код.");
    } finally {
      setBusyId("");
    }
  }

  async function reissueAll() {
    if (manageablePending.length === 0) return;
    if (!window.confirm(`Перевыпустить коды для ${manageablePending.length} сотрудник(ов)? Все прежние коды сразу перестанут работать.`)) return;
    setBulkBusy(true);
    setError("");
    setSuccess("");
    const generated: CreatedStaffInvite[] = [];
    const failed: string[] = [];
    try {
      for (const item of manageablePending) {
        try {
          generated.push(await reissueStaffInvite(item));
        } catch {
          failed.push(item.fullName);
        }
      }
      setReissuedCodes(generated);
      await refresh();
      if (generated.length > 0) setSuccess(`Создано новых кодов: ${generated.length}. Скопируйте или скачайте список сейчас.`);
      if (failed.length > 0) setError(`Не удалось перевыпустить: ${failed.join(", ")}. Остальные новые коды уже показаны ниже.`);
    } finally {
      setBulkBusy(false);
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

  async function copyReissuedCode(item: CreatedStaffInvite) {
    try {
      await navigator.clipboard.writeText(item.activationCode);
      setSuccess(`Код для ${item.fullName} скопирован.`);
    } catch {
      setSuccess(`${item.fullName}: ${item.activationCode}`);
    }
  }

  async function copyAllCodes() {
    if (reissuedCodes.length === 0) return;
    const text = reissuedCodes.map((item) => `${item.fullName} — ${item.phone} — ${item.activationCode}`).join("\n");
    try {
      await navigator.clipboard.writeText(text);
      setSuccess(`Скопировано кодов: ${reissuedCodes.length}.`);
    } catch {
      setError("Не удалось скопировать автоматически. Используйте кнопку копирования у каждого кода.");
    }
  }

  function downloadCodes() {
    if (reissuedCodes.length === 0) return;
    const header = ["ФИО", "Телефон", "Роль", "Филиал", "Предмет", "Код", "Действует до"];
    const lines = [header, ...reissuedCodes.map((item) => [
      item.fullName,
      item.phone,
      roleLabels[item.roleName] || item.roleName,
      item.branch,
      item.teachingSubject,
      item.activationCode,
      fmt(item.expiresAt),
    ])].map((row) => row.map(csvCell).join(";"));
    const blob = new Blob(["\uFEFF", lines.join("\r\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `OPEN_STARS_staff_codes_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    setSuccess("Список кодов сохранён на устройство.");
  }

  function closeManager() {
    if (saving || bulkBusy || busyId) return;
    if (reissuedCodes.length > 0 && !window.confirm("Новые коды показываются только сейчас. Вы уже сохранили их? Закрыть раздел?")) return;
    setOpen(false);
  }

  if (!enabled) return null;
  const needsBranch = roleName !== "project_director";
  const canChooseProjectDirector = actorRole === "owner";

  return (
    <>
      {open && <div className="fixed inset-0 z-[88] flex items-end justify-center bg-black/30 backdrop-blur-[2px] sm:items-center sm:p-5" onClick={closeManager}>
        <div className="max-h-[96vh] w-full max-w-6xl overflow-y-auto rounded-t-[28px] bg-[#FAF9F5] p-5 shadow-2xl sm:rounded-[28px] sm:p-7" onClick={(event) => event.stopPropagation()}>
          <div className="flex items-start justify-between gap-4">
            <div><p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#D96A24]">OPEN STARS ADMIN</p><h2 className="mt-1 text-2xl font-semibold tracking-[-0.03em]">Сотрудники</h2><p className="mt-2 max-w-2xl text-sm leading-6 text-black/45">Один сотрудник — один аккаунт. Для двойной роли «администратор/управляющий + педагог» укажите основной статус и предмет.</p></div>
            <button type="button" onClick={closeManager} disabled={saving || bulkBusy || Boolean(busyId)} className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-white text-black/55 shadow-sm disabled:opacity-40"><X size={20} /></button>
          </div>

          <div className="mt-6 grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
            <section className="rounded-[24px] border border-black/[0.06] bg-white p-5 sm:p-6">
              <div className="flex items-center gap-2"><UserPlus size={19} className="text-[#D96A24]" /><h3 className="font-semibold">Новый доступ</h3></div>
              <label className="mt-4 block text-xs font-semibold text-black/55">Имя и фамилия<input className={inputClass} value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Белова Марина" /></label>
              <label className="mt-3 block text-xs font-semibold text-black/55">Рабочий телефон<input className={inputClass} value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+7 999 123-45-67" inputMode="tel" /></label>
              <label className="mt-3 block text-xs font-semibold text-black/55">Основная роль<select className={inputClass} value={roleName} onChange={(e) => setRoleName(e.target.value)}><option value="teacher">Педагог</option><option value="admin">Администратор филиала</option><option value="manager">Управляющий</option>{canChooseProjectDirector && <option value="project_director">Директор по проекту</option>}</select></label>
              {needsBranch && <label className="mt-3 block text-xs font-semibold text-black/55">Филиал<select className={inputClass} value={branch} onChange={(e) => setBranch(e.target.value)}>{branches.map((item) => <option key={item}>{item}</option>)}</select></label>}
              {roleName !== "project_director" && <div className="mt-3">
                <label className="block text-xs font-semibold text-black/55">Педагогический предмет {roleName === "teacher" ? "· обязательно" : "· необязательно"}
                  <select className={inputClass} value={subjectChoice} onChange={(e) => changeSubjectChoice(e.target.value)}>
                    {roleName !== "teacher" && <option value="">Без педагогического предмета</option>}
                    {standardSubjects.map((item) => <option key={item} value={item}>{item}</option>)}
                    <option value={CUSTOM_SUBJECT}>Мастер-класс / другой предмет…</option>
                  </select>
                </label>
                {subjectChoice === CUSTOM_SUBJECT && <label className="mt-2 block text-xs font-semibold text-black/55">Название мастер-класса / предмета<input autoFocus className={inputClass} value={teachingSubject} onChange={(e) => setTeachingSubject(e.target.value)} placeholder="Например: Мастер-класс по визажу" /></label>}
              </div>}
              <p className="mt-3 rounded-[14px] bg-[#FAF9F5] px-3.5 py-3 text-xs leading-5 text-black/45">Для администратора или управляющего педагогический предмет добавляется только если вы выбрали его явно. Для разового мастер-класса выберите «Мастер-класс / другой предмет» и впишите название вручную.</p>
              <button type="button" onClick={() => void create()} disabled={saving || bulkBusy} className="mt-5 flex w-full items-center justify-center gap-2 rounded-[14px] bg-[#171717] px-5 py-3.5 text-sm font-semibold text-white disabled:opacity-50">{saving ? <LoaderCircle className="animate-spin" size={17} /> : <KeyRound size={17} />} Создать код на 7 дней</button>

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
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div><p className="text-[11px] font-bold uppercase tracking-[0.18em] text-black/35">Приглашения</p><h3 className="mt-1 text-lg font-semibold">Ожидают активации · {pendingInvites.length}</h3></div>
                  {manageablePending.length > 0 && <button type="button" onClick={() => void reissueAll()} disabled={bulkBusy || Boolean(busyId)} className="flex items-center gap-2 rounded-[12px] bg-[#171717] px-3.5 py-2.5 text-xs font-semibold text-white disabled:opacity-45">{bulkBusy ? <LoaderCircle size={15} className="animate-spin" /> : <KeyRound size={15} />} Перевыпустить все {manageablePending.length}</button>}
                </div>

                {reissuedCodes.length > 0 && <div className="mt-4 rounded-[18px] border border-[#D96A24]/20 bg-[#FFF8F1] p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#C95320]">Новые коды · {reissuedCodes.length}</p><p className="mt-1 text-xs leading-5 text-black/45">Сохраните их сейчас. После закрытия раздела коды восстановить нельзя.</p></div><div className="flex gap-2"><button type="button" onClick={() => void copyAllCodes()} className="flex items-center gap-1.5 rounded-[10px] bg-white px-3 py-2 text-xs font-semibold text-black/55 shadow-sm"><Copy size={14} /> Копировать</button><button type="button" onClick={downloadCodes} className="flex items-center gap-1.5 rounded-[10px] bg-white px-3 py-2 text-xs font-semibold text-black/55 shadow-sm"><Download size={14} /> CSV</button></div></div>
                  <div className="mt-3 grid gap-2 sm:grid-cols-2">{reissuedCodes.map((item) => <div key={item.inviteId} className="rounded-[13px] bg-white px-3 py-2.5"><div className="flex items-center justify-between gap-2"><div className="min-w-0"><p className="truncate text-xs font-semibold">{item.fullName}</p><p className="mt-1 font-mono text-xl font-bold tracking-[0.15em]">{item.activationCode}</p></div><button type="button" onClick={() => void copyReissuedCode(item)} className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-[#FAF9F5] text-black/45" aria-label={`Скопировать код ${item.fullName}`}><Copy size={15} /></button></div></div>)}</div>
                </div>}

                {invites.length === 0 ? <p className="mt-4 text-sm text-black/40">Приглашений ещё не было.</p> : <div className="mt-4 max-h-[500px] space-y-2 overflow-y-auto">{invites.map((item) => {
                  const status = inviteStatus(item);
                  const canManage = !item.claimedAt && !item.revokedAt && (actorRole === "owner" || item.roleName !== "project_director");
                  const revealed = reissuedCodes.find((code) => code.inviteId === item.inviteId);
                  return <div key={item.inviteId} className="rounded-[16px] border border-black/[0.055] p-3">
                    <div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="truncate text-sm font-semibold">{item.fullName}</p><p className="mt-1 text-xs text-black/40">{roleLabels[item.roleName] || item.roleName}{item.branch ? ` · ${item.branch}` : ""}</p><p className="mt-1 text-xs text-black/35">{item.phone}{item.teachingSubject ? ` · ${item.teachingSubject}` : ""}</p><p className="mt-1 text-[11px] text-black/30">Создано {fmt(item.createdAt)}{item.expiresAt ? ` · до ${fmt(item.expiresAt)}` : ""}</p></div><span className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold ${status.className}`}>{status.label}</span></div>
                    {canManage && <div className="mt-3 flex flex-wrap gap-2"><button type="button" onClick={() => void reissueOne(item)} disabled={bulkBusy || Boolean(busyId)} className="flex items-center gap-1.5 rounded-[10px] bg-[#FFF3E9] px-3 py-2 text-xs font-semibold text-[#C95320] disabled:opacity-45">{busyId === item.inviteId ? <LoaderCircle size={14} className="animate-spin" /> : <KeyRound size={14} />} Новый код</button><button type="button" onClick={() => void revoke(item)} disabled={bulkBusy || Boolean(busyId)} className="flex items-center gap-1.5 rounded-[10px] bg-red-50 px-3 py-2 text-xs font-semibold text-red-600 disabled:opacity-45"><Trash2 size={14} /> Отозвать</button></div>}
                    {revealed && <div className="mt-3 flex items-center justify-between gap-3 rounded-[12px] bg-[#FFF8F1] px-3 py-2.5"><div><p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#C95320]">Новый код</p><p className="mt-1 font-mono text-2xl font-bold tracking-[0.16em]">{revealed.activationCode}</p></div><button type="button" onClick={() => void copyReissuedCode(revealed)} className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-white text-black/45 shadow-sm"><Copy size={15} /></button></div>}
                  </div>;
                })}</div>}
              </section>
            </div>
          </div>
        </div>
      </div>}
    </>
  );
}
