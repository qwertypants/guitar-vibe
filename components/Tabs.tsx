"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { reducedMotion } from "@/lib/motion";

export function Tabs<T extends string>({ label, items, value, onChange, children }: {
  label: string;
  items: readonly { id: T; label: string; disabled?: boolean }[];
  value: T;
  onChange: (value: T) => void;
  children: ReactNode;
}) {
  const id = useId();
  const previous = useRef(value);
  const bar = useRef<HTMLDivElement>(null);
  const indicator = useRef<HTMLSpanElement>(null);
  useGSAP(() => {
    const selected = bar.current?.querySelector<HTMLElement>('[aria-selected="true"]');
    if (!selected || !indicator.current) return;
    gsap.to(indicator.current, {
      x: selected.offsetLeft, scaleX: selected.offsetWidth,
      duration: reducedMotion() ? 0 : 0.42, ease: "power3.out", overwrite: "auto",
    });
  }, { scope: bar, dependencies: [value] });
  useEffect(() => {
    if (previous.current !== value) document.getElementById(`${id}-${value}`)?.focus();
    previous.current = value;
  }, [id, value]);
  return <div className="space-y-5">
    <div data-intro ref={bar} role="tablist" aria-label={label} className="tab-bar" onKeyDown={(event) => {
      if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
      event.preventDefault();
      event.stopPropagation();
      const enabled = items.filter((item) => !item.disabled);
      const index = enabled.findIndex((item) => item.id === value);
      const next = event.key === "Home" ? enabled[0] : event.key === "End" ? enabled.at(-1)
        : enabled[(index + (event.key === "ArrowRight" ? 1 : -1) + enabled.length) % enabled.length];
      if (next) {
        onChange(next.id);
        document.getElementById(`${id}-${next.id}`)?.focus();
      }
    }}>
      {items.map((item) => <button key={item.id} id={`${id}-${item.id}`} role="tab" type="button"
        aria-selected={value === item.id} aria-controls={`${id}-panel`} tabIndex={value === item.id ? 0 : -1}
        disabled={item.disabled} onClick={() => onChange(item.id)}>{item.label}</button>)}
      <span ref={indicator} className="tab-indicator" aria-hidden="true" />
    </div>
    <div id={`${id}-panel`} role="tabpanel" aria-labelledby={`${id}-${value}`} tabIndex={0}>{children}</div>
  </div>;
}
