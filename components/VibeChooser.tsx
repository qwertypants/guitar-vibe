"use client";

import { isPagesMode, vibeService } from "@/lib/client/vibe-service";
import { Tabs } from "@/components/Tabs";
import { useEffect, useRef, useState } from "react";
import { VibePicker } from "@/components/VibePicker";
import { ProgressionResult } from "@/components/ProgressionResult";
import { UiIcon } from "@/components/UiIcon";
import { getSelectedVibes, hasVibeSelection, surpriseVibes, type VibeSelection } from "@/lib/vibe-selection";
import { beginProgressionVariation, completeProgressionVariation, createProgressionSession, failProgressionVariation, type ProgressionSession, type VariationDirection } from "@/lib/progression-session";
import { vibeCatalog } from "@/lib/vibes";
import type { ProgressionCard } from "@/lib/progression";
import { variationModeOptions, type VariationMode } from "@/lib/variation";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { reducedMotion } from "@/lib/motion";
import Link from "next/link";

export function VibeChooser() {
  const [selection, setSelection] = useState<VibeSelection>({});
  const [progression, setProgression] = useState<ProgressionCard[] | null>(null);
  const [view, setView] = useState<"choose" | "play">("choose");
  const [generatedSelection, setGeneratedSelection] = useState<VibeSelection>({});
  const [variation, setVariation] = useState<VariationMode>("familiar");
  const [session, setSession] = useState<ProgressionSession | null>(null);
  const [moodId, setMoodId] = useState("mood-dreamy");
  const requestInFlight = useRef(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fallbackUsed, setFallbackUsed] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [transitioning, setTransitioning] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const choosePanel = useRef<HTMLDivElement>(null);
  const playPanel = useRef<HTMLDivElement>(null);
  const transition = useRef<gsap.core.Tween | null>(null);
  const lastView = useRef(view);
  useGSAP(() => {
    if (!pending || reducedMotion()) return;
    const icon = root.current?.querySelector<SVGElement>("[data-generate] svg");
    if (icon) gsap.fromTo(icon, { rotation: -25, scale: 0.7 },
      { rotation: 360, scale: 1, duration: 0.7, ease: "back.out(1.4)",
        onComplete: () => gsap.set(icon, { clearProps: "transform" }) });
  }, { scope: root, dependencies: [pending] });

  useGSAP(() => {
    if (!error || reducedMotion()) return;
    const message = root.current?.querySelector<HTMLElement>('[role="alert"]');
    const button = root.current?.querySelector<HTMLElement>("[data-generate]");
    if (message) gsap.fromTo(message, { autoAlpha: 0, y: -14 },
      { autoAlpha: 1, y: 0, duration: 0.3, ease: "power2.out", onComplete: () => gsap.set(message, { clearProps: "opacity,visibility,transform" }) });
    if (button) gsap.fromTo(button, { x: -10 }, { x: 0, duration: 0.38, ease: "elastic.out(1, 0.3)",
      onComplete: () => gsap.set(button, { clearProps: "transform" }) });
  }, { scope: root, dependencies: [error] });

  const switchView = (next: "choose" | "play") => {
    if (next === view || transitioning || (next === "play" && !progression)) return;
    const outgoing = view === "choose" ? choosePanel.current : playPanel.current;
    if (!outgoing || reducedMotion()) {
      setView(next);
      return;
    }
    setTransitioning(true);
    transition.current?.kill();
    transition.current = gsap.to(outgoing, {
      autoAlpha: 0, y: view === "choose" ? -8 : 8,
      duration: 0.2, ease: "power2.inOut", overwrite: "auto",
      onComplete: () => {
        gsap.set(outgoing, { clearProps: "opacity,visibility,transform" });
        setView(next);
        setTransitioning(false);
      },
    });
  };

  useGSAP(() => {
    if (lastView.current === view) return;
    lastView.current = view;
    if (reducedMotion()) return;
    const incoming = view === "choose" ? choosePanel.current : playPanel.current;
    if (!incoming) return;
    const content = view === "play"
      ? Array.from(incoming.querySelectorAll<HTMLElement>(".progression-grid > li"))
      : Array.from(incoming.querySelectorAll<HTMLElement>("[data-intro]"));
    if (content.length === 0) return;
    const timeline = gsap.timeline({ defaults: { overwrite: "auto" } });
    timeline.fromTo(content, { autoAlpha: 0, y: 10 }, {
      autoAlpha: 1, y: 0, duration: 0.24, stagger: 0.025, ease: "power2.out",
      onComplete: () => gsap.set(content, { clearProps: "opacity,visibility,transform" }),
    });
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    const reduceNow = () => {
      if (!preference.matches) return;
      timeline.kill();
      gsap.killTweensOf(content);
      gsap.set(content, { clearProps: "opacity,visibility,transform" });
    };
    preference.addEventListener("change", reduceNow);
    return () => { preference.removeEventListener("change", reduceNow); timeline.kill(); gsap.killTweensOf(content); gsap.set(content, { clearProps: "opacity,visibility,transform" }); };
  }, { scope: root, dependencies: [view], revertOnUpdate: true });

  useEffect(() => () => { transition.current?.kill(); }, []);

  const choose = (next: VibeSelection) => {
    setSelection(next);
    setError(null);
  };
  const summarySelection = view === "play" ? generatedSelection : selection;

  const generate = async (source: VibeSelection, mode: VariationMode) => {
    if (requestInFlight.current) return;
    requestInFlight.current = true;
    setPending(true);
    setError(null);
    try {
      const payload = await vibeService.generate({
        vibeIds: getSelectedVibes(source).map((vibe) => vibe.id), variation: mode,
      });
      setSession(createProgressionSession({ vibeIds: getSelectedVibes(source).map((vibe) => vibe.id), variation: mode, chords: payload.chords.map((chord) => chord.symbol) }));
      setProgression(payload.chords);
      setFallbackUsed(payload.fallbackUsed);
      setGeneratedSelection(source);
      setSaveMessage(null);
      if (view === "play") return;
      // Mount the result before the chooser leaves so the play view is ready when shown.
      const outgoing = choosePanel.current;
      if (!outgoing || reducedMotion()) setView("play");
      else {
        setTransitioning(true);
        transition.current?.kill();
        transition.current = gsap.to(outgoing, { autoAlpha: 0, y: -8, duration: 0.2,
          ease: "power2.inOut", onComplete: () => {
            gsap.set(outgoing, { clearProps: "opacity,visibility,transform" });
            setView("play");
            setTransitioning(false);
          } });
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "We couldn't generate a progression. Please try again.");
    } finally {
      requestInFlight.current = false;
      setPending(false);
    }
  };

  const generateVariation = async (direction: VariationDirection) => {
    if (!session || requestInFlight.current) return;
    requestInFlight.current = true;
    const requested = beginProgressionVariation(session, direction);
    setSession(requested);
    setError(null);
    setSaveMessage(null);
    try {
      const payload = await vibeService.generate({
        vibeIds: [...requested.vibeIds], variation: requested.variation,
        exploration: { originalChords: [...requested.progressions.original.chords], direction },
      });
      setSession(completeProgressionVariation(requested, payload.chords.map((chord) => chord.symbol)));
    } catch (cause) {
      setSession(failProgressionVariation(requested, cause instanceof Error ? cause.message : "We couldn't generate a variation. Please try again."));
    } finally {
      requestInFlight.current = false;
    }
  };
  const variationPending = session?.generation.kind === "pending";
  const busy = pending || variationPending;

  const saveVibe = async () => {
    if (!progression || saving) return;
    setSaving(true);
    setSaveMessage(null);
    try {
      await vibeService.save({ vibeIds: getSelectedVibes(generatedSelection).map((vibe) => vibe.id), chords: progression.map((chord) => chord.symbol) });
      setSaveMessage("Vibe saved to My Vibes.");
    } catch (cause) {
      setSaveMessage(cause instanceof Error ? cause.message : "This vibe could not be saved. Please try again.");
    } finally { setSaving(false); }
  };

  return (
    <div ref={root} data-view={view} className="vibe-workspace space-y-6">
      <div className="flex items-center justify-between gap-3">
        <h2 data-intro className="text-2xl">Find your sound</h2>
      </div>
      {isPagesMode && <p className="text-sm text-muted">Progressions use built-in musical rules. Saved vibes stay in this browser on this device.</p>}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted">{getSelectedVibes(summarySelection).map((vibe) => vibe.label).join(" · ") || "No vibes selected"}</p>
        <button type="button" disabled={busy} className="min-h-11 rounded-full border border-foreground/20 px-4 text-sm disabled:opacity-50" onClick={() => choose({})}>Reset selection</button>
      </div>
      <Tabs label="Workspace" items={[{ id: "choose", label: "Choose vibe" }, { id: "play", label: "Play", disabled: !progression || transitioning }]} value={view} onChange={switchView}
        actions={<Link href="/my-vibes" className="min-h-11 inline-flex items-center rounded-full px-4 text-sm font-medium text-accent hover:bg-accent/10">My Vibes</Link>}>
        <div ref={choosePanel} hidden={view !== "choose"} className="choose-panel space-y-5">
        <VibePicker value={selection} onChange={choose} disabled={busy} showSurpriseAction={false} />
        <div role="group" aria-label="Progression variation" className="space-y-2">
          <p className="text-sm font-medium">Chord variation</p>
          <div className="flex flex-wrap gap-2">
            {variationModeOptions.map((option) => <button key={option.value} type="button" aria-pressed={variation === option.value}
              aria-describedby={`variation-${option.value}`} disabled={busy}
              onClick={() => setVariation(option.value)}
              className={`min-h-11 rounded-md border px-3 py-2 text-left text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground disabled:opacity-50 ${variation === option.value ? "border-accent bg-accent/10" : "border-foreground/20"}`}>
              <span className="block font-medium">{option.label}</span>
              <span id={`variation-${option.value}`} className="block text-xs text-muted">{option.description}</span>
            </button>)}
          </div>
        </div>
        <div className="generation-actions flex gap-3 flex-wrap">
          <button data-intro data-generate type="button" disabled={!hasVibeSelection(selection) || busy || transitioning} onClick={() => void generate(selection, variation)}
            className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-md bg-accent px-4 py-2 text-sm font-medium text-accent-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground disabled:cursor-not-allowed disabled:opacity-40 sm:w-auto">
            <UiIcon name="generate" />
            {pending ? "Finding your chords…" : progression ? "Generate another" : "Generate progression"}
          </button>
          <button data-intro type="button" disabled={busy || transitioning} onClick={() => choose(surpriseVibes())}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-foreground/20 px-3 py-2 text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground sm:w-auto">
            <UiIcon name="surprise" /> Surprise me
          </button>
        </div>
        {error && <p role="alert" className="text-sm">{error}</p>}
        </div>
        {progression && <div ref={playPanel} hidden={view !== "play"} className="play-panel space-y-5">
          <>{fallbackUsed && <p role="status" className="text-sm text-muted">The model response could not be validated, so this progression uses a trusted fallback.</p>}
          <ProgressionResult key={JSON.stringify(progression)} chords={progression} active={view === "play" && !transitioning && !pending} onEditVibe={() => switchView("choose")} />
          <div className="flex flex-wrap items-center gap-3">
            {session && <fieldset disabled={busy || transitioning} className="flex flex-wrap items-center gap-3">
              <legend className="mb-2 text-sm font-medium">Create a variation</legend>
              <fieldset className="basis-full">
                <legend className="mb-2 text-sm">Mood direction</legend>
                <div className="flex flex-wrap gap-2">
                  {vibeCatalog.filter((vibe) => vibe.facet === "mood").map((mood) => <label key={mood.id} className="inline-flex min-h-11 items-center gap-2 rounded-md border border-foreground/20 px-3 text-sm">
                    <input type="radio" name="variation-mood" value={mood.id} checked={moodId === mood.id} onChange={() => setMoodId(mood.id)} />
                    {mood.label}
                  </label>)}
                </div>
              </fieldset>
              <button type="button" onClick={() => void generateVariation({ kind: "mood", moodId })} className="min-h-11 rounded-full border border-foreground/20 px-4 text-sm font-medium disabled:opacity-50">Generate mood variation</button>
              <button type="button" onClick={() => void generateVariation({ kind: "surprise" })} className="min-h-11 rounded-full border border-foreground/20 px-4 text-sm font-medium disabled:opacity-50">Surprise variation</button>
            </fieldset>}
            <button type="button" disabled={saving || busy} onClick={() => void saveVibe()} className="min-h-11 rounded-full bg-accent px-4 text-sm font-medium text-accent-foreground disabled:opacity-50">{saving ? "Saving…" : "Save vibe"}</button>
            {saveMessage && <p role="status" className="text-sm text-muted">{saveMessage}</p>}</div></>
          {variationPending && <p role="status" className="text-sm text-muted">Generating one variation…</p>}
          {session?.generation.kind === "error" && <p role="alert" className="text-sm">{session.generation.message}</p>}
          {session?.progressions.variations.map((entry) => <div key={entry.id} aria-label={entry.label} className="space-y-1">
            <p className="text-sm font-medium">{entry.label}</p>
            <p className="text-sm text-muted">{entry.chords.join(" · ")}</p>
          </div>)}
          {error && <p role="alert" className="text-sm">{error}</p>}
        </div>}
      </Tabs>
    </div>
  );
}
