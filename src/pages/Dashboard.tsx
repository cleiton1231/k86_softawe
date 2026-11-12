import { routes } from "../app/routes";

const features = routes.filter((route) => route.id !== "dashboard");

export default function Dashboard() {
  return (
    <section className="page dashboard-page" aria-labelledby="dashboard-title">
      <header className="page-header">
        <p className="eyebrow">Central de controle</p>
        <h2 id="dashboard-title">Dashboard</h2>
        <p className="lede">
          Status do dispositivo e atalhos para cada área do K86 Studio. A
          conexão USB entra na próxima fase; por enquanto, esta é uma prévia da
          central de controle.
        </p>
      </header>

      <div className="dashboard-layout">
        <section
          className="connection-card"
          aria-labelledby="connection-title"
        >
          <div className="card-top">
            <span className="status-pill">
              <span className="status-dot" aria-hidden="true" />
              Desconectado
            </span>
            <span className="phase-tag">Próxima fase</span>
          </div>

          <h3 id="connection-title">Conectar teclado</h3>
          <p className="card-copy">
            O K86 Studio vai abrir o dispositivo por WebHID e identificar o
            modelo em modo somente leitura. Nenhum dado sai deste navegador.
          </p>

          <div className="button-row">
            <button
              className="button button-primary"
              type="button"
              disabled
              aria-describedby="connection-phase"
            >
              Conectar teclado
            </button>
            <button
              className="button button-secondary"
              type="button"
              disabled
              aria-describedby="connection-phase"
            >
              Modo demo
            </button>
          </div>

          <p id="connection-phase" className="field-note">
            A conexão será habilitada na próxima fase, depois da validação do
            protocolo e da identificação em hardware real. Gravações continuam
            desativadas nesta fundação.
          </p>
        </section>

        <section className="target-card" aria-labelledby="target-title">
          <h3 id="target-title">Alvo desta versão</h3>
          <p className="card-copy">
            Perfil previsto para a fundação, reconhecido apenas para leitura.
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

          <p className="read-only-badge">Somente leitura nesta fase</p>
        </section>
      </div>

      <section className="features" aria-labelledby="features-title">
        <div className="section-heading">
          <h3 id="features-title">Recursos planejados</h3>
          <p>Cada área ganha função em uma fase posterior.</p>
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
              <span className="feature-status">Planejado</span>
            </li>
          ))}
        </ul>
      </section>
    </section>
  );
}
