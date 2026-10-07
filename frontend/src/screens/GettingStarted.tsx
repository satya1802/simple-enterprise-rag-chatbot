import React from "react";

import * as UI from "@/lib/ui";
import { Icons } from "@/lib/icons";
import { brand } from "@/lib/brand";
import { useNavigate } from "@/lib/navigate";

const {
  Button,
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  Input,
  Label,
  Checkbox,
  Table,
  THead,
  TBody,
  TR,
  TH,
  TD,
  Separator,
} = UI;

const GUIDE_SECTIONS = [
  {
    id: "how-it-works",
    title: "How Evidence First works",
    summary:
      "Answers are built only from documents in the shared knowledge base, and every claim carries a citation you can open beside the answer.",
    keywords: [
      "grounded",
      "retrieval",
      "hybrid search",
      "index",
      "corpus",
      "overview",
      "model",
      "tenant",
    ],
  },
  {
    id: "good-questions",
    title: "Ask a good question",
    summary:
      "Plain English, one topic at a time, and follow-ups that build on what you just asked.",
    keywords: [
      "question box",
      "prompt",
      "follow-up",
      "examples",
      "wording",
      "keyword",
      "paraphrase",
    ],
  },
  {
    id: "citations",
    title: "Read and follow the citations",
    summary:
      "Clicking a citation opens the source passage in the evidence panel next to the answer instead of sending you to another tab.",
    keywords: [
      "sources",
      "evidence panel",
      "proof",
      "verify",
      "open original",
      "download",
      "passage",
    ],
  },
  {
    id: "upload",
    title: "Upload documents",
    summary:
      "PDF, DOCX, TXT and Markdown files are extracted, chunked, embedded and indexed automatically — usually within a few minutes.",
    keywords: [
      "pdf",
      "docx",
      "txt",
      "markdown",
      "md",
      "file size",
      "processing",
      "ready",
      "failed",
      "indexing",
    ],
  },
  {
    id: "remove",
    title: "Remove a document",
    summary:
      "Any employee can delete anything in the corpus. Deletion is immediate, applies to everyone, and is written to the audit log.",
    keywords: ["delete", "remove", "obsolete", "audit log", "confirm", "knowledge base"],
  },
  {
    id: "limitations",
    title: "Limitations of release one",
    summary:
      "What the pilot deliberately does not do yet, stated plainly so the pilot is judged on what it actually promises.",
    keywords: [
      "scanned pdf",
      "ocr",
      "confluence",
      "jira",
      "english",
      "shared",
      "private",
      "known issues",
      "refusal",
    ],
  },
  {
    id: "help",
    title: "Where to get help",
    summary: "Who to contact during the pilot, and where the answer API contract lives.",
    keywords: ["support", "contact", "api", "openapi", "feedback", "pilot team"],
  },
];

const CHECKLIST = [
  { id: "ask", label: "Ask your first question in the chat", minutes: "1 min" },
  { id: "cite", label: "Open a citation and read the source passage", minutes: "1 min" },
  { id: "upload", label: "Upload a document to the shared knowledge base", minutes: "2 min" },
  { id: "limits", label: "Skim the limitations of release one", minutes: "1 min" },
];

const EXAMPLE_QUESTIONS = [
  "What is the approval limit for client entertainment in the UK?",
  "How do I request access to the data warehouse?",
  "Who signs off a change to the payments incident runbook?",
  "What does PROJ-184 say about the Q4 migration cut-over?",
];

const QUESTION_CONTRAST = [
  {
    weak: "policies",
    strong: "What notice period applies to a contractor on a 12-month engagement?",
  },
  {
    weak: "tell me everything about onboarding and payroll and leave",
    strong: "What steps does a new joiner complete on their first day?",
  },
  {
    weak: "is it allowed",
    strong: "Can expenses over £150 be claimed without a receipt?",
  },
];

