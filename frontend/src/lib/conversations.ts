/**
 * Client for the real /conversations endpoints (US-017-1).
 *
 * Thin wrappers over the shared `apiFetch` -- no second fetch wrapper, no
 * client-side scoping logic: the backend already scopes every row to the
 * signed-in caller (`Conversation.user_id`), so these calls never carry or
 * need a user id of their own, and an id that belongs to someone else comes
 * back 404, identical to one that does not exist at all.
 */
import { apiFetch } from "@/lib/api";
import type { Citation } from "@/lib/chat";

export interface ConversationSummary {
  id: string;
  title: string | null;
  created_at: string;
  updated_at: string;
  message_count: number;
}

export interface ConversationMessage {
  // The persisted Message row's id (MessageOut.id on the backend) -- what
  // POST /messages/{id}/feedback is called with for an assistant turn.
  id: string;
  role: "user" | "assistant";
  content: string;
  citations: Citation[];
}

export interface ConversationDetail {
  id: string;
  title: string | null;
  created_at: string;
  updated_at: string;
  messages: ConversationMessage[];
}

export async function listConversations(): Promise<ConversationSummary[]> {
  return apiFetch<ConversationSummary[]>("/conversations");
}

export async function getConversation(id: string): Promise<ConversationDetail> {
  return apiFetch<ConversationDetail>(`/conversations/${id}`);
}

export async function deleteConversation(id: string): Promise<void> {
  await apiFetch<void>(`/conversations/${id}`, { method: "DELETE" });
}
