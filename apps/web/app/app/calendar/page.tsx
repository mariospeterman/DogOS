"use client";

import {
  CalendarPlus,
  Check,
  Download,
  Eye,
  Moon,
  RefreshCw,
} from "lucide-react";
import { useState } from "react";
import { AppShell, DevelopmentNotice } from "../../../components/app-shell";

const initial = [
  {
    day: "15",
    weekday: "Mi",
    title: "Orientierung",
    detail: "08:00 · 4 Min.",
    type: "training",
    done: false,
  },
  {
    day: "16",
    weekday: "Do",
    title: "Ruhetag",
    detail: "Erholung",
    type: "rest",
    done: false,
  },
  {
    day: "17",
    weekday: "Fr",
    title: "Orientierung",
    detail: "08:00 · 4 Min.",
    type: "training",
    done: false,
  },
  {
    day: "18",
    weekday: "Sa",
    title: "Beobachtung",
    detail: "Beim Spaziergang",
    type: "observe",
    done: false,
  },
  {
    day: "19",
    weekday: "So",
    title: "Wochenrückblick",
    detail: "3 Min.",
    type: "review",
    done: false,
  },
];

export default function CalendarPage() {
  const [items, setItems] = useState(initial);
  const [rescheduled, setRescheduled] = useState(false);
  const icon = (type: string) =>
    type === "rest" ? (
      <Moon />
    ) : type === "observe" ? (
      <Eye />
    ) : type === "review" ? (
      <RefreshCw />
    ) : (
      <CalendarPlus />
    );
  const reschedule = () => {
    setItems((value) =>
      value.map((item, index) =>
        index === 2
          ? {
              ...item,
              detail: rescheduled ? "08:00 · 4 Min." : "17:30 · 4 Min.",
            }
          : item,
      ),
    );
    setRescheduled((value) => !value);
  };
  return (
    <AppShell
      title="Trainingskalender"
      eyebrow="15. - 21. Juli"
      action={
        <a
          className="icon-action"
          href="/api/calendar.ics?token=local-review-calendar-v1"
          download
          title="Widerrufbare ICS herunterladen"
          aria-label="Kalenderdatei herunterladen"
        >
          <Download />
        </a>
      }
    >
      <DevelopmentNotice compact />
      <section className="calendar-list">
        {items.map((item, index) => (
          <button
            className={`calendar-item ${item.type} ${item.done ? "completed" : ""}`}
            key={item.day}
            onClick={() =>
              setItems((value) =>
                value.map((entry, position) =>
                  position === index ? { ...entry, done: !entry.done } : entry,
                ),
              )
            }
          >
            <span className="calendar-date">
              <strong>{item.day}</strong>
              {item.weekday}
            </span>
            <span className="calendar-icon">
              {item.done ? <Check /> : icon(item.type)}
            </span>
            <span className="calendar-copy">
              <strong>{item.title}</strong>
              <small>{item.done ? "Abgeschlossen" : item.detail}</small>
            </span>
          </button>
        ))}
      </section>
      <button className="button secondary wide" onClick={reschedule}>
        <RefreshCw size={17} />
        {rescheduled
          ? "Freitag auf 08:00 zurücksetzen"
          : "Freitag auf 17:30 verschieben"}
      </button>
      <p className="helper">
        Tippe eine Einheit an, um sie als abgeschlossen zu markieren.
        Verschieben ist nur innerhalb dieser Trainingswoche erlaubt.
      </p>
    </AppShell>
  );
}
