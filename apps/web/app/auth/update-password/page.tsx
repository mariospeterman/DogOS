"use client";

import { KeyRound } from "lucide-react";
import { useState } from "react";
import { AppShell } from "../../../components/app-shell";
import { createClient } from "../../../lib/supabase/client";

export default function UpdatePasswordPage() {
  const [password, setPassword] = useState("");
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function updatePassword() {
    setWorking(true);
    const { error: updateError } = await createClient().auth.updateUser({
      password,
    });
    if (updateError !== null) {
      setError("Das Passwort konnte nicht geändert werden.");
      setWorking(false);
      return;
    }
    window.location.assign("/app/account");
  }

  return (
    <AppShell title="Neues Passwort" eyebrow="DogOS Konto">
      <section className="auth-form">
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
          disabled={working || password.length < 10}
          onClick={updatePassword}
        >
          <KeyRound size={18} /> {working ? "Wird gespeichert..." : "Speichern"}
        </button>
        {error === null ? null : <p className="error-note">{error}</p>}
      </section>
    </AppShell>
  );
}
