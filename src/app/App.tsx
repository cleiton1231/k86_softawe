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
            Uma ferramenta para o seu teclado, feita para rodar no navegador e
            conversar com o dispositivo conectado por USB. Sem conta, sem nuvem
            e sem enviar dados para lugar nenhum.
          </p>
        </section>

        <section className="principles" aria-label="Princípios do projeto">
          <article className="principle-card">
            <h3>Local-first</h3>
            <p>Configurações e preferências ficam neste navegador.</p>
          </article>
          <article className="principle-card">
            <h3>Sem telemetria</h3>
            <p>Nenhum evento, métrica ou identificador sai do app.</p>
          </article>
          <article className="principle-card">
            <h3>Leitura segura</h3>
            <p>Esta fase identifica o teclado sem enviar writes ao hardware.</p>
          </article>
        </section>

        <section className="next-step" aria-labelledby="next-title">
          <h2 id="next-title">Próximo passo</h2>
          <p>
            A fundação está pronta: React, TypeScript, Vite e o ambiente de
            testes. A conexão com o K86 será adicionada nas próximas etapas.
          </p>
        </section>
      </main>

      <footer className="app-footer">
        <p>K86 Studio 0.1.0</p>
        <p>GPL-3.0-or-later</p>
      </footer>
    </div>
  );
}
