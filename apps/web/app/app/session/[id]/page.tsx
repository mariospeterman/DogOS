import { AppShell } from "../../../../components/app-shell";
import { SessionControls } from "../../../../components/session-controls";

export default function SessionPage() {
  return (
    <AppShell title="Block 01" eyebrow="Live · Milo">
      <section className="session-instruction">
        <strong>Orientierung / lockere Leine</strong>
        <p>
          Warte auf lockere Leine, gehe an und bestätige Milos freiwillige
          Orientierung. Bei Zug stehen bleiben; mit lockerer Leine fortsetzen.
        </p>
        <span>4 Minuten · 8 Abschnitte · ruhige Strecke</span>
      </section>
      <SessionControls />
    </AppShell>
  );
}
