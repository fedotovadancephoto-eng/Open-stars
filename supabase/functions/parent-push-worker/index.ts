import webpush from "npm:web-push@3.6.7";

type Job = { id: number; lease: string; endpoint: string; p256dh: string; auth: string; notificationId: string; target: string; title: string };

function allowedEndpoint(endpoint: string) {
  try {
    const u = new URL(endpoint);
    return u.protocol === "https:" && !u.username && !u.password && !u.port &&
      /^(fcm\.googleapis\.com|[a-z0-9.-]+\.push\.apple\.com|[a-z0-9.-]+\.push\.services\.mozilla\.com|[a-z0-9.-]+\.notify\.windows\.com)$/.test(u.hostname);
  } catch { return false; }
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });
  // pg_net uses this Vault-held key. The browser never calls this worker.
  const secret = req.headers.get("X-Openstars-Push-Key") || "";
  if (!/^[a-f0-9]{64}$/.test(secret)) return new Response("Unauthorized", { status: 401 });
  const url = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  async function rpc(action: string, data: unknown = {}) {
    const response = await fetch(`${url}/rest/v1/rpc/parent_push_worker`, {
      method: "POST",
      headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ p_action: action, p_secret: secret, p_data: data }),
      signal: AbortSignal.timeout(12000),
    });
    if (!response.ok) {
      const info = await response.json().catch(() => ({}));
      throw new Error(`Worker RPC ${action}: ${response.status} ${String(info.code || "").slice(0,20)}`);
    }
    return response.json();
  }
  let keys: { publicKey: string; privateKey: string };
  try { keys = await rpc("keys"); }
  catch { return new Response("Unauthorized or unavailable", { status: 403 }); }
  try {
    if (!keys.publicKey) {
      const generated = webpush.generateVAPIDKeys();
      await rpc("init", generated);
      keys = await rpc("keys"); // concurrent initializers all use the one persisted key pair
    }
    const request = await req.json().catch(() => ({}));
    if (request.diagnostic === "encryption") {
      // Authenticated operational check. Synthetic receiver; no notifications are sent.
      const receiver = webpush.generateVAPIDKeys();
      const auth = btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(16)))).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/,"");
      const details = webpush.generateRequestDetails({ endpoint: "https://fcm.googleapis.com/push/diagnostic", keys: { p256dh: receiver.publicKey, auth } }, "OPEN STARS", {
        vapidDetails: { subject: "https://open-stars-cabinet.vercel.app", ...keys }, TTL: 60,
      });
      return Response.json({ ready: true, encryptionReady: Boolean(details.body?.length && details.headers.Authorization) });
    }
    let delivered = 0;
    let failed = 0;
    for (let batch = 0; batch < 3; batch++) {
      const jobs: Job[] = await rpc("claim");
      if (!jobs.length) break;
      for (let offset = 0; offset < jobs.length; offset += 5) {
        const results = await Promise.all(jobs.slice(offset, offset + 5).map(async (job) => {
          let status = 400;
          if (allowedEndpoint(job.endpoint)) {
            try {
              const details = webpush.generateRequestDetails({
                endpoint: job.endpoint, keys: { p256dh: job.p256dh, auth: job.auth },
              }, JSON.stringify({
                title: job.title,
                body: job.target === "push_test" ? "Уведомления OPEN STARS подключены." : "Откройте OPEN STARS, чтобы посмотреть подробности.",
                notificationId: job.notificationId,
              }), {
                vapidDetails: { subject: "https://open-stars-cabinet.vercel.app", ...keys },
                TTL: job.target === "payments" ? 300 : 3600,
                urgency: "normal",
              });
              const result = await fetch(details.endpoint, { method: "POST", headers: details.headers,
                body: details.body, signal: AbortSignal.timeout(8000), redirect: "manual" });
              status = result.status;
              await result.body?.cancel();
            } catch (error) {
              status = typeof (error as { statusCode?: number }).statusCode === "number"
                ? (error as { statusCode: number }).statusCode : 503;
            }
          }
          if (status >= 200 && status < 300) delivered++; else failed++;
          return { id: job.id, lease: job.lease, status };
        }));
        await rpc("ack", { results });
      }
    }
    // Operational counts only: no endpoints, signing keys, child names or payment data.
    return Response.json({ ready: true, delivered, failed });
  } catch (error) {
    // Only explicit RPC status codes and error type are returned, never request data or keys.
    const reason = error instanceof Error && error.message.startsWith("Worker RPC ") ? error.message : (error instanceof Error ? error.name : "UnknownError");
    return Response.json({ error: "Delivery deferred; queued jobs will retry", reason }, { status: 503 });
  }
});
