"use client";

import { useEffect, useId, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { UiIcon } from "@/components/UiIcon";
import { PlaybackController } from "@/lib/playback";
import type { ChordVoicing } from "@/lib/voicings";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { reducedMotion } from "@/lib/motion";

export function PlaybackControls({ voicings, children, active = true, createController = () => new PlaybackController() }: {
  voicings: readonly ChordVoicing[];
  active?: boolean;
  children?: (voicing: ChordVoicing, index: number, preview: (voicing: ChordVoicing) => void) => ReactNode;
  createController?: () => PlaybackController;
}) {
  const [controller] = useState(createController);
  const state = useSyncExternalStore(controller.subscribe, controller.getState, controller.getState);
  const [error, setError] = useState<string | null>(null);
  const orderHintId = useId();
  const grid = useRef<HTMLOListElement>(null);
  useGSAP(() => {
    if (reducedMotion() || state.kind === "idle") return;
    const index = state.kind === "sequence" ? state.index : voicings.findIndex((voicing) => voicing.id === state.voicingId);
    const name = grid.current?.children[index]?.querySelector<HTMLElement>(".chord-name");
    if (!name) return;
    const tween = gsap.fromTo(name, { scale: 1.08, y: -2 },
      { scale: 1, y: 0, duration: 0.24, ease: "power2.out", overwrite: "auto" });
    return () => { tween.kill(); gsap.set(name, { clearProps: "transform" }); };
  }, { scope: grid, dependencies: [state] });
  useEffect(() => {
    if (!active) controller.stop();
  }, [active, controller]);
  useEffect(() => controller.dispose, [controller]);

  const start = (play: () => Promise<void>) => {
    setError(null);
    void play().catch((cause: unknown) => {
      setError(cause instanceof Error ? cause.message : "Audio could not start. Try playing again.");
    });
  };
  const preview = (voicing: ChordVoicing) => start(() => controller.preview(voicing));
  const buttonClass = "inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-foreground/20 px-4 py-2 text-sm font-medium focus-visible:outline-2 focus-visible:outline-offset-2";
  return (
    <section aria-label="Chord playback" className="chord-playback space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <button type="button" className={`${buttonClass} border-accent bg-accent text-accent-foreground`} disabled={voicings.length === 0}
          aria-pressed={state.kind === "sequence"}
          onClick={() => state.kind === "sequence" ? controller.stop() : start(() => controller.sequence(voicings))}>
          <UiIcon name={state.kind === "sequence" ? "stop" : "play"} />
          {state.kind === "sequence" ? "Stop progression" : "Play progression"}
        </button>
        <button type="button" className={buttonClass} disabled={state.kind === "idle"} onClick={controller.stop}>
          <UiIcon name="stop" />
          Stop
        </button>
      </div>
      <p className="sr-only" role="status" aria-live="polite">
        {state.kind === "idle" ? "Playback stopped." : state.kind === "sequence"
          ? `Playing position ${state.index + 1} of ${voicings.length}.` : "Playing chord preview."}
      </p>
      {error && <p role="alert">{error}</p>}
      <p id={orderHintId} className="sr-only">Preview a chord or play the full progression in order.</p>
      <div role="region" aria-label="Chord progression" aria-describedby={orderHintId} tabIndex={0}
        className="rounded-md focus-visible:outline-2 focus-visible:outline-offset-2">
        <ol ref={grid} role="list" className="progression-grid grid grid-cols-1 gap-5">
          {voicings.map((voicing, index) => {
            const active = state.kind === "sequence" ? state.index === index
              : state.kind === "preview" && state.voicingId === voicing.id;
            return (
              <li key={index} className={`relative flex min-w-0 flex-col gap-4 rounded-xl border bg-card p-4 ${
                active ? "border-accent ring-1 ring-accent" : "border-foreground/15"
              }`}>
                {children?.(voicing, index, preview)}
              </li>
            );
          })}
        </ol>
      </div>
    </section>
  );
}
