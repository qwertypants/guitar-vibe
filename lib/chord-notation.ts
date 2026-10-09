import type { ChordVoicing } from "@/lib/voicings";

export function voicingToVexTab(voicing: ChordVoicing): string {
  const positions = voicing.notes.map((note) => `${note.fret}/${note.stringNumber}`).join(".");
  return `tabstave notation=true tablature=true tuning=standard\nnotes :w (${positions})`;
}

/** Browser-only compatibility boundary. Never import VexTab during SSR. */
export async function renderChordNotation(element: HTMLElement, voicing: ChordVoicing): Promise<void> {
  const { Artist, VexTab, Vex } = await import("vextab");
  const renderer = new Vex.Flow.Renderer(element, Vex.Flow.Renderer.Backends.SVG);
  const artist = new Artist(10, 10, 300, { scale: 1 });
  const parser = new VexTab(artist);
  parser.parse(voicingToVexTab(voicing));
  artist.render(renderer);
}
