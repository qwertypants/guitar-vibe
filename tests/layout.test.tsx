import { StrictMode, act } from "react";
import { readFileSync } from "node:fs";
import { hydrateRoot, type Root } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { afterEach, expect, test, vi } from "vitest";
import RootLayout from "@/app/layout";

const BOOT_MS = 1200;

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  document.documentElement.removeAttribute("data-motion-boot");
  document.documentElement.removeAttribute("lang");
  document.head.replaceChildren();
  document.body.replaceChildren();
});

function motionMedia(matches: boolean) {
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches,
    media: query,
    onchange: null,
    addListener() {},
    removeListener() {},
    addEventListener() {},
    removeEventListener() {},
    dispatchEvent: () => false,
  }));
}

function parseHtml(markup: string) {
  return new DOMParser().parseFromString(markup, "text/html");
}

function installServerHtml(markup: string) {
  const parsed = parseHtml(markup);
  document.documentElement.innerHTML = parsed.documentElement.innerHTML;
  for (const name of document.documentElement.getAttributeNames()) {
    if (!parsed.documentElement.hasAttribute(name)) document.documentElement.removeAttribute(name);
  }
  for (const attr of parsed.documentElement.attributes) {
    document.documentElement.setAttribute(attr.name, attr.value);
  }
}

function bootScript() {
  const script = document.head.querySelector("script");
  if (!script?.textContent) throw new Error("Root layout did not emit a blocking boot script");
  expect(script.getAttribute("async")).toBeNull();
  expect(script.getAttribute("defer")).toBeNull();
  expect(script.getAttribute("src")).toBeNull();
  return script.textContent;
}

/** Classic inline scripts resolve bare names on the window, before hydration. */
function runBootScript() {
  const source = bootScript();
  new Function(source)();
  return source;
}

function page() {
  return (
    <RootLayout>
      <p data-intro="">Intro</p>
    </RootLayout>
  );
}

function flatten(args: unknown[]) {
  return args.map((arg) => (arg instanceof Error ? arg.stack ?? arg.message : String(arg))).join("\n");
}

/** Hydrates against whatever is in `document` right now, collecting React's reports. */
async function hydrateCurrentDom(element: React.ReactElement) {
  const reports: string[] = [];
  const spy = vi.spyOn(console, "error").mockImplementation((...args: unknown[]) => {
    reports.push(flatten(args));
  });
  let root: Root | undefined;
  await act(async () => {
    root = hydrateRoot(document, element);
  });
  spy.mockRestore();
  return { reports, unmount: () => root?.unmount() };
}

test("the boot marker is not in server HTML, so no-JS content stays readable", () => {
  const markup = renderToString(page());
  expect(parseHtml(markup).documentElement.hasAttribute("data-motion-boot")).toBe(false);
  installServerHtml(markup);
  const source = bootScript();
  expect(source).toContain("prefers-reduced-motion: reduce");
  expect(source).toContain("document.documentElement.dataset.motionBoot='pending'");
  expect(source).toContain("removeAttribute('data-motion-boot')");
  expect(source).toContain(String(BOOT_MS));
});

test("reduced motion never sets the boot marker", () => {
  motionMedia(true);
  vi.useFakeTimers();
  installServerHtml(renderToString(page()));
  runBootScript();
  expect(document.documentElement.hasAttribute("data-motion-boot")).toBe(false);
  vi.advanceTimersByTime(BOOT_MS);
  expect(document.documentElement.hasAttribute("data-motion-boot")).toBe(false);
});

test("the boot deadline drops the marker so content cannot stay hidden", () => {
  motionMedia(false);
  vi.useFakeTimers();
  installServerHtml(renderToString(page()));
  runBootScript();
  expect(document.documentElement).toHaveAttribute("data-motion-boot", "pending");
  vi.advanceTimersByTime(BOOT_MS - 1);
  expect(document.documentElement).toHaveAttribute("data-motion-boot", "pending");
  vi.advanceTimersByTime(1);
  expect(document.documentElement.hasAttribute("data-motion-boot")).toBe(false);
});

