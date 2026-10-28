import { useLayoutEffect } from "react";
import { render, screen } from "@testing-library/react";
import { expect, test } from "vitest";
import { Tabs } from "@/components/Tabs";

function FocusPosition({ active }: { active: boolean }) {
  useLayoutEffect(() => {
    if (active) screen.getByRole("button", { name: "Chord position" }).focus();
  }, [active]);
  return null;
}

function Workspace({ value }: { value: "choose" | "play" }) {
  return <>
    <Tabs label="Workspace" items={[{ id: "choose", label: "Choose vibe" }, { id: "play", label: "Play" }]}
      value={value} onChange={() => undefined}>
      <button type="button" hidden={value !== "play"}>Chord position</button>
    </Tabs>
    <FocusPosition active={value === "play"} />
  </>;
}

test("changing tabs does not reclaim focus after the newly visible content receives it", () => {
  const view = render(<Workspace value="choose" />);
  view.rerender(<Workspace value="play" />);
  expect(screen.getByRole("tab", { name: "Play" })).toHaveAttribute("aria-selected", "true");
  expect(screen.getByRole("button", { name: "Chord position" })).toHaveFocus();
});


test("changing tabs still focuses the selected tab when content has not received focus", () => {
  const workspace = (value: "choose" | "play") => <Tabs label="Workspace"
    items={[{ id: "choose", label: "Choose vibe" }, { id: "play", label: "Play" }]}
    value={value} onChange={() => undefined}><button type="button">Chord position</button></Tabs>;
  const view = render(workspace("choose"));
  screen.getByRole("tab", { name: "Choose vibe" }).focus();
  view.rerender(workspace("play"));
  expect(screen.getByRole("tab", { name: "Play" })).toHaveFocus();
});
