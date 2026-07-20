import { redirect } from "next/navigation";

export default function VideoPage() {
  redirect("/app/coach?action=upload-video");
}
