import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { FakeTransport } from "../hid/fake";
import { DeviceProvider } from "../hid/device-context";
import Dashboard from "./Dashboard";

const webhid = vi.hoisted(() => ({
  supported: false,
  requestK86Device: vi.fn(),
  openWebHidTransport: vi.fn(),
}));

vi.mock("../hid/webhid", () => ({
  isWebHidSupported: () => webhid.supported,
  requestK86Device: webhid.requestK86Device,
  openWebHidTransport: webhid.openWebHidTransport,
}));

beforeEach(() => {
  webhid.supported = false;
  webhid.requestK86Device.mockReset();
  webhid.openWebHidTransport.mockReset();
});

function renderDashboard() {
  return render(
    <DeviceProvider>
      <Dashboard />
    </DeviceProvider>,
  );
}

describe("Dashboard", () => {
  it("starts disconnected with connection actions and reference data", () => {
    renderDashboard();

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
    expect(screen.getByText("Pronto para conectar")).toBeInTheDocument();
    expect(screen.queryByText("Demo")).not.toBeInTheDocument();
    expect(
      screen.getByText(/webhid não está disponível neste navegador/i),
    ).toBeInTheDocument();
  });

  it("labels a demo session as demo and disconnects", async () => {
    renderDashboard();

    fireEvent.click(screen.getByRole("button", { name: "Modo demo" }));

    expect(
      await screen.findByText("Attack Shark K86 (1168)"),
    ).toBeInTheDocument();
    expect(screen.getByText("Dispositivo conectado")).toBeInTheDocument();
    expect(screen.getByText("Demo")).toBeInTheDocument();
    expect(screen.getByText("Conectado (demo)")).toBeInTheDocument();
    expect(screen.queryByText("Conectado")).not.toBeInTheDocument();
    expect(
      screen.getByText(/nenhum hardware real está conectado/i),
    ).toBeInTheDocument();
    expect(screen.getByText("1168")).toBeInTheDocument();
    expect(screen.getByText("yc500")).toBeInTheDocument();
    expect(screen.getByText("ANSI, sem cedilha")).toBeInTheDocument();
    expect(
      screen.getByText("Demonstração: envio desativado"),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Desconectar" }));

    expect(
      await screen.findByRole("button", { name: "Conectar teclado" }),
    ).toBeEnabled();
    expect(screen.getByText("Alvo desta versão")).toBeInTheDocument();
    expect(screen.queryByText("Demo")).not.toBeInTheDocument();
    expect(screen.queryByText("Attack Shark K86 (1168)")).not.toBeInTheDocument();
  });

  it("shows a real WebHID connection without demo labelling", async () => {
    webhid.supported = true;
    webhid.requestK86Device.mockResolvedValue({});
    webhid.openWebHidTransport.mockResolvedValue(
      FakeTransport.withIdentify(1168, 0x4015),
    );

    renderDashboard();

    fireEvent.click(screen.getByRole("button", { name: "Conectar teclado" }));

    expect(await screen.findByText("Teclado conectado")).toBeInTheDocument();
    expect(screen.getByText("Conectado")).toBeInTheDocument();
    expect(screen.queryByText("Conectado (demo)")).not.toBeInTheDocument();
    expect(screen.queryByText("Demo")).not.toBeInTheDocument();
    expect(screen.getByText("Attack Shark K86 (1168)")).toBeInTheDocument();
  });

  it("uses conservative wording for an unknown read-only device", async () => {
    webhid.supported = true;
    webhid.requestK86Device.mockResolvedValue({});
    webhid.openWebHidTransport.mockResolvedValue(
      FakeTransport.withIdentify(9999, 0x4015),
    );

    renderDashboard();

    fireEvent.click(screen.getByRole("button", { name: "Conectar teclado" }));

    expect(
      await screen.findByText("Modelo não reconhecido"),
    ).toBeInTheDocument();
    expect(screen.getByText("9999")).toBeInTheDocument();
    expect(
      screen.getByText("yc500 (padrão conservador)"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("ANSI, sem cedilha (padrão conservador)"),
    ).toBeInTheDocument();
    expect(screen.queryByText(/identificado com sucesso/i)).not.toBeInTheDocument();
    expect(screen.queryByText("Demo")).not.toBeInTheDocument();
  });

  it("shows a recognized gen2 model without enabling writes", async () => {
    webhid.supported = true;
    webhid.requestK86Device.mockResolvedValue({});
    webhid.openWebHidTransport.mockResolvedValue(
      FakeTransport.withIdentify(2730, 0x5002),
    );

    renderDashboard();

    fireEvent.click(screen.getByRole("button", { name: "Conectar teclado" }));

    expect(
      await screen.findByText("Attack Shark K86 (2730)"),
    ).toBeInTheDocument();
    expect(screen.getByText("Dispositivo conectado")).toBeInTheDocument();
    expect(screen.queryByText("Modelo não reconhecido")).not.toBeInTheDocument();
    expect(screen.getByText("gen2")).toBeInTheDocument();
    expect(
      screen.getByText("Somente leitura: gravação não validada"),
    ).toBeInTheDocument();
  });

  it("mentions the browser chooser only while a real selection is pending", async () => {
    webhid.supported = true;
    webhid.requestK86Device.mockReturnValue(new Promise(() => {}));

    renderDashboard();

    fireEvent.click(screen.getByRole("button", { name: "Conectar teclado" }));

    expect(
      await screen.findByText(/aguardando a seleção do dispositivo no navegador/i),
    ).toBeInTheDocument();
  });

  it("reports WebHID unavailability and still offers demo mode", async () => {
    renderDashboard();

    fireEvent.click(screen.getByRole("button", { name: "Conectar teclado" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/webhid/i);
    expect(screen.getByRole("button", { name: "Modo demo" })).toBeEnabled();
    expect(screen.queryByText("Demo")).not.toBeInTheDocument();
  });
});
