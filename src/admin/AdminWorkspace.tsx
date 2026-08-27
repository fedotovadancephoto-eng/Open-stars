import AdminApp from "@/admin/AdminApp";
import { AdminCoinManager } from "@/admin/AdminCoinManager";
import { AdminNewsManager } from "@/admin/AdminNewsManager";
import { AdminPaymentManager } from "@/admin/AdminPaymentManager";
import { AdminPhotoSessionManager } from "@/admin/AdminPhotoSessionManager";
import { AdminScheduleManager } from "@/admin/AdminScheduleManager";
import { AdminStudentOperations } from "@/admin/AdminStudentOperations";
import { AdminStudyManager } from "@/admin/AdminStudyManager";
import { ChildPhotoUpload } from "@/admin/ChildPhotoUpload";

export default function AdminWorkspace() {
  return (
    <>
      <AdminApp />
      <AdminStudentOperations />
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
