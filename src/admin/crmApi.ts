import { fetchStaffIdentity, getValidStaffSession, StaffRole } from "@/admin/adminApi";

const SUPABASE_URL = "https://yiwiykbuaggyslfyhlfo.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_1MORh5rY7uMDVYLYVX5VAA_cyoph4-7";

export type CrmRole = StaffRole | "sales" | "marketer";
export type CrmStage = "new" | "contacted" | "trial_booked" | "trial_attended" | "thinking" | "awaiting_payment" | "paid" | "student";
export type CrmLostReason = "no_answer" | "not_responding" | "rescheduled" | "refusal" | "other_school" | "unqualified";

export type CrmLead = {
  id: string;
  branch: string;
  childName: string;
  childBirthDate: string;
  parentName: string;
  parentPhone: string;
  source: string;
  sourceNote: string;
  campaign: string;
  stage: CrmStage;
  isLost: boolean;
  lostReason: CrmLostReason | "";
  firstContactAt: string;
  trialAt: string;
  nextContactAt: string;
  responsibleProfileId: string;
  comment: string;
  convertedChildId: string;
  createdAt: string;
  updatedAt: string;
};

export type CrmTask = {
  id: string;
  leadId: string;
  title: string;
  dueAt: string;
  status: "open" | "done" | "cancelled";
  assignedProfileId: string;
  completedAt: string;
};

export type CrmMarketingRow = {
  branch: string;
  source: string;
  leads: number;
  trials: number;
  paid: number;
  students: number;
  lost: number;
};

type ApiError = { message?: string; details?: string };

async function sessionToken() {
  const session = await getValidStaffSession();
  if (!session) throw new Error("Сессия сотрудника не найдена. Войдите снова.");
  return session.access_token;
}

async function rest<T>(path: string) {
  const token = await sessionToken();
  const response = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: { apikey: SUPABASE_PUBLISHABLE_KEY, Authorization: `Bearer ${token}` },
  });
  if (!response.ok) throw new Error("Не удалось загрузить CRM.");
  return response.json() as Promise<T>;
}

function friendly(message: string) {
  if (message.includes("duplicate phone")) return "Клиент с таким телефоном уже есть в активной CRM. Откройте существующую карточку, чтобы не создать дубль.";
  if (message.includes("next contact required")) return "Укажите дату следующего контакта.";
  if (message.includes("invalid phone")) return "Проверьте телефон родителя.";
  if (message.includes("source required")) return "Выберите источник клиента.";
  if (message.includes("lost reason required")) return "Укажите причину, почему лид потерян.";
  if (message.includes("not authorized")) return "Недостаточно прав для этого действия.";
  return message || "Не удалось выполнить действие CRM.";
}

