import AdminApp from "@/admin/AdminApp";
import { AdminStudentOperations } from "@/admin/AdminStudentOperations";
import { ChildPhotoUpload } from "@/admin/ChildPhotoUpload";

export default function AdminWorkspace() {
  return (
    <>
      <AdminApp />
      <AdminStudentOperations />
      <ChildPhotoUpload />
    </>
  );
}
