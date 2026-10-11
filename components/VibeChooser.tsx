"use client";

import { Tabs } from "@/components/Tabs";
import { useEffect, useRef, useState } from "react";
import { VibePicker } from "@/components/VibePicker";
import { ProgressionResult } from "@/components/ProgressionResult";
import { UiIcon } from "@/components/UiIcon";
import { getSelectedVibes, hasVibeSelection, surpriseVibes, type VibeSelection } from "@/lib/vibe-selection";
import type { ProgressionCard } from "@/lib/progression";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { reducedMotion } from "@/lib/motion";

export function VibeChooser() {
  const [selection, setSelection] = useState<VibeSelection>({});
  const [progression, setProgression] = useState<ProgressionCard[] | null>(null);
  const [view, setView] = useState<"choose" | "play">("choose");
  const [generatedSelection, setGeneratedSelection] = useState<VibeSelection>({});
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
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
      autoAlpha: 0, x: view === "choose" ? -44 : 44, rotationY: view === "choose" ? -9 : 9,
      duration: 0.34, ease: "power3.in", overwrite: "auto",
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
    const cards = view === "play" ? Array.from(incoming.querySelectorAll<HTMLElement>(".progression-grid > li")) : [];
    const content = view === "play" ? cards : Array.from(incoming.querySelectorAll<HTMLElement>("[data-intro]"));
    if (content.length === 0) return;
    const timeline = gsap.timeline({ defaults: { overwrite: "auto" } });
    let observer: IntersectionObserver | undefined;
    let immediate = content;
    if (view === "play") {
      const visible = typeof IntersectionObserver === "undefined" ? cards
        : cards.filter((card) => card.getBoundingClientRect().top < window.innerHeight * 0.9);
      const below = cards.filter((card) => !visible.includes(card));
      immediate = visible;
      gsap.set(below, { autoAlpha: 0, y: 90, rotation: -8, scale: 0.78 });
      timeline.fromTo(visible, {
        autoAlpha: 0, x: (index: number) => index % 2 ? 120 : -120,
        y: 150, rotation: (index: number) => index % 2 ? 14 : -14,
        rotationY: (index: number) => index % 2 ? -22 : 22, scale: 0.67,
      }, {
        autoAlpha: 1, x: 0, y: 0, rotation: 0, rotationY: 0, scale: 1,
        duration: 0.88, stagger: 0.17, ease: "back.out(1.45)",
      });
      if (below.length) observer = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          const card = entry.target as HTMLElement;
          observer?.unobserve(card);
          gsap.to(card, { autoAlpha: 1, y: 0, rotation: 0, scale: 1,
            duration: 0.75, ease: "back.out(1.5)",
            onComplete: () => gsap.set(card, { clearProps: "opacity,visibility,transform" }) });
        });
      }, { rootMargin: "0px 0px -10% 0px" });
      below.forEach((card) => observer?.observe(card));
    } else {
      timeline.fromTo(content, { autoAlpha: 0, y: 38, rotationX: -12 }, {
        autoAlpha: 1, y: 0, rotationX: 0, duration: 0.5, stagger: 0.035, ease: "back.out(1.4)",
      });
    }
    timeline.eventCallback("onComplete", () => gsap.set(immediate, { clearProps: "opacity,visibility,transform" }));
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    const reduceNow = () => {
      if (!preference.matches) return;
      timeline.kill();
      observer?.disconnect();
      gsap.killTweensOf(content);
      gsap.set(content, { clearProps: "opacity,visibility,transform" });
    };
    preference.addEventListener("change", reduceNow);
    return () => { preference.removeEventListener("change", reduceNow); timeline.kill(); observer?.disconnect(); gsap.killTweensOf(content); gsap.set(content, { clearProps: "opacity,visibility,transform" }); };
  }, { scope: root, dependencies: [view], revertOnUpdate: true });

  useEffect(() => () => { transition.current?.kill(); }, []);

  const choose = (next: VibeSelection) => {
    setSelection(next);
    setError(null);
  };
  const summarySelection = view === "play" ? generatedSelection : selection;

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
      // The result is mounted before the outgoing panel leaves; the card-deal starts after the tab switch.
      const outgoing = choosePanel.current;
      if (!outgoing || reducedMotion()) setView("play");
      else {
        setTransitioning(true);
        transition.current?.kill();
        transition.current = gsap.to(outgoing, { autoAlpha: 0, x: -70, rotationY: -12, duration: 0.36,
          ease: "power3.in", onComplete: () => {
            gsap.set(outgoing, { clearProps: "opacity,visibility,transform" });
            setView("play");
            setTransitioning(false);
          } });
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "We couldn't generate a progression. Please try again.");
    } finally {
      setPending(false);
    }
  };

  return (
    <div ref={root} className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <h2 data-intro className="text-2xl">Find your sound</h2>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted">{getSelectedVibes(summarySelection).map((vibe) => vibe.label).join(" · ") || "No vibes selected"}</p>
        <button type="button" disabled={pending} className="min-h-11 rounded-full border border-foreground/20 px-4 text-sm disabled:opacity-50" onClick={() => choose({})}>Reset selection</button>
      </div>
      <Tabs label="Workspace" items={[{ id: "choose", label: "Choose vibe" }, { id: "play", label: "Play", disabled: !progression || transitioning }]} value={view} onChange={switchView}>
        <div ref={choosePanel} hidden={view !== "choose"} className="space-y-5">
        <VibePicker value={selection} onChange={choose} disabled={pending} showSurpriseAction={false} />
        <div className="generation-actions flex gap-3 flex-wrap">
          <button data-intro data-generate type="button" disabled={!hasVibeSelection(selection) || pending || transitioning} onClick={() => void generate()}
            className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-md bg-accent px-4 py-2 text-sm font-medium text-accent-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground disabled:cursor-not-allowed disabled:opacity-40 sm:w-auto">
            <UiIcon name="generate" />
            {pending ? "Finding your chords…" : progression ? "Generate another" : "Generate progression"}
          </button>
          <button data-intro type="button" disabled={pending || transitioning} onClick={() => choose(surpriseVibes())}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-foreground/20 px-3 py-2 text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground sm:w-auto">
            <UiIcon name="surprise" /> Surprise me
          </button>
        </div>
        {error && <p role="alert" className="text-sm">{error}</p>}
        </div>
        {progression && <div ref={playPanel} hidden={view !== "play"} className="space-y-5">
          <div className="flex justify-end">
            <button type="button" className="min-h-11 rounded-full border border-foreground/20 px-4 text-sm" onClick={() => switchView("choose")}>Edit vibe</button>
          </div>
          <ProgressionResult key={JSON.stringify(progression)} chords={progression} active={view === "play" && !transitioning} />
        </div>}
      </Tabs>
    </div>
  );
}
