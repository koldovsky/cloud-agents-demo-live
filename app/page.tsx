"use client";

import { useState, useRef, useCallback } from "react";

type StreamEvent =
  | { type: "status"; message: string }
  | { type: "thinking"; content: string }
  | { type: "text"; content: string }
  | { type: "task"; content: string }
  | { type: "tool_call"; name: string; status: string; args?: unknown; result?: unknown }
  | { type: "done"; status: string; result?: string }
  | { type: "error"; message: string };

type DisplayItem =
  | { kind: "status"; message: string; id: string }
  | { kind: "thinking"; content: string; id: string }
  | { kind: "text"; content: string; id: string }
  | { kind: "tool_call"; name: string; status: string; args?: unknown; result?: unknown; id: string }
  | { kind: "error"; message: string; id: string };

let idCounter = 0;
function nextId() {
  return `item-${++idCounter}`;
}

type DistributiveOmit<T, K extends keyof T> = T extends unknown ? Omit<T, K> : never;

export default function Home() {
  const [query, setQuery] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [items, setItems] = useState<DisplayItem[]>([]);
  const [running, setRunning] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const addItem = useCallback((item: DistributiveOmit<DisplayItem, "id">) => {
    setItems((prev) => [...prev, { ...item, id: nextId() } as DisplayItem]);
  }, []);

  const updateLastToolCall = useCallback(
    (name: string, status: string, result: unknown) => {
      setItems((prev) => {
        const idx = [...prev].reverse().findIndex(
          (i) => i.kind === "tool_call" && i.name === name && i.status === "running"
        );
        if (idx === -1) return prev;
        const realIdx = prev.length - 1 - idx;
        const updated = [...prev];
        updated[realIdx] = { ...updated[realIdx], status, result } as DisplayItem;
        return updated;
      });
    },
    []
  );

  async function startResearch() {
    if (!query.trim()) return;
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    setItems([]);
    setRunning(true);

    try {
      const res = await fetch("/api/research", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: query.trim(), apiKey: apiKey.trim() }),
        signal: ctrl.signal,
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Request failed" }));
        addItem({ kind: "error", message: err.error ?? "Request failed" });
        return;
      }

      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split("\n\n");
        buffer = parts.pop() ?? "";
        for (const part of parts) {
          const line = part.trim();
          if (!line.startsWith("data: ")) continue;
          try {
            const event: StreamEvent = JSON.parse(line.slice(6));
            handleEvent(event);
          } catch {
            // ignore malformed lines
          }
        }
      }
    } catch (err) {
      if (err instanceof Error && err.name !== "AbortError") {
        addItem({ kind: "error", message: err.message });
      }
    } finally {
      setRunning(false);
    }

    function handleEvent(event: StreamEvent) {
      switch (event.type) {
        case "status":
          addItem({ kind: "status", message: event.message });
          break;
        case "thinking":
          addItem({ kind: "thinking", content: event.content });
          break;
        case "text":
          addItem({ kind: "text", content: event.content });
          break;
        case "task":
          addItem({ kind: "status", message: `📋 ${event.content}` });
          break;
        case "tool_call":
          if (event.status === "running") {
            addItem({ kind: "tool_call", name: event.name, status: "running", args: event.args });
          } else {
            updateLastToolCall(event.name, event.status, event.result);
          }
          break;
        case "done":
          addItem({ kind: "status", message: `✅ Research complete (${event.status})` });
          break;
        case "error":
          addItem({ kind: "error", message: event.message });
          break;
      }
    }
  }

  function stop() {
    abortRef.current?.abort();
    setRunning(false);
  }

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 font-sans">
      <div className="max-w-4xl mx-auto px-4 py-10">
        {/* Header */}
        <div className="mb-8 text-center">
          <h1 className="text-4xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50 mb-2">
            Deep Research
          </h1>
          <p className="text-zinc-500 dark:text-zinc-400 text-lg">
            Powered by{" "}
            <a
              href="https://cursor.com/docs/sdk/typescript"
              target="_blank"
              rel="noopener noreferrer"
              className="underline underline-offset-2 hover:text-zinc-900 dark:hover:text-zinc-100"
            >
              Cursor SDK
            </a>
          </p>
        </div>

        {/* Input */}
        <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-sm border border-zinc-200 dark:border-zinc-800 p-6 mb-6">
          <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
            Research Question
          </label>
          <textarea
            className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 px-4 py-3 text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-100 resize-none"
            rows={3}
            placeholder="e.g. What are the latest breakthroughs in quantum computing and their practical applications?"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            disabled={running}
          />

          <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mt-4 mb-1">
            Cursor API Key{" "}
            <span className="font-normal text-zinc-400">(or set CURSOR_API_KEY env var)</span>
          </label>
          <input
            type="password"
            className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 px-4 py-2 text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-100"
            placeholder="sk-…"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            disabled={running}
          />

          <div className="flex gap-3 mt-4">
            <button
              onClick={startResearch}
              disabled={running || !query.trim()}
              className="flex-1 rounded-full bg-zinc-900 dark:bg-zinc-50 text-white dark:text-zinc-900 font-semibold py-2.5 transition-colors hover:bg-zinc-700 dark:hover:bg-zinc-200 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {running ? "Researching…" : "Start Research"}
            </button>
            {running && (
              <button
                onClick={stop}
                className="rounded-full border border-zinc-300 dark:border-zinc-700 px-5 py-2.5 text-sm font-medium hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
              >
                Stop
              </button>
            )}
          </div>
        </div>

        {/* Output */}
        {items.length > 0 && (
          <div className="space-y-3">
            {items.map((item) => {
              switch (item.kind) {
                case "status":
                  return (
                    <div
                      key={item.id}
                      className="text-sm text-zinc-500 dark:text-zinc-400 flex items-center gap-2 px-1"
                    >
                      <span className="inline-block w-1.5 h-1.5 rounded-full bg-zinc-400 dark:bg-zinc-600 flex-shrink-0" />
                      {item.message}
                    </div>
                  );

                case "thinking":
                  return (
                    <details
                      key={item.id}
                      className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-xl px-4 py-3"
                    >
                      <summary className="text-sm font-medium text-amber-700 dark:text-amber-400 cursor-pointer select-none">
                        🧠 Thinking
                      </summary>
                      <pre className="mt-2 text-xs text-amber-800 dark:text-amber-300 whitespace-pre-wrap break-words leading-relaxed">
                        {item.content}
                      </pre>
                    </details>
                  );

                case "tool_call":
                  return (
                    <details
                      key={item.id}
                      className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-xl px-4 py-3"
                    >
                      <summary className="text-sm font-medium text-blue-700 dark:text-blue-400 cursor-pointer select-none flex items-center gap-2">
                        <span>🔧 {item.name}</span>
                        <span
                          className={`text-xs px-2 py-0.5 rounded-full ${
                            item.status === "running"
                              ? "bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-300"
                              : item.status === "completed"
                              ? "bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300"
                              : "bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300"
                          }`}
                        >
                          {item.status}
                        </span>
                      </summary>
                      {item.args !== undefined && (
                        <pre className="mt-2 text-xs text-blue-800 dark:text-blue-300 whitespace-pre-wrap break-words leading-relaxed">
                          {JSON.stringify(item.args, null, 2)}
                        </pre>
                      )}
                      {item.result !== undefined && (
                        <>
                          <div className="mt-2 text-xs font-semibold text-blue-600 dark:text-blue-400">Result:</div>
                          <pre className="mt-1 text-xs text-blue-800 dark:text-blue-300 whitespace-pre-wrap break-words leading-relaxed max-h-60 overflow-y-auto">
                            {typeof item.result === "string"
                              ? item.result
                              : JSON.stringify(item.result, null, 2)}
                          </pre>
                        </>
                      )}
                    </details>
                  );

                case "text":
                  return (
                    <div
                      key={item.id}
                      className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl px-5 py-4 text-zinc-800 dark:text-zinc-200 text-sm leading-7 whitespace-pre-wrap break-words"
                    >
                      {item.content}
                    </div>
                  );

                case "error":
                  return (
                    <div
                      key={item.id}
                      className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-xl px-4 py-3 text-sm text-red-700 dark:text-red-400"
                    >
                      ⚠️ {item.message}
                    </div>
                  );
              }
            })}

            {running && (
              <div className="flex items-center gap-2 text-sm text-zinc-400 px-1">
                <span className="inline-flex gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-zinc-400 animate-bounce [animation-delay:0ms]" />
                  <span className="w-1.5 h-1.5 rounded-full bg-zinc-400 animate-bounce [animation-delay:150ms]" />
                  <span className="w-1.5 h-1.5 rounded-full bg-zinc-400 animate-bounce [animation-delay:300ms]" />
                </span>
                Agent is researching…
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
