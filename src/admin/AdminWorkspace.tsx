import AdminApp from "@/admin/AdminApp";
import { AdminStudentOperations } from "@/admin/AdminStudentOperations";

export default function AdminWorkspace() {
  return (
    <>
      <AdminApp />
      <AdminStudentOperations />
    </>
  );
}
