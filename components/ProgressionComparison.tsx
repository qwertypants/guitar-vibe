"use client";

import { useRef } from "react";
import { ProgressionResult } from "@/components/ProgressionResult";
import type { PlaybackController } from "@/lib/playback";
import { resolveProgression } from "@/lib/progression";
import type { ProgressionSession } from "@/lib/progression-session";

export function ProgressionComparison({ progressions, active = true, onEditVibe, createController }: {
  progressions: ProgressionSession["progressions"];
  active?: boolean;
  onEditVibe?: () => void;
  createController?: () => PlaybackController;
}) {
  const playing = useRef<PlaybackController | null>(null);
  const startPlayback = (controller: PlaybackController) => {
    if (playing.current !== controller) playing.current?.stop();
    playing.current = controller;
  };

  return (
    <div className="progression-comparison min-w-0 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-2xl font-semibold">Your chord progression</h2>
        {onEditVibe && <button type="button" className="min-h-11 rounded-full border border-foreground/20 px-4 text-sm" onClick={onEditVibe}>Edit vibe</button>}
      </div>
      <p className="text-sm text-muted">Compare each variation with your original. Playing a chord, progression, or scale stops the previous playback.</p>
      {[progressions.original, ...progressions.variations].map((entry) => {
        const chords = resolveProgression(entry.chords);
        if (!chords) throw new Error("A comparison progression contains unsupported chords.");
        return <div key={entry.id} className="min-w-0 space-y-2 border-t border-foreground/20 pt-4">
          <ProgressionResult chords={chords} label={entry.label} active={active} onPlaybackStart={startPlayback}
            {...(createController ? { createController } : {})} />
          <p className="text-sm text-muted">{entry.chords.join(" · ")}</p>
        </div>;
      })}
    </div>
  );
}
