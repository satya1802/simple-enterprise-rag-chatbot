/* eslint-disable @typescript-eslint/no-unused-vars */
import React from "react";

import * as UI from "@/lib/ui";
import { Icons } from "@/lib/icons";
import { brand } from "@/lib/brand";
import { useNavigate } from "@/lib/navigate";

const { Tabs, Empty } = UI;
const { Search, Check, X, ChevronRight, User, Users, Home, FileText, Clock, Filter, Download, Upload, ArrowLeft, ArrowRight, AlertCircle, CheckCircle } = Icons;

const BASE_URL = "https://kb-api.internal.contoso.com/v1";

const FOCUS =
  "focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[#1C5D4A] focus-visible:ring-offset-[#F1F3F1]";

const CITATION_FIELDS = [
  { name: "id", type: "uuid", desc: "Identifier of the citation record." },
  { name: "document_id", type: "uuid", desc: "Document the cited chunk belongs to." },
  { name: "source_type", type: "enum", desc: "One of document, confluence, jira. Release one only emits document." },
  { name: "source_id", type: "string", desc: "Identifier inside the source system. For uploads this is the stored filename." },
  { name: "source_url", type: "string", desc: "Resolvable URL for the citation. Uploads point at GET /documents/{id}/file." },
  { name: "chunk_index", type: "integer", desc: "Position of the cited chunk inside the document." },
  { name: "snippet", type: "string", desc: "The retrieved passage, for display beside the answer." }
];

