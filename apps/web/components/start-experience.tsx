"use client";

import { ArrowRight, Check, MessageCircle } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

import {
  buildWhatsAppStartUrl,
  normalizeReferralCode,
} from "../lib/distribution";
import { DistributionActions } from "./distribution-actions";

export function StartExperience() {
  const params = useSearchParams();
  const referralCode = normalizeReferralCode(params.get("ref"));
  const whatsappUrl = buildWhatsAppStartUrl(
    process.env.NEXT_PUBLIC_WHATSAPP_CHAT_URL ?? "https://wa.me/15551617622",
    { locale: "de-CH", referralCode },
  );

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
          <small>Training, das bei deinem Hund bleibt.</small>
        </div>
      </section>

      <section className="start-core">
        <p className="eyebrow">Dein nächster Trainingsschritt</p>
        <h1>Im WhatsApp-Chat starten. In DogOS dranbleiben.</h1>
        <p>
          Erzähle kurz von deinem Hund und Ziel. DogOS baut daraus einen
          messbaren Plan und hält Einheiten, Fortschritt und Termine zusammen.
        </p>
        <a className="button primary start-primary" href={whatsappUrl}>
          <MessageCircle size={20} /> In WhatsApp starten
          <ArrowRight size={18} />
        </a>
        <ul className="start-proof">
          <li>
            <Check size={16} /> Keine App-Einrichtung vor dem ersten Gespräch
          </li>
          <li>
            <Check size={16} /> Deutsch oder Englisch, derselbe Trainingsstand
          </li>
          <li>
            <Check size={16} /> Plan und Fortschritt bleiben in deinem Konto
          </li>
        </ul>
      </section>

      <section className="start-return">
        <div>
          <strong>DogOS auf diesem Gerät</strong>
          <span>Schneller zurück zu Heute, Plan und Fortschritt.</span>
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
