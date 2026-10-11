import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import { ChordNotation } from "@/components/ChordNotation";
import * as notation from "@/lib/chord-notation";
import { resolveChord } from "@/lib/voicings";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  Reflect.deleteProperty(SVGElement.prototype, "getComputedTextLength");
  Reflect.deleteProperty(SVGElement.prototype, "getBBox");
  for (const token of ["--foreground", "--card", "--accent", "--muted"]) {
    document.documentElement.style.removeProperty(token);
  }
});

function enableSvgTextMetrics() {
  // jsdom omits native SVG text metrics; rendering still uses the real library.
  Object.defineProperty(SVGElement.prototype, "getComputedTextLength", { configurable: true, value: () => 12 });
  Object.defineProperty(SVGElement.prototype, "getBBox", { configurable: true, value: () => ({ x: 0, y: 0, width: 12, height: 12 }) });
}

function setDiagramTokens(foreground: string, card: string, accent: string, muted: string) {
  document.documentElement.style.setProperty("--foreground", foreground);
  document.documentElement.style.setProperty("--card", card);
  document.documentElement.style.setProperty("--accent", accent);
  document.documentElement.style.setProperty("--muted", muted);
}

test("real VexChords renders open and higher C positions and replaces the selected SVG", async () => {
  enableSvgTextMetrics();
  const chord = resolveChord("C");
  if (chord.kind !== "resolved") throw new Error("Missing fixture chord");
  const open = chord.voicings[0];
  const higher = chord.voicings.find((voicing) => voicing.id === "C-E");
  if (!higher) throw new Error("Missing higher fixture position");
  const { container, rerender, unmount } = render(<ChordNotation voicing={open} onPlay={() => {}} />);
  await waitFor(() => expect(container.querySelectorAll("svg")).toHaveLength(1));
  expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  expect(container.querySelector("details")).toBeNull();
  expect(screen.getByLabelText("Chord details")).toHaveTextContent("C3E3G3C4E4");
  const openSvg = container.querySelector("svg");
  expect(openSvg).toHaveAttribute("viewBox", "0 0 240 280");
  expect(openSvg?.querySelectorAll("circle").length).toBeGreaterThan(0);
  rerender(<ChordNotation voicing={higher} onPlay={() => {}} />);
  await waitFor(() => {
    expect(container.querySelectorAll("svg")).toHaveLength(1);
    expect(container.querySelector("svg")).not.toBe(openSvg);
  });
  expect(screen.getByLabelText("Chord details")).toBeInTheDocument();
  expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  unmount();
  expect(container.querySelector("svg")).toBeNull();
});

test("the diagram alone is the replay button and its name follows the displayed position", () => {
  const chord = resolveChord("C");
  if (chord.kind !== "resolved") throw new Error("Missing C");
  const onPlay = vi.fn();
  const { rerender } = render(<ChordNotation voicing={chord.voicings[0]} onPlay={onPlay} />);
  const button = screen.getByRole("button", { name: "Play C, Open position" });
  fireEvent.click(screen.getByText("C"));
  fireEvent.click(screen.getByLabelText("Chord details"));
  expect(onPlay).not.toHaveBeenCalled();
  fireEvent.click(button);
  fireEvent.click(button);
  expect(onPlay).toHaveBeenCalledTimes(2);
  const higher = chord.voicings[1];
  if (!higher) throw new Error("Missing alternate C");
  rerender(<ChordNotation voicing={higher} onPlay={onPlay} />);
  expect(screen.getByRole("button", { name: `Play C, ${higher.label}` })).toBe(button);
});

