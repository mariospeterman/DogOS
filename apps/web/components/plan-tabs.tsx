import Link from "next/link";

export function PlanTabs({ active }: { active: "plan" | "calendar" }) {
  return (
    <nav className="section-tabs" aria-label="Planansichten">
      <Link
        href="/app/plan"
        aria-current={active === "plan" ? "page" : undefined}
      >
        Übersicht
      </Link>
      <Link
        href="/app/calendar"
        aria-current={active === "calendar" ? "page" : undefined}
      >
        Kalender
      </Link>
    </nav>
  );
}
