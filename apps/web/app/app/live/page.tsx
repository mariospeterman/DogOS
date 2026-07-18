import { redirect } from "next/navigation";

export default function LivePage() {
  redirect("/app/coach?action=start-live");
}
