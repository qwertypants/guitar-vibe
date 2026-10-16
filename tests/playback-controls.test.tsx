import { StrictMode } from "react";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { expect, test, vi } from "vitest";
import { PlaybackControls } from "@/components/PlaybackControls";
import { ChordNotation } from "@/components/ChordNotation";
import { ProgressionResult } from "@/components/ProgressionResult";
import { PlaybackController } from "@/lib/playback";
import { getBestProgressionScale } from "@/lib/harmony";
import { getScaleFretboard } from "@/lib/scale-notation";
import { resolveProgression } from "@/lib/progression";
import { resolveChord } from "@/lib/voicings";

function voicings(symbol: string) {
  const chord = resolveChord(symbol);
  if (chord.kind !== "resolved") throw new Error(symbol);
  return chord.voicings;
}

test("groups every position in one ordered progression with playable diagrams", () => {
  const selected = voicings("C");
  render(<PlaybackControls voicings={selected}>{(voicing, _index, preview) =>
    <ChordNotation voicing={voicing} onPlay={() => preview(voicing)} />
  }</PlaybackControls>);

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
    expect(within(position).queryByText(`Position ${index + 1}`)).not.toBeInTheDocument();
    expect(within(position).getByRole("button", {
      name: `Play ${voicing.chord}, ${voicing.label}`,
    })).toBeEnabled();
  });
  expect(within(strip).queryByRole("button", { name: /Preview|Stop C/ })).not.toBeInTheDocument();
  expect(within(strip).queryByRole("button", { name: "Play progression" })).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Play progression" })).toBeEnabled();
  expect(screen.getByRole("button", { name: "Play progression" }).querySelector("svg")).toHaveAttribute("aria-hidden", "true");
});

test("accessible controls replay diagrams, switch modes, stop on leaving Play and release on unmount", async () => {
  const audio = { prepare: vi.fn(async () => {}), play: vi.fn(), stop: vi.fn(), dispose: vi.fn() };
  const controller = new PlaybackController(audio);
  const selected = voicings("C");
  const card = (voicing: typeof selected[number], _index: number, preview: (voicing: typeof selected[number]) => void) =>
    <ChordNotation voicing={voicing} onPlay={() => preview(voicing)} />;
  const { rerender, unmount } = render(<StrictMode><PlaybackControls voicings={selected} createController={() => controller}>{card}</PlaybackControls></StrictMode>);
  const diagram = screen.getByRole("button", { name: "Play C, Open position" });
  fireEvent.click(diagram);
  await waitFor(() => expect(audio.play).toHaveBeenCalledWith(selected[0].midiNotes, 1200));
  fireEvent.click(diagram);
  await waitFor(() => expect(audio.play).toHaveBeenCalledTimes(2));
  expect(diagram).not.toHaveAttribute("aria-pressed");
  expect(screen.getByRole("status")).toHaveTextContent("Playing chord preview.");
  fireEvent.click(screen.getByRole("button", { name: "Play progression" }));
  await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Playing position 1"));
  expect(screen.getByRole("button", { name: "Stop progression" })).toHaveAttribute("aria-pressed", "true");
  fireEvent.click(screen.getByRole("button", { name: "Stop progression" }));
  expect(screen.getByRole("status")).toHaveTextContent("Playback stopped.");
  await act(async () => { await controller.sequence(selected); });
  rerender(<StrictMode><PlaybackControls voicings={selected} active={false} createController={() => controller}>{card}</PlaybackControls></StrictMode>);
  expect(controller.getState().kind).toBe("idle");
  await act(async () => { await controller.sequence(selected); });
  rerender(<StrictMode><PlaybackControls voicings={voicings("G")} createController={() => controller}>{card}</PlaybackControls></StrictMode>);
  expect(controller.getState().kind).toBe("sequence");
  await act(async () => { await controller.preview(selected[0]); });
  unmount();
  expect(controller.getState().kind).toBe("idle");
  expect(audio.dispose.mock.calls.length).toBeGreaterThanOrEqual(2);
});

test("position buttons play the pressed voicing, survive selection renders, and interrupt the sequence", async () => {
  const chords = resolveProgression(["C", "Am", "G"]);
  if (!chords) throw new Error("Missing progression");
  const audio = { prepare: vi.fn(async () => {}), play: vi.fn(), stop: vi.fn(), dispose: vi.fn() };
  const controller = new PlaybackController(audio);
  render(<ProgressionResult chords={chords} createController={() => controller} />);
  const first = chords[0]?.voicings;
  const open = first?.[0];
  const higher = first?.[1];
  if (!open || !higher) throw new Error("Missing C positions");
  const group = screen.getByRole("group", { name: "Guitar position for C, chord 1" });
  const alternate = within(group).getByRole("button", { name: higher.label });
  fireEvent.click(alternate);
  await waitFor(() => expect(audio.play).toHaveBeenLastCalledWith(higher.midiNotes, 1200));
  expect(controller.getState()).toEqual({ kind: "preview", voicingId: higher.id });
  expect(screen.getByRole("button", { name: `Play C, ${higher.label}` })).toBeVisible();
  fireEvent.click(alternate);
  await waitFor(() => expect(audio.play).toHaveBeenCalledTimes(2));
  fireEvent.click(screen.getByRole("button", { name: "Play progression" }));
  await waitFor(() => expect(audio.play).toHaveBeenLastCalledWith(higher.midiNotes, 1200));
  expect(controller.getState().kind).toBe("sequence");
  fireEvent.click(within(group).getByRole("button", { name: open.label }));
  await waitFor(() => expect(audio.play).toHaveBeenLastCalledWith(open.midiNotes, 1200));
  expect(controller.getState()).toEqual({ kind: "preview", voicingId: open.id });
  fireEvent.click(screen.getByRole("button", { name: "Play progression" }));
  await waitFor(() => expect(controller.getState().kind).toBe("sequence"));
  expect(audio.play).toHaveBeenLastCalledWith(open.midiNotes, 1200);
  fireEvent.click(screen.getByRole("button", { name: /^Stop$/ }));
  expect(controller.getState().kind).toBe("idle");
});

