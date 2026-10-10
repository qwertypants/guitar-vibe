"use client";

import { useState } from "react";
import { ChordNotation } from "@/components/ChordNotation";
import { PlaybackControls } from "@/components/PlaybackControls";
import type { ProgressionCard } from "@/lib/progression";
import type { ChordVoicing } from "@/lib/voicings";

export function ProgressionResult({ chords }: { chords: readonly ProgressionCard[] }) {
  const [positions, setPositions] = useState<number[]>(() => chords.map(() => 0));
  const selected: ChordVoicing[] = chords.map((chord, index) => chord.voicings[positions[index] ?? 0] ?? chord.voicings[0]!);

  return (
    <div className="space-y-4 pt-2">
      <h2 className="text-2xl font-semibold">Your chord progression</h2>
      <PlaybackControls voicings={selected}>
        {(voicing, index) => {
          const options = chords[index]?.voicings ?? [];
          return (
            <>
              <ChordNotation voicing={voicing} />
              {options.length > 1 && (
                <label className="space-y-1 text-sm">
                  <span className="block">Guitar position</span>
                  <select
                    value={positions[index] ?? 0}
                    onChange={(event) => setPositions((current) => current.map((position, item) => item === index ? Number(event.target.value) : position))}
                    className="min-h-11 w-full rounded border border-foreground/20 bg-card px-3"
                  >
                    {options.map((option, optionIndex) => <option key={option.id} value={optionIndex}>{option.label}</option>)}
                  </select>
                </label>
              )}
            </>
          );
        }}
      </PlaybackControls>
    </div>
  );
}
