import "server-only";
import { NextResponse } from "next/server";
import { resolveProgression } from "@/lib/progression";
import { generationRequestSchema, getGenerationContext } from "@/lib/progression-variation";
import { generateLocalProgressionWithFallback, LocalModelError } from "@/lib/server/local-model";
import { progressionErrorResponse } from "@/app/api/progression/errors";

export const runtime = "nodejs";

export async function POST(request: Request) {
  let body: unknown;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: "Please choose a few vibe options and try again." }, { status: 400 });
  }
  const parsedRequest = generationRequestSchema.safeParse(body);
  if (!parsedRequest.success) {
    return progressionErrorResponse("invalid_input");
  }
  try {
    const context = getGenerationContext(parsedRequest.data);
    const output = await generateLocalProgressionWithFallback(context.vibeIds, {
      signal: request.signal,
      variation: context.variation,
      ...(context.exploration ? { originalChords: context.exploration.originalChords } : {}),
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
