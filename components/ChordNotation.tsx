"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { renderChordNotation } from "@/lib/chord-notation";
import type { ChordVoicing } from "@/lib/voicings";

const colorSchemeQuery = "(prefers-color-scheme: dark)";

function subscribeToColorScheme(onChange: () => void) {
  if (typeof window === "undefined" || !window.matchMedia) return () => {};
  const media = window.matchMedia(colorSchemeQuery);
  media.addEventListener("change", onChange);
  return () => media.removeEventListener("change", onChange);
}

function isDarkColorScheme() {
  return typeof window !== "undefined" && !!window.matchMedia?.(colorSchemeQuery).matches;
}

export function ChordNotation({ voicing, onPlay }: { voicing: ChordVoicing; onPlay: () => void }) {
  const host = useRef<HTMLDivElement>(null);
  const [failedVoicing, setFailedVoicing] = useState<ChordVoicing | null>(null);
  const isDark = useSyncExternalStore(subscribeToColorScheme, isDarkColorScheme, () => false);

  useEffect(() => {
    const container = host.current;
    if (!container) return;
    // Render into an effect-owned node. A stale async import cannot alter the next selection.
    const drawing = document.createElement("div");
    container.replaceChildren(drawing);
    let cancelled = false;
    void renderChordNotation(drawing, voicing).then(() => {
      if (!cancelled) setFailedVoicing(null);
    }).catch(() => {
      if (!cancelled) {
        drawing.replaceChildren();
        setFailedVoicing(voicing);
      }
    });
    return () => {
      cancelled = true;
      drawing.remove();
    };
  }, [voicing, isDark]);

  return (
    <figure className="space-y-3 text-sm text-muted">
      <figcaption className="space-y-1">
        <span className="chord-name block text-foreground">{voicing.chord}</span>
        <span className="block text-sm text-muted">{voicing.label}</span>
      </figcaption>
      <button type="button" onClick={onPlay} aria-label={`Play ${voicing.chord}, ${voicing.label}`}
        className="chord-diagram-button mx-auto block w-full max-w-[240px] rounded-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent">
        <div ref={host} aria-hidden="true" className="chord-diagram flex justify-center" />
      </button>
      {failedVoicing === voicing && <p role="alert">Chord diagram is unavailable for this position. Use the frets and notes below.</p>}
      <div className="chord-details space-y-2" aria-label="Chord details">
        <div className="flex flex-wrap items-center gap-1" aria-label="Strings, low E to high E">
          <span className="detail-label">Frets</span>
          {voicing.frets.map((fret, index) => <span className="fret-pill" key={index}>
            <span className="sr-only">{["Low E string", "A string", "D string", "G string", "B string", "High E string"][index]}: </span>
            {fret ?? "×"}
          </span>)}
        </div>
        <div className="flex flex-wrap items-center gap-1">
          <span className="detail-label">Notes</span>
          {voicing.notes.map((note, index) => <span className="note-pill" key={index}>{note.name}</span>)}
        </div>
      </div>
    </figure>
  );
}
