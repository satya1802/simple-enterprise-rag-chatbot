/**
 * Client for the real /documents endpoints.
 *
 * Kept separate from `lib/api.ts` (owned by US-002-2) because the multipart
 * upload must not carry the JSON `Content-Type` header that `apiFetch`
 * always sends -- the browser has to set its own `multipart/form-data`
 * boundary. Every call still sends `credentials: "include"` and surfaces
 * failures as `ApiError`, so screens can rely on a single shape.
 */
import { API_BASE_URL, ApiError } from "@/lib/api";

export interface DocumentItem {
  id: string;
  filename: string;
  format: string;
  uploader: string;
  uploaded_at: string;
  status: string;
  status_reason?: string | null;
}

export interface DocumentListResponse {
  items: DocumentItem[];
  total: number;
}

export interface DocumentUploadResult {
  document_id: string;
  filename: string;
  status: string;
}

export interface DocumentRejection {
  filename: string;
  reason: string;
}

export interface DocumentUploadResponse {
  accepted: DocumentUploadResult[];
  rejected: DocumentRejection[];
}

export interface ListDocumentsParams {
  q?: string;
  page?: number;
  page_size?: number;
}

async function readJson<T>(response: Response, method: string, path: string): Promise<T> {
  if (!response.ok) {
    throw new ApiError(response.status, `${method} ${path} failed: ${response.status}`);
  }
  return response.status === 204 ? (undefined as T) : ((await response.json()) as T);
}

export async function listDocuments(
  params: ListDocumentsParams = {},
): Promise<DocumentListResponse> {
  const search = new URLSearchParams();
  if (params.q) search.set("q", params.q);
  search.set("page", String(params.page ?? 1));
  search.set("page_size", String(params.page_size ?? 20));
  const path = `/documents?${search.toString()}`;
  const response = await fetch(`${API_BASE_URL}${path}`, { credentials: "include" });
  return readJson<DocumentListResponse>(response, "GET", path);
}

export async function uploadDocuments(files: File[]): Promise<DocumentUploadResponse> {
  const formData = new FormData();
  files.forEach((file) => formData.append("files", file));
  const response = await fetch(`${API_BASE_URL}/documents`, {
    method: "POST",
    credentials: "include",
    body: formData,
  });
  return readJson<DocumentUploadResponse>(response, "POST", "/documents");
}

export async function deleteDocument(documentId: string): Promise<void> {
  const path = `/documents/${documentId}`;
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: "DELETE",
    credentials: "include",
  });
  await readJson<void>(response, "DELETE", path);
}

export function documentFileUrl(documentId: string): string {
  return `${API_BASE_URL}/documents/${documentId}/file`;
}
