"use client";

import { useId, useState } from "react";
import { Tabs } from "@/components/Tabs";
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
  const [query, setQuery] = useState("");
  const [facet, setFacet] = useState<(typeof vibeFacets)[number]["id"]>("mood");
  const matches = searchVibes(query);
  const selected = getSelectedVibes(value);

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

  return (
    <section aria-label="Choose your vibe" className="space-y-5">
      <Tabs label="Vibe categories" items={vibeFacets.map((item) => ({ id: item.id, label: item.label + (value[item.id] ? " ✓" : "") }))} value={facet} onChange={setFacet}>
        <div className="space-y-4">
          <label htmlFor={searchId} className="sr-only">Search vibes</label>
          <input id={searchId} type="search" value={query} onChange={(event) => setQuery(event.target.value)} disabled={disabled}
            placeholder="Search vibes" className="min-h-11 w-full rounded-lg border border-foreground/15 bg-card px-3 text-sm" />
          <fieldset disabled={disabled} className="min-h-40">
            <legend className="sr-only">{vibeFacets.find((item) => item.id === facet)?.label}</legend>
            {renderOptions(matches.filter((option) => option.facet === facet))}
            {!matches.some((option) => option.facet === facet) && <p className="text-sm text-muted">No matching vibes in this category. Try another category or search.</p>}
          </fieldset>
        </div>
      </Tabs>

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
