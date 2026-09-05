import { requireRole } from "@/lib/auth";
import { db } from "@/lib/db";
import { PageHeader, Card } from "@/components/ui";
import SubmitButton from "@/components/SubmitButton";
import FormMessage from "@/components/FormMessage";
import NotificationsList from "@/components/NotificationsList";
import { markAdminRead, sendNotification } from "../actions";
import { currentWeek } from "@/lib/dates";
import { pushEnabled } from "@/lib/notify";

export const metadata = { title: "الإشعارات" };

export default async function AdminNotificationsPage({ searchParams }: { searchParams: Promise<{ ok?: string; err?: string }> }) {
  const me = await requireRole("ADMIN");
  const { ok, err } = await searchParams;
  const [users, inbox, subs] = await Promise.all([
    db.user.findMany({ where: { active: true }, orderBy: { name: "asc" }, select: { id: true, name: true, role: true } }),
    db.notification.findMany({ where: { userId: me.id }, orderBy: { createdAt: "desc" }, take: 50 }),
    db.pushSubscription.count(),
  ]);
  const week = currentWeek();
  const templates = week
    ? [
        { title: "تذكير الورد والمهمة الأسبوعية", body: `الورد: ${week.reading}. المهمة: ${week.task}.`, url: "/app/reading" },
        { title: "حلقة النقاش عن بُعد الليلة", body: week.circle, url: "/app/quizzes" },
        { title: "تسليم التقرير الأسبوعي", body: "موعد التسليم الخميس قبل الساعة العاشرة مساءً.", url: "/app/reports" },
      ]
    : [];

  return (
    <>
      <PageHeader title="الإشعارات" subtitle={`إشعارات الدفع ${(await pushEnabled()) ? "مفعّلة" : "غير متاحة (تعمل الإشعارات داخل المنصة فقط)"} · ${subs} جهاز مشترك`} />
      <FormMessage ok={ok} err={err} />
      <div className="grid md:grid-cols-2 gap-4 items-start">
        <Card title="إرسال إشعار">
          <form action={sendNotification}>
            <div className="field">
              <label className="label">إلى</label>
              <select name="target" className="select" defaultValue="participants">
                <option value="participants">جميع المشاركين</option>
                <option value="mentors">المشرفون المرافقون</option>
                <option value="all">الجميع</option>
                {users.map((u) => <option key={u.id} value={`user:${u.id}`}>{u.name}</option>)}
              </select>
            </div>
            <div className="field"><label className="label">العنوان</label><input name="title" className="input" required list="tpl-titles" /></div>
            <div className="field"><label className="label">النص</label><textarea name="body" className="textarea" required /></div>
            <div className="field"><label className="label">رابط داخل المنصة (اختياري)</label><input name="url" className="input" dir="ltr" placeholder="/app/reports" /></div>
            <SubmitButton>إرسال</SubmitButton>
          </form>
          {templates.length > 0 && (
            <div className="mt-4 border-t border-line pt-3">
              <div className="text-xs text-muted mb-2">قوالب سريعة لهذا الأسبوع</div>
              <div className="space-y-2">
                {templates.map((t) => (
                  <form key={t.title} action={sendNotification} className="flex items-center justify-between gap-2 text-sm">
                    <input type="hidden" name="target" value="participants" />
                    <input type="hidden" name="title" value={t.title} />
                    <input type="hidden" name="body" value={t.body} />
                    <input type="hidden" name="url" value={t.url} />
                    <span className="truncate">{t.title}</span>
                    <SubmitButton secondary className="btn-sm shrink-0">إرسال</SubmitButton>
                  </form>
                ))}
              </div>
            </div>
          )}
          <p className="text-xs text-muted mt-4">التذكيرات التلقائية (السبت، الأحد، الثلاثاء، الخميس، الجمعة، والقراءة اليومية) تُرسل يومياً من مشغّل Cron دون تدخل.</p>
        </Card>
        <Card title="واردي" action={inbox.some((n) => !n.readAt) && <form action={markAdminRead}><button className="btn btn-ghost btn-sm">تعليم الكل كمقروء</button></form>}>
          <NotificationsList items={inbox} />
        </Card>
      </div>
    </>
  );
}
