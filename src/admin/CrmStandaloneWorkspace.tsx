import { FormEvent, useEffect, useState } from "react";
import { Eye, EyeOff, KeyRound, LockKeyhole, LogOut, Phone, Target } from "lucide-react";

import { AdminCrmManager } from "@/admin/AdminCrmManager";
import { clearStaffSession, getValidStaffSession } from "@/admin/adminApi";
import { openAdminSection } from "@/admin/adminNavigation";
import { CrmRole, fetchCrmContext } from "@/admin/crmApi";
import { registerStaff } from "@/admin/staffRegisterApi";
import { Logo } from "@/components/Logo";

const SUPABASE_URL = "https://yiwiykbuaggyslfyhlfo.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_1MORh5rY7uMDVYLYVX5VAA_cyoph4-7";
const STAFF_SESSION_KEY = "openstars_staff_session";

const roleLabels: Record<CrmRole, string> = {
  owner: "Владелец",
  project_director: "Директор по проекту",
  manager: "Управляющий",
  admin: "Администратор",
  sales: "Продажи",
  marketer: "Маркетолог",
};

type State = "checking" | "guest" | "ready" | "error";
type LoginMode = "login" | "activate";
type AuthPayload = {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  expires_at?: number;
  token_type?: string;
  user?: { id?: string };
};

function normalizePhone(input: string) {
  const digits = input.replace(/[^0-9]/g, "");
  if (/^8[0-9]{10}$/.test(digits)) return `+7${digits.slice(1)}`;
  if (/^7[0-9]{10}$/.test(digits)) return `+${digits}`;
  if (/^[1-9][0-9]{9,14}$/.test(digits)) return `+${digits}`;
  return null;
}

function internalStaffEmail(phone: string) {
  return `staff.${phone.replace(/[^0-9]/g, "")}@auth.openstars.app`;
}

async function loginCrmStaff(phoneInput: string, password: string) {
  const phone = normalizePhone(phoneInput);
  if (!phone || !password) throw new Error("Введите рабочий номер телефона и пароль.");

  const response = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: {
      apikey: SUPABASE_PUBLISHABLE_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ email: internalStaffEmail(phone), password }),
  });
  const auth = await response.json() as AuthPayload;
  if (!response.ok || !auth.access_token || !auth.refresh_token || !auth.user?.id) {
    throw new Error("Неверный номер телефона или пароль.");
  }

  const profileResponse = await fetch(
    `${SUPABASE_URL}/rest/v1/users_profile?select=id,roles(name)&auth_user_id=eq.${encodeURIComponent(auth.user.id)}&limit=1`,
    { headers: { apikey: SUPABASE_PUBLISHABLE_KEY, Authorization: `Bearer ${auth.access_token}` } }
  );
  if (!profileResponse.ok) throw new Error("Не удалось проверить роль сотрудника.");
  const rows = await profileResponse.json() as Array<{ roles?: { name?: string } | Array<{ name?: string }> }>;
  const roles = rows[0]?.roles;
  const role = Array.isArray(roles) ? roles[0]?.name : roles?.name;
  const allowed = new Set(["owner", "project_director", "manager", "admin", "sales", "marketer"]);
  if (!role || !allowed.has(role)) throw new Error("У этого аккаунта нет доступа к CRM OPEN STARS.");

  localStorage.setItem(STAFF_SESSION_KEY, JSON.stringify({
    access_token: auth.access_token,
    refresh_token: auth.refresh_token,
    expires_in: auth.expires_in || 3600,
    expires_at: auth.expires_at || Math.floor(Date.now() / 1000) + (auth.expires_in || 3600),
    token_type: auth.token_type || "bearer",
  }));
}

