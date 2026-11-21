import { useEffect, useState } from "react";
import { fetchStaffAccessContext, getStaffSession, StaffAccessContextData, STAFF_SESSION_CHANGED_EVENT } from "@/admin/adminApi";
import { selectedStaffContext, switchStaffContext } from "@/temporaryStaffContext";

export function TemporaryStaffAccess() {
  const [context, setContext] = useState<StaffAccessContextData | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    let busy = false;
    async function refresh() {
      if (busy) return;
      if (!getStaffSession()) { if (active) setContext(null); return; }
      busy = true;
      try {
        const next = await fetchStaffAccessContext();
        if (!active) return;
        if (selectedStaffContext() && !next.selectedValid) {
          switchStaffContext("", next.baseRole);
          return;
        }
        setContext(next); setError("");
      } catch {
        if (active && selectedStaffContext()) setError("Не удалось проверить временный доступ. Обновите страницу.");
      } finally { busy = false; }
    }
    void refresh();
    const timer = window.setInterval(() => void refresh(), 60_000);
    const handler = () => { void refresh(); };
    window.addEventListener(STAFF_SESSION_CHANGED_EVENT, handler);
    window.addEventListener("focus", handler);
    return () => {
      active = false; window.clearInterval(timer);
      window.removeEventListener(STAFF_SESSION_CHANGED_EVENT, handler);
      window.removeEventListener("focus", handler);
    };
  }, []);
  if (!context?.grants.length && !selectedStaffContext()) return null;
  if (!context) return error ? <p role="alert" className="bg-amber-50 px-5 py-3 text-sm">{error}</p> : null;
  const selected = selectedStaffContext();
  const grant = context.grants.find(item => item.key === selected);
  const baseLabel = context.baseRole === "sales" ? "Продажник · CRM" : `Администратор · ${context.baseBranch || "основной округ"}`;
  return <section aria-label="Рабочая роль" className="border-b border-[#D96A24]/20 bg-[#FFF9F3] px-5 py-4">
    <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-3">
      <label className="text-sm font-semibold" htmlFor="temporary-staff-context">Рабочая роль</label>
      <select id="temporary-staff-context" value={selected} onChange={event => switchStaffContext(event.target.value, context.baseRole)} className="max-w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-sm">
        <option value="">Основная: {baseLabel}</option>
        {context.grants.map(item => <option key={item.key} value={item.key}>Временно: Администратор · {item.branch}</option>)}
      </select>
      <p className="text-xs text-black/60">{grant ? "Временный доступ" : "Дополнительный доступ"} до {new Date((grant || context.grants[0]).expiresAt).toLocaleString("ru-RU", { timeZone: "Asia/Irkutsk", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })} (Иркутск). Отключится автоматически.</p>
      {error && <p role="alert" className="w-full text-sm text-red-700">{error}</p>}
    </div>
  </section>;
}
