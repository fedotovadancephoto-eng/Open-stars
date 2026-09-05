import { useEffect, useMemo, useState } from "react";
import { Copy, KeyRound, LoaderCircle, UserPlus, X } from "lucide-react";

import { onAdminSection } from "@/admin/adminNavigation";
import { CrmRole, fetchCrmContext } from "@/admin/crmApi";
import {
  CreatedStaffInvite,
  StaffDirectoryRow,
  createStaffInvite,
  fetchStaffDirectory,
} from "@/admin/staffManagementApi";

const inputClass = "mt-1.5 w-full rounded-[14px] border border-black/[0.08] bg-white px-4 py-3 text-sm outline-none focus:border-[#D96A24]/40";
const roleLabels: Record<string, string> = { sales: "Продажи", marketer: "Маркетолог" };

export function CrmAccessManager() {
  const [role, setRole] = useState<CrmRole | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [newRole, setNewRole] = useState<"sales" | "marketer">("sales");
  const [created, setCreated] = useState<CreatedStaffInvite | null>(null);
  const [directory, setDirectory] = useState<StaffDirectoryRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => onAdminSection("crm-access", () => { void openPanel(); }), []);

  useEffect(() => {
    const closeHandler = (event: KeyboardEvent) => {
      if (event.key === "Escape" && panelOpen) setPanelOpen(false);
    };
    window.addEventListener("keydown", closeHandler);
    return () => window.removeEventListener("keydown", closeHandler);
  }, [panelOpen]);

  const crmPeople = useMemo(() => directory.filter((person) => person.roleName === "sales" || person.roleName === "marketer"), [directory]);

  async function openPanel() {
    setPanelOpen(true);
    setLoading(true);
    setError("");
    setSuccess("");
    try {
      const context = await fetchCrmContext();
      setRole(context.role);
      if (context.role !== "owner" && context.role !== "project_director") {
        throw new Error("CRM-доступами управляет только руководитель.");
      }
      setDirectory(await fetchStaffDirectory());
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Не удалось загрузить CRM-доступы.");
    } finally { setLoading(false); }
  }

  async function createAccess() {
    if (role !== "owner" && role !== "project_director") return setError("Недостаточно прав.");
    if (!fullName.trim()) return setError("Введите имя и фамилию сотрудника.");
    if (!phone.trim()) return setError("Введите рабочий телефон.");
    setSaving(true); setError(""); setSuccess(""); setCreated(null);
    try {
      const invite = await createStaffInvite({
        fullName,
        phone,
        roleName: newRole,
        branch: "",
        teachingSubject: "",
      });
      setCreated(invite);
      setFullName(""); setPhone("");
      setSuccess("Доступ создан. Передайте сотруднику код и ссылку /admin/crm. Код показывается только сейчас.");
      setDirectory(await fetchStaffDirectory());
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Не удалось создать CRM-доступ.");
    } finally { setSaving(false); }
  }

  async function copyCode() {
    if (!created?.activationCode) return;
    const text = `OPEN STARS CRM\n${created.fullName}\nТелефон: ${created.phone}\nКод: ${created.activationCode}\nВход: /admin/crm`;
    try {
      await navigator.clipboard.writeText(text);
      setSuccess("Данные для входа скопированы.");
    } catch {
      setSuccess(`Код: ${created.activationCode}`);
    }
  }

  if (!panelOpen) return null;

  return <div className="fixed inset-0 z-[92] overflow-y-auto bg-black/30 p-3 backdrop-blur-sm sm:p-6" onClick={()=>setPanelOpen(false)}>
    <div className="mx-auto max-w-2xl rounded-[28px] bg-[#FAF9F5] p-5 shadow-2xl sm:p-7" onClick={e=>e.stopPropagation()}>
      <div className="flex items-start justify-between gap-4"><div><p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#D96A24]">OPEN STARS · CRM</p><h2 className="mt-1 text-2xl font-semibold">Доступы продаж и маркетинга</h2><p className="mt-2 text-sm leading-6 text-black/45">Эти сотрудники входят через отдельную страницу CRM и не получают доступ к ДДС, зарплатам и административным разделам.</p></div><button onClick={()=>setPanelOpen(false)} className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-white"><X size={20}/></button></div>

      <section className="mt-5 rounded-[22px] bg-white p-5">
        <div className="flex items-center gap-2"><UserPlus size={18} className="text-[#D96A24]"/><h3 className="font-semibold">Новый CRM-доступ</h3></div>
        <div className="mt-3 grid gap-3 sm:grid-cols-2"><label className="text-xs font-semibold text-black/50">Имя и фамилия<input className={inputClass} value={fullName} onChange={e=>setFullName(e.target.value)}/></label><label className="text-xs font-semibold text-black/50">Рабочий телефон<input inputMode="tel" className={inputClass} value={phone} onChange={e=>setPhone(e.target.value)}/></label><label className="text-xs font-semibold text-black/50 sm:col-span-2">Роль<select className={inputClass} value={newRole} onChange={e=>setNewRole(e.target.value as "sales"|"marketer")}><option value="sales">Продажи — лиды, пробные, задачи, продажи</option><option value="marketer">Маркетолог — только агрегированная аналитика</option></select></label></div>
        <button disabled={saving || loading} onClick={()=>void createAccess()} className="mt-4 flex w-full items-center justify-center gap-2 rounded-[15px] bg-[#171717] py-3.5 text-sm font-semibold text-white disabled:opacity-50">{saving?<LoaderCircle size={16} className="animate-spin"/>:<KeyRound size={16}/>}Создать код на 7 дней</button>
        {created&&<div className="mt-4 rounded-[18px] border border-[#D96A24]/20 bg-[#FFF8F1] p-4"><p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#C95320]">Код активации</p><div className="mt-2 flex items-center justify-between gap-3"><div><p className="font-mono text-3xl font-bold tracking-[0.18em]">{created.activationCode}</p><p className="mt-1 text-xs text-black/45">{created.fullName} · {created.phone}</p></div><button onClick={()=>void copyCode()} className="grid h-11 w-11 place-items-center rounded-xl bg-white shadow-sm"><Copy size={17}/></button></div><p className="mt-3 text-xs font-semibold text-[#5F6338]">Вход сотрудника: /admin/crm</p></div>}
        {error&&<div className="mt-4 rounded-[14px] bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
        {success&&<div className="mt-4 rounded-[14px] bg-[#5F6338]/10 px-4 py-3 text-sm text-[#4D512E]">{success}</div>}
      </section>

      <section className="mt-4 rounded-[22px] bg-white p-5"><div className="flex items-center justify-between"><h3 className="font-semibold">CRM-команда · {crmPeople.length}</h3>{loading&&<LoaderCircle size={16} className="animate-spin text-black/30"/>}</div>{!loading&&crmPeople.length===0?<p className="mt-3 text-sm text-black/40">Отдельных сотрудников продаж/маркетинга пока нет.</p>:<div className="mt-3 space-y-2">{crmPeople.map(person=><div key={person.profileId} className="rounded-[14px] bg-[#F7F5EF] p-3"><p className="text-sm font-semibold">{person.fullName}</p><p className="mt-1 text-xs text-black/40">{roleLabels[person.roleName] || person.roleName} · {person.phone}</p></div>)}</div>}</section>
    </div>
  </div>;
}
