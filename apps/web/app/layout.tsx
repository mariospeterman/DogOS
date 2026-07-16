import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";

import "./globals.css";
import { PwaRegistration } from "../components/pwa-registration";

export const metadata: Metadata = {
  applicationName: "DogOS",
  title: { default: "DogOS", template: "%s | DogOS" },
  description:
    "Dog-first training, progress, and coaching through WhatsApp and the DogOS app.",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "DogOS",
  },
  icons: {
    icon: "/icons/dogos-192.png",
    apple: "/icons/dogos-192.png",
  },
  openGraph: {
    title: "DogOS",
    description: "Im WhatsApp-Chat starten. In DogOS dranbleiben.",
    siteName: "DogOS",
    type: "website",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0b1f3a",
};

export default function RootLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="de-CH">
      <body>
        <PwaRegistration />
        {children}
      </body>
    </html>
  );
}
