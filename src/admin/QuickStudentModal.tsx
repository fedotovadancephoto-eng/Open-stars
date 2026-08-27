import { useState } from "react";
import { LoaderCircle, Plus, Save, X } from "lucide-react";

import {
  BranchName,
  GroupName,
  QuickStudentInput,
  quickCreateStudent,
} from "@/admin/adminApi";
import { administratorForBranch } from "@/admin/branchAdministrators";

const branches: BranchName[] = ["Свердловский", "НЛО", "Октябрьский"];
const groups: GroupName[] = ["Базовый", "Продвинутый", "PRO"];
const times = ["11:00", "13:00", "16:00"];
const days = ["Суббота", "Воскресенье"];

const inputClass = "mt-1.5 w-full rounded-[13px] border border-black/[0.08] bg-[#FAF9F5] px-3.5 py-3 text-sm text-[#171717] outline-none placeholder:text-black/25 focus:border-[#D96A24]/45 focus:ring-4 focus:ring-[#D96A24]/[0.06]";

const emptyForm: QuickStudentInput = {
  firstName: "",
  lastName: "",
  parentName: "",
  parentPhone: "",
  branch: "",
  groupName: "",
  birthDate: "",
  lessonDay: "",
  lessonTime: "",
  photoUrl: "",
};

export function QuickStudentModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (addNext: boolean) => Promise<void>;
}) {
  const [form, setForm] = useState<QuickStudentInput>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  function field<K extends keyof QuickStudentInput>(key: K, value: QuickStudentInput[K]) {
    setForm((current) => ({ ...current, [key]: value }));
    setError("");
    setSuccess("");
  }

  async function save(addNext: boolean) {
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      await quickCreateStudent(form);

      if (addNext) {
        setSuccess(`${form.firstName} ${form.lastName} добавлен(а). Можно вводить следующего.`);
        setForm((current) => ({
          ...emptyForm,
          branch: current.branch,
          groupName: current.groupName,
          lessonDay: current.lessonDay,
          lessonTime: current.lessonTime,
        }));
        await onCreated(true);
      } else {
        await onCreated(false);
        onClose();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось добавить ученика.");
    } finally {
      setSaving(false);
    }
  }

  const administrator = administratorForBranch(form.branch);

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/30 p-0 backdrop-blur-[2px] sm:items-center sm:p-5" onClick={onClose}>
      <div className="max-h-[94vh] w-full overflow-y-auto rounded-t-[28px] bg-[#FAF9F5] p-5 shadow-2xl sm:max-w-2xl sm:rounded-[28px] sm:p-7" onClick={(event) => event.stopPropagation()}>
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#D96A24]">Быстрый ввод</p>
            <h2 className="mt-1 text-2xl font-semibold tracking-[-0.03em] text-[#171717]">Добавить ученика</h2>
            <p className="mt-2 text-sm leading-6 text-black/45">Обязательны только ребёнок, родитель, телефон, филиал и группа. Остальное можно заполнить позже.</p>
          </div>
          <button type="button" onClick={onClose} className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-white text-black/55 shadow-sm" aria-label="Закрыть"><X size={20} /></button>
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <label className="text-xs font-semibold text-black/55">Фамилия ребёнка *<input autoFocus className={inputClass} value={form.lastName} onChange={(e) => field("lastName", e.target.value)} /></label>
          <label className="text-xs font-semibold text-black/55">Имя ребёнка *<input className={inputClass} value={form.firstName} onChange={(e) => field("firstName", e.target.value)} /></label>
          <label className="text-xs font-semibold text-black/55">Имя родителя *<input className={inputClass} value={form.parentName} onChange={(e) => field("parentName", e.target.value)} placeholder="Например, Анна" /></label>
          <label className="text-xs font-semibold text-black/55">Телефон родителя *<input inputMode="tel" className={inputClass} value={form.parentPhone} onChange={(e) => field("parentPhone", e.target.value)} placeholder="+7 999 123-45-67" /></label>
          <label className="text-xs font-semibold text-black/55">Филиал *<select className={inputClass} value={form.branch} onChange={(e) => field("branch", e.target.value as BranchName | "")}><option value="">Выберите филиал</option>{branches.map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
          <label className="text-xs font-semibold text-black/55">Группа *<select className={inputClass} value={form.groupName} onChange={(e) => field("groupName", e.target.value as GroupName | "")}><option value="">Выберите группу</option>{groups.map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
          <label className="text-xs font-semibold text-black/55">День занятий<select className={inputClass} value={form.lessonDay} onChange={(e) => field("lessonDay", e.target.value)}><option value="">Заполнить позже</option>{days.map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
          <label className="text-xs font-semibold text-black/55">Время группы<select className={inputClass} value={form.lessonTime} onChange={(e) => field("lessonTime", e.target.value)}><option value="">Заполнить позже</option>{times.map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
          <label className="text-xs font-semibold text-black/55">Дата рождения<input type="date" className={inputClass} value={form.birthDate} onChange={(e) => field("birthDate", e.target.value)} /></label>
          <label className="text-xs font-semibold text-black/55">Администратор<input className={`${inputClass} cursor-not-allowed bg-[#F0EEE5]`} value={administrator} readOnly placeholder="Подставится по филиалу" /></label>
        </div>

        {error && <div className="mt-5 rounded-[15px] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
        {success && <div className="mt-5 rounded-[15px] border border-[#5F6338]/15 bg-[#5F6338]/[0.07] px-4 py-3 text-sm font-medium text-[#4D512E]">{success}</div>}

        <div className="mt-6 grid gap-2 sm:grid-cols-2">
          <button type="button" disabled={saving} onClick={() => save(false)} className="flex items-center justify-center gap-2 rounded-[15px] border border-black/[0.08] bg-white px-4 py-3.5 text-sm font-semibold text-[#171717] disabled:opacity-50">{saving ? <LoaderCircle className="animate-spin" size={17} /> : <Save size={17} />} Сохранить</button>
          <button type="button" disabled={saving} onClick={() => save(true)} className="flex items-center justify-center gap-2 rounded-[15px] bg-[#171717] px-4 py-3.5 text-sm font-semibold text-white disabled:opacity-50">{saving ? <LoaderCircle className="animate-spin" size={17} /> : <Plus size={17} />} Сохранить и добавить следующего</button>
        </div>
      </div>
    </div>
  );
}