function CrmLogin({ onSuccess }: { onSuccess: () => void }) {
  const [mode, setMode] = useState<LoginMode>("login");
  const [phone, setPhone] = useState("");
  const [activationCode, setActivationCode] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent) {
    event.preventDefault();
    setLoading(true); setError("");
    try {
      if (mode === "activate") {
        await registerStaff(phone, activationCode, password);
      }
      await loginCrmStaff(phone, password);
      onSuccess();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : mode === "activate" ? "Не удалось активировать CRM-доступ." : "Не удалось войти в CRM.");
    } finally { setLoading(false); }
  }

  function changeMode(next: LoginMode) {
    setMode(next);
    setError("");
    setActivationCode("");
  }

  return <div className="grid min-h-screen place-items-center bg-[#FAF9F5] px-5 py-10">
    <div className="w-full max-w-md rounded-[28px] border border-black/[0.06] bg-white p-6 shadow-[0_18px_60px_rgba(0,0,0,0.08)] sm:p-8">
      <Logo />
      <p className="mt-8 text-[11px] font-bold uppercase tracking-[0.2em] text-[#D96A24]">OPEN STARS · CRM</p>
      <h1 className="mt-2 text-3xl font-semibold tracking-[-0.04em] text-[#171717]">{mode === "login" ? "Лиды и продажи" : "Первый вход в CRM"}</h1>
      <p className="mt-2 text-sm leading-6 text-black/45">{mode === "login" ? "Рабочий вход для продаж, маркетинга и сотрудников с доступом к CRM." : "Введите рабочий номер, одноразовый код от руководителя и придумайте личный пароль."}</p>

      <div className="mt-6 grid grid-cols-2 gap-1.5 rounded-[16px] bg-[#ECEAE2] p-1.5">
        <button type="button" onClick={()=>changeMode("login")} className={`rounded-[12px] px-3 py-2.5 text-sm font-semibold ${mode === "login" ? "bg-white text-[#171717] shadow-sm" : "text-black/45"}`}>Войти</button>
        <button type="button" onClick={()=>changeMode("activate")} className={`rounded-[12px] px-3 py-2.5 text-sm font-semibold ${mode === "activate" ? "bg-white text-[#171717] shadow-sm" : "text-black/45"}`}>Активировать</button>
      </div>

      <form onSubmit={submit} className="mt-6 space-y-4">
        <label className="block text-xs font-semibold text-black/55">Номер телефона<div className="relative mt-2"><Phone className="absolute left-4 top-1/2 -translate-y-1/2 text-[#5F6338]" size={18}/><input type="tel" value={phone} onChange={e=>setPhone(e.target.value)} placeholder="+7 999 123-45-67" className="w-full rounded-[16px] border border-black/[0.08] bg-[#FAF9F5] py-3.5 pl-12 pr-4 text-sm outline-none focus:border-[#D96A24]/40" required/></div></label>
        {mode === "activate" && <label className="block text-xs font-semibold text-black/55">Код активации<div className="relative mt-2"><KeyRound className="absolute left-4 top-1/2 -translate-y-1/2 text-[#D96A24]" size={18}/><input value={activationCode} onChange={e=>setActivationCode(e.target.value.toUpperCase().replace(/[^0-9A-F]/g, "").slice(0, 6))} placeholder="6 символов" minLength={6} maxLength={6} className="w-full rounded-[16px] border border-black/[0.08] bg-[#FAF9F5] py-3.5 pl-12 pr-4 text-sm font-semibold uppercase tracking-[0.18em] outline-none focus:border-[#D96A24]/40" required/></div></label>}
        <label className="block text-xs font-semibold text-black/55">{mode === "activate" ? "Придумайте пароль" : "Пароль"}<div className="relative mt-2"><LockKeyhole className="absolute left-4 top-1/2 -translate-y-1/2 text-[#5F6338]" size={18}/><input type={showPassword?"text":"password"} value={password} onChange={e=>setPassword(e.target.value)} minLength={mode === "activate" ? 8 : undefined} className="w-full rounded-[16px] border border-black/[0.08] bg-[#FAF9F5] py-3.5 pl-12 pr-12 text-sm outline-none focus:border-[#D96A24]/40" required/><button type="button" onClick={()=>setShowPassword(v=>!v)} className="absolute right-3 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-full text-black/35">{showPassword?<EyeOff size={17}/>:<Eye size={17}/>}</button></div></label>
        {mode === "activate" && <p className="rounded-[14px] bg-[#5F6338]/[0.07] px-4 py-3 text-xs leading-5 text-[#4D512E]">Код используется один раз. После активации сотрудник входит только по рабочему телефону и своему паролю.</p>}
        {error&&<div className="rounded-[14px] bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
        <button disabled={loading} className="w-full rounded-[16px] bg-[#171717] py-3.5 text-sm font-semibold text-white disabled:opacity-50">{loading ? (mode === "activate" ? "Активируем…" : "Проверяем доступ…") : (mode === "activate" ? "Активировать и войти" : "Войти в CRM")}</button>
      </form>
    </div>
  </div>;
}

export default function CrmStandaloneWorkspace() {
  const [state, setState] = useState<State>("checking");
  const [role, setRole] = useState<CrmRole | null>(null);
  const [error, setError] = useState("");

  async function check() {
    setState("checking"); setError("");
    try {
      const session = await getValidStaffSession();
      if (!session) { setState("guest"); return; }
      const context = await fetchCrmContext();
      setRole(context.role);
      setState("ready");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Не удалось открыть CRM.");
      setState("error");
    }
  }

  useEffect(() => { void check(); }, []);
  useEffect(() => {
    if (state !== "ready") return;
    const timer = window.setTimeout(() => openAdminSection("crm"), 0);
    return () => window.clearTimeout(timer);
  }, [state]);

  if (state === "checking") return <div className="grid min-h-screen place-items-center bg-[#FAF9F5]"><div className="text-center"><Logo/><p className="mt-4 text-xs uppercase tracking-[0.18em] text-black/35">Загрузка CRM</p></div></div>;
  if (state === "guest") return <CrmLogin onSuccess={() => void check()}/>;
  if (state === "error") return <div className="grid min-h-screen place-items-center bg-[#FAF9F5] px-5"><div className="w-full max-w-md rounded-[24px] bg-white p-6 text-center"><h2 className="text-xl font-semibold">Не удалось открыть CRM</h2><p className="mt-3 text-sm text-black/45">{error}</p><button onClick={()=>{clearStaffSession();setState("guest");}} className="mt-5 rounded-[14px] bg-[#171717] px-5 py-3 text-sm font-semibold text-white">Войти снова</button></div></div>;

  return <div className="min-h-screen bg-[#FAF9F5] px-5 py-8">
    <div className="mx-auto max-w-lg rounded-[26px] bg-white p-6 shadow-sm">
      <Logo/>
      <div className="mt-7 flex items-center justify-between gap-3"><div><p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#D96A24]">OPEN STARS · CRM</p><h1 className="mt-1 text-2xl font-semibold">{role?roleLabels[role]:"CRM"}</h1></div><Target className="text-[#D96A24]"/></div>
      <button onClick={()=>openAdminSection("crm")} className="mt-6 w-full rounded-[16px] bg-[#D96A24] py-3.5 text-sm font-semibold text-white">Открыть CRM</button>
      <button onClick={()=>{clearStaffSession();setRole(null);setState("guest");}} className="mt-3 flex w-full items-center justify-center gap-2 rounded-[16px] bg-[#F6F5F1] py-3 text-sm font-semibold text-black/55"><LogOut size={17}/>Выйти</button>
    </div>
    <AdminCrmManager/>
  </div>;
}
