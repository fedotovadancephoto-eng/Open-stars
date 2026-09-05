import AdminApp from "@/admin/AdminApp";
import { AdminCoinManager } from "@/admin/AdminCoinManager";
import { AdminDocumentsManager } from "@/admin/AdminDocumentsManager";
import { AdminExpenseManager } from "@/admin/AdminExpenseManager";
import { AdminFeedbackManager } from "@/admin/AdminFeedbackManager";
import { AdminNewsManager } from "@/admin/AdminNewsManager";
import { AdminParentActivationManager } from "@/admin/AdminParentActivationManager";
import { AdminParentPasswordResetManager } from "@/admin/AdminParentPasswordResetManager";
import { AdminPaymentManager } from "@/admin/AdminPaymentManager";
import { AdminPayrollManager } from "@/admin/AdminPayrollManager";
import { AdminPhotoSessionManager } from "@/admin/AdminPhotoSessionManager";
import { AdminReportExport } from "@/admin/AdminReportExport";
import { AdminScheduleManager } from "@/admin/AdminScheduleManager";
import { AdminStaffManager } from "@/admin/AdminStaffManager";
import { AdminStudentOperations } from "@/admin/AdminStudentOperations";
import { AdminStudyManager } from "@/admin/AdminStudyManager";
import { AdminTopMenu } from "@/admin/AdminTopMenu";
import { ChildPhotoUpload } from "@/admin/ChildPhotoUpload";
import { OwnerBusinessDashboard } from "@/admin/OwnerBusinessDashboard";
import { OwnerHomeLanding } from "@/admin/OwnerHomeLanding";
import { StaffModeSwitch } from "@/admin/StaffModeSwitch";

export default function AdminWorkspace() {
  return (
    <>
      <StaffModeSwitch />
      <AdminTopMenu />
      <AdminApp />
      <AdminStudentOperations />
      <AdminParentActivationManager />
      <AdminParentPasswordResetManager />
      <AdminFeedbackManager />
      <ChildPhotoUpload />
      <AdminScheduleManager />
      <AdminStudyManager />
      <AdminCoinManager />
      <AdminNewsManager />
      <AdminPaymentManager />
      <AdminPhotoSessionManager />
      <AdminStaffManager />
      <AdminReportExport />
      <AdminExpenseManager />
      <AdminPayrollManager />
      <AdminDocumentsManager />
      <OwnerBusinessDashboard />
      <OwnerHomeLanding />
    </>
  );
}
