"use client";

import { useState } from "react";
import { ChordNotation } from "@/components/ChordNotation";
import { PlaybackControls } from "@/components/PlaybackControls";
import { PlaybackController } from "@/lib/playback";
import type { ProgressionCard } from "@/lib/progression";
import type { ChordVoicing } from "@/lib/voicings";

export function ProgressionResult({ chords, active = true, createController, onEditVibe }: {
  chords: readonly ProgressionCard[];
  active?: boolean;
  createController?: () => PlaybackController;
  onEditVibe?: () => void;
}) {
  const [positions, setPositions] = useState<number[]>(() => chords.map(() => 0));
  const selected: ChordVoicing[] = chords.map((chord, index) => chord.voicings[positions[index] ?? 0] ?? chord.voicings[0]!);

  return (
    <div className="progression-result space-y-4 pt-2">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-2xl font-semibold">Your chord progression</h2>
        {onEditVibe && <button type="button" className="min-h-11 shrink-0 rounded-full border border-foreground/20 px-4 text-sm" onClick={onEditVibe}>Edit vibe</button>}
      </div>
      <PlaybackControls voicings={selected} active={active} {...(createController ? { createController } : {})}>
        {(voicing, index, preview) => {
          const options = chords[index]?.voicings ?? [];
          return (
            <>
              <ChordNotation voicing={voicing} onPlay={() => preview(voicing)} />
              {options.length > 1 && (
                <div role="group" aria-label={`Guitar position for ${voicing.chord}, chord ${index + 1}`} className="space-y-2">
                  <p className="detail-label">Guitar position</p>
                  <div className="flex flex-wrap gap-2">
                    {options.map((option, optionIndex) => <button type="button" key={option.id}
                      aria-pressed={(positions[index] ?? 0) === optionIndex}
                      onClick={() => {
                        setPositions((current) => chords.map((_, item) => item === index ? optionIndex : current[item] ?? 0));
                        preview(option);
                      }}
                      className="position-button">{option.label}</button>)}
                  </div>
                </div>
              )}
            </>
          );
        }}
      </PlaybackControls>
    </div>
  );
}
