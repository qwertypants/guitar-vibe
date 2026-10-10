"use client";

import { useEffect, useId, useRef, useState } from "react";
import { UiIcon } from "@/components/UiIcon";
import {
  getSelectedVibes,
  removeVibe,
  surpriseVibes,
  toggleVibe,
  type VibeSelection,
} from "@/lib/vibe-selection";
import { searchVibes, vibeFacets } from "@/lib/vibes";

export type VibePickerProps = {
  value: VibeSelection;
  onChange: (selection: VibeSelection) => void;
  disabled?: boolean;
  showSurpriseAction?: boolean;
};

export function VibePicker({ value, onChange, disabled = false, showSurpriseAction = true }: VibePickerProps) {
  const searchId = useId();
  const panelId = useId();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [mobile, setMobile] = useState(() =>
    typeof window !== "undefined" && window.matchMedia("(max-width: 767px)").matches,
  );
  const refineButton = useRef<HTMLButtonElement>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const matches = searchVibes(query);
  const selected = getSelectedVibes(value);
  const mood = matches.filter((option) => option.facet === "mood");
  const refinements = vibeFacets.filter((facet) => facet.id !== "mood");
  const refinementCount = selected.filter((option) => option.facet !== "mood").length;

  useEffect(() => {
    const media = window.matchMedia("(max-width: 767px)");
    const update = () => {
      const panel = document.getElementById(panelId);
      const focusWasInside = document.activeElement instanceof Node && panel?.contains(document.activeElement);
      if (dialog.current?.open) dialog.current.close();
      setMobile(media.matches);
      setOpen(false);
      if (focusWasInside) refineButton.current?.focus();
    };
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, [panelId]);

  useEffect(() => {
    if (!mobile || !open || !dialog.current) return;
    const element = dialog.current;
    const previousOverflow = document.body.style.overflow;
    element.showModal();
    document.body.style.overflow = "hidden";
    element.querySelector<HTMLInputElement>("input")?.focus();
    return () => {
      if (element.open) element.close();
      document.body.style.overflow = previousOverflow;
    };
  }, [mobile, open]);

  const closeRefinements = () => {
    if (dialog.current?.open) dialog.current.close();
    setOpen(false);
    refineButton.current?.focus();
  };

  const renderOptions = (options: typeof matches) => (
    <div className="flex flex-wrap gap-2">
      {options.map((option) => {
        const pressed = value[option.facet]?.id === option.id;
        return (
          <button
            key={option.id}
            type="button"
            aria-pressed={pressed}
            onClick={() => onChange(toggleVibe(value, option))}
            disabled={disabled}
            className="min-h-11 max-w-full rounded-md border border-foreground/20 bg-card px-3 py-2 text-sm break-words aria-pressed:border-accent aria-pressed:bg-accent aria-pressed:text-accent-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground disabled:opacity-50"
          >
            {option.label}{pressed && <span aria-hidden="true"> ✓</span>}
          </button>
        );
      })}
    </div>
  );

  const refinementContent = (
    <div className="space-y-5">
      <div className="flex min-w-0 flex-col gap-2">
        <label htmlFor={searchId} className="text-sm font-medium">Search vibes</label>
        <input id={searchId} type="search" value={query}
          onChange={(event) => setQuery(event.target.value)} disabled={disabled}
          placeholder="Try rain, soul, or 90s"
          className="min-h-11 min-w-0 rounded-md border border-foreground/20 bg-card px-3 py-2 text-sm text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground" />
      </div>
      {matches.length === 0 && <p className="text-sm">No vibes match your search.</p>}
      {refinements.map((facet) => {
        const options = matches.filter((option) => option.facet === facet.id);
        if (options.length === 0) return null;
        return (
          <fieldset key={facet.id} disabled={disabled} className="min-w-0 space-y-2">
            <legend className="mb-2 text-sm font-medium">{facet.label}</legend>
            {renderOptions(options)}
          </fieldset>
        );
      })}
    </div>
  );

  return (
    <section aria-label="Choose your vibe" className="space-y-5">
      <fieldset disabled={disabled} className="min-w-0 space-y-3">
        <legend className="mb-3 text-2xl font-medium">Mood</legend>
        {mood.length > 0 ? renderOptions(mood) : <p className="text-sm">No moods match your search.</p>}
      </fieldset>

      <div>
        <button ref={refineButton} type="button" aria-expanded={open} aria-controls={panelId}
          onClick={() => setOpen((current) => !current)}
          className="inline-flex min-h-11 items-center gap-2 rounded-md border border-foreground/20 bg-card px-4 py-2 text-sm font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground">
          <UiIcon name="refine" /> Refine
          {refinementCount > 0 && <span className="font-normal text-muted">{refinementCount} selected</span>}
        </button>
        {mobile ? (
          open && <dialog ref={dialog} aria-label="Refine your vibe" onCancel={(event) => {
            event.preventDefault();
            closeRefinements();
          }} id={panelId}
            className="fixed inset-x-0 bottom-0 top-auto m-0 max-h-[85dvh] w-full max-w-none overflow-y-auto rounded-t-2xl border border-foreground/20 bg-card p-5 text-foreground shadow-xl">
            <div className="mb-5 flex items-center justify-between gap-3">
              <h2 className="text-xl">Refine your vibe</h2>
              <button type="button" aria-label="Close refinements" onClick={closeRefinements}
                className="flex min-h-11 min-w-11 items-center justify-center rounded-md border border-foreground/20"><UiIcon name="close" /></button>
            </div>
            {refinementContent}
            <button type="button" onClick={closeRefinements}
              className="mt-6 min-h-11 w-full rounded-md bg-accent px-4 py-2 font-medium text-accent-foreground">Done</button>
          </dialog>
        ) : (
          open && <div id={panelId} className="mt-3 rounded-lg border border-foreground/15 bg-card p-4">
            {refinementContent}
          </div>
        )}
      </div>

      {selected.length > 0 && (
        <div role="status" aria-label="Selected vibes" className="space-y-2">
          <p className="text-sm font-medium">Your selection</p>
          <div className="flex flex-wrap gap-2">
            {selected.map((option) => (
              <button key={option.id} type="button" aria-label={`Remove ${option.label}`}
                onClick={() => onChange(removeVibe(value, option.facet))} disabled={disabled}
                className="min-h-11 max-w-full rounded-md border border-accent/30 bg-accent/10 px-3 py-2 text-sm break-words focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground disabled:opacity-50">
                {vibeFacets.find((facet) => facet.id === option.facet)?.label}: {option.label} ×
              </button>
            ))}
          </div>
        </div>
      )}

      {showSurpriseAction && (
        <button type="button" onClick={() => onChange(surpriseVibes())} disabled={disabled}
          className="inline-flex min-h-11 items-center gap-2 rounded-md border border-foreground/20 px-4 py-2 text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground disabled:opacity-50">
          <UiIcon name="surprise" /> Surprise me
        </button>
      )}
    </section>
  );
}
