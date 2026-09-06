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
  refundableAmount: number;
  latestPaymentMonth: string;
};

type ArchiveStudentResponseRow = {
  child_id: string;
  first_name?: string | null;
  last_name?: string | null;
  branch?: string | null;
  group_name?: string | null;
  archived_at?: string | null;
  archive_reason?: string | null;
  parent_name?: string | null;
  parent_phone?: string | null;
  refundable_amount?: number | string | null;
  latest_payment_month?: string | null;
};

export async function fetchStudentsForArchive(): Promise<ArchiveStudentRow[]> {
  const session = await getValidStaffSession();
  if (!session) throw new Error("Сессия сотрудника не найдена.");

  const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/staff_list_students_for_archive_v2`, {
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

  const rows = (await response.json()) as ArchiveStudentResponseRow[];
  return rows.map((row) => ({
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
    refundableAmount: Number(row.refundable_amount || 0),
    latestPaymentMonth: row.latest_payment_month || "",
  }));
}
