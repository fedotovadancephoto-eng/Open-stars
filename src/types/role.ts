export type UserRole =
  | "parent"
  | "teacher"
  | "admin"
  | "manager";

export const DEMO_USER_ROLE: UserRole =
  "parent";

export const ROLE_PORTAL_LABELS: Record<
  UserRole,
  string
> = {
  parent: "Родительский портал",
  teacher: "Портал педагога",
  admin: "Администратор",
  manager: "Менеджер",
};