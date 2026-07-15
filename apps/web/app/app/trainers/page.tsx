import {
  CalendarCheck,
  Languages,
  MapPin,
  ShieldCheck,
  Video,
} from "lucide-react";
import { AppShell } from "../../../components/app-shell";

const trainers = [
  {
    name: "Nina Frei",
    fit: "Leinenführung & Angst",
    location: "Zürich · online",
    language: "DE / EN",
    availability: "Fr, 17:30",
    price: "CHF 120-150",
    evidence: "Ausbildung geprüft · 4 Fallnachweise",
  },
  {
    name: "Jonas Keller",
    fit: "Sicherheitsfälle & Alltag",
    location: "Winterthur · vor Ort",
    language: "DE",
    availability: "Mo, 09:00",
    price: "CHF 110-140",
    evidence: "Ausbildung geprüft · 7 Fallnachweise",
  },
];
export default function TrainersPage() {
  return (
    <AppShell
      title="Passende Fachpersonen"
      eyebrow="Mock-Daten · keine Buchung"
    >
      <div className="mock-warning">
        Ranking nach Fachgebiet, Sicherheitskompetenz, Passung, Sprache,
        Verfügbarkeit, Preis und Qualitätsnachweis. Keine Provision fliesst ein.
      </div>
      <section className="trainer-list">
        {trainers.map((trainer, index) => (
          <article className="trainer-card" key={trainer.name}>
            <div className="trainer-head">
              <span>
                {trainer.name
                  .split(" ")
                  .map((part) => part[0])
                  .join("")}
              </span>
              <div>
                <small>PASSUNG {index === 0 ? "SEHR HOCH" : "HOCH"}</small>
                <h2>{trainer.name}</h2>
                <p>{trainer.fit}</p>
              </div>
            </div>
            <ul>
              <li>
                <ShieldCheck />
                {trainer.evidence}
              </li>
              <li>
                <MapPin />
                {trainer.location}
              </li>
              <li>
                <Languages />
                {trainer.language}
              </li>
              <li>
                <CalendarCheck />
                {trainer.availability} · {trainer.price}
              </li>
            </ul>
            <button className="button secondary wide">
              <Video size={18} /> Mock-Gespräch anfragen
            </button>
          </article>
        ))}
      </section>
      <p className="helper">
        Buchungen und Verfügbarkeit sind simuliert. Keine Cal.com- oder
        Zahlungsintegration aktiv.
      </p>
    </AppShell>
  );
}
