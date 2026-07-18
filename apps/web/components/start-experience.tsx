"use client";

import { ArrowRight, Check, MessageCircle } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

import { normalizeReferralCode } from "../lib/distribution";
import { DistributionActions } from "./distribution-actions";

export function StartExperience() {
  const params = useSearchParams();
  const referralCode = normalizeReferralCode(params.get("ref"));
  const startUrl = `/auth/sign-up?next=${encodeURIComponent("/app/coach")}${
    referralCode === null ? "" : `&ref=${encodeURIComponent(referralCode)}`
  }`;

  return (
    <main className="start-screen">
      <section className="start-brand">
        <Image
          src="/icons/dogos-192.png"
          alt=""
          width={72}
          height={72}
          priority
        />
        <div>
          <span>DogOS</span>
          <small>Der Coach, der deinen Hund kennt.</small>
        </div>
      </section>

      <section className="start-core">
        <p className="eyebrow">Dein persönlicher Trainingscoach</p>
        <h1>Erzähl mir von deinem Hund.</h1>
        <p>
          DogOS erinnert sich an Training, Fortschritt und das, was bei euch
          funktioniert. Daraus entsteht Schritt für Schritt euer Plan.
        </p>
        <Link className="button primary start-primary" href={startUrl}>
          <MessageCircle size={20} /> Gespräch starten
          <ArrowRight size={18} />
        </Link>
        <ul className="start-proof">
          <li>
            <Check size={16} /> Natürlich schreiben statt Formulare ausfüllen
          </li>
          <li>
            <Check size={16} /> Ein Coach für Plan, Training und Fortschritt
          </li>
          <li>
            <Check size={16} /> Als App installierbar, direkt im Browser nutzbar
          </li>
        </ul>
      </section>

      <section className="start-return">
        <div>
          <strong>DogOS auf diesem Gerät</strong>
          <span>Schneller zurück zum Coach und aktuellen Training.</span>
        </div>
        <DistributionActions compact />
      </section>

      <Link className="start-login" href="/auth/sign-in">
        Schon verbunden? DogOS öffnen <ArrowRight size={16} />
      </Link>
      <p className="start-disclosure">
        KI-gestützter Trainingscoach. Keine Diagnose oder Notfallhilfe.
      </p>
    </main>
  );
}
