import { requireRole } from "@/lib/auth";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/ui";
import NotificationsList from "@/components/NotificationsList";
import PushToggle from "@/components/PushToggle";
import { vapidPublicKey } from "@/lib/notify";
import { markAdminRead } from "@/app/admin/actions";

export const metadata = { title: "الإشعارات" };

export default async function MentorNotifications() {
  const me = await requireRole("MENTOR", "ADMIN");
  const items = await db.notification.findMany({ where: { userId: me.id }, orderBy: { createdAt: "desc" }, take: 100 });
  return (
    <>
      <PageHeader title="الإشعارات" actions={items.some((i) => !i.readAt) && <form action={markAdminRead}><button className="btn btn-secondary btn-sm">تعليم الكل كمقروء</button></form>} />
      <div className="mb-4"><PushToggle compact publicKey={vapidPublicKey()} /></div>
      <NotificationsList items={items} />
    </>
  );
}
