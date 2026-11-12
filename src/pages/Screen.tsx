import { useEffect, useRef, useState, type ChangeEvent } from "react";
import type { RouteId } from "../app/routes";
import { useDeviceContext } from "../hid/device-context";
import { SCREEN_HEIGHT, SCREEN_WIDTH } from "../protocol/screen";
import { useScreenUpload } from "../screen/useScreenUpload";

type ScreenPageProps = {
  onNavigate: (route: RouteId) => void;
};

export default function ScreenPage({ onNavigate }: ScreenPageProps) {
  const { state: connectionState } = useDeviceContext();
  const session =
    connectionState.status === "connected" ? connectionState.session : undefined;
  const isDemo = connectionState.source === "demo";
  const {
    state,
    maxFrames,
    loadFile,
    setDelayMs,
    setSlot,
    send,
    cancel,
    reset,
  } = useScreenUpload();
  const [confirming, setConfirming] = useState(false);
  const [frameIndex, setFrameIndex] = useState(0);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const animation =
    state.status === "ready" || state.status === "sending"
      ? state.animation
      : undefined;
  const delayMs =
    state.status === "ready" || state.status === "sending" ? state.delayMs : 50;
  const slot =
    state.status === "ready" || state.status === "sending" ? state.slot : 4;
  const sending = state.status === "sending";
  const canSend =
    Boolean(session?.writesAllowed) &&
    !isDemo &&
    state.status === "ready" &&
    Boolean(animation);

  useEffect(() => {
    setFrameIndex(0);
  }, [animation]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !animation || animation.frames.length === 0) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const frame = animation.frames[Math.min(frameIndex, animation.frames.length - 1)];
    const image = ctx.createImageData(SCREEN_WIDTH, SCREEN_HEIGHT);
    image.data.set(frame);
    ctx.putImageData(image, 0, 0);
  }, [animation, frameIndex]);

  const chooseFile = () => {
    setConfirming(false);
    fileInputRef.current?.click();
  };

  const handleFile = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    setConfirming(false);
    if (file) void loadFile(file);
  };

  const confirmSend = () => {
    if (!session || !canSend) return;
    setConfirming(false);
    void send(session);
  };

  return (
    <section className="page screen-page" aria-labelledby="screen-title">
      <header className="page-header">
        <p className="eyebrow">Fase 2 · tela</p>
        <h2 id="screen-title">Screen</h2>
        <p className="lede">
          Envie uma imagem ou um GIF para a tela TFT 240x135 do K86. O preview
          e a decodificação acontecem no navegador; nada sai daqui.
        </p>
      </header>

      {!session ? (
        <div className="screen-connect-card">
          <span className="phase-tag">Desconectado</span>
          <h3>Conecte o teclado para enviar</h3>
          <p>
            O envio grava na tela do teclado. Conecte o K86 por cabo USB no
            Dashboard e volte para esta página.
          </p>
          <button
            type="button"
            className="button button-primary"
            onClick={() => onNavigate("dashboard")}
          >
            Ir para o Dashboard
          </button>
        </div>
      ) : null}

      {session && !session.writesAllowed ? (
        <div className="screen-readonly-card" role="note">
          <span className="phase-tag">Somente leitura</span>
          <h3>Envio de tela ainda não validado para esta revisão</h3>
          <p>
            O modelo foi reconhecido, mas a gravação na tela está desabilitada
            para esta família até a validação em hardware. O preview continua
            disponível.
          </p>
        </div>
      ) : null}

      {isDemo ? (
        <div className="screen-demo-card" role="note">
          <span className="demo-badge">Demo</span>
          <p>
            No modo demo o preview e a timeline funcionam, mas o envio fica
            desativado. Conecte o K86 real para gravar na tela.
          </p>
        </div>
      ) : null}

      <div className="screen-grid">
        <section className="screen-panel" aria-labelledby="screen-preview-title">
          <div className="screen-panel-head">
            <div>
              <p className="eyebrow">Preview</p>
              <h3 id="screen-preview-title">Tela do teclado</h3>
            </div>
            <span className="screen-size-label">240 × 135 · RGB565</span>
          </div>

          <div className="screen-preview-frame">
            <canvas
              ref={canvasRef}
              width={SCREEN_WIDTH}
              height={SCREEN_HEIGHT}
              className="screen-canvas"
              aria-label="Preview da tela do teclado"
            />
            {!animation ? (
              <p className="screen-preview-empty">
                Escolha uma imagem ou GIF para começar.
              </p>
            ) : null}
          </div>

          {animation ? (
            <div className="screen-frame-strip">
              <p className="screen-frame-meta">
                {animation.frames.length} frame
                {animation.frames.length === 1 ? "" : "s"} · limite {maxFrames}
              </p>
              <div className="screen-timeline" role="list" aria-label="Frames">
                {animation.frames.map((_, index) => (
                  <button
                    key={index}
                    type="button"
                    className={
                      index === frameIndex
                        ? "screen-frame-button is-current"
                        : "screen-frame-button"
                    }
                    aria-current={index === frameIndex ? "true" : undefined}
                    onClick={() => setFrameIndex(index)}
                  >
                    {index + 1}
                  </button>
                ))}
              </div>
            </div>
          ) : null}
        </section>

        <section className="screen-controls" aria-labelledby="screen-controls-title">
          <h3 id="screen-controls-title">Enviar para a tela</h3>

          <div className="screen-file-field">
            <span>Arquivo</span>
            <input
              ref={fileInputRef}
              className="screen-file-input"
              type="file"
              accept="image/png,image/gif,image/webp,image/jpeg"
              onChange={handleFile}
              aria-label="Escolher arquivo de imagem ou GIF"
            />
            <button type="button" className="button" onClick={chooseFile}>
              Escolher imagem ou GIF
            </button>
          </div>

          <div className="screen-field-row">
            <label>
              <span>Delay (ms)</span>
              <input
                type="number"
                min={0}
                max={255}
                value={delayMs}
                disabled={!animation || sending}
                onChange={(event) => setDelayMs(Number(event.target.value))}
              />
            </label>
            <label>
              <span>Slot</span>
              <select
                value={slot}
                disabled={!animation || sending}
                onChange={(event) => setSlot(Number(event.target.value))}
              >
                {[0, 1, 2, 3, 4].map((value) => (
                  <option key={value} value={value}>
                    Slot {value + 1}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {state.status === "decoding" ? (
            <p className="screen-status" role="status">
              Lendo {state.fileName}...
            </p>
          ) : null}

          {state.status === "error" ? (
            <div className="screen-error" role="alert">
              <p>{state.message}</p>
              <button type="button" className="button" onClick={reset}>
                Tentar outro arquivo
              </button>
            </div>
          ) : null}

          {state.status === "done" ? (
            <div className="screen-success" role="status">
              <p>
                Enviado para o slot {state.slot + 1} ({state.frameCount} frame
                {state.frameCount === 1 ? "" : "s"}).
              </p>
              <p>O conteúdo anterior do slot pode ter sido substituído.</p>
              <button type="button" className="button" onClick={reset}>
                Enviar outra imagem
              </button>
            </div>
          ) : null}

          {sending ? (
            <div className="screen-progress" role="status">
              <p>
                Enviando frame {state.done} de {state.total}...
              </p>
              <progress value={state.done} max={state.total} />
              <button type="button" className="button" onClick={cancel}>
                Cancelar envio
              </button>
            </div>
          ) : null}

          {confirming ? (
            <div className="screen-confirm" role="alertdialog" aria-labelledby="screen-confirm-title">
              <h4 id="screen-confirm-title">Confirmar envio para o slot {slot + 1}?</h4>
              <p>
                Isso grava na flash da tela e pode substituir o conteúdo atual
                do slot. Use cabo USB.
              </p>
              <div className="screen-confirm-actions">
                <button type="button" className="button button-primary" onClick={confirmSend}>
                  Confirmar envio
                </button>
                <button type="button" className="button" onClick={() => setConfirming(false)}>
                  Cancelar
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              className="button button-primary screen-send-button"
              disabled={!canSend}
              onClick={() => setConfirming(true)}
            >
              Enviar para a tela
            </button>
          )}

          <p className="screen-safety">
            Gravação na flash da tela. O conteúdo anterior do slot pode ser
            substituído. Não há erase de flash nesta tela. O envio exige cabo
            USB.
          </p>
        </section>
      </div>
    </section>
  );
}
