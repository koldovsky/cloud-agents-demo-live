import { Agent } from "@cursor/sdk";
import type { NextRequest } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const DEEP_RESEARCH_PROMPT = `You are a deep research agent, similar to ChatGPT's deep research feature.

When given a research topic or question, you will:
1. Break the topic into key sub-questions that need to be answered
2. Conduct thorough research by searching the web multiple times with different queries
3. Gather information from diverse, credible sources
4. Analyze and cross-reference findings
5. Synthesize everything into a comprehensive, well-structured research report

Your final report must include:
- An executive summary
- Detailed findings organized by theme or sub-topic
- Key insights and analysis
- Sources and references cited throughout
- A conclusion with actionable takeaways

Be thorough — perform many searches, read broadly, and dig deep. Do not stop after one or two searches.`;

export async function POST(request: NextRequest) {
  const { query, apiKey } = await request.json();

  if (!query || typeof query !== "string") {
    return Response.json({ error: "query is required" }, { status: 400 });
  }

  const resolvedApiKey =
    typeof apiKey === "string" && apiKey.trim()
      ? apiKey.trim()
      : process.env.CURSOR_API_KEY;

  if (!resolvedApiKey) {
    return Response.json(
      {
        error:
          "No API key provided. Supply a Cursor API key in the request or set CURSOR_API_KEY env var.",
      },
      { status: 401 }
    );
  }

  const encoder = new TextEncoder();

  function send(data: object) {
    return encoder.encode(`data: ${JSON.stringify(data)}\n\n`);
  }

  const stream = new ReadableStream({
    async start(controller) {
      try {
        controller.enqueue(
          send({ type: "status", message: "Creating research agent…" })
        );

        const agent = await Agent.create({
          name: `Deep Research: ${query.slice(0, 60)}`,
          apiKey: resolvedApiKey,
          cloud: {},
        });

        controller.enqueue(
          send({ type: "status", message: "Agent created. Starting research…" })
        );

        const run = await agent.send(
          `${DEEP_RESEARCH_PROMPT}\n\nResearch topic: ${query}`
        );

        for await (const message of run.stream()) {
          switch (message.type) {
            case "assistant": {
              for (const block of message.message.content) {
                if (block.type === "text" && block.text) {
                  controller.enqueue(
                    send({ type: "text", content: block.text })
                  );
                }
              }
              break;
            }
            case "thinking": {
              if (message.text) {
                controller.enqueue(
                  send({ type: "thinking", content: message.text })
                );
              }
              break;
            }
            case "tool_call": {
              controller.enqueue(
                send({
                  type: "tool_call",
                  name: message.name,
                  status: message.status,
                  args: message.args,
                  result:
                    message.status === "completed" ? message.result : undefined,
                })
              );
              break;
            }
            case "status": {
              controller.enqueue(
                send({
                  type: "status",
                  message: `Agent status: ${message.status}${message.message ? " — " + message.message : ""}`,
                })
              );
              break;
            }
            case "task": {
              if (message.text) {
                controller.enqueue(
                  send({ type: "task", content: message.text })
                );
              }
              break;
            }
          }
        }

        const result = await run.wait();
        controller.enqueue(
          send({
            type: "done",
            status: result.status,
            result: result.result,
          })
        );

        agent.close();
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Unknown error occurred";
        controller.enqueue(send({ type: "error", message }));
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
