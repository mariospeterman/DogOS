import { assertNoPrivateBrowserEnv, parseWebEnv } from "@dogos/config/web";

export default function HomePage() {
  assertNoPrivateBrowserEnv(process.env);
  const environment = parseWebEnv(process.env);

  return (
    <main>
      <nav aria-label="Hauptnavigation">
        <a className="brand" href="#top" aria-label="DogOS Startseite">
          DogOS
        </a>
        <span className="status">Phase 2 · Foundation</span>
      </nav>

      <section id="top" className="hero">
        <div className="hero-copy">
          <p className="eyebrow">Für Alltag, Fortschritt und Sicherheit</p>
          <h1>Training, das sich anpasst.</h1>
          <p className="lede">
            DogOS entsteht als deutschsprachige Trainingsbegleitung mit klaren
            Zielen, kurzen Einheiten und nachvollziehbaren Anpassungen.
          </p>
        </div>
        <div className="signal" aria-label="Systemstatus">
          <span className="signal-mark" aria-hidden="true" />
          <div>
            <strong>Lokale Basis aktiv</strong>
            <small>Umgebung: {environment.NEXT_PUBLIC_DOGOS_ENV}</small>
          </div>
        </div>
      </section>

      <section className="next-band" aria-labelledby="next-heading">
        <p>Als Nächstes</p>
        <h2 id="next-heading">Datenmodell und lokale Zugriffskontrollen</h2>
      </section>
    </main>
  );
}
