import AdminApp from "@/admin/AdminApp";
import { AdminCoinManager } from "@/admin/AdminCoinManager";
import { AdminFeedbackManager } from "@/admin/AdminFeedbackManager";
import { AdminNewsManager } from "@/admin/AdminNewsManager";
import { AdminParentActivationManager } from "@/admin/AdminParentActivationManager";
import { AdminPaymentManager } from "@/admin/AdminPaymentManager";
import { AdminPhotoSessionManager } from "@/admin/AdminPhotoSessionManager";
import { AdminScheduleManager } from "@/admin/AdminScheduleManager";
import { AdminStudentOperations } from "@/admin/AdminStudentOperations";
import { AdminStudyManager } from "@/admin/AdminStudyManager";
import { AdminTopMenu } from "@/admin/AdminTopMenu";
import { ChildPhotoUpload } from "@/admin/ChildPhotoUpload";

export default function AdminWorkspace() {
  return (
    <>
      <AdminTopMenu />
      <AdminApp />
      <AdminStudentOperations />
      <AdminParentActivationManager />
      <AdminFeedbackManager />
      <ChildPhotoUpload />
      <AdminScheduleManager />
      <AdminStudyManager />
      <AdminCoinManager />
      <AdminNewsManager />
      <AdminPaymentManager />
      <AdminPhotoSessionManager />
    </>
  );
}