const ENDPOINTS = [
  {
    id: "post-answer",
    method: "POST",
    path: "/answer",
    group: "Answers",
    primary: true,
    stability: "Stable",
    summary:
      "Ask a question against the whole corpus and receive a grounded, cited answer. Retrieval is hybrid (keyword + vector) over one combined index; generation runs on the in-tenant model. This is the endpoint a Teams or Slack front end calls.",
    notes:
      "There is no scope or source-type parameter. The retriever searches the entire corpus by default, exactly as the web UI does.",
    contentType: "application/json → text/event-stream",
    request: [
      { name: "question", type: "string", required: true, where: "body", desc: "The employee's question in plain English. English-only content is a known limitation of release one." },
      { name: "conversation_id", type: "uuid", required: false, where: "body", desc: "Appends the turn to an existing conversation so earlier turns resolve pronouns and ellipsis. Omit to start a new conversation." },
      { name: "stream", type: "boolean", required: false, where: "body", desc: "Defaults to true. When false the complete answer is returned as a single JSON body instead of an event stream." },
      { name: "client", type: "string", required: false, where: "body", desc: "Calling front end, e.g. teams-bot. Recorded alongside token_usage for later spend reporting." }
    ],
    response: [
      { name: "message_id", type: "uuid", desc: "Assistant message created for this turn." },
      { name: "conversation_id", type: "uuid", desc: "Conversation the turn was appended to, created if none was supplied." },
      { name: "content", type: "string", desc: "The grounded answer text. Never contains substantive content without an attached citation." },
      { name: "not_covered", type: "boolean", desc: "True when nothing in the corpus scored above the relevance threshold. citations is then empty." },
      { name: "citations", type: "Citation[]", desc: "One entry per distinct source document, duplicates collapsed. See the citation object below." },
      { name: "token_usage", type: "object", desc: "prompt_tokens and completion_tokens recorded against the requesting user." },
      { name: "created_at", type: "timestamp", desc: "ISO 8601, UTC." }
    ],
    sample: `curl -N ${BASE_URL}/answer \\
  -H "Authorization: Bearer $ACCESS_TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{
    "question": "How much notice does a contractor have to give?",
    "conversation_id": "c7a1f0e2-5b3d-4a19-9f55-0c2b6b8e4411",
    "stream": true,
    "client": "teams-bot"
  }'`,
    sampleResponse: `{
  "message_id": "9f1c2d44-7a80-4f61-b0ac-2d5e9a1f33b2",
  "conversation_id": "c7a1f0e2-5b3d-4a19-9f55-0c2b6b8e4411",
  "content": "Contractors give four weeks' written notice to their engaging manager. The manager confirms the end date with People Ops before the final timesheet is approved.",
  "not_covered": false,
  "citations": [
    {
      "id": "4b31aa0e-1f2c-44d9-9d70-6c5b0a7e2e18",
      "document_id": "2a7c9e51-0b44-4c8e-91f6-77d2a1c40e9b",
      "source_type": "document",
      "source_id": "contractor-engagement-policy-v4.pdf",
      "source_url": "${BASE_URL}/documents/2a7c9e51-0b44-4c8e-91f6-77d2a1c40e9b/file",
      "chunk_index": 12,
      "snippet": "Contractors shall provide four weeks' written notice to the engaging manager…"
    }
  ],
  "token_usage": { "prompt_tokens": 2480, "completion_tokens": 166 },
  "created_at": "2026-10-06T09:14:27Z"
}`,
    errors: [
      { status: "400", code: "question_required", when: "The body is missing question, or question is empty after trimming." },
      { status: "401", code: "unauthenticated", when: "No bearer token, or the token has expired. No corpus content is returned." },
      { status: "413", code: "question_too_long", when: "The question exceeds 2,000 characters." },
      { status: "429", code: "rate_limited", when: "Per-user request ceiling reached. Retry-After header gives the wait in seconds." },
      { status: "503", code: "model_unavailable", when: "The in-tenant model endpoint did not respond. No partial answer is presented as complete." },
      { status: "504", code: "retrieval_timeout", when: "Hybrid retrieval exceeded its budget. The client should offer a retry." }
    ]
  },
  {
    id: "post-answer-stop",
    method: "POST",
    path: "/answer/stop",
    group: "Answers",
    stability: "Stable",
    summary: "Stop an in-flight generation. The partial answer already streamed is persisted and marked as stopped, so the transcript stays honest about what was produced.",
    contentType: "application/json",
    request: [
      { name: "message_id", type: "uuid", required: true, where: "body", desc: "The assistant message currently streaming." }
    ],
    response: [
      { name: "message_id", type: "uuid", desc: "Echo of the stopped message." },
      { name: "status", type: "enum", desc: "stopped when generation was cancelled, completed if it had already finished." },
      { name: "token_usage", type: "object", desc: "Tokens consumed before cancellation." }
    ],
    sample: `curl -X POST ${BASE_URL}/answer/stop \\
  -H "Authorization: Bearer $ACCESS_TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{"message_id": "9f1c2d44-7a80-4f61-b0ac-2d5e9a1f33b2"}'`,
    sampleResponse: `{
  "message_id": "9f1c2d44-7a80-4f61-b0ac-2d5e9a1f33b2",
  "status": "stopped",
  "token_usage": { "prompt_tokens": 2480, "completion_tokens": 41 }
}`,
    errors: [
      { status: "401", code: "unauthenticated", when: "Missing or expired bearer token." },
      { status: "404", code: "message_not_found", when: "The message does not exist or belongs to another user." }
    ]
  },
  {
    id: "get-documents",
    method: "GET",
    path: "/documents",
    group: "Documents",
    stability: "Stable",
    summary: "List every document in the shared company-wide corpus, regardless of who uploaded it. There is no per-user filtering and no private flag.",
    contentType: "application/json",
    request: [
      { name: "q", type: "string", required: false, where: "query", desc: "Case-insensitive filename substring filter." },
      { name: "status", type: "enum", required: false, where: "query", desc: "processing, ready, no_readable_text or failed." },
      { name: "limit", type: "integer", required: false, where: "query", desc: "Page size, 1–100. Defaults to 25." },
      { name: "cursor", type: "string", required: false, where: "query", desc: "Opaque cursor from the previous page's next_cursor." }
    ],
    response: [
      { name: "data", type: "Document[]", desc: "id, filename, format, uploader_id, status, status_reason, source_type, source_id, source_url, uploaded_at." },
      { name: "next_cursor", type: "string | null", desc: "Null on the final page." },
      { name: "total", type: "integer", desc: "Document count matching the filter." }
    ],
    sample: `curl "${BASE_URL}/documents?q=policy&status=ready&limit=25" \\
  -H "Authorization: Bearer $ACCESS_TOKEN"`,
    sampleResponse: `{
  "data": [
    {
      "id": "2a7c9e51-0b44-4c8e-91f6-77d2a1c40e9b",
      "filename": "contractor-engagement-policy-v4.pdf",
      "format": "pdf",
      "uploader_id": "a1d9…",
      "status": "ready",
      "status_reason": null,
      "source_type": "document",
      "source_id": "contractor-engagement-policy-v4.pdf",
      "source_url": "${BASE_URL}/documents/2a7c9e51…/file",
      "uploaded_at": "2026-10-01T08:42:11Z"
    },
    {
      "id": "7e4411b0-3c92-4a5d-8f31-b0d2e6c7a119",
      "filename": "site-survey-scan-2019.pdf",
      "format": "pdf",
      "uploader_id": "c4f2…",
      "status": "no_readable_text",
      "status_reason": "Scanned or image-only PDF; no text layer found.",
      "uploaded_at": "2026-10-05T16:03:55Z"
    }
  ],
  "next_cursor": "eyJvZmZzZXQiOjI1fQ==",
  "total": 38
}`,
    errors: [
      { status: "400", code: "invalid_cursor", when: "The cursor is malformed or expired." },
      { status: "401", code: "unauthenticated", when: "Missing or expired bearer token." }
    ]
  },
  {
    id: "post-documents",
    method: "POST",
    path: "/documents",
    group: "Documents",
    stability: "Stable",
    summary: "Upload one or more files into the shared corpus. Accepted files are stored, extracted, chunked, embedded in-tenant and written to the combined index. There is no approval step at this scope.",
    notes: "Each file is tracked independently: valid files start processing even when others in the same request are rejected.",
    contentType: "multipart/form-data",
    request: [
      { name: "file", type: "file[]", required: true, where: "form", desc: "One or more files. Accepted extensions: .pdf, .docx, .txt, .md. Maximum 25 MB each." }
    ],
    response: [
      { name: "accepted", type: "Document[]", desc: "Created document records, each with status processing." },
      { name: "rejected", type: "object[]", desc: "filename, reason_code (unsupported_format, file_too_large) and a human-readable reason. No document record is created." }
    ],
    sample: `curl -X POST ${BASE_URL}/documents \\
  -H "Authorization: Bearer $ACCESS_TOKEN" \\
  -F "file=@expenses-policy-2026.docx" \\
  -F "file=@q4-forecast.xlsx"`,
    sampleResponse: `{
  "accepted": [
    {
      "id": "b55c0a18-9d2e-4e77-aa31-1f8c6d0b4e22",
      "filename": "expenses-policy-2026.docx",
      "format": "docx",
      "status": "processing",
      "uploaded_at": "2026-10-06T09:02:40Z"
    }
  ],
  "rejected": [
    {
      "filename": "q4-forecast.xlsx",
      "reason_code": "unsupported_format",
      "reason": "Only PDF, DOCX, TXT and Markdown files can be indexed."
    }
  ]
}`,
    errors: [
      { status: "401", code: "unauthenticated", when: "Missing or expired bearer token." },
      { status: "413", code: "file_too_large", when: "A file exceeds the 25 MB ceiling. The message states the file size and the limit." },
      { status: "415", code: "unsupported_format", when: "Every file in the request was an unsupported type." }
    ]
  },
  {
    id: "get-document-file",
    method: "GET",
    path: "/documents/{id}/file",
    group: "Documents",
    stability: "Stable",
    summary: "Fetch the original stored file behind a citation. This is the URL carried in citation.source_url for uploaded documents.",
    contentType: "application/octet-stream",
    request: [
      { name: "id", type: "uuid", required: true, where: "path", desc: "Document identifier." },
      { name: "disposition", type: "enum", required: false, where: "query", desc: "inline (default) or attachment." }
    ],
    response: [
      { name: "—", type: "binary", desc: "The stored file, with Content-Type and Content-Disposition set from the document record." }
    ],
    sample: `curl -L -o policy.pdf \\
  "${BASE_URL}/documents/2a7c9e51-0b44-4c8e-91f6-77d2a1c40e9b/file?disposition=attachment" \\
  -H "Authorization: Bearer $ACCESS_TOKEN"`,
    sampleResponse: `HTTP/1.1 200 OK
Content-Type: application/pdf
Content-Disposition: attachment; filename="contractor-engagement-policy-v4.pdf"
Content-Length: 418233`,
    errors: [
      { status: "401", code: "unauthenticated", when: "Missing or expired bearer token." },
      { status: "404", code: "document_not_found", when: "The document was deleted from the corpus or never existed." }
    ]
  },
  {
    id: "delete-document",
    method: "DELETE",
    path: "/documents/{id}",
    group: "Documents",
    stability: "Stable",
    summary: "Remove a document for everyone: the record, the stored file and all of its chunks and embeddings. Writes an audit_log entry with actor, document and timestamp.",
    contentType: "—",
    request: [
      { name: "id", type: "uuid", required: true, where: "path", desc: "Document identifier." }
    ],
    response: [
      { name: "—", type: "204 No Content", desc: "Empty body. Subsequent questions covered only by this document return not_covered." }
    ],
    sample: `curl -X DELETE \\
  ${BASE_URL}/documents/7e4411b0-3c92-4a5d-8f31-b0d2e6c7a119 \\
  -H "Authorization: Bearer $ACCESS_TOKEN"`,
    sampleResponse: `HTTP/1.1 204 No Content`,
    errors: [
      { status: "401", code: "unauthenticated", when: "Missing or expired bearer token." },
      { status: "404", code: "document_not_found", when: "Already deleted, or no such document." },
      { status: "409", code: "document_locked", when: "Processing is mid-flight. Retry once the status leaves processing." }
    ]
  },
  {
    id: "get-conversations",
    method: "GET",
    path: "/conversations",
    group: "Conversations",
    stability: "Stable",
    summary: "List the signed-in employee's own conversations, most recent first. A caller never sees another employee's transcripts.",
    contentType: "application/json",
    request: [
      { name: "limit", type: "integer", required: false, where: "query", desc: "Page size, 1–100. Defaults to 20." },
      { name: "cursor", type: "string", required: false, where: "query", desc: "Opaque pagination cursor." }
    ],
    response: [
      { name: "data", type: "Conversation[]", desc: "id, title (generated from the first question), created_at, message_count." },
      { name: "next_cursor", type: "string | null", desc: "Null on the final page." }
    ],
    sample: `curl "${BASE_URL}/conversations?limit=20" \\
  -H "Authorization: Bearer $ACCESS_TOKEN"`,
    sampleResponse: `{
  "data": [
    { "id": "c7a1f0e2…", "title": "Contractor notice periods", "created_at": "2026-10-06T09:14:02Z", "message_count": 6 },
    { "id": "1b8e44d0…", "title": "Expense limits for client dinners", "created_at": "2026-10-05T14:48:19Z", "message_count": 2 },
    { "id": "f0c21a93…", "title": "Who signs off a data request", "created_at": "2026-10-02T11:07:44Z", "message_count": 9 }
  ],
  "next_cursor": null
}`,
    errors: [
      { status: "401", code: "unauthenticated", when: "Missing or expired bearer token." }
    ]
  },
  {
    id: "post-conversations",
    method: "POST",
    path: "/conversations",
    group: "Conversations",
    stability: "Stable",
    summary: "Open an empty conversation. Usually unnecessary — posting to /answer without a conversation_id creates one and titles it from the first question.",
    contentType: "application/json",
    request: [
      { name: "title", type: "string", required: false, where: "body", desc: "Optional title. Generated from the first question when omitted." }
    ],
    response: [
      { name: "id", type: "uuid", desc: "New conversation identifier, owned by the caller." },
      { name: "title", type: "string | null", desc: "Null until the first answer completes." },
      { name: "created_at", type: "timestamp", desc: "ISO 8601, UTC." }
    ],
    sample: `curl -X POST ${BASE_URL}/conversations \\
  -H "Authorization: Bearer $ACCESS_TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{"title": "Onboarding questions"}'`,
    sampleResponse: `{
  "id": "e21b7c40-55aa-4f0c-9b1e-8d33c0a7f512",
  "title": "Onboarding questions",
  "created_at": "2026-10-06T09:20:11Z"
}`,
    errors: [
      { status: "401", code: "unauthenticated", when: "Missing or expired bearer token." }
    ]
  },
  {
    id: "get-conversation",
    method: "GET",
    path: "/conversations/{id}",
    group: "Conversations",
    stability: "Stable",
    summary: "Read a full transcript: every message in order with its citations still resolvable, so a reopened conversation renders exactly as it did in the chat UI.",
    contentType: "application/json",
    request: [
      { name: "id", type: "uuid", required: true, where: "path", desc: "Conversation identifier owned by the caller." }
    ],
    response: [
      { name: "id", type: "uuid", desc: "Conversation identifier." },
      { name: "title", type: "string", desc: "Generated or supplied title." },
      { name: "messages", type: "Message[]", desc: "role (user|assistant), content, not_covered, token_usage, created_at." },
      { name: "messages[].citations", type: "Citation[]", desc: "Citations attached to each assistant message." }
    ],
    sample: `curl ${BASE_URL}/conversations/c7a1f0e2-5b3d-4a19-9f55-0c2b6b8e4411 \\
  -H "Authorization: Bearer $ACCESS_TOKEN"`,
    sampleResponse: `{
  "id": "c7a1f0e2-5b3d-4a19-9f55-0c2b6b8e4411",
  "title": "Contractor notice periods",
  "messages": [
    { "role": "user", "content": "How much notice does a contractor give?", "created_at": "2026-10-06T09:14:02Z" },
    {
      "role": "assistant",
      "content": "Contractors give four weeks' written notice…",
      "not_covered": false,
      "citations": [ { "document_id": "2a7c9e51…", "source_type": "document", "chunk_index": 12 } ],
      "token_usage": { "prompt_tokens": 2480, "completion_tokens": 166 },
      "created_at": "2026-10-06T09:14:27Z"
    },
    { "role": "user", "content": "And who approves it?", "created_at": "2026-10-06T09:15:40Z" }
  ]
}`,
    errors: [
      { status: "401", code: "unauthenticated", when: "Missing or expired bearer token." },
      { status: "404", code: "conversation_not_found", when: "No such conversation, or it belongs to another employee." }
    ]
  },
  {
    id: "delete-conversation",
    method: "DELETE",
    path: "/conversations/{id}",
    group: "Conversations",
    stability: "Stable",
    summary: "Delete one of the caller's own conversations and its messages. It disappears from history immediately.",
    contentType: "—",
    request: [
      { name: "id", type: "uuid", required: true, where: "path", desc: "Conversation identifier owned by the caller." }
    ],
    response: [
      { name: "—", type: "204 No Content", desc: "Empty body." }
    ],
    sample: `curl -X DELETE \\
  ${BASE_URL}/conversations/1b8e44d0-77c2-4b90-8e51-3a0f9d2c6a74 \\
  -H "Authorization: Bearer $ACCESS_TOKEN"`,
    sampleResponse: `HTTP/1.1 204 No Content`,
    errors: [
      { status: "401", code: "unauthenticated", when: "Missing or expired bearer token." },
      { status: "404", code: "conversation_not_found", when: "No such conversation, or it belongs to another employee." }
    ]
  },
  {
    id: "post-feedback",
    method: "POST",
    path: "/messages/{id}/feedback",
    group: "Conversations",
    stability: "Beta",
    summary: "Record a thumbs up or down against an assistant message. One rating per user per message; posting again replaces the previous rating.",
    contentType: "application/json",
    request: [
      { name: "id", type: "uuid", required: true, where: "path", desc: "Assistant message identifier." },
      { name: "rating", type: "enum", required: true, where: "body", desc: "up or down." },
      { name: "comment", type: "string", required: false, where: "body", desc: "Optional free-text note, maximum 500 characters." }
    ],
    response: [
      { name: "id", type: "uuid", desc: "Feedback record identifier." },
      { name: "message_id", type: "uuid", desc: "Message the rating applies to." },
      { name: "rating", type: "enum", desc: "Stored rating." },
      { name: "created_at", type: "timestamp", desc: "ISO 8601, UTC." }
    ],
    sample: `curl -X POST \\
  ${BASE_URL}/messages/9f1c2d44-7a80-4f61-b0ac-2d5e9a1f33b2/feedback \\
  -H "Authorization: Bearer $ACCESS_TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{"rating": "up"}'`,
    sampleResponse: `{
  "id": "d0a9f3b1-6c47-4e28-bb05-9f2e1c7a4408",
  "message_id": "9f1c2d44-7a80-4f61-b0ac-2d5e9a1f33b2",
  "rating": "up",
  "created_at": "2026-10-06T09:16:03Z"
}`,
    errors: [
      { status: "400", code: "invalid_rating", when: "rating is absent or not up / down." },
      { status: "401", code: "unauthenticated", when: "Missing or expired bearer token." },
      { status: "404", code: "message_not_found", when: "No such message, or it is not visible to the caller." }
    ]
  },
  {
    id: "get-me",
    method: "GET",
    path: "/me",
    group: "Account",
    stability: "Stable",
    summary: "Return the session identity resolved from the IdP token: subject, display name and group claims. Group claims are stored so the Knowledge Admin role can be switched on later without re-integration.",
    contentType: "application/json",
    request: [],
    response: [
      { name: "id", type: "uuid", desc: "Internal user identifier, the owner key for conversations." },
      { name: "idp_subject", type: "string", desc: "Subject identifier returned by the corporate IdP." },
      { name: "display_name", type: "string", desc: "Name shown in the UI." },
      { name: "group_claims", type: "string[]", desc: "Groups from the token, stored verbatim." },
      { name: "created_at", type: "timestamp", desc: "First sign-in, ISO 8601." }
    ],
    sample: `curl ${BASE_URL}/me \\
  -H "Authorization: Bearer $ACCESS_TOKEN"`,
    sampleResponse: `{
  "id": "a1d9c3f8-4b22-4f6e-9c10-77ab3e5d2201",
  "idp_subject": "AAD|9f3c7e21-0b55-4a8d-bb31-c2e40a7f9d16",
  "display_name": "Satya Ganaraju",
  "group_claims": ["All-Employees", "Pilot-KB-Users"],
  "created_at": "2026-09-28T07:31:12Z"
}`,
    errors: [
      { status: "401", code: "unauthenticated", when: "Missing or expired bearer token. The client should restart the OIDC flow." }
    ]
  },
  {
    id: "get-openapi",
    method: "GET",
    path: "/openapi.json",
    group: "Account",
    stability: "Stable",
    summary: "The machine-readable OpenAPI 3.1 document for everything on this page, including the Citation and Document schemas. Generate a client from it rather than hand-writing one.",
    contentType: "application/json",
    request: [],
    response: [
      { name: "openapi", type: "string", desc: "Specification version, currently 3.1.0." },
      { name: "info", type: "object", desc: "title, version and the in-tenant deployment description." },
      { name: "paths", type: "object", desc: "Every endpoint listed on this page." },
      { name: "components.schemas", type: "object", desc: "Citation, Document, Conversation, Message, AnswerResponse, Error." }
    ],
    sample: `curl ${BASE_URL}/openapi.json \\
  -H "Authorization: Bearer $ACCESS_TOKEN" -o openapi.json

npx openapi-typescript openapi.json -o src/api/types.ts`,
    sampleResponse: `{
  "openapi": "3.1.0",
  "info": { "title": "Answer Engine API", "version": "1.3.0" },
  "paths": { "/answer": { "post": { "summary": "Ask a grounded question" } } },
  "components": { "schemas": { "Citation": { "type": "object" } } }
}`,
    errors: [
      { status: "401", code: "unauthenticated", when: "The specification sits behind the same SSO gate as the rest of the API." }
    ]
  }
];

