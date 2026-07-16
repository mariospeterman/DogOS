"use client";

import { LogIn } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useState } from "react";

import { AppShell } from "../../../components/app-shell";
import { createClient } from "../../../lib/supabase/client";

export default function SignInPage() {
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
      next !== null && next.startsWith("/") ? next : "/app/today",
    );
  }

  return (
    <AppShell title="Anmelden" eyebrow="DogOS Konto">
      <section className="auth-form">
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
      </section>
    </AppShell>
  );
}
