"use client";

import {
  CircleUserRound,
  MessageCircle,
  Route,
  TrendingUp,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const navigation = [
  { href: "/app/coach", label: "Coach", icon: MessageCircle },
  { href: "/app/plan", label: "Plan", icon: Route },
  { href: "/app/progress", label: "Fortschritt", icon: TrendingUp },
  { href: "/app/account", label: "Konto", icon: CircleUserRound },
] as const;

export function AppNavigation() {
  const pathname = usePathname();
  return (
    <nav className="bottom-nav" aria-label="Produktnavigation">
      {navigation.map(({ href, icon: Icon, label }) => {
        const active =
          pathname === href ||
          (href === "/app/plan" &&
            (pathname === "/app/calendar" ||
              pathname.startsWith("/app/session")));
        return (
          <Link
            href={href}
            key={href}
            aria-current={active ? "page" : undefined}
          >
            <Icon size={20} />
            <span>{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
