import { useEffect, useMemo, useState } from "react";
import { Check, Clipboard, Download, KeyRound, LoaderCircle, RefreshCw, Search, UsersRound, X } from "lucide-react";

import { AdminChild, StaffRole, fetchAdminChildren, fetchStaffIdentity, getValidStaffSession } from "@/admin/adminApi";
import {
  BulkParentActivationCode,
  ParentActivationCode,
  generateBulkParentActivationCodes,
  generateParentActivationCode,
} from "@/admin/parentActivationApi";

const branches = ["НЛО", "Свердловский", "Октябрьский"];

function dateLabel(value: string) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("ru-RU", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(date);
}

function csvCell(value: unknown) {
  return `"${String(value ?? "").replace(/"/g, '""')}"`;
}

function downloadCodes(rows: BulkParentActivationCode[], branch: string) {
  const header = ["Ребёнок", "Имя родителя", "Телефон", "Филиал", "Группа", "Код активации", "Действует до", "Ошибка"];
  const lines = [header, ...rows.map((row) => [row.children, row.parentName, row.phone, row.branch, row.groupName, row.activationCode, dateLabel(row.expiresAt), row.error])];
  const csv = "\uFEFF" + lines.map((line) => line.map(csvCell).join(";")).join("\r\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `OPEN_STARS_коды_${branch || "все"}_${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

async function copyText(text: string) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }
  const area = document.createElement("textarea");
  area.value = text;
  area.style.position = "fixed";
  area.style.opacity = "0";
  document.body.appendChild(area);
  area.select();
  document.execCommand("copy");
  area.remove();
}

