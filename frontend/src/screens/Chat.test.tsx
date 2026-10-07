import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AuthProvider } from "@/lib/auth";
import Chat from "@/screens/Chat";
import type { AnswerTerminal, Citation, StreamAnswerHandlers } from "@/lib/chat";
import type { ConversationDetail, ConversationSummary } from "@/lib/conversations";

const streamAnswer =
  vi.fn<
    (
      params: { question: string; conversationId?: string | null },
      handlers: StreamAnswerHandlers,
    ) => { stop: () => Promise<void> }
  >();

vi.mock("@/lib/chat", async () => {
  const actual = await vi.importActual<typeof import("@/lib/chat")>("@/lib/chat");
  return {
    ...actual,
    streamAnswer: (...args: Parameters<typeof actual.streamAnswer>) => streamAnswer(...args),
  };
});

function meResponse() {
  return {
    ok: true,
    status: 200,
    json: async () => ({ id: "u1", display_name: "Satya Ganaraju", is_admin: false }),
  };
}

function jsonResponse(status: number, body: unknown) {
  return { ok: status >= 200 && status < 300, status, json: async () => body };
}

function pathOf(url: string): string {
  return url.replace(/^https?:\/\/[^/]+/, "");
}

function renderScreen() {
  return render(
    <MemoryRouter>
      <AuthProvider>
        <Chat />
      </AuthProvider>
    </MemoryRouter>,
  );
}

function citation(overrides: Partial<Citation> = {}): Citation {
  return {
    document_id: "doc-1",
    source_type: "document",
    source_id: "policy.pdf",
    source_url: "http://localhost:8000/documents/doc-1/file",
    chunk_index: 1,
    snippet: "Relevant passage.",
    ...overrides,
  };
}

function terminal(overrides: Partial<AnswerTerminal> = {}): AnswerTerminal {
  return {
    stream_id: "s1",
    citations: [citation()],
    not_covered: false,
    partial: false,
    token_usage: { prompt_tokens: 10, completion_tokens: 5 },
    ...overrides,
  };
}

function summary(overrides: Partial<ConversationSummary> = {}): ConversationSummary {
  return {
    id: "conv-1",
    title: "Expense policy",
    created_at: "2026-10-01T09:00:00Z",
    updated_at: "2026-10-01T09:05:00Z",
    message_count: 2,
    ...overrides,
  };
}

function detail(overrides: Partial<ConversationDetail> = {}): ConversationDetail {
  return {
    id: "conv-1",
    title: "Expense policy",
    created_at: "2026-10-01T09:00:00Z",
    updated_at: "2026-10-01T09:05:00Z",
    messages: [
      { role: "user", content: "What is the expense policy?", citations: [] },
      {
        role: "assistant",
        content: "Expenses are reimbursed within 30 days.",
        citations: [citation()],
      },
    ],
    ...overrides,
  };
}

async function flush() {
  await act(async () => {
    await Promise.resolve();
  });
}

