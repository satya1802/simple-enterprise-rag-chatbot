/**
 * Session bootstrap for the real SSO round trip.
 *
 * The backend owns the identity provider exchange (`/auth/login`,
 * `/auth/callback`) and mints a cookie session. This module's only job is to
 * ask `GET /me` whether that cookie is valid, expose the result as React
 * state, and give screens a single place to kick off `/auth/login`.
 */
import * as React from "react";
import { useNavigate } from "react-router-dom";

import {
  API_BASE_URL,
  ApiError,
  apiFetch,
  setUnauthorizedHandler,
  signOut as apiSignOut,
} from "@/lib/api";

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
  /**
   * Sign out of the current session (AC-002). Always clears the auth
   * context's user, regardless of whether the server call succeeds, and
   * navigates to the signed-out landing page with history replace so the
   * browser back button cannot return to authenticated content.
   */
  signOut: () => Promise<void>;
}

const AuthContext = React.createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = React.useState<AuthStatus>("loading");
  const [user, setUser] = React.useState<SessionUser | null>(null);
  const navigate = useNavigate();

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

  const handleUnauthorized = React.useCallback(() => {
    setUser(null);
    setStatus("unauthenticated");
    navigate("/sign-in", { replace: true });
  }, [navigate]);

  // Only hook into the shared 401 handler while a session is live (AC-069).
  // Public screens probe /me on mount too; a 401 there just means "not
  // signed in yet" and must not redirect a visitor away from an unguarded
  // page like Getting started.
  React.useEffect(() => {
    if (status !== "authenticated") return undefined;
    setUnauthorizedHandler(handleUnauthorized);
    return () => setUnauthorizedHandler(null);
  }, [status, handleUnauthorized]);

  const beginSignIn = React.useCallback(() => {
    window.location.href = `${API_BASE_URL}/auth/login`;
  }, []);

  const signOut = React.useCallback(async () => {
    await apiSignOut();
    setUser(null);
    setStatus("unauthenticated");
    navigate("/sign-in", { replace: true });
  }, [navigate]);

  const value = React.useMemo<AuthContextValue>(
    () => ({ status, user, refresh, beginSignIn, signOut }),
    [status, user, refresh, beginSignIn, signOut],
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
