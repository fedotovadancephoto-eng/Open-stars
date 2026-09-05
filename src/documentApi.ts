import { getValidParentSession } from "@/openStarsApi";

const SUPABASE_URL = "https://yiwiykbuaggyslfyhlfo.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_1MORh5rY7uMDVYLYVX5VAA_cyoph4-7";

export type DocumentStatus = "pending" | "accept" | "decline" | "revoke";

export type ParentDocumentItem = {
  code: "esign_agreement" | "personal_data" | "education_contract" | "photo_video";
  version: number;
  title: string;
  shortTitle: string;
  required: boolean;
  childSpecific: boolean;
  body: string | null;
  status: DocumentStatus;
  signedAt: string | null;
  hash: string | null;
};

export type ParentDocumentCenter = {
  profile: {
    id: string;
    fullName: string;
    phone: string;
    address: string;
    email: string;
  };
  child: {
    id: string;
    fullName: string;
    birthDate: string | null;
    branch: string;
    address: string;
  };
  contractTerms: null | {
    child_id: string;
    start_date: string;
    end_date: string;
    monthly_price: number;
    total_price: number;
    tariff_name: string;
    tariff_description: string;
    program_type: string;
    program_name: string;
    study_form: string;
    completion_document_name: string;
    updated_at: string;
  };
  documents: ParentDocumentItem[];
};

type RpcError = { message?: string; details?: string; hint?: string; error?: string };

async function parentRpc<T>(name: string, body: Record<string, unknown>): Promise<T> {
  const session = await getValidParentSession();
  if (!session) throw new Error("Сессия истекла. Войдите снова.");

  const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${name}`, {
    method: "POST",
    headers: {
      apikey: SUPABASE_PUBLISHABLE_KEY,
      Authorization: `Bearer ${session.access_token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    let payload: RpcError = {};
    try { payload = await response.json(); } catch { /* ignore */ }
    const message = payload.message || payload.details || "Не удалось выполнить действие.";
    throw new Error(message.replace("document template not found", "Документ пока недоступен."));
  }

  if (response.status === 204) return undefined as T;
  const text = await response.text();
  return (text ? JSON.parse(text) : undefined) as T;
}

export function fetchParentDocumentCenter(childId: string) {
  return parentRpc<ParentDocumentCenter>("parent_document_center", { p_child_id: childId });
}

export function saveParentDocumentDetails(input: {
  childId: string;
  parentAddress: string;
  childAddress: string;
  email?: string;
}) {
  return parentRpc<void>("parent_save_document_details", {
    p_child_id: input.childId,
    p_parent_address: input.parentAddress,
    p_child_address: input.childAddress,
    p_email: input.email || "",
  });
}

export function signParentDocument(childId: string, code: ParentDocumentItem["code"], decision: "accept" | "decline" | "revoke" = "accept") {
  return parentRpc<{ ok: true; status: DocumentStatus; hash: string; signedAt: string }>("parent_sign_document", {
    p_child_id: childId,
    p_code: code,
    p_decision: decision,
  });
}
