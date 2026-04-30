"use client";

import { useMemo, useRef, useState, type FormEvent } from "react";

type ResearchDepth = "quick" | "standard" | "deep";

type ResearchEvent =
  | { event: "status"; message: string }
  | { event: "meta"; agentId: string; runId: string }
  | { event: "thinking"; text: string }
  | { event: "tool"; name: string; status: string }
  | { event: "text"; text: string }
  | { event: "done"; status: string; result?: string }
  | { event: "error"; message: string };

const EXAMPLE_TOPICS = [
  "What changed in AI coding agent platforms in 2026?",
  "Compare current approaches to reducing hallucinations in LLM research agents.",
  "Research practical adoption risks for autonomous software engineering agents.",
];

function parseResearchEvent(line: string): ResearchEvent | undefined {
  try {
    const event = JSON.parse(line) as ResearchEvent;
    return typeof event === "object" && event !== null && "event" in event
      ? event
      : undefined;
  } catch {
    return undefined;
  }
}

export default function Home() {
  const [topic, setTopic] = useState(EXAMPLE_TOPICS[0]);
  const [depth, setDepth] = useState<ResearchDepth>("standard");
  const [report, setReport] = useState("");
  const [thinking, setThinking] = useState("");
  const [events, setEvents] = useState<string[]>([]);
  const [agentRun, setAgentRun] = useState("");
  const [error, setError] = useState("");
  const [isResearching, setIsResearching] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const hasOutput = report || thinking || events.length > 0 || error;

  const eventPreview = useMemo(() => events.slice(-7), [events]);

  async function startResearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    abortRef.current?.abort();

    const controller = new AbortController();
    abortRef.current = controller;

    setReport("");
    setThinking("");
    setEvents(["Preparing research request"]);
    setAgentRun("");
    setError("");
    setIsResearching(true);

    try {
      const response = await fetch("/api/research", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic, depth }),
        signal: controller.signal,
      });

      if (!response.ok || !response.body) {
        const payload = (await response.json().catch(() => null)) as
          | { error?: string }
          | null;
        throw new Error(payload?.error ?? "Research request failed.");
      }

      const reader = response.body
        .pipeThrough(new TextDecoderStream())
        .getReader();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          break;
        }

        buffer += value;
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.trim()) {
            continue;
          }

          const nextEvent = parseResearchEvent(line);
          if (!nextEvent) {
            continue;
          }

          if (nextEvent.event === "text") {
            setReport((current) => current + nextEvent.text);
          }

          if (nextEvent.event === "thinking") {
            setThinking((current) => (current + nextEvent.text).slice(-1600));
          }

          if (nextEvent.event === "status") {
            setEvents((current) => [...current, nextEvent.message]);
          }

          if (nextEvent.event === "tool") {
            setEvents((current) => [
              ...current,
              `${nextEvent.name}: ${nextEvent.status}`,
            ]);
          }

          if (nextEvent.event === "meta") {
            setAgentRun(`${nextEvent.agentId} / ${nextEvent.runId}`);
            setEvents((current) => [...current, "Cursor agent started"]);
          }

          if (nextEvent.event === "done") {
            if (nextEvent.result) {
              setReport((current) => current || nextEvent.result || "");
            }
            setEvents((current) => [
              ...current,
              `Research finished: ${nextEvent.status}`,
            ]);
          }

          if (nextEvent.event === "error") {
            throw new Error(nextEvent.message);
          }
        }
      }
    } catch (caught) {
      if (caught instanceof DOMException && caught.name === "AbortError") {
        setEvents((current) => [...current, "Research cancelled"]);
      } else {
        setError(
          caught instanceof Error ? caught.message : "Research request failed.",
        );
      }
    } finally {
      setIsResearching(false);
    }
  }

  function cancelResearch() {
    abortRef.current?.abort();
  }

  return (
    <main className="min-h-screen bg-[#08111f] px-5 py-8 text-white sm:px-8 lg:px-12">
      <section className="mx-auto grid max-w-7xl gap-8 lg:grid-cols-[0.9fr_1.1fr]">
        <div className="rounded-[2rem] border border-white/10 bg-white/[0.06] p-6 shadow-2xl shadow-cyan-950/30 backdrop-blur md:p-8">
          <p className="mb-4 inline-flex rounded-full border border-cyan-300/20 bg-cyan-300/10 px-3 py-1 text-sm font-medium text-cyan-100">
            Powered by Cursor SDK
          </p>
          <h1 className="text-4xl font-semibold tracking-tight text-white md:text-6xl">
            Deep research, streamed from a Cursor agent.
          </h1>
          <p className="mt-5 text-lg leading-8 text-slate-300">
            Ask a complex question and watch the agent plan, inspect sources,
            use tools, and draft a structured research brief.
          </p>

          <form className="mt-8 space-y-5" onSubmit={startResearch}>
            <label className="block">
              <span className="text-sm font-medium text-slate-200">
                Research topic
              </span>
              <textarea
                className="mt-2 min-h-36 w-full resize-y rounded-3xl border border-white/10 bg-slate-950/70 p-4 text-base leading-7 text-white outline-none ring-cyan-300/30 transition focus:border-cyan-200 focus:ring-4"
                value={topic}
                onChange={(event) => setTopic(event.target.value)}
                placeholder="Enter a question that needs investigation..."
                maxLength={1200}
              />
            </label>

            <div className="grid gap-3 sm:grid-cols-3">
              {(["quick", "standard", "deep"] as const).map((option) => (
                <label
                  className={`cursor-pointer rounded-2xl border p-4 transition ${
                    depth === option
                      ? "border-cyan-200 bg-cyan-200/15 text-cyan-50"
                      : "border-white/10 bg-white/[0.04] text-slate-300 hover:border-white/25"
                  }`}
                  key={option}
                >
                  <input
                    className="sr-only"
                    type="radio"
                    name="depth"
                    value={option}
                    checked={depth === option}
                    onChange={() => setDepth(option)}
                  />
                  <span className="block text-sm font-semibold capitalize">
                    {option}
                  </span>
                  <span className="mt-1 block text-xs text-slate-400">
                    {option === "quick"
                      ? "Fast scan"
                      : option === "deep"
                        ? "More caveats"
                        : "Balanced brief"}
                  </span>
                </label>
              ))}
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              <button
                className="rounded-full bg-cyan-200 px-6 py-3 text-base font-semibold text-slate-950 transition hover:bg-cyan-100 disabled:cursor-not-allowed disabled:opacity-60"
                type="submit"
                disabled={isResearching || topic.trim().length < 8}
              >
                {isResearching ? "Researching..." : "Start research"}
              </button>
              <button
                className="rounded-full border border-white/15 px-6 py-3 text-base font-semibold text-white transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
                type="button"
                disabled={!isResearching}
                onClick={cancelResearch}
              >
                Cancel
              </button>
            </div>
          </form>

          <div className="mt-8 space-y-3">
            <p className="text-sm font-medium text-slate-300">Try a prompt</p>
            {EXAMPLE_TOPICS.map((example) => (
              <button
                className="block w-full rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-left text-sm text-slate-300 transition hover:border-cyan-200/50 hover:text-cyan-50"
                key={example}
                type="button"
                onClick={() => setTopic(example)}
              >
                {example}
              </button>
            ))}
          </div>
        </div>

        <div className="flex min-h-[42rem] flex-col rounded-[2rem] border border-white/10 bg-slate-950/80 p-5 shadow-2xl shadow-black/30 md:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-4">
            <div>
              <h2 className="text-xl font-semibold text-white">
                Research workspace
              </h2>
              <p className="text-sm text-slate-400">
                {agentRun || "Agent and run IDs appear after launch."}
              </p>
            </div>
            <span
              className={`rounded-full px-3 py-1 text-sm ${
                isResearching
                  ? "bg-emerald-300/15 text-emerald-200"
                  : "bg-white/10 text-slate-300"
              }`}
            >
              {isResearching ? "Live" : "Idle"}
            </span>
          </div>

          {hasOutput ? (
            <div className="grid flex-1 gap-4 overflow-hidden pt-4 lg:grid-rows-[auto_1fr]">
              <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-4">
                <p className="mb-3 text-sm font-semibold text-cyan-100">
                  Progress
                </p>
                <div className="space-y-2">
                  {eventPreview.map((item, index) => (
                    <p
                      className="rounded-2xl bg-slate-900/80 px-3 py-2 text-sm text-slate-300"
                      key={`${item}-${index}`}
                    >
                      {item}
                    </p>
                  ))}
                </div>
                {thinking && (
                  <p className="mt-4 line-clamp-3 text-sm leading-6 text-slate-500">
                    {thinking}
                  </p>
                )}
              </div>

              <article className="overflow-auto rounded-3xl border border-white/10 bg-white p-5 text-slate-950">
                {error ? (
                  <div className="rounded-2xl bg-red-50 p-4 text-red-700">
                    {error}
                  </div>
                ) : (
                  <pre className="whitespace-pre-wrap font-sans text-sm leading-7">
                    {report || "Waiting for the research brief..."}
                  </pre>
                )}
              </article>
            </div>
          ) : (
            <div className="flex flex-1 items-center justify-center text-center">
              <div className="max-w-sm">
                <div className="mx-auto mb-5 flex size-16 items-center justify-center rounded-3xl bg-cyan-200/10 text-3xl">
                  R
                </div>
                <p className="text-lg font-medium text-white">
                  Your report will stream here.
                </p>
                <p className="mt-2 text-sm leading-6 text-slate-400">
                  The route uses your server-side Cursor API key, so no secret is
                  exposed to the browser.
                </p>
              </div>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
