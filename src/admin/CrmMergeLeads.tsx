import { useState } from "react";
import { GitMerge, LoaderCircle } from "lucide-react";
import { mergeCrmLeads, type CrmLead, type CrmRole } from "@/admin/crmApi";

type Props = {
  lead: CrmLead;
  leads: CrmLead[];
  role: CrmRole;
  onMerged: () => Promise<void>;
};

function childKey(name: string) {
  return name.trim().replace(/\s+/g, " ").toLocaleLowerCase("ru-RU").replace(/ё/g, "е");
}

export function CrmMergeLeads({ lead, leads, role, onMerged }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [duplicateId, setDuplicateId] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  // UI permissions mirror the server RPC. Admins can see only their branch via CRM RLS.
  if (!["owner", "admin", "sales"].includes(role) || lead.isLost ||
    ["paid", "student"].includes(lead.stage) || lead.convertedChildId || lead.linkedExistingChildId) return null;

  const candidates = leads.filter(item =>
    item.id !== lead.id &&
    item.branch === lead.branch &&
    !!item.phoneNormalized &&
    item.phoneNormalized === lead.phoneNormalized &&
    childKey(item.childName) === childKey(lead.childName) &&
    (!lead.childBirthDate || !item.childBirthDate || lead.childBirthDate === item.childBirthDate) &&
    !["paid", "student"].includes(item.stage) &&
    !item.convertedChildId && !item.linkedExistingChildId
  );

  async function performMerge() {
    if (!duplicateId || !confirmed || busy) return;
    setBusy(true);
    setError("");
    try {
      await mergeCrmLeads(lead.id, duplicateId);
      setExpanded(false);
      setDuplicateId("");
      setConfirmed(false);
      await onMerged();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Не удалось объединить лиды.");
    } finally {
      setBusy(false);
    }
  }

  return <section className="mt-4 rounded-[18px] border border-black/10 bg-white p-4">
    <button type="button" onClick={() => { setExpanded(value => !value); setError(""); }}
      className="flex w-full items-center gap-2 text-left text-sm font-semibold">
      <GitMerge size={18} className="text-[#D96A24]"/>
      <span className="flex-1">Объединить с дублем</span>
      <span className="text-xs text-black/40">{expanded ? "Свернуть" : "Открыть"}</span>
    </button>
    {expanded && <div className="mt-3">
      <p className="text-xs leading-5 text-black/55">
        Основной останется эта карточка. Можно объединить только одного ребёнка с тем же телефоном
        в том же филиале. Задачи, история и обращения сохраняются. Действие нельзя отменить.
      </p>
      {candidates.length === 0 ? <p className="mt-3 rounded-xl bg-[#F7F5EF] p-3 text-sm text-black/50">
        Подходящих дублей с тем же ребёнком и телефоном сейчас нет.
      </p> : <>
        <label className="mt-3 block text-xs font-semibold text-black/60">
          Карточка-дубль, которую нужно объединить с основной
          <select className="mt-2 w-full rounded-xl border border-black/10 bg-white p-3 text-sm"
            value={duplicateId} onChange={event => { setDuplicateId(event.target.value); setConfirmed(false); }}>
            <option value="">Выберите дубль</option>
            {candidates.map(item => <option key={item.id} value={item.id}>
              {item.childName} · {item.parentName} · {item.source} · {item.isLost ? "Потерян" : item.stage}
            </option>)}
          </select>
        </label>
        <label className="mt-3 flex items-start gap-2 text-xs leading-5 text-black/70">
          <input type="checkbox" className="mt-1" checked={confirmed} onChange={event => setConfirmed(event.target.checked)}/>
          Я проверил(а), что это один и тот же ребёнок. Сохраняем текущую карточку основной.
        </label>
        <button type="button" disabled={busy || !duplicateId || !confirmed}
          onClick={() => void performMerge()}
          className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-[#171717] px-4 py-3 text-sm font-semibold text-white disabled:opacity-40">
          {busy ? <LoaderCircle size={16} className="animate-spin"/> : <GitMerge size={16}/>}
          Подтвердить объединение
        </button>
      </>}
      {error && <p role="alert" className="mt-2 text-xs text-red-700">{error}</p>}
    </div>}
  </section>;
}
