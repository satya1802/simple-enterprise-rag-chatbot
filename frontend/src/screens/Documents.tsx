/* eslint-disable @typescript-eslint/no-unused-vars */
import React from "react";

import * as UI from "@/lib/ui";
import { Icons } from "@/lib/icons";
import { brand } from "@/lib/brand";
import { useNavigate } from "@/lib/navigate";

const { Card, Input, Label, Table, THead, TBody, TR, TH, TD } = UI;
const { Plus, Search, X, Bell, FileText, Package, Calendar, Clock, Trash, Download, Upload, ArrowRight, AlertCircle, CheckCircle } = Icons;

const MAX_BYTES = 25 * 1024 * 1024;
const MAX_LABEL = "25 MB";
const ALLOWED_EXT = ["pdf", "docx", "txt", "md"];

const CURRENT_USER = "Satya Ganaraju";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const STATUSES = ["Ready", "Processing", "No readable text", "Failed"];

const INITIAL_DOCUMENTS = [
  {
    id: "doc_8f21",
    filename: "Expense-Policy-FIN-204.pdf",
    format: "PDF",
    size_bytes: 1887437,
    uploader: "Priya Raghunathan",
    uploaded_at: "2026-10-06T09:12:00",
    status: "Ready",
    status_reason: "",
  },
  {
    id: "doc_8e07",
    filename: "Security-Incident-Response-v4.pdf",
    format: "PDF",
    size_bytes: 3565158,
    uploader: "Lena Hoffmann",
    uploaded_at: "2026-10-06T08:55:00",
    status: "Processing",
    status_reason: "",
  },
  {
    id: "doc_8d55",
    filename: "Customer-Support-Escalation-Matrix.docx",
    format: "DOCX",
    size_bytes: 757760,
    uploader: "Dana Whitfield",
    uploaded_at: "2026-10-05T17:21:00",
    status: "Processing",
    status_reason: "",
  },
  {
    id: "doc_8c90",
    filename: "Onboarding-Checklist-2026.docx",
    format: "DOCX",
    size_bytes: 626688,
    uploader: "Marcus Bell",
    uploaded_at: "2026-10-05T16:40:00",
    status: "Ready",
    status_reason: "",
  },
  {
    id: "doc_8b12",
    filename: "ATLAS-Release-Runbook.md",
    format: "MD",
    size_bytes: 49152,
    uploader: CURRENT_USER,
    uploaded_at: "2026-10-05T11:03:00",
    status: "Ready",
    status_reason: "",
  },
  {
    id: "doc_8a44",
    filename: "Finance-Close-Calendar-FY26.pdf",
    format: "PDF",
    size_bytes: 2202010,
    uploader: "Tomas Lindqvist",
    uploaded_at: "2026-10-04T15:58:00",
    status: "Failed",
    status_reason:
      "The file is corrupt and could not be parsed (unexpected end of file). Delete it and upload a fresh export.",
  },
  {
    id: "doc_89f3",
    filename: "Q3-Vendor-Assessment-scan.pdf",
    format: "PDF",
    size_bytes: 10066330,
    uploader: "Dana Whitfield",
    uploaded_at: "2026-10-04T14:22:00",
    status: "No readable text",
    status_reason:
      "No text layer was found. Release one reads text-only PDFs — scanned or image-only files are not read. Re-upload a text PDF or a DOCX version.",
  },
  {
    id: "doc_88a1",
    filename: "Contractor-Travel-Rates.txt",
    format: "TXT",
    size_bytes: 11264,
    uploader: "Joaquín Ferrer",
    uploaded_at: "2026-10-03T10:06:00",
    status: "Ready",
    status_reason: "",
  },
  {
    id: "doc_8792",
    filename: "Data-Retention-Standard-SEC-118.pdf",
    format: "PDF",
    size_bytes: 1258291,
    uploader: "Amara Okonjo",
    uploaded_at: "2026-10-02T13:47:00",
    status: "Ready",
    status_reason: "",
  },
  {
    id: "doc_8650",
    filename: "HR-Leave-Guidelines-2026.docx",
    format: "DOCX",
    size_bytes: 839680,
    uploader: "Marcus Bell",
    uploaded_at: "2026-10-02T09:30:00",
    status: "Failed",
    status_reason: "The document is password-protected, so no text could be extracted.",
  },
  {
    id: "doc_8533",
    filename: "Procurement-Thresholds.md",
    format: "MD",
    size_bytes: 22528,
    uploader: CURRENT_USER,
    uploaded_at: "2026-10-01T16:12:00",
    status: "Ready",
    status_reason: "",
  },
  {
    id: "doc_8420",
    filename: "Office-Access-and-Badging.txt",
    format: "TXT",
    size_bytes: 7168,
    uploader: "Priya Raghunathan",
    uploaded_at: "2026-09-30T11:55:00",
    status: "Ready",
    status_reason: "",
  },
  {
    id: "doc_8318",
    filename: "Remote-Work-Standard-HR-087.pdf",
    format: "PDF",
    size_bytes: 983040,
    uploader: "Amara Okonjo",
    uploaded_at: "2026-09-29T14:08:00",
    status: "Ready",
    status_reason: "",
  },
  {
    id: "doc_8205",
    filename: "ATLAS-Sprint-42-Retro-Notes.md",
    format: "MD",
    size_bytes: 36864,
    uploader: "Joaquín Ferrer",
    uploaded_at: "2026-09-29T09:44:00",
    status: "Ready",
    status_reason: "",
  },
  {
    id: "doc_8101",
    filename: "Brand-and-Tone-Guidelines-2026.pdf",
    format: "PDF",
    size_bytes: 5557453,
    uploader: "Lena Hoffmann",
    uploaded_at: "2026-09-28T15:20:00",
    status: "Ready",
    status_reason: "",
  },
];