const STREAM_EVENTS = [
  { name: "token", payload: '{ "delta": string }', when: "Emitted repeatedly as the answer is generated. Concatenate deltas in order." },
  { name: "citation", payload: "Citation", when: "One event per distinct source document, sent as each source is confirmed used." },
  { name: "usage", payload: '{ "prompt_tokens": int, "completion_tokens": int }', when: "Once, just before done. Recorded against the requesting user." },
  { name: "done", payload: '{ "message_id": uuid, "conversation_id": uuid, "not_covered": bool }', when: "Terminal event on success. Close the stream when received." },
  { name: "error", payload: '{ "code": string, "message": string }', when: "Terminal event on failure. Never present a partial answer as complete." }
];

const SCENARIOS = {
  grounded: {
    label: "Grounded answer with citations",
    ttft: "1.4 s",
    lines: [
      'event: token\ndata: {"delta":"Contractors give "}',
      'event: token\ndata: {"delta":"four weeks\' written notice "}',
      'event: token\ndata: {"delta":"to their engaging manager."}',
      'event: citation\ndata: {"document_id":"2a7c9e51…","source_type":"document","source_id":"contractor-engagement-policy-v4.pdf","chunk_index":12,\n       "source_url":"/v1/documents/2a7c9e51…/file","snippet":"Contractors shall provide four weeks\' written notice…"}',
      'event: usage\ndata: {"prompt_tokens":2480,"completion_tokens":166}',
      'event: done\ndata: {"message_id":"9f1c2d44…","conversation_id":"c7a1f0e2…","not_covered":false}'
    ]
  },
  not_covered: {
    label: "Not covered by the knowledge base",
    ttft: "0.9 s",
    lines: [
      'event: token\ndata: {"delta":"Nothing in the knowledge base covers "}',
      'event: token\ndata: {"delta":"this question, so I can\'t answer it. "}',
      'event: token\ndata: {"delta":"Try uploading a document that does."}',
      'event: usage\ndata: {"prompt_tokens":1120,"completion_tokens":34}',
      'event: done\ndata: {"message_id":"5c08be77…","conversation_id":"c7a1f0e2…","not_covered":true,"citations":[]}'
    ]
  },
  partial: {
    label: "Partly covered — answered and refused in one turn",
    ttft: "1.6 s",
    lines: [
      'event: token\ndata: {"delta":"Expense claims over £150 need director approval."}',
      'event: token\ndata: {"delta":" The knowledge base does not cover "}',
      'event: token\ndata: {"delta":"the contractor equivalent of this rule."}',
      'event: citation\ndata: {"document_id":"b55c0a18…","source_type":"document","source_id":"expenses-policy-2026.docx","chunk_index":4,\n       "source_url":"/v1/documents/b55c0a18…/file","snippet":"Any single claim above £150 requires director approval…"}',
      'event: usage\ndata: {"prompt_tokens":3015,"completion_tokens":98}',
      'event: done\ndata: {"message_id":"77b1aa32…","conversation_id":"c7a1f0e2…","not_covered":false}'
    ]
  }
};

