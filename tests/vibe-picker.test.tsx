import { useState } from "react";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { VibePicker } from "@/components/VibePicker";
import type { VibeSelection } from "@/lib/vibe-selection";

let mobile = false;
let mediaListener: (() => void) | undefined;

beforeEach(() => {
  mobile = false;
  mediaListener = undefined;
  vi.stubGlobal("matchMedia", vi.fn(() => ({
    get matches() { return mobile; },
    addEventListener: (_type: string, listener: () => void) => { mediaListener = listener; },
    removeEventListener: () => { mediaListener = undefined; },
  })));
  HTMLDialogElement.prototype.showModal = function () {
    this.setAttribute("open", "");
  };
  HTMLDialogElement.prototype.close = function () {
    this.removeAttribute("open");
  };
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  document.body.style.overflow = "";
});

function ControlledPicker() {
  const [selection, setSelection] = useState<VibeSelection>({});
  return <VibePicker value={selection} onChange={setSelection} />;
}

function openRefinements() {
  fireEvent.click(screen.getByRole("button", { name: /Refine/ }));
}

function resizeToMobile() {
  act(() => { mobile = true; mediaListener?.(); });
}

test("moods remain prominent and desktop refinements share a persistent search and selection", () => {
  render(<ControlledPicker />);
  expect(screen.getByRole("group", { name: "Mood" })).toBeVisible();
  expect(screen.queryByRole("searchbox")).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Moody", pressed: false }));
  openRefinements();
  fireEvent.click(screen.getByRole("button", { name: "R&B", pressed: false }));
  fireEvent.change(screen.getByRole("searchbox", { name: "Search vibes" }), { target: { value: "rain" } });
  fireEvent.click(screen.getByRole("button", { name: "Rainy night", pressed: false }));
  openRefinements();
  const selected = within(screen.getByRole("status", { name: "Selected vibes" }));
  expect(selected.getByRole("button", { name: "Remove Moody" })).toBeVisible();
  expect(selected.getByRole("button", { name: "Remove R&B" })).toBeVisible();
  expect(selected.getByRole("button", { name: "Remove Rainy night" })).toBeVisible();
  openRefinements();
  expect(screen.getByRole("searchbox")).toHaveValue("rain");
  fireEvent.click(selected.getByRole("button", { name: "Remove R&B" }));
  expect(selected.queryByRole("button", { name: "Remove R&B" })).not.toBeInTheDocument();
});

test("search uses local options and Surprise me exposes editable selections", () => {
  const fetch = vi.spyOn(globalThis, "fetch");
  vi.spyOn(Math, "random").mockReturnValue(0);
  render(<ControlledPicker />);
  openRefinements();
  fireEvent.change(screen.getByRole("searchbox"), { target: { value: "rain" } });
  expect(screen.getByRole("button", { name: "Rainy night", pressed: false })).toBeVisible();
  expect(screen.getByText("No moods match your search.")).toBeVisible();
  fireEvent.click(screen.getByRole("button", { name: "Surprise me" }));
  expect(within(screen.getByRole("status", { name: "Selected vibes" })).getAllByRole("button")).toHaveLength(5);
  expect(fetch).not.toHaveBeenCalled();
});

test("mobile sheet closes with Done or Escape, restores focus, and releases body scroll", () => {
  resizeToMobile();
  render(<ControlledPicker />);
  const trigger = screen.getByRole("button", { name: "Refine" });
  trigger.focus();
  openRefinements();
  const sheet = screen.getByRole("dialog", { name: "Refine your vibe" });
  expect(sheet).toHaveAttribute("open");
  expect(document.body.style.overflow).toBe("hidden");
  expect(screen.getByRole("searchbox")).toHaveFocus();
  fireEvent.click(screen.getByRole("button", { name: "R&B", pressed: false }));
  fireEvent.click(screen.getByRole("button", { name: "Done" }));
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  expect(trigger).toHaveFocus();
  expect(document.body.style.overflow).toBe("");
  expect(screen.getByRole("button", { name: "Remove R&B" })).toBeVisible();
  openRefinements();
  fireEvent(screen.getByRole("dialog"), new Event("cancel", { cancelable: true }));
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  expect(trigger).toHaveFocus();
  expect(document.body.style.overflow).toBe("");
});

test("resizing an open sheet closes it and restores focus and scroll", () => {
  resizeToMobile();
  render(<ControlledPicker />);
  const trigger = screen.getByRole("button", { name: "Refine" });
  openRefinements();
  act(() => { mobile = false; mediaListener?.(); });
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  expect(trigger).toHaveFocus();
  expect(document.body.style.overflow).toBe("");
});

test("unmounting an open sheet releases the body scroll lock", () => {
  resizeToMobile();
  const view = render(<ControlledPicker />);
  openRefinements();
  expect(document.body.style.overflow).toBe("hidden");
  view.unmount();
  expect(document.body.style.overflow).toBe("");
});

test("resizing an inline refinement while focused returns focus to Refine", () => {
  render(<ControlledPicker />);
  const trigger = screen.getByRole("button", { name: "Refine" });
  openRefinements();
  screen.getByRole("searchbox").focus();
  resizeToMobile();
  expect(screen.queryByRole("searchbox")).not.toBeInTheDocument();
  expect(trigger).toHaveFocus();
});

test("disabled options and standalone Surprise cannot change the selection", () => {
  const onChange = vi.fn();
  render(<VibePicker value={{}} onChange={onChange} disabled />);
  openRefinements();
  expect(screen.getByRole("searchbox")).toBeDisabled();
  expect(screen.getByRole("button", { name: "Moody" })).toBeDisabled();
  expect(screen.getByRole("button", { name: "R&B" })).toBeDisabled();
  expect(screen.getByRole("button", { name: "Surprise me" })).toBeDisabled();
  fireEvent.click(screen.getByRole("button", { name: "Surprise me" }));
  expect(onChange).not.toHaveBeenCalled();
});
