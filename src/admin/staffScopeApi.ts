import { BranchName, StaffRole, getValidStaffSession } from "@/admin/adminApi";

const SUPABASE_URL = "https://yiwiykbuaggyslfyhlfo.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_1MORh5rY7uMDVYLYVX5VAA_cyoph4-7";

type Scope = { role: StaffRole | null; branch: BranchName | "" };

export async function getCurrentStaffScope(): Promise<Scope> {
  const session = await getValidStaffSession();
  if (!session) return { role: null, branch: "" };

  const userResponse = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: {
      apikey: SUPABASE_PUBLISHABLE_KEY,
      Authorization: `Bearer ${session.access_token}`,
    },
  });
  if (!userResponse.ok) return { role: null, branch: "" };

  const user = await userResponse.json();
  if (!user?.id) return { role: null, branch: "" };

  const profileResponse = await fetch(
    `${SUPABASE_URL}/rest/v1/users_profile?select=staff_branch,roles(name)&auth_user_id=eq.${encodeURIComponent(user.id)}&limit=1`,
    {
      headers: {
        apikey: SUPABASE_PUBLISHABLE_KEY,
        Authorization: `Bearer ${session.access_token}`,
      },
    }
  );
  if (!profileResponse.ok) return { role: null, branch: "" };

  const rows = await profileResponse.json();
  const row = rows?.[0];
  const rawRole = Array.isArray(row?.roles) ? row.roles[0]?.name : row?.roles?.name;
  const role = ["owner", "admin", "manager", "teacher"].includes(rawRole) ? (rawRole as StaffRole) : null;
  const branch = ["Свердловский", "НЛО", "Октябрьский"].includes(row?.staff_branch)
    ? (row.staff_branch as BranchName)
    : "";

  return { role, branch };
}
