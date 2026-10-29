import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";

vi.hoisted(() => { process.env.NEXT_PUBLIC_APP_MODE = "pages"; });
import Home from "@/app/page";
import { MyVibesLibrary } from "@/components/MyVibesLibrary";
import * as builtin from "@/lib/builtin-progression";
import { BROWSER_VIBES_KEY } from "@/lib/browser-vibes-store";

beforeEach(() => localStorage.clear());
afterEach(() => vi.restoreAllMocks());

test("browser generation saves to My Vibes, filters, reloads, and deletes without HTTP", async () => {
  const fetch = vi.spyOn(globalThis, "fetch");
  const view = render(<Home />);
  expect(screen.getByText(/Progressions use built-in musical rules/)).toBeVisible();
  fireEvent.click(screen.getByRole("button", { name: "Moody" }));
  fireEvent.click(screen.getByRole("button", { name: "Generate progression" }));
  await screen.findByRole("button", { name: "Generate mood variation" });
  expect(screen.queryByText(/trusted fallback/)).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Generate mood variation" }));
  expect(await screen.findByRole("tab", { name: "Variation 1 · Dreamy" })).toBeVisible();
  fireEvent.click(screen.getByRole("button", { name: "Surprise variation" }));
  expect(await screen.findByRole("tab", { name: "Variation 2 · Surprise" })).toBeVisible();
  expect(screen.getByRole("tab", { name: "Variation 1 · Dreamy" })).toBeVisible();
  await waitFor(() => expect(screen.getByRole("button", { name: "Save vibe" })).toBeEnabled());
  vi.spyOn(Storage.prototype, "setItem").mockImplementationOnce(() => { throw new Error("Browser storage is full. Clear space and retry."); });
  fireEvent.click(screen.getByRole("button", { name: "Save vibe" }));
  expect(await screen.findByText("Browser storage is full. Clear space and retry.")).toHaveAttribute("role", "status");
  fireEvent.click(screen.getByRole("tab", { name: "Original" }));
  expect(screen.getByRole("region", { name: "Original" })).toBeVisible();
  expect(screen.getByRole("tab", { name: "Variation 1 · Dreamy" })).toBeVisible();
  expect(screen.getByRole("tab", { name: "Variation 2 · Surprise" })).toBeVisible();
  expect(localStorage.getItem(BROWSER_VIBES_KEY)).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Save vibe" }));
  await screen.findByText("Vibe saved to My Vibes.");
  const stored = JSON.parse(localStorage.getItem(BROWSER_VIBES_KEY) ?? "null");
  expect(stored.vibes[0]).toMatchObject({ vibeIds: ["mood-moody"], chords: ["C", "F", "G"], progressions: {
    original: { id: "original", label: "Original", chords: ["C", "F", "G"] },
    variations: [
      { id: "variation-1", label: "Variation 1 · Dreamy", direction: { kind: "mood", moodId: "mood-dreamy" } },
      { id: "variation-2", label: "Variation 2 · Surprise", direction: { kind: "surprise" } },
    ],
  } });
  view.unmount();
  const library = render(<MyVibesLibrary />);
  expect(screen.getByText(/Saved in this browser/)).toBeVisible();
  await screen.findByRole("button", { name: "Delete" });
  fireEvent.click(screen.getByRole("button", { name: "Moody" }));
  expect(screen.getByRole("button", { name: "Delete" })).toBeVisible();
  fireEvent.click(screen.getByRole("button", { name: "Clear filters" }));
  library.unmount();
  render(<MyVibesLibrary />);
  await screen.findByRole("button", { name: "Delete" });
  fireEvent.click(screen.getByRole("button", { name: "Open saved vibe" }));
  expect(screen.getAllByRole("heading", { level: 3, hidden: true }).map((heading) => heading.textContent)).toEqual(["Original", "Variation 1 · Dreamy", "Variation 2 · Surprise"]);
  expect(screen.getByText(stored.vibes[0].progressions.original.chords.join(" · "))).toBeVisible();
  for (const entry of stored.vibes[0].progressions.variations) {
    fireEvent.click(screen.getByRole("tab", { name: entry.label }));
    expect(within(screen.getByRole("region", { name: entry.label })).getByRole("button", { name: "Play progression" })).toBeEnabled();
    expect(screen.getAllByText(entry.chords.join(" · ")).length).toBeGreaterThan(0);
  }
  vi.spyOn(window, "confirm").mockReturnValue(true);
  fireEvent.click(screen.getByRole("button", { name: "Delete" }));
  await screen.findByText("Vibe deleted.");
  expect(screen.queryByRole("button", { name: "Delete" })).not.toBeInTheDocument();
  expect(fetch).not.toHaveBeenCalled();
});

test("corrupt browser data is reported and preserved", async () => {
  localStorage.setItem(BROWSER_VIBES_KEY, "damaged");
  render(<MyVibesLibrary />);
  await screen.findByText("Saved vibes could not be loaded. Refresh to try again.");
  expect(localStorage.getItem(BROWSER_VIBES_KEY)).toBe("damaged");
});

test("a failed Pages variation retains the original and earlier alternatives, then recovers", async () => {
  const fetch = vi.spyOn(globalThis, "fetch");
  render(<Home />);
  fireEvent.click(screen.getByRole("button", { name: "Moody" }));
  fireEvent.click(screen.getByRole("button", { name: "Generate progression" }));
  fireEvent.click(await screen.findByRole("button", { name: "Generate mood variation" }));
  expect(await screen.findByRole("tab", { name: "Variation 1 · Dreamy" })).toBeVisible();
  vi.spyOn(builtin, "getFallbackProgression").mockReturnValueOnce(["unknown", "F", "G"]);
  fireEvent.click(screen.getByRole("button", { name: "Surprise variation" }));
  await waitFor(() => expect(screen.getAllByRole("alert").some((alert) => alert.textContent === "This progression could not be played.")).toBe(true));
  expect(screen.getByRole("tab", { name: "Variation 1 · Dreamy" })).toBeVisible();
  fireEvent.click(screen.getByRole("tab", { name: "Original" }));
  expect(within(screen.getByRole("region", { name: "Original" })).getByRole("button", { name: "Play C, Open position" })).toBeEnabled();
  fireEvent.click(screen.getByRole("tab", { name: "Variation 1 · Dreamy" }));
  expect(within(screen.getByRole("region", { name: "Variation 1 · Dreamy" })).getByRole("button", { name: "Play progression" })).toBeEnabled();
  expect(screen.queryByText(/Variation 2/)).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Surprise variation" }));
  expect(await screen.findByRole("tab", { name: "Variation 2 · Surprise" })).toBeVisible();
  expect(screen.getByRole("tab", { name: "Variation 1 · Dreamy" })).toBeVisible();
  expect(fetch).not.toHaveBeenCalled();
});
