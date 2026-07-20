"use client";

import { ArrowRight, LogIn, MessageCircle } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";

import { createClient } from "../../../lib/supabase/client";

export default function SignInPage() {
  return (
    <Suspense fallback={<main className="auth-chat-screen" />}>
      <SignInForm />
    </Suspense>
  );
}

function SignInForm() {
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("owner.ch@dogos.local");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [working, setWorking] = useState(false);

  async function signIn() {
    setWorking(true);
    setError(null);
    const { error: signInError } = await createClient().auth.signInWithPassword(
      {
        email,
        password,
      },
    );
    if (signInError !== null) {
      setError("Anmeldung fehlgeschlagen. Prüfe E-Mail und Passwort.");
      setWorking(false);
      return;
    }
    const next = searchParams.get("next");
    window.location.assign(
      next !== null && next.startsWith("/") ? next : "/app/coach",
    );
  }

  return (
    <main className="auth-chat-screen">
      <header className="public-chat-header compact">
        <Link href="/" className="chat-wordmark" aria-label="DogOS">
          <span className="coach-mark">D</span>
          <strong>DogOS</strong>
        </Link>
        <Link href="/auth/sign-up?next=/app/coach">Konto erstellen</Link>
      </header>

      <section className="auth-chat-panel">
        <div className="public-message assistant">
          <span className="coach-avatar">D</span>
          <div className="message-bubble assistant">
            <p>Willkommen zurück. Melde dich an und öffne deinen Coach.</p>
          </div>
        </div>
        <div className="auth-card">
          <div className="auth-card-heading">
            <MessageCircle size={18} />
            <span>
              <h1>Anmelden</h1>
              <small>Supabase Auth schützt Konto, Memory und Verlauf.</small>
            </span>
          </div>
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
              autoComplete="current-password"
              onChange={(event) => setPassword(event.target.value)}
              type="password"
              value={password}
            />
          </label>
          <button
            className="button primary wide"
            disabled={working || email.length === 0 || password.length === 0}
            onClick={signIn}
          >
            <LogIn size={18} /> {working ? "Anmeldung..." : "Anmelden"}
          </button>
          {error === null ? null : <p className="error-note">{error}</p>}
          <div className="auth-links compact">
            <Link className="text-link" href="/auth/forgot-password">
              Passwort vergessen
            </Link>
            <Link className="text-link" href="/auth/sign-up?next=/app/coach">
              Konto erstellen <ArrowRight size={15} />
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
