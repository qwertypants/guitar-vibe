// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { expect, test, vi } from "vitest";
import { ScalePractice } from "@/components/ScalePractice";
import { getBestProgressionScale } from "@/lib/harmony";
import { getScaleFretboard } from "@/lib/scale-notation";

const { renderScaleMock } = vi.hoisted(() => ({ renderScaleMock: vi.fn() }));
vi.mock("@/lib/scale-notation", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/scale-notation")>();
  return {
    ...actual,
    renderScaleVexTab: renderScaleMock,
  };
});

test("expands into a VexTab diagram and exposes ascending playback", async () => {
  const scale = getBestProgressionScale(["Am", "F", "C", "G"]);
  if (!scale) throw new Error("Missing scale fixture");
  const { rows, positions, midiNotes } = getScaleFretboard(scale);
  renderScaleMock.mockImplementation(async (element: HTMLElement) => { element.innerHTML = "<svg aria-hidden=\"true\"></svg>"; });
  const onPlay = vi.fn();
  const view = render(<ScalePractice scale={scale} rows={rows} positions={positions} midiNotes={midiNotes} active={false} onPlay={onPlay} />);
  const disclosure = screen.getByText("C major").closest("details");
  if (!disclosure) throw new Error("Missing scale disclosure");
  expect(disclosure).not.toHaveAttribute("open");
  fireEvent.click(within(disclosure).getByText("C major"));
  const fretboard = await screen.findByRole("img", { name: /C major tablature/ });
  await waitFor(() => expect(fretboard.querySelector("svg")).not.toBeNull());
  expect(within(disclosure).getByText(/frets 0–12/)).toBeInTheDocument();
  fireEvent.click(within(disclosure).getByRole("button", { name: "Play C major scale ascending" }));
  expect(onPlay).toHaveBeenCalledWith(scale.id, midiNotes);
  view.unmount();
});

test("keeps audio available when VexTab rendering fails", async () => {
  const scale = getBestProgressionScale(["Am", "F", "C", "G"]);
  if (!scale) throw new Error("Missing scale fixture");
  const fretboard = getScaleFretboard(scale);
  const onPlay = vi.fn();
  render(<ScalePractice scale={scale} {...fretboard} active={false} onPlay={onPlay} />);
  const disclosure = screen.getByText(scale.name).closest("details");
  if (!disclosure) throw new Error("Missing scale disclosure");
  renderScaleMock.mockRejectedValueOnce(new Error("VexTab failed"));
  fireEvent.click(within(disclosure).getByText(scale.name));
  expect(await within(disclosure).findByRole("alert")).toHaveTextContent("You can still play the scale");
  fireEvent.click(within(disclosure).getByRole("button", { name: `Play ${scale.name} scale ascending` }));
  expect(onPlay).toHaveBeenCalledWith(scale.id, fretboard.midiNotes);
});
