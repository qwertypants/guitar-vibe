import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { resolveProgression } from "@/lib/progression";
import Home from "@/app/page";

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
