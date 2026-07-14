import type { Metadata } from "next";
import type { ReactNode } from "react";

import "./globals.css";

export const metadata: Metadata = {
  title: "DogOS | Adaptives Hundetraining",
  description:
    "DogOS wird als sichere, nachvollziehbare Trainingsplattform aufgebaut.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="de">
      <body>{children}</body>
    </html>
  );
}
