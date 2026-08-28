import { useEffect, useMemo, useState } from "react";
import { Download, FileSpreadsheet, LoaderCircle, ShieldCheck, X } from "lucide-react";

import { onAdminSection } from "@/admin/adminNavigation";
import { buildAdminSheets } from "@/admin/reportAdminSheets";
import { buildAcademicSheets } from "@/admin/reportAcademicSheets";
import { ReportContext, ReportFilters, fetchReportContext } from "@/admin/reportExportShared";
import { downloadXlsx } from "@/admin/xlsxExport";

const branches = ["Свердловский", "НЛО", "Октябрьский"];
const groups = ["Базовый", "Продвинутый", "PRO"];
const inputClass = "mt-1.5 w-full rounded-[13px] border border-black/[0.08] bg-white px-3.5 py-3 text-sm text-[#171717] outline-none focus:border-[#D96A24]/45 focus:ring-4 focus:ring-[#D96A24]/[0.06]";

function localDate(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function filePart(value: string) {
  return value.replace(/[^a-zA-Zа-яА-ЯёЁ0-9_-]+/g, "_").replace(/^_+|_+$/g, "");
}

export function AdminReportExport() {
  const [open, setOpen] = useState(false);
  const [context, setContext] = useState<ReportContext | null>(null);
  const [filters, setFilters] = useState<ReportFilters>({ branch: "", groupName: "", childId: "", fromDate: "", toDate: "" });
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function load() {
    setLoading(true);
    setError("");
    try {
      const next = await fetchReportContext();
      setContext(next);
      if (next.role === "admin" && next.staffBranch) setFilters((current) => ({ ...current, branch: next.staffBranch }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось подготовить экспорт.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => onAdminSection("reports", () => {
    setOpen(true);
    setSuccess("");
    void load();
  }), []);

  const visibleChildren = useMemo(() => {
    if (!context) return [];
    return context.children.filter((child) => (!filters.branch || child.branch === filters.branch) && (!filters.groupName || child.groupName === filters.groupName));
  }, [context, filters.branch, filters.groupName]);

  function patch(patchValue: Partial<ReportFilters>) {
    setFilters((current) => ({ ...current, ...patchValue }));
    setSuccess("");
  }

  function currentMonth() {
    const now = new Date();
    patch({ fromDate: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`, toDate: localDate(now) });
  }

  async function exportReport() {
    if (!context) return;
    setExporting(true);
    setError("");
    setSuccess("");
    try {
      const academic = await buildAcademicSheets(filters, context);
      const admin = await buildAdminSheets(filters, context);
      const sheets = [...academic, ...admin];
      const selected = context.children.find((child) => child.id === filters.childId);
      const scope = [filters.branch, filters.groupName, selected?.fullName].filter(Boolean).map(filePart).join("_") || "all";
      downloadXlsx(sheets, `OPEN_STARS_${scope}_${localDate()}.xlsx`);
      const rows = sheets.reduce((sum, sheet) => sum + sheet.rows.length, 0);
      setSuccess(`Готово: ${sheets.length} лист(ов), ${rows} строк данных. Файл .xlsx сохранён на устройство.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось сформировать Excel-файл.");
    } finally {
      setExporting(false);
    }
  }

  if (!open) return null;

  const branchLocked = context?.role === "admin" && Boolean(context.staffBranch);

  return (
    <div className="fixed inset-0 z-[90] flex items-end justify-center bg-black/30 backdrop-blur-[2px] sm:items-center sm:p-5" onClick={() => !exporting && setOpen(false)}>
      <div className="max-h-[96vh] w-full max-w-4xl overflow-y-auto rounded-t-[28px] bg-[#FAF9F5] p-5 shadow-2xl sm:rounded-[28px] sm:p-7" onClick={(event) => event.stopPropagation()}>
        <div className="flex items-start justify-between gap-4">
          <div><p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#D96A24]">OPEN STARS · ОТЧЁТЫ</p><h2 className="mt-1 text-2xl font-semibold">Выгрузка в Excel</h2><p className="mt-2 max-w-2xl text-sm leading-6 text-black/45">Один настоящий .xlsx-файл с отдельными листами. Фильтры применяются ко всей выгрузке.</p></div>
          <button type="button" disabled={exporting} onClick={() => setOpen(false)} className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-white text-black/55"><X size={20}/></button>
        </div>

        {loading ? <div className="grid min-h-[240px] place-items-center"><LoaderCircle className="animate-spin text-black/25"/></div> : context && <>
          <div className="mt-5 flex items-start gap-3 rounded-[17px] border border-[#5F6338]/15 bg-[#5F6338]/[0.07] px-4 py-3 text-xs leading-5 text-[#4D512E]"><ShieldCheck size={17} className="mt-0.5 shrink-0"/><p>{context.teacherView ? "Педагогическая выгрузка: ученики, оценки, посещаемость, ДЗ, комментарии, достижения и расписание. Телефоны родителей, оплата и административные данные не выгружаются." : "Административная выгрузка дополнительно включает родителей, Star Coin, оплату, обратную связь, новости и фотосессии. RLS автоматически ограничивает доступ вашей ролью и филиалом."}</p></div>

          <section className="mt-5 rounded-[22px] border border-black/[0.06] bg-white p-5">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <label className="text-xs font-semibold text-black/55">Филиал<select className={inputClass} value={filters.branch} disabled={branchLocked} onChange={(e) => patch({ branch: e.target.value, childId: "" })}><option value="">Все доступные</option>{branches.map((value) => <option key={value}>{value}</option>)}</select></label>
              <label className="text-xs font-semibold text-black/55">Группа<select className={inputClass} value={filters.groupName} onChange={(e) => patch({ groupName: e.target.value, childId: "" })}><option value="">Все группы</option>{groups.map((value) => <option key={value}>{value}</option>)}</select></label>
              <label className="text-xs font-semibold text-black/55">Ученик<select className={inputClass} value={filters.childId} onChange={(e) => patch({ childId: e.target.value })}><option value="">Все ученики</option>{visibleChildren.map((child) => <option key={child.id} value={child.id}>{child.fullName} · {child.groupName} · {child.lessonTime?.slice(0,5)}</option>)}</select></label>
              <label className="text-xs font-semibold text-black/55">С даты<input type="date" className={inputClass} value={filters.fromDate} onChange={(e) => patch({ fromDate: e.target.value })}/></label>
              <label className="text-xs font-semibold text-black/55">По дату<input type="date" className={inputClass} value={filters.toDate} onChange={(e) => patch({ toDate: e.target.value })}/></label>
              <div className="flex items-end gap-2"><button type="button" onClick={currentMonth} className="flex-1 rounded-[12px] bg-[#F2F0E8] px-3 py-3 text-xs font-semibold text-black/55">Этот месяц</button><button type="button" onClick={() => patch({ fromDate: "", toDate: "" })} className="flex-1 rounded-[12px] bg-[#F2F0E8] px-3 py-3 text-xs font-semibold text-black/55">Вся история</button></div>
            </div>
          </section>

          <div className="mt-5 rounded-[18px] bg-white px-4 py-3 text-xs leading-5 text-black/45">Будут выгружены данные для <strong className="text-[#171717]">{visibleChildren.filter((child) => !filters.childId || child.id === filters.childId).length}</strong> ученик(ов). Пустой период означает всю доступную историю.</div>
        </>}

        {error && <div className="mt-4 rounded-[15px] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
        {success && <div className="mt-4 rounded-[15px] border border-[#5F6338]/15 bg-[#5F6338]/[0.07] px-4 py-3 text-sm font-medium text-[#4D512E]">{success}</div>}

        <button type="button" onClick={exportReport} disabled={!context || loading || exporting} className="mt-5 flex w-full items-center justify-center gap-2 rounded-[15px] bg-[#171717] px-5 py-4 text-sm font-semibold text-white disabled:opacity-40">{exporting ? <LoaderCircle className="animate-spin" size={18}/> : <Download size={18}/>} {exporting ? "Формируем Excel..." : "Скачать полный Excel-отчёт"}</button>
        <div className="mt-3 flex items-center justify-center gap-2 text-[11px] text-black/35"><FileSpreadsheet size={14}/> Microsoft Excel · формат .xlsx</div>
      </div>
    </div>
  );
}
