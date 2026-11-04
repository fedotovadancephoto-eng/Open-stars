import { useEffect, useState } from "react";
import { Check, Copy, Link2, LoaderCircle, ShieldCheck } from "lucide-react";
import { createCrmVkSetup, fetchCrmVkSetup, syncCrmVkExistingSecret } from "@/admin/crmApi";

const VK_CALLBACK_URL = "https://yiwiykbuaggyslfyhlfo.supabase.co/functions/v1/crm-inbound-webhook?source=vk";

export function CrmVkConnection() {
  const [groupId, setGroupId] = useState("176730512");
  const [confirmation, setConfirmation] = useState("");
  const [secret, setSecret] = useState("");
  const [existingVkSecret, setExistingVkSecret] = useState("");
  const [configured, setConfigured] = useState(false);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    let active = true;
    fetchCrmVkSetup().then(result => {
      if (!active) return;
      setConfigured(result.configured);
      if (result.group_id) setGroupId(result.group_id);
      if (result.confirmation_code) setConfirmation(result.confirmation_code);
    }).catch(cause => {
      if (active) setError(cause instanceof Error ? cause.message : "Не удалось загрузить настройки VK");
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => { active = false; };
  }, []);

  async function copy(value: string, label: string) {
    try {
      await navigator.clipboard.writeText(value);
      setNotice(label + " скопирован");
      setError("");
    } catch {
      setError("Не удалось скопировать автоматически. Нажмите и удерживайте значение, чтобы скопировать вручную.");
    }
  }

  async function generate() {
    if (busy) return;
    if (!/^[1-9][0-9]{0,14}$/.test(groupId.trim())) {
      setError("Проверьте числовой ID сообщества");
      return;
    }
    if (!/^[A-Za-z0-9_-]{4,128}$/.test(confirmation.trim())) {
      setError("Вставьте строку подтверждения из VK Callback API");
      return;
    }
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const result = await createCrmVkSetup(groupId.trim(), confirmation.trim());
      setSecret(result.secret);
      setConfigured(true);
      setNotice("Создан новый ключ из 32 символов, совместимый с VK. Скопируйте его в настройки нового сервера VK: после обновления страницы он больше не показывается.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Не удалось подготовить подключение VK");
    } finally {
      setBusy(false);
    }
  }

  async function syncExisting() {
    if (busy) return;
    const value = existingVkSecret.trim();
    if (!/^[0-9a-f]{32}$/.test(value)) {
      setError("Нужен ключ из 32 символов, уже сохранённый в настройках Сервера 6 ВКонтакте.");
      return;
    }
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await syncCrmVkExistingSecret(groupId.trim(), value);
      setExistingVkSecret("");
      setNotice("Ключ CRM синхронизирован с ВКонтакте. Теперь можно проверить тестовое сообщение.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Не удалось синхронизировать ключ ВКонтакте.");
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return <section className="mt-5 rounded-[22px] border border-black/[0.07] bg-white p-4 text-sm text-black/55">Загрузка настроек ВКонтакте…</section>;
  }

  // A configured callback is not proof of successful event delivery.
  // Keep setup available to the owner, but do not show the long setup form by default.
  if (configured && !editing && !secret) {
    return (
      <section className="mt-5 rounded-[22px] border border-black/[0.07] bg-white p-4">
        <div className="flex items-center gap-2">
          <Link2 size={20} className="text-[#D96A24]"/>
          <div className="flex-1">
            <h2 className="font-semibold">Сервер ВКонтакте</h2>
            <p className="text-xs text-black/50">Настройки сохранены · передача сообщений ещё не подтверждена</p>
          </div>
          <button type="button" onClick={() => setEditing(true)}
            className="rounded-xl bg-[#F7F5EF] px-3 py-2 text-xs font-semibold">Настройки</button>
        </div>
        <p className="mt-3 text-xs leading-5 text-amber-800">
          Если сообщение не приходит, откройте «Настройки», скопируйте действующий секретный ключ
          из VK → Callback API → Сервер 6 и синхронизируйте его с CRM.
          Не нужно генерировать новый ключ или менять amoCRM.
        </p>
      </section>
    );
  }

  return (
    <section className="mt-5 rounded-[22px] border border-black/[0.07] bg-white p-4">
      <div className="flex items-center gap-2">
        <Link2 size={20} className="text-[#D96A24]"/>
        <div>
          <h2 className="font-semibold">Подключение ВКонтакте</h2>
          <p className="text-xs text-black/50">Для владельца CRM · без перехода в Supabase</p>
        </div>
      </div>
      <p className="mt-3 text-sm leading-6 text-black/65">
        В сообществе VK откройте «Управление → Работа с API → Callback API».
        Скопируйте оттуда строку подтверждения и вставьте ниже.
        Если VK показывает другой ID сообщества, исправьте его.
      </p>

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <label className="text-xs font-semibold text-black/60">
          ID сообщества
          <input className="mt-1 w-full rounded-xl border border-black/10 px-3 py-3 text-sm"
            inputMode="numeric" value={groupId} onChange={event => setGroupId(event.target.value)}/>
        </label>
        <label className="text-xs font-semibold text-black/60">
          Строка подтверждения из VK
          <input className="mt-1 w-full rounded-xl border border-black/10 px-3 py-3 text-sm"
            value={confirmation} onChange={event => setConfirmation(event.target.value)}
            placeholder="Код из раздела Callback API"/>
        </label>
      </div>

      <button type="button" disabled={busy} onClick={() => void generate()}
        className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-[#D96A24] px-4 py-3 text-sm font-semibold text-white disabled:opacity-50">
        {busy ? <LoaderCircle size={16} className="animate-spin"/> : <ShieldCheck size={16}/>}
        {configured ? "Сгенерировать новый ключ" : "Подготовить подключение"}
      </button>
      {configured && <p className="mt-2 text-xs text-amber-800">
        Новый ключ заменяет предыдущий. Скопируйте все 32 символа без пробелов и сохраните ключ на новом сервере VK.
      </p>}

      {configured && !secret && <div className="mt-4 rounded-xl border border-black/10 bg-[#F7F5EF] p-3">
        <p className="text-sm font-semibold">Ключ уже сохранён в ВК?</p>
        <p className="mt-1 text-xs leading-5 text-black/60">
          Скопируйте текущий секретный ключ из VK → Callback API → Сервер 6 и вставьте сюда.
          CRM проверит его формат и сохранит только защищённый отпечаток. Новый ключ создавать не нужно.
        </p>
        <label className="mt-3 block text-xs font-semibold text-black/60">
          Текущий ключ из VK (32 символа)
          <input type="password" autoComplete="off" spellCheck={false}
            className="mt-1 w-full rounded-xl border border-black/10 bg-white px-3 py-3 text-sm"
            value={existingVkSecret} onChange={event => setExistingVkSecret(event.target.value)}
            placeholder="Вставить ключ, не отправляя его в чат"/>
        </label>
        <button type="button" disabled={busy || !existingVkSecret}
          onClick={() => void syncExisting()}
          className="mt-2 w-full rounded-xl bg-[#D96A24] px-3 py-3 text-xs font-semibold text-white disabled:opacity-50">
          Синхронизировать ключ с ВК
        </button>
      </div>}

      <div className="mt-4 rounded-xl bg-[#F7F5EF] p-3">
        <p className="text-xs font-semibold text-black/55">Адрес сервера для VK</p>
        <p className="mt-1 break-all text-xs">{VK_CALLBACK_URL}</p>
        <button type="button" onClick={() => void copy(VK_CALLBACK_URL, "Адрес")}
          className="mt-2 inline-flex items-center gap-2 rounded-lg bg-white px-3 py-2 text-xs font-semibold">
          <Copy size={14}/> Скопировать адрес
        </button>
      </div>

      {secret && <div className="mt-3 rounded-xl border border-[#D96A24]/20 bg-[#FFF7F0] p-3">
        <p className="text-xs font-semibold">Секретный ключ для VK — 32 символа (показывается один раз)</p>
        <p className="mt-2 break-all font-mono text-xs">{secret}</p>
        <div className="mt-2 flex flex-wrap gap-2">
          <button type="button" onClick={() => void copy(secret, "Ключ")}
            className="inline-flex items-center gap-2 rounded-lg bg-white px-3 py-2 text-xs font-semibold">
            <Copy size={14}/> Скопировать ключ
          </button>
          <button type="button" onClick={() => setSecret("")}
            className="rounded-lg bg-white px-3 py-2 text-xs font-semibold">Скрыть ключ</button>
        </div>
      </div>}

      {configured && <p className="mt-3 flex items-center gap-2 text-xs text-[#4D512E]">
        <Check size={15}/> Серверная конфигурация сохранена. Осталось подтвердить сервер и включить события в VK.
      </p>}
      <p className="mt-3 text-xs leading-5 text-black/50">
        В VK добавьте адрес сервера, вставьте секретный ключ в поле «Секретный ключ»,
        подтвердите сервер. Затем выберите события «Входящие сообщения» и, при наличии,
        «Новая заявка из лид-формы». Сообщения будут поступать в «Входящие обращения»
        для проверки менеджером, а не сразу в воронку.
      </p>
      <p className="mt-2 text-xs leading-5 text-amber-800">
        Перед включением реального потока проверьте согласия и требования к хранению
        персональных данных: текущая база Supabase расположена за пределами России.
      </p>
      {notice && <p role="status" className="mt-3 text-xs text-[#4D512E]">{notice}</p>}
      {error && <p role="alert" className="mt-3 text-xs text-red-700">{error}</p>}
    </section>
  );
}
