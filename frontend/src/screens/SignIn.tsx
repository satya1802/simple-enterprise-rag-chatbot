/* eslint-disable @typescript-eslint/no-unused-vars */
import React from "react";

import { Icons } from "@/lib/icons";
import { brand } from "@/lib/brand";
import { useNavigate } from "@/lib/navigate";
import { useAuth } from "@/lib/auth";

const {
  Check,
  X,
  ChevronRight,
  ChevronDown,
  User,
  FileText,
  ArrowRight,
  AlertCircle,
  CheckCircle,
} = Icons;

const SAMPLE_ANSWER = {
  question: "How much notice do I need to give before taking parental leave?",
  paragraphs: [
    {
      text: "Employees must give written notice at least 10 weeks before the intended start date of parental leave, confirmed in writing by the line manager within 5 working days.",
      cites: [1],
    },
    {
      text: "For leave starting inside that 10-week window, the People Operations team can approve a shortened notice period where the reason is documented.",
      cites: [1, 2],
    },
  ],
  sources: [
    {
      n: 1,
      filename: "People-Handbook-2026.pdf",
      format: "PDF",
      uploader: "Mira Lindqvist",
      uploaded_at: "28 Sep 2026",
      excerpt:
        "4.3 Parental leave — Notice of at least ten (10) weeks must be submitted in writing to the employee's line manager, who confirms receipt within five (5) working days.",
    },
    {
      n: 2,
      filename: "Leave-Exceptions-Process.md",
      format: "Markdown",
      uploader: "Daniel Opoku",
      uploaded_at: "02 Oct 2026",
      excerpt:
        "Shortened notice is permitted only when People Operations records the reason in the leave register before approval is granted.",
    },
  ],
};

const PILOT_FACTS = [
  "Answers are built only from documents uploaded to the shared corpus.",
  "The model runs inside Quorq's own Azure tenant. Nothing is sent to a public AI API.",
  "Release 1.0 is English-only and does not read scanned or image-only PDFs.",
];

