import { NextResponse } from "next/server";
import type { LocalModelErrorCode } from "@/lib/server/local-model";

const errors = {
  invalid_input: { status: 400, error: "Please choose between one and five available vibe options, one per category." },
  configuration: { status: 503, error: "The local chord generator needs a valid local configuration." },
  unavailable: { status: 503, error: "The local chord generator is unavailable. Please check Ollama and try again." },
  timeout: { status: 504, error: "The local chord generator took too long. Please try again." },
  invalid_output: { status: 502, error: "The local chord generator returned an invalid progression. Please try again." },
} satisfies Record<LocalModelErrorCode, { status: number; error: string }>;

export function progressionErrorResponse(code: LocalModelErrorCode): NextResponse {
  const { error, status } = errors[code];
  return NextResponse.json({ error }, { status });
}
