import { useEffect, useMemo, useState } from "react";
import { ArrowDownCircle, ArrowUpCircle, CheckCircle2, Coins, LoaderCircle, Search, Sparkles, X } from "lucide-react";

import {
  CoinChild,
  CoinHistoryRow,
  adjustCoins,
  fetchCoinContext,
  fetchCoinHistory,
} from "@/admin/coinApi";

const inputClass = "mt-1.5 w-full rounded-[13px] border border-black/[0.08] bg-white px-3.5 py-3 text-sm text-[#171717] outline-none focus:border-[#D96A24]/45 focus:ring-4 focus:ring-[#D96A24]/[0.06]";

function formatDateTime(value: string) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("ru-RU", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date).replace(".", "");
}

function sourceLabel(source: string) {
  if (source === "grade") return "Автоматически · оценка";
  if (source === "attendance") return "Автоматически · посещение";
  return "Вручную";
}

export function AdminCoinManager() {
  const [enabled, setEnabled] = useState(false);
  const [open, setOpen] = useState(false);
  const [children, setChildren] = useState<CoinChild[]>([]);
  const [rules, setRules] = useState<Array<{ code: string; title: string; amount: number; active: boolean }>>([]);
  const [selectedId, setSelectedId] = useState("");
  const [query, setQuery] = useState("");
  const [history, setHistory] = useState<CoinHistoryRow[]>([]);
  const [mode, setMode] = useState<"add" | "subtract">("add");
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    let cancelled = false;
    let timer = 0;
    async function detect() {
      try {
        const context = await fetchCoinContext();
        if (cancelled) return;
        setEnabled(true);
        setChildren(context.children);
        setRules(context.rules);
      } catch {
        if (!cancelled) timer = window.setTimeout(detect, 1400);
      }
    }
    detect();
    return () => {
      cancelled = true;
      if (timer) window.clearTimeout(timer);
    };
  }, []);

  useEffect(() => {
    const handler = () => setOpen(true);
    window.addEventListener("openstars:open-coins", handler);
    return () => window.removeEventListener("openstars:open-coins", handler);
  }, []);

  const selected = useMemo(() => children.find((child) => child.id === selectedId) || null, [children, selectedId]);
  const visible = useMemo(() => {
    const value = query.trim().toLowerCase();
    if (!value) return children.slice(0, 50);
    return children.filter((child) => [child.name, child.branch, child.groupName].join(" ").toLowerCase().includes(value)).slice(0, 50);
  }, [children, query]);

  async function refreshContext(keepSelected = true) {
    const context = await fetchCoinContext();
    setChildren(context.children);
    setRules(context.rules);
    if (keepSelected && selectedId) {
      const exists = context.children.some((child) => child.id === selectedId);
      if (!exists) setSelectedId("");
    }
  }

  async function openManager() {
    setOpen(true);
    setLoading(true);
    setError("");
    setSuccess("");
    try {
      await refreshContext(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось открыть Star Coin.");
    } finally {
      setLoading(false);
    }
  }

  async function chooseChild(child: CoinChild) {
    setSelectedId(child.id);
    setLoading(true);
    setError("");
    setSuccess("");
    try {
      setHistory(await fetchCoinHistory(child.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось загрузить историю Star Coin.");
    } finally {
      setLoading(false);
    }
  }

  async function saveAdjustment() {
    if (!selected) return setError("Выберите ребёнка.");
    const value = Number(amount);
    if (!Number.isInteger(value) || value <= 0) return setError("Введите целое количество Star Coin больше нуля.");
    if (!reason.trim()) return setError("Обязательно укажите, за что начисление или списание.");

    const signedAmount = mode === "add" ? value : -value;
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      await adjustCoins(selected.id, signedAmount, reason);
      await refreshContext();
      setHistory(await fetchCoinHistory(selected.id));
      setAmount("");
      setReason("");
      setSuccess(mode === "add" ? `Начислено +${value} Star Coin.` : `Списано ${value} Star Coin.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось выполнить операцию.");
    } finally {
      setSaving(false);
    }
  }

  if (!enabled) return null;

  return (
    <>
      <button
        type="button"
        onClick={openManager}
        className="fixed bottom-[20.7rem] right-4 z-40 flex items-center gap-2 rounded-full bg-[#5F6338] px-4 py-3 text-sm font-semibold text-white shadow-[0_10px_30px_rgba(0,0,0,0.18)] sm:right-6"
      >
        <Coins size={17} /> Star Coin
      </button>

      {open && (
        <div className="fixed inset-0 z-[79] flex items-end justify-center bg-black/30 p-0 backdrop-blur-[2px] sm:items-center sm:p-5" onClick={() => !saving && setOpen(false)}>
          <div className="max-h-[96vh] w-full max-w-6xl overflow-y-auto rounded-t-[28px] bg-[#FAF9F5] p-5 shadow-2xl sm:rounded-[28px] sm:p-7" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#D96A24]">OPEN STARS ADMIN</p>
                <h2 className="mt-1 text-2xl font-semibold tracking-[-0.03em]">Star Coin</h2>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-black/45">Автоматические начисления за обучение и ручные бонусы/списания с полной историей.</p>
              </div>
              <button type="button" onClick={() => setOpen(false)} disabled={saving} className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-white text-black/55 shadow-sm"><X size={20} /></button>
            </div>

            <div className="mt-6 grid gap-5 lg:grid-cols-[0.85fr_1.15fr]">
              <section className="rounded-[24px] border border-black/[0.06] bg-white p-5 sm:p-6">
                <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-black/35">Ученик</p>
                <div className="relative mt-3"><Search className="absolute left-3.5 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-black/25" /><input className="w-full rounded-[14px] border border-black/[0.07] bg-[#FAF9F5] py-3 pl-11 pr-4 text-sm outline-none placeholder:text-black/25 focus:border-[#D96A24]/40" value={query} onChange={(e)=>setQuery(e.target.value)} placeholder="Имя, филиал или группа" /></div>
                <div className="mt-3 max-h-[310px] space-y-2 overflow-y-auto pr-1">
                  {visible.length === 0 && <div className="rounded-[17px] bg-[#FAF9F5] px-4 py-8 text-center text-sm text-black/40">Ученики не найдены.</div>}
                  {visible.map((child) => {
                    const active = child.id === selectedId;
                    return <button key={child.id} type="button" onClick={()=>chooseChild(child)} className={`flex w-full items-center justify-between gap-3 rounded-[16px] border p-3 text-left ${active?"border-[#D96A24]/30 bg-[#D96A24]/[0.06]":"border-black/[0.055] bg-white hover:bg-[#FAF9F5]"}`}><div className="min-w-0"><p className="truncate text-sm font-semibold">{child.name}</p><p className="mt-1 truncate text-xs text-black/40">{[child.branch,child.groupName].filter(Boolean).join(" · ")}</p></div><span className="shrink-0 rounded-full bg-[#5F6338]/10 px-2.5 py-1 text-xs font-bold text-[#4D512E]">{child.coins}</span></button>;
                  })}
                </div>

                <div className="mt-5 border-t border-black/[0.06] pt-5">
                  <div className="flex items-center gap-2"><Sparkles size={17} className="text-[#D96A24]"/><p className="text-sm font-semibold">Автоматические правила</p></div>
                  <div className="mt-3 space-y-2">{rules.filter((r)=>r.active).map((rule)=><div key={rule.code} className="flex items-center justify-between rounded-[13px] bg-[#FAF9F5] px-3.5 py-3"><span className="text-xs font-medium text-black/55">{rule.title}</span><span className="text-sm font-bold text-[#C95320]">+{rule.amount}</span></div>)}</div>
                </div>
              </section>

              <div className="space-y-5">
                <section className="rounded-[24px] border border-black/[0.06] bg-white p-5 sm:p-6">
                  {selected ? <>
                    <div className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-xs text-black/40">Баланс</p><p className="mt-1 text-2xl font-semibold">{selected.name}</p><p className="mt-1 text-xs text-black/35">{selected.branch} · {selected.groupName}</p></div><div className="text-right"><p className="text-4xl font-semibold tracking-[-0.05em] text-[#171717]">{selected.coins}</p><p className="text-xs font-semibold uppercase tracking-[0.14em] text-black/35">Star Coin</p></div></div>
                    <div className="mt-5 grid grid-cols-2 gap-2 rounded-[14px] bg-[#FAF9F5] p-1.5"><button type="button" onClick={()=>setMode("add")} className={`flex items-center justify-center gap-2 rounded-[11px] px-3 py-3 text-sm font-semibold ${mode==="add"?"bg-[#5F6338] text-white":"text-black/45"}`}><ArrowUpCircle size={17}/>Начислить</button><button type="button" onClick={()=>setMode("subtract")} className={`flex items-center justify-center gap-2 rounded-[11px] px-3 py-3 text-sm font-semibold ${mode==="subtract"?"bg-[#171717] text-white":"text-black/45"}`}><ArrowDownCircle size={17}/>Списать</button></div>
                    <label className="mt-4 block text-xs font-semibold text-black/55">Количество<input type="number" min="1" step="1" className={inputClass} value={amount} onChange={(e)=>setAmount(e.target.value)} placeholder="Например: 10" /></label>
                    <label className="mt-3 block text-xs font-semibold text-black/55">Причина *<textarea className={`${inputClass} min-h-[80px] resize-y`} value={reason} onChange={(e)=>setReason(e.target.value)} placeholder={mode==="add"?"Например: Отличная работа на показе":"Например: Обмен на подарок"} /></label>
                    <button type="button" onClick={saveAdjustment} disabled={saving} className={`mt-4 flex w-full items-center justify-center gap-2 rounded-[14px] px-5 py-3.5 text-sm font-semibold text-white disabled:opacity-50 ${mode==="add"?"bg-[#D96A24]":"bg-[#171717]"}`}>{saving?<LoaderCircle className="animate-spin" size={17}/>:mode==="add"?<ArrowUpCircle size={17}/>:<ArrowDownCircle size={17}/>} {mode==="add"?"Начислить Star Coin":"Списать Star Coin"}</button>
                  </> : <div className="grid min-h-[260px] place-items-center text-center"><div><Coins className="mx-auto text-black/20" size={38}/><p className="mt-3 font-semibold">Выберите ребёнка</p><p className="mt-1 text-sm text-black/40">После выбора появится баланс и управление.</p></div></div>}
                </section>

                {error && <div className="rounded-[15px] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
                {success && <div className="flex items-start gap-2 rounded-[15px] border border-[#5F6338]/15 bg-[#5F6338]/[0.07] px-4 py-3 text-sm font-medium text-[#4D512E]"><CheckCircle2 size={17} className="mt-0.5 shrink-0"/>{success}</div>}

                <section className="rounded-[24px] border border-black/[0.06] bg-white p-5 sm:p-6">
                  <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-black/35">История</p><h3 className="mt-1 text-lg font-semibold">Операции Star Coin</h3>
                  {loading ? <div className="grid min-h-[130px] place-items-center"><LoaderCircle className="animate-spin text-black/25"/></div> : !selected ? <p className="mt-4 text-sm text-black/40">Выберите ребёнка.</p> : history.length===0 ? <div className="mt-4 rounded-[17px] bg-[#FAF9F5] px-4 py-7 text-center text-sm text-black/40">Операций пока нет.</div> : <div className="mt-4 divide-y divide-black/[0.06]">{history.map((row)=><div key={row.id} className="flex items-start justify-between gap-4 py-3"><div className="min-w-0"><p className="text-sm font-semibold text-[#171717]">{row.reason}</p><p className="mt-1 text-[11px] text-black/35">{sourceLabel(row.source)} · {formatDateTime(row.createdAt)}{row.createdByName?` · ${row.createdByName}`:""}</p></div><span className={`shrink-0 text-base font-bold ${row.amount>=0?"text-[#C95320]":"text-[#171717]"}`}>{row.amount>0?"+":""}{row.amount}</span></div>)}</div>}
                </section>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
