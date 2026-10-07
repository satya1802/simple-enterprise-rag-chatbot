/**
 * Session bootstrap for the real SSO round trip.
 *
 * The backend owns the identity provider exchange (`/auth/login`,
 * `/auth/callback`) and mints a cookie session. This module's only job is to
 * ask `GET /me` whether that cookie is valid, expose the result as React
 * state, and give screens a single place to kick off `/auth/login`.
 */
import * as React from "react";

import { API_BASE_URL, ApiError, apiFetch } from "@/lib/api";

export interface SessionUser {
  id: string;
  display_name: string;
  is_admin: boolean;
}

export type AuthStatus = "loading" | "authenticated" | "unauthenticated" | "error";

export interface AuthContextValue {
  status: AuthStatus;
  user: SessionUser | null;
  /** Re-run GET /me, e.g. after returning from the IdP callback. */
  refresh: () => Promise<void>;
  /** Start the real SSO round trip: a full navigation to the backend. */
  beginSignIn: () => void;
}

const AuthContext = React.createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = React.useState<AuthStatus>("loading");
  const [user, setUser] = React.useState<SessionUser | null>(null);

  const refresh = React.useCallback(async () => {
    setStatus("loading");
    try {
      const me = await apiFetch<SessionUser>("/me");
      setUser(me);
      setStatus("authenticated");
    } catch (err) {
      setUser(null);
      if (err instanceof ApiError && err.status === 401) {
        setStatus("unauthenticated");
      } else {
        setStatus("error");
      }
    }
  }, []);

  React.useEffect(() => {
    void refresh();
  }, [refresh]);

  const beginSignIn = React.useCallback(() => {
    window.location.href = `${API_BASE_URL}/auth/login`;
  }, []);

  const value = React.useMemo<AuthContextValue>(
    () => ({ status, user, refresh, beginSignIn }),
    [status, user, refresh, beginSignIn],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = React.useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return ctx;
}
