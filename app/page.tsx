import { VibeChooser } from "@/components/VibeChooser";

export default function Home() {
  return (
    <main className="mx-auto min-h-screen max-w-7xl space-y-6 px-4 py-6 sm:px-8 sm:py-8">
      <header className="space-y-2 border-b border-foreground/15 pb-5">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent">A mood. A few chords. Something to play.</p>
        <h1 className="text-4xl font-normal tracking-tight sm:text-5xl">Vibe Chords</h1>
        <p className="text-base text-muted">Choose a mood. Find something to play.</p>
      </header>
      <VibeChooser />
    </main>
  );
}
