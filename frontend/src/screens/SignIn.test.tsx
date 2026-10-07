import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AuthProvider } from "@/lib/auth";
import { API_BASE_URL } from "@/lib/api";
import SignIn from "@/screens/SignIn";

function renderSignIn() {
  return render(
    <MemoryRouter>
      <AuthProvider>
        <SignIn />
      </AuthProvider>
    </MemoryRouter>,
  );
}

function mockMe(result: { status: number; body?: unknown }) {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok: result.status < 300,
      status: result.status,
      json: async () => result.body ?? {},
    }),
  );
}

describe("SignIn", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("shows a loading state while GET /me is in flight", () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => new Promise(() => {})),
    );
    renderSignIn();
    expect(screen.getByText(/Checking your session/i)).toBeInTheDocument();
  });

  it("renders the sign-in failed message on a 401 from /me (AC-067)", async () => {
    mockMe({ status: 401 });
    renderSignIn();
    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent("Sign-in failed — contact IT"),
    );
  });

  it("renders the sign-in failed message on an unexpected /me error", async () => {
    mockMe({ status: 500 });
    renderSignIn();
    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent("Sign-in failed — contact IT"),
    );
  });

  it("renders the authenticated display name on success (AC-001, AC-066)", async () => {
    mockMe({
      status: 200,
      body: { id: "u1", display_name: "Satya Ganaraju", is_admin: false },
    });
    renderSignIn();
    await waitFor(() => expect(screen.getByText("Satya Ganaraju")).toBeInTheDocument());
    expect(screen.getByText("Session established")).toBeInTheDocument();
  });

  it("redirects to the backend /auth/login endpoint instead of opening a mock dialog (AC-001)", async () => {
    mockMe({ status: 401 });
    const originalLocation = window.location;
    // jsdom's window.location.href setter does not throw, but assigning the
    // whole object lets the assertion read back exactly what was set.
    delete (window as unknown as { location?: unknown }).location;
    (window as unknown as { location: Location }).location = { href: "" } as Location;

    renderSignIn();
    await waitFor(() => expect(screen.getByRole("alert")).toBeInTheDocument());

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /Continue with corporate SSO/i }));

    expect(window.location.href).toBe(`${API_BASE_URL}/auth/login`);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    (window as unknown as { location: Location }).location = originalLocation;
  });
});
