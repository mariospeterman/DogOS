import { Suspense } from "react";
import { AppShell } from "../../../components/app-shell";
import { CoachConversation } from "../../../components/coach-conversation";

export default function CoachPage() {
  return (
    <AppShell title="Coach" eyebrow="Milo · gemeinsamer Verlauf" wide>
      <Suspense
        fallback={<div className="coach-loading">Coach wird geladen ...</div>}
      >
        <CoachConversation />
      </Suspense>
    </AppShell>
  );
}
