const SUPABASE_HOST = "yiwiykbuaggyslfyhlfo.supabase.co";
const MAX_CLOCK_SKEW_RETRIES = 3;

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

      // Supabase Auth and PostgREST can occasionally differ by a fraction
      // of a second immediately after a token is issued. Waiting briefly and
      // retrying the same read request prevents parents from seeing a false
      // authentication error.
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
