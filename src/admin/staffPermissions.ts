import type { StaffRole } from "@/admin/adminApi";
import type { AdminSection } from "@/admin/adminNavigation";

const allStaff: readonly StaffRole[] = ["owner", "project_director", "admin", "manager", "teacher"];
const administration: readonly StaffRole[] = ["owner", "project_director", "admin", "manager"];

export const STAFF_SECTION_ROLES: Record<AdminSection, readonly StaffRole[]> = {
  "team-work": ["owner", "admin", "manager", "teacher"],
  "attendance-overview": administration,
  students: allStaff,
  "add-student": administration,
  archive: administration,
  "parent-activation": administration,
  "parent-password-reset": administration,
  "child-photo": administration,
  schedule: allStaff,
  study: allStaff,
  coins: administration,
  news: administration,
  payments: administration,
  "tuition-refund": ["owner"],
  events: administration,
  documents: administration,
  photos: administration,
  feedback: administration,
  team: ["owner", "project_director"],
  reports: allStaff,
  expenses: administration,
  payroll: ["owner", "admin", "manager"],
  crm: administration,
  "crm-access": ["owner", "project_director"],
  business: ["owner"],
};

export function canAccessAdminSection(role: StaffRole | null, section: AdminSection) {
  return Boolean(role && STAFF_SECTION_ROLES[section].includes(role));
}
