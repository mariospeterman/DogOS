"use client";

import { MessageCircle, ShieldCheck, UserPlus } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { normalizeReferralCode } from "../../../lib/distribution";
import { createClient } from "../../../lib/supabase/client";

export default function SignUpPage() {
  return (
    <Suspense fallback={<main className="auth-chat-screen" />}>
      <SignUpForm />
    </Suspense>
  );
}

function SignUpForm() {
  const searchParams = useSearchParams();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [working, setWorking] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const referralCode = normalizeReferralCode(searchParams.get("ref"));

  async function signUp() {
    setWorking(true);
    setError(null);
    const locale = navigator.language.toLowerCase().startsWith("de")
      ? "de-CH"
      : "en";
    const requestedNext = searchParams.get("next");
    const next =
      requestedNext !== null && requestedNext.startsWith("/")
        ? requestedNext
        : "/app/coach";
    const confirmUrl = new URL("/auth/confirm", window.location.origin);
    confirmUrl.searchParams.set("next", next);
    if (referralCode !== null) confirmUrl.searchParams.set("ref", referralCode);
    const { data, error: signUpError } = await createClient().auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: name.trim(),
          locale,
          ...(referralCode === null
            ? {}
            : { referral_code: referralCode, referral_source: "landing" }),
        },
        emailRedirectTo: confirmUrl.toString(),
      },
    });
    if (signUpError !== null) {
      setError("Das Konto konnte nicht erstellt werden. Prüfe deine Angaben.");
      setWorking(false);
      return;
    }
    if (data.session !== null) {
      window.location.assign(next);
      return;
    }
    setSent(true);
    setWorking(false);
  }

  return (
    <main className="auth-chat-screen">
      <header className="public-chat-header compact">
        <Link href="/" className="chat-wordmark" aria-label="DogOS">
          <span className="coach-mark">D</span>
          <strong>DogOS</strong>
        </Link>
        <Link href="/auth/sign-in">Anmelden</Link>
      </header>

      <section className="auth-chat-panel">
        {sent ? (
          <section className="success-panel">
            <strong>Bestätige deine E-Mail</strong>
            <p>Öffne den sicheren Link in der Nachricht von DogOS.</p>
          </section>
        ) : (
          <>
            <div className="public-message assistant">
              <span className="coach-avatar">D</span>
              <div className="message-bubble assistant">
                <p>
                  Ich erstelle dein Konto und starte danach direkt mit dem
                  Onboarding im Coach.
                </p>
              </div>
            </div>
            <section className="auth-card">
              <div className="auth-card-heading">
                <MessageCircle size={18} />
                <span>
                  <h1>Konto erstellen</h1>
                  <small>
                    {referralCode === null
                      ? "Supabase Auth mit privatem DogOS Workspace."
                      : `Referral ${referralCode} wird sicher mitgegeben.`}
                  </small>
                </span>
              </div>
              <label>
                Name
                <input
                  autoComplete="name"
                  maxLength={120}
                  onChange={(event) => setName(event.target.value)}
                  value={name}
                />
              </label>
              <label>
                E-Mail
                <input
                  autoComplete="email"
                  onChange={(event) => setEmail(event.target.value)}
                  type="email"
                  value={email}
                />
              </label>
              <label>
                Passwort
                <input
                  autoComplete="new-password"
                  minLength={10}
                  onChange={(event) => setPassword(event.target.value)}
                  type="password"
                  value={password}
                />
              </label>
              <button
                className="button primary wide"
                disabled={
                  working ||
                  name.trim().length === 0 ||
                  !email.includes("@") ||
                  password.length < 10
                }
                onClick={signUp}
              >
                <UserPlus size={18} />{" "}
                {working ? "Wird erstellt..." : "Starten"}
              </button>
              {error === null ? null : <p className="error-note">{error}</p>}
              <p className="auth-safe-note">
                <ShieldCheck size={15} /> Referral-Codes sind nicht
                autorisierend; DogOS prüft sie serverseitig beim Bootstrap.
              </p>
              <Link className="text-link" href="/auth/sign-in">
                Bereits registriert? Anmelden
              </Link>
            </section>
          </>
        )}
      </section>
    </main>
  );
}
