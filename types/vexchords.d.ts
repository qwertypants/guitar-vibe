declare module "vexchords" {
  export interface ChordData {
    chord: [number, number | "x"][];
    position?: number;
    tuning?: string[];
  }

  export class ChordBox {
    constructor(element: HTMLElement | string, options?: {
      width?: number;
      height?: number;
      numStrings?: number;
      numFrets?: number;
      showTuning?: boolean;
      defaultColor?: string;
      bgColor?: string;
      strokeColor?: string;
      textColor?: string;
      stringColor?: string;
      fretColor?: string;
      fontFamily?: string;
    });
    draw(data: ChordData): void;
  }
}