export function AdminParentActivationManager() {
  const [enabled, setEnabled] = useState(false);
  const [open, setOpen] = useState(false);
  const [role, setRole] = useState<StaffRole | null>(null);
  const [children, setChildren] = useState<AdminChild[]>([]);
  const [branch, setBranch] = useState("НЛО");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState("");
  const [bulkBusy, setBulkBusy] = useState(false);
  const [codes, setCodes] = useState<Record<string, ParentActivationCode>>({});
  const [bulkRows, setBulkRows] = useState<BulkParentActivationCode[]>([]);
  const [copied, setCopied] = useState("");
  const [error, setError] = useState("");

  async function load() {
    const session = await getValidStaffSession();
    if (!session) return;
    const identity = await fetchStaffIdentity();
    if (identity.role === "teacher") return;
    const rows = await fetchAdminChildren(identity.role);
    setRole(identity.role);
    setChildren(rows.filter((item) => !item.archivedAt));
    const availableBranches = Array.from(new Set(rows.map((item) => item.branch).filter(Boolean)));
    if (identity.role === "admin" && availableBranches[0]) setBranch(availableBranches[0]);
    setEnabled(true);
  }

  useEffect(() => {
    let cancelled = false;
    let timer = 0;
    const detect = async () => {
      try {
        await load();
      } catch {
        if (!cancelled) timer = window.setTimeout(detect, 1200);
      }
    };
    detect();
    return () => { cancelled = true; if (timer) window.clearTimeout(timer); };
  }, []);

  const availableBranches = useMemo(() => {
    const values = Array.from(new Set(children.map((item) => item.branch).filter(Boolean)));
    return values.length ? values : branches;
  }, [children]);

  const visible = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return children
      .filter((item) => !branch || item.branch === branch)
      .filter((item) => !normalized || [item.fullName, item.parentName, item.parentPhone, item.groupName].join(" ").toLowerCase().includes(normalized));
  }, [children, branch, query]);

  async function openManager() {
    setOpen(true);
    setLoading(true);
    setError("");
    try { await load(); }
    catch (e) { setError(e instanceof Error ? e.message : "Не удалось загрузить родителей."); }
    finally { setLoading(false); }
  }

  async function generateOne(child: AdminChild) {
    setBusyId(child.id);
    setError("");
    try {
      const result = await generateParentActivationCode(child.id);
      setCodes((current) => ({ ...current, [child.id]: result }));
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось создать код.");
    } finally {
      setBusyId("");
    }
  }

  async function generateBulk() {
    setBulkBusy(true);
    setError("");
    setBulkRows([]);
    try {
      const result = await generateBulkParentActivationCodes(branch || undefined);
      setBulkRows(result);
      await load();
      if (result.length === 0) setError("В выбранном филиале нет неактивированных родителей.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось создать коды.");
    } finally {
      setBulkBusy(false);
    }
  }

  async function copyCode(childId: string, value: string) {
    await copyText(value);
    setCopied(childId);
    window.setTimeout(() => setCopied(""), 1500);
  }

  async function copyBulk() {
    const text = bulkRows
      .filter((row) => row.activationCode)
      .map((row) => `${row.parentName} · ${row.phone}\nКод активации OPEN STARS: ${row.activationCode}`)
      .join("\n\n");
    await copyText(text);
    setCopied("bulk");
    window.setTimeout(() => setCopied(""), 1500);
  }

  if (!enabled || !role) return null;

  return <>
    <button type="button" onClick={openManager} className="fixed bottom-[36.8rem] right-4 z-40 flex items-center gap-2 rounded-full bg-[#171717] px-4 py-3 text-sm font-semibold text-white shadow-[0_10px_30px_rgba(0,0,0,0.18)] sm:right-6"><KeyRound size={17}/> Активация родителей</button>

    {open && <div className="fixed inset-0 z-[84] flex items-end justify-center bg-black/30 backdrop-blur-[2px] sm:items-center sm:p-5" onClick={() => !bulkBusy && setOpen(false)}>
      <div className="max-h-[96vh] w-full max-w-5xl overflow-y-auto rounded-t-[28px] bg-[#FAF9F5] p-5 shadow-2xl sm:rounded-[28px] sm:p-7" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#D96A24]">OPEN STARS ADMIN</p>
            <h2 className="mt-1 text-2xl font-semibold">Активация родителей</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-black/45">Код нужен только один раз. Родитель вводит номер + код, задаёт свой пароль и дальше входит по номеру и паролю без SMS.</p>
          </div>
          <button type="button" onClick={() => setOpen(false)} className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-white"><X size={20}/></button>
        </div>

        <section className="mt-6 rounded-[24px] border border-black/[0.06] bg-white p-5 sm:p-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <label className="flex-1 text-xs font-semibold text-black/55">Филиал
              <select value={branch} onChange={(e) => { setBranch(e.target.value); setBulkRows([]); }} disabled={role === "admin"} className="mt-1.5 w-full rounded-[13px] border border-black/[0.08] bg-[#FAF9F5] px-3.5 py-3 text-sm outline-none disabled:opacity-65">
                {availableBranches.map((item) => <option key={item} value={item}>{item}</option>)}
              </select>
            </label>
            <button type="button" onClick={generateBulk} disabled={bulkBusy} className="flex min-h-[46px] flex-1 items-center justify-center gap-2 rounded-[13px] bg-[#D96A24] px-4 py-3 text-sm font-semibold text-white disabled:opacity-50">
              {bulkBusy ? <LoaderCircle className="animate-spin" size={17}/> : <UsersRound size={17}/>} Сгенерировать коды всем неактивированным
            </button>
          </div>

          {bulkRows.length > 0 && <div className="mt-4 rounded-[18px] bg-[#FAF9F5] p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-semibold">Создано: {bulkRows.filter((item) => item.activationCode).length} · ошибок: {bulkRows.filter((item) => item.error).length}</p>
              <div className="flex gap-2">
                <button type="button" onClick={copyBulk} className="flex items-center gap-1.5 rounded-[11px] bg-white px-3 py-2 text-xs font-semibold text-black/55">{copied === "bulk" ? <Check size={14}/> : <Clipboard size={14}/>} {copied === "bulk" ? "Скопировано" : "Копировать сообщения"}</button>
                <button type="button" onClick={() => downloadCodes(bulkRows, branch)} className="flex items-center gap-1.5 rounded-[11px] bg-[#171717] px-3 py-2 text-xs font-semibold text-white"><Download size={14}/> Скачать список CSV</button>
              </div>
            </div>
            <div className="mt-3 max-h-64 overflow-y-auto space-y-1.5">
              {bulkRows.map((row) => <div key={row.familyId} className="grid gap-1 rounded-[12px] bg-white px-3 py-2 text-xs sm:grid-cols-[1.5fr_1fr_1fr_auto]">
                <span className="font-semibold">{row.children}</span><span>{row.phone}</span><span className={row.error ? "text-red-600" : "font-bold text-[#4D512E]"}>{row.error || row.activationCode}</span><span className="text-black/35">{row.expiresAt ? dateLabel(row.expiresAt) : ""}</span>
              </div>)}
            </div>
          </div>}
        </section>

        <section className="mt-5 rounded-[24px] border border-black/[0.06] bg-white p-5 sm:p-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div><p className="text-[11px] font-bold uppercase tracking-[0.18em] text-black/35">Точечно</p><h3 className="mt-1 text-lg font-semibold">Код для одного родителя</h3></div>
            <div className="relative w-full sm:max-w-sm"><Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-black/30"/><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Ребёнок, родитель, телефон" className="w-full rounded-[13px] border border-black/[0.08] bg-[#FAF9F5] py-3 pl-10 pr-3 text-sm outline-none"/></div>
          </div>

          {loading ? <div className="grid min-h-[150px] place-items-center"><LoaderCircle className="animate-spin text-black/25"/></div> : <div className="mt-4 space-y-2">
            {visible.length === 0 && <div className="rounded-[16px] bg-[#FAF9F5] px-4 py-8 text-center text-sm text-black/40">Родители не найдены.</div>}
            {visible.map((child) => {
              const result = codes[child.id];
              const active = child.activationStatus === "active";
              return <div key={child.id} className="rounded-[16px] border border-black/[0.055] p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div><p className="font-semibold">{child.fullName}</p><p className="mt-1 text-xs text-black/40">{child.parentName || "Родитель"} · {child.parentPhone || "телефон не указан"} · {child.groupName}</p><p className={`mt-1 text-[11px] font-semibold ${active ? "text-[#4D512E]" : "text-[#C95320]"}`}>{active ? "Кабинет активирован" : child.activationStatus === "invited" ? "Код уже выдавался — можно создать новый" : "Кабинет не активирован"}</p></div>
                  {active ? <span className="rounded-full bg-[#5F6338]/10 px-3 py-2 text-xs font-semibold text-[#4D512E]">Активирован</span> : <button type="button" disabled={busyId === child.id} onClick={() => generateOne(child)} className="flex shrink-0 items-center justify-center gap-1.5 rounded-[12px] bg-[#171717] px-3.5 py-2.5 text-xs font-semibold text-white disabled:opacity-50">{busyId === child.id ? <LoaderCircle className="animate-spin" size={14}/> : child.activationStatus === "invited" ? <RefreshCw size={14}/> : <KeyRound size={14}/>} {child.activationStatus === "invited" ? "Новый код" : "Сгенерировать код"}</button>}
                </div>
                {result && <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-[13px] bg-[#F2F0E8] px-3.5 py-3"><div><p className="text-[10px] font-bold uppercase tracking-wide text-black/35">Код активации</p><p className="mt-0.5 text-xl font-bold tracking-[0.12em]">{result.activationCode}</p><p className="mt-1 text-[10px] text-black/35">Действует до {dateLabel(result.expiresAt)}</p></div><button type="button" onClick={() => copyCode(child.id, result.activationCode)} className="flex items-center gap-1.5 rounded-[11px] bg-white px-3 py-2 text-xs font-semibold">{copied === child.id ? <Check size={14}/> : <Clipboard size={14}/>} {copied === child.id ? "Скопировано" : "Копировать"}</button></div>}
              </div>;
            })}
          </div>}
        </section>

        {error && <div className="mt-4 rounded-[15px] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
      </div>
    </div>}
  </>;
}
