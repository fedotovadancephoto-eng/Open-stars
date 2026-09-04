export type AdminSection =
  | "students"
  | "add-student"
  | "archive"
  | "parent-activation"
  | "parent-password-reset"
  | "child-photo"
  | "schedule"
  | "study"
  | "coins"
  | "news"
  | "payments"
  | "photos"
  | "feedback"
  | "team"
  | "reports"
  | "expenses"
  | "payroll"
  | "business";

export const ADMIN_SECTION_EVENT = "openstars:admin-section";
export const ADMIN_DATA_UPDATED_EVENT = "openstars:admin-data-updated";

const legacyEventBySection: Partial<Record<AdminSection, string>> = {
  "child-photo": "openstars:open-child-photo-upload",
  study: "openstars:open-study",
  coins: "openstars:open-coins",
  news: "openstars:open-news",
};

const legacyButtonLabelBySection: Partial<Record<AdminSection, string>> = {
  "parent-activation": "Активация родителей",
  schedule: "Расписание",
  payments: "Оплата",
  photos: "Фотосессии",
  feedback: "Обратная связь",
};

function openLegacyManager(section: AdminSection) {
  const label = legacyButtonLabelBySection[section];
  if (!label) return;
  const button = Array.from(document.querySelectorAll<HTMLButtonElement>("button")).find((item) => {
    const className = typeof item.className === "string" ? item.className : "";
    return className.includes("fixed") && (item.textContent || "").replace(/\s+/g, " ").trim().startsWith(label);
  });
  button?.click();
}

export function openAdminSection(section: AdminSection, detail: Record<string, unknown> = {}) {
  window.dispatchEvent(new CustomEvent(ADMIN_SECTION_EVENT, { detail: { section, ...detail } }));
  const legacyEvent = legacyEventBySection[section];
  if (legacyEvent) window.dispatchEvent(new CustomEvent(legacyEvent, { detail }));
  if (legacyButtonLabelBySection[section]) window.setTimeout(() => openLegacyManager(section), 0);
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
