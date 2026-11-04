// OPEN STARS CRM: signed Tilda forms + verified VK Callback API.
// Keep this function JWT-public only because both providers call server-to-server.
// Authentication is mandatory inside the handler (Tilda header / VK callback secret).
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_ADMIN_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const MAX_BODY = 64_000;

type Inbound = {
  source: "site" | "vk";
  external_event_id: string | null;
  event_type: string;
  sender_id?: string | null;
  sender_name?: string | null;
  sender_phone?: string | null;
  sender_email?: string | null;
  message?: string | null;
  campaign?: string | null;
  form_id?: string | null;
  page_url?: string | null;
  metadata?: Record<string, string>;
};

function response(body: string, status = 200) {
  return new Response(body, { status, headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" } });
}

function sameSecret(received: string, expected: string) {
  const a = new TextEncoder().encode(received);
  const b = new TextEncoder().encode(expected);
  if (!a.length || a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) mismatch |= a[i] ^ b[i];
  return mismatch === 0;
}

function short(value: unknown, limit = 200) {
  return (typeof value === "string" || typeof value === "number" ? String(value) : "").trim().slice(0, limit);
}

function getField(obj: Record<string, unknown>, ...keys: string[]) {
  const lower = Object.fromEntries(Object.entries(obj).map(([key, value]) => [key.toLowerCase().trim(), value]));
  for (const key of keys) {
    const value = lower[key.toLowerCase()];
    if (value !== undefined && value !== null) return short(value, 1000);
  }
  return "";
}

function parseTilda(raw: string, contentType: string): Record<string, unknown> {
  if (contentType.includes("application/json")) {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("invalid form");
    return parsed as Record<string, unknown>;
  }
  return Object.fromEntries(new URLSearchParams(raw));
}

async function store(item: Inbound) {
  if (!SUPABASE_URL || !SUPABASE_ADMIN_KEY) throw new Error("missing database configuration");
  const result = await fetch(SUPABASE_URL + "/rest/v1/crm_inbound_items", {
    method: "POST",
    headers: {
      apikey: SUPABASE_ADMIN_KEY,
      Authorization: "Bearer " + SUPABASE_ADMIN_KEY,
      "Content-Type": "application/json",
      Prefer: "return=minimal",
    },
    body: JSON.stringify(item),
  });
  if (result.ok) return;
  // Provider retries must not create duplicate messages or forms.
  if (result.status === 409) {
    const body = await result.json().catch(() => ({})) as { code?: string };
    if (body.code === "23505") return;
  }
  throw new Error("database insert failed: " + result.status);
}


async function verifyTildaKey(value: string): Promise<boolean> {
  if (!/^[0-9a-f]{64}$/.test(value)) return false;
  if (!SUPABASE_URL || !SUPABASE_ADMIN_KEY) throw new Error("missing database configuration");
  const result = await fetch(SUPABASE_URL + "/rest/v1/rpc/crm_verify_tilda_key", {
    method: "POST",
    headers: {
      apikey: SUPABASE_ADMIN_KEY,
      Authorization: "Bearer " + SUPABASE_ADMIN_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ p_key: value }),
  });
  if (!result.ok) throw new Error("key verifier unavailable");
  return (await result.json()) === true;
}

async function receiveTilda(req: Request, raw: string) {
  if (!(await verifyTildaKey(req.headers.get("x-open-stars-webhook-key") ?? ""))) return response("unauthorized", 401);
  let fields: Record<string, unknown>;
  try { fields = parseTilda(raw, req.headers.get("content-type") ?? ""); }
  catch { return response("invalid form", 400); }

  if (getField(fields, "test") === "test") return response("ok");
  const transactionId = getField(fields, "tranid", "transaction_id", "leadid");
  const phone = getField(fields, "phone", "телефон", "tel", "mobile");
  const email = getField(fields, "email", "e-mail");
  if (!phone && !email) return response("missing contact", 422);

  const name = getField(fields, "name", "имя", "fio", "fullname", "full_name");
  const comment = getField(fields, "comments", "comment", "message", "вопрос", "комментарий");
  const program = getField(fields, "program", "service", "услуга", "направление");
  const childName = getField(fields, "child", "child_name", "имя ребенка", "имя ребёнка");
  const message = [program && "Направление: " + program, childName && "Ребёнок: " + childName, comment]
    .filter(Boolean).join("\n").slice(0, 4000);

  await store({
    source: "site",
    external_event_id: transactionId ? "tilda:" + transactionId.slice(0, 250) : null,
    event_type: "form_submission",
    sender_name: name || null,
    sender_phone: phone || null,
    sender_email: email || null,
    message: message || null,
    campaign: getField(fields, "utm_campaign", "campaign") || null,
    form_id: getField(fields, "formid") || null,
    page_url: getField(fields, "formurl", "url", "page") || null,
    metadata: {
      utm_source: getField(fields, "utm_source"),
      utm_medium: getField(fields, "utm_medium"),
      requested_branch: getField(fields, "branch", "filial", "филиал", "округ", "location"),
    },
  });
  return response("ok");
}

function vkLeadText(object: Record<string, unknown>) {
  const answers = object.answers;
  if (Array.isArray(answers)) {
    return answers.slice(0, 30).map((answer) => {
      if (!answer || typeof answer !== "object") return "";
      const entry = answer as Record<string, unknown>;
      return [short(entry.key, 100), short(entry.answer, 300)].filter(Boolean).join(": ");
    }).filter(Boolean).join("\n").slice(0, 4000);
  }
  return "";
}

async function verifyVkCallback(groupId: number, secret: string): Promise<{ authorized: boolean; confirmation_code?: string }> {
  if (!Number.isSafeInteger(groupId) || groupId < 1 || !/^[0-9a-f]{32}([0-9a-f]{32})?$/.test(secret)) {
    return { authorized: false };
  }
  if (!SUPABASE_URL || !SUPABASE_ADMIN_KEY) throw new Error("missing database configuration");
  const result = await fetch(SUPABASE_URL + "/rest/v1/rpc/crm_vk_verify_callback", {
    method: "POST",
    headers: {
      apikey: SUPABASE_ADMIN_KEY,
      Authorization: "Bearer " + SUPABASE_ADMIN_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ p_group_id: groupId, p_secret: secret }),
  });
  if (!result.ok) throw new Error("VK callback verifier unavailable");
  return await result.json() as { authorized: boolean; confirmation_code?: string };
}