export default function Screen() {
  const navigate = useNavigate();
  const { status, user, beginSignIn } = useAuth();
  const [helpOpen, setHelpOpen] = React.useState(false);
  const [activeTab, setActiveTab] = React.useState("cited");
  const [openSource, setOpenSource] = React.useState(1);

  const focusRing =
    "focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-[#F1F3F1]";
  const ringVar = { ["--tw-ring-color"]: brand.primaryColor };

  const tabs = [
    { id: "cited", label: "A cited answer" },
    { id: "refusal", label: "When nothing covers it" },
  ];

  function onTabKeyDown(event) {
    const index = tabs.findIndex((t) => t.id === activeTab);
    if (event.key === "ArrowRight") {
      event.preventDefault();
      setActiveTab(tabs[(index + 1) % tabs.length].id);
    } else if (event.key === "ArrowLeft") {
      event.preventDefault();
      setActiveTab(tabs[(index - 1 + tabs.length) % tabs.length].id);
    }
  }

  const showFailure = status === "unauthenticated" || status === "error";

  return (
    <div
      className="min-h-full w-full px-6 py-10 sm:px-10"
      style={{ backgroundColor: brand.backgroundColor, fontFamily: brand.fontBody }}
    >
      <div className="mx-auto grid max-w-6xl gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,460px)] lg:gap-12">
        {/* ---------------- Left: sign-in ---------------- */}
        <main className="max-w-xl">
          <p
            className="text-xs font-semibold uppercase tracking-[0.14em]"
            style={{ color: brand.neutralColor }}
          >
            Quorq Knowledge Assistant · Pilot release 1.0
          </p>
          <h1
            className="mt-3 text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl"
            style={{ fontFamily: brand.fontHeading }}
          >
            Sign in to the knowledge assistant
          </h1>
          <p className="mt-3 text-base leading-relaxed" style={{ color: brand.neutralColor }}>
            Use your Quorq corporate account. There are no local accounts and no self-registration —
            the assistant is reachable only from the internal network or behind the SSO gate.
          </p>

          {/* Sign-in card */}
          <section
            aria-labelledby="sso-heading"
            className="mt-7 rounded-xl border bg-white p-6 sm:p-8"
            style={{ borderColor: "#D5DCD8", borderRadius: brand.radius }}
          >
            <h2 id="sso-heading" className="text-lg font-semibold text-slate-900">
              Corporate single sign-on
            </h2>
            <p className="mt-1.5 text-sm leading-relaxed" style={{ color: brand.neutralColor }}>
              You will be taken to Quorq Identity (Microsoft Entra ID) and returned here once you
              have authenticated.
            </p>

            <div className="mt-6" aria-live="polite">
              {status === "loading" ? (
                <p className="text-sm" style={{ color: brand.neutralColor }}>
                  Checking your session…
                </p>
              ) : status === "authenticated" && user ? (
                <div
                  className="rounded-lg border p-5"
                  style={{
                    borderColor: "#C8D3CE",
                    backgroundColor: "#F3F7F5",
                    borderRadius: brand.radius,
                  }}
                >
                  <h3
                    className="flex items-center gap-2 text-sm font-semibold"
                    style={{ color: brand.primaryColor }}
                  >
                    <Icons.CheckCircle className="h-5 w-5" aria-hidden="true" />
                    Session established
                  </h3>
                  <p className="mt-4 text-sm font-semibold text-slate-900">
                    {user.display_name}
                  </p>
                  {user.is_admin ? (
                    <p className="mt-0.5 text-xs" style={{ color: brand.neutralColor }}>
                      Knowledge base admin
                    </p>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => navigate("chat")}
                    className={`mt-6 inline-flex w-full items-center justify-center gap-2 rounded-md px-5 py-3 text-sm font-semibold text-white ${focusRing}`}
                    style={{
                      backgroundColor: brand.primaryColor,
                      borderRadius: brand.radius,
                      ...ringVar,
                    }}
                  >
                    Continue to the assistant
                    <Icons.ArrowRight className="h-4 w-4" aria-hidden="true" />
                  </button>
                </div>
              ) : showFailure ? (
                <div
                  role="alert"
                  className="rounded-lg border bg-white px-5 py-4"
                  style={{ borderColor: brand.accentColor, borderRadius: brand.radius }}
                >
                  <h2
                    className="flex items-center gap-2 text-base font-semibold"
                    style={{ color: brand.accentColor }}
                  >
                    <Icons.AlertCircle className="h-5 w-5" aria-hidden="true" />
                    Sign-in failed — contact IT
                  </h2>
                  <p className="mt-2 text-sm leading-relaxed text-slate-700">
                    We could not verify your session with the corporate identity provider. You
                    cannot reach the chat, upload or document screens until sign-in succeeds.
                  </p>
                  <div className="mt-4 flex flex-wrap items-center gap-3">
                    <button
                      type="button"
                      onClick={beginSignIn}
                      className={`inline-flex items-center justify-center gap-2.5 rounded-md px-5 py-3 text-sm font-semibold text-white ${focusRing}`}
                      style={{
                        backgroundColor: brand.primaryColor,
                        borderRadius: brand.radius,
                        ...ringVar,
                      }}
                    >
                      <Icons.User className="h-4 w-4" aria-hidden="true" />
                      Continue with corporate SSO
                    </button>
                    <a
                      href="mailto:servicedesk@quorq.ai"
                      className={`rounded-md text-sm font-medium underline underline-offset-4 ${focusRing}`}
                      style={{ color: brand.primaryColor, ...ringVar }}
                    >
                      Email the service desk
                    </a>
                  </div>
                </div>
              ) : null}
            </div>

            {status !== "authenticated" ? (
              <>
                <hr className="my-6 border-slate-200" />

                <h3 className="sr-only">Help with signing in</h3>
                <button
                  type="button"
                  onClick={() => setHelpOpen((v) => !v)}
                  aria-expanded={helpOpen}
                  aria-controls="signin-help"
                  className={`flex w-full items-center justify-between rounded-md px-1 py-1.5 text-sm font-medium text-slate-800 hover:text-slate-950 ${focusRing}`}
                  style={ringVar}
                >
                  Trouble signing in?
                  {helpOpen ? (
                    <Icons.ChevronDown className="h-4 w-4" aria-hidden="true" />
                  ) : (
                    <Icons.ChevronRight className="h-4 w-4" aria-hidden="true" />
                  )}
                </button>
                {helpOpen ? (
                  <ul
                    id="signin-help"
                    className="mt-3 space-y-2.5 pl-1 text-sm leading-relaxed"
                    style={{ color: brand.neutralColor }}
                  >
                    <li className="flex gap-2.5">
                      <Icons.ChevronRight
                        className="mt-1 h-3.5 w-3.5 shrink-0"
                        aria-hidden="true"
                      />
                      <span>
                        The assistant is internal only. From outside the office network, connect to
                        the Quorq VPN first.
                      </span>
                    </li>
                    <li className="flex gap-2.5">
                      <Icons.ChevronRight
                        className="mt-1 h-3.5 w-3.5 shrink-0"
                        aria-hidden="true"
                      />
                      <span>
                        Contractors and external partners are not in the pilot directory and cannot
                        sign in.
                      </span>
                    </li>
                    <li className="flex gap-2.5">
                      <Icons.ChevronRight
                        className="mt-1 h-3.5 w-3.5 shrink-0"
                        aria-hidden="true"
                      />
                      <span>
                        Still blocked? Contact the IT service desk on extension 4400 or
                        servicedesk@quorq.ai with reference code AUTH-4013-QX.
                      </span>
                    </li>
                  </ul>
                ) : null}
              </>
            ) : null}
          </section>

          <p className="mt-6 text-sm" style={{ color: brand.neutralColor }}>
            New to the pilot?{" "}
            <button
              type="button"
              onClick={() => navigate("getting-started")}
              className={`rounded font-semibold underline underline-offset-4 ${focusRing}`}
              style={{ color: brand.primaryColor, ...ringVar }}
            >
              Read the getting-started guide
            </button>{" "}
            — it is readable before you sign in.
          </p>
        </main>

        {/* ---------------- Right: evidence panel ---------------- */}
        <aside
          aria-labelledby="evidence-heading"
          className="rounded-xl border bg-white p-6 sm:p-7"
          style={{ borderColor: "#D5DCD8", borderRadius: brand.radius }}
        >
          <h2 id="evidence-heading" className="text-lg font-semibold text-slate-900">
            Every answer arrives with its proof
          </h2>
          <p className="mt-1.5 text-sm leading-relaxed" style={{ color: brand.neutralColor }}>
            The assistant answers only from documents in the shared corpus, and shows you the
            passage it used.
          </p>

          <div
            role="tablist"
            aria-label="Example assistant behaviour"
            onKeyDown={onTabKeyDown}
            className="mt-5 flex gap-1 rounded-lg p-1"
            style={{ backgroundColor: "#E7EBE8" }}
          >
            {tabs.map((tab) => {
              const selected = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  id={`tab-${tab.id}`}
                  role="tab"
                  type="button"
                  aria-selected={selected}
                  aria-controls={`panel-${tab.id}`}
                  tabIndex={selected ? 0 : -1}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex-1 rounded-md px-3 py-2 text-xs font-semibold ${focusRing}`}
                  style={{
                    backgroundColor: selected ? "#FFFFFF" : "transparent",
                    color: selected ? brand.primaryColor : brand.neutralColor,
                    ...ringVar,
                  }}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>

          {activeTab === "cited" ? (
            <div
              id="panel-cited"
              role="tabpanel"
              aria-labelledby="tab-cited"
              tabIndex={0}
              className="mt-5"
            >
              <p
                className="text-xs font-semibold uppercase tracking-wider"
                style={{ color: brand.neutralColor }}
              >
                Question
              </p>
              <p className="mt-1.5 text-sm font-medium text-slate-900">{SAMPLE_ANSWER.question}</p>

              <h3
                className="mt-5 text-xs font-semibold uppercase tracking-wider"
                style={{ color: brand.neutralColor }}
              >
                Answer
              </h3>
              <div className="mt-2 space-y-3">
                {SAMPLE_ANSWER.paragraphs.map((para, i) => (
                  <p key={i} className="text-sm leading-relaxed text-slate-700">
                    {para.text}{" "}
                    {para.cites.map((n) => (
                      <button
                        key={n}
                        type="button"
                        onClick={() => setOpenSource(n)}
                        aria-pressed={openSource === n}
                        className={`mx-0.5 inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded border px-1 align-middle text-[11px] font-semibold ${focusRing}`}
                        style={{
                          borderColor: brand.primaryColor,
                          color: openSource === n ? "#FFFFFF" : brand.primaryColor,
                          backgroundColor: openSource === n ? brand.primaryColor : "transparent",
                          ...ringVar,
                        }}
                      >
                        <span className="sr-only">Show source </span>
                        {n}
                      </button>
                    ))}
                  </p>
                ))}
              </div>

              <h3
                className="mt-6 text-xs font-semibold uppercase tracking-wider"
                style={{ color: brand.neutralColor }}
              >
                Source panel
              </h3>
              <ul className="mt-2 space-y-2">
                {SAMPLE_ANSWER.sources.map((src) => {
                  const open = openSource === src.n;
                  return (
                    <li
                      key={src.n}
                      className="rounded-lg border"
                      style={{
                        borderColor: open ? brand.primaryColor : "#DCE2DF",
                        backgroundColor: open ? "#F6F9F7" : "#FFFFFF",
                        borderRadius: brand.radius,
                      }}
                    >
                      <button
                        type="button"
                        onClick={() => setOpenSource(open ? null : src.n)}
                        aria-expanded={open}
                        aria-controls={`excerpt-${src.n}`}
                        className={`flex w-full items-center gap-3 px-3.5 py-3 text-left ${focusRing}`}
                        style={ringVar}
                      >
                        <Icons.FileText
                          className="h-4 w-4 shrink-0"
                          style={{ color: brand.primaryColor }}
                          aria-hidden="true"
                        />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium text-slate-900">
                            [{src.n}] {src.filename}
                          </span>
                          <span
                            className="mt-0.5 block text-xs"
                            style={{ color: brand.neutralColor }}
                          >
                            {src.format} · {src.uploader} · {src.uploaded_at}
                          </span>
                        </span>
                        {open ? (
                          <Icons.ChevronDown
                            className="h-4 w-4 shrink-0"
                            style={{ color: brand.neutralColor }}
                            aria-hidden="true"
                          />
                        ) : (
                          <Icons.ChevronRight
                            className="h-4 w-4 shrink-0"
                            style={{ color: brand.neutralColor }}
                            aria-hidden="true"
                          />
                        )}
                      </button>
                      {open ? (
                        <p
                          id={`excerpt-${src.n}`}
                          className="border-t px-3.5 py-3 text-xs leading-relaxed text-slate-700"
                          style={{ borderColor: "#DCE2DF" }}
                        >
                          “{src.excerpt}”
                        </p>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            </div>
          ) : (
            <div
              id="panel-refusal"
              role="tabpanel"
              aria-labelledby="tab-refusal"
              tabIndex={0}
              className="mt-5"
            >
              <p
                className="text-xs font-semibold uppercase tracking-wider"
                style={{ color: brand.neutralColor }}
              >
                Question
              </p>
              <p className="mt-1.5 text-sm font-medium text-slate-900">
                What is the capital of France?
              </p>
              <h3
                className="mt-5 text-xs font-semibold uppercase tracking-wider"
                style={{ color: brand.neutralColor }}
              >
                Answer
              </h3>
              <div
                className="mt-2 rounded-lg border p-4"
                style={{
                  borderColor: "#DCE2DF",
                  backgroundColor: "#FAFBFA",
                  borderRadius: brand.radius,
                }}
              >
                <p
                  className="flex items-start gap-2 text-sm font-medium"
                  style={{ color: brand.accentColor }}
                >
                  <Icons.AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                  Not covered by the knowledge base
                </p>
                <p className="mt-2 text-sm leading-relaxed text-slate-700">
                  Nothing in the uploaded corpus covers this question, so there is no grounded
                  answer to give. The assistant will not answer from the model's own general
                  knowledge.
                </p>
                <p className="mt-3 text-xs" style={{ color: brand.neutralColor }}>
                  Citations: none — no source passed the relevance threshold.
                </p>
              </div>
            </div>
          )}

          <hr className="my-6 border-slate-200" />

          <h3
            className="text-xs font-semibold uppercase tracking-wider"
            style={{ color: brand.neutralColor }}
          >
            Known limits of release 1.0
          </h3>
          <ul className="mt-3 space-y-2.5">
            {PILOT_FACTS.map((fact) => (
              <li key={fact} className="flex gap-2.5 text-sm leading-relaxed text-slate-700">
                <Icons.Check
                  className="mt-0.5 h-4 w-4 shrink-0"
                  style={{ color: brand.primaryColor }}
                  aria-hidden="true"
                />
                <span>{fact}</span>
              </li>
            ))}
          </ul>
        </aside>
      </div>
    </div>
  );
}
