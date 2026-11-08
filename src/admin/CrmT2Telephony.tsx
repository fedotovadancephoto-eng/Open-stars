import { useEffect, useState } from "react";
import { CheckCircle2, Headphones, LoaderCircle, RefreshCw } from "lucide-react";

import { getValidStaffSession } from "@/admin/adminApi";

const SUPABASE_URL = "https://yiwiykbuaggyslfyhlfo.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_1MORh5rY7uMDVYLYVX5VAA_cyoph4-7";
type Status = { connected: boolean; phoneLast4: string; connectedAt: string | null; lastSyncedAt: string | null };
async function requestT2(body: Record<string, string>) {
  const session = await getValidStaffSession();
  if (!session) throw new Error("Войди в аккаунт директора повторно.");
  const response = await fetch(SUPABASE_URL + "/functions/v1/t2-crm-bridge", {
    method: "POST",
    headers: {
      apikey: SUPABASE_PUBLISHABLE_KEY,
      Authorization: "Bearer " + session.access_token,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const result = await response.json();
  if (!response.ok) {
    if (result.error === "t2_auth_failed") throw new Error("Токены не подошли. Сгенерируй новую пару в кабинете АТС Т2.");
    if (result.error === "t2_tokens_expired") throw new Error("Токены Т2 истекли. Сгенерируй новую пару в кабинете АТС.");
    throw new Error("Не удалось связаться с Т2. Проверь активацию АТС и попробуй снова.");
  }
  return result;
}
function when(value: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("ru-RU", { dateStyle: "short", timeStyle: "short" }).format(new Date(value));
}

export function CrmT2Telephony() {
  const [status, setStatus] = useState<Status | null>(null);
  const [access, setAccess] = useState("");
  const [refresh, setRefresh] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    let active = true;
    void requestT2({ action: "status" })
      .then((data) => { if (active) setStatus(data); })
      .catch(() => { if (active) setError("Статус телефонии временно недоступен."); });
    return () => { active = false; };
  }, []);

  async function connect() {
    if (!access.trim() || !refresh.trim()) return;
    setBusy(true); setError(""); setMessage("");
    try {
      await requestT2({ action: "connect", accessToken: access.trim(), refreshToken: refresh.trim() });
      setAccess(""); setRefresh("");
      setStatus(await requestT2({ action: "status" }));
      setMessage("Т2 подключён к CRM. Теперь синхронизируй историю звонков.");
    } catch (e) { setError(e instanceof Error ? e.message : "Ошибка подключения."); }
    finally { setBusy(false); }
  }
  async function sync() {
    setBusy(true); setError(""); setMessage("");
    try {
      const result = await requestT2({ action: "sync" });
      setStatus(await requestT2({ action: "status" }));
      setMessage("Синхронизация завершена. Связано с карточками клиентов: " + result.saved + ". Неоднозначные и неизвестные номера: " + result.unmatched + ". Обнови карточку клиента, чтобы увидеть звонки.");
    } catch (e) { setError(e instanceof Error ? e.message : "Ошибка синхронизации."); }
    finally { setBusy(false); }
  }

  return (
    <section className="mt-4 rounded-[22px] border border-black/[0.06] bg-white p-4">
      <div className="flex items-center gap-2">
        <Headphones size={18} className="text-[#D96A24]" />
        <h3 className="font-semibold">Телефония Т2</h3>
        {status?.connected && <CheckCircle2 size={17} className="ml-auto text-[#5F6338]" />}
      </div>
      <p className="mt-2 text-sm leading-6 text-black/55">
        {status?.connected ? "АТС связана с CRM. Рабочий номер оканчивается на " + status.phoneLast4 + "." :
          "Интеграция CRM подготовлена. Для реальных звонков сначала активируй корпоративную АТС Т2, затем добавь её API-токены."}
      </p>
      {status?.connected ? (
        <div className="mt-3">
          <p className="text-xs text-black/45">Последняя синхронизация: {when(status.lastSyncedAt)}</p>
          <button type="button" disabled={busy} onClick={() => void sync()} className="mt-3 flex items-center gap-2 rounded-[13px] bg-[#171717] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-40">
            {busy ? <LoaderCircle size={16} className="animate-spin" /> : <RefreshCw size={16} />} Синхронизировать звонки
          </button>
          <details className="mt-3 text-xs text-black/55"><summary className="cursor-pointer">Обновить токены Т2</summary>
            <div className="mt-3 space-y-2">
              <input aria-label="Access token" type="password" autoComplete="off" value={access} onChange={(e) => setAccess(e.target.value)} placeholder="Access token" className="w-full rounded-xl border p-3" />
              <input aria-label="Refresh token" type="password" autoComplete="off" value={refresh} onChange={(e) => setRefresh(e.target.value)} placeholder="Refresh token" className="w-full rounded-xl border p-3" />
              <button type="button" disabled={busy || !access || !refresh} onClick={() => void connect()} className="rounded-xl bg-[#171717] px-4 py-2.5 text-white disabled:opacity-40">Обновить подключение</button>
            </div>
          </details>
        </div>
      ) : (
        <div className="mt-3 space-y-2">
          <a href="https://irkutsk.t2.ru/business/corp-pbx" target="_blank" rel="noopener noreferrer" className="block text-sm font-semibold text-[#D96A24] underline">Оформить корпоративную АТС Т2</a>
          <p className="text-xs leading-5 text-black/45">После активации открой кабинет АТС → название организации → «Токен API» → «Сгенерировать токен». Вводи токены только здесь, не отправляй их в переписке.</p>
          <input aria-label="Access token" type="password" autoComplete="off" value={access} onChange={(e) => setAccess(e.target.value)} placeholder="Access token" className="w-full rounded-xl border p-3" />
          <input aria-label="Refresh token" type="password" autoComplete="off" value={refresh} onChange={(e) => setRefresh(e.target.value)} placeholder="Refresh token" className="w-full rounded-xl border p-3" />
          <button type="button" disabled={busy || !access || !refresh} onClick={() => void connect()} className="flex items-center gap-2 rounded-xl bg-[#D96A24] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-40">
            {busy && <LoaderCircle size={16} className="animate-spin" />} Подключить Т2 к CRM
          </button>
        </div>
      )}
      {error && <p role="alert" className="mt-3 text-xs text-red-600">{error}</p>}
      {message && <p role="status" className="mt-3 text-xs text-[#5F6338]">{message}</p>}
    </section>
  );
}
