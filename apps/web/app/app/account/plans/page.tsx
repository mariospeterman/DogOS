import Link from "next/link";
import { AppShell } from "../../../../components/app-shell";

export default function PlansPage() {
  return (
    <AppShell title="Plans" eyebrow="Trainingsumfang">
      <section className="settings">
        {["Freemium", "Plus", "Pro", "Ultra"].map((tier) => (
          <div key={tier}>
            <span>
              {tier}
              <small>
                Kontingente werden serverseitig aus Entitlements gelesen.
              </small>
            </span>
            <Link className="button secondary" href="/app/account/billing">
              Öffnen
            </Link>
          </div>
        ))}
      </section>
    </AppShell>
  );
}
