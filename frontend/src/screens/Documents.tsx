/* eslint-disable @typescript-eslint/no-unused-vars */
import React from "react";

import * as UI from "@/lib/ui";
import { Icons } from "@/lib/icons";
import { brand } from "@/lib/brand";
import { useNavigate } from "@/lib/navigate";
import { useAuth } from "@/lib/auth";
import { ApiError } from "@/lib/api";
import {
  deleteDocument,
  documentFileUrl,
  listDocuments,
  uploadDocuments,
  type DocumentItem,
} from "@/lib/documents";

const { Card, Input, Label, Table, THead, TBody, TR, TH, TD } = UI;
const {
  Plus,
  Search,
  X,
  Bell,
  FileText,
  Package,
  Calendar,
  Clock,
  Trash,
  Download,
  Upload,
  ArrowRight,
  AlertCircle,
  CheckCircle,
} = Icons;

const MAX_BYTES = 25 * 1024 * 1024;
const MAX_LABEL = "25 MB";
const ALLOWED_EXT = ["pdf", "docx", "txt", "md"];
const PAGE_SIZE = 10;

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const STATUSES = ["Ready", "Processing", "No readable text", "Failed"];

function fmtSize(bytes: number) {
  if (bytes >= 1048576) return (bytes / 1048576).toFixed(1) + " MB";
  return Math.max(1, Math.round(bytes / 1024)) + " KB";
}