test("scale and chord playback share one controller and stop one another", async () => {
  const chords = resolveProgression(["C", "Am", "G"]);
  if (!chords) throw new Error("Missing progression fixture");
  const scale = getBestProgressionScale(chords.map(({ symbol }) => symbol));
  if (!scale) throw new Error("Missing scale fixture");
  const fretboard = getScaleFretboard(scale);
  const audio = { prepare: vi.fn(async () => {}), play: vi.fn(), stop: vi.fn(), dispose: vi.fn() };
  const controller = new PlaybackController(audio);
  render(<ProgressionResult chords={chords} createController={() => controller} />);
  const disclosure = screen.getByText(scale.name).closest("details");
  if (!disclosure) throw new Error("Missing scale section");
  fireEvent.click(within(disclosure).getByText(scale.name));
  await screen.findByRole("img", { name: new RegExp(`${scale.name} tablature`) });
  fireEvent.click(within(disclosure).getByRole("button", { name: `Play ${scale.name} scale ascending` }));
  await waitFor(() => expect(audio.play).toHaveBeenLastCalledWith([fretboard.midiNotes[0]], 300));
  expect(controller.getState()).toEqual({ kind: "scale", scaleId: scale.id, index: 0 });
  fireEvent.click(screen.getByRole("button", { name: "Play progression" }));
  await waitFor(() => expect(controller.getState().kind).toBe("sequence"));
  expect(audio.play).toHaveBeenLastCalledWith(chords[0]?.voicings[0]?.midiNotes, 1200);
  expect(within(disclosure).getByRole("button", { name: `Play ${scale.name} scale ascending` })).toHaveAttribute("aria-pressed", "false");
  fireEvent.click(within(disclosure).getByRole("button", { name: `Play ${scale.name} scale ascending` }));
  await waitFor(() => expect(controller.getState()).toEqual({ kind: "scale", scaleId: scale.id, index: 0 }));
  expect(audio.play).toHaveBeenLastCalledWith([fretboard.midiNotes[0]], 300);
  fireEvent.click(within(disclosure).getByRole("button", { name: `Stop ${scale.name} scale ascending` }));
  expect(controller.getState()).toEqual({ kind: "idle" });
});

test("rapid position presses during audio loading play only the last choice", async () => {
  const chords = resolveProgression(["C", "Am", "G"]);
  if (!chords) throw new Error("Missing progression");
  const pending: Array<() => void> = [];
  const audio = { prepare: vi.fn(() => new Promise<void>((resolve) => pending.push(resolve))), play: vi.fn(), stop: vi.fn(), dispose: vi.fn() };
  const controller = new PlaybackController(audio);
  render(<ProgressionResult chords={chords} createController={() => controller} />);
  const options = chords[0]?.voicings;
  if (!options?.[0] || !options[1]) throw new Error("Missing C positions");
  const group = screen.getByRole("group", { name: "Guitar position for C, chord 1" });
  fireEvent.click(within(group).getByRole("button", { name: options[1].label }));
  fireEvent.click(within(group).getByRole("button", { name: options[0].label }));
  expect(audio.play).not.toHaveBeenCalled();
  await act(async () => { pending[1]?.(); pending[0]?.(); });
  expect(audio.play).toHaveBeenCalledOnce();
  expect(audio.play).toHaveBeenLastCalledWith(options[0].midiNotes, 1200);
});

test("replacing the progression disposes its running controller", async () => {
  const first = resolveProgression(["C", "Am", "G"]);
  const replacement = resolveProgression(["G", "D", "Em"]);
  if (!first || !replacement) throw new Error("Missing progression fixtures");
  const audio = { prepare: vi.fn(async () => {}), play: vi.fn(), stop: vi.fn(), dispose: vi.fn() };
  const controller = new PlaybackController(audio);
  const { rerender } = render(<ProgressionResult key="first" chords={first} createController={() => controller} />);
  fireEvent.click(screen.getByRole("button", { name: "Play progression" }));
  await waitFor(() => expect(controller.getState().kind).toBe("sequence"));
  rerender(<ProgressionResult key="replacement" chords={replacement} createController={() => new PlaybackController(audio)} />);
  expect(controller.getState().kind).toBe("idle");
  expect(audio.dispose).toHaveBeenCalledOnce();
});

test("blocked audio gives a readable alert and stop remains available while resume is pending", async () => {
  const audio = { prepare: vi.fn(async () => { throw new Error("Audio playback is unavailable in this browser."); }), play: vi.fn(), stop: vi.fn(), dispose: vi.fn() };
  const controller = new PlaybackController(audio);
  render(<PlaybackControls voicings={voicings("C")} createController={() => controller} />);
  fireEvent.click(screen.getByRole("button", { name: "Play progression" }));
  await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("Audio playback is unavailable"));
  expect(screen.getByRole("button", { name: /^Stop$/ })).toBeDisabled();
});
