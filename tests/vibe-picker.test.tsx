import { useState } from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import { VibePicker } from "@/components/VibePicker";
import { type VibeSelection } from "@/lib/vibe-selection";

afterEach(() => vi.restoreAllMocks());

function ControlledPicker() {
  const [selection, setSelection] = useState<VibeSelection>({});
  return <VibePicker value={selection} onChange={setSelection} />;
}

function openRefinements() {
  fireEvent.click(screen.getByText("Refine your vibe"));
}

test("Mood is the first visible group and refinements start closed", () => {
  render(<ControlledPicker />);

  const mood = screen.getByRole("group", { name: "Mood" });
  const disclosure = screen.getByText("Refine your vibe").closest("details");
  expect(mood).toBeVisible();
  expect(screen.getAllByRole("group", { hidden: true })[0]).toBe(mood);
  expect(disclosure).not.toHaveAttribute("open");
  expect(screen.getByRole("group", { name: "Genre", hidden: true })).not.toBeVisible();
  expect(screen.getByRole("searchbox", { hidden: true })).not.toBeVisible();
  expect(screen.getByRole("button", { name: "Surprise me" })).toBeVisible();
  expect(screen.queryByRole("status", { name: "Selected vibes" })).not.toBeInTheDocument();

  openRefinements();
  for (const name of ["Genre", "Era", "Setting", "Energy"]) {
    expect(screen.getByRole("group", { name })).toBeVisible();
  }
  expect(screen.getByRole("searchbox", { name: "Search vibes" })).toBeVisible();
});

test("the closed disclosure reports selected refinements and selected values stay removable", () => {
  render(<ControlledPicker />);
  fireEvent.click(screen.getByRole("button", { name: "Moody", pressed: false }));
  expect(screen.getByRole("status", { name: "Selected vibes" })).toBeVisible();
  expect(screen.queryByText("1 selected")).not.toBeInTheDocument();

  openRefinements();
  fireEvent.click(screen.getByRole("button", { name: "R&B", pressed: false }));
  fireEvent.click(screen.getByRole("button", { name: "Gentle", pressed: false }));
  expect(screen.getByText("2 selected")).toBeVisible();
  fireEvent.click(screen.getByText("Refine your vibe"));
  expect(screen.getByRole("button", { name: "Remove R&B" })).toBeVisible();
  fireEvent.click(screen.getByRole("button", { name: "Remove R&B" }));
  expect(screen.getByText("1 selected")).toBeVisible();
  fireEvent.click(screen.getByRole("button", { name: "Remove Gentle" }));
  fireEvent.click(screen.getByRole("button", { name: "Remove Moody" }));
  expect(screen.queryByRole("status", { name: "Selected vibes" })).not.toBeInTheDocument();
});

test("local rain search reveals Rainy night without a remote request", () => {
  const fetch = vi.spyOn(globalThis, "fetch");
  const request = vi.spyOn(XMLHttpRequest.prototype, "open");
  render(<ControlledPicker />);
  openRefinements();

  fireEvent.change(screen.getByRole("searchbox", { name: "Search vibes" }), {
    target: { value: "rain" },
  });

  expect(screen.getByRole("button", { name: "Rainy night", pressed: false })).toBeVisible();
  expect(screen.queryByRole("button", { name: "Moody" })).not.toBeInTheDocument();
  expect(screen.getByRole("group", { name: "Mood" })).toBeVisible();
  expect(screen.getByText("No moods match your search.")).toBeVisible();
  expect(screen.getByRole("group", { name: "Setting" })).toBeVisible();
  expect(screen.queryByRole("group", { name: "Genre" })).not.toBeInTheDocument();
  expect(fetch).not.toHaveBeenCalled();
  expect(request).not.toHaveBeenCalled();
});

