import { getValidStaffSession } from "@/admin/adminApi";

export type AttendanceRow = {
  childId: string; name: string; branch: string; group: string; lessonDay: string;
  time: string; date: string; expected: boolean;
  status: "present" | "absent" | "unmarked"; markedSubjects: number; scheduledSubjects: number;
};
export type AttendanceOverview = {
  branches: string[];
  rows: AttendanceRow[];
  unassigned: { childId: string; name: string; branch: string }[];
};
export async function fetchAttendanceOverview(from: string, to: string): Promise<AttendanceOverview> {
  const session = await getValidStaffSession();
  if (!session) throw new Error("Войдите в кабинет сотрудника заново.");
  const response = await fetch("https://yiwiykbuaggyslfyhlfo.supabase.co/rest/v1/rpc/staff_attendance_overview", {
    method: "POST",
    headers: { apikey: "sb_publishable_1MORh5rY7uMDVYLYVX5VAA_cyoph4-7", Authorization: `Bearer ${session.access_token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ p_from: from, p_to: to }),
  });
  if (!response.ok) throw new Error(response.status === 401 || response.status === 403
    ? "Нет доступа к своду посещаемости. Войдите заново."
    : "Не удалось загрузить посещаемость. Проверьте период (не более 93 дней) и повторите.");
  return response.json();
}
