import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "DogOS",
    short_name: "DogOS",
    description: "Dog-first training and one Coach across DogOS and WhatsApp.",
    start_url: "/app/coach?source=installed_app",
    scope: "/",
    display: "standalone",
    background_color: "#f4f6f9",
    theme_color: "#0b1f3a",
    orientation: "portrait-primary",
    categories: ["lifestyle", "education"],
    icons: [
      {
        src: "/icons/dogos-192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/icons/dogos-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
    shortcuts: [
      {
        name: "DogOS Coach",
        short_name: "Coach",
        url: "/app/coach?source=app_shortcut",
        icons: [
          {
            src: "/icons/dogos-192.png",
            sizes: "192x192",
          },
        ],
      },
      {
        name: "Heutiges Training",
        short_name: "Heute",
        url: "/app/today?source=app_shortcut",
        icons: [
          {
            src: "/icons/dogos-192.png",
            sizes: "192x192",
          },
        ],
      },
      {
        name: "Fortschritt",
        short_name: "Fortschritt",
        url: "/app/progress?source=app_shortcut",
        icons: [
          {
            src: "/icons/dogos-192.png",
            sizes: "192x192",
          },
        ],
      },
    ],
  };
}
