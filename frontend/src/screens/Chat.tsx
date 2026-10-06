/* eslint-disable @typescript-eslint/no-unused-vars */
import React from "react";

import * as UI from "@/lib/ui";
import { Icons } from "@/lib/icons";
import { brand } from "@/lib/brand";
import { useNavigate } from "@/lib/navigate";

const { Select } = UI;
const { Plus, Search, Check, X, ChevronRight, FileText, Package, Calendar, Clock, Trash, Download, ArrowRight, AlertCircle, CheckCircle } = Icons;

const DOCS = {
  d1: {
    id: "d1",
    filename: "Travel-and-Expense-Policy-FIN-2024-07.pdf",
    format: "PDF",
    uploader: "Marta Lindqvist",
    uploaded_at: "2026-09-28",
    status: "Ready",
    source_type: "Uploaded document",
    source_id: "doc_8831",
    source_url: "/documents/8831/file",
  },
  d2: {
    id: "d2",
    filename: "Finance-Shared-Services-FAQ.docx",
    format: "DOCX",
    uploader: "Priya Raman",
    uploaded_at: "2026-09-30",
    status: "Ready",
    source_type: "Uploaded document",
    source_id: "doc_8847",
    source_url: "/documents/8847/file",
  },
  d3: {
    id: "d3",
    filename: "People-Handbook-Leave-and-Absence.md",
    format: "Markdown",
    uploader: "Tomas Okafor",
    uploaded_at: "2026-10-01",
    status: "Ready",
    source_type: "Uploaded document",
    source_id: "doc_8862",
    source_url: "/documents/8862/file",
  },
  d4: {
    id: "d4",
    filename: "Platform-Release-Runbook-v6.md",
    format: "Markdown",
    uploader: "Dan Whitfield",
    uploaded_at: "2026-09-24",
    status: "Ready",
    source_type: "Uploaded document",
    source_id: "doc_8804",
    source_url: "/documents/8804/file",
  },
  d5: {
    id: "d5",
    filename: "Security-Incident-Response-Plan.pdf",
    format: "PDF",
    uploader: "Hannah Ueda",
    uploaded_at: "2026-08-19",
    status: "Ready",
    source_type: "Uploaded document",
    source_id: "doc_8710",
    source_url: "/documents/8710/file",
  },
  d6: {
    id: "d6",
    filename: "Contractor-Engagement-Guidelines.docx",
    format: "DOCX",
    uploader: "Marta Lindqvist",
    uploaded_at: "2026-10-02",
    status: "Ready",
    source_type: "Uploaded document",
    source_id: "doc_8870",
    source_url: "/documents/8870/file",
  },
  d7: {
    id: "d7",
    filename: "IT-Onboarding-Checklist.txt",
    format: "TXT",
    uploader: "Service Desk",
    uploaded_at: "2026-09-15",
    status: "Ready",
    source_type: "Uploaded document",
    source_id: "doc_8755",
    source_url: "/documents/8755/file",
  },
  d8: {
    id: "d8",
    filename: "Platform-Release-Calendar-2026.md",
    format: "Markdown",
    uploader: "Dan Whitfield",
    uploaded_at: "2026-09-24",
    status: "Ready",
    source_type: "Uploaded document",
    source_id: "doc_8805",
    source_url: "/documents/8805/file",
  },
};

