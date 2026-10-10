import { useState } from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { expect, test, vi } from "vitest";
import { VibePicker } from "@/components/VibePicker";
import type { VibeSelection } from "@/lib/vibe-selection";

function ControlledPicker() {
  const [selection, setSelection] = useState<VibeSelection>({});
  return <VibePicker value={selection} onChange={setSelection} />;
}

test("category tabs retain selections and search across category changes", () => {
  render(<ControlledPicker />);
  fireEvent.click(screen.getByRole("button", { name: "Moody" }));
  fireEvent.click(screen.getByRole("tab", { name: "Genre" }));
  expect(screen.queryByRole("button", { name: "Dreamy" })).not.toBeInTheDocument();
  fireEvent.change(screen.getByRole("searchbox"), { target: { value: "soul" } });
  fireEvent.click(screen.getByRole("button", { name: "Neo-soul" }));
  expect(screen.getByRole("status", { name: "Selected vibes" })).toHaveTextContent("Moody");
  expect(screen.getByRole("status", { name: "Selected vibes" })).toHaveTextContent("Neo-soul");
  fireEvent.click(screen.getByRole("tab", { name: /Mood/ }));
  expect(screen.getByRole("searchbox")).toHaveValue("soul");
  fireEvent.change(screen.getByRole("searchbox"), { target: { value: "" } });
  expect(screen.getByRole("button", { name: /Moody/, pressed: true })).toBeVisible();
  fireEvent.click(screen.getByRole("button", { name: "Remove Moody" }));
  expect(screen.getByRole("button", { name: "Moody", pressed: false })).toBeVisible();
});

test("tabs support arrow keys and Home and End", () => {
  render(<ControlledPicker />);
  const mood = screen.getByRole("tab", { name: "Mood" });
  mood.focus();
  fireEvent.keyDown(mood, { key: "ArrowRight" });
  expect(screen.getByRole("tab", { name: "Genre" })).toHaveFocus();
  fireEvent.keyDown(screen.getByRole("tab", { name: "Genre" }), { key: "End" });
  expect(screen.getByRole("tab", { name: "Energy" })).toHaveAttribute("aria-selected", "true");
  fireEvent.keyDown(screen.getByRole("tab", { name: "Energy" }), { key: "Home" });
  expect(mood).toHaveFocus();
});

test("Surprise exposes five editable selections without generating", () => {
  render(<ControlledPicker />);
  fireEvent.click(screen.getByRole("button", { name: "Surprise me" }));
  const selected = screen.getByRole("status", { name: "Selected vibes" });
  expect(within(selected).getAllByRole("button")).toHaveLength(5);
  fireEvent.click(within(selected).getAllByRole("button")[0]!);
  expect(within(selected).getAllByRole("button")).toHaveLength(4);
});

test("disabled picker cannot modify the selection", () => {
  const change = vi.fn();
  render(<VibePicker value={{}} onChange={change} disabled />);
  expect(screen.getByRole("button", { name: "Moody" })).toBeDisabled();
  expect(screen.getByRole("button", { name: "Surprise me" })).toBeDisabled();
  fireEvent.click(screen.getByRole("button", { name: "Moody" }));
  expect(change).not.toHaveBeenCalled();
});
