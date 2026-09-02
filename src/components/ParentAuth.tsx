import { FormEvent, useState } from "react";
import {
  Eye,
  EyeOff,
  LockKeyhole,
  Phone,
  ShieldCheck,
} from "lucide-react";

import { Logo } from "@/components/Logo";
import {
  loginParent,
  registerParent,
} from "@/openStarsApi";
import { resetParentPassword } from "@/parentPasswordResetApi";

type ParentAuthProps = {
  onSuccess: () => void;
};

export function ParentAuth({
  onSuccess,
}: ParentAuthProps) {
  const [mode, setMode] = useState<
    "login" | "register" | "reset"
  >("login");

  const [phone, setPhone] = useState("");
  const [password, setPassword] =
    useState("");
  const [activationCode, setActivationCode] =
    useState("");
  const [resetCode, setResetCode] =
    useState("");

  const [showPassword, setShowPassword] =
    useState(false);

  const [loading, setLoading] =
    useState(false);

  const [error, setError] = useState("");
  const [message, setMessage] =
    useState("");

  const handleSubmit = async (
    event: FormEvent
  ) => {
    event.preventDefault();

    setError("");
    setMessage("");
    setLoading(true);

    try {
      if (mode === "login") {
        await loginParent(
          phone,
          password
        );

        onSuccess();
        return;
      }

      if (mode === "register") {
        await registerParent(
          phone,
          activationCode,
          password
        );

        setMessage(
          "Аккаунт создан. Теперь войдите по номеру телефона и паролю."
        );

        setPassword("");
        setActivationCode("");
        setMode("login");
        return;
      }

      const result = await resetParentPassword(
        phone,
        resetCode,
        password
      );

      setMessage(result.message);
      setPassword("");
      setResetCode("");
      setShowPassword(false);
      setMode("login");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Что-то пошло не так."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FAF9F5]">
      <div className="grid min-h-screen lg:grid-cols-[1.05fr_0.95fr]">
        {/* Левая часть */}
        <div
          className="
            relative
            hidden
            overflow-hidden
            bg-[#171717]
            px-12
            py-10
            text-white
            lg:flex
            lg:flex-col
            lg:justify-between
          "
        >
          <div
            className="
              absolute
              -right-32
              -top-32
              h-[420px]
              w-[420px]
              rounded-full
              bg-[#D96A24]/20
              blur-3xl
            "
          />

          <div
            className="
              absolute
              -bottom-40
              -left-32
              h-[430px]
              w-[430px]
              rounded-full
              bg-[#5F6338]/30
              blur-3xl
            "
          />

          <div className="relative">
            <Logo />
          </div>

          <div className="relative max-w-xl">
            <p
              className="
                text-[12px]
                font-semibold
                uppercase
                tracking-[0.22em]
                text-[#E8752A]
              "
            >
              Родительский портал
            </p>

            <h1
              className="
                mt-5
                text-5xl
                font-semibold
                leading-[1.05]
                tracking-[-0.045em]
              "
            >
              Всё важное
              <br />
              о развитии ребёнка
              <br />
              в одном месте.
            </h1>

            <p
              className="
                mt-6
                max-w-md
                text-[16px]
                leading-relaxed
                text-white/55
              "
            >
              Расписание, успеваемость,
              задания, комментарии
              педагогов, Star Coin и важная
              информация OPEN STARS.
            </p>
          </div>

          <div
            className="
              relative
              flex
              items-center
              gap-2
              text-sm
              text-white/40
            "
          >
            <ShieldCheck
              size={17}
              strokeWidth={1.8}
            />

            Доступ только для родителей
            учеников OPEN STARS
          </div>
        </div>

        {/* Форма */}
        <div
          className="
            flex
            items-center
            justify-center
            px-5
            py-10
            sm:px-8
          "
        >
          <div className="w-full max-w-md">
            <div className="mb-9 lg:hidden">
              <Logo />
            </div>

            <div>
              <p
                className="
                  text-[11px]
                  font-bold
                  uppercase
                  tracking-[0.20em]
                  text-[#D96A24]
                "
              >
                OPEN STARS
              </p>

              <h2
                className="
                  mt-2
                  text-3xl
                  font-semibold
                  tracking-[-0.035em]
                  text-[#171717]
                "
              >
                {mode === "login"
                  ? "Вход для родителей"
                  : mode === "register"
                    ? "Первый вход"
                    : "Новый пароль"}
              </h2>

              <p
                className="
                  mt-2
                  text-sm
                  leading-relaxed
                  text-black/45
                "
              >
                {mode === "login"
                  ? "Введите номер телефона и пароль."
                  : mode === "register"
                    ? "Используйте номер телефона, который указан в карточке родителя."
                    : "Введите номер телефона, код восстановления от администратора и придумайте новый пароль."}
              </p>
            </div>

            {mode !== "reset" ? (
              <div
                className="
                  mt-7
                  grid
                  grid-cols-2
                  rounded-[16px]
                  bg-black/[0.045]
                  p-1
                "
              >
                <button
                  type="button"
                  onClick={() => {
                    setMode("login");
                    setError("");
                    setMessage("");
                  }}
                  className={`
                    rounded-[13px]
                    px-4
                    py-2.5
                    text-sm
                    font-semibold
                    transition
                    ${
                      mode === "login"
                        ? "bg-white text-[#171717] shadow-sm"
                        : "text-black/45"
                    }
                  `}
                >
                  Войти
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setMode("register");
                    setError("");
                    setMessage("");
                  }}
                  className={`
                    rounded-[13px]
                    px-4
                    py-2.5
                    text-sm
                    font-semibold
                    transition
                    ${
                      mode === "register"
                        ? "bg-white text-[#171717] shadow-sm"
                        : "text-black/45"
                    }
                  `}
                >
                  Первый вход
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setMode("login");
                  setError("");
                  setMessage("");
                  setPassword("");
                  setResetCode("");
                }}
                className="mt-6 text-sm font-semibold text-[#5F6338]"
              >
                ← Вернуться ко входу
              </button>
            )}

            <form
              onSubmit={handleSubmit}
              className="mt-6 space-y-4"
            >
              {/* Телефон */}
              <div>
                <label
                  htmlFor="phone"
                  className="
                    mb-2
                    block
                    text-xs
                    font-semibold
                    text-[#171717]
                  "
                >
                  Номер телефона
                </label>

                <div className="relative">
                  <Phone
                    size={18}
                    strokeWidth={1.9}
                    className="
                      absolute
                      left-4
                      top-1/2
                      -translate-y-1/2
                      text-[#5F6338]
                    "
                  />

                  <input
                    id="phone"
                    type="tel"
                    value={phone}
                    onChange={(e) =>
                      setPhone(e.target.value)
                    }
                    placeholder="+7 999 123-45-67"
                    autoComplete="tel"
                    required
                    className="
                      h-13
                      w-full
                      rounded-[16px]
                      border
                      border-black/[0.08]
                      bg-white
                      py-3.5
                      pl-12
                      pr-4
                      text-[15px]
                      text-[#171717]
                      outline-none
                      transition
                      placeholder:text-black/25
                      focus:border-[#D96A24]/50
                      focus:ring-4
                      focus:ring-[#D96A24]/[0.07]
                    "
                  />
                </div>
              </div>

              {/* Код активации */}
              {mode === "register" && (
                <div>
                  <label
                    htmlFor="activationCode"
                    className="
                      mb-2
                      block
                      text-xs
                      font-semibold
                      text-[#171717]
                    "
                  >
                    Код активации
                  </label>

                  <div className="relative">
                    <ShieldCheck
                      size={18}
                      strokeWidth={1.9}
                      className="
                        absolute
                        left-4
                        top-1/2
                        -translate-y-1/2
                        text-[#D96A24]
                      "
                    />

                    <input
                      id="activationCode"
                      type="text"
                      value={activationCode}
                      onChange={(e) =>
                        setActivationCode(
                          e.target.value
                            .toUpperCase()
                            .slice(0, 6)
                        )
                      }
                      placeholder="6 символов"
                      required
                      maxLength={6}
                      className="
                        h-13
                        w-full
                        rounded-[16px]
                        border
                        border-black/[0.08]
                        bg-white
                        py-3.5
                        pl-12
                        pr-4
                        text-[15px]
                        font-semibold
                        uppercase
                        tracking-[0.15em]
                        text-[#171717]
                        outline-none
                        transition
                        placeholder:font-normal
                        placeholder:normal-case
                        placeholder:tracking-normal
                        placeholder:text-black/25
                        focus:border-[#D96A24]/50
                        focus:ring-4
                        focus:ring-[#D96A24]/[0.07]
                      "
                    />
                  </div>
                </div>
              )}

              {/* Код восстановления */}
              {mode === "reset" && (
                <div>
                  <label
                    htmlFor="resetCode"
                    className="
                      mb-2
                      block
                      text-xs
                      font-semibold
                      text-[#171717]
                    "
                  >
                    Код восстановления
                  </label>

                  <div className="relative">
                    <ShieldCheck
                      size={18}
                      strokeWidth={1.9}
                      className="
                        absolute
                        left-4
                        top-1/2
                        -translate-y-1/2
                        text-[#D96A24]
                      "
                    />

                    <input
                      id="resetCode"
                      type="text"
                      value={resetCode}
                      onChange={(e) =>
                        setResetCode(
                          e.target.value
                            .toUpperCase()
                            .slice(0, 6)
                        )
                      }
                      placeholder="6 символов"
                      required
                      maxLength={6}
                      autoComplete="one-time-code"
                      className="
                        h-13
                        w-full
                        rounded-[16px]
                        border
                        border-black/[0.08]
                        bg-white
                        py-3.5
                        pl-12
                        pr-4
                        text-[15px]
                        font-semibold
                        uppercase
                        tracking-[0.15em]
                        text-[#171717]
                        outline-none
                        transition
                        placeholder:font-normal
                        placeholder:normal-case
                        placeholder:tracking-normal
                        placeholder:text-black/25
                        focus:border-[#D96A24]/50
                        focus:ring-4
                        focus:ring-[#D96A24]/[0.07]
                      "
                    />
                  </div>
                </div>
              )}

              {/* Пароль */}
              <div>
                <label
                  htmlFor="password"
                  className="
                    mb-2
                    block
                    text-xs
                    font-semibold
                    text-[#171717]
                  "
                >
                  {mode === "login"
                    ? "Пароль"
                    : mode === "register"
                      ? "Придумайте пароль"
                      : "Новый пароль"}
                </label>

                <div className="relative">
                  <LockKeyhole
                    size={18}
                    strokeWidth={1.9}
                    className="
                      absolute
                      left-4
                      top-1/2
                      -translate-y-1/2
                      text-[#5F6338]
                    "
                  />

                  <input
                    id="password"
                    type={
                      showPassword
                        ? "text"
                        : "password"
                    }
                    value={password}
                    onChange={(e) =>
                      setPassword(e.target.value)
                    }
                    placeholder={
                      mode === "login"
                        ? "Введите пароль"
                        : "Минимум 8 символов"
                    }
                    minLength={8}
                    required
                    autoComplete={
                      mode === "login"
                        ? "current-password"
                        : "new-password"
                    }
                    className="
                      h-13
                      w-full
                      rounded-[16px]
                      border
                      border-black/[0.08]
                      bg-white
                      py-3.5
                      pl-12
                      pr-12
                      text-[15px]
                      text-[#171717]
                      outline-none
                      transition
                      placeholder:text-black/25
                      focus:border-[#D96A24]/50
                      focus:ring-4
                      focus:ring-[#D96A24]/[0.07]
                    "
                  />

                  <button
                    type="button"
                    onClick={() =>
                      setShowPassword(
                        (value) => !value
                      )
                    }
                    className="
                      absolute
                      right-3
                      top-1/2
                      grid
                      h-9
                      w-9
                      -translate-y-1/2
                      place-items-center
                      rounded-full
                      text-black/35
                      transition
                      hover:bg-black/[0.04]
                    "
                  >
                    {showPassword ? (
                      <EyeOff
                        size={17}
                        strokeWidth={1.8}
                      />
                    ) : (
                      <Eye
                        size={17}
                        strokeWidth={1.8}
                      />
                    )}
                  </button>
                </div>

                {mode === "login" && (
                  <button
                    type="button"
                    onClick={() => {
                      setMode("reset");
                      setError("");
                      setMessage("");
                      setPassword("");
                    }}
                    className="mt-2 text-sm font-semibold text-[#D96A24]"
                  >
                    Забыли пароль?
                  </button>
                )}
              </div>

              {error && (
                <div
                  className="
                    rounded-[14px]
                    border
                    border-red-500/10
                    bg-red-500/[0.06]
                    px-4
                    py-3
                    text-sm
                    leading-relaxed
                    text-red-700
                  "
                >
                  {error}
                </div>
              )}

              {message && (
                <div
                  className="
                    rounded-[14px]
                    border
                    border-[#5F6338]/10
                    bg-[#5F6338]/[0.07]
                    px-4
                    py-3
                    text-sm
                    leading-relaxed
                    text-[#4D512E]
                  "
                >
                  {message}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="
                  mt-2
                  flex
                  w-full
                  items-center
                  justify-center
                  rounded-[16px]
                  bg-[#171717]
                  px-5
                  py-3.5
                  text-sm
                  font-semibold
                  text-white
                  shadow-[0_8px_22px_rgba(0,0,0,0.14)]
                  transition
                  hover:bg-[#252525]
                  disabled:cursor-wait
                  disabled:opacity-60
                "
              >
                {loading
                  ? "Подождите..."
                  : mode === "login"
                    ? "Войти"
                    : mode === "register"
                      ? "Активировать доступ"
                      : "Сохранить новый пароль"}
              </button>
            </form>

            {mode === "register" && (
              <p
                className="
                  mt-5
                  text-center
                  text-xs
                  leading-relaxed
                  text-black/40
                "
              >
                Код активации выдаёт
                администратор OPEN STARS.
                Он используется только при
                первом входе.
              </p>
            )}

            {mode === "reset" && (
              <p className="mt-5 text-center text-xs leading-relaxed text-black/40">
                Код восстановления выдаёт администратор OPEN STARS. Код действует 60 минут и используется один раз.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