describe("Chat screen", () => {
  let lastHandlers: StreamAnswerHandlers | undefined;
  let stop: ReturnType<typeof vi.fn>;
  let conversationsListMock: ConversationSummary[];
  let conversationDetailMock: ConversationDetail | null;
  let deleteShouldFail: boolean;
  let conversationDetailStatus: number;

  function routeFetch(url: string, init?: RequestInit) {
    const path = pathOf(url);
    const method = (init?.method ?? "GET").toUpperCase();
    if (path === "/me") return Promise.resolve(meResponse());
    if (path === "/conversations" && method === "GET") {
      return Promise.resolve(jsonResponse(200, conversationsListMock));
    }
    if (path.startsWith("/conversations/") && method === "GET") {
      if (conversationDetailMock === null) {
        return Promise.resolve(jsonResponse(conversationDetailStatus || 404, {}));
      }
      return Promise.resolve(jsonResponse(200, conversationDetailMock));
    }
    if (path.startsWith("/conversations/") && method === "DELETE") {
      if (deleteShouldFail) return Promise.resolve(jsonResponse(500, {}));
      return Promise.resolve(jsonResponse(204, undefined));
    }
    return Promise.resolve(jsonResponse(200, {}));
  }

  beforeEach(() => {
    conversationsListMock = [];
    conversationDetailMock = null;
    conversationDetailStatus = 404;
    deleteShouldFail = false;
    vi.stubGlobal("fetch", vi.fn(routeFetch));
    stop = vi.fn().mockResolvedValue(undefined);
    streamAnswer.mockReset();
    streamAnswer.mockImplementation((_params, handlers) => {
      lastHandlers = handlers;
      return { stop };
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    lastHandlers = undefined;
  });

  it("shows the empty state with no filter or scope control (AC-107)", async () => {
    renderScreen();
    await screen.findByText(/Welcome — ask our knowledge base anything/i);
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
    expect(screen.queryByText(/source type/i)).not.toBeInTheDocument();
  });

  it("calls POST /answer via streamAnswer and renders tokens as they arrive, not only on completion (AC-011, AC-092)", async () => {
    renderScreen();
    const user = userEvent.setup();
    const box = await screen.findByLabelText("Ask a question");
    await user.type(box, "What is the expense policy?");
    await user.click(screen.getByRole("button", { name: "Ask" }));

    expect(streamAnswer).toHaveBeenCalledWith(
      expect.objectContaining({ question: "What is the expense policy?" }),
      expect.any(Object),
    );
    expect(box).toBeDisabled();
    expect(screen.getByRole("button", { name: /Stop generating/i })).toBeInTheDocument();

    await act(async () => {
      lastHandlers?.onToken("Expenses ");
    });
    expect(screen.getByText(/Expenses/)).toBeInTheDocument();

    await act(async () => {
      lastHandlers?.onToken("are reimbursed within 30 days.");
    });
    expect(screen.getByText(/Expenses are reimbursed within 30 days\./)).toBeInTheDocument();
  });

  it("renders a citation per distinct source, collapsing duplicates, each clickable (AC-012, AC-096, AC-097)", async () => {
    renderScreen();
    const user = userEvent.setup();
    const box = await screen.findByLabelText("Ask a question");
    await user.type(box, "What is the policy?");
    await user.click(screen.getByRole("button", { name: "Ask" }));

    await act(async () => {
      lastHandlers?.onToken("Answer text.");
    });
    await act(async () => {
      lastHandlers?.onDone(
        terminal({
          citations: [
            citation({ document_id: "doc-1", source_id: "policy.pdf" }),
            citation({ document_id: "doc-1", source_id: "policy.pdf" }),
            citation({
              document_id: "doc-2",
              source_type: "confluence",
              source_id: "space/Policy",
              source_url: "https://wiki.example.com/Policy",
            }),
          ],
        }),
      );
    });

    // One entry in the citation list; the first citation is also shown
    // auto-opened in the source panel heading, hence two occurrences.
    expect(screen.getAllByText("policy.pdf")).toHaveLength(2);
    expect(screen.getAllByText("space/Policy")).toHaveLength(1);

    await user.click(screen.getByText("space/Policy"));
    expect(screen.getAllByText("confluence").length).toBeGreaterThan(0);
    expect(screen.getByRole("link", { name: /Open original source/i })).toHaveAttribute(
      "href",
      "https://wiki.example.com/Policy",
    );
  });

  it("renders the not-covered message with no citations and a link to Documents (AC-013/099/100/102)", async () => {
    renderScreen();
    const user = userEvent.setup();
    const box = await screen.findByLabelText("Ask a question");
    await user.type(box, "What is the 2099 target?");
    await user.click(screen.getByRole("button", { name: "Ask" }));

    await act(async () => {
      lastHandlers?.onToken("This question is not covered by the knowledge base.");
    });
    await act(async () => {
      lastHandlers?.onDone(terminal({ citations: [], not_covered: true }));
    });

    expect(screen.getByText("Not covered")).toBeInTheDocument();
    expect(screen.queryByText("Sources")).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /add a document to the knowledge base/i }),
    ).toBeInTheDocument();
  });

  it("renders a partial answer with citations plus the uncovered-part statement (AC-101)", async () => {
    renderScreen();
    const user = userEvent.setup();
    const box = await screen.findByLabelText("Ask a question");
    await user.type(box, "Two part question?");
    await user.click(screen.getByRole("button", { name: "Ask" }));

    await act(async () => {
      lastHandlers?.onToken("Part one is answered. Part two is not covered.");
    });
    await act(async () => {
      lastHandlers?.onDone(terminal({ partial: true }));
    });

    expect(screen.getByText("Partly covered")).toBeInTheDocument();
    expect(screen.getByText("Sources")).toBeInTheDocument();
  });

  it("shows a clear error and does not present the partial text as complete (AC-093)", async () => {
    renderScreen();
    const user = userEvent.setup();
    const box = await screen.findByLabelText("Ask a question");
    await user.type(box, "A question that fails");
    await user.click(screen.getByRole("button", { name: "Ask" }));

    await act(async () => {
      lastHandlers?.onToken("Partial thought");
    });
    await act(async () => {
      lastHandlers?.onError("The answer stream failed. Please try again.");
    });

    expect(screen.getByRole("alert")).toHaveTextContent(/failed/i);
    expect(screen.queryByText("Partial thought")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Retry this question/i })).toBeInTheDocument();
    expect(box).not.toBeDisabled();
  });

  it("Stop calls POST /answer/stop and finalises the partial answer (AC-092)", async () => {
    renderScreen();
    const user = userEvent.setup();
    const box = await screen.findByLabelText("Ask a question");
    await user.type(box, "A long question");
    await user.click(screen.getByRole("button", { name: "Ask" }));

    await act(async () => {
      lastHandlers?.onToken("Partial answer so far.");
    });

    await user.click(screen.getByRole("button", { name: /Stop generating/i }));
    await flush();

    expect(stop).toHaveBeenCalledTimes(1);
    expect(screen.getByText("Stopped")).toBeInTheDocument();
    expect(screen.getByText(/Partial answer so far\./)).toBeInTheDocument();
    expect(box).not.toBeDisabled();
  });

  // ---------------- History: list (AC-017) ----------------

  it("loads history from GET /conversations and renders title and date, most recent first", async () => {
    conversationsListMock = [
      summary({ id: "conv-1", title: "Expense policy" }),
      summary({ id: "conv-2", title: "Leave policy", created_at: "2026-09-30T09:00:00Z" }),
    ];
    renderScreen();

    await screen.findByText("Expense policy");
    expect(screen.getByText("Leave policy")).toBeInTheDocument();
    const items = screen.getAllByRole("listitem");
    const firstIndex = items.findIndex((li) => li.textContent?.includes("Expense policy"));
    const secondIndex = items.findIndex((li) => li.textContent?.includes("Leave policy"));
    expect(firstIndex).toBeLessThan(secondIndex);
  });

  it("shows a loading state while history loads, then renders the empty state", async () => {
    let resolveList: (value: unknown) => void = () => {};
    const pending = new Promise((resolve) => {
      resolveList = resolve;
    });
    vi.stubGlobal(
      "fetch",
      vi.fn((url: string, init?: RequestInit) => {
        const path = pathOf(url);
        const method = (init?.method ?? "GET").toUpperCase();
        if (path === "/me") return Promise.resolve(meResponse());
        if (path === "/conversations" && method === "GET") return pending;
        return Promise.resolve(jsonResponse(200, {}));
      }),
    );

    renderScreen();
    expect(await screen.findByText(/Loading your conversations/i)).toBeInTheDocument();

    await act(async () => {
      resolveList(jsonResponse(200, []));
    });

    expect(await screen.findByText(/No saved conversations/i)).toBeInTheDocument();
  });

  it("shows an error state when the history list fails to load, with a retry", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn((url: string, init?: RequestInit) => {
        const path = pathOf(url);
        const method = (init?.method ?? "GET").toUpperCase();
        if (path === "/me") return Promise.resolve(meResponse());
        if (path === "/conversations" && method === "GET")
          return Promise.resolve(jsonResponse(500, {}));
        return Promise.resolve(jsonResponse(200, {}));
      }),
    );

    renderScreen();
    expect(await screen.findByText(/could not be loaded/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Try again/i })).toBeInTheDocument();
  });

  // ---------------- History: reopen with citations (AC-114) ----------------

  it("reopens a conversation via GET /conversations/{id} and renders ordered turns with clickable citations", async () => {
    conversationsListMock = [summary()];
    conversationDetailMock = detail();
    renderScreen();

    const user = userEvent.setup();
    await user.click(await screen.findByText("Expense policy"));

    await screen.findByText("What is the expense policy?");
    expect(screen.getByText("Expenses are reimbursed within 30 days.")).toBeInTheDocument();

    await user.click(screen.getByText("policy.pdf"));
    expect(screen.getByRole("link", { name: /Open original source/i })).toBeInTheDocument();
  });

  it("asking inside a reopened conversation posts the real conversation_id, not null (AC-115)", async () => {
    conversationsListMock = [summary()];
    conversationDetailMock = detail();
    renderScreen();

    const user = userEvent.setup();
    await user.click(await screen.findByText("Expense policy"));
    await screen.findByText("What is the expense policy?");

    const box = screen.getByLabelText("Ask a question");
    await user.type(box, "A follow-up question");
    await user.click(screen.getByRole("button", { name: "Ask" }));

    expect(streamAnswer).toHaveBeenCalledWith(
      expect.objectContaining({ conversationId: "conv-1" }),
      expect.any(Object),
    );
  });

  // ---------------- History: not found / search scoping (AC-116) ----------------

  it("shows a 'conversation not found' state and no content on a 404 from GET /conversations/{id}", async () => {
    conversationsListMock = [summary()];
    conversationDetailMock = null;
    conversationDetailStatus = 404;
    renderScreen();

    const user = userEvent.setup();
    await user.click(await screen.findByText("Expense policy"));

    expect(await screen.findByText(/could not be found/i)).toBeInTheDocument();
    expect(screen.queryByText("What is the expense policy?")).not.toBeInTheDocument();
  });

  it("filters only the fetched history list, never requesting another search endpoint", async () => {
    conversationsListMock = [
      summary({ id: "conv-1", title: "Expense policy" }),
      summary({ id: "conv-2", title: "Leave policy", created_at: "2026-09-30T09:00:00Z" }),
    ];
    renderScreen();
    await screen.findByText("Expense policy");

    const user = userEvent.setup();
    await user.type(screen.getByLabelText("Search your history"), "expense");

    expect(screen.getByText("Expense policy")).toBeInTheDocument();
    expect(screen.queryByText("Leave policy")).not.toBeInTheDocument();
  });

  // ---------------- History: delete (AC-117) ----------------

  it("deletes a conversation via DELETE /conversations/{id} and removes it, clearing the open transcript", async () => {
    conversationsListMock = [summary()];
    conversationDetailMock = detail();
    renderScreen();

    const user = userEvent.setup();
    await user.click(await screen.findByText("Expense policy"));
    await screen.findByText("What is the expense policy?");

    await user.click(screen.getByRole("button", { name: /Delete conversation: Expense policy/i }));
    await user.click(screen.getByRole("button", { name: "Delete conversation" }));
    await flush();

    await waitFor(() => expect(screen.queryByText("Expense policy")).not.toBeInTheDocument());
    expect(screen.queryByText("What is the expense policy?")).not.toBeInTheDocument();
  });

  it("surfaces an error and keeps the conversation when the delete request fails", async () => {
    conversationsListMock = [summary()];
    deleteShouldFail = true;
    renderScreen();

    const user = userEvent.setup();
    await screen.findByText("Expense policy");
    await user.click(screen.getByRole("button", { name: /Delete conversation: Expense policy/i }));
    await user.click(screen.getByRole("button", { name: "Delete conversation" }));
    await flush();

    expect(await screen.findByRole("alert")).toHaveTextContent(/could not be deleted/i);
    expect(screen.getByText("Expense policy")).toBeInTheDocument();
  });
});
