import { StrictMode } from "react";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { expect, test, vi } from "vitest";
import { PlaybackControls } from "@/components/PlaybackControls";
import { PlaybackController } from "@/lib/playback";
import { resolveChord } from "@/lib/voicings";

function voicings(symbol: string) {
  const chord = resolveChord(symbol);
  if (chord.kind !== "resolved") throw new Error(symbol);
  return chord.voicings;
}

test("groups every position in one ordered progression with individual previews", () => {
  const selected = voicings("C");
  render(<PlaybackControls voicings={selected}>{(voicing) => <span>{voicing.label}</span>}</PlaybackControls>);

  const strip = screen.getByRole("region", { name: "Chord progression" });
  expect(strip).toHaveAttribute("tabindex", "0");
  expect(strip).toHaveAccessibleDescription(/play the full progression in order/);
  strip.focus();
  expect(strip).toHaveFocus();

  const progression = within(strip).getByRole("list");
  expect(progression.tagName).toBe("OL");
  const positions = within(progression).getAllByRole("listitem");
  expect(positions).toHaveLength(selected.length);
  selected.forEach((voicing, index) => {
    const position = positions[index];
    if (!position) throw new Error(`Missing position ${index + 1}`);
    expect(within(position).getByText(`Position ${index + 1}`)).toBeVisible();
    expect(within(position).getByRole("button", {
      name: `Preview ${voicing.chord}, ${voicing.label}, position ${index + 1}`,
    })).toBeEnabled();
  });
  expect(within(strip).queryByRole("button", { name: "Play progression" })).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Play progression" })).toBeEnabled();
  expect(screen.getByRole("button", { name: "Play progression" }).querySelector("svg")).toHaveAttribute("aria-hidden", "true");
});

test("accessible controls switch modes, stop on selection/regeneration and release on unmount", async () => {
  const audio = { prepare: vi.fn(async () => {}), play: vi.fn(), stop: vi.fn(), dispose: vi.fn() };
  const controller = new PlaybackController(audio);
  const selected = voicings("C");
  const { rerender, unmount } = render(<StrictMode><PlaybackControls voicings={selected} createController={() => controller} /></StrictMode>);
  fireEvent.click(screen.getByRole("button", { name: /Preview C, Open position, position 1/ }));
  await waitFor(() => expect(audio.play).toHaveBeenCalledWith(selected[0].midiNotes, 1200));
  expect(screen.getByRole("button", { name: /Stop C, Open position/ })).toHaveAttribute("aria-pressed", "true");
  expect(screen.getByText("Previewing this chord")).toBeVisible();
  fireEvent.click(screen.getByRole("button", { name: "Play progression" }));
  await waitFor(() => expect(screen.getByText("Playing this progression position")).toBeVisible());
  expect(screen.getByRole("button", { name: "Stop progression" })).toHaveAttribute("aria-pressed", "true");
  fireEvent.click(screen.getByRole("button", { name: "Stop progression" }));
  expect(screen.getByRole("status")).toHaveTextContent("Playback stopped.");
  await act(async () => { await controller.sequence(selected); });
  rerender(<StrictMode><PlaybackControls voicings={voicings("G")} createController={() => controller} /></StrictMode>);
  expect(controller.getState().kind).toBe("idle");
  await act(async () => { await controller.preview(selected[0]); });
  unmount();
  expect(controller.getState().kind).toBe("idle");
  expect(audio.dispose.mock.calls.length).toBeGreaterThanOrEqual(2);
});

test("blocked audio gives a readable alert and stop remains available while resume is pending", async () => {
  const audio = { prepare: vi.fn(async () => { throw new Error("Audio playback is unavailable in this browser."); }), play: vi.fn(), stop: vi.fn(), dispose: vi.fn() };
  const controller = new PlaybackController(audio);
  render(<PlaybackControls voicings={voicings("C")} createController={() => controller} />);
  fireEvent.click(screen.getByRole("button", { name: "Play progression" }));
  await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("Audio playback is unavailable"));
  expect(screen.getByRole("button", { name: /^Stop$/ })).toBeDisabled();
});
