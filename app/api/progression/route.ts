import "server-only";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { generateText, Output } from "ai";
import { NextResponse } from "next/server";
import {
  getVibeLabels,
  progressionRequestSchema,
  progressionSchema,
  resolveProgression,
} from "@/lib/progression";

export const runtime = "nodejs";

function safeErrorDetails(cause: unknown) {
  if (!(cause instanceof Error)) return { type: typeof cause };

  const candidate = cause as Error & { code?: unknown; statusCode?: unknown };
  const message = cause.message
    .replace(/\bsk-or-v1-[\w-]+/gi, "[redacted]")
    .replace(/\bsk-[\w-]+/gi, "[redacted]")
    .replace(/\bBearer\s+\S+/gi, "Bearer [redacted]")
    .replace(/(OPENROUTER_API_KEY\s*[:=]\s*)\S+/gi, "$1[redacted]")
    .slice(0, 400);

  return {
    name: cause.name,
    message,
    ...(typeof candidate.statusCode === "number" ? { statusCode: candidate.statusCode } : {}),
    ...(typeof candidate.code === "string" ? { code: candidate.code } : {}),
  };
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Please choose a few vibe options and try again." }, { status: 400 });
  }

  const parsedRequest = progressionRequestSchema.safeParse(body);
  if (!parsedRequest.success) {
    return NextResponse.json({ error: "Please choose between one and five vibe options." }, { status: 400 });
  }
  const vibeLabels = getVibeLabels(parsedRequest.data.vibeIds);
  if (!vibeLabels) {
    return NextResponse.json({ error: "One or more selected vibe options are unavailable." }, { status: 400 });
  }

  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "Add OPENROUTER_API_KEY to .env.local to generate progressions." }, { status: 503 });
  }

  try {
    const openrouter = createOpenRouter({ apiKey });
    const model = process.env.OPENROUTER_MODEL || "openai/gpt-6-luna";
    const { output } = await generateText({
      model: openrouter(model),
      output: Output.object({ schema: progressionSchema }),
      maxRetries: 0,
      prompt: [
        "Create a playable guitar chord progression inspired by these selected vibes.",
        ...vibeLabels,
        "Return 3 to 8 chord symbols using only these supported forms: root note A-G with optional # or b, followed by nothing, m, 7, maj7, or m7.",
        "Prefer coherent voice-leading and approachable guitar harmony. Return chord symbols only in the required structured output.",
      ].join("\n"),
    });
    const chords = resolveProgression(output.chords);
    if (!chords) {
      return NextResponse.json({ error: "That progression used an unsupported chord. Please generate another." }, { status: 502 });
    }
    return NextResponse.json({ chords });
  } catch (cause) {
    console.error("[progression] OpenRouter generation failed", safeErrorDetails(cause));
    return NextResponse.json({ error: "We couldn't reach the chord generator. Please try again." }, { status: 502 });
  }
}
