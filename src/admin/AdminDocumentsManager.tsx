import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, FileCheck2, LoaderCircle, Pencil, Search, X } from "lucide-react";

import { fetchStaffIdentity, StaffRole } from "@/admin/adminApi";
import { fetchStaffDocumentRegistry, StaffDocumentRow, upsertContractTerms } from "@/admin/documentAdminApi";
import { onAdminSection } from "@/admin/adminNavigation";

const BRANCHES = ["Октябрьский", "Свердловский", "НЛО"];
const inputClass = "mt-1.5 w-full rounded-[14px] border border-black/[0.08] bg-white px-3.5 py-3 text-sm text-[#171717] outline-none focus:border-[#D96A24]/45 focus:ring-4 focus:ring-[#D96A24]/[0.06]";

function money(value: number | null) {
  if (value == null) return "—";
  return new Intl.NumberFormat("ru-RU", { style: "currency", currency: "RUB", maximumFractionDigits: 0 }).format(value);
}

function statusLabel(value: string, optional = false) {
  if (value === "accept") return { text: "Подписано", cls: "bg-[#5F6338]/10 text-[#4D512E]" };
  if (value === "decline") return { text: "Отказ", cls: "bg-black/[0.055] text-black/55" };
  if (value === "revoke") return { text: "Отозвано", cls: "bg-amber-50 text-amber-700" };
  return { text: optional ? "Не выбрано" : "Ожидает", cls: "bg-[#D96A24]/10 text-[#C95320]" };
}

function defaultStart() { return "2026-09-01"; }
function defaultEnd() { return "2027-05-31"; }

