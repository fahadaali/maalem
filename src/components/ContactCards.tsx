import { db } from "@/lib/db";
import { headers } from "next/headers";
import { Card } from "@/components/ui";
import SubmitButton from "@/components/SubmitButton";
import CalendarSubscribe from "@/components/CalendarSubscribe";
import { emailEnabled } from "@/lib/email";
import { updateContactPrefs, refreshCalendarLink } from "@/app/(auth)/actions";

/** بطاقتا تنبيهات البريد واشتراك التقويم — مشتركة بين إعدادات المشارك والمشرف ومدير المشروع */
export default async function ContactCards({ userId, back }: { userId: string; back: string }) {
  const me = await db.user.findUnique({ where: { id: userId }, select: { email: true, emailOptIn: true, calendarToken: true } });
  const mailOn = await emailEnabled();
  const h = await headers();
  const proto = h.get("x-forwarded-proto") ?? (h.get("host")?.startsWith("localhost") ? "http" : "https");
  const appUrl = (process.env.APP_URL || `${proto}://${h.get("host") ?? "localhost"}`).replace(/\/$/, "");

  return (
    <>
      <Card title="تنبيهات البريد الإلكتروني">
        <p className="text-sm text-muted mb-3">
          {mailOn
            ? "قناة احتياطية: إن لم تُفعّل إشعارات جهازك، أو أوقفتها، يصلك التنبيه على بريدك."
            : "قناة البريد غير مفعّلة في المنصة بعد. يمكنك حفظ بريدك الآن ليصلك التنبيه حين تُفعَّل."}
        </p>
        <form action={updateContactPrefs}>
          <input type="hidden" name="back" value={back} />
          <div className="field">
            <label className="label">البريد الإلكتروني</label>
            <input type="email" name="email" className="input" dir="ltr" defaultValue={me?.email ?? ""} placeholder="name@example.com" />
          </div>
          <label className="flex items-center gap-2 text-sm mb-3">
            <input type="checkbox" name="emailOptIn" defaultChecked={me?.emailOptIn ?? true} />
            أرغب في استقبال التنبيهات على بريدي
          </label>
          <SubmitButton secondary>حفظ</SubmitButton>
        </form>
      </Card>
      <Card title="مواعيد البرنامج في تقويم جوالي">
        <p className="text-sm text-muted mb-3">
          اشترك بالرابط مرة واحدة، فتظهر اللقاءات والحلقات ومواعيد التسليم في تقويمك، وتتحدّث تلقائياً مع أي تعديل في الجدول.
        </p>
        {me?.calendarToken ? (
          <>
            <CalendarSubscribe url={`${appUrl}/api/calendar/${me.calendarToken}.ics`} />
            <form action={refreshCalendarLink} className="mt-3">
              <input type="hidden" name="back" value={back} />
              <SubmitButton ghost className="btn-sm !px-0">توليد رابط جديد (يُبطل السابق)</SubmitButton>
            </form>
          </>
        ) : (
          <form action={refreshCalendarLink}>
            <input type="hidden" name="back" value={back} />
            <SubmitButton secondary>إنشاء رابط التقويم</SubmitButton>
          </form>
        )}
      </Card>
    </>
  );
}
