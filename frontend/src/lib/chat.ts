/**
 * Client for the real `/answer` SSE stream and `/answer/stop`.
 *
 * Contract (US-011-1): POST /answer responds `text/event-stream`. Each
 * `event: token` carries `{ stream_id, token }`; the stream ends with one
 * `event: done` carrying the terminal `{ stream_id, citations, not_covered,
 * partial, token_usage }`, or `event: error` on failure. POST /answer/stop
 * takes `{ stream_id }` and finalises the partial generation server-side.
 *
 * The backend does not serve real SSE yet (US-011-1 landed a synchronous
 * JSON `/answer`, with streaming explicitly deferred) -- this module is
 * written against the agreed contract so the UI is ready the day it does;
 * tests mock the stream at the `fetch` boundary.
 */
import { API_BASE_URL, reportUnauthorized } from "@/lib/api";

export interface Citation {
  document_id: string;
  source_type: string;
  source_id: string;
  source_url: string | null;
  chunk_index?: number;
  snippet?: string;
}

export interface TokenUsage {
  prompt_tokens: number;
  completion_tokens: number;
}

export interface AnswerTerminal {
  stream_id: string;
  citations: Citation[];
  not_covered: boolean;
  partial: boolean;
  token_usage: TokenUsage;
}

export interface StreamAnswerParams {
  question: string;
  conversationId?: string | null;
}

export interface StreamAnswerHandlers {
  onToken: (token: string) => void;
  onDone: (result: AnswerTerminal) => void;
  onError: (message: string) => void;
}

export interface StreamAnswerHandle {
  stop: () => Promise<void>;
}

const IDLE_TIMEOUT_MS = 30000;

/** One citation per document_id, first occurrence wins (AC-096). */
export function dedupeCitations(citations: Citation[]): Citation[] {
  const seen = new Set<string>();
  const out: Citation[] = [];
  for (const citation of citations) {
    const key = citation.document_id || `${citation.source_type}:${citation.source_id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(citation);
  }
  return out;
}

export function streamAnswer(
  params: StreamAnswerParams,
  handlers: StreamAnswerHandlers,
): StreamAnswerHandle {
  const controller = new AbortController();
  let streamId: string | null = null;
  let stoppedByUser = false;
  let settled = false;
  let idleTimer: ReturnType<typeof setTimeout> | undefined;

  function clearIdleTimer() {
    if (idleTimer) clearTimeout(idleTimer);
  }

  function resetIdleTimer() {
    clearIdleTimer();
    idleTimer = setTimeout(() => {
      stoppedByUser = true;
      controller.abort();
      if (!settled) {
        settled = true;
        handlers.onError("The answer timed out. Please try again.");
      }
    }, IDLE_TIMEOUT_MS);
  }

  function parseEvent(raw: string): { event: string; data: string } {
    let event = "message";
    let data = "";
    for (const line of raw.split("\n")) {
      if (line.startsWith("event:")) event = line.slice(6).trim();
      else if (line.startsWith("data:")) data += line.slice(5).trim();
    }
    return { event, data };
  }

  (async () => {
    resetIdleTimer();
    try {
      const response = await fetch(`${API_BASE_URL}/answer`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json", Accept: "text/event-stream" },
        body: JSON.stringify({
          question: params.question,
          conversation_id: params.conversationId ?? null,
          stream: true,
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        reportUnauthorized(response.status);
        clearIdleTimer();
        if (!settled) {
          settled = true;
          handlers.onError(`The question could not be sent (${response.status}).`);
        }
        return;
      }

      if (!response.body) {
        clearIdleTimer();
        if (!settled) {
          settled = true;
          handlers.onError("No response stream was received.");
        }
        return;
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        let boundary = buffer.indexOf("\n\n");
        while (boundary !== -1) {
          const rawEvent = buffer.slice(0, boundary);
          buffer = buffer.slice(boundary + 2);
          boundary = buffer.indexOf("\n\n");
          const { event, data } = parseEvent(rawEvent);
          if (!data) continue;
          let parsed: Record<string, unknown>;
          try {
            parsed = JSON.parse(data) as Record<string, unknown>;
          } catch {
            continue;
          }

          if (typeof parsed.stream_id === "string") streamId = parsed.stream_id;

          if (event === "token") {
            if (typeof parsed.token === "string") {
              resetIdleTimer();
              handlers.onToken(parsed.token);
            }
          } else if (event === "done") {
            clearIdleTimer();
            if (!settled) {
              settled = true;
              handlers.onDone({
                stream_id: streamId ?? "",
                citations: dedupeCitations((parsed.citations as Citation[]) ?? []),
                not_covered: Boolean(parsed.not_covered),
                partial: Boolean(parsed.partial),
                token_usage: (parsed.token_usage as TokenUsage) ?? {
                  prompt_tokens: 0,
                  completion_tokens: 0,
                },
              });
            }
            return;
          } else if (event === "error") {
            clearIdleTimer();
            if (!settled) {
              settled = true;
              handlers.onError(
                typeof parsed.message === "string"
                  ? parsed.message
                  : "The answer stream failed. Please try again.",
              );
            }
            return;
          }
        }
      }

      clearIdleTimer();
      if (!settled && !stoppedByUser) {
        settled = true;
        handlers.onError("The connection ended before the answer completed. Please try again.");
      }
    } catch {
      clearIdleTimer();
      // An aborted fetch from `stop()` or the idle timeout above is expected
      // and already handled where it was triggered -- anything else is a
      // genuine network failure (AC-093).
      if (!stoppedByUser && !settled) {
        settled = true;
        handlers.onError("The answer stream failed. Please try again.");
      }
    }
  })();

  return {
    async stop() {
      stoppedByUser = true;
      clearIdleTimer();
      controller.abort();
      if (streamId) {
        try {
          await fetch(`${API_BASE_URL}/answer/stop`, {
            method: "POST",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ stream_id: streamId }),
          });
        } catch {
          // Best effort -- the UI finalises the partial answer locally
          // regardless of whether this call lands.
        }
      }
    },
  };
}
