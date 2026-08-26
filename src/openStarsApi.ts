const SUPABASE_URL =
  "https://yiwiykbuaggyslfyhlfo.supabase.co";

const SUPABASE_PUBLISHABLE_KEY =
  "sb_publishable_1MORh5rY7uMDVYLYVX5VAA_cyoph4-7";

const SESSION_STORAGE_KEY =
  "openstars_parent_session";

export type ParentSession = {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  expires_at: number;
  token_type: string;
};

export type ParentLoginResult = {
  ok: true;
  phone: string;
  session: ParentSession;
  user: {
    id: string;
  };
};

export type ParentRegistrationResult = {
  ok: true;
  phone: string;
  message: string;
};

type ApiErrorResponse = {
  error?: string;
  message?: string;
};

async function callEdgeFunction<T>(
  functionName: string,
  body: Record<string, unknown>
): Promise<T> {
  const response = await fetch(
    `${SUPABASE_URL}/functions/v1/${functionName}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: SUPABASE_PUBLISHABLE_KEY,
      },
      body: JSON.stringify(body),
    }
  );

  let data: T | ApiErrorResponse;

  try {
    data = await response.json();
  } catch {
    throw new Error(
      "Не удалось получить ответ от сервера."
    );
  }

  if (!response.ok) {
    const errorData = data as ApiErrorResponse;

    throw new Error(
      errorData.message ||
        "Что-то пошло не так. Попробуйте ещё раз."
    );
  }

  return data as T;
}

export async function registerParent(
  phone: string,
  activationCode: string,
  password: string
) {
  return callEdgeFunction<ParentRegistrationResult>(
    "register-parent",
    {
      phone,
      activationCode,
      password,
    }
  );
}

export async function loginParent(
  phone: string,
  password: string
) {
  const result =
    await callEdgeFunction<ParentLoginResult>(
      "login-parent",
      {
        phone,
        password,
      }
    );

  saveParentSession(result.session);

  return result;
}

export function saveParentSession(
  session: ParentSession
) {
  if (typeof window === "undefined") return;

  window.localStorage.setItem(
    SESSION_STORAGE_KEY,
    JSON.stringify(session)
  );
}

export function getParentSession():
  | ParentSession
  | null {
  if (typeof window === "undefined") {
    return null;
  }

  const stored =
    window.localStorage.getItem(
      SESSION_STORAGE_KEY
    );

  if (!stored) return null;

  try {
    return JSON.parse(stored) as ParentSession;
  } catch {
    clearParentSession();
    return null;
  }
}

export function clearParentSession() {
  if (typeof window === "undefined") return;

  window.localStorage.removeItem(
    SESSION_STORAGE_KEY
  );
}

export function isParentSessionExpired(
  session: ParentSession
) {
  const now = Math.floor(Date.now() / 1000);

  return session.expires_at <= now + 30;
}

export async function refreshParentSession() {
  const currentSession =
    getParentSession();

  if (!currentSession) {
    return null;
  }

  const response = await fetch(
    `${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: SUPABASE_PUBLISHABLE_KEY,
      },
      body: JSON.stringify({
        refresh_token:
          currentSession.refresh_token,
      }),
    }
  );

  if (!response.ok) {
    clearParentSession();
    return null;
  }

  const data = await response.json();

  const session: ParentSession = {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expires_in: data.expires_in,
    expires_at:
      data.expires_at ??
      Math.floor(Date.now() / 1000) +
        data.expires_in,
    token_type: data.token_type,
  };

  saveParentSession(session);

  return session;
}

export async function getValidParentSession() {
  const session = getParentSession();

  if (!session) {
    return null;
  }

  if (!isParentSessionExpired(session)) {
    return session;
  }

  return refreshParentSession();
}

export function logoutParent() {
  clearParentSession();
}