const ANSWERS = {
  expenses: {
    token_usage: 1284,
    not_covered: false,
    partial: false,
    text:
      "Expense claims are governed by policy FIN-2024-07. A claim must be submitted within 30 days of the date the spend was incurred, and anything above €500 needs line-manager approval before Finance Shared Services will process it [1].\n\nDomestic per diem is €46 for a full day and €23 for a part day. Approved claims are paid in the next payroll run, and the payroll cut-off is the 18th of each month [2].",
    citations: [
      {
        document_id: "d1",
        chunk_index: 14,
        quote:
          "Claims must be submitted within 30 days of the date on which the expense was incurred. Claims with a total value above €500 require line-manager approval prior to processing by Finance Shared Services. Claims received after the 30-day window are returned to the claimant and require a written exception from the cost-centre owner.",
      },
      {
        document_id: "d2",
        chunk_index: 6,
        quote:
          "Domestic per diem is set at €46 for a full day of travel and €23 for a part day. Approved reimbursements are paid in the next payroll run following approval; the payroll cut-off is the 18th of each month.",
      },
    ],
  },
  contractors: {
    token_usage: 1102,
    not_covered: false,
    partial: false,
    text:
      "Contractors engaged through an agency claim expenses through their agency and not through the company expense system. Directly contracted specialists may claim pre-approved travel only, and the approval has to be recorded on the statement of work before the travel is booked [1].\n\nWhere a direct contractor does claim, the €500 manager-approval threshold in FIN-2024-07 applies to them in exactly the same way as to employees [2].",
    citations: [
      {
        document_id: "d6",
        chunk_index: 3,
        quote:
          "Agency-supplied contractors submit all expenses through their agency. Directly contracted specialists may claim pre-approved travel costs only; the approval must be recorded against the statement of work before travel is booked.",
      },
      {
        document_id: "d1",
        chunk_index: 14,
        quote:
          "Claims with a total value above €500 require line-manager approval prior to processing by Finance Shared Services. This threshold applies to all claimants processed through the expense system, including directly contracted personnel.",
      },
    ],
  },
  leave: {
    token_usage: 965,
    not_covered: false,
    partial: false,
    text:
      "You give at least 10 weeks' written notice before parental leave starts, addressed to your line manager and to People Operations [1]. The notice period drops to 4 weeks for an adoption placement confirmed at short notice [1].\n\nLeave is recorded in Workday before it is approved, and any holiday already booked inside the leave window has to be rescheduled by the employee [1].",
    citations: [
      {
        document_id: "d3",
        chunk_index: 21,
        quote:
          "Parental leave requires a minimum of 10 weeks' written notice to the line manager and People Operations. For adoption placements confirmed at short notice the notice period is reduced to 4 weeks. All leave is recorded in Workday prior to approval; previously booked holiday falling inside the leave window must be rescheduled by the employee.",
      },
    ],
  },
  release: {
    token_usage: 1340,
    not_covered: false,
    partial: false,
    text:
      "The Q4 change freeze runs from 18 December 2026 to 2 January 2027 inclusive, and no production deployments are made in that window. An exception needs a severity-1 justification signed off by the on-call engineering manager and recorded against the release ticket before the deploy runs [1].\n\nThe standard release train is unaffected up to 17 December; the last scheduled production deploy of the year is at 14:00 UTC on 17 December [2].",
    citations: [
      {
        document_id: "d4",
        chunk_index: 8,
        quote:
          "Change freeze: 18 December 2026 to 2 January 2027 inclusive. No production deployment is executed during the freeze. Exceptions require a severity-1 justification approved by the on-call engineering manager and recorded on the release ticket prior to execution.",
      },
      {
        document_id: "d8",
        chunk_index: 2,
        quote:
          "Release train continues on the normal weekly cadence until 17 December 2026. Final scheduled production deploy of the calendar year: 17 December, 14:00 UTC.",
      },
    ],
  },
  incident: {
    token_usage: 1190,
    not_covered: false,
    partial: false,
    text:
      "A severity 1 is declared when a customer-facing service is unavailable, or when the integrity of customer data is at risk [1].\n\nDeclaring it pages the on-call platform engineer and the duty incident commander immediately. The security lead is paged in parallel whenever the incident involves suspected data exposure, and the first stakeholder status update is due within 30 minutes of declaration [1].",
    citations: [
      {
        document_id: "d5",
        chunk_index: 11,
        quote:
          "Severity 1: a customer-facing service is unavailable, or customer data integrity is at risk. Declaration pages the on-call platform engineer and the duty incident commander. Where data exposure is suspected the security lead is paged in parallel. First stakeholder status update is due within 30 minutes of declaration.",
      },
    ],
  },
  onboarding: {
    token_usage: 880,
    not_covered: false,
    partial: false,
    text:
      "A new starter's laptop is ordered by the hiring manager at least five working days before the start date, and the build is collected from the Service Desk on day one with the starter present for the hand-over [1].\n\nAccounts, MFA enrolment and the security-awareness module are all completed on day one before any system access is granted [1].",
    citations: [
      {
        document_id: "d7",
        chunk_index: 1,
        quote:
          "Hiring manager orders the device at least five working days before the start date. The starter collects the build in person from the Service Desk on day one. Account creation, MFA enrolment and the security-awareness module are completed on day one before system access is granted.",
      },
    ],
  },
  vpn: {
    token_usage: 1022,
    not_covered: false,
    partial: true,
    text:
      "New starters request VPN access through the IT onboarding checklist: the line manager raises the request on the starter's first day, and access is granted once the security-awareness module has been completed [1].\n\nOne part of your question is not covered by the knowledge base. No indexed document describes the split-tunnelling configuration or the per-region VPN gateways, so I cannot answer that part.",
    citations: [
      {
        document_id: "d7",
        chunk_index: 4,
        quote:
          "Remote access: the line manager raises the VPN access request on the starter's first day. Access is enabled once the security-awareness module is recorded as complete.",
      },
    ],
  },
};

