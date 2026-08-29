import { useEffect, useMemo, useState } from "react";
import { Award, BookOpenCheck, CheckCircle2, ClipboardCheck, LoaderCircle, MessageCircle, Save, UsersRound, X } from "lucide-react";

import {
  AcademicBranch,
  AcademicGroup,
  AcademicRosterRow,
  AcademicStream,
  addAchievement,
  addTeacherComment,
  fetchAcademicContext,
  fetchAcademicRoster,
  publishGroupHomework,
  saveAcademicGroup,
} from "@/admin/academicApi";
import { AcademicHistoryManager } from "@/admin/AcademicHistoryManager";
import { publishGroupComment } from "@/admin/groupCommentApi";

const branches: AcademicBranch[] = ["Свердловский", "НЛО", "Октябрьский"];
const groups: AcademicGroup[] = ["Базовый", "Продвинутый", "PRO"];
const streams: AcademicStream[] = ["11:00", "13:00", "16:00"];
const commonSubjects = ["Дефиле", "Дефиле и подиумный шаг", "Хореография", "Актёрское мастерство", "Фотопозирование"];
const CUSTOM_SUBJECT = "__custom__";
const inputClass = "mt-1.5 w-full rounded-[13px] border border-black/[0.08] bg-white px-3.5 py-3 text-sm text-[#171717] outline-none focus:border-[#D96A24]/45 focus:ring-4 focus:ring-[#D96A24]/[0.06]";

type CommentAudience = "individual" | "group";