const METHOD_STYLE = {
  GET: { bg: "#E4EBE7", fg: "#1C5D4A" },
  POST: { bg: "#1C5D4A", fg: "#FFFFFF" },
  DELETE: { bg: "#8C2F39", fg: "#FFFFFF" }
};

const MethodTag = ({ method, size }) => {
  const s = METHOD_STYLE[method] || METHOD_STYLE.GET;
  return (
    <span
      className={
        "inline-flex items-center justify-center font-semibold tracking-wide rounded " +
        (size === "lg" ? "text-xs px-2.5 py-1" : "text-[11px] px-2 py-0.5")
      }
      style={{ backgroundColor: s.bg, color: s.fg }}
    >
      {method}
    </span>
  );
};

const FieldTable = ({ caption, columns, rows, renderRow }) => (
  <div className="overflow-x-auto rounded-lg border border-[#D6DCD8] bg-white">
    <table className="w-full border-collapse text-sm">
      <caption className="sr-only">{caption}</caption>
      <thead>
        <tr className="border-b border-[#D6DCD8] bg-[#F6F8F6]">
          {columns.map((c) => (
            <th
              key={c}
              scope="col"
              className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider"
              style={{ color: "#5E6A66" }}
            >
              {c}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>{rows.map(renderRow)}</tbody>
    </table>
  </div>
);

export default function Screen() {
  const navigate = useNavigate();
  const [query, setQuery] = React.useState("");
  const [selectedId, setSelectedId] = React.useState("post-answer");
  const [tab, setTab] = React.useState("request");
  const [copied, setCopied] = React.useState(null);
  const [scenario, setScenario] = React.useState("grounded");
  const [streamState, setStreamState] = React.useState("idle");
  const [shown, setShown] = React.useState(0);

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return ENDPOINTS;
    return ENDPOINTS.filter((e) =>
      (e.method + " " + e.path + " " + e.summary + " " + e.group).toLowerCase().includes(q)
    );
  }, [query]);

  const endpoint = ENDPOINTS.find((e) => e.id === selectedId) || ENDPOINTS[0];

  const tabs = React.useMemo(() => {
    const base = [
      { id: "request", label: "Request" },
      { id: "response", label: "Response" }
    ];
    if (endpoint.id === "post-answer") base.push({ id: "streaming", label: "Streaming" });
    base.push({ id: "errors", label: "Errors" });
    return base;
  }, [endpoint.id]);

  React.useEffect(() => {
    if (!tabs.some((t) => t.id === tab)) setTab("request");
  }, [tabs, tab]);

  React.useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(null), 1800);
    return () => clearTimeout(t);
  }, [copied]);

  const lines = SCENARIOS[scenario].lines;

  React.useEffect(() => {
    if (streamState !== "streaming") return;
    if (shown >= lines.length) {
      setStreamState("complete");
      return;
    }
    const t = setTimeout(() => setShown((n) => n + 1), 380);
    return () => clearTimeout(t);
  }, [streamState, shown, lines.length]);

  const doCopy = (text, key) => {
    try {
      if (navigator && navigator.clipboard) navigator.clipboard.writeText(text);
    } catch (e) {
      /* clipboard unavailable in sandbox */
    }
    setCopied(key);
  };

  const selectEndpoint = (id) => {
    setSelectedId(id);
    setTab("request");
  };

  const onTabKeyDown = (e, idx) => {
    let next = null;
    if (e.key === "ArrowRight") next = (idx + 1) % tabs.length;
    else if (e.key === "ArrowLeft") next = (idx - 1 + tabs.length) % tabs.length;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = tabs.length - 1;
    if (next !== null) {
      e.preventDefault();
      setTab(tabs[next].id);
      const el = document.getElementById("tab-" + tabs[next].id);
      if (el) el.focus();
    }
  };

  const CodeBlock = ({ code, copyKey, label }) => (
    <div className="relative rounded-lg border border-[#2A4A40]" style={{ backgroundColor: "#11261F" }}>
      <div className="flex items-center justify-between border-b border-[#2A4A40] px-4 py-2">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-[#A8C4B8]">{label}</span>
        <button
          type="button"
          onClick={() => doCopy(code, copyKey)}
          className={
            "inline-flex items-center gap-1.5 rounded px-2 py-1 text-xs font-medium text-[#DCE7E1] hover:bg-[#1D3A31] " +
            FOCUS
          }
        >
          {copied === copyKey ? (
            <Icons.Check className="h-3.5 w-3.5" aria-hidden="true" />
          ) : (
            <Icons.FileText className="h-3.5 w-3.5" aria-hidden="true" />
          )}
          {copied === copyKey ? "Copied" : "Copy"}
          <span className="sr-only"> {label}</span>
        </button>
      </div>
      <pre className="overflow-x-auto px-4 py-3.5 text-[12.5px] leading-relaxed text-[#E8F0EB]">
        <code>{code}</code>
      </pre>
    </div>
  );

  const groups = ["Answers", "Documents", "Conversations", "Account"].filter((g) =>
    filtered.some((e) => e.group === g)
  );

  const streamStatusText =
    streamState === "streaming"
      ? "Streaming. " + shown + " of " + lines.length + " events received."
      : streamState === "complete"
      ? "Stream complete. " + lines.length + " events received, connection closed."
      : streamState === "stopped"
      ? "Stopped via POST /answer/stop after " + shown + " events. Partial answer persisted."
      : "Idle. No request in flight.";

  return (
    <div style={{ fontFamily: brand.fontBody, color: "#1F2A26" }}>
      <div className="mx-auto max-w-[1440px] px-6 py-8 lg:px-10">
        {/* Header */}
        <header>
          <p
            className="text-[11px] font-semibold uppercase tracking-[0.14em]"
            style={{ color: brand.neutralColor }}
          >
            Answer engine · v1.3.0
          </p>
          <h1
            className="mt-2 text-3xl font-semibold tracking-tight"
            style={{ fontFamily: brand.fontHeading }}
          >
            API reference
          </h1>
          <p className="mt-3 max-w-3xl text-[15px] leading-relaxed" style={{ color: "#44524D" }}>
            The retrieve-ground-generate-cite engine sits behind this HTTP contract, not inside the web
            front end. A Teams or Slack client calls the same endpoints the chat UI does and gets the same
            streamed answers, the same citation objects and the same explicit refusal when the corpus does
            not cover a question.
          </p>

          <div className="mt-6 flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 rounded-lg border border-[#D6DCD8] bg-white px-3 py-2">
              <span className="text-xs font-medium" style={{ color: brand.neutralColor }}>
                Base URL
              </span>
              <code className="text-[13px]">{BASE_URL}</code>
              <button
                type="button"
                onClick={() => doCopy(BASE_URL, "base")}
                aria-label="Copy base URL"
                className={"rounded p-1 hover:bg-[#EEF2EF] " + FOCUS}
              >
                {copied === "base" ? (
                  <Icons.Check className="h-4 w-4" style={{ color: brand.primaryColor }} aria-hidden="true" />
                ) : (
                  <Icons.FileText className="h-4 w-4" style={{ color: brand.neutralColor }} aria-hidden="true" />
                )}
              </button>
            </div>

            <button
              type="button"
              onClick={() => doCopy(BASE_URL + "/openapi.json", "spec")}
              className={
                "inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold text-white " + FOCUS
              }
              style={{ backgroundColor: brand.primaryColor, borderRadius: brand.radius }}
            >
              <Icons.Download className="h-4 w-4" aria-hidden="true" />
              {copied === "spec" ? "Spec URL copied" : "Download openapi.json"}
            </button>

            <button
              type="button"
              onClick={() => navigate("getting-started")}
              className={
                "inline-flex items-center gap-2 rounded-lg border border-[#C9D2CD] bg-white px-4 py-2.5 text-sm font-semibold hover:bg-[#F6F8F6] " +
                FOCUS
              }
              style={{ color: brand.primaryColor, borderRadius: brand.radius }}
            >
              Getting started guide
              <Icons.ChevronRight className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>

          <div
            className="mt-6 flex gap-3 rounded-lg border px-4 py-3.5"
            style={{ borderColor: "#D9C4C7", backgroundColor: "#FBF2F3" }}
          >
            <Icons.AlertCircle
              className="mt-0.5 h-5 w-5 shrink-0"
              style={{ color: brand.accentColor }}
              aria-hidden="true"
            />
            <p className="text-sm leading-relaxed" style={{ color: "#4A3338" }}>
              <strong className="font-semibold">Authentication is required on every endpoint.</strong> Send a
              bearer token issued by the corporate IdP in the <code>Authorization</code> header. Unauthenticated
              requests are rejected with <code>401</code> and no corpus content is returned. All questions,
              chunks and document text are processed only by the model running in the company's own cloud
              tenant.
            </p>
          </div>
        </header>

        <div className="mt-10 grid gap-8 lg:grid-cols-[286px_minmax(0,1fr)]">
          {/* Endpoint index */}
          <aside className="lg:sticky lg:top-6 lg:self-start">
            <h2 className="text-sm font-semibold uppercase tracking-wider" style={{ color: brand.neutralColor }}>
              Endpoints
            </h2>

            <div className="mt-3">
              <label htmlFor="endpoint-filter" className="block text-sm font-medium">
                Filter endpoints
              </label>
              <div className="relative mt-1.5">
                <Icons.Search
                  className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2"
                  style={{ color: brand.neutralColor }}
                  aria-hidden="true"
                />
                <input
                  id="endpoint-filter"
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="answer, documents, DELETE…"
                  className={
                    "w-full rounded-lg border border-[#C9D2CD] bg-white py-2 pl-9 pr-3 text-sm placeholder:text-[#8A9893] " +
                    FOCUS
                  }
                  style={{ borderRadius: brand.radius }}
                />
              </div>
              <p className="mt-2 text-xs" style={{ color: brand.neutralColor }} aria-live="polite">
                {filtered.length} of {ENDPOINTS.length} endpoints shown
              </p>
            </div>

            {filtered.length === 0 ? (
              <div className="mt-4 rounded-lg border border-dashed border-[#C9D2CD] bg-white px-4 py-8 text-center">
                <Icons.Search
                  className="mx-auto h-6 w-6"
                  style={{ color: brand.neutralColor }}
                  aria-hidden="true"
                />
                <p className="mt-3 text-sm font-medium">No endpoints match “{query}”</p>
                <p className="mt-1 text-xs" style={{ color: brand.neutralColor }}>
                  Try a path fragment such as /answer, or a method.
                </p>
                <button
                  type="button"
                  onClick={() => setQuery("")}
                  className={
                    "mt-4 inline-flex items-center gap-1.5 rounded-lg border border-[#C9D2CD] px-3 py-1.5 text-sm font-medium hover:bg-[#F6F8F6] " +
                    FOCUS
                  }
                  style={{ color: brand.primaryColor }}
                >
                  <Icons.X className="h-3.5 w-3.5" aria-hidden="true" />
                  Clear filter
                </button>
              </div>
            ) : (
              <nav className="mt-5 space-y-5" aria-label="API endpoints">
                {groups.map((group) => (
                  <div key={group}>
                    <h3
                      className="px-1 text-[11px] font-semibold uppercase tracking-[0.12em]"
                      style={{ color: brand.neutralColor }}
                    >
                      {group}
                    </h3>
                    <ul className="mt-2 space-y-1">
                      {filtered
                        .filter((e) => e.group === group)
                        .map((e) => {
                          const active = e.id === endpoint.id;
                          return (
                            <li key={e.id}>
                              <button
                                type="button"
                                onClick={() => selectEndpoint(e.id)}
                                aria-current={active ? "true" : undefined}
                                className={
                                  "flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[13px] " +
                                  FOCUS +
                                  (active ? " font-semibold" : " hover:bg-[#E7EBE8]")
                                }
                                style={
                                  active
                                    ? { backgroundColor: "#E1EAE5", color: brand.primaryColor }
                                    : { color: "#2E3A36" }
                                }
                              >
                                <MethodTag method={e.method} />
                                <span className="truncate font-mono">{e.path}</span>
                              </button>
                            </li>
                          );
                        })}
                    </ul>
                  </div>
                ))}
              </nav>
            )}
          </aside>

          {/* Endpoint detail */}
          <main>
            <article className="rounded-xl border border-[#D6DCD8] bg-white">
              <div className="border-b border-[#D6DCD8] px-6 py-6 lg:px-8">
                <div className="flex flex-wrap items-center gap-3">
                  <MethodTag method={endpoint.method} size="lg" />
                  <h2 className="font-mono text-xl font-semibold tracking-tight" style={{ fontFamily: brand.fontHeading }}>
                    {endpoint.path}
                  </h2>
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-[#C9D2CD] bg-[#F6F8F6] px-2.5 py-1 text-xs font-medium">
                    <Icons.CheckCircle className="h-3.5 w-3.5" style={{ color: brand.primaryColor }} aria-hidden="true" />
                    {endpoint.stability}
                  </span>
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-[#C9D2CD] bg-[#F6F8F6] px-2.5 py-1 text-xs font-medium">
                    <Icons.User className="h-3.5 w-3.5" style={{ color: brand.neutralColor }} aria-hidden="true" />
                    Bearer token required
                  </span>
                  <span className="rounded-full border border-[#C9D2CD] bg-[#F6F8F6] px-2.5 py-1 font-mono text-xs">
                    {endpoint.contentType}
                  </span>
                </div>

                <p className="mt-4 max-w-3xl text-[15px] leading-relaxed" style={{ color: "#44524D" }}>
                  {endpoint.summary}
                </p>
                {endpoint.notes && (
                  <p className="mt-2 max-w-3xl text-sm leading-relaxed" style={{ color: brand.neutralColor }}>
                    {endpoint.notes}
                  </p>
                )}
              </div>

              {/* Tabs */}
              <div className="border-b border-[#D6DCD8] px-6 lg:px-8">
                <div role="tablist" aria-label={endpoint.method + " " + endpoint.path + " documentation"} className="flex gap-1">
                  {tabs.map((t, i) => {
                    const active = tab === t.id;
                    return (
                      <button
                        key={t.id}
                        id={"tab-" + t.id}
                        role="tab"
                        type="button"
                        aria-selected={active}
                        aria-controls={"panel-" + t.id}
                        tabIndex={active ? 0 : -1}
                        onClick={() => setTab(t.id)}
                        onKeyDown={(e) => onTabKeyDown(e, i)}
                        className={
                          "-mb-px border-b-2 px-4 py-3 text-sm " +
                          FOCUS +
                          (active ? " font-semibold" : " border-transparent font-medium hover:text-[#1C5D4A]")
                        }
                        style={
                          active
                            ? { borderColor: brand.primaryColor, color: brand.primaryColor }
                            : { color: brand.neutralColor }
                        }
                      >
                        {t.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div
                id={"panel-" + tab}
                role="tabpanel"
                aria-labelledby={"tab-" + tab}
                tabIndex={0}
                className={"px-6 py-7 lg:px-8 " + FOCUS}
              >
                {tab === "request" && (
                  <div className="space-y-7">
                    <section>
                      <h3 className="text-base font-semibold" style={{ fontFamily: brand.fontHeading }}>
                        Parameters
                      </h3>
                      {endpoint.request.length === 0 ? (
                        <p className="mt-2 text-sm" style={{ color: brand.neutralColor }}>
                          This endpoint takes no parameters. The caller is identified entirely by the bearer token.
                        </p>
                      ) : (
                        <div className="mt-3">
                          <FieldTable
                            caption={"Parameters for " + endpoint.method + " " + endpoint.path}
                            columns={["Field", "In", "Type", "Required", "Description"]}
                            rows={endpoint.request}
                            renderRow={(f) => (
                              <tr key={f.name} className="border-b border-[#EAEEEB] last:border-0 align-top">
                                <td className="px-4 py-3 font-mono text-[13px] font-medium">{f.name}</td>
                                <td className="px-4 py-3 text-[13px]" style={{ color: brand.neutralColor }}>
                                  {f.where}
                                </td>
                                <td className="px-4 py-3 font-mono text-[13px]" style={{ color: brand.neutralColor }}>
                                  {f.type}
                                </td>
                                <td className="px-4 py-3 text-[13px]">
                                  {f.required ? (
                                    <span className="inline-flex items-center gap-1 font-medium" style={{ color: brand.accentColor }}>
                                      <Icons.Check className="h-3.5 w-3.5" aria-hidden="true" />
                                      Required
                                    </span>
                                  ) : (
                                    <span style={{ color: brand.neutralColor }}>Optional</span>
                                  )}
                                </td>
                                <td className="px-4 py-3 text-[13px] leading-relaxed" style={{ color: "#44524D" }}>
                                  {f.desc}
                                </td>
                              </tr>
                            )}
                          />
                        </div>
                      )}
                    </section>

                    <section>
                      <h3 className="mb-3 text-base font-semibold" style={{ fontFamily: brand.fontHeading }}>
                        Example request
                      </h3>
                      <CodeBlock code={endpoint.sample} copyKey={endpoint.id + "-req"} label="cURL" />
                    </section>
                  </div>
                )}

                {tab === "response" && (
                  <div className="space-y-7">
                    <section>
                      <h3 className="text-base font-semibold" style={{ fontFamily: brand.fontHeading }}>
                        Response fields
                      </h3>
                      <div className="mt-3">
                        <FieldTable
                          caption={"Response fields for " + endpoint.method + " " + endpoint.path}
                          columns={["Field", "Type", "Description"]}
                          rows={endpoint.response}
                          renderRow={(f) => (
                            <tr key={f.name} className="border-b border-[#EAEEEB] last:border-0 align-top">
                              <td className="px-4 py-3 font-mono text-[13px] font-medium">{f.name}</td>
                              <td className="px-4 py-3 font-mono text-[13px]" style={{ color: brand.neutralColor }}>
                                {f.type}
                              </td>
                              <td className="px-4 py-3 text-[13px] leading-relaxed" style={{ color: "#44524D" }}>
                                {f.desc}
                              </td>
                            </tr>
                          )}
                        />
                      </div>
                    </section>

                    {endpoint.id === "post-answer" && (
                      <section>
                        <h3 className="text-base font-semibold" style={{ fontFamily: brand.fontHeading }}>
                          The citation object
                        </h3>
                        <p className="mt-2 max-w-3xl text-sm leading-relaxed" style={{ color: "#44524D" }}>
                          Every citation carries source type, source identifier and a source URL. Release one only
                          emits <code>document</code>, but a Confluence page or Jira issue renders through the same
                          shape with no change to the answer format.
                        </p>
                        <div className="mt-3">
                          <FieldTable
                            caption="Citation object fields"
                            columns={["Field", "Type", "Description"]}
                            rows={CITATION_FIELDS}
                            renderRow={(f) => (
                              <tr key={f.name} className="border-b border-[#EAEEEB] last:border-0 align-top">
                                <td className="px-4 py-3 font-mono text-[13px] font-medium">{f.name}</td>
                                <td className="px-4 py-3 font-mono text-[13px]" style={{ color: brand.neutralColor }}>
                                  {f.type}
                                </td>
                                <td className="px-4 py-3 text-[13px] leading-relaxed" style={{ color: "#44524D" }}>
                                  {f.desc}
                                </td>
                              </tr>
                            )}
                          />
                        </div>
                      </section>
                    )}

                    <section>
                      <h3 className="mb-3 text-base font-semibold" style={{ fontFamily: brand.fontHeading }}>
                        Example response
                      </h3>
                      <CodeBlock
                        code={endpoint.sampleResponse}
                        copyKey={endpoint.id + "-res"}
                        label="200 OK"
                      />
                    </section>
                  </div>
                )}

                {tab === "streaming" && (
                  <div className="space-y-7">
                    <section>
                      <h3 className="text-base font-semibold" style={{ fontFamily: brand.fontHeading }}>
                        Server-sent events
                      </h3>
                      <p className="mt-2 max-w-3xl text-sm leading-relaxed" style={{ color: "#44524D" }}>
                        With <code>stream: true</code> the response is <code>text/event-stream</code>. The first
                        token is expected within roughly five seconds at pilot concurrency. Read events until{" "}
                        <code>done</code> or <code>error</code> arrives.
                      </p>
                      <div className="mt-3">
                        <FieldTable
                          caption="Streamed event types"
                          columns={["Event", "Payload", "When it is sent"]}
                          rows={STREAM_EVENTS}
                          renderRow={(e) => (
                            <tr key={e.name} className="border-b border-[#EAEEEB] last:border-0 align-top">
                              <td className="px-4 py-3 font-mono text-[13px] font-medium">{e.name}</td>
                              <td className="px-4 py-3 font-mono text-[12.5px]" style={{ color: brand.neutralColor }}>
                                {e.payload}
                              </td>
                              <td className="px-4 py-3 text-[13px] leading-relaxed" style={{ color: "#44524D" }}>
                                {e.when}
                              </td>
                            </tr>
                          )}
                        />
                      </div>
                    </section>

                    <section className="rounded-lg border border-[#D6DCD8] bg-[#F6F8F6] p-5">
                      <h3 className="text-base font-semibold" style={{ fontFamily: brand.fontHeading }}>
                        Replay a recorded stream
                      </h3>
                      <p className="mt-1.5 text-sm" style={{ color: "#44524D" }}>
                        Three recorded responses from the pilot corpus, replayed at the rate the engine emitted them.
                      </p>

                      <div className="mt-4 flex flex-wrap items-end gap-4">
                        <div className="min-w-[280px] flex-1">
                          <label htmlFor="scenario" className="block text-sm font-medium">
                            Recorded response
                          </label>
                          <select
                            id="scenario"
                            value={scenario}
                            onChange={(e) => {
                              setScenario(e.target.value);
                              setShown(0);
                              setStreamState("idle");
                            }}
                            className={"mt-1.5 w-full rounded-lg border border-[#C9D2CD] bg-white px-3 py-2 text-sm " + FOCUS}
                            style={{ borderRadius: brand.radius }}
                          >
                            {Object.keys(SCENARIOS).map((k) => (
                              <option key={k} value={k}>
                                {SCENARIOS[k].label}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              setShown(0);
                              setStreamState("streaming");
                            }}
                            disabled={streamState === "streaming"}
                            className={
                              "inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold text-white disabled:opacity-50 " +
                              FOCUS
                            }
                            style={{ backgroundColor: brand.primaryColor, borderRadius: brand.radius }}
                          >
                            <Icons.ArrowRight className="h-4 w-4" aria-hidden="true" />
                            {streamState === "complete" || streamState === "stopped" ? "Replay stream" : "Send request"}
                          </button>
                          <button
                            type="button"
                            onClick={() => setStreamState("stopped")}
                            disabled={streamState !== "streaming"}
                            className={
                              "inline-flex items-center gap-2 rounded-lg border border-[#C9D2CD] bg-white px-4 py-2 text-sm font-semibold disabled:opacity-50 " +
                              FOCUS
                            }
                            style={{ color: brand.accentColor, borderRadius: brand.radius }}
                          >
                            <Icons.X className="h-4 w-4" aria-hidden="true" />
                            Stop
                          </button>
                        </div>
                      </div>

                      <dl className="mt-5 grid gap-4 sm:grid-cols-3">
                        <div className="rounded-lg border border-[#D6DCD8] bg-white px-4 py-3">
                          <dt className="text-xs font-medium uppercase tracking-wider" style={{ color: brand.neutralColor }}>
                            Time to first token
                          </dt>
                          <dd className="mt-1 text-lg font-semibold">{SCENARIOS[scenario].ttft}</dd>
                        </div>
                        <div className="rounded-lg border border-[#D6DCD8] bg-white px-4 py-3">
                          <dt className="text-xs font-medium uppercase tracking-wider" style={{ color: brand.neutralColor }}>
                            Events in stream
                          </dt>
                          <dd className="mt-1 text-lg font-semibold">{lines.length}</dd>
                        </div>
                        <div className="rounded-lg border border-[#D6DCD8] bg-white px-4 py-3">
                          <dt className="text-xs font-medium uppercase tracking-wider" style={{ color: brand.neutralColor }}>
                            not_covered
                          </dt>
                          <dd className="mt-1 text-lg font-semibold font-mono">
                            {scenario === "not_covered" ? "true" : "false"}
                          </dd>
                        </div>
                      </dl>

                      <p className="mt-4 flex items-center gap-2 text-sm" role="status" aria-live="polite">
                        {streamState === "streaming" ? (
                          <Icons.Clock className="h-4 w-4" style={{ color: brand.primaryColor }} aria-hidden="true" />
                        ) : streamState === "complete" ? (
                          <Icons.CheckCircle className="h-4 w-4" style={{ color: brand.primaryColor }} aria-hidden="true" />
                        ) : streamState === "stopped" ? (
                          <Icons.AlertCircle className="h-4 w-4" style={{ color: brand.accentColor }} aria-hidden="true" />
                        ) : (
                          <Icons.Clock className="h-4 w-4" style={{ color: brand.neutralColor }} aria-hidden="true" />
                        )}
                        <span style={{ color: "#44524D" }}>{streamStatusText}</span>
                      </p>

                      <div className="mt-3 rounded-lg border border-[#2A4A40]" style={{ backgroundColor: "#11261F" }}>
                        <div className="border-b border-[#2A4A40] px-4 py-2 text-[11px] font-semibold uppercase tracking-wider text-[#A8C4B8]">
                          text/event-stream
                        </div>
                        <pre className="min-h-[190px] overflow-x-auto px-4 py-3.5 text-[12.5px] leading-relaxed text-[#E8F0EB]">
                          <code>
                            {shown === 0
                              ? "// Press Send request to replay the recorded stream."
                              : lines.slice(0, shown).join("\n\n")}
                            {streamState === "stopped" && shown > 0
                              ? '\n\n// client called POST /answer/stop — stream closed'
                              : ""}
                          </code>
                        </pre>
                      </div>
                    </section>
                  </div>
                )}

                {tab === "errors" && (
                  <div className="space-y-6">
                    <section>
                      <h3 className="text-base font-semibold" style={{ fontFamily: brand.fontHeading }}>
                        Error responses
                      </h3>
                      <p className="mt-2 max-w-3xl text-sm leading-relaxed" style={{ color: "#44524D" }}>
                        Errors share one body shape: <code>{'{ "code": string, "message": string }'}</code>. A
                        question the corpus does not cover is <em>not</em> an error — it returns <code>200</code>{" "}
                        with <code>not_covered: true</code> and empty citations.
                      </p>
                      <div className="mt-3">
                        <FieldTable
                          caption={"Error responses for " + endpoint.method + " " + endpoint.path}
                          columns={["Status", "Code", "When it happens"]}
                          rows={endpoint.errors}
                          renderRow={(e) => (
                            <tr key={e.code} className="border-b border-[#EAEEEB] last:border-0 align-top">
                              <td className="px-4 py-3">
                                <span
                                  className="inline-block rounded px-2 py-0.5 font-mono text-[12.5px] font-semibold"
                                  style={{
                                    backgroundColor: e.status.startsWith("2") ? "#E4EBE7" : "#F6E8EA",
                                    color: e.status.startsWith("2") ? brand.primaryColor : brand.accentColor
                                  }}
                                >
                                  {e.status}
                                </span>
                              </td>
                              <td className="px-4 py-3 font-mono text-[13px] font-medium">{e.code}</td>
                              <td className="px-4 py-3 text-[13px] leading-relaxed" style={{ color: "#44524D" }}>
                                {e.when}
                              </td>
                            </tr>
                          )}
                        />
                      </div>
                    </section>

                    <section>
                      <h3 className="mb-3 text-base font-semibold" style={{ fontFamily: brand.fontHeading }}>
                        Example error body
                      </h3>
                      <CodeBlock
                        code={`{
  "code": "${endpoint.errors[0].code}",
  "message": "${endpoint.errors[0].when}"
}`}
                        copyKey={endpoint.id + "-err"}
                        label={endpoint.errors[0].status + " response"}
                      />
                    </section>
                  </div>
                )}
              </div>
            </article>

            <section className="mt-8 rounded-xl border border-[#D6DCD8] bg-white px-6 py-6 lg:px-8">
              <h2 className="text-base font-semibold" style={{ fontFamily: brand.fontHeading }}>
                Before you build against this
              </h2>
              <ul className="mt-3 space-y-2.5 text-sm leading-relaxed" style={{ color: "#44524D" }}>
                <li className="flex gap-2.5">
                  <Icons.Check className="mt-0.5 h-4 w-4 shrink-0" style={{ color: brand.primaryColor }} aria-hidden="true" />
                  The refusal behaviour lives in the engine, not the web UI. A Teams client that ignores{" "}
                  <code>not_covered</code> will present a refusal as if it were an answer.
                </li>
                <li className="flex gap-2.5">
                  <Icons.Check className="mt-0.5 h-4 w-4 shrink-0" style={{ color: brand.primaryColor }} aria-hidden="true" />
                  Render every citation you receive. No substantive content is asserted without one, and your
                  front end is what makes that visible.
                </li>
                <li className="flex gap-2.5">
                  <Icons.Check className="mt-0.5 h-4 w-4 shrink-0" style={{ color: brand.primaryColor }} aria-hidden="true" />
                  Chat and embedding calls go through one in-tenant provider abstraction. Swapping the model is a
                  configuration change and leaves this contract untouched.
                </li>
                <li className="flex gap-2.5">
                  <Icons.Check className="mt-0.5 h-4 w-4 shrink-0" style={{ color: brand.primaryColor }} aria-hidden="true" />
                  Token usage is recorded per request against the calling user, so per-user caps can be switched on
                  later without re-instrumenting your client.
                </li>
              </ul>
              <div className="mt-5 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => navigate("chat")}
                  className={
                    "inline-flex items-center gap-2 rounded-lg border border-[#C9D2CD] px-4 py-2 text-sm font-semibold hover:bg-[#F6F8F6] " +
                    FOCUS
                  }
                  style={{ color: brand.primaryColor, borderRadius: brand.radius }}
                >
                  See the contract in use in Chat
                  <Icons.ChevronRight className="h-4 w-4" aria-hidden="true" />
                </button>
                <button
                  type="button"
                  onClick={() => navigate("documents")}
                  className={
                    "inline-flex items-center gap-2 rounded-lg border border-[#C9D2CD] px-4 py-2 text-sm font-semibold hover:bg-[#F6F8F6] " +
                    FOCUS
                  }
                  style={{ color: brand.primaryColor, borderRadius: brand.radius }}
                >
                  Browse the knowledge base
                  <Icons.ChevronRight className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>
            </section>
          </main>
        </div>
      </div>
    </div>
  );
}