async function rpc<T>(name: string, body: Record<string, unknown>) {
  const token = await sessionToken();
  const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${name}`, {
    method: "POST",
    headers: {
      apikey: SUPABASE_PUBLISHABLE_KEY,
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    let message = "";
    try {
      const payload = (await response.json()) as ApiError;
      message = payload.message || payload.details || "";
    } catch {
      // ignore
    }
    throw new Error(friendly(message));
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

export async function fetchCrmContext(): Promise<{ role: CrmRole; staffBranch: string; profileId: string }> {
  const identity = await fetchStaffIdentity();
  const role = String(identity.role) as CrmRole;
  const allowed = new Set<string>(["owner", "project_director", "manager", "admin", "sales", "marketer"]);
  if (!allowed.has(role)) throw new Error("CRM недоступна для этой роли.");
  const rows = await rest<any[]>(`users_profile?select=staff_branch&id=eq.${encodeURIComponent(identity.profile.id)}&limit=1`);
  return { role, staffBranch: rows[0]?.staff_branch || "", profileId: identity.profile.id };
}

function mapLead(row: any): CrmLead {
  return {
    id: row.id,
    branch: row.branch || "",
    childName: row.child_name || "",
    childBirthDate: row.child_birth_date || "",
    parentName: row.parent_name || "",
    parentPhone: row.parent_phone || "",
    source: row.source || "",
    sourceNote: row.source_note || "",
    campaign: row.campaign || "",
    stage: row.stage,
    isLost: Boolean(row.is_lost),
    lostReason: row.lost_reason || "",
    firstContactAt: row.first_contact_at || "",
    trialAt: row.trial_at || "",
    nextContactAt: row.next_contact_at || "",
    responsibleProfileId: row.responsible_profile_id || "",
    comment: row.comment || "",
    convertedChildId: row.converted_child_id || "",
    createdAt: row.created_at || "",
    updatedAt: row.updated_at || "",
  };
}

export async function fetchCrmLeads(branch = "") {
  const filter = branch ? `&branch=eq.${encodeURIComponent(branch)}` : "";
  const rows = await rest<any[]>(`crm_leads?select=*&order=next_contact_at.asc${filter}`);
  return rows.map(mapLead);
}

export async function fetchCrmTasks() {
  const rows = await rest<any[]>("crm_tasks?select=*&order=due_at.asc");
  return rows.map((row) => ({
    id: row.id,
    leadId: row.lead_id,
    title: row.title || "",
    dueAt: row.due_at || "",
    status: row.status,
    assignedProfileId: row.assigned_profile_id || "",
    completedAt: row.completed_at || "",
  })) as CrmTask[];
}

export async function createCrmLead(input: {
  branch: string;
  childName: string;
  childBirthDate?: string;
  parentName: string;
  parentPhone: string;
  source: string;
  sourceNote?: string;
  campaign?: string;
  trialAt?: string;
  nextContactAt: string;
  comment?: string;
}) {
  return rpc<{ id: string; branch: string; stage: CrmStage }>("crm_create_lead", {
    p_branch: input.branch,
    p_child_name: input.childName.trim(),
    p_child_birth_date: input.childBirthDate || null,
    p_parent_name: input.parentName.trim(),
    p_parent_phone: input.parentPhone.trim(),
    p_source: input.source,
    p_source_note: input.sourceNote?.trim() || null,
    p_campaign: input.campaign?.trim() || null,
    p_trial_at: input.trialAt || null,
    p_next_contact_at: input.nextContactAt,
    p_comment: input.comment?.trim() || null,
    p_responsible_profile_id: null,
  });
}

export async function updateCrmLead(input: {
  leadId: string;
  stage: CrmStage;
  trialAt?: string;
  nextContactAt?: string;
  comment?: string;
  isLost?: boolean;
  lostReason?: CrmLostReason | "";
}) {
  return rpc("crm_update_lead", {
    p_lead_id: input.leadId,
    p_stage: input.stage,
    p_trial_at: input.trialAt || null,
    p_next_contact_at: input.nextContactAt || null,
    p_comment: input.comment?.trim() || null,
    p_is_lost: Boolean(input.isLost),
    p_lost_reason: input.isLost ? input.lostReason || null : null,
    p_responsible_profile_id: null,
  });
}

export async function createCrmTask(leadId: string, title: string, dueAt: string) {
  return rpc<string>("crm_create_task", { p_lead_id: leadId, p_title: title.trim(), p_due_at: dueAt });
}

export async function completeCrmTask(taskId: string) {
  return rpc<string>("crm_complete_task", { p_task_id: taskId });
}

export async function fetchCrmMarketingSummary(from: string, to: string, branch = "") {
  const rows = await rpc<any[]>("crm_marketing_summary", { p_from: from, p_to: to, p_branch: branch || null });
  return rows.map((row) => ({
    branch: row.branch || "",
    source: row.source || "",
    leads: Number(row.leads || 0),
    trials: Number(row.trials || 0),
    paid: Number(row.paid || 0),
    students: Number(row.students || 0),
    lost: Number(row.lost || 0),
  })) as CrmMarketingRow[];
}
