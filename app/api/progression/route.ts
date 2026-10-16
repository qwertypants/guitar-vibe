import "server-only";
import { NextResponse } from "next/server";
import { progressionRequestSchema, resolveProgression } from "@/lib/progression";
import { generateLocalProgressionWithFallback, LocalModelError } from "@/lib/server/local-model";
import { progressionErrorResponse } from "@/app/api/progression/errors";

export const runtime = "nodejs";

export async function POST(request: Request) {
  let body: unknown;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: "Please choose a few vibe options and try again." }, { status: 400 });
  }
  const parsedRequest = progressionRequestSchema.safeParse(body);
  if (!parsedRequest.success) {
    return progressionErrorResponse("invalid_input");
  }
  try {
    const output = await generateLocalProgressionWithFallback(parsedRequest.data.vibeIds, {
      signal: request.signal,
      variation: parsedRequest.data.variation,
    });
    const chords = resolveProgression(output.chords);
    if (!chords) throw new LocalModelError("invalid_output");
    return NextResponse.json(output.metrics.fallbackUsed ? { chords, fallbackUsed: true } : { chords });
  } catch (cause) {
    const code = cause instanceof LocalModelError ? cause.code : "unavailable";
    console.error("[progression] local generation failed", { code });
    return progressionErrorResponse(code);
  }
}
