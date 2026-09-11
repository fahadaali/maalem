import { requireRole } from "@/lib/auth";
import { db } from "@/lib/db";
import { PageHeader, Card, Badge, Empty } from "@/components/ui";
import SubmitButton from "@/components/SubmitButton";
import FormMessage from "@/components/FormMessage";
import { saveReminder, deleteReminder, sendReminderNow } from "../actions";
import { formatDateTime, todayKey } from "@/lib/dates";
import { participantsWhere } from "@/lib/cohort";
import { emailEnabled } from "@/lib/email";
import { REMINDER_AUDIENCES as AUDIENCE_LABEL } from "@/lib/reminders";

export const metadata = { title: "التذكيرات المجدولة" };

export default async function RemindersPage({ searchParams }: { searchParams: Promise<{ ok?: string; err?: string }> }) {
  await requireRole("ADMIN");
  const { ok, err } = await searchParams;
  const [reminders, people, mailOn] = await Promise.all([
    db.reminder.findMany({ orderBy: [{ sentAt: "asc" }, { sendAt: "asc" }] }),
    db.user.findMany({ where: await participantsWhere(), orderBy: { name: "asc" }, select: { id: true, name: true } }),
    emailEnabled(),
  ]);
  const names = new Map(people.map((p) => [p.id, p.name]));
  const pending = reminders.filter((r) => !r.sentAt);
  const sent = reminders.filter((r) => r.sentAt).reverse();

  return (
    <>
      <PageHeader
        title="التذكيرات المجدولة"
        subtitle="تذكير خاص تكتبه اليوم ويصل في موعده — كتنبيه بلقاء خبير، أو تمديد مهلة تسليم. التذكيرات الثابتة للبرنامج تعمل من نفسها ولا تحتاج جدولة."
      />
      <FormMessage ok={ok} err={err} />

      <Card title="تذكير جديد" className="mb-4">
        <form action={saveReminder}>
          <div className="grid md:grid-cols-2 gap-x-4">
            <div className="field"><label className="label">العنوان</label><input name="title" className="input" required maxLength={80} placeholder="غداً: لقاء الخبير" /></div>
            <div className="field"><label className="label">الرابط داخل المنصة (اختياري)</label><input name="url" className="input" dir="ltr" placeholder="/program/schedule" /></div>
          </div>
          <div className="field"><label className="label">نص التذكير</label><textarea name="body" className="textarea" rows={2} required maxLength={400} /></div>
          <div className="grid md:grid-cols-4 gap-x-4">
            <div className="field">
              <label className="label">تاريخ الإرسال</label>
              <input type="date" name="date" className="input" dir="ltr" required defaultValue={todayKey()} />
            </div>
            <div className="field"><label className="label">الوقت (الرياض)</label><input type="time" name="time" className="input" dir="ltr" defaultValue="07:00" /></div>
            <div className="field">
              <label className="label">الفئة</label>
              <select name="audience" className="select">
                {Object.entries(AUDIENCE_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
            <div className="field">
              <label className="label">المشارك (عند اختيار «مشارك بعينه»)</label>
              <select name="userId" className="select">
                <option value="">—</option>
                {people.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
          </div>
          <div className="field">
            <label className="label">القناة</label>
            <select name="channels" className="select">
              <option value="PUSH">إشعار في المنصة والجوال، والبريد لمن لا جهاز له</option>
              <option value="PUSH_EMAIL" disabled={!mailOn}>إشعار وبريد للجميع{mailOn ? "" : " (قناة البريد غير مفعّلة)"}</option>
            </select>
          </div>
          <SubmitButton>جدولة التذكير</SubmitButton>
          <p className="text-xs text-muted mt-2">يُفحص الجدول كل ساعة، فيصل التذكير في الساعة التي يحين فيها موعده.</p>
        </form>
      </Card>

      <Card title={`بانتظار الإرسال (${pending.length})`} className="mb-4">
        {pending.length === 0 ? (
          <Empty>لا تذكيرات مجدولة.</Empty>
        ) : (
          <ul className="divide-y divide-line m-0 p-0 list-none">
            {pending.map((r) => (
              <li key={r.id} className="py-3 flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-medium">{r.title}</div>
                  <div className="text-sm text-muted whitespace-pre-wrap">{r.body}</div>
                  <div className="flex gap-1 mt-1 flex-wrap">
                    <Badge>{formatDateTime(r.sendAt)}</Badge>
                    <Badge tone="soft">{r.audience === "ONE" ? names.get(r.userId ?? "") ?? "مشارك" : AUDIENCE_LABEL[r.audience as keyof typeof AUDIENCE_LABEL]}</Badge>
                    {r.channels === "PUSH_EMAIL" && <Badge tone="soft">بريد للجميع</Badge>}
                  </div>
                </div>
                <div className="flex gap-1 shrink-0">
                  <form action={sendReminderNow}>
                    <input type="hidden" name="id" value={r.id} />
                    <SubmitButton secondary className="btn-sm" pendingText="جارٍ الإرسال…">أرسله الآن</SubmitButton>
                  </form>
                  <form action={deleteReminder}>
                    <input type="hidden" name="id" value={r.id} />
                    <SubmitButton ghost className="btn-sm" pendingText="…">حذف</SubmitButton>
                  </form>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card title={`أُرسلت (${sent.length})`}>
        {sent.length === 0 ? (
          <Empty>لم يُرسل تذكير مخصص بعد.</Empty>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>العنوان</th><th>الفئة</th><th>أُرسل</th></tr></thead>
              <tbody>
                {sent.map((r) => (
                  <tr key={r.id}>
                    <td>{r.title}</td>
                    <td>{r.audience === "ONE" ? names.get(r.userId ?? "") ?? "مشارك" : AUDIENCE_LABEL[r.audience as keyof typeof AUDIENCE_LABEL]}</td>
                    <td className="text-muted">{r.sentAt ? formatDateTime(r.sentAt) : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  );
}
