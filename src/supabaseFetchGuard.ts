const SUPABASE_HOST = "yiwiykbuaggyslfyhlfo.supabase.co";
const MAX_CLOCK_SKEW_RETRIES = 3;
const REFRESH_DEDUP_WINDOW_MS = 1800;

function sleep(ms: number) {
  return new Promise<void>((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

function getRequestUrl(input: RequestInfo | URL) {
  if (typeof input === "string") return input;
  if (input instanceof URL) return input.toString();
  return input.url;
}

function getRequestMethod(input: RequestInfo | URL, init?: RequestInit) {
  if (init?.method) return init.method.toUpperCase();
  if (typeof Request !== "undefined" && input instanceof Request) {
    return input.method.toUpperCase();
  }
  return "GET";
}

function refreshRequestKey(input: RequestInfo | URL, init?: RequestInit) {
  const url = getRequestUrl(input);
  const method = getRequestMethod(input, init);
  if (
    method !== "POST" ||
    !url.includes(SUPABASE_HOST) ||
    !url.includes("/auth/v1/token") ||
    !url.includes("grant_type=refresh_token")
  ) {
    return "";
  }

  if (typeof init?.body === "string") {
    try {
      const parsed = JSON.parse(init.body);
      if (typeof parsed?.refresh_token === "string") return parsed.refresh_token;
    } catch {
      // Fall back to the URL key below.
    }
  }
  return url;
}

async function isIssuedAtFutureResponse(response: Response) {
  if (response.status !== 401) return false;

  try {
    const payload = await response.clone().json();
    const code = typeof payload?.code === "string" ? payload.code : "";
    const message = typeof payload?.message === "string" ? payload.message : "";

    return (
      code === "PGRST303" &&
      message.toLowerCase().includes("issued at future")
    );
  } catch {
    return false;
  }
}

let installed = false;
let refreshLock: {
  key: string;
  promise: Promise<Response>;
  expiresAt: number;
} | null = null;

export function installSupabaseFetchGuard() {
  if (installed || typeof window === "undefined") return;
  installed = true;

  const originalFetch = window.fetch.bind(window);

  window.fetch = async (
    input: RequestInfo | URL,
    init?: RequestInit
  ): Promise<Response> => {
    const url = getRequestUrl(input);
    const method = getRequestMethod(input, init);
    const refreshKey = refreshRequestKey(input, init);

    if (refreshKey) {
      const now = Date.now();
      if (
        refreshLock &&
        refreshLock.key === refreshKey &&
        refreshLock.expiresAt > now
      ) {
        const shared = await refreshLock.promise;
        return shared.clone();
      }

      const entry = {
        key: refreshKey,
        promise: originalFetch(input, init),
        expiresAt: now + REFRESH_DEDUP_WINDOW_MS,
      };
      refreshLock = entry;
      window.setTimeout(() => {
        if (refreshLock === entry) refreshLock = null;
      }, REFRESH_DEDUP_WINDOW_MS);

      const response = await entry.promise;
      return response.clone();
    }

    const shouldGuard =
      method === "GET" &&
      url.includes(SUPABASE_HOST) &&
      url.includes("/rest/v1/");

    if (!shouldGuard) {
      return originalFetch(input, init);
    }

    let lastResponse: Response | null = null;

    for (let attempt = 0; attempt <= MAX_CLOCK_SKEW_RETRIES; attempt += 1) {
      const response = await originalFetch(input, init);
      lastResponse = response;

      const issuedAtFuture = await isIssuedAtFutureResponse(response);
      if (!issuedAtFuture) {
        return response;
      }

      if (attempt === MAX_CLOCK_SKEW_RETRIES) {
        break;
      }

      await sleep(1200 * (attempt + 1));
    }

    if (lastResponse) {
      return new Response(
        "Сессия синхронизируется. Нажмите «Повторить» через несколько секунд.",
        {
          status: 503,
          statusText: "Session syncing",
          headers: {
            "Content-Type": "text/plain; charset=utf-8",
          },
        }
      );
    }

    return originalFetch(input, init);
  };
}
