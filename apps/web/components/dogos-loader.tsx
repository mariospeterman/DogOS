"use client";

import { useEffect, useState } from "react";

export type DogOSLoaderLabel =
  | "DogOS lädt Echos Plan ..."
  | "DogOS prüft Echos Kontext ..."
  | "DogOS vergleicht die letzten Einheiten ..."
  | "Video wird vorbereitet ...";

export function DogOSLoader({
  label,
  reserve = "page",
}: {
  label: DogOSLoaderLabel;
  reserve?: "inline" | "page";
}) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => setVisible(true), 250);
    return () => window.clearTimeout(timer);
  }, []);

  return (
    <div
      aria-busy="true"
      aria-live="polite"
      className="dogos-loader-shell"
      data-reserve={reserve}
      role="status"
    >
      {visible ? (
        <div className="dogos-loader">
          <svg
            aria-hidden="true"
            className="dogos-loader-art"
            focusable="false"
            role="img"
            viewBox="0 0 160 72"
          >
            <path
              className="dogos-loader-arc"
              d="M34 48 C60 22 92 20 126 46"
              pathLength="1"
            />
            <g className="dogos-loader-ball">
              <circle cx="126" cy="46" r="5.5" />
            </g>
            <g className="dogos-loader-dog">
              <path
                className="dogos-loader-tail"
                d="M48 44 C35 39 31 30 37 24"
              />
              <path
                className="dogos-loader-body"
                d="M50 47 C55 35 70 31 86 35 C96 38 104 45 112 51 L100 53 C91 48 83 47 72 49 C64 50 56 50 50 47 Z"
              />
              <path
                className="dogos-loader-chest"
                d="M89 36 C97 31 107 32 116 39 L123 45 L112 46 C104 43 97 41 89 36 Z"
              />
              <path
                className="dogos-loader-ear"
                d="M102 32 L109 17 L113 35 Z"
              />
              <circle className="dogos-loader-eye" cx="110" cy="36" r="1.8" />
              <path className="dogos-loader-leg rear" d="M65 48 L59 60" />
              <path className="dogos-loader-leg rear2" d="M75 48 L78 60" />
              <path className="dogos-loader-leg front" d="M96 48 L91 61" />
              <path className="dogos-loader-leg front2" d="M104 49 L110 60" />
            </g>
          </svg>
          <span className="dogos-loader-text">{label}</span>
        </div>
      ) : (
        <span className="sr-only">{label}</span>
      )}
    </div>
  );
}
