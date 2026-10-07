import * as React from "react";
import { NavLink, Navigate, Route, Routes } from "react-router-dom";

import SignIn from "@/screens/SignIn";
import Chat from "@/screens/Chat";
import Documents from "@/screens/Documents";
import GettingStarted from "@/screens/GettingStarted";
import ApiReference from "@/screens/ApiReference";
import { AuthProvider, useAuth } from "@/lib/auth";
import { Icons } from "@/lib/icons";

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

/**
 * Below `lg` the persistent sidebar becomes an off-canvas drawer reached via a
 * menu button in a small top bar, so the app shell reflows to a single usable
 * column at narrow widths (AC-070) without changing the auth guard or routes.
 */
function AppShell() {
  const [navOpen, setNavOpen] = React.useState(false);

  React.useEffect(() => {
    if (!navOpen) return undefined;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setNavOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [navOpen]);

  const links = (
    <nav className="flex flex-col gap-1" onClick={() => setNavOpen(false)}>
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
  );

  return (
    <div className="flex min-h-screen flex-col lg:flex-row">
      <header
        className="flex items-center justify-between border-b px-4 py-3 lg:hidden"
        style={{
          backgroundColor: "var(--brand-surface)",
          borderColor: "var(--brand-border)",
        }}
      >
        <p className="text-sm font-semibold" style={{ fontFamily: "var(--brand-font-heading)" }}>
          {"Simple enterprise RAG chatbot"}
        </p>
        <button
          type="button"
          onClick={() => setNavOpen(true)}
          aria-label="Open navigation menu"
          aria-haspopup="true"
          aria-expanded={navOpen}
          aria-controls="app-sidebar"
          className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--brand-radius)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-primary)]"
          style={{ color: "var(--brand-fg)" }}
        >
          <Icons.Menu size={20} aria-hidden="true" />
        </button>
      </header>

      {navOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/40 lg:hidden"
          aria-hidden="true"
          onClick={() => setNavOpen(false)}
        />
      )}

      <aside
        id="app-sidebar"
        className={[
          "fixed inset-y-0 left-0 z-50 w-64 max-w-[85vw] shrink-0 overflow-y-auto border-r p-4",
          "transition-transform duration-200 ease-out",
          "lg:static lg:z-auto lg:w-56 lg:max-w-none lg:translate-x-0",
          navOpen ? "translate-x-0 shadow-xl" : "-translate-x-full",
        ].join(" ")}
        style={{
          backgroundColor: "var(--brand-surface)",
          borderColor: "var(--brand-border)",
        }}
      >
        <div className="mb-4 flex items-center justify-between gap-2 px-3">
          <p
            className="text-sm font-semibold"
            style={{ fontFamily: "var(--brand-font-heading)" }}
          >
            {"Simple enterprise RAG chatbot"}
          </p>
          <button
            type="button"
            onClick={() => setNavOpen(false)}
            aria-label="Close navigation menu"
            className="rounded-[var(--brand-radius)] p-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-primary)] lg:hidden"
            style={{ color: "var(--brand-fg-muted)" }}
          >
            <Icons.X size={18} aria-hidden="true" />
          </button>
        </div>
        <AccountChrome />
        {links}
      </aside>
      <main className="min-w-0 flex-1 overflow-x-hidden overflow-y-auto">
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
