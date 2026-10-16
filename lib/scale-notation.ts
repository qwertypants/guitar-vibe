import { STANDARD_TUNING_MIDI } from "@/lib/voicings";
import { getBestProgressionScale } from "@/lib/harmony";
import type { ProgressionScale, ScaleFretPosition, ScaleFretboard } from "@/types/scales";

const STRING_LABELS = ["High E", "B", "G", "D", "A", "Low E"] as const;

export function getScaleFretboard(scale: ProgressionScale): ScaleFretboard {
  const rows = Array.from({ length: 6 }, (_, index) => {
    const stringNumber = index + 1;
    const openMidi = STANDARD_TUNING_MIDI[5 - index]!;
    const positions = Array.from({ length: 13 }, (_, fret) => ({ stringNumber, fret, midi: openMidi + fret }))
      .filter(({ midi }) => scale.pitchClasses.includes(midi % 12));
    return { stringNumber, label: STRING_LABELS[index]!, positions };
  });
  const positions = rows.flatMap((row) => row.positions);
  const midiNotes = [...new Set(positions.map(({ midi }) => midi))].sort((a, b) => a - b);
  return { rows, positions, midiNotes };
}

export function getProgressionScalePractice(chords: readonly string[]) {
  const scale = getBestProgressionScale(chords);
  return scale ? { scale, ...getScaleFretboard(scale) } : null;
}

export function scaleFretboardToVexTab(positions: readonly ScaleFretPosition[]): string {
  const groups = Array.from({ length: 13 }, (_, fret) => positions.filter((position) => position.fret === fret))
    .filter((group) => group.length > 0)
    .map((group) => {
      const notes = group.map(({ fret, stringNumber }) => `${fret}/${stringNumber}`).join(".");
      return `:q ${group.length > 1 ? `(${notes})` : notes}`;
    });
  return `tabstave notation=true tablature=true tuning=standard strings=6 time=4/4\nnotes ${groups.join(" ")}`;
}

export async function renderScaleVexTab(element: HTMLElement, source: string): Promise<void> {
  const { Artist, Vex, VexTab } = await import("vextab");
  element.replaceChildren();
  const width = 960;
  const scale = 1;
  const renderer = new Vex.Flow.Renderer(element, Vex.Flow.Renderer.Backends.SVG);
  const artist = new Artist(10, 10, width - 20, { scale });
  const tab = new VexTab(artist);
  tab.parse(source);
  artist.render(renderer);
  const svg = element.querySelector("svg");
  if (!svg) throw new Error("Scale tablature could not be rendered.");
  for (const node of svg.querySelectorAll<SVGElement>("[stroke], [fill]")) {
    if (node.hasAttribute("stroke") && node.getAttribute("stroke") !== "none") node.setAttribute("stroke", "currentColor");
  }
  const staveYs = [...svg.querySelectorAll<SVGPathElement>(".vf-stave path")]
    .flatMap((path) => [...(path.getAttribute("d") ?? "").matchAll(/[ML]\s*[-\d.]+\s+([-\d.]+)/g)])
    .map((match) => Number(match[1]))
    .filter(Number.isFinite);
  if (staveYs.length === 0) throw new Error("Scale tablature has no visible stave.");
  const viewBox = svg.getAttribute("viewBox")?.split(/\s+/).map(Number);
  const viewBoxWidth = viewBox?.[2] ?? width - 20;
  const contentHeight = Math.ceil(Math.max(...staveYs) + 30);
  svg.setAttribute("viewBox", `0 0 ${viewBoxWidth} ${contentHeight}`);
  svg.setAttribute("height", String(contentHeight * scale));
  svg.style.height = `${contentHeight * scale}px`;
  svg.setAttribute("focusable", "false");
}
