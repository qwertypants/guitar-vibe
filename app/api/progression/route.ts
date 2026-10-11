import "server-only";
import { NextResponse } from "next/server";
import { progressionRequestSchema, resolveProgression } from "@/lib/progression";
import { generateLocalProgression, LocalModelError, type LocalModelErrorCode } from "@/lib/server/local-model";

export const runtime = "nodejs";

const errors = {
  invalid_input: { status: 400, error: "Please choose between one and five available vibe options, one per category." },
  configuration: { status: 503, error: "The local chord generator needs a valid local configuration." },
  unavailable: { status: 503, error: "The local chord generator is unavailable. Please check Ollama and try again." },
  timeout: { status: 504, error: "The local chord generator took too long. Please try again." },
  invalid_output: { status: 502, error: "The local chord generator returned an invalid progression. Please try again." },
} satisfies Record<LocalModelErrorCode, { status: number; error: string }>;

export async function POST(request: Request) {
  let body: unknown;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: "Please choose a few vibe options and try again." }, { status: 400 });
  }
  const parsedRequest = progressionRequestSchema.safeParse(body);
  if (!parsedRequest.success) {
    return NextResponse.json({ error: errors.invalid_input.error }, { status: 400 });
  }
  try {
    const output = await generateLocalProgression(parsedRequest.data.vibeIds, { signal: request.signal });
    const chords = resolveProgression(output.chords);
    if (!chords) throw new LocalModelError("invalid_output");
    return NextResponse.json({ chords });
  } catch (cause) {
    const code = cause instanceof LocalModelError ? cause.code : "unavailable";
    console.error("[progression] local generation failed", { code });
    const { error, status } = errors[code];
    return NextResponse.json({ error }, { status });
  }
}
