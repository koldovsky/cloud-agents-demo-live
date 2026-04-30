import { NextRequest, NextResponse } from "next/server";
import { Agent } from "@cursor/sdk";

type DeepResearchRequest = {
  query?: string;
};

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as DeepResearchRequest;
    const query = body.query?.trim();

    if (!query) {
      return NextResponse.json({ error: "A query is required." }, { status: 400 });
    }

    const apiKey = process.env.CURSOR_API;

    if (!apiKey) {
      return NextResponse.json(
        { error: "Missing CURSOR_API environment variable." },
        { status: 500 },
      );
    }

    const agent = await Agent.create({
      apiKey,
      model: { id: "composer-2" },
      local: { cwd: process.cwd() },
    });

    const run = await agent.send(`You are a deep research assistant.\n
Goal: ${query}\n
Return a markdown report with:\n1) Executive summary\n2) Key findings with confidence and source URLs\n3) Contradictions/gaps\n4) Recommended next steps\n
Requirements:\n- Prefer primary sources and include dates.\n- Be explicit if evidence is weak or missing.`);

    const result = await run.wait();

    return NextResponse.json({
      runId: run.id,
      output: result.result,
      usage: undefined,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: "Failed to run deep research task.",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
