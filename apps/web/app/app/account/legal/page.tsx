import { AppShell } from "../../../../components/app-shell";

export default function LegalPage() {
  return (
    <AppShell title="Legal" eyebrow="Hinweise">
      <section className="auth-form">
        <p className="helper">
          DogOS ist KI-gestütztes Training, keine Diagnose, Notfallhilfe oder
          tierärztliche Behandlung. Video- und Live-Funktionen bleiben privat
          und werden nicht zum Training externer Modelle freigegeben.
        </p>
      </section>
    </AppShell>
  );
}
