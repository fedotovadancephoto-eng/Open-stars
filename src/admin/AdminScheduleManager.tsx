import { useEffect, useMemo, useState } from "react";
import { CalendarDays, CheckCircle2, Clock3, LoaderCircle, Pencil, Plus, Save, Trash2, UsersRound, X } from "lucide-react";

import {
  GroupSchedule,
  ScheduleBranch,
  ScheduleGroup,
  ScheduleLessonInput,
  ScheduleStream,
  deleteGroupSchedule,
  fetchGroupSchedules,
  fetchScheduleContext,
  publishGroupSchedule,
  updateGroupSchedule,
} from "@/admin/scheduleApi";

const branches: ScheduleBranch[] = ["Свердловский", "НЛО", "Октябрьский"];
const groups: ScheduleGroup[] = ["Базовый", "Продвинутый", "PRO"];
const streams: ScheduleStream[] = ["11:00", "13:00", "16:00"];

const streamRules: Record<ScheduleStream, { duration: number; breakMinutes: number }> = {
  "11:00": { duration: 30, breakMinutes: 5 },
  "13:00": { duration: 45, breakMinutes: 10 },
  "16:00": { duration: 45, breakMinutes: 10 },
};

const defaultLessons: ScheduleLessonInput[] = [
  { subject: "Дефиле", instructor: "", room: "" },
  { subject: "Хореография", instructor: "", room: "" },
  { subject: "Актёрское мастерство", instructor: "", room: "" },
];

