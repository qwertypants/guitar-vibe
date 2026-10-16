/** Narrow declarations for the inspected VexTab 4.0.5 API used by our adapter. */
declare module "vextab" {
  export class Artist {
    constructor(x: number, y: number, width: number, options: { scale: number });
    render(renderer: VexTabRenderer): void;
  }
  export class VexTab {
    constructor(artist: Artist);
    parse(source: string): void;
  }
  export interface VexTabRenderer {
    resize(width: number, height: number): void;
  }
  export const Vex: {
    Flow: {
      Renderer: {
        new(element: HTMLElement, backend: number): VexTabRenderer;
        Backends: { SVG: number };
      };
    };
  };
}
