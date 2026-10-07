/**
 * Client for POST /messages/{id}/feedback.
 *
 * Kept as its own module (not folded into chat.ts or conversations.ts)
 * because it is the one write that targets a message id rather than a
 * stream or a conversation id -- that id now comes back as
 * `AnswerTerminal.message_id` (the SSE `done` event) or
 * `ConversationMessage.id` (GET /conversations/{id}).
 */
import { apiFetch } from "@/lib/api";

export type FeedbackRating = "up" | "down";

export async function submitFeedback(messageId: string, rating: FeedbackRating): Promise<void> {
  await apiFetch<void>(`/messages/${messageId}/feedback`, {
    method: "POST",
    body: JSON.stringify({ rating: rating === "up" ? 1 : -1 }),
  });
}
