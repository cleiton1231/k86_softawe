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
    expect(screen.getByRole("main")).toHaveFocus();
    expect(keysLink).toHaveAttribute("aria-current", "page");
    expect(
      screen.getByRole("link", { name: /dashboard/i }),
    ).not.toHaveAttribute("aria-current");

    fireEvent.click(screen.getByRole("link", { name: /about/i }));

    expect(
      screen.getByRole("heading", { level: 2, name: /about/i }),
    ).toBeInTheDocument();
  });

  it("keeps a demo connection while navigating away and back", async () => {
    render(<App />);

    fireEvent.click(screen.getByRole("button", { name: "Modo demo" }));

    expect(await screen.findByText("Conectado (demo)")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("link", { name: /keys/i }));

    expect(
      screen.getByRole("heading", { level: 2, name: "Keys" }),
    ).toBeInTheDocument();
    expect(screen.queryByText("Conectado (demo)")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("link", { name: /dashboard/i }));

    expect(await screen.findByText("Conectado (demo)")).toBeInTheDocument();
    expect(screen.getByText("Attack Shark K86 (1168)")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Desconectar" }),
    ).toBeInTheDocument();
  });
});
