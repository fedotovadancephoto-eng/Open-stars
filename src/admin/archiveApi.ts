import { getValidStaffSession } from "@/admin/adminApi";

const SUPABASE_URL = "https://yiwiykbuaggyslfyhlfo.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_1MORh5rY7uMDVYLYVX5VAA_cyoph4-7";

export type ArchiveStudentRow = {
  id: string;
  firstName: string;
  lastName: string;
  fullName: string;
  branch: string;
  groupName: string;
  archivedAt: string;
  archiveReason: string;
  parentName: string;
  parentPhone: string;
};

export async function fetchStudentsForArchive(): Promise<ArchiveStudentRow[]> {
  const session = await getValidStaffSession();
  if (!session) throw new Error("Сессия сотрудника не найдена.");

  const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/staff_list_students_for_archive`, {
    method: "POST",
    headers: {
      apikey: SUPABASE_PUBLISHABLE_KEY,
      Authorization: `Bearer ${session.access_token}`,
      "Content-Type": "application/json",
    },
    body: "{}",
  });

  if (!response.ok) {
    throw new Error("Не удалось загрузить активных и выбывших учеников.");
  }

  const rows = await response.json();
  return rows.map((row: any) => ({
    id: row.child_id,
    firstName: row.first_name || "",
    lastName: row.last_name || "",
    fullName: [row.first_name, row.last_name].filter(Boolean).join(" "),
    branch: row.branch || "",
    groupName: row.group_name || "",
    archivedAt: row.archived_at || "",
    archiveReason: row.archive_reason || "",
    parentName: row.parent_name || "",
    parentPhone: row.parent_phone || "",
  }));
}
