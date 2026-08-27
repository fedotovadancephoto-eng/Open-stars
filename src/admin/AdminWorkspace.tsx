import AdminApp from "@/admin/AdminApp";
import { AdminCoinManager } from "@/admin/AdminCoinManager";
import { AdminNewsManager } from "@/admin/AdminNewsManager";
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
    </>
  );
}
