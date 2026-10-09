"use client";

import { useEffect, useRef, useState } from "react";
import { renderChordNotation } from "@/lib/chord-notation";
import type { ChordVoicing } from "@/lib/voicings";

export function ChordNotation({ voicing }: { voicing: ChordVoicing }) {
  const host = useRef<HTMLDivElement>(null);
  const [failedVoicing, setFailedVoicing] = useState<ChordVoicing | null>(null);

  useEffect(() => {
    const container = host.current;
    if (!container) return;
    // Render into an effect-owned node. A stale async import cannot alter the next selection.
    const drawing = document.createElement("div");
    container.replaceChildren(drawing);
    let cancelled = false;
    void renderChordNotation(drawing, voicing).catch(() => {
      if (!cancelled) {
        drawing.replaceChildren();
        setFailedVoicing(voicing);
      }
    });
    return () => {
      cancelled = true;
      drawing.remove();
    };
  }, [voicing]);

  return (
    <figure className="space-y-3 text-sm">
      <figcaption className="text-base font-semibold">{voicing.chord}: {voicing.label}</figcaption>
      <div ref={host} role="img" aria-label={`${voicing.chord}, ${voicing.label}, guitar tablature and notation`} className="overflow-x-auto rounded bg-white text-black" />
      {failedVoicing === voicing && <p role="alert">Notation is unavailable for this position.</p>}
      <p>Strings, low E to high E: {voicing.frets.map((fret) => fret ?? "muted").join(", ")}</p>
      <p>Notes: {voicing.notes.map((note) => note.name).join(", ")}</p>
    </figure>
  );
}
