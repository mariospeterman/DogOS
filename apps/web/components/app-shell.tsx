import {
  CalendarDays,
  CircleUserRound,
  MessageCircle,
  PawPrint,
  Route,
  TrendingUp,
} from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

const navigation = [
  { href: "/app/today", label: "Heute", icon: PawPrint },
  { href: "/app/plan", label: "Plan", icon: Route },
  { href: "/app/calendar", label: "Kalender", icon: CalendarDays },
  { href: "/app/progress", label: "Fortschritt", icon: TrendingUp },
] as const;

export function AppShell({
  children,
  title,
  eyebrow,
  action,
}: {
  children: ReactNode;
  title: string;
  eyebrow?: string;
  action?: ReactNode;
}) {
  return (
    <div className="product-shell">
      <header className="topbar">
        <Link href="/app/today" className="wordmark" aria-label="DogOS heute">
          <span className="mark">D</span>
          <span>DogOS</span>
        </Link>
        <div className="top-actions">
          <Link
            className="icon-link"
            href="/simulator"
            aria-label="Chat-Simulator"
            title="Chat-Simulator"
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
      <main className="product-main">
        <div className="page-heading">
          <div>
            {eyebrow ? <p className="eyebrow">{eyebrow}</p> : null}
            <h1>{title}</h1>
          </div>
          {action}
        </div>
        {children}
      </main>
      <nav className="bottom-nav" aria-label="Produktnavigation">
        {navigation.map(({ href, icon: Icon, label }) => (
          <Link href={href} key={href}>
            <Icon size={20} />
            <span>{label}</span>
          </Link>
        ))}
      </nav>
    </div>
  );
}

export function DevelopmentNotice({ compact = false }: { compact?: boolean }) {
  return (
    <aside className={compact ? "dev-notice compact" : "dev-notice"}>
      <strong>Entwicklungsprotokoll</strong>
      <span>
        Keine Diagnose oder Notfallhilfe. Fachliche Freigabe steht aus.
      </span>
    </aside>
  );
}
