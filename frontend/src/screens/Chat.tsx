import React from "react";

import * as UI from "@/lib/ui";
import { Icons } from "@/lib/icons";
import { brand } from "@/lib/brand";
import { useNavigate } from "@/lib/navigate";
import { useAuth } from "@/lib/auth";
import { ApiError } from "@/lib/api";
import { dedupeCitations, streamAnswer } from "@/lib/chat";
import type { AnswerTerminal, Citation, StreamAnswerHandle, TokenUsage } from "@/lib/chat";
import {
  deleteConversation as deleteConversationApi,
  getConversation,
  listConversations,
} from "@/lib/conversations";
import type { ConversationSummary } from "@/lib/conversations";

void UI;

const SUGGESTIONS = [
  "What's the deadline for submitting an expense claim?",
  "When is the Q4 release freeze and who approves exceptions?",
  "How much notice do I give for parental leave?",
  "What triggers a severity 1 incident?",
];

type UserMessage = {
  id: string;
  role: "user";
  content: string;
  created_at: string;
};

type AssistantMessage = {
  id: string;
  role: "assistant";
  content: string;
  created_at: string;
  citations: Citation[];
  not_covered: boolean;
  partial: boolean;
  stopped: boolean;
  token_usage: TokenUsage | null;
  feedback?: "up" | "down" | null;
};

type ErrorMessage = {
  id: string;
  role: "error";
  content: string;
  created_at: string;
  question: string;
};

type Message = UserMessage | AssistantMessage | ErrorMessage;

type ActiveConversation = {
  id: string | null;
  title: string;
  created_at: string;
  messages: Message[];
};

type StreamState = {
  id: string;
  convId: string | null;
  created_at: string;
  question: string;
  text: string;
};

type HistoryStatus = "loading" | "loaded" | "error";
type ActiveStatus = "idle" | "loading" | "loaded" | "not-found" | "error";

const BORDER = "#D8DEDA";
const INK = "#16211D";
const BODY_INK = "#33403B";

const RING =
  "focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[#1C5D4A] focus-visible:ring-offset-[#F1F3F1]";

const BTN =
  "inline-flex items-center justify-center gap-2 rounded-[0.5rem] text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 " +
  RING;

function titleFrom(question: string): string {
  const clean = question
    .replace(/\s+/g, " ")
    .trim()
    .replace(/[?.!]+$/, "");
  return clean.length > 52 ? clean.slice(0, 52).trim() + "…" : clean;
}

function fmtTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}

