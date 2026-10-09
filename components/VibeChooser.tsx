"use client";

import { useState } from "react";
import { VibePicker } from "@/components/VibePicker";
import { ProgressionResult } from "@/components/ProgressionResult";
import { getSelectedVibes, hasVibeSelection, surpriseVibes, type VibeSelection } from "@/lib/vibe-selection";
import type { ProgressionCard } from "@/lib/progression";

export function VibeChooser() {
  const [selection, setSelection] = useState<VibeSelection>({});
  const [progression, setProgression] = useState<ProgressionCard[] | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const choose = (next: VibeSelection) => {
    setSelection(next);
    setProgression(null);
    setError(null);
  };

  const generate = async () => {
    setPending(true);
    setError(null);
    try {
      const response = await fetch("/api/progression", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ vibeIds: getSelectedVibes(selection).map((vibe) => vibe.id) }),
      });
      const payload: unknown = await response.json();
      if (!response.ok || typeof payload !== "object" || payload === null || !("chords" in payload) || !Array.isArray(payload.chords)) {
        const message = typeof payload === "object" && payload !== null && "error" in payload && typeof payload.error === "string"
          ? payload.error : "We couldn't generate a progression. Please try again.";
        throw new Error(message);
      }
      setProgression(payload.chords as ProgressionCard[]);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "We couldn't generate a progression. Please try again.");
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="space-y-6">
      <VibePicker value={selection} onChange={choose} showSurpriseAction={false} />
      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          disabled={!hasVibeSelection(selection) || pending}
          onClick={() => void generate()}
          className="min-h-11 max-w-full rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground disabled:cursor-not-allowed disabled:opacity-40"
        >
          {pending ? "Finding your chords…" : progression ? "Generate another" : "Generate progression"}
        </button>
        <button
          type="button"
          onClick={() => choose(surpriseVibes())}
          className="min-h-11 max-w-full rounded-md border border-foreground/20 px-4 py-2 text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground"
        >
          Surprise me
        </button>
      </div>
      {error && <p role="alert" className="text-sm">{error}</p>}
      {progression && <ProgressionResult chords={progression} />}
    </div>
  );
}