function localDate() {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

export function AdminStudyManager() {
  const [enabled, setEnabled] = useState(false);
  const [open, setOpen] = useState(false);
  const [role, setRole] = useState("");
  const [staffBranch, setStaffBranch] = useState("");
  const [teacherName, setTeacherName] = useState("");
  const [assignedSubjects, setAssignedSubjects] = useState<string[]>([]);
  const [branch, setBranch] = useState<AcademicBranch>("Октябрьский");
  const [groupName, setGroupName] = useState<AcademicGroup>("PRO");
  const [stream, setStream] = useState<AcademicStream>("16:00");
  const [lessonDate, setLessonDate] = useState(localDate());
  const [subjectChoice, setSubjectChoice] = useState("Дефиле");
  const [subject, setSubject] = useState("Дефиле");
  const [roster, setRoster] = useState<AcademicRosterRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [historyVersion, setHistoryVersion] = useState(0);

  const [homeworkTitle, setHomeworkTitle] = useState("");
  const [homeworkDescription, setHomeworkDescription] = useState("");
  const [homeworkDue, setHomeworkDue] = useState("");
  const [personalChild, setPersonalChild] = useState("");
  const [commentAudience, setCommentAudience] = useState<CommentAudience>("individual");
  const [commentTitle, setCommentTitle] = useState("");
  const [commentText, setCommentText] = useState("");
  const [achievementTitle, setAchievementTitle] = useState("");
  const [achievementDescription, setAchievementDescription] = useState("");

  useEffect(() => {
    let cancelled = false;
    let timer = 0;
    async function detect() {
      try {
        const context = await fetchAcademicContext();
        if (cancelled) return;
        setEnabled(true);
        setRole(context.role);
        setStaffBranch(context.staffBranch);
        setTeacherName(context.staffName);
        const uniqueSubjects = Array.from(new Set((context.assignments || []).map((item) => item.subject).filter(Boolean)));
        setAssignedSubjects(uniqueSubjects);
        if (context.role === "admin" && branches.includes(context.staffBranch as AcademicBranch)) {
          setBranch(context.staffBranch as AcademicBranch);
        }
        if (context.role === "teacher" && context.assignments[0]) {
          const first = context.assignments[0];
          if (first.branch && branches.includes(first.branch as AcademicBranch)) setBranch(first.branch as AcademicBranch);
          if (groups.includes(first.groupName as AcademicGroup)) setGroupName(first.groupName as AcademicGroup);
          if (first.subject) {
            setSubjectChoice(first.subject);
            setSubject(first.subject);
          }
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

  useEffect(() => {
    const handler = () => setOpen(true);
    window.addEventListener("openstars:open-study", handler);
    return () => window.removeEventListener("openstars:open-study", handler);
  }, []);

  const branchLocked = role === "admin" || role === "teacher";
  const subjectOptions = role === "teacher" ? assignedSubjects : commonSubjects;
  const selectedStudent = useMemo(() => roster.find((row) => row.childId === personalChild) || null, [roster, personalChild]);

  function clearLoadedRoster() {
    setRoster([]);
    setPersonalChild("");
    setSuccess("");
  }

  function changeSubjectChoice(value: string) {
    setSubjectChoice(value);
    setSubject(value === CUSTOM_SUBJECT ? "" : value);
    clearLoadedRoster();
  }

  async function loadRoster() {
    if (!subject.trim()) return setError("Укажите предмет.");
    setLoading(true);
    setError("");
    setSuccess("");
    try {
      const rows = await fetchAcademicRoster({ branch, groupName, stream, lessonDate, subject });
      setRoster(rows);
      setPersonalChild(rows[0]?.childId || "");
      if (!rows.length) setSuccess("В выбранной группе пока нет учеников.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось загрузить группу.");
    } finally {
      setLoading(false);
    }
  }

  function patchStudent(childId: string, patch: Partial<AcademicRosterRow>) {
    setRoster((current) => current.map((row) => row.childId === childId ? { ...row, ...patch } : row));
  }

  function markAll(present: boolean) {
    setRoster((current) => current.map((row) => ({ ...row, present })));
  }

  async function saveMarks() {
    if (!roster.length) return setError("Сначала загрузите группу.");
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      const count = await saveAcademicGroup({
        lessonDate,
        subject,
        teacherName,
        entries: roster.map((row) => ({ childId: row.childId, present: row.present, grade: row.grade })),
      });
      setSuccess(`Сохранено: ${count} ученик(ов). Родители увидят данные после обновления кабинета.`);
      setHistoryVersion((value) => value + 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось сохранить оценки и посещаемость.");
    } finally {
      setSaving(false);
    }
  }

  async function publishHomework() {
    if (!homeworkTitle.trim()) return setError("Введите название домашнего задания.");
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      const count = await publishGroupHomework({ branch, groupName, stream, subject, title: homeworkTitle, description: homeworkDescription, dueDate: homeworkDue, lessonDate, teacherName });
      setSuccess(`Домашнее задание опубликовано для ${count} ученик(ов).`);
      setHomeworkTitle("");
      setHomeworkDescription("");
      setHomeworkDue("");
      setHistoryVersion((value) => value + 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось опубликовать домашнее задание.");
    } finally {
      setSaving(false);
    }
  }

  async function saveComment() {
    if (!commentText.trim()) return setError("Введите комментарий.");
    if (commentAudience === "individual" && !personalChild) return setError("Выберите ребёнка.");
    if (commentAudience === "group" && !roster.length) return setError("Сначала загрузите группу.");

    setSaving(true);
    setError("");
    setSuccess("");
    try {
      if (commentAudience === "group") {
        const result = await publishGroupComment({
          branch,
          groupName,
          stream,
          subject,
          title: commentTitle,
          text: commentText,
          date: lessonDate,
          teacherName,
        });
        setSuccess(`Комментарий опубликован для всей группы: ${result.count} ученик(ов).`);
      } else {
        await addTeacherComment({ childId: personalChild, subject, title: commentTitle, text: commentText, date: lessonDate, teacherName });
        setSuccess(`Личный комментарий для ${selectedStudent?.childName || "ученика"} опубликован.`);
      }
      setCommentTitle("");
      setCommentText("");
      setHistoryVersion((value) => value + 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось добавить комментарий.");
    } finally {
      setSaving(false);
    }
  }

  async function saveAchievement() {
    if (!personalChild) return setError("Выберите ребёнка.");
    if (!achievementTitle.trim()) return setError("Введите название достижения.");
    setSaving(true); setError(""); setSuccess("");
    try {
      await addAchievement({ childId: personalChild, title: achievementTitle, description: achievementDescription, date: lessonDate });
      setSuccess(`Достижение для ${selectedStudent?.childName || "ученика"} добавлено.`);
      setAchievementTitle(""); setAchievementDescription("");
      setHistoryVersion((value) => value + 1);
    } catch (err) { setError(err instanceof Error ? err.message : "Не удалось добавить достижение."); }
    finally { setSaving(false); }
  }

  if (!enabled) return null;

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="fixed bottom-[16.7rem] right-4 z-40 flex items-center gap-2 rounded-full bg-[#D96A24] px-4 py-3 text-sm font-semibold text-white shadow-[0_10px_30px_rgba(0,0,0,0.18)] sm:right-6">
        <BookOpenCheck size={17} /> Учебная часть
      </button>

      {open && (
        <div className="fixed inset-0 z-[78] flex items-end justify-center bg-black/30 p-0 backdrop-blur-[2px] sm:items-center sm:p-5" onClick={() => !saving && setOpen(false)}>
          <div className="max-h-[96vh] w-full max-w-6xl overflow-y-auto rounded-t-[28px] bg-[#FAF9F5] p-5 shadow-2xl sm:rounded-[28px] sm:p-7" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-start justify-between gap-4">
              <div><p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#D96A24]">OPEN STARS ADMIN</p><h2 className="mt-1 text-2xl font-semibold tracking-[-0.03em]">Учебная часть</h2><p className="mt-2 text-sm leading-6 text-black/45">Посещаемость, оценки, домашние задания, личная и групповая обратная связь.</p></div>
              <button type="button" onClick={() => setOpen(false)} disabled={saving} className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-white text-black/55 shadow-sm"><X size={20} /></button>
            </div>

            <div className="mt-6 rounded-[24px] border border-black/[0.06] bg-white p-5 sm:p-6">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                <label className="text-xs font-semibold text-black/55">Филиал<select className={inputClass} value={branch} disabled={branchLocked && Boolean(staffBranch)} onChange={(e) => { setBranch(e.target.value as AcademicBranch); clearLoadedRoster(); }}>{branches.map((v) => <option key={v}>{v}</option>)}</select></label>
                <label className="text-xs font-semibold text-black/55">Группа<select className={inputClass} value={groupName} onChange={(e) => { setGroupName(e.target.value as AcademicGroup); clearLoadedRoster(); }}>{groups.map((v) => <option key={v}>{v}</option>)}</select></label>
                <label className="text-xs font-semibold text-black/55">Поток<select className={inputClass} value={stream} onChange={(e) => { setStream(e.target.value as AcademicStream); clearLoadedRoster(); }}>{streams.map((v) => <option key={v}>{v}</option>)}</select></label>
                <label className="text-xs font-semibold text-black/55">Дата<input type="date" className={inputClass} value={lessonDate} onChange={(e) => { setLessonDate(e.target.value); clearLoadedRoster(); }} /></label>
                <div>
                  <label className="text-xs font-semibold text-black/55">Предмет<select className={inputClass} value={subjectChoice} onChange={(e) => changeSubjectChoice(e.target.value)}>{subjectOptions.length === 0 && <option value="">Нет назначенных предметов</option>}{subjectOptions.map((v) => <option key={v} value={v}>{v}</option>)}{role !== "teacher" && <option value={CUSTOM_SUBJECT}>Мастер-класс / другой предмет…</option>}</select></label>
                  {role !== "teacher" && subjectChoice === CUSTOM_SUBJECT && <input autoFocus className={inputClass} value={subject} onChange={(e) => { setSubject(e.target.value); clearLoadedRoster(); }} placeholder="Например: Мастер-класс по визажу" />}
                </div>
              </div>
              {role === "teacher" && assignedSubjects.length > 0 && <p className="mt-3 text-xs leading-5 text-black/40">Показаны только предметы, назначенные этому педагогу. Разовый мастер-класс появится здесь после добавления его точного названия в карточке сотрудника.</p>}
              <button type="button" onClick={loadRoster} disabled={loading || !subject.trim()} className="mt-4 flex items-center gap-2 rounded-[14px] bg-[#171717] px-4 py-3 text-sm font-semibold text-white disabled:opacity-50">{loading ? <LoaderCircle className="animate-spin" size={17} /> : <UsersRound size={17} />} Загрузить группу</button>
            </div>

            {error && <div className="mt-4 rounded-[15px] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
            {success && <div className="mt-4 flex items-start gap-2 rounded-[15px] border border-[#5F6338]/15 bg-[#5F6338]/[0.07] px-4 py-3 text-sm font-medium text-[#4D512E]"><CheckCircle2 size={17} className="mt-0.5 shrink-0" />{success}</div>}

            <div className="mt-6 grid gap-5 xl:grid-cols-[1.35fr_0.85fr]">
              <section className="rounded-[24px] border border-black/[0.06] bg-white p-5 sm:p-6">
                <div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-[11px] font-bold uppercase tracking-[0.18em] text-black/35">Журнал занятия</p><h3 className="mt-1 text-xl font-semibold">Посещаемость и оценки</h3></div>{roster.length > 0 && <div className="flex gap-2"><button type="button" onClick={() => markAll(true)} className="rounded-[11px] bg-[#5F6338]/10 px-3 py-2 text-xs font-semibold text-[#4D512E]">Все были</button><button type="button" onClick={() => markAll(false)} className="rounded-[11px] bg-red-50 px-3 py-2 text-xs font-semibold text-red-600">Все отсутствовали</button></div>}</div>
                {roster.length === 0 ? <div className="mt-5 rounded-[18px] bg-[#FAF9F5] px-5 py-9 text-center text-sm text-black/40">Выберите параметры занятия и загрузите группу.</div> : <div className="mt-4 space-y-2">{roster.map((row) => <div key={row.childId} className="grid gap-3 rounded-[16px] border border-black/[0.055] p-3 sm:grid-cols-[1fr_auto_auto] sm:items-center"><p className="font-semibold text-[#171717]">{row.childName}</p><div className="flex gap-1 rounded-[11px] bg-[#FAF9F5] p-1"><button type="button" onClick={() => patchStudent(row.childId,{present:true})} className={`rounded-[9px] px-3 py-2 text-xs font-semibold ${row.present===true?"bg-[#5F6338] text-white":"text-black/40"}`}>Был</button><button type="button" onClick={() => patchStudent(row.childId,{present:false})} className={`rounded-[9px] px-3 py-2 text-xs font-semibold ${row.present===false?"bg-red-500 text-white":"text-black/40"}`}>Нет</button></div><select value={row.grade ?? ""} onChange={(e) => patchStudent(row.childId,{grade:e.target.value?Number(e.target.value):null})} className="rounded-[11px] border border-black/[0.08] bg-white px-3 py-2 text-sm"><option value="">Оценка —</option>{[5,4,3,2,1].map((v)=><option key={v} value={v}>{v}</option>)}</select></div>)}</div>}
                {roster.length > 0 && <button type="button" onClick={saveMarks} disabled={saving} className="mt-5 flex w-full items-center justify-center gap-2 rounded-[14px] bg-[#D96A24] px-5 py-3.5 text-sm font-semibold text-white disabled:opacity-50 sm:w-auto">{saving?<LoaderCircle className="animate-spin" size={17}/>:<Save size={17}/>} Сохранить журнал</button>}
              </section>

              <div className="space-y-5">
                <section className="rounded-[24px] border border-black/[0.06] bg-white p-5">
                  <div className="flex items-center gap-2"><ClipboardCheck className="text-[#D96A24]" size={19}/><h3 className="font-semibold">Домашнее задание группе</h3></div>
                  <label className="mt-4 block text-xs font-semibold text-black/55">Название<input className={inputClass} value={homeworkTitle} onChange={(e)=>setHomeworkTitle(e.target.value)} placeholder="Например: Отработать проходку" /></label>
                  <label className="mt-3 block text-xs font-semibold text-black/55">Описание<textarea className={`${inputClass} min-h-[90px] resize-y`} value={homeworkDescription} onChange={(e)=>setHomeworkDescription(e.target.value)} /></label>
                  <label className="mt-3 block text-xs font-semibold text-black/55">Выполнить до<input type="date" className={inputClass} value={homeworkDue} onChange={(e)=>setHomeworkDue(e.target.value)} /></label>
                  <button type="button" onClick={publishHomework} disabled={saving || !roster.length} className="mt-4 w-full rounded-[13px] bg-[#171717] px-4 py-3 text-sm font-semibold text-white disabled:opacity-40">Опубликовать группе</button>
                </section>

                <section className="rounded-[24px] border border-black/[0.06] bg-white p-5">
                  <div className="flex items-center gap-2"><MessageCircle size={18} className="text-[#5F6338]"/><h3 className="font-semibold">Комментарий педагога</h3></div>
                  <div className="mt-4 grid grid-cols-2 gap-2 rounded-[14px] bg-[#F2F0E8] p-1.5">
                    <button type="button" onClick={() => setCommentAudience("individual")} className={`rounded-[11px] px-3 py-2.5 text-xs font-semibold ${commentAudience === "individual" ? "bg-white text-[#171717] shadow-sm" : "text-black/45"}`}>Лично ребёнку</button>
                    <button type="button" onClick={() => setCommentAudience("group")} className={`rounded-[11px] px-3 py-2.5 text-xs font-semibold ${commentAudience === "group" ? "bg-[#5F6338] text-white shadow-sm" : "text-black/45"}`}>Всей группе</button>
                  </div>
                  {commentAudience === "individual" ? (
                    <label className="mt-3 block text-xs font-semibold text-black/55">Ребёнок<select className={inputClass} value={personalChild} onChange={(e)=>setPersonalChild(e.target.value)}><option value="">Выберите ребёнка</option>{roster.map((r)=><option key={r.childId} value={r.childId}>{r.childName}</option>)}</select></label>
                  ) : (
                    <div className="mt-3 rounded-[13px] bg-[#5F6338]/[0.07] px-3.5 py-3 text-xs leading-5 text-[#4D512E]">Получатели: <strong>{branch} · {groupName} · {stream}</strong>. После загрузки группы комментарий получат все {roster.length || 0} ученик(ов) этого потока.</div>
                  )}
                  <input className={inputClass} value={commentTitle} onChange={(e)=>setCommentTitle(e.target.value)} placeholder="Заголовок — необязательно"/>
                  <textarea className={`${inputClass} min-h-[95px] resize-y`} value={commentText} onChange={(e)=>setCommentText(e.target.value)} placeholder={commentAudience === "group" ? "Например: Сегодня отлично отработали проходку и повороты..." : "Что получилось, над чем поработать..."}/>
                  <button type="button" onClick={saveComment} disabled={saving || (commentAudience === "individual" ? !personalChild : !roster.length)} className="mt-3 w-full rounded-[12px] bg-[#5F6338] px-4 py-3 text-sm font-semibold text-white disabled:opacity-40">{commentAudience === "group" ? "Опубликовать всей группе" : "Добавить личный комментарий"}</button>
                  <p className="mt-2 text-[11px] leading-5 text-black/35">Групповая публикация сохраняется как единое сообщение: её можно будет исправить или удалить сразу у всех родителей.</p>

                  <div className="mt-5 border-t border-black/[0.06] pt-4"><div className="flex items-center gap-2"><Award size={18} className="text-[#D96A24]"/><h4 className="text-sm font-semibold">Личное достижение</h4></div><label className="mt-3 block text-xs font-semibold text-black/55">Ребёнок<select className={inputClass} value={personalChild} onChange={(e)=>setPersonalChild(e.target.value)}><option value="">Выберите ребёнка</option>{roster.map((r)=><option key={r.childId} value={r.childId}>{r.childName}</option>)}</select></label><input className={inputClass} value={achievementTitle} onChange={(e)=>setAchievementTitle(e.target.value)} placeholder="Например: Лучший результат месяца"/><textarea className={`${inputClass} min-h-[70px] resize-y`} value={achievementDescription} onChange={(e)=>setAchievementDescription(e.target.value)} placeholder="Описание — необязательно"/><button type="button" onClick={saveAchievement} disabled={saving || !personalChild} className="mt-3 w-full rounded-[12px] bg-[#D96A24] px-4 py-3 text-sm font-semibold text-white disabled:opacity-40">Добавить достижение</button></div>
                </section>

                <AcademicHistoryManager
                  childId={personalChild}
                  childName={selectedStudent?.childName || ""}
                  subject={subject}
                  refreshKey={historyVersion}
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
