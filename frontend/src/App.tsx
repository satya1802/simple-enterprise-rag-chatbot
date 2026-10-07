import * as React from "react";
import { NavLink, Navigate, Route, Routes } from "react-router-dom";

import SignIn from "@/screens/SignIn";
import Chat from "@/screens/Chat";
import Documents from "@/screens/Documents";
import GettingStarted from "@/screens/GettingStarted";
import ApiReference from "@/screens/ApiReference";
import { AuthProvider, useAuth } from "@/lib/auth";

const navLinkClass = ({ isActive }: { isActive: boolean }) =>
  [
    "block rounded-[var(--brand-radius)] px-3 py-2 text-sm font-medium transition-colors",
    isActive ? "bg-[var(--brand-hover)] text-[var(--brand-fg)]" : "text-[var(--brand-fg-muted)]",
  ].join(" ");

/** Guards /chat, /documents and any future upload route behind a live session. */
function RequireAuth({ children }: { children: React.ReactElement }) {
  const { status } = useAuth();
  if (status === "loading") {
    return (
      <div className="p-6 text-sm" style={{ color: "var(--brand-fg-muted)" }}>
        Checking your session…
      </div>
    );
  }
  if (status !== "authenticated") {
    return <Navigate to="/sign-in" replace />;
  }
  return children;
}

function AccountChrome() {
  const { status, user } = useAuth();
  if (status !== "authenticated" || !user) return null;
  return (
    <p className="mb-4 px-3 text-xs" style={{ color: "var(--brand-fg-muted)" }}>
      {"Signed in as "}
      <span className="font-medium" style={{ color: "var(--brand-fg)" }}>
        {user.display_name}
      </span>
    </p>
  );
}

function AppShell() {
  return (
    <div className="flex min-h-screen">
      <aside
        className="w-56 shrink-0 border-r p-4"
        style={{
          backgroundColor: "var(--brand-surface)",
          borderColor: "var(--brand-border)",
        }}
      >
        <p
          className="mb-4 px-3 text-sm font-semibold"
          style={{ fontFamily: "var(--brand-font-heading)" }}
        >
          {"Simple enterprise RAG chatbot"}
        </p>
        <AccountChrome />
        <nav className="flex flex-col gap-1">
          <NavLink to="/sign-in" className={navLinkClass}>
            {"Sign in"}
          </NavLink>
          <NavLink to="/chat" className={navLinkClass}>
            {"Chat"}
          </NavLink>
          <NavLink to="/documents" className={navLinkClass}>
            {"Knowledge base"}
          </NavLink>
          <NavLink to="/getting-started" className={navLinkClass}>
            {"Getting started"}
          </NavLink>
          <NavLink to="/api-reference" className={navLinkClass}>
            {"API reference"}
          </NavLink>
        </nav>
      </aside>
      <main className="flex-1 overflow-auto">
        <Routes>
          <Route path="/sign-in" element={<SignIn />} />
          <Route
            path="/chat"
            element={
              <RequireAuth>
                <Chat />
              </RequireAuth>
            }
          />
          <Route
            path="/documents"
            element={
              <RequireAuth>
                <Documents />
              </RequireAuth>
            }
          />
          <Route path="/getting-started" element={<GettingStarted />} />
          <Route path="/api-reference" element={<ApiReference />} />
          <Route path="*" element={<Navigate to="/sign-in" replace />} />
        </Routes>
      </main>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppShell />
    </AuthProvider>
  );
}
