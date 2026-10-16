"use client";

import { useEffect, useRef, useState } from "react";
import { scaleFretboardToVexTab, renderScaleVexTab } from "@/lib/scale-notation";
import type { ScalePracticeProps } from "@/types/scales";

export function ScalePractice({ scale, rows, positions, midiNotes, active, onPlay }: ScalePracticeProps) {
  const host = useRef<HTMLDivElement>(null);
  const [expanded, setExpanded] = useState(false);
  const [renderError, setRenderError] = useState(false);
  const source = scaleFretboardToVexTab(midiNotes, positions);

  useEffect(() => {
    const container = host.current;
    if (!expanded || !container) return;
    const drawing = document.createElement("div");
    container.replaceChildren(drawing);
    let cancelled = false;
    setRenderError(false);
    void renderScaleVexTab(drawing, source).catch(() => {
      if (!cancelled) {
        drawing.replaceChildren();
        setRenderError(true);
      }
    });
    return () => {
      cancelled = true;
      drawing.remove();
    };
  }, [expanded, source]);

  return (
    <details className="scale-practice" onToggle={(event) => setExpanded(event.currentTarget.open)}>
      <summary className="scale-practice-summary">
        <span className="detail-label">Best fit scale</span>
        <span className="scale-practice-name">{scale.name}</span>
      </summary>
      {expanded && <div className="scale-practice-content">
        <p className="scale-practice-hint">Standard tuning · frets 0–12 · strings from high E to low E</p>
        <button type="button" className="scale-play-button" aria-pressed={active}
          aria-label={`${active ? "Stop" : "Play"} ${scale.name} scale ascending`}
          onClick={() => onPlay(scale.id, midiNotes)}>
          {active ? "Stop scale" : "Play scale"}
        </button>
        <div role="img" aria-label={`${scale.name} tablature, open strings through fret 12, high E string at the top`}
          className="scale-notation-viewport">
          <div ref={host} className="scale-notation" />
        </div>
        {renderError && <p role="alert">Scale tablature is unavailable. You can still play the scale.</p>}
        <p className="sr-only">{rows.map((row) => `${row.label}: ${row.positions.map((position) => `fret ${position.fret}`).join(", ")}`).join(". ")}</p>
      </div>}
    </details>
  );
}