const FORMATS = [
  {
    format: "Portable Document Format",
    ext: ".pdf",
    note: "Text layer only. Scanned or photographed pages are not read in this release.",
  },
  {
    format: "Word document",
    ext: ".docx",
    note: "Body text, headings and tables. Embedded images are ignored.",
  },
  { format: "Plain text", ext: ".txt", note: "Read as-is." },
  {
    format: "Markdown",
    ext: ".md, .markdown",
    note: "Read as-is. Formatting is stripped before chunking.",
  },
];

const DOC_STATUSES = [
  {
    label: "Processing",
    icon: "Clock",
    meaning:
      "Text is being extracted, chunked and embedded. The list updates on its own when it finishes — no need to reload.",
  },
  {
    label: "Ready",
    icon: "CheckCircle",
    meaning: "Indexed and answerable. Ask a question about it straight away.",
  },
  {
    label: "No readable text",
    icon: "AlertCircle",
    meaning:
      "The file was accepted but nothing could be extracted — almost always a scanned or image-only PDF. Delete it and upload a text version.",
  },
  {
    label: "Failed",
    icon: "X",
    meaning:
      "Processing stopped, for example a corrupt or password-protected file. The reason is shown on the row; delete and retry.",
  },
];

const LIMITATIONS = [
  {
    title: "Everything you upload is readable by every employee",
    body: "There is no private library and no way to mark a document personal or restricted. If content is confidential to a team or to an individual, it does not belong in the pilot corpus.",
  },
  {
    title: "Answers come only from uploaded documents",
    body: "Confluence pages and Jira issues are not connected yet. The citation format already carries source type, source identifier and source URL, so those connectors can be added later without reindexing — but today the corpus is upload-only.",
  },
  {
    title: "Scanned or image-only PDFs are not read",
    body: "There is no OCR in release one. Such a file indexes as 'No readable text' and tells you so rather than failing silently. Diagrams and screenshots inside a document are not interpreted.",
  },
  {
    title: "English only",
    body: "The interface, the content and the answers are English. Questions or documents in other languages are untested and are not a supported scenario for the pilot.",
  },
  {
    title: "It will say it does not know, rather than guess",
    body: "If retrieval finds nothing that supports an answer, you get an explicit 'not covered by the knowledge base' response with no citations — even for questions the underlying model could easily answer from general knowledge. That refusal is the feature, not a fault.",
  },
];

