import { useEffect, useRef, useState } from "react";
import { Home, LayoutDashboard } from "lucide-react";

import { AdminChild, fetchAdminChildren, fetchStaffIdentity, getValidStaffSession } from "@/admin/adminApi";
import { ADMIN_DATA_UPDATED_EVENT, openAdminSection } from "@/admin/adminNavigation";
import { OwnerHomeDashboard } from "@/admin/OwnerHomeDashboard";
import { STAFF_VIEW_MODE_EVENT, STAFF_VIEW_MODE_KEY } from "@/admin/StaffModeSwitch";
import { Logo } from "@/components/Logo";

export function OwnerHomeLanding() {
  const [isOwner, setIsOwner] = useState(false);
  const [open, setOpen] = useState(false);
  const [children, setChildren] = useState<AdminChild[]>([]);
  const [teacherMode, setTeacherMode] = useState(localStorage.getItem(STAFF_VIEW_MODE_KEY) === "teacher");
  const openedOnce = useRef(false);

  async function detectOwner() {
    const session = await getValidStaffSession();
    if (!session) return false;
    try {
      const identity = await fetchStaffIdentity();
      if (identity.role !== "owner") {
        setIsOwner(false);
        return true;
      }
      setIsOwner(true);
      const rows = await fetchAdminChildren("owner");
      setChildren(rows);
      if (!teacherMode && !openedOnce.current) {
        openedOnce.current = true;
        setOpen(true);
      }
      return true;
    } catch {
      return false;
    }
  }

  useEffect(() => {
    let cancelled = false;
    let attempts = 0;
    const tryLoad = async () => {
      if (cancelled) return;
      const resolved = await detectOwner();
      attempts += 1;
      if (!resolved && attempts < 30 && !cancelled) window.setTimeout(() => void tryLoad(), 1000);
    };
    void tryLoad();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    const modeHandler = (event: Event) => {
      const detail = (event as CustomEvent<{ mode?: "primary" | "teacher" }>).detail;
      const nextTeacher = detail?.mode === "teacher";
      setTeacherMode(nextTeacher);
      if (nextTeacher) setOpen(false);
    };
    const dataHandler = () => { if (isOwner) void detectOwner(); };
    window.addEventListener(STAFF_VIEW_MODE_EVENT, modeHandler);
    window.addEventListener(ADMIN_DATA_UPDATED_EVENT, dataHandler);
    return () => {
      window.removeEventListener(STAFF_VIEW_MODE_EVENT, modeHandler);
      window.removeEventListener(ADMIN_DATA_UPDATED_EVENT, dataHandler);
    };
  }, [isOwner, teacherMode]);

  if (!isOwner || teacherMode) return null;

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="fixed bottom-5 right-5 z-[48] flex items-center gap-2 rounded-full bg-[#171717] px-4 py-3 text-sm font-semibold text-white shadow-[0_16px_45px_rgba(0,0,0,0.22)]">
        <Home size={17} /> Главная
      </button>
    );
  }

  return (
    <div className="fixed inset-0 z-[70] overflow-y-auto bg-[#F6F5F1] text-[#171717]">
      <header className="sticky top-0 z-20 border-b border-black/[0.06] bg-[#F6F5F1]/92 px-5 py-4 backdrop-blur-xl sm:px-7 lg:px-9">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4">
          <div className="flex min-w-0 items-center gap-4">
            <div className="hidden rounded-[14px] bg-white px-3 py-2 shadow-sm sm:block"><Logo /></div>
            <div className="min-w-0"><p className="text-[10px] font-bold uppercase tracking-[0.2em] text-black/30">Центр управления</p><p className="mt-1 truncate text-sm font-semibold">OPEN STARS BUSINESS</p></div>
          </div>
          <button type="button" onClick={() => setOpen(false)} className="flex shrink-0 items-center gap-2 rounded-full border border-black/[0.06] bg-white px-4 py-2.5 text-xs font-semibold text-black/55 shadow-sm">
            <LayoutDashboard size={16} /> Рабочий кабинет
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-5 py-6 sm:px-7 lg:px-9 lg:py-8">
        <OwnerHomeDashboard
          children={children}
          onOpenStudents={() => {
            setOpen(false);
            window.scrollTo({ top: 0, behavior: "smooth" });
          }}
          onOpenPayments={() => {
            setOpen(false);
            window.setTimeout(() => openAdminSection("payments"), 0);
          }}
          onOpenBusiness={() => {
            setOpen(false);
            window.setTimeout(() => openAdminSection("business"), 0);
          }}
        />
      </main>
    </div>
  );
}
