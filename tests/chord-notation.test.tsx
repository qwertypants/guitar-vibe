import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import { ChordNotation } from "@/components/ChordNotation";
import { resolveChord } from "@/lib/voicings";

afterEach(() => vi.restoreAllMocks());

test("real VexTab renders open and higher C positions and replaces the selected SVG", async () => {
  // jsdom has no canvas text measurement. VexFlow supports a null-context fallback.
  // The actual SVG parser/renderer runs here; visual metrics are checked in Chrome.
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
  const chord = resolveChord("C");
  if (chord.kind !== "resolved") throw new Error("Missing fixture chord");
  const open = chord.voicings[0];
  const higher = chord.voicings.find((voicing) => voicing.id === "C-E");
  if (!higher) throw new Error("Missing higher fixture position");
  const { container, rerender, unmount } = render(<ChordNotation voicing={open} />);
  await waitFor(() => expect(container.querySelectorAll("svg")).toHaveLength(1));
  expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  expect(screen.getByText("Notes: C3, E3, G3, C4, E4")).toBeInTheDocument();
  const openSvg = container.querySelector("svg");
  expect(openSvg?.querySelectorAll("path").length).toBeGreaterThan(0);
  rerender(<ChordNotation voicing={higher} />);
  await waitFor(() => {
    expect(container.querySelectorAll("svg")).toHaveLength(1);
    expect(container.querySelector("svg")).not.toBe(openSvg);
  });
  expect(screen.getByText("Notes: C3, G3, C4, E4, G4, C5")).toBeInTheDocument();
  expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  unmount();
  expect(container.querySelector("svg")).toBeNull();
});
