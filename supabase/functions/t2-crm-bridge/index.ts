import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.10";

const base = "https://ats2.t2.ru/crm/openapi";
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Cache-Control": "no-store",
};
function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { ...cors, "Content-Type": "application/json; charset=utf-8" } });
}
function phone(raw: unknown) {
  const digits = String(raw ?? "").replace(/\D/g, "");
  if (digits.length === 11 && digits[0] === "8") return "7" + digits.slice(1);
  if (digits.length === 11 && digits[0] === "7") return digits;
  if (digits.length === 10) return "7" + digits;
  return "";
}
type Account = {
  provider: "t2"; work_phone: string; access_token: string | null;
  refresh_token: string | null; connected_at: string | null;
  last_synced_at: string | null;
};
type T2Call = {
  uuid?: string; date?: string; callType?: string; callerNumber?: string;
  calleeNumber?: string; destinationNumber?: string; callDuration?: number;
  conversationDuration?: number; callStatus?: string; recordFileName?: string;
};
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return json({ ok: true });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  if (Number(req.headers.get("content-length") || 0) > 16384) return json({ error: "too_large" }, 413);
  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  if (!supabaseUrl || !key) return json({ error: "server_not_configured" }, 503);
  const authHeader = req.headers.get("authorization") || "";
  const jwt = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
  if (!jwt) return json({ error: "unauthorized" }, 401);
  const admin = createClient(supabaseUrl, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: auth, error: authError } = await admin.auth.getUser(jwt);
  if (authError || !auth.user) return json({ error: "unauthorized" }, 401);
  const { data: staff, error: staffError } = await admin.from("users_profile")
    .select("id,staff_branch,roles(name)").eq("auth_user_id", auth.user.id).maybeSingle();
  const rawRole = staff?.roles as { name?: string } | { name?: string }[] | null;
  const role = Array.isArray(rawRole) ? rawRole[0]?.name : rawRole?.name;
  if (staffError || !staff || !["owner", "manager", "sales", "admin"].includes(role || "")) return json({ error: "forbidden" }, 403);
  let body: { action?: string; accessToken?: string; refreshToken?: string; callId?: string };
  try { body = await req.json(); } catch { return json({ error: "invalid_json" }, 400); }
  const action = body.action;
  if (!["status", "connect", "sync", "recording"].includes(action || "")) return json({ error: "invalid_action" }, 400);
  if (action !== "recording" && role !== "owner") return json({ error: "owner_only" }, 403);

  const { data: account, error: accountError } = await admin.from("crm_telephony_accounts")
    .select("provider,work_phone,access_token,refresh_token,connected_at,last_synced_at")
    .eq("provider", "t2").maybeSingle();
  if (accountError || !account) return json({ error: "account_not_prepared" }, 503);
  const acc = account as Account;
  if (action === "status") {
    return json({ ok: true, connected: Boolean(acc.access_token && acc.refresh_token),
      phoneLast4: acc.work_phone.slice(-4), connectedAt: acc.connected_at, lastSyncedAt: acc.last_synced_at });
  }

  async function t2(path: string): Promise<Response> {
    if (!acc.access_token || !acc.refresh_token) throw new Error("t2_not_connected");
    const fetchWith = (token: string) => fetch(base + path, {
      headers: { Authorization: token, Accept: "application/json, audio/mpeg" },
      signal: AbortSignal.timeout(18000),
    });
    let result = await fetchWith(acc.access_token);
    if (result.status !== 403) return result;
    const refresh = await fetch(base + "/authorization/refresh/token", {
      method: "PUT", headers: { Authorization: acc.refresh_token, Accept: "application/json" },
      signal: AbortSignal.timeout(18000),
    });
    if (!refresh.ok) throw new Error("t2_tokens_expired");
    const tokens = await refresh.json();
    if (typeof tokens.accessToken !== "string" || typeof tokens.refreshToken !== "string") throw new Error("t2_invalid_refresh");
    acc.access_token = tokens.accessToken;
    acc.refresh_token = tokens.refreshToken;
    const { error } = await admin.from("crm_telephony_accounts").update({
      access_token: tokens.accessToken, refresh_token: tokens.refreshToken,
      token_updated_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    }).eq("provider", "t2");
    if (error) throw new Error("t2_token_storage_failed");
    result = await fetchWith(tokens.accessToken);
    return result;
  }

  if (action === "connect") {
    const access = body.accessToken?.trim() || "";
    const refresh = body.refreshToken?.trim() || "";
    if (access.length < 30 || access.length > 8000 || refresh.length < 30 || refresh.length > 8000)
      return json({ error: "invalid_tokens" }, 400);
    const response = await fetch(base + "/employees", {
      headers: { Authorization: access, Accept: "application/json" },
      signal: AbortSignal.timeout(18000),
    }).catch(() => null);
    if (!response?.ok) return json({ error: "t2_auth_failed", status: response?.status || 0 }, 400);
    const { error } = await admin.from("crm_telephony_accounts").update({
      access_token: access, refresh_token: refresh,
      connected_at: new Date().toISOString(), token_updated_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }).eq("provider", "t2");
    if (error) return json({ error: "credential_save_failed" }, 500);
    return json({ ok: true, connected: true });
  }

  if (!acc.access_token || !acc.refresh_token) return json({ error: "t2_not_connected" }, 409);

  if (action === "recording") {
    const callId = body.callId || "";
    if (!/^[a-f0-9-]{36}$/i.test(callId)) return json({ error: "invalid_call" }, 400);
    const { data: call } = await admin.from("crm_call_logs")
      .select("lead_id,provider,recording_external_id,recording_state").eq("id", callId).maybeSingle();
    if (!call || call.provider !== "t2" || call.recording_state !== "ready" || !call.recording_external_id || !call.lead_id)
      return json({ error: "recording_not_found" }, 404);
    const { data: lead } = await admin.from("crm_leads").select("branch").eq("id", call.lead_id).maybeSingle();
    if (!lead || (role === "admin" && lead.branch !== staff.staff_branch)) return json({ error: "forbidden" }, 403);
    const file = await t2("/call-records/file?filename=" + encodeURIComponent(call.recording_external_id));
    if (!file.ok) return json({ error: "t2_recording_unavailable" }, 502);
    return new Response(file.body, {
      status: 200, headers: { ...cors, "Content-Type": "audio/mpeg", "Content-Disposition": "inline; filename=call.mp3" },
    });
  }

  try {
    const now = new Date();
    const since = acc.last_synced_at ? new Date(acc.last_synced_at).getTime() - 3600000 : now.getTime() - 7 * 86400000;
    const start = new Date(Math.max(since, now.getTime() - 30 * 86400000)).toISOString();
    const end = now.toISOString();
    const found = new Map<string, T2Call>();
    for (const field of ["caller", "callee"] as const) {
      for (let page = 0; page < 5; page++) {
        const qs = new URLSearchParams({ start, end, [field]: acc.work_phone, page: String(page), size: "100" });
        const response = await t2("/call-records/info?" + qs.toString());
        if (!response.ok) throw new Error("t2_calls_request_failed");
        const payload = await response.json();
        const items: T2Call[] = Array.isArray(payload) ? payload : Array.isArray(payload?.content) ? payload.content : [];
        for (const item of items) if (typeof item.uuid === "string") found.set(item.uuid, item);
        if (items.length < 100) break;
      }
    }
    const { data: leads, error: leadsError } = await admin.from("crm_leads").select("id,phone_normalized,parent_phone");
    if (leadsError) throw new Error("crm_leads_unavailable");
    const byPhone = new Map<string, string[]>();
    for (const lead of leads || []) {
      const key = phone(lead.phone_normalized || lead.parent_phone);
      if (!key) continue;
      byPhone.set(key, [...(byPhone.get(key) || []), lead.id]);
    }
    const rows: Record<string, unknown>[] = [];
    let unmatched = 0;
    for (const call of found.values()) {
      const caller = phone(call.callerNumber);
      const callee = phone(call.calleeNumber);
      const destination = phone(call.destinationNumber);
      const outbound = caller === acc.work_phone;
      const inbound = !outbound && (callee === acc.work_phone || destination === acc.work_phone);
      if (!outbound && !inbound) continue;
      const client = outbound ? (callee || destination) : caller;
      if (!client || client === acc.work_phone) continue;
      const ids = byPhone.get(client) || [];
      if (ids.length !== 1) { unmatched++; continue; }
      const startTime = new Date(call.date || "");
      if (Number.isNaN(startTime.getTime())) continue;
      const duration = Number.isFinite(call.conversationDuration) ? call.conversationDuration : call.callDuration;
      const seconds = Number.isFinite(duration) ? Math.max(0, Math.round(Number(duration))) : null;
      const status = call.callStatus || "";
      const outcome = status.startsWith("ANSWERED") ? "answered" :
        status.includes("BUSY") ? "busy" : status.includes("NOT_ANSWERED") || status.includes("CANCELLED") ? "missed" : "unknown";
      rows.push({
        provider: "t2", external_call_id: call.uuid, lead_id: ids[0],
        direction: outbound ? "outbound" : "inbound",
        client_phone: client, staff_phone: acc.work_phone,
        started_at: startTime.toISOString(),
        duration_seconds: seconds, outcome,
        recording_external_id: call.recordFileName || null,
        recording_state: call.recordFileName ? "ready" : "unavailable",
      });
    }
    if (rows.length) {
      const { error } = await admin.from("crm_call_logs").upsert(rows, { onConflict: "provider,external_call_id" });
      if (error) throw new Error("crm_call_save_failed");
    }
    const { error: updated } = await admin.from("crm_telephony_accounts")
      .update({ last_synced_at: now.toISOString(), updated_at: now.toISOString() }).eq("provider", "t2");
    if (updated) throw new Error("crm_sync_state_failed");
    return json({ ok: true, saved: rows.length, unmatched, total: found.size, syncedAt: now.toISOString() });
  } catch (error) {
    const code = error instanceof Error ? error.message : "sync_failed";
    return json({ error: code }, 502);
  }
});