async function vkConfirmationCode(groupId: number): Promise<string | null> {
  if (!Number.isSafeInteger(groupId) || groupId < 1) return null;
  if (!SUPABASE_URL || !SUPABASE_ADMIN_KEY) throw new Error("missing database configuration");
  const result = await fetch(SUPABASE_URL + "/rest/v1/rpc/crm_vk_confirmation", {
    method: "POST",
    headers: {
      apikey: SUPABASE_ADMIN_KEY,
      Authorization: "Bearer " + SUPABASE_ADMIN_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ p_group_id: groupId }),
  });
  if (!result.ok) throw new Error("VK confirmation verifier unavailable");
  const code: unknown = await result.json();
  return typeof code === "string" && code.length >= 4 && code.length <= 128 ? code : null;
}

async function receiveVk(raw: string) {
  let payload: Record<string, unknown>;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("invalid callback");
    payload = parsed as Record<string, unknown>;
  } catch { return response("invalid json", 400); }

  const groupId = Number(payload.group_id);
  // VK's confirmation POST contains type + group_id, but no shared event secret.
  if (payload.type === "confirmation") {
    const code = await vkConfirmationCode(groupId);
    return code ? response(code) : response("not configured", 403);
  }
  // All subsequent event deliveries must have the exact secret.
  const verification = await verifyVkCallback(groupId, short(payload.secret, 500));
  if (!verification.authorized) return response("unauthorized", 403);
  const eventType = short(payload.type, 100);
  if (eventType !== "message_new" && eventType !== "lead_forms_new") return response("ok");
  const object = payload.object && typeof payload.object === "object" && !Array.isArray(payload.object)
    ? payload.object as Record<string, unknown> : {};
  const msg = object.message && typeof object.message === "object" && !Array.isArray(object.message)
    ? object.message as Record<string, unknown> : {};
  const senderId = eventType === "message_new" ? short(msg.from_id) : short(object.user_id);
  if (eventType === "message_new" && (!senderId || Number(senderId) <= 0)) return response("ok");
  const messageId = eventType === "message_new"
    ? short(msg.id || msg.conversation_message_id)
    : short(object.lead_id || object.id);
  const eventId = short(payload.event_id) || (messageId ? String(groupId) + ":" + senderId + ":" + messageId : "");
  await store({
    source: "vk",
    external_event_id: eventId ? "vk:" + eventId.slice(0, 270) : null,
    event_type: eventType,
    sender_id: senderId || null,
    message: eventType === "message_new" ? short(msg.text, 4000) : vkLeadText(object),
    form_id: eventType === "lead_forms_new" ? short(object.form_id) : null,
    metadata: { group_id: String(groupId) },
  });
  return response("ok");
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return response("method not allowed", 405);
  if (Number(req.headers.get("content-length") || "0") > MAX_BODY) return response("payload too large", 413);
  const source = new URL(req.url).searchParams.get("source");
  if (source !== "tilda" && source !== "vk") return response("unknown source", 404);
  try {
    const raw = await req.text();
    if (raw.length > MAX_BODY) return response("payload too large", 413);
    return source === "tilda" ? await receiveTilda(req, raw) : await receiveVk(raw);
  } catch {
    // No request bodies or personal information in logs.
    return response("temporary error", 503);
  }
});