export default function Screen() {
  const navigate = useNavigate();
  const [query, setQuery] = React.useState("");
  const [activeId, setActiveId] = React.useState(GUIDE_SECTIONS[0].id);
  const [checked, setChecked] = React.useState({
    ask: false,
    cite: false,
    upload: false,
    limits: false,
  });
  const [helpful, setHelpful] = React.useState(null);
  const sectionRefs = React.useRef({});

  const q = query.trim().toLowerCase();
  const visibleSections = GUIDE_SECTIONS.filter((s) => {
    if (!q) return true;
    return (s.title + " " + s.summary + " " + s.keywords.join(" ")).toLowerCase().includes(q);
  });

  const doneCount = CHECKLIST.filter((c) => checked[c.id]).length;
  const progressPct = Math.round((doneCount / CHECKLIST.length) * 100);

  const goToSection = (id) => {
    setActiveId(id);
    const el = sectionRefs.current[id];
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
      const heading = el.querySelector("h2");
      if (heading && heading.focus) heading.focus({ preventScroll: true });
    }
  };

  const StatusIcon = ({ name }) => {
    const Cmp = Icons[name];
    return Cmp ? <Cmp className="h-4 w-4 shrink-0" aria-hidden="true" /> : null;
  };

  const sectionBody = (id) => {
    switch (id) {
      case "how-it-works":
        return (
          <div className="space-y-5">
            <p className="text-[15px] leading-7 text-slate-700">
              Evidence First answers questions from one combined index of everything employees have
              uploaded. When you ask something, the system searches that index two ways at once —
              exact keyword matching for things like policy codes and project keys, and
              meaning-based matching for when you describe something in your own words — then merges
              the results into a single ranked set and writes the answer from those passages only.
            </p>
            <p className="text-[15px] leading-7 text-slate-700">
              Nothing is sent to a public AI service. Your question, the retrieved passages and the
              generated answer are all processed by the model running inside the company's own cloud
              tenant.
            </p>
            <ol className="space-y-3">
              {[
                "You ask a question in plain English. There are no filters to set — the whole corpus is searched by default.",
                "The answer starts streaming within about five seconds, a sentence at a time. You can stop it at any point.",
                "Citations appear as the answer forms. Click one and the source passage opens in the evidence panel beside it.",
              ].map((step, i) => (
                <li key={i} className="flex gap-4">
                  <span
                    className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm font-semibold text-white"
                    style={{ backgroundColor: brand.primaryColor }}
                    aria-hidden="true"
                  >
                    {i + 1}
                  </span>
                  <span className="text-[15px] leading-7 text-slate-700">
                    <span className="sr-only">{"Step " + (i + 1) + ": "}</span>
                    {step}
                  </span>
                </li>
              ))}
            </ol>
          </div>
        );

      case "good-questions":
        return (
          <div className="space-y-6">
            <p className="text-[15px] leading-7 text-slate-700">
              Ask the way you would ask a well-informed colleague. One topic per question, with
              enough detail to pin down which case you mean. You do not need to match the wording of
              the source document — but if you know the exact term, policy code or project key, use
              it.
            </p>

            <div className="overflow-hidden rounded-lg border border-slate-200">
              <h3 className="border-b border-slate-200 bg-slate-50 px-5 py-3 text-sm font-semibold text-slate-900">
                Sharpen a vague question
              </h3>
              <ul className="divide-y divide-slate-200">
                {QUESTION_CONTRAST.map((row) => (
                  <li key={row.weak} className="grid gap-3 px-5 py-4 sm:grid-cols-2">
                    <p className="flex items-start gap-2 text-sm leading-6 text-slate-500">
                      <Icons.X
                        className="mt-0.5 h-4 w-4 shrink-0"
                        style={{ color: brand.accentColor }}
                        aria-hidden="true"
                      />
                      <span>
                        <span className="font-medium text-slate-600">Too vague: </span>
                        {row.weak}
                      </span>
                    </p>
                    <p className="flex items-start gap-2 text-sm leading-6 text-slate-800">
                      <Icons.Check
                        className="mt-0.5 h-4 w-4 shrink-0"
                        style={{ color: brand.primaryColor }}
                        aria-hidden="true"
                      />
                      <span>
                        <span className="font-medium">Better: </span>
                        {row.strong}
                      </span>
                    </p>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <h3 className="text-sm font-semibold text-slate-900">
                Follow-ups are understood in context
              </h3>
              <p className="mt-2 text-[15px] leading-7 text-slate-700">
                Once you have an answer you can ask “who approves it?” or “and for contractors?”
                without repeating yourself. The conversation is saved to your own history with a
                title taken from your first question. Starting a new conversation clears that
                context so a new topic is not confused with the old one. Only you can see your
                conversations.
              </p>
            </div>

            <div>
              <h3 className="text-sm font-semibold text-slate-900">Try one of these</h3>
              <p className="mt-1 text-sm text-slate-600">
                Selecting a question opens the chat and submits it for you.
              </p>
              <ul className="mt-3 space-y-2">
                {EXAMPLE_QUESTIONS.map((question) => (
                  <li key={question}>
                    <button
                      type="button"
                      onClick={() => navigate("chat")}
                      className="group flex w-full items-center justify-between gap-4 rounded-lg border border-slate-200 bg-white px-4 py-3 text-left text-[15px] leading-6 text-slate-800 transition-colors hover:border-slate-400 hover:bg-slate-50"
                    >
                      <span>“{question}”</span>
                      <Icons.ArrowRight
                        className="h-4 w-4 shrink-0"
                        style={{ color: brand.primaryColor }}
                        aria-hidden="true"
                      />
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        );

      case "citations":
        return (
          <div className="space-y-5">
            <p className="text-[15px] leading-7 text-slate-700">
              Every substantive statement in an answer is attached to a source. When the answer
              finishes, a citation list names each document it drew on — one entry per document,
              even if several passages from it were used.
            </p>
            <ul className="space-y-3">
              {[
                {
                  icon: "FileText",
                  title: "Click a citation to see the passage",
                  body: "The evidence panel on the right opens at the exact chunk the answer used, so you can check the wording without losing your place in the chat.",
                },
                {
                  icon: "Download",
                  title: "Open the original when you need full context",
                  body: "From the evidence panel, 'Open original' fetches the stored file so you can read the whole document.",
                },
                {
                  icon: "AlertCircle",
                  title: "No citations means no answer",
                  body: "If you see an answer with no sources listed, it is the 'not covered by the knowledge base' response. Treat anything uncited as not verified.",
                },
              ].map((item) => (
                <li key={item.title} className="flex gap-4 rounded-lg bg-slate-50 p-4">
                  <StatusIcon name={item.icon} />
                  <div>
                    <h3 className="text-sm font-semibold text-slate-900">{item.title}</h3>
                    <p className="mt-1 text-sm leading-6 text-slate-700">{item.body}</p>
                  </div>
                </li>
              ))}
            </ul>
            <p className="text-[15px] leading-7 text-slate-700">
              If part of your question is covered and part is not, the answer says so explicitly:
              the supported part is answered with citations, and the rest is named as not covered.
            </p>
          </div>
        );

      case "upload":
        return (
          <div className="space-y-6">
            <div
              className="rounded-lg border-l-4 bg-white p-4"
              style={{ borderColor: brand.accentColor }}
            >
              <h3
                className="flex items-center gap-2 text-sm font-semibold"
                style={{ color: brand.accentColor }}
              >
                <Icons.Users className="h-4 w-4" aria-hidden="true" />
                Uploads are shared company-wide
              </h3>
              <p className="mt-2 text-sm leading-6 text-slate-700">
                A document you add joins the shared knowledge base immediately. It is listed to
                every employee, answerable to every employee, and deletable by every employee.
                Upload only material that is safe for anyone in the company to read.
              </p>
            </div>

            <p className="text-[15px] leading-7 text-slate-700">
              Drag files onto the knowledge base screen or use the file picker. You can select
              several at once; each is tracked separately, so one rejected file does not hold up the
              others. The maximum size is 25&nbsp;MB per file.
            </p>

            <div>
              <h3 className="mb-3 text-sm font-semibold text-slate-900">Supported formats</h3>
              <Table>
                <THead>
                  <TR>
                    <TH scope="col">Format</TH>
                    <TH scope="col">Extension</TH>
                    <TH scope="col">What gets read</TH>
                  </TR>
                </THead>
                <TBody>
                  {FORMATS.map((f) => (
                    <TR key={f.ext}>
                      <TH scope="row" className="font-medium text-slate-900">
                        {f.format}
                      </TH>
                      <TD className="whitespace-nowrap font-mono text-[13px] text-slate-600">
                        {f.ext}
                      </TD>
                      <TD className="text-slate-700">{f.note}</TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
              <p className="mt-3 text-sm leading-6 text-slate-600">
                Anything else — spreadsheets, slide decks, images, archives — is rejected before
                upload with a message naming the file and the four supported formats. Nothing from a
                rejected file reaches the index.
              </p>
            </div>

            <div>
              <h3 className="mb-3 text-sm font-semibold text-slate-900">What the statuses mean</h3>
              <ul className="space-y-3">
                {DOC_STATUSES.map((s) => (
                  <li
                    key={s.label}
                    className="flex flex-col gap-2 rounded-lg border border-slate-200 bg-white p-4 sm:flex-row sm:items-start sm:gap-4"
                  >
                    <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-800">
                      <StatusIcon name={s.icon} />
                      {s.label}
                    </span>
                    <span className="text-sm leading-6 text-slate-700">{s.meaning}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        );

      case "remove":
        return (
          <div className="space-y-5">
            <p className="text-[15px] leading-7 text-slate-700">
              If something is wrong, out of date or should never have been shared, remove it. During
              the pilot every signed-in employee can delete any document, including ones they did
              not upload — there is no separate admin role yet.
            </p>
            <ol className="space-y-3 text-[15px] leading-7 text-slate-700">
              <li className="rounded-lg bg-slate-50 p-4">
                <span className="font-medium text-slate-900">1. Find it. </span>
                On the knowledge base screen, filter the list by filename, then use the row menu and
                choose Delete.
              </li>
              <li className="rounded-lg bg-slate-50 p-4">
                <span className="font-medium text-slate-900">2. Confirm. </span>
                The dialog names the document and states that removal affects all employees.
                Cancelling leaves the document and its index entries untouched.
              </li>
              <li className="rounded-lg bg-slate-50 p-4">
                <span className="font-medium text-slate-900">3. It is gone everywhere. </span>
                The stored file, every chunk and every embedding are removed. Questions that relied
                on it will return the 'not covered by the knowledge base' response unless another
                document covers them.
              </li>
            </ol>
            <p className="text-[15px] leading-7 text-slate-700">
              Each deletion writes an audit entry recording the document, who deleted it and when,
              so the action is always traceable.
            </p>
            <Button
              type="button"
              onClick={() => navigate("documents")}
              className="inline-flex items-center gap-2"
            >
              <Icons.Package className="h-4 w-4" aria-hidden="true" />
              Open the knowledge base
            </Button>
          </div>
        );

      case "limitations":
        return (
          <div className="space-y-5">
            <p className="text-[15px] leading-7 text-slate-700">
              Release one is deliberately narrow. These are the boundaries — please judge the pilot
              against them rather than against what the product might become.
            </p>
            <ul className="space-y-4">
              {LIMITATIONS.map((item) => (
                <li key={item.title} className="rounded-lg border border-slate-200 bg-white p-5">
                  <h3 className="flex items-start gap-2 text-sm font-semibold text-slate-900">
                    <Icons.AlertCircle
                      className="mt-0.5 h-4 w-4 shrink-0"
                      style={{ color: brand.accentColor }}
                      aria-hidden="true"
                    />
                    {item.title}
                  </h3>
                  <p className="mt-2 pl-6 text-sm leading-6 text-slate-700">{item.body}</p>
                </li>
              ))}
            </ul>
          </div>
        );

      case "help":
        return (
          <div className="space-y-5">
            <p className="text-[15px] leading-7 text-slate-700">
              The pilot runs to 18 December 2026. Tell us when an answer is wrong, unsupported or
              missing a source — a thumbs-down on an answer is the fastest way to flag it, and the
              comment box attached to it goes straight to the pilot team.
            </p>
            <dl className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-lg border border-slate-200 bg-white p-4">
                <dt className="text-sm font-semibold text-slate-900">Pilot team</dt>
                <dd className="mt-1 text-sm leading-6 text-slate-700">
                  <a
                    className="underline underline-offset-2"
                    style={{ color: brand.primaryColor }}
                    href="mailto:ai-pilot@company.example"
                  >
                    ai-pilot@company.example
                  </a>
                  <br />
                  Weekdays, 09:00–17:00 UK time.
                </dd>
              </div>
              <div className="rounded-lg border border-slate-200 bg-white p-4">
                <dt className="text-sm font-semibold text-slate-900">Sign-in problems</dt>
                <dd className="mt-1 text-sm leading-6 text-slate-700">
                  Access uses your corporate account. If you see “sign-in failed”, contact the IT
                  service desk on extension 4400.
                </dd>
              </div>
            </dl>
            <p className="text-[15px] leading-7 text-slate-700">
              Building something that needs answers? The answer engine is its own authenticated API,
              so a Teams or Slack front end can call it without rebuilding retrieval or grounding.
            </p>
            <div className="flex flex-wrap gap-3">
              <Button
                type="button"
                onClick={() => navigate("api-reference")}
                className="inline-flex items-center gap-2"
              >
                <Icons.FileText className="h-4 w-4" aria-hidden="true" />
                Read the API reference
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => navigate("chat")}
                className="inline-flex items-center gap-2"
              >
                Back to the chat
                <Icons.ChevronRight className="h-4 w-4" aria-hidden="true" />
              </Button>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="mx-auto w-full max-w-6xl px-6 py-10" style={{ fontFamily: brand.fontBody }}>
      <header className="max-w-3xl">
        <p
          className="text-xs font-semibold uppercase tracking-[0.14em]"
          style={{ color: brand.primaryColor }}
        >
          Pilot guide
        </p>
        <h1
          className="mt-2 text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl"
          style={{ fontFamily: brand.fontHeading }}
        >
          Getting started with Evidence First
        </h1>
        <p className="mt-4 text-lg leading-8 text-slate-700">
          Five minutes of reading. Evidence First answers questions from documents your colleagues
          have uploaded — and shows you the passage behind every claim, so you never have to take an
          answer on trust.
        </p>
        <p className="mt-4 text-sm text-slate-600">
          Release 1.0 (pilot) · Updated 2 October 2026 · About 5 minutes to read
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Button
            type="button"
            onClick={() => navigate("chat")}
            className="inline-flex items-center gap-2"
          >
            <Icons.ArrowRight className="h-4 w-4" aria-hidden="true" />
            Ask your first question
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => navigate("documents")}
            className="inline-flex items-center gap-2"
          >
            <Icons.Upload className="h-4 w-4" aria-hidden="true" />
            Upload a document
          </Button>
        </div>
      </header>

      <Separator className="my-10" />

      <div className="grid gap-10 lg:grid-cols-[240px_minmax(0,1fr)]">
        <nav aria-labelledby="toc-heading" className="lg:sticky lg:top-6 lg:self-start">
          <h2 id="toc-heading" className="text-sm font-semibold text-slate-900">
            On this page
          </h2>

          <div className="mt-4">
            <Label htmlFor="guide-search">Search this guide</Label>
            <div className="relative mt-1.5">
              <Icons.Search
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
                aria-hidden="true"
              />
              <Input
                id="guide-search"
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="e.g. scanned PDF"
                className="pl-9"
              />
            </div>
            <p className="mt-2 text-xs text-slate-600" role="status" aria-live="polite">
              {q
                ? visibleSections.length +
                  " of " +
                  GUIDE_SECTIONS.length +
                  " sections match “" +
                  query.trim() +
                  "”"
                : GUIDE_SECTIONS.length + " sections"}
            </p>
          </div>

          {visibleSections.length > 0 && (
            <ul className="mt-5 space-y-1 border-l border-slate-200">
              {visibleSections.map((s) => {
                const isActive = s.id === activeId;
                return (
                  <li key={s.id}>
                    <button
                      type="button"
                      onClick={() => goToSection(s.id)}
                      aria-current={isActive ? "true" : undefined}
                      className={
                        "-ml-px w-full border-l-2 py-1.5 pl-4 pr-2 text-left text-sm leading-6 transition-colors hover:text-slate-900 " +
                        (isActive
                          ? "font-semibold text-slate-900"
                          : "border-transparent text-slate-600")
                      }
                      style={isActive ? { borderColor: brand.primaryColor } : undefined}
                    >
                      {s.title}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </nav>

        <main className="min-w-0">
          {!q && (
            <Card className="mb-10">
              <CardHeader>
                <CardTitle>Your first five minutes</CardTitle>
                <CardDescription>
                  Tick these off as you go — the list is just for you and is not saved anywhere.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <ul className="space-y-3">
                  {CHECKLIST.map((item) => (
                    <li key={item.id} className="flex items-start gap-3">
                      <Checkbox
                        id={"check-" + item.id}
                        checked={checked[item.id]}
                        onChange={(e) =>
                          setChecked((prev) => ({ ...prev, [item.id]: e.target.checked }))
                        }
                        className="mt-1"
                      />
                      <Label
                        htmlFor={"check-" + item.id}
                        className={
                          "text-[15px] leading-6 " +
                          (checked[item.id] ? "text-slate-500 line-through" : "text-slate-800")
                        }
                      >
                        {item.label}{" "}
                        <span className="text-xs font-normal text-slate-500">({item.minutes})</span>
                      </Label>
                    </li>
                  ))}
                </ul>
                <div>
                  <div
                    className="h-2 w-full overflow-hidden rounded-full bg-slate-200"
                    aria-hidden="true"
                  >
                    <div
                      className="h-full rounded-full transition-all"
                      style={{ width: progressPct + "%", backgroundColor: brand.primaryColor }}
                    />
                  </div>
                  <p className="mt-2 text-sm text-slate-700" role="status" aria-live="polite">
                    {doneCount === CHECKLIST.length
                      ? "All four done — you are set up for the pilot."
                      : doneCount + " of " + CHECKLIST.length + " complete"}
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

          {visibleSections.length === 0 ? (
            <div className="rounded-lg border border-dashed border-slate-300 bg-white px-6 py-14 text-center">
              <Icons.Search className="mx-auto h-6 w-6 text-slate-400" aria-hidden="true" />
              <h2 className="mt-4 text-base font-semibold text-slate-900">
                Nothing in the guide matches “{query.trim()}”
              </h2>
              <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-600">
                Try a broader word such as “upload”, “citation” or “limitations” — or ask the
                chatbot directly and see whether the knowledge base covers it.
              </p>
              <div className="mt-6 flex flex-wrap justify-center gap-3">
                <Button type="button" variant="outline" onClick={() => setQuery("")}>
                  Clear search
                </Button>
                <Button type="button" onClick={() => navigate("chat")}>
                  Ask in the chat
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-12">
              {visibleSections.map((section) => (
                <section
                  key={section.id}
                  id={section.id}
                  ref={(el) => {
                    sectionRefs.current[section.id] = el;
                  }}
                  aria-labelledby={"heading-" + section.id}
                  className="scroll-mt-6"
                >
                  <h2
                    id={"heading-" + section.id}
                    tabIndex={-1}
                    className="text-xl font-semibold tracking-tight text-slate-900"
                    style={{ fontFamily: brand.fontHeading }}
                  >
                    {section.title}
                  </h2>
                  <p className="mt-2 max-w-2xl text-[15px] leading-7 text-slate-600">
                    {section.summary}
                  </p>
                  <div className="mt-6">{sectionBody(section.id)}</div>
                </section>
              ))}
            </div>
          )}

          <Separator className="my-12" />

          <section aria-labelledby="feedback-heading" className="rounded-lg bg-white p-6">
            <h2 id="feedback-heading" className="text-base font-semibold text-slate-900">
              Was this guide helpful?
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              Your answer goes to the pilot team with no other details.
            </p>
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <Button
                type="button"
                variant={helpful === "yes" ? "default" : "outline"}
                onClick={() => setHelpful("yes")}
                aria-pressed={helpful === "yes"}
                className="inline-flex items-center gap-2"
              >
                <Icons.CheckCircle className="h-4 w-4" aria-hidden="true" />
                Yes, this covered it
              </Button>
              <Button
                type="button"
                variant={helpful === "no" ? "default" : "outline"}
                onClick={() => setHelpful("no")}
                aria-pressed={helpful === "no"}
                className="inline-flex items-center gap-2"
              >
                <Icons.X className="h-4 w-4" aria-hidden="true" />
                No, something was missing
              </Button>
            </div>
            <p className="mt-4 text-sm leading-6 text-slate-700" role="status" aria-live="polite">
              {helpful === "yes" &&
                "Thanks — recorded. The guide is reviewed weekly during the pilot."}
              {helpful === "no" &&
                "Thanks — recorded. Tell us what was missing at ai-pilot@company.example and we will add it to the guide."}
            </p>
          </section>
        </main>
      </div>
    </div>
  );
}
