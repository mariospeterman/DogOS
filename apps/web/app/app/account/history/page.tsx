import Link from "next/link";
import { AppShell } from "../../../../components/app-shell";

export default function HistoryPage() {
  return (
    <AppShell title="History" eyebrow="Coach Timeline">
      <section className="settings">
        <div>
          <span>
            Canonical Coach Timeline
            <small>
              Verlauf und Suche werden aus gespeicherten Coach Messages
              projiziert.
            </small>
          </span>
          <Link className="button primary" href="/app/coach">
            Coach
          </Link>
        </div>
      </section>
    </AppShell>
  );
}
