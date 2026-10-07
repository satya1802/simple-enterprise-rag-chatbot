import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

import App from "./App";

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

describe("App", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("renders without crashing and shows the first screen's nav link", async () => {
    mockMe({ status: 401 });
    render(
      <MemoryRouter>
        <App />
      </MemoryRouter>,
    );
    expect(screen.getByText("Sign in")).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole("alert")).toBeInTheDocument());
  });

  it("redirects /chat to sign-in when unauthenticated (AC-068)", async () => {
    mockMe({ status: 401 });
    render(
      <MemoryRouter initialEntries={["/chat"]}>
        <App />
      </MemoryRouter>,
    );
    await waitFor(() =>
      expect(
        screen.getByRole("heading", { name: /Sign in to the knowledge assistant/i }),
      ).toBeInTheDocument(),
    );
  });

  it("shows the authenticated display name in the persistent chrome after /me succeeds", async () => {
    mockMe({
      status: 200,
      body: { id: "u1", display_name: "Satya Ganaraju", is_admin: false },
    });
    render(
      <MemoryRouter initialEntries={["/sign-in"]}>
        <App />
      </MemoryRouter>,
    );
    await waitFor(() => expect(screen.getAllByText("Satya Ganaraju").length).toBeGreaterThan(0));
  });

  it("reveals a reachable menu button that opens and closes the off-canvas nav drawer (AC-070)", async () => {
    mockMe({ status: 401 });
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <App />
      </MemoryRouter>,
    );
    await waitFor(() => expect(screen.getByRole("alert")).toBeInTheDocument());

    const openButton = screen.getByRole("button", { name: /open navigation menu/i });
    expect(openButton).toBeVisible();
    expect(openButton).toHaveAttribute("aria-expanded", "false");

    await user.click(openButton);
    expect(openButton).toHaveAttribute("aria-expanded", "true");
    const closeButton = screen.getByRole("button", { name: /close navigation menu/i });
    expect(closeButton).toBeVisible();

    await user.click(closeButton);
    expect(openButton).toHaveAttribute("aria-expanded", "false");
  });

  it("closes the drawer on Escape", async () => {
    mockMe({ status: 401 });
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <App />
      </MemoryRouter>,
    );
    await waitFor(() => expect(screen.getByRole("alert")).toBeInTheDocument());

    const openButton = screen.getByRole("button", { name: /open navigation menu/i });
    await user.click(openButton);
    expect(openButton).toHaveAttribute("aria-expanded", "true");

    await user.keyboard("{Escape}");
    expect(openButton).toHaveAttribute("aria-expanded", "false");
  });
});
