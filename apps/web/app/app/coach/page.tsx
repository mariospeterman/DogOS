"use client";

import { CoachChat } from "../../../components/coach-chat";
import { OnboardingChat } from "../../../components/onboarding-chat";
import { useProductDashboard } from "../../../lib/product";

export default function CoachPage() {
  const { error, loading, product } = useProductDashboard();
  if (loading)
    return (
      <div className="coach-loading">
        <span className="coach-pulse" />
      </div>
    );
  if (product === null) {
    return error ? (
      <main className="coach-empty">
        <p>{error}</p>
      </main>
    ) : (
      <OnboardingChat />
    );
  }
  return <CoachChat product={product} />;
}
