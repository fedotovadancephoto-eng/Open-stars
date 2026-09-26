import AdminApp from "@/admin/AdminApp";
import { TeamWorkBoard } from "@/admin/TeamWorkBoard";
import { AdminCoinManager } from "@/admin/AdminCoinManager";
import { AdminCrmManager } from "@/admin/AdminCrmManager";
import { AdminDocumentsManager } from "@/admin/AdminDocumentsManager";
import { AdminEventsManager } from "@/admin/AdminEventsManager";
import { AdminExpenseManager } from "@/admin/AdminExpenseManager";
import { AdminFeedbackManager } from "@/admin/AdminFeedbackManager";
import { AdminNewsManager } from "@/admin/AdminNewsManager";
import { AdminParentActivationManager } from "@/admin/AdminParentActivationManager";
import { AdminParentPasswordResetManager } from "@/admin/AdminParentPasswordResetManager";
import { AdminPaymentManager } from "@/admin/AdminPaymentManager";
import { AdminPayrollManager } from "@/admin/AdminPayrollManager";
import { AdminPhotoSessionManager } from "@/admin/AdminPhotoSessionManager";
import { AdminReportExport } from "@/admin/AdminReportExport";
import { AttendanceOverviewModal } from "@/admin/AttendanceOverview";
import { AdminScheduleManager } from "@/admin/AdminScheduleManager";
import { AdminStaffManager } from "@/admin/AdminStaffManager";
import { AdminStudentOperations } from "@/admin/AdminStudentOperations";
import { AdminStudyManager } from "@/admin/AdminStudyManager";
import { AdminTopMenu } from "@/admin/AdminTopMenu";
import { ChildPhotoUpload } from "@/admin/ChildPhotoUpload";
import { CrmAccessManager } from "@/admin/CrmAccessManager";
import { OwnerBusinessDashboard } from "@/admin/OwnerBusinessDashboard";
import { OwnerHomeLanding } from "@/admin/OwnerHomeLanding";
import { OwnerTuitionRefundManager } from "@/admin/OwnerTuitionRefundManager";
import { StaffModeSwitch } from "@/admin/StaffModeSwitch";
import { StaffAccessProvider, useStaffAccess } from "@/admin/StaffAccessContext";
import { canAccessAdminSection } from "@/admin/staffPermissions";
import { ADMIN_SECTION_EVENT, AdminSection, openAdminSection } from "@/admin/adminNavigation";

function DeferredManager({ sections, children }: { sections: readonly AdminSection[]; children: ReactNode }) {
  const [mounted, setMounted] = useState(false);
  const pending = useRef<{ section: AdminSection; detail: Record<string, unknown> } | null>(null);
  const sectionKey = sections.join("|");

  useEffect(() => {
    if (mounted) return;
    const allowedSections = new Set(sectionKey.split("|") as AdminSection[]);
    const listener = (event: Event) => {
      const detail = (event as CustomEvent<Record<string, unknown> & { section?: AdminSection }>).detail || {};
      if (!detail.section || !allowedSections.has(detail.section)) return;
      pending.current = { section: detail.section, detail };
      setMounted(true);
    };
    window.addEventListener(ADMIN_SECTION_EVENT, listener);
    return () => window.removeEventListener(ADMIN_SECTION_EVENT, listener);
  }, [mounted, sectionKey]);

  useEffect(() => {
    if (!mounted || !pending.current) return;
    const request = pending.current;
    pending.current = null;
    const timer = window.setTimeout(() => openAdminSection(request.section, request.detail), 0);
    return () => window.clearTimeout(timer);
  }, [mounted]);

  return mounted ? children : null;
}

function RoleAwareWorkspace() {
  const { role } = useStaffAccess();
  const allowed = (section: Parameters<typeof canAccessAdminSection>[1]) => canAccessAdminSection(role, section);

  return (
    <>
      {role && <AdminTopMenu />}
      {role && role !== "teacher" && <StaffModeSwitch />}
      <AdminApp />
      {allowed("add-student") && <DeferredManager sections={["add-student", "archive"]}><AdminStudentOperations /></DeferredManager>}
      {allowed("parent-activation") && <DeferredManager sections={["parent-activation"]}><AdminParentActivationManager /></DeferredManager>}
      {allowed("parent-password-reset") && <DeferredManager sections={["parent-password-reset"]}><AdminParentPasswordResetManager /></DeferredManager>}
      {allowed("feedback") && <DeferredManager sections={["feedback"]}><AdminFeedbackManager /></DeferredManager>}
      {allowed("child-photo") && <ChildPhotoUpload />}
      {allowed("schedule") && <DeferredManager sections={["schedule"]}><AdminScheduleManager /></DeferredManager>}
      {allowed("study") && <DeferredManager sections={["study"]}><AdminStudyManager /></DeferredManager>}
      {allowed("coins") && <DeferredManager sections={["coins"]}><AdminCoinManager /></DeferredManager>}
      {allowed("news") && <DeferredManager sections={["news"]}><AdminNewsManager /></DeferredManager>}
      {allowed("payments") && <DeferredManager sections={["payments"]}><AdminPaymentManager /></DeferredManager>}
      {allowed("tuition-refund") && <DeferredManager sections={["tuition-refund"]}><OwnerTuitionRefundManager /></DeferredManager>}
      {allowed("events") && <DeferredManager sections={["events"]}><AdminEventsManager /></DeferredManager>}
      {allowed("photos") && <DeferredManager sections={["photos"]}><AdminPhotoSessionManager /></DeferredManager>}
      {allowed("team") && <DeferredManager sections={["team"]}><AdminStaffManager /></DeferredManager>}
      {allowed("reports") && <DeferredManager sections={["reports"]}><AdminReportExport /></DeferredManager>}
      {allowed("attendance-overview") && <DeferredManager sections={["attendance-overview"]}><AttendanceOverviewModal /></DeferredManager>}
      {allowed("team-work") && <DeferredManager sections={["team-work"]}><TeamWorkBoard /></DeferredManager>}
      {allowed("expenses") && <DeferredManager sections={["expenses"]}><AdminExpenseManager /></DeferredManager>}
      {allowed("payroll") && <DeferredManager sections={["payroll"]}><AdminPayrollManager /></DeferredManager>}
      {allowed("documents") && <DeferredManager sections={["documents"]}><AdminDocumentsManager /></DeferredManager>}
      {allowed("crm") && <DeferredManager sections={["crm"]}><AdminCrmManager /></DeferredManager>}
      {allowed("crm-access") && <DeferredManager sections={["crm-access"]}><CrmAccessManager /></DeferredManager>}
      {allowed("business") && <DeferredManager sections={["business"]}><OwnerBusinessDashboard /></DeferredManager>}
      {allowed("business") && <OwnerHomeLanding />}
    </>
  );
}

export default function AdminWorkspace() {
  return <StaffAccessProvider><RoleAwareWorkspace /></StaffAccessProvider>;
}
import { ReactNode, useEffect, useRef, useState } from "react";
