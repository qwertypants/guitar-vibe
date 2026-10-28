import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { MyVibesLibrary } from "@/components/MyVibesLibrary";
import MyVibesPage from "@/app/my-vibes/page";
import { PlaybackController } from "@/lib/playback";
import { resolveChord } from "@/lib/voicings";

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

it("renders the My Vibes route inside the shared motion stage", async () => {
  vi.spyOn(globalThis, "fetch").mockResolvedValue(Response.json({ vibes: [] }));
  render(<MyVibesPage />);
  expect(screen.getByRole("main")).toBeInTheDocument();
  expect(screen.getByRole("heading", { name: "My Vibes" })).toBeInTheDocument();
  await screen.findByText("No saved vibes yet.");
});

it("filters by any chosen value, clears filters, previews a chord, and confirms deletion", async () => {
  const entries = [
    { id: 1, createdAt: "2026-10-12T12:00:00.000Z", vibeIds: ["mood-dreamy", "genre-jazz"], chords: ["Am", "F", "C"] },
    { id: 2, createdAt: "2026-10-11T12:00:00.000Z", vibeIds: ["setting-rainy-night"], chords: ["C", "G", "Am"] },
  ];
  const amResolution = resolveChord("Am");
  if (amResolution.kind !== "resolved") throw new Error("Am should have catalogued voicings");
  const alternateAmVoicing = amResolution.voicings[1];
  if (!alternateAmVoicing) throw new Error("Am should have more than one voicing");
  const fetch = vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
    if (String(input) === "/api/vibes" && !init?.method) return Response.json({ vibes: entries });
    if (String(input) === "/api/vibes/1" && init?.method === "DELETE") return new Response(null, { status: 204 });
    return new Response(null, { status: 500 });
  });
  const controller = new PlaybackController();
  const preview = vi.fn().mockResolvedValue(undefined);
  const sequence = vi.fn().mockResolvedValue(undefined);
  controller.preview = preview;
  controller.sequence = sequence;
  vi.spyOn(window, "confirm").mockReturnValue(true);
  const { container } = render(<MyVibesLibrary createController={() => controller} />);
  await screen.findByRole("heading", { name: /Oct 12, 2026/ });
  const filterMenu = container.querySelector("details");
  expect(filterMenu).toHaveAttribute("open");
  expect(screen.getByRole("list", { name: "Saved progressions" })).toHaveClass("space-y-4");
  expect(container.querySelector('[aria-label="Chord previews"]')).toHaveClass("xl:grid-cols-4");
  expect(screen.getAllByRole("listitem")[0]).toHaveClass("w-full");
  expect(screen.getByRole("button", { name: "Jazz" })).toHaveClass("text-xs", "min-h-8");
  expect(within(screen.getAllByRole("listitem")[0]!).getAllByRole("button", { name: /^Play Am,/ })).toHaveLength(amResolution.voicings.length);
  const filterToggle = screen.getByText("Quick filters");
  fireEvent.click(filterToggle);
  expect(filterMenu).not.toHaveAttribute("open");
  fireEvent.click(filterToggle);
  expect(filterMenu).toHaveAttribute("open");
  fireEvent.click(screen.getByRole("button", { name: "Jazz" }));
  fireEvent.click(screen.getByRole("button", { name: "Rainy night" }));
  fireEvent.click(screen.getByRole("button", { name: "Jazz" }));
  fireEvent.click(screen.getByRole("button", { name: "Jazz" }));
  expect(screen.getByRole("heading", { name: /Oct 12, 2026/ })).toBeInTheDocument();
  expect(screen.getByRole("heading", { name: /Oct 11, 2026/ })).toBeInTheDocument();
  fireEvent.click(within(screen.getAllByRole("listitem")[0]!).getByRole("button", { name: `Play Am, ${alternateAmVoicing.label}` }));
  expect(preview).toHaveBeenCalledWith(alternateAmVoicing);
  fireEvent.click(within(screen.getAllByRole("listitem")[0]!).getByRole("button", { name: /Play saved progression/ }));
  expect(sequence).toHaveBeenCalledWith(["Am", "F", "C"].map((chord) => {
    const result = resolveChord(chord);
    if (result.kind !== "resolved") throw new Error(`${chord} should have catalogued voicings`);
    return result.voicings[0];
  }));
  fireEvent.click(screen.getByRole("button", { name: "Clear filters" }));
  fireEvent.click(screen.getAllByRole("button", { name: "Delete" })[0]!);
  await waitFor(() => expect(fetch).toHaveBeenCalledWith("/api/vibes/1", { method: "DELETE" }));
  await waitFor(() => expect(screen.queryByRole("heading", { name: /Oct 12, 2026/ })).not.toBeInTheDocument());
});

it("shows a recovery message for an invalid list response", async () => {
  vi.spyOn(globalThis, "fetch").mockResolvedValue(Response.json({ entries: [] }));
  render(<MyVibesLibrary />);
  expect(await screen.findByText("Saved vibes could not be loaded. Refresh to try again.")).toBeInTheDocument();
});

it("opens legacy vibes as an original-only comparison and closes comparison before library playback", async () => {
  vi.spyOn(globalThis, "fetch").mockResolvedValue(Response.json({ vibes: [
    { id: 1, createdAt: "2026-10-12T12:00:00.000Z", vibeIds: ["mood-dreamy"], chords: ["Am", "F", "C"] },
  ] }));
  const controller = new PlaybackController();
  const stop = vi.spyOn(controller, "stop");
  const sequence = vi.spyOn(controller, "sequence").mockResolvedValue();
  render(<MyVibesLibrary createController={() => controller} />);
  const open = await screen.findByRole("button", { name: "Open saved vibe" });
  expect(open).toHaveAttribute("aria-expanded", "false");
  fireEvent.click(open);
  expect(stop).toHaveBeenCalled();
  expect(open).toHaveAttribute("aria-expanded", "true");
  expect(screen.getByRole("region", { name: "Original" })).toBeVisible();
  expect(screen.queryByText(/Variation 1/)).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Close saved vibe" }));
  expect(screen.queryByRole("region", { name: "Original" })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Open saved vibe" }));
  fireEvent.click(screen.getByRole("button", { name: /Play saved progression/ }));
  expect(sequence).toHaveBeenCalled();
  expect(screen.queryByRole("region", { name: "Original" })).not.toBeInTheDocument();
});

it("reports a failed load and leaves a vibe in place when deletion fails", async () => {
  const fetch = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(Response.json({ vibes: [
    { id: 8, createdAt: "2026-10-10T12:00:00.000Z", vibeIds: ["mood-warm"], chords: ["C", "G", "Am"] },
  ] })).mockResolvedValueOnce(Response.json({ error: "unavailable" }, { status: 500 }));
  const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
  const view = render(<MyVibesLibrary />);
  await screen.findByRole("heading", { name: /Oct 10, 2026/ });
  fireEvent.click(screen.getByRole("button", { name: "Delete" }));
  expect(fetch).toHaveBeenCalledTimes(1);
  confirm.mockReturnValue(true);
  fireEvent.click(screen.getByRole("button", { name: "Delete" }));
  expect(await screen.findByText("This vibe could not be deleted. Please try again.")).toBeInTheDocument();
  expect(screen.getByRole("heading", { name: /Oct 10, 2026/ })).toBeInTheDocument();
  view.unmount();

  vi.spyOn(globalThis, "fetch").mockRejectedValueOnce(new Error("offline"));
  render(<MyVibesLibrary />);
  expect(await screen.findByText("Saved vibes could not be loaded. Refresh to try again.")).toBeInTheDocument();
});
