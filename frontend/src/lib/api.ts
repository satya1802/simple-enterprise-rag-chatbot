/// <reference types="vite/client" />
// Without the reference above, `import.meta.env` is not typed and `tsc --noEmit` fails --
// which `vite build` does not catch, because it tree-shakes this module out when no screen
// imports it yet.
//
// Where the generated API lives.
//
// Set at build time: the platform bakes the deployed API URL into the frontend build. The
// fallback is the local backend so a bare `npm run dev` still points somewhere real.
//
// The generated screens do NOT use this yet -- they render seeded sample data, exactly as
// they were approved. This is the seam to replace that with real calls, one screen at a
// time.
export const API_BASE_URL: string = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000";

/**
 * Thrown by `apiFetch` on any non-2xx response. Carries the HTTP status so
 * callers can distinguish "unauthenticated" (401) from every other failure
 * without parsing message strings.
 */
export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

/**
 * Shared 401 hook (AC-069). `AuthProvider` registers a handler here while the
 * session is authenticated, so any screen's API call that comes back 401
 * (session expired server-side) can flip the auth context to
 * "unauthenticated" and redirect to sign-in -- regardless of which screen
 * made the call.
 */
type UnauthorizedHandler = () => void;
let unauthorizedHandler: UnauthorizedHandler | null = null;

export function setUnauthorizedHandler(handler: UnauthorizedHandler | null): void {
  unauthorizedHandler = handler;
}

/**
 * Lets callers that cannot use `apiFetch` (e.g. SSE streaming, which needs
 * its own `fetch` call to read the response body incrementally) still
 * route a 401 through the same shared handler (AC-069).
 */
export function reportUnauthorized(status: number): void {
  if (status === 401) {
    unauthorizedHandler?.();
  }
}

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    // Session auth is a cookie set by the backend's /auth/callback. Without
    // this, cross-origin requests in dev (and anywhere the API is on a
    // different origin from the SPA) never send it.
    credentials: "include",
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  if (!response.ok) {
    if (response.status === 401) {
      unauthorizedHandler?.();
    }
    throw new ApiError(
      response.status,
      `${init?.method ?? "GET"} ${path} failed: ${response.status}`,
    );
  }
  return response.status === 204 ? (undefined as T) : ((await response.json()) as T);
}

/**
 * POST /auth/logout. Sign-out must never leave content on screen, so a
 * network failure or a non-204 response here is swallowed -- the caller
 * (`AuthProvider.signOut`) always proceeds to clear client state and
 * navigate to the signed-out page regardless of this outcome.
 */
export async function signOut(): Promise<void> {
  try {
    await apiFetch<void>("/auth/logout", { method: "POST" });
  } catch {
    // intentionally ignored -- see doc comment above
  }
}
