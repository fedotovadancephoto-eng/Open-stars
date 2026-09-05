import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, ExternalLink, Link2, LoaderCircle } from "lucide-react";

import { fetchPaymentLinkContext, savePaymentLink } from "@/admin/paymentApi";

const branches = ["НЛО", "Свердловский", "Октябрьский"];

export function AdminPaymentLinkSettings() {
  const [role, setRole] = useState("");
  const [staffBranch, setStaffBranch] = useState("");
  const [branch, setBranch] = useState("НЛО");
  const [links, setLinks] = useState<Record<string, string>>({});
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const context = await fetchPaymentLinkContext();
        if (cancelled) return;
        const next = Object.fromEntries(context.links.map((item) => [item.branch, item.enabled ? item.paymentUrl : ""]));
        const initialBranch = context.role === "admin" && context.staffBranch ? context.staffBranch : branches[0];
        setRole(context.role);
        setStaffBranch(context.staffBranch);
        setLinks(next);
        setBranch(initialBranch);
        setUrl(next[initialBranch] || "");
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Не удалось загрузить ссылку на оплату.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const availableBranches = useMemo(() => role === "admin" && staffBranch ? [staffBranch] : branches, [role, staffBranch]);

  function changeBranch(value: string) {
    setBranch(value);
    setUrl(links[value] || "");
    setError("");
    setSuccess("");
  }

  async function save() {
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      const result = await savePaymentLink(branch, url);
      setLinks((current) => ({ ...current, [branch]: result.enabled ? result.paymentUrl : "" }));
      setUrl(result.enabled ? result.paymentUrl : "");
      setSuccess(result.enabled ? `Ссылка для филиала «${branch}» сохранена.` : `Ссылка для филиала «${branch}» отключена.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось сохранить ссылку.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="mt-5 rounded-[20px] border border-[#D96A24]/15 bg-[#D96A24]/[0.035] p-4 sm:p-5">
      <div className="flex items-start gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-[13px] bg-white text-[#C95320]"><Link2 size={18}/></span>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-bold uppercase tracking-[0.17em] text-[#C95320]">Ссылка для родителей</p>
          <h3 className="mt-1 text-base font-semibold text-[#171717]">Оплатить обучение</h3>
          <p className="mt-1 text-xs leading-5 text-black/40">Вставьте готовую ссылку банка или платёжной страницы. Родитель увидит кнопку оплаты, а фактическое поступление вы по-прежнему подтверждаете в реестре.</p>
        </div>
      </div>

      {loading ? <div className="mt-4 flex items-center gap-2 text-xs text-black/35"><LoaderCircle className="animate-spin" size={15}/> Загружаю настройки…</div> : (
        <div className="mt-4 grid gap-3 sm:grid-cols-[0.38fr_1fr_auto] sm:items-end">
          <label className="text-xs font-semibold text-black/55">Филиал
            <select value={branch} onChange={(e) => changeBranch(e.target.value)} disabled={availableBranches.length === 1} className="mt-1.5 w-full rounded-[13px] border border-black/[0.08] bg-white px-3.5 py-3 text-sm outline-none disabled:opacity-65">
              {availableBranches.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
          </label>
          <label className="text-xs font-semibold text-black/55">Ссылка на оплату
            <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://..." inputMode="url" autoCapitalize="none" className="mt-1.5 w-full rounded-[13px] border border-black/[0.08] bg-white px-3.5 py-3 text-sm outline-none focus:border-[#D96A24]/45"/>
          </label>
          <button type="button" onClick={save} disabled={saving} className="flex min-h-[46px] items-center justify-center gap-2 rounded-[13px] bg-[#171717] px-4 py-3 text-sm font-semibold text-white disabled:opacity-50">
            {saving ? <LoaderCircle className="animate-spin" size={16}/> : <Link2 size={16}/>} Сохранить
          </button>
        </div>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-3 text-[11px] text-black/35">
        <span>Чтобы убрать кнопку у родителей, очистите поле ссылки и сохраните.</span>
        {url.trim().startsWith("http") && <a href={url.trim()} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-semibold text-[#4D512E]">Проверить ссылку <ExternalLink size={12}/></a>}
      </div>
      {error && <div className="mt-3 rounded-[13px] border border-red-200 bg-red-50 px-3.5 py-2.5 text-xs text-red-700">{error}</div>}
      {success && <div className="mt-3 flex items-center gap-2 rounded-[13px] bg-[#5F6338]/[0.08] px-3.5 py-2.5 text-xs text-[#4D512E]"><CheckCircle2 size={14}/>{success}</div>}
    </section>
  );
}
