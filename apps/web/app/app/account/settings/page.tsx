import { AppShell } from "../../../../components/app-shell";

export default function SettingsPage() {
  return (
    <AppShell title="Settings" eyebrow="Konto">
      <section className="settings">
        <div>
          <span>
            Sprache
            <small>DogOS erkennt Deutsch und Englisch im Gespräch.</small>
          </span>
          <strong>Automatisch</strong>
        </div>
        <div>
          <span>
            Benachrichtigungen
            <small>
              Web Push wird erst nach einem nützlichen Plan angefragt.
            </small>
          </span>
          <strong>PWA</strong>
        </div>
      </section>
    </AppShell>
  );
}
