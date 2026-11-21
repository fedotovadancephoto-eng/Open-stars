export const TEMP_STAFF_CONTEXT_KEY = "openstars_temporary_staff_context";

export function selectedStaffContext() {
  try { return sessionStorage.getItem(TEMP_STAFF_CONTEXT_KEY) || ""; } catch { return ""; }
}

export function switchStaffContext(key: string, baseRole: string) {
  if (key) sessionStorage.setItem(TEMP_STAFF_CONTEXT_KEY, key);
  else sessionStorage.removeItem(TEMP_STAFF_CONTEXT_KEY);
  localStorage.setItem("openstars_staff_view_mode", "primary");
  window.location.assign(!key && baseRole === "sales" ? "/admin/crm" : "/admin");
}

/** Scope only the signed-in staff's REST calls; parent/auth/storage requests are untouched. */
export function staffContextRequestInit(input: RequestInfo | URL, init?: RequestInit): RequestInit | undefined {
  if (!window.location.pathname.startsWith("/admin")) return init;
  const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url, window.location.origin);
  if (url.origin !== "https://yiwiykbuaggyslfyhlfo.supabase.co" || !url.pathname.startsWith("/rest/v1/")) return init;
  const key = selectedStaffContext();
  if (!key) return init;
  const headers = new Headers(init?.headers ?? (input instanceof Request ? input.headers : undefined));
  try {
    const session = JSON.parse(localStorage.getItem("openstars_staff_session") || "null");
    if (!session?.access_token || headers.get("Authorization") !== `Bearer ${session.access_token}`) return init;
  } catch { return init; }
  headers.set("x-openstars-staff-context", key);
  return { ...init, headers };
}
