import { Agent, type InteractionUpdate, type SDKMessage } from "@cursor/sdk";

export const runtime = "nodejs";
export const maxDuration = 300;

const DEPTH_CONFIG = {
  quick: {
    label: "Quick scan",
    instruction:
      "Create a concise report with 3-5 findings and only the most important sources.",
  },
  standard: {
    label: "Standard research",
    instruction:
      "Create a balanced report with a research plan, 5-8 findings, tradeoffs, and sources.",
  },
  deep: {
    label: "Deep research",
    instruction:
      "Create a thorough report with a research plan, multiple perspectives, risks, caveats, and source-backed recommendations.",
  },
} as const;

type ResearchDepth = keyof typeof DEPTH_CONFIG;

type StreamEvent =
  | { event: "status"; message: string }
  | { event: "meta"; agentId: string; runId: string }
  | { event: "thinking"; text: string }
  | { event: "tool"; name: string; status: string }
  | { event: "text"; text: string }
  | { event: "done"; status: string; result?: string }
  | { event: "error"; message: string };

function getApiKey() {
  return process.env.CURSOR_API_KEY ?? process.env.CURSOR_API;
}

function parseDepth(depth: unknown): ResearchDepth {
  return depth === "quick" || depth === "deep" ? depth : "standard";
}

function buildResearchPrompt(topic: string, depth: ResearchDepth) {
  const depthConfig = DEPTH_CONFIG[depth];

  return [
    "You are running a deep research workflow similar to ChatGPT Deep Research.",
    `Research topic: ${topic}`,
    `Research depth: ${depthConfig.label}. ${depthConfig.instruction}`,
    "",
    "Requirements:",
    "- Work in read-only mode. Do not edit files, create files, commit, or change the repository.",
    "- Use available search, web, documentation, and shell tools only when they help answer the research question.",
    "- Prefer current primary sources. Cite source URLs inline when external sources are used.",
    "- If live web access is unavailable, state that limitation clearly and proceed with the best available evidence.",
    "- Structure the final report as: Executive summary, Research process, Key findings, Source notes, Risks and unknowns, Recommended next steps.",
    "- Be specific, note uncertainty, and avoid unsupported claims.",
  ].join("\n");
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Research request failed.";
}

function assistantText(event: SDKMessage) {
  if (event.type !== "assistant") {
    return "";
  }

  return event.message.content
    .filter((block) => block.type === "text")
    .map((block) => block.text)
    .join("");
}

export async function POST(request: Request) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Expected a JSON request body." }, { status: 400 });
  }

  const topic =
    typeof body === "object" && body !== null && "topic" in body
      ? String(body.topic).trim()
      : "";

  if (topic.length < 8) {
    return Response.json(
      { error: "Enter a research topic with at least 8 characters." },
      { status: 400 },
    );
  }

  if (topic.length > 1200) {
    return Response.json(
      { error: "Research topic must be 1,200 characters or fewer." },
      { status: 400 },
    );
  }

  const apiKey = getApiKey();
  if (!apiKey) {
    return Response.json(
      { error: "Missing CURSOR_API_KEY or CURSOR_API environment variable." },
      { status: 500 },
    );
  }

  const depth = parseDepth(
    typeof body === "object" && body !== null && "depth" in body
      ? body.depth
      : undefined,
  );
  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let agent: Awaited<ReturnType<typeof Agent.create>> | undefined;
      let sawTextDelta = false;
      let sawThinkingDelta = false;

      const send = (payload: StreamEvent) => {
        controller.enqueue(encoder.encode(`${JSON.stringify(payload)}\n`));
      };

      const handleDelta = ({ update }: { update: InteractionUpdate }) => {
        if (update.type === "text-delta") {
          sawTextDelta = true;
          send({ event: "text", text: update.text });
        }

        if (update.type === "thinking-delta") {
          sawThinkingDelta = true;
          send({ event: "thinking", text: update.text });
        }
      };

      try {
        send({ event: "status", message: "Creating Cursor research agent..." });

        agent = await Agent.create({
          apiKey,
          model: { id: process.env.CURSOR_RESEARCH_MODEL ?? "default" },
          name: "Deep Research",
          local: {
            cwd: process.cwd(),
            settingSources: ["project"],
          },
        });

        const run = await agent.send(buildResearchPrompt(topic, depth), {
          local: { force: true },
          onDelta: handleDelta,
        });

        send({ event: "meta", agentId: agent.agentId, runId: run.id });

        for await (const event of run.stream()) {
          if (event.type === "status" && event.message) {
            send({ event: "status", message: event.message });
          }

          if (event.type === "task" && event.text) {
            send({ event: "status", message: event.text });
          }

          if (event.type === "thinking" && !sawThinkingDelta) {
            send({ event: "thinking", text: event.text });
          }

          if (event.type === "tool_call") {
            send({ event: "tool", name: event.name, status: event.status });
          }

          const text = assistantText(event);
          if (text && !sawTextDelta) {
            send({ event: "text", text });
          }
        }

        const result = await run.wait();
        send({ event: "done", status: result.status, result: result.result });
      } catch (error) {
        send({ event: "error", message: errorMessage(error) });
      } finally {
        agent?.close();
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Cache-Control": "no-store",
      "Content-Type": "application/x-ndjson; charset=utf-8",
    },
  });
}
