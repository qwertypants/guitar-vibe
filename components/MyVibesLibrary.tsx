"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import Flip from "gsap/Flip";
import { PlaybackController } from "@/lib/playback";
import { reducedMotion } from "@/lib/motion";
import { ChordNotation } from "@/components/ChordNotation";
import { UiIcon } from "@/components/UiIcon";
import { filterVibes } from "@/lib/vibes-filter";
import { vibeCatalog, vibeFacets } from "@/lib/vibes";
import { resolveChord, type ChordVoicing } from "@/lib/voicings";
import type { SavedVibe } from "@/lib/server/vibes-store";

gsap.registerPlugin(Flip);

function usePlayback(createController: () => PlaybackController) {
  const [controller] = useState(createController);
  const state = useSyncExternalStore(controller.subscribe, controller.getState, controller.getState);
  useEffect(() => () => controller.dispose(), [controller]);
  return { controller, state };
}

export const MyVibesLibrary = ({ createController = () => new PlaybackController() }: { createController?: () => PlaybackController }) => {
  const [entries, setEntries] = useState<SavedVibe[]>([]);
  const [playingEntryId, setPlayingEntryId] = useState<number | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [message, setMessage] = useState("Loading your saved vibes…");
  const root = useRef<HTMLElement>(null);
  const list = useRef<HTMLOListElement>(null);
  const flipState = useRef<Flip.FlipState | null>(null);
  const controllerState = usePlayback(createController);
  const visibleEntries = filterVibes(entries, selectedIds);
  const activeVoicingId = controllerState.state.kind === "preview" ? controllerState.state.voicingId : null;

  const fetchEntries = useCallback(async () => {
    try {
      const response = await fetch("/api/vibes");
      const payload: unknown = await response.json();
      if (!response.ok || typeof payload !== "object" || payload === null || !("vibes" in payload) || !Array.isArray(payload.vibes)) throw new Error();
      setEntries(payload.vibes as SavedVibe[]);
      setMessage("");
    } catch { setMessage("Saved vibes could not be loaded. Refresh to try again."); }
  }, []);

  useEffect(() => { void Promise.resolve().then(fetchEntries); }, [fetchEntries]);

  const changeFilters = (next: string[]) => {
    if (!reducedMotion() && list.current) flipState.current = Flip.getState(list.current.querySelectorAll("[data-vibe-row]"));
    setSelectedIds(next);
  };

  useGSAP(() => {
    const rows = list.current?.querySelectorAll<HTMLElement>("[data-vibe-row]");
    if (!rows?.length || reducedMotion()) { flipState.current = null; return; }
    if (flipState.current) {
      const state = flipState.current;
      flipState.current = null;
      Flip.from(state, { duration: 0.35, ease: "power2.out", stagger: 0.025 });
    } else {
      gsap.fromTo(rows, { autoAlpha: 0, y: 12 }, { autoAlpha: 1, y: 0, duration: 0.28, stagger: 0.045,
        onComplete: () => gsap.set(rows, { clearProps: "opacity,visibility,transform" }) });
    }
  }, { scope: root, dependencies: [entries.length, selectedIds.join("|")], revertOnUpdate: true });

  const remove = async (entry: SavedVibe) => {
    if (!window.confirm("Delete this saved vibe?")) return;
    try {
      const response = await fetch(`/api/vibes/${entry.id}`, { method: "DELETE" });
      if (!response.ok) throw new Error();
      if (!reducedMotion()) {
        const row = list.current?.querySelector<HTMLElement>(`[data-vibe-id="${entry.id}"]`);
        if (row) await gsap.to(row, { autoAlpha: 0, y: 8, duration: 0.18 }).then();
      }
      setEntries((current) => current.filter(({ id }) => id !== entry.id));
      setMessage("Vibe deleted.");
    } catch { setMessage("This vibe could not be deleted. Please try again."); }
  };

  const preview = (voicing: ChordVoicing, event: React.MouseEvent<HTMLButtonElement>) => {
    void controllerState.controller.preview(voicing).catch(() => setMessage("Audio could not start. Try again."));
    if (!reducedMotion()) gsap.fromTo(event.currentTarget, { scale: 0.92 }, { scale: 1, duration: 0.25, ease: "back.out(2)" });
  };

  const playEntry = (entry: SavedVibe) => {
    if (controllerState.state.kind === "sequence" && playingEntryId === entry.id) {
      controllerState.controller.stop();
      setPlayingEntryId(null);
      return;
    }
    const voicings: ChordVoicing[] = [];
    for (const chord of entry.chords) {
      const resolution = resolveChord(chord);
      if (resolution.kind === "unsupported") return;
      const voicing = resolution.voicings[0];
      if (!voicing) return;
      voicings.push(voicing);
    }
    setPlayingEntryId(entry.id);
    void controllerState.controller.sequence(voicings).catch(() => {
      setPlayingEntryId(null);
      setMessage("Audio could not start. Try again.");
    });
  };

  return <section ref={root} className="mx-auto w-full max-w-7xl space-y-7 px-5 pb-12" aria-labelledby="my-vibes-title">
    <header className="space-y-2 border-b border-foreground/15 pb-5">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent">Your saved progressions</p>
      <h1 id="my-vibes-title" className="text-4xl font-normal tracking-tight sm:text-5xl">My Vibes</h1>
      <div className="flex flex-wrap items-center justify-between gap-3"><p className="text-base text-muted">Settings and chords from the progressions you chose to save.</p>
        <Link href="/" className="min-h-11 inline-flex items-center rounded-full px-4 text-sm font-medium text-accent hover:bg-accent/10">Play</Link></div>
    </header>
    <section aria-label="Filter by vibe">
      <details open className="rounded-xl border border-foreground/15 bg-card px-4 py-3">
        <summary className="flex min-h-8 flex-wrap items-center gap-x-2 text-sm font-medium">
          <span>Quick filters</span>
          <span className="text-xs text-muted">{selectedIds.length ? `${selectedIds.length} active` : "None active"}</span>
        </summary>
        <div className="space-y-3 pt-3">
          {selectedIds.length > 0 && <div className="flex justify-end"><button type="button" onClick={() => changeFilters([])} className="min-h-8 rounded-full border border-foreground/20 px-2.5 text-xs">Clear filters</button></div>}
          {vibeFacets.map((facet) => {
            const options = vibeCatalog.filter((option) => option.facet === facet.id && entries.some((entry) => entry.vibeIds.includes(option.id)));
            return options.length ? <div key={facet.id} className="space-y-1.5"><p className="detail-label text-xs">{facet.label}</p><div className="flex flex-wrap gap-1.5">
              {options.map((option) => <button type="button" key={option.id} aria-pressed={selectedIds.includes(option.id)} onClick={() => changeFilters(selectedIds.includes(option.id) ? selectedIds.filter((id) => id !== option.id) : [...selectedIds, option.id])}
                className="min-h-8 rounded-full border border-foreground/20 px-2.5 py-1 text-xs aria-pressed:border-accent aria-pressed:bg-accent aria-pressed:text-accent-foreground">{option.label}</button>)}
            </div></div> : null;
          })}
        </div>
      </details>
    </section>
    {message && <p role="status" className="text-sm text-muted">{message}</p>}
    {entries.length === 0 && !message && <div className="rounded-xl border border-foreground/15 bg-card p-6"><p className="mb-3">No saved vibes yet.</p><Link href="/" className="text-accent underline underline-offset-4">Go to Play to create one</Link></div>}
    {entries.length > 0 && visibleEntries.length === 0 && <p role="status" className="text-sm text-muted">No saved vibes match those filters.</p>}
    <ol ref={list} className="space-y-4" aria-label="Saved progressions">
      {visibleEntries.map((entry) => {
        const isPlaying = controllerState.state.kind === "sequence" && playingEntryId === entry.id;
        const canPlay = entry.chords.length > 0 && entry.chords.every((chord) => resolveChord(chord).kind === "resolved");
        return <li data-vibe-row data-vibe-id={entry.id} key={entry.id} className="my-vibes-entry w-full min-w-0 rounded-xl border border-foreground/15 bg-card p-3 sm:p-4">
        <article className="space-y-3"><header className="flex flex-wrap items-start justify-between gap-2"><div className="min-w-0"><h2 className="text-base leading-snug">{new Date(entry.createdAt).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}</h2>
          <div className="mt-2 flex flex-wrap gap-1.5">{entry.vibeIds.map((id) => { const option = vibeCatalog.find((item) => item.id === id); return option ? <span key={id} className="rounded-full border border-foreground/15 px-2 py-0.5 text-[0.7rem]">{vibeFacets.find((facet) => facet.id === option.facet)?.label}: {option.label}</span> : null; })}</div></div>
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => playEntry(entry)} disabled={!canPlay}
              aria-label={`${isPlaying ? "Stop" : "Play"} saved progression from ${new Date(entry.createdAt).toLocaleDateString()}`}
              aria-pressed={isPlaying} className="inline-flex min-h-11 items-center gap-2 rounded-full border border-accent bg-accent px-4 text-sm font-medium text-accent-foreground disabled:cursor-not-allowed disabled:opacity-50">
              <UiIcon name={isPlaying ? "stop" : "play"} />{isPlaying ? "Stop" : "Play"}
            </button>
            <button type="button" onClick={() => void remove(entry)} className="min-h-11 rounded-full border border-foreground/20 px-4 text-sm">Delete</button>
          </div></header>
          <div className="my-vibe-chords grid min-w-0 grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4" aria-label="Chord previews">{entry.chords.map((chord, index) => {
            const resolution = resolveChord(chord);
            if (resolution.kind === "unsupported") return <p key={`${chord}-${index}`} className="text-sm text-muted">Chord shape unavailable for {chord}.</p>;
            return <section key={`${chord}-${index}`} aria-label={`${chord} voicings`} className="space-y-1.5">
              <h3 className="sr-only">{chord}</h3>
              <div className="grid min-w-0 grid-cols-1 gap-2 sm:grid-cols-2">
                {resolution.voicings.map((voicing) => <div key={voicing.id} className="min-w-0 rounded-lg border border-foreground/15 bg-background/40 p-1.5 sm:p-2">
                  <ChordNotation voicing={voicing} active={activeVoicingId === voicing.id} onPlay={(event) => preview(voicing, event)} />
                </div>)}
              </div>
            </section>;
          })}</div>
        </article>
      </li>;
      })}
    </ol>
  </section>;
};