function localDateValue(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function nextSaturday() {
  const date = new Date();
  const add = (6 - date.getDay() + 7) % 7;
  date.setDate(date.getDate() + add);
  return localDateValue(date);
}

function minutes(value: string) {
  const [hours, mins] = value.split(":").map(Number);
  return hours * 60 + mins;
}

function timeFromMinutes(value: number) {
  const hours = Math.floor(value / 60) % 24;
  const mins = value % 60;
  return `${String(hours).padStart(2, "0")}:${String(mins).padStart(2, "0")}`;
}

function lessonTimes(stream: ScheduleStream) {
  const rule = streamRules[stream];
  const start = minutes(stream);
  return [0, 1, 2].map((index) => {
    const lessonStart = start + index * (rule.duration + rule.breakMinutes);
    return {
      start: timeFromMinutes(lessonStart),
      end: timeFromMinutes(lessonStart + rule.duration),
    };
  });
}

function formatDate(value: string) {
  const date = new Date(`${value}T12:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("ru-RU", { weekday: "short", day: "numeric", month: "short" })
    .format(date)
    .replace(".", "");
}

const inputClass = "mt-1.5 w-full rounded-[13px] border border-black/[0.08] bg-white px-3.5 py-3 text-sm text-[#171717] outline-none focus:border-[#D96A24]/45 focus:ring-4 focus:ring-[#D96A24]/[0.06]";

export function AdminScheduleManager() {
  const [enabled, setEnabled] = useState(false);
  const [canManage, setCanManage] = useState(false);
  const [staffBranch, setStaffBranch] = useState("");
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [schedules, setSchedules] = useState<GroupSchedule[]>([]);
  const [branch, setBranch] = useState<ScheduleBranch>("Октябрьский");
  const [groupName, setGroupName] = useState<ScheduleGroup>("PRO");
  const [stream, setStream] = useState<ScheduleStream>("16:00");
  const [firstDate, setFirstDate] = useState(nextSaturday());
  const [weeks, setWeeks] = useState(4);
  const [lessons, setLessons] = useState<ScheduleLessonInput[]>(defaultLessons);
  const [editId, setEditId] = useState("");
  const [editStream, setEditStream] = useState<ScheduleStream>("16:00");
  const [editLessons, setEditLessons] = useState<ScheduleLessonInput[]>(defaultLessons);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [busyId, setBusyId] = useState("");

  useEffect(() => {
    let cancelled = false;
    let timer = 0;
    async function detect() {
      try {
        const context = await fetchScheduleContext();
        if (cancelled) return;
        setEnabled(true);
        setCanManage(context.canManage);
        setStaffBranch(context.staffBranch);
        if (context.role === "admin" && context.staffBranch && branches.includes(context.staffBranch as ScheduleBranch)) {
          setBranch(context.staffBranch as ScheduleBranch);
        }
      } catch {
        if (!cancelled) timer = window.setTimeout(detect, 1200);
      }
    }
    detect();
    return () => {
      cancelled = true;
      if (timer) window.clearTimeout(timer);
    };
  }, []);

  const preview = useMemo(() => lessonTimes(stream), [stream]);
  const editPreview = useMemo(() => lessonTimes(editStream), [editStream]);
  const adminLocked = Boolean(staffBranch);

  async function refresh() {
    setLoading(true);
    setError("");
    try {
      setSchedules(await fetchGroupSchedules(localDateValue()));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось загрузить расписание.");
    } finally {
      setLoading(false);
    }
  }

  async function openManager() {
    setOpen(true);
    setSuccess("");
    await refresh();
  }

  function updateLesson(index: number, key: keyof ScheduleLessonInput, value: string) {
    setLessons((current) => current.map((lesson, position) => position === index ? { ...lesson, [key]: value } : lesson));
  }

  function updateEditLesson(index: number, key: keyof ScheduleLessonInput, value: string) {
    setEditLessons((current) => current.map((lesson, position) => position === index ? { ...lesson, [key]: value } : lesson));
  }

  async function publish() {
    if (!firstDate) return setError("Выберите дату первого занятия.");
    if (lessons.some((lesson) => !lesson.subject.trim())) return setError("Заполните название всех трёх уроков.");
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      const result = await publishGroupSchedule({ branch, groupName, firstDate, streamStart: stream, lessons, weeks });
      const maxStudents = Math.max(0, ...(result || []).map((row) => Number(row.students_count || 0)));
      setSuccess(maxStudents === 0
        ? `Расписание сохранено на ${weeks} нед. Сейчас в этом потоке нет учеников; новые карточки подхватят занятия автоматически.`
        : `Готово: расписание опубликовано на ${weeks} нед. для ${maxStudents} ученик(ов).`);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось опубликовать расписание.");
    } finally {
      setSaving(false);
    }
  }

  function startEdit(schedule: GroupSchedule) {
    setEditId(schedule.id);
    setEditStream((streams.includes(schedule.streamStart as ScheduleStream) ? schedule.streamStart : "16:00") as ScheduleStream);
    setEditLessons([0, 1, 2].map((index) => {
      const lesson = schedule.lessons[index];
      return {
        subject: lesson?.subject || "",
        instructor: lesson?.instructor || "",
        room: lesson?.room || "",
      };
    }));
    setError("");
    setSuccess("");
  }

  async function saveEdit(schedule: GroupSchedule) {
    if (editLessons.some((lesson) => !lesson.subject.trim())) return setError("Заполните название всех трёх уроков.");
    setBusyId(schedule.id);
    setError("");
    setSuccess("");
    try {
      const result = await updateGroupSchedule({ batchId: schedule.id, streamStart: editStream, lessons: editLessons });
      const count = Number(result?.[0]?.students_count || 0);
      setSuccess(`Изменения сохранены. Расписание обновлено у ${count} ученик(ов).`);
      setEditId("");
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось изменить расписание.");
    } finally {
      setBusyId("");
    }
  }

  async function remove(schedule: GroupSchedule) {
    if (!window.confirm(`Удалить расписание ${schedule.branch} · ${schedule.groupName} · ${formatDate(schedule.lessonDate)}?`)) return;
    setBusyId(schedule.id);
    setError("");
    try {
      await deleteGroupSchedule(schedule.id);
      if (editId === schedule.id) setEditId("");
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось удалить расписание.");
    } finally {
      setBusyId("");
    }
  }

  if (!enabled) return null;

  return (
    <>
      <button type="button" onClick={openManager} className="fixed bottom-[12.7rem] right-4 z-40 flex items-center gap-2 rounded-full bg-[#171717] px-4 py-3 text-sm font-semibold text-white shadow-[0_10px_30px_rgba(0,0,0,0.18)] sm:bottom-[13.4rem] sm:right-6">
        <CalendarDays size={17} /> Расписание
      </button>

      {open && (
        <div className="fixed inset-0 z-[76] flex items-end justify-center bg-black/30 p-0 backdrop-blur-[2px] sm:items-center sm:p-5" onClick={() => !saving && !busyId && setOpen(false)}>
          <div className="max-h-[95vh] w-full max-w-5xl overflow-y-auto rounded-t-[28px] bg-[#FAF9F5] p-5 shadow-2xl sm:rounded-[28px] sm:p-7" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-start justify-between gap-4">
              <div><p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#D96A24]">OPEN STARS ADMIN</p><h2 className="mt-1 text-2xl font-semibold tracking-[-0.03em]">Расписание групп</h2><p className="mt-2 max-w-2xl text-sm leading-6 text-black/45">Публикуйте расписание на несколько недель и редактируйте уже опубликованные занятия без дублей.</p></div>
              <button type="button" onClick={() => setOpen(false)} disabled={saving || Boolean(busyId)} className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-white text-black/55 shadow-sm disabled:opacity-50"><X size={20} /></button>
            </div>

            {canManage && (
              <div className="mt-6 rounded-[24px] border border-black/[0.06] bg-white p-5 sm:p-6">
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                  <label className="text-xs font-semibold text-black/55">Филиал<select className={inputClass} value={branch} disabled={adminLocked} onChange={(event) => setBranch(event.target.value as ScheduleBranch)}>{branches.map((item) => <option key={item}>{item}</option>)}</select></label>
                  <label className="text-xs font-semibold text-black/55">Группа<select className={inputClass} value={groupName} onChange={(event) => setGroupName(event.target.value as ScheduleGroup)}>{groups.map((item) => <option key={item}>{item}</option>)}</select></label>
                  <label className="text-xs font-semibold text-black/55">Поток<select className={inputClass} value={stream} onChange={(event) => setStream(event.target.value as ScheduleStream)}>{streams.map((item) => <option key={item}>{item}</option>)}</select></label>
                  <label className="text-xs font-semibold text-black/55">Первое занятие<input type="date" className={inputClass} value={firstDate} onChange={(event) => setFirstDate(event.target.value)} /></label>
                  <label className="text-xs font-semibold text-black/55">Повторять<select className={inputClass} value={weeks} onChange={(event) => setWeeks(Number(event.target.value))}>{[1,2,3,4,5,6,7,8].map((item) => <option key={item} value={item}>{item} нед.</option>)}</select></label>
                </div>
                <div className="mt-5 space-y-3">
                  {lessons.map((lesson, index) => (
                    <div key={index} className="grid gap-3 rounded-[18px] bg-[#FAF9F5] p-4 md:grid-cols-[110px_1.2fr_1fr_0.8fr] md:items-end">
                      <div><p className="text-[10px] font-bold uppercase tracking-[0.16em] text-black/35">Урок {index + 1}</p><div className="mt-1 flex items-center gap-1.5 text-sm font-semibold"><Clock3 size={15} className="text-[#D96A24]" />{preview[index].start}–{preview[index].end}</div></div>
                      <label className="text-xs font-semibold text-black/55">Предмет<input className={inputClass} value={lesson.subject} onChange={(event) => updateLesson(index, "subject", event.target.value)} /></label>
                      <label className="text-xs font-semibold text-black/55">Преподаватель<input className={inputClass} value={lesson.instructor} onChange={(event) => updateLesson(index, "instructor", event.target.value)} placeholder="Можно заполнить позже" /></label>
                      <label className="text-xs font-semibold text-black/55">Зал<input className={inputClass} value={lesson.room} onChange={(event) => updateLesson(index, "room", event.target.value)} placeholder="Необязательно" /></label>
                    </div>
                  ))}
                </div>
                <p className="mt-3 text-xs leading-5 text-black/35">11:00 — уроки по 30 минут, перемены по 5. 13:00 и 16:00 — уроки по 45 минут, перемены по 10.</p>
                <button type="button" onClick={publish} disabled={saving} className="mt-5 flex w-full items-center justify-center gap-2 rounded-[15px] bg-[#D96A24] px-5 py-3.5 text-sm font-semibold text-white disabled:opacity-50 sm:w-auto">{saving ? <LoaderCircle className="animate-spin" size={18} /> : <Plus size={18} />}{saving ? "Публикуем..." : "Опубликовать расписание"}</button>
              </div>
            )}

            {error && <div className="mt-5 rounded-[15px] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
            {success && <div className="mt-5 flex items-start gap-2 rounded-[15px] border border-[#5F6338]/15 bg-[#5F6338]/[0.07] px-4 py-3 text-sm font-medium text-[#4D512E]"><CheckCircle2 className="mt-0.5 shrink-0" size={17} />{success}</div>}

            <div className="mt-7">
              <div className="flex items-end justify-between gap-3"><div><p className="text-[11px] font-bold uppercase tracking-[0.18em] text-black/35">Опубликовано</p><h3 className="mt-1 text-xl font-semibold">Ближайшие занятия</h3></div><button type="button" onClick={refresh} className="rounded-[12px] bg-white px-3 py-2 text-xs font-semibold text-black/50">Обновить</button></div>
              {loading ? <div className="grid min-h-[160px] place-items-center"><LoaderCircle className="animate-spin text-black/25" /></div> : (
                <div className="mt-4 space-y-3">
                  {schedules.length === 0 && <div className="rounded-[20px] bg-white px-5 py-9 text-center text-sm text-black/40">Групповое расписание пока не опубликовано.</div>}
                  {schedules.map((schedule) => (
                    <div key={schedule.id} className="rounded-[20px] border border-black/[0.055] bg-white p-4 sm:p-5">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div><div className="flex flex-wrap items-center gap-2"><span className="rounded-full bg-[#5F6338]/10 px-2.5 py-1 text-[11px] font-bold text-[#4D512E]">{schedule.groupName}</span><span className="text-sm font-semibold">{schedule.branch}</span><span className="text-sm text-black/40">{formatDate(schedule.lessonDate)} · {schedule.streamStart}</span></div><div className="mt-2 flex items-center gap-1.5 text-xs text-black/40"><UsersRound size={14} />{schedule.studentsCount} ученик(ов)</div></div>
                        {canManage && <div className="flex gap-2"><button type="button" disabled={Boolean(busyId)} onClick={() => startEdit(schedule)} className="flex items-center gap-1.5 rounded-[11px] bg-[#5F6338]/10 px-3 py-2 text-xs font-semibold text-[#4D512E] disabled:opacity-50"><Pencil size={14} />Изменить</button><button type="button" disabled={busyId === schedule.id} onClick={() => remove(schedule)} className="flex items-center gap-1.5 rounded-[11px] bg-red-50 px-3 py-2 text-xs font-semibold text-red-600 disabled:opacity-50">{busyId === schedule.id ? <LoaderCircle className="animate-spin" size={14} /> : <Trash2 size={14} />}Удалить</button></div>}
                      </div>

                      {editId === schedule.id ? (
                        <div className="mt-4 rounded-[18px] border border-[#D96A24]/15 bg-[#FFF9F4] p-4">
                          <div className="grid gap-3 sm:grid-cols-[180px_1fr] sm:items-end"><label className="text-xs font-semibold text-black/55">Поток<select className={inputClass} value={editStream} onChange={(event) => setEditStream(event.target.value as ScheduleStream)}>{streams.map((item) => <option key={item}>{item}</option>)}</select></label><p className="text-xs leading-5 text-black/40">Если изменить поток, время автоматически пересчитается и обновится в карточках детей этой группы.</p></div>
                          <div className="mt-3 space-y-2">{editLessons.map((lesson, index) => <div key={index} className="grid gap-2 rounded-[14px] bg-white p-3 md:grid-cols-[105px_1.2fr_1fr_0.8fr] md:items-end"><div className="text-xs font-semibold">{editPreview[index].start}–{editPreview[index].end}</div><label className="text-[11px] font-semibold text-black/50">Предмет<input className={inputClass} value={lesson.subject} onChange={(event) => updateEditLesson(index, "subject", event.target.value)} /></label><label className="text-[11px] font-semibold text-black/50">Преподаватель<input className={inputClass} value={lesson.instructor} onChange={(event) => updateEditLesson(index, "instructor", event.target.value)} /></label><label className="text-[11px] font-semibold text-black/50">Зал<input className={inputClass} value={lesson.room} onChange={(event) => updateEditLesson(index, "room", event.target.value)} /></label></div>)}</div>
                          <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:justify-end"><button type="button" onClick={() => setEditId("")} disabled={busyId === schedule.id} className="rounded-[12px] border border-black/[0.08] bg-white px-4 py-2.5 text-xs font-semibold text-black/55">Отмена</button><button type="button" onClick={() => saveEdit(schedule)} disabled={busyId === schedule.id} className="flex items-center justify-center gap-2 rounded-[12px] bg-[#171717] px-4 py-2.5 text-xs font-semibold text-white disabled:opacity-50">{busyId === schedule.id ? <LoaderCircle className="animate-spin" size={14} /> : <Save size={14} />}Сохранить изменения</button></div>
                        </div>
                      ) : (
                        <div className="mt-3 grid gap-2 md:grid-cols-3">{schedule.lessons.map((lesson) => <div key={lesson.position} className="rounded-[14px] bg-[#FAF9F5] px-3.5 py-3"><p className="text-xs font-bold text-[#171717]">{lesson.startTime}–{lesson.endTime}</p><p className="mt-1 text-sm font-semibold">{lesson.subject}</p>{(lesson.instructor || lesson.room) && <p className="mt-1 text-[11px] text-black/40">{[lesson.instructor, lesson.room].filter(Boolean).join(" · ")}</p>}</div>)}</div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
