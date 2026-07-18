import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";

import "@livekit/components-styles";
import "./globals.css";
import { PwaRegistration } from "../components/pwa-registration";

export const metadata: Metadata = {
  applicationName: "DogOS",
  title: { default: "DogOS", template: "%s | DogOS" },
  description: "A dog training coach that remembers and adapts.",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "DogOS",
  },
  icons: {
    icon: [
      { url: "/icons/favicon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/icons/dogos-192.png", sizes: "192x192", type: "image/png" },
    ],
    apple: "/icons/dogos-192.png",
  },
  openGraph: {
    title: "DogOS",
    description: "Chatten, trainieren, Fortschritt verstehen.",
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
