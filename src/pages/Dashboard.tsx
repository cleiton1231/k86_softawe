import { routes } from "../app/routes";
import type { PhysicalLayout } from "../devices/types";
import { useDeviceContext } from "../hid/device-context";
import { hasNativeHid } from "../hid/native";
import { isWebHidSupported } from "../hid/webhid";

const features = routes.filter((route) => route.id !== "dashboard");

const layoutLabels: Record<PhysicalLayout, string> = {
  ansi: "ANSI, sem cedilha",
  iso: "ISO",
  abnt2: "ABNT2",
};

const statusLabels = {
  disconnected: "Desconectado",
  connecting: "Conectando",
  connected: "Conectado",
  error: "Erro de conexão",
} as const;

export default function Dashboard() {
  const { state, connect, connectDemo, disconnect } = useDeviceContext();
  const session = state.status === "connected" ? state.session : undefined;
  const busy = state.status === "connecting";
  const isDemo = state.source === "demo";
  const native = hasNativeHid();
  const webHidSupported = isWebHidSupported();
  const statusText =
    state.status === "connected" && isDemo
      ? "Conectado (demo)"
      : statusLabels[state.status];

  return (
    <section className="page dashboard-page" aria-labelledby="dashboard-title">
      <header className="page-header">
        <p className="eyebrow">Central de controle</p>
        <h2 id="dashboard-title">Dashboard</h2>
        <p className="lede">
          Conecte o K86 para identificar o modelo e configurar a tela. A conexão
          é local: nenhum dado sai deste aplicativo.
        </p>
      </header>

      <div className="dashboard-layout">
        <section
          className="connection-card"
          aria-labelledby="connection-title"
          aria-busy={busy}
        >
          <div className="card-top">
            <span
              className="status-pill"
              role="status"
              aria-live="polite"
              data-status={state.status}
            >
              <span className="status-dot" aria-hidden="true" />
              {statusText}
            </span>
            <div className="card-tags">
              {isDemo && <span className="demo-badge">Demo</span>}
              <span className="phase-tag">
                {isDemo
                  ? "Demonstração"
                  : session
                    ? session.writesAllowed
                      ? "Tela habilitada"
                      : "Somente leitura"
                    : native
                      ? "App desktop"
                      : "Navegador"}
              </span>
            </div>
          </div>

          <h3 id="connection-title">
            {session
              ? "Teclado conectado"
              : busy
                ? "Conectando teclado"
                : "Conectar teclado"}
          </h3>

          {!native && !webHidSupported && !session ? (
            <p className="webhid-notice" role="note">
              WebHID não está disponível neste navegador. Use Chrome ou Edge
              atualizado para conectar o teclado real; o modo demo funciona
              sem WebHID e sem hardware.
            </p>
          ) : null}

          {state.status === "error" && state.error ? (
            <p className="card-copy" role="alert">
              {state.error}
            </p>
          ) : session ? (
            <p className="card-copy">
              {!session.recognized
                ? "O ID interno deste dispositivo não corresponde a um modelo conhecido. A sessão usa uma definição conservadora e permanece somente leitura."
                : isDemo
                  ? "Sessão de demonstração com um dispositivo virtual. Nenhum hardware real está conectado."
                  : session.writesAllowed
                    ? `${session.definition.name} identificado com sucesso. A sessão permanece ativa até você desconectar ou o dispositivo ser removido.`
                    : `${session.definition.name} identificado com sucesso. A gravação permanece desabilitada: esta revisão ainda não foi validada em hardware.`}
            </p>
          ) : busy ? (
            <p className="card-copy">
              {state.source === "native"
                ? "Abrindo o K86 pelo bridge nativo. Mantenha o teclado conectado por USB."
                : state.source === "webhid"
                  ? "Aguardando a seleção do dispositivo no navegador. Mantenha o teclado conectado por USB."
                  : "Conectando ao teclado..."}
            </p>
          ) : (
            <p className="card-copy">
              {native
                ? "Conecte o K86 por USB. O app desktop acessa o teclado diretamente pelo bridge nativo, sem WebHID."
                : "Abra o K86 pelo WebHID para identificar o modelo. Use Chrome ou Edge atualizado e mantenha o teclado conectado por USB."}
            </p>
          )}

          {session ? (
            <div className="button-row">
              <button
                className="button button-secondary"
                type="button"
                onClick={() => void disconnect()}
              >
                Desconectar
              </button>
            </div>
          ) : (
            <div className="button-row">
              <button
                className="button button-primary"
                type="button"
                disabled={busy}
                onClick={() => void connect()}
              >
                Conectar teclado
              </button>
              <button
                className="button button-secondary"
                type="button"
                disabled={busy}
                onClick={() => void connectDemo()}
              >
                Modo demo
              </button>
            </div>
          )}

          <p className="field-note">
            A gravação de tela está habilitada para o K86 de ID 1168, validada
            em hardware. As demais gravações seguem em desenvolvimento. O modo
            demo usa um dispositivo virtual com ID 1168.
          </p>
        </section>

        <section className="target-card" aria-labelledby="target-title">
          {session ? (
            <>
              <h3 id="target-title">
                {!session.recognized
                  ? "Modelo não reconhecido"
                  : "Dispositivo conectado"}
              </h3>
              <p className="card-copy">
                {!session.recognized
                  ? "O modelo não foi reconhecido. Família e layout abaixo são um padrão conservador, não informações confirmadas."
                  : isDemo
                    ? "Sessão de demonstração com dados virtuais. Nenhum dado é enviado para fora deste aplicativo."
                    : "Identificado localmente. Nenhum dado é enviado para fora deste aplicativo."}
              </p>

              <dl className="device-facts">
                {!session.recognized ? (
                  <>
                    <div className="fact">
                      <dt>Nome provisório</dt>
                      <dd>{session.definition.name}</dd>
                    </div>
                    <div className="fact">
                      <dt>ID interno</dt>
                      <dd>{session.definition.id}</dd>
                    </div>
                    <div className="fact">
                      <dt>Família</dt>
                      <dd>{session.definition.family} (padrão conservador)</dd>
                    </div>
                    <div className="fact">
                      <dt>Layout</dt>
                      <dd>
                        {layoutLabels[session.definition.layout]} (padrão
                        conservador)
                      </dd>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="fact">
                      <dt>Nome</dt>
                      <dd>{session.definition.name}</dd>
                    </div>
                    <div className="fact">
                      <dt>ID interno</dt>
                      <dd>{session.definition.id}</dd>
                    </div>
                    <div className="fact">
                      <dt>Família</dt>
                      <dd>{session.definition.family}</dd>
                    </div>
                    <div className="fact">
                      <dt>Layout</dt>
                      <dd>{layoutLabels[session.definition.layout]}</dd>
                    </div>
                  </>
                )}
              </dl>

              <p className="read-only-badge">
                {isDemo
                  ? "Demonstração: envio desativado"
                  : session.writesAllowed
                    ? "Gravação de tela habilitada"
                    : "Somente leitura: gravação não validada"}
              </p>
            </>
          ) : (
            <>
              <h3 id="target-title">Alvo desta versão</h3>
              <p className="card-copy">
                Valores de referência desta fundação. Nenhum dispositivo está
                conectado no momento.
              </p>

              <dl className="device-facts">
                <div className="fact">
                  <dt>VID:PID</dt>
                  <dd>3151:4015</dd>
                </div>
                <div className="fact">
                  <dt>Revisão</dt>
                  <dd>1168</dd>
                </div>
                <div className="fact">
                  <dt>Família</dt>
                  <dd>yc500</dd>
                </div>
                <div className="fact">
                  <dt>Layout</dt>
                  <dd>ANSI, sem cedilha</dd>
                </div>
              </dl>

              <p className="read-only-badge">Pronto para conectar</p>
            </>
          )}
        </section>
      </div>

      <section className="features" aria-labelledby="features-title">
        <div className="section-heading">
          <h3 id="features-title">Recursos</h3>
          <p>Screen está disponível; as demais áreas chegam nas próximas fases.</p>
        </div>

        <ul className="feature-grid">
          {features.map((feature) => (
            <li className="feature-card" key={feature.id}>
              <span className="feature-index" aria-hidden="true">
                {String(
                  routes.findIndex((route) => route.id === feature.id) + 1,
                ).padStart(2, "0")}
              </span>
              <h4>{feature.label}</h4>
              <p>{feature.description}</p>
              <span className="feature-status">
                {feature.id === "screen" ? "Disponível" : "Planejado"}
              </span>
            </li>
          ))}
        </ul>
      </section>
    </section>
  );
}
