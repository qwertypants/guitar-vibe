"use client";

import { ChordNotation } from "@/components/ChordNotation";
import { PlaybackControls } from "@/components/PlaybackControls";
import { resolveChord } from "@/lib/voicings";

export default function NotationSpike() {
  const chord = resolveChord("C");
  if (chord.kind !== "resolved") return null;
  return (
    <main className="mx-auto min-h-screen max-w-6xl space-y-6 px-4 py-8 sm:px-6">
      <h1 className="text-2xl font-semibold">VexChords diagram fixture</h1>
      <p>Preview each C major position, or play all shown positions in numbered order. Audio uses the exact displayed notes. Turn your volume down before playing.</p>
      <PlaybackControls voicings={chord.voicings}>
        {(voicing) => <ChordNotation voicing={voicing} />}
      </PlaybackControls>
    </main>
  );
}