test("closing refinements preserves the local search and selected summary", () => {
  render(<ControlledPicker />);
  fireEvent.click(screen.getByRole("button", { name: "Moody", pressed: false }));
  openRefinements();
  fireEvent.change(screen.getByRole("searchbox"), { target: { value: "rain" } });
  fireEvent.click(screen.getByRole("button", { name: "Rainy night", pressed: false }));
  fireEvent.click(screen.getByText("Refine your vibe"));

  expect(screen.getByRole("group", { name: "Mood" })).toBeVisible();
  expect(screen.getByRole("button", { name: "Remove Moody" })).toBeVisible();
  expect(screen.getByRole("button", { name: "Remove Rainy night" })).toBeVisible();
  expect(screen.getByRole("searchbox", { hidden: true })).not.toBeVisible();
  openRefinements();
  expect(screen.getByRole("searchbox")).toHaveValue("rain");
  expect(screen.getByRole("button", { name: "Rainy night", pressed: true })).toBeVisible();
});

test("selected chips stay visible during search and allow facet replacement and removal", () => {
  render(<ControlledPicker />);
  fireEvent.click(screen.getByRole("button", { name: "Moody", pressed: false }));
  openRefinements();
  fireEvent.click(screen.getByRole("button", { name: "R&B", pressed: false }));
  fireEvent.click(screen.getByRole("button", { name: "Dreamy", pressed: false }));

  expect(screen.getByRole("button", { name: "Dreamy", pressed: true })).toBeVisible();
  expect(screen.getByRole("button", { name: "Moody", pressed: false })).toBeVisible();
  expect(screen.queryByRole("button", { name: "Remove Moody" })).not.toBeInTheDocument();
  fireEvent.change(screen.getByRole("searchbox"), { target: { value: "rain" } });
  expect(screen.getByRole("button", { name: "Remove Dreamy" })).toBeVisible();
  expect(screen.getByRole("button", { name: "Remove R&B" })).toBeVisible();
  fireEvent.click(screen.getByRole("button", { name: "Remove Dreamy" }));
  expect(screen.queryByRole("button", { name: "Remove Dreamy" })).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Remove R&B" })).toBeVisible();
});

test("Surprise me replaces the selection with visible editable values across every facet", () => {
  vi.spyOn(Math, "random").mockReturnValue(0);
  render(<ControlledPicker />);
  fireEvent.click(screen.getByRole("button", { name: "Dreamy", pressed: false }));
  openRefinements();
  fireEvent.change(screen.getByRole("searchbox"), { target: { value: "rain" } });
  fireEvent.click(screen.getByRole("button", { name: "Surprise me" }));

  const summary = within(screen.getByRole("status", { name: "Selected vibes" }));
  expect(summary.getAllByRole("button")).toHaveLength(5);
  for (const label of ["Moody", "R&B", "60s", "Rainy night", "Gentle"]) {
    expect(summary.getByRole("button", { name: `Remove ${label}` })).toBeVisible();
  }
  expect(summary.queryByRole("button", { name: "Remove Dreamy" })).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Rainy night", pressed: true })).toBeVisible();
  fireEvent.click(summary.getByRole("button", { name: "Remove Moody" }));
  expect(summary.getAllByRole("button")).toHaveLength(4);
});

test("empty matches give feedback while preserving the selection", () => {
  render(<ControlledPicker />);
  fireEvent.click(screen.getByRole("button", { name: "Moody", pressed: false }));
  openRefinements();
  fireEvent.change(screen.getByRole("searchbox"), { target: { value: "nothing matches" } });
  expect(screen.getByText("No vibes match your search.")).toBeVisible();
  expect(screen.getByRole("button", { name: "Remove Moody" })).toBeVisible();
});

test("disabled controls cannot change the controlled selection", () => {
  const onChange = vi.fn();
  render(<VibePicker value={{}} onChange={onChange} disabled />);
  openRefinements();
  expect(screen.getByRole("searchbox")).toBeDisabled();
  expect(screen.getByRole("button", { name: "Surprise me" })).toBeDisabled();
  expect(screen.getByRole("button", { name: "Moody" })).toBeDisabled();
  expect(screen.getByRole("button", { name: "R&B" })).toBeDisabled();
  fireEvent.click(screen.getByRole("button", { name: "Surprise me" }));
  expect(onChange).not.toHaveBeenCalled();
});

test("the standalone Surprise action can be hidden by an action-owning container", () => {
  render(<VibePicker value={{}} onChange={vi.fn()} showSurpriseAction={false} />);

  expect(screen.queryByRole("button", { name: "Surprise me" })).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Moody" })).toBeVisible();
});
