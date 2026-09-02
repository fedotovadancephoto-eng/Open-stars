import { getValidParentSession } from "@/openStarsApi";

const SUPABASE_URL = "https://yiwiykbuaggyslfyhlfo.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_1MORh5rY7uMDVYLYVX5VAA_cyoph4-7";

export async function fetchParentPaymentLink(branch: string) {
  if (!branch) return "";
  const session = await getValidParentSession();
  if (!session) return "";

  const response = await fetch(
    `${SUPABASE_URL}/rest/v1/payment_settings?select=payment_url,enabled&branch=eq.${encodeURIComponent(branch)}&enabled=eq.true&limit=1`,
    {
      headers: {
        apikey: SUPABASE_PUBLISHABLE_KEY,
        Authorization: `Bearer ${session.access_token}`,
      },
    },
  );

  if (!response.ok) return "";
  const rows = (await response.json()) as Array<{ payment_url?: string; enabled?: boolean }>;
  return rows[0]?.enabled ? rows[0]?.payment_url || "" : "";
}
