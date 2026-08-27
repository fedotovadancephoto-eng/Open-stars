import { getValidParentSession } from "@/openStarsApi";

const SUPABASE_URL = "https://yiwiykbuaggyslfyhlfo.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_1MORh5rY7uMDVYLYVX5VAA_cyoph4-7";

export type BirthdayReward = {
  isBirthday: boolean;
  awardedNow: boolean;
  amount: number;
};

export async function claimBirthdayReward(childId: string): Promise<BirthdayReward> {
  const session = await getValidParentSession();
  if (!session) throw new Error("Сессия истекла. Войдите снова.");

  const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/parent_claim_birthday_reward`, {
    method: "POST",
    headers: {
      apikey: SUPABASE_PUBLISHABLE_KEY,
      Authorization: `Bearer ${session.access_token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ p_child_id: childId }),
  });

  if (!response.ok) {
    throw new Error("Не удалось проверить подарок ко дню рождения.");
  }

  const rows = await response.json();
  const row = Array.isArray(rows) ? rows[0] : rows;

  return {
    isBirthday: Boolean(row?.is_birthday),
    awardedNow: Boolean(row?.awarded_now),
    amount: Number(row?.reward_amount || 0),
  };
}
