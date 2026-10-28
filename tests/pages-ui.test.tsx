import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";

vi.hoisted(() => { process.env.NEXT_PUBLIC_APP_MODE = "pages"; });
import Home from "@/app/page";
import { MyVibesLibrary } from "@/components/MyVibesLibrary";
import { BROWSER_VIBES_KEY } from "@/lib/browser-vibes-store";

beforeEach(() => localStorage.clear());
afterEach(() => vi.restoreAllMocks());

test("browser generation saves to My Vibes, filters, reloads, and deletes without HTTP", async () => {
  const fetch = vi.spyOn(globalThis, "fetch");
  const view = render(<Home />);
  expect(screen.getByText(/Progressions use built-in musical rules/)).toBeVisible();
  fireEvent.click(screen.getByRole("button", { name: "Moody" }));
  fireEvent.click(screen.getByRole("button", { name: "Generate progression" }));
  await screen.findByRole("button", { name: "re-vibe" });
  expect(screen.queryByText(/trusted fallback/)).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "re-vibe" }));
  await waitFor(() => expect(screen.getByRole("button", { name: "Save vibe" })).toBeEnabled());
  fireEvent.click(screen.getByRole("button", { name: "Save vibe" }));
  await screen.findByText("Vibe saved to My Vibes.");
  view.unmount();
  const library = render(<MyVibesLibrary />);
  expect(screen.getByText(/Saved in this browser/)).toBeVisible();
  await screen.findByRole("button", { name: "Delete" });
  fireEvent.click(screen.getByRole("button", { name: "Moody" }));
  expect(screen.getByRole("button", { name: "Delete" })).toBeVisible();
  fireEvent.click(screen.getByRole("button", { name: "Clear filters" }));
  library.unmount();
  render(<MyVibesLibrary />);
  await screen.findByRole("button", { name: "Delete" });
  vi.spyOn(window, "confirm").mockReturnValue(true);
  fireEvent.click(screen.getByRole("button", { name: "Delete" }));
  await screen.findByText("Vibe deleted.");
  expect(screen.queryByRole("button", { name: "Delete" })).not.toBeInTheDocument();
  expect(fetch).not.toHaveBeenCalled();
});

test("corrupt browser data is reported and preserved", async () => {
  localStorage.setItem(BROWSER_VIBES_KEY, "damaged");
  render(<MyVibesLibrary />);
  await screen.findByText("Saved vibes could not be loaded. Refresh to try again.");
  expect(localStorage.getItem(BROWSER_VIBES_KEY)).toBe("damaged");
});
