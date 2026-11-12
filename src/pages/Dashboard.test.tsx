import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import Dashboard from "./Dashboard";

describe("Dashboard", () => {
  it("starts disconnected with connection actions and reference data", () => {
    render(<Dashboard />);

    expect(
      screen.getByRole("button", { name: "Conectar teclado" }),
    ).toBeEnabled();
    expect(screen.getByRole("button", { name: "Modo demo" })).toBeEnabled();
    expect(screen.getByText("Alvo desta versão")).toBeInTheDocument();
    expect(
      screen.getByText(/nenhum dispositivo está conectado/i),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Desconectar" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByText("Somente leitura nesta fase"),
    ).toBeInTheDocument();
  });

  it("shows identified device data in demo mode and disconnects", async () => {
    render(<Dashboard />);

    fireEvent.click(screen.getByRole("button", { name: "Modo demo" }));

    expect(
      await screen.findByText("Attack Shark K86 (1168)"),
    ).toBeInTheDocument();
    expect(screen.getByText("Dispositivo conectado")).toBeInTheDocument();
    expect(screen.getByText("1168")).toBeInTheDocument();
    expect(screen.getByText("yc500")).toBeInTheDocument();
    expect(screen.getByText("ANSI, sem cedilha")).toBeInTheDocument();
    expect(screen.getByText("Somente leitura nesta fase")).toBeInTheDocument();
    expect(screen.getByText("Conectado")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Desconectar" }));

    expect(
      await screen.findByRole("button", { name: "Conectar teclado" }),
    ).toBeEnabled();
    expect(screen.getByText("Alvo desta versão")).toBeInTheDocument();
    expect(screen.queryByText("Attack Shark K86 (1168)")).not.toBeInTheDocument();
  });

  it("reports WebHID unavailability and still offers demo mode", async () => {
    render(<Dashboard />);

    fireEvent.click(screen.getByRole("button", { name: "Conectar teclado" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/webhid/i);
    expect(screen.getByRole("button", { name: "Modo demo" })).toBeEnabled();
  });
});
