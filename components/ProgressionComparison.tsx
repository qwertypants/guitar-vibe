"use client";

import { useEffect, useRef, useState } from "react";
import { ProgressionResult } from "@/components/ProgressionResult";
import { Tabs } from "@/components/Tabs";
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
  const [selectedId, setSelectedId] = useState("original");
  const previousVariationCount = useRef(progressions.variations.length);
  useEffect(() => {
    if (progressions.variations.length > previousVariationCount.current) {
      setSelectedId(progressions.variations.at(-1)!.id);
    }
    previousVariationCount.current = progressions.variations.length;
  }, [progressions.variations]);
  const entries = [progressions.original, ...progressions.variations];
  const currentId = entries.some((entry) => entry.id === selectedId) ? selectedId : "original";
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
      <p className="text-sm text-muted">Switch between your original and variations. Playing a chord, progression, or scale stops the previous playback.</p>
      <Tabs label="Progressions" items={entries.map((entry) => ({ id: entry.id, label: entry.label }))} value={currentId} onChange={setSelectedId}>
      {entries.map((entry) => {
        const chords = resolveProgression(entry.chords);
        if (!chords) throw new Error("A comparison progression contains unsupported chords.");
        return <div key={entry.id} hidden={entry.id !== currentId} className="min-w-0 space-y-2">
          <ProgressionResult chords={chords} label={entry.label} active={active && entry.id === currentId} onPlaybackStart={startPlayback}
            {...(createController ? { createController } : {})} />
          <p className="text-sm text-muted">{entry.chords.join(" · ")}</p>
        </div>;
      })}
      </Tabs>
    </div>
  );
}