test("system theme changes redraw the current diagram with computed theme colors", async () => {
  enableSvgTextMetrics();
  let dark = false;
  const media = new EventTarget();
  Object.defineProperty(media, "matches", { get: () => dark });
  const removeListener = vi.spyOn(media, "removeEventListener");
  vi.stubGlobal("matchMedia", vi.fn(() => media));
  setDiagramTokens("#241C17", "#FFF9F0", "#A8442A", "#705C4F");

  const chord = resolveChord("C");
  if (chord.kind !== "resolved") throw new Error("Missing C");
  const { container, unmount } = render(<ChordNotation voicing={chord.voicings[0]} onPlay={() => {}} />);
  await waitFor(() => expect(container.querySelectorAll("svg")).toHaveLength(1));
  const lightSvg = container.querySelector("svg");
  expect(lightSvg?.outerHTML).toContain('fill="#241c17"');
  expect(lightSvg?.outerHTML).toContain('stroke="#a8442a"');
  expect(lightSvg?.outerHTML).toContain('stroke="#705c4f"');
  expect(lightSvg?.outerHTML).toContain('fill="#fff9f0"');
  expect(screen.getByLabelText("Chord details")).toBeVisible();

  setDiagramTokens("#F7EBDD", "#2A211C", "#E38B6F", "#C6AD9B");
  await act(async () => {
    dark = true;
    media.dispatchEvent(new Event("change"));
  });
  await waitFor(() => {
    expect(container.querySelectorAll("svg")).toHaveLength(1);
    expect(container.querySelector("svg")).not.toBe(lightSvg);
  });
  expect(container.querySelector("svg")?.outerHTML).toContain('fill="#f7ebdd"');
  expect(container.querySelector("svg")?.outerHTML).toContain('stroke="#e38b6f"');
  expect(container.querySelector("svg")?.outerHTML).toContain('stroke="#c6ad9b"');
  expect(container.querySelector("svg")?.outerHTML).toContain('fill="#2a211c"');
  expect(screen.getByLabelText("Chord details")).toBeVisible();
  unmount();
  expect(removeListener).toHaveBeenCalledWith("change", expect.any(Function));
});


test("failed diagrams retain text and recover on a new selection", async () => {
  const chord = resolveChord("C");
  if (chord.kind !== "resolved") throw new Error("Missing C");
  const next = chord.voicings[1];
  if (!next) throw new Error("Missing alternate C");
  const renderer = vi.spyOn(notation, "renderChordNotation").mockRejectedValueOnce(new Error("Failed render"));
  const { rerender } = render(<ChordNotation voicing={chord.voicings[0]} onPlay={() => {}} />);
  await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("Chord diagram is unavailable"));
  expect(screen.getByLabelText("Chord details")).toBeVisible();
  expect(screen.getByLabelText("Strings, low E to high E")).toBeVisible();
  expect(screen.getByLabelText("Chord details")).toBeVisible();
  renderer.mockResolvedValue(undefined);
  rerender(<ChordNotation voicing={next} onPlay={() => {}} />);
  await waitFor(() => expect(screen.queryByRole("alert")).not.toBeInTheDocument());
  expect(screen.getByLabelText("Chord details")).toBeVisible();
  rerender(<ChordNotation voicing={chord.voicings[0]} onPlay={() => {}} />);
  await waitFor(() => expect(screen.queryByRole("alert")).not.toBeInTheDocument());
});

test("rapid selections detach stale drawings and ignore stale failures", async () => {
  const chord = resolveChord("C");
  if (chord.kind !== "resolved") throw new Error("Missing C");
  const [, next, last] = chord.voicings;
  if (!next || !last) throw new Error("Missing C positions");
  let dark = false;
  const media = new EventTarget();
  Object.defineProperty(media, "matches", { get: () => dark });
  vi.stubGlobal("matchMedia", vi.fn(() => media));
  const pending: { element: HTMLElement; resolve: () => void; reject: (error: Error) => void }[] = [];
  vi.spyOn(notation, "renderChordNotation").mockImplementation((element) => new Promise<void>((resolve, reject) => {
    pending.push({ element, resolve, reject });
  }));
  const { container, rerender, unmount } = render(<ChordNotation voicing={chord.voicings[0]} onPlay={() => {}} />);
  rerender(<ChordNotation voicing={next} onPlay={() => {}} />);
  act(() => {
    dark = true;
    media.dispatchEvent(new Event("change"));
  });
  rerender(<ChordNotation voicing={last} onPlay={() => {}} />);
  const [firstRender, secondRender, themeRender, lastRender] = pending;
  if (!firstRender || !secondRender || !themeRender || !lastRender) throw new Error("Missing render calls");
  await act(async () => {
    lastRender.element.append(document.createElementNS("http://www.w3.org/2000/svg", "svg"));
    lastRender.resolve();
    firstRender.element.append(document.createElementNS("http://www.w3.org/2000/svg", "svg"));
    firstRender.resolve();
    secondRender.reject(new Error("Stale failure"));
    themeRender.element.append(document.createElementNS("http://www.w3.org/2000/svg", "svg"));
    themeRender.resolve();
  });
  expect(container.querySelectorAll("svg")).toHaveLength(1);
  expect(firstRender.element.isConnected).toBe(false);
  expect(themeRender.element.isConnected).toBe(false);
  expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  unmount();
  expect(lastRender.element.isConnected).toBe(false);
});
