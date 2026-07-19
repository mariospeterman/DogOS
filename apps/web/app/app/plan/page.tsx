import { redirect } from "next/navigation";

export default function PlanPage() {
  redirect("/app/coach?space=plan");
}
