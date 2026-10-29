import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { expect, test, vi } from "vitest";
import { ProgressionComparison } from "@/components/ProgressionComparison";
import { PlaybackController } from "@/lib/playback";
import { beginProgressionVariation, completeProgressionVariation, createProgressionSession } from "@/lib/progression-session";

const original = createProgressionSession({ vibeIds: ["mood-dreamy"], chords: ["C", "F", "G"] });
const first = completeProgressionVariation(beginProgressionVariation(original, { kind: "mood", moodId: "mood-dark" }), ["Am", "F", "G"]);
const second = completeProgressionVariation(beginProgressionVariation(first, { kind: "surprise" }), ["Dm", "G", "C"]);
const audio = () => ({ prepare: vi.fn(async () => {}), play: vi.fn(), stop: vi.fn(), dispose: vi.fn() });

test("shows the original and all variations in order, retaining position choices as more arrive", async () => {
  const edit = vi.fn();
  const createController = () => new PlaybackController(audio());
  const { rerender } = render(<ProgressionComparison progressions={first.progressions} onEditVibe={edit} createController={createController} />);
  const originalSection = screen.getByRole("region", { name: "Original" });
  const positions = within(originalSection).getByRole("group", { name: "Guitar position for C, chord 1" });
  const higher = within(positions).getByRole("button", { name: "Fret 3 (A-shape)" });
  fireEvent.click(higher);
  await waitFor(() => expect(higher).toHaveAttribute("aria-pressed", "true"));
  rerender(<ProgressionComparison progressions={second.progressions} onEditVibe={edit} createController={createController} />);
  expect(screen.getAllByRole("heading", { level: 3, hidden: true }).map((heading) => heading.textContent)).toEqual(["Original", "Variation 1 · Dark", "Variation 2 · Surprise"]);
  await waitFor(() => expect(screen.getByRole("tab", { name: "Variation 2 · Surprise" })).toHaveAttribute("aria-selected", "true"));
  fireEvent.click(screen.getByRole("tab", { name: "Original" }));
  expect(higher).toHaveAttribute("aria-pressed", "true");
  for (const label of ["Original", "Variation 1 · Dark", "Variation 2 · Surprise"]) {
    fireEvent.click(screen.getByRole("tab", { name: label }));
    const section = screen.getByRole("region", { name: label });
    expect(within(section).getByRole("button", { name: "Play progression" })).toBeVisible();
    expect(within(section).getByRole("list").children).toHaveLength(3);
    const strip = within(section).getByRole("region", { name: "Chord progression" });
    strip.focus();
    expect(strip).toHaveFocus();
  }
  fireEvent.click(screen.getByRole("button", { name: "Edit vibe" }));
  expect(edit).toHaveBeenCalledOnce();
});

test("progression, preview, position and scale playback stop other sections and leaving Play stops all", async () => {
  const sounds = [audio(), audio(), audio()];
  const controllers = sounds.map((sound) => new PlaybackController(sound));
  let index = 0;
  const createController = () => {
    const controller = controllers[index++];
    if (!controller) throw new Error("Missing test controller");
    return controller;
  };
  const { rerender, unmount } = render(<ProgressionComparison progressions={second.progressions} createController={createController} />);
  const originalSection = within(screen.getByRole("region", { name: "Original", hidden: true }));
  const variation = within(screen.getByRole("region", { name: "Variation 1 · Dark", hidden: true }));
  const surprise = within(screen.getByRole("region", { name: "Variation 2 · Surprise", hidden: true }));
  fireEvent.click(originalSection.getByRole("button", { name: "Play progression" }));
  await waitFor(() => expect(controllers[0]?.getState().kind).toBe("sequence"));
  fireEvent.click(screen.getByRole("tab", { name: "Variation 1 · Dark" }));
  fireEvent.click(variation.getByRole("button", { name: "Play Am, Open position" }));
  await waitFor(() => expect(controllers[1]?.getState().kind).toBe("preview"));
  expect(controllers[0]?.getState().kind).toBe("idle");
  fireEvent.click(screen.getByRole("tab", { name: "Original" }));
  expect(originalSection.getByRole("button", { name: "Play progression" })).toHaveAttribute("aria-pressed", "false");
  fireEvent.click(screen.getByRole("tab", { name: "Variation 2 · Surprise" }));
  fireEvent.click(surprise.getByRole("button", { name: "Play progression" }));
  await waitFor(() => expect(controllers[2]?.getState().kind).toBe("sequence"));
  expect(controllers[1]?.getState().kind).toBe("idle");
  fireEvent.click(screen.getByRole("tab", { name: "Original" }));
  const positions = originalSection.getByRole("group", { name: "Guitar position for C, chord 1" });
  fireEvent.click(within(positions).getByRole("button", { name: "Fret 3 (A-shape)" }));
  await waitFor(() => expect(controllers[0]?.getState().kind).toBe("preview"));
  expect(controllers[2]?.getState().kind).toBe("idle");
  fireEvent.click(screen.getByRole("tab", { name: "Variation 1 · Dark" }));
  const details = variation.getByText("C major").closest("details");
  if (!details) throw new Error("Missing scale practice");
  details.open = true;
  fireEvent(details, new Event("toggle"));
  fireEvent.click(await variation.findByRole("button", { name: "Play C major scale ascending" }));
  await waitFor(() => expect(controllers[1]?.getState().kind).toBe("scale"));
  expect(controllers[0]?.getState().kind).toBe("idle");
  fireEvent.click(variation.getByRole("button", { name: "Stop C major scale ascending" }));
  expect(controllers[1]?.getState().kind).toBe("idle");
  fireEvent.click(screen.getByRole("tab", { name: "Variation 2 · Surprise" }));
  fireEvent.click(surprise.getByRole("button", { name: "Play progression" }));
  await waitFor(() => expect(controllers[2]?.getState().kind).toBe("sequence"));
  rerender(<ProgressionComparison progressions={second.progressions} active={false} createController={createController} />);
  expect(controllers.map((controller) => controller.getState().kind)).toEqual(["idle", "idle", "idle"]);
  unmount();
  sounds.forEach((sound) => expect(sound.dispose).toHaveBeenCalledOnce());
});

test("switching sections during audio loading cancels the earlier pending playback", async () => {
  let finishLoading: (() => void) | undefined;
  const slow = { ...audio(), prepare: vi.fn(() => new Promise<void>((resolve) => { finishLoading = resolve; })) };
  const next = audio();
  const controllers = [new PlaybackController(slow), new PlaybackController(next)];
  let index = 0;
  render(<ProgressionComparison progressions={first.progressions} createController={() => {
    const controller = controllers[index++];
    if (!controller) throw new Error("Missing test controller");
    return controller;
  }} />);
  fireEvent.click(within(screen.getByRole("region", { name: "Original" })).getByRole("button", { name: "Play progression" }));
  fireEvent.click(screen.getByRole("tab", { name: "Variation 1 · Dark" }));
  fireEvent.click(within(screen.getByRole("region", { name: "Variation 1 · Dark" })).getByRole("button", { name: "Play progression" }));
  await waitFor(() => expect(next.play).toHaveBeenCalledOnce());
  await act(async () => { finishLoading?.(); });
  expect(slow.play).not.toHaveBeenCalled();
  expect(controllers[0]?.getState().kind).toBe("idle");
});
