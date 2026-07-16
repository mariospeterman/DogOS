import { Suspense } from "react";
import { StartExperience } from "../components/start-experience";

export default function HomePage() {
  return (
    <Suspense fallback={<main className="start-screen" />}>
      <StartExperience />
    </Suspense>
  );
}
