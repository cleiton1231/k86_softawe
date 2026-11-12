import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import App from "./App";

describe("App", () => {
  it("renders the K86 Studio shell and navigation", () => {
    render(<App />);

    expect(screen.getByText("K86 Studio")).toBeInTheDocument();

    for (const route of [
      "dashboard",
      "keys",
      "lighting",
      "screen",
      "macros",
      "settings",
      "about",
    ]) {
      expect(
        screen.getByRole("link", { name: new RegExp(route, "i") }),
      ).toBeInTheDocument();
    }
  });

  it("switches pages and marks the active route", () => {
    render(<App />);

    const keysLink = screen.getByRole("link", { name: /keys/i });
    fireEvent.click(keysLink);

    expect(
      screen.getByRole("heading", { level: 2, name: "Keys" }),
    ).toBeInTheDocument();
    expect(keysLink).toHaveAttribute("aria-current", "page");
    expect(
      screen.getByRole("link", { name: /dashboard/i }),
    ).not.toHaveAttribute("aria-current");

    fireEvent.click(screen.getByRole("link", { name: /about/i }));

    expect(
      screen.getByRole("heading", { level: 2, name: /about/i }),
    ).toBeInTheDocument();
  });
});
