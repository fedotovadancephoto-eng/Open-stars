import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, FileCheck2, LoaderCircle, Search, X } from "lucide-react";

import { fetchStaffIdentity, StaffRole } from "@/admin/adminApi";
import { fetchStaffDocumentRegistry, StaffDocumentRow } from "@/admin/documentAdminApi";
import { onAdminSection } from "@/admin/adminNavigation";

const BRANCHES = ["Октябрьский", "Свердловский", "НЛО"];

function statusLabel(value: string, optional = false) {
  if (value === "accept") return { text: "Подписано", cls: "bg-[#5F6338]/10 text-[#4D512E]" };
  if (value === "decline") return { text: "Отказ", cls: "bg-black/[0.055] text-black/55" };
  if (value === "revoke") return { text: "Отозвано", cls: "bg-amber-50 text-amber-700" };
  return { text: optional ? "Не выбрано" : "Ожидает", cls: "bg-[#D96A24]/10 text-[#C95320]" };
}

export function AdminDocumentsManager() {
  const [open, setOpen] = useState(false);
  const [role, setRole] = useState<StaffRole | null>(null);
  const [rows, setRows] = useState<StaffDocumentRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [branch, setBranch] = useState("");
  const [search, setSearch] = useState("");

  async function refresh(nextBranch = branch) {
    const data = await fetchStaffDocumentRegistry(nextBranch);
    setRows(Array.isArray(data) ? data : []);
  }

  useEffect(() => onAdminSection("documents", () => {
    setOpen(true);
    setError("");
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

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[80] overflow-y-auto bg-[#FAF9F5]">
      <div className="mx-auto min-h-screen w-full max-w-7xl px-4 pb-12 pt-[calc(env(safe-area-inset-top,0px)+1rem)] sm:px-6 lg:px-8">
        <div className="sticky top-0 z-10 -mx-4 mb-5 flex items-center justify-between gap-4 border-b border-black/[0.06] bg-[#FAF9F5]/95 px-4 py-4 backdrop-blur sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.19em] text-[#D96A24]">OPEN STARS · ДОКУМЕНТЫ</p>
            <h1 className="mt-1 text-2xl font-semibold tracking-[-0.03em] text-[#171717]">Документы родителей</h1>
          </div>
          <button type="button" onClick={() => setOpen(false)} className="grid h-11 w-11 place-items-center rounded-full bg-black/[0.055] text-black/60"><X className="h-5 w-5" /></button>
        </div>

        <div className="rounded-[22px] border border-black/[0.055] bg-white p-5 shadow-[0_8px_28px_rgba(0,0,0,0.03)]">
          <div className="flex items-start gap-3">
            <div className="grid h-11 w-11 shrink-0 place-items-center rounded-[15px] bg-[#D96A24]/10 text-[#C95320]"><FileCheck2 className="h-5 w-5" /></div>
            <div>
              <h2 className="font-semibold text-[#171717]">Только контроль подписания</h2>
              <p className="mt-1 text-sm leading-6 text-black/45">Администратору не нужно выбирать тариф, пакет, стоимость или срок договора. Родитель открывает документы в своём кабинете и подписывает их самостоятельно.</p>
            </div>
          </div>
        </div>

        {error && <div className="mt-4 rounded-[16px] bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

        <div className="mt-4 grid gap-3 rounded-[20px] border border-black/[0.055] bg-white p-4 sm:grid-cols-[1fr_auto]">
          <label className="relative"><Search className="absolute left-3.5 top-3.5 h-4 w-4 text-black/30" /><input value={search} onChange={(e) => setSearch(e.target.value)} className="w-full rounded-[14px] border border-black/[0.08] bg-[#FAF9F5] py-3 pl-10 pr-3 text-sm outline-none focus:border-[#D96A24]/45" placeholder="Ребёнок, родитель или телефон" /></label>
          {canFilterBranches && <select value={branch} onChange={(e) => { const value=e.target.value; setBranch(value); setLoading(true); void refresh(value).catch((reason)=>setError(reason instanceof Error?reason.message:"Не удалось обновить список.")).finally(()=>setLoading(false)); }} className="rounded-[14px] border border-black/[0.08] bg-white px-3 py-3 text-sm"><option value="">Все филиалы</option>{BRANCHES.map((item)=><option key={item} value={item}>{item}</option>)}</select>}
        </div>

        {loading ? <div className="mt-6 flex items-center gap-3 rounded-[20px] bg-white p-6 text-sm text-black/50"><LoaderCircle className="h-5 w-5 animate-spin" /> Загружаем реестр…</div> : (
          <div className="mt-4 space-y-3">
            {filtered.map((row) => {
              const es=statusLabel(row.esign_status); const pd=statusLabel(row.personal_data_status); const ct=statusLabel(row.contract_status); const ph=statusLabel(row.photo_status,true);
              return <div key={row.child_id} className="rounded-[20px] border border-black/[0.055] bg-white p-4 sm:p-5">
                <div><p className="text-[10px] font-bold uppercase tracking-[0.14em] text-black/35">{row.branch}</p><h3 className="mt-1 text-lg font-semibold text-[#171717]">{row.child_name}</h3><p className="mt-1 text-xs text-black/45">{row.parent_name || "Родитель не привязан"}{row.parent_phone ? ` · ${row.parent_phone}` : ""}</p></div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${es.cls}`}>{row.esign_status==="accept"&&<CheckCircle2 className="mr-1 inline h-3 w-3"/>}ЭП: {es.text}</span>
                  <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${pd.cls}`}>ПД: {pd.text}</span>
                  <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${ct.cls}`}>Договор: {ct.text}</span>
                  <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${ph.cls}`}>Фото: {ph.text}</span>
                </div>
              </div>;
            })}
            {filtered.length===0 && <div className="rounded-[20px] bg-white p-7 text-center text-sm text-black/40">Ничего не найдено.</div>}
          </div>
        )}
      </div>
    </div>
  );
}