function fmtDate(iso: string) {
  const d = new Date(iso);
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()} · ${hh}:${mm}`;
}

function extOf(name: string) {
  const parts = String(name).split(".");
  return parts.length > 1 ? (parts.pop() as string).toLowerCase() : "";
}

const STATUS_STYLE: Record<string, { fg: string; bg: string; bd: string; icon: string }> = {
  Ready: {
    fg: "#1C5D4A",
    bg: "rgba(28, 93, 74, 0.10)",
    bd: "rgba(28, 93, 74, 0.30)",
    icon: "CheckCircle",
  },
  Processing: {
    fg: "#49534F",
    bg: "rgba(94, 106, 102, 0.12)",
    bd: "rgba(94, 106, 102, 0.30)",
    icon: "Clock",
  },
  "No readable text": {
    fg: "#8C2F39",
    bg: "rgba(140, 47, 57, 0.09)",
    bd: "rgba(140, 47, 57, 0.28)",
    icon: "AlertCircle",
  },
  Failed: {
    fg: "#8C2F39",
    bg: "rgba(140, 47, 57, 0.09)",
    bd: "rgba(140, 47, 57, 0.28)",
    icon: "AlertCircle",
  },
};

const StatusPill = ({ status }: { status: string }) => {
  const s = STATUS_STYLE[status] || STATUS_STYLE.Processing;
  const Icon = Icons[s.icon];
  return (
    <span
      className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-1 text-xs font-medium"
      style={{ color: s.fg, backgroundColor: s.bg, borderColor: s.bd }}
    >
      {Icon ? <Icon className="h-3.5 w-3.5" aria-hidden="true" /> : null}
      {status}
    </span>
  );
};

const Btn = ({
  variant = "secondary",
  className = "",
  style = {},
  children,
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: string }) => {
  const base =
    "inline-flex items-center justify-center gap-2 text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[#1C5D4A] disabled:opacity-50 disabled:cursor-not-allowed";
  const variants: Record<string, { cls: string; st: React.CSSProperties }> = {
    primary: {
      cls: "px-4 py-2 text-white hover:opacity-90",
      st: { backgroundColor: brand.primaryColor },
    },
    secondary: {
      cls: "px-4 py-2 border bg-white hover:bg-[#F1F3F1]",
      st: { borderColor: "#D3D9D5", color: "#283330" },
    },
    danger: {
      cls: "px-4 py-2 text-white hover:opacity-90",
      st: { backgroundColor: brand.accentColor },
    },
    ghost: { cls: "px-2.5 py-2 hover:bg-[#EDF0EE]", st: { color: brand.neutralColor } },
  };
  const v = variants[variant] || variants.secondary;
  return (
    <button
      type="button"
      {...rest}
      className={`${base} ${v.cls} ${className}`}
      style={{ borderRadius: brand.radius, ...v.st, ...style }}
    >
      {children}
    </button>
  );
};

export default function Screen() {
  const navigate = useNavigate();
  const { user, refresh } = useAuth();
  const currentUserName = user?.display_name ?? "";

  const [documents, setDocuments] = React.useState<DocumentItem[]>([]);
  const [total, setTotal] = React.useState(0);
  const [page, setPage] = React.useState(1);
  const [loading, setLoading] = React.useState(true);
  const [loadError, setLoadError] = React.useState("");

  const [staged, setStaged] = React.useState<File[]>([]);
  const [rejections, setRejections] = React.useState<Array<{ name: string; reason: string }>>([]);
  const [formError, setFormError] = React.useState("");
  const [banner, setBanner] = React.useState<{ tone: string; text: string } | null>(null);
  const [live, setLive] = React.useState("");
  const [dragging, setDragging] = React.useState(false);
  const [uploading, setUploading] = React.useState(false);

  const [query, setQuery] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState("all");

  const [deleteTarget, setDeleteTarget] = React.useState<DocumentItem | null>(null);
  const [deleting, setDeleting] = React.useState(false);

  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const dialogRef = React.useRef<HTMLDivElement>(null);
  const returnFocusRef = React.useRef<HTMLElement | null>(null);
  const didMountRef = React.useRef(false);

  const handle401 = React.useCallback(
    async (err: unknown): Promise<boolean> => {
      if (err instanceof ApiError && err.status === 401) {
        await refresh();
        return true;
      }
      return false;
    },
    [refresh],
  );

  const fetchDocuments = React.useCallback(
    async (targetPage: number, q: string) => {
      setLoading(true);
      setLoadError("");
      try {
        const res = await listDocuments({ q, page: targetPage, page_size: PAGE_SIZE });
        setDocuments(res.items);
        setTotal(res.total);
        setPage(targetPage);
      } catch (err) {
        if (await handle401(err)) return;
        setLoadError(
          "The knowledge base could not be loaded. Check your connection and try again.",
        );
      } finally {
        setLoading(false);
      }
    },
    [handle401],
  );

  /* ---- initial load, then search-driven refetch ---- */
  React.useEffect(() => {
    if (!didMountRef.current) {
      didMountRef.current = true;
      void fetchDocuments(1, "");
      return;
    }
    const timer = setTimeout(() => {
      void fetchDocuments(1, query);
    }, 300);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  /* ---- delete dialog focus management ---- */
  React.useEffect(() => {
    if (deleteTarget && dialogRef.current) {
      const first = dialogRef.current.querySelector("button");
      if (first) (first as HTMLElement).focus();
    }
  }, [deleteTarget]);

  const closeDialog = () => {
    setDeleteTarget(null);
    if (returnFocusRef.current && returnFocusRef.current.focus) returnFocusRef.current.focus();
  };

  const onDialogKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Escape") {
      e.stopPropagation();
      closeDialog();
      return;
    }
    if (e.key === "Tab" && dialogRef.current) {
      const nodes = Array.from(
        dialogRef.current.querySelectorAll<HTMLElement & { disabled?: boolean }>(
          "button, [href], input, select, textarea",
        ),
      ).filter((n) => !n.disabled);
      if (nodes.length === 0) return;
      const first = nodes[0];
      const last = nodes[nodes.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
  };

  /* ---- staging files ---- */
  const stageFiles = (fileList: FileList | null | undefined) => {
    const incoming = Array.from(fileList || []);
    if (incoming.length === 0) return;
    setFormError("");
    setStaged((prev) => {
      const names = new Set(prev.map((f) => f.name));
      return [...prev, ...incoming.filter((f) => !names.has(f.name))];
    });
  };

  const removeStaged = (name: string) => setStaged((prev) => prev.filter((f) => f.name !== name));

  const handleUpload = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (staged.length === 0) {
      setFormError("Choose at least one file to upload.");
      return;
    }
    const valid: File[] = [];
    const clientRejected: Array<{ name: string; reason: string }> = [];
    staged.forEach((f) => {
      const ext = extOf(f.name);
      if (!ALLOWED_EXT.includes(ext)) {
        clientRejected.push({
          name: f.name,
          reason: `Unsupported format${ext ? ` “.${ext}”` : ""}. The knowledge base accepts PDF, DOCX, TXT and Markdown (.md) only.`,
        });
      } else if (f.size > MAX_BYTES) {
        clientRejected.push({
          name: f.name,
          reason: `${fmtSize(f.size)} exceeds the ${MAX_LABEL} maximum upload size.`,
        });
      } else {
        valid.push(f);
      }
    });

    setFormError("");

    if (valid.length === 0) {
      setRejections(clientRejected);
      setStaged([]);
      if (fileInputRef.current) fileInputRef.current.value = "";
      setBanner(null);
      setLive("No files were accepted.");
      return;
    }

    setUploading(true);
    try {
      const res = await uploadDocuments(valid);
      setRejections([
        ...clientRejected,
        ...res.rejected.map((r) => ({ name: r.filename, reason: r.reason })),
      ]);
      setStaged([]);
      if (fileInputRef.current) fileInputRef.current.value = "";

      if (res.accepted.length) {
        setBanner({
          tone: "success",
          text: `${res.accepted.length} ${res.accepted.length === 1 ? "file" : "files"} added to the shared company-wide knowledge base. They are now visible and answerable to all employees as they finish processing.`,
        });
        setLive(`${res.accepted.length} uploaded. Processing started.`);
        setQuery("");
        await fetchDocuments(1, "");
      } else {
        setBanner(null);
        setLive("No files were accepted.");
      }
    } catch (err) {
      if (await handle401(err)) return;
      setRejections(clientRejected);
      setStaged([]);
      if (fileInputRef.current) fileInputRef.current.value = "";
      setFormError("Upload failed. Check your connection and try again.");
    } finally {
      setUploading(false);
    }
  };

  /* ---- deletion ---- */
  const askDelete = (doc: DocumentItem, e?: React.SyntheticEvent) => {
    returnFocusRef.current = e && e.currentTarget ? (e.currentTarget as HTMLElement) : null;
    setDeleteTarget(doc);
  };

  const confirmDelete = async () => {
    const doc = deleteTarget;
    if (!doc) return;
    setDeleting(true);
    try {
      await deleteDocument(doc.id);
      setBanner({
        tone: "neutral",
        text: `“${doc.filename}” was removed for all employees — its file, chunks and embeddings are deleted from the index.`,
      });
      setLive(`${doc.filename} deleted from the shared corpus.`);
      setDeleteTarget(null);
      await fetchDocuments(page, query);
    } catch (err) {
      if (await handle401(err)) return;
      setBanner({ tone: "neutral", text: `Could not delete “${doc.filename}”. Try again.` });
    } finally {
      setDeleting(false);
    }
  };

  const openFile = (doc: DocumentItem) => {
    window.open(documentFileUrl(doc.id), "_blank", "noopener,noreferrer");
  };

  /* ---- client-side status filter on the current page ---- */
  const visible = documents.filter((d) => statusFilter === "all" || d.status === statusFilter);

  const filtersActive = query.trim() !== "" || statusFilter !== "all";
  const clearFilters = () => {
    setQuery("");
    setStatusFilter("all");
  };

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const goPrev = () => {
    if (page > 1) void fetchDocuments(page - 1, query);
  };
  const goNext = () => {
    if (page < totalPages) void fetchDocuments(page + 1, query);
  };

  const corpusEmpty = !loading && !loadError && total === 0 && query.trim() === "";
  const noMatches = !loading && !loadError && total === 0 && query.trim() !== "";
  const statusFilterHidAll = !loading && !loadError && total > 0 && visible.length === 0;

  return (
    <div
      className="mx-auto w-full max-w-6xl px-6 py-8"
      style={{ fontFamily: brand.fontBody, color: "#242E2B" }}
    >
      <span className="sr-only" aria-live="polite">
        {live}
      </span>

      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <h1
            className="text-3xl font-semibold tracking-tight"
            style={{ fontFamily: brand.fontHeading, color: "#15201D" }}
          >
            Knowledge base
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6" style={{ color: brand.neutralColor }}>
            Every document the chatbot can answer from, shared across the company. Upload PDF, DOCX,
            TXT or Markdown files; each one is extracted, chunked, embedded and written to the
            combined index.
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          <Btn variant="secondary" onClick={() => navigate("getting-started")}>
            <Icons.FileText className="h-4 w-4" aria-hidden="true" />
            Getting started
          </Btn>
          <Btn variant="primary" onClick={() => navigate("chat")}>
            Ask a question
            <Icons.ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Btn>
        </div>
      </div>

      {/* Shared-corpus notice */}
      <div
        role="note"
        className="mt-6 flex items-start gap-3 border-l-4 p-4"
        style={{
          borderColor: brand.accentColor,
          backgroundColor: "rgba(140, 47, 57, 0.06)",
          borderRadius: brand.radius,
        }}
      >
        <Icons.AlertCircle
          className="mt-0.5 h-5 w-5 shrink-0"
          aria-hidden="true"
          style={{ color: brand.accentColor }}
        />
        <p className="text-sm leading-6" style={{ color: "#5C2027" }}>
          <strong className="font-semibold">Uploads are shared with everyone.</strong> Anything
          added here joins the shared company-wide knowledge base, is answerable to all employees
          and can be deleted by any employee. Upload only content that is safe for every colleague
          to read — there is no private or restricted option in this release.
        </p>
      </div>

      {/* Upload */}
      <section aria-labelledby="upload-heading" className="mt-8">
        <UI.Card>
          <div className="p-6">
            <h2
              id="upload-heading"
              className="text-lg font-semibold"
              style={{ fontFamily: brand.fontHeading, color: "#15201D" }}
            >
              Add documents
            </h2>
            <p className="mt-1 text-sm" style={{ color: brand.neutralColor }}>
              PDF, DOCX, TXT and Markdown (.md), up to {MAX_LABEL} per file. PDFs are read as text
              only — scanned or image-only files will index no text.
            </p>

            <form className="mt-5" onSubmit={handleUpload} noValidate>
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragging(true);
                }}
                onDragLeave={() => setDragging(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragging(false);
                  stageFiles(e.dataTransfer && e.dataTransfer.files);
                }}
                className="border-2 border-dashed p-6"
                style={{
                  borderColor: dragging ? brand.primaryColor : "#CDD5D1",
                  backgroundColor: dragging ? "rgba(28, 93, 74, 0.05)" : "#FBFCFB",
                  borderRadius: brand.radius,
                }}
              >
                <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                  <div className="min-w-0">
                    <UI.Label htmlFor="document-files">Choose files to upload</UI.Label>
                    <input
                      ref={fileInputRef}
                      id="document-files"
                      name="documents"
                      type="file"
                      multiple
                      accept=".pdf,.docx,.txt,.md"
                      aria-describedby="upload-help"
                      onChange={(e) => stageFiles(e.target.files)}
                      className="mt-2 block w-full max-w-md text-sm file:mr-3 file:rounded-md file:border file:border-[#D3D9D5] file:bg-white file:px-3 file:py-2 file:text-sm file:font-medium file:text-[#283330] hover:file:bg-[#F1F3F1] focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[#1C5D4A]"
                      style={{ color: brand.neutralColor }}
                    />
                    <p
                      id="upload-help"
                      className="mt-2 text-xs"
                      style={{ color: brand.neutralColor }}
                    >
                      Or drag files onto this area. Each file is tracked separately with its own
                      processing status.
                    </p>
                  </div>
                  <Btn type="submit" variant="primary" className="shrink-0" disabled={uploading}>
                    <Icons.Upload className="h-4 w-4" aria-hidden="true" />
                    {uploading
                      ? "Uploading…"
                      : staged.length > 0
                        ? `Upload ${staged.length} ${staged.length === 1 ? "file" : "files"}`
                        : "Upload to shared corpus"}
                  </Btn>
                </div>

                {staged.length > 0 && (
                  <div className="mt-5">
                    <h3
                      className="text-xs font-semibold uppercase tracking-wide"
                      style={{ color: brand.neutralColor }}
                    >
                      Selected ({staged.length})
                    </h3>
                    <ul className="mt-2 flex flex-wrap gap-2">
                      {staged.map((f) => (
                        <li
                          key={f.name}
                          className="flex items-center gap-2 border bg-white py-1 pl-3 pr-1 text-sm"
                          style={{ borderColor: "#DEE3E0", borderRadius: brand.radius }}
                        >
                          <Icons.FileText
                            className="h-4 w-4"
                            aria-hidden="true"
                            style={{ color: brand.neutralColor }}
                          />
                          <span className="max-w-[18rem] truncate">{f.name}</span>
                          <span className="text-xs" style={{ color: brand.neutralColor }}>
                            {fmtSize(f.size)}
                          </span>
                          <Btn
                            variant="ghost"
                            className="px-1.5 py-1"
                            aria-label={`Remove ${f.name} from the selection`}
                            onClick={() => removeStaged(f.name)}
                          >
                            <Icons.X className="h-4 w-4" aria-hidden="true" />
                          </Btn>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {formError && (
                  <p
                    className="mt-4 flex items-center gap-2 text-sm font-medium"
                    style={{ color: brand.accentColor }}
                    role="alert"
                  >
                    <Icons.AlertCircle className="h-4 w-4" aria-hidden="true" />
                    {formError}
                  </p>
                )}
              </div>
            </form>

            {rejections.length > 0 && (
              <div
                role="alert"
                className="mt-5 border p-4"
                style={{
                  borderColor: "rgba(140, 47, 57, 0.35)",
                  backgroundColor: "rgba(140, 47, 57, 0.06)",
                  borderRadius: brand.radius,
                }}
              >
                <div className="flex items-start justify-between gap-4">
                  <h3 className="text-sm font-semibold" style={{ color: "#5C2027" }}>
                    {rejections.length} {rejections.length === 1 ? "file was" : "files were"} not
                    accepted — nothing from {rejections.length === 1 ? "it" : "them"} reached the
                    index
                  </h3>
                  <Btn
                    variant="ghost"
                    className="px-1.5 py-1"
                    aria-label="Dismiss rejected file messages"
                    onClick={() => setRejections([])}
                  >
                    <Icons.X className="h-4 w-4" aria-hidden="true" />
                  </Btn>
                </div>
                <ul className="mt-3 space-y-2">
                  {rejections.map((r) => (
                    <li key={r.name} className="text-sm leading-6" style={{ color: "#5C2027" }}>
                      <span className="font-medium">{r.name}</span> — {r.reason}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </UI.Card>
      </section>

      {banner && (
        <div
          role="status"
          className="mt-6 flex items-start justify-between gap-4 border p-4"
          style={{
            borderColor: banner.tone === "success" ? "rgba(28, 93, 74, 0.30)" : "#DEE3E0",
            backgroundColor: banner.tone === "success" ? "rgba(28, 93, 74, 0.07)" : "#FFFFFF",
            borderRadius: brand.radius,
          }}
        >
          <p className="flex items-start gap-3 text-sm leading-6" style={{ color: "#263330" }}>
            {banner.tone === "success" ? (
              <Icons.CheckCircle
                className="mt-0.5 h-5 w-5 shrink-0"
                aria-hidden="true"
                style={{ color: brand.primaryColor }}
              />
            ) : (
              <Icons.FileText
                className="mt-0.5 h-5 w-5 shrink-0"
                aria-hidden="true"
                style={{ color: brand.neutralColor }}
              />
            )}
            {banner.text}
          </p>
          <Btn
            variant="ghost"
            className="px-1.5 py-1"
            aria-label="Dismiss notification"
            onClick={() => setBanner(null)}
          >
            <Icons.X className="h-4 w-4" aria-hidden="true" />
          </Btn>
        </div>
      )}

      {/* Document list */}
      <section aria-labelledby="corpus-heading" className="mt-8 mb-4">
        <UI.Card>
          <div className="p-6">
            <div className="flex flex-col gap-1">
              <h2
                id="corpus-heading"
                className="text-lg font-semibold"
                style={{ fontFamily: brand.fontHeading, color: "#15201D" }}
              >
                Documents in the corpus
              </h2>
              <p className="text-sm" style={{ color: brand.neutralColor }}>
                Visible to every employee, whoever uploaded them.
              </p>
            </div>

            {/* Toolbar */}
            <div className="mt-5 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
                <div className="w-full sm:w-72">
                  <UI.Label htmlFor="doc-search">Search by filename</UI.Label>
                  <div className="relative mt-1.5">
                    <Icons.Search
                      className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2"
                      aria-hidden="true"
                      style={{ color: brand.neutralColor }}
                    />
                    <UI.Input
                      id="doc-search"
                      type="search"
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      placeholder="e.g. expense policy"
                      className="pl-9"
                    />
                  </div>
                </div>

                <div className="w-full sm:w-56">
                  <UI.Label htmlFor="doc-status">Status</UI.Label>
                  <select
                    id="doc-status"
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="mt-1.5 h-10 w-full border bg-white px-3 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[#1C5D4A]"
                    style={{ borderColor: "#D3D9D5", borderRadius: brand.radius, color: "#283330" }}
                  >
                    <option value="all">All statuses</option>
                    {STATUSES.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex items-center gap-3">
                {filtersActive && (
                  <Btn variant="secondary" onClick={clearFilters}>
                    <Icons.X className="h-4 w-4" aria-hidden="true" />
                    Clear filters
                  </Btn>
                )}
              </div>
            </div>

            <p className="mt-4 text-sm" style={{ color: brand.neutralColor }} aria-live="polite">
              {loading
                ? "Loading documents…"
                : `Showing ${visible.length} of ${total} ${total === 1 ? "document" : "documents"}`}
            </p>

            {/* Loading / error / empty states / table */}
            {loading ? (
              <div
                className="mt-4 border border-dashed px-6 py-12 text-center"
                style={{ borderColor: "#CDD5D1", borderRadius: brand.radius }}
                role="status"
              >
                <p className="text-sm" style={{ color: brand.neutralColor }}>
                  Loading the knowledge base…
                </p>
              </div>
            ) : loadError ? (
              <div
                role="alert"
                className="mt-4 border px-6 py-10 text-center"
                style={{
                  borderColor: "rgba(140, 47, 57, 0.35)",
                  backgroundColor: "rgba(140, 47, 57, 0.06)",
                  borderRadius: brand.radius,
                }}
              >
                <Icons.AlertCircle
                  className="mx-auto h-8 w-8"
                  aria-hidden="true"
                  style={{ color: brand.accentColor }}
                />
                <h3 className="mt-3 text-base font-semibold" style={{ color: "#5C2027" }}>
                  {loadError}
                </h3>
                <div className="mt-5">
                  <Btn variant="secondary" onClick={() => void fetchDocuments(page, query)}>
                    Try again
                  </Btn>
                </div>
              </div>
            ) : corpusEmpty ? (
              <div
                className="mt-4 border border-dashed px-6 py-12 text-center"
                style={{ borderColor: "#CDD5D1", borderRadius: brand.radius }}
              >
                <Icons.Package
                  className="mx-auto h-8 w-8"
                  aria-hidden="true"
                  style={{ color: brand.neutralColor }}
                />
                <h3 className="mt-3 text-base font-semibold" style={{ color: "#15201D" }}>
                  The knowledge base is empty
                </h3>
                <p
                  className="mx-auto mt-2 max-w-md text-sm leading-6"
                  style={{ color: brand.neutralColor }}
                >
                  Until a document is uploaded the chatbot will answer every question with “not
                  covered by the knowledge base”. Upload a PDF, DOCX, TXT or Markdown file to get
                  started.
                </p>
                <div className="mt-5">
                  <Btn
                    variant="primary"
                    onClick={() => fileInputRef.current && fileInputRef.current.focus()}
                  >
                    <Icons.Plus className="h-4 w-4" aria-hidden="true" />
                    Upload a document
                  </Btn>
                </div>
              </div>
            ) : noMatches || statusFilterHidAll ? (
              <div
                className="mt-4 border border-dashed px-6 py-12 text-center"
                style={{ borderColor: "#CDD5D1", borderRadius: brand.radius }}
              >
                <Icons.Search
                  className="mx-auto h-8 w-8"
                  aria-hidden="true"
                  style={{ color: brand.neutralColor }}
                />
                <h3 className="mt-3 text-base font-semibold" style={{ color: "#15201D" }}>
                  No documents match your filters
                </h3>
                <p
                  className="mx-auto mt-2 max-w-md text-sm leading-6"
                  style={{ color: brand.neutralColor }}
                >
                  Nothing in the corpus matches{" "}
                  {query.trim() ? `“${query.trim()}”` : "the current filters"}. Try a different
                  filename or clear the filters.
                </p>
                <div className="mt-5">
                  <Btn variant="secondary" onClick={clearFilters}>
                    Clear filters
                  </Btn>
                </div>
              </div>
            ) : (
              <>
                <div className="mt-4 overflow-x-auto">
                  <UI.Table>
                    <UI.THead>
                      <UI.TR>
                        <UI.TH scope="col">Document</UI.TH>
                        <UI.TH scope="col">Uploaded by</UI.TH>
                        <UI.TH scope="col">Uploaded</UI.TH>
                        <UI.TH scope="col">Status</UI.TH>
                        <UI.TH scope="col">
                          <span className="sr-only">Actions</span>
                        </UI.TH>
                      </UI.TR>
                    </UI.THead>
                    <UI.TBody>
                      {visible.map((d) => (
                        <UI.TR key={d.id}>
                          <UI.TD>
                            <div className="flex items-start gap-3">
                              <Icons.FileText
                                className="mt-0.5 h-4 w-4 shrink-0"
                                aria-hidden="true"
                                style={{ color: brand.neutralColor }}
                              />
                              <div className="min-w-0 max-w-[16rem] sm:max-w-xs">
                                <button
                                  type="button"
                                  onClick={() => openFile(d)}
                                  aria-label={`Open ${d.filename}`}
                                  title={d.filename}
                                  className="block w-full truncate text-left text-sm font-medium underline-offset-2 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[#1C5D4A]"
                                  style={{ color: brand.primaryColor, borderRadius: brand.radius }}
                                >
                                  {d.filename}
                                </button>
                                <p className="mt-1 text-xs" style={{ color: brand.neutralColor }}>
                                  {d.format}
                                </p>
                              </div>
                            </div>
                          </UI.TD>
                          <UI.TD>
                            <span className="text-sm">
                              {d.uploader}
                              {currentUserName && d.uploader === currentUserName && (
                                <span
                                  className="ml-1 text-xs"
                                  style={{ color: brand.neutralColor }}
                                >
                                  (you)
                                </span>
                              )}
                            </span>
                          </UI.TD>
                          <UI.TD>
                            <span
                              className="whitespace-nowrap text-sm"
                              style={{ color: brand.neutralColor }}
                            >
                              {fmtDate(d.uploaded_at)}
                            </span>
                          </UI.TD>
                          <UI.TD>
                            <StatusPill status={d.status} />
                            {d.status_reason && (
                              <p
                                className="mt-2 max-w-sm text-xs leading-5"
                                style={{ color: "#6B3036" }}
                              >
                                {d.status_reason}
                              </p>
                            )}
                          </UI.TD>
                          <UI.TD>
                            <div className="flex items-center justify-end gap-1">
                              <Btn
                                variant="ghost"
                                aria-label={`Open ${d.filename}`}
                                onClick={() => openFile(d)}
                              >
                                <Icons.Download className="h-4 w-4" aria-hidden="true" />
                              </Btn>
                              <Btn
                                variant="ghost"
                                aria-label={`Delete ${d.filename} from the shared corpus`}
                                onClick={(e) => askDelete(d, e)}
                                style={{ color: brand.accentColor }}
                              >
                                <Icons.Trash className="h-4 w-4" aria-hidden="true" />
                              </Btn>
                            </div>
                          </UI.TD>
                        </UI.TR>
                      ))}
                    </UI.TBody>
                  </UI.Table>
                </div>

                {totalPages > 1 && (
                  <div className="mt-4 flex items-center justify-between">
                    <p className="text-sm" style={{ color: brand.neutralColor }}>
                      Page {page} of {totalPages}
                    </p>
                    <div className="flex gap-2">
                      <Btn variant="secondary" onClick={goPrev} disabled={page <= 1}>
                        Previous
                      </Btn>
                      <Btn variant="secondary" onClick={goNext} disabled={page >= totalPages}>
                        Next
                      </Btn>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </UI.Card>
      </section>

      {/* Delete confirmation dialog */}
      {deleteTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={closeDialog}
        >
          <div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-title"
            aria-describedby="delete-desc"
            onKeyDown={onDialogKeyDown}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-lg bg-white p-6 shadow-xl"
            style={{ borderRadius: brand.radius }}
          >
            <h2
              id="delete-title"
              className="text-lg font-semibold"
              style={{ fontFamily: brand.fontHeading, color: "#15201D" }}
            >
              Delete “{deleteTarget.filename}” for everyone?
            </h2>
            <p id="delete-desc" className="mt-3 text-sm leading-6" style={{ color: "#3C4743" }}>
              This removes the document, its stored file and all of its chunks and embeddings from
              the shared corpus. Every employee loses access to it, and the chatbot will stop citing
              it — if nothing else covers the topic it will answer “not covered by the knowledge
              base”. This cannot be undone.
            </p>
            <dl
              className="mt-4 grid grid-cols-2 gap-3 border p-4 text-sm"
              style={{ borderColor: "#DEE3E0", borderRadius: brand.radius }}
            >
              <div>
                <dt
                  className="text-xs uppercase tracking-wide"
                  style={{ color: brand.neutralColor }}
                >
                  Uploaded by
                </dt>
                <dd className="mt-1">{deleteTarget.uploader}</dd>
              </div>
              <div>
                <dt
                  className="text-xs uppercase tracking-wide"
                  style={{ color: brand.neutralColor }}
                >
                  Status
                </dt>
                <dd className="mt-1">
                  <StatusPill status={deleteTarget.status} />
                </dd>
              </div>
            </dl>
            <div className="mt-6 flex justify-end gap-2">
              <Btn variant="secondary" onClick={closeDialog} disabled={deleting}>
                Cancel
              </Btn>
              <Btn variant="danger" onClick={() => void confirmDelete()} disabled={deleting}>
                <Icons.Trash className="h-4 w-4" aria-hidden="true" />
                {deleting ? "Deleting…" : "Delete for all employees"}
              </Btn>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
