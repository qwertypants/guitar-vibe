import type { ChordVoicing } from "@/lib/voicings";

export function voicingToVexTab(voicing: ChordVoicing): string {
  const positions = voicing.notes.map((note) => `${note.fret}/${note.stringNumber}`).join(".");
  return `tabstave notation=true tablature=true tuning=standard\nnotes :w (${positions})`;
}

/** VexChords frets are relative to the displayed starting fret. */
export function voicingToVexChords(voicing: ChordVoicing) {
  const position = voicing.baseFret > 1 ? voicing.baseFret : 0;
  const chord: [number, number | "x"][] = voicing.frets.map((fret, index) => [
    6 - index,
    fret === null ? "x" : fret === 0 ? 0 : fret - Math.max(1, position) + 1,
  ]);
  return { chord, position, tuning: ["E", "A", "D", "G", "B", "E"] };
}

/** Browser-only rendering boundary. Keep library imports out of SSR. */
export async function renderChordNotation(element: HTMLElement, voicing: ChordVoicing): Promise<void> {
  const { ChordBox } = await import("vexchords");
  const theme = getComputedStyle(document.documentElement);
  const color = (token: string) => theme.getPropertyValue(token).trim();
  const diagram = new ChordBox(element, {
    width: 320,
    height: 373,
    numStrings: 6,
    numFrets: 5,
    showTuning: true,
    defaultColor: color("--foreground"),
    bgColor: color("--card"),
    strokeColor: color("--accent"),
    textColor: color("--foreground"),
    stringColor: color("--muted"),
    fretColor: color("--muted"),
    fontFamily: "Arial, sans-serif",
  });
  diagram.draw(voicingToVexChords(voicing));
  const svg = element.querySelector("svg");
  if (svg) {
    const content = document.createElementNS("http://www.w3.org/2000/svg", "g");
    content.setAttribute("transform", "translate(-12.8 0) scale(1.08 1)");
    while (svg.firstChild) content.append(svg.firstChild);
    svg.append(content);
    svg.setAttribute("viewBox", "0 0 320 373");
  }
}
