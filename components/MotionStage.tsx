"use client";

import { useRef, type ReactNode } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { SplitText } from "gsap/SplitText";
import { reducedMotion } from "@/lib/motion";

gsap.registerPlugin(useGSAP, SplitText);

/** The page's Animaxxing route-letters entrance and delegated press feedback. */
export function MotionStage({ children }: { children: ReactNode }) {
  const root = useRef<HTMLElement>(null);
  const preparedThisVisit = useRef(false);

  useGSAP(() => {
    const container = root.current;
    if (!container) return;
    const items = Array.from(container.querySelectorAll<HTMLElement>("[data-intro]"));
    const title = container.querySelector<HTMLElement>('[data-intro="letters"]');
    const standard = items.filter((item) => item !== title);
    let split: SplitText | undefined;
    let timeline: gsap.core.Timeline | undefined;
    const settle = () => {
      split?.revert();
      split = undefined;
      gsap.set(items, { clearProps: "opacity,visibility,transform,willChange" });
      document.documentElement.removeAttribute("data-motion-boot");
    };

    try {
      // A missing marker means the boot deadline already exposed readable content.
      // Never hide it again when hydration arrives late.
      if (reducedMotion() || (document.documentElement.dataset.motionBoot !== "pending" && !preparedThisVisit.current)) {
        document.documentElement.removeAttribute("data-motion-boot");
      } else {
        gsap.set(standard, { autoAlpha: 0, y: 34, rotationX: -12 });
        if (title) {
          split = SplitText.create(title, { type: "chars", smartWrap: true, aria: "auto" });
          gsap.set(split.chars, {
            autoAlpha: 0,
            x: () => gsap.utils.random(-window.innerWidth * 0.55, window.innerWidth * 0.55),
            y: () => gsap.utils.random(-window.innerHeight * 0.45, window.innerHeight * 0.45),
            rotation: () => gsap.utils.random(-100, 100),
            scale: 0.45,
          });
        }
        timeline = gsap.timeline({ defaults: { overwrite: "auto" }, onComplete: settle });
        if (split) timeline.to(split.chars, {
          autoAlpha: 1, x: 0, y: 0, rotation: 0, scale: 1,
          duration: 0.88, ease: "power4.out", stagger: { each: 0.035, from: "random" },
        });
        timeline.to(standard, {
          autoAlpha: 1, y: 0, rotationX: 0, duration: 0.64,
          ease: "back.out(1.45)", stagger: 0.055,
        }, split ? 0.28 : 0);
        preparedThisVisit.current = true;
        document.documentElement.removeAttribute("data-motion-boot");
      }
    } catch {
      preparedThisVisit.current = false;
      timeline?.kill();
      settle();
    }

    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    const reduceNow = () => {
      if (preference.matches) { timeline?.kill(); settle(); }
    };
    preference.addEventListener("change", reduceNow);

    const control = (event: Event) => (event.target as Element | null)?.closest<HTMLButtonElement>("button");
    const press = (event: PointerEvent | KeyboardEvent) => {
      if (reducedMotion()) return;
      const isPointer = typeof PointerEvent !== "undefined" && event instanceof PointerEvent;
      if (isPointer && event.button !== 0) return;
      if (event instanceof KeyboardEvent && (event.repeat || (event.key !== "Enter" && event.key !== " "))) return;
      const button = control(event);
      if (!button || button.disabled) return;
      gsap.to(button, { scale: 0.93, duration: 0.1, ease: "power2.out", overwrite: "auto" });
      const box = button.getBoundingClientRect();
      const x = isPointer ? (event as PointerEvent).clientX - box.left : box.width / 2;
      const y = isPointer ? (event as PointerEvent).clientY - box.top : box.height / 2;
      const ink = document.createElement("span");
      ink.className = "motion-ripple";
      ink.setAttribute("aria-hidden", "true");
      const reach = Math.hypot(Math.max(x, box.width - x), Math.max(y, box.height - y));
      Object.assign(ink.style, { left: `${x - reach}px`, top: `${y - reach}px`, width: `${reach * 2}px`, height: `${reach * 2}px` });
      button.append(ink);
      gsap.fromTo(ink, { scale: 0, opacity: 0.26 }, {
        scale: 1, opacity: 0, duration: 0.55, ease: "power2.out",
        onComplete: () => ink.remove(),
      });
    };
    const release = (event: Event) => {
      const button = control(event);
      if (button) gsap.to(button, { scale: 1, duration: 0.42, ease: "elastic.out(1, 0.45)", overwrite: "auto" });
    };
    container.addEventListener("pointerdown", press);
    container.addEventListener("keydown", press);
    container.addEventListener("pointerup", release);
    container.addEventListener("pointerout", release);
    container.addEventListener("pointercancel", release);
    container.addEventListener("keyup", release);
    container.addEventListener("focusout", release);
    return () => {
      timeline?.kill();
      settle();
      preference.removeEventListener("change", reduceNow);
      container.removeEventListener("pointerdown", press);
      container.removeEventListener("keydown", press);
      container.removeEventListener("pointerup", release);
      container.removeEventListener("pointerout", release);
      container.removeEventListener("pointercancel", release);
      container.removeEventListener("keyup", release);
      container.removeEventListener("focusout", release);
      container.querySelectorAll(".motion-ripple").forEach((ink) => ink.remove());
      gsap.killTweensOf(container.querySelectorAll("button"));
    };
  }, { scope: root });

  return <main ref={root} className="motion-stage mx-auto min-h-screen max-w-7xl space-y-6 px-4 py-6 sm:px-8 sm:py-8">{children}</main>;
}
