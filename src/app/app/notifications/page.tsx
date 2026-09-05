import { requireRole } from "@/lib/auth";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/ui";
import NotificationsList from "@/components/NotificationsList";
import { markAllRead } from "../actions";
import PushToggle from "@/components/PushToggle";
import { vapidPublicKey } from "@/lib/notify";

export const metadata = { title: "الإشعارات" };

export default async function NotificationsPage() {
  const user = await requireRole("PARTICIPANT", "ADMIN");
  const items = await db.notification.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, take: 100 });
  const unread = items.filter((i) => !i.readAt).length;
  return (
    <>
      <PageHeader
        title="الإشعارات"
        actions={
          unread > 0 && (
            <form action={markAllRead}>
              <input type="hidden" name="back" value="/app/notifications" />
              <button className="btn btn-secondary btn-sm">تعليم الكل كمقروء</button>
            </form>
          )
        }
      />
      <div className="mb-4"><PushToggle compact publicKey={await vapidPublicKey()} /></div>
      <NotificationsList items={items} />
    </>
  );
}