function fmtSize(bytes) {
  if (bytes >= 1048576) return (bytes / 1048576).toFixed(1) + " MB";
  return Math.max(1, Math.round(bytes / 1024)) + " KB";
}

function fmtDate(iso) {
  const d = new Date(iso);
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()} · ${hh}:${mm}`;
}

function extOf(name) {
  const parts = String(name).split(".");
  return parts.length > 1 ? parts.pop().toLowerCase() : "";
}

const STATUS_STYLE = {
  Ready: { fg: "#1C5D4A", bg: "rgba(28, 93, 74, 0.10)", bd: "rgba(28, 93, 74, 0.30)", icon: "CheckCircle" },
  Processing: { fg: "#49534F", bg: "rgba(94, 106, 102, 0.12)", bd: "rgba(94, 106, 102, 0.30)", icon: "Clock" },
  "No readable text": { fg: "#8C2F39", bg: "rgba(140, 47, 57, 0.09)", bd: "rgba(140, 47, 57, 0.28)", icon: "AlertCircle" },
  Failed: { fg: "#8C2F39", bg: "rgba(140, 47, 57, 0.09)", bd: "rgba(140, 47, 57, 0.28)", icon: "AlertCircle" },
};

const StatusPill = ({ status }) => {
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

const Btn = ({ variant = "secondary", className = "", style = {}, children, ...rest }) => {
  const base =
    "inline-flex items-center justify-center gap-2 text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[#1C5D4A] disabled:opacity-50 disabled:cursor-not-allowed";
  const variants = {
    primary: { cls: "px-4 py-2 text-white hover:opacity-90", st: { backgroundColor: brand.primaryColor } },
    secondary: {
      cls: "px-4 py-2 border bg-white hover:bg-[#F1F3F1]",
      st: { borderColor: "#D3D9D5", color: "#283330" },
    },
    danger: { cls: "px-4 py-2 text-white hover:opacity-90", st: { backgroundColor: brand.accentColor } },
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
  const [documents, setDocuments] = React.useState(INITIAL_DOCUMENTS);
  const [staged, setStaged] = React.useState([]);
  const [rejections, setRejections] = React.useState([]);
  const [formError, setFormError] = React.useState("");
  const [banner, setBanner] = React.useState(null);
  const [live, setLive] = React.useState("");
  const [dragging, setDragging] = React.useState(false);

  const [query, setQuery] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState("all");
  const [mineOnly, setMineOnly] = React.useState(false);

  const [deleteTarget, setDeleteTarget] = React.useState(null);

  const fileInputRef = React.useRef(null);
  const dialogRef = React.useRef(null);
  const returnFocusRef = React.useRef(null);
  const deadlines = React.useRef({});

  /* ---- indexing pipeline: Processing -> Ready / No readable text ---- */
  React.useEffect(() => {
    const timers = [];
    documents
      .filter((d) => d.status === "Processing")
      .forEach((d, i) => {
        if (!deadlines.current[d.id]) deadlines.current[d.id] = Date.now() + 6000 + i * 2500;
        const delay = Math.max(500, deadlines.current[d.id] - Date.now());
        timers.push(
          setTimeout(() => {
            setDocuments((prev) =>
              prev.map((x) => {
                if (x.id !== d.id) return x;
                const scanned = x.format === "PDF" && /scan|image|photo/i.test(x.filename);
                return scanned
                  ? {
                      ...x,
                      status: "No readable text",
                      status_reason:
                        "No text layer was found. Release one reads text-only PDFs — scanned or image-only files are not read.",
                    }
                  : { ...x, status: "Ready", status_reason: "" };
              })
            );
            setLive(`${d.filename} finished processing and is now answerable.`);
          }, delay)
        );
      });
    return () => timers.forEach(clearTimeout);
  }, [documents]);

  /* ---- delete dialog focus management ---- */
  React.useEffect(() => {
    if (deleteTarget && dialogRef.current) {
      const first = dialogRef.current.querySelector("button");
      if (first) first.focus();
    }
  }, [deleteTarget]);

  const closeDialog = () => {
    setDeleteTarget(null);
    if (returnFocusRef.current && returnFocusRef.current.focus) returnFocusRef.current.focus();
  };

  const onDialogKeyDown = (e) => {
    if (e.key === "Escape") {
      e.stopPropagation();
      closeDialog();
      return;
    }
    if (e.key === "Tab" && dialogRef.current) {
      const nodes = Array.from(dialogRef.current.querySelectorAll("button, [href], input, select, textarea")).filter(
        (n) => !n.disabled
      );
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
  const stageFiles = (fileList) => {
    const incoming = Array.from(fileList || []).map((f) => ({ name: f.name, size: f.size }));
    if (incoming.length === 0) return;
    setFormError("");
    setStaged((prev) => {
      const names = new Set(prev.map((f) => f.name));
      return [...prev, ...incoming.filter((f) => !names.has(f.name))];
    });
  };

  const removeStaged = (name) => setStaged((prev) => prev.filter((f) => f.name !== name));

  const handleUpload = (e) => {
    e.preventDefault();
    if (staged.length === 0) {
      setFormError("Choose at least one file to upload.");
      return;
    }
    const accepted = [];
    const refused = [];
    staged.forEach((f) => {
      const ext = extOf(f.name);
      if (!ALLOWED_EXT.includes(ext)) {
        refused.push({
          name: f.name,
          reason: `Unsupported format${ext ? ` “.${ext}”` : ""}. The knowledge base accepts PDF, DOCX, TXT and Markdown (.md) only.`,
        });
      } else if (f.size > MAX_BYTES) {
        refused.push({
          name: f.name,
          reason: `${fmtSize(f.size)} exceeds the ${MAX_LABEL} maximum upload size.`,
        });
      } else {
        accepted.push(f);
      }
    });

    const stamp = Date.now();
    const newDocs = accepted.map((f, i) => ({
      id: `doc_${stamp.toString(36)}${i}`,
      filename: f.name,
      format: extOf(f.name).toUpperCase(),
      size_bytes: f.size,
      uploader: CURRENT_USER,
      uploaded_at: new Date().toISOString(),
      status: "Processing",
      status_reason: "",
    }));

    if (newDocs.length) setDocuments((prev) => [...newDocs, ...prev]);
    setRejections(refused);
    setStaged([]);
    setFormError("");
    if (fileInputRef.current) fileInputRef.current.value = "";

    if (newDocs.length) {
      setBanner({
        tone: "success",
        text: `${newDocs.length} ${newDocs.length === 1 ? "file" : "files"} added to the shared company-wide knowledge base. Text extraction, chunking and embedding have started — each document becomes answerable to every employee once it reaches Ready.`,
      });
      setLive(`${newDocs.length} uploaded. Processing started.`);
    } else {
      setBanner(null);
      setLive("No files were accepted.");
    }
  };

  /* ---- deletion ---- */
  const askDelete = (doc, e) => {
    returnFocusRef.current = e && e.currentTarget ? e.currentTarget : null;
    setDeleteTarget(doc);
  };

  const confirmDelete = () => {
    const doc = deleteTarget;
    setDocuments((prev) => prev.filter((d) => d.id !== doc.id));
    delete deadlines.current[doc.id];
    const now = new Date();
    setBanner({
      tone: "neutral",
      text: `“${doc.filename}” was removed for all employees — its file, chunks and embeddings are deleted from the index. Audit log entry recorded for ${CURRENT_USER} at ${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}.`,
    });
    setLive(`${doc.filename} deleted from the shared corpus.`);
    setDeleteTarget(null);
    if (returnFocusRef.current && returnFocusRef.current.focus) {
      // the row is gone; move focus somewhere sensible
      returnFocusRef.current = null;
    }
  };

  const openFile = (doc) => {
    setLive(`Opening ${doc.filename} from document storage.`);
    setBanner({ tone: "neutral", text: `Opening “${doc.filename}” from document storage (GET /documents/${doc.id}/file).` });
  };

  /* ---- filtering ---- */
  const filtered = documents.filter((d) => {
    const q = query.trim().toLowerCase();
    if (q && !d.filename.toLowerCase().includes(q)) return false;
    if (statusFilter !== "all" && d.status !== statusFilter) return false;
    if (mineOnly && d.uploader !== CURRENT_USER) return false;
    return true;
  });

  const counts = {
    total: documents.length,
    ready: documents.filter((d) => d.status === "Ready").length,
    processing: documents.filter((d) => d.status === "Processing").length,
    attention: documents.filter((d) => d.status === "Failed" || d.status === "No readable text").length,
  };

  const filtersActive = query.trim() !== "" || statusFilter !== "all" || mineOnly;
  const clearFilters = () => {
    setQuery("");
    setStatusFilter("all");
    setMineOnly(false);
  };

  const summary = [
    { label: "Documents in corpus", value: counts.total },
    { label: "Ready to answer", value: counts.ready },
    { label: "Processing", value: counts.processing },
    { label: "Need attention", value: counts.attention },
  ];

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
            Every document the chatbot can answer from, shared across the company. Upload PDF, DOCX, TXT or Markdown
            files; each one is extracted, chunked, embedded and written to the combined index.
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
        <Icons.AlertCircle className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" style={{ color: brand.accentColor }} />
        <p className="text-sm leading-6" style={{ color: "#5C2027" }}>
          <strong className="font-semibold">Uploads are shared with everyone.</strong> Anything added here joins the
          shared company-wide knowledge base, is answerable to all employees and can be deleted by any employee. Upload
          only content that is safe for every colleague to read — there is no private or restricted option in this
          release.
        </p>
      </div>

      {/* Summary */}
      <section aria-labelledby="corpus-summary-heading" className="mt-6">
        <h2 id="corpus-summary-heading" className="sr-only">
          Corpus summary
        </h2>
        <dl className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {summary.map((s) => (
            <div
              key={s.label}
              className="border bg-white px-4 py-3"
              style={{ borderColor: "#DEE3E0", borderRadius: brand.radius }}
            >
              <dt className="text-xs font-medium uppercase tracking-wide" style={{ color: brand.neutralColor }}>
                {s.label}
              </dt>
              <dd className="mt-1 text-2xl font-semibold" style={{ color: "#15201D", fontFamily: brand.fontHeading }}>
                {s.value}
              </dd>
            </div>
          ))}
        </dl>
      </section>

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
              PDF, DOCX, TXT and Markdown (.md), up to {MAX_LABEL} per file. PDFs are read as text only — scanned or
              image-only files will index no text.
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
                    <p id="upload-help" className="mt-2 text-xs" style={{ color: brand.neutralColor }}>
                      Or drag files onto this area. Each file is tracked separately with its own processing status.
                    </p>
                  </div>
                  <Btn type="submit" variant="primary" className="shrink-0">
                    <Icons.Upload className="h-4 w-4" aria-hidden="true" />
                    {staged.length > 0
                      ? `Upload ${staged.length} ${staged.length === 1 ? "file" : "files"}`
                      : "Upload to shared corpus"}
                  </Btn>
                </div>

                {staged.length > 0 && (
                  <div className="mt-5">
                    <h3 className="text-xs font-semibold uppercase tracking-wide" style={{ color: brand.neutralColor }}>
                      Selected ({staged.length})
                    </h3>
                    <ul className="mt-2 flex flex-wrap gap-2">
                      {staged.map((f) => (
                        <li
                          key={f.name}
                          className="flex items-center gap-2 border bg-white py-1 pl-3 pr-1 text-sm"
                          style={{ borderColor: "#DEE3E0", borderRadius: brand.radius }}
                        >
                          <Icons.FileText className="h-4 w-4" aria-hidden="true" style={{ color: brand.neutralColor }} />
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
                  <p className="mt-4 flex items-center gap-2 text-sm font-medium" style={{ color: brand.accentColor }} role="alert">
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
                    {rejections.length} {rejections.length === 1 ? "file was" : "files were"} not accepted — nothing from{" "}
                    {rejections.length === 1 ? "it" : "them"} reached the index
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
              <Icons.CheckCircle className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" style={{ color: brand.primaryColor }} />
            ) : (
              <Icons.FileText className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" style={{ color: brand.neutralColor }} />
            )}
            {banner.text}
          </p>
          <Btn variant="ghost" className="px-1.5 py-1" aria-label="Dismiss notification" onClick={() => setBanner(null)}>
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

                <div className="flex items-center gap-2 pb-2.5">
                  <input
                    id="mine-only"
                    type="checkbox"
                    checked={mineOnly}
                    onChange={(e) => setMineOnly(e.target.checked)}
                    className="h-4 w-4 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[#1C5D4A]"
                    style={{ accentColor: brand.primaryColor }}
                  />
                  <label htmlFor="mine-only" className="text-sm" style={{ color: "#283330" }}>
                    Only documents I uploaded
                  </label>
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
              Showing {filtered.length} of {documents.length} {documents.length === 1 ? "document" : "documents"}
            </p>

            {/* Table / empty states */}
            {documents.length === 0 ? (
              <div
                className="mt-4 border border-dashed px-6 py-12 text-center"
                style={{ borderColor: "#CDD5D1", borderRadius: brand.radius }}
              >
                <Icons.Package className="mx-auto h-8 w-8" aria-hidden="true" style={{ color: brand.neutralColor }} />
                <h3 className="mt-3 text-base font-semibold" style={{ color: "#15201D" }}>
                  The knowledge base is empty
                </h3>
                <p className="mx-auto mt-2 max-w-md text-sm leading-6" style={{ color: brand.neutralColor }}>
                  Until a document is uploaded the chatbot will answer every question with “not covered by the knowledge
                  base”. Upload a PDF, DOCX, TXT or Markdown file to get started.
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
            ) : filtered.length === 0 ? (
              <div
                className="mt-4 border border-dashed px-6 py-12 text-center"
                style={{ borderColor: "#CDD5D1", borderRadius: brand.radius }}
              >
                <Icons.Search className="mx-auto h-8 w-8" aria-hidden="true" style={{ color: brand.neutralColor }} />
                <h3 className="mt-3 text-base font-semibold" style={{ color: "#15201D" }}>
                  No documents match your filters
                </h3>
                <p className="mx-auto mt-2 max-w-md text-sm leading-6" style={{ color: brand.neutralColor }}>
                  Nothing in the corpus matches {query.trim() ? `“${query.trim()}”` : "the current filters"}. Try a
                  different filename or clear the filters.
                </p>
                <div className="mt-5">
                  <Btn variant="secondary" onClick={clearFilters}>
                    Clear filters
                  </Btn>
                </div>
              </div>
            ) : (
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
                    {filtered.map((d) => (
                      <UI.TR key={d.id}>
                        <UI.TD>
                          <div className="flex items-start gap-3">
                            <Icons.FileText
                              className="mt-0.5 h-4 w-4 shrink-0"
                              aria-hidden="true"
                              style={{ color: brand.neutralColor }}
                            />
                            <div className="min-w-0">
                              <button
                                type="button"
                                onClick={() => openFile(d)}
                                aria-label={`Open ${d.filename}`}
                                className="text-left text-sm font-medium underline-offset-2 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[#1C5D4A]"
                                style={{ color: brand.primaryColor, borderRadius: brand.radius }}
                              >
                                {d.filename}
                              </button>
                              <p className="mt-1 text-xs" style={{ color: brand.neutralColor }}>
                                {d.format} · {fmtSize(d.size_bytes)} · Upload
                              </p>
                            </div>
                          </div>
                        </UI.TD>
                        <UI.TD>
                          <span className="text-sm">
                            {d.uploader}
                            {d.uploader === CURRENT_USER && (
                              <span className="ml-1 text-xs" style={{ color: brand.neutralColor }}>
                                (you)
                              </span>
                            )}
                          </span>
                        </UI.TD>
                        <UI.TD>
                          <span className="whitespace-nowrap text-sm" style={{ color: brand.neutralColor }}>
                            {fmtDate(d.uploaded_at)}
                          </span>
                        </UI.TD>
                        <UI.TD>
                          <StatusPill status={d.status} />
                          {d.status_reason && (
                            <p className="mt-2 max-w-sm text-xs leading-5" style={{ color: "#6B3036" }}>
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
              This removes the document, its stored file and all of its chunks and embeddings from the shared corpus.
              Every employee loses access to it, and the chatbot will stop citing it — if nothing else covers the topic
              it will answer “not covered by the knowledge base”. The deletion is recorded in the audit log against your
              name. This cannot be undone.
            </p>
            <dl className="mt-4 grid grid-cols-2 gap-3 border p-4 text-sm" style={{ borderColor: "#DEE3E0", borderRadius: brand.radius }}>
              <div>
                <dt className="text-xs uppercase tracking-wide" style={{ color: brand.neutralColor }}>
                  Uploaded by
                </dt>
                <dd className="mt-1">{deleteTarget.uploader}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide" style={{ color: brand.neutralColor }}>
                  Status
                </dt>
                <dd className="mt-1">
                  <StatusPill status={deleteTarget.status} />
                </dd>
              </div>
            </dl>
            <div className="mt-6 flex justify-end gap-2">
              <Btn variant="secondary" onClick={closeDialog}>
                Cancel
              </Btn>
              <Btn variant="danger" onClick={confirmDelete}>
                <Icons.Trash className="h-4 w-4" aria-hidden="true" />
                Delete for all employees
              </Btn>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
