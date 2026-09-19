import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json; charset=utf-8" },
  });
}

function normalizePhone(input: string) {
  const digits = input.replace(/[^0-9]/g, "");
  if (/^8[0-9]{10}$/.test(digits)) return `+7${digits.slice(1)}`;
  if (/^[1-9][0-9]{9,14}$/.test(digits)) return `+${digits}`;
  return null;
}

function internalEmail(phone: string) {
  const digits = phone.replace(/[^0-9]/g, "");
  return `staff.${digits}@auth.openstars.app`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) return json({ error: "server_configuration_error" }, 500);

  let payload: { phone?: string; password?: string; activationCode?: string };
  try { payload = await req.json(); } catch { return json({ error: "invalid_json" }, 400); }

  const phone = normalizePhone(String(payload.phone ?? ""));
  const password = String(payload.password ?? "");
  const activationCode = String(payload.activationCode ?? "").trim().toUpperCase();

  if (!phone) return json({ error: "invalid_phone", message: "Проверьте номер телефона." }, 400);
  if (password.length < 8 || password.length > 72) {
    return json({ error: "invalid_password", message: "Пароль должен содержать от 8 до 72 символов." }, 400);
  }
  if (!/^[0-9A-F]{6}$/.test(activationCode)) {
    return json({ error: "invalid_activation_code", message: "Проверьте код активации." }, 400);
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: verifyData, error: verifyError } = await admin.rpc("verify_staff_invite_code", {
    p_phone: phone,
    p_code: activationCode,
  });
  if (verifyError) {
    console.error("Staff invite verification error", verifyError);
    return json({ error: "invite_verification_failed", message: "Не удалось проверить код активации." }, 500);
  }

  const invite = Array.isArray(verifyData) ? verifyData[0] : verifyData;
  if (!invite?.is_valid) {
    if (invite?.reason === "expired") return json({ error: "activation_expired", message: "Срок действия кода истёк. Обратитесь к директору OPEN STARS." }, 410);
    if (invite?.reason === "locked") return json({ error: "activation_locked", message: "Код заблокирован после нескольких попыток. Обратитесь к директору OPEN STARS." }, 429);
    return json({ error: "activation_failed", message: "Неверный номер телефона или код активации." }, 403);
  }

  const { data: existingProfile, error: profileError } = await admin
    .from("users_profile")
    .select("id,auth_user_id")
    .eq("phone_normalized", phone)
    .maybeSingle();
  if (profileError) {
    console.error("Find existing staff profile error", profileError);
    return json({ error: "registration_failed", message: "Не удалось проверить аккаунт сотрудника." }, 500);
  }

  let authUserId = String(existingProfile?.auth_user_id ?? "");
  const reactivation = Boolean(authUserId);

  if (reactivation) {
    const { error: updateError } = await admin.auth.admin.updateUserById(authUserId, {
      password,
      user_metadata: {
        full_name: invite.full_name ?? "",
        login_phone: phone,
        branch: invite.branch ?? null,
      },
      app_metadata: {
        role: invite.role_name ?? "admin",
        login_method: "phone_alias",
        branch: invite.branch ?? null,
      },
    });
    if (updateError) {
      console.error("Update staff auth user error", updateError);
      return json({ error: "reactivation_failed", message: "Не удалось обновить доступ сотрудника." }, 500);
    }
  } else {
    const { data: created, error: createError } = await admin.auth.admin.createUser({
      email: internalEmail(phone),
      password,
      email_confirm: true,
      user_metadata: {
        full_name: invite.full_name ?? "",
        login_phone: phone,
        branch: invite.branch ?? null,
      },
      app_metadata: {
        role: invite.role_name ?? "admin",
        login_method: "phone_alias",
        branch: invite.branch ?? null,
      },
    });
    if (createError || !created.user) {
      console.error("Create staff auth user error", createError);
      const message = createError?.message?.toLowerCase() ?? "";
      if (message.includes("already") || message.includes("registered") || message.includes("exists")) {
        return json({ error: "phone_already_registered", message: "Этот номер уже активирован. Попросите директора перевыпустить доступ." }, 409);
      }
      return json({ error: "registration_failed", message: "Не удалось создать аккаунт сотрудника." }, 500);
    }
    authUserId = created.user.id;
  }

  const { error: claimError } = await admin.rpc("complete_staff_invite_claim", {
    p_invite_id: invite.invite_id,
    p_auth_user_id: authUserId,
  });
  if (claimError) {
    console.error("Complete staff claim error", claimError);
    if (!reactivation) await admin.auth.admin.deleteUser(authUserId);
    return json({ error: "registration_failed", message: "Не удалось завершить активацию аккаунта." }, 500);
  }

  return json({
    ok: true,
    reactivated: reactivation,
    phone,
    fullName: invite.full_name,
    role: invite.role_name,
    branch: invite.branch,
    message: reactivation
      ? "Доступ обновлён. Войдите по номеру телефона и новому паролю."
      : "Доступ активирован. Теперь войдите по номеру телефона и своему паролю.",
  });
});
