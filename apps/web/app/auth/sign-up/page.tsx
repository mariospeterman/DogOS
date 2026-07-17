"use client";

import { UserPlus } from "lucide-react";
import { useState } from "react";
import { AppShell } from "../../../components/app-shell";
import { createClient } from "../../../lib/supabase/client";

export default function SignUpPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [working, setWorking] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function signUp() {
    setWorking(true);
    setError(null);
    const locale = navigator.language.toLowerCase().startsWith("de")
      ? "de-CH"
      : "en";
    const { data, error: signUpError } = await createClient().auth.signUp({
      email,
      password,
      options: {
        data: { full_name: name.trim(), locale },
        emailRedirectTo: `${window.location.origin}/auth/confirm?next=/app/account`,
      },
    });
    if (signUpError !== null) {
      setError("Das Konto konnte nicht erstellt werden. Prüfe deine Angaben.");
      setWorking(false);
      return;
    }
    if (data.session !== null) {
      window.location.assign("/app/account");
      return;
    }
    setSent(true);
    setWorking(false);
  }

  return (
    <AppShell title="Konto erstellen" eyebrow="DogOS starten">
      {sent ? (
        <section className="success-panel">
          <strong>Bestätige deine E-Mail</strong>
          <p>Öffne den sicheren Link in der Nachricht von DogOS.</p>
        </section>
      ) : (
        <section className="auth-form">
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
            <UserPlus size={18} /> {working ? "Wird erstellt..." : "Starten"}
          </button>
          {error === null ? null : <p className="error-note">{error}</p>}
          <a className="text-link" href="/auth/sign-in">
            Bereits registriert? Anmelden
          </a>
        </section>
      )}
    </AppShell>
  );
}
