import { redirect } from "next/navigation";
import { dogosFeatures } from "../../../lib/features";

export default function LivePage() {
  if (!dogosFeatures.live) redirect("/app/coach");
  redirect("/app/coach?action=start-live");
}