export function AdminDocumentsManager() {
  const [open, setOpen] = useState(false);
  const [role, setRole] = useState<StaffRole | null>(null);
  const [rows, setRows] = useState<StaffDocumentRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [branch, setBranch] = useState("");
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<StaffDocumentRow | null>(null);
  const [startDate, setStartDate] = useState(defaultStart());
  const [endDate, setEndDate] = useState(defaultEnd());
  const [monthlyPrice, setMonthlyPrice] = useState("");
  const [totalPrice, setTotalPrice] = useState("");
  const [tariffName, setTariffName] = useState("Индивидуальный");
  const [tariffDescription, setTariffDescription] = useState("Обучение по программе OPEN STARS согласно расписанию.");

  async function refresh(nextBranch = branch) {
    const data = await fetchStaffDocumentRegistry(nextBranch);
    setRows(Array.isArray(data) ? data : []);
  }

  useEffect(() => onAdminSection("documents", () => {
    setOpen(true);
    setError("");
    setSuccess("");
    setLoading(true);
    Promise.all([fetchStaffIdentity(), fetchStaffDocumentRegistry("")])
      .then(([identity, data]) => { setRole(identity.role); setRows(Array.isArray(data) ? data : []); })
      .catch((reason) => setError(reason instanceof Error ? reason.message : "Не удалось открыть документы."))
      .finally(() => setLoading(false));
  }), []);

  const canFilterBranches = role === "owner" || role === "project_director" || role === "manager";
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((row) => !q || [row.child_name, row.parent_name, row.parent_phone, row.branch].some((value) => (value || "").toLowerCase().includes(q)));
  }, [rows, search]);

  function startEdit(row: StaffDocumentRow) {
    setEditing(row);
    setStartDate(row.start_date || defaultStart());
    setEndDate(row.end_date || defaultEnd());
    setMonthlyPrice(row.monthly_price == null ? "" : String(row.monthly_price));
    setTotalPrice(row.total_price == null ? "" : String(row.total_price));
    setTariffName("Индивидуальный");
    setTariffDescription("Обучение по программе OPEN STARS согласно расписанию.");
    setError(""); setSuccess("");
  }

  async function saveTerms() {
    if (!editing) return;
    const monthly = Number(monthlyPrice.replace(/\s/g, "").replace(",", "."));
    const total = totalPrice.trim() ? Number(totalPrice.replace(/\s/g, "").replace(",", ".")) : null;
    if (!startDate || !endDate) return setError("Укажите даты договора.");
    if (!Number.isFinite(monthly) || monthly < 0) return setError("Укажите корректную стоимость месяца.");
    if (total != null && (!Number.isFinite(total) || total < 0)) return setError("Проверьте полную стоимость.");

    setSaving(true); setError(""); setSuccess("");
    try {
      await upsertContractTerms({ childId: editing.child_id, startDate, endDate, monthlyPrice: monthly, totalPrice: total, tariffName, tariffDescription });
      await refresh(branch);
      setEditing(null);
      setSuccess(`Договор для ${editing.child_name} подготовлен. Родитель увидит его в своём кабинете.`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Не удалось сохранить договор.");
    } finally { setSaving(false); }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[80] overflow-y-auto bg-[#FAF9F5]">
      <div className="mx-auto min-h-screen w-full max-w-7xl px-4 pb-12 pt-[calc(env(safe-area-inset-top,0px)+1rem)] sm:px-6 lg:px-8">
        <div className="sticky top-0 z-10 -mx-4 mb-5 flex items-center justify-between gap-4 border-b border-black/[0.06] bg-[#FAF9F5]/95 px-4 py-4 backdrop-blur sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
          <div><p className="text-[10px] font-bold uppercase tracking-[0.19em] text-[#D96A24]">OPEN STARS · ДОКУМЕНТЫ</p><h1 className="mt-1 text-2xl font-semibold tracking-[-0.03em] text-[#171717]">Документы родителей</h1></div>
          <button type="button" onClick={() => setOpen(false)} className="grid h-11 w-11 place-items-center rounded-full bg-black/[0.055] text-black/60"><X className="h-5 w-5" /></button>
        </div>

        <div className="rounded-[22px] border border-black/[0.055] bg-white p-5 shadow-[0_8px_28px_rgba(0,0,0,0.03)]">
          <div className="flex items-start gap-3"><div className="grid h-11 w-11 shrink-0 place-items-center rounded-[15px] bg-[#D96A24]/10 text-[#C95320]"><FileCheck2 className="h-5 w-5" /></div><div><h2 className="font-semibold text-[#171717]">Контроль без 600 бумажных договоров</h2><p className="mt-1 text-sm leading-6 text-black/45">Сначала задайте индивидуальные условия обучения ребёнка. После этого родитель сможет открыть договор и подписать его отдельной галочкой в личном кабинете.</p></div></div>
        </div>

        {(error || success) && <div className={`mt-4 rounded-[16px] px-4 py-3 text-sm ${error ? "bg-red-50 text-red-700" : "bg-[#5F6338]/[0.08] text-[#4D512E]"}`}>{error || success}</div>}

        <div className="mt-4 grid gap-3 rounded-[20px] border border-black/[0.055] bg-white p-4 sm:grid-cols-[1fr_auto]">
          <label className="relative"><Search className="absolute left-3.5 top-3.5 h-4 w-4 text-black/30" /><input value={search} onChange={(e) => setSearch(e.target.value)} className="w-full rounded-[14px] border border-black/[0.08] bg-[#FAF9F5] py-3 pl-10 pr-3 text-sm outline-none focus:border-[#D96A24]/45" placeholder="Ребёнок, родитель или телефон" /></label>
          {canFilterBranches && <select value={branch} onChange={(e) => { const value=e.target.value; setBranch(value); setLoading(true); void refresh(value).catch((reason)=>setError(reason instanceof Error?reason.message:"Не удалось обновить список.")).finally(()=>setLoading(false)); }} className="rounded-[14px] border border-black/[0.08] bg-white px-3 py-3 text-sm"><option value="">Все филиалы</option>{BRANCHES.map((item)=><option key={item} value={item}>{item}</option>)}</select>}
        </div>

        {loading ? <div className="mt-6 flex items-center gap-3 rounded-[20px] bg-white p-6 text-sm text-black/50"><LoaderCircle className="h-5 w-5 animate-spin" /> Загружаем реестр…</div> : (
          <div className="mt-4 space-y-3">
            {filtered.map((row) => {
              const pd=statusLabel(row.personal_data_status); const ct=statusLabel(row.contract_status); const ph=statusLabel(row.photo_status,true);
              return <div key={row.child_id} className="rounded-[20px] border border-black/[0.055] bg-white p-4 sm:p-5">
                <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-[10px] font-bold uppercase tracking-[0.14em] text-black/35">{row.branch}</p><h3 className="mt-1 text-lg font-semibold text-[#171717]">{row.child_name}</h3><p className="mt-1 text-xs text-black/45">{row.parent_name || "Родитель не привязан"}{row.parent_phone ? ` · ${row.parent_phone}` : ""}</p></div><button type="button" onClick={()=>startEdit(row)} className="flex items-center gap-2 rounded-[14px] bg-[#171717] px-4 py-2.5 text-xs font-semibold text-white"><Pencil className="h-4 w-4" /> {row.terms_ready ? "Изменить договор" : "Настроить договор"}</button></div>
                <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4"><div className="rounded-[14px] bg-[#FAF9F5] p-3"><p className="text-[10px] uppercase tracking-[0.12em] text-black/35">Стоимость / мес.</p><p className="mt-1 text-sm font-semibold">{money(row.monthly_price)}</p></div><div className="rounded-[14px] bg-[#FAF9F5] p-3"><p className="text-[10px] uppercase tracking-[0.12em] text-black/35">Полная стоимость</p><p className="mt-1 text-sm font-semibold">{money(row.total_price)}</p></div><div className="rounded-[14px] bg-[#FAF9F5] p-3"><p className="text-[10px] uppercase tracking-[0.12em] text-black/35">Начало</p><p className="mt-1 text-sm font-semibold">{row.start_date || "—"}</p></div><div className="rounded-[14px] bg-[#FAF9F5] p-3"><p className="text-[10px] uppercase tracking-[0.12em] text-black/35">Окончание</p><p className="mt-1 text-sm font-semibold">{row.end_date || "—"}</p></div></div>
                <div className="mt-3 flex flex-wrap gap-2"><span className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${pd.cls}`}>ПД: {pd.text}</span><span className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${ct.cls}`}>Договор: {ct.text}</span><span className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${ph.cls}`}>Фото: {ph.text}</span>{row.esign_status==="accept"&&<span className="inline-flex items-center gap-1 rounded-full bg-[#5F6338]/10 px-2.5 py-1 text-[10px] font-bold text-[#4D512E]"><CheckCircle2 className="h-3 w-3" /> ЭП</span>}</div>
              </div>;
            })}
            {filtered.length===0 && <div className="rounded-[20px] bg-white p-7 text-center text-sm text-black/40">Ничего не найдено.</div>}
          </div>
        )}
      </div>

      {editing && <div className="fixed inset-0 z-[95] flex items-end justify-center bg-black/35 sm:items-center sm:p-6"><div className="max-h-[92vh] w-full max-w-xl overflow-y-auto rounded-t-[28px] bg-[#FAF9F5] p-5 shadow-2xl sm:rounded-[28px] sm:p-6"><div className="flex items-start justify-between gap-3"><div><p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#D96A24]">Индивидуальный договор</p><h3 className="mt-1 text-xl font-semibold">{editing.child_name}</h3><p className="mt-1 text-xs text-black/40">{editing.branch} · {editing.parent_name}</p></div><button type="button" onClick={()=>setEditing(null)} className="grid h-10 w-10 place-items-center rounded-full bg-black/[0.055]"><X className="h-5 w-5" /></button></div>
        <div className="mt-5 grid gap-3 sm:grid-cols-2"><label className="text-xs font-semibold text-black/55">Начало обучения<input type="date" value={startDate} onChange={(e)=>setStartDate(e.target.value)} className={inputClass}/></label><label className="text-xs font-semibold text-black/55">Окончание обучения<input type="date" value={endDate} onChange={(e)=>setEndDate(e.target.value)} className={inputClass}/></label><label className="text-xs font-semibold text-black/55">Стоимость месяца, ₽<input inputMode="decimal" value={monthlyPrice} onChange={(e)=>setMonthlyPrice(e.target.value)} className={inputClass} placeholder="6500"/></label><label className="text-xs font-semibold text-black/55">Полная стоимость, ₽<input inputMode="decimal" value={totalPrice} onChange={(e)=>setTotalPrice(e.target.value)} className={inputClass} placeholder="Оставьте пустым для авторасчёта"/></label></div>
        <label className="mt-3 block text-xs font-semibold text-black/55">Название тарифа<input value={tariffName} onChange={(e)=>setTariffName(e.target.value)} className={inputClass}/></label><label className="mt-3 block text-xs font-semibold text-black/55">Что входит в тариф<textarea value={tariffDescription} onChange={(e)=>setTariffDescription(e.target.value)} className={`${inputClass} min-h-[90px] resize-y`}/></label>
        <div className="mt-5 rounded-[16px] bg-[#D96A24]/[0.055] px-4 py-3 text-xs leading-5 text-[#6F4A32]">Если полную стоимость оставить пустой, система рассчитает её как стоимость месяца × количество расчётных месяцев. Для скидки или особых условий можно указать полную сумму вручную.</div>
        <button type="button" disabled={saving} onClick={()=>void saveTerms()} className="mt-5 flex w-full items-center justify-center gap-2 rounded-[15px] bg-[#171717] px-5 py-4 text-sm font-semibold text-white disabled:opacity-40">{saving&&<LoaderCircle className="h-4 w-4 animate-spin"/>} Сохранить условия договора</button></div></div>}
    </div>
  );
}
