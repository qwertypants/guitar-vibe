import { VibeChooser } from "@/components/VibeChooser";

export default function Home() {
  return (
    <main className="mx-auto min-h-screen max-w-2xl space-y-8 px-5 py-10 sm:px-8 sm:py-16">
      <header className="space-y-3">
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Vibe Chords</h1>
        <p className="text-base text-muted">Pick a mood, then refine your vibe if you like.</p>
      </header>
      <VibeChooser />
    </main>
  );
}
