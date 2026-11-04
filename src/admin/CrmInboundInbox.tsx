import { useEffect, useState } from "react";
import { Check, Inbox, LoaderCircle, X } from "lucide-react";
import {
  CrmRole,
  CrmInboundItem,
  fetchCrmInboundItems,
  processCrmInboundItem,
} from "@/admin/crmApi";

const branches = ["НЛО", "Октябрьский", "Свердловский"];
const labels: Record<CrmInboundItem["source"], string> = {
  site: "Сайт",
  vk: "ВКонтакте",
  instagram: "Instagram",
};
const inputClass = "mt-1 w-full rounded-xl border border-black/10 bg-white px-3 py-2.5 text-sm";

function nextDay() {
  const date = new Date(Date.now() + 24 * 60 * 60 * 1000);
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().slice(0, 16);
}

export function CrmInboundInbox({
  role, staffBranch, onConverted,
}: {
  role: CrmRole | null;
  staffBranch: string;
  onConverted: () => void;
}) {
  const [items, setItems] = useState<CrmInboundItem[]>([]);
  const [selected, setSelected] = useState<CrmInboundItem | null>(null);
  const [branch, setBranch] = useState("НЛО");
  const [childName, setChildName] = useState("");
  const [parentName, setParentName] = useState("");
  const [parentPhone, setParentPhone] = useState("");
  const [nextContact, setNextContact] = useState(nextDay());
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [expanded, setExpanded] = useState(() => new URLSearchParams(window.location.search).get("inbox") === "1");

  async function load() {
    setLoading(true);
    try {
      setItems(await fetchCrmInboundItems());
      setError("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Не удалось загрузить входящие.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { if (role && ["owner", "manager", "sales"].includes(role)) void load(); }, [role]);

  function choose(item: CrmInboundItem) {
    setSelected(item);
    setBranch(role === "admin" ? staffBranch : item.branch || "НЛО");
    setParentName(item.senderName || "");
    setParentPhone(item.senderPhone || "");
    setChildName("");
    setNextContact(nextDay());
    setError("");
  }

  async function process(action: "ignore" | "convert") {
    if (!selected || busy) return;
    if (action === "convert" && (!childName.trim() || !parentName.trim() || !parentPhone.trim() || !nextContact)) {
      setError("Для создания CRM-лида нужны имя ученика, имя контактного лица, телефон и следующий контакт.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await processCrmInboundItem({
        id: selected.id,
        action,
        branch: role === "admin" ? staffBranch : branch,
        childName, parentName, parentPhone,
        nextContactAt: new Date(nextContact).toISOString(),
      });
      setSelected(null);
      await load();
      if (action === "convert") onConverted();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Не удалось обработать обращение.");
    } finally {
      setBusy(false);
    }
  }

  if (!role || !["owner", "manager", "sales"].includes(role)) return null;
  return (
    <section className="mt-5 rounded-[22px] bg-white p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Inbox size={20} className="text-[#D96A24]"/>
          <div>
            <h2 className="font-semibold">Входящие обращения</h2>
            <p className="text-xs text-black/45">Сайт и соцсети · ожидают проверки: {items.length}</p>
          </div>
        </div>
        <button type="button" onClick={() => { setExpanded(value => !value); if (!expanded) void load(); }}
          className="rounded-xl bg-[#F7F5EF] px-3 py-2 text-xs font-semibold">
          {expanded ? "Свернуть" : "Открыть"}
        </button>
      </div>
      {expanded && <>
        <p className="mt-3 text-xs leading-5 text-black/50">Обращение ещё не является CRM-лидом. Отметьте нерелевантное или заполните недостающие сведения и создайте лид.</p>
        {loading && <p className="mt-3 flex items-center gap-2 text-sm text-black/45"><LoaderCircle size={15} className="animate-spin"/>Загрузка…</p>}
        {error && <p role="alert" className="mt-3 rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
        <div className="mt-3 space-y-2">
          {items.map(item => <button key={item.id} type="button" onClick={() => choose(item)}
            className="flex w-full items-start justify-between gap-3 rounded-xl border border-black/[0.07] p-3 text-left">
            <div className="min-w-0">
              <p className="text-sm font-semibold">{item.senderName || item.senderPhone || item.senderId || "Без имени"}</p>
              <p className="mt-1 truncate text-xs text-black/50">{item.message || item.eventType}</p>
            </div>
            <span className="shrink-0 rounded-lg bg-[#F7F5EF] px-2 py-1 text-xs">{labels[item.source]}</span>
          </button>)}
          {!loading && items.length === 0 && <p className="py-5 text-center text-sm text-black/45">Новых обращений нет.</p>}
        </div>
      </>}
      {selected && <div className="fixed inset-0 z-[90] overflow-y-auto bg-black/30 p-3">
        <div className="mx-auto max-w-lg rounded-2xl bg-[#FAF9F5] p-5">
          <div className="flex items-center justify-between">
            <div><p className="text-xs font-semibold text-[#D96A24]">{labels[selected.source]}</p><h3 className="text-xl font-semibold">Обработка обращения</h3></div>
            <button type="button" onClick={() => { setSelected(null); setError(""); }} className="rounded-full bg-white p-2"><X size={20}/></button>
          </div>
          <div className="mt-4 rounded-xl bg-white p-3 text-sm">
            <p>{selected.senderName || "Контакт не указан"} · {selected.senderPhone || selected.senderEmail || selected.senderId || "Без контакта"}</p>
            <p className="mt-2 whitespace-pre-wrap text-black/65">{selected.message || "Без текста"}</p>
            {selected.requestedBranch && <p className="mt-2 text-xs text-black/45">Запрошенный филиал: {selected.requestedBranch}</p>}
            {selected.campaign && <p className="mt-2 text-xs text-black/45">Кампания: {selected.campaign}</p>}
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <label className="text-xs font-semibold text-black/50">Филиал<select disabled={role === "admin"} className={inputClass} value={role === "admin" ? staffBranch : branch} onChange={event => setBranch(event.target.value)}>{branches.map(item => <option key={item}>{item}</option>)}</select></label>
            <label className="text-xs font-semibold text-black/50">Имя ученика / клиента<input className={inputClass} value={childName} onChange={event => setChildName(event.target.value)}/></label>
            <label className="text-xs font-semibold text-black/50">Контактное лицо<input className={inputClass} value={parentName} onChange={event => setParentName(event.target.value)}/></label>
            <label className="text-xs font-semibold text-black/50">Телефон<input className={inputClass} inputMode="tel" value={parentPhone} onChange={event => setParentPhone(event.target.value)}/></label>
            <label className="text-xs font-semibold text-black/50 sm:col-span-2">Следующий контакт<input className={inputClass} type="datetime-local" value={nextContact} onChange={event => setNextContact(event.target.value)}/></label>
          </div>
          {error && <p role="alert" className="mt-3 rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
          <div className="mt-4 flex gap-2">
            <button disabled={busy} onClick={() => void process("ignore")} className="rounded-xl bg-white px-4 py-3 text-sm font-semibold disabled:opacity-50">Не заявка</button>
            <button disabled={busy} onClick={() => void process("convert")} className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-[#D96A24] px-4 py-3 text-sm font-semibold text-white disabled:opacity-50"><Check size={17}/>Создать лид</button>
          </div>
        </div>
      </div>}
    </section>
  );
}
