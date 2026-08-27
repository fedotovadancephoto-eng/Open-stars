export type AdminSection =
  | "students"
  | "add-student"
  | "archive"
  | "parent-activation"
  | "child-photo"
  | "schedule"
  | "study"
  | "coins"
  | "news"
  | "payments"
  | "photos"
  | "feedback"
  | "team";

export const ADMIN_SECTION_EVENT = "openstars:admin-section";
export const ADMIN_DATA_UPDATED_EVENT = "openstars:admin-data-updated";

export function openAdminSection(section: AdminSection, detail: Record<string, unknown> = {}) {
  window.dispatchEvent(new CustomEvent(ADMIN_SECTION_EVENT, { detail: { section, ...detail } }));
}

export function onAdminSection(section: AdminSection, handler: (detail: Record<string, unknown>) => void) {
  const listener = (event: Event) => {
    const detail = (event as CustomEvent<Record<string, unknown> & { section?: AdminSection }>).detail || {};
    if (detail.section !== section) return;
    handler(detail);
  };
  window.addEventListener(ADMIN_SECTION_EVENT, listener);
  return () => window.removeEventListener(ADMIN_SECTION_EVENT, listener);
}

export function notifyAdminDataUpdated(detail: Record<string, unknown> = {}) {
  window.dispatchEvent(new CustomEvent(ADMIN_DATA_UPDATED_EVENT, { detail }));
}