test("a pre-paint boot marker on html hydrates without a mismatch and is left in place", async () => {
  motionMedia(false);
  vi.useFakeTimers();
  const markup = renderToString(page());
  expect(parseHtml(markup).documentElement.hasAttribute("data-motion-boot")).toBe(false);
  installServerHtml(markup);
  runBootScript();
  expect(document.documentElement).toHaveAttribute("data-motion-boot", "pending");

  const { reports, unmount } = await hydrateCurrentDom(page());
  expect(reports, reports.join("\n---\n")).toEqual([]);
  // React must not strip the marker. The intro hide depends on it surviving until
  // MotionStage or the deadline.
  expect(document.documentElement).toHaveAttribute("data-motion-boot", "pending");
  unmount();
});

test("strict mode still accepts the pre-paint marker instead of regenerating html", async () => {
  motionMedia(false);
  vi.useFakeTimers();
  installServerHtml(renderToString(page()));
  runBootScript();
  expect(document.documentElement).toHaveAttribute("data-motion-boot", "pending");

  const { reports, unmount } = await hydrateCurrentDom(<StrictMode>{page()}</StrictMode>);
  expect(reports, reports.join("\n---\n")).toEqual([]);
  expect(document.documentElement.getAttribute("data-motion-boot")).toBe("pending");
  unmount();
});

test("suppressHydrationWarning stays scoped to html and does not silence real mismatches", async () => {
  motionMedia(false);
  vi.useFakeTimers();
  installServerHtml(renderToString(page()));
  runBootScript();
  expect(document.documentElement).toHaveAttribute("data-motion-boot", "pending");

  // A foreign attribute on <body> is a genuine bug. If suppressHydrationWarning ever
  // widens past <html>, this test is what notices — an unsilenced React report.
  document.body.setAttribute("data-injected-by-extension", "");

  const { reports, unmount } = await hydrateCurrentDom(page());
  expect(reports.some((report) => /data-injected-by-extension/.test(report))).toBe(true);
  unmount();
});

// The stylesheet, read from source: all three halves (stylesheet, boot script,
// MotionStage) share the data-motion-boot contract, and the selector is what decides
// whether intro content flashes before the animation takes over.
const bootHideSelector = /^([^{}\n]*\[data-intro\][^{}\n]*?)\s*\{\s*visibility:\s*hidden;?\s*\}/m
  .exec(readFileSync("app/globals.css", "utf8"))?.[1]?.trim();

function introHiddenByStylesheet() {
  if (!bootHideSelector) throw new Error("app/globals.css no longer hides [data-intro] behind the boot marker");
  return document.querySelector("[data-intro]")?.matches(bootHideSelector) ?? false;
}

test("the stylesheet hides intro content only while the boot marker is pending", () => {
  motionMedia(false);
  vi.useFakeTimers();
  installServerHtml(renderToString(page()));

  // Before the script runs the marker is absent, so nothing is hidden by CSS alone —
  // the script has to run before first paint for this to be safe.
  expect(document.documentElement).not.toHaveAttribute("data-motion-boot");
  expect(introHiddenByStylesheet()).toBe(false);

  runBootScript();
  expect(introHiddenByStylesheet()).toBe(true);

  vi.advanceTimersByTime(BOOT_MS);
  expect(introHiddenByStylesheet()).toBe(false);
});

test("hydration after the deadline does not put the boot marker back", async () => {
  motionMedia(false);
  vi.useFakeTimers();
  installServerHtml(renderToString(page()));
  runBootScript();
  expect(document.documentElement).toHaveAttribute("data-motion-boot", "pending");

  // Hydration never arrives in time; the deadline exposes the content.
  vi.advanceTimersByTime(BOOT_MS);
  expect(document.documentElement).not.toHaveAttribute("data-motion-boot");
  expect(introHiddenByStylesheet()).toBe(false);

  // A late hydration must not re-hide what is already readable.
  const { reports, unmount } = await hydrateCurrentDom(page());
  expect(reports, reports.join("\n---\n")).toEqual([]);
  expect(document.documentElement).not.toHaveAttribute("data-motion-boot");
  expect(introHiddenByStylesheet()).toBe(false);
  unmount();
});