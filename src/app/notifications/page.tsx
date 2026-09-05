import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { homeFor } from "@/lib/roles";

/** اختصار محايد للإشعارات: يوجّه كل دور إلى صفحة إشعاراته */
export default async function NotificationsEntry() {
  const session = await getSession();
  if (!session) redirect("/login?next=/notifications");
  redirect(`${homeFor(session.role)}/notifications`);
}
