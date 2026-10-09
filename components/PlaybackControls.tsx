"use client";

import { useEffect, useId, useState, useSyncExternalStore, type ReactNode } from "react";
import { PlaybackController } from "@/lib/playback";
import type { ChordVoicing } from "@/lib/voicings";

export function PlaybackControls({ voicings, children, createController = () => new PlaybackController() }: {
  voicings: readonly ChordVoicing[];
  children?: (voicing: ChordVoicing, index: number) => ReactNode;
  createController?: () => PlaybackController;
}) {
  const [controller] = useState(createController);
  const state = useSyncExternalStore(controller.subscribe, controller.getState, controller.getState);
  const [error, setError] = useState<string | null>(null);
  const scrollHintId = useId();
  useEffect(() => {
    // Changing displayed selections or regenerating a progression cancels its old audio.
    return controller.stop;
  }, [controller, voicings]);
  useEffect(() => controller.dispose, [controller]);

  const start = (play: () => Promise<void>) => {
    setError(null);
    void play().catch((cause: unknown) => {
      setError(cause instanceof Error ? cause.message : "Audio could not start. Try playing again.");
    });
  };
  const buttonClass = "rounded border px-4 py-2 focus-visible:outline-2 focus-visible:outline-offset-2";
  return (
    <section aria-label="Chord playback" className="space-y-6">
      <div className="flex flex-wrap gap-3">
        <button type="button" className={buttonClass} disabled={voicings.length === 0}
          aria-pressed={state.kind === "sequence"}
          onClick={() => state.kind === "sequence" ? controller.stop() : start(() => controller.sequence(voicings))}>
          {state.kind === "sequence" ? "Stop sequence" : "Play sequence"}
        </button>
        <button type="button" className={buttonClass} disabled={state.kind === "idle"} onClick={controller.stop}>Stop all audio</button>
      </div>
      <p role="status" aria-live="polite">
        {state.kind === "idle" ? "Playback stopped." : state.kind === "sequence"
          ? `Playing position ${state.index + 1} of ${voicings.length}.` : "Playing chord preview."}
      </p>
      {error && <p role="alert">{error}</p>}
      <div className="space-y-3">
        <p id={scrollHintId} className="text-sm">Positions run left to right. Swipe or scroll horizontally to see more. With the strip focused, use the left and right arrow keys.</p>
        <div role="region" aria-label="Chord progression" aria-describedby={scrollHintId} tabIndex={0}
          className="overflow-x-auto rounded border p-3 focus-visible:outline-2 focus-visible:outline-offset-2">
          <ol role="list" className="flex flex-nowrap gap-4">
            {voicings.map((voicing, index) => {
              const previewing = state.kind === "preview" && state.voicingId === voicing.id;
              return (
                <li key={`${index}-${voicing.id}`} className="flex w-[22rem] shrink-0 flex-col gap-3 rounded border p-4">
                  <p className="text-sm">Position {index + 1}</p>
                  {children?.(voicing, index)}
                  <button type="button" className={`${buttonClass} mt-auto w-full`} aria-pressed={previewing}
                    aria-label={`${previewing ? "Stop" : "Preview"} ${voicing.chord}, ${voicing.label}, position ${index + 1}`}
                    onClick={() => previewing ? controller.stop() : start(() => controller.preview(voicing))}>
                    {previewing ? "Stop preview" : `Preview ${voicing.chord}, ${voicing.label}`}
                  </button>
                </li>
              );
            })}
          </ol>
        </div>
      </div>
    </section>
  );
}
