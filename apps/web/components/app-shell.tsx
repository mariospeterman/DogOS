import { CircleUserRound, MessageCircle } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { AppNavigation } from "./app-navigation";

export function AppShell({
  children,
  title,
  eyebrow,
  action,
  wide = false,
}: {
  children?: ReactNode;
  title: string;
  eyebrow?: string;
  action?: ReactNode;
  wide?: boolean;
}) {
  return (
    <div className="product-shell">
      <header className="topbar">
        <Link href="/app/coach" className="wordmark" aria-label="DogOS Coach">
          <span className="mark">D</span>
          <span>DogOS</span>
        </Link>
        <div className="top-actions">
          <Link
            className="icon-link coach-link"
            href="/app/coach"
            aria-label="DogOS Coach"
            title="DogOS Coach"
          >
            <MessageCircle size={20} />
          </Link>
          <Link
            className="icon-link"
            href="/app/account"
            aria-label="Konto"
            title="Konto"
          >
            <CircleUserRound size={21} />
          </Link>
        </div>
      </header>
      <main
        className={wide ? "product-main product-main-wide" : "product-main"}
      >
        <div className="page-heading">
          <div>
            {eyebrow ? <p className="eyebrow">{eyebrow}</p> : null}
            <h1>{title}</h1>
          </div>
          {action}
        </div>
        {children}
      </main>
      <AppNavigation />
    </div>
  );
}

export function DevelopmentNotice({ compact = false }: { compact?: boolean }) {
  return (
    <aside className={compact ? "dev-notice compact" : "dev-notice"}>
      <strong>Pilot-Hinweis</strong>
      <span>
        Keine Diagnose oder Notfallhilfe. Trainingsprotokoll in Prüfung.
      </span>
    </aside>
  );
}
