export const REQUEST_TIMEOUT_MS = 20_000;
/** Sign-in and token requests are tiny, and everything else waits behind them. */
export const AUTH_TIMEOUT_MS = 8_000;

/** Shorter limit for auth calls, the normal limit for data calls. */
export function timeoutFor(input: RequestInfo | URL): number {
  const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
  return url.includes("/auth/v1/") ? AUTH_TIMEOUT_MS : REQUEST_TIMEOUT_MS;
}

type FetchFn = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

/**
 * A fetch that gives up after `ms`.
 *
 * On a network that is "connected" but has no internet, a request can hang for
 * minutes. Sync waits for each request, so one hung request would delay the
 * upload of your offline entries long after the connection is really back.
 * Timing out makes a hung request fail like any other network error, and the
 * next retry starts fresh.
 */
export function createTimeoutFetch(
  ms: number | ((input: RequestInfo | URL) => number) = REQUEST_TIMEOUT_MS,
  base: FetchFn = (input, init) => fetch(input, init),
): FetchFn {
  return (input, init) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), typeof ms === "function" ? ms(input) : ms);

    // Keep honouring an abort signal the caller passed in.
    const outer = init?.signal;
    if (outer) {
      if (outer.aborted) controller.abort();
      else outer.addEventListener("abort", () => controller.abort(), { once: true });
    }

    return base(input, { ...init, signal: controller.signal }).finally(() => clearTimeout(timer));
  };
}
