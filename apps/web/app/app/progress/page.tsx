import { redirect } from "next/navigation";

export default function ProgressPage() {
  redirect("/app/coach?space=progress");
}
