"use client";

import { useId, useState } from "react";
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
  const [query, setQuery] = useState("");
  const matches = searchVibes(query);
  const selected = getSelectedVibes(value);
  const mood = matches.filter((option) => option.facet === "mood");
  const refinements = vibeFacets.filter((facet) => facet.id !== "mood");
  const refinementCount = selected.filter((option) => option.facet !== "mood").length;

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
            className="min-h-11 max-w-full rounded-md border border-foreground/20 px-3 py-2 text-sm break-words aria-pressed:bg-foreground aria-pressed:text-background focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground disabled:opacity-50"
          >
            {option.label}
            {pressed && <span aria-hidden="true"> ✓</span>}
          </button>
        );
      })}
    </div>
  );

  return (
    <section aria-label="Choose your vibe" className="space-y-6">
      <fieldset disabled={disabled} className="min-w-0 space-y-3">
        <legend className="mb-3 text-base font-medium">Mood</legend>
        {mood.length > 0 ? renderOptions(mood) : <p className="text-sm">No moods match your search.</p>}
      </fieldset>

      <details className="min-w-0 border-y border-foreground/15">
        <summary className="cursor-pointer rounded-md py-3 text-sm font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground">
          <span>Refine your vibe</span>
          {refinementCount > 0 && <span className="ml-2 font-normal">{refinementCount} selected</span>}
        </summary>
        <div className="space-y-5 pt-2 pb-5">
          <div className="flex min-w-0 flex-col gap-2">
            <label htmlFor={searchId} className="text-sm">Search vibes</label>
            <input
              id={searchId}
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              disabled={disabled}
              placeholder="Try rain, soul, or 90s"
              className="min-h-11 min-w-0 rounded-md border border-foreground/20 px-3 py-2 text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground"
            />
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
      </details>

      {selected.length > 0 && (
        <div role="status" aria-label="Selected vibes" className="space-y-2">
          <p className="text-sm font-medium">Your selection</p>
          <div className="flex flex-wrap gap-2">
            {selected.map((option) => (
              <button
                key={option.id}
                type="button"
                aria-label={`Remove ${option.label}`}
                onClick={() => onChange(removeVibe(value, option.facet))}
                disabled={disabled}
                className="min-h-11 max-w-full rounded-md border border-foreground/20 px-3 py-2 text-sm break-words focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground disabled:opacity-50"
              >
                {vibeFacets.find((facet) => facet.id === option.facet)?.label}: {option.label} ×
              </button>
            ))}
          </div>
        </div>
      )}

      {showSurpriseAction && (
        <button
          type="button"
          onClick={() => onChange(surpriseVibes())}
          disabled={disabled}
          className="min-h-11 rounded-md border border-foreground/20 px-4 py-2 text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground disabled:opacity-50"
        >
          Surprise me
        </button>
      )}
    </section>
  );
}
