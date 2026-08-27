import { useEffect, useMemo, useState } from "react";
import { GraduationCap, ShieldCheck } from "lucide-react";

import { fetchStaffIdentity, StaffRole } from "@/admin/adminApi";
import { fetchAcademicContext } from "@/admin/academicApi";

export const STAFF_VIEW_MODE_KEY = "openstars_staff_view_mode";
export const STAFF_VIEW_MODE_EVENT = "openstars:staff-view-mode";

type StaffViewMode = "primary" | "teacher";

const primaryRoleLabels: Partial<Record<StaffRole, string>> = {
  owner: "Директор",
  project_director: "Директор по проекту",
  manager: "Управляющий",
  admin: "Администратор",
};

const teacherHiddenLabels = new Set([
  "Добавить ученика",
  "Выбывшие",
  "Активация родителей",
  "Фото ребёнка",
  "Star Coin",
  "Новости",
  "Оплата",
  "Фотосессии",
  "Обратная связь",
  "Сотрудники",
]);

function normalize(value: string | null | undefined) {
  return (value || "").replace(/\s+/g, " ").trim();
}

function storedMode(): StaffViewMode {
  return localStorage.getItem(STAFF_VIEW_MODE_KEY) === "teacher" ? "teacher" : "primary";
}

export function StaffModeSwitch() {
  const [enabled, setEnabled] = useState(false);
  const [role, setRole] = useState<StaffRole | null>(null);
  const [mode, setMode] = useState<StaffViewMode>(storedMode);
  const [subjects, setSubjects] = useState<string[]>([]);

  useEffect(() => {
    let cancelled = false;
    let timer = 0;

    async function detect() {
      try {
        const identity = await fetchStaffIdentity();
        const academic = await fetchAcademicContext();
        if (cancelled) return;

        const uniqueSubjects = Array.from(
          new Set((academic.assignments || []).map((item) => item.subject).filter(Boolean)),
        );
        setRole(identity.role);
        setSubjects(uniqueSubjects);
        setEnabled(identity.role !== "teacher" && uniqueSubjects.length > 0);

        if (identity.role === "teacher" || uniqueSubjects.length === 0) {
          localStorage.setItem(STAFF_VIEW_MODE_KEY, "primary");
          setMode("primary");
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
    if (!enabled) return;

    let raf = 0;
    const sync = () => {
      window.cancelAnimationFrame(raf);
      raf = window.requestAnimationFrame(() => {
        document
          .querySelectorAll<HTMLElement>('[data-staff-mode-hidden="true"]')
          .forEach((element) => {
            element.style.removeProperty("display");
            delete element.dataset.staffModeHidden;
          });

        if (mode !== "teacher") return;

        document.querySelectorAll<HTMLElement>("button,a").forEach((element) => {
          if (element.dataset.staffModeSwitch === "true") return;
          if (element.dataset.adminTopMenu === "true") return;
          const text = normalize(element.textContent);
          if (!teacherHiddenLabels.has(text)) return;
          element.dataset.staffModeHidden = "true";
          element.style.setProperty("display", "none", "important");
        });
      });
    };

    sync();
    const observer = new MutationObserver(sync);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => {
      observer.disconnect();
      window.cancelAnimationFrame(raf);
      document
        .querySelectorAll<HTMLElement>('[data-staff-mode-hidden="true"]')
        .forEach((element) => {
          element.style.removeProperty("display");
          delete element.dataset.staffModeHidden;
        });
    };
  }, [enabled, mode]);

  const subjectLabel = useMemo(() => subjects.join(", "), [subjects]);

  if (!enabled || !role) return null;

  function toggleMode() {
    const next: StaffViewMode = mode === "teacher" ? "primary" : "teacher";
    localStorage.setItem(STAFF_VIEW_MODE_KEY, next);
    setMode(next);
    window.dispatchEvent(new CustomEvent(STAFF_VIEW_MODE_EVENT, { detail: { mode: next } }));
  }

  const primaryLabel = primaryRoleLabels[role] || "Основной режим";

  return (
    <div
      className="fixed left-4 z-[67] sm:left-6"
      style={{ top: "calc(env(safe-area-inset-top, 0px) + 5.6rem)" }}
    >
      <button
        type="button"
        data-staff-mode-switch="true"
        onClick={toggleMode}
        className={`flex min-h-12 items-center gap-2 rounded-full border px-4 text-sm font-semibold shadow-[0_10px_30px_rgba(0,0,0,0.15)] active:scale-[0.98] ${
          mode === "teacher"
            ? "border-[#D96A24]/20 bg-[#D96A24] text-white"
            : "border-black/[0.07] bg-white text-[#171717]"
        }`}
        title={mode === "teacher" ? `Педагог: ${subjectLabel}` : primaryLabel}
      >
        {mode === "teacher" ? <GraduationCap size={18} /> : <ShieldCheck size={18} />}
        <span className="hidden sm:inline">
          {mode === "teacher" ? "Режим педагога" : primaryLabel}
        </span>
        <span className="sm:hidden">{mode === "teacher" ? "Педагог" : "Роль"}</span>
      </button>
    </div>
  );
}
