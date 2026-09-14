import Link from "@/components/Link";
import { requireRole } from "@/lib/auth";
import { PageHeader, Card } from "@/components/ui";
import SubmitButton from "@/components/SubmitButton";
import FormMessage from "@/components/FormMessage";
import { notifyWeekChange, saveWeek, saveScheduleTimes } from "../actions";
import { scheduleTimes } from "@/lib/ics";
import Attachments from "@/components/Attachments";
import { listAttachments } from "@/lib/attachments";
import { getWeeks, resolveCurrentWeek } from "@/lib/weeks";
import { SCHEDULE_NOTE } from "@/lib/program";
import { cn } from "@/lib/utils";

export const metadata = { title: "جدول البرنامج" };

export default async function AdminSchedulePage({ searchParams }: { searchParams: Promise<{ week?: string; ok?: string; err?: string }> }) {
  await requireRole("ADMIN");
  const sp = await searchParams;
  const weeks = await getWeeks();
  const cur = resolveCurrentWeek(weeks);
  const parsed = Number(sp.week);
  const selected = sp.week != null && Number.isInteger(parsed) ? parsed : Math.max(0, cur);
  const w = weeks.find((x) => x.number === selected) ?? weeks[0];
  const times = await scheduleTimes();
  // صورة البطاقة تُنسب إلى صفّ الأسبوع نفسه، فتنفصل بين الدفعات تلقائياً
  const cardFiles = w?.id ? await listAttachments({ kind: "WEEKCARD", refId: w.id }) : [];

  return (
    <>
      <PageHeader
        title="جدول البرنامج"
        subtitle="عدّل موعد أي أسبوع ومحتواه ورابط حلقته عن بُعد. الأسبوع الاحتياطي وتأجيل اللقاءات يُداران من هنا."
      />
      <FormMessage ok={sp.ok} err={sp.err} />
      <p className="text-sm text-muted mb-3">{SCHEDULE_NOTE}</p>
      <Card title="مواعيد اللقاءات في تقويم المشاركين" className="mb-4">
        <p className="text-sm text-muted mb-3">
          هذه الساعات تُستعمل في تقويم البرنامج الذي يشترك به المشاركون على جوالاتهم. عدّلها لتطابق مواعيدكم الفعلية.
        </p>
        <form action={saveScheduleTimes}>
          <div className="grid md:grid-cols-4 gap-3">
            <div className="field"><label className="label">بداية اللقاء الحضوري (السبت)</label><input type="time" name="sessionTime" className="input" dir="ltr" defaultValue={times.sessionTime} /></div>
            <div className="field"><label className="label">مدته بالدقائق</label><input type="number" name="sessionMinutes" className="input" dir="ltr" min={15} max={480} defaultValue={times.sessionMinutes} /></div>
            <div className="field"><label className="label">بداية حلقة النقاش (الثلاثاء)</label><input type="time" name="circleTime" className="input" dir="ltr" defaultValue={times.circleTime} /></div>
            <div className="field"><label className="label">مدتها بالدقائق</label><input type="number" name="circleMinutes" className="input" dir="ltr" min={15} max={480} defaultValue={times.circleMinutes} /></div>
          </div>
          <SubmitButton secondary>حفظ المواعيد</SubmitButton>
        </form>
      </Card>
      <div className="flex gap-1 overflow-x-auto pb-3 mb-3 -mx-4 px-4">
        {weeks.map((x) => (
          <Link key={x.number} href={`/admin/schedule?week=${x.number}`} className={cn("badge shrink-0", x.number === selected && "badge-ink", x.number === cur && x.number !== selected && "border-ink")}>
            {x.number === 0 ? "الافتتاحي" : x.number === 13 ? "الختامي" : x.number === 14 ? "احتياطي" : x.number}
          </Link>
        ))}
      </div>
      <Card title={`الأسبوع ${w.label}`} action={w.number === cur ? <span className="badge badge-ink">الأسبوع الحالي</span> : undefined}>
        <form action={saveWeek}>
          <input type="hidden" name="number" value={w.number} />
          <div className="grid md:grid-cols-2 gap-3">
            <div className="field">
              <label className="label">تاريخ اللقاء الحضوري (السبت)</label>
              <input type="date" name="gregorian" className="input" defaultValue={w.gregorian} required />
            </div>
            <div className="field">
              <label className="label">التاريخ الهجري</label>
              <input name="hijri" className="input" defaultValue={w.hijri} />
            </div>
          </div>
          <div className="field">
            <label className="label">الكفاءة</label>
            <input name="competency" className="input" defaultValue={w.competency} />
          </div>
          <div className="field">
            <label className="label">اللقاء الحضوري (ساعتان)</label>
            <textarea name="session" className="textarea" rows={2} defaultValue={w.session} />
          </div>
          <div className="field">
            <label className="label">مكان اللقاء</label>
            <input name="meetingPlace" className="input" defaultValue={w.meetingPlace ?? ""} placeholder="قاعة الجهة" />
          </div>
          <div className="field">
            <label className="label">حلقة النقاش عن بُعد (ساعة)</label>
            <textarea name="circle" className="textarea" rows={2} defaultValue={w.circle} />
          </div>
          <div className="field">
            <label className="label">رابط حلقة النقاش</label>
            <input name="remoteUrl" className="input" dir="ltr" placeholder="https://" defaultValue={w.remoteUrl ?? ""} />
          </div>
          <div className="grid md:grid-cols-2 gap-3">
            <div className="field">
              <label className="label">الورد القرائي</label>
              <input name="reading" className="input" defaultValue={w.reading} />
            </div>
            <div className="field">
              <label className="label">المهمة الأسبوعية</label>
              <input name="task" className="input" defaultValue={w.task} />
            </div>
          </div>
          <div className="field">
            <label className="label">المعايشة الميدانية (ساعة · يوم يختاره المشارك)</label>
            <textarea name="field" className="textarea" rows={2} defaultValue={w.field} placeholder="اتركه فارغاً في الأسابيع التي لا معايشة فيها" />
          </div>
          <div className="field">
            <label className="label">ملاحظة تظهر للمشاركين (تأجيل، تغيير قاعة، ونحوه)</label>
            <input name="note" className="input" defaultValue={w.note ?? ""} />
          </div>
          <SubmitButton>حفظ الأسبوع</SubmitButton>
        </form>
        {w?.id && (
          <div className="mt-3 border-t border-line pt-3">
            <div className="text-sm font-medium mb-1">بطاقة الأسبوع (صورة)</div>
            <p className="text-xs text-muted mb-2">
              تظهر للمشارك تحت بطاقة الأسبوع، يفتحها للمشاركة أو الطباعة. المنصة ترسم البطاقة بنفسها من الحقول أعلاه، وهذه الصورة إضافة إليها.
            </p>
            <Attachments kind="WEEKCARD" refId={w.id} initial={cardFiles} />
          </div>
        )}
        <form action={notifyWeekChange} className="mt-3 border-t border-line pt-3">
          <input type="hidden" name="number" value={w.number} />
          <SubmitButton secondary className="btn-sm">إشعار المشاركين بالتحديث</SubmitButton>
        </form>
      </Card>
    </>
  );
}
