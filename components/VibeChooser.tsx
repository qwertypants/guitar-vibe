"use client";

import { Tabs } from "@/components/Tabs";
import { useEffect, useRef, useState } from "react";
import { VibePicker } from "@/components/VibePicker";
import { ProgressionResult } from "@/components/ProgressionResult";
import { UiIcon } from "@/components/UiIcon";
import { getSelectedVibes, hasVibeSelection, surpriseVibes, type VibeSelection } from "@/lib/vibe-selection";
import type { ProgressionCard } from "@/lib/progression";

export function VibeChooser() {
  const [selection, setSelection] = useState<VibeSelection>({});
  const [progression, setProgression] = useState<ProgressionCard[] | null>(null);
  const [view, setView] = useState<"choose" | "play">("choose");
  const [generatedSelection, setGeneratedSelection] = useState<VibeSelection>({});
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [moreOpen, setMoreOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const menu = useRef<HTMLDivElement>(null);
  const moreButton = useRef<HTMLButtonElement>(null);
  const helpDialog = useRef<HTMLDialogElement>(null);

  const choose = (next: VibeSelection) => {
    setSelection(next);
    setError(null);
  };

  useEffect(() => {
    if (!moreOpen) return;
    const dismiss = (event: PointerEvent) => {
      if (event.target instanceof Node && !menu.current?.contains(event.target)) setMoreOpen(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setMoreOpen(false);
        moreButton.current?.focus();
      }
    };
    document.addEventListener("pointerdown", dismiss);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", dismiss);
      document.removeEventListener("keydown", escape);
    };
  }, [moreOpen]);

  useEffect(() => {
    if (!helpOpen || !helpDialog.current) return;
    const dialog = helpDialog.current;
    const previousOverflow = document.body.style.overflow;
    dialog.showModal();
    document.body.style.overflow = "hidden";
    return () => {
      if (dialog.open) dialog.close();
      document.body.style.overflow = previousOverflow;
    };
  }, [helpOpen]);

  const closeHelp = () => {
    if (helpDialog.current?.open) helpDialog.current.close();
    setHelpOpen(false);
    moreButton.current?.focus();
  };

  const focusMenuItem = (index: number) => {
    const items = menu.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]:not(:disabled)');
    items?.[index]?.focus();
  };

  const handleMenuKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const items = Array.from(menu.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]:not(:disabled)') ?? []);
    const index = items.findIndex((item) => item === document.activeElement);
    if (event.key === "Home") items[0]?.focus();
    if (event.key === "End") items[items.length - 1]?.focus();
    if (event.key === "ArrowDown") items[(index + 1) % items.length]?.focus();
    if (event.key === "ArrowUp") items[(index + items.length - 1) % items.length]?.focus();
  };

  const generate = async () => {
    setPending(true);
    setError(null);
    try {
      const response = await fetch("/api/progression", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ vibeIds: getSelectedVibes(selection).map((vibe) => vibe.id) }),
      });
      const payload: unknown = await response.json();
      if (!response.ok || typeof payload !== "object" || payload === null || !("chords" in payload) || !Array.isArray(payload.chords)) {
        const message = typeof payload === "object" && payload !== null && "error" in payload && typeof payload.error === "string"
          ? payload.error : "We couldn't generate a progression. Please try again.";
        throw new Error(message);
      }
      setProgression(payload.chords as ProgressionCard[]);
      setGeneratedSelection(selection);
      setView("play");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "We couldn't generate a progression. Please try again.");
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-2xl">Find your sound</h2>
        <div ref={menu} className="relative">
          <button ref={moreButton} type="button" aria-label="More" aria-expanded={moreOpen} aria-haspopup="menu"
            onClick={() => setMoreOpen((current) => !current)}
            onKeyDown={(event) => {
              if (event.key === "ArrowDown") {
                event.preventDefault();
                setMoreOpen(true);
                requestAnimationFrame(() => focusMenuItem(0));
              }
            }}
            className="inline-flex min-h-11 items-center gap-2 rounded-md border border-foreground/20 bg-card px-3 py-2 text-sm">
            <UiIcon name="more" /> More
          </button>
          {moreOpen && <div role="menu" aria-label="More options" onKeyDown={handleMenuKeyDown}
            className="absolute right-0 z-10 mt-2 flex min-w-44 flex-col gap-2 rounded-lg border border-foreground/20 bg-card p-1 shadow-lg">
            <button type="button" role="menuitem" onClick={() => { setMoreOpen(false); setHelpOpen(true); }}
              className="block min-h-11 w-full rounded-md px-3 py-2 text-left text-sm hover:bg-accent/10">How to play</button>
            <button type="button" role="menuitem" disabled={pending} onClick={() => {
              choose({});
              setMoreOpen(false);
              moreButton.current?.focus();
            }} className="block min-h-11 w-full rounded-md px-3 py-2 text-left text-sm hover:bg-accent/10 disabled:opacity-50">Reset selection</button>
          </div>}
        </div>
      </div>
      <Tabs label="Workspace" items={[{ id: "choose", label: "Choose vibe" }, { id: "play", label: "Play", disabled: !progression }]} value={view} onChange={setView}>
        <div hidden={view !== "choose"} className="space-y-5">
        <VibePicker value={selection} onChange={choose} disabled={pending} showSurpriseAction={false} />
        <div className="generation-actions flex gap-3 flex-wrap">
          <button type="button" disabled={!hasVibeSelection(selection) || pending} onClick={() => void generate()}
            className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-md bg-accent px-4 py-2 text-sm font-medium text-accent-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground disabled:cursor-not-allowed disabled:opacity-40 sm:w-auto">
            <UiIcon name="generate" />
            {pending ? "Finding your chords…" : progression ? "Generate another" : "Generate progression"}
          </button>
          <button type="button" disabled={pending} onClick={() => choose(surpriseVibes())}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-foreground/20 px-3 py-2 text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground sm:w-auto">
            <UiIcon name="surprise" /> Surprise me
          </button>
        </div>
        {error && <p role="alert" className="text-sm">{error}</p>}
        </div>
        {view === "play" && progression && <div className="space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-muted">{getSelectedVibes(generatedSelection).map((vibe) => vibe.label).join(" · ")}</p>
            <button type="button" className="min-h-11 rounded-full border border-foreground/20 px-4 text-sm" onClick={() => setView("choose")}>Edit vibe</button>
          </div>
          <ProgressionResult key={JSON.stringify(progression)} chords={progression} />
        </div>}
      </Tabs>
      {helpOpen && <dialog ref={helpDialog} aria-labelledby="help-title" onCancel={(event) => {
        event.preventDefault();
        closeHelp();
      }}
        className="w-[min(28rem,calc(100vw-2rem))] rounded-xl border border-foreground/20 bg-card p-6 text-foreground shadow-xl">
        <div className="flex items-start justify-between gap-3">
          <h2 id="help-title" className="text-2xl">How to play</h2>
          <button type="button" aria-label="Close help" onClick={closeHelp}
            className="flex min-h-11 min-w-11 items-center justify-center rounded-md border border-foreground/20"><UiIcon name="close" /></button>
        </div>
        <p className="mt-3 text-sm text-muted">Pick a mood and any details you like, then generate a chord progression. Preview a chord or play the full progression.</p>
        <button type="button" onClick={closeHelp}
          className="mt-5 min-h-11 rounded-md bg-accent px-5 py-2 text-sm font-medium text-accent-foreground">Done</button>
      </dialog>}
    </div>
  );
}
