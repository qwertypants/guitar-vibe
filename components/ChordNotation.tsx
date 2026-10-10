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

export function ChordNotation({ voicing }: { voicing: ChordVoicing }) {
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
        <span className="block text-3xl font-semibold leading-tight text-foreground">{voicing.chord}</span>
        <span className="block text-sm text-muted">{voicing.label}</span>
      </figcaption>
      <div ref={host} role="img" aria-label={`${voicing.chord}, ${voicing.label}, guitar chord diagram`} className="chord-diagram flex min-h-[280px] justify-center" />
      {failedVoicing === voicing && <p role="alert">Chord diagram is unavailable for this position. Use the frets and notes below.</p>}
      <details key={voicing.id} open={failedVoicing === voicing} className="rounded border border-foreground/20 px-3">
        <summary className="flex min-h-11 items-center font-medium text-foreground">Details</summary>
        <div className="space-y-1 pb-3">
          <p>Strings, low E to high E: {voicing.frets.map((fret) => fret ?? "muted").join(", ")}</p>
          <p>Notes: {voicing.notes.map((note) => note.name).join(", ")}</p>
        </div>
      </details>
    </figure>
  );
}
