import { FormEvent, useState } from "react";
import { Eye, EyeOff, KeyRound, LockKeyhole, Phone, ShieldCheck } from "lucide-react";

import { Logo } from "@/components/Logo";
import { loginStaff } from "@/admin/adminApi";
import { registerStaff } from "@/admin/staffRegisterApi";

type Props = { onSuccess: () => void };
type Mode = "login" | "activate";

export function StaffAuth({ onSuccess }: Props) {
  const [mode, setMode] = useState<Mode>("login");
  const [phone, setPhone] = useState("");
  const [activationCode, setActivationCode] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  function switchMode(next: Mode) {
    setMode(next);
    setError("");
    setActivationCode("");
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError("");
    setLoading(true);

    try {
      if (mode === "activate") {
        await registerStaff(phone, activationCode, password);
      }
      await loginStaff(phone, password);
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : mode === "activate" ? "Не удалось активировать доступ." : "Не удалось войти.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#FAF9F5]">
      <div className="grid min-h-screen lg:grid-cols-[1fr_0.9fr]">
        <div className="relative hidden overflow-hidden bg-[#171717] p-12 text-white lg:flex lg:flex-col lg:justify-between">
          <div className="absolute -right-28 -top-28 h-96 w-96 rounded-full bg-[#D96A24]/20 blur-3xl" />
          <div className="absolute -bottom-36 -left-28 h-96 w-96 rounded-full bg-[#5F6338]/30 blur-3xl" />
          <div className="relative"><Logo /></div>
          <div className="relative max-w-xl">
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-[#E8752A]">Управление школой</p>
            <h1 className="mt-5 text-5xl font-semibold leading-[1.04] tracking-[-0.045em]">
              Админ-панель<br />OPEN STARS
            </h1>
            <p className="mt-6 max-w-md text-base leading-relaxed text-white/55">
              Ученики, расписание, учебная часть, Star Coin, новости, оплаты и фотосессии — в одном рабочем пространстве.
            </p>
          </div>
          <div className="relative flex items-center gap-2 text-sm text-white/40">
            <ShieldCheck size={18} /> Доступ только для сотрудников OPEN STARS
          </div>
        </div>

        <div className="flex items-center justify-center px-5 py-10 sm:px-8">
          <div className="w-full max-w-md">
            <div className="mb-10 lg:hidden"><Logo /></div>
            <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#D96A24]">OPEN STARS ADMIN</p>
            <h2 className="mt-2 text-3xl font-semibold tracking-[-0.035em] text-[#171717]">
              {mode === "login" ? "Вход для сотрудников" : "Первый вход"}
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-black/45">
              {mode === "login"
                ? "Используйте рабочий номер телефона и свой пароль."
                : "Введите рабочий номер, одноразовый код от директора и придумайте личный пароль."}
            </p>

            <div className="mt-6 grid grid-cols-2 gap-1.5 rounded-[16px] bg-[#ECEAE2] p-1.5">
              <button
                type="button"
                onClick={() => switchMode("login")}
                className={`rounded-[12px] px-3 py-2.5 text-sm font-semibold transition ${mode === "login" ? "bg-white text-[#171717] shadow-sm" : "text-black/45"}`}
              >
                Войти
              </button>
              <button
                type="button"
                onClick={() => switchMode("activate")}
                className={`rounded-[12px] px-3 py-2.5 text-sm font-semibold transition ${mode === "activate" ? "bg-white text-[#171717] shadow-sm" : "text-black/45"}`}
              >
                Активировать доступ
              </button>
            </div>

            <form onSubmit={handleSubmit} className="mt-6 space-y-4">
              <div>
                <label className="mb-2 block text-xs font-semibold text-[#171717]" htmlFor="staff-phone">Номер телефона</label>
                <div className="relative">
                  <Phone className="absolute left-4 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-[#5F6338]" />
                  <input
                    id="staff-phone"
                    type="tel"
                    value={phone}
                    onChange={(event) => setPhone(event.target.value)}
                    placeholder="+7 999 123-45-67"
                    autoComplete="tel"
                    required
                    className="w-full rounded-[16px] border border-black/[0.08] bg-white py-3.5 pl-12 pr-4 text-[15px] outline-none transition placeholder:text-black/25 focus:border-[#D96A24]/50 focus:ring-4 focus:ring-[#D96A24]/[0.07]"
                  />
                </div>
              </div>

              {mode === "activate" && (
                <div>
                  <label className="mb-2 block text-xs font-semibold text-[#171717]" htmlFor="staff-code">Код активации</label>
                  <div className="relative">
                    <KeyRound className="absolute left-4 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-[#D96A24]" />
                    <input
                      id="staff-code"
                      value={activationCode}
                      onChange={(event) => setActivationCode(event.target.value.toUpperCase().replace(/[^0-9A-F]/g, "").slice(0, 6))}
                      placeholder="6 символов"
                      autoComplete="one-time-code"
                      required
                      minLength={6}
                      maxLength={6}
                      className="w-full rounded-[16px] border border-black/[0.08] bg-white py-3.5 pl-12 pr-4 text-[15px] font-semibold uppercase tracking-[0.18em] outline-none transition placeholder:font-normal placeholder:tracking-normal placeholder:text-black/25 focus:border-[#D96A24]/50 focus:ring-4 focus:ring-[#D96A24]/[0.07]"
                    />
                  </div>
                </div>
              )}

              <div>
                <label className="mb-2 block text-xs font-semibold text-[#171717]" htmlFor="staff-password">
                  {mode === "activate" ? "Придумайте пароль" : "Пароль"}
                </label>
                <div className="relative">
                  <LockKeyhole className="absolute left-4 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-[#5F6338]" />
                  <input
                    id="staff-password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    placeholder={mode === "activate" ? "Минимум 8 символов" : "Введите пароль"}
                    autoComplete={mode === "activate" ? "new-password" : "current-password"}
                    required
                    minLength={8}
                    className="w-full rounded-[16px] border border-black/[0.08] bg-white py-3.5 pl-12 pr-12 text-[15px] outline-none transition placeholder:text-black/25 focus:border-[#D96A24]/50 focus:ring-4 focus:ring-[#D96A24]/[0.07]"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((value) => !value)}
                    aria-label={showPassword ? "Скрыть пароль" : "Показать пароль"}
                    className="absolute right-3 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-full text-black/35 hover:bg-black/[0.04]"
                  >
                    {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                  </button>
                </div>
              </div>

              {mode === "activate" && (
                <p className="rounded-[14px] bg-[#5F6338]/[0.07] px-4 py-3 text-xs leading-5 text-[#4D512E]">
                  Код используется только один раз. После активации входите по номеру телефона и своему паролю.
                </p>
              )}

              {error && (
                <div className="rounded-[14px] border border-red-500/10 bg-red-500/[0.06] px-4 py-3 text-sm leading-relaxed text-red-700">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="flex w-full items-center justify-center rounded-[16px] bg-[#171717] px-5 py-3.5 text-sm font-semibold text-white shadow-[0_8px_22px_rgba(0,0,0,0.14)] transition hover:bg-[#252525] disabled:cursor-wait disabled:opacity-60"
              >
                {loading
                  ? mode === "activate" ? "Активируем..." : "Проверяем доступ..."
                  : mode === "activate" ? "Активировать и войти" : "Войти в админ-панель"}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
