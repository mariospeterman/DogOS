"use client";

import { Mail } from "lucide-react";
import { useState } from "react";
import { AppShell } from "../../../components/app-shell";
import { createClient } from "../../../lib/supabase/client";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [working, setWorking] = useState(false);
  const [sent, setSent] = useState(false);

  async function requestReset() {
    setWorking(true);
    await createClient().auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/confirm?next=/auth/update-password`,
    });
    setSent(true);
    setWorking(false);
  }

  return (
    <AppShell title="Passwort zurücksetzen" eyebrow="DogOS Konto">
      <section className="auth-form">
        {sent ? (
          <p className="success-note">
            Falls ein Konto existiert, wurde ein sicherer Link gesendet.
          </p>
        ) : (
          <>
            <label>
              E-Mail
              <input
                autoComplete="email"
                onChange={(event) => setEmail(event.target.value)}
                type="email"
                value={email}
              />
            </label>
            <button
              className="button primary wide"
              disabled={working || !email.includes("@")}
              onClick={requestReset}
            >
              <Mail size={18} /> {working ? "Wird gesendet..." : "Link senden"}
            </button>
          </>
        )}
      </section>
    </AppShell>
  );
}