function fmtDay(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const same = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();
  const yest = new Date(now.getTime() - 86400000);
  if (same(d, now)) return "Today";
  if (same(d, yest)) return "Yesterday";
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

export default function Screen() {
  const navigate = useNavigate();
  const { signOut } = useAuth();

  // History panel (AC-017): the fetched list is the only source of truth --
  // nothing seeded, nothing synthesised client-side.
  const [historyList, setHistoryList] = React.useState<ConversationSummary[]>([]);
  const [historyStatus, setHistoryStatus] = React.useState<HistoryStatus>("loading");
  const [historyQuery, setHistoryQuery] = React.useState("");
  const [deleteError, setDeleteError] = React.useState("");

  // The open conversation. `activeId` is null for a brand-new conversation
  // that has not been given a server id yet (the first answer in it is
  // still streaming, or none has been asked); `activeMessages` holds its
  // turns regardless of whether they came from GET /conversations/{id} or
  // were just appended by `ask`.
  const [activeId, setActiveId] = React.useState<string | null>(null);
  const [activeStatus, setActiveStatus] = React.useState<ActiveStatus>("idle");
  const [activeMessages, setActiveMessages] = React.useState<Message[]>([]);
  const [activeMeta, setActiveMeta] = React.useState<{
    title: string | null;
    created_at: string;
  } | null>(null);

  const [draft, setDraft] = React.useState("");
  const [stream, setStream] = React.useState<StreamState | null>(null);
  const [openSource, setOpenSource] = React.useState<Citation | null>(null);
  const [deleteTarget, setDeleteTarget] = React.useState<ConversationSummary | null>(null);
  const [announce, setAnnounce] = React.useState("");

  const seq = React.useRef(0);
  const uid = (p: string) => {
    seq.current += 1;
    return p + "-" + seq.current;
  };

  const transcriptRef = React.useRef<HTMLDivElement | null>(null);
  const sourceHeadingRef = React.useRef<HTMLHeadingElement | null>(null);
  const cancelRef = React.useRef<HTMLButtonElement | null>(null);
  const dialogRef = React.useRef<HTMLDivElement | null>(null);
  const composerRef = React.useRef<HTMLTextAreaElement | null>(null);
  const streamHandleRef = React.useRef<StreamAnswerHandle | null>(null);

  const isStreaming = stream !== null;

  const activeConv: ActiveConversation | null =
    activeStatus === "loaded" || activeMessages.length > 0
      ? {
          id: activeId,
          title:
            activeMeta?.title ||
            (activeMessages[0] && activeMessages[0].role === "user"
              ? titleFrom(activeMessages[0].content)
              : "New conversation"),
          created_at: activeMeta?.created_at ?? activeMessages[0]?.created_at ?? new Date().toISOString(),
          messages: activeMessages,
        }
      : null;

  const loadHistory = React.useCallback(async () => {
    setHistoryStatus("loading");
    try {
      const list = await listConversations();
      setHistoryList(list);
      setHistoryStatus("loaded");
    } catch {
      setHistoryStatus("error");
    }
  }, []);

  React.useEffect(() => {
    void loadHistory();
    // Only ever this user's own conversations: no user id is ever read from
    // the client and none is ever sent (AC-116) -- the backend scopes
    // GET /conversations to the session's caller.
  }, [loadHistory]);

  React.useEffect(() => {
    const el = transcriptRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [activeId, activeStatus, stream, activeMessages]);

  // Dialog: escape to close, focus trap between its two buttons.
  React.useEffect(() => {
    if (!deleteTarget) return undefined;
    if (cancelRef.current) cancelRef.current.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        setDeleteTarget(null);
      } else if (e.key === "Tab" && dialogRef.current) {
        const nodes = dialogRef.current.querySelectorAll("button");
        if (!nodes.length) return;
        const first = nodes[0] as HTMLElement;
        const last = nodes[nodes.length - 1] as HTMLElement;
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [deleteTarget]);

  // After a turn completes (answered, errored, or stopped), the backend has
  // committed the user's message (and the conversation itself, if this was
  // its first turn). Re-fetch the list so title/date/count stay accurate,
  // and -- for a conversation that had no id yet -- adopt the most recently
  // updated entry as the now-open conversation's id (AC-115).
  async function syncAfterTurn(hadNoIdBeforeTurn: boolean) {
    try {
      const list = await listConversations();
      setHistoryList(list);
      setHistoryStatus("loaded");
      if (hadNoIdBeforeTurn && list.length > 0) {
        const newest = list[0];
        setActiveId(newest.id);
        setActiveMeta({ title: newest.title, created_at: newest.created_at });
        setActiveStatus("loaded");
      }
    } catch {
      // The turn itself already succeeded locally; a failed refresh just
      // means the sidebar is stale until the next successful load.
    }
  }

  async function selectConversation(id: string) {
    if (isStreaming) return;
    setActiveId(id);
    setActiveStatus("loading");
    setActiveMessages([]);
    setActiveMeta(null);
    setOpenSource(null);
    try {
      const detail = await getConversation(id);
      if (!detail || !detail.id) {
        setActiveStatus("not-found");
        return;
      }
      const messages: Message[] = detail.messages.map((m, i) =>
        m.role === "user"
          ? {
              id: id + "-m" + i,
              role: "user",
              content: m.content,
              created_at: detail.created_at,
            }
          : {
              id: id + "-m" + i,
              role: "assistant",
              content: m.content,
              created_at: detail.updated_at,
              citations: dedupeCitations(m.citations),
              not_covered: m.citations.length === 0,
              partial: false,
              stopped: false,
              token_usage: null,
              feedback: null,
            },
      );
      setActiveMeta({ title: detail.title, created_at: detail.created_at });
      setActiveMessages(messages);
      setActiveStatus("loaded");
      setAnnounce("Opened conversation " + (detail.title || "untitled"));
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) {
        setActiveStatus("not-found");
      } else {
        setActiveStatus("error");
      }
    }
  }

  function finishStream(result: AnswerTerminal, s: StreamState) {
    const msg: AssistantMessage = {
      id: s.id,
      role: "assistant",
      content: s.text,
      created_at: s.created_at,
      citations: dedupeCitations(result.citations),
      not_covered: result.not_covered,
      partial: result.partial,
      stopped: false,
      token_usage: result.token_usage,
      feedback: null,
    };
    setActiveMessages((prev) => [...prev, msg]);
    setStream(null);
    streamHandleRef.current = null;
    if (msg.not_covered) {
      setAnnounce("Answer complete. Not covered by the knowledge base, no citations.");
    } else {
      setAnnounce("Answer complete with " + msg.citations.length + " source(s).");
      if (msg.citations.length) setOpenSource(msg.citations[0]);
    }
    void syncAfterTurn(s.convId === null);
  }

  function failStream(message: string, s: StreamState) {
    const msg: ErrorMessage = {
      id: s.id,
      role: "error",
      content: message,
      created_at: s.created_at,
      question: s.question,
    };
    setActiveMessages((prev) => [...prev, msg]);
    setStream(null);
    streamHandleRef.current = null;
    setAnnounce("The answer failed: " + message);
    void syncAfterTurn(s.convId === null);
  }

  function ask(question: string) {
    const q = question.replace(/\s+/g, " ").trim();
    if (!q || isStreaming) return;
    const nowIso = new Date().toISOString();
    const userMsg: UserMessage = { id: uid("m"), role: "user", content: q, created_at: nowIso };
    const convIdAtStart = activeId;
    setActiveMessages((prev) => [...prev, userMsg]);
    setDraft("");
    setAnnounce("Searching the knowledge base. Generating answer.");

    const streamId = uid("m");
    const newStream: StreamState = {
      id: streamId,
      convId: convIdAtStart,
      created_at: nowIso,
      question: q,
      text: "",
    };
    setStream(newStream);

    const handle = streamAnswer(
      { question: q, conversationId: convIdAtStart },
      {
        onToken: (token) => {
          setStream((s) => (s && s.id === streamId ? { ...s, text: s.text + token } : s));
        },
        onDone: (result) => {
          setStream((s) => {
            if (s && s.id === streamId) finishStream(result, s);
            return s;
          });
        },
        onError: (message) => {
          setStream((s) => {
            if (s && s.id === streamId) failStream(message, s);
            return s;
          });
        },
      },
    );
    streamHandleRef.current = handle;
  }

  async function stopGenerating() {
    const handle = streamHandleRef.current;
    let hadNoId = false;
    setStream((s) => {
      if (!s) return s;
      hadNoId = s.convId === null;
      const msg: AssistantMessage = {
        id: s.id,
        role: "assistant",
        content: s.text.trimEnd() || "(Generation was stopped before any text arrived.)",
        created_at: s.created_at,
        citations: [],
        not_covered: false,
        partial: false,
        stopped: true,
        token_usage: null,
        feedback: null,
      };
      setActiveMessages((prev) => [...prev, msg]);
      setAnnounce("Generation stopped. The partial answer has been saved.");
      return null;
    });
    streamHandleRef.current = null;
    if (handle) await handle.stop();
    void syncAfterTurn(hadNoId);
  }

  function startNewConversation() {
    if (isStreaming) return;
    setActiveId(null);
    setActiveStatus("idle");
    setActiveMessages([]);
    setActiveMeta(null);
    setOpenSource(null);
    setDraft("");
    setAnnounce("New conversation started. Earlier turns are no longer used as context.");
    if (composerRef.current) composerRef.current.focus();
  }

  async function confirmDelete() {
    const target = deleteTarget;
    if (!target) return;
    setDeleteTarget(null);
    try {
      await deleteConversationApi(target.id);
      setHistoryList((prev) => prev.filter((c) => c.id !== target.id));
      if (activeId === target.id) {
        setActiveId(null);
        setActiveStatus("idle");
        setActiveMessages([]);
        setActiveMeta(null);
      }
      setDeleteError("");
      setAnnounce("Conversation “" + (target.title || "untitled") + "” deleted from your history.");
    } catch {
      setDeleteError("The conversation could not be deleted. Please try again.");
      setAnnounce("The conversation could not be deleted. Please try again.");
    }
  }

  // Filters only the list this client already fetched for the signed-in
  // user -- never a server-side search across other users (AC-116).
  const filteredHistory = historyList.filter((c) =>
    (c.title || "").toLowerCase().includes(historyQuery.trim().toLowerCase()),
  );

  function renderBody(text: string, key: string) {
    return text.split("\n\n").map((para, pi) => (
      <p key={key + "-p" + pi} className="mb-3 last:mb-0 leading-7" style={{ color: BODY_INK }}>
        {para}
      </p>
    ));
  }

  function AssistantMeta({ msg }: { msg: AssistantMessage }) {
    return (
      <p className="mt-4 text-xs" style={{ color: brand.neutralColor }}>
        Generated in the company Azure tenant
        {msg.token_usage && (
          <>
            <span aria-hidden="true"> · </span>
            {(msg.token_usage.prompt_tokens + msg.token_usage.completion_tokens).toLocaleString(
              "en-GB",
            )}{" "}
            tokens
          </>
        )}
        <span aria-hidden="true"> · </span>
        {msg.not_covered
          ? "no sources"
          : msg.citations.length + (msg.citations.length === 1 ? " source" : " sources")}
      </p>
    );
  }

  function Feedback({ msg }: { msg: AssistantMessage }) {
    const set = (rating: "up" | "down") => {
      setActiveMessages((prev) =>
        prev.map((m) =>
          m.id === msg.id && m.role === "assistant"
            ? { ...m, feedback: m.feedback === rating ? null : rating }
            : m,
        ),
      );
    };
    return (
      <div className="mt-3 flex items-center gap-2">
        <span className="text-xs" style={{ color: brand.neutralColor }}>
          Was this useful?
        </span>
        <button
          type="button"
          onClick={() => set("up")}
          aria-pressed={msg.feedback === "up"}
          className={BTN + " border px-2 py-1 text-xs"}
          style={{
            borderColor: msg.feedback === "up" ? brand.primaryColor : BORDER,
            backgroundColor: msg.feedback === "up" ? "#E4EDE9" : "#FFFFFF",
            color: msg.feedback === "up" ? brand.primaryColor : BODY_INK,
          }}
        >
          <Icons.CheckCircle className="h-3.5 w-3.5" aria-hidden="true" />
          Yes
        </button>
        <button
          type="button"
          onClick={() => set("down")}
          aria-pressed={msg.feedback === "down"}
          className={BTN + " border px-2 py-1 text-xs"}
          style={{
            borderColor: msg.feedback === "down" ? brand.accentColor : BORDER,
            backgroundColor: msg.feedback === "down" ? "#F6E9EA" : "#FFFFFF",
            color: msg.feedback === "down" ? brand.accentColor : BODY_INK,
          }}
        >
          <Icons.X className="h-3.5 w-3.5" aria-hidden="true" />
          No
        </button>
      </div>
    );
  }

  return (
    <div style={{ fontFamily: brand.fontBody, color: BODY_INK }}>
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-2xl">
          <h1
            className="text-3xl font-semibold tracking-tight"
            style={{ fontFamily: brand.fontHeading, color: INK }}
          >
            Chat
          </h1>
          <p className="mt-2 text-sm leading-6" style={{ color: brand.neutralColor }}>
            Answers are built only from documents in the shared knowledge base. Every claim carries
            a citation you can open beside the answer — and when nothing supports your question, the
            assistant says so instead of guessing.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={startNewConversation}
            disabled={isStreaming}
            className={BTN + " px-4 py-2 text-white hover:opacity-90"}
            style={{ backgroundColor: brand.primaryColor }}
          >
            <Icons.Plus className="h-4 w-4" aria-hidden="true" />
            New conversation
          </button>
          <button
            type="button"
            onClick={() => navigate("getting-started")}
            className={BTN + " border bg-white px-4 py-2 hover:bg-[#E9EDEA]"}
            style={{ borderColor: BORDER, color: BODY_INK }}
          >
            <Icons.FileText className="h-4 w-4" aria-hidden="true" />
            Getting started
          </button>
          <button
            type="button"
            onClick={() => void signOut()}
            className={BTN + " border bg-white px-4 py-2 hover:bg-[#E9EDEA]"}
            style={{ borderColor: BORDER, color: BODY_INK }}
          >
            Sign out
          </button>
        </div>
      </header>

      <p role="status" aria-live="polite" className="sr-only">
        {announce}
      </p>

      <div className="mt-6 grid gap-6 lg:grid-cols-[17rem_minmax(0,1fr)] xl:grid-cols-[17rem_minmax(0,1fr)_21rem]">
        {/* ---------------- History ---------------- */}
        <aside
          aria-labelledby="history-heading"
          className="rounded-[0.5rem] border bg-white"
          style={{ borderColor: BORDER }}
        >
          <div className="border-b px-4 py-4" style={{ borderColor: BORDER }}>
            <h2 id="history-heading" className="text-sm font-semibold" style={{ color: INK }}>
              Your conversations
            </h2>
            <p className="mt-1 text-xs" style={{ color: brand.neutralColor }}>
              {historyStatus === "loaded" ? historyList.length + " saved · visible only to you" : ""}
            </p>
            {deleteError && (
              <p role="alert" className="mt-2 text-xs font-medium" style={{ color: brand.accentColor }}>
                {deleteError}
              </p>
            )}
            <div className="mt-3">
              <label
                htmlFor="history-search"
                className="block text-xs font-medium"
                style={{ color: BODY_INK }}
              >
                Search your history
              </label>
              <div className="relative mt-1">
                <Icons.Search
                  className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2"
                  aria-hidden="true"
                  style={{ color: brand.neutralColor }}
                />
                <input
                  id="history-search"
                  type="search"
                  value={historyQuery}
                  onChange={(e) => setHistoryQuery(e.target.value)}
                  placeholder="e.g. expenses"
                  className={
                    "w-full rounded-[0.5rem] border bg-white py-2 pl-8 pr-3 text-sm " + RING
                  }
                  style={{ borderColor: BORDER, color: BODY_INK }}
                />
              </div>
            </div>
          </div>

          {historyStatus === "loading" ? (
            <div className="px-4 py-8 text-center">
              <p className="text-sm font-medium" style={{ color: INK }}>
                Loading your conversations…
              </p>
            </div>
          ) : historyStatus === "error" ? (
            <div className="px-4 py-8 text-center">
              <Icons.AlertCircle
                className="mx-auto h-5 w-5"
                aria-hidden="true"
                style={{ color: brand.accentColor }}
              />
              <p className="mt-2 text-sm font-medium" style={{ color: INK }}>
                Your conversations could not be loaded
              </p>
              <button
                type="button"
                onClick={() => void loadHistory()}
                className={BTN + " mt-3 border bg-white px-3 py-1.5 text-xs"}
                style={{ borderColor: BORDER, color: BODY_INK }}
              >
                Try again
              </button>
            </div>
          ) : historyList.length === 0 ? (
            <div className="px-4 py-8 text-center">
              <Icons.Clock
                className="mx-auto h-5 w-5"
                aria-hidden="true"
                style={{ color: brand.neutralColor }}
              />
              <p className="mt-2 text-sm font-medium" style={{ color: INK }}>
                No saved conversations
              </p>
              <p className="mt-1 text-xs leading-5" style={{ color: brand.neutralColor }}>
                Ask your first question and it will be saved here with a title and date.
              </p>
            </div>
          ) : filteredHistory.length === 0 ? (
            <div className="px-4 py-8 text-center">
              <p className="text-sm font-medium" style={{ color: INK }}>
                No matches
              </p>
              <p className="mt-1 text-xs leading-5" style={{ color: brand.neutralColor }}>
                Nothing in your history matches “{historyQuery.trim()}”.
              </p>
            </div>
          ) : (
            <ul role="list" className="max-h-72 overflow-y-auto p-2 lg:max-h-[26rem]">
              {filteredHistory.map((c) => {
                const isActive = c.id === activeId;
                return (
                  <li key={c.id} className="flex items-stretch gap-1">
                    <button
                      type="button"
                      onClick={() => void selectConversation(c.id)}
                      disabled={isStreaming}
                      aria-current={isActive ? "true" : undefined}
                      className={
                        "flex-1 rounded-[0.5rem] border-l-2 px-3 py-2 text-left hover:bg-[#F1F3F1] disabled:opacity-50 " +
                        RING
                      }
                      style={{
                        borderLeftColor: isActive ? brand.primaryColor : "transparent",
                        backgroundColor: isActive ? "#E8EFEB" : "transparent",
                      }}
                    >
                      <span
                        className={
                          "block text-sm leading-5 " + (isActive ? "font-semibold" : "font-normal")
                        }
                        style={{ color: INK }}
                      >
                        {c.title || "Untitled conversation"}
                      </span>
                      <span className="mt-0.5 block text-xs" style={{ color: brand.neutralColor }}>
                        {fmtDay(c.created_at)} · {fmtTime(c.created_at)}
                        {isActive ? " · open" : ""}
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeleteTarget(c)}
                      aria-label={"Delete conversation: " + (c.title || "Untitled conversation")}
                      className={"rounded-[0.5rem] px-2 hover:bg-[#F6E9EA] " + RING}
                      style={{ color: brand.accentColor }}
                    >
                      <Icons.Trash className="h-4 w-4" aria-hidden="true" />
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </aside>

        {/* ---------------- Conversation ---------------- */}
        <section
          aria-labelledby="conversation-heading"
          className="flex min-w-0 flex-col rounded-[0.5rem] border bg-white"
          style={{ borderColor: BORDER }}
        >
          <div className="border-b px-6 py-4" style={{ borderColor: BORDER }}>
            <h2
              id="conversation-heading"
              className="text-base font-semibold"
              style={{ color: INK }}
            >
              {activeStatus === "not-found"
                ? "Conversation not found"
                : activeConv
                  ? activeConv.title
                  : "New conversation"}
            </h2>
            <p className="mt-1 text-xs" style={{ color: brand.neutralColor }}>
              {activeStatus === "not-found"
                ? "It may have been deleted, or it never belonged to your account."
                : activeConv
                  ? "Started " +
                    fmtDay(activeConv.created_at) +
                    " at " +
                    fmtTime(activeConv.created_at) +
                    " · " +
                    activeConv.messages.length +
                    " turns · follow-ups are read in context"
                  : "No earlier turns are used as context for your next question."}
            </p>
          </div>

          <div
            ref={transcriptRef}
            role="log"
            aria-label="Conversation transcript"
            tabIndex={0}
            className={"max-h-[34rem] flex-1 overflow-y-auto px-6 py-6 " + RING}
          >
            {activeStatus === "loading" ? (
              <div className="mx-auto max-w-xl py-10 text-center">
                <p className="text-sm font-medium" style={{ color: INK }}>
                  Loading conversation…
                </p>
              </div>
            ) : activeStatus === "not-found" ? (
              <div className="mx-auto max-w-xl py-10 text-center">
                <Icons.AlertCircle
                  className="mx-auto h-5 w-5"
                  aria-hidden="true"
                  style={{ color: brand.accentColor }}
                />
                <p className="mt-3 text-sm font-medium" style={{ color: INK }}>
                  This conversation could not be found
                </p>
                <p className="mt-1 text-sm leading-6" style={{ color: brand.neutralColor }}>
                  It may have been deleted, or the link no longer applies to your account.
                </p>
              </div>
            ) : activeStatus === "error" ? (
              <div className="mx-auto max-w-xl py-10 text-center">
                <Icons.AlertCircle
                  className="mx-auto h-5 w-5"
                  aria-hidden="true"
                  style={{ color: brand.accentColor }}
                />
                <p className="mt-3 text-sm font-medium" style={{ color: INK }}>
                  This conversation could not be loaded
                </p>
                <button
                  type="button"
                  onClick={() => (activeId ? void selectConversation(activeId) : undefined)}
                  className={BTN + " mt-3 border bg-white px-3 py-1.5 text-xs"}
                  style={{ borderColor: BORDER, color: BODY_INK }}
                >
                  Try again
                </button>
              </div>
            ) : !activeConv || activeConv.messages.length === 0 ? (
              <div className="mx-auto max-w-xl py-4 text-center">
                <div
                  className="mx-auto flex h-11 w-11 items-center justify-center rounded-full"
                  style={{ backgroundColor: "#E4EDE9" }}
                >
                  <Icons.Search
                    className="h-5 w-5"
                    aria-hidden="true"
                    style={{ color: brand.primaryColor }}
                  />
                </div>
                <h3 className="mt-4 text-lg font-semibold" style={{ color: INK }}>
                  {historyList.length === 0
                    ? "Welcome — ask our knowledge base anything"
                    : "Ask a question to start"}
                </h3>
                <p
                  className="mx-auto mt-2 max-w-md text-sm leading-6"
                  style={{ color: brand.neutralColor }}
                >
                  Answers come only from documents uploaded to the shared company knowledge base,
                  and each one is cited so you can read the original source. If nothing covers your
                  question, you will be told rather than guessed at.
                </p>
                <p className="mt-3 text-sm">
                  <button
                    type="button"
                    onClick={() => navigate("getting-started")}
                    className={"font-medium underline underline-offset-2 rounded " + RING}
                    style={{ color: brand.primaryColor }}
                  >
                    Read the getting-started guide
                  </button>
                </p>
                <h4
                  className="mt-8 text-xs font-semibold uppercase tracking-wide"
                  style={{ color: INK }}
                >
                  Try one of these
                </h4>
                <ul role="list" className="mx-auto mt-3 grid gap-2 text-left sm:grid-cols-2">
                  {SUGGESTIONS.map((s) => (
                    <li key={s}>
                      <button
                        type="button"
                        onClick={() => ask(s)}
                        disabled={isStreaming}
                        className={
                          "h-full w-full rounded-[0.5rem] border bg-white px-3 py-3 text-left text-sm leading-5 hover:bg-[#F1F3F1] disabled:opacity-50 " +
                          RING
                        }
                        style={{ borderColor: BORDER, color: BODY_INK }}
                      >
                        {s}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <ol role="list" className="space-y-6">
                {activeConv.messages.map((msg) => {
                  if (msg.role === "user") {
                    return (
                      <li key={msg.id}>
                        <div className="flex items-baseline gap-2">
                          <span className="text-xs font-semibold" style={{ color: INK }}>
                            You
                          </span>
                          <span className="text-xs" style={{ color: brand.neutralColor }}>
                            {fmtTime(msg.created_at)}
                          </span>
                        </div>
                        <div
                          className="mt-1.5 rounded-[0.5rem] border px-4 py-3 text-sm leading-6"
                          style={{
                            borderColor: BORDER,
                            backgroundColor: "#F1F3F1",
                            color: BODY_INK,
                          }}
                        >
                          {msg.content}
                        </div>
                      </li>
                    );
                  }

                  if (msg.role === "error") {
                    return (
                      <li key={msg.id}>
                        <div className="flex items-baseline gap-2">
                          <span
                            className="text-xs font-semibold"
                            style={{ color: brand.accentColor }}
                          >
                            Assistant
                          </span>
                          <span className="text-xs" style={{ color: brand.neutralColor }}>
                            {fmtTime(msg.created_at)}
                          </span>
                        </div>
                        <div
                          role="alert"
                          className="mt-1.5 rounded-[0.5rem] border border-l-2 px-4 py-4 text-sm"
                          style={{
                            borderColor: BORDER,
                            borderLeftColor: brand.accentColor,
                            backgroundColor: "#F6E9EA",
                          }}
                        >
                          <p
                            className="flex items-center gap-2 font-medium"
                            style={{ color: brand.accentColor }}
                          >
                            <Icons.AlertCircle className="h-4 w-4" aria-hidden="true" />
                            {msg.content}
                          </p>
                          <button
                            type="button"
                            onClick={() => ask(msg.question)}
                            disabled={isStreaming}
                            className={BTN + " mt-3 border bg-white px-3 py-1.5 text-xs"}
                            style={{ borderColor: brand.accentColor, color: brand.accentColor }}
                          >
                            Retry this question
                          </button>
                        </div>
                      </li>
                    );
                  }

                  return (
                    <li key={msg.id}>
                      <div className="flex items-baseline gap-2">
                        <span
                          className="text-xs font-semibold"
                          style={{ color: brand.primaryColor }}
                        >
                          Assistant
                        </span>
                        <span className="text-xs" style={{ color: brand.neutralColor }}>
                          {fmtTime(msg.created_at)}
                        </span>
                        {msg.not_covered && (
                          <span
                            className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[0.7rem] font-semibold"
                            style={{
                              borderColor: brand.accentColor,
                              color: brand.accentColor,
                              backgroundColor: "#F6E9EA",
                            }}
                          >
                            <Icons.AlertCircle className="h-3 w-3" aria-hidden="true" />
                            Not covered
                          </span>
                        )}
                        {msg.partial && (
                          <span
                            className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[0.7rem] font-semibold"
                            style={{
                              borderColor: brand.accentColor,
                              color: brand.accentColor,
                              backgroundColor: "#F6E9EA",
                            }}
                          >
                            <Icons.AlertCircle className="h-3 w-3" aria-hidden="true" />
                            Partly covered
                          </span>
                        )}
                        {msg.stopped && (
                          <span
                            className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[0.7rem] font-semibold"
                            style={{ borderColor: BORDER, color: brand.neutralColor }}
                          >
                            Stopped
                          </span>
                        )}
                      </div>
                      <div
                        className="mt-1.5 rounded-[0.5rem] border border-l-2 px-4 py-4 text-sm"
                        style={{
                          borderColor: BORDER,
                          borderLeftColor: msg.not_covered ? brand.accentColor : brand.primaryColor,
                        }}
                      >
                        {renderBody(msg.content, msg.id)}

                        {msg.citations.length > 0 && (
                          <div className="mt-4 border-t pt-3" style={{ borderColor: BORDER }}>
                            <h4
                              className="text-xs font-semibold uppercase tracking-wide"
                              style={{ color: INK }}
                            >
                              Sources
                            </h4>
                            <ul role="list" className="mt-2 space-y-1.5">
                              {msg.citations.map((cit, i) => (
                                <li key={msg.id + "-cit" + i}>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setOpenSource(cit);
                                      if (sourceHeadingRef.current)
                                        sourceHeadingRef.current.focus();
                                    }}
                                    className={
                                      "flex w-full items-center gap-2 rounded-[0.5rem] border px-3 py-2 text-left text-sm hover:bg-[#F1F3F1] " +
                                      RING
                                    }
                                    style={{ borderColor: BORDER }}
                                  >
                                    <span
                                      className="flex h-5 w-5 shrink-0 items-center justify-center rounded text-[0.68rem] font-semibold"
                                      style={{
                                        backgroundColor: "#E4EDE9",
                                        color: brand.primaryColor,
                                      }}
                                      aria-hidden="true"
                                    >
                                      {i + 1}
                                    </span>
                                    <span className="min-w-0 flex-1">
                                      <span
                                        className="block truncate font-medium"
                                        style={{ color: INK }}
                                      >
                                        {cit.source_id}
                                      </span>
                                      <span
                                        className="block text-xs"
                                        style={{ color: brand.neutralColor }}
                                      >
                                        {cit.source_type}
                                      </span>
                                    </span>
                                    <Icons.ChevronRight
                                      className="h-4 w-4 shrink-0"
                                      aria-hidden="true"
                                      style={{ color: brand.neutralColor }}
                                    />
                                  </button>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}

                        {msg.not_covered && (
                          <p
                            className="mt-3 text-xs leading-5"
                            style={{ color: brand.neutralColor }}
                          >
                            No citations are shown because no passage scored above the relevance
                            threshold. You can{" "}
                            <button
                              type="button"
                              onClick={() => navigate("documents")}
                              className={"font-medium underline underline-offset-2 rounded " + RING}
                              style={{ color: brand.primaryColor }}
                            >
                              add a document to the knowledge base
                            </button>
                            .
                          </p>
                        )}

                        <AssistantMeta msg={msg} />
                        {!msg.stopped && <Feedback msg={msg} />}
                      </div>
                    </li>
                  );
                })}

                {stream && (activeConv?.id ?? null) === stream.convId && (
                  <li>
                    <div className="flex items-baseline gap-2">
                      <span className="text-xs font-semibold" style={{ color: brand.primaryColor }}>
                        Assistant
                      </span>
                      <span className="text-xs" style={{ color: brand.neutralColor }}>
                        {stream.text.length === 0 ? "searching the knowledge base…" : "streaming…"}
                      </span>
                    </div>
                    <div
                      className="mt-1.5 rounded-[0.5rem] border border-l-2 px-4 py-4 text-sm"
                      style={{ borderColor: BORDER, borderLeftColor: brand.primaryColor }}
                    >
                      {stream.text.length === 0 ? (
                        <p className="text-sm" style={{ color: brand.neutralColor }}>
                          Running hybrid keyword and meaning-based retrieval across the combined
                          index…
                        </p>
                      ) : (
                        renderBody(stream.text, stream.id)
                      )}
                      <span
                        className="mt-2 inline-block h-4 w-2 animate-pulse align-middle"
                        style={{ backgroundColor: brand.primaryColor }}
                        aria-hidden="true"
                      />
                    </div>
                  </li>
                )}
              </ol>
            )}
          </div>

          {/* Composer */}
          <div className="border-t px-6 py-4" style={{ borderColor: BORDER }}>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                ask(draft);
              }}
            >
              <label
                htmlFor="question"
                className="block text-sm font-medium"
                style={{ color: INK }}
              >
                Ask a question
              </label>
              <textarea
                id="question"
                ref={composerRef}
                rows={3}
                value={draft}
                disabled={isStreaming}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    ask(draft);
                  }
                }}
                aria-describedby="question-hint"
                placeholder="e.g. What is the approval limit for an expense claim?"
                className={
                  "mt-1.5 w-full resize-y rounded-[0.5rem] border px-3 py-2 text-sm leading-6 disabled:bg-[#F1F3F1] " +
                  RING
                }
                style={{ borderColor: BORDER, color: BODY_INK }}
              />
              <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
                <p
                  id="question-hint"
                  className="max-w-md text-xs leading-5"
                  style={{ color: brand.neutralColor }}
                >
                  Enter sends · Shift + Enter adds a line. The whole knowledge base is searched —
                  there are no filters to set.
                </p>
                <div className="flex items-center gap-2">
                  {isStreaming && (
                    <>
                      <span className="text-xs font-medium" style={{ color: brand.neutralColor }}>
                        Generating…
                      </span>
                      <button
                        type="button"
                        onClick={() => void stopGenerating()}
                        className={BTN + " border bg-white px-3 py-2 hover:bg-[#F6E9EA]"}
                        style={{ borderColor: brand.accentColor, color: brand.accentColor }}
                      >
                        <Icons.X className="h-4 w-4" aria-hidden="true" />
                        Stop generating
                      </button>
                    </>
                  )}
                  <button
                    type="submit"
                    disabled={isStreaming || draft.trim().length === 0}
                    className={BTN + " px-4 py-2 text-white hover:opacity-90"}
                    style={{ backgroundColor: brand.primaryColor }}
                  >
                    <Icons.ArrowRight className="h-4 w-4" aria-hidden="true" />
                    Ask
                  </button>
                </div>
              </div>
            </form>
          </div>
        </section>

        {/* ---------------- Source panel ---------------- */}
        <aside
          aria-labelledby="source-heading"
          className="rounded-[0.5rem] border bg-white xl:sticky xl:top-6 xl:self-start"
          style={{ borderColor: BORDER }}
        >
          <div
            className="flex items-start justify-between gap-2 border-b px-4 py-4"
            style={{ borderColor: BORDER }}
          >
            <div>
              <h2
                id="source-heading"
                ref={sourceHeadingRef}
                tabIndex={-1}
                className={"text-sm font-semibold outline-none " + RING}
                style={{ color: INK }}
              >
                Source
              </h2>
              <p className="mt-1 text-xs" style={{ color: brand.neutralColor }}>
                {openSource ? "Citation selected" : "Nothing open"}
              </p>
            </div>
            {openSource && (
              <button
                type="button"
                onClick={() => setOpenSource(null)}
                aria-label="Close source panel"
                className={"rounded-[0.5rem] p-1.5 hover:bg-[#F1F3F1] " + RING}
                style={{ color: brand.neutralColor }}
              >
                <Icons.X className="h-4 w-4" aria-hidden="true" />
              </button>
            )}
          </div>

          {!openSource ? (
            <div className="px-5 py-10 text-center">
              <Icons.FileText
                className="mx-auto h-6 w-6"
                aria-hidden="true"
                style={{ color: brand.neutralColor }}
              />
              <p className="mt-3 text-sm font-medium" style={{ color: INK }}>
                No source open
              </p>
              <p className="mt-1 text-xs leading-5" style={{ color: brand.neutralColor }}>
                Select a source in an answer and its details open here, beside the answer.
              </p>
            </div>
          ) : (
            <div className="px-4 py-4">
              <h3 className="break-words text-sm font-semibold leading-5" style={{ color: INK }}>
                {openSource.source_id}
              </h3>
              <div className="mt-2 flex flex-wrap gap-1.5">
                <span
                  className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[0.7rem] font-medium"
                  style={{ borderColor: BORDER, color: BODY_INK }}
                >
                  {openSource.source_type}
                </span>
              </div>

              {openSource.snippet && (
                <>
                  <h4
                    className="mt-5 text-xs font-semibold uppercase tracking-wide"
                    style={{ color: INK }}
                  >
                    Cited passage
                  </h4>
                  <blockquote
                    className="mt-2 border-l-2 py-1 pl-3 text-sm leading-6"
                    style={{ borderColor: brand.primaryColor, color: BODY_INK }}
                  >
                    {openSource.snippet}
                  </blockquote>
                </>
              )}

              <div className="mt-5 space-y-2">
                {openSource.source_url ? (
                  <a
                    href={openSource.source_url}
                    target="_blank"
                    rel="noreferrer"
                    className={BTN + " w-full px-4 py-2 text-white hover:opacity-90"}
                    style={{ backgroundColor: brand.primaryColor }}
                  >
                    <Icons.Download className="h-4 w-4" aria-hidden="true" />
                    Open original source
                  </a>
                ) : (
                  <p className="text-xs" style={{ color: brand.neutralColor }}>
                    No source link was returned for this citation.
                  </p>
                )}
                <button
                  type="button"
                  onClick={() => navigate("documents")}
                  className={BTN + " w-full border bg-white px-4 py-2 hover:bg-[#F1F3F1]"}
                  style={{ borderColor: BORDER, color: BODY_INK }}
                >
                  <Icons.Package className="h-4 w-4" aria-hidden="true" />
                  View in knowledge base
                </button>
              </div>
            </div>
          )}
        </aside>
      </div>

      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-title"
            aria-describedby="delete-desc"
            className="w-full max-w-md rounded-[0.5rem] border bg-white p-6 shadow-lg"
            style={{ borderColor: BORDER }}
          >
            <h2 id="delete-title" className="text-lg font-semibold" style={{ color: INK }}>
              Delete this conversation?
            </h2>
            <p id="delete-desc" className="mt-2 text-sm leading-6" style={{ color: BODY_INK }}>
              “{deleteTarget.title || "Untitled conversation"}” will be removed from your history
              and will no longer appear in your list. The documents it cited are not affected.
            </p>
            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                ref={cancelRef}
                onClick={() => setDeleteTarget(null)}
                className={BTN + " border bg-white px-4 py-2 hover:bg-[#F1F3F1]"}
                style={{ borderColor: BORDER, color: BODY_INK }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void confirmDelete()}
                className={BTN + " px-4 py-2 text-white hover:opacity-90"}
                style={{ backgroundColor: brand.accentColor }}
              >
                <Icons.Trash className="h-4 w-4" aria-hidden="true" />
                Delete conversation
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
