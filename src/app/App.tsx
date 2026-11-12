export default function App() {
  return (
    <div className="app">
      <header className="app-header">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true">
            K86
          </span>
          <div>
            <h1>K86 Studio</h1>
            <p>local-first, sem telemetria</p>
          </div>
        </div>
      </header>

      <main className="app-main">
        <section className="hero" aria-labelledby="hero-title">
          <p className="eyebrow">Fundação</p>
          <h2 id="hero-title">Configurador independente para o Attack Shark K86</h2>
          <p className="lede">
            Uma ferramenta para o seu teclado, feita para rodar no navegador e,
            nas próximas etapas, se conectar ao dispositivo por USB. Sem conta,
            sem nuvem e sem enviar dados para lugar nenhum.
          </p>
        </section>

        <section className="principles" aria-label="Princípios do projeto">
          <article className="principle-card">
            <h3>Local-first</h3>
            <p>Planejado: as configurações e preferências ficarão neste navegador.</p>
          </article>
          <article className="principle-card">
            <h3>Sem telemetria</h3>
            <p>O app não coleta eventos, métricas ou identificadores.</p>
          </article>
          <article className="principle-card">
            <h3>Leitura segura</h3>
            <p>
              Planejado: identificar o teclado em modo somente leitura, sem
              gravar no hardware.
            </p>
          </article>
        </section>

        <section className="next-step" aria-labelledby="next-title">
          <h2 id="next-title">Próximo passo</h2>
          <p>
            Esta fundação reúne React, TypeScript, Vite e o ambiente de testes.
            A conexão somente leitura com o K86 e a persistência local entram
            nas próximas etapas.
          </p>
        </section>
      </main>

      <footer className="app-footer">
        <p>K86 Studio</p>
        <p>GPL-3.0-or-later</p>
      </footer>
    </div>
  );
}
