import { VibeChooser } from "@/components/VibeChooser";
import { MotionStage } from "@/components/MotionStage";

export default function Home() {
  return (
    <MotionStage>
      <header className="space-y-2 border-b border-foreground/15 pb-5">
        <p data-intro className="text-xs font-semibold uppercase tracking-[0.2em] text-accent">A mood. A few chords. Something to play.</p>
        <h1 data-intro="letters" className="text-4xl font-normal tracking-tight sm:text-5xl">Vibe Chords</h1>
        <p data-intro className="text-base text-muted">Choose a mood. Find something to play.</p>
      </header>
      <VibeChooser />
    </MotionStage>
  );
}
