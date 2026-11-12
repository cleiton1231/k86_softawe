type PlaceholderPageProps = {
  title: string;
  description: string;
};

export default function PlaceholderPage({
  title,
  description,
}: PlaceholderPageProps) {
  return (
    <section className="page placeholder-page" aria-labelledby="page-title">
      <header className="page-header">
        <p className="eyebrow">Próxima fase</p>
        <h2 id="page-title">{title}</h2>
        <p className="lede">{description}</p>
      </header>

      <div className="placeholder-panel">
        <span className="phase-tag">Planejado</span>
        <h3>Esta área entra em uma fase posterior</h3>
        <p>
          A fundação valida o protocolo e a leitura do dispositivo antes de
          habilitar configurações. Por enquanto, esta página reserva o lugar
          dessa funcionalidade na navegação.
        </p>
        <ul className="placeholder-points">
          <li>Sem gravação no hardware nesta fase.</li>
          <li>Sem conexões de rede ou telemetria.</li>
          <li>Preferências locais entram junto com cada editor.</li>
        </ul>
      </div>
    </section>
  );
}
