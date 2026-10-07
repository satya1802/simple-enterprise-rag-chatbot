import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AuthProvider } from "@/lib/auth";
import Documents from "@/screens/Documents";
import type { DocumentListResponse, ListDocumentsParams } from "@/lib/documents";

const listDocuments = vi.fn<(params?: ListDocumentsParams) => Promise<DocumentListResponse>>();
const deleteDocument = vi.fn().mockResolvedValue(undefined);
const uploadDocuments = vi.fn();

vi.mock("@/lib/documents", async () => {
  const actual = await vi.importActual<typeof import("@/lib/documents")>("@/lib/documents");
  return {
    ...actual,
    listDocuments: (...args: Parameters<typeof actual.listDocuments>) => listDocuments(...args),
    deleteDocument: (...args: Parameters<typeof actual.deleteDocument>) => deleteDocument(...args),
    uploadDocuments: (...args: Parameters<typeof actual.uploadDocuments>) =>
      uploadDocuments(...args),
    documentFileUrl: (id: string) => `http://localhost:8000/documents/${id}/file`,
  };
});

function mockMe() {
  return {
    ok: true,
    status: 200,
    json: async () => ({ id: "u1", display_name: "Satya Ganaraju", is_admin: false }),
  };
}

function renderScreen() {
  return render(
    <MemoryRouter>
      <AuthProvider>
        <Documents />
      </AuthProvider>
    </MemoryRouter>,
  );
}

function doc(overrides: Partial<DocumentListResponse["items"][number]> = {}) {
  return {
    id: "d1",
    filename: "policy.pdf",
    format: "pdf",
    uploader: "Alex",
    uploaded_at: "2026-10-01T10:00:00Z",
    status: "Processing",
    status_reason: null,
    ...overrides,
  };
}

describe("Documents screen", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(mockMe()));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
    listDocuments.mockReset();
    deleteDocument.mockClear();
    uploadDocuments.mockReset();
  });

  it("shows exactly one current status per row (AC-007)", async () => {
    listDocuments.mockResolvedValue({
      items: [
        doc({ id: "a", filename: "a.pdf", status: "Ready" }),
        doc({ id: "b", filename: "b.pdf", status: "Failed", status_reason: "Could not parse." }),
      ],
      total: 2,
    });
    renderScreen();

    const row = await screen.findByText("a.pdf");
    const tr = row.closest("tr") as HTMLElement;
    expect(within(tr).getAllByText("Ready")).toHaveLength(1);
  });

  async function flush() {
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
  }

  it("polls while a document is Processing and flips to Ready without reload (AC-081)", async () => {
    vi.useFakeTimers();
    listDocuments
      .mockResolvedValueOnce({
        items: [doc({ status: "Processing" })],
        total: 1,
      })
      .mockResolvedValueOnce({
        items: [doc({ status: "Ready" })],
        total: 1,
      });

    renderScreen();
    await flush();

    expect(listDocuments).toHaveBeenCalledTimes(1);
    const rowBefore = screen.getByText("policy.pdf").closest("tr") as HTMLElement;
    expect(within(rowBefore).getByText("Processing")).toBeInTheDocument();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000);
    });

    expect(listDocuments).toHaveBeenCalledTimes(2);
    const rowAfter = screen.getByText("policy.pdf").closest("tr") as HTMLElement;
    expect(within(rowAfter).getByText("Ready")).toBeInTheDocument();

    const live = document.querySelector('[aria-live="polite"]');
    expect(live?.textContent).toMatch(/policy\.pdf is now Ready\./);
  });

  it("stops polling once nothing is Processing", async () => {
    vi.useFakeTimers();
    listDocuments
      .mockResolvedValueOnce({ items: [doc({ status: "Processing" })], total: 1 })
      .mockResolvedValueOnce({ items: [doc({ status: "Ready" })], total: 1 });

    renderScreen();
    await flush();
    expect(listDocuments).toHaveBeenCalledTimes(1);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000);
    });
    expect(listDocuments).toHaveBeenCalledTimes(2);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(20000);
    });
    expect(listDocuments).toHaveBeenCalledTimes(2);
  });

  it("never stacks overlapping poll requests", async () => {
    vi.useFakeTimers();
    let resolveSecond: (v: DocumentListResponse) => void = () => {};
    listDocuments
      .mockResolvedValueOnce({ items: [doc({ status: "Processing" })], total: 1 })
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveSecond = resolve;
          }),
      );

    renderScreen();
    await flush();
    expect(listDocuments).toHaveBeenCalledTimes(1);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000);
    });
    expect(listDocuments).toHaveBeenCalledTimes(2);

    // A second in-flight request must not overlap: advancing time again
    // while the first poll is still pending should not add a third call.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(20000);
    });
    expect(listDocuments).toHaveBeenCalledTimes(2);

    await act(async () => {
      resolveSecond({ items: [doc({ status: "Processing" })], total: 1 });
      await Promise.resolve();
    });
  });

  it("shows guidance and delete for Failed rows, and the row disappears after delete (AC-082)", async () => {
    listDocuments
      .mockResolvedValueOnce({
        items: [
          doc({
            id: "f1",
            filename: "broken.pdf",
            status: "Failed",
            status_reason: "Parse error.",
          }),
        ],
        total: 1,
      })
      .mockResolvedValueOnce({ items: [], total: 0 });

    renderScreen();
    await screen.findByText("broken.pdf");
    expect(screen.getByText("Parse error.")).toBeInTheDocument();
    expect(
      screen.getByText(/Delete this document, then upload a different file to try again\./i),
    ).toBeInTheDocument();

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /Delete broken\.pdf/i }));
    await user.click(screen.getByRole("button", { name: /Delete for all employees/i }));

    await waitFor(() => expect(deleteDocument).toHaveBeenCalledWith("f1"));
    await waitFor(() => expect(screen.queryByText("broken.pdf")).not.toBeInTheDocument());

    // Upload control still reachable to retry.
    expect(screen.getByLabelText(/Choose files to upload/i)).toBeInTheDocument();
  });

  it("shows guidance for No readable text rows", async () => {
    listDocuments.mockResolvedValue({
      items: [
        doc({
          id: "n1",
          filename: "scan.pdf",
          status: "No readable text",
          status_reason: "No extractable text found.",
        }),
      ],
      total: 1,
    });
    renderScreen();
    await screen.findByText("scan.pdf");
    expect(
      screen.getByText(/Delete this document, then upload a different file to try again\./i),
    ).toBeInTheDocument();
  });
});