const NOT_COVERED = {
  token_usage: 310,
  not_covered: true,
  partial: false,
  citations: [],
  text:
    "I can't answer this from the knowledge base.\n\nNothing in the indexed documents covers this question, so I won't answer from the model's general knowledge. Try rephrasing it using the wording that appears in the source document, or add a document that covers it from the Knowledge base screen.",
};

const MATCHERS = [
  { keys: ["contractor", "contractors", "agency", "freelance"], answer: ANSWERS.contractors },
  { keys: ["expense", "expenses", "claim", "per diem", "reimburs", "fin-2024", "travel"], answer: ANSWERS.expenses },
  { keys: ["parental", "leave", "maternity", "absence", "notice period"], answer: ANSWERS.leave },
  { keys: ["freeze", "release", "deploy", "deployment", "release train", "q4"], answer: ANSWERS.release },
  { keys: ["severity", "sev1", "incident", "paged", "page", "breach", "outage"], answer: ANSWERS.incident },
  { keys: ["vpn", "remote access", "split tunnel"], answer: ANSWERS.vpn },
  { keys: ["laptop", "onboarding", "new starter", "device", "equipment"], answer: ANSWERS.onboarding },
];

const SUGGESTIONS = [
  "What's the deadline for submitting an expense claim?",
  "When is the Q4 release freeze and who approves exceptions?",
  "How much notice do I give for parental leave?",
  "What triggers a severity 1 incident?",
];

const SEED_CONVERSATIONS = [
  {
    id: "c-1",
    title: "Expense claim deadline and approval limits",
    created_at: "2026-10-06T09:12:00",
    messages: [
      {
        id: "m-1",
        role: "user",
        content: "What's the deadline for submitting an expense claim, and when do I need approval?",
        created_at: "2026-10-06T09:12:00",
      },
      {
        id: "m-2",
        role: "assistant",
        created_at: "2026-10-06T09:12:00",
        feedback: "up",
        ...ANSWERS.expenses,
      },
      {
        id: "m-3",
        role: "user",
        content: "And for contractors?",
        created_at: "2026-10-06T09:15:00",
      },
      {
        id: "m-4",
        role: "assistant",
        created_at: "2026-10-06T09:15:00",
        feedback: null,
        ...ANSWERS.contractors,
      },
    ],
  },
  {
    id: "c-2",
    title: "Release freeze dates for Q4",
    created_at: "2026-10-05T16:40:00",
    messages: [
      {
        id: "m-5",
        role: "user",
        content: "When is the Q4 release freeze and who can approve an exception?",
        created_at: "2026-10-05T16:40:00",
      },
      { id: "m-6", role: "assistant", created_at: "2026-10-05T16:40:00", feedback: null, ...ANSWERS.release },
    ],
  },
  {
    id: "c-3",
    title: "Parental leave notice period",
    created_at: "2026-10-02T11:05:00",
    messages: [
      {
        id: "m-7",
        role: "user",
        content: "How far in advance do I have to tell my manager about parental leave?",
        created_at: "2026-10-02T11:05:00",
      },
      { id: "m-8", role: "assistant", created_at: "2026-10-02T11:05:00", feedback: "up", ...ANSWERS.leave },
    ],
  },
  {
    id: "c-4",
    title: "Who gets paged for a severity 1",
    created_at: "2026-09-29T08:23:00",
    messages: [
      {
        id: "m-9",
        role: "user",
        content: "Who gets paged when we declare a severity 1?",
        created_at: "2026-09-29T08:23:00",
      },
      { id: "m-10", role: "assistant", created_at: "2026-09-29T08:23:00", feedback: null, ...ANSWERS.incident },
    ],
  },
  {
    id: "c-5",
    title: "VPN access for new starters",
    created_at: "2026-09-25T14:02:00",
    messages: [
      {
        id: "m-11",
        role: "user",
        content: "How does a new starter get VPN access, and how is split tunnelling configured?",
        created_at: "2026-09-25T14:02:00",
      },
      { id: "m-12", role: "assistant", created_at: "2026-09-25T14:02:00", feedback: null, ...ANSWERS.vpn },
    ],
  },
  {
    id: "c-6",
    title: "2027 revenue target",
    created_at: "2026-09-22T17:30:00",
    messages: [
      {
        id: "m-13",
        role: "user",
        content: "What is our 2027 revenue target?",
        created_at: "2026-09-22T17:30:00",
      },
      { id: "m-14", role: "assistant", created_at: "2026-09-22T17:30:00", feedback: null, ...NOT_COVERED },
    ],
  },
];

