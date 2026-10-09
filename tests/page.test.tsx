import { fireEvent, render, screen, within } from "@testing-library/react";
import { expect, test } from "vitest";
import Home from "@/app/page";

test("the landing page introduces Vibe Chords in the main landmark", () => {
  render(<Home />);

  expect(screen.getByRole("main")).toContainElement(
    screen.getByRole("heading", { level: 1, name: "Vibe Chords" }),
  );
  expect(screen.getByRole("group", { name: "Mood" })).toBeVisible();
  expect(screen.getByText("Refine your vibe").closest("details")).not.toHaveAttribute("open");
  expect(screen.getByRole("button", { name: "Generate progression" })).toBeDisabled();
  expect(screen.getByRole("button", { name: "Surprise me" })).toBeVisible();
  const buttons = screen.getAllByRole("button");
  expect(buttons.indexOf(screen.getByRole("button", { name: "Generate progression" }))).toBeLessThan(
    buttons.indexOf(screen.getByRole("button", { name: "Surprise me" })),
  );
});

test("a mood enables Generate and removing the last selection disables it", () => {
  render(<Home />);
  const generate = screen.getByRole("button", { name: "Generate progression" });

  fireEvent.click(screen.getByRole("button", { name: "Moody", pressed: false }));
  expect(generate).toBeEnabled();
  expect(screen.getByRole("button", { name: "Moody", pressed: true })).toBeVisible();
  expect(screen.getByRole("status", { name: "Selected vibes" })).toBeVisible();

  fireEvent.click(screen.getByRole("button", { name: "Remove Moody" }));
  expect(generate).toBeDisabled();
  expect(screen.queryByRole("status", { name: "Selected vibes" })).not.toBeInTheDocument();
});

test("toggling a mood off restores the disabled Generate state", () => {
  render(<Home />);

  fireEvent.click(screen.getByRole("button", { name: "Moody", pressed: false }));
  fireEvent.click(screen.getByRole("button", { name: "Moody", pressed: true }));

  expect(screen.getByRole("button", { name: "Generate progression" })).toBeDisabled();
});

test("a refinement alone enables Generate and persists when refinements close", () => {
  render(<Home />);
  fireEvent.click(screen.getByText("Refine your vibe"));
  fireEvent.click(screen.getByRole("button", { name: "R&B", pressed: false }));
  fireEvent.click(screen.getByText("Refine your vibe"));

  expect(screen.getByRole("button", { name: "Generate progression" })).toBeEnabled();
  expect(screen.getByRole("button", { name: "Remove R&B" })).toBeVisible();
});

test("Surprise me updates home selection and enables Generate", () => {
  render(<Home />);
  fireEvent.click(screen.getByRole("button", { name: "Surprise me" }));

  expect(screen.getByRole("button", { name: "Generate progression" })).toBeEnabled();
  expect(within(screen.getByRole("status", { name: "Selected vibes" })).getAllByRole("button")).toHaveLength(5);
});
