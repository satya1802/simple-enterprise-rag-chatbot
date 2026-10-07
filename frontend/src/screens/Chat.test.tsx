import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AuthProvider } from "@/lib/auth";
import Chat from "@/screens/Chat";
import type { AnswerTerminal, Citation, StreamAnswerHandlers } from "@/lib/chat";

const streamAnswer =
  vi.fn<(params: { question: string; conversationId?: string | null }, handlers: StreamAnswerHandlers) => { stop: () => Promise<void> }>();

vi.mock("@/lib/chat", async () => {
  const actual = await vi.importActual<typeof import("@/lib/chat")>("@/lib/chat");
  return {
    ...actual,
    streamAnswer: (...args: Parameters<typeof actual.streamAnswer>) => streamAnswer(...args),
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

async function flush() {
  await act(async () => {
    await Promise.resolve();
  });
}

describe("Chat screen", () => {
  let lastHandlers: StreamAnswerHandlers | undefined;
  let stop: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(mockMe()));
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
});
