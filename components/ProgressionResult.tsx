"use client";

import { useId, useState } from "react";
import { ChordNotation } from "@/components/ChordNotation";
import { PlaybackControls } from "@/components/PlaybackControls";
import { PlaybackController } from "@/lib/playback";
import { getProgressionScalePractice } from "@/lib/scale-notation";
import { ScalePractice } from "@/components/ScalePractice";
import type { ProgressionCard } from "@/lib/progression";
import type { ChordVoicing } from "@/lib/voicings";

export function ProgressionResult({ chords, active = true, createController, onEditVibe, label, onPlaybackStart }: {
  chords: readonly ProgressionCard[];
  active?: boolean;
  createController?: () => PlaybackController;
  onEditVibe?: () => void;
  label?: string;
  onPlaybackStart?: (controller: PlaybackController) => void;
}) {
  const headingId = useId();
  const [positions, setPositions] = useState<number[]>(() => chords.map(() => 0));
  const selected: ChordVoicing[] = chords.map((chord, index) => chord.voicings[positions[index] ?? 0] ?? chord.voicings[0]!);
  const scalePractice = getProgressionScalePractice(chords.map((chord) => chord.symbol));

  return (
    <section aria-labelledby={headingId} className="progression-result min-w-0 space-y-4 pt-2">
      <div className="flex flex-wrap items-center justify-between gap-3">
        {label ? <h3 id={headingId} className="text-xl font-semibold">{label}</h3>
          : <h2 id={headingId} className="text-2xl font-semibold">Your chord progression</h2>}
        {onEditVibe && <button type="button" className="min-h-11 shrink-0 rounded-full border border-foreground/20 px-4 text-sm" onClick={onEditVibe}>Edit vibe</button>}
      </div>
      <PlaybackControls voicings={selected} active={active} {...(onPlaybackStart ? { onPlaybackStart } : {})} {...(createController ? { createController } : {})}
        {...(scalePractice ? { renderFooter: ({ state, playScale }: { state: ReturnType<PlaybackController["getState"]>; playScale: (scaleId: string, midiNotes: readonly number[]) => void }) => <ScalePractice
          scale={scalePractice.scale}
          rows={scalePractice.rows}
          positions={scalePractice.positions}
          midiNotes={scalePractice.midiNotes}
          active={state.kind === "scale" && state.scaleId === scalePractice.scale.id}
          onPlay={playScale}
        /> } : {})}>
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
    </section>
  );
}
