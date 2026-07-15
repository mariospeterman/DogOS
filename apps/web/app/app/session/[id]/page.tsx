import { AppShell, DevelopmentNotice } from "../../../../components/app-shell";
import { SessionControls } from "../../../../components/session-controls";

export default function SessionPage() {
  return (
    <AppShell title="Orientierung" eyebrow="Einheit mit Milo">
      <DevelopmentNotice compact />
      <section className="session-instruction">
        <strong>Heute</strong>
        <p>
          Belohne den Blickkontakt bei lockerer Leine. Stoppe bei
          Futterverweigerung, Meiden oder Schmerzzeichen.
        </p>
        <span>Maximal 8 Wiederholungen · ruhige Strasse</span>
      </section>
      <SessionControls />
    </AppShell>
  );
}