const BORDER = "#D8DEDA";
const INK = "#16211D";
const BODY_INK = "#33403B";

const RING =
  "focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[#1C5D4A] focus-visible:ring-offset-[#F1F3F1]";

const BTN =
  "inline-flex items-center justify-center gap-2 rounded-[0.5rem] text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 " +
  RING;

function buildAnswer(question) {
  const q = question.toLowerCase();
  for (const m of MATCHERS) {
    if (m.keys.some((k) => q.includes(k))) return m.answer;
  }
  return NOT_COVERED;
}

function titleFrom(question) {
  const clean = question.replace(/\s+/g, " ").trim().replace(/[?.!]+$/, "");
  return clean.length > 52 ? clean.slice(0, 52).trim() + "…" : clean;
}

function fmtTime(iso) {
  const d = new Date(iso);
  return d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}

function fmtDay(iso) {
  const d = new Date(iso);
  const now = new Date();
  const same = (a, b) =>
    a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
  const yest = new Date(now.getTime() - 86400000);
  if (same(d, now)) return "Today";
  if (same(d, yest)) return "Yesterday";
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

export default function Screen() {
  const navigate = useNavigate();
  const [conversations, setConversations] = React.useState(SEED_CONVERSATIONS);
  const [activeId, setActiveId] = React.useState("c-1");
  const [draft, setDraft] = React.useState("");
  const [historyQuery, setHistoryQuery] = React.useState("");
  const [stream, setStream] = React.useState(null);
  const [openSource, setOpenSource] = React.useState({
    citation: ANSWERS.expenses.citations[0],
    index: 1,
  });
  const [deleteTarget, setDeleteTarget] = React.useState(null);
  const [announce, setAnnounce] = React.useState("");

  const seq = React.useRef(200);
  const uid = (p) => {
    seq.current += 1;
    return p + "-" + seq.current;
  };

  const transcriptRef = React.useRef(null);
  const sourceHeadingRef = React.useRef(null);
  const cancelRef = React.useRef(null);
  const dialogRef = React.useRef(null);
  const composerRef = React.useRef(null);

  const activeConv = conversations.find((c) => c.id === activeId) || null;
  const isStreaming = stream !== null;

  // Stream the answer token by token.
  React.useEffect(() => {
    if (!stream) return undefined;
    if (stream.shown >= stream.tokens.length) {
      commitStream(stream, false);
      return undefined;
    }
    const delay = stream.shown === 0 ? 420 : 26;
    const t = setTimeout(() => {
      setStream((s) =>
        s && s.id === stream.id ? { ...s, shown: Math.min(s.shown + 2, s.tokens.length) } : s
      );
    }, delay);
    return () => clearTimeout(t);
  }, [stream]);

  React.useEffect(() => {
    const el = transcriptRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [activeId, stream, conversations]);

  // Dialog: escape to close, focus trap between its two buttons.
  React.useEffect(() => {
    if (!deleteTarget) return undefined;
    if (cancelRef.current) cancelRef.current.focus();
    const onKey = (e) => {
      if (e.key === "Escape") {
        e.preventDefault();
        setDeleteTarget(null);
      } else if (e.key === "Tab" && dialogRef.current) {
        const nodes = dialogRef.current.querySelectorAll("button");
        if (!nodes.length) return;
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
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [deleteTarget]);

  function commitStream(s, stopped) {
    const text = stopped ? s.tokens.slice(0, s.shown).join("").trimEnd() + " …" : s.answer.text;
    const msg = {
      id: s.id,
      role: "assistant",
      content: text,
      created_at: s.created_at,
      citations: stopped ? [] : s.answer.citations,
      not_covered: stopped ? false : s.answer.not_covered,
      partial: stopped ? false : s.answer.partial,
      stopped: stopped,
      token_usage: stopped ? Math.max(40, s.shown * 3) : s.answer.token_usage,
      feedback: null,
    };
    setConversations((prev) =>
      prev.map((c) => (c.id === s.convId ? { ...c, messages: [...c.messages, msg] } : c))
    );
    setStream(null);
    if (stopped) {
      setAnnounce("Generation stopped.");
    } else if (msg.not_covered) {
      setAnnounce("Answer complete. Not covered by the knowledge base, no citations.");
    } else {
      setAnnounce("Answer complete with " + msg.citations.length + " source(s).");
      if (msg.citations.length) setOpenSource({ citation: msg.citations[0], index: 1 });
    }
  }

  function ask(question) {
    const q = question.replace(/\s+/g, " ").trim();
    if (!q || isStreaming) return;
    const nowIso = new Date().toISOString();
    const userMsg = { id: uid("m"), role: "user", content: q, created_at: nowIso };
    let convId = activeId;
    if (!convId) {
      convId = uid("c");
      const conv = { id: convId, title: titleFrom(q), created_at: nowIso, messages: [userMsg] };
      setConversations((prev) => [conv, ...prev]);
      setActiveId(convId);
    } else {
      setConversations((prev) =>
        prev.map((c) => (c.id === convId ? { ...c, messages: [...c.messages, userMsg] } : c))
      );
    }
    const answer = buildAnswer(q);
    setStream({
      id: uid("m"),
      convId,
      created_at: nowIso,
      answer,
      tokens: answer.text.split(/(\s+)/),
      shown: 0,
    });
    setDraft("");
    setAnnounce("Searching the knowledge base. Generating answer.");
  }

  function startNewConversation() {
    if (isStreaming) return;
    setActiveId(null);
    setDraft("");
    setAnnounce("New conversation started. Earlier turns are no longer used as context.");
    if (composerRef.current) composerRef.current.focus();
  }

  function confirmDelete() {
    const target = deleteTarget;
    if (!target) return;
    setConversations((prev) => prev.filter((c) => c.id !== target.id));
    if (activeId === target.id) setActiveId(null);
    setDeleteTarget(null);
    setAnnounce("Conversation “" + target.title + "” deleted from your history.");
  }

  function openCitation(citation, index) {
    setOpenSource({ citation, index });
    if (sourceHeadingRef.current) sourceHeadingRef.current.focus();
  }

  const filteredHistory = conversations.filter((c) =>
    c.title.toLowerCase().includes(historyQuery.trim().toLowerCase())
  );

  const streamText = stream ? stream.tokens.slice(0, stream.shown).join("") : "";

  function renderBody(text, citations, msgKey) {
    return text.split("\n\n").map((para, pi) => (
      <p key={msgKey + "-p" + pi} className="mb-3 last:mb-0 leading-7" style={{ color: BODY_INK }}>
        {para.split(/(\[\d+\])/g).map((part, si) => {
          const m = part.match(/^\[(\d+)\]$/);
          if (!m) return <React.Fragment key={si}>{part}</React.Fragment>;
          const n = parseInt(m[1], 10);
          const cit = citations && citations[n - 1];
          if (!cit) return <React.Fragment key={si}>{part}</React.Fragment>;
          const doc = DOCS[cit.document_id];
          const active =
            openSource &&
            openSource.citation &&
            openSource.citation.document_id === cit.document_id &&
            openSource.citation.chunk_index === cit.chunk_index;
          return (
            <button
              key={si}
              type="button"
              onClick={() => openCitation(cit, n)}
              aria-label={"Show source " + n + ": " + doc.filename}
              className={
                "mx-0.5 inline-flex -translate-y-0.5 items-center rounded px-1 py-0.5 align-baseline text-[0.68rem] font-semibold hover:underline " +
                RING
              }
              style={{
                color: brand.primaryColor,
                backgroundColor: active ? "#C9DCD4" : "#E4EDE9",
                border: "1px solid " + (active ? brand.primaryColor : "#CBDBD4"),
              }}
            >
              {n}
            </button>
          );
        })}
      </p>
    ));
  }

  function AssistantMeta({ msg }) {
    return (
      <p className="mt-4 text-xs" style={{ color: brand.neutralColor }}>
        Generated in the company Azure tenant
        <span aria-hidden="true"> · </span>
        {msg.token_usage.toLocaleString("en-GB")} tokens
        <span aria-hidden="true"> · </span>
        {msg.not_covered
          ? "no sources"
          : msg.citations.length + (msg.citations.length === 1 ? " source" : " sources")}
      </p>
    );
  }

  function Feedback({ convId, msg }) {
    const set = (rating) => {
      setConversations((prev) =>
        prev.map((c) =>
          c.id !== convId
            ? c
            : {
                ...c,
                messages: c.messages.map((m) =>
                  m.id === msg.id ? { ...m, feedback: m.feedback === rating ? null : rating } : m
                ),
              }
        )
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

  const openDoc = openSource && openSource.citation ? DOCS[openSource.citation.document_id] : null;

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
            Answers are built only from documents in the shared knowledge base. Every claim carries a
            citation you can open beside the answer — and when nothing supports your question, the
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
            onClick={() => navigate("sign-in")}
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
              {conversations.length} saved · visible only to you
            </p>
            <div className="mt-3">
              <label htmlFor="history-search" className="block text-xs font-medium" style={{ color: BODY_INK }}>
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
                  className={"w-full rounded-[0.5rem] border bg-white py-2 pl-8 pr-3 text-sm " + RING}
                  style={{ borderColor: BORDER, color: BODY_INK }}
                />
              </div>
            </div>
          </div>

          {conversations.length === 0 ? (
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
                      onClick={() => {
                        setActiveId(c.id);
                        setAnnounce("Opened conversation " + c.title);
                      }}
                      aria-current={isActive ? "true" : undefined}
                      className={
                        "flex-1 rounded-[0.5rem] border-l-2 px-3 py-2 text-left hover:bg-[#F1F3F1] " + RING
                      }
                      style={{
                        borderLeftColor: isActive ? brand.primaryColor : "transparent",
                        backgroundColor: isActive ? "#E8EFEB" : "transparent",
                      }}
                    >
                      <span
                        className={"block text-sm leading-5 " + (isActive ? "font-semibold" : "font-normal")}
                        style={{ color: INK }}
                      >
                        {c.title}
                      </span>
                      <span className="mt-0.5 block text-xs" style={{ color: brand.neutralColor }}>
                        {fmtDay(c.created_at)} · {fmtTime(c.created_at)}
                        {isActive ? " · open" : ""}
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeleteTarget(c)}
                      aria-label={"Delete conversation: " + c.title}
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
            <h2 id="conversation-heading" className="text-base font-semibold" style={{ color: INK }}>
              {activeConv ? activeConv.title : "New conversation"}
            </h2>
            <p className="mt-1 text-xs" style={{ color: brand.neutralColor }}>
              {activeConv
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
            {!activeConv || activeConv.messages.length === 0 ? (
              <div className="mx-auto max-w-xl py-4 text-center">
                <div
                  className="mx-auto flex h-11 w-11 items-center justify-center rounded-full"
                  style={{ backgroundColor: "#E4EDE9" }}
                >
                  <Icons.Search className="h-5 w-5" aria-hidden="true" style={{ color: brand.primaryColor }} />
                </div>
                <h3 className="mt-4 text-lg font-semibold" style={{ color: INK }}>
                  {conversations.length === 0
                    ? "Welcome — ask our knowledge base anything"
                    : "Ask a question to start"}
                </h3>
                <p className="mx-auto mt-2 max-w-md text-sm leading-6" style={{ color: brand.neutralColor }}>
                  Answers come only from documents uploaded to the shared company knowledge base, and each
                  one is cited so you can read the original passage. If nothing covers your question, you
                  will be told rather than guessed at.
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
                <h4 className="mt-8 text-xs font-semibold uppercase tracking-wide" style={{ color: INK }}>
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
                {activeConv.messages.map((msg) =>
                  msg.role === "user" ? (
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
                        style={{ borderColor: BORDER, backgroundColor: "#F1F3F1", color: BODY_INK }}
                      >
                        {msg.content}
                      </div>
                    </li>
                  ) : (
                    <li key={msg.id}>
                      <div className="flex items-baseline gap-2">
                        <span className="text-xs font-semibold" style={{ color: brand.primaryColor }}>
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
                        {renderBody(msg.content, msg.citations, msg.id)}

                        {msg.citations && msg.citations.length > 0 && (
                          <div className="mt-4 border-t pt-3" style={{ borderColor: BORDER }}>
                            <h4
                              className="text-xs font-semibold uppercase tracking-wide"
                              style={{ color: INK }}
                            >
                              Sources
                            </h4>
                            <ul role="list" className="mt-2 space-y-1.5">
                              {msg.citations.map((cit, i) => {
                                const doc = DOCS[cit.document_id];
                                return (
                                  <li key={msg.id + "-cit" + i}>
                                    <button
                                      type="button"
                                      onClick={() => openCitation(cit, i + 1)}
                                      className={
                                        "flex w-full items-center gap-2 rounded-[0.5rem] border px-3 py-2 text-left text-sm hover:bg-[#F1F3F1] " +
                                        RING
                                      }
                                      style={{ borderColor: BORDER }}
                                    >
                                      <span
                                        className="flex h-5 w-5 shrink-0 items-center justify-center rounded text-[0.68rem] font-semibold"
                                        style={{ backgroundColor: "#E4EDE9", color: brand.primaryColor }}
                                        aria-hidden="true"
                                      >
                                        {i + 1}
                                      </span>
                                      <span className="min-w-0 flex-1">
                                        <span className="block truncate font-medium" style={{ color: INK }}>
                                          {doc.filename}
                                        </span>
                                        <span className="block text-xs" style={{ color: brand.neutralColor }}>
                                          {doc.source_type} · {doc.format} · passage {cit.chunk_index}
                                        </span>
                                      </span>
                                      <Icons.ChevronRight
                                        className="h-4 w-4 shrink-0"
                                        aria-hidden="true"
                                        style={{ color: brand.neutralColor }}
                                      />
                                    </button>
                                  </li>
                                );
                              })}
                            </ul>
                          </div>
                        )}

                        {msg.not_covered && (
                          <p className="mt-3 text-xs leading-5" style={{ color: brand.neutralColor }}>
                            No citations are shown because no passage scored above the relevance threshold.
                            You can{" "}
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
                        {!msg.stopped && <Feedback convId={activeConv.id} msg={msg} />}
                      </div>
                    </li>
                  )
                )}

                {stream && stream.convId === activeConv.id && (
                  <li>
                    <div className="flex items-baseline gap-2">
                      <span className="text-xs font-semibold" style={{ color: brand.primaryColor }}>
                        Assistant
                      </span>
                      <span className="text-xs" style={{ color: brand.neutralColor }}>
                        {stream.shown === 0 ? "searching the knowledge base…" : "streaming…"}
                      </span>
                    </div>
                    <div
                      className="mt-1.5 rounded-[0.5rem] border border-l-2 px-4 py-4 text-sm"
                      style={{ borderColor: BORDER, borderLeftColor: brand.primaryColor }}
                    >
                      {stream.shown === 0 ? (
                        <p className="text-sm" style={{ color: brand.neutralColor }}>
                          Running hybrid keyword and meaning-based retrieval across the combined index…
                        </p>
                      ) : (
                        renderBody(streamText, stream.answer.citations, stream.id)
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
              <label htmlFor="question" className="block text-sm font-medium" style={{ color: INK }}>
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
                <p id="question-hint" className="max-w-md text-xs leading-5" style={{ color: brand.neutralColor }}>
                  Enter sends · Shift + Enter adds a line. The whole knowledge base is searched — there are
                  no filters to set.
                </p>
                <div className="flex items-center gap-2">
                  {isStreaming && (
                    <>
                      <span className="text-xs font-medium" style={{ color: brand.neutralColor }}>
                        Generating…
                      </span>
                      <button
                        type="button"
                        onClick={() => commitStream(stream, true)}
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
                {openDoc ? "Citation " + openSource.index + " · passage in place" : "Nothing open"}
              </p>
            </div>
            {openDoc && (
              <button
                type="button"
                onClick={() => setOpenSource({ citation: null, index: 0 })}
                aria-label="Close source panel"
                className={"rounded-[0.5rem] p-1.5 hover:bg-[#F1F3F1] " + RING}
                style={{ color: brand.neutralColor }}
              >
                <Icons.X className="h-4 w-4" aria-hidden="true" />
              </button>
            )}
          </div>

          {!openDoc ? (
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
                Select a citation number in an answer and the exact passage it came from opens here, beside
                the answer.
              </p>
            </div>
          ) : (
            <div className="px-4 py-4">
              <h3 className="break-words text-sm font-semibold leading-5" style={{ color: INK }}>
                {openDoc.filename}
              </h3>
              <div className="mt-2 flex flex-wrap gap-1.5">
                <span
                  className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[0.7rem] font-medium"
                  style={{ borderColor: BORDER, color: BODY_INK }}
                >
                  {openDoc.source_type}
                </span>
                <span
                  className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[0.7rem] font-medium"
                  style={{ borderColor: BORDER, color: BODY_INK }}
                >
                  {openDoc.format}
                </span>
                <span
                  className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[0.7rem] font-semibold"
                  style={{
                    borderColor: brand.primaryColor,
                    color: brand.primaryColor,
                    backgroundColor: "#E4EDE9",
                  }}
                >
                  <Icons.Check className="h-3 w-3" aria-hidden="true" />
                  {openDoc.status}
                </span>
              </div>

              <dl className="mt-4 space-y-2 text-xs">
                <div className="flex justify-between gap-3">
                  <dt style={{ color: brand.neutralColor }}>Uploaded by</dt>
                  <dd className="text-right font-medium" style={{ color: BODY_INK }}>
                    {openDoc.uploader}
                  </dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt style={{ color: brand.neutralColor }}>Uploaded</dt>
                  <dd className="text-right font-medium" style={{ color: BODY_INK }}>
                    {new Date(openDoc.uploaded_at).toLocaleDateString("en-GB", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })}
                  </dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt style={{ color: brand.neutralColor }}>Source ID</dt>
                  <dd className="text-right font-medium" style={{ color: BODY_INK }}>
                    {openDoc.source_id}
                  </dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt style={{ color: brand.neutralColor }}>Passage</dt>
                  <dd className="text-right font-medium" style={{ color: BODY_INK }}>
                    Chunk {openSource.citation.chunk_index}
                  </dd>
                </div>
              </dl>

              <h4 className="mt-5 text-xs font-semibold uppercase tracking-wide" style={{ color: INK }}>
                Cited passage
              </h4>
              <blockquote
                className="mt-2 border-l-2 py-1 pl-3 text-sm leading-6"
                style={{ borderColor: brand.primaryColor, color: BODY_INK }}
              >
                {openSource.citation.quote}
              </blockquote>

              <div className="mt-5 space-y-2">
                <button
                  type="button"
                  onClick={() => navigate("documents")}
                  className={BTN + " w-full px-4 py-2 text-white hover:opacity-90"}
                  style={{ backgroundColor: brand.primaryColor }}
                >
                  <Icons.Download className="h-4 w-4" aria-hidden="true" />
                  Open original file
                </button>
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
              “{deleteTarget.title}” will be removed from your history and will no longer appear in your
              list. The documents it cited are not affected.
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
                onClick={confirmDelete}
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
