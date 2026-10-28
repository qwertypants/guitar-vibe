import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { resolveProgression } from "@/lib/progression";
import { variationModeOptions } from "@/lib/variation";
import Home from "@/app/page";
import { MyVibesLibrary } from "@/components/MyVibesLibrary";
import { parseSnapshot, type SavedVibe } from "@/lib/saved-vibe";

beforeEach(() => {
  vi.stubGlobal("matchMedia", vi.fn(() => ({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() })));
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

test("the landing page keeps explicit generation after visible selection", () => {
  const fetch = vi.spyOn(globalThis, "fetch");
  render(<Home />);
  expect(screen.getByRole("main")).toContainElement(screen.getByRole("heading", { level: 1, name: "Vibe Chords" }));
  const generate = screen.getByRole("button", { name: "Generate progression" });
  expect(generate).toBeDisabled();
  fireEvent.click(screen.getByRole("button", { name: "Surprise me" }));
  expect(generate).toBeEnabled();
  expect(within(screen.getByRole("status", { name: "Selected vibes" })).getAllByRole("button")).toHaveLength(5);
  expect(fetch).not.toHaveBeenCalled();
});

test.each(variationModeOptions)("sends the selected $value mode and keeps the result playable", async (option) => {
  const chords = resolveProgression(["Am", "F", "C"]);
  if (!chords) throw new Error("Missing progression fixture");
  const fetch = vi.spyOn(globalThis, "fetch").mockResolvedValue(Response.json({ chords }));
  render(<Home />);
  expect(screen.getByRole("group", { name: "Progression variation" })).toBeVisible();
  expect(screen.getByRole("button", { name: /Familiar/ })).toHaveAttribute("aria-pressed", "true");
  const mode = screen.getByRole("button", { name: new RegExp(option.label) });
  expect(mode).toHaveAttribute("aria-describedby", `variation-${option.value}`);
  fireEvent.click(screen.getByRole("button", { name: "Moody" }));
  fireEvent.click(mode);
  expect(mode).toHaveAttribute("aria-pressed", "true");
  fireEvent.click(screen.getByRole("button", { name: "Generate progression" }));
  await waitFor(() => expect(screen.getByRole("tab", { name: "Play", selected: true })).toBeVisible());
  expect(JSON.parse(String(fetch.mock.calls[0]?.[1]?.body))).toEqual({ vibeIds: ["mood-moody"], variation: option.value });
  expect(screen.getByRole("button", { name: "Play Am, Open position" })).toBeVisible();
  expect(screen.getByRole("group", { name: "Guitar position for Am, chord 1" })).toBeVisible();
});

test("shows when a trusted fallback progression was used", async () => {
  const chords = resolveProgression(["C", "F", "G"]);
  if (!chords) throw new Error("Missing progression fixture");
  vi.spyOn(globalThis, "fetch").mockResolvedValue(Response.json({ chords, fallbackUsed: true }));
  render(<Home />);
  fireEvent.click(screen.getByRole("button", { name: "Moody" }));
  fireEvent.click(screen.getByRole("button", { name: "Generate progression" }));
  expect(await screen.findByText(/trusted fallback/)).toHaveAttribute("role", "status");
  expect(screen.getByRole("button", { name: "Play C, Open position" })).toBeVisible();
});

test("keeps the selected variation through a pending request and generation error", async () => {
  let resolveRequest: ((response: Response) => void) | undefined;
  vi.spyOn(globalThis, "fetch").mockImplementationOnce(() => new Promise<Response>((resolve) => { resolveRequest = resolve; }));
  render(<Home />);
  fireEvent.click(screen.getByRole("button", { name: "Moody" }));
  const adventurous = screen.getByRole("button", { name: /Adventurous/ });
  fireEvent.click(adventurous);
  fireEvent.click(screen.getByRole("button", { name: "Generate progression" }));
  expect(adventurous).toHaveAttribute("aria-pressed", "true");
  expect(screen.getByRole("button", { name: /Familiar/ })).toBeDisabled();
  expect(screen.getByRole("button", { name: /Richer chords/ })).toBeDisabled();
  expect(adventurous).toBeDisabled();
  resolveRequest?.(Response.json({ error: "Generation failed" }, { status: 502 }));
  expect(await screen.findByRole("alert")).toHaveTextContent("Generation failed");
  expect(adventurous).toHaveAttribute("aria-pressed", "true");
  expect(adventurous).toBeEnabled();
});

test("saving a generated progression sends its creation facets and chord symbols", async () => {
  const chords = resolveProgression(["Am", "F", "C"]);
  if (!chords) throw new Error("Missing progression fixture");
  const fetch = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(new Response(JSON.stringify({ chords })))
    .mockResolvedValueOnce(Response.json({ vibe: { id: 1 } }, { status: 201 }));
  render(<Home />);
  fireEvent.click(screen.getByRole("button", { name: "Moody" }));
  fireEvent.click(screen.getByRole("button", { name: "Generate progression" }));
  await screen.findByRole("button", { name: "Save vibe" });
  fireEvent.click(screen.getByRole("button", { name: "Save vibe" }));
  await waitFor(() => expect(fetch).toHaveBeenCalledTimes(2));
  expect(JSON.parse(String(fetch.mock.calls[1]?.[1]?.body))).toEqual({ vibeIds: ["mood-moody"], chords: ["Am", "F", "C"], progressions: { original: { id: "original", label: "Original", chords: ["Am", "F", "C"] }, variations: [] } });
  expect(await screen.findByText("Vibe saved to My Vibes.")).toHaveAttribute("role", "status");
});

test("a mood variation uses the original Play context and appends without replacing it", async () => {
  const first = resolveProgression(["Am", "F", "C"]);
  const second = resolveProgression(["C", "G", "Am"]);
  if (!first || !second) throw new Error("Missing progression fixture");
  let finishReVibe: ((response: Response) => void) | undefined;
  const fetch = vi.spyOn(globalThis, "fetch")
    .mockResolvedValueOnce(Response.json({ chords: first }))
    .mockImplementationOnce(() => new Promise<Response>((resolve) => { finishReVibe = resolve; }));
  render(<Home />);
  fireEvent.click(screen.getByRole("button", { name: "Moody" }));
  fireEvent.click(screen.getByRole("button", { name: /Adventurous/ }));
  fireEvent.click(screen.getByRole("button", { name: "Generate progression" }));
  await waitFor(() => expect(screen.getByRole("tab", { name: "Play", selected: true })).toBeVisible());
  fireEvent.click(screen.getByRole("tab", { name: "Choose vibe" }));
  fireEvent.click(screen.getByRole("button", { name: "Dreamy" }));
  fireEvent.click(screen.getByRole("button", { name: /Familiar/ }));
  fireEvent.click(screen.getByRole("tab", { name: "Play" }));
  fireEvent.click(screen.getByRole("button", { name: "Generate mood variation" }));
  expect(JSON.parse(String(fetch.mock.calls[1]?.[1]?.body))).toEqual({ vibeIds: ["mood-moody"], variation: "adventurous", exploration: { originalChords: ["Am", "F", "C"], direction: { kind: "mood", moodId: "mood-dreamy" } } });
  expect(screen.getByRole("button", { name: "Generate mood variation" })).toBeDisabled();
  expect(screen.getByText("Generating one variation…")).toHaveAttribute("role", "status");
  expect(screen.getByRole("button", { name: "Save vibe" })).toBeDisabled();
  expect(within(screen.getByRole("region", { name: "Original" })).getByRole("button", { name: "Play Am, Open position" })).toBeVisible();
  finishReVibe?.(Response.json({ chords: second }));
  await waitFor(() => expect(within(screen.getByRole("region", { name: "Variation 1 · Dreamy" })).getByRole("button", { name: "Play C, Open position" })).toBeVisible());
  expect(await screen.findByText("Variation 1 · Dreamy")).toBeVisible();
  expect(screen.getByText("C · G · Am")).toBeVisible();
  expect(within(screen.getByRole("region", { name: "Original" })).getByRole("button", { name: "Play Am, Open position" })).toBeVisible();
  expect(screen.getByRole("button", { name: "Generate mood variation" })).toBeEnabled();
  expect(screen.getByRole("tabpanel", { name: "Play" })).toHaveTextContent("Moody");
});

test("a failed variation keeps the current chords and shows the error in Play", async () => {
  const chords = resolveProgression(["Am", "F", "C"]);
  if (!chords) throw new Error("Missing progression fixture");
  vi.spyOn(globalThis, "fetch")
    .mockResolvedValueOnce(Response.json({ chords }))
    .mockResolvedValueOnce(Response.json({ error: "Try again" }, { status: 502 }));
  render(<Home />);
  fireEvent.click(screen.getByRole("button", { name: "Moody" }));
  fireEvent.click(screen.getByRole("button", { name: "Generate progression" }));
  await waitFor(() => expect(screen.getByRole("button", { name: "Generate mood variation" })).toBeVisible());
  fireEvent.click(screen.getByRole("button", { name: "Generate mood variation" }));
  await waitFor(() => expect(screen.getAllByRole("alert").some((alert) => alert.textContent === "Try again")).toBe(true));
  expect(screen.getByRole("button", { name: "Play Am, Open position" })).toBeVisible();
  expect(screen.getByRole("button", { name: "Generate mood variation" })).toBeEnabled();
});

test("More and help are absent", () => {
  render(<Home />);
  expect(screen.queryByRole("button", { name: "More" })).not.toBeInTheDocument();
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
});

test("Reset clears the selection and a generation error", async () => {
  vi.spyOn(globalThis, "fetch").mockResolvedValue({ ok: false, json: async () => ({ error: "Generation failed" }) } as Response);
  render(<Home />);
  fireEvent.click(screen.getByRole("button", { name: "Moody" }));
  fireEvent.click(screen.getByRole("button", { name: "Generate progression" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("Generation failed");
  fireEvent.click(screen.getByRole("button", { name: "Reset selection" }));
  expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  expect(screen.queryByRole("status", { name: "Selected vibes" })).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Generate progression" })).toBeDisabled();
  const workspace = screen.getByRole("tablist", { name: "Workspace" });
  expect(within(workspace.closest(".tab-bar")!).getByRole("link", { name: "My Vibes" })).toHaveAttribute("href", "/my-vibes");
  expect(screen.queryByRole("navigation", { name: "Main navigation" })).not.toBeInTheDocument();
});

test("Reset clears selection while keeping an existing progression", async () => {
  const chords = resolveProgression(["C", "Am", "G"]);
  if (!chords) throw new Error("Missing progression fixture");
  vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ chords })));
  render(<Home />);
  fireEvent.click(screen.getByRole("button", { name: "Moody" }));
  fireEvent.click(screen.getByRole("button", { name: "Generate progression" }));
  await waitFor(() => expect(screen.getByRole("tab", { name: "Play", selected: true })).toBeVisible());
  fireEvent.click(screen.getByRole("button", { name: "Reset selection" }));
  fireEvent.click(screen.getByRole("tab", { name: "Choose vibe" }));
  expect(screen.getByRole("button", { name: "Generate another" })).toBeDisabled();
  fireEvent.click(screen.getByRole("tab", { name: "Play" }));
  expect(screen.getByRole("heading", { name: "Your chord progression" })).toBeVisible();
  expect(screen.getByText("Moody", { exact: true, selector: "p" })).toBeVisible();
});

test("Reset stays disabled while a generation request is pending", async () => {
  let resolveRequest: ((value: Response) => void) | undefined;
  vi.spyOn(globalThis, "fetch").mockImplementationOnce(() => new Promise<Response>((resolve) => { resolveRequest = resolve; }));
  render(<Home />);
  fireEvent.click(screen.getByRole("button", { name: "Moody", pressed: false }));
  fireEvent.click(screen.getByRole("button", { name: "Generate progression" }));
  expect(screen.getByRole("button", { name: "Reset selection" })).toBeDisabled();
  resolveRequest?.({ ok: false, json: async () => ({ error: "Try again" }) } as Response);
  await waitFor(() => expect(screen.getByRole("button", { name: "Reset selection" })).toBeEnabled());
});


test("generation opens Play, position buttons update diagrams, and a failed replacement preserves the last chords", async () => {
  const chords = resolveProgression(["C", "Am", "G"]);
  if (!chords) throw new Error("Missing progression fixture");
  vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(new Response(JSON.stringify({ chords })))
    .mockResolvedValueOnce(new Response(JSON.stringify({ error: "Try again" }), { status: 502 }));
  render(<Home />);
  fireEvent.click(screen.getByRole("button", { name: "Moody" }));
  fireEvent.click(screen.getByRole("button", { name: "Generate progression" }));
  await waitFor(() => expect(screen.getByRole("tab", { name: "Play", selected: true })).toBeVisible());
  const group = screen.getByRole("group", { name: "Guitar position for C, chord 1" });
  const alternate = within(group).getByRole("button", { name: "Fret 8 (E-shape)" });
  alternate.focus();
  fireEvent.click(alternate);
  expect(alternate).toHaveFocus();
  expect(alternate).toHaveAttribute("aria-pressed", "true");
  expect(screen.getByRole("button", { name: "Play C, Fret 8 (E-shape)" })).toBeVisible();
  expect(screen.getAllByText("Low E string:").length).toBeGreaterThan(0);
  expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Edit vibe" }));
  fireEvent.click(screen.getByRole("tab", { name: /Mood/ }));
  fireEvent.keyDown(screen.getByRole("tab", { name: /Mood/ }), { key: "ArrowRight" });
  expect(screen.getByRole("tab", { name: "Choose vibe" })).toHaveAttribute("aria-selected", "true");
  expect(alternate).toHaveAttribute("aria-pressed", "true");
  fireEvent.click(screen.getByRole("tab", { name: /Mood/ }));
  fireEvent.click(screen.getByRole("button", { name: "Dreamy" }));
  fireEvent.click(screen.getByRole("button", { name: "Generate another" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("Try again");
  fireEvent.click(screen.getByRole("tab", { name: "Play" }));
  expect(screen.getByRole("heading", { name: "Your chord progression" })).toBeVisible();
  expect(screen.getByRole("tabpanel", { name: "Play" })).toHaveTextContent("Moody");
});

test("successive mood and surprise actions retain earlier options through invalid output and recovery", async () => {
  const fetch = vi.spyOn(globalThis, "fetch")
    .mockResolvedValueOnce(Response.json({ chords: resolveProgression(["C", "F", "G"]) }))
    .mockResolvedValueOnce(Response.json({ chords: resolveProgression(["Am", "F", "C"]) }))
    .mockResolvedValueOnce(Response.json({ chords: [{ symbol: "unsupported" }, { symbol: "F" }, { symbol: "C" }] }))
    .mockResolvedValueOnce(Response.json({ chords: resolveProgression(["Dm", "G", "C"]) }));
  render(<Home />);
  fireEvent.click(screen.getByRole("button", { name: "Moody" }));
  fireEvent.click(screen.getByRole("button", { name: "Generate progression" }));
  const moodButton = await screen.findByRole("button", { name: "Generate mood variation" });
  fireEvent.click(screen.getByRole("radio", { name: "Dark" }));
  fireEvent.click(moodButton);
  expect(await screen.findByText("Variation 1 · Dark")).toBeVisible();
  fireEvent.click(screen.getByRole("button", { name: "Surprise variation" }));
  await waitFor(() => expect(screen.getAllByRole("alert").some((alert) => alert.textContent === "This progression could not be played.")).toBe(true));
  expect(screen.getByText("Variation 1 · Dark")).toBeVisible();
  expect(screen.queryByText(/Variation 2/)).not.toBeInTheDocument();
  expect(within(screen.getByRole("region", { name: "Original" })).getByRole("button", { name: "Play C, Open position" })).toBeEnabled();
  fireEvent.click(screen.getByRole("button", { name: "Surprise variation" }));
  expect(await screen.findByText("Variation 2 · Surprise")).toBeVisible();
  expect(screen.getByText("Variation 1 · Dark")).toBeVisible();
  expect(screen.getByText("Am · F · C")).toBeVisible();
  expect(screen.getByText("Dm · G · C")).toBeVisible();
  expect(fetch).toHaveBeenCalledTimes(4);
  for (const index of [2, 3]) expect(JSON.parse(String(fetch.mock.calls[index]?.[1]?.body))).toEqual({
    vibeIds: ["mood-moody"], variation: "familiar", exploration: { originalChords: ["C", "F", "G"], direction: { kind: "surprise" } },
  });
});

test("saves the complete server session after a failed save and reloads every progression in order", async () => {
  const saved: SavedVibe[] = [];
  const generated = [["C", "F", "G"], ["Am", "F", "C"], ["Dm", "G", "C"]];
  let saveAttempts = 0;
  let completeSave: ((response: Response) => void) | undefined;
  vi.spyOn(globalThis, "fetch").mockImplementation(async (url, init) => {
    if (url === "/api/progression") return Response.json({ chords: resolveProgression(generated.shift() ?? []) });
    if (init?.method === "POST") {
      const snapshot = parseSnapshot(JSON.parse(String(init.body)));
      if (!snapshot) throw new Error("Invalid saved session");
      saveAttempts += 1;
      if (saveAttempts === 1) return Response.json({ error: "Storage unavailable. Try again." }, { status: 503 });
      saved.push({ id: 1, createdAt: "2026-10-28T12:00:00Z", ...snapshot });
      return new Promise<Response>((resolve) => { completeSave = resolve; });
    }
    return Response.json({ vibes: saved });
  });
  const view = render(<Home />);
  fireEvent.click(screen.getByRole("button", { name: "Moody" }));
  fireEvent.click(screen.getByRole("button", { name: "Generate progression" }));
  fireEvent.click(await screen.findByRole("button", { name: "Generate mood variation" }));
  await screen.findByText("Variation 1 · Dreamy");
  fireEvent.click(screen.getByRole("button", { name: "Surprise variation" }));
  await screen.findByText("Variation 2 · Surprise");
  fireEvent.click(screen.getByRole("button", { name: "Edit vibe" }));
  fireEvent.click(screen.getByRole("button", { name: "Dreamy" }));
  fireEvent.click(screen.getByRole("tab", { name: "Play" }));
  fireEvent.click(screen.getByRole("button", { name: "Save vibe" }));
  expect(await screen.findByText("Storage unavailable. Try again.")).toHaveAttribute("role", "status");
  expect(screen.getByText("C · F · G")).toBeVisible();
  expect(screen.getByText("Am · F · C")).toBeVisible();
  expect(screen.getByText("Dm · G · C")).toBeVisible();
  fireEvent.click(screen.getByRole("button", { name: "Save vibe" }));
  expect(screen.getByRole("button", { name: "Saving…" })).toBeDisabled();
  expect(screen.getByRole("button", { name: "Surprise variation" })).toBeDisabled();
  expect(saved[0]).toMatchObject({ vibeIds: ["mood-moody"], chords: ["C", "F", "G"], progressions: {
    original: { id: "original", label: "Original", chords: ["C", "F", "G"] },
    variations: [
      { id: "variation-1", label: "Variation 1 · Dreamy", chords: ["Am", "F", "C"], direction: { kind: "mood", moodId: "mood-dreamy" } },
      { id: "variation-2", label: "Variation 2 · Surprise", chords: ["Dm", "G", "C"], direction: { kind: "surprise" } },
    ],
  } });
  completeSave?.(Response.json({ vibe: saved[0] }, { status: 201 }));
  await screen.findByText("Vibe saved to My Vibes.");
  view.unmount();
  render(<MyVibesLibrary />);
  fireEvent.click(await screen.findByRole("button", { name: "Open saved vibe" }));
  expect(screen.getAllByRole("heading", { level: 3 }).map((heading) => heading.textContent)).toEqual(["Original", "Variation 1 · Dreamy", "Variation 2 · Surprise"]);
  for (const chords of ["C · F · G", "Am · F · C", "Dm · G · C"]) expect(screen.getByText(chords)).toBeVisible();
});
