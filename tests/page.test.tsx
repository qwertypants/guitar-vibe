import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { resolveProgression } from "@/lib/progression";
import Home from "@/app/page";

beforeEach(() => {
  vi.stubGlobal("matchMedia", vi.fn(() => ({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() })));
  HTMLDialogElement.prototype.showModal = function () {
    this.setAttribute("open", "");
  };
  HTMLDialogElement.prototype.close = function () {
    this.removeAttribute("open");
  };
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

test("Reset clears selection and errors through the existing selection path", async () => {
  vi.spyOn(globalThis, "fetch").mockResolvedValue({ ok: false, json: async () => ({ error: "Generation failed" }) } as Response);
  render(<Home />);
  fireEvent.click(screen.getByRole("button", { name: "Moody", pressed: false }));
  fireEvent.click(screen.getByRole("button", { name: "Generate progression" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("Generation failed");
  fireEvent.click(screen.getByRole("button", { name: "More" }));
  fireEvent.click(screen.getByRole("menuitem", { name: "Reset selection" }));
  expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  expect(screen.queryByRole("status", { name: "Selected vibes" })).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Generate progression" })).toBeDisabled();
});

test("More menu supports Escape and Help restores focus", () => {
  render(<Home />);
  const more = screen.getByRole("button", { name: "More" });
  fireEvent.click(more);
  expect(screen.getByRole("menu", { name: "More options" })).toBeVisible();
  fireEvent.keyDown(document, { key: "Escape" });
  expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  expect(more).toHaveFocus();
  fireEvent.click(more);
  const menu = screen.getByRole("menu");
  screen.getByRole("menuitem", { name: "How to play" }).focus();
  fireEvent.keyDown(menu, { key: "ArrowDown" });
  expect(screen.getByRole("menuitem", { name: "Reset selection" })).toHaveFocus();
  fireEvent.keyDown(menu, { key: "Home" });
  expect(screen.getByRole("menuitem", { name: "How to play" })).toHaveFocus();
  fireEvent.click(screen.getByRole("menuitem", { name: "How to play" }));
  expect(screen.getByRole("dialog", { name: "How to play" })).toHaveAttribute("open");
  expect(document.body.style.overflow).toBe("hidden");
  fireEvent(screen.getByRole("dialog"), new Event("cancel", { cancelable: true }));
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  expect(more).toHaveFocus();
  expect(document.body.style.overflow).toBe("");
});

test("Reset stays disabled while a generation request is pending", async () => {
  let resolveRequest: ((value: Response) => void) | undefined;
  vi.spyOn(globalThis, "fetch").mockImplementation(() => new Promise<Response>((resolve) => { resolveRequest = resolve; }));
  render(<Home />);
  fireEvent.click(screen.getByRole("button", { name: "Moody", pressed: false }));
  fireEvent.click(screen.getByRole("button", { name: "Generate progression" }));
  fireEvent.click(screen.getByRole("button", { name: "More" }));
  expect(screen.getByRole("menuitem", { name: "Reset selection" })).toBeDisabled();
  resolveRequest?.({ ok: false, json: async () => ({ error: "Try again" }) } as Response);
  await waitFor(() => expect(screen.getByRole("menuitem", { name: "Reset selection" })).toBeEnabled());
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
