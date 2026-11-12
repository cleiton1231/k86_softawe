import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ScreenPage from "./Screen";

const { mockUseDeviceContext, mockDecode } = vi.hoisted(() => ({
  mockUseDeviceContext: vi.fn(),
  mockDecode: vi.fn(),
}));

vi.mock("../hid/device-context", () => ({
  useDeviceContext: mockUseDeviceContext,
}));

vi.mock("../screen/decode", () => ({
  decodeScreenFile: mockDecode,
}));

const fakeAnimation = {
  width: 240,
  height: 135,
  delayMs: 80,
  frames: [new Uint8ClampedArray(240 * 135 * 4)],
};

const writeSession = {
  writesAllowed: true,
  recognized: true,
  definition: { screen: { slots: 5 } },
  sendScreenAnimation: vi.fn().mockResolvedValue(undefined),
};

function context(state: unknown, source?: "webhid" | "demo") {
  const stateWithSource = source
    ? { ...(state as Record<string, unknown>), source }
    : state;
  return {
    state: stateWithSource,
    connect: vi.fn(),
    connectDemo: vi.fn(),
    disconnect: vi.fn(),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockDecode.mockResolvedValue(fakeAnimation);
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("ScreenPage", () => {
  it("asks the user to connect when there is no session", () => {
    const onNavigate = vi.fn();
    mockUseDeviceContext.mockReturnValue(context({ status: "disconnected" }));
    render(<ScreenPage onNavigate={onNavigate} />);

    expect(screen.getByText(/Conecte o teclado para enviar/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Ir para o Dashboard/i }));
    expect(onNavigate).toHaveBeenCalledWith("dashboard");
  });

  it("loads a GIF, previews frame count and sends after confirmation", async () => {
    mockUseDeviceContext.mockReturnValue(
      context({ status: "connected", session: writeSession }, "webhid"),
    );
    render(<ScreenPage onNavigate={vi.fn()} />);

    const input = screen.getByLabelText("Escolher arquivo de imagem ou GIF");
    fireEvent.change(input, {
      target: {
        files: [new File([new Uint8Array([1, 2, 3])], "anim.gif", { type: "image/gif" })],
      },
    });

    expect(await screen.findByText(/1 frame/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Enviar para a tela" }));
    expect(screen.getByText(/Confirmar envio para o slot 5/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Confirmar envio" }));

    await waitFor(() => expect(writeSession.sendScreenAnimation).toHaveBeenCalled());
    const [animation, options] = writeSession.sendScreenAnimation.mock.calls[0];
    expect(animation.frames).toHaveLength(1);
    expect(options.slot).toBe(4);
    expect(options.signal).toBeInstanceOf(AbortSignal);
    expect(await screen.findByText(/Enviado para o slot 5/i)).toBeInTheDocument();
  });

  it("shows a decoding error", async () => {
    mockDecode.mockRejectedValue(new Error("GIF inválido"));
    mockUseDeviceContext.mockReturnValue(
      context({ status: "connected", session: writeSession }, "webhid"),
    );
    render(<ScreenPage onNavigate={vi.fn()} />);

    fireEvent.change(screen.getByLabelText("Escolher arquivo de imagem ou GIF"), {
      target: {
        files: [new File([new Uint8Array([1])], "broken.gif", { type: "image/gif" })],
      },
    });

    expect(await screen.findByText("GIF inválido")).toBeInTheDocument();
  });

  it("disables sending in demo mode even with a connected fake session", async () => {
    mockUseDeviceContext.mockReturnValue(
      context({ status: "connected", session: writeSession }, "demo"),
    );
    render(<ScreenPage onNavigate={vi.fn()} />);

    fireEvent.change(screen.getByLabelText("Escolher arquivo de imagem ou GIF"), {
      target: {
        files: [new File([new Uint8Array([1])], "anim.gif", { type: "image/gif" })],
      },
    });
    await screen.findByText(/1 frame/i);

    expect(screen.getByText(/modo demo/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Enviar para a tela" })).toBeDisabled();
  });

  it("disables sending for a read-only session", async () => {
    const readOnly = { ...writeSession, writesAllowed: false };
    mockUseDeviceContext.mockReturnValue(
      context({ status: "connected", session: readOnly }, "webhid"),
    );
    render(<ScreenPage onNavigate={vi.fn()} />);

    fireEvent.change(screen.getByLabelText("Escolher arquivo de imagem ou GIF"), {
      target: {
        files: [new File([new Uint8Array([1])], "anim.gif", { type: "image/gif" })],
      },
    });
    await screen.findByText(/1 frame/i);

    expect(screen.getByText(/somente leitura/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Enviar para a tela" })).toBeDisabled();
  });
});
