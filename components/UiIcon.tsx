import type { SVGProps } from "react";

const paths = {
  generate: "m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5Z",
  surprise: "m3 3 18 18M16 3h5v5M3 21l7-7m4-4 7-7M16 21h5v-5",
  refine: "M4 7h16M4 17h16M8 4v6m8 4v6",
  play: "m8 4 12 8-12 8Z",
  stop: "M6 6h12v12H6Z",
  preview: "m8 4 12 8-12 8Z",
  close: "m6 6 12 12M6 18 18 6",
  more: "M5 12h.01M12 12h.01M19 12h.01",
} satisfies Record<string, string>;

export type UiIconName = keyof typeof paths;

export function UiIcon({ name, className = "", ...props }: SVGProps<SVGSVGElement> & { name: UiIconName }) {
  return (
    <svg {...props} aria-hidden="true" focusable="false" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
      className={`inline-block size-4 shrink-0 ${className}`}>
      <path d={paths[name]} />
    </svg>
  );
}
