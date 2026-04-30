"use client";

import { FormEvent, useState } from "react";

type ResearchResponse = {
  runId: string;
  output?: string;
  usage?: unknown;
  error?: string;
};

export default function Home() {
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ResearchResponse | null>(null);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!query.trim()) {
      return;
    }

    setLoading(true);
    setResult(null);

    try {
      const response = await fetch("/api/deep-research", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ query }),
      });

      const payload = (await response.json()) as ResearchResponse;
      setResult(payload);
    } catch {
      setResult({ runId: "", error: "Network error while requesting research." });
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-4xl flex-col gap-6 px-6 py-10">
      <h1 className="text-3xl font-semibold">Deep Research Demo (Cursor SDK)</h1>
      <p className="text-zinc-600 dark:text-zinc-300">
        Enter a research question and this app runs a Cursor SDK agent to generate a structured report.
      </p>

      <form onSubmit={onSubmit} className="flex flex-col gap-3">
        <textarea
          className="min-h-32 rounded-md border border-zinc-300 bg-transparent p-3"
          placeholder="Example: Compare the latest 2026 state of battery recycling technologies in the U.S."
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        <button
          type="submit"
          disabled={loading}
          className="w-fit rounded-md bg-black px-4 py-2 text-white disabled:opacity-60 dark:bg-white dark:text-black"
        >
          {loading ? "Researching..." : "Run deep research"}
        </button>
      </form>

      {result && (
        <section className="rounded-md border border-zinc-200 p-4 dark:border-zinc-700">
          {result.error ? (
            <p className="text-red-600">{result.error}</p>
          ) : (
            <>
              <p className="mb-2 text-sm text-zinc-500">Run ID: {result.runId}</p>
              <pre className="whitespace-pre-wrap text-sm">{String(result.output ?? "")}</pre>
            </>
          )}
        </section>
      )}
    </main>
  );
}
