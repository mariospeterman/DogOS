"use client";

import {
  CircleUserRound,
  MessageCircle,
  Route,
  TrendingUp,
  Video,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

export function AppNavigation({
  locale = "de-CH",
}: {
  locale?: "de-CH" | "en";
}) {
  const pathname = usePathname();
  const navigation = [
    { href: "/app/coach", label: "Coach", icon: MessageCircle },
    { href: "/app/plan", label: "Plan", icon: Route },
    {
      href: "/app/progress",
      label: locale === "en" ? "Progress" : "Fortschritt",
      icon: TrendingUp,
    },
    {
      href: "/app/video",
      label: locale === "en" ? "Video" : "Video",
      icon: Video,
    },
    {
      href: "/app/account",
      label: locale === "en" ? "Account" : "Konto",
      icon: CircleUserRound,
    },
  ] as const;
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
