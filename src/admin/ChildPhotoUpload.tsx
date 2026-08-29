import { ChangeEvent, PointerEvent as ReactPointerEvent, useEffect, useMemo, useRef, useState } from "react";
import { Camera, CheckCircle2, ImagePlus, LoaderCircle, Move, RefreshCw, Search, Upload, X, ZoomIn, ZoomOut } from "lucide-react";

import {
  PhotoStudent,
  fetchPhotoUploadContext,
  fileFromExistingPhoto,
  uploadChildPhoto,
} from "@/admin/photoUploadApi";

export const OPEN_CHILD_PHOTO_UPLOAD_EVENT = "openstars:open-child-photo-upload";
export const CHILD_PHOTO_UPDATED_EVENT = "openstars:child-photo-updated";

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return parts.slice(0, 2).map((part) => part.charAt(0)).join("").toUpperCase() || "OS";
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

const centerCrop = { zoom: 1, positionX: 50, positionY: 50 };

type DragState = {
  pointerId: number;
  startX: number;
  startY: number;
  positionX: number;
  positionY: number;
};

export function ChildPhotoUpload() {
  const [enabled, setEnabled] = useState(false);
  const [open, setOpen] = useState(false);
  const [students, setStudents] = useState<PhotoStudent[]>([]);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<PhotoStudent | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState("");
  const [crop, setCrop] = useState(centerCrop);
  const [loading, setLoading] = useState(false);
  const [loadingExisting, setLoadingExisting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const inputRef = useRef<HTMLInputElement | null>(null);
  const dragRef = useRef<DragState | null>(null);

  async function loadContext(selectChildId?: string) {
    const context = await fetchPhotoUploadContext();
    setEnabled(context.canUpload);
    setStudents(context.students);
    if (selectChildId) {
      const student = context.students.find((item) => item.id === selectChildId) || null;
      setSelected(student);
      setPreview(student?.photoUrl || "");
    }
    return context;
  }

  useEffect(() => {
    let cancelled = false;
    let timer = 0;
    async function detectAccess() {
      try {
        const context = await fetchPhotoUploadContext();
        if (cancelled) return;
        setEnabled(context.canUpload);
        if (context.canUpload) setStudents(context.students);
      } catch {
        if (!cancelled) timer = window.setTimeout(detectAccess, 1200);
      }
    }
    detectAccess();
    return () => {
      cancelled = true;
      if (timer) window.clearTimeout(timer);
    };
  }, []);

  useEffect(() => {
    const handler = (event: Event) => {
      const detail = (event as CustomEvent<{ childId?: string }>).detail;
      setOpen(true);
      setLoading(true);
      setError("");
      setSuccess("");
      setQuery("");
      setFile(null);
      setCrop(centerCrop);
      dragRef.current = null;
      loadContext(detail?.childId)
        .catch((err) => setError(err instanceof Error ? err.message : "Не удалось загрузить список учеников."))
        .finally(() => setLoading(false));
    };
    window.addEventListener(OPEN_CHILD_PHOTO_UPLOAD_EVENT, handler);
    return () => window.removeEventListener(OPEN_CHILD_PHOTO_UPLOAD_EVENT, handler);
  }, []);

  useEffect(() => () => {
    if (preview.startsWith("blob:")) URL.revokeObjectURL(preview);
  }, [preview]);

  const visible = useMemo(() => {
    const value = query.trim().toLowerCase();
    if (!value) return students.slice(0, 30);
    return students.filter((student) => [student.fullName, student.branch, student.groupName].join(" ").toLowerCase().includes(value)).slice(0, 30);
  }, [query, students]);

  async function openModal() {
    setOpen(true);
    setLoading(true);
    setError("");
    setSuccess("");
    try {
      await loadContext();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось загрузить список учеников.");
    } finally {
      setLoading(false);
    }
  }

  function clearLocalPreview() {
    if (preview.startsWith("blob:")) URL.revokeObjectURL(preview);
  }

  function closeModal() {
    if (saving) return;
    clearLocalPreview();
    setOpen(false);
    setQuery("");
    setSelected(null);
    setFile(null);
    setPreview("");
    setCrop(centerCrop);
    dragRef.current = null;
    setError("");
    setSuccess("");
  }

  function chooseStudent(student: PhotoStudent) {
    clearLocalPreview();
    setSelected(student);
    setFile(null);
    setPreview(student.photoUrl || "");
    setCrop(centerCrop);
    dragRef.current = null;
    setError("");
    setSuccess("");
  }

  function chooseFile(event: ChangeEvent<HTMLInputElement>) {
    const next = event.target.files?.[0] ?? null;
    if (!next) return;
    if (!next.type.startsWith("image/")) return setError("Можно выбрать только фотографию.");
    if (next.size > 25 * 1024 * 1024) return setError("Исходный файл слишком большой. Выберите фото до 25 МБ.");

    clearLocalPreview();
    setFile(next);
    setPreview(URL.createObjectURL(next));
    setCrop(centerCrop);
    dragRef.current = null;
    setError("");
    setSuccess("");
    event.target.value = "";
  }

  async function editCurrentPhoto() {
    if (!selected?.photoUrl) return;
    setLoadingExisting(true);
    setError("");
    try {
      const current = await fileFromExistingPhoto(selected.photoUrl);
      clearLocalPreview();
      setFile(current);
      setPreview(URL.createObjectURL(current));
      setCrop(centerCrop);
      dragRef.current = null;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось открыть текущее фото.");
    } finally {
      setLoadingExisting(false);
    }
  }

  function changeZoom(delta: number) {
    setCrop((current) => ({ ...current, zoom: clamp(Number((current.zoom + delta).toFixed(2)), 1, 3) }));
  }

  function startDrag(event: ReactPointerEvent<HTMLDivElement>) {
    if (!file) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture?.(event.pointerId);
    dragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      positionX: crop.positionX,
      positionY: crop.positionY,
    };
  }

  function moveDrag(event: ReactPointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;
    if (!file || !drag || drag.pointerId !== event.pointerId) return;
    event.preventDefault();
    const rect = event.currentTarget.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const dx = ((event.clientX - drag.startX) / rect.width) * 100;
    const dy = ((event.clientY - drag.startY) / rect.height) * 100;
    setCrop((current) => ({
      ...current,
      positionX: clamp(drag.positionX - dx, 0, 100),
      positionY: clamp(drag.positionY - dy, 0, 100),
    }));
  }

  function endDrag(event: ReactPointerEvent<HTMLDivElement>) {
    if (dragRef.current?.pointerId !== event.pointerId) return;
    try { event.currentTarget.releasePointerCapture?.(event.pointerId); } catch { /* already released */ }
    dragRef.current = null;
  }

  async function upload() {
    if (!selected) return setError("Сначала выберите ребёнка.");
    if (!file) return setError("Выберите фотографию или нажмите «Изменить текущий кадр». ");

    setSaving(true);
    setError("");
    setSuccess("");
    try {
      const url = await uploadChildPhoto(selected.id, file, {
        zoom: crop.zoom,
        positionX: crop.positionX / 100,
        positionY: crop.positionY / 100,
      });
      clearLocalPreview();
      setSelected((current) => (current ? { ...current, photoUrl: url } : current));
      setPreview(url);
      setFile(null);
      setCrop(centerCrop);
      dragRef.current = null;
      setStudents((current) => current.map((student) => student.id === selected.id ? { ...student, photoUrl: url } : student));
      setSuccess("Фото сохранено в вертикальном формате 4:5 и уже обновлено в карточке ребёнка.");
      window.dispatchEvent(new CustomEvent(CHILD_PHOTO_UPDATED_EVENT, { detail: { childId: selected.id, photoUrl: url } }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось загрузить фотографию.");
    } finally {
      setSaving(false);
    }
  }

  if (!enabled) return null;

  return (
    <>
      <button type="button" onClick={openModal} className="fixed bottom-[8.7rem] right-4 z-40 flex items-center gap-2 rounded-full border border-black/[0.08] bg-[#5F6338] px-4 py-3 text-sm font-semibold text-white shadow-[0_10px_30px_rgba(0,0,0,0.16)] sm:bottom-[9.4rem] sm:right-6">
        <Camera size={17} /> Фото ребёнка
      </button>

      {open && (
        <div className="fixed inset-0 z-[75] flex items-end justify-center bg-black/30 p-0 backdrop-blur-[2px] sm:items-center sm:p-5" onClick={closeModal}>
          <div className="max-h-[95vh] w-full max-w-4xl overflow-y-auto rounded-t-[28px] bg-[#FAF9F5] p-5 shadow-2xl sm:rounded-[28px] sm:p-7" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-start justify-between gap-4">
              <div><p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#D96A24]">Карточка ученика</p><h2 className="mt-1 text-2xl font-semibold tracking-[-0.03em] text-[#171717]">Фото ребёнка</h2><p className="mt-2 text-sm leading-6 text-black/45">Фото сохраняется вертикально 4:5. После выбора перетащите изображение пальцем внутри рамки и увеличьте его до нужного кадра.</p></div>
              <button type="button" onClick={closeModal} disabled={saving} className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-white text-black/55 shadow-sm disabled:opacity-50" aria-label="Закрыть"><X size={20} /></button>
            </div>

            <div className="mt-6 grid gap-5 md:grid-cols-[0.9fr_1.1fr]">
              <div className="min-w-0">
                <p className="text-xs font-semibold text-black/55">1. Найдите ребёнка</p>
                <div className="relative mt-2"><Search className="absolute left-3.5 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-black/30" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Имя, филиал или группа" className="w-full rounded-[14px] border border-black/[0.07] bg-white py-3 pl-11 pr-4 text-sm outline-none placeholder:text-black/25 focus:border-[#D96A24]/40" /></div>
                <div className="mt-3 max-h-[420px] space-y-2 overflow-y-auto pr-1">
                  {loading && <div className="grid min-h-[120px] place-items-center"><LoaderCircle className="animate-spin text-black/25" /></div>}
                  {!loading && visible.length === 0 && <div className="rounded-[17px] bg-white px-4 py-8 text-center text-sm text-black/40">Ничего не найдено.</div>}
                  {!loading && visible.map((student) => {
                    const active = selected?.id === student.id;
                    return <button key={student.id} type="button" onClick={() => chooseStudent(student)} className={`flex w-full items-center gap-3 rounded-[17px] border p-3 text-left transition ${active ? "border-[#D96A24]/35 bg-[#D96A24]/[0.06]" : "border-black/[0.055] bg-white hover:border-black/[0.12]"}`}>
                      {student.photoUrl ? <img src={student.photoUrl} alt="" className="h-12 w-10 shrink-0 rounded-[11px] object-cover" /> : <div className="grid h-12 w-10 shrink-0 place-items-center rounded-[11px] bg-[#F0EEE5] text-xs font-bold text-[#5F6338]">{initials(student.fullName)}</div>}
                      <div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold text-[#171717]">{student.fullName}</p><p className="mt-0.5 truncate text-xs text-black/40">{[student.branch, student.groupName].filter(Boolean).join(" · ")}</p></div>{active && <CheckCircle2 className="shrink-0 text-[#D96A24]" size={19} />}
                    </button>;
                  })}
                </div>
              </div>

              <div>
                <p className="text-xs font-semibold text-black/55">2. Подгоните кадр</p>
                <div className="mt-2 rounded-[22px] border border-black/[0.06] bg-white p-4">
                  <div
                    className={`relative mx-auto aspect-[4/5] w-full max-w-[330px] overflow-hidden rounded-[20px] bg-[#F0EEE5] shadow-inner ${file ? "touch-none cursor-grab active:cursor-grabbing" : ""}`}
                    onPointerDown={startDrag}
                    onPointerMove={moveDrag}
                    onPointerUp={endDrag}
                    onPointerCancel={endDrag}
                  >
                    {preview ? <img src={preview} alt="Предпросмотр" draggable={false} className="pointer-events-none h-full w-full select-none object-cover" style={{ objectPosition: `${crop.positionX}% ${crop.positionY}%`, transform: `scale(${crop.zoom})`, transformOrigin: `${crop.positionX}% ${crop.positionY}%` }} /> : selected ? <div className="grid h-full place-items-center text-center"><div><div className="mx-auto grid h-20 w-20 place-items-center rounded-[22px] bg-white text-xl font-bold text-[#5F6338]">{initials(selected.fullName)}</div><p className="mt-3 text-sm font-semibold text-[#171717]">{selected.fullName}</p></div></div> : <div className="grid h-full place-items-center px-6 text-center text-sm leading-6 text-black/35"><div><ImagePlus className="mx-auto mb-3" size={34} />Сначала выберите ребёнка.</div></div>}
                    {file && <div className="pointer-events-none absolute inset-x-3 bottom-3 flex items-center justify-center gap-1.5 rounded-full bg-black/55 px-3 py-2 text-[11px] font-semibold text-white backdrop-blur-sm"><Move size={13} /> Перетащите фото пальцем</div>}
                  </div>

                  <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp,image/heic,image/heif,.heic,.heif" onChange={chooseFile} className="hidden" />
                  <div className="mt-4 grid gap-2 sm:grid-cols-2">
                    <button type="button" disabled={!selected || saving} onClick={() => inputRef.current?.click()} className="flex items-center justify-center gap-2 rounded-[14px] border border-black/[0.08] bg-[#FAF9F5] px-4 py-3 text-sm font-semibold text-[#171717] disabled:opacity-40"><ImagePlus size={18} />{file ? "Другое фото" : "Из галереи"}</button>
                    {selected?.photoUrl && !file && <button type="button" disabled={loadingExisting || saving} onClick={editCurrentPhoto} className="flex items-center justify-center gap-2 rounded-[14px] border border-black/[0.08] bg-[#FAF9F5] px-4 py-3 text-sm font-semibold text-[#171717] disabled:opacity-40">{loadingExisting ? <LoaderCircle className="animate-spin" size={17} /> : <RefreshCw size={17} />}Изменить текущий кадр</button>}
                  </div>

                  {file && <div className="mt-5 space-y-4 rounded-[17px] bg-[#FAF9F5] p-4">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-xs font-semibold text-black/55">Масштаб · {crop.zoom.toFixed(2)}×</span>
                      <div className="flex gap-2">
                        <button type="button" onClick={() => changeZoom(-0.15)} disabled={crop.zoom <= 1} className="grid h-10 w-10 place-items-center rounded-xl bg-white text-black/55 shadow-sm disabled:opacity-30" aria-label="Уменьшить"><ZoomOut size={18} /></button>
                        <button type="button" onClick={() => changeZoom(0.15)} disabled={crop.zoom >= 3} className="grid h-10 w-10 place-items-center rounded-xl bg-white text-black/55 shadow-sm disabled:opacity-30" aria-label="Увеличить"><ZoomIn size={18} /></button>
                      </div>
                    </div>
                    <input aria-label="Масштаб фотографии" type="range" min="1" max="3" step="0.05" value={crop.zoom} onChange={(event) => setCrop((current) => ({ ...current, zoom: Number(event.target.value) }))} className="w-full accent-[#D96A24]" />
                    <div className="rounded-[13px] bg-white px-3 py-2.5 text-[11px] leading-5 text-black/45">На телефоне удобнее просто перетаскивать фото внутри рамки. Ползунки ниже оставлены для точной подгонки.</div>
                    <label className="block text-xs font-semibold text-black/55">По горизонтали<input type="range" min="0" max="100" value={crop.positionX} onChange={(event) => setCrop((current) => ({ ...current, positionX: Number(event.target.value) }))} className="mt-2 w-full accent-[#5F6338]" /></label>
                    <label className="block text-xs font-semibold text-black/55">По вертикали<input type="range" min="0" max="100" value={crop.positionY} onChange={(event) => setCrop((current) => ({ ...current, positionY: Number(event.target.value) }))} className="mt-2 w-full accent-[#5F6338]" /></label>
                    <button type="button" onClick={() => setCrop(centerCrop)} className="text-xs font-semibold text-[#D96A24]">Вернуть по центру</button>
                  </div>}
                </div>
              </div>
            </div>

            {error && <div className="mt-5 rounded-[15px] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
            {success && <div className="mt-5 flex items-start gap-2 rounded-[15px] border border-[#5F6338]/15 bg-[#5F6338]/[0.07] px-4 py-3 text-sm font-medium text-[#4D512E]"><CheckCircle2 className="mt-0.5 shrink-0" size={17} />{success}</div>}
            <div className="mt-6 flex justify-end"><button type="button" onClick={upload} disabled={!selected || !file || saving} className="flex w-full items-center justify-center gap-2 rounded-[15px] bg-[#171717] px-6 py-3.5 text-sm font-semibold text-white shadow-sm disabled:cursor-not-allowed disabled:opacity-40 sm:w-auto">{saving ? <LoaderCircle className="animate-spin" size={18} /> : <Upload size={18} />}{saving ? "Сохраняем..." : "Сохранить кадр"}</button></div>
          </div>
        </div>
      )}
    </>
  );
}
