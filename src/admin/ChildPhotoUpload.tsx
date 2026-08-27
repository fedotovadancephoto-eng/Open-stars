import { ChangeEvent, useEffect, useMemo, useRef, useState } from "react";
import { Camera, CheckCircle2, ImagePlus, LoaderCircle, Search, Upload, X } from "lucide-react";

import {
  PhotoStudent,
  fetchPhotoUploadContext,
  uploadChildPhoto,
} from "@/admin/photoUploadApi";

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return parts.slice(0, 2).map((part) => part.charAt(0)).join("").toUpperCase() || "OS";
}

export function ChildPhotoUpload() {
  const [enabled, setEnabled] = useState(false);
  const [open, setOpen] = useState(false);
  const [students, setStudents] = useState<PhotoStudent[]>([]);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<PhotoStudent | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const inputRef = useRef<HTMLInputElement | null>(null);

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
        if (!cancelled) {
          timer = window.setTimeout(detectAccess, 1200);
        }
      }
    }

    detectAccess();
    return () => {
      cancelled = true;
      if (timer) window.clearTimeout(timer);
    };
  }, []);

  useEffect(() => {
    return () => {
      if (preview.startsWith("blob:")) URL.revokeObjectURL(preview);
    };
  }, [preview]);

  const visible = useMemo(() => {
    const value = query.trim().toLowerCase();
    if (!value) return students.slice(0, 30);
    return students
      .filter((student) =>
        [student.fullName, student.branch, student.groupName]
          .join(" ")
          .toLowerCase()
          .includes(value)
      )
      .slice(0, 30);
  }, [query, students]);

  async function openModal() {
    setOpen(true);
    setLoading(true);
    setError("");
    setSuccess("");
    try {
      const context = await fetchPhotoUploadContext();
      setEnabled(context.canUpload);
      setStudents(context.students);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось загрузить список учеников.");
    } finally {
      setLoading(false);
    }
  }

  function closeModal() {
    if (saving) return;
    setOpen(false);
    setQuery("");
    setSelected(null);
    setFile(null);
    setPreview("");
    setError("");
    setSuccess("");
  }

  function chooseStudent(student: PhotoStudent) {
    setSelected(student);
    setFile(null);
    setPreview(student.photoUrl || "");
    setError("");
    setSuccess("");
  }

  function chooseFile(event: ChangeEvent<HTMLInputElement>) {
    const next = event.target.files?.[0] ?? null;
    if (!next) return;
    if (!next.type.startsWith("image/")) {
      setError("Можно выбрать только фотографию.");
      return;
    }
    if (next.size > 25 * 1024 * 1024) {
      setError("Исходный файл слишком большой. Выберите фото до 25 МБ.");
      return;
    }

    if (preview.startsWith("blob:")) URL.revokeObjectURL(preview);
    setFile(next);
    setPreview(URL.createObjectURL(next));
    setError("");
    setSuccess("");
  }

  async function upload() {
    if (!selected) {
      setError("Сначала выберите ребёнка.");
      return;
    }
    if (!file) {
      setError("Выберите фотографию с телефона или компьютера.");
      return;
    }

    setSaving(true);
    setError("");
    setSuccess("");
    try {
      const url = await uploadChildPhoto(selected.id, file);
      setSelected((current) => (current ? { ...current, photoUrl: url } : current));
      setPreview(url);
      setFile(null);
      setStudents((current) =>
        current.map((student) =>
          student.id === selected.id ? { ...student, photoUrl: url } : student
        )
      );
      setSuccess("Фото загружено и уже привязано к карточке ребёнка.");
      window.setTimeout(() => window.location.reload(), 900);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось загрузить фотографию.");
    } finally {
      setSaving(false);
    }
  }

  if (!enabled) return null;

  return (
    <>
      <button
        type="button"
        onClick={openModal}
        className="fixed bottom-[8.7rem] right-4 z-40 flex items-center gap-2 rounded-full border border-black/[0.08] bg-[#5F6338] px-4 py-3 text-sm font-semibold text-white shadow-[0_10px_30px_rgba(0,0,0,0.16)] sm:bottom-[9.4rem] sm:right-6"
      >
        <Camera size={17} /> Фото ребёнка
      </button>

      {open && (
        <div
          className="fixed inset-0 z-[75] flex items-end justify-center bg-black/30 p-0 backdrop-blur-[2px] sm:items-center sm:p-5"
          onClick={closeModal}
        >
          <div
            className="max-h-[94vh] w-full max-w-3xl overflow-y-auto rounded-t-[28px] bg-[#FAF9F5] p-5 shadow-2xl sm:rounded-[28px] sm:p-7"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#D96A24]">Карточка ученика</p>
                <h2 className="mt-1 text-2xl font-semibold tracking-[-0.03em] text-[#171717]">Загрузить фото ребёнка</h2>
                <p className="mt-2 text-sm leading-6 text-black/45">Выберите ребёнка, затем фотографию из галереи. Фото автоматически уменьшается для приложения и сохраняется в Storage.</p>
              </div>
              <button type="button" onClick={closeModal} disabled={saving} className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-white text-black/55 shadow-sm disabled:opacity-50" aria-label="Закрыть"><X size={20} /></button>
            </div>

            <div className="mt-6 grid gap-5 md:grid-cols-[1fr_0.95fr]">
              <div className="min-w-0">
                <p className="text-xs font-semibold text-black/55">1. Найдите ребёнка</p>
                <div className="relative mt-2">
                  <Search className="absolute left-3.5 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-black/30" />
                  <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Имя, филиал или группа" className="w-full rounded-[14px] border border-black/[0.07] bg-white py-3 pl-11 pr-4 text-sm outline-none placeholder:text-black/25 focus:border-[#D96A24]/40" />
                </div>

                <div className="mt-3 max-h-[330px] space-y-2 overflow-y-auto pr-1">
                  {loading && <div className="grid min-h-[120px] place-items-center"><LoaderCircle className="animate-spin text-black/25" /></div>}
                  {!loading && visible.length === 0 && <div className="rounded-[17px] bg-white px-4 py-8 text-center text-sm text-black/40">Ничего не найдено.</div>}
                  {!loading && visible.map((student) => {
                    const active = selected?.id === student.id;
                    return (
                      <button
                        key={student.id}
                        type="button"
                        onClick={() => chooseStudent(student)}
                        className={`flex w-full items-center gap-3 rounded-[17px] border p-3 text-left transition ${active ? "border-[#D96A24]/35 bg-[#D96A24]/[0.06]" : "border-black/[0.055] bg-white hover:border-black/[0.12]"}`}
                      >
                        {student.photoUrl ? <img src={student.photoUrl} alt="" className="h-11 w-11 shrink-0 rounded-[13px] object-cover" /> : <div className="grid h-11 w-11 shrink-0 place-items-center rounded-[13px] bg-[#F0EEE5] text-xs font-bold text-[#5F6338]">{initials(student.fullName)}</div>}
                        <div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold text-[#171717]">{student.fullName}</p><p className="mt-0.5 truncate text-xs text-black/40">{[student.branch, student.groupName].filter(Boolean).join(" · ")}</p></div>
                        {active && <CheckCircle2 className="shrink-0 text-[#D96A24]" size={19} />}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <p className="text-xs font-semibold text-black/55">2. Выберите фотографию</p>
                <div className="mt-2 rounded-[22px] border border-black/[0.06] bg-white p-4">
                  <div className="grid aspect-square w-full max-h-[330px] place-items-center overflow-hidden rounded-[18px] bg-[#F0EEE5]">
                    {preview ? <img src={preview} alt="Предпросмотр" className="h-full w-full object-cover" /> : selected ? <div className="text-center"><div className="mx-auto grid h-20 w-20 place-items-center rounded-[22px] bg-white text-xl font-bold text-[#5F6338]">{initials(selected.fullName)}</div><p className="mt-3 text-sm font-semibold text-[#171717]">{selected.fullName}</p></div> : <div className="px-6 text-center text-sm leading-6 text-black/35"><ImagePlus className="mx-auto mb-3" size={34} />Сначала выберите ребёнка слева.</div>}
                  </div>

                  <input
                    ref={inputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/heic,image/heif,.heic,.heif"
                    onChange={chooseFile}
                    className="hidden"
                  />

                  <button
                    type="button"
                    disabled={!selected || saving}
                    onClick={() => inputRef.current?.click()}
                    className="mt-4 flex w-full items-center justify-center gap-2 rounded-[14px] border border-black/[0.08] bg-[#FAF9F5] px-4 py-3.5 text-sm font-semibold text-[#171717] disabled:opacity-40"
                  >
                    <ImagePlus size={18} /> {file ? "Выбрать другое фото" : "Выбрать из галереи"}
                  </button>

                  {file && <p className="mt-2 truncate text-center text-[11px] text-black/35">{file.name} · {(file.size / 1024 / 1024).toFixed(1)} МБ</p>}
                </div>
              </div>
            </div>

            {error && <div className="mt-5 rounded-[15px] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
            {success && <div className="mt-5 flex items-start gap-2 rounded-[15px] border border-[#5F6338]/15 bg-[#5F6338]/[0.07] px-4 py-3 text-sm font-medium text-[#4D512E]"><CheckCircle2 className="mt-0.5 shrink-0" size={17} /> {success}</div>}

            <div className="mt-6 flex justify-end">
              <button
                type="button"
                onClick={upload}
                disabled={!selected || !file || saving}
                className="flex w-full items-center justify-center gap-2 rounded-[15px] bg-[#171717] px-6 py-3.5 text-sm font-semibold text-white shadow-sm disabled:cursor-not-allowed disabled:opacity-40 sm:w-auto"
              >
                {saving ? <LoaderCircle className="animate-spin" size={18} /> : <Upload size={18} />}
                {saving ? "Загружаем..." : "Загрузить и сохранить"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
