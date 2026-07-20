"use client";

import { CoachChat } from "../../../components/coach-chat";
import { DogOSLoader } from "../../../components/dogos-loader";
import { OnboardingChat } from "../../../components/onboarding-chat";
import { useProductDashboard } from "../../../lib/product";

export default function CoachPage() {
  const { error, loading, product } = useProductDashboard();
  if (loading)
    return (
      <div className="coach-loading">
        <DogOSLoader label="DogOS lädt Echos Plan ..." />
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
