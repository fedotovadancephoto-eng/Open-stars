import { useEffect, useMemo, useState } from "react";
import { Archive, LoaderCircle, Plus, RotateCcw, Search, Trash2, UserX, X } from "lucide-react";

import {
  StaffRole,
  archiveStudent,
  fetchStaffIdentity,
  getValidStaffSession,
  restoreStudent,
} from "@/admin/adminApi";
import { notifyAdminDataUpdated, onAdminSection } from "@/admin/adminNavigation";
import { ArchiveStudentRow, fetchStudentsForArchive } from "@/admin/archiveApi";
import { QuickStudentModal } from "@/admin/QuickStudentModal";
import { deleteUnstartedStudent } from "@/admin/studentCleanupApi";

type View = "active" | "archived";

const reasons = [
  "По желанию семьи",
  "Переезд",
  "Перешёл в другую школу / студию",
  "Временно прекратил обучение",
  "Другое",
];

export function AdminStudentOperations() {
  const [role, setRole] = useState<StaffRole | null>(null);
  const [showQuick, setShowQuick] = useState(false);
  const [showArchive, setShowArchive] = useState(false);
  const [children, setChildren] = useState<ArchiveStudentRow[]>([]);
  const [view, setView] = useState<View>("active");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState("");
  const [archiveChild, setArchiveChild] = useState<ArchiveStudentRow | null>(null);
  const [deleteChild, setDeleteChild] = useState<ArchiveStudentRow | null>(null);
  const [reason, setReason] = useState("");
  const [otherReason, setOtherReason] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let mounted = true;
    async function detectSession() {
      try {
        const session = await getValidStaffSession();
        if (!session || !mounted) return;
        const identity = await fetchStaffIdentity();
        if (mounted) setRole(identity.role);
      } catch {
        // Login may not have happened yet.
      }
    }
    void detectSession();
    const timer = window.setInterval(() => { if (!role) void detectSession(); }, 1200);
    return () => { mounted = false; window.clearInterval(timer); };
  }, [role]);

  async function refresh() {
    if (!role) return;
    setLoading(true);
    setError("");
    try {
      setChildren(await fetchStudentsForArchive());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось загрузить список учеников.");
    } finally {
      setLoading(false);
    }
  }

  async function openArchive() {
    setShowArchive(true);
    await refresh();
  }

  useEffect(() => {
    const stopAdd = onAdminSection("add-student", () => setShowQuick(true));
    const stopArchive = onAdminSection("archive", () => { void openArchive(); });
    return () => { stopAdd(); stopArchive(); };
  }, [role]);

  async function afterCreated(_addNext: boolean) {
    notifyAdminDataUpdated({ source: "student-created" });
    if (showArchive) await refresh();
  }

  async function confirmArchive() {
    if (!archiveChild) return;
    const finalReason = reason === "Другое" ? otherReason.trim() : reason;
    if (!finalReason) return setError("Укажите причину выбытия.");
    setBusyId(archiveChild.id);
    setError("");
    try {
      await archiveStudent(archiveChild.id, finalReason);
      setArchiveChild(null);
      setReason("");
      setOtherReason("");
      await refresh();
      notifyAdminDataUpdated({ source: "student-archived" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось отметить ученика как выбывшего.");
    } finally {
      setBusyId("");
    }
  }

  async function confirmDelete() {
    if (!deleteChild) return;
    setBusyId(deleteChild.id);
    setError("");
    try {
      await deleteUnstartedStudent(deleteChild.id);
      setDeleteChild(null);
      await refresh();
      notifyAdminDataUpdated({ source: "student-deleted" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось удалить ученика.");
    } finally {
      setBusyId("");
    }
  }

  async function restore(child: ArchiveStudentRow) {
    setBusyId(child.id);
    setError("");
    try {
      await restoreStudent(child.id);
      await refresh();
      notifyAdminDataUpdated({ source: "student-restored" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось восстановить ученика.");
    } finally {
      setBusyId("");
    }
  }

  const active = children.filter((child) => !child.archivedAt);
  const archived = children.filter((child) => Boolean(child.archivedAt));
  const source = view === "active" ? active : archived;
  const visible = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return source;
    return source.filter((child) => [child.fullName, child.parentName, child.parentPhone, child.branch, child.groupName].join(" ").toLowerCase().includes(normalized));
  }, [source, query]);

  if (!role || role === "teacher") return null;

  return (
    <>
      <div className="fixed bottom-4 right-4 z-40 flex flex-col items-end gap-2 sm:bottom-6 sm:right-6">
        <button type="button" onClick={() => void openArchive()} className="flex items-center gap-2 rounded-full border border-black/[0.08] bg-white px-4 py-3 text-sm font-semibold text-[#171717] shadow-[0_10px_30px_rgba(0,0,0,0.12)]"><Archive size={17} /> Выбывшие</button>
        <button type="button" onClick={() => setShowQuick(true)} className="flex items-center gap-2 rounded-full bg-[#D96A24] px-5 py-3.5 text-sm font-semibold text-white shadow-[0_12px_35px_rgba(217,106,36,0.3)]"><Plus size={18} /> Добавить ученика</button>
      </div>

      {showQuick && <QuickStudentModal onClose={() => setShowQuick(false)} onCreated={afterCreated} />}

      {showArchive && (
        <div className="fixed inset-0 z-[65] flex justify-end bg-black/30 backdrop-blur-[2px]" onClick={() => setShowArchive(false)}>
          <div className="h-full w-full max-w-xl overflow-y-auto bg-[#FAF9F5] p-5 shadow-[-20px_0_50px_rgba(0,0,0,0.15)] sm:p-7" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-start justify-between gap-4">
              <div><p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#D96A24]">Ученики</p><h2 className="mt-1 text-2xl font-semibold tracking-[-0.03em]">Активные и выбывшие</h2><p className="mt-2 text-sm leading-6 text-black/45">Если ребёнок учился — отмечаем «Выбыл» и сохраняем историю. Если вообще не приступил и кабинет не активирован — его можно удалить полностью.</p></div>
              <button type="button" onClick={() => setShowArchive(false)} className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-white text-black/55 shadow-sm"><X size={20} /></button>
            </div>

            <div className="mt-5 grid grid-cols-2 gap-2 rounded-[16px] bg-[#ECEAE2] p-1.5">
              <button type="button" onClick={() => setView("active")} className={`rounded-[12px] px-3 py-2.5 text-sm font-semibold ${view === "active" ? "bg-white text-[#171717] shadow-sm" : "text-black/45"}`}>Активные · {active.length}</button>
              <button type="button" onClick={() => setView("archived")} className={`rounded-[12px] px-3 py-2.5 text-sm font-semibold ${view === "archived" ? "bg-white text-[#171717] shadow-sm" : "text-black/45"}`}>Выбывшие · {archived.length}</button>
            </div>

            <div className="relative mt-4"><Search className="absolute left-3.5 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-black/30" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Поиск по ребёнку или родителю" className="w-full rounded-[14px] border border-black/[0.07] bg-white py-3 pl-11 pr-4 text-sm outline-none placeholder:text-black/25" /></div>
            {error && <div className="mt-4 rounded-[15px] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

            {loading ? <div className="grid min-h-[180px] place-items-center"><LoaderCircle className="animate-spin text-black/25" /></div> : <div className="mt-4 space-y-2">
              {visible.length === 0 && <div className="rounded-[18px] bg-white px-5 py-9 text-center text-sm text-black/40">В этом списке пока никого нет.</div>}
              {visible.map((child) => <div key={child.id} className="rounded-[18px] border border-black/[0.055] bg-white p-4"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="font-semibold text-[#171717]">{child.fullName}</p><p className="mt-1 text-xs text-black/40">{[child.branch, child.groupName, child.parentName, child.parentPhone].filter(Boolean).join(" · ")}</p>{child.archivedAt && <p className="mt-2 text-xs text-black/35">Выбыл: {new Date(child.archivedAt).toLocaleDateString("ru-RU")} · {child.archiveReason}</p>}</div>{view === "active" ? <div className="flex shrink-0 flex-col gap-1.5"><button type="button" onClick={() => { setArchiveChild(child); setReason(""); setOtherReason(""); setError(""); }} className="flex items-center justify-center gap-1.5 rounded-[11px] bg-[#171717] px-3 py-2 text-xs font-semibold text-white"><UserX size={14}/> Выбыл</button><button type="button" onClick={() => { setDeleteChild(child); setError(""); }} className="flex items-center justify-center gap-1.5 rounded-[11px] bg-red-50 px-3 py-2 text-[11px] font-semibold text-red-600"><Trash2 size={13}/> Не приступил</button></div> : <button type="button" disabled={busyId === child.id} onClick={() => void restore(child)} className="flex shrink-0 items-center gap-1.5 rounded-[11px] bg-[#171717] px-3 py-2 text-xs font-semibold text-white disabled:opacity-50">{busyId === child.id ? <LoaderCircle className="animate-spin" size={14} /> : <RotateCcw size={14} />} Вернуть</button>}</div></div>)}
            </div>}
          </div>
        </div>
      )}

      {archiveChild && <div className="fixed inset-0 z-[80] grid place-items-center bg-black/35 p-4 backdrop-blur-[2px]" onClick={() => setArchiveChild(null)}><div className="w-full max-w-md rounded-[24px] bg-white p-5 shadow-2xl sm:p-6" onClick={(event) => event.stopPropagation()}><div className="flex items-start justify-between gap-3"><div><p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#D96A24]">Выбыл</p><h3 className="mt-1 text-xl font-semibold">{archiveChild.fullName}</h3></div><button type="button" onClick={() => setArchiveChild(null)} className="grid h-9 w-9 place-items-center rounded-full bg-[#F2F0E8] text-black/50"><X size={18} /></button></div><p className="mt-3 text-sm leading-6 text-black/45">Ребёнок исчезнет из активного списка и автоматически перейдёт в архив. Оценки, посещаемость, Star Coin, оплаты и вся история сохранятся.</p><label className="mt-4 block text-xs font-semibold text-black/55">Причина выбытия<select value={reason} onChange={(e) => setReason(e.target.value)} className="mt-1.5 w-full rounded-[13px] border border-black/[0.08] bg-[#FAF9F5] px-3.5 py-3 text-sm outline-none"><option value="">Выберите причину</option>{reasons.map((item) => <option key={item} value={item}>{item}</option>)}</select></label>{reason === "Другое" && <textarea value={otherReason} onChange={(e) => setOtherReason(e.target.value)} rows={3} placeholder="Укажите причину" className="mt-3 w-full resize-none rounded-[13px] border border-black/[0.08] bg-[#FAF9F5] px-3.5 py-3 text-sm outline-none" />}<p className="mt-3 text-xs text-black/35">Дата выбытия фиксируется автоматически.</p><div className="mt-5 grid grid-cols-2 gap-2"><button type="button" onClick={() => setArchiveChild(null)} className="rounded-[13px] border border-black/[0.08] px-4 py-3 text-sm font-semibold text-black/55">Отмена</button><button type="button" disabled={busyId === archiveChild.id} onClick={() => void confirmArchive()} className="flex items-center justify-center gap-2 rounded-[13px] bg-[#171717] px-4 py-3 text-sm font-semibold text-white disabled:opacity-50">{busyId === archiveChild.id && <LoaderCircle className="animate-spin" size={16} />} Отметить «Выбыл»</button></div></div></div>}

      {deleteChild && <div className="fixed inset-0 z-[81] grid place-items-center bg-black/35 p-4 backdrop-blur-[2px]" onClick={() => setDeleteChild(null)}><div className="w-full max-w-md rounded-[24px] bg-white p-5 shadow-2xl sm:p-6" onClick={(event) => event.stopPropagation()}><div className="flex items-start justify-between gap-3"><div><p className="text-[11px] font-bold uppercase tracking-[0.18em] text-red-600">Удаление</p><h3 className="mt-1 text-xl font-semibold">{deleteChild.fullName}</h3></div><button type="button" onClick={() => setDeleteChild(null)} className="grid h-9 w-9 place-items-center rounded-full bg-[#F2F0E8] text-black/50"><X size={18} /></button></div><p className="mt-3 text-sm leading-6 text-black/50">Это действие только для ребёнка, который <strong>вообще не приступил к занятиям</strong> и чей родитель не активировал кабинет. Система сама проверит учебную историю и не даст удалить действующего ученика.</p><div className="mt-4 rounded-[14px] bg-red-50 px-4 py-3 text-xs leading-5 text-red-700">Если уже были оценки, посещаемость, Star Coin, оплаты или кабинет активирован — используйте «Выбыл», а не удаление.</div>{error && <div className="mt-4 rounded-[14px] border border-red-200 px-4 py-3 text-sm text-red-700">{error}</div>}<div className="mt-5 grid grid-cols-2 gap-2"><button type="button" onClick={() => setDeleteChild(null)} className="rounded-[13px] border border-black/[0.08] px-4 py-3 text-sm font-semibold text-black/55">Отмена</button><button type="button" disabled={busyId === deleteChild.id} onClick={() => void confirmDelete()} className="flex items-center justify-center gap-2 rounded-[13px] bg-red-600 px-4 py-3 text-sm font-semibold text-white disabled:opacity-50">{busyId === deleteChild.id ? <LoaderCircle className="animate-spin" size={16}/> : <Trash2 size={16}/>} Удалить</button></div></div></div>}
    </>
  );
}
