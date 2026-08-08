export default function Home() {
  return (
    <main className="site-shell">
      <section className="hero" aria-labelledby="site-title">
        <p className="eyebrow">structureCo</p>
        <h1 id="site-title">Análisis estructural 2D, claro y trazable.</h1>
        <p className="lead">
          Modela marcos, vigas y armaduras; revisa reacciones, diagramas,
          deformadas y el procedimiento de cálculo en un mismo espacio de trabajo.
        </p>
        <a className="primary-action" href="/app/">Abrir structureCo</a>
      </section>

      <section className="capabilities" aria-label="Capacidades principales">
        <article>
          <h2>Modela</h2>
          <p>Nodos, miembros, apoyos, cargas, liberaciones y combinaciones con editor canvas-first.</p>
        </article>
        <article>
          <h2>Analiza</h2>
          <p>Resultados trazables de equilibrio, desplazamientos y diagramas N, V y M.</p>
        </article>
        <article>
          <h2>Aprende</h2>
          <p>El modo Aula acompaña el mismo modelo real con predicción y explicaciones guiadas.</p>
        </article>
      </section>

      <p className="privacy-note">
        La aplicación conserva el enfoque local-first: tus proyectos permanecen en tu navegador hasta que decidas exportarlos.
      </p>
    </main>
  );
}